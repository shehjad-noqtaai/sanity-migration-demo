import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadExtractedContentTrees } from "aem-to-sanity-core";

/**
 * Nested-component slot discovery. Some AEM components embed a **single named
 * child component** rather than declaring it in their dialog — e.g.
 * `aem-integration/components/media-paragraph` carries a `content` child
 * whose own `sling:resourceType` is `aem-integration/components/content`.
 * That's not a dialog field and it's not a cq:isContainer drop-zone; it's
 * a named slot. Operators don't want to enumerate these by hand, and the
 * dialog itself carries no hint of them — the only place the slot shape
 * shows up is inside already-extracted content.
 *
 * So the schema emitter runs a post-extract pass: walk every raw page JSON
 * on disk, and for every mapped parent node, note which of its direct
 * children carry their own `sling:resourceType` under a key that isn't a
 * dialog field. That's a slot. The result feeds the emitter, which then
 * declares `defineField({ name: slotKey, type: childTypeName })` on the
 * parent schema so the Studio stops flagging the slot as an "Unknown
 * field".
 *
 * Missing `raw/` dir → empty result (first-ever run has no content to
 * scan, which is fine — a second `migrate:schema` after the first
 * `extract` picks up the slots). Keeps the feature config-free.
 */

interface AemNode {
  [key: string]: unknown;
  "sling:resourceType"?: string;
}

interface SlotHit {
  /** First JCR path where this parent→slot→child combo was seen. */
  examplePath: string;
}

export interface SlotMapEntry {
  /** Keyed by the child `sling:resourceType`. Multi-type slots stay flagged. */
  childTypes: Map<string, SlotHit>;
}

export type DiscoveredSlots = Map<string, Map<string, SlotMapEntry>>;

export interface ScanOptions {
  /**
   * JCR path prefixes that are structural wrappers, not real components. Their
   * children aren't slots; they are transparent walk-throughs. Keeps the AEM
   * `page` root + responsive-grid from polluting the slot map for every
   * top-level block.
   */
  structuralPassthroughTypes?: Set<string>;
}

const DEFAULT_STRUCTURAL = new Set<string>([
  "aem-integration/components/page",
  "wcm/foundation/components/responsivegrid",
]);

/**
 * Pure scanner — takes a list of raw AEM roots (each is an extracted page
 * tree) and returns every `parentResourceType → childKey → childResourceType`
 * combo it sees. Consumers filter by dialog-field names at emission time
 * (the scanner doesn't have that knowledge yet; migrate:schema maps
 * dialogs after scanning).
 *
 * Exported for unit testing; the CLI wrapper {@link scanSlotsFromRawDir}
 * handles disk I/O and JSON parsing.
 */
export function discoverSlots(
  roots: AemNode[],
  opts: ScanOptions = {},
): DiscoveredSlots {
  const structural = opts.structuralPassthroughTypes ?? DEFAULT_STRUCTURAL;
  const out: DiscoveredSlots = new Map();

  function visit(node: AemNode, jcrPath: string): void {
    const parentType = typeof node["sling:resourceType"] === "string"
      ? (node["sling:resourceType"] as string)
      : undefined;
    const parentIsReal = parentType && !structural.has(parentType);

    if (parentIsReal && parentType) {
      for (const [key, value] of Object.entries(node)) {
        if (key.startsWith("jcr:") || key.startsWith("sling:") || key.startsWith("cq:")) continue;
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const child = value as AemNode;
        const childType = typeof child["sling:resourceType"] === "string"
          ? (child["sling:resourceType"] as string)
          : undefined;
        if (!childType) continue;

        let bySlot = out.get(parentType);
        if (!bySlot) {
          bySlot = new Map();
          out.set(parentType, bySlot);
        }
        let entry = bySlot.get(key);
        if (!entry) {
          entry = { childTypes: new Map() };
          bySlot.set(key, entry);
        }
        if (!entry.childTypes.has(childType)) {
          entry.childTypes.set(childType, { examplePath: `${jcrPath}/${key}` });
        }
      }
    }

    // Always recurse — nested blocks can have their own slots too.
    for (const [key, value] of Object.entries(node)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      visit(value as AemNode, `${jcrPath}/${key}`);
    }
  }

  for (const root of roots) visit(root, "");
  return out;
}

/**
 * Disk-backed wrapper: reads extract/tag cache under `output/cache/aem/content/`
 * (falling back to legacy `cache/raw/`), feeds the trees into
 * {@link discoverSlots}, and returns the combined map.
 */
export function scanSlotsFromExtractCache(
  outputDir: string,
  opts: ScanOptions = {},
): DiscoveredSlots {
  const roots = loadExtractedContentTrees(outputDir) as AemNode[];
  return discoverSlots(roots, opts);
}

/**
 * @deprecated Pass `outputDir` to {@link scanSlotsFromExtractCache} instead.
 * Still accepts a legacy flat `cache/raw/` directory path for compatibility.
 */
export function scanSlotsFromRawDir(
  rawDir: string,
  opts: ScanOptions = {},
): DiscoveredSlots {
  let entries: string[];
  try {
    entries = readdirSync(rawDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw err;
  }
  const roots: AemNode[] = [];
  for (const file of entries) {
    if (!file.endsWith(".json")) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(rawDir, file), "utf8"));
    } catch {
      continue;
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const tree = (raw as { tree?: unknown }).tree;
    if (tree && typeof tree === "object" && !Array.isArray(tree)) {
      roots.push(tree as AemNode);
    }
  }
  return discoverSlots(roots, opts);
}
