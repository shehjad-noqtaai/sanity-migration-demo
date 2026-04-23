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
- `examples/davids-bridal/.env.example` — must list every env var a CLI reads.

**Triggers:**
- **New CLI flag** → update the package README + the stage section in `docs/running-the-migration.md` + the short summary in `docs/run.md` + `.env.example` if there's a matching env var.
- **New env var** → update the env-vars table in `docs/running-the-migration.md` § 1a + `.env.example`.
- **Emitter / mapper behavior change** → update `packages/aem-to-sanity-schema/src/docs.ts` (prose that lands in the generated mapping doc) + regenerate `docs/aem-to-sanity-mapping.md`.
- **Pipeline phase / output shape change** → update the "Outputs" subsections in `docs/running-the-migration.md` § 2 and § 4, and `docs/run.md`.
- **Mapping table change** (`packages/aem-to-sanity-schema/src/mapping-table.ts`) → rerun `pnpm migrate:schema` so `docs/aem-to-sanity-mapping.md` regenerates from the source of truth. `writeMappingDocs` can also be called standalone from the schema package's `dist/index.js` (no AEM round-trip needed).

**Anti-patterns:**
- Don't duplicate content between the generated mapping doc and hand-authored docs. The generated file is the source of truth for field-level mapping; hand-authored docs describe architecture, phases, env vars, flags.
- Don't describe internals the operator can't touch — focus on observable behavior from the CLI.
- Don't add a changelog section to READMEs; use git history + Changesets.

## Regenerating artifacts

The pipeline emits many artifacts into `output/cache/` and `apps/studio/schemas/generated/`. These are regenerable; never hand-edit.

- `output/cache/content-type-registry.json` — written by `migrate:schema`. Shape: `entries: Array<{resourceType, sanityType, fields: Array<{name, type}>}>`. Legacy `fields: string[]` still loads but disables type-aware coercion (notably HTML → Portable Text).
- `apps/studio/schemas/generated/*.ts` — written by `migrate:schema`. Each file carries a `// Generated from AEM component: …` banner.
- `output/cache/raw/*.json` — written by `aem-extract`.
- `output/cache/clean/*.json` — written by `aem-transform`, mutated in place by `aem-assets` phase 4 (DAM-path → asset ref rewrite).
- `output/cache/assets/manifest.json` — per-DAM-path state; drives `aem-assets` resumability.

When you change how any artifact is generated, **re-run the relevant stage against `examples/davids-bridal/` to verify** — don't just typecheck. The example has `MIGRATION_DRY_RUN=false` configured, so schema + transform runs are free; assets and import writes go to a real dataset (`rolz99xh` / `production`). Prefer `--link-only` on `aem-assets` for re-runs — it skips AEM downloads and ML uploads.

## Type-name resolution (reserved names)

`/apps/.../image` would collide with Sanity's built-in `image` type. `resolveSanityTypeNames` (in `packages/aem-to-sanity-schema/src/naming.ts`) applies an `aem` prefix at emission time so the on-disk schema, the content registry, `pageBuilder.of[]`, and ingested document `_type` values all agree — no Studio-side rename, no orphaned content. Don't reintroduce per-import renames in `sanitize.ts`; it's a defense-in-depth pass for hand-authored schemas only.

## Type-aware coercion at transform

AEM's JCR is schemaless on dialog inputs — `.infinity.json` serializes every authored value as a **JSON string** regardless of what the dialog widget was (numberfield → `"10"`, checkbox → `"true"` / `"false"`, richtext → HTML string). The emitted Sanity schemas declare proper types, so without coercion the Studio rejects every ingested value with "Expected type X, got String".

`content-type-registry.json` records each field's Sanity type as a **tree** (`fields: Array<{name, type, itemFields?}>`). `aem-transform` reads those types and coerces at every depth:

- **`array-of-blocks`** → Portable Text via `@portabletext/block-tools` + `jsdom`. Decorators / styles / lists / `link` annotations preserved. `_key`s SHA1-seeded for deterministic diffs.
- **`number`** → `Number(v)`; kept as-is on `NaN`.
- **`boolean`** → `"true"` / `"false"` literal strings only.
- **`array-of-object`** → recurses into each item using the field's `itemFields` subtree, so nested richtext / number / boolean (e.g. `variableColumn.columnContents[].columnText`) are coerced the same as top-level fields. If the AEM value is a plain object instead of an array (named-key multifield — e.g. `colorCarousel.colors: { weddingDresses: {...}, ... }`), `Object.values` materializes it in authored order before recursing. The same principle applies to `splitAemFileUploadDamPaths`: nested field names are collected from the registry tree so `{base}AemPath` moves work at any depth.

**When adding a new coerced type:**
1. Extend `coerceScalarFields` (or `coerceRichTextFields` if shape-heavy) in `packages/aem-to-sanity-content/src/transform.ts`.
2. Keep the **keep-original-on-failure** contract. Unrecognized values should surface as Studio validation errors, not silent data loss.
3. Document it in the generated mapping doc — add prose under the "Type-aware coercion at transform" section in `packages/aem-to-sanity-schema/src/docs.ts`, then regenerate `docs/aem-to-sanity-mapping.md`.
4. Update the mirror blurbs in `packages/aem-to-sanity-content/README.md`, `docs/running-the-migration.md` § 4b, and `docs/run.md` § 4b.

If the issue is actually a wrong Sanity type (not a coercion gap), fix it at the schema emitter layer — check that the dialog's `sling:resourceType` is mapped correctly in `packages/aem-to-sanity-schema/src/mapping-table.ts`. Don't paper over schema-layer bugs with per-field coercion in the transform.

## Running verification

After code changes that affect the pipeline output:

```bash
# 1. Rebuild so dist/ reflects source changes (Node runs from dist/)
pnpm -r build

# 2. Full schema + content run on the reference example
cd examples/davids-bridal
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
- Generated artifacts (`apps/studio/schemas/generated/*`, regenerated `content-type-registry.json`, regenerated docs) can be committed alongside the source change that produced them — makes the diff reviewable end-to-end.
- Never commit `output/` artifacts that are local caches (raw/, clean/, assets/). Emitted *schema* files under `apps/studio/schemas/generated/` are different — those ship with the Studio.
