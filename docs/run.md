Here are the migration steps to run one by one, in order:

## 0. Prerequisites

```bash
cd /Users/shehjad.khan/Documents/aem-to-sanity/aem-to-sanity
pnpm install
pnpm build
```

**What this does:** Installs all workspace dependencies via pnpm (the repo is pnpm-only — npm/yarn can't resolve `workspace:*` links), then compiles every package under `packages/*` into `dist/` using Turbo. The CLIs (`aem-to-sanity-schema`, `aem-extract`, `aem-transform`, `aem-assets`, `aem-import`, etc.) all run from `dist/`, so a successful build is a hard prerequisite for every step below.

---

## 1. Bootstrap a tenant folder + configure env

Every migration runs from a **tenant folder** under `examples/`. The only one tracked in git is `examples/tenant/` — the template. Scaffold a new tenant from it:

```bash
pnpm -w migrate:init <your-tenant>   # works from any cwd in the repo
pnpm install                         # link the new workspace
```

Then fill in env files:

```bash
$EDITOR examples/<your-tenant>/.env   # AEM creds + Sanity project id / dataset / token
cp apps/studio/.env.example apps/studio/.env
$EDITOR apps/studio/.env
```

Before running the pipeline, verify the folder is wired up correctly:

```bash
pnpm -w migrate:doctor <your-tenant>          # reports missing env vars, placeholder values, and template drift
pnpm -w migrate:doctor <your-tenant> --fix    # auto-repair package.json scripts if the template has moved
```

**What this does:** Creates two local `.env` files that the pipeline and Studio read at startup.

- **`examples/<your-tenant>/.env`** — consumed by the migration CLIs. Holds AEM connection info (`AEM_ENV`, `AEM_AUTHOR_URL`, plus **one** of: `AEM_SERVICE_CREDENTIALS_FILE` for AEMaaCS via Adobe IMS — recommended; `AEM_TOKEN` for an AEMaaCS developer token or any pre-minted bearer; or `AEM_AUTHOR_USERNAME`+`AEM_AUTHOR_PASSWORD` for on-prem / AMS basic auth) and, for live runs, Sanity write credentials (`SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_TOKEN`, `SANITY_MEDIA_LIBRARY_ID`, `SANITY_ML_LINK_TOKEN`). See `running-the-migration.md` § 1a-bis for the AEMaaCS Service Credentials walkthrough.
- **`apps/studio/.env`** — consumed by the Sanity Studio. Holds `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` so the Studio knows which project to open.

Each tool loads `.env` from its own cwd, which is why the two files live in different directories (they can share values). Operator tenant folders (`examples/<your-tenant>/`) are gitignored — they hold real credentials, customer-specific component lists, and per-run pipeline output. Only `examples/tenant/` (the template) is committed.

---

## 2. Stage 1 — emit Sanity schemas

```bash
pnpm --filter example-<your-tenant> migrate:schema
pnpm --filter example-<your-tenant> migrate:schema --verbose  # + per-request AEM GET logs
```

**What this does:** Reads every AEM component path listed in `examples/<your-tenant>/aem-component-paths`, fetches each component's `_cq_dialog.infinity.json` from AEM, and converts those Granite UI dialogs into Sanity object schemas.

At startup the CLI prints a runtime banner summarizing the AEM env it's about to hit (base URL, auth kind — with password masked and bearer tokens shown as length + 4-char prefix) plus a Sanity preflight check (project id, dataset, token presence — the schema stage never calls Sanity, this is a config confirmation).

Flags / env vars:
- `--verbose` / `-v` (or `AEM_VERBOSE=true`) — elevates the logger to `debug` level. Surfaces every `GET {url}` the AEM fetcher issues, including Sling `.N.json` depth-fallback retries.
- `--continue-on-auth` (or `AEM_CONTINUE_ON_AUTH=true`) — treat per-component 401/403 as per-path ACL skips and keep going, as long as at least one component succeeds. Existing behavior.

Component type-name resolution happens up front via `resolveSanityTypeNames` (in `aem-to-sanity-schema/naming.ts`): any AEM path whose base name collides with a Sanity built-in (`image`, `file`, `slug`, `text`, etc.) is emitted with an `aem` prefix (so `/apps/aem-integration/components/image` → `aemImage.ts`). The same resolved name is written into the content registry and the `pageBuilder.of[]` array, so ingested documents will carry a `_type` that matches the Studio-registered schema name with no Studio-side renaming needed.

Outputs:
- `apps/studio/schemas/generated/*.ts` (repo-root, consumed by the Studio) — one Sanity object type per AEM component, plus `pageBuilder.ts`, `page.ts`, and a barrel `index.ts`. **Gitignored by default** — each operator regenerates from their own AEM. The `index.ts` stub is the only tracked file in there so the Studio boots on a bare clone. To source-control the schemas (single-tenant repos only), comment out the `apps/studio/schemas/generated/` line in `.gitignore` and `git add` the regenerated files.
- `examples/<your-tenant>/output/content-type-registry.json` — `sling:resourceType` → Sanity type mapping, consumed by stage 3.
- `examples/<your-tenant>/output/migration-report.json` + `audit/unmapped-examples.json` — what mapped, what didn't, and real examples of unmapped AEM props.

Output is deterministic, so re-runs produce clean `git diff`s.

---

## 3. Stage 2 — TypeGen

```bash
pnpm --filter example-<your-tenant> typegen
```

**What this does:** Reads the schemas emitted in stage 1 and generates `output/sanity.types.ts` — TypeScript types for every schema, suitable for typed GROQ clients (`client.fetch<HeroBanner>(...)`). Runs entirely in-process via `tsx` + `@sanity/schema` internals; no network call and no `sanity schema extract` needed.

---

## 4. Stage 3 — content migration (run each sub-step individually)

```bash
pnpm --filter example-<your-tenant> extract
pnpm --filter example-<your-tenant> tags
pnpm --filter example-<your-tenant> transform
pnpm --filter example-<your-tenant> assets
pnpm --filter example-<your-tenant> import
```

The five stages are independent CLIs chained through on-disk output; you can re-run any single one without redoing the others. `tags` is optional — skip it for migrations that don't use AEM taxonomy.

### 4a. `extract`
**What this does:** For every content root in `aem-content-roots`, fetches `{root}.infinity.json` from AEM and writes one JSON file per page into `output/raw/`. Automatically follows AEM's depth-5 truncation markers (issuing follow-up fetches in parallel and splicing subtrees back in) so the raw tree you get is complete. Also writes `output/extract-report.json` with counts, failures, and depth-expansion stats.

### 4a-bis. `tags`
**What this does:** For every namespace listed in `aem-tag-roots`, walks the AEM tag tree (`/content/cq:tags/<namespace>/...`) and emits one Sanity `category` document per `cq:Tag` node into `output/cache/categories/`. Each doc carries `title`, `slug`, `tagId` (canonical `namespace:parent/child`), and a `parent` reference to the next tag up the chain — implementing the parent-child taxonomy pattern from https://www.sanity.io/docs/developer-guides/parent-child-taxonomy. Default-namespace tags (those under `/content/cq:tags/default/...`) drop the `default:` prefix from `tagId` to match AEM's reference syntax. `cq:movedTo` aliases are recorded in the manifest so `transform` can follow them when resolving stale references.

Also writes `output/cache/categories/manifest.json` (consumed by `transform` to rewrite `cq:tags` strings into `_type:"reference"` arrays) and `output/cache/tags-report.json` with counts, dangling-parent warnings, and depth-splice stats.

Flags:
- `--overwrite` — re-emit category docs even when the on-disk file already exists. Manifest is always rewritten in full.

Operator allowlist: only namespaces (or subtrees) listed in `aem-tag-roots` are migrated. There's no canonical "always skip" set in AEM, so sample-content namespaces like `wknd` or `we-retail` are simply absent from the roots file.

### 4b. `transform`
**What this does:** Walks each raw JCR tree under `output/raw/`, maps `sling:resourceType` values via `content-type-registry.json`, and emits one Sanity `page` doc per input into `output/clean/` — with a `pageBuilder` array of typed blocks. Each doc gets a deterministic `_id` (from JCR path) and each block a stable `_key`, so re-runs upsert instead of duplicating. Unknown types and entries in `aem-component-exceptions` are skipped but recorded in `output/transform-report.json`. Purely local — no AEM or Sanity calls.

Any `sling:resourceType` that isn't in the registry is also printed to the console at the end of the run — hit count, example path, and a paste-ready `/apps/...` line. New pages bringing new components show up here as action items: paste the lines into `aem-component-paths`, re-run `migrate:schema` + `transform` + `import`, and the dropped content comes through on the next pass.

AEM **container** components (cq:isContainer=true — drop-zone children, not dialog multifields) are declared in `aem-component-containers.json` (default path). Listed types get a synthetic pageBuilder-typed `items` array appended at schema emission, and the transform walker descends into each container's direct child nodes with `sling:resourceType`, recursively emitting them as pageBuilder blocks under that field — so expander → box → content nests exactly like AEM structures it. See running-the-migration § 1c-quater for the config shape.

AEM **authoring hints** like `cq:panelTitle` (the question heading on each accordion / expander panel child) live outside the dialog payload, so the migration drops them by default. Components opt in via `aem-component-hints.json` (default path; mirror shape of the containers config). Listed components get the named hint(s) lifted at transform time to a canonical Sanity field name (`cq:panelTitle` → `panelTitle`) and a matching read-only field declared on their emitted schema. Non-listed components stay clean — no pollution. See running-the-migration § 1c-quinquies for the config shape.

AEM **named-slot** components (a single nested child under a fixed JCR key, e.g. `media-paragraph` > `content`) are auto-detected — no config needed. Every `migrate:schema` run scans the extracted raw content in `output/cache/raw/` and appends a typed field to each parent schema for each slot it finds. Transform emits nested components under their JCR key on every run, so data never gets dropped; the Studio stops showing "Unknown field" warnings once the schema pass picks up the slot shape. Container parents skip slot synthesis (their drop-zone logic already claims resourceType-carrying children).

AEM's JCR serializes every authored dialog value as a JSON string; transform reads each field's declared Sanity type from the registry and coerces on the way in. `array-of-blocks` fields (richtext) are converted to Portable Text via `@portabletext/block-tools`; `number` fields are parsed via `Number(v)`; `boolean` fields are parsed from the literal strings `"true"` / `"false"`. `array-of-reference` fields (AEM tagfields) are resolved through `output/cache/categories/manifest.json` produced by `tags`: each authored tag id (`namespace:parent/child`) becomes a `_type:"reference"` to the matching `category` doc, following `cq:movedTo` aliases. Page-level `cq:tags` (on `jcr:content`) are lifted onto the page doc's `tags` field via the same resolver. Values that can't be coerced cleanly are left in place so they surface as Studio validation errors rather than being silently remapped. Deterministic `_key`s preserve clean diffs across re-runs.

Tag references that don't resolve (the operator hasn't added that namespace to `aem-tag-roots`, or AEM has stale refs to a deleted tag) get dropped and surfaced in `transform-report.json` → `unresolvedTagRefs` with example paths.

### 4c. `assets`
**What this does:** Scans `output/clean/` for `/content/dam/...` references and moves the binaries from AEM DAM into the Sanity Media Library in five phases:
1. **Dedup** against the Media Library via the `aemSource.damPath` aspect.
2. **Download** from AEM DAM into `output/assets/` (on-disk, resumable cache).
3. **Upload** each asset to the org-level Media Library.
4. **Link** the Media Library asset into the target dataset (creates the `_ref` that goes into docs).
5. **Rewrite** clean docs in place so every DAM path becomes a proper `{_type:'image', asset:{_ref:...}}` object.

Maintains `output/assets/manifest.json` so re-runs skip phases already complete. **Dry-run by default** — without `MIGRATION_DRY_RUN=false` only the download cache is populated; nothing is uploaded or linked.

Flags:
- `--upload-only` — skip phase 1 (download). Assumes the local cache already exists.
- `--link-only` (or `MIGRATION_LINK_ONLY=true`) — skip phases 1 + 2 entirely. Phase 0's ML lookup resolves existing assets by `aemSource.damPath`; phases 3 + 4 run as normal. Dry-run + `--link-only` = preview of which DAM paths would be linked vs. missing from the ML. Mutually exclusive with `--upload-only`. Intended for re-runs against an ML that already has the binaries (either from a prior pipeline run or stamped out-of-band). Any DAM path without an ML hit stays unresolved in `/content/dam/*` form and surfaces in `output/assets-report.json → rewrite.unresolved`.
- `--no-rewrite` — skip phase 4 (in-place rewrite of `clean/*.json`).

### 4d. `import`
**What this does:** Reads every file under `output/cache/categories/` (if present) and `output/clean/` and commits the docs into your Sanity dataset via `@sanity/client` using `transaction().createOrReplace(doc).commit()`. **Categories are committed first** in batches of 50 per transaction so page-side references resolve immediately when pages are written. Because `_id` values are derived from JCR paths and tag ids, re-runs upsert rather than duplicate. **Dry-run by default** — prints what it *would* write until you set `MIGRATION_DRY_RUN=false`.

Flags:
- `--discard-drafts` (or `MIGRATION_DISCARD_DRAFTS=true`) — also delete `drafts.{id}` in the same transaction. Without this, the Studio's draft pins stale content even after a successful re-import. Opt-in; destroys authored in-progress edits.

All four are dry-run by default. To actually write to Sanity, export `MIGRATION_DRY_RUN=false` before running `assets` + `import` (plus `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_TOKEN`, and for `assets` `SANITY_MEDIA_LIBRARY_ID` + `SANITY_ML_LINK_TOKEN`).

> The Media Library endpoints (`/media-libraries/{mlId}/upload` in phase 2, `/assets/media-library-link/{dataset}` in phase 3) reject project robot tokens with `401 SIO-401-ANF "Session not found"`. You need a **personal auth token** for these. See `running-the-migration.md` § 4c-bis for two ways to generate one (`sanity login` + `sanity debug --secrets`, or sanity.io/manage → Personal access tokens).

### One-time before the first live `assets` run:
```bash
pnpm --filter studio exec sanity media deploy-aspect aemSource
```

**What this does:** Deploys the `aemSource` aspect schema (`damPath` + `assetInstanceId`) to your Sanity Media Library. Once deployed, `aem-assets` can stamp every uploaded asset with its origin JCR path, which powers phase 0's dedup lookup on subsequent runs. Skipping this step is non-fatal — stamping just fails gracefully — but you lose cross-run dedup until you deploy.

---

## 5. Run the whole pipeline in one shot

The `migrate` script chains every stage end-to-end, with `--discard-drafts` on import so re-runs reflect immediately in the Studio:

```bash
pnpm --filter example-<your-tenant> migrate
```

**What this does:** runs in order — `extract` → `tags` → `migrate:schema` → `transform` → `assets` (full download + upload + link) → `import --discard-drafts`. Each stage's `Elapsed:` line surfaces along the way. Use this for "blow away and re-run" workflows on a dataset only the pipeline writes to.

For more granular variants:

- `pnpm --filter example-<your-tenant> migrate:content` — content stages only, **no** `--discard-drafts` (preserves any in-progress author edits).
- `pnpm --filter example-<your-tenant> migrate:all` — schema + typegen only.

Or via Turbo with input-hash caching for the pure emit stages:

```bash
pnpm turbo run migrate:schema typegen migrate:content --filter=example-<your-tenant>
```

---

## 6. Studio — visual verification

```bash
pnpm --filter studio dev          # http://localhost:3333
```

**What this does:** Boots the Sanity Studio defined in `apps/studio/` against your configured project. The Studio's `schemas/index.ts` re-exports `allSchemaTypes` from `examples/<your-tenant>/output/schemas/index.ts`, so every schema the pipeline emitted shows up as a real editable document type — you can open imported pages, verify block rendering, and spot-check the migration result.

Or just validate schema shape without booting the UI:

```bash
pnpm --filter studio exec sanity schema validate
```

**What this does:** Runs Sanity's static schema validator against the emitted types. Expects `0 errors, 0 warnings`. This is the gate that catches breakage if you change the emitter or hand-edit `output/schemas/`.

---

## 7. Media Library clean-up (test environments only)

```bash
# dry-run — prints what would be deleted
pnpm --filter example-<your-tenant> wipe:media-library

# actually delete
pnpm --filter example-<your-tenant> wipe:media-library -- --confirm-delete
```

**What this does:** Runs `scripts/wipe-media-library.ts`, which deletes **every** asset from the configured Sanity Media Library. It queries all `sanity.asset` parents plus their `sanity.imageAsset` / `sanity.fileAsset` instances, then removes them in batches of 50 via the Media Library mutate endpoint.

**Destructive and org-scoped — intended for test environments only. Not reversible.**

- **Dry-run by default** — without `--confirm-delete` it only lists the first 10 ids it would remove and reports the total count.
- **Env required:** `SANITY_TOKEN` (user-scoped, with ML write access) and `SANITY_MEDIA_LIBRARY_ID`. `SANITY_API_VERSION` is optional (defaults to `2025-02-19`).
- **What it does NOT clean up:**
  - **Dataset-level linked asset docs** created by `aem-assets` phase 3 (`/assets/media-library-link`). These stay behind in the dataset after a wipe. Re-run `aem-import` to re-hydrate, or delete them separately via `@sanity/client`.
  - **Local manifest** — `output/cache/assets/manifest.json` will be stale after a wipe. Delete `output/cache/` (or at least the manifest) before the next `aem-assets` run, otherwise phase 0's dedup cache will point at assets that no longer exist.

Typical reset sequence for a test environment:

```bash
pnpm --filter example-<your-tenant> wipe:media-library -- --confirm-delete
rm -rf examples/<your-tenant>/output/cache/assets
# optionally also clear the dataset's linked-asset docs, then re-run:
pnpm --filter example-<your-tenant> assets
pnpm --filter example-<your-tenant> import
```

---

Tell me which stage you want to start with and I can walk through just that one (or tail the output, inspect reports, etc.).
