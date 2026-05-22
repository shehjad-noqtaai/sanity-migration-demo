# AEM fixtures (offline replay)

Scrubbed AEM REST responses consumed when `AEM_FIXTURES_DIR=./fixtures/aem`.

Paths **mirror AEM URL paths** — no `__` encoding:

| On disk | AEM URL | Used by |
| --- | --- | --- |
| `content/demo/.../*.infinity.json` | `/content/...` | `aem-extract`, `aem-tags` |
| `apps/demo/.../*.infinity.json` | `/apps/...` | `migrate:schema` |
| `assets/` | `/content/dam/demo/_generated/*.gif` | `aem-assets` |

Twelve procedural animated GIFs (hero, banner, icon, tile, etc.) — no AEM download.
Regenerate with `pnpm build:demo-fixtures --capture-tags`.

Legacy flat `__`-encoded captures are still read if present. Convert with:

```bash
pnpm tsx scripts/migrate-fixtures-layout.ts tenants/demo/fixtures/aem --delete-legacy
```
