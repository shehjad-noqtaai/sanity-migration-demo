# aem-to-sanity-schema

Reads AEM Granite UI component dialog definitions and emits:

- Sanity object schemas (`defineType` / `defineField` TypeScript files — one per AEM component)
- Matching TypeScript types via official Sanity TypeGen (`sanity schema extract` + `sanity typegen generate`)
- A migration report (`migration-report.json`) with per-component outcome and unmapped fields
- An audit artifact pointing at concrete JSON examples of unmapped AEM resource types — makes extending the mapping table straightforward

Usage (programmatic):

```ts
import { migrateSchemas } from "aem-to-sanity-schema";
```

Usage (CLI):

```sh
aem-to-sanity-schema                  # read config from env/.env
aem-to-sanity-schema --verbose        # + log every AEM GET
aem-to-sanity-schema --continue-on-auth
```

Flags:

- `--verbose` / `-v` (or `AEM_VERBOSE=true`) — elevate logger to `debug`; surfaces every `GET {url}` + Sling `.N.json` depth-fallback retries issued by `aem-to-sanity-core`'s AEM fetcher.
- `--continue-on-auth` (or `AEM_CONTINUE_ON_AUTH=true`) — treat per-component 401/403 as per-path ACL skips and keep going, as long as at least one component succeeds. A circuit breaker still aborts on `N` consecutive auth failures with zero successes.

Startup banner (always printed at info level) shows what the run is about to connect to: AEM env + base URL, auth kind (basic: username only; bearer: `len=N, prefix=abcd…`), paths / roots files, output dir, concurrency. A Sanity preflight block reports `SANITY_PROJECT_ID` / `SANITY_DATASET` / token presence — the schema stage never calls Sanity, it's a config sanity check for the downstream content ingest.

Reserved-name handling: `resolveSanityTypeNames` (exported from this package) maps each AEM component path to its final Sanity type name up front. Bases that collide with Sanity built-ins (`image`, `file`, `slug`, `text`, etc.) are prefixed with `aem` at emission time, and the same resolved name lands in `schemas/*.ts`, `pageBuilder.of[]`, and `content-type-registry.json` — so the Studio never has to rename and ingested `_type` values match what the schema registers.

Content registry carries Sanity types: each entry's `fields` is `Array<{name, type}>`, not just names. `aem-transform` reads those types to coerce AEM values into the exact Sanity shape — for example, HTML strings on `array-of-blocks` fields (AEM's `cq/gui/components/authoring/dialog/richtext`) are converted into Portable Text at ingest. Legacy `fields: string[]` registries are still read, minus the coercion.

Container components are declared in `aem-component-containers.json` (override with `AEM_COMPONENT_CONTAINERS_FILE`). For each listed `sling:resourceType`, the emitter appends a synthetic `defineField({ name: childrenField, type: "pageBuilder" })` so the Studio palette inside the container mirrors the top-level page builder. The content transform consumes the same file to recursively emit drop-zone children (cq:isContainer pattern: JCR keys whose values are nodes carrying their own `sling:resourceType`) as nested pageBuilder blocks. Missing file → no container behavior.

**Named-slot auto-discovery.** Some AEM components nest a single fixed-name child component under a JCR key (e.g. `media-paragraph.content` = a `content` block). These aren't dialog fields and aren't drop-zones — they're slots, and they only show up in authored content. `migrate:schema` scans `output/cache/raw/*.json` after the dialog pass and emits a `defineField({ name: slotKey, type: childTypeName })` for each discovered slot so the Studio shows typed inline data instead of "Unknown fields" warnings. No config. First run has no content to scan (returns empty); rerun after `aem-extract` and slots materialize. Container parents skip slot synthesis — their drop-zone logic already claims resourceType-carrying children.

> Status: scaffold. See repo root for the refactor plan.
