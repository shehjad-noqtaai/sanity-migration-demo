# Running the AEM → Sanity migration end-to-end

This is the operator's guide: every env var, every command, and the order to run them in so you can go from a running AEM instance to content in Sanity.

The pipeline has three independent stages. Stage 3 is itself a four-step chain:

1. **Schemas** — read AEM component dialogs (`_cq_dialog`) → emit Sanity object types.
2. **TypeGen** — produce `sanity.types.ts` for typed GROQ clients.
3. **Content** — `aem-extract` → `aem-transform` → `aem-assets` → `aem-import`. Walks AEM `.infinity.json` trees, transforms JCR nodes into Sanity docs, uploads DAM assets, and commits via `@sanity/client`. **Dry-run by default**; set `MIGRATION_DRY_RUN=false` to write to Sanity.

A fourth, one-time step scaffolds the **Studio** that consumes the emitted schemas.

---

## 0. Prerequisites

- **Node** ≥ 20
- **pnpm** ≥ 9 (this repo is pnpm-only; npm/yarn will not resolve `workspace:*`)
- **AEM access** — an account that can `GET` both `*.infinity.json` on component paths and content paths, or an equivalent bearer token.
- **Sanity project** — create at [sanity.io/manage](https://www.sanity.io/manage). You need the project id, dataset name, and a write token (role: Editor or higher).

```bash
pnpm install
pnpm build   # builds all three packages into packages/*/dist
```

---

## 1. Configure environment variables

There are two `.env` files — one for the pipeline CLIs, one for the Studio. They can share values; they live in different directories because each tool loads `.env` from its own cwd.

### 1-pre. Bootstrap a tenant folder

Every migration runs from a tenant folder under `examples/`. The only one tracked in git is `examples/tenant/` — the template. **Copy it** to start a new migration:

```bash
cp -R examples/tenant examples/<your-tenant>
# Update the workspace name so `pnpm -F` matches:
sed -i '' 's/"example-tenant"/"example-<your-tenant>"/' examples/<your-tenant>/package.json
pnpm install   # pnpm auto-discovers via the `examples/*` glob in pnpm-workspace.yaml
```

`<your-tenant>` is any short slug — `acme`, `tmobile`, `davids-bridal`. The copy is gitignored — only `examples/tenant/` is committed, so each operator's working copy (with real credentials, customer-specific component lists, and per-run pipeline output) stays local.

### 1a. Pipeline `.env` — `examples/<your-tenant>/.env`

```bash
cp examples/<your-tenant>/.env.example examples/<your-tenant>/.env
```

| Variable | Required? | Purpose |
| --- | --- | --- |
| `AEM_ENV` | yes | `author` or `publish` — which of the URL/credential pairs below to use. Default: `author`. |
| `AEM_AUTHOR_URL` | conditional | Base URL of your author instance. Required when `AEM_ENV=author`. AEMaaCS URLs look like `https://author-pXXXX-eYYYY.adobeaemcloud.com`. |
| `AEM_AUTHOR_USERNAME` | conditional | Basic-auth user for author. **AMS / on-prem only** — AEMaaCS rejects basic auth. |
| `AEM_AUTHOR_PASSWORD` | conditional | Basic-auth password for author. **AMS / on-prem only.** |
| `AEM_PUBLISH_URL` / `USERNAME` / `PASSWORD` | conditional | Same, for publish. |
| `AEM_TOKEN` | optional | Bearer token. Use this for **AEMaaCS developer (local-development) tokens** generated in Cloud Manager → Environment → Developer Console → *Integrations* → *Get Local Development Token*. They expire after 24h. Overrides basic auth when set. |
| `AEM_SERVICE_CREDENTIALS_FILE` | optional | Path to a **Service Credentials JSON** downloaded from Adobe Developer Console. The migration exchanges these credentials with Adobe IMS at startup and uses the resulting short-lived access token as a bearer. Works for both modern OAuth Server-to-Server and legacy JWT shapes. See § 1a-bis. Highest priority — overrides `AEM_TOKEN` and basic auth. |
| `AEM_SERVICE_CREDENTIALS` | optional | Same content as the file above, but inlined as a JSON string (useful for CI where you'd rather paste into a secret manager than mount a file). Mutually exclusive with `AEM_SERVICE_CREDENTIALS_FILE`. |
| `AEM_COMPONENT_PATHS_FILE` | optional | File listing component JCR paths to migrate (one per line, `#` for comments). Default: `./aem-component-paths`. |
| `AEM_CONTENT_ROOTS_FILE` | optional | File listing content roots to walk during extraction. Default: `./aem-content-roots`. See `aem-content-roots.example` for syntax. |
| `AEM_TAG_ROOTS_FILE` | optional | File listing AEM tag namespaces / subtrees to walk during `aem-tags`. Default: `./aem-tag-roots`. Same format as `aem-content-roots` (slug semantics are irrelevant for tags). Only listed namespaces are migrated — there's no canonical "always skip" set in AEM. See § 1c-sexies. |
| `AEM_COMPONENT_EXCEPTIONS_FILE` | optional | File listing `sling:resourceType` values to skip during transform. Default: `./aem-component-exceptions`. |
| `AEM_COMPONENT_CONTAINERS_FILE` | optional | JSON file mapping `sling:resourceType` → `{ childrenField }` for AEM container components whose drop-zone children should become a nested `pageBuilder` array. Default: `./aem-component-containers.json`. Missing file → no container behavior. |
| `AEM_COMPONENT_HINTS_FILE` | optional | JSON file mapping `sling:resourceType` → `["cq:hintKey", …]`, opting individual components into AEM authoring-hint lifting (e.g. `cq:panelTitle` on accordion children). Default: `./aem-component-hints.json`. Missing file → no hint behavior. See § 1c-quinquies. |
| `AEM_MAX_RESPONSE_MB` | optional | Cap per-fetch payload size during extract. Pages exceeding this are recorded as `tooLarge` failures. |
| `MIGRATION_DOC_ID_PREFIX_STRIP` | optional | `aem-transform` only. Path prefix(es) to strip from JCR paths before deriving Sanity document `_id`s. Typical value is the `@base` from `aem-content-roots` (e.g. `/content/uxp/us/en`). Multiple prefixes allowed comma-separated; longest match wins. Without this, `_id`s carry the full path (`content-uxp-us-en-customer-support-plans-...`). With it, you get the page-relative form (`customer-support-plans-...`). Changing this between runs orphans previously imported docs — set once, leave alone. |
| `OUTPUT_DIR` | optional | Where schemas, reports, and audit live. Default: `./output`. |
| `CONCURRENCY` | optional | Parallel AEM fetches. Default: `4`. |
| `MIGRATION_DRY_RUN` | optional | `aem-assets` and `aem-import` are dry-run unless this is explicitly set to `false`. Default (unset): dry-run. |
| `MIGRATION_LINK_ONLY` | optional | `aem-assets` only. `true` ⇔ passing `--link-only`. Skips phases 1 + 2 (download + upload) and relies on phase 0 to find assets already in the Media Library. See § 4c. |
| `ASSET_CONCURRENCY` | optional | `aem-assets` only. Number of parallel workers used across phases 0 (ML dedup), 1 (AEM download), 2 (ML upload), 3 (dataset link). Default: `4`. Dedup in phase 0 guarantees each DAM path is processed by exactly one worker, so the shared manifest is never contended at the same key. |
| `MIGRATION_DISCARD_DRAFTS` | optional | `aem-import` only. `true` ⇔ passing `--discard-drafts`. Deletes `drafts.{id}` alongside each published `createOrReplace` so the Studio shows the freshly-imported content instead of a stale draft from a prior run. Opt-in — destroys authored in-progress edits. |
| `AEM_VERBOSE` | optional | `true` ⇔ passing `--verbose`. Elevates the CLI logger to `debug` so every AEM GET is logged. |
| `SANITY_PROJECT_ID` | required for writes | Only read when `MIGRATION_DRY_RUN=false`. |
| `SANITY_DATASET` | required for writes | |
| `SANITY_TOKEN` | required for writes | API token. Used for `aem-import` and for the Media Library **upload** phase of `aem-assets`. A project robot token (Editor+) works for `aem-import` and historically worked for ML upload too, but newer Media Library API versions reject robot tokens with `401 SIO-401-ANF "Session not found"` — if you hit that on phase 2, use a personal token here. See § 4c-bis for how to generate one. |
| `SANITY_MEDIA_LIBRARY_ID` | required for `aem-assets` writes | Id of the org-level Sanity Media Library that assets go into (e.g. `mlTnBiUKRzfi`). Must belong to the same org as `SANITY_PROJECT_ID`. |
| `SANITY_ML_LINK_TOKEN` | conditional | Personal auth token used for the Media Library **link** step in `aem-assets`. Required when `SANITY_TOKEN` is a project robot token (the link API rejects non-global sessions with `401 SIO-401-ANF`). See § 4c-bis for how to generate one. |
| `SANITY_API_VERSION` | optional | Default: `2024-01-01` for import; `aem-assets` pins `2025-02-19` because Media Library endpoints require it. |

Auth precedence: `AEM_SERVICE_CREDENTIALS_FILE` / `AEM_SERVICE_CREDENTIALS` (AEMaaCS via IMS) > `AEM_TOKEN` (developer / pre-minted bearer) > (`*_USERNAME` + `*_PASSWORD`) (on-prem / AMS basic auth). If none are set for the active `AEM_ENV`, the CLI fails fast and lists all three options.

### 1a-bis. AEM as a Cloud Service — Service Credentials & developer tokens

AEMaaCS does not accept basic auth. Pick one of the three flows below; the resolver auto-detects which based on which env vars you set.

#### Service Credentials (recommended for migration runs)

The right choice for anything more than a quick local trial — the token Adobe IMS issues is valid for hours, doesn't need to be re-pasted between runs, and survives CI workflows.

1. In **Cloud Manager**, open the target environment (the one you want to migrate from).
2. Click the actions menu → **Developer Console** (opens `dev-console-ns-team-aem-cm-prd-nXXXXX.ethos05-prod-va6.dev.adobeaemcloud.com/...` or similar).
3. Go to **Integrations** → **Service Credentials** → **Get Service Credentials** → **Create new technical account**. Adobe IMS provisions a technical account, generates a private key, and downloads a JSON file. Save it somewhere outside the repo — it carries credentials.
4. Point the migration at the file:
   ```bash
   AEM_SERVICE_CREDENTIALS_FILE=/path/to/service-credentials.json
   ```
   Or, for CI, inline the JSON:
   ```bash
   AEM_SERVICE_CREDENTIALS='{"CLIENT_ID":"...","CLIENT_SECRET":"...","SCOPES":["..."], ...}'
   ```
   Set only one — both is a configuration error.

The migration accepts both shapes Adobe currently emits:

- **OAuth Server-to-Server** (current, for new integrations): flat object with `CLIENT_ID`, `CLIENT_SECRET`, `SCOPES`, `TECHNICAL_ACCOUNT_ID`, `IMS_ORG_ID`. The resolver exchanges these via `POST {imsEndpoint}/ims/token/v3` with `grant_type=client_credentials`.
- **Legacy JWT** (still issued for some AEMaaCS environments — deprecated by Adobe but supported by IMS through their migration window): `{ok, integration:{...}}` wrapper with `imsEndpoint`, `technicalAccount.{clientId,clientSecret}`, `org`, `metascopes`, `id`, `privateKey`. The resolver signs an RS256 JWT and exchanges it via `POST {imsEndpoint}/ims/exchange/jwt/`.

If your file doesn't match either shape, the CLI fails at startup with a message naming the missing fields — no opaque 401s deep in the walker.

Token lifetime: IMS access tokens are typically valid for ~24h. The migration uses a single token for the whole run, so a single token easily covers even a multi-hour migration. The startup banner prints `auth ims access token (len=…, prefix=…) (expires <ISO8601>)` so you can see at a glance how long you have. If you hit an expired token mid-run, just re-run the stage — the resolver fetches a fresh token at startup.

#### Developer (local-development) token

For quick local trials or one-shot debugging. Generate one in Cloud Manager → Environment → Developer Console → *Integrations* → *Get Local Development Token*, then paste:

```bash
AEM_TOKEN=eyJhbGc...
```

Expires after 24h. If the migration takes longer, regenerate and re-run — the manifest-driven extract/transform/assets stages are resumable.

#### Basic auth — on-prem / AMS only

`AEM_AUTHOR_USERNAME` + `AEM_AUTHOR_PASSWORD` works against author + publish on-prem and on AMS. AEMaaCS rejects it with 401. If you see a 401 banner against an `*.adobeaemcloud.com` URL with these set, switch to one of the two flows above.

#### Where to read more

- [AEM Headless Authentication Overview](https://experienceleague.adobe.com/en/docs/experience-manager-learn/getting-started-with-aem-headless/authentication/overview) — Adobe's matrix of the three flows.
- [Service Credentials walkthrough](https://experienceleague.adobe.com/en/docs/experience-manager-learn/getting-started-with-aem-headless/authentication/service-credentials) — step-by-step screenshots of provisioning a Service Credential in Cloud Manager.

### 1b. Studio `.env` — `apps/studio/.env`

```bash
cp apps/studio/.env.example apps/studio/.env
```

Sanity CLI auto-loads variables with the `SANITY_STUDIO_` prefix from this file:

```
SANITY_STUDIO_PROJECT_ID=your-project-id
SANITY_STUDIO_DATASET=production
```

The studio config also accepts unprefixed `SANITY_PROJECT_ID` / `SANITY_DATASET` as a fallback, so if you already exported those in your shell for the content CLI you don't need to duplicate them.

### 1c. Component path list — `examples/<your-tenant>/aem-component-paths`

One JCR path per line. Lines beginning with `#` are ignored. Example:

```
/apps/<your-namespace>/components/content/heroBanner
/apps/<your-namespace>/components/content/promo
# add or remove paths as you migrate in waves
```

The schema CLI fetches `{path}/_cq_dialog.infinity.json` for each entry.

### 1c-bis. Content roots list — `examples/<your-tenant>/aem-content-roots`

Consumed by `aem-extract` (stage 3). Supports `@base` sections to avoid repeating long paths, nested relative entries (slashes allowed), and absolute JCR paths. Example:

```
@base /content/uxp/us/en

home
about-us
customer-support/plans/consumer/phones/experience-beyond-plan   # nested relatives share the @base
development-growth/news/magenta-accelerator-fall-2026
/content/other-site/top                                          # absolute paths work too
```

Each line becomes a Sanity page doc with its `slug` derived from the **last segment** of the resolved JCR path — matching AEM's own page-slug semantics. So the nested entry above produces `slug: experience-beyond-plan`, not the full sub-path. See `aem-content-roots.example` for the full syntax (comments, absolute paths, multiple `@base` blocks).

### 1c-ter. Component exceptions — `examples/<your-tenant>/aem-component-exceptions`

Consumed by `aem-transform`. One `sling:resourceType` (or `apps/...` prefix) per line; matching nodes and their subtrees are skipped. Use this for decorative wrappers or AEM-only utilities that don't belong in Sanity.

### 1c-quater. Container components — `examples/<your-tenant>/aem-component-containers.json`

Consumed by both `migrate:schema` and `aem-transform`. Declares which components are AEM "containers" — ones whose children are dropped in via the page editor (cq:isContainer=true) rather than declared as a dialog multifield. Example:

```json
{
  "aem-integration/components/expander": { "childrenField": "items" },
  "aem-integration/components/container": { "childrenField": "items" },
  "aem-integration/components/column-layout": { "childrenField": "items" },
  "aem-integration/components/box": { "childrenField": "items" }
}
```

For each listed resource type:

- **Schema emission** appends a synthetic `defineField({ name: childrenField, title: "Items", type: "pageBuilder" })` to the component so the Studio palette inside the container matches the top-level page builder — every block type is droppable. The field is appended last so dialog-authored fields keep their declared order. Name collisions with dialog fields (same-name field already declared) leave the dialog field untouched and skip the synthetic append.
- **Content transform** walks the container's subtree — including `nt:unstructured` layout-only wrappers (AEM's responsive-grid pattern that wraps drop-zones in nodes carrying just a `layout` field, no `sling:resourceType`) — and emits each resource-type-bearing descendant as a pageBuilder block (same `_type` / `_key` / coercion pipeline as top-level blocks) under `childrenField`. Containers nest: an expander containing boxes containing content paragraphs all roundtrip. Children without `sling:resourceType` stay inline on the container (that's how multifields keep working).

**`flatten: true`** (optional, default `false`) — drops the container's own block at transform time and hoists its items into the parent's pageBuilder array. Use this for **pure layout containers** like AEM's responsive grid (`proxy/content/container`) where the wrapping component has no authored content of its own. Without `flatten`, deeply nested layouts (container-in-container-in-container, common in responsive-grid content) produce nested-block trees that can hit Sanity's hard **20-level attribute-depth limit** at import time. With `flatten`, every responsive-grid layer collapses and the actual content blocks end up at a sane depth. Containers with their own dialog fields you want preserved (accordions, expanders, named panels) should stay non-flatten.

```json
{
  "uxp/components/structure/page":          { "childrenField": "items" },
  "uxp/components/proxy/content/container": { "childrenField": "items", "flatten": true }
}
```

Missing file → container behavior stays off. Malformed JSON or invalid entries are a hard error (fail loudly rather than silently drop child content).

### 1c-quinquies. Authoring hints — `examples/<your-tenant>/aem-component-hints.json`

Consumed by both `migrate:schema` and `aem-transform`. Opts specific components into AEM authoring-hint lifting — JCR/CQ properties that carry meaningful content but live outside the dialog payload, like `cq:panelTitle` on accordion / expander panel children. Without this opt-in, the transform's normal property iterator drops anything with a colon and the value is lost.

```json
{
  "aem-integration/components/box":     ["cq:panelTitle"],
  "aem-integration/components/content": ["cq:panelTitle"]
}
```

Two layers, one source of truth each:

- **Rename vocabulary** (`AEM_AUTHORING_HINTS` in `packages/aem-to-sanity-core/src/aem/authoring-hints.ts`) — the migrator-wide map of AEM keys to canonical Sanity field names (`cq:panelTitle` → `panelTitle`). Stable across projects.
- **Per-project opt-in** (this file) — names which components apply which hints. Per-project, since which components act as accordion children depends on the AEM authoring conventions in that project.

For each listed resource type:

- **Schema emission** appends a `readOnly` `string` field per opted-in hint (translated through the rename vocabulary). Read-only because the value is preserved from AEM, not authored from the Studio. Components not listed in this file get no extra fields — the rest of the schema stays clean.
- **Content transform** consults the same map keyed by the current node's `sling:resourceType`. If the node is opted in and the property is in its allowlist, the value is renamed and emitted under the Sanity field name; otherwise colon-bearing keys drop as before. The drift report skips opted-in keys so they don't surface as "unknown props".

Missing file → no hint behavior on any component. Malformed JSON or invalid entries are a hard error.

### 1c-sexies. Tag roots — `examples/<your-tenant>/aem-tag-roots`

Consumed by `aem-tags`. Plain-text list of AEM tag namespaces (or subtrees) to walk under `/content/cq:tags/`. Same format as `aem-content-roots`:

```text
@base /content/cq:tags

promotion
page-type
/content/cq:tags/wknd     # absolute paths also OK
```

Only what's listed here is migrated. There is no canonical "always skip" set in AEM — sample-content namespaces like `wknd` or `we-retail` are simply absent from the file. Discovery tip: hit `<AEM_AUTHOR_URL>/content/cq:tags.1.json` while logged into AEM author to list every namespace under your tag root.

Missing file → `aem-tags` exits 2 with an instruction to create one. Migrations that don't use AEM taxonomy can skip the `tags` stage entirely (the rest of the pipeline doesn't depend on it; `aem-transform` runs without tag resolution and content with `cq:tags` surfaces as unresolved findings instead).

### 1d. Resource-type registry — `output/content-type-registry.json`

**Generated** by `migrate:schema`; you don't hand-author it. Maps AEM `sling:resourceType` values to the Sanity type names that stage 1 emitted, plus each field's name + Sanity type (used by the drift auditor and by `aem-transform` for type-aware coercion — e.g. HTML → Portable Text on `array-of-blocks` fields):

```json
{
  "__generated": "GENERATED by aem-to-sanity-schema. Remove this field (or delete the file) to take ownership; the next run will preserve your edits.",
  "entries": [
    {
      "resourceType": "aem-integration/components/promo",
      "sanityType": "promo",
      "fields": [
        { "name": "headline1", "type": "string" },
        { "name": "description", "type": "array-of-blocks" },
        { "name": "fileReference", "type": "image" }
      ]
    }
  ]
}
```

- `resourceType` — derived by stripping `/apps/` from each component path. Override via `jcrPrefix` on the programmatic API if your install uses a different prefix.
- `sanityType` — the emitted schema's `name`.
- `fields` — tree-shaped `Array<{name, type, itemFields?}>` covering every field the emitted schema declares. `array-of-object` fields carry their members under `itemFields` so the content transform can coerce AEM scalars into the right Sanity shape at any depth — HTML strings on `array-of-blocks` fields become Portable Text (via `@portabletext/block-tools`) whether they sit at the top level or inside a `variableColumn.columnContents[]` multifield row.

Legacy `fields: string[]` registry files are still accepted. The transform falls back to pass-through behavior on fields without type info, so old registries keep working but don't get the richtext coercion — regenerate to opt in.

**Taking ownership:** if your AEM content uses `sling:resourceSuperType` chains or unusual mappings, delete the `__generated` marker (or rewrite the file as a bare `[...]` array). The next `migrate:schema` run will preserve it and log that it skipped regeneration. The content CLI accepts both shapes.

Anything outside this registry is still extracted but tagged `_type: "aemUnmapped"` and flagged in the audit.

---

## 2. Stage 1 — emit Sanity schemas

```bash
pnpm --filter example-<your-tenant> migrate:schema
pnpm --filter example-<your-tenant> migrate:schema --verbose  # + per-request AEM GET logs
```

On start-up the CLI prints a banner summarizing what it's connecting to: AEM env, base URL, auth kind (basic shows the username only; bearer is shown as `len=N, prefix=abcd…` so you can confirm the right token is loaded without it leaking into logs), paths / roots files, output dir, concurrency. A Sanity preflight block follows with project id, dataset, and token presence — schema generation never calls Sanity, it's a config confirmation for the downstream content ingest.

| Flag / env | Effect |
| --- | --- |
| `--verbose` / `-v` or `AEM_VERBOSE=true` | Elevates the logger to `debug` level. Surfaces every `GET {url}` the AEM fetcher issues plus Sling `.N.json` depth-fallback retries. |
| `--continue-on-auth` or `AEM_CONTINUE_ON_AUTH=true` | Treat per-component 401/403 as per-path ACL skips and keep going, as long as at least one component succeeds. A circuit breaker still aborts on `N` consecutive auth failures with zero successes (signals credentials-wide failure, not ACL). |

**Outputs under `output/`:**

| Path | What it is |
| --- | --- |
| `schemas/*.ts` | One Sanity object type per AEM component, named `componentNameInCamelCase`. Each carries a `preview.prepare` that returns a guaranteed-non-empty title (AEM `jcr:title` → title-cased type name → raw type name fallback), so array/Page Builder rows never render as "Untitled" even before the row has any data. |
| `schemas/pageBuilder.ts` | Array type with every emitted block in `of: [...]`. Each member is emitted as `defineArrayMember({ type, title })` so the "+ Add" menu and row previews carry friendly labels. Regenerated each run. |
| `schemas/page.ts` | Minimal document type (`title`, `slug`, `pageBuilder`). Preserved if you hand-author it. |
| `schemas/index.ts` | Barrel exporting `allSchemaTypes` — plug straight into `defineConfig`. |
| `content-type-registry.json` | AEM `sling:resourceType` → Sanity type + field names, consumed by stage 3. Preserved if you hand-edit. |
| `aem/components/**/*.json` | Raw dialog snapshots — audit trail. |
| `migration-report.json` | Pass/fail per component (including the resolved `sanityTypeName` and friendly `schemaTitle`) + unmapped props inventory. |
| `audit/unmapped-examples.json` | Real-world examples per unmapped AEM type. Feed these back into `mapping-table.ts` when adding new mappings. |

Re-run any time — output is deterministic, so `git diff` shows only real changes. Each CLI appends an `Elapsed:` line to its summary (and `aem-assets` prints a `Per phase:` breakdown) so you can see where time is going across runs.

**Slot discovery runs automatically on every schema pass.** `migrate:schema` scans `output/cache/raw/*.json` — the output of `aem-extract` — for AEM components that nest other AEM components under a fixed JCR key (e.g. `media-paragraph`'s `content` child is itself an `aem-integration/components/content` block). Each discovered slot gets a synthetic `defineField({ name: slotKey, type: childTypeName })` on the parent schema so the Studio shows it as a typed inline field rather than flagging it as "Unknown field found". First-ever run has no `raw/` to scan yet (scan returns empty, no slot fields emitted); run `aem-extract` once and the next `migrate:schema` picks every slot up. The content transform always emits nested components under their JCR key regardless, so data never gets dropped on the first pass — the schema upgrade only clears Studio warnings. Skipped cases: dialog-field name collisions (dialog wins), container parents (their drop-zone logic claims all resourceType-carrying children already), multi-type slots (logged, hand-author if you need the field), and slots whose child type isn't yet in `aem-component-paths` (add it, re-run).

### Type-name resolution (reserved-name handling)

Component type names are resolved up front via `resolveSanityTypeNames` (in `aem-to-sanity-schema/naming.ts`). The base name is the camelCased tail after `components/`; if that collides with a Sanity built-in (`image`, `file`, `slug`, `text`, `string`, `number`, `block`, `object`, `array`, etc.) or with another path, it's prefixed with `aem` and — only if still colliding — suffixed with a numeric counter.

Example: `/apps/aem-integration/components/image` → `aemImage.ts` on disk, `aemImage` in `pageBuilder.of[]`, `"sanityType": "aemImage"` in the content registry, and `_type: "aemImage"` on every ingested document. Keeping all four artifacts aligned up front is what prevents ingested data from later appearing as "Untitled" + unknown-type warnings in the Studio.

The Studio-side `sanitizeSchemaTypes` still exists and runs the same rename as a defense-in-depth pass for hand-authored schemas, but for the emitter path it's a no-op.

### Dialog inheritance via `sling:resourceSuperType`

`migrate:schema` resolves each component's Granite UI dialog using the same chain-walking AEM does at request time:

1. Try the component's own `cq:dialog` (either embedded in the component node or fetched at `{componentPath}/_cq_dialog.infinity.json`).
2. On 404, read `sling:resourceSuperType` off the component itself. Absent → the component is genuinely dialogless and `migrate:schema` records a `failure` for it.
3. Resolve the supertype:
   - **Absolute** (`/apps/...`, `/libs/...`) — used as-is.
   - **Relative** (`<namespace>/components/...`) — AEM's lookup order is `/apps/<rt>` first (project + AMS overrides take precedence), `/libs/<rt>` second (Adobe defaults).
4. Recurse with the resolved path. A 10-hop cap and per-component cycle guard prevent runaway walks.

Why this matters in practice: **proxy components are the norm in AEMaaCS.** A site at `/apps/<site>/components/proxy/content/pageinfo` typically has no `cq:dialog` of its own — it extends a versioned base under `/apps/<site>/components/content/pageinfo/v1/pageinfo` (or, for Adobe-shipped components, something under `/libs`). Without chain resolution, those proxies fail with a 404 and the operator has to hand-list the supertype path in `aem-component-paths` — losing the proxy's identity in the process. With chain resolution, you list the proxy and the migrator finds the inherited dialog automatically.

The resolved chain is recorded in `migration-report.json` under each successful component's `supertypeChain` field (omitted for direct hits). Operators auditing emitted schemas can see exactly which ancestor supplied the dialog fields. Each run also logs an `info` line per inherited dialog:

```
[info] /apps/uxp/components/proxy/content/pageinfo: dialog inherited via supertype — chain /apps/uxp/components/proxy/content/pageinfo → /apps/uxp/components/content/pageinfo/v1/pageinfo
```

Important: **the registry key remains the original proxy path's resource type**, not the supertype's. Authored content has `sling:resourceType: uxp/components/proxy/content/pageinfo`, so that's what the registry needs as a lookup key. Two proxy components sharing one supertype produce two distinct Sanity types with identical field sets — they render identically in the Studio but each has its own `_type` so ingestion stays unambiguous.

You can verify a single component's dialog resolution before kicking off a full schema run with `scripts/aem-probe.ts`:

```bash
cd examples/<your-tenant>
pnpm exec tsx ../../scripts/aem-probe.ts /apps/<site>/components/proxy/foo
# → Prints the supertype chain + the dialog's top-level form fields.
```

The probe uses the same `resolveDialogViaSuperType` helper from `aem-to-sanity-core` that the migrator does, so the probe's output is exactly what the schema run will see.

### Registering new block types between migrations

If you hand-add a `schemas/myBlock.ts` without re-running the whole migration, refresh the page-builder registration with:

```bash
pnpm --filter example-<your-tenant> pagebuilder:refresh
# or
npx aem-to-sanity-pagebuilder --output-dir ./output --exclude xfPage
```

This rescans `schemas/`, rebuilds `pageBuilder.ts`, and refreshes `schemas/index.ts`. It preserves `page.ts` if you've removed the `GENERATED` marker comment.

---

## 3. Stage 2 — TypeGen

```bash
pnpm --filter example-<your-tenant> typegen
```

Produces `output/sanity.types.ts`. Runs in-process via tsx + `@sanity/schema` internals — **no network call**, no `sanity schema extract` required.

Consume it in a downstream Sanity client like:

```ts
import type { HeroBanner } from "./output/sanity.types";
const doc = await client.fetch<HeroBanner>(`*[_type == "heroBanner"][0]`);
```

---

## 4. Stage 3 — content migration

Stage 3 is five independent CLIs, run in order. The `migrate:content` pnpm script chains them (`extract && tags && transform && assets && import`), but you can run each step on its own — each reads from the output directory of the previous one, so re-running just one stage is cheap. `tags` is optional — skip it for migrations that don't use AEM taxonomy.

```bash
pnpm --filter example-<your-tenant> migrate:content
# equivalent to:
pnpm --filter example-<your-tenant> extract
pnpm --filter example-<your-tenant> tags         # optional — only when migrating AEM tags
pnpm --filter example-<your-tenant> transform
pnpm --filter example-<your-tenant> assets
pnpm --filter example-<your-tenant> import
```

**All writes to Sanity are dry-run unless `MIGRATION_DRY_RUN=false` is set.** The `extract`, `tags`, and `transform` stages are read/local-only regardless; only `assets` and `import` touch Sanity.

### 4a. `aem-extract` — AEM `.infinity.json` → `output/raw/`

Reads every entry in `aem-content-roots`, fetches `{root}.infinity.json` from AEM, and writes one JSON file per page to `output/raw/`. Transparently follows depth-5 truncation markers (AEM returns a string marker like `"...section_0": "...section_0"` at the depth boundary; the fetcher detects these plus suspiciously-empty nodes, issues follow-up fetches in parallel, and splices resolved subtrees back in).

| Flag / env | Effect |
| --- | --- |
| `--overwrite` | Re-fetch pages that already have a cached raw file. Default: skip. |
| `AEM_CONTENT_ROOTS_FILE` | Path to roots file. Default: `./aem-content-roots`. |
| `AEM_MAX_RESPONSE_MB` | Per-fetch payload cap. Oversized responses are recorded as `tooLarge` failures. |
| `AEM_MAX_DEPTH_EXPANSIONS` | How many rounds of depth-5 follow-up fetches to run per root. Default: 3. Raise only if a page is pathologically deep; leftover markers after the budget are replaced with `{__truncated: "maxDepth", jcrPath}` sentinels and the transform stage treats them as opaque. |
| `AEM_FIXTURES_DIR` | If set, reads captured AEM responses from this directory instead of issuing HTTP calls. Capture fixtures with `packages/aem-to-sanity-core/scripts/capture-fixtures.ts` — default output is `<cwd>/output/cache/fixtures/aem/`. Used by unit tests and CI; leave unset for live migrations. |

**Outputs:** `output/raw/*.json`, `output/extract-report.json` (counts, categorized failures, ambiguous-path resolutions, and a `depthExpansions` array with per-root `markersFound`/`markersResolved`/`markersTruncated`/`markersFailed`/`expansionsUsed` stats), and `output/extract-404.log` if any roots weren't found.

### 4a-bis. `aem-tags` — AEM `/content/cq:tags` → `output/cache/categories/`

Walks every namespace (or subtree) listed in `aem-tag-roots`, fetching each via `fetchInfinityTree` (same depth-5 follow-up splicing the page extractor uses), and emits one Sanity `category` document per `cq:Tag` node — implementing Sanity's [parent-child taxonomy pattern](https://www.sanity.io/docs/developer-guides/parent-child-taxonomy). The hand-authored `category` document type lives at `apps/studio/schemas/category.ts`.

ID derivation is deterministic on both sides — `aem-tags` and `aem-transform` compute the same Sanity `_id` from the same AEM tag id, without sharing state:

| AEM tag id | Sanity category `_id` |
| --- | --- |
| `promotion` (namespace) | `category-promotion` |
| `promotion:payout` | `category-promotion-payout` |
| `promotion:payout/recurring-device-credits` | `category-promotion-payout-recurring-device-credits` |
| `color/red` (default namespace, prefix dropped) | `category-color-red` |

Long ids (>80 chars) fall back to `{first-60-chars}-{sha1-10}` so they stay under Sanity's 128-char `_id` limit even for deep tag trees. Hyphen-separated (not `.`) so the docs stay readable via the public CDN — same rule as `pathToDocId`.

**Default-namespace asymmetry.** Adobe's reference syntax drops the `default:` prefix: a tag at `/content/cq:tags/default/color/red` is authored as `color/red`, not `default:color/red`. `aem-tags` records this in the manifest so `aem-transform` resolves both forms the same way.

**Namespaces are categories too.** A namespace in AEM is a `cq:Tag` whose parent is not a `cq:Tag` (i.e. direct child of `/content/cq:tags`). The walker emits a category doc for the namespace itself, since authors expect to see it in the Studio reference picker as a grouping. Namespaces have no `parent` reference.

**`cq:movedTo` aliases.** When a tag has been merged/moved in AEM, the tombstone node carries `cq:movedTo` pointing at the new tag id. The manifest records these as aliases (no category doc is emitted for the tombstone), and `aem-transform` follows the alias chain when resolving authored references. Cycle guard prevents pathological alias loops.

**Allowlist, not denylist.** Only namespaces listed in `aem-tag-roots` are walked. AEM sample-content namespaces like `wknd` or `we-retail` are simply absent — there's no canonical "always skip" set to ship.

| Flag / env | Effect |
| --- | --- |
| `--overwrite` | Re-emit category doc files even when they already exist on disk. The manifest is always rewritten. |
| `AEM_TAG_ROOTS_FILE` | Path to tag roots file. Default: `./aem-tag-roots`. |
| `AEM_MAX_RESPONSE_MB` / `AEM_MAX_DEPTH_EXPANSIONS` | Shared with `aem-extract` — same response cap and depth-splice budget. |

**Outputs:**
- `output/cache/categories/<sanityCategoryId>.json` — one Sanity category doc per `cq:Tag` node. Shape `{ jcrPath, docs: [categoryDoc] }` so `aem-import` ingests them via the same loader as pages.
- `output/cache/categories/manifest.json` — keyed by AEM tag id (`namespace:parent/child` or `parent/child` for default-namespace tags). Value: `{ sanityCategoryId, title, slug, parentTagId, isNamespace, movedTo? }`. Consumed by `aem-transform` to resolve `cq:tags` strings on pages and components.
- `output/cache/tags-report.json` — counts, failures, depth-splice stats, `aliases`, and `danglingParents` (tags whose parent namespace wasn't included in the listed roots).

### 4b. `aem-transform` — `output/raw/` → `output/clean/`

Walks each raw JCR tree, maps `sling:resourceType` values via `content-type-registry.json`, and emits one `page` doc per input file with a `pageBuilder` array of typed blocks. Each doc gets a deterministic `_id` (from JCR path) and each block a stable `_key` (from `jcr:uuid` or path SHA1). Unknown resource types and nodes listed in `aem-component-exceptions` are skipped but noted in the audit.

**Type-aware coercion.** AEM's JCR is schemaless on dialog inputs — every authored value lands in `.infinity.json` as a JSON string regardless of what the dialog widget was. The emitted Sanity schemas declare proper types (`number`, `boolean`, `array-of-blocks`), so without coercion the Studio rejects ingested values with "Expected type X, got String". Transform reads the registry's tree-shaped `fields` (`Array<{name, type, itemFields?}>`) and coerces at every depth — top-level fields *and* members inside nested `array-of-object` multifields (e.g. `variableColumn.columnContents[].columnText`):

- **`array-of-blocks`** — AEM `cq/gui/components/authoring/dialog/richtext` / Coral richtext values arrive as HTML strings. Converted to Portable Text via `@portabletext/block-tools` (with `jsdom` as the DOM). Decorators (`strong`, `em`, `underline`, `strike-through`, `code`), styles (`normal`, `h1`–`h4`, `blockquote`), lists (`bullet`, `number`), and `<a href>` annotations are preserved. `_key`s are derived from a SHA1 of `{jcrPath}::{fieldName}:{counter}` so re-runs produce byte-identical clean docs. On parser failure the original string is kept intact.
- **`number`** — coerced via `Number(v)`; kept as-is on `NaN`. AEM numberfield values land as `"10"` etc.
- **`boolean`** — coerced when the value is the literal string `"true"` or `"false"`; kept as-is otherwise. AEM checkbox values land as `"true"` / `"false"`.
- **`array-of-object`** — recurses into nested multifield items. Handles both AEM shapes: the ordered `item0`/`item1` form (materialized earlier in `transformInline`) and the named-key form (e.g. `colorCarousel.colors: { weddingDresses: {...}, bridesmaidDresses: {...} }`) — materialized here by taking `Object.values` of the keyed map in authored order.
- **`array-of-reference`** — AEM `cq/gui/components/coral/common/form/tagfield` values arrive as string arrays of canonical tag ids (`["promotion:payout/recurring-device-credits", "promotion:status/in-market"]`). Resolved through `output/cache/categories/manifest.json` (from `aem-tags`) into `[{_type:"reference", _key:..., _ref:"category-..."}]`. Follows `cq:movedTo` aliases. Page-level `cq:tags` on the `jcr:content` node are lifted onto the page doc's `tags` field via the same resolver. Tag ids not in the manifest get dropped and surfaced in `transform-report.json → unresolvedTagRefs` (operator either missed a namespace in `aem-tag-roots` or AEM has stale references to a deleted tag).

Legacy `content-type-registry.json` files without `fields[].type` skip every coercion step — regenerate via `pnpm migrate:schema` to opt in.

| Flag / env | Effect |
| --- | --- |
| `--registry <file>` | Override the default `./content-type-registry.json`. |
| `--include type1,type2` | Restrict to a comma-separated allow-list of `sling:resourceType` values. |
| `AEM_COMPONENT_EXCEPTIONS_FILE` | Path to exceptions file. Default: `./aem-component-exceptions`. |

**Outputs:** `output/clean/*.json` (one per page, containing the transformed doc) and `output/transform-report.json` (unknown resource types with hit counts, unknown props per component, transform bails — with first-N example paths per finding).

**Unmapped components, surfaced in the console.** At the end of each `aem-transform` run, any `sling:resourceType` that doesn't resolve to a Sanity type is printed directly to stderr as a ranked list — `<hits>× <resourceType>  /apps/<resourceType>`, plus one example JCR path per type. Those `/apps/...` lines are paste-ready for `aem-component-paths`; add them, re-run `migrate:schema` to emit schemas, then rerun `transform` + `import` to pick up the content that was dropped. The page root (`aem-integration/components/page`) and `wcm/foundation/components/responsivegrid` wrapper are hidden from this list — they're structural passthroughs the walker recurses through, not missing schemas. (They still appear in `transform-report.json` for completeness.)

### 4c. `aem-assets` — upload DAM → Media Library → link to dataset

> **Scope decision (@shehjadkhan 2026-04-22):** assets go to the Sanity **Media Library** (org-scoped), NOT the dataset's Content Lake. Each asset is uploaded once into the Media Library and then **linked** into the target dataset via the Global Document Reference (GDR) endpoint. The dataset holds a small linked asset document whose `_id` becomes the `asset._ref` inside content docs.

#### One-time: deploy the `aemSource` aspect

`aem-assets` stamps every uploaded asset with an `aemSource` aspect (`damPath` + cached `assetInstanceId`) so subsequent runs can dedup by origin JCR path instead of re-uploading. Deploy the aspect schema once per Media Library before the first live run:

```bash
pnpm --filter studio exec sanity media deploy-aspect aemSource
```

If this step is skipped, uploads still succeed — the stamp mutations fail gracefully (logged, not fatal) and the dedup pre-check in phase 0 returns no hits. Once deployed, running `aem-assets` once backfills the aspect on any prior-uploaded assets whose ids are still in the local manifest.

Scans `output/clean/` for `/content/dam/...` references, downloads each asset from AEM, and runs five phases:

0. **Dedup lookup + manifest staleness check** — GROQ `*[_type=="sanity.asset" && aspects.aemSource.damPath == $damPath][0]` against the Media Library. A hit populates the manifest with both ids so phases 1+2 skip that asset entirely — no re-download from AEM, no re-upload to ML. Same content reused across pages/runs links to the same ML asset. When the lookup misses but the manifest already claims an `mediaLibraryAssetId`, phase 0 verifies the asset doc still exists in the ML (separate ID-based query). If the ML says the doc is gone (e.g. `sanity media delete`, `wipe-media-library`), the stale `mediaLibraryAssetId` / `linkedAssetInstanceId` / `linkedRef` / `sanityRef` / `mediaRef` are cleared from the manifest, preserving only the local download cache. Phases 2-3 then re-upload + re-link for real instead of silently skipping on a dead id. Transport errors during the check (`unknown`) are treated conservatively — manifest state is preserved and the next healthy-network run re-verifies.
1. **Download** from AEM DAM → `output/assets/<flattened-path>` (on-disk cache, resumable).
2. **Upload** to Media Library — `POST https://api.sanity.io/v{apiVersion}/media-libraries/{mlId}/upload` returns `{asset: {_id}, assetInstance: {_id}}`. The parent `asset._id` is recorded as `mediaLibraryAssetId`; the versioned `assetInstance._id` as `linkedAssetInstanceId`. Immediately after a successful upload (or when skipping an already-uploaded entry whose aspect isn't set yet), the pipeline patches `aspects.aemSource = {damPath, assetInstanceId}` onto the parent via `POST /media-libraries/{mlId}/mutate`.
3. **Link** to dataset — `POST https://{projectId}.api.sanity.io/v{apiVersion}/assets/media-library-link/{dataset}` with body `{mediaLibraryId, assetInstanceId, assetId}`. Returns `{document: {_id, media: {_ref}, ...}}`. `document._id` is the dataset-local `_ref` that goes into content docs (Pattern A: `{_type:'image', asset:{_ref:'<linked-ref>'}}` — Studio-compatible).
4. **Rewrite** clean docs in place so every `/content/dam/...` string becomes the linked asset ref object.

Phases 0, 1, 2, and 3 all run with a work-stealing pool sized by `ASSET_CONCURRENCY` (default `4`). Phase 0's ML dedup pre-pass guarantees each DAM path is only handled by one worker in phases 1–3, so the shared `manifest` is never contended at the same key. The manifest file is written via synchronous `writeFileSync` + `JSON.stringify`, which are atomic relative to the single-threaded event loop — no lock needed as long as this stays sync. Output is logged in completion order (`{done}/{total}`) rather than start order, so progress tracks actual throughput.

Maintains `output/assets/manifest.json` — per-DAM-path record with `damPath → cachedFile → mediaLibraryAssetId → linkedAssetInstanceId → linkedRef`. Re-runs skip each phase that's already complete. Entry shape:

```ts
interface ManifestEntry {
  damPath: string;
  cachedFile?: string;             // local cache path
  mimeType?: string;
  fileSize?: number;
  mediaLibraryAssetId?: string;    // asset._id in the ML (parent sanity.asset doc)
  linkedAssetInstanceId?: string;  // assetInstance._id in the ML (versioned asset)
  linkedRef?: string;              // dataset-local ref — goes into asset._ref in docs
  mediaRef?: string;               // media-library:<mlId>:<assetId> — GDR reference
  sanityRef?: { _type: "image"|"file"; asset: { _type: "reference"; _ref: string } };
  status: "cached"|"downloaded"|"failed-download"|"uploaded"|"failed-upload"|"linked"|"failed-link"|"dry-run";
  error?: string;
  downloadedAt?: string; uploadedAt?: string; linkedAt?: string;
}
```

- **Dry-run default.** Without `MIGRATION_DRY_RUN=false`, assets are downloaded to local cache only — no Media Library API calls, no link calls, no doc rewrites.
- **Env vars:**
  - `SANITY_PROJECT_ID`, `SANITY_DATASET` — as before.
  - `SANITY_MEDIA_LIBRARY_ID` — **required** when not dry-running. Must be a Media Library in the same org as the project.
  - `SANITY_TOKEN` — used for phase 2 (upload). A project robot token historically worked here, but newer Media Library API versions reject project-scoped sessions with `401 SIO-401-ANF "Session not found"` on `/media-libraries/{mlId}/upload`. When that happens, swap in a personal auth token (the same kind § 4c-bis describes for the link phase). The token still needs write access on the project for the in-place doc rewrites in phase 4.
  - `SANITY_ML_LINK_TOKEN` — **required for phase 3 (link)** when `SANITY_TOKEN` is a project robot token. The `/assets/media-library-link` endpoint requires a *personal* authorization token with read/write on both the Media Library (org-level) and the project/dataset; a project-only robot token is rejected with `401 Invalid non-global session`. Falls back to `SANITY_TOKEN` if unset (works only if that token is already a personal/OAuth token). See § 4c-bis for how to generate one.
  - `SANITY_API_VERSION` — defaults to `2025-02-19`, which is when Media Library support landed.
- **Flags:**
  - `--upload-only` — skip phase 1 (download). Assumes the local cache already exists.
  - `--link-only` (or `MIGRATION_LINK_ONLY=true`) — skip phases 1 + 2 entirely. Phase 0's ML lookup resolves existing assets by `aemSource.damPath`; phases 3 + 4 run as normal. Dry-run + `--link-only` = preview of which DAM paths would be linked vs. missing from the ML. Mutually exclusive with `--upload-only`. Intended for re-runs against an ML that already holds the binaries (either from a prior pipeline run or stamped out-of-band). Any DAM path that phase 0 can't resolve stays in `/content/dam/*` form in clean docs and is listed in `output/assets-report.json → rewrite.unresolved`. Caveat: phase 0 keys on the `aemSource` aspect stamped by this pipeline on upload, so assets uploaded through the Studio UI without that aspect will not be found by DAM path.
  - `--no-rewrite` — skip phase 4 (in-place rewrite of `clean/*.json`).

Ordering contract: the link phase must complete before `aem-import` runs, because the clean docs only contain the linked `_ref` after phase 4. The `migrate:content` chain (`extract → transform → assets → import`) already enforces this.

### 4c-bis. Generating a personal Sanity auth token

The Sanity Media Library endpoints reject project-scoped robot tokens because they're tied to a non-global session (error code `SIO-401-ANF`, message `Session not found` / `Invalid non-global session`). They require a token tied to a **user account** with read/write access to both the Media Library (org-level) and the project/dataset. Two ways to mint one:

#### Option A — Sanity CLI (fastest)

```bash
# 1. Authenticate as your Sanity user (opens a browser).
sanity login

# 2. Print the resulting auth token.
sanity debug --secrets
```

Look for the `Authentication:` block in the output:

```
Authentication:
  Auth token: sk...redacted...
  User type:  normal
```

Copy the value after `Auth token:`. That token is tied to your user account, so it carries every grant you have — including org-level Media Library access. Paste it into `examples/<your-tenant>/.env` as `SANITY_ML_LINK_TOKEN=…` (and, if phase 2 is also failing with `SIO-401-ANF`, replace `SANITY_TOKEN` with the same value).

**Note:** the token in `sanity debug --secrets` is the live session token used by the CLI. Logging in again from another machine, running `sanity logout`, or rotating credentials in your Sanity account will invalidate it. For a stable token that survives CLI re-logins, use Option B.

#### Option B — Sanity user UI (stable, long-lived)

1. Go to https://www.sanity.io/manage and sign in as the same user.
2. Top-right user menu → **User settings** → **Personal access tokens**.
3. Click **Add API token**, give it a descriptive label (e.g. `aem-to-sanity migration — local`), and copy the generated token. You'll only see it once.
4. The token inherits your user's grants, so make sure your user has:
   - **Editor (or higher) on the destination project** — required for `aem-import` writes and phase-4 doc rewrites.
   - **Read/write on the org-level Media Library** — required for phases 2 + 3. If your user can browse the ML in sanity.io/manage and upload through the UI, this is already satisfied.

#### Sanity check before re-running

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $SANITY_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.sanity.io/v2025-02-19/media-libraries/$SANITY_MEDIA_LIBRARY_ID/query" \
  -d '{"query":"*[_type==\"sanity.asset\"][0]._id"}'
```

- `200` → token has Media Library access; if `aem-assets` still 401s, the issue is elsewhere (wrong `SANITY_MEDIA_LIBRARY_ID`, wrong org, etc.).
- `401` → token doesn't have Media Library access. Regenerate via Option A or check the user's grants per Option B.

After updating the token, re-run `pnpm assets`. Phase 0 picks up where you left off — already-uploaded assets in the manifest are reconciled against the ML by id, so no duplicate uploads.

### 4d. `aem-import` — `output/cache/categories/` + `output/clean/` → Sanity

Reads every file under `output/cache/categories/` (if present) and `output/clean/` and commits the docs via `@sanity/client` using `transaction().createOrReplace(doc).commit()`. Because `_id` values are derived from JCR paths (pages) and AEM tag ids (categories), re-runs upsert rather than duplicate.

**Categories commit first**, batched 50 docs per transaction. That ordering matters: pages may reference categories via `tags` or via tagfield-mapped component fields, and Sanity's strong-ref validation would reject those refs if the target docs didn't yet exist when the page commit lands. Batching of 50 keeps each transaction well under Sanity's payload cap on tenants with thousands of tags.

- **Dry-run default.** With `MIGRATION_DRY_RUN` unset or truthy, the command only prints what it *would* write.
- **Requires** `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_TOKEN` when writing.
- **Flags:**
  - `--discard-drafts` (or `MIGRATION_DISCARD_DRAFTS=true`) — delete `drafts.{id}` in the same transaction as each published `createOrReplace`. The Studio opens a draft whenever one exists, so without this flag a stale draft from a prior migration run keeps shadowing freshly-imported published data — you re-run `aem-import`, the terminal shows "Committed", and the Studio still shows the old content. Opt-in because it also destroys any authored in-progress edits; use it when re-running migrations against a dataset that only this pipeline writes to. Also applied to category docs.

### Depth-5 truncation — handled for you

AEM's `.infinity.json` truncates the tree at depth ~5, inserting path-string markers like `"/content/.../section_0": "/content/.../section_0"`. `aem-extract` detects these (and suspiciously-empty nodes at depth boundaries), issues follow-up fetches in parallel (concurrency 4 by default), and splices resolved subtrees back into the parent tree at the correct key. A cycle guard prevents re-fetching the same path twice within a root. Nothing to configure unless a page is pathologically deep — raise `AEM_MAX_DEPTH_EXPANSIONS` (default 3) or the `maxDepthExpansions` option on the programmatic `fetchInfinityTree` API in `aem-to-sanity-core`. Markers still present after the budget are replaced with `{__truncated: "maxDepth", jcrPath}` sentinels which the transform stage treats as opaque (no broken string-marker leaves ever reach the Sanity docs).

---

## 5. Orchestrated — one command for the full pipeline

```bash
pnpm --filter example-<your-tenant> migrate
```

Chains `extract` → `tags` → `migrate:schema` → `transform` → `assets` → `import --discard-drafts` in a single shell. Each stage's `Elapsed:` line surfaces as it runs, so timing breakdowns are visible without parsing logs after the fact. Use this for "blow away and re-run" workflows on datasets only the pipeline writes to — `--discard-drafts` is destructive of in-progress author edits.

More granular variants:

- `pnpm --filter example-<your-tenant> migrate:content` — content stages only, no `--discard-drafts`.
- `pnpm --filter example-<your-tenant> migrate:all` — schema + typegen only.

Or via Turbo with input-hash caching for the pure emit stages:

```bash
pnpm turbo run migrate:schema typegen migrate:content --filter=example-<your-tenant>
```

Turbo respects the ordering declared in `turbo.json`: schema → typegen → content. Network-dependent tasks are `"cache": false`; pure emit steps cache against input hashes.

---

## 6. Studio (visual verification)

```bash
pnpm --filter studio dev
# Opens http://localhost:3333 with every emitted schema loaded.
```

Or validate schema shape without booting the UI:

```bash
pnpm --filter studio exec sanity schema validate
# Expects: 0 errors, 0 warnings.
```

The studio's `schemas/index.ts` re-exports `allSchemaTypes` from `examples/<your-tenant>/output/schemas/index.ts`, and `sanity.config.ts` runs them through `sanitizeSchemaTypes` (from `aem-to-sanity-schema/sanitize`) at import time — it's a real consumer of the pipeline output, not a toy fixture. If you change the emitted schemas, `sanity schema validate` is the gate that catches breakage.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `AEM_AUTHOR_URL is required when AEM_ENV=author` | Either set the matching URL/creds, switch `AEM_ENV` to `publish`, or use `AEM_TOKEN`. |
| `Missing credentials. Set AEM_SERVICE_CREDENTIALS_FILE (AEMaaCS), AEM_TOKEN, or AEM_..._USERNAME and AEM_..._PASSWORD.` | No auth resolved for the active env. Pick one of the three flows in § 1a-bis. |
| `IMS OAuth Server-to-Server failed: HTTP 400 — invalid_client` | The Service Credentials JSON's client id / secret don't match what Adobe IMS has for that technical account. Re-download from Cloud Manager (Developer Console → Integrations → Service Credentials) — secrets rotate when you regenerate. |
| `IMS JWT exchange failed: HTTP 401` | The technical account was deleted, the metascopes don't include `ent_aem_cloud_api`, or the org id is wrong. Re-download Service Credentials from Cloud Manager. Adobe is also deprecating JWT — newly generated credentials will be OAuth Server-to-Server (the resolver picks the right flow automatically). |
| `AEM service credentials JSON is missing the fields needed for either flow` | Neither `SCOPES` (Server-to-Server) nor `privateKey + metascopes + technicalAccountId + org` (JWT) found. You likely pasted a half-edited file or a different Adobe integration's JSON. Re-export from Cloud Manager. |
| `401` or `403` on fetches | Creds valid but account lacks read access to the JCR paths. Verify in AEM's CRXDE — for AEMaaCS the technical account's product profile must include the right AEM environment + permissions. |
| `aem-import` prints `DRY RUN` and nothing lands in Sanity | That's the default. Export `MIGRATION_DRY_RUN=false` (also set `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_TOKEN`) and re-run. |
| `aem-import` → `Missing env var: SANITY_TOKEN` | You set `MIGRATION_DRY_RUN=false` but the write token isn't in the env. Source it into `examples/<your-tenant>/.env`. |
| `aem-assets` phase 2 → `HTTP 401 SIO-401-ANF "Session not found"` on every upload | The `/media-libraries/{mlId}/upload` endpoint rejected your `SANITY_TOKEN`. Newer Media Library API versions don't accept project robot tokens here. Replace `SANITY_TOKEN` (or just override for this run) with a **personal auth token** that has read/write on the Media Library. See § 4c-bis for how to generate one. Retries can't help — every request fails the same way. |
| `aem-assets` phase 3 → `401 Invalid non-global session for user id g-...` | The `/assets/media-library-link` endpoint rejected your `SANITY_TOKEN`. It requires a *personal* auth token, not a project robot token. Set `SANITY_ML_LINK_TOKEN` to a personal token with read/write on both the Media Library and the project. See § 4c-bis. |
| `aem-assets` phase 2 → `409 asset already exists` | Informational, not an error. The binary was already uploaded to the Media Library. The code recovers both IDs via a GROQ lookup and continues. |
| `aem-assets` → `Missing env var: SANITY_MEDIA_LIBRARY_ID` | Set it to the org-level ML id that the project belongs to. `sanity media library list` on the org shows available ids. |
| `aem-extract` fails with `HTTP 300` on a root | AEM returned an ambiguous-path response (the path may point at a folder). Check `output/extract-report.json` → `ambiguous[]` for the resolution suggestion. |
| `aem-transform` → `No raw files in output/raw` | Run `aem-extract` first. The transform stage only reads from disk — it never hits AEM. |
| Studio boots but shows no schemas | `output/schemas/index.ts` is missing or stale. Run `pnpm --filter example-<your-tenant> migrate:schema`. |
| `sanity schema validate` → `Type has property "fields", but is not an object/document type` | The sanitizer is injecting placeholder fields into a non-object type. Confirm you're on the latest schema package (this is fixed). |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` when running sanity CLI | Rebuild: `pnpm build`. The bundled CJS loader the Sanity CLI uses needs the `default` export condition that `dist/` ships. |
| Depth-5 follow-ups never fire on a deep page | Make sure you're calling `aem-extract`, not hitting `.infinity.json` manually. Raise `maxDepthExpansions` if you have pages > 6 follow-up rounds deep. |

---

## 8. What's **not** automated yet

- **`pathfield` → Sanity `reference`** — AEM path fields stay as strings. Resolving them to document references is still a follow-up.
- **Custom page document types** — the generator writes one generic `page` doc. Hand-author `landingPage` / `productPage` types in `output/schemas/` (or a separate authored directory you merge into `allSchemaTypes`); the generator won't touch files missing the `GENERATED` marker.
- **CI publish** — `changeset publish` is wired but not yet triggered from GitHub Actions.
