# aem-to-sanity-core

Shared primitives for the AEM → Sanity migration toolkit:

- AEM client (authenticated fetch for `.model.json` / `.infinity.json`). Emits `logger?.debug(\`GET {url}\`)` per request, so running any host CLI with `--verbose` (or `AEM_VERBOSE=true`) surfaces the full request trace without fetcher-level code changes.
- `.infinity.json` depth-truncation walker (transparent follow-up fetching)
- Config schema + resolver (no dotenv side-effects — pass your own env)
- Logger
- `logStartupBanner(logger, config, opts)` — print a masked, human-readable summary of the AEM config at CLI start. Basic auth shows the username only; bearer tokens render as `(len=N, prefix=abcd…)`. Optional `opts.sanity` adds a Sanity preflight block (project id / dataset / token presence) without ever reading the token value itself.
- Filesystem helpers (swappable output writers)

Depended on by `aem-to-sanity-schema` and `aem-to-sanity-content`.

> Status: scaffold. See repo root for the refactor plan.
