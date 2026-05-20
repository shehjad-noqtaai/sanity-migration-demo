# web — Ethereal Atelier storefront preview

A small Vite + React 19 app that reads the migrated home page out of Sanity and renders it through a set of block primitives styled per [`docs/DESIGN.md`](../../docs/DESIGN.md) (the "Digital Curator" / Ethereal Atelier system).

Mirrors the data-fetching pattern of the `hydrogen-sanity` package — read the published perspective via a Sanity client, dereference `pageBuilder[]`, render each block with a dedicated primitive. When this graduates into a full Hydrogen (Shopify + Remix) storefront, the block renderers and the Portable Text setup carry over unchanged; only the loader / route shell swaps.

## Run

```bash
pnpm -F web dev          # http://localhost:4321
```

Env plumbing: `vite.config.ts` loads `apps/web/.env` first, then falls back to the first non-template tenant folder under `examples/` that has a `.env` (so the demo picks up the same project / dataset whichever migration destination you have configured locally). Only `SANITY_PROJECT_ID` and `SANITY_DATASET` are exposed to the client.

**Private datasets.** Every Sanity API call goes through the Vite dev server's `/sanity-api/*` proxy (see `vite.config.ts`). When `SANITY_TOKEN` is present in the server env, the proxy attaches `Authorization: Bearer <token>` to outbound requests so the dev preview reads private datasets without shipping the token to the browser. Public datasets work without a token — the proxy just rewrites the path. The proxy also sidesteps the CORS registration you'd otherwise need for `http://localhost:4321` on each Sanity project.

## Layout

- `src/styles.css` — Tailwind v4 `@theme` block mapping the DESIGN.md color + font tokens. `.cta-satin` and `.label-caps` utilities live here so the primary CTA gradient and the label-caps treatment stay in one place.
- `src/sanity.ts` — `@sanity/client` instance + `imageUrl()` helper wired through `@sanity/image-url`.
- `src/blocks/PortableText.tsx` — shared renderer used by every block that holds richtext. Empty `<p>&nbsp;</p>` paragraphs (common in AEM richtext) are stripped to preserve the vertical rhythm.
- `src/blocks/*.tsx` — one primitive per `_type`:
  - `Promo` — asymmetric hero with overlapping headline.
  - `ColorCarousel` — breathable masonry-ish grid (every third tile nudges to break the template look).
  - `VariableColumn` — multi-column storytelling block, nested richtext + CTAs.
  - `Hr` — tonal spacer (never a 1px line — DESIGN.md §2 "no-line rule").
  - `UnknownBlock` — visible placeholder for block types without a renderer yet.
- `src/blocks/index.tsx` — dispatcher keyed on `_type`.
- `src/App.tsx` — fetches the home doc (`_id == "content.aem-integration.us.en.home"`), renders header + pageBuilder + footer.

## Extending

To render a new block type, drop a primitive under `src/blocks/` and add its case to the dispatcher. Anything without a renderer falls through to `UnknownBlock`, which shows the `_type` inline so missing primitives surface immediately instead of rendering as blank space.
