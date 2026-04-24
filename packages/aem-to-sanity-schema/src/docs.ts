import { writeTextFile } from "aem-to-sanity-core";
import { MAPPING } from "./mapping-table.ts";

export async function writeMappingDocs(outputFile: string): Promise<void> {
  const rows = Object.entries(MAPPING)
    .map(
      ([aemType, entry]) =>
        `| \`${aemType}\` | \`${entry.kind}\` | ${entry.description} |`,
    )
    .join("\n");

  const md = `# AEM → Sanity field mapping

> Auto-generated from \`packages/aem-to-sanity-schema/src/mapping-table.ts\` on every \`pnpm migrate:schema\` run. Do not edit by hand — update the mapping table and re-run.

Each AEM Granite UI \`sling:resourceType\` is mapped to a Sanity field kind. Unknown types become a string placeholder and are reported in \`output/migration-report.json\` so you can extend the table.

| AEM resource type | Sanity kind | Description |
|---|---|---|
${rows}

## Fallback behaviour

- **Unknown resource type** → emitted as a \`string\` field with a TODO description and recorded under \`unmapped\` in the run report.
- **Missing \`name\`** → field is skipped and recorded.
- **Hidden field** → skipped (not emitted, not a failure).

## Composite multifields (dialog + authored JCR)

When a dialog node has \`sling:resourceType\`: \`granite/ui/components/coral/foundation/form/multifield\` and \`composite\` is \`true\`, AEM stores authored values under a **persisted property** named by the nested **\`field\`** child (usually a fieldset), **not** by the Granite sibling key under \`items\`:

1. **Property name** — Read \`field.name\` (e.g. \`./videos\`, \`./textAsImages\`). Strip a leading \`./\` (Granite “current node” prefix) and normalize to camelCase so it matches page JSON keys and Sanity fields (same rules as other dialog \`name\` values).
2. **Repeating rows** — Under that property, each row is a child node keyed \`item0\`, \`item1\`, … (or sometimes \`0\`, \`1\`, …). Each item is \`nt:unstructured\` and repeats the inner fieldset’s field names (e.g. \`fileReference\`, \`visible\`, \`videoFormat\`). For \`cq/gui/components/authoring/dialog/fileupload\`, the DAM path is stored on the property named by \`fileReferenceParameter\` (often \`./fileReference\` → \`fileReference\`), not necessarily on the widget’s own \`name\` (e.g. \`./video\`).
3. **Schema** — \`aem-to-sanity-schema\` maps multifield → Sanity \`array\` of objects. The array field uses that inner \`field.name\` for \`defineField({ name })\`, uses the multifield’s \`fieldLabel\` for Studio titles, and emits row object titles from \`fieldLabel\` (see \`multifieldArrayPropertyName\` / multifield handling in \`mapper.ts\`).
4. **Content** — \`aem-transform\` (\`aem-to-sanity-content\`) inlines components, then \`deepCoerceAemMultifieldMapsToArrays\` turns any object whose keys are exclusively \`itemN\` / numeric indices into a JSON **array** so it matches Sanity \`array\` types. Scalar keys still use dialog \`name\` when the JCR sibling key differs (\`sanityPropertyKeyFromAemChild\` in \`transform.ts\`).

## Named slots (auto-discovered)

Some AEM components embed a **single named child component** under a fixed JCR key — e.g. \`aem-integration/components/media-paragraph\` has a \`content\` child whose own \`sling:resourceType\` is \`aem-integration/components/content\`. That's not a dialog field, and it's not a \`cq:isContainer\` drop-zone either; it's a named slot. The dialog itself doesn't describe it, so the shape only shows up in authored content.

\`migrate:schema\` runs a post-extract scan of \`output/cache/raw/*.json\` (the output of \`aem-extract\`) and records every \`parentResourceType → slotKey → childResourceType\` combo it sees. For each one it appends a \`defineField({ name: slotKey, type: childTypeName })\` to the parent schema so the Studio shows the slot as a first-class typed field rather than flagging it as an "Unknown field found".

- **First run has no raw content** → scan returns empty, no slot fields emitted. Run \`aem-extract\` then re-run \`migrate:schema\`; the second pass picks up every slot.
- **Dialog field with the same name** → dialog field wins; slot synthesis skipped.
- **Container parents** (listed in \`aem-component-containers.json\`) skip slot synthesis entirely — their drop-zone children are already claimed by \`childrenField\`, and author-generated JCR keys like \`item_1657754806454\` would otherwise pollute the schema with one defineField per instance.
- **Multiple child types** seen at the same slot → skipped + warned; the pipeline won't guess which type to reference. Transform still writes the nested block under the JCR key so data isn't lost; the Studio keeps flagging "Unknown field" until a human authors the field.
- **Unmapped child type** (not in \`aem-component-paths\`) → skipped + warned. Add the path to the list, re-run \`migrate:schema\`.

The content transform always emits nested child components under their JCR key (single-object under the slot key, same \`_type\` + \`_key\` + coercion pipeline as top-level blocks), regardless of whether the schema has a matching \`slot-reference\` field yet. So data flows correctly on the first run; the second \`migrate:schema\` upgrades "Unknown field" warnings to typed fields in the Studio.

## Container components (\`cq:isContainer\`)

Some AEM components are containers: authors drop child components into them via the page editor instead of declaring the children as a dialog multifield. The canonical examples are \`aem-integration/components/expander\`, \`container\`, \`column-layout\`, and \`box\`. Their JCR nodes mix dialog values (\`theme\`, \`singleExpansion\`, …) with child keys like \`item_1657754806454\`, each of which is itself a full component instance with its own \`sling:resourceType\`.

AEM marks these with \`cq:isContainer=true\` in component definitions, but that flag isn't in the dialog payload — so the migration mirrors it explicitly in \`aem-component-containers.json\` (override via \`AEM_COMPONENT_CONTAINERS_FILE\`):

\`\`\`json
{
  "aem-integration/components/expander":     { "childrenField": "items" },
  "aem-integration/components/box":          { "childrenField": "items" },
  "aem-integration/components/column-layout":{ "childrenField": "items" },
  "aem-integration/components/container":    { "childrenField": "items" }
}
\`\`\`

- **Schema side:** \`migrate:schema\` appends \`defineField({ name: childrenField, title: "Items", type: "pageBuilder" })\` to each listed component so the palette inside the container matches the top-level page builder. Name collisions with a dialog-declared field skip the append (dialog field wins).
- **Content side:** \`aem-transform\` descends into the container node's direct child keys that themselves carry a \`sling:resourceType\`, recursively emits each as a pageBuilder block (full \`_type\` / \`_key\` / coercion pipeline), and stores the array under \`childrenField\`. Children without \`sling:resourceType\` stay inline on the container so multifield handling keeps working.

Containers nest without special-casing — expander → box → content → Portable Text roundtrips through the same recursive call. Missing file → container behavior stays off. Malformed JSON / invalid entries are a hard error so a typo doesn't silently drop children.

## Type-aware coercion at transform

AEM's JCR is schemaless on dialog inputs: \`.infinity.json\` serializes everything authored through a dialog widget as a **JSON string**, regardless of what the dialog thinks the type is. A numberfield storing \`10\` lands as \`"10"\`; a checkbox lands as \`"true"\` / \`"false"\`; a richtext widget lands as an HTML string. The emitted Sanity schemas declare proper types (\`number\`, \`boolean\`, \`array-of-blocks\`), so without coercion the Studio rejects every ingested value with "Expected type X, got String".

\`content-type-registry.json\` records each field's Sanity type as a tree (\`fields: Array<{name, type, itemFields?}>\`) so \`aem-transform\` can coerce at any depth. Nested array-of-object members carry their own field types under \`itemFields\`; the coercion pass recurses into every multifield item, so richtext / number / boolean inside a \`variableColumn.columnContents[]\` row is treated the same as a top-level field.

**Map-shaped multifields.** AEM stores multifield rows in two shapes: the canonical ordered form (child keys \`item0\` / \`item1\` / ...) and a named-key form where each row lives under a meaningful key (e.g. \`colors: { weddingDresses: {...}, bridesmaidDresses: {...} }\` on \`color-carousel\`). The ordered form is materialized during \`transformInline\` by \`deepCoerceAemMultifieldMapsToArrays\`; the named-key form is materialized during \`coerceFieldTypes\` whenever the registry declares a field as \`array-of-object\` but the value is a plain object — \`Object.values\` preserves authored order (JSON key order as emitted by AEM).

**Dialog-runtime metadata.** AEM writes bookkeeping flags next to authored fields that have no Sanity counterpart — e.g. \`textIsRich: "true"\` sits alongside every richtext value so the AEM runtime knows to render it as HTML. These are dropped during \`transformInline\` (\`AEM_DIALOG_RUNTIME_KEYS\` in \`transform.ts\`) so they don't surface in the Studio as "Unknown field found". Add new entries to that set as more leaks show up; they should stay a narrow allowlist, not a blanket string-value filter.

### Richtext → Portable Text

Both richtext variants — \`cq/gui/components/authoring/dialog/richtext\` (legacy) and \`granite/ui/components/coral/foundation/form/richtext\` (Coral) — map to \`array-of-blocks\`. When the ingested value is a string, \`aem-transform\` parses it as HTML via \`@portabletext/block-tools\` (with \`jsdom\` as the DOM):

- Decorators preserved: \`strong\`, \`em\`, \`underline\`, \`strike-through\`, \`code\`.
- Styles preserved: \`normal\`, \`h1\`–\`h4\`, \`blockquote\`.
- Lists preserved: \`bullet\`, \`number\`.
- \`<a href="...">\` preserved as a \`link\` annotation with an \`href\` field.
- \`_key\`s derived from SHA1 of \`{jcrPath}::{fieldName}:{counter}\` so re-runs produce byte-identical clean docs (deterministic-diff invariant).
- Parser failure leaves the original string in place — no silent data loss.

### Number and boolean

AEM stores numberfield values as strings (\`"10"\`) and checkbox values as literal \`"true"\` / \`"false"\` strings. \`aem-transform\` coerces when the declared Sanity type is \`number\` or \`boolean\`:

- \`number\` → \`Number(v)\`; kept as-is on \`NaN\`.
- \`boolean\` → \`true\` when value is the literal string \`"true"\`, \`false\` when \`"false"\`; kept as-is otherwise. Unrecognized literals surface as Studio validation errors rather than being silently remapped (e.g. \`"yes"\`, \`"1"\`, \`""\` are not assumed).

### Legacy registries

\`content-type-registry.json\` files written before type-info was recorded (\`fields: string[]\`) still load, but every coercion step is skipped — Studio will reject the values. Regenerate via \`pnpm migrate:schema\` to opt in.

## Authoring dialog file upload (\`cq/gui/components/authoring/dialog/fileupload\`)

When \`fileReferenceParameter\` is present (e.g. \`./fileReference\`), AEM stores the DAM path on that property in page JSON (often \`/content/dam/...\`). The widget \`name\` (e.g. \`./video\`) is not where the path is persisted.

**Schema** — If \`fileReferenceParameter\` is set, the migrator emits **two** fields in order:

1. **\`{name}AemPath\`** — \`string\`, \`readOnly: true\`, holds the migrated AEM path for traceability in Studio.
2. **\`{name}\`** — \`image\` when all \`mimeTypes\` are \`image/*\`, otherwise \`file\` (e.g. video). **\`required\`** from AEM applies only here so authors attach a Sanity asset.

If \`fileReferenceParameter\` is omitted, a single image/file field is emitted (legacy behaviour).

**Content + assets** — \`aem-transform\` moves \`/content/dam/...\` strings from \`{name}\` onto \`{name}AemPath\` using \`content-type-registry.json\` (field names include **nested** multifield/array member fields via \`flattenSchemaFieldNames\` in \`mapper.ts\`). \`aem-assets\` uploads binaries and replaces \`{name}\` with a Sanity asset reference object, while **leaving** \`{name}AemPath\` strings untouched (\`rewriteDamRefs\` in \`assets.ts\`).
`;

  await writeTextFile(outputFile, md);
}
