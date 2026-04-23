Here are the migration steps to run one by one, in order:

## 0. Prerequisites

```bash
cd /Users/shehjad.khan/Documents/aem-to-sanity/aem-to-sanity
pnpm install
pnpm build
```

**What this does:** Installs all workspace dependencies via pnpm (the repo is pnpm-only — npm/yarn can't resolve `workspace:*` links), then compiles every package under `packages/*` into `dist/` using Turbo. The CLIs (`aem-to-sanity-schema`, `aem-extract`, `aem-transform`, `aem-assets`, `aem-import`, etc.) all run from `dist/`, so a successful build is a hard prerequisite for every step below.

---

## 1. Configure env files

```bash
cp examples/davids-bridal/.env.example examples/davids-bridal/.env
cp apps/studio/.env.example apps/studio/.env
# then edit both files with AEM creds + Sanity project id / dataset / token
```

**What this does:** Creates two local `.env` files that the pipeline and Studio read at startup.

- **`examples/davids-bridal/.env`** — consumed by the migration CLIs. Holds AEM connection info (`AEM_ENV`, `AEM_AUTHOR_URL`, basic-auth creds or `AEM_TOKEN`) and, for live runs, Sanity write credentials (`SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_TOKEN`, `SANITY_MEDIA_LIBRARY_ID`, `SANITY_ML_LINK_TOKEN`).
- **`apps/studio/.env`** — consumed by the Sanity Studio. Holds `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` so the Studio knows which project to open.

Each tool loads `.env` from its own cwd, which is why the two files live in different directories (they can share values).

---

## 2. Stage 1 — emit Sanity schemas

```bash
pnpm --filter example-davids-bridal migrate:schema
pnpm --filter example-davids-bridal migrate:schema --verbose  # + per-request AEM GET logs
```

**What this does:** Reads every AEM component path listed in `examples/davids-bridal/aem-component-paths`, fetches each component's `_cq_dialog.infinity.json` from AEM, and converts those Granite UI dialogs into Sanity object schemas.

At startup the CLI prints a runtime banner summarizing the AEM env it's about to hit (base URL, auth kind — with password masked and bearer tokens shown as length + 4-char prefix) plus a Sanity preflight check (project id, dataset, token presence — the schema stage never calls Sanity, this is a config confirmation).

Flags / env vars:
- `--verbose` / `-v` (or `AEM_VERBOSE=true`) — elevates the logger to `debug` level. Surfaces every `GET {url}` the AEM fetcher issues, including Sling `.N.json` depth-fallback retries.
- `--continue-on-auth` (or `AEM_CONTINUE_ON_AUTH=true`) — treat per-component 401/403 as per-path ACL skips and keep going, as long as at least one component succeeds. Existing behavior.

Component type-name resolution happens up front via `resolveSanityTypeNames` (in `aem-to-sanity-schema/naming.ts`): any AEM path whose base name collides with a Sanity built-in (`image`, `file`, `slug`, `text`, etc.) is emitted with an `aem` prefix (so `/apps/aem-integration/components/image` → `aemImage.ts`). The same resolved name is written into the content registry and the `pageBuilder.of[]` array, so ingested documents will carry a `_type` that matches the Studio-registered schema name with no Studio-side renaming needed.

Outputs land under `examples/davids-bridal/output/`:
- `schemas/*.ts` — one Sanity object type per AEM component. Each carries a non-empty preview title (AEM `jcr:title` → title-cased type name → raw type name fallback) so Page Builder rows never render as "Untitled".
- `schemas/pageBuilder.ts` — array type listing every emitted block. Each member is emitted as `defineArrayMember({ type, title })` so the "+ Add" menu and row previews render friendly labels even before the row has any data.
- `schemas/page.ts` — minimal `page` document type (`title`, `slug`, `pageBuilder`).
- `schemas/index.ts` — barrel that exports `allSchemaTypes` for `defineConfig`.
- `content-type-registry.json` — `sling:resourceType` → Sanity type mapping, consumed by stage 3.
- `migration-report.json` + `audit/unmapped-examples.json` — what mapped, what didn't, and real examples of unmapped AEM props.

Output is deterministic, so re-runs produce clean `git diff`s.

---

## 3. Stage 2 — TypeGen

```bash
pnpm --filter example-davids-bridal typegen
```

**What this does:** Reads the schemas emitted in stage 1 and generates `output/sanity.types.ts` — TypeScript types for every schema, suitable for typed GROQ clients (`client.fetch<HeroBanner>(...)`). Runs entirely in-process via `tsx` + `@sanity/schema` internals; no network call and no `sanity schema extract` needed.

---

## 4. Stage 3 — content migration (run each sub-step individually)

```bash
pnpm --filter example-davids-bridal extract
pnpm --filter example-davids-bridal transform
pnpm --filter example-davids-bridal assets
pnpm --filter example-davids-bridal import
```

The four stages are independent CLIs chained through on-disk output; you can re-run any single one without redoing the others.

### 4a. `extract`
**What this does:** For every content root in `aem-content-roots`, fetches `{root}.infinity.json` from AEM and writes one JSON file per page into `output/raw/`. Automatically follows AEM's depth-5 truncation markers (issuing follow-up fetches in parallel and splicing subtrees back in) so the raw tree you get is complete. Also writes `output/extract-report.json` with counts, failures, and depth-expansion stats.

### 4b. `transform`
**What this does:** Walks each raw JCR tree under `output/raw/`, maps `sling:resourceType` values via `content-type-registry.json`, and emits one Sanity `page` doc per input into `output/clean/` — with a `pageBuilder` array of typed blocks. Each doc gets a deterministic `_id` (from JCR path) and each block a stable `_key`, so re-runs upsert instead of duplicating. Unknown types and entries in `aem-component-exceptions` are skipped but recorded in `output/transform-report.json`. Purely local — no AEM or Sanity calls.

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
**What this does:** Reads every file under `output/clean/` and commits the docs into your Sanity dataset via `@sanity/client` using `transaction().createOrReplace(doc).commit()`. Because `_id` values are derived from JCR paths, re-runs upsert rather than duplicate. **Dry-run by default** — prints what it *would* write until you set `MIGRATION_DRY_RUN=false`.

All four are dry-run by default. To actually write to Sanity, export `MIGRATION_DRY_RUN=false` before running `assets` + `import` (plus `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_TOKEN`, and for `assets` `SANITY_MEDIA_LIBRARY_ID` + `SANITY_ML_LINK_TOKEN`).

### One-time before the first live `assets` run:
```bash
pnpm --filter studio exec sanity media deploy-aspect aemSource
```

**What this does:** Deploys the `aemSource` aspect schema (`damPath` + `assetInstanceId`) to your Sanity Media Library. Once deployed, `aem-assets` can stamp every uploaded asset with its origin JCR path, which powers phase 0's dedup lookup on subsequent runs. Skipping this step is non-fatal — stamping just fails gracefully — but you lose cross-run dedup until you deploy.

---

## 5. (Optional) Run the whole pipeline in one shot

```bash
pnpm turbo run migrate:schema typegen migrate:content --filter=example-davids-bridal
```

**What this does:** Turbo executes the three top-level tasks in the order declared in `turbo.json` (schema → typegen → content). Pure emit steps are cached against input hashes so unchanged inputs skip re-running; network-dependent tasks (`extract`, `assets`, `import`) are marked `"cache": false` and always execute.

---

## 6. Studio — visual verification

```bash
pnpm --filter studio dev          # http://localhost:3333
```

**What this does:** Boots the Sanity Studio defined in `apps/studio/` against your configured project. The Studio's `schemas/index.ts` re-exports `allSchemaTypes` from `examples/davids-bridal/output/schemas/index.ts`, so every schema the pipeline emitted shows up as a real editable document type — you can open imported pages, verify block rendering, and spot-check the migration result.

Or just validate schema shape without booting the UI:

```bash
pnpm --filter studio exec sanity schema validate
```

**What this does:** Runs Sanity's static schema validator against the emitted types. Expects `0 errors, 0 warnings`. This is the gate that catches breakage if you change the emitter or hand-edit `output/schemas/`.

---

## 7. Media Library clean-up (test environments only)

```bash
# dry-run — prints what would be deleted
pnpm --filter example-davids-bridal wipe:media-library

# actually delete
pnpm --filter example-davids-bridal wipe:media-library -- --confirm-delete
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
pnpm --filter example-davids-bridal wipe:media-library -- --confirm-delete
rm -rf examples/davids-bridal/output/cache/assets
# optionally also clear the dataset's linked-asset docs, then re-run:
pnpm --filter example-davids-bridal assets
pnpm --filter example-davids-bridal import
```

---

Tell me which stage you want to start with and I can walk through just that one (or tail the output, inspect reports, etc.).
