# AEM fixtures (offline replay)

Scrubbed AEM REST responses consumed when `AEM_FIXTURES_DIR=./fixtures/aem`.

| Folder | AEM paths | Used by |
|--------|-----------|---------|
| `content/` | `/content/...` | `aem-extract`, `aem-tags` |
| `components/` | `/apps/...` | `migrate:schema` |
| `images/` | `/content/dam/demo/_generated/*.gif` | `aem-assets` (when `AEM_FIXTURES_DIR` is set) |

Twelve procedural animated GIFs (hero, banner, icon, tile, etc.) — no AEM download.
Regenerate with `pnpm build:demo-fixtures --capture-tags`.
