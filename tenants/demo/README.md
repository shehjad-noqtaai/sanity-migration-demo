# Demo tenant (no AEM)

Offline demo of the AEM → Sanity migration pipeline. All AEM REST responses are
committed as scrubbed fixtures under `fixtures/aem/`; running the pipeline
regenerates `output/cache/raw/`, `clean/`, schemas, and imports locally.
`output/` is gitignored — only fixtures and tenant config are committed.

## Fixture layout

```
fixtures/aem/
├── content/...   page + tag .infinity.json trees (mirrors /content/...)
├── apps/...      component + dialog .infinity.json trees (mirrors /apps/...)
└── assets/       procedural animated GIFs per layout kind (/_generated/*.gif)
```

Fixture paths mirror AEM URLs. When `AEM_FIXTURES_DIR=./fixtures/aem` is set,
`aem-assets` reads `assets/` for DAM binaries. Content references canonical
`/_generated/{layout}.gif` paths.

## Quick start (operators)

```bash
cd tenants/demo
cp .env.example .env          # fill SANITY_* vars with your project
pnpm migrate                  # full offline pipeline
pnpm --filter studio dev      # verify in Studio
```

No AEM credentials are required — `AEM_FIXTURES_DIR` replays committed fixtures.

## Maintainer flow

Regenerate fixtures from source tenant caches:

```bash
pnpm build:demo-fixtures --capture-tags
pnpm migrate:doctor demo
```

Use `--scratch` to write to `output/demo-scratch/` for review before promoting.
