# Design System: The Ethereal Atelier
 
## 1. Overview & Creative North Star
**Creative North Star: "The Digital Curator"**
 
This design system is not merely a retail interface; it is a curated editorial experience. It moves away from the rigid, boxy constraints of traditional e-commerce to embrace a sense of "planned serendipity." By utilizing intentional asymmetry, expansive white space, and high-contrast typography scales, the system mimics the layout of a luxury fashion monograph.
 
The goal is to evoke the feeling of flipping through a premium bridal magazine. We achieve this by breaking the "template" look—images may bleed off-center, text may overlap subtle tonal shifts, and the interface breathes through generous margins that prioritize emotional resonance over information density.
 
---
 
## 2. Colors: Tonal Depth & Soul
Our palette transitions from the crisp clarity of high-fashion whites to the soft, romantic depths of blush and wine.
 
### The "No-Line" Rule
To maintain a high-end editorial feel, **1px solid borders are strictly prohibited for sectioning.** Boundaries must be defined solely through background color shifts. For instance, a section utilizing `surface-container-low` (#f3f3f4) should sit directly against a `surface` (#f9f9f9) background. This creates a "soft-edge" transition that feels sophisticated rather than clinical.
 
### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of vellum or handmade paper. 
- **Base:** `surface` (#f9f9f9)
- **Nested Content:** Use `surface-container-lowest` (#ffffff) for primary content cards to create a subtle "lift" against the off-white background.
- **Emphasis Zones:** Use `secondary-container` (#fbdbdb) for soft call-outs or promotional banners.
 
### The "Glass & Gradient" Rule
Standard flat colors can feel sterile. To inject "soul":
- **Floating Elements:** Navigation bars or hover-state cards should use a semi-transparent `surface` color with a `backdrop-blur-md` effect.
- **Signature Gradients:** Use a subtle linear gradient (from `primary` #be0039 to `primary-container` #e8184c) for high-impact CTAs. This creates a "satin" finish that reflects light more naturally than a flat fill.
 
---
 
## 3. Typography: The Editorial Voice
The system relies on the interplay between the timeless authority of the serif and the modern precision of the sans-serif.
 
*   **Display & Headlines (Noto Serif):** These are the "hero" elements. Use `display-lg` for campaign titles. The serif evokes history, elegance, and the "once-in-a-lifetime" nature of the bridal industry.
*   **Body & Titles (Manrope):** A modern, geometric sans-serif that ensures readability and a contemporary edge. Use `body-lg` for product descriptions to maintain a luxury feel.
*   **Labels (Inter):** Reserved for technical data (sizes, SKU, pricing). These should be small, letter-spaced, and all-caps to act as functional anchors without distracting from the beauty of the headlines.
 
---
 
## 4. Elevation & Depth: Tonal Layering
We avoid the "shadow-heavy" look of material design in favor of **Tonal Layering**.
 
*   **The Layering Principle:** Depth is achieved by "stacking." Place a `#ffffff` card on a `#f3f3f4` section. The change in hex code provides all the separation the eye needs.
*   **Ambient Shadows:** If a floating effect is required (e.g., a "Quick View" modal), use an ultra-diffused shadow. 
    *   *Spec:* `shadow-[0_20px_50px_rgba(92,63,65,0.05)]`. Note the use of a tinted shadow (based on `on-surface-variant`) rather than pure black.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use `outline-variant` (#e6bdbe) at **20% opacity**. It should be a whisper, not a statement.
*   **Glassmorphism:** Use semi-transparent layers for mobile menus or image overlays to allow the rich imagery to bleed through, maintaining a cohesive visual flow.
 
---
 
## 5. Components: Refined Primitives
 
### Buttons: The "Satin" CTA
*   **Primary:** High-contrast `primary` (#be0039) background with `on-primary` (#ffffff) text. Use `rounded-sm` (0.125rem) for a sharp, architectural look.
*   **Secondary:** An "Outline" style using the Ghost Border rule. No fill, `outline-variant` at 40% opacity, with `primary` text.
*   **Tertiary:** Purely typographic with a subtle `primary` underline that expands on hover.
 
### Input Fields: The "Vanishing" Input
Avoid the "boxy" input field. Use a `surface-container-low` background with a bottom-only border of `outline-variant`. Labels should transition from `body-md` to `label-sm` on focus.
 
### Cards & Lists: The Negative Space Rule
*   **Forbid divider lines.** Separate list items using `py-6` or `py-8` (vertical white space).
*   **Cards:** Use `surface-container-lowest` (#ffffff) with no border. The "edge" is defined by the contrast against the `surface` background.
 
### Custom Component: The "Image Triptych"
Specifically for bridal showcases: A 3-column asymmetric grid where the center image is slightly offset vertically. This breaks the "e-commerce grid" and forces the user to engage with the photography as art.
 
---
 
## 6. Do's and Don'ts
 
### Do
*   **DO** use "Overlapping Content": Allow a `headline-lg` to slightly overlap the margin of a high-quality image.
*   **DO** prioritize imagery: If an image is stunning, let it take up 100% of the viewport width.
*   **DO** use "Breathable Grids": Increase the standard Tailwind `gap-4` to `gap-12` or `gap-16` to emphasize luxury.
 
### Don't
*   **DON'T** use 100% black (#000000) for long-form text. Use `on-surface` (#1a1c1c) for a softer, more premium reading experience.
*   **DON'T** use heavy drop shadows. If it looks like it's "floating" more than a few millimeters off the page, it's too heavy.
*   **DON'T** crowd the UI. If you are unsure, add 2rem of extra padding.
*   **DON'T** use standard "Alert Red" for errors. Use the `error` token (#ba1a1a) which is tuned to the system's warmer palette.
 
---
 
## 7. Tailwind CSS 4 Implementation Note
Utilize the `@theme` block in Tailwind 4 to map these tokens. Leverage the new `oklch` interpolation for the "Ghost Border" opacities to ensure color vibrancy even at low alphas. Use the `container-type: inline-size` for the Asymmetric Triptych components to ensure they scale gracefully across editorial layouts.