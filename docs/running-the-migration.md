# Running the AEM → Sanity migration end-to-end

This is the operator's guide: every env var, every command, and the order to run them in so you can go from a running AEM instance to content in Sanity.

The pipeline has three independent stages. Stage 3 is itself a four-step chain:

1. **Schemas** — read AEM component dialogs (`_cq_dialog`) → emit Sanity object types.
2. **TypeGen** — produce `sanity.types.ts` for typed GROQ clients.
3. **Content** — `aem-extract` → `aem-transform` → `aem-assets` → `aem-import`. Walks AEM `.infinity.json` trees, transforms JCR nodes into Sanity docs, uploads DAM assets, and commits via `@sanity/client`. **Dry-run by default**; set `MIGRATION_DRY_RUN=false` to write to Sanity.

A fourth, one-time step scaffolds the **Studio** that consumes the emitted schemas.

---

## 0. Prerequisites

- **Node** ≥ 20
- **pnpm** ≥ 9 (this repo is pnpm-only; npm/yarn will not resolve `workspace:*`)
- **AEM access** — an account that can `GET` both `*.infinity.json` on component paths and content paths, or an equivalent bearer token.
- **Sanity project** — create at [sanity.io/manage](https://www.sanity.io/manage). You need the project id, dataset name, and a write token (role: Editor or higher).

```bash
pnpm install
pnpm build   # builds all three packages into packages/*/dist
```

---

## 1. Configure environment variables

There are two `.env` files — one for the pipeline CLIs, one for the Studio. They can share values; they live in different directories because each tool loads `.env` from its own cwd.

### 1a. Pipeline `.env` — `examples/davids-bridal/.env`

```bash
cp examples/davids-bridal/.env.example examples/davids-bridal/.env
```

| Variable | Required? | Purpose |
| --- | --- | --- |
| `AEM_ENV` | yes | `author` or `publish` — which of the URL/credential pairs below to use. Default: `author`. |
| `AEM_AUTHOR_URL` | conditional | Base URL of your author instance. Required when `AEM_ENV=author`. |
| `AEM_AUTHOR_USERNAME` | conditional | Basic-auth user for author. |
| `AEM_AUTHOR_PASSWORD` | conditional | Basic-auth password for author. |
| `AEM_PUBLISH_URL` / `USERNAME` / `PASSWORD` | conditional | Same, for publish. |
| `AEM_TOKEN` | optional | Bearer token. If set, overrides basic auth for whichever env is active. |
| `AEM_COMPONENT_PATHS_FILE` | optional | File listing component JCR paths to migrate (one per line, `#` for comments). Default: `./aem-component-paths`. |
| `AEM_CONTENT_ROOTS_FILE` | optional | File listing content roots to walk during extraction. Default: `./aem-content-roots`. See `aem-content-roots.example` for syntax. |
| `AEM_COMPONENT_EXCEPTIONS_FILE` | optional | File listing `sling:resourceType` values to skip during transform. Default: `./aem-component-exceptions`. |
| `AEM_MAX_RESPONSE_MB` | optional | Cap per-fetch payload size during extract. Pages exceeding this are recorded as `tooLarge` failures. |
| `OUTPUT_DIR` | optional | Where schemas, reports, and audit live. Default: `./output`. |
| `CONCURRENCY` | optional | Parallel AEM fetches. Default: `4`. |
| `MIGRATION_DRY_RUN` | optional | `aem-assets` and `aem-import` are dry-run unless this is explicitly set to `false`. Default (unset): dry-run. |
| `MIGRATION_LINK_ONLY` | optional | `aem-assets` only. `true` ⇔ passing `--link-only`. Skips phases 1 + 2 (download + upload) and relies on phase 0 to find assets already in the Media Library. See § 4c. |
| `MIGRATION_DISCARD_DRAFTS` | optional | `aem-import` only. `true` ⇔ passing `--discard-drafts`. Deletes `drafts.{id}` alongside each published `createOrReplace` so the Studio shows the freshly-imported content instead of a stale draft from a prior run. Opt-in — destroys authored in-progress edits. |
| `AEM_VERBOSE` | optional | `true` ⇔ passing `--verbose`. Elevates the CLI logger to `debug` so every AEM GET is logged. |
| `SANITY_PROJECT_ID` | required for writes | Only read when `MIGRATION_DRY_RUN=false`. |
| `SANITY_DATASET` | required for writes | |
| `SANITY_TOKEN` | required for writes | Write-scoped API token. Used for `aem-import` and for the Media Library **upload** phase of `aem-assets`. |
| `SANITY_MEDIA_LIBRARY_ID` | required for `aem-assets` writes | Id of the org-level Sanity Media Library that assets go into (e.g. `mlTnBiUKRzfi`). Must belong to the same org as `SANITY_PROJECT_ID`. |
| `SANITY_ML_LINK_TOKEN` | conditional | Personal auth token used for the Media Library **link** step in `aem-assets`. Required when `SANITY_TOKEN` is a project robot token (the link API rejects non-global sessions). See § 4c. |
| `SANITY_API_VERSION` | optional | Default: `2024-01-01` for import; `aem-assets` pins `2025-02-19` because Media Library endpoints require it. |

Auth precedence: `AEM_TOKEN` > (`*_USERNAME` + `*_PASSWORD`). If neither is set for the active `AEM_ENV`, the CLI fails fast with a clear message.

### 1b. Studio `.env` — `apps/studio/.env`

```bash
cp apps/studio/.env.example apps/studio/.env
```

Sanity CLI auto-loads variables with the `SANITY_STUDIO_` prefix from this file:

```
SANITY_STUDIO_PROJECT_ID=your-project-id
SANITY_STUDIO_DATASET=production
```

The studio config also accepts unprefixed `SANITY_PROJECT_ID` / `SANITY_DATASET` as a fallback, so if you already exported those in your shell for the content CLI you don't need to duplicate them.

### 1c. Component path list — `examples/davids-bridal/aem-component-paths`

One JCR path per line. Lines beginning with `#` are ignored. Example:

```
/apps/davidsbridal/components/content/heroBanner
/apps/davidsbridal/components/content/promo
# add or remove paths as you migrate in waves
```

The schema CLI fetches `{path}/_cq_dialog.infinity.json` for each entry.

### 1c-bis. Content roots list — `examples/davids-bridal/aem-content-roots`

Consumed by `aem-extract` (stage 3). Supports `@base` sections to avoid repeating long paths, plus absolute JCR paths. Example:

```
@base /content/dbi/en

homepage
about-us
/content/dbi/en/sitemap
```

Each line becomes a Sanity page doc with its slug derived from the last segment. See `aem-content-roots.example` for the full syntax (comments, absolute paths, multiple `@base` blocks).

### 1c-ter. Component exceptions — `examples/davids-bridal/aem-component-exceptions`

Consumed by `aem-transform`. One `sling:resourceType` (or `apps/...` prefix) per line; matching nodes and their subtrees are skipped. Use this for decorative wrappers or AEM-only utilities that don't belong in Sanity.

### 1d. Resource-type registry — `output/content-type-registry.json`

**Generated** by `migrate:schema`; you don't hand-author it. Maps AEM `sling:resourceType` values to the Sanity type names that stage 1 emitted, plus each field's name + Sanity type (used by the drift auditor and by `aem-transform` for type-aware coercion — e.g. HTML → Portable Text on `array-of-blocks` fields):

```json
{
  "__generated": "GENERATED by aem-to-sanity-schema. Remove this field (or delete the file) to take ownership; the next run will preserve your edits.",
  "entries": [
    {
      "resourceType": "aem-integration/components/promo",
      "sanityType": "promo",
      "fields": [
        { "name": "headline1", "type": "string" },
        { "name": "description", "type": "array-of-blocks" },
        { "name": "fileReference", "type": "image" }
      ]
    }
  ]
}
```

- `resourceType` — derived by stripping `/apps/` from each component path. Override via `jcrPrefix` on the programmatic API if your install uses a different prefix.
- `sanityType` — the emitted schema's `name`.
- `fields` — tree-shaped `Array<{name, type, itemFields?}>` covering every field the emitted schema declares. `array-of-object` fields carry their members under `itemFields` so the content transform can coerce AEM scalars into the right Sanity shape at any depth — HTML strings on `array-of-blocks` fields become Portable Text (via `@portabletext/block-tools`) whether they sit at the top level or inside a `variableColumn.columnContents[]` multifield row.

Legacy `fields: string[]` registry files are still accepted. The transform falls back to pass-through behavior on fields without type info, so old registries keep working but don't get the richtext coercion — regenerate to opt in.

**Taking ownership:** if your AEM content uses `sling:resourceSuperType` chains or unusual mappings, delete the `__generated` marker (or rewrite the file as a bare `[...]` array). The next `migrate:schema` run will preserve it and log that it skipped regeneration. The content CLI accepts both shapes.

Anything outside this registry is still extracted but tagged `_type: "aemUnmapped"` and flagged in the audit.

---

## 2. Stage 1 — emit Sanity schemas

```bash
pnpm --filter example-davids-bridal migrate:schema
pnpm --filter example-davids-bridal migrate:schema --verbose  # + per-request AEM GET logs
```

On start-up the CLI prints a banner summarizing what it's connecting to: AEM env, base URL, auth kind (basic shows the username only; bearer is shown as `len=N, prefix=abcd…` so you can confirm the right token is loaded without it leaking into logs), paths / roots files, output dir, concurrency. A Sanity preflight block follows with project id, dataset, and token presence — schema generation never calls Sanity, it's a config confirmation for the downstream content ingest.

| Flag / env | Effect |
| --- | --- |
| `--verbose` / `-v` or `AEM_VERBOSE=true` | Elevates the logger to `debug` level. Surfaces every `GET {url}` the AEM fetcher issues plus Sling `.N.json` depth-fallback retries. |
| `--continue-on-auth` or `AEM_CONTINUE_ON_AUTH=true` | Treat per-component 401/403 as per-path ACL skips and keep going, as long as at least one component succeeds. A circuit breaker still aborts on `N` consecutive auth failures with zero successes (signals credentials-wide failure, not ACL). |

**Outputs under `output/`:**

| Path | What it is |
| --- | --- |
| `schemas/*.ts` | One Sanity object type per AEM component, named `componentNameInCamelCase`. Each carries a `preview.prepare` that returns a guaranteed-non-empty title (AEM `jcr:title` → title-cased type name → raw type name fallback), so array/Page Builder rows never render as "Untitled" even before the row has any data. |
| `schemas/pageBuilder.ts` | Array type with every emitted block in `of: [...]`. Each member is emitted as `defineArrayMember({ type, title })` so the "+ Add" menu and row previews carry friendly labels. Regenerated each run. |
| `schemas/page.ts` | Minimal document type (`title`, `slug`, `pageBuilder`). Preserved if you hand-author it. |
| `schemas/index.ts` | Barrel exporting `allSchemaTypes` — plug straight into `defineConfig`. |
| `content-type-registry.json` | AEM `sling:resourceType` → Sanity type + field names, consumed by stage 3. Preserved if you hand-edit. |
| `aem/components/**/*.json` | Raw dialog snapshots — audit trail. |
| `migration-report.json` | Pass/fail per component (including the resolved `sanityTypeName` and friendly `schemaTitle`) + unmapped props inventory. |
| `audit/unmapped-examples.json` | Real-world examples per unmapped AEM type. Feed these back into `mapping-table.ts` when adding new mappings. |

Re-run any time — output is deterministic, so `git diff` shows only real changes. Each CLI appends an `Elapsed:` line to its summary (and `aem-assets` prints a `Per phase:` breakdown) so you can see where time is going across runs.

### Type-name resolution (reserved-name handling)

Component type names are resolved up front via `resolveSanityTypeNames` (in `aem-to-sanity-schema/naming.ts`). The base name is the camelCased tail after `components/`; if that collides with a Sanity built-in (`image`, `file`, `slug`, `text`, `string`, `number`, `block`, `object`, `array`, etc.) or with another path, it's prefixed with `aem` and — only if still colliding — suffixed with a numeric counter.

Example: `/apps/aem-integration/components/image` → `aemImage.ts` on disk, `aemImage` in `pageBuilder.of[]`, `"sanityType": "aemImage"` in the content registry, and `_type: "aemImage"` on every ingested document. Keeping all four artifacts aligned up front is what prevents ingested data from later appearing as "Untitled" + unknown-type warnings in the Studio.

The Studio-side `sanitizeSchemaTypes` still exists and runs the same rename as a defense-in-depth pass for hand-authored schemas, but for the emitter path it's a no-op.

### Registering new block types between migrations

If you hand-add a `schemas/myBlock.ts` without re-running the whole migration, refresh the page-builder registration with:

```bash
pnpm --filter example-davids-bridal pagebuilder:refresh
# or
npx aem-to-sanity-pagebuilder --output-dir ./output --exclude xfPage
```

This rescans `schemas/`, rebuilds `pageBuilder.ts`, and refreshes `schemas/index.ts`. It preserves `page.ts` if you've removed the `GENERATED` marker comment.

---

## 3. Stage 2 — TypeGen

```bash
pnpm --filter example-davids-bridal typegen
```

Produces `output/sanity.types.ts`. Runs in-process via tsx + `@sanity/schema` internals — **no network call**, no `sanity schema extract` required.

Consume it in a downstream Sanity client like:

```ts
import type { HeroBanner } from "./output/sanity.types";
const doc = await client.fetch<HeroBanner>(`*[_type == "heroBanner"][0]`);
```

---

## 4. Stage 3 — content migration

Stage 3 is four independent CLIs, run in order. The `migrate:content` pnpm script chains them (`extract && transform && assets && import`), but you can run each step on its own — each reads from the output directory of the previous one, so re-running just one stage is cheap.

```bash
pnpm --filter example-davids-bridal migrate:content
# equivalent to:
pnpm --filter example-davids-bridal extract
pnpm --filter example-davids-bridal transform
pnpm --filter example-davids-bridal assets
pnpm --filter example-davids-bridal import
```

**All writes to Sanity are dry-run unless `MIGRATION_DRY_RUN=false` is set.** The `extract` and `transform` stages are read/local-only regardless; only `assets` and `import` touch Sanity.

### 4a. `aem-extract` — AEM `.infinity.json` → `output/raw/`

Reads every entry in `aem-content-roots`, fetches `{root}.infinity.json` from AEM, and writes one JSON file per page to `output/raw/`. Transparently follows depth-5 truncation markers (AEM returns a string marker like `"...section_0": "...section_0"` at the depth boundary; the fetcher detects these plus suspiciously-empty nodes, issues follow-up fetches in parallel, and splices resolved subtrees back in).

| Flag / env | Effect |
| --- | --- |
| `--overwrite` | Re-fetch pages that already have a cached raw file. Default: skip. |
| `AEM_CONTENT_ROOTS_FILE` | Path to roots file. Default: `./aem-content-roots`. |
| `AEM_MAX_RESPONSE_MB` | Per-fetch payload cap. Oversized responses are recorded as `tooLarge` failures. |
| `AEM_MAX_DEPTH_EXPANSIONS` | How many rounds of depth-5 follow-up fetches to run per root. Default: 3. Raise only if a page is pathologically deep; leftover markers after the budget are replaced with `{__truncated: "maxDepth", jcrPath}` sentinels and the transform stage treats them as opaque. |
| `AEM_FIXTURES_DIR` | If set, reads captured AEM responses from this directory instead of issuing HTTP calls. See `examples/davids-bridal/fixtures/aem/README.md` for the URL → filename mapping. Used by unit tests and CI; leave unset for live migrations. |

**Outputs:** `output/raw/*.json`, `output/extract-report.json` (counts, categorized failures, ambiguous-path resolutions, and a `depthExpansions` array with per-root `markersFound`/`markersResolved`/`markersTruncated`/`markersFailed`/`expansionsUsed` stats), and `output/extract-404.log` if any roots weren't found.

### 4b. `aem-transform` — `output/raw/` → `output/clean/`

Walks each raw JCR tree, maps `sling:resourceType` values via `content-type-registry.json`, and emits one `page` doc per input file with a `pageBuilder` array of typed blocks. Each doc gets a deterministic `_id` (from JCR path) and each block a stable `_key` (from `jcr:uuid` or path SHA1). Unknown resource types and nodes listed in `aem-component-exceptions` are skipped but noted in the audit.

**Type-aware coercion.** AEM's JCR is schemaless on dialog inputs — every authored value lands in `.infinity.json` as a JSON string regardless of what the dialog widget was. The emitted Sanity schemas declare proper types (`number`, `boolean`, `array-of-blocks`), so without coercion the Studio rejects ingested values with "Expected type X, got String". Transform reads the registry's tree-shaped `fields` (`Array<{name, type, itemFields?}>`) and coerces at every depth — top-level fields *and* members inside nested `array-of-object` multifields (e.g. `variableColumn.columnContents[].columnText`):

- **`array-of-blocks`** — AEM `cq/gui/components/authoring/dialog/richtext` / Coral richtext values arrive as HTML strings. Converted to Portable Text via `@portabletext/block-tools` (with `jsdom` as the DOM). Decorators (`strong`, `em`, `underline`, `strike-through`, `code`), styles (`normal`, `h1`–`h4`, `blockquote`), lists (`bullet`, `number`), and `<a href>` annotations are preserved. `_key`s are derived from a SHA1 of `{jcrPath}::{fieldName}:{counter}` so re-runs produce byte-identical clean docs. On parser failure the original string is kept intact.
- **`number`** — coerced via `Number(v)`; kept as-is on `NaN`. AEM numberfield values land as `"10"` etc.
- **`boolean`** — coerced when the value is the literal string `"true"` or `"false"`; kept as-is otherwise. AEM checkbox values land as `"true"` / `"false"`.
- **`array-of-object`** — recurses into nested multifield items. Handles both AEM shapes: the ordered `item0`/`item1` form (materialized earlier in `transformInline`) and the named-key form (e.g. `colorCarousel.colors: { weddingDresses: {...}, bridesmaidDresses: {...} }`) — materialized here by taking `Object.values` of the keyed map in authored order.

Legacy `content-type-registry.json` files without `fields[].type` skip every coercion step — regenerate via `pnpm migrate:schema` to opt in.

| Flag / env | Effect |
| --- | --- |
| `--registry <file>` | Override the default `./content-type-registry.json`. |
| `--include type1,type2` | Restrict to a comma-separated allow-list of `sling:resourceType` values. |
| `AEM_COMPONENT_EXCEPTIONS_FILE` | Path to exceptions file. Default: `./aem-component-exceptions`. |

**Outputs:** `output/clean/*.json` (one per page, containing the transformed doc) and `output/transform-report.json` (unknown resource types, unknown props per component, transform bails — with first-N example paths per finding).

### 4c. `aem-assets` — upload DAM → Media Library → link to dataset

> **Scope decision (@shehjadkhan 2026-04-22):** assets go to the Sanity **Media Library** (org-scoped), NOT the dataset's Content Lake. Each asset is uploaded once into the Media Library and then **linked** into the target dataset via the Global Document Reference (GDR) endpoint. The dataset holds a small linked asset document whose `_id` becomes the `asset._ref` inside content docs.

#### One-time: deploy the `aemSource` aspect

`aem-assets` stamps every uploaded asset with an `aemSource` aspect (`damPath` + cached `assetInstanceId`) so subsequent runs can dedup by origin JCR path instead of re-uploading. Deploy the aspect schema once per Media Library before the first live run:

```bash
pnpm --filter studio exec sanity media deploy-aspect aemSource
```

If this step is skipped, uploads still succeed — the stamp mutations fail gracefully (logged, not fatal) and the dedup pre-check in phase 0 returns no hits. Once deployed, running `aem-assets` once backfills the aspect on any prior-uploaded assets whose ids are still in the local manifest.

Scans `output/clean/` for `/content/dam/...` references, downloads each asset from AEM, and runs five phases:

0. **Dedup lookup** — GROQ `*[_type=="sanity.asset" && aspects.aemSource.damPath == $damPath][0]` against the Media Library. A hit populates the manifest with both ids so phases 1+2 skip that asset entirely — no re-download from AEM, no re-upload to ML. Same content reused across pages/runs links to the same ML asset.
1. **Download** from AEM DAM → `output/assets/<flattened-path>` (on-disk cache, resumable).
2. **Upload** to Media Library — `POST https://api.sanity.io/v{apiVersion}/media-libraries/{mlId}/upload` returns `{asset: {_id}, assetInstance: {_id}}`. The parent `asset._id` is recorded as `mediaLibraryAssetId`; the versioned `assetInstance._id` as `linkedAssetInstanceId`. Immediately after a successful upload (or when skipping an already-uploaded entry whose aspect isn't set yet), the pipeline patches `aspects.aemSource = {damPath, assetInstanceId}` onto the parent via `POST /media-libraries/{mlId}/mutate`.
3. **Link** to dataset — `POST https://{projectId}.api.sanity.io/v{apiVersion}/assets/media-library-link/{dataset}` with body `{mediaLibraryId, assetInstanceId, assetId}`. Returns `{document: {_id, media: {_ref}, ...}}`. `document._id` is the dataset-local `_ref` that goes into content docs (Pattern A: `{_type:'image', asset:{_ref:'<linked-ref>'}}` — Studio-compatible).
4. **Rewrite** clean docs in place so every `/content/dam/...` string becomes the linked asset ref object.

Maintains `output/assets/manifest.json` — per-DAM-path record with `damPath → cachedFile → mediaLibraryAssetId → linkedAssetInstanceId → linkedRef`. Re-runs skip each phase that's already complete. Entry shape:

```ts
interface ManifestEntry {
  damPath: string;
  cachedFile?: string;             // local cache path
  mimeType?: string;
  fileSize?: number;
  mediaLibraryAssetId?: string;    // asset._id in the ML (parent sanity.asset doc)
  linkedAssetInstanceId?: string;  // assetInstance._id in the ML (versioned asset)
  linkedRef?: string;              // dataset-local ref — goes into asset._ref in docs
  mediaRef?: string;               // media-library:<mlId>:<assetId> — GDR reference
  sanityRef?: { _type: "image"|"file"; asset: { _type: "reference"; _ref: string } };
  status: "cached"|"downloaded"|"failed-download"|"uploaded"|"failed-upload"|"linked"|"failed-link"|"dry-run";
  error?: string;
  downloadedAt?: string; uploadedAt?: string; linkedAt?: string;
}
```

- **Dry-run default.** Without `MIGRATION_DRY_RUN=false`, assets are downloaded to local cache only — no Media Library API calls, no link calls, no doc rewrites.
- **Env vars:**
  - `SANITY_PROJECT_ID`, `SANITY_DATASET` — as before.
  - `SANITY_MEDIA_LIBRARY_ID` — **required** when not dry-running. Must be a Media Library in the same org as the project.
  - `SANITY_TOKEN` — used for the upload phase (project robot token with write access works fine).
  - `SANITY_ML_LINK_TOKEN` — **required for the link phase** when `SANITY_TOKEN` is a project robot token. The `/assets/media-library-link` endpoint requires a *personal* authorization token with read/write on both the Media Library (org-level) and the project/dataset; a project-only robot token is rejected with `401 Invalid non-global session`. Generate one via `sanity login` + `sanity debug --secrets` or the Sanity user management UI. Falls back to `SANITY_TOKEN` if unset (works only if that token is already a personal/OAuth token).
  - `SANITY_API_VERSION` — defaults to `2025-02-19`, which is when Media Library support landed.
- **Flags:**
  - `--upload-only` — skip phase 1 (download). Assumes the local cache already exists.
  - `--link-only` (or `MIGRATION_LINK_ONLY=true`) — skip phases 1 + 2 entirely. Phase 0's ML lookup resolves existing assets by `aemSource.damPath`; phases 3 + 4 run as normal. Dry-run + `--link-only` = preview of which DAM paths would be linked vs. missing from the ML. Mutually exclusive with `--upload-only`. Intended for re-runs against an ML that already holds the binaries (either from a prior pipeline run or stamped out-of-band). Any DAM path that phase 0 can't resolve stays in `/content/dam/*` form in clean docs and is listed in `output/assets-report.json → rewrite.unresolved`. Caveat: phase 0 keys on the `aemSource` aspect stamped by this pipeline on upload, so assets uploaded through the Studio UI without that aspect will not be found by DAM path.
  - `--no-rewrite` — skip phase 4 (in-place rewrite of `clean/*.json`).

Ordering contract: the link phase must complete before `aem-import` runs, because the clean docs only contain the linked `_ref` after phase 4. The `migrate:content` chain (`extract → transform → assets → import`) already enforces this.

### 4d. `aem-import` — `output/clean/` → Sanity

Reads every file under `output/clean/` and commits the docs via `@sanity/client` using `transaction().createOrReplace(doc).commit()`. Because `_id` values are derived from JCR paths, re-runs upsert rather than duplicate.

- **Dry-run default.** With `MIGRATION_DRY_RUN` unset or truthy, the command only prints what it *would* write.
- **Requires** `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_TOKEN` when writing.
- **Flags:**
  - `--discard-drafts` (or `MIGRATION_DISCARD_DRAFTS=true`) — delete `drafts.{id}` in the same transaction as each published `createOrReplace`. The Studio opens a draft whenever one exists, so without this flag a stale draft from a prior migration run keeps shadowing freshly-imported published data — you re-run `aem-import`, the terminal shows "Committed", and the Studio still shows the old content. Opt-in because it also destroys any authored in-progress edits; use it when re-running migrations against a dataset that only this pipeline writes to.

### Depth-5 truncation — handled for you

AEM's `.infinity.json` truncates the tree at depth ~5, inserting path-string markers like `"/content/.../section_0": "/content/.../section_0"`. `aem-extract` detects these (and suspiciously-empty nodes at depth boundaries), issues follow-up fetches in parallel (concurrency 4 by default), and splices resolved subtrees back into the parent tree at the correct key. A cycle guard prevents re-fetching the same path twice within a root. Nothing to configure unless a page is pathologically deep — raise `AEM_MAX_DEPTH_EXPANSIONS` (default 3) or the `maxDepthExpansions` option on the programmatic `fetchInfinityTree` API in `aem-to-sanity-core`. Markers still present after the budget are replaced with `{__truncated: "maxDepth", jcrPath}` sentinels which the transform stage treats as opaque (no broken string-marker leaves ever reach the Sanity docs).

---

## 5. Orchestrated — one command for the full pipeline

```bash
pnpm turbo run migrate:schema typegen migrate:content --filter=example-davids-bridal
```

Turbo respects the ordering declared in `turbo.json`: schema → typegen → content. Network-dependent tasks are `"cache": false`; pure emit steps cache against input hashes.

---

## 6. Studio (visual verification)

```bash
pnpm --filter studio dev
# Opens http://localhost:3333 with every emitted schema loaded.
```

Or validate schema shape without booting the UI:

```bash
pnpm --filter studio exec sanity schema validate
# Expects: 0 errors, 0 warnings.
```

The studio's `schemas/index.ts` re-exports `allSchemaTypes` from `examples/davids-bridal/output/schemas/index.ts`, and `sanity.config.ts` runs them through `sanitizeSchemaTypes` (from `aem-to-sanity-schema/sanitize`) at import time — it's a real consumer of the pipeline output, not a toy fixture. If you change the emitted schemas, `sanity schema validate` is the gate that catches breakage.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `AEM_AUTHOR_URL is required when AEM_ENV=author` | Either set the matching URL/creds, switch `AEM_ENV` to `publish`, or use `AEM_TOKEN`. |
| `Missing credentials. Set AEM_TOKEN, or AEM_AUTHOR_USERNAME and AEM_AUTHOR_PASSWORD.` | No auth resolved for the active env. |
| `401` or `403` on fetches | Creds valid but account lacks read access to the JCR paths. Verify in AEM's CRXDE. |
| `aem-import` prints `DRY RUN` and nothing lands in Sanity | That's the default. Export `MIGRATION_DRY_RUN=false` (also set `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_TOKEN`) and re-run. |
| `aem-import` → `Missing env var: SANITY_TOKEN` | You set `MIGRATION_DRY_RUN=false` but the write token isn't in the env. Source it into `examples/davids-bridal/.env`. |
| `aem-assets` phase 3 → `401 Invalid non-global session for user id g-...` | The `/assets/media-library-link` endpoint rejected your `SANITY_TOKEN`. It requires a *personal* auth token, not a project robot token. Set `SANITY_ML_LINK_TOKEN` to a personal token with read/write on both the Media Library and the project. See § 4c. |
| `aem-assets` phase 2 → `409 asset already exists` | Informational, not an error. The binary was already uploaded to the Media Library. The code recovers both IDs via a GROQ lookup and continues. |
| `aem-assets` → `Missing env var: SANITY_MEDIA_LIBRARY_ID` | Set it to the org-level ML id that the project belongs to. `sanity media library list` on the org shows available ids. |
| `aem-extract` fails with `HTTP 300` on a root | AEM returned an ambiguous-path response (the path may point at a folder). Check `output/extract-report.json` → `ambiguous[]` for the resolution suggestion. |
| `aem-transform` → `No raw files in output/raw` | Run `aem-extract` first. The transform stage only reads from disk — it never hits AEM. |
| Studio boots but shows no schemas | `output/schemas/index.ts` is missing or stale. Run `pnpm --filter example-davids-bridal migrate:schema`. |
| `sanity schema validate` → `Type has property "fields", but is not an object/document type` | The sanitizer is injecting placeholder fields into a non-object type. Confirm you're on the latest schema package (this is fixed). |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` when running sanity CLI | Rebuild: `pnpm build`. The bundled CJS loader the Sanity CLI uses needs the `default` export condition that `dist/` ships. |
| Depth-5 follow-ups never fire on a deep page | Make sure you're calling `aem-extract`, not hitting `.infinity.json` manually. Raise `maxDepthExpansions` if you have pages > 6 follow-up rounds deep. |

---

## 8. What's **not** automated yet

- **`pathfield` → Sanity `reference`** — AEM path fields stay as strings. Resolving them to document references is still a follow-up.
- **Custom page document types** — the generator writes one generic `page` doc. Hand-author `landingPage` / `productPage` types in `output/schemas/` (or a separate authored directory you merge into `allSchemaTypes`); the generator won't touch files missing the `GENERATED` marker.
- **CI publish** — `changeset publish` is wired but not yet triggered from GitHub Actions.
