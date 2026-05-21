# Update prompt for the aem-to-sanity slide deck

Use this prompt verbatim with Claude Design (or any designer applying the edits). **Keep the existing visual style, layout, typography (Waldenburg, JetBrains Mono, Helvetica Neue, etc.), color tokens, dividers, footer styling, slide chrome, and the corner-mark / eyebrow / title / subtitle structure exactly the same — only the content and slide labels listed below change.** Do not redesign anything.

---

## Target file

`docs/aem-to-sanity-standalone.html` (single-file standalone deck, ~2.4 MB).

**File-shape note for the executor:** the slide markup lives inside JavaScript-escaped string literals, which means:
- Quotes inside slide HTML appear as `\"`, not `"`.
- Forward slashes in closing tags appear as `/`, so `</h1>` is written `</h1>`.
- A stray unescaped `"` or `/` will break deck rendering silently. Diff every edit against the original before saving.

If editing by hand is too risky, the alternative is to regenerate the deck from this prompt against the current `docs/overview.md` + `docs/running-the-migration.md`. Either way, the **content** specified below is the source of truth.

---

## Why this update exists

The deck (last revised May 5) is behind the current `main` branch on three things:

1. The deck reads as a "pipeline" walkthrough rather than a **migration** walkthrough — the `<title>` tag and slide 1 framing both lead with "pipeline" / "How aem-to-sanity works," not the actual job (moving content from AEM into Sanity).
2. Several shipped features aren't reflected: **per-template Sanity document types** (`aem-page-components.json` → `pageProperties` + `cqTemplate`) and the **`aem-tags` stage** (parent-child taxonomy migration as a distinct content step).
3. Slide 7 (Architecture — three-zone diagram) was specced in the prior update brief but never added.

This prompt covers all four updates.

---

## Section A — Retitle the deck + reframe slide 1 around "migration"

### A1. `<title>` tag

Replace:

```html
<title>aem-to-sanity — pipeline</title>
```

with:

```html
<title>aem-to-sanity — AEM → Sanity content migration</title>
```

### A2. Slide 1 — title

The current slide 1 title is:

```
How aem-to-sanity works
```

(rendered as `<h1 class="title">How <span style="font-family: var(--font-mono); ...">aem-to-sanity</span> works</h1>`).

Replace with:

```
Migrate AEM into Sanity
```

(rendered as `<h1 class="title">Migrate <span style="font-family: var(--font-mono); ...">aem-to-sanity</span> end-to-end</h1>` — keep the same inline `<span>` styling for the monospace `aem-to-sanity` lockup; just change the surrounding text.)

### A3. Slide 1 — subtitle

Replace:

> Five automated steps (schema first, then content), plus the one that stays human.

with:

> A content migration toolkit. Schemas first, content second — automated end-to-end, deterministic across runs, dry-run by default. The one step that stays human is the frontend rebuild at the end.

### A4. Slide 1 — eyebrow (above the title)

If the current eyebrow reads `Pipeline` or similar, replace it with:

> Migration overview

(Match the existing eyebrow casing — uppercase letterspacing if that's the existing convention.)

### A5. Slide 1 — deck-stage section label

Update the `data-label` on the slide 1 `<section>` from `01 Pipeline` to:

```
01 Migration overview
```

(Leave the other section labels as-is for now — see Section C for the tags-step change to the rest of the deck.)

---

## Section B — Add per-template page documents to the pipeline overview

Per-template document types (declared in `examples/<tenant>/aem-page-components.json`) became a first-class feature in commit `72bc8d9 feat(pages): emit per-template Sanity docs for AEM page-shell components`, with auto-discovery added in `4e61656`. The deck doesn't mention them at all.

### B1. Slide 1, Step 02 — Schema generation

Replace the `step-how` body for Step 02 with:

> Reads each component's `_cq_dialog.infinity.json`, walks the Granite UI tree (including `sling:resourceSuperType` chains so proxy components inherit dialogs automatically), auto-discovers named-slot children and `cq:isContainer` drop-zones from extracted content, and emits one Sanity object type per AEM component. Page-shell components declared in `aem-page-components.json` become **per-template Sanity document types** (one doc type per `cq:template`), with the page-shell dialog lifted into a `pageProperties` field. Per-project hints (`aem-component-hints.json`) opt selected components into AEM authoring metadata like `cq:panelTitle`. Outputs: a `pageBuilder` array, a fallback `page` doc type, and one document type per declared template.

### B2. Slide 1 — pipeline diagram annotation (if present)

If the slide 1 visual includes labels for the emitted artifacts ("Studio schemas", "sanity.types.ts", etc.), add a small chip / annotation under "Studio schemas" reading:

> + per-template document types

Style identical to existing chips. If there's no chip layer, skip this — the body copy in B1 already carries the information.

### B3. Slide 6, Card 04 — Determinism contract (per-template page docs touch this)

In the existing card 04 body, after the sentence about deterministic `_id`s, append:

> Pages whose `jcr:content` matches a declared `(resourceType, cq:template)` pair are emitted as the matching per-template document type — first-time imports that flip a page's `_type` from generic `page` to a per-template doc require `--recreate-on-type-change` since Sanity treats `_type` as immutable.

(Same paragraph styling as the surrounding text. No new card needed.)

---

## Section C — Promote `aem-tags` to a distinct pipeline step

The deck currently shows the content chain as `extract → transform → assets → import` (4 steps). It needs to become `extract → tags → transform → assets → import` (5 content steps) with `tags` marked **optional** — `aem-tags` shipped in commit `64eb6ef feat(tags): migrate AEM cq:tags as parent-child Sanity category taxonomy`.

### C1. Slide 1 — step grid

Slide 1's six step-cards are currently:

```
01 Export · 02 Schema generation · 03 Data transform · 04 Asset handling · 05 Import · 06 Frontend rebuild (Manual)
```

Restructure to **seven** cards:

```
01 Export · 02 Schema generation · 03 Tags · 04 Data transform · 05 Asset handling · 06 Import · 07 Frontend rebuild (Manual)
```

**New Step 03 — Tags** (insert between current 02 and 03):

- `step-num`: `Step 03 · Optional`
- `step-name`: `Tags`
- `step-how`:

> `aem-tags` walks `/content/cq:tags/<namespace>/…` for each namespace listed in `aem-tag-roots`, and emits one Sanity `category` document per `cq:Tag` node — the parent-child taxonomy pattern. Page-level `cq:tags` references are resolved at transform time. Skip this step entirely if your migration doesn't use AEM taxonomy.

Renumber the cards that follow:
- Old Step 03 (Data transform) → Step 04
- Old Step 04 (Asset handling) → Step 05
- Old Step 05 (Import) → Step 06
- Old Step 06 (Frontend rebuild · Manual) → Step 07

Keep `step-num` formatting consistent. The "· Manual" suffix stays on the final card only.

### C2. Slide 1 — subtitle alignment

Update the count in the subtitle (set in Section A3):

> A content migration toolkit. Schemas first, content second — **six automated steps** (one optional), plus the human frontend rebuild at the end. Deterministic across runs, dry-run by default.

### C3. Slide 3 — operating modes

Mode 04 ("Chained — The full chain") currently reads:

> A single command runs the four content steps in order — extract, transform, assets, import — with the same dry-run safety in place. Run after `migrate:schema` has produced the content-type registry; otherwise the transform stage has nothing to coerce against.

Replace with:

> A single command runs the content stages in order — extract, then tags (optional), then transform, assets, import — with the same dry-run safety in place. Run after `migrate:schema` has produced the content-type registry; otherwise the transform stage has nothing to coerce against.

### C4. Slide 4 — commands

Wherever the deck currently shows the content sub-stages as four commands (look for the "One step at a time" row, `cmd-code` block listing extract/transform/assets/import), insert a `tags` line between `extract` and `transform`:

```
pnpm --filter example-<tenant> migrate:schema
pnpm --filter example-<tenant> extract
pnpm --filter example-<tenant> tags         # optional — only when migrating AEM tags
pnpm --filter example-<tenant> transform
pnpm --filter example-<tenant> assets
pnpm --filter example-<tenant> import
```

Apply the same insertion to any other row on slide 4 that lists the content chain.

### C5. Slide 5 — reports

Add a new short card (or extend an existing card) between Card 01 (extract-report) and Card 02 (migration-report) — actual position depends on the existing grid layout — for the tags report:

- `mode-num`: `Stage 02 · Tags (optional)`
- `mode-name`: `output/cache/tags-report.json + categories/manifest.json`
- `mode-what`: `Per-namespace walk stats, depth-splice counts, `cq:movedTo` aliases the walker followed, dangling-parent warnings. The `categories/manifest.json` is consumed by `aem-transform` to resolve authored `cq:tags` strings into `_type:"reference"` arrays.`
- `mode-best`: `Best for: confirming taxonomy resolution before transform.`

Renumber the cards that follow to keep the `Stage XX · …` numbering monotonic (Schema → Stage 03, Transform → Stage 04, Assets → Stage 05, etc.).

---

## Section D — Add slide 7 (Architecture)

Add a new `<section data-label="08 Architecture">` (number `08` because Section C bumps the step count). **This slide is diagram-dominant — keep prose to a minimum.** The reader should be able to read the whole architecture in 10 seconds by following the arrows.

**Reuse the SVG arrow style from slide 2** (the `flow-arrow` shape with `<path d="M2 7h48"></path><path d="M44 2l8 5-8 5"></path>`). Keep all typography, colors, and chrome consistent with the other slides.

### Header

- Eyebrow: `Architecture`
- Title: `Where everything lives`
- Subtitle: `Three zones, five flows. Local cache is the contract — every external boundary writes through it.`

### Diagram layout

Three columns. Each column is a zone box with a label at the top and 2–6 small artifact cards stacked inside. Arrows connect specific cards across zones (not the whole boxes). Each arrow is labeled with the **stage name** that produces the flow plus a 3–6-word caption.

#### Zone 1 — AEM (left column)

- Zone label: `AEM` · sublabel: `source of truth`
- Card: `Author` · annotation: `/apps/* dialogs · /content/* page trees`
- Card: `Tag tree` · annotation: `/content/cq:tags/* namespaces`
- Card: `DAM` · annotation: `/content/dam/* binaries`

#### Zone 2 — Local cache (middle column)

- Zone label: `Local cache` · sublabel: `examples/<tenant>/output/`
- Card: `output/cache/aem/*` · annotation: `component dialogs`
- Card: `output/cache/raw/*` · annotation: `page trees`
- Card: `output/cache/categories/*` · annotation: `taxonomy docs + manifest`
- Card: `output/cache/clean/*` · annotation: `Sanity-shaped JSON`
- Card: `content-type-registry.json` · annotation: `field types per component`
- Card: `apps/studio/schemas/generated/*` · annotation: `defineType() per component + per-template doc types`
- Card: `output/cache/assets/manifest.json` · annotation: `per-DAM-path upload state`

#### Zone 3 — Sanity (right column)

- Zone label: `Sanity` · sublabel: `org + project`
- Card: `Media Library` · annotation: `org-scoped, asset binaries`
- Card: `Dataset` · annotation: `project-scoped, drafts + published, categories + per-template docs`
- Card: `Studio` · annotation: `apps/studio reads generated schemas`
- Card: `Web preview` · annotation: `apps/web queries dataset`

### Arrows (six flows)

Render each as a small arrow with the **stage name** above and a one-phrase caption below. Color the arrows by stage if the design system has accent colors.

1. **Author → `output/cache/aem/*` and `output/cache/raw/*`**
   - Stage: `aem-extract` + dialog fetch in `migrate:schema`
   - Caption: `download .infinity.json + dialog trees`

2. **Tag tree → `output/cache/categories/*`**
   - Stage: `aem-tags`
   - Caption: `walk `cq:Tag` nodes, emit category docs`

3. **`output/cache/aem/*` → `content-type-registry.json` + `apps/studio/schemas/generated/*`**
   - Stage: `migrate:schema`
   - Caption: `dialog walker → defineType() + registry + per-template docs`

4. **`output/cache/raw/*` + `content-type-registry.json` + `categories/manifest.json` → `output/cache/clean/*`**
   - Stage: `aem-transform`
   - Caption: `coerce values, resolve tag refs, link slot children`

5. **`output/cache/clean/*` + DAM → Media Library + `manifest.json`** (this arrow forks: clean docs go to Sanity, DAM binaries go to Sanity ML, manifest stays local)
   - Stage: `aem-assets`
   - Caption: `upload once, link per dataset`

6. **`output/cache/clean/*` + `output/cache/categories/*` → Dataset**
   - Stage: `aem-import`
   - Caption: `categories first, pages second, `createOrReplace`, optional `--discard-drafts``

### Two extra connectors (smaller, dashed style if the design system supports it)

- **`apps/studio/schemas/generated/*` → Studio** — caption: `loaded by Sanity build`
- **Dataset → Web preview** — caption: `GROQ queries`

### Footer

> Read along the arrows: AEM is the source, the local cache is the staging area where every transformation happens, Sanity is the destination. Re-runs converge because each artifact's identity is content-derived (JCR path → `_id`, JCR UUID → `_key`, DAM path → manifest key, tag id → category doc id).

### Hard constraints for this slide

- **No bullet lists, no paragraphs** in the body region — just zone boxes, artifact cards, and labeled arrows.
- **Arrows must be labeled with both the stage name and a 3–6-word caption.** No labels on arrow heads.
- **Three columns roughly equal width.** Middle column cards are smaller and stacked; outer columns have fewer, larger cards.
- **Color arrows by stage** if accent tokens are available — reuse the matching color on slide 4's command rows to tie the two slides together.
- **Keep the corner-mark + eyebrow + title + subtitle structure** identical to the other slides; only the body region shape changes.

---

## Where placeholders should appear in examples

Keep the tenant-folder placeholder `<tenant>` (or `your-app`) consistent across the deck — it stands for the user's package name (matching `name` in the workspace `package.json`). In the David's Bridal example repo it's `example-davids-bridal`, but the deck is generic; pick one convention and use it everywhere.

---

## What NOT to change

- Slide chrome (corner-mark, eyebrow casing, frame, page numbering).
- Color tokens, typography, dividers, spacing, drop shadows.
- The "Source → Action → Destination" diagram on Slide 2.
- The first-time setup row on Slide 4.
- The visual identity of any existing slide — content-only edits.

---

## Verification checklist

After applying the edits:

1. Open `docs/aem-to-sanity-standalone.html` in a browser — every slide renders without script errors.
2. Browser tab title reads `aem-to-sanity — AEM → Sanity content migration` (not `… — pipeline`).
3. Slide 1 title reads `Migrate aem-to-sanity end-to-end` (with the monospace `aem-to-sanity` lockup preserved).
4. Slide 1 subtitle mentions "migration toolkit" and "six automated steps (one optional)".
5. Slide 1 shows **seven** step-cards in order: Export · Schema generation · Tags (optional) · Data transform · Asset handling · Import · Frontend rebuild (Manual).
6. Slide 1's Step 02 (Schema generation) body mentions `aem-page-components.json`, `pageProperties`, and per-template document types.
7. Slide 3 Mode 04 mentions the optional tags step in the content chain.
8. Slide 4's "One step at a time" row includes `pnpm --filter <tenant> tags` between `extract` and `transform`.
9. Slide 5 has a tags-specific card with `output/cache/tags-report.json` + `categories/manifest.json`.
10. Slide 6 Card 04 (Determinism) mentions per-template doc types and `--recreate-on-type-change`.
11. A new slide labelled `08 Architecture` (no body bullet lists) shows three zones (AEM · Local cache · Sanity) connected by six labelled arrows, with two dashed connectors (Studio loads schemas; Web preview reads dataset).
12. `data-label`s in the deck-stage are sequential and updated: `01 Migration overview · 02 Asset migration · 03 Run modes · 04 Commands · 05 Logs & audit · 06 Implementation · 08 Architecture`. (The 07 slot is intentionally skipped — operator-facing labels track the seven pipeline steps; the architecture slide is bonus content.)
13. The deck's literal `<title>`, every `data-label`, and every visible slide eyebrow / title / subtitle pair are consistent — no leftover references to "pipeline" as the deck's framing.

---

## Open items NOT covered by this update (track separately)

- The Hydrogen storefront (`apps/storefront`) and Sanity Functions (`functions/auto-colorize`) are mentioned in `README.md` but not in the deck. Slide 6 Card 01 (Layout) could add them as a fourth bullet — out of scope for this update, but worth tracking.
- The deck doesn't yet show **AEMaaCS Service Credentials** as the recommended auth flow. If you want auth coverage in the deck, add it to Slide 3 as a Mode card or to Slide 4 as a setup row.
