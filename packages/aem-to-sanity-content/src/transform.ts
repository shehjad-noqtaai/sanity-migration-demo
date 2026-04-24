#!/usr/bin/env node
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  createColors,
  loadContainerConfig,
  startTimer,
  type ContainerConfig,
} from "aem-to-sanity-core";
import { htmlToBlocks } from "@portabletext/block-tools";
import { compileSchema, defineSchema, type Schema } from "@portabletext/schema";
import { JSDOM } from "jsdom";

interface AemNode {
  [key: string]: unknown;
  "sling:resourceType"?: string;
  "jcr:uuid"?: string;
}
interface RegistryFieldWire {
  name: string;
  type?: string;
  itemFields?: RegistryFieldWire[];
}
/**
 * Registry entry as written on disk. Supports three shapes for back-compat:
 *   - Legacy: `fields: string[]` — names only, no coercion downstream.
 *   - Flat typed: `fields: Array<{name, type}>` — top-level coercion only.
 *   - Tree typed (current): `fields: Array<{name, type, itemFields?}>` —
 *     nested array-of-object members carry their own field types, so
 *     coercion walks into multifield items (variableColumn > columnContents
 *     > columnText richtext etc.).
 * Entries are normalized into {@link NormalizedRegistryEntry} at load.
 */
interface RegistryEntry {
  resourceType: string;
  sanityType: string;
  fields?: Array<string | RegistryFieldWire>;
}
interface FieldTypeNode {
  type: string;
  itemFields?: Map<string, FieldTypeNode>;
}
interface NormalizedRegistryEntry {
  resourceType: string;
  sanityType: string;
  fieldNames: string[];
  /** `name → type (+ nested itemFields)`. Empty for legacy string[] entries. */
  fieldTypes: Map<string, FieldTypeNode>;
}
interface RawFile {
  jcrPath: string;
  slug?: string;
  fetchedAt: string;
  tree: AemNode;
}
interface PageBuilderItem {
  _type: string;
  _key: string;
  [key: string]: unknown;
}
interface PageDoc {
  _id: string;
  _type: "page";
  title: string;
  slug: { _type: "slug"; current: string };
  pageBuilder: PageBuilderItem[];
}

const JCR_METADATA = new Set<string>([
  "jcr:primaryType",
  "jcr:mixinTypes",
  "jcr:uuid",
  "jcr:created",
  "jcr:createdBy",
  "jcr:lastModified",
  "jcr:lastModifiedBy",
  "cq:lastModified",
  "cq:lastModifiedBy",
  "cq:lastReplicated",
  "cq:lastReplicatedBy",
  "cq:lastReplicationAction",
  "sling:resourceType",
  "sling:resourceSuperType",
]);

/**
 * Dialog-runtime metadata that AEM writes alongside authored values but
 * that have no Sanity schema counterpart. Dropped during `transformInline`
 * the same way JCR metadata is.
 *
 * - `textIsRich`: a hint AEM adds next to richtext fields so the runtime
 *   knows to render them as rich HTML. We already convert those fields to
 *   Portable Text via `coerceFieldTypes`; the flag is noise that would
 *   otherwise surface in the Studio as "Unknown field found".
 */
const AEM_DIALOG_RUNTIME_KEYS = new Set<string>(["textIsRich"]);

/**
 * AEM structural wrappers we always recurse through — the page root and the
 * responsive-grid container. These never become Sanity blocks on their own;
 * the transform walker descends into their children. Listing them here lets
 * the CLI hide them from the "unmapped components" callout so every row there
 * is an actionable missing schema, not known passthrough noise. The JSON
 * report still records them for completeness.
 */
const AEM_STRUCTURAL_PASSTHROUGH_TYPES = new Set<string>([
  "aem-integration/components/page",
  "wcm/foundation/components/responsivegrid",
]);

const MAX_DEPTH = 512;

/**
 * Read-only DAM path fields from fileupload mapping (`{name}AemPath`).
 * Must match `AEM_FILE_UPLOAD_PATH_FIELD_SUFFIX` in `aem-to-sanity-schema` mapper.
 */
const AEM_FILE_UPLOAD_PATH_FIELD_SUFFIX = "AemPath";

/** Sanity document / object attribute names; AEM often emits `cq:*` on nodes. */
const SANITY_ATTRIBUTE_KEY = /^\$?[a-zA-Z0-9_-]+$/;

function isValidSanityAttributeKey(key: string): boolean {
  return SANITY_ATTRIBUTE_KEY.test(key);
}

/**
 * Same camelCase rules as schema generation (`aem-to-sanity-schema` naming) so
 * `./lineOneTextFontFamily` → `lineOneTextFontFamily`, not `lineonetextfontfamily`.
 */
function toCamelCase(input: string): string {
  const spaced = input
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
  const words = spaced.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

/**
 * Granite dialog nodes declare the persisted property as `name` (often
 * `./contentPosition`). Page `.infinity.json` usually already uses that final
 * key, but when the JCR sibling key differs (e.g. `align` vs `./textAlign`),
 * use `name` so migrated documents match emitted Sanity schemas.
 */
function sanityPropertyKeyFromAemChild(
  child: AemNode,
  jcrSiblingKey: string,
): string {
  const raw = asString(child.name);
  if (!raw) return jcrSiblingKey;
  const stripped = raw.replace(/^\.\//, "").replace(/\//g, "_");
  if (!stripped) return jcrSiblingKey;
  return toCamelCase(stripped);
}

function loadRegistry(path: string): Map<string, NormalizedRegistryEntry> {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const entries = Array.isArray(raw)
    ? (raw as RegistryEntry[])
    : raw && typeof raw === "object" && Array.isArray((raw as { entries?: unknown }).entries)
      ? ((raw as { entries: RegistryEntry[] }).entries)
      : null;
  if (!entries) {
    throw new Error(`${path}: expected RegistryEntry[] or { entries: RegistryEntry[] }`);
  }
  const map = new Map<string, NormalizedRegistryEntry>();
  for (const e of entries) map.set(e.resourceType, normalizeRegistryEntry(e));
  return map;
}

function normalizeRegistryEntry(e: RegistryEntry): NormalizedRegistryEntry {
  const fieldNames: string[] = [];
  const fieldTypes = buildFieldTypeTree(e.fields, fieldNames);
  return {
    resourceType: e.resourceType,
    sanityType: e.sanityType,
    fieldNames,
    fieldTypes,
  };
}

function buildFieldTypeTree(
  fields: RegistryEntry["fields"],
  collectNames?: string[],
): Map<string, FieldTypeNode> {
  const out = new Map<string, FieldTypeNode>();
  for (const f of fields ?? []) {
    if (typeof f === "string") {
      collectNames?.push(f);
      continue;
    }
    collectNames?.push(f.name);
    if (!f.type) continue;
    const node: FieldTypeNode = { type: f.type };
    if (f.itemFields?.length) {
      // Recurse with the same collector so nested member names (e.g.
      // `fileReference` / `fileReferenceAemPath` inside a multifield item)
      // also land in the flat `fieldNames` list. `splitAemFileUploadDamPaths`
      // uses that list to find `*AemPath` pairs at any depth during its
      // recursive walk; without nested names the split never moves the
      // DAM string off the asset field and the downstream link rewrite
      // has nothing to fill in.
      node.itemFields = buildFieldTypeTree(f.itemFields, collectNames);
    }
    out.set(f.name, node);
  }
  return out;
}

function normalizeExceptionKey(v: string): string {
  const trimmed = v.trim().replace(/^\/+/, "");
  if (trimmed.startsWith("apps/")) return trimmed.slice("apps/".length);
  return trimmed;
}

function readExceptionResourceTypes(file: string): Set<string> {
  try {
    const raw = readFileSync(file, "utf8");
    return new Set(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"))
        .map(normalizeExceptionKey),
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Set();
    throw err;
  }
}

function pathToDocId(jcrPath: string): string {
  const normalized = jcrPath.replace(/^\/+/, "");
  const rawSlug = normalized.replace(/\//g, ".");
  const safeSlug = rawSlug.replace(/[^A-Za-z0-9_.-]/g, "-");
  if (safeSlug === rawSlug && safeSlug.length <= 80) return safeSlug;
  const hash = createHash("sha1").update(jcrPath).digest("hex").slice(0, 10);
  return `${safeSlug.slice(0, 60).replace(/[.-]+$/, "")}.${hash}`;
}

function stableKey(jcrUuid: string | undefined, jcrPath: string): string {
  if (jcrUuid && jcrUuid.length > 0) return jcrUuid.replace(/-/g, "").slice(0, 16);
  return createHash("sha1").update(jcrPath).digest("hex").slice(0, 16);
}

/**
 * For a container node, the list of direct child keys that are themselves
 * full AEM components (have a `sling:resourceType`). These are the drop-zone
 * items that become pageBuilder blocks inside the container, NOT inline
 * fields. Ordered by JCR insertion order (JavaScript object-key iteration).
 */
function collectContainerChildKeys(node: AemNode): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (!isChildNode(value)) continue;
    const childType = asString((value as AemNode)["sling:resourceType"]);
    if (!childType) continue;
    out.push(key);
  }
  return out;
}

/**
 * Named-slot keys for the current node: direct children that are themselves
 * AEM component instances (carry `sling:resourceType`) under a JCR key
 * that isn't already claimed by container logic. Each hit becomes one
 * nested block under that key at transform time — the schema side
 * discovers the same shape offline by scanning extracted content
 * (`packages/aem-to-sanity-schema/src/slots.ts`) and appends a matching
 * typed `slot-reference` field so the Studio shows the slot as
 * first-class content.
 *
 * Intentionally NOT filtering by dialog-declared field names: once
 * schema-side slot discovery runs, the registry's `fieldNames` includes
 * the slot key (as a `slot-reference` type). If we excluded declared
 * field names here, the nested block would round-trip through
 * `transformInline` as raw inline data and lose its `_type` + richtext
 * coercion. Having `sling:resourceType` on the child is the reliable
 * signal that it's a component instance, not dialog data — dialog
 * multifield rows are plain `nt:unstructured` nodes without
 * sling:resourceType, so they're never mistaken for slots.
 */
function collectSlotKeys(
  node: AemNode,
  containerChildKeys: string[] | null,
): string[] {
  const containerClaim = new Set(containerChildKeys ?? []);
  const out: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (containerClaim.has(key)) continue;
    if (!isChildNode(value)) continue;
    const childType = asString((value as AemNode)["sling:resourceType"]);
    if (!childType) continue;
    out.push(key);
  }
  return out;
}

function stripKeys(node: AemNode, keys: string[]): AemNode {
  if (keys.length === 0) return node;
  const skip = new Set(keys);
  const out: AemNode = {};
  for (const [k, v] of Object.entries(node)) {
    if (skip.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function isChildNode(value: unknown): value is AemNode {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value as { __truncated?: unknown }).__truncated
  );
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

interface TransformContext {
  visited: WeakSet<object>;
  depth: number;
  registry: Map<string, NormalizedRegistryEntry>;
  audit: Audit;
  /** Resource types whose drop-zone children should be emitted under `childrenField`. */
  containers: ContainerConfig;
}

/**
 * AEM composite multifield (`granite/.../form/multifield` + `composite: true`):
 * authored data lives under the inner `field.name` property (see schema
 * `multifieldArrayPropertyName`); each row is `item0`, `item1`, … (or `0`, `1`)
 * until we coerce to a JSON array below.
 */
const AEM_MULTIFIELD_ITEM_KEY = /^item\d+$/i;
const AEM_MULTIFIELD_NUMERIC_KEY = /^\d+$/;

function isAemMultifieldItemKey(k: string): boolean {
  return AEM_MULTIFIELD_ITEM_KEY.test(k) || AEM_MULTIFIELD_NUMERIC_KEY.test(k);
}

function multifieldItemOrder(a: string, b: string): number {
  const mA = a.match(/^item(\d+)$/i);
  const mB = b.match(/^item(\d+)$/i);
  const na = mA ? parseInt(mA[1]!, 10) : parseInt(a, 10);
  const nb = mB ? parseInt(mB[1]!, 10) : parseInt(b, 10);
  return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
}

function isAemMultifieldItemMap(o: Record<string, unknown>): boolean {
  const keys = Object.keys(o);
  if (keys.length === 0) return false;
  const itemLike = keys.filter((k) => k !== "_key");
  if (itemLike.length === 0) return false;
  return itemLike.every((k) => isAemMultifieldItemKey(k));
}

/**
 * Move migrated DAM strings from `{base}` → `{base}AemPath` so asset fields
 * stay empty until `aem-assets` fills Sanity refs (see fileupload schema pair).
 */
function splitAemFileUploadDamPaths(
  value: unknown,
  fieldNames: string[] | undefined,
): void {
  if (!fieldNames?.length) return;
  const fieldSet = new Set(fieldNames);
  function walk(o: unknown): void {
    if (Array.isArray(o)) {
      for (const x of o) walk(x);
      return;
    }
    if (!o || typeof o !== "object") return;
    if ((o as { __truncated?: unknown }).__truncated) return;
    const rec = o as Record<string, unknown>;
    for (const f of fieldSet) {
      if (!f.endsWith(AEM_FILE_UPLOAD_PATH_FIELD_SUFFIX)) continue;
      const base = f.slice(0, -AEM_FILE_UPLOAD_PATH_FIELD_SUFFIX.length);
      if (!base) continue;
      const v = rec[base];
      if (typeof v === "string" && v.startsWith("/content/dam/")) {
        if (rec[f] === undefined) rec[f] = v;
        delete rec[base];
      }
    }
    for (const v of Object.values(rec)) walk(v);
  }
  walk(value);
}

/**
 * Default Portable Text schema used to compile AEM richtext HTML into Sanity
 * blocks. Matches the shape our emitter produces for `array-of-blocks` fields
 * (`{ type: "array", of: [{ type: "block" }] }`): Sanity's default decorators
 * + styles + lists + a `link` annotation. Kept module-level so every call
 * reuses the same compiled schema — the compile pass is not free.
 */
const PORTABLE_TEXT_SCHEMA: Schema = compileSchema(
  defineSchema({
    decorators: [
      { name: "strong" },
      { name: "em" },
      { name: "underline" },
      { name: "strike-through" },
      { name: "code" },
    ],
    styles: [
      { name: "normal" },
      { name: "h1" },
      { name: "h2" },
      { name: "h3" },
      { name: "h4" },
      { name: "blockquote" },
    ],
    lists: [{ name: "bullet" }, { name: "number" }],
    annotations: [
      { name: "link", fields: [{ name: "href", type: "string" }] },
    ],
  }),
);

const parseHtml = (html: string): Document =>
  new JSDOM(html, { contentType: "text/html" }).window.document;

/**
 * Deterministic `_key` generator for a single htmlToBlocks call. Seeds a
 * SHA1 stream with `{seed}:{counter}` so re-running the transform on
 * byte-identical input produces byte-identical Portable Text — preserving
 * the "re-runs produce clean git diffs" invariant that makes this pipeline
 * usable in CI.
 */
function deterministicKeyGen(seed: string): () => string {
  let counter = 0;
  return () =>
    createHash("sha1")
      .update(`${seed}:${counter++}`)
      .digest("hex")
      .slice(0, 12);
}

/**
 * Convert an AEM richtext HTML string into Portable Text blocks. Returns
 * `null` on parser failure so the caller can keep the original string and
 * surface the failure via the audit — never drops content silently.
 */
function htmlStringToPortableText(
  html: string,
  seed: string,
): unknown[] | null {
  try {
    return htmlToBlocks(html, PORTABLE_TEXT_SCHEMA, {
      parseHtml,
      keyGenerator: deterministicKeyGen(seed),
    }) as unknown[];
  } catch {
    return null;
  }
}

/**
 * In-place coercion: for every field the registry declares a type on,
 * coerce the ingested AEM value to match that type. Walks nested
 * array-of-object members using the registry's `itemFields` tree so
 * multifield items (e.g. `variableColumn.columnContents[].columnText`)
 * get the same treatment as top-level fields.
 *
 * AEM's JCR is schemaless on dialog inputs — `.infinity.json` serializes
 * every authored value as a JSON string regardless of widget type:
 *   - richtext → HTML string   → Portable Text blocks (`array-of-blocks`)
 *   - numberfield → `"10"`     → `number`
 *   - checkbox  → `"true"`     → `boolean`
 *
 * Keep-original contract: if parsing fails (NaN number, unrecognized
 * boolean literal, HTML parser error), leave the original value in place
 * so the mismatch surfaces as a Studio validation error rather than
 * being silently overwritten with a fake value.
 */
function coerceFieldTypes(
  inline: Record<string, unknown>,
  fieldTypes: Map<string, FieldTypeNode>,
  jcrPath: string,
): void {
  if (fieldTypes.size === 0) return;
  for (const [name, node] of fieldTypes) {
    const v = inline[name];
    if (node.type === "array-of-blocks") {
      if (typeof v !== "string") continue;
      const blocks = htmlStringToPortableText(v, `${jcrPath}::${name}`);
      if (blocks !== null) inline[name] = blocks;
      continue;
    }
    if (node.type === "number") {
      if (typeof v !== "string") continue;
      const n = Number(v);
      if (Number.isFinite(n)) inline[name] = n;
      continue;
    }
    if (node.type === "boolean") {
      if (typeof v !== "string") continue;
      if (v === "true") inline[name] = true;
      else if (v === "false") inline[name] = false;
      continue;
    }
    if (node.type === "array-of-object" && node.itemFields) {
      // Materialize keyed-map variants before recursing. AEM's `itemN` /
      // numeric-index multifield shape is coerced earlier by
      // `deepCoerceAemMultifieldMapsToArrays`, but some AEM widgets (e.g.
      // the color-carousel's `colors`) store each row under a meaningful
      // named key (`weddingDresses`, `bridesmaidDresses`, …) instead. The
      // registry says the target is `array-of-object`; honor that by
      // flattening the keyed map's values into an array in JSON iteration
      // order (which mirrors the authored order in AEM). Truncation
      // sentinels are skipped — they stay opaque for downstream audit.
      let items: unknown[] | null = null;
      if (Array.isArray(v)) {
        items = v;
      } else if (
        v !== null &&
        typeof v === "object" &&
        !(v as { __truncated?: unknown }).__truncated
      ) {
        items = Object.values(v as Record<string, unknown>).filter(
          (item) => item !== null && typeof item === "object" && !Array.isArray(item),
        );
        inline[name] = items;
      }
      if (!items) continue;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && typeof item === "object" && !Array.isArray(item)) {
          coerceFieldTypes(
            item as Record<string, unknown>,
            node.itemFields,
            `${jcrPath}::${name}[${i}]`,
          );
        }
      }
    }
  }
}

function deepCoerceAemMultifieldMapsToArrays(val: unknown): unknown {
  if (val === null || typeof val !== "object") return val;
  if (Array.isArray(val)) {
    return val.map((x) => deepCoerceAemMultifieldMapsToArrays(x));
  }
  const o = val as Record<string, unknown>;
  if (isAemMultifieldItemMap(o)) {
    const keys = Object.keys(o).filter((k) => k !== "_key");
    keys.sort(multifieldItemOrder);
    return keys.map((ik) => deepCoerceAemMultifieldMapsToArrays(o[ik]));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    out[k] = deepCoerceAemMultifieldMapsToArrays(v) as unknown;
  }
  return out;
}

// Transform a mapped component into an inline object. Children are recursively
// inlined (each with a stable _key). Used for pageBuilder items and nested refs.
function transformInline(node: AemNode, jcrPath: string, ctx: TransformContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (ctx.visited.has(node)) {
    ctx.audit.bail(jcrPath, "cycle", ctx.depth);
    return { __truncated: "cycle", jcrPath };
  }
  ctx.visited.add(node);

  for (const [key, value] of Object.entries(node)) {
    if (JCR_METADATA.has(key) || AEM_DIALOG_RUNTIME_KEYS.has(key)) continue;
    if (isChildNode(value)) {
      const outKey = sanityPropertyKeyFromAemChild(value, key);
      if (!isValidSanityAttributeKey(outKey)) continue;
      if (out[outKey] !== undefined) continue;
      const childPath = `${jcrPath}/${key}`;
      if (ctx.depth + 1 > MAX_DEPTH) {
        ctx.audit.bail(childPath, "maxDepth", ctx.depth + 1);
        out[outKey] = { __truncated: "maxDepth", jcrPath: childPath };
        continue;
      }
      const inline = transformInline(value, childPath, { ...ctx, depth: ctx.depth + 1 });
      out[outKey] = {
        ...inline,
        _key: stableKey(asString(value["jcr:uuid"]), childPath),
      };
    } else {
      if (!isValidSanityAttributeKey(key)) continue;
      if (out[key] !== undefined) continue;
      out[key] = value;
    }
  }

  return deepCoerceAemMultifieldMapsToArrays(out) as Record<string, unknown>;
}

// Walk the tree, collect every node whose sling:resourceType maps to a
// sanityType. Stops descending once a mapped node is found — its children are
// inlined by transformInline. Unmapped containers (page, responsivegrid, etc.)
// are transparently descended through.
function collectPageBuilder(
  root: AemNode,
  rootPath: string,
  ctx: TransformContext,
  filter: Set<string> | undefined,
  exceptions: Set<string>,
): PageBuilderItem[] {
  const out: PageBuilderItem[] = [];
  const stack: Array<{ node: AemNode; jcrPath: string }> = [{ node: root, jcrPath: rootPath }];
  const seen = new Set<string>();

  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (seen.has(frame.jcrPath)) continue;
    seen.add(frame.jcrPath);

    const resourceType = asString(frame.node["sling:resourceType"]);
    if (resourceType && exceptions.has(resourceType)) {
      // Explicitly ignored resource type: skip this node and its subtree.
      continue;
    }
    const entry = resourceType ? ctx.registry.get(resourceType) : undefined;

    if (entry?.sanityType && (!filter || filter.has(resourceType!))) {
      const inlineCtx: TransformContext = {
        ...ctx,
        depth: 0,
        visited: new WeakSet(),
      };
      const containerEntry = resourceType ? ctx.containers.get(resourceType) : undefined;

      // Container components carry two shapes in the same JCR node: dialog
      // fields (handled by transformInline) AND drop-zone child components
      // (each itself an AEM component with its own sling:resourceType).
      // Strip those child keys out before transformInline so they don't
      // pollute the dialog-field area; we re-collect them below as
      // pageBuilder-style blocks under `childrenField`.
      const containerChildKeys = containerEntry
        ? collectContainerChildKeys(frame.node)
        : null;

      // Named-slot children: direct child nodes that carry their own
      // sling:resourceType under a JCR key that isn't a declared dialog
      // field and isn't already claimed by container logic. e.g.
      // `media-paragraph` has a `content` child that's itself a full
      // `aem-integration/components/content` component. We emit these as
      // single nested blocks under the same JCR key so the Studio shows
      // them as typed subfields rather than raw "Unknown field" blobs.
      // Dialog-field collisions leave the dialog field in place (dialog
      // wins).
      const slotKeys = collectSlotKeys(frame.node, containerChildKeys);
      const stripAll = [
        ...(containerChildKeys ?? []),
        ...slotKeys,
      ];
      const nodeForInline = stripAll.length > 0
        ? stripKeys(frame.node, stripAll)
        : frame.node;

      const inline = transformInline(nodeForInline, frame.jcrPath, inlineCtx);
      splitAemFileUploadDamPaths(inline, entry.fieldNames);
      coerceFieldTypes(inline, entry.fieldTypes, frame.jcrPath);

      for (const slotKey of slotKeys) {
        const child = frame.node[slotKey] as AemNode;
        const childItems = collectPageBuilder(
          child,
          `${frame.jcrPath}/${slotKey}`,
          ctx,
          filter,
          exceptions,
        );
        // Named slots hold a single nested block. If the child walker
        // returned more than one (unlikely — would mean the slot child
        // was itself a container-of-containers), keep them as an array
        // so nothing is dropped; the Studio will flag the shape mismatch
        // rather than losing data.
        if (childItems.length === 1) {
          inline[slotKey] = childItems[0];
        } else if (childItems.length > 1) {
          inline[slotKey] = childItems;
        }
      }

      if (containerEntry && containerChildKeys) {
        const items: PageBuilderItem[] = [];
        for (const key of containerChildKeys) {
          const child = frame.node[key] as AemNode;
          const childItems = collectPageBuilder(
            child,
            `${frame.jcrPath}/${key}`,
            ctx,
            filter,
            exceptions,
          );
          items.push(...childItems);
        }
        inline[containerEntry.childrenField] = items;
      }

      out.push({
        _type: entry.sanityType,
        _key: stableKey(asString(frame.node["jcr:uuid"]), frame.jcrPath),
        ...inline,
      });
      ctx.audit.tick();
      const drift = diffProps(frame.node, entry);
      if (drift.length > 0) ctx.audit.unknownProps(entry.sanityType, frame.jcrPath, drift);
      continue;
    }

    if (resourceType && !entry?.sanityType) {
      ctx.audit.unknownType(resourceType, frame.jcrPath);
    }

    const entries = Object.entries(frame.node);
    for (let i = entries.length - 1; i >= 0; i--) {
      const [key, value] = entries[i]!;
      if (isChildNode(value)) {
        stack.push({ node: value, jcrPath: `${frame.jcrPath}/${key}` });
      }
    }
  }

  return out;
}

// Slim audit. Tracks: unknown resource types (with a few example paths),
// unknown props per mapped component, transform bails. One JSON file per run.
interface Audit {
  tick(): void;
  unknownType(resourceType: string, path: string): void;
  unknownProps(component: string, path: string, props: Array<{ prop: string; value: unknown }>): void;
  bail(path: string, reason: "maxDepth" | "cycle", depth: number): void;
  report(): unknown;
}

function createAudit(maxExamples = 3): Audit {
  let totalDocs = 0;
  let totalFindings = 0;
  const unknownTypes = new Map<string, { hits: number; examples: string[] }>();
  const unknownProps = new Map<string, Map<string, Array<{ path: string; value: unknown }>>>();
  const bails: Array<{ path: string; reason: string; depth: number }> = [];

  function bump<T>(list: T[], item: T): void {
    if (list.length < maxExamples) list.push(item);
  }

  return {
    tick: () => void totalDocs++,
    unknownType(resourceType, path) {
      totalFindings++;
      let entry = unknownTypes.get(resourceType);
      if (!entry) {
        entry = { hits: 0, examples: [] };
        unknownTypes.set(resourceType, entry);
      }
      entry.hits++;
      bump(entry.examples, path);
    },
    unknownProps(component, path, props) {
      totalFindings++;
      let comp = unknownProps.get(component);
      if (!comp) {
        comp = new Map();
        unknownProps.set(component, comp);
      }
      for (const { prop, value } of props) {
        let examples = comp.get(prop);
        if (!examples) {
          examples = [];
          comp.set(prop, examples);
        }
        bump(examples, { path, value });
      }
    },
    bail(path, reason, depth) {
      totalFindings++;
      bump(bails, { path, reason, depth });
    },
    report() {
      return {
        summary: {
          totalDocs,
          totalFindings,
          unknownTypes: unknownTypes.size,
          componentsWithUnknownProps: unknownProps.size,
          transformBails: bails.length,
        },
        unknownResourceTypes: [...unknownTypes.entries()].map(([resourceType, { hits, examples }]) => ({
          resourceType,
          hits,
          examples,
        })),
        unknownPropsByComponent: Object.fromEntries(
          [...unknownProps.entries()].map(([component, props]) => [
            component,
            [...props.entries()].map(([prop, examples]) => ({ prop, examples })),
          ]),
        ),
        transformBails: bails,
      };
    },
  };
}

function diffProps(node: AemNode, entry: NormalizedRegistryEntry | undefined): Array<{ prop: string; value: unknown }> {
  if (!entry?.fieldNames?.length) return [];
  const expected = new Set(entry.fieldNames);
  const out: Array<{ prop: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(node)) {
    if (JCR_METADATA.has(key) || AEM_DIALOG_RUNTIME_KEYS.has(key)) continue;
    if (expected.has(key)) continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) continue;
    out.push({ prop: key, value });
  }
  return out;
}

// Page title: prefer explicit AEM page properties, fall back to slug, then
// last path segment.
function derivePageTitle(tree: AemNode, slug: string | undefined, jcrPath: string): string {
  const content = isChildNode(tree["jcr:content"]) ? (tree["jcr:content"] as AemNode) : undefined;
  const candidates = [
    content ? asString(content["pageTitle"]) : undefined,
    content ? asString(content["jcr:title"]) : undefined,
    content ? asString(content["navTitle"]) : undefined,
    slug,
    jcrPath.split("/").filter(Boolean).pop(),
  ];
  for (const c of candidates) {
    if (c && c.trim().length > 0) return c.trim();
  }
  return jcrPath;
}

function main(): void {
  const timer = startTimer();
  const c = createColors({ stream: process.stderr });
  const outputDir = resolve(process.env.OUTPUT_DIR ?? "./output");
  const registryFile = resolve(getFlag("--registry") ?? "./content-type-registry.json");
  const exceptionsFile = resolve(
    process.env.AEM_COMPONENT_EXCEPTIONS_FILE ?? "./aem-component-exceptions",
  );
  const exceptions = readExceptionResourceTypes(exceptionsFile);
  const include = getFlag("--include")?.split(",").filter(Boolean);
  const allowed = include ? new Set(include) : undefined;

  const containersFile = resolve(
    process.env.AEM_COMPONENT_CONTAINERS_FILE ?? "./aem-component-containers.json",
  );
  const containers = loadContainerConfig({ file: containersFile });

  const registry = loadRegistry(registryFile);
  const rawDir = join(outputDir, "cache", "raw");
  const cleanDir = join(outputDir, "cache", "clean");
  mkdirSync(cleanDir, { recursive: true });

  const rawFiles = readdirSync(rawDir).filter((f) => f.endsWith(".json")).sort();
  if (rawFiles.length === 0) {
    console.error(`No raw files in ${rawDir}. Run \`aem-extract\` first.`);
    process.exit(2);
  }

  console.error(`[transform] ${rawFiles.length} raw file(s) → ${cleanDir}`);
  if (exceptions.size > 0) {
    console.error(
      `[transform] applying ${exceptions.size} exception(s) from ${exceptionsFile}`,
    );
  }
  if (containers.size > 0) {
    console.error(
      `[transform] container behavior for ${containers.size} resource type(s) from ${containersFile}`,
    );
  }

  const audit = createAudit();
  let pagesWritten = 0;
  let blocksEmitted = 0;

  for (const file of rawFiles) {
    let raw: RawFile;
    try {
      raw = JSON.parse(readFileSync(join(rawDir, file), "utf8")) as RawFile;
    } catch (err) {
      console.error(`[transform] skip ${file}: ${(err as Error).message}`);
      continue;
    }

    const { jcrPath, slug, tree } = raw;
    const currentSlug = slug ?? jcrPath.split("/").filter(Boolean).pop() ?? jcrPath;

    const ctx: TransformContext = {
      visited: new WeakSet(),
      depth: 0,
      registry,
      containers,
      audit,
    };

    let pageBuilder: PageBuilderItem[];
    try {
      pageBuilder = collectPageBuilder(tree, jcrPath, ctx, allowed, exceptions);
    } catch (err) {
      console.error(`[transform] ${jcrPath}: ${(err as Error).message}`);
      continue;
    }

    const pageDoc: PageDoc = {
      _id: pathToDocId(jcrPath),
      _type: "page",
      title: derivePageTitle(tree, slug, jcrPath),
      slug: { _type: "slug", current: currentSlug },
      pageBuilder,
    };

    const outFile = join(cleanDir, file);
    writeFileSync(
      outFile,
      JSON.stringify({ jcrPath, slug: currentSlug, docs: [pageDoc] }, null, 2) + "\n",
      "utf8",
    );
    pagesWritten++;
    blocksEmitted += pageBuilder.length;
  }

  const report = audit.report() as {
    summary: { totalFindings: number };
    unknownResourceTypes: Array<{ resourceType: string; hits: number; examples: string[] }>;
  };
  const reportFile = join(outputDir, "cache", "transform-report.json");
  writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.error(c.dim("────────────────────────────────────────"));
  console.error(`Pages:     ${c.green(pagesWritten)}`);
  console.error(`Blocks:    ${c.green(blocksEmitted)}`);
  console.error(
    `Findings:  ${report.summary.totalFindings > 0 ? c.yellow(report.summary.totalFindings) : c.green(0)}  ${c.dim(`→ ${reportFile}`)}`,
  );
  console.error(`Elapsed:   ${c.dim(timer.elapsed())}`);

  const unmapped = report.unknownResourceTypes.filter(
    (u) => !AEM_STRUCTURAL_PASSTHROUGH_TYPES.has(u.resourceType),
  );
  if (unmapped.length > 0) {
    const typeWidth = Math.min(60, unmapped.reduce((w, u) => Math.max(w, u.resourceType.length), 0));
    console.error("");
    console.error(
      c.yellow(
        `${unmapped.length} unmapped AEM resource type(s) — content dropped. Add to aem-component-paths, then re-run migrate:schema + transform + import:`,
      ),
    );
    unmapped
      .sort((a, b) => b.hits - a.hits)
      .forEach((u, i) => {
        const n = c.dim(String(i + 1).padStart(2, " ") + ".");
        const rt = u.resourceType.padEnd(typeWidth, " ");
        const count = c.yellow(`${u.hits}×`.padStart(5, " "));
        const pathLine = `/apps/${u.resourceType}`;
        console.error(`  ${n} ${rt}  ${count}  ${c.dim(pathLine)}`);
        const firstExample = u.examples[0];
        if (firstExample) console.error(`      ${c.dim(`e.g. ${firstExample}`)}`);
      });
  }
}

function getFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
