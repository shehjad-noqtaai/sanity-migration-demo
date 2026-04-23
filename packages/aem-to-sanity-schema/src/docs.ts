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

## Type-aware coercion at transform

AEM's JCR is schemaless on dialog inputs: \`.infinity.json\` serializes everything authored through a dialog widget as a **JSON string**, regardless of what the dialog thinks the type is. A numberfield storing \`10\` lands as \`"10"\`; a checkbox lands as \`"true"\` / \`"false"\`; a richtext widget lands as an HTML string. The emitted Sanity schemas declare proper types (\`number\`, \`boolean\`, \`array-of-blocks\`), so without coercion the Studio rejects every ingested value with "Expected type X, got String".

\`content-type-registry.json\` records each field's Sanity type as a tree (\`fields: Array<{name, type, itemFields?}>\`) so \`aem-transform\` can coerce at any depth. Nested array-of-object members carry their own field types under \`itemFields\`; the coercion pass recurses into every multifield item, so richtext / number / boolean inside a \`variableColumn.columnContents[]\` row is treated the same as a top-level field.

**Map-shaped multifields.** AEM stores multifield rows in two shapes: the canonical ordered form (child keys \`item0\` / \`item1\` / ...) and a named-key form where each row lives under a meaningful key (e.g. \`colors: { weddingDresses: {...}, bridesmaidDresses: {...} }\` on \`color-carousel\`). The ordered form is materialized during \`transformInline\` by \`deepCoerceAemMultifieldMapsToArrays\`; the named-key form is materialized during \`coerceFieldTypes\` whenever the registry declares a field as \`array-of-object\` but the value is a plain object — \`Object.values\` preserves authored order (JSON key order as emitted by AEM).

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
