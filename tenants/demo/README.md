# Demo tenant (no AEM)

Offline demo of the AEM → Sanity migration pipeline. All AEM REST responses are
committed as scrubbed fixtures under `fixtures/aem/`; running the pipeline
regenerates `output/cache/raw/`, `clean/`, schemas, and imports locally.
`output/` is gitignored — only fixtures and tenant config are committed.

## Fixture layout

```
fixtures/aem/
├── content/      page + tag .infinity.json trees (/content/...)
├── components/   component + dialog .infinity.json trees (/apps/...)
└── images/       procedural animated GIFs per layout kind (/_generated/*.gif)
```

Pipeline stages resolve fixtures from the matching bucket automatically when
`AEM_FIXTURES_DIR=./fixtures/aem` is set. `aem-assets` reads `images/`
when that env var is set. Content references canonical `/_generated/{layout}.gif` paths.

## Quick start (operators)

```bash
cd tenants/demo
cp .env.example .env          # fill SANITY_* vars with your project
pnpm install                  # from repo root if needed
pnpm migrate:demo
pnpm --filter studio dev
```

No AEM credentials are required — `AEM_FIXTURES_DIR` replays committed fixtures.

## Regenerating fixtures (maintainers)

Requires local source tenant caches under `tenants/` (gitignored) plus
live AEM for tag capture once:

```bash
pnpm build:demo-fixtures --capture-tags
```

Review with `--scratch` first (`output/demo-scratch/`) if desired.
