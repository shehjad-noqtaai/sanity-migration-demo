# AEM → Sanity migration — high-level overview

A single-page map of what this repo does, how the pieces fit together, and the minimum commands and configuration to run it end to end.

For deeper reading: the architectural reasoning lives in [`monorepo-refactor-plan.md`](./monorepo-refactor-plan.md); the full operator's runbook lives in [`running-the-migration.md`](./running-the-migration.md); the AEM↔Sanity field-level mapping lives in [`aem-to-sanity-mapping.md`](./aem-to-sanity-mapping.md).

---

## What we're migrating

Adobe Experience Manager (AEM) stores two distinct things that both need to move to Sanity:

1. **Component dialog definitions** — the Granite UI forms that describe what fields each AEM component has (e.g. a `promo` has `headline`, `image`, `cta`). These are the *schemas*.
2. **Content instances** — authored pages under `/content/...` that use those components. These are the *documents*.

AEM exposes both over HTTP as JSON:

- `{host}/{componentPath}/_cq_dialog.infinity.json` — dialog tree for a component.
- `{host}/{contentPath}.infinity.json` — content tree for a page (truncated at depth ~5).

Sanity expects:

- TypeScript object types (`defineType` / `defineField`) for schemas.
- JSON documents with `_type`, `_id`, `_key`, references, and optional Portable Text for content.

Everything in this repo is a bridge between those two shapes.

---

## The pipeline — three stages plus a studio

```
 AEM author/publish            aem-to-sanity pipeline              Sanity
┌──────────────────┐          ┌───────────────────────┐          ┌──────────┐
│ _cq_dialog       │──(1)──▶  │ migrate:schema        │──emits──▶│ Studio   │
│ .infinity.json   │          │   → output/schemas/*.ts          │ (validates
│                  │          │   → pageBuilder.ts / page.ts     │  schemas) │
│                  │          │   → content-type-registry.json   │           │
├──────────────────┤          ├───────────────────────┤          ├──────────┤
│ (same schemas)   │──(2)──▶  │ typegen               │──emits──▶│ typed    │
│                  │          │   → output/sanity.types.ts       │ GROQ     │
├──────────────────┤          ├───────────────────────┤          ├──────────┤
│ /content/...     │──(3)──▶  │ extract → transform   │──writes─▶│ docs via │
│ .infinity.json   │          │   → assets → import   │          │ client   │
│ (depth-truncated)│          │   (dry-run by default)           │           │
└──────────────────┘          └───────────────────────┘          └──────────┘
```

**Stage 1 — Schema generation** (`packages/aem-to-sanity-schema`)
Reads the component paths in `aem-component-paths`, fetches each dialog's `.infinity.json`, walks the Granite UI tree, and emits one Sanity object type per component using a deterministic resource-type → Sanity-type mapping table. Also emits a `pageBuilder` array type (every emitted block registered in `of: [...]`), a minimal `page` document type, a barrel `index.ts`, and a `content-type-registry.json` that stage 3 consumes.

**Stage 2 — TypeGen** (same package, separate CLI)
Runs `@sanity/schema` in-process to produce `output/sanity.types.ts` — no network call, no Studio required. Downstream consumers can import types like `HeroBanner` for typed GROQ results.

**Stage 3 — Content migration** (`packages/aem-to-sanity-content`, four flat scripts run in order)
- `aem-extract` — walks `.infinity.json` for each root in `aem-content-roots`, transparently following depth-5 truncation markers. Writes to `output/raw/` plus `output/extract-report.json`.
- `aem-transform` — maps extracted AEM nodes to Sanity `page` docs using `content-type-registry.json`. Adds `_type`, deterministic `_id` (from JCR path), stable `_key`s (from `jcr:uuid` or path SHA1). Unknown resource types and exceptions are skipped but noted. Writes to `output/clean/` plus `output/transform-report.json`.
- `aem-assets` — scans clean docs for `/content/dam/...` references, downloads from AEM, uploads to Sanity's asset pipeline, and rewrites the clean docs in place so fileupload fields hold Sanity asset refs. Maintains `output/assets/manifest.json` so re-runs skip uploaded assets.
- `aem-import` — commits docs from `output/clean/` via `@sanity/client` using `transaction().createOrReplace(doc).commit()`. Deterministic `_id`s mean re-runs upsert instead of duplicating.

**All writes to Sanity are dry-run unless `MIGRATION_DRY_RUN=false` is set.** `aem-extract` and `aem-transform` are local-only regardless; only `aem-assets` and `aem-import` touch Sanity.

Drift findings (unknown resource types, unknown props per mapped component, transform bails) are captured in `output/transform-report.json` with first-N example paths per finding — feed these back into `mapping-table.ts` when extending the mapping.

**Studio app** (`apps/studio`)
A real Sanity Studio. `apps/studio/schemas/index.ts` re-exports `allSchemaTypes` from `examples/<your-tenant>/output/schemas/index.ts`, and `sanity.config.ts` runs them through `sanitizeSchemaTypes` (from `aem-to-sanity-schema/sanitize`) at import. It's a consumer test — if emitted schemas break `sanity schema validate`, this is where it surfaces.

**Storefront preview** (`apps/web`)
A Vite + React 19 app that reads the migrated home doc and renders its pageBuilder through a set of block primitives styled per `docs/DESIGN.md`. Mirrors the `hydrogen-sanity` data pattern — when this graduates into a full Shopify + Hydrogen storefront, the renderers + Portable Text setup carry over unchanged. Run with `pnpm -F web dev`.

---

## Design principles worth keeping in mind

- **Deterministic output.** Re-running any stage produces byte-identical files given the same input, so `git diff` shows only real changes.
- **Dry-run by default for anything that writes to Sanity.** Opt in with `MIGRATION_DRY_RUN=false`.
- **Upserts, not duplicates.** `_id`s are derived from JCR paths; re-runs converge.
- **Unknown shapes are findings, not failures.** The pipeline keeps going; the audit captures what to fix next.
- **Separation of concerns.** `aem-to-sanity-core` owns fetching/auth/config; the two workflow packages (`schema`, `content`) own their transforms. External projects can depend on just the pieces they need.

---

## Monorepo layout (what lives where)

```
aem-migration/
├── packages/
│   ├── aem-to-sanity-core/       shared fetcher, auth, config, logger, depth-handling
│   ├── aem-to-sanity-schema/     dialog → Sanity object types + TypeGen + pageBuilder
│   └── aem-to-sanity-content/    extract / transform / assets / import CLIs
├── apps/
│   └── studio/                   example Sanity Studio consuming emitted schemas
├── examples/
│   ├── tenant/                   committed template — copy to start a new migration
│   └── <your-tenant>/            operator working copy (gitignored): env, path lists, pnpm scripts, output/
├── docs/
└── turbo.json / pnpm-workspace.yaml / tsconfig.base.json
```

Tooling: **pnpm workspaces + Turborepo**, TypeScript strict/NodeNext, `tsup` for ESM+CJS+`.d.ts` output, `zod` for runtime validation of AEM payloads, `changesets` for releases.

---

## Minimum commands to run it end to end

From the repo root, assuming `pnpm` ≥ 9 and Node ≥ 20:

```bash
# 0. Install + build all three packages
pnpm install
pnpm build

# 1. Fill in env (see Configuration section below)
cp examples/<your-tenant>/.env.example examples/<your-tenant>/.env
cp apps/studio/.env.example            apps/studio/.env
$EDITOR examples/<your-tenant>/.env
$EDITOR apps/studio/.env

# 2. Stage 1 — emit Sanity schemas from AEM dialogs
pnpm --filter example-<your-tenant> migrate:schema

# 3. Stage 2 — generate TypeScript types from those schemas
pnpm --filter example-<your-tenant> typegen

# 4. Stage 3 — content migration (dry-run by default)
pnpm --filter example-<your-tenant> migrate:content
#    (chains extract → transform → assets → import)

# 5. Real write to Sanity — opt in explicitly via env var
MIGRATION_DRY_RUN=false pnpm --filter example-<your-tenant> migrate:content
#    (or export MIGRATION_DRY_RUN=false once, for the whole shell)

# 6. Visually verify in a Sanity Studio that loads the emitted schemas
pnpm --filter studio dev                     # http://localhost:3333
pnpm --filter studio exec sanity schema validate

# — Or orchestrate the whole pipeline with Turbo —
pnpm turbo run migrate:schema typegen migrate:content --filter=example-<your-tenant>
```

### Incremental tasks

```bash
# Re-register hand-authored block types without re-running migrate:schema
pnpm --filter example-<your-tenant> pagebuilder:refresh

# Run a single content stage on its own
pnpm --filter example-<your-tenant> extract
pnpm --filter example-<your-tenant> transform
pnpm --filter example-<your-tenant> assets
pnpm --filter example-<your-tenant> import
```

---

## Configuration — the bare minimum

Two `.env` files. They can share values; each tool loads `.env` from its own cwd.

### Pipeline — `examples/<your-tenant>/.env`

```bash
# AEM source
AEM_ENV=author                     # or `publish`
AEM_AUTHOR_URL=https://author.example.com

# Pick one (see running-the-migration.md § 1a-bis):
# (a) AEMaaCS Service Credentials — exchanged via Adobe IMS at startup
# AEM_SERVICE_CREDENTIALS_FILE=/path/to/service-credentials.json
# (b) AEMaaCS developer token (24h) or any pre-minted bearer
# AEM_TOKEN=...
# (c) on-prem / AMS basic auth (rejected by AEMaaCS)
AEM_AUTHOR_USERNAME=migration-user
AEM_AUTHOR_PASSWORD=***

# Optional plumbing
AEM_COMPONENT_PATHS_FILE=./aem-component-paths
AEM_CONTENT_ROOTS_FILE=./aem-content-roots
AEM_COMPONENT_EXCEPTIONS_FILE=./aem-component-exceptions
# AEM_MAX_RESPONSE_MB=50           # optional, cap per-fetch payload size
OUTPUT_DIR=./output
CONCURRENCY=4

# Sanity destination — only read when MIGRATION_DRY_RUN=false
# MIGRATION_DRY_RUN=false          # opt in to real writes from aem-assets / aem-import
SANITY_PROJECT_ID=your-project-id
SANITY_DATASET=production
SANITY_TOKEN=sk...                 # write-scoped (Editor or higher)
SANITY_API_VERSION=2024-01-01      # optional
```

### Studio — `apps/studio/.env`

```bash
SANITY_STUDIO_PROJECT_ID=your-project-id
SANITY_STUDIO_DATASET=production
```

### Input files (under `examples/<your-tenant>/`)

| File | Purpose |
| --- | --- |
| `aem-component-paths` | JCR paths of components to migrate, one per line. `#` comments allowed. Consumed by `migrate:schema`. |
| `aem-content-roots` | Content paths to walk, with `@base` sections and slug lines. Consumed by `aem-extract`. See `aem-content-roots.example` for syntax. |
| `aem-component-exceptions` | Components to skip or override during schema emission. |
| `output/content-type-registry.json` | **Generated** by `migrate:schema`. Maps AEM `sling:resourceType` → Sanity type name + fields. Consumed by stage 3. Preserved on re-run if you remove the `__generated` marker. |

### Auth precedence

`AEM_SERVICE_CREDENTIALS_FILE` / `AEM_SERVICE_CREDENTIALS` (AEMaaCS via IMS) > `AEM_TOKEN` (developer / pre-minted bearer) > (`AEM_{ENV}_USERNAME` + `AEM_{ENV}_PASSWORD`) (on-prem / AMS basic auth). If none are set for the active `AEM_ENV`, the CLI fails fast and lists all three options.

### What you almost certainly don't need to touch

- `turbo.json` — the pipeline ordering (`migrate:schema` → `typegen` → `migrate:content`) is already declared.
- `tsconfig.base.json` — every package extends it; `strict` + `noUncheckedIndexedAccess` are intentional.
- Mapping table — edit `packages/aem-to-sanity-schema/src/mapping-table.ts` only when the audit surfaces a recurring unmapped `sling:resourceType`. Docs regenerate from it.

---

## What's not automated yet

- **`pathfield` → Sanity `reference`** — AEM path fields pass through as strings; document-reference resolution is deferred.
- **Custom page document types** — the generic `page` doc is the fallback. For per-template document types (one Sanity type per `cq:template` with the page-shell dialog lifted as `pageProperties`), declare your page-shell components in `aem-page-components.json` — see `docs/running-the-migration.md` § 1c-septies. Hand-authored doc types still work alongside: the generator won't overwrite files missing the `GENERATED` marker, so you can drop in a custom `landingPage` / `productPage` schema and it survives `migrate:schema` re-runs.
- **CI publishing** — `changeset publish` is wired but not automated from GitHub Actions yet.

See [`running-the-migration.md`](./running-the-migration.md#7-troubleshooting) for the troubleshooting table.
