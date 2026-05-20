#!/usr/bin/env -S tsx
/**
 * Capture AEM `.infinity.json` responses to disk so the fetcher and downstream
 * extract pipeline can be unit-tested (and the depth-5 splice can be
 * TDD-ed) without hitting live AEM.
 *
 * Usage (run from a tenant example folder so `dotenv/config` picks up its `.env`):
 *
 *   pnpm --filter example-<your-tenant> tsx ../../packages/aem-to-sanity-core/scripts/capture-fixtures.ts
 *
 * Or directly from the core package:
 *
 *   cd packages/aem-to-sanity-core && pnpm tsx scripts/capture-fixtures.ts
 *
 * Reads the same env vars as `aem-extract` (`AEM_AUTHOR_URL`,
 * `AEM_AUTHOR_USERNAME`, `AEM_AUTHOR_PASSWORD`, or `AEM_TOKEN`). Writes under
 * `<cwd>/output/cache/fixtures/aem/` by default, overridable via
 * `FIXTURES_OUT_DIR`.
 *
 * For each target: performs the fetch, writes the JSON body as a file with a
 * filename derived from the URL (see `fixtureFilenameForUrl`), and — if the
 * response is a successful JSON tree — recursively enqueues every
 * truncation marker discovered by `detectTruncations` up to
 * `MARKER_FOLLOW_BUDGET` rounds. This produces a self-contained fixture set
 * that replays a complete multi-response extract offline.
 *
 * Safety: only reads from AEM; no mutations. Every request is GET.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AemFetchError,
  fetchInfinityJson,
  resolveConfig,
  type AmbiguousResolution,
} from "../src/index.ts";
import { fixtureFilenameForUrl } from "../src/aem/fetcher-fixtures.ts";
import { detectTruncations } from "../src/aem/infinity.ts";

const MARKER_FOLLOW_BUDGET = 3;
// Dialog paths to capture. Defaults are empty so this script is tenant-agnostic
// — set FIXTURE_DIALOG_PATHS to a comma-separated list of JCR paths (the
// `_cq_dialog` suffix is appended automatically) if you want dialog fixtures.
const DIALOG_TARGETS = (process.env.FIXTURE_DIALOG_PATHS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0)
  .map((p) => (p.endsWith("/_cq_dialog") ? p : `${p}/_cq_dialog`));
const NOT_FOUND_TARGET = "/content/does-not-exist-abc123";

/**
 * Content targets come from a roots file (same format as the migrator
 * consumes). Defaults to `<cwd>/aem-content-roots.fixtures` so the script
 * runs against whatever tenant folder you invoked it from, rather than
 * hardcoding a specific tenant path. Override with `FIXTURE_ROOTS_FILE`.
 *
 * Parser mirrors `aem-to-sanity-content/src/extract.ts::parseRoots` (small
 * duplication kept intentionally so this script has no cross-package runtime
 * dependency on `aem-to-sanity-content`).
 */
function readContentTargets(): string[] {
  const file = resolve(
    process.env.FIXTURE_ROOTS_FILE ?? join(process.cwd(), "aem-content-roots.fixtures"),
  );
  const raw = readFileSync(file, "utf8");
  const out: string[] = [];
  let base: string | undefined;
  for (const rawLine of raw.split(/\r?\n/)) {
    const commentAt = rawLine.indexOf("#");
    const line = (commentAt === -1 ? rawLine : rawLine.slice(0, commentAt)).trim();
    if (!line) continue;
    if (line.startsWith("@base")) {
      const rest = line.slice(5).trim();
      if (!rest.startsWith("/")) {
        throw new Error(`@base must be an absolute path, got ${JSON.stringify(rest)}`);
      }
      base = rest.replace(/\/+$/, "");
      continue;
    }
    if (line.startsWith("/")) {
      out.push(line.replace(/\/+$/, ""));
      continue;
    }
    if (!base) {
      throw new Error(`Relative slug ${JSON.stringify(line)} needs an @base above it in ${file}.`);
    }
    out.push(`${base}/${line}`);
  }
  if (out.length === 0) {
    throw new Error(`No content targets found in ${file}.`);
  }
  return out;
}

// Ambiguous case — real AEM returns 300 on the site root for us; the live
// harness resolves it to `.4.json`, which we also want on disk so the
// fixtures-mode replay exercises the full 300 → refetch path.

interface CaptureStats {
  attempts: number;
  writtenBodies: number;
  writtenMetas: number;
  skipped: number;
  errors: Array<{ target: string; message: string }>;
  bytes: number;
}

async function main(): Promise<void> {
  const config = await resolveConfig(process.env);
  const outDir = resolve(
    process.env.FIXTURES_OUT_DIR ??
      join(process.cwd(), "output/cache/fixtures/aem"),
  );
  mkdirSync(outDir, { recursive: true });

  console.log(`[capture] baseUrl=${config.baseUrl}`);
  console.log(`[capture] outDir=${outDir}`);

  const captured = new Set<string>();
  const captured300 = new Set<string>();
  const ambiguousAll: AmbiguousResolution[] = [];
  const stats: CaptureStats = {
    attempts: 0,
    writtenBodies: 0,
    writtenMetas: 0,
    skipped: 0,
    errors: [],
    bytes: 0,
  };

  // Phase 1: dialogs — shallow, never expect markers. Direct capture.
  for (const dialogPath of DIALOG_TARGETS) {
    await captureSingle(
      config.baseUrl,
      dialogPath,
      ".infinity.json",
      outDir,
      captured,
      captured300,
      ambiguousAll,
      stats,
    );
  }

  // Phase 2: content roots + follow-up markers (marker chain).
  const contentTargets = readContentTargets();
  console.log(`[capture] content targets: ${contentTargets.length}`);
  for (const contentPath of contentTargets) {
    await captureWithFollowups(
      config.baseUrl,
      contentPath,
      outDir,
      captured,
      captured300,
      ambiguousAll,
      stats,
    );
  }

  // Phase 3: a known 404 — keep the .meta.json for the error kind.
  await captureSingle(
    config.baseUrl,
    NOT_FOUND_TARGET,
    ".infinity.json",
    outDir,
    captured,
    captured300,
    ambiguousAll,
    stats,
    { expectStatus: 404 },
  );

  // README: describe the mapping and list every captured URL.
  writeReadme(outDir, [...captured], [...captured300], ambiguousAll);

  console.log(`\n[capture] done.`);
  console.log(`  attempts:     ${stats.attempts}`);
  console.log(`  bodies saved: ${stats.writtenBodies}`);
  console.log(`  metas saved:  ${stats.writtenMetas}`);
  console.log(`  bytes total:  ${formatBytes(stats.bytes)}`);
  console.log(`  errors:       ${stats.errors.length}`);
  for (const e of stats.errors) {
    console.log(`    - ${e.target} :: ${e.message.slice(0, 120)}`);
  }

  if (process.env.SKIP_SMOKE === "1") {
    console.log(`\n[capture] SKIP_SMOKE=1 — not running extract smoke test.`);
    return;
  }

  console.log(`\n[capture] fixtures ready at ${outDir}`);
  console.log(`[capture] next: run AEM_FIXTURES_DIR=${outDir} aem-extract`);
}

async function captureWithFollowups(
  baseUrl: string,
  rootPath: string,
  outDir: string,
  captured: Set<string>,
  captured300: Set<string>,
  ambiguousAll: AmbiguousResolution[],
  stats: CaptureStats,
): Promise<void> {
  // Seed the worklist with the root, then iterate — each round captures
  // everything currently in the queue, collects new markers, and repeats.
  let worklist: string[] = [rootPath];
  for (let round = 0; round <= MARKER_FOLLOW_BUDGET && worklist.length > 0; round++) {
    const tier = worklist;
    worklist = [];
    for (const path of tier) {
      if (captured.has(`${path}.infinity.json`)) continue;
      const tree = await captureSingle(
        baseUrl,
        path,
        ".infinity.json",
        outDir,
        captured,
        captured300,
        ambiguousAll,
        stats,
      );
      if (tree === undefined) continue;
      const markers = detectTruncations(tree, path);
      if (markers.length > 0) {
        console.log(
          `  [markers] ${path} → ${markers.length} marker(s) found (round ${round})`,
        );
      }
      for (const m of markers) {
        if (!captured.has(`${m}.infinity.json`)) worklist.push(m);
      }
    }
  }
}

interface CaptureOptions {
  expectStatus?: number;
}

async function captureSingle(
  baseUrl: string,
  jcrPath: string,
  selector: string,
  outDir: string,
  captured: Set<string>,
  captured300: Set<string>,
  ambiguousAll: AmbiguousResolution[],
  stats: CaptureStats,
  opts: CaptureOptions = {},
): Promise<unknown | undefined> {
  const relativePath = `${jcrPath}${selector}`;
  if (captured.has(relativePath)) {
    stats.skipped++;
    return undefined;
  }
  captured.add(relativePath);
  stats.attempts++;
  const url = `${baseUrl}${relativePath}`;

  // Intercept fetch so we can save the wire response (including 300 body +
  // the follow-up 200 body) rather than only the resolved tree.
  const records: Array<{ url: string; status: number; body: string }> = [];
  const recordingFetch: typeof globalThis.fetch = async (input, init) => {
    const res = await globalThis.fetch(input, init);
    // Tee the body: clone, read full text.
    const body = await res.clone().text();
    records.push({
      url: typeof input === "string" ? input : (input as URL).toString(),
      status: res.status,
      body,
    });
    return res;
  };

  try {
    const tree = await fetchInfinityJson(
      {
        config: await resolveConfig(process.env),
        fetch: recordingFetch,
      },
      jcrPath,
      undefined,
      {
        onAmbiguous: (r) => {
          ambiguousAll.push(r);
        },
      },
    );
    // Save every recorded response. For the .infinity.json that returned 300,
    // store the 300 body as a meta sidecar (so fixture replay can run the
    // same refetch flow). For the chosen .N.json and the 200s, store the body.
    for (const rec of records) {
      const relUrl = rec.url.slice(baseUrl.length);
      const fname = fixtureFilenameForUrl(relUrl);
      if (rec.status === 200) {
        const filePath = join(outDir, fname);
        writeFileSync(filePath, rec.body, "utf8");
        stats.writtenBodies++;
        stats.bytes += Buffer.byteLength(rec.body, "utf8");
      } else if (rec.status === 300) {
        // Save as meta sidecar; body contains the alternatives listing.
        const metaPath = join(outDir, `${fname}.meta.json`);
        writeFileSync(
          metaPath,
          JSON.stringify({ status: 300, body: rec.body }, null, 2) + "\n",
          "utf8",
        );
        captured300.add(relUrl);
        stats.writtenMetas++;
        stats.bytes += Buffer.byteLength(rec.body, "utf8");
      } else {
        const metaPath = join(outDir, `${fname}.meta.json`);
        writeFileSync(
          metaPath,
          JSON.stringify(
            { status: rec.status, body: rec.body.slice(0, 2000) },
            null,
            2,
          ) + "\n",
          "utf8",
        );
        stats.writtenMetas++;
      }
    }
    console.log(`  ✓ ${jcrPath}${selector}  (${records.length} response(s))`);
    return tree;
  } catch (err) {
    const e = err as AemFetchError;
    const message = e.message ?? String(err);
    // Expected 404: capture as meta so replay gets the same error.
    if (e instanceof AemFetchError && e.details?.status === 404) {
      const fname = fixtureFilenameForUrl(relativePath);
      writeFileSync(
        join(outDir, `${fname}.meta.json`),
        JSON.stringify({ status: 404 }, null, 2) + "\n",
        "utf8",
      );
      stats.writtenMetas++;
      console.log(`  ✓ ${jcrPath}${selector}  (404 captured)`);
      return undefined;
    }
    // Anything else is real: log and skip.
    stats.errors.push({ target: `${jcrPath}${selector}`, message });
    console.log(`  ✗ ${jcrPath}${selector}  :: ${message.slice(0, 160)}`);
    return undefined;
  }
}

function writeReadme(
  outDir: string,
  captured: string[],
  captured300: string[],
  ambiguous: AmbiguousResolution[],
): void {
  const lines: string[] = [];
  lines.push(`# AEM fixture set — David's Bridal`);
  lines.push("");
  lines.push(
    `Captured by \`packages/aem-to-sanity-core/scripts/capture-fixtures.ts\`.`,
  );
  lines.push(
    `Replay these offline with \`AEM_FIXTURES_DIR=${outDir.replace(/.*\/examples/, "examples")} aem-extract\`.`,
  );
  lines.push("");
  lines.push(`## URL → filename mapping`);
  lines.push("");
  lines.push(`Each AEM URL is encoded as:`);
  lines.push("");
  lines.push("```");
  lines.push(`<baseUrl><relPath>   →   <relPath with "/" replaced by "__", leading "/" dropped>`);
  lines.push("```");
  lines.push("");
  lines.push(`Examples:`);
  lines.push("");
  lines.push("```");
  lines.push(
    `GET  /content/dbi.infinity.json              → content__dbi.infinity.json`,
  );
  lines.push(
    `GET  /content/dbi/en/home.infinity.json      → content__dbi__en__home.infinity.json`,
  );
  lines.push(
    `GET  /content/dbi.4.json                     → content__dbi.4.json`,
  );
  lines.push("```");
  lines.push("");
  lines.push(`Non-200 responses (404, 300, 500) are stored in a sidecar file named`);
  lines.push(`\`<filename>.meta.json\` with shape:`);
  lines.push("");
  lines.push("```json");
  lines.push(`{ "status": 300, "body": "..." }`);
  lines.push(`{ "status": 404 }`);
  lines.push("```");
  lines.push("");
  lines.push(`A missing fixture (no body file, no meta) replays as 404 — fixture mode is closed-world.`);
  lines.push("");
  lines.push(`## Captured URLs (${captured.length})`);
  lines.push("");
  for (const rel of captured.sort()) {
    lines.push(`- \`${rel}\``);
  }
  if (captured300.length > 0) {
    lines.push("");
    lines.push(`## Ambiguous (HTTP 300) responses (${captured300.length})`);
    lines.push("");
    for (const rel of captured300.sort()) {
      const match = ambiguous.find((a) => a.originalUrl.endsWith(rel));
      lines.push(
        `- \`${rel}\`${match ? `  → resolved to \`${match.chosenUrl.replace(/^https?:\/\/[^/]+/, "")}\` (depth ${match.chosenDepth})` : ""}`,
      );
    }
  }
  lines.push("");
  lines.push(`## Regenerating`);
  lines.push("");
  lines.push(`\`\`\``);
  lines.push(
    `AEM_ENV=author AEM_AUTHOR_URL=... AEM_AUTHOR_USERNAME=... AEM_AUTHOR_PASSWORD=... \\`,
  );
  lines.push(
    `  pnpm --filter aem-to-sanity-core tsx scripts/capture-fixtures.ts`,
  );
  lines.push(`\`\`\``);
  lines.push("");
  writeFileSync(join(outDir, "README.md"), lines.join("\n"), "utf8");
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

main().catch((err) => {
  console.error(`\nFATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
