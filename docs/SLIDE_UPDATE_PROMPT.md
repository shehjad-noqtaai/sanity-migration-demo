# Update prompt for the aem-to-sanity slide deck

Use this prompt verbatim with Claude Design. **Keep the existing visual style, layout, fonts, colors, and slide structure exactly the same — only the content listed below changes.** Do not redesign anything.

---

## Context

The slide deck `docs/aem-to-sanity-standalone (1).html` was generated against an older version of the codebase. Several command examples and pipeline descriptions are now inaccurate. This update fixes them to match the current monorepo (`aem-to-sanity` Turborepo with `apps/`, `packages/`, `examples/davids-bridal/`).

**Hard rule:** preserve every aspect of the existing design — layout grid, deck-stage dimensions, typography (Waldenburg, JetBrains Mono, etc.), color tokens, eyebrows, dividers, footer styling, all of it. Edit only the text content described below.

---

## Slide 1 — "Migration pipeline"

**Subtitle.** Replace:

> Five automated steps, plus the one that stays human.

with:

> Five automated steps (schema first, then content), plus the one that stays human.

**Step 02 — "Schema generation" — replace the description (`step-how`).**

Old:

> Reads each component's `_cq_dialog.infinity.json`, walks the Granite UI tree, and emits one Sanity object type per component plus a `pageBuilder` array and a `page` document type.

New:

> Reads each component's `_cq_dialog.infinity.json`, walks the Granite UI tree, auto-discovers named-slot children and `cq:isContainer` drop-zones from extracted content, and emits one Sanity object type per component plus a `pageBuilder` array and a `page` document type. Per-project hints (`aem-component-hints.json`) opt selected components into AEM authoring metadata like `cq:panelTitle`.

**Step 04 — "Asset handling" — replace the description.**

Old:

> `aem-assets` downloads each `/content/dam/...` reference, uploads it to the Sanity Media Library, and rewrites the docs to point at the new asset refs. Re-runs skip anything already uploaded.

New:

> `aem-assets` runs in five phases: ML dedup (skip what's already there), download from AEM, upload to the Sanity Media Library, link into the dataset, and rewrite the clean docs to point at the new asset refs. Phases 0–3 run in a work-stealing pool sized by `ASSET_CONCURRENCY` (default 4). A local manifest makes re-runs cheap; pass `--link-only` to skip download + upload entirely.

**Step 05 — "Import" — replace the description.**

Old:

> `aem-import` uses `@sanity/client` with `createOrReplace`, so re-runs upsert instead of duplicating. Dry-run is the default — real writes are an explicit opt-in.

New:

> `aem-import` uses `@sanity/client` with `createOrReplace`, so re-runs upsert instead of duplicating. Dry-run is the default — real writes are an explicit opt-in via `MIGRATION_DRY_RUN=false`. For migration re-runs pass `--discard-drafts` (or `MIGRATION_DISCARD_DRAFTS=true`) so stale `drafts.{id}` documents don't shadow the freshly-imported content in the Studio.

---

## Slide 2 — "Asset migration deep dive"

**Section 02 — "Mechanism" — append one sentence about the manifest.**

After "The link is what lets your Studio show the image even though the file itself isn't stored in the dataset.", append:

> The whole flow is driven by a local manifest at `output/cache/assets/manifest.json` — phase 0 reconciles it against the live Media Library on every run, so a wiped ML triggers a re-upload instead of silently leaving stale links.

**Footnote.** Replace:

> Media Library is a Sanity Enterprise feature. The link step needs a personal auth token, not a project robot token.

with:

> Media Library is a Sanity Enterprise feature. The link step needs a personal auth token (the org-scoped Media Library API isn't reachable with a project robot token). Asset uploads go through the Sanity client; configuration is the same `SANITY_TOKEN` used elsewhere.

---

## Slide 3 — "Operating modes"

No structural changes, but **revise these mode descriptions**:

**Mode 04 · Chained — "The full chain" — replace `mode-what`.**

Old:

> A single command runs all four content steps in order — extract, transform, assets, import — with the same dry-run safety in place.

New:

> A single command runs the four content steps in order — extract, transform, assets, import — with the same dry-run safety in place. Run after `migrate:schema` has produced the content-type registry; otherwise the transform stage has nothing to coerce against.

**Mode 05 · Orchestrated — "Whole pipeline, one command" — replace `mode-what`.**

Old:

> Turbo orchestrates schema generation, type generation, and content migration together, in the right order, only re-running what changed.

New:

> Turbo runs schema generation, TypeScript-type generation, and the four content stages together. Root-level pnpm scripts (`migrate:schema`, `typegen`, `migrate:content`) all go through Turbo, so caching and dependency order are automatic.

---

## Slide 4 — "How to run each mode" (the most-changed slide)

This slide has a header, a "First time only" setup row, and a `cmd-table` with seven `cmd-row`s. **Keep all the row structure, classes, and styling — only update the command text inside `<pre class="cmd-code">` blocks and the relevant `cmd-hint`s.**

### Setup row — keep as is

```
pnpm install
pnpm build
```

(unchanged)

### Row 1 — Dry run · default

`cmd-hint`: keep "Practice runs and stakeholder previews."

`cmd-code` — replace from:

```
pnpm --filter your-app migrate:content
```

to:

```
pnpm migrate:schema
pnpm migrate:content
```

### Row 2 — Real write

`cmd-hint`: keep "The actual migration. Sets the opt-in flag inline."

`cmd-code` — replace from:

```
MIGRATION_DRY_RUN=false \
  pnpm --filter your-app migrate:content
```

to:

```
pnpm migrate:schema
MIGRATION_DRY_RUN=false \
  pnpm migrate:content
```

(Schema generation only writes local files, so it doesn't need the dry-run flag. The flag attaches to the content stage where the real Sanity writes happen.)

### Row 3 — One step at a time

`cmd-hint`: keep "Iterate on a single stage without re-running the others."

`cmd-code` — replace from:

```
pnpm --filter your-app extract
pnpm --filter your-app transform
pnpm --filter your-app assets
pnpm --filter your-app import
```

to:

```
pnpm --filter your-app migrate:schema
pnpm --filter your-app extract
pnpm --filter your-app transform
pnpm --filter your-app assets
pnpm --filter your-app import
```

### Row 4 — The full chain

`cmd-hint` — replace from "Extract → transform → assets → import, in order." to:

> Extract → schema → transform → assets → import, in order. Adds `--discard-drafts` so re-imports show fresh content instead of stale drafts.

`cmd-code` — replace from:

```
pnpm --filter your-app migrate:content
```

to:

```
pnpm --filter your-app migrate
```

(The example package's `migrate` script chains all five stages and discards drafts. Don't confuse with `migrate:content`, which is content-only.)

### Row 5 — Whole pipeline, one command

`cmd-hint`: keep "Schema + types + content together, with caching."

`cmd-code` — replace from:

```
pnpm turbo run migrate:schema typegen migrate:content \
  --filter=your-app
```

to:

```
pnpm turbo migrate:schema typegen migrate:content
```

(Turbo v2 — `turbo run` is the legacy form; bare `turbo <task...>` is current. Root scripts already filter via Turbo's task graph; explicit `--filter=` is only needed for scoping to a subset of workspaces.)

### Row 6 — Offline / fixtures mode

Unchanged:

```
AEM_FIXTURES_DIR=./fixtures/aem \
  pnpm --filter your-app extract
```

### Row 7 — Open the Studio (bonus row)

Unchanged:

```
pnpm --filter studio dev
```

### Footer — replace

Old:

> All commands run from the repo root. Real writes need SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_TOKEN in the env.

New:

> All commands run from the repo root. Real writes need `SANITY_PROJECT_ID`, `SANITY_DATASET`, and `SANITY_TOKEN`, plus AEM credentials (`AEM_BASE_URL` + token or basic-auth user/pass). Re-import re-runs: set `MIGRATION_DISCARD_DRAFTS=true`. Asset re-runs without re-uploading: pass `--link-only` to the assets stage.

(Render the env-var names in the same `<code>` style already used elsewhere on the slide.)

---

## Where `your-app` should appear in examples

Keep the `your-app` placeholder consistent across rows — it's the user's package name (matching `name` in their workspace `package.json`). In the David's Bridal example repo it's `example-davids-bridal`, but the slide is generic; use `your-app` everywhere.

## What NOT to change

- Slide order, slide titles, eyebrows, frame chrome, corner mark, page numbering.
- Color tokens, typography, dividers, spacing.
- The "Source → Action → Destination" diagram on Slide 2.
- The first-time setup row on Slide 4.
- Slide 1 step ordering (01 Export, 02 Schema, 03 Transform, 04 Assets, 05 Import, 06 Frontend rebuild).

## Slide 5 — NEW — "Reading the run: logs & audit"

Add a new `<section data-label="05 Logs & audit">` after Slide 4. **Reuse the existing `mode-card` grid layout from Slide 3** (same wrapper `modes-grid`, same `mode-card` shape: icon + `mode-num` + `mode-name` + `mode-what` + `mode-best`). That keeps it visually identical to Slide 3 — same fonts, same spacing, same chrome. Six cards, two rows of three.

**Header:**

- Eyebrow: `Run output`
- Title: `Reading the run — logs & audit`
- Subtitle: `Every stage drops a deterministic JSON report next to its output. Reports tell you what got migrated, what got skipped, and what to fix before the next run.`

**Card 01 — `extract-report.json`**

- `mode-num`: `Stage 01 · Extract`
- `mode-name`: `output/cache/extract-report.json`
- `mode-what`: `Per content root: HTTP status, depth-truncations followed, response sizes. The summary line on stdout — Downloaded / Skipped / Failed — comes from this report. Use Failed > 0 to find auth or rate-limit issues without re-running.`
- `mode-best`: `Best for:` `Diagnosing partial extracts.`

**Card 02 — `migration-report.json`**

- `mode-num`: `Stage 02 · Schema`
- `mode-name`: `output/cache/migration-report.json`
- `mode-what`: `One row per AEM component: emitted Sanity type name, output file, every renamed field, every unmapped Granite UI widget kind, plus a final Unmapped AEM types section listing widgets seen in dialogs but not in the mapping table. Hand-extend mapping-table.ts when these appear.`
- `mode-best`: `Best for:` `Closing the loop on schema coverage.`

**Card 03 — `transform-report.json` + `audit/`**

- `mode-num`: `Stage 03 · Transform`
- `mode-name`: `output/cache/transform-report.json + audit/`
- `mode-what`: `Pages, blocks, and findings: unknown _types, drift props (fields the registry doesn't declare), depth-bail markers, structural passthroughs. The audit/ directory carries deeper drift snapshots so re-runs can diff against them. Findings don't fail the run — they hand you the action list.`
- `mode-best`: `Best for:` `Finding components missing from aem-component-paths.`

**Card 04 — `assets-report.json` + manifest**

- `mode-num`: `Stage 04 · Assets`
- `mode-name`: `output/cache/assets/manifest.json`
- `mode-what`: `Per-DAM-path state: status (uploaded / linked / failed), assetId, mediaLibraryAssetId, last-checked timestamp. The manifest is the source of truth for re-runs — phase 0 reconciles it against the live Media Library on every run, so a wiped ML triggers a re-upload instead of leaving stale links.`
- `mode-best`: `Best for:` `Resuming after partial asset failures.`

**Card 05 — Import stdout**

- `mode-num`: `Stage 05 · Import`
- `mode-name`: `import summary on stdout`
- `mode-what`: `Pages × docs committed, drafts discarded, elapsed. No JSON report — the Sanity client returns transactionally, so a non-zero exit code means nothing landed. Pair with the Studio Vision tool to spot-check counts (count(*) per _type).`
- `mode-best`: `Best for:` `Confirming the write actually happened.`

**Card 06 — Generated artifacts**

- `mode-num`: `Stage 06 · Outputs`
- `mode-name`: `apps/studio/schemas/generated/* + content-type-registry.json`
- `mode-what`: `Every emitted Sanity object schema lands in apps/studio/schemas/generated/, banner-tagged "DO NOT EDIT BY HAND". The registry pairs each Sanity type with its declared field shape and is what the transform reads for type-aware coercion. Both regenerate from source on every migrate:schema run.`
- `mode-best`: `Best for:` `Diffing schema drift across migration runs.`

**Footer:**

> Reports are JSON (machine-readable) plus a one-paragraph stdout summary. Findings model is intentionally a list of actions, not a pass/fail — every stage finishes when its inputs are exhausted, regardless of unmapped components.

---

## Slide 6 — NEW — "Inside the package: code, errors, contracts"

Add a new `<section data-label="06 Implementation">` after Slide 5. **Reuse the `step-card` grid layout from Slide 1** so it pairs visually with the pipeline overview — same numbered head, body text, and "what / how" structure.

**Header:**

- Eyebrow: `Implementation`
- Title: `Inside the package`
- Subtitle: `How the codebase is laid out, how it handles failure, and the contracts each stage holds.`

**Step-card 01 — Package layout**

- `step-num`: `01 · Layout`
- `step-name`: `Four packages, sharp boundaries`
- `step-how`:

> Three runtime packages plus a Studio app and a preview app:
>
> - `aem-to-sanity-core` — shared logger, AEM fetcher (bearer + basic auth, fixture-mode override), config loaders, fs helpers. No business logic.
> - `aem-to-sanity-schema` — dialog walker → `SanityField` mapper → emitter → content registry → page-builder synthesizer → typegen. Self-contained.
> - `aem-to-sanity-content` — four CLIs: `aem-extract`, `aem-transform`, `aem-assets`, `aem-import`. Pipeline-style — each reads disk, writes disk.
> - `apps/studio` — generated schemas land under `schemas/generated/`. `apps/web` — Vite preview that renders migrated pages from Sanity, one block primitive per `_type`.

**Step-card 02 — Error handling**

- `step-num`: `02 · Errors`
- `step-name`: `Loud on misconfig, soft on content drift`
- `step-how`:

> Two different failure modes, surfaced differently:
>
> - **Hard fail** — malformed JSON in `aem-component-paths` / `aem-component-containers.json` / `aem-component-hints.json`, missing required env, schema validation errors on a fetched dialog. Fails fast so a typo doesn't silently disable behavior.
> - **Soft fail / audit finding** — unmapped `sling:resourceType`, unknown widget kind, drift prop on an authored component, depth-bail on truncated AEM trees. Recorded in the run report and carried through transform via `__truncated` markers; never aborts the pipeline.
> - **Auth circuit breaker** — `migrate:schema` aborts after N (default 5) consecutive 401/403s with zero successes — signals credential-wide failure, not per-path ACL. `--continue-on-auth` flips it to "skip and keep going" for ACL-mixed projects.

**Step-card 03 — Concurrency model**

- `step-num`: `03 · Parallelism`
- `step-name`: `Work-stealing pools, per-key ownership`
- `step-how`:

> AEM fetches in `migrate:schema` and `aem-extract` run in parallel via a configurable pool (`CONCURRENCY`, default 4). Asset migration is sized separately (`ASSET_CONCURRENCY`, default 4) and runs five phases:
>
> Phase 0 (ML dedup) is the gate — it resolves every DAM path that's already in the Media Library before phases 1–3 touch anything, so each `damPath` is owned by exactly one worker for the rest of the run. The shared manifest is written via synchronous `writeFileSync` + atomic `JSON.stringify`, no locks needed. Phase 4 (rewrite clean docs) runs single-threaded after the upload/link phases settle.

**Step-card 04 — Determinism contract**

- `step-num`: `04 · Determinism`
- `step-name`: `Re-runs converge, never duplicate`
- `step-how`:

> Every output has a content-derived identity:
>
> - Document `_id`s are derived from JCR paths via a stable hash; re-running the import upserts the same docs.
> - `_key`s on inline objects are SHA1-seeded from JCR UUIDs (or path fallback) so Portable Text and array members keep stable keys across runs — the diff in Studio matches what actually changed.
> - Asset references go through the manifest. Same image, same upload-once.
> - Schema files emit deterministic prettier-formatted output; the registry's field order is stable.

**Step-card 05 — Type-aware coercion**

- `step-num`: `05 · Coercion`
- `step-name`: `Transform reads the registry`
- `step-how`:

> AEM serializes every dialog value as a JSON string — `"true"` for booleans, `"10"` for numbers, raw HTML for richtext. The transform consults the per-component field-type tree in `content-type-registry.json` and coerces at every depth:
>
> - `array-of-blocks` → Portable Text via `@portabletext/block-tools` + `jsdom` (preserves decorators, lists, link annotations).
> - `number` / `boolean` → parsed; values that fail to coerce are left in place so the Studio surfaces a validation error instead of silently dropping content.
> - Nested array-of-object items recurse through their `itemFields` subtree, so multifield-inside-multifield richtext still becomes Portable Text.

**Step-card 06 — Resumability & idempotence**

- `step-num`: `06 · Resumability`
- `step-name`: `Pick up where the run left off`
- `step-how`:

> Each stage reads its inputs from disk and writes its outputs to disk. Re-running any stage is safe; chaining is just `&&`. Phase 0 of the assets stage validates manifest entries against the Media Library and clears stale linkage so a wiped ML doesn't poison the next run. The schema package's auth circuit breaker, the content package's `--include` filter, and the asset package's `--link-only` flag give the operator three different escape hatches for partial-rerun scenarios.

**Footer:**

> Tested via per-package `pnpm test` and `pnpm typecheck` (Turbo-orchestrated). The reference example at `examples/davids-bridal/` is the integration suite — every migration-shape change is verified end-to-end against a real production AEM instance before merging.

---

## Slide 7 — NEW — "Architecture: where everything lives"

Add a new `<section data-label="07 Architecture">` after Slide 6. **This slide is diagram-dominant — keep prose to a minimum.** The reader should be able to read the whole architecture in 10 seconds by following the arrows.

**Reuse the SVG arrow style from Slide 2** (the `flow-arrow` shape with `<path d="M2 7h48"></path><path d="M44 2l8 5-8 5"></path>`). Keep all typography, colors, and chrome consistent with the other slides.

### Header

- Eyebrow: `Architecture`
- Title: `Where everything lives`
- Subtitle: `Three zones, five flows. Local cache is the contract — every external boundary writes through it.`

### Diagram

A three-column layout. Each column is a zone box with a label at the top and 2–4 small artifact cards stacked inside. Arrows connect specific cards across zones (not the whole boxes). Arrows are labeled with the **stage name** that produces the flow.

#### Zone 1 — AEM (left column)

- Zone label: `AEM` · sublabel: `source of truth`
- Artifact card: `Author` · annotation: `/apps/* dialogs · /content/* page trees`
- Artifact card: `DAM` · annotation: `/content/dam/* binaries`

#### Zone 2 — Local cache (middle column)

- Zone label: `Local cache` · sublabel: `output/`
- Artifact card: `output/cache/aem/*` · annotation: `component dialogs`
- Artifact card: `output/cache/raw/*` · annotation: `page trees`
- Artifact card: `output/cache/clean/*` · annotation: `Sanity-shaped JSON`
- Artifact card: `content-type-registry.json` · annotation: `field types per component`
- Artifact card: `apps/studio/schemas/generated/*` · annotation: `defineType() per component`
- Artifact card: `output/cache/assets/manifest.json` · annotation: `per-DAM-path upload state`

#### Zone 3 — Sanity (right column)

- Zone label: `Sanity` · sublabel: `org + project`
- Artifact card: `Media Library` · annotation: `org-scoped, asset binaries`
- Artifact card: `Dataset` · annotation: `project-scoped, drafts + published`
- Artifact card: `Studio` · annotation: `apps/studio reads generated schemas`
- Artifact card: `Web preview` · annotation: `apps/web queries dataset`

### Arrows (5 flows, each labeled)

Render each flow as a small arrow with the **stage name** on the label and a one-phrase description below. Arrows in this exact set:

1. **Author → `output/cache/aem/*` and `output/cache/raw/*`**
   - Stage: `aem-extract` + dialog fetch in `migrate:schema`
   - Caption: `download .infinity.json + dialog trees`

2. **`output/cache/aem/*` → `content-type-registry.json` + `apps/studio/schemas/generated/*`**
   - Stage: `migrate:schema`
   - Caption: `dialog walker → defineType() + registry`

3. **`output/cache/raw/*` + `content-type-registry.json` → `output/cache/clean/*`**
   - Stage: `aem-transform`
   - Caption: `coerce values, link slot children`

4. **`output/cache/clean/*` + DAM → Media Library + `manifest.json`** (this arrow forks: clean docs go to Sanity, DAM binaries go to Sanity ML, manifest stays local)
   - Stage: `aem-assets`
   - Caption: `upload once, link per dataset`

5. **`output/cache/clean/*` → Dataset**
   - Stage: `aem-import`
   - Caption: `createOrReplace, optional --discard-drafts`

### Two extra connectors (smaller, dashed style if available)

- **`apps/studio/schemas/generated/*` → Studio** (Studio reads local files at boot)
  - Caption: `loaded by Sanity build`
- **Dataset → Web preview**
  - Caption: `GROQ queries`

### Footer

> Read along the arrows: AEM is the source, the local cache is the staging area where every transformation happens, Sanity is the destination. Re-runs converge because each artifact's identity is content-derived (JCR path → `_id`, JCR UUID → `_key`, DAM path → manifest key).

### Hard constraints for this slide

- **No bullet lists, no paragraphs.** Just zone boxes, artifact cards, and labeled arrows.
- **Arrows must be labeled with both the stage name and a 3–6-word caption.** No labels on arrow heads.
- **Three columns must be roughly equal width.** Cards in the middle column are smaller and stacked; outer columns have fewer, larger cards.
- **Color the arrows by stage** if the design system has accent colors — same color reused on Slide 4's matching command row would tie the two slides together.
- **Keep the corner-mark + eyebrow + title + subtitle structure** identical to the other six slides; only the body region changes shape.

---

## Verification checklist

After applying the edits:

1. Open `aem-to-sanity-standalone (1).html` in a browser — every slide renders without script errors.
2. Slide 4 shows two-line dry-run and three-line real-write commands.
3. Slide 4 row 4 calls `pnpm --filter your-app migrate` (not `migrate:content`).
4. Slide 4 row 5 calls `pnpm turbo migrate:schema typegen migrate:content` (no `run`, no `--filter=`).
5. Slide 4 footer mentions AEM credentials, `MIGRATION_DISCARD_DRAFTS`, and `--link-only`.
6. Slide 1 step 02 mentions named-slot auto-discovery, container drop-zones, and `aem-component-hints.json`.
7. Subtitle on Slide 1 reads "Five automated steps (schema first, then content)".
8. Slide 5 (new) uses the same `mode-card` layout as Slide 3 — six cards in two rows of three.
9. Slide 6 (new) uses the same `step-card` layout as Slide 1 — six numbered cards.
10. Both new slides have the same corner-mark, eyebrow, title, subtitle, and footer chrome as the existing four slides.
11. Slide labels in the deck-stage are sequential: `01 Pipeline`, `02 Asset migration`, `03 Run modes`, `04 Commands`, `05 Logs & audit`, `06 Implementation`, `07 Architecture`.
12. Slide 7 (new architecture diagram) reuses Slide 2's SVG arrow style (`flow-arrow`) and has three labeled zones (AEM · Local cache · Sanity) connected by five labeled arrows — no bullet lists, no paragraphs in the body.
