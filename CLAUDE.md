# CLAUDE.md

Project-level guidance for AI assistants (Claude Code, and any compatible tool) working in this repo. Auto-loaded into context for every session.

## Keep docs refreshed as we go

Every user-facing change must update its documentation in the same commit. Drifting docs hide real changes from operators and break the "read the docs, run the pipeline" flow.

**Doc surface to scan on every user-facing change:**
- `README.md` (root) — high-level overview.
- `packages/*/README.md` — per-package surface (flags, env vars, phases, outputs).
- `docs/run.md` — short operator's runbook.
- `docs/running-the-migration.md` — exhaustive operator's guide (env vars table, per-stage flag tables, troubleshooting).
- `docs/overview.md` — architecture + layout.
- `docs/aem-to-sanity-mapping.md` — **auto-generated** by `packages/aem-to-sanity-schema/src/docs.ts`. Do not edit by hand; regenerate.
- `examples/tenant/.env.example` — must list every env var a CLI reads. `examples/tenant/` is the **committed template**; operator working copies live at `examples/<their-tenant>/` and are gitignored.

**Triggers:**
- **New CLI flag** → update the package README + the stage section in `docs/running-the-migration.md` + the short summary in `docs/run.md` + `.env.example` if there's a matching env var.
- **New env var** → update the env-vars table in `docs/running-the-migration.md` § 1a + `.env.example`.
- **Emitter / mapper behavior change** → update `packages/aem-to-sanity-schema/src/docs.ts` (prose that lands in the generated mapping doc) + regenerate `docs/aem-to-sanity-mapping.md`.
- **Pipeline phase / output shape change** → update the "Outputs" subsections in `docs/running-the-migration.md` § 2 and § 4, and `docs/run.md`.
- **Mapping table change** (`packages/aem-to-sanity-schema/src/mapping-table.ts`) → rerun `pnpm migrate:schema` so `docs/aem-to-sanity-mapping.md` regenerates from the source of truth. `writeMappingDocs` can also be called standalone from the schema package's `dist/index.js` (no AEM round-trip needed).
- **Container config shape change** (`packages/aem-to-sanity-core/src/config/containers.ts` or `aem-component-containers.json` fields) → update the "Container components" section in `packages/aem-to-sanity-schema/src/docs.ts`, regenerate `docs/aem-to-sanity-mapping.md`, and mirror in `docs/running-the-migration.md` § 1c-quater + content package README.
- **Slot discovery shape change** (`packages/aem-to-sanity-schema/src/slots.ts` behavior, `slot-reference` field emission rules) → update the "Named slots (auto-discovered)" section in `packages/aem-to-sanity-schema/src/docs.ts`, regenerate the mapping doc, and mirror in `docs/running-the-migration.md` § 2 + content package README.

**Anti-patterns:**
- Don't duplicate content between the generated mapping doc and hand-authored docs. The generated file is the source of truth for field-level mapping; hand-authored docs describe architecture, phases, env vars, flags.
- Don't describe internals the operator can't touch — focus on observable behavior from the CLI.
- Don't add a changelog section to READMEs; use git history + Changesets.

## Regenerating artifacts

The pipeline emits many artifacts into `output/cache/` and `apps/studio/schemas/generated/`. These are regenerable; never hand-edit.

- `output/cache/content-type-registry.json` — written by `migrate:schema`. Shape: `entries: Array<{resourceType, sanityType, fields: Array<{name, type}>}>`. Legacy `fields: string[]` still loads but disables type-aware coercion (notably HTML → Portable Text).
- `apps/studio/schemas/generated/*.ts` — written by `migrate:schema`. Each file carries a `// Generated from AEM component: …` banner. **Gitignored by default** (see `.gitignore`); each operator regenerates locally. Only `generated/index.ts` is tracked as a stub so the Studio boots on bare clone before any migration has run. Single-tenant projects that want the schemas source-controlled should comment out the `apps/studio/schemas/generated/` line in `.gitignore` and `git add` the regenerated files after `migrate:schema`.
- `output/cache/raw/*.json` — written by `aem-extract`.
- `output/cache/clean/*.json` — written by `aem-transform`, mutated in place by `aem-assets` phase 4 (DAM-path → asset ref rewrite).
- `output/cache/categories/*.json` + `manifest.json` — written by `aem-tags`. One Sanity `category` doc per AEM `cq:Tag` node (parent-child taxonomy), plus a manifest keyed by AEM tag id that `aem-transform` consults when resolving authored `cq:tags` references.
- `output/cache/assets/manifest.json` — per-DAM-path state; drives `aem-assets` resumability.

When you change how any artifact is generated, **re-run the relevant stage against whichever local tenant folder you have set up** — don't just typecheck. Operator tenant folders (`examples/davids-bridal/`, `examples/<your-tenant>/`, etc.) are gitignored, so on a fresh clone there's nothing to run against — copy `examples/tenant/` first and fill in real credentials. Prefer `--link-only` on `aem-assets` for re-runs — it skips AEM downloads and ML uploads.

## Document ID generation

`pathToDocId` in `packages/aem-to-sanity-content/src/transform.ts` derives each Sanity doc `_id` from the JCR path. Two operator knobs:

- **`MIGRATION_DOC_ID_PREFIX_STRIP`** — comma-separated list of path prefixes to remove before generating the id. The intent is to drop the AEM site/locale rootpage (e.g. `/content/uxp/us/en`) so ids stay short and page-relative. Longest match wins when prefixes overlap. Unset → full path goes into the id.
- **Separator is `-`** (hyphen), not `.`. Sanity treats any `_id` containing `.` as a **private** doc — readable only with an auth token. Hyphenated ids work over the public CDN, which matters for read-only frontends that don't ship a token. Studio reads always carry auth, so dotted ids would work there too — but hyphens are the safe default.

Idempotency hazard: **changing `MIGRATION_DOC_ID_PREFIX_STRIP` between runs reshapes every id and orphans previously imported docs.** Set it once at the start of a migration and leave it alone. If you must change it on a live dataset, run an `unpublishDocuments` pass against the old id space first.

Long paths (>80 chars after sanitization) fall back to `{first-60-chars}-{sha1-10}` so ids stay under Sanity's 128-char limit without collisions.

## Type-name resolution (reserved names)

`/apps/.../image` would collide with Sanity's built-in `image` type. `resolveSanityTypeNames` (in `packages/aem-to-sanity-schema/src/naming.ts`) applies an `aem` prefix at emission time so the on-disk schema, the content registry, `pageBuilder.of[]`, and ingested document `_type` values all agree — no Studio-side rename, no orphaned content. Don't reintroduce per-import renames in `sanitize.ts`; it's a defense-in-depth pass for hand-authored schemas only.

## Dialog resolution via `sling:resourceSuperType`

`migrate:schema` walks the `sling:resourceSuperType` chain when a listed component has no `cq:dialog` of its own — same lookup AEM runs at request time. Logic lives in `packages/aem-to-sanity-core/src/aem/dialog-resolution.ts` (`resolveDialogViaSuperType`); the schema migrator (`api.ts:processOne`) and the audit step (`audit.ts`) both call it, and so does the standalone `scripts/aem-probe.ts` so what the probe shows is exactly what the migrator will see.

Chain: try `{path}/_cq_dialog` → on 404, read `sling:resourceSuperType` from the component, resolve `/apps/<rt>` then `/libs/<rt>` for relative supertypes (absolutes used as-is), recurse with cycle guard + 10-hop cap. Successful runs record the chain in `migration-report.json → results[].supertypeChain` (omitted for direct hits) and log an info line per inherited component. **The registry key remains the original proxy path's resource type** — authored content references the proxy at ingest time, not the supertype that supplied the dialog. Two proxies sharing one supertype produce two distinct Sanity types with identical fields; this is intentional, not a duplicate.

## Type-aware coercion at transform

AEM's JCR is schemaless on dialog inputs — `.infinity.json` serializes every authored value as a **JSON string** regardless of what the dialog widget was (numberfield → `"10"`, checkbox → `"true"` / `"false"`, richtext → HTML string). The emitted Sanity schemas declare proper types, so without coercion the Studio rejects every ingested value with "Expected type X, got String".

`content-type-registry.json` records each field's Sanity type as a **tree** (`fields: Array<{name, type, itemFields?}>`). `aem-transform` reads those types and coerces at every depth:

- **`array-of-blocks`** → Portable Text via `@portabletext/block-tools` + `jsdom`. Decorators / styles / lists / `link` annotations preserved. `_key`s SHA1-seeded for deterministic diffs.
- **`number`** → `Number(v)`; kept as-is on `NaN`.
- **`boolean`** → `"true"` / `"false"` literal strings only.
- **`array-of-object`** → recurses into each item using the field's `itemFields` subtree, so nested richtext / number / boolean (e.g. `variableColumn.columnContents[].columnText`) are coerced the same as top-level fields. If the AEM value is a plain object instead of an array (named-key multifield — e.g. `colorCarousel.colors: { weddingDresses: {...}, ... }`), `Object.values` materializes it in authored order before recursing. The same principle applies to `splitAemFileUploadDamPaths`: nested field names are collected from the registry tree so `{base}AemPath` moves work at any depth.

**Dialog-runtime metadata.** AEM writes bookkeeping sidecars next to authored fields (e.g. `textIsRich: "true"` beside richtext values). These have no Sanity counterpart and would surface as "Unknown field found" warnings if not dropped. Maintained as a narrow allowlist (`AEM_DIALOG_RUNTIME_KEYS` in `transform.ts`) — add new leaks there as they appear; never substitute a blanket heuristic.

**When adding a new coerced type:**
1. Extend `coerceScalarFields` (or `coerceRichTextFields` if shape-heavy) in `packages/aem-to-sanity-content/src/transform.ts`.
2. Keep the **keep-original-on-failure** contract. Unrecognized values should surface as Studio validation errors, not silent data loss.
3. Document it in the generated mapping doc — add prose under the "Type-aware coercion at transform" section in `packages/aem-to-sanity-schema/src/docs.ts`, then regenerate `docs/aem-to-sanity-mapping.md`.
4. Update the mirror blurbs in `packages/aem-to-sanity-content/README.md`, `docs/running-the-migration.md` § 4b, and `docs/run.md` § 4b.

If the issue is actually a wrong Sanity type (not a coercion gap), fix it at the schema emitter layer — check that the dialog's `sling:resourceType` is mapped correctly in `packages/aem-to-sanity-schema/src/mapping-table.ts`. Don't paper over schema-layer bugs with per-field coercion in the transform.

## aem-assets parallelism

Phases 0–3 of `aem-assets` run with a work-stealing pool sized by `ASSET_CONCURRENCY` (default `4`). Safety invariants — preserve these when touching that code:

1. **Phase 0 is the dedup gate.** It populates the manifest for every DAM path already in the ML before any other phase touches it. Phases 1–3 skip entries that phase 0 already resolved, so the same DAM path is never processed twice across workers.
2. **Each damPath is owned by exactly one worker at a time.** The pool hands each list index out once; there is no fan-out per item. So mutations to `manifest[damPath]` and `aspectStamped.add(damPath)` from different workers always target distinct keys — no lock needed.
3. **Manifest persistence stays synchronous.** `writeFileSync` + `JSON.stringify` are atomic relative to the single-threaded event loop. If this is ever moved to async `writeFile`, a serial lock (or in-memory batching with a single write at the end of the phase) becomes mandatory — otherwise interleaved writes will corrupt the file.
4. **Don't skip the dedup pass.** Running phases 1–3 in parallel without phase 0 would re-download / re-upload duplicate DAM paths and race on the same manifest keys. Phase 0 must stay enabled whenever concurrency > 1.
5. **Phase 0 also validates the manifest.** When the aspect lookup misses but the manifest claims an `mediaLibraryAssetId`, phase 0 verifies the doc still exists in the ML by id. If missing → clear the stale linkage (preserve local download cache) so phases 2-3 re-upload for real. Without this, a wiped ML leaves the manifest claiming uploads that were never redone; phases 2-3 short-circuit their "already uploaded / already linked" branches and the run reports success while writing nothing. Transport errors (`unknown`) are treated as "keep state" — the next healthy run re-verifies. Never trust just the local manifest; trust ML as source of truth and reconcile.

## Drafts shadow imports

The Studio edits `drafts.{id}` whenever one exists. `aem-import` by default only writes the published `{id}`, so a stale draft keeps shadowing fresh migration output — the operator sees old content after a "successful" re-import and gets confused. For migration re-runs, pass `--discard-drafts` (or set `MIGRATION_DISCARD_DRAFTS=true`). When diagnosing "I re-ran the import and nothing changed in the Studio", check for a shadowing draft first.

## Storefront preview (apps/web)

A Vite + React 19 app lives at `apps/web/` that reads the migrated home doc from Sanity and renders its pageBuilder through a set of block primitives styled per `docs/DESIGN.md` (the "Ethereal Atelier" system). Use it to eyeball the output of a migration run end-to-end — `pnpm -F web dev` → http://localhost:4321. Env plumbing falls back to the first non-template tenant folder under `examples/` that has a `.env` (so the demo tracks whichever migration destination you have configured locally).

Design tokens live in `apps/web/src/styles.css` under a Tailwind v4 `@theme` block. Block renderers are one-per-`_type` under `apps/web/src/blocks/`, wired through a switch-based dispatcher in `blocks/index.tsx`; unknown `_type`s fall through to a visible `UnknownBlock` placeholder so missing primitives surface immediately instead of rendering as blank space. When adding a new block type to the schema side, drop a primitive into this dispatcher in the same change so the preview stays usable.

## Running verification

After code changes that affect the pipeline output:

```bash
# 1. Rebuild so dist/ reflects source changes (Node runs from dist/)
pnpm -r build

# 2. Full schema + content run against your local tenant folder
cd examples/<your-tenant>             # e.g. examples/davids-bridal, examples/acme
pnpm migrate:schema
pnpm extract
pnpm transform
pnpm assets -- --link-only     # skip AEM + ML if assets already migrated
pnpm import

# 3. Inspect
pnpm --filter studio exec sanity schema validate   # catches schema drift
pnpm --filter studio dev                           # http://localhost:3333
```

Typecheck + tests also need to pass:

```bash
pnpm -r typecheck
pnpm -r test
```

## Commit discipline

- Small, focused commits. One logical change per commit.
- Commit messages follow the style in `git log` (conventional-ish: `feat(content):`, `fix(schema):`, `chore:`, etc.).
- Regenerated docs (`docs/aem-to-sanity-mapping.md`) can be committed alongside the source change that produced them — makes the diff reviewable end-to-end.
- Never commit `output/` artifacts (raw/, clean/, categories/, assets/) — these are local caches, gitignored by default.
- `apps/studio/schemas/generated/*` is **gitignored by default** — each operator regenerates from their own AEM via `pnpm migrate:schema`, so committing them creates merge conflicts between tenants and surfaces one customer's component vocabulary in another's repo. The `generated/index.ts` stub stays tracked so the Studio boots + typechecks on a bare clone. Single-tenant repos that want the schemas under source control should comment out the `apps/studio/schemas/generated/` line in `.gitignore` and `git add` the regenerated files explicitly.
