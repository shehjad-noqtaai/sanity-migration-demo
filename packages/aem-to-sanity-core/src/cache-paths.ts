import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/** Shape written by `aem-extract` and tag-root caching under `cache/aem/content/`. */
export interface ExtractedContentDoc {
  jcrPath: string;
  slug?: string;
  fetchedAt?: string;
  tree: unknown;
}

export interface CachedJsonFile {
  absPath: string;
  /** Path relative to the cache root directory (content/ or clean/). */
  relPath: string;
}

export function aemCacheRoot(outputDir: string): string {
  return join(outputDir, "cache", "aem");
}

export function aemCacheContentRoot(outputDir: string): string {
  return join(aemCacheRoot(outputDir), "content");
}

/** Canonical extract/tag cache path: mirrors JCR path under `cache/aem/content/`. */
export function aemCacheContentFile(outputDir: string, jcrPath: string): string {
  const rel = `${jcrPath.replace(/^\/+/, "")}.json`;
  return join(aemCacheContentRoot(outputDir), rel);
}

/** Canonical schema dialog cache: mirrors component path under `cache/aem/apps/...`. */
export function aemCacheAppsFile(outputDir: string, componentPath: string): string {
  const rel = `${componentPath.replace(/^\/+/, "")}.json`;
  return join(aemCacheRoot(outputDir), rel);
}

/** Legacy flat filename used by older extract output in `cache/raw/`. */
export function legacyFlatContentFilename(jcrPath: string): string {
  return `${jcrPath.replace(/^\/+/, "").replace(/[^A-Za-z0-9_-]/g, "_")}.json`;
}

export function legacyRawFile(outputDir: string, jcrPath: string): string {
  return join(outputDir, "cache", "raw", legacyFlatContentFilename(jcrPath));
}

export function legacyAppsDialogFile(outputDir: string, componentPath: string): string {
  const rel = componentPath.replace(/^\/+/, "");
  return join(outputDir, "cache", "aem", "components", `${rel}.json`);
}

/** Resolve an existing dialog JSON cache file (canonical first, then legacy). */
export function resolveAppsDialogFile(
  outputDir: string,
  componentPath: string,
): string | undefined {
  const canonical = aemCacheAppsFile(outputDir, componentPath);
  if (existsSync(canonical)) return canonical;
  const legacy = legacyAppsDialogFile(outputDir, componentPath);
  if (existsSync(legacy)) return legacy;
  return undefined;
}

export function resolveExtractedContentFile(outputDir: string, jcrPath: string): string {
  const canonical = aemCacheContentFile(outputDir, jcrPath);
  if (existsSync(canonical)) return canonical;
  const legacy = legacyRawFile(outputDir, jcrPath);
  if (existsSync(legacy)) return legacy;
  return canonical;
}

/** True when extract/tag cache exists for `jcrPath` (canonical or legacy raw). */
export function extractedContentExists(outputDir: string, jcrPath: string): boolean {
  return (
    existsSync(aemCacheContentFile(outputDir, jcrPath)) ||
    existsSync(legacyRawFile(outputDir, jcrPath))
  );
}

export function ensureExtractedContentFile(
  outputDir: string,
  jcrPath: string,
): string {
  const file = aemCacheContentFile(outputDir, jcrPath);
  mkdirSync(dirname(file), { recursive: true });
  return file;
}

function walkJsonFiles(dir: string, baseDir: string, out: CachedJsonFile[]): void {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJsonFiles(abs, baseDir, out);
      continue;
    }
    if (!entry.name.endsWith(".json") || entry.name === "manifest.json") continue;
    out.push({ absPath: abs, relPath: relative(baseDir, abs) });
  }
}

/** List extract/tag cache files under `cache/aem/content/`, falling back to flat `cache/raw/`. */
export function listExtractedContentFiles(outputDir: string): CachedJsonFile[] {
  const contentRoot = aemCacheContentRoot(outputDir);
  const out: CachedJsonFile[] = [];
  walkJsonFiles(contentRoot, contentRoot, out);
  if (out.length > 0) {
    return out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  }

  const legacyRaw = join(outputDir, "cache", "raw");
  if (!existsSync(legacyRaw)) return [];
  for (const name of readdirSync(legacyRaw)) {
    if (!name.endsWith(".json")) continue;
    out.push({ absPath: join(legacyRaw, name), relPath: name });
  }
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

/** List transform output under `cache/clean/` (flat legacy or path-mirror). */
export function listCleanFiles(outputDir: string): CachedJsonFile[] {
  const cleanRoot = join(outputDir, "cache", "clean");
  const out: CachedJsonFile[] = [];
  walkJsonFiles(cleanRoot, cleanRoot, out);
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

/** Load `{ tree }` objects from extract/tag cache for schema discovery passes. */
export function loadExtractedContentTrees(outputDir: string): unknown[] {
  const trees: unknown[] = [];
  for (const { absPath } of listExtractedContentFiles(outputDir)) {
    try {
      const raw = JSON.parse(readFileSync(absPath, "utf8")) as { tree?: unknown };
      if (raw.tree && typeof raw.tree === "object" && !Array.isArray(raw.tree)) {
        trees.push(raw.tree);
      }
    } catch {
      continue;
    }
  }
  return trees;
}
