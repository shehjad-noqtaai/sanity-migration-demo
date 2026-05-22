import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  AemFetchError,
  type AmbiguousResolution,
  type FetchDeps,
  type FetchInfinityOptions,
} from "./fetcher.ts";

/**
 * File-based AEM fetcher mode, toggled by `AEM_FIXTURES_DIR`.
 *
 * When this env var is set, `fetchInfinityJson` (and, when it lands,
 * `fetchInfinityTree`) reads captured AEM responses from disk instead of
 * issuing HTTP calls. This is the test harness for the depth-5 splice fix
 * (`BpFIDGFA`) and for unit-testing every failure path without talking to a
 * live AEM instance.
 *
 * ## Fixture on-disk layout (canonical — path mirror)
 *
 * Each AEM URL maps to a file whose relative path mirrors the URL path:
 *
 *   GET  /content/dbi.infinity.json
 *        → {fixturesDir}/content/dbi.infinity.json
 *   GET  /content/dbi/en/home.infinity.json
 *        → {fixturesDir}/content/dbi/en/home.infinity.json
 *   GET  /apps/dbi/components/content/about/_cq_dialog.infinity.json
 *        → {fixturesDir}/apps/dbi/components/content/about/_cq_dialog.infinity.json
 *
 * Non-200 responses use a sibling `<path>.meta.json` sidecar:
 *
 *   { "status": 300, "body": "<raw 300 body>" }
 *   { "status": 404 }
 *
 * A 200 is implied when only the JSON body file is present and no meta exists.
 *
 * ## Legacy layout (still read, not written)
 *
 * Older captures encode slashes as `__` in a flat filename, optionally under
 * `content/` or `components/` bucket folders. `lookupFixture` falls back to
 * these paths when a path-mirror file is missing.
 *
 * If a fixture is missing entirely, the fetcher throws
 * `AemFetchError("network", ..., { status: 404 })` — i.e. treats missing
 * fixtures as 404s, which matches how live AEM reports non-existent paths.
 */

const KNOWN_SELECTORS = [
  ".infinity.json",
  ".4.json",
  ".3.json",
  ".2.json",
  ".1.json",
  ".0.json",
] as const;

/** Normalize a URL path relative to baseUrl (always leading `/`). */
export function normalizeRelativeUrlPath(relativePath: string): string {
  return relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
}

/**
 * Canonical on-disk path segment for a relative AEM URL (no leading slash).
 * Example: `/content/dbi/en/home.infinity.json` → `content/dbi/en/home.infinity.json`
 */
export function fixtureRelativePathForUrl(relativePath: string): string {
  return normalizeRelativeUrlPath(relativePath).replace(/^\/+/, "");
}

/** Absolute path to write/read a path-mirror fixture body. */
export function fixturePathForUrl(fixturesDir: string, relativePath: string): string {
  return join(fixturesDir, fixtureRelativePathForUrl(relativePath));
}

/** Legacy flat filename: slash → `__`, leading slash dropped. */
export function fixtureLegacyFilenameForUrl(relativePath: string): string {
  return fixtureRelativePathForUrl(relativePath).replace(/\//g, "__");
}

/** @deprecated Prefer `fixtureRelativePathForUrl` — kept for legacy callers. */
export function fixtureFilenameForUrl(relativePath: string): string {
  return fixtureLegacyFilenameForUrl(relativePath);
}

/** Encodes a JCR path + selector into a legacy flat filename. */
export function fixtureFilenameFor(jcrPath: string, selector: string): string {
  const trimmed = jcrPath.replace(/^\/+/, "");
  const encoded = trimmed.replace(/\//g, "__");
  return `${encoded}${selector}`;
}

/**
 * Decode a legacy flat fixture filename back to a path-mirror relative path.
 * Returns undefined when the name does not look like a legacy capture.
 */
export function decodeLegacyFixtureFilename(filename: string): string | undefined {
  let name = filename;
  if (name.endsWith(".meta.json")) {
    name = name.slice(0, -".meta.json".length);
  }

  let selector = "";
  for (const s of KNOWN_SELECTORS) {
    if (name.endsWith(s)) {
      selector = s;
      name = name.slice(0, -s.length);
      break;
    }
  }
  if (!selector) {
    if (!name.endsWith(".json")) return undefined;
    selector = ".json";
    name = name.slice(0, -".json".length);
  }
  if (!name.includes("__")) return undefined;
  return `${name.replace(/__/g, "/")}${selector}`;
}

/** Bucket subfolder for legacy split fixture trees. */
export function fixtureBucketForUrl(relativePath: string): "content" | "components" | undefined {
  const normalized = normalizeRelativeUrlPath(relativePath);
  if (normalized.startsWith("/content/")) return "content";
  if (normalized.startsWith("/apps/")) return "components";
  return undefined;
}

/** Legacy search dirs: bucket subdir (if any), then flat root. */
export function fixtureSearchDirs(
  fixturesDir: string,
  relativePath: string,
): string[] {
  const bucket = fixtureBucketForUrl(relativePath);
  const out = bucket ? [join(fixturesDir, bucket), fixturesDir] : [fixturesDir];
  return [...new Set(out)];
}

/** Ordered candidate body paths — path mirror first, then legacy layouts. */
export function fixtureLookupCandidates(
  fixturesDir: string,
  relativePath: string,
): string[] {
  const normalized = normalizeRelativeUrlPath(relativePath);
  const legacyName = fixtureLegacyFilenameForUrl(normalized);
  const out = [fixturePathForUrl(fixturesDir, normalized)];
  for (const dir of fixtureSearchDirs(fixturesDir, normalized)) {
    out.push(join(dir, legacyName));
  }
  return [...new Set(out)];
}

export interface FixtureMeta {
  status: number;
  body?: string;
  /** Optional content-length override, useful for synthetic `tooLarge` tests. */
  sizeBytes?: number;
}

export interface FixtureLookup {
  /** Raw JSON text of a successful response, or undefined if not a 200. */
  body200?: string;
  /** Meta sidecar contents, present for non-200 responses. */
  meta?: FixtureMeta;
  /** The absolute fixture path we resolved (for diagnostics). */
  resolvedPath: string;
}

function lookupFixtureAtPath(bodyPath: string): FixtureLookup | undefined {
  const metaPath = `${bodyPath}.meta.json`;

  const hasBody = existsSync(bodyPath);
  const hasMeta = existsSync(metaPath);

  if (!hasBody && !hasMeta) return undefined;

  if (hasBody && hasMeta) {
    throw new Error(
      `Fixture ${bodyPath}: both a body file and a meta sidecar exist. ` +
        `Remove one — a body file implies a 200 response; a meta sidecar implies a non-200.`,
    );
  }

  let meta: FixtureMeta | undefined;
  if (hasMeta) {
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8")) as FixtureMeta;
    } catch (err) {
      throw new Error(
        `Fixture meta at ${metaPath} is not valid JSON: ${(err as Error).message}`,
      );
    }
  }

  let body200: string | undefined;
  if (hasBody) {
    body200 = readFileSync(bodyPath, "utf8");
  }

  return { body200, meta, resolvedPath: bodyPath };
}

export function lookupFixture(
  fixturesDir: string,
  relativePath: string,
): FixtureLookup | undefined {
  for (const bodyPath of fixtureLookupCandidates(fixturesDir, relativePath)) {
    const hit = lookupFixtureAtPath(bodyPath);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Build a `fetch`-compatible function that reads from a fixtures directory.
 */
export function buildFixturesFetch(
  fixturesDir: string,
  baseUrl: string,
): typeof globalThis.fetch {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const fetchImpl: typeof globalThis.fetch = async (input, _init) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    if (!url.startsWith(normalizedBase)) {
      throw new Error(
        `fixtures fetch: URL ${url} is not under configured baseUrl ${normalizedBase}`,
      );
    }
    const relativePath = url.slice(normalizedBase.length);
    const lookup = lookupFixture(fixturesDir, relativePath);

    if (!lookup) {
      return makeResponse(404, "", url);
    }

    if (lookup.meta) {
      const { status, body = "" } = lookup.meta;
      return makeResponse(status, body, url, lookup.meta.sizeBytes);
    }

    return makeResponse(200, lookup.body200 ?? "", url);
  };
  return fetchImpl;
}

function makeResponse(
  status: number,
  body: string,
  url: string,
  overrideSize?: number,
): Response {
  const bodyBytes = Buffer.from(body, "utf8");
  const actualSize = overrideSize ?? bodyBytes.byteLength;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (bodyBytes.byteLength > 0) controller.enqueue(bodyBytes);
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    statusText: statusText(status),
    headers: {
      "content-type":
        status === 200 ? "application/json" : "text/html; charset=utf-8",
      "content-length": String(actualSize),
      "x-fixture-url": url,
    },
  });
}

function statusText(status: number): string {
  const map: Record<number, string> = {
    200: "OK",
    300: "Multiple Choices",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    500: "Internal Server Error",
  };
  return map[status] ?? "";
}

export function maybeApplyFixturesMode(deps: FetchDeps): FetchDeps {
  const dir = deps.fixturesDir;
  if (!dir) return deps;
  let stat;
  try {
    stat = statSync(dir);
  } catch (err) {
    throw new Error(
      `fixturesDir=${dir} does not exist or is not readable: ${(err as Error).message}`,
    );
  }
  if (!stat.isDirectory()) {
    throw new Error(`fixturesDir=${dir} is not a directory`);
  }
  deps.logger?.debug(`fixtures mode: reading AEM responses from ${dir}`);
  return {
    ...deps,
    fetch: buildFixturesFetch(dir, deps.config.baseUrl),
  };
}

export function applyFixturesFromEnv(deps: FetchDeps): FetchDeps {
  if (deps.fixturesDir) return deps;
  const dir = process.env.AEM_FIXTURES_DIR;
  if (!dir) return deps;
  return { ...deps, fixturesDir: dir };
}

export type { AemFetchError, AmbiguousResolution, FetchInfinityOptions };
