import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PageComponentConfig } from "aem-to-sanity-core";
import { loadExtractedContentTrees } from "aem-to-sanity-core";

type AemNode = Record<string, unknown>;

/**
 * Map<resourceType, Set<cqTemplate>> — distinct `cq:template` values seen on
 * `jcr:content` nodes whose `sling:resourceType` matches a declared page-shell.
 */
export type DiscoveredTemplates = Map<string, Set<string>>;

/**
 * Walk a set of raw AEM page trees (one per extracted page) and collect the
 * `cq:template` paths found on `jcr:content` nodes whose `sling:resourceType`
 * matches a declared page-shell with `discover: true`.
 *
 * Pure / exported for unit testing; the disk-backed wrapper is
 * {@link scanTemplatesFromRawDir}.
 */
export function discoverTemplates(
  trees: AemNode[],
  config: PageComponentConfig,
): DiscoveredTemplates {
  const discoveryEnabled = new Set<string>();
  for (const [rt, entry] of config) {
    if (entry.discover) discoveryEnabled.add(rt);
  }

  const out: DiscoveredTemplates = new Map();
  if (discoveryEnabled.size === 0) return out;

  for (const tree of trees) {
    const content = tree["jcr:content"];
    if (!content || typeof content !== "object" || Array.isArray(content)) continue;
    const node = content as AemNode;
    const rt =
      typeof node["sling:resourceType"] === "string"
        ? (node["sling:resourceType"] as string)
        : undefined;
    if (!rt || !discoveryEnabled.has(rt)) continue;
    const tpl =
      typeof node["cq:template"] === "string"
        ? (node["cq:template"] as string)
        : undefined;
    if (!tpl) continue;
    let set = out.get(rt);
    if (!set) {
      set = new Set();
      out.set(rt, set);
    }
    set.add(tpl);
  }
  return out;
}

/**
 * Disk-backed wrapper: reads extract/tag cache under `output/cache/aem/content/`
 * (falling back to legacy `cache/raw/`), feeds the trees into
 * {@link discoverTemplates}, and returns the resulting map.
 */
export function scanTemplatesFromExtractCache(
  outputDir: string,
  config: PageComponentConfig,
): DiscoveredTemplates {
  const trees = loadExtractedContentTrees(outputDir) as AemNode[];
  return discoverTemplates(trees, config);
}

/**
 * @deprecated Pass `outputDir` to {@link scanTemplatesFromExtractCache} instead.
 * Still accepts a legacy flat `cache/raw/` directory path for compatibility.
 */
export function scanTemplatesFromRawDir(
  rawDir: string,
  config: PageComponentConfig,
): DiscoveredTemplates {
  let entries: string[];
  try {
    entries = readdirSync(rawDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw err;
  }
  const trees: AemNode[] = [];
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
      trees.push(tree as AemNode);
    }
  }
  return discoverTemplates(trees, config);
}

/**
 * Merge discovered templates into the explicit config. Returns a new
 * `PageComponentConfig` where each entry's `templates` includes both the
 * operator's explicit list and any discovered values, deduplicated while
 * preserving authored order (explicit first, discovered appended in
 * iteration order).
 *
 * Entries with `discover: false` (or omitted) pass through unchanged.
 */
export function mergeDiscoveredTemplates(
  config: PageComponentConfig,
  discovered: DiscoveredTemplates,
): PageComponentConfig {
  const out: PageComponentConfig = new Map();
  for (const [rt, entry] of config) {
    const found = discovered.get(rt);
    if (!entry.discover || !found || found.size === 0) {
      out.set(rt, entry);
      continue;
    }
    const seen = new Set<string>(entry.templates);
    const merged = [...entry.templates];
    for (const tpl of found) {
      if (seen.has(tpl)) continue;
      seen.add(tpl);
      merged.push(tpl);
    }
    out.set(rt, { ...entry, templates: merged });
  }
  return out;
}
