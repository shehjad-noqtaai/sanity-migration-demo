# Tenant migration template

This folder is a starting point. **Copy it** to set up a new migration:

```bash
cp -R examples/tenant examples/<your-tenant>
```

`<your-tenant>` is any short slug — `acme`, `tmobile`, `davids-bridal`. The copy lives outside git (`examples/*` is gitignored except this template) so each operator's working copy stays local.

## What's in here

| File | What to fill in |
| --- | --- |
| `.env.example` | Copy to `.env` and set AEM source + Sanity destination credentials. See `docs/running-the-migration.md` § 1a-bis for the AEMaaCS authentication walkthrough. |
| `aem-component-paths` | One JCR path per line — the AEM components you want a Sanity schema for. Discover via `<AEM_AUTHOR_URL>/apps/<your-namespace>/components.1.json`. |
| `aem-content-roots` | The AEM page paths to walk (`@base` + slug syntax). See `aem-content-roots.example` for the full grammar. |
| `aem-component-containers.json` | Map `sling:resourceType` → `{childrenField}` for AEM containers whose drop-zone children should become a nested `pageBuilder` array. Empty until you find one. |
| `aem-component-hints.json` | Map `sling:resourceType` → list of `cq:*` authoring-hint keys to preserve. Empty by default. |
| `aem-component-exceptions` | resource types / paths to skip during schema + transform. |
| `package.json` | Pre-wired scripts (`pnpm migrate:schema`, `extract`, `transform`, `assets`, `import`, `migrate`). Rename the `name` field after copying. |

## Bootstrapping a new tenant

```bash
# 1. Copy the template
cp -R examples/tenant examples/<your-tenant>

# 2. Rename the workspace
#    Edit examples/<your-tenant>/package.json → "name": "example-<your-tenant>"

# 3. Install (pnpm auto-discovers via examples/* glob in pnpm-workspace.yaml)
pnpm install

# 4. Fill in credentials
cp examples/<your-tenant>/.env.example examples/<your-tenant>/.env
$EDITOR examples/<your-tenant>/.env

# 5. List the AEM components you want migrated
$EDITOR examples/<your-tenant>/aem-component-paths
$EDITOR examples/<your-tenant>/aem-content-roots

# 6. Run the pipeline
pnpm -F example-<your-tenant> migrate:schema   # AEM dialogs → Sanity schemas
pnpm -F example-<your-tenant> extract          # AEM pages → output/cache/raw/
pnpm -F example-<your-tenant> transform        # raw → output/cache/clean/
pnpm -F example-<your-tenant> assets           # DAM → Media Library + link
pnpm -F example-<your-tenant> import           # clean docs → Sanity dataset

# Or one shot (with destructive --discard-drafts at the end):
pnpm -F example-<your-tenant> migrate
```

All five run in dry-run mode by default. Set `MIGRATION_DRY_RUN=false` in `.env` once the dry-run output looks right.

## Where to read more

- `docs/running-the-migration.md` — full operator runbook (env vars, per-stage flags, troubleshooting, AEMaaCS auth).
- `docs/overview.md` — architecture and stage-by-stage data flow.
- `docs/aem-to-sanity-mapping.md` — auto-generated mapping doc (regenerates from `mapping-table.ts` on each `migrate:schema` run).
