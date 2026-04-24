# aem-to-sanity-content

AEM → Sanity content migration as four flat scripts. Each step is inspectable on disk, so you can stop between phases and re-run just one.

```
aem-extract    AEM  → output/raw/*.json           + output/extract-report.json
aem-transform  raw  → output/clean/*.json         + output/transform-report.json
aem-assets     DAM  → output/assets/* + Sanity    + output/assets/manifest.json (resumable)
aem-import     clean → Sanity (dry-run by default)
```

## Configure

Env vars (can live in `.env`):

```
AEM_ENV=author                                # or publish
AEM_AUTHOR_URL=https://author.example.com
AEM_AUTHOR_USERNAME=...
AEM_AUTHOR_PASSWORD=...
# or: AEM_TOKEN=...

AEM_CONTENT_ROOTS_FILE=./aem-content-roots    # default
OUTPUT_DIR=./output                           # default

# Writes (import only)
SANITY_PROJECT_ID=...
SANITY_DATASET=production
SANITY_TOKEN=...
MIGRATION_DRY_RUN=false                       # opt-in to commit. Default: dry-run.

# aem-assets — Media Library
# Assets go to the org-level Media Library, NOT the dataset Content Lake.
SANITY_MEDIA_LIBRARY_ID=ml...                 # required when MIGRATION_DRY_RUN=false
SANITY_ML_LINK_TOKEN=...                      # personal auth token for /assets/media-library-link
                                              # (required when SANITY_TOKEN is a project robot token —
                                              #  the link API rejects non-global sessions)
# SANITY_API_VERSION=2025-02-19               # pinned for aem-assets; ML endpoints require it

# Optional
# AEM_MAX_RESPONSE_MB=100                     # abort any single response larger than this
```

## Roots file

`aem-content-roots` — one page per line:

```
@base /content/site/us/en
home
about-us
/content/other-site/top           # absolute path also fine
```

## Run

```sh
pnpm aem-extract                                         # fetches everything in roots file
pnpm aem-transform --registry ./content-type-registry.json
pnpm aem-assets                                          # dry run: downloads only
MIGRATION_DRY_RUN=false pnpm aem-assets                  # uploads to Sanity, rewrites clean docs
pnpm aem-import                                          # dry run
MIGRATION_DRY_RUN=false pnpm aem-import                  # commit docs
```

`--overwrite` on `aem-extract` re-fetches roots that already exist on disk. `--include <resourceTypes>` on `aem-transform` restricts the walk to a comma-separated allow-list. `aem-assets` processes one file at a time (sequential, low memory) and is resumable via `manifest.json`; flags:

- `--upload-only` — skip phase 1 (download from AEM); assumes local cache is populated.
- `--link-only` (or `MIGRATION_LINK_ONLY=true`) — skip phases 1 + 2 entirely. Phase 0's ML lookup finds assets already in the Media Library and links them into the dataset. Useful for re-runs, for iterating on link/rewrite logic without re-hitting AEM, or when assets were pushed out-of-band. Mutually exclusive with `--upload-only`. See § *aem-assets — Media Library flow* below for the caveat about the `aemSource` aspect.
- `--no-rewrite` — skip the in-place rewrite of `clean/*.json`.

`aem-import` flags:

- `--discard-drafts` (or `MIGRATION_DISCARD_DRAFTS=true`) — delete `drafts.{id}` alongside each published `createOrReplace`. Without this flag a stale draft from a prior run keeps shadowing freshly-imported content in the Studio. Opt-in; destroys authored in-progress edits.

## Type-aware coercion (transform)

AEM's JCR is schemaless on dialog inputs — every authored value arrives in `.infinity.json` as a JSON string, no matter what the dialog widget was. `aem-transform` reads each mapped block's `fields: [{name, type}]` from `content-type-registry.json` and coerces ingested string values into the Sanity-expected scalar:

- **`array-of-blocks`** (richtext) — converted to Portable Text via `@portabletext/block-tools` (parsed through `jsdom`). Decorators (`strong`, `em`, `underline`, `strike-through`, `code`), styles (`normal`, `h1`–`h4`, `blockquote`), lists (`bullet`, `number`), and `link` annotations are preserved. Keys are derived from a SHA1 of `{jcrPath}::{field}:{counter}` so re-runs produce byte-identical clean docs.
- **`number`** — `Number(v)`; kept as-is on `NaN`.
- **`boolean`** — `"true"` / `"false"` literal strings only; kept as-is otherwise so unrecognized values surface in Studio validation rather than being silently remapped.

Coercion walks the registry tree recursively — nested `array-of-object` items (e.g. `variableColumn.columnContents[]` rows) get the same treatment as top-level fields via the `itemFields` entries. AEM stores multifield rows in two shapes: canonical ordered (`item0`/`item1`/…) and named-key (`colors: {weddingDresses: {...}, ...}`). Both are materialized into proper arrays — the ordered form by `deepCoerceAemMultifieldMapsToArrays` during `transformInline`, the named-key form by `coerceFieldTypes` when the registry declares the field as `array-of-object` but the value is a plain object. `Object.values` preserves authored order.

Legacy `fields: string[]` registry entries skip every coercion step (pass-through); regenerate the registry via `migrate:schema` to opt in.

## Container components

AEM "container" components (cq:isContainer=true) carry two shapes in one JCR node: authored dialog fields *plus* drop-zone children that are themselves full component instances (e.g. the keys on an `expander` include both `theme` / `singleExpansion` dialog values AND `item_1657754806454`-style child `box` components). Declare those resource types in `aem-component-containers.json` (override with `AEM_COMPONENT_CONTAINERS_FILE`):

```json
{
  "aem-integration/components/expander":     { "childrenField": "items" },
  "aem-integration/components/box":          { "childrenField": "items" },
  "aem-integration/components/column-layout":{ "childrenField": "items" },
  "aem-integration/components/container":    { "childrenField": "items" }
}
```

Transform then does the right thing: dialog fields go through the normal inline + coercion path, while direct child keys with `sling:resourceType` are recursively emitted as pageBuilder blocks under `childrenField`. Nesting works — expander > box > content roundtrips. On the schema side, `migrate:schema` appends a matching `type: "pageBuilder"` field so the Studio palette inside the container matches the top-level page builder (any block is droppable).

## Named-slot components (auto-detected)

A different AEM pattern shows up on components like `media-paragraph`: a single nested child under a **fixed** JCR key (e.g. `content`) whose value is itself a full component with its own `sling:resourceType`. Not a dialog field, not a drop-zone container — just a named slot.

- **Transform** always emits these as single nested blocks under the slot key (`mediaParagraph.content = {_type: 'content', text: [{_type:'block', ...}], ...}`). Detection is structural: any direct child with `sling:resourceType` that isn't already claimed by container logic is a slot. Works on the first run with no config.
- **Schema** catches up on the next `migrate:schema`: that pass scans `output/cache/raw/` (extracted content) and appends a typed `defineField({ name: slotKey, type: childTypeName })` to the parent schema. Until then the Studio shows a yellow "Unknown fields found" warning on the nested data but the data itself is preserved.

There's no config for named slots — the shape is inferred from content. Container parents (listed in `aem-component-containers.json`) skip slot synthesis so their drop-zone children stay on the container-items path.

## Timing

Every CLI appends an `Elapsed:` line to its summary. `aem-assets` also reports per-phase durations (`phase 0 (ML dedup)` / `phase 1 (download)` / `phase 2 (upload)` / `phase 3 (link)` / `phase 4 (rewrite)`), which lets you see at a glance whether a slow run is bottlenecked on AEM fetches, ML uploads, or the dataset link API.

## Parallelism in aem-assets

Phases 0, 1, 2, 3 run with a work-stealing pool sized by `ASSET_CONCURRENCY` (default `4`). Phase 0's ML dedup pre-pass resolves every DAM path that already lives in the Media Library, so the downstream phases only touch each DAM path with a single worker — the shared `manifest` is never contended at the same key, and no locks are needed. The manifest file is persisted via synchronous `writeFileSync` + `JSON.stringify`, both atomic relative to the single-threaded event loop. If that ever moves to async `writeFile`, a serial lock becomes mandatory. Output is logged in completion order so progress reflects actual throughput.

## Reports

- `output/extract-report.json` — per-root outcome; HTTP 300/404/auth/too-large failures grouped by category.
- `output/extract-404.log` — one `<jcrPath>\t<fullUrl>` per 404 (only written when 404s occur).
- `output/transform-report.json` — unknown `sling:resourceType`s (with hit counts and example paths), unknown properties per mapped component, transform bails (max-depth or cycle). `aem-transform` also echoes unmapped types to the console at the end of the run as a paste-ready `/apps/...` list (the page root and `responsivegrid` wrapper are hidden — they're always passthroughs, never missing schemas). Add the listed paths to `aem-component-paths`, then re-run `migrate:schema` → `transform` → `import` so the new component's content stops being dropped.
- `output/assets-report.json` — asset download/upload/link counts, failures.
- `output/assets/manifest.json` — per-asset state (damPath → cachedFile → mediaLibraryAssetId → linkedAssetInstanceId → linkedRef + sanityRef). Drives resumability for all four phases: download, upload to Media Library, GDR link to dataset, doc rewrite.

## aem-assets — Media Library flow (@shehjadkhan 2026-04-22)

`aem-assets` runs five phases. Dry-run default stops after phase 1 (local download).

0. **Dedup against the Media Library + manifest staleness check** — GROQ on `aspects.aemSource.damPath`. A hit populates the manifest with both ids so phases 1+2 skip entirely for that asset. When the lookup misses but the manifest claims an `mediaLibraryAssetId`, phase 0 verifies the doc still exists in the ML by id; if it's been deleted (e.g. ML wipe), the stale linkage is cleared so phases 2-3 re-upload + re-link for real. Transport errors are treated conservatively — manifest state is preserved and the next healthy-network run re-verifies. Requires the `aemSource` aspect to be deployed once per ML. Skipped on dry-run by default; `--link-only` forces it to run (safe, read-only).
1. **Download** AEM DAM binary → local cache in `output/assets/`.
2. **Upload to Media Library** — `POST https://api.sanity.io/v{apiVersion}/media-libraries/{mlId}/upload`. Response `{asset: {_id}, assetInstance: {_id}}` captures the parent asset id and the versioned instance id (both needed for step 3). Uses `SANITY_TOKEN` — a project robot token works for this step.
3. **Link to dataset** — `POST https://{projectId}.api.sanity.io/v{apiVersion}/assets/media-library-link/{dataset}` with body `{mediaLibraryId, assetInstanceId, assetId}`. Response `{document: {_id, media: {_ref}, ...}}` — `document._id` is the dataset-local asset ref that goes into docs. **Requires a personal auth token** (`SANITY_ML_LINK_TOKEN`) because the endpoint rejects project robot tokens with `401 Invalid non-global session`.
4. **Rewrite clean docs** in place — every `/content/dam/...` string becomes `{_type:'image'|'file', asset:{_ref:'<linked-ref>'}}`. Pattern A (Studio-compatible), matches existing doc shape.

### `--link-only` mode

Runs phase 0, skips phases 1 + 2, runs phases 3 + 4. Use when assets are already in the ML (from an earlier run or pushed out-of-band). Any DAM path that phase 0 can't find in the ML is reported up front and ends up in the phase-4 `unresolved` summary. Phase 0's lookup only finds assets that this pipeline previously stamped — assets uploaded through the Studio UI without the `aemSource` aspect won't resolve by DAM path.

Manifest entry shape (`output/assets/manifest.json`):

```ts
{
  damPath: "/content/dam/dbi/m1.png",
  cachedFile: "/path/to/output/assets/dbi--m1.png",
  mimeType: "image/png", fileSize: 4049,
  mediaLibraryAssetId: "3CjO...",                // asset._id in ML
  linkedAssetInstanceId: "image-<sha1>-WxH-png", // assetInstance._id in ML
  linkedRef: "image-<sha1>-WxH-png",             // dataset-local ref — used as asset._ref
  mediaRef: "media-library:mlTnBi...:3CjO...",    // GDR reference
  sanityRef: {_type:"image", asset:{_type:"reference", _ref:"image-<sha1>-WxH-png"}},
  status: "linked",
  downloadedAt, uploadedAt, linkedAt
}
```

Re-runs are idempotent: a populated `linkedRef` skips upload + link; a populated `cachedFile` skips download.
