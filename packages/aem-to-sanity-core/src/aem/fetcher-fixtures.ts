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
 * ## Fixture on-disk layout
 *
 * Each AEM URL maps to exactly one fixture file. The URL path *and* any
 * selector/extension (`.infinity.json`, `.4.json`, `.json`) are encoded into
 * the filename so a single directory captures any number of variants of the
 * same JCR path without collision.
 *
 * Mapping: slash → `__`, leading slash dropped. Examples:
 *
 *   GET  /content/dbi.infinity.json              → content__dbi.infinity.json
 *   GET  /content/dbi/en/home.infinity.json      → content__dbi__en__home.infinity.json
 *   GET  /content/dbi.4.json                     → content__dbi.4.json
 *   GET  /apps/dbi/components/content/about/_cq_dialog.infinity.json
 *        → apps__dbi__components__content__about___cq_dialog.infinity.json
 *
 * ## Subdirectory layout (optional)
 *
 * Demo tenants may split fixtures under bucket folders beneath `fixturesDir`:
 *
 *   fixtures/aem/content/     — `/content/...` page + tag trees
 *   fixtures/aem/components/  — `/apps/...` component + dialog trees
 *
 * `lookupFixture` checks the bucket subdir first, then falls back to a flat
 * `fixturesDir` for backward compatibility with older captures.
 *
 * Non-200 responses are captured by placing a sibling `<filename>.meta.json`
 * next to the response body (or in place of it, for 404s where we never get a
 * body). The meta file is a JSON object:
 *
 *   { "status": 300, "body": "<raw 300 body>" }
 *   { "status": 404 }
 *   { "status": 500, "body": "..." }
 *
 * A 200 is implied when only the JSON body file is present and no meta exists.
 *
 * If a fixture is missing entirely, the fetcher throws
 * `AemFetchError("network", ..., { status: 404 })` — i.e. treats missing
 * fixtures as 404s, which matches how live AEM reports non-existent paths.
 * This makes fixture mode "closed-world": you can't accidentally hit a URL
 * you forgot to capture.
 */

/** Encodes a JCR path + selector into a filesystem-safe filename. */
export function fixtureFilenameFor(jcrPath: string, selector: string): string {
  const trimmed = jcrPath.replace(/^\/+/, "");
  const encoded = trimmed.replace(/\//g, "__");
  return `${encoded}${selector}`;
}

/**
 * Encode a full URL (relative to the configured baseUrl) into a fixture
 * filename. Handles `.infinity.json`, `.N.json`, and dialog paths uniformly.
 */
export function fixtureFilenameForUrl(relativePath: string): string {
  // relativePath looks like "/content/dbi.infinity.json" or
  // "/apps/dbi/components/content/about/_cq_dialog.infinity.json".
  const trimmed = relativePath.replace(/^\/+/, "");
  return trimmed.replace(/\//g, "__");
}

/** Bucket subfolder for a relative AEM URL path, when using split fixture trees. */
export function fixtureBucketForUrl(relativePath: string): "content" | "components" | undefined {
  const normalized = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  if (normalized.startsWith("/content/")) return "content";
  if (normalized.startsWith("/apps/")) return "components";
  return undefined;
}

/** Search order for fixture files: bucket subdir (if any), then flat root. */
export function fixtureSearchDirs(
  fixturesDir: string,
  relativePath: string,
): string[] {
  const bucket = fixtureBucketForUrl(relativePath);
  const out = bucket ? [join(fixturesDir, bucket), fixturesDir] : [fixturesDir];
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

/**
 * Resolve a fixture for a given relative URL path under the configured
 * `fixturesDir`. Returns `undefined` if no fixture exists (caller decides
 * whether that's a 404 or a hard error).
 */
function lookupFixtureInDir(
  dir: string,
  filename: string,
): FixtureLookup | undefined {
  const bodyPath = join(dir, filename);
  const metaPath = join(dir, `${filename}.meta.json`);

  const hasBody = existsSync(bodyPath);
  const hasMeta = existsSync(metaPath);

  if (!hasBody && !hasMeta) return undefined;

  // Invariant: a fixture captures EITHER a successful 200 body OR a non-200
  // meta sidecar — never both. Having both means the capture is ambiguous
  // (the next round of `buildFixturesFetch` would silently prefer the meta
  // and drop the body, which is the exact silent-data-loss pattern we're
  // trying to avoid). Fail loudly instead.
  if (hasBody && hasMeta) {
    throw new Error(
      `Fixture ${filename}: both a body file and a meta sidecar exist under ${dir}. ` +
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
  const filename = fixtureFilenameForUrl(relativePath);
  for (const dir of fixtureSearchDirs(fixturesDir, relativePath)) {
    const hit = lookupFixtureInDir(dir, filename);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Build a `fetch`-compatible function that reads from a fixtures directory.
 * The returned function can be injected into `FetchDeps.fetch` to run the
 * existing `fetchInfinityJson` code path entirely offline — preserving all
 * error kinds (`network`/`auth`/`tooLarge`/`parseError`) by returning the
 * correct HTTP status that `parseResponse` then branches on.
 *
 * This is the recommended way to use fixture mode: it lets the unit tests
 * cover the real HTTP-response-shape logic (e.g. 300 → parse alternatives →
 * refetch) without mocking internal functions.
 */
export function buildFixturesFetch(
  fixturesDir: string,
  baseUrl: string,
): typeof globalThis.fetch {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const fetchImpl: typeof globalThis.fetch = async (input, _init) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    if (!url.startsWith(normalizedBase)) {
      // Unexpected out-of-fixture URL — surface clearly rather than silently 404.
      throw new Error(
        `fixtures fetch: URL ${url} is not under configured baseUrl ${normalizedBase}`,
      );
    }
    const relativePath = url.slice(normalizedBase.length);
    const lookup = lookupFixture(fixturesDir, relativePath);

    if (!lookup) {
      // Closed-world: missing fixture == 404. Matches real AEM for missing paths.
      return makeResponse(404, "", url);
    }

    if (lookup.meta) {
      const { status, body = "" } = lookup.meta;
      return makeResponse(status, body, url, lookup.meta.sizeBytes);
    }

    // 200 with a JSON body — default case.
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
  // Build a Response with a streamable body so `readTextWithCap` in
  // fetcher.ts exercises its streaming path (required for tooLarge coverage).
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

/**
 * If `deps.fixturesDir` is set and points at a readable directory, returns an
 * augmented `FetchDeps` with a fixtures-backed `fetch`. Otherwise returns
 * `deps` unchanged. Pure function of inputs — does NOT read process env, so
 * library callers see deterministic behaviour (an explicit `deps.fetch` is
 * only overridden when `deps.fixturesDir` is set too). To pick up
 * `AEM_FIXTURES_DIR` from the environment at CLI entry points, call
 * `applyFixturesFromEnv(deps)` first.
 */
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

/**
 * CLI-only helper: copies `AEM_FIXTURES_DIR` from `process.env` into
 * `deps.fixturesDir` (if not already set). Keeps env-var reading out of
 * library code — only CLI entry points should touch `process.env`.
 */
export function applyFixturesFromEnv(deps: FetchDeps): FetchDeps {
  if (deps.fixturesDir) return deps;
  const dir = process.env.AEM_FIXTURES_DIR;
  if (!dir) return deps;
  return { ...deps, fixturesDir: dir };
}

// Avoid unused warnings on the re-export list — these types are part of the
// fixture-mode public surface.
export type { AemFetchError, AmbiguousResolution, FetchInfinityOptions };
