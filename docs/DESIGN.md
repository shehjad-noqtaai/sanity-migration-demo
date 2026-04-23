# Design System: David's Bridal Production

Reference for the `apps/web` preview styling. Every value in this doc maps to a concrete token in `apps/web/src/styles.css` — if you need to deviate, update the token first and re-read it from there rather than inlining the new value.

Sourced from the live production site (`https://www.davidsbridal.com/`): palette sampled from the page CSS, typography from the preloaded `Objektiv Mk2` woff2 files, radii from the compiled Tailwind utilities.

---

## 1. Creative direction

A bridal retailer, not a luxury editorial. Warm, approachable, confident. The production site leans into:

- **Sans-serif everywhere.** One family across display, body, and label — no serif/sans pairing. Keeps the storefront friendly and commerce-appropriate rather than magazine-aloof.
- **Warm neutrals + a deep wine anchor.** Cream backgrounds (`surface-cream`), a single saturated wine for primary CTAs and brand marks, and pastel category tints for chips and promo banners.
- **Soft corners.** `rounded-md` / `rounded-lg` (6–8px) on interactive surfaces — never hard architectural 2px.
- **Generous vertical rhythm.** Sections breathe with ~4–6rem of padding; imagery is large and edge-to-edge on key heroes.

---

## 2. Palette

Token names map 1:1 to CSS custom properties in `styles.css`.

### Brand + semantic

| Token | Hex | Role |
| --- | --- | --- |
| `primary` | `#691c35` | Primary brand / CTA fill / link text. Deeper than the brighter `#99062a` used for hero chrome — safer as a background behind white text. |
| `primary-strong` | `#99062a` | Hero chrome, decorative bands, hover state on the primary CTA. |
| `on-primary` | `#ffffff` | Text on `primary` surfaces. |
| `error` | `#c11a44` | Validation / stock warnings. Warmer than the default Tailwind red. |

### Surfaces (warm, not clinical)

| Token | Hex | Use |
| --- | --- | --- |
| `surface` | `#ffffff` | Page default. DB's home sits on white — no off-white luxury tint. |
| `surface-cream` | `#faf4ef` | Secondary sections, card backgrounds, softer bands. |
| `surface-muted` | `#f0f0f0` | Tertiary surface for nested cards + product tiles. |
| `on-surface` | `#132122` | Body text. Never `#000`. |
| `on-surface-muted` | `#4b5563` | Meta copy, captions, supporting labels. |
| `outline` | `#e5e7eb` | When a hairline is truly necessary (form inputs, dividers); otherwise let surface contrast carry the separation. |

### Category accents

Pastel tints used for "Shop by X" chips, promo banners, and editorial callouts. Each has a text pair tuned for accessible contrast.

| Token | Hex | Paired text |
| --- | --- | --- |
| `accent-blush` | `#ebb8af` | `on-surface` |
| `accent-sage` | `#c9d8cf` | `on-surface` |
| `accent-plum` | `#4f204a` | `#ffffff` |
| `accent-lavender` | `#d8cfe7` | `on-surface` |
| `accent-gold` | `#d4af36` | `on-surface` |
| `accent-magenta` | `#ec008c` | `#ffffff` — reserved for sale / "new" badges |

---

## 3. Typography

One family. Production uses Objektiv Mk2; the preview substitutes **Inter** (licence-friendly, near-identical geometric sans with matching weights + vertical metrics). Swap to Objektiv in `styles.css` when a licence is available.

| Scale | Size / leading | Use |
| --- | --- | --- |
| `display-lg` | `3rem / 1.05` @ 300 | Page-level hero headline. Light weight — the elegance comes from size + letterspacing, not bold strokes. |
| `display-md` | `2.25rem / 1.1` @ 400 | Section headlines (e.g. "Shop by category"). |
| `title-lg` | `1.5rem / 1.2` @ 500 | Card titles, editorial sub-headings. |
| `body-lg` | `1.0625rem / 1.6` @ 400 | Primary paragraph copy. |
| `body-md` | `0.9375rem / 1.55` @ 400 | Supporting paragraph, card body. |
| `label` | `0.75rem / 1.2` @ 500, `letter-spacing: 0.08em`, uppercase | "Shop by category" eyebrows, filter chips. |

Links inside paragraphs are `primary`, no underline by default, underline on hover. Buttons never underline.

---

## 4. Elevation & surfaces

- No heavy drop shadows. Use soft ambient `shadow-soft` (`0 1px 2px rgba(19,33,34,0.04), 0 8px 24px rgba(19,33,34,0.06)`) only on elements that truly float (sticky header when scrolled, modals). Product cards on page sit flat on the cream band.
- Section separation = background-color shift (`surface` → `surface-cream`). Dividers as 1px lines only inside forms (`outline`).
- Corner radius: **6px** for controls (`rounded-md`), **8px** for cards/tiles (`rounded-lg`), **9999px** for pill chips and round category badges.

---

## 5. Components

### Buttons

- **Primary:** `primary` fill, `on-primary` text, `rounded-md`, `px-6 py-3`, label-case (not all caps), 15px @ 500. Hover: shift to `primary-strong`. No gradient, no shimmer.
- **Secondary:** `surface` fill, 1px `primary` border, `primary` text. Hover: fill flips to `primary`, text flips to `on-primary`.
- **Tertiary / link:** Inline `primary` text with `underline-offset-2` underline appearing on hover/focus. Reserved for inline CTAs inside paragraphs.

### Category chip (new, unique to DB)

Used for "Shop by category" tiles. A round circular thumbnail on top (aspect `1/1`), centered label below.

Fill hierarchy (resolved by `tileColor` in `blocks/ColorCarousel.tsx`):

1. **Image** — if `fileReference` is present, the chip shows the image crop.
2. **Authored hex** — else the item's `hexValue` field if it passes a hex regex.
3. **Name-derived hex** — else a small name→hex map (`Red`, `Green`, `Blue`, `Pink`, `Neutral`, `Ivory`, `Navy`, etc.) tuned to read well at chip size against `surface-cream`. This covers AEM authoring gaps where the hex wasn't stamped.
4. **`surface-muted`** — final fallback.

Every chip carries a 1px inset black/5 ring so white / near-white tiles remain visible against the cream section background without a hard border.

### Product / image card

- `surface` background, `rounded-lg`, overflow hidden.
- Image fills a 4:5 aspect on tile, 3:4 on editorial cards.
- Title (`title-lg`) sits below image in its own padding band (`px-4 py-3`).
- No hover shadow — hover instead darkens the image subtly or reveals a secondary image if a hover-alt is provided.

### Rich text

Portable Text renders at `body-lg` inside marketing copy blocks. Lists use a `primary` colored marker. Blockquote takes a 4px left-border in `accent-blush` with `italic`.

---

## 6. Do's & Don'ts

### Do

- **Use `surface-cream` behind editorial story blocks** to create warmth against the white default.
- **Let imagery carry the hero.** The DB home is image-dominant — copy sits under or beside, not overlapping.
- **Tint promos with a category accent** rather than inventing new colors. Consistent accent use is half the brand.

### Don't

- **Don't use serif fonts.** The production site has none. Keep everything in the sans stack.
- **Don't use pure black (`#000`)** for long-form copy. Use `on-surface` (`#132122`).
- **Don't ship hard 2px corners** on interactive surfaces. The system is soft-cornered; 2px reads as a different brand.
- **Don't stack heavy shadows.** Tonal surfaces + breathing room do the lifting.

---

## 7. Tailwind v4 implementation note

Tokens in `apps/web/src/styles.css` are declared inside a single `@theme` block so Tailwind v4 generates utilities like `bg-primary`, `text-on-surface`, `font-display`. Fonts are declared via `--font-display`, `--font-body`, `--font-label` — all three currently point at Inter; when Objektiv Mk2 is licensed, swap the value in `--font-body` / `--font-display` to `'Objektiv Mk2', Inter, sans-serif` with no other code changes.
