/**
 * Build the committed `tenants/demo/` tenant from two real tenant caches
 * (davids-bridal + t-mobile). Commits scrubbed AEM REST fixtures (raw only);
 * operators regenerate clean output via the normal pipeline.
 *
 *   pnpm build:demo-fixtures [--scratch] [--capture-tags]
 *
 * Default output: `tenants/demo/`. Use `--scratch` to write to
 * `output/demo-scratch/` for review first.
 *
 * Demo DAM binaries are procedural animated GIFs (one per layout kind) — no AEM
 * download. Tag capture still needs live AEM once per maintainer refresh.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchInfinityTree,
  resolveConfig,
  type Config,
} from "../packages/aem-to-sanity-core/src/index.ts";
import { fixturePathForUrl, fixtureRelativePathForUrl } from "../packages/aem-to-sanity-core/src/aem/fetcher-fixtures.ts";
import {
  classifyDemoLayout,
  DEMO_LAYOUT_KINDS,
  generatedDamPath,
  writeAnimatedLayoutGif,
} from "./lib/demo-image-generator.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_OUT = join(REPO_ROOT, "tenants", "demo");
const SCRATCH_OUT = join(REPO_ROOT, "output", "demo-scratch");

const LONG_STRING_THRESHOLD = 40;
const METADATA_KEYS = new Set(["__generated", "fetchedAt", "generatedAt"]);

const SOURCES = [
  {
    key: "site-a",
    tenantDir: "tenants/davids-bridal",
    pathPrefixes: ["/content/aem-integration/us/en", "/content/aem-integration"],
    sitePathPrefixes: [
      ["/content/aem-integration/us/en", "/content/demo/site-a/us/en"],
      ["/content/aem-integration", "/content/demo/site-a"],
    ],
    tagSource: false,
  },
  {
    key: "site-b",
    tenantDir: "tenants/t-mobile",
    pathPrefixes: ["/content/uxp/us/en", "/content/uxp"],
    sitePathPrefixes: [
      ["/content/uxp/us/en", "/content/demo/site-b/us/en"],
      ["/content/uxp", "/content/demo/site-b"],
    ],
    tagSource: true,
  },
] as const;

const APPS_PREFIXES: Array<[string, string]> = [
  ["/apps/aem-integration/", "/apps/demo-site-a/"],
  ["/apps/dbi/", "/apps/demo/"],
  ["/apps/uxp/", "/apps/demo/"],
];

const CONF_PREFIXES: Array<[string, string]> = [
  ["/conf/aem-integration/", "/conf/demo-site-a/"],
  ["/conf/uxp/", "/conf/demo-site-b/"],
];

const DAM_PREFIXES: Array<[string, string]> = [
  ["/content/dam/aem-integration", "/content/dam/demo/site-a"],
  ["/content/dam/davids-bridal", "/content/dam/demo/site-a"],
  ["/content/dam/dbi", "/content/dam/demo"],
  ["/content/dam/uxp", "/content/dam/demo/site-b"],
];

const TAG_PREFIXES: Array<[string, string]> = [
  ["/content/cq:tags/promotion", "/content/cq:tags/demo/promotion"],
  ["/content/cq:tags/page-type", "/content/cq:tags/demo/page-type"],
  ["/content/cq:tags", "/content/cq:tags/demo"],
];

const BRAND_TOKENS: Array<[RegExp, string]> = [
  [/Dbi/g, "Demo"],
  [/Uxp/g, "Demo"],
  [/david'?s\s+bridal/gi, "Site A"],
  [/davids[-_]bridal/gi, "site-a"],
  [/\baem[-_]integration\b/gi, "demo-site-a"],
  [/\bt[-\s]?mobile\b/gi, "Site B"],
  [/\btmo\b/gi, "Site B"],
  [/\bun[-\s]?carrier\b/gi, "modern"],
  [/t[-_]mobile\.com/gi, "example.com"],
  [/davidsbridal\.com/gi, "example.com"],
  [/BRIDESMAID'?S?/g, "COMPANION"],
  [/Bridesmaid'?s?/g, "Companion"],
  [/bridesmaid'?s?/g, "companion"],
  [/BRIDAL/g, "APPAREL"],
  [/Bridal/g, "Apparel"],
  [/bridal/g, "apparel"],
  [/MAGENTA/g, "BRANDB"],
  [/Magenta/g, "BrandB"],
  [/magenta/g, "brandb"],
  [/ASPIRATIONAL/g, "FEATURED"],
  [/Aspirational/g, "Featured"],
  [/aspirational/g, "featured"],
  [/SAMPLE\s+SALE/g, "SEASONAL SALE"],
  [/Sample\s+Sale/g, "Seasonal Sale"],
  [/sample\s+sale/gi, "seasonal sale"],
  [/WEDDING/g, "EVENT"],
  [/Wedding/g, "Event"],
  [/wedding/g, "event"],
  [/VOWS/g, "PROMISES"],
  [/Vows/g, "Promises"],
  [/vows/g, "promises"],
  [/LABUBU/g, "SHOWCASE"],
  [/Labubu/g, "Showcase"],
  [/labubu/g, "showcase"],
  [/DBI/g, "DEMO"],
  [/Dbi/g, "Demo"],
  [/dbi/g, "demo"],
  [/UXP/g, "DEMO"],
  [/Uxp/g, "Demo"],
  [/uxp/g, "demo"],
];

const BRAND_LEAK_REGEX =
  /(?:\bt[-_\s]?mobile\b|\btmobile\b|\bun[-\s]?carrier\b|magenta|david'?s\s+bridal|davids[-_]bridal|\bdbi\b|Dbi|bridal|bridesmaid|aspirational|labubu|\buxp\b|Uxp|aem-integration)/i;

const URL_BRAND_LEAK_REGEX =
  /(?:tmobile|t-mobile|magenta|uncarrier|un-carrier|davidsbridal|david'?s|bridal|dbi|aem-integration|uxp|labubu|aspirational)/i;

const LOREM_CORPUS = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.",
  "Curabitur pretium tincidunt lacus, nulla gravida orci a odio.",
  "Nullam varius, turpis et commodo pharetra, est eros bibendum elit.",
  "Vestibulum auctor dapibus neque, vivamus vel nulla eget eros elementum.",
  "Praesent feugiat tellus eget velit fringilla, nec vehicula nisi vulputate.",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium.",
  "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit.",
  "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.",
  "Quis autem vel eum iure reprehenderit qui in ea voluptate velit.",
  "At vero eos et accusamus et iusto odio dignissimos ducimus.",
  "Temporibus autem quibusdam et aut officiis debitis aut rerum.",
];

const LOREM_HEADINGS = [
  "Demo Heading A",
  "Demo Heading B",
  "Demo Heading C",
  "Demo Heading D",
  "Demo Heading E",
  "Demo Heading F",
  "Demo Heading G",
  "Demo Heading H",
];

interface ScrubReport {
  fixturesWritten: number;
  configsWritten: number;
  imagesWritten: number;
  stringsScrubbed: number;
  longStringsReplaced: number;
  brandLeaks: Array<{ file: string; line: number; sample: string }>;
}

interface ScrubCtx {
  sourceKey: string;
  report: ScrubReport;
  skipLorem?: boolean;
}

function sha1Hex(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

function pickFromCorpus<T>(corpus: T[], seed: string): T {
  const hash = sha1Hex(seed);
  const n = parseInt(hash.slice(0, 8), 16);
  return corpus[n % corpus.length]!;
}

function applyPrefixRewrites(s: string, pairs: Array<[string, string]>): string {
  let out = s;
  for (const [from, to] of pairs) {
    if (out.startsWith(from)) {
      out = to + out.slice(from.length);
    }
  }
  return out;
}

function applyBrandTokens(s: string): string {
  let out = s;
  for (const [re, replacement] of BRAND_TOKENS) {
    out = out.replace(re, replacement);
  }
  return out;
}

function rewritePaths(s: string): string {
  let out = s;
  // Longest prefix first so `/content/uxp/us/en` wins over `/content/uxp`.
  const sitePairs = SOURCES.flatMap((src) => src.sitePathPrefixes).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [from, to] of sitePairs) {
    if (out.startsWith(from)) {
      out = to + out.slice(from.length);
      break;
    }
  }
  out = applyPrefixRewrites(out, DAM_PREFIXES);
  out = applyPrefixRewrites(out, APPS_PREFIXES);
  out = applyPrefixRewrites(out, CONF_PREFIXES);
  const tagPairs = [...TAG_PREFIXES].sort((a, b) => b[0].length - a[0].length);
  if (!out.startsWith("/content/cq:tags/demo")) {
    for (const [from, to] of tagPairs) {
      if (out.startsWith(from)) {
        out = to + out.slice(from.length);
        break;
      }
    }
  }
  return out;
}

/** Rewrite DAM path prefixes, then map to a generated layout asset (animated GIF). */
function scrubDamPath(damPath: string): string {
  const rewritten = rewritePaths(damPath);
  const intermediate = rewritten
    .split("/")
    .map((seg, i) => (i <= 3 ? seg : applyBrandTokens(seg)))
    .join("/");
  const kind = classifyDemoLayout(intermediate);
  return generatedDamPath(kind);
}

function scrubScalarString(s: string, ctx: ScrubCtx): string {
  if (!s) return s;

  if (/^https?:\/\//i.test(s) && URL_BRAND_LEAK_REGEX.test(s)) {
    ctx.report.stringsScrubbed += 1;
    return "https://example.com";
  }

  if (
    s.startsWith("/content/") ||
    s.startsWith("/apps/") ||
    s.startsWith("/conf/") ||
    s.startsWith("/content/dam/")
  ) {
    s = rewritePaths(s);
  }

  // DAM paths are asset identifiers — never replace with lorem.
  if (s.startsWith("/content/dam/")) {
    return scrubDamPath(s);
  }

  const tokenized = applyBrandTokens(s);
  if (tokenized !== s) ctx.report.stringsScrubbed += 1;
  s = tokenized;

  if (ctx.skipLorem) return s;

  if (s.length >= LONG_STRING_THRESHOLD && /[a-z].*[a-z].*[a-z]/i.test(s)) {
    const looksLikeUrl = /^https?:\/\//i.test(s);
    const looksLikeJsonOrCss = /^\s*[{[<]/.test(s) || /;\s*[a-z-]+\s*:/.test(s);
    const looksLikeIdentifier = /^[a-z0-9_\-/:]+$/i.test(s);
    if (!looksLikeUrl && !looksLikeJsonOrCss && !looksLikeIdentifier) {
      ctx.report.longStringsReplaced += 1;
      return s.length < 80
        ? pickFromCorpus(LOREM_HEADINGS, s)
        : pickFromCorpus(LOREM_CORPUS, s);
    }
  }

  return s;
}

function scrubValue(value: unknown, ctx: ScrubCtx, key?: string): unknown {
  if (typeof value === "string") {
    const skipLorem = key !== undefined && METADATA_KEYS.has(key);
    return scrubScalarString(value, { ...ctx, skipLorem: ctx.skipLorem || skipLorem });
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, ctx));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const scrubbedKey = applyBrandTokens(k);
      out[scrubbedKey] = scrubValue(v, ctx, k);
    }
    return out;
  }
  return value;
}

function scrubTextFile(content: string, ctx: ScrubCtx): string {
  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      return scrubScalarString(line, ctx);
    })
    .join("\n");
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function writeTextFileSync(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.endsWith("\n") ? content : content + "\n", "utf8");
}

function fixtureUrlForJcrPath(jcrPath: string, selector = ".infinity.json"): string {
  const trimmed = jcrPath.replace(/\/+$/, "");
  return `${trimmed}${selector}`;
}

async function writeFixture(
  fixturesDir: string,
  jcrPath: string,
  body: unknown,
  ctx: ScrubCtx,
): Promise<void> {
  const scrubbed = scrubValue(body, ctx);
  const url = fixtureUrlForJcrPath(jcrPath);
  const outPath = fixturePathForUrl(fixturesDir, url);
  await writeJsonFile(outPath, scrubbed);
  ctx.report.fixturesWritten += 1;
}

async function emitContentFixtures(fixturesDir: string, ctx: ScrubCtx): Promise<void> {
  for (const src of SOURCES) {
    const rawDir = join(REPO_ROOT, src.tenantDir, "output/cache/raw");
    let files: string[];
    try {
      files = (await readdir(rawDir)).filter((f) => f.endsWith(".json"));
    } catch {
      throw new Error(`Missing raw cache at ${rawDir} — run extract on ${src.tenantDir} first.`);
    }
    for (const file of files) {
      const wrapper = JSON.parse(await readFile(join(rawDir, file), "utf8")) as {
        jcrPath: string;
        tree: unknown;
      };
      const demoPath = scrubScalarString(rewritePaths(wrapper.jcrPath), {
        ...ctx,
        sourceKey: src.key,
      });
      await writeFixture(fixturesDir, demoPath, wrapper.tree, {
        ...ctx,
        sourceKey: src.key,
      });
    }
  }
}

async function walkJsonFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkJsonFiles(p)));
    else if (entry.name.endsWith(".json")) out.push(p);
  }
  return out;
}

async function emitDialogFixtures(fixturesDir: string, ctx: ScrubCtx): Promise<void> {
  const seen = new Set<string>();
  for (const src of SOURCES) {
    const componentsDir = join(REPO_ROOT, src.tenantDir, "output/cache/aem/components");
    const files = await walkJsonFiles(componentsDir);
    for (const file of files) {
      const rel = relative(componentsDir, file).replace(/\\/g, "/");
      if (!rel.startsWith("apps/")) continue;
      const jcrPath = "/" + rel.replace(/\.json$/, "").replace(/\//g, "/");
      const dialogPath = jcrPath.endsWith("/_cq_dialog")
        ? jcrPath
        : `${jcrPath}/_cq_dialog`;
      const demoDialogPath = applyBrandTokens(rewritePaths(dialogPath));
      if (seen.has(demoDialogPath)) continue;
      seen.add(demoDialogPath);
      const body = JSON.parse(await readFile(file, "utf8")) as unknown;
      const componentPath = demoDialogPath.replace(/\/_cq_dialog$/, "");
      // migrate:schema fetches the component node first and looks for an
      // embedded `cq:dialog` before requesting `/_cq_dialog` separately.
      await writeFixture(
        fixturesDir,
        componentPath,
        {
          "jcr:primaryType": "cq:Component",
          "cq:dialog": body,
        },
        { ...ctx, sourceKey: src.key },
      );
      await writeFixture(fixturesDir, demoDialogPath, body, {
        ...ctx,
        sourceKey: src.key,
      });
    }
  }
}

/** Matches `flatten()` in `packages/aem-to-sanity-content/src/assets.ts`. */
function flattenDamPath(damPath: string): string {
  return damPath.replace(/^\/content\/dam\//, "").replace(/\//g, "--");
}

function clearAemEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("AEM_")) delete process.env[key];
  }
}

function loadTenantEnv(tenantRoot: string): void {
  clearAemEnv();
  const envPath = join(tenantRoot, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function resolveTenantConfig(tenantDir: string): Promise<Config> {
  const tenantRoot = join(REPO_ROOT, tenantDir);
  const prevCwd = process.cwd();
  loadTenantEnv(tenantRoot);
  process.chdir(tenantRoot);
  try {
    return await resolveConfig(process.env);
  } finally {
    process.chdir(prevCwd);
  }
}

async function emitAssetFixtures(assetsDir: string, ctx: ScrubCtx): Promise<void> {
  await mkdir(assetsDir, { recursive: true });

  for (const kind of DEMO_LAYOUT_KINDS) {
    const damPath = generatedDamPath(kind);
    const destFile = join(assetsDir, flattenDamPath(damPath));
    console.log(`[build-demo] generating ${kind} → ${relative(REPO_ROOT, destFile)}`);
    writeAnimatedLayoutGif(destFile, kind);
    ctx.report.imagesWritten += 1;
  }
}

const TAG_ROOTS_LIVE = ["/content/cq:tags/promotion", "/content/cq:tags/page-type"];
const TAG_ROOTS_DEMO = TAG_ROOTS_LIVE.map((p) => rewritePaths(p));
const TAG_NAMESPACE_DEMO = "/content/cq:tags/demo";

async function captureTagFixtures(fixturesDir: string, ctx: ScrubCtx): Promise<void> {
  const envPath = join(REPO_ROOT, "tenants/t-mobile/.env");
  if (!existsSync(envPath)) {
    throw new Error(
      "Tag capture needs tenants/t-mobile/.env with live AEM credentials. " +
        "Run without --capture-tags to reuse existing tag fixtures.",
    );
  }
  const config = await resolveTenantConfig("tenants/t-mobile");
  console.log(`[build-demo] capturing tag fixtures from ${config.baseUrl}…`);
  const prevCwd = process.cwd();
  process.chdir(join(REPO_ROOT, "tenants/t-mobile"));
  try {
    for (let i = 0; i < TAG_ROOTS_LIVE.length; i += 1) {
      const livePath = TAG_ROOTS_LIVE[i]!;
      const demoPath = TAG_ROOTS_DEMO[i]!;
      const { tree } = await fetchInfinityTree({ config }, livePath, {});
      await writeFixture(fixturesDir, demoPath, tree, { ...ctx, sourceKey: "site-b" });
    }
  } finally {
    process.chdir(prevCwd);
    clearAemEnv();
  }
}

async function writeTagNamespaceFixture(fixturesDir: string, ctx: ScrubCtx): Promise<void> {
  await writeFixture(
    fixturesDir,
    TAG_NAMESPACE_DEMO,
    {
      "jcr:primaryType": "cq:Tag",
      "jcr:title": "Demo Tags",
      "sling:resourceType": "cq/tagging/components/tag",
    },
    { ...ctx, sourceKey: "site-b" },
  );
}

async function ensureTagFixtures(
  fixturesDir: string,
  ctx: ScrubCtx,
  captureTags: boolean,
): Promise<void> {
  const missing = TAG_ROOTS_DEMO.filter((p) => {
    return !existsSync(fixturePathForUrl(fixturesDir, fixtureUrlForJcrPath(p)));
  });
  if (missing.length === 0) return;
  if (captureTags) {
    await captureTagFixtures(fixturesDir, ctx);
    return;
  }
  throw new Error(
    `Missing tag fixtures: ${missing.join(", ")}. Re-run with --capture-tags ` +
      `(requires live AEM access via tenants/t-mobile/.env) or copy fixtures manually.`,
  );
}

function readLinesFile(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/);
}

function generateContentRoots(ctx: ScrubCtx): string {
  const siteASlugs = ["home", "vows", "labubu", "faq"];
  const siteBSlugs = [
    "customer-support/plans/consumer/phones/experience-beyond-plan",
    "development-growth/news/magenta-accelerator-fall-2026",
    "customer-support/promotions/android/phone/29643",
  ];
  const blocks: string[] = [
    "# Demo content roots — generated by build-demo-fixtures.ts",
    "# Two sites merged from scrubbed source caches (site-a + site-b).",
    "",
    "@base /content/demo/site-a/us/en",
    "",
    ...siteASlugs.map((s) => scrubScalarString(s, ctx)),
    "",
    "@base /content/demo/site-b/us/en",
    "",
    ...siteBSlugs.map((s) => scrubScalarString(s, ctx)),
    "",
  ];
  return blocks.join("\n");
}

function generateComponentPaths(ctx: ScrubCtx): string {
  const seen = new Set<string>();
  const lines: string[] = [
    "# Generated by build-demo-fixtures.ts — union of site-a + site-b component paths.",
  ];
  for (const src of SOURCES) {
    const file = join(REPO_ROOT, src.tenantDir, "aem-component-paths");
    for (const raw of readLinesFile(file)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const scrubbed = scrubScalarString(line, ctx);
      if (seen.has(scrubbed)) continue;
      seen.add(scrubbed);
      lines.push(scrubbed);
    }
  }
  return lines.join("\n") + "\n";
}

function generateTagRoots(_ctx: ScrubCtx): string {
  return `# Demo tag roots — generated by build-demo-fixtures.ts
#
/content/cq:tags/demo

@base /content/cq:tags/demo

promotion
page-type
`;
}

function mergeJsonConfig(
  filename: string,
  ctx: ScrubCtx,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const src of SOURCES) {
    const path = join(REPO_ROOT, src.tenantDir, filename);
    if (!existsSync(path)) continue;
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    for (const [key, value] of Object.entries(raw)) {
      const scrubbedKey = scrubScalarString(key, ctx);
      if (merged[scrubbedKey] !== undefined) continue;
      merged[scrubbedKey] = scrubValue(value, ctx);
    }
  }
  return merged;
}

function generatePageComponents(ctx: ScrubCtx): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out[scrubScalarString("aem-integration/components/page", ctx)] = { discover: true };
  out[scrubScalarString("uxp/components/structure/page", ctx)] = { discover: true };
  return out;
}

function generateEnvExample(): string {
  return `# Demo tenant — offline AEM via fixtures. No live AEM credentials required.
# Copy to .env and fill in your Sanity project values.

AEM_ENV=author
AEM_AUTHOR_URL=http://demo.local
AEM_TOKEN=offline-fixtures
AEM_FIXTURES_DIR=./fixtures/aem

SANITY_PROJECT_ID=your-project-id
SANITY_DATASET=production
SANITY_TOKEN=your-write-token
SANITY_MEDIA_LIBRARY_ID=ml-xxxxxxxxxxxx

OUTPUT_DIR=./output
MIGRATION_DOC_ID_PREFIX_STRIP=/content/demo/site-a/us/en,/content/demo/site-b/us/en
MIGRATION_DRY_RUN=false
MIGRATION_DISCARD_DRAFTS=true
`;
}

function generatePackageJson(): string {
  const pkg = {
    name: "tenant-demo",
    version: "0.0.0",
    private: true,
    description:
      "Offline demo tenant — replays scrubbed AEM fixtures through the full migration pipeline.",
    type: "module",
    scripts: {
      "migrate:schema": "aem-to-sanity-schema",
      typegen: "aem-to-sanity-typegen",
      "pagebuilder:refresh": "aem-to-sanity-pagebuilder",
      extract: "aem-extract",
      tags: "aem-tags",
      transform: "aem-transform --registry ./output/cache/content-type-registry.json",
      assets: "aem-assets",
      import: "aem-import",
      "migrate:demo":
        'tsx ../../scripts/run-with-log.ts "pnpm run extract && pnpm run tags && pnpm run migrate:schema && pnpm run transform && pnpm run assets && pnpm run import -- --discard-drafts"',
      "migrate:content":
        'tsx ../../scripts/run-with-log.ts "pnpm run extract && pnpm run tags && pnpm run transform && pnpm run assets && pnpm run import"',
      "migrate:all": "pnpm run migrate:schema && pnpm run typegen",
      migrate:
        'tsx ../../scripts/run-with-log.ts "pnpm run extract && pnpm run tags && pnpm run migrate:schema && pnpm run transform && pnpm run assets && pnpm run import -- --discard-drafts"',
    },
    devDependencies: {
      "aem-to-sanity-content": "workspace:*",
      "aem-to-sanity-schema": "workspace:*",
      sanity: "^5.26.0",
      tsx: "^4.21.0",
    },
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

function generateReadme(): string {
  return `# Demo tenant (no AEM)

Offline demo of the AEM → Sanity migration pipeline. All AEM REST responses are
committed as scrubbed fixtures under \`fixtures/aem/\`; running the pipeline
regenerates \`output/cache/raw/\`, \`clean/\`, schemas, and imports locally.
\`output/\` is gitignored — only fixtures and tenant config are committed.

## Fixture layout

\`\`\`
fixtures/aem/
├── content/...   page + tag .infinity.json trees (mirrors /content/...)
├── apps/...      component + dialog .infinity.json trees (mirrors /apps/...)
└── assets/       procedural animated GIFs per layout kind (/_generated/*.gif)
\`\`\`

Fixture paths mirror AEM URL paths — \`/content/demo/...\` becomes
\`fixtures/aem/content/demo/....infinity.json\`. \`aem-assets\` reads \`assets/\`
when that env var is set. Content references canonical \`/_generated/{layout}.gif\` paths.

## Quick start (operators)

\`\`\`bash
cd tenants/demo
cp .env.example .env          # fill SANITY_* vars with your project
pnpm install                  # from repo root if needed
pnpm migrate:demo
pnpm --filter studio dev
\`\`\`

No AEM credentials are required — \`AEM_FIXTURES_DIR\` replays committed fixtures.

## Regenerating fixtures (maintainers)

Requires local source tenant caches under \`tenants/\` (gitignored) plus
live AEM for tag capture once:

\`\`\`bash
pnpm build:demo-fixtures --capture-tags
\`\`\`

Review with \`--scratch\` first (\`output/demo-scratch/\`) if desired.
`;
}

async function writeFixturesReadme(fixturesRoot: string): Promise<void> {
  const readme = `# AEM fixtures (offline replay)

Scrubbed AEM REST responses consumed when \`AEM_FIXTURES_DIR=./fixtures/aem\`.

| Folder | AEM paths | Used by |
|--------|-----------|---------|
| \`content/...\` | \`/content/...\` | \`aem-extract\`, \`aem-tags\` |
| \`apps/...\` | \`/apps/...\` | \`migrate:schema\` |
| \`assets/\` | \`/content/dam/demo/_generated/*.gif\` | \`aem-assets\` (when \`AEM_FIXTURES_DIR\` is set) |

Paths mirror AEM URLs — no \`__\` encoding. Legacy flat captures are still read if present.

Twelve procedural animated GIFs (hero, banner, icon, tile, etc.) — no AEM download.
Regenerate with \`pnpm build:demo-fixtures --capture-tags\`.
`;
  await writeFile(join(fixturesRoot, "README.md"), readme, "utf8");
}

async function writeTenantConfigs(outDir: string, ctx: ScrubCtx): Promise<void> {
  const textCtx = { ...ctx, sourceKey: "config" };
  writeTextFileSync(join(outDir, "aem-content-roots"), generateContentRoots(textCtx));
  writeTextFileSync(join(outDir, "aem-component-paths"), generateComponentPaths(textCtx));
  writeTextFileSync(join(outDir, "aem-tag-roots"), generateTagRoots(textCtx));
  writeTextFileSync(join(outDir, ".env.example"), generateEnvExample());
  writeTextFileSync(join(outDir, "package.json"), generatePackageJson());
  writeTextFileSync(join(outDir, "README.md"), generateReadme());

  await writeJsonFile(
    join(outDir, "aem-component-containers.json"),
    mergeJsonConfig("aem-component-containers.json", textCtx),
  );
  await writeJsonFile(
    join(outDir, "aem-page-components.json"),
    generatePageComponents(textCtx),
  );
  await writeJsonFile(
    join(outDir, "aem-component-hints.json"),
    mergeJsonConfig("aem-component-hints.json", textCtx),
  );

  for (const name of ["aem-component-exceptions"]) {
    const merged: string[] = [];
    for (const src of SOURCES) {
      const path = join(REPO_ROOT, src.tenantDir, name);
      if (!existsSync(path)) continue;
      merged.push(scrubTextFile(readFileSync(path, "utf8"), textCtx));
    }
    writeTextFileSync(join(outDir, name), merged.join("\n").trim() + "\n");
  }

  ctx.report.configsWritten += 8;
}

async function checkBrandLeaks(outDir: string, report: ScrubReport): Promise<void> {
  async function walk(dir: string): Promise<string[]> {
    const out: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out.push(...(await walk(p)));
      else if (e.isFile()) out.push(p);
    }
    return out;
  }
  const files = await walk(outDir);
  for (const file of files) {
    const relPath = relative(REPO_ROOT, file);
    if (relPath.includes("/fixtures/aem/assets/")) continue;
    if (/\.(png|jpe?g|gif|webp|avif|svg|pdf|mp4|mov|webm|ico)$/i.test(file)) continue;
    if (BRAND_LEAK_REGEX.test(relPath)) {
      report.brandLeaks.push({ file: relPath, line: 0, sample: `[path] ${relPath}` });
    }
    const text = await readFile(file, "utf8");
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!;
      if (BRAND_LEAK_REGEX.test(line)) {
        report.brandLeaks.push({
          file: relPath,
          line: i + 1,
          sample: line.slice(0, 120),
        });
      }
    }
  }
}

async function main(): Promise<void> {
  const scratch = process.argv.includes("--scratch");
  const captureTags = process.argv.includes("--capture-tags");
  if (process.argv.includes("--capture-assets")) {
    console.warn("[build-demo] --capture-assets is deprecated — demo images are generated locally");
  }
  const outArg = process.argv.indexOf("--out");
  const outDir =
    outArg >= 0 && process.argv[outArg + 1]
      ? resolve(process.argv[outArg + 1]!)
      : scratch
        ? SCRATCH_OUT
        : DEFAULT_OUT;

  console.log(`[build-demo] output: ${outDir}`);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const fixturesRoot = join(outDir, "fixtures/aem");
  const assetFixturesDir = join(fixturesRoot, "assets");
  await mkdir(fixturesRoot, { recursive: true });
  await mkdir(assetFixturesDir, { recursive: true });

  const report: ScrubReport = {
    fixturesWritten: 0,
    configsWritten: 0,
    imagesWritten: 0,
    stringsScrubbed: 0,
    longStringsReplaced: 0,
    brandLeaks: [],
  };
  const ctx: ScrubCtx = { sourceKey: "build", report };

  await emitContentFixtures(fixturesRoot, ctx);
  await emitDialogFixtures(fixturesRoot, ctx);
  await ensureTagFixtures(fixturesRoot, ctx, captureTags);
  await writeTagNamespaceFixture(fixturesRoot, ctx);
  await emitAssetFixtures(assetFixturesDir, ctx);
  await writeFixturesReadme(fixturesRoot);
  await writeTenantConfigs(outDir, ctx);
  await checkBrandLeaks(outDir, report);

  console.log(`\n[build-demo] summary:`);
  console.log(`  fixtures written      : ${report.fixturesWritten}`);
  console.log(`  image fixtures        : ${report.imagesWritten}`);
  console.log(`  config files written  : ${report.configsWritten}`);
  console.log(`  brand-tokens swapped  : ${report.stringsScrubbed}`);
  console.log(`  long strings → lorem  : ${report.longStringsReplaced}`);

  if (report.brandLeaks.length > 0) {
    console.error(`\n[build-demo] BRAND LEAK CHECK FAILED — ${report.brandLeaks.length} hit(s):`);
    for (const leak of report.brandLeaks.slice(0, 25)) {
      console.error(`  ${leak.file}:${leak.line}\n    ${leak.sample}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\n[build-demo] no brand leaks — ready at ${relative(REPO_ROOT, outDir)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
