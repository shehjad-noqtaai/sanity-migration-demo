#!/usr/bin/env node
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createColors } from "aem-to-sanity-core";
import { htmlToBlocks } from "@portabletext/block-tools";
import { compileSchema, defineSchema, type Schema } from "@portabletext/schema";
import { JSDOM } from "jsdom";

interface AemNode {
  [key: string]: unknown;
  "sling:resourceType"?: string;
  "jcr:uuid"?: string;
}
/**
 * Registry entry as written on disk. Supports two shapes for back-compat:
 *   - Legacy: `fields: string[]` — names only.
 *   - Current: `fields: Array<{name, type}>` — names + Sanity type, required
 *     for HTML → Portable Text coercion on `array-of-blocks` fields.
 * Entries are normalized into {@link NormalizedRegistryEntry} at load.
 */
interface RegistryEntry {
  resourceType: string;
  sanityType: string;
  fields?: Array<string | { name: string; type?: string }>;
}
interface NormalizedRegistryEntry {
  resourceType: string;
  sanityType: string;
  fieldNames: string[];
  /** `name → sanity type`. Missing for legacy string[] entries. */
  fieldTypes: Map<string, string>;
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
  const fieldTypes = new Map<string, string>();
  for (const f of e.fields ?? []) {
    if (typeof f === "string") {
      fieldNames.push(f);
      continue;
    }
    fieldNames.push(f.name);
    if (f.type) fieldTypes.set(f.name, f.type);
  }
  return {
    resourceType: e.resourceType,
    sanityType: e.sanityType,
    fieldNames,
    fieldTypes,
  };
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
 * In-place coercion: any top-level field whose declared Sanity type is
 * `array-of-blocks` and whose ingested value is a string is parsed as HTML
 * and replaced with Portable Text blocks. AEM's `cq/gui/components/authoring/dialog/richtext`
 * dialog fields land as HTML strings; Sanity expects PT arrays. Without
 * this step the Studio rejects the field with "value is string, expected
 * array".
 *
 * Scope is intentionally flat — nested array-of-object members get
 * pass-through behavior because the registry flattens field lists and
 * doesn't preserve nesting. If nested richtext starts appearing in real
 * AEM content, thread structured field metadata through instead of
 * broadening the detection here.
 */
function coerceRichTextFields(
  inline: Record<string, unknown>,
  fieldTypes: Map<string, string>,
  jcrPath: string,
): void {
  if (fieldTypes.size === 0) return;
  for (const [name, type] of fieldTypes) {
    if (type !== "array-of-blocks") continue;
    const v = inline[name];
    if (typeof v !== "string") continue;
    const blocks = htmlStringToPortableText(v, `${jcrPath}::${name}`);
    if (blocks === null) continue;
    inline[name] = blocks;
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
    if (JCR_METADATA.has(key)) continue;
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
      const inline = transformInline(frame.node, frame.jcrPath, inlineCtx);
      splitAemFileUploadDamPaths(inline, entry.fieldNames);
      coerceRichTextFields(inline, entry.fieldTypes, frame.jcrPath);
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
  const unknownTypes = new Map<string, string[]>();
  const unknownProps = new Map<string, Map<string, Array<{ path: string; value: unknown }>>>();
  const bails: Array<{ path: string; reason: string; depth: number }> = [];

  function bump<T>(list: T[], item: T): void {
    if (list.length < maxExamples) list.push(item);
  }

  return {
    tick: () => void totalDocs++,
    unknownType(resourceType, path) {
      totalFindings++;
      let list = unknownTypes.get(resourceType);
      if (!list) {
        list = [];
        unknownTypes.set(resourceType, list);
      }
      bump(list, path);
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
        unknownResourceTypes: [...unknownTypes.entries()].map(([resourceType, examples]) => ({
          resourceType,
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
    if (JCR_METADATA.has(key)) continue;
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
  const c = createColors({ stream: process.stderr });
  const outputDir = resolve(process.env.OUTPUT_DIR ?? "./output");
  const registryFile = resolve(getFlag("--registry") ?? "./content-type-registry.json");
  const exceptionsFile = resolve(
    process.env.AEM_COMPONENT_EXCEPTIONS_FILE ?? "./aem-component-exceptions",
  );
  const exceptions = readExceptionResourceTypes(exceptionsFile);
  const include = getFlag("--include")?.split(",").filter(Boolean);
  const allowed = include ? new Set(include) : undefined;

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

  const report = audit.report() as { summary: { totalFindings: number } };
  const reportFile = join(outputDir, "cache", "transform-report.json");
  writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.error(c.dim("────────────────────────────────────────"));
  console.error(`Pages:     ${c.green(pagesWritten)}`);
  console.error(`Blocks:    ${c.green(blocksEmitted)}`);
  console.error(
    `Findings:  ${report.summary.totalFindings > 0 ? c.yellow(report.summary.totalFindings) : c.green(0)}  ${c.dim(`→ ${reportFile}`)}`,
  );
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
