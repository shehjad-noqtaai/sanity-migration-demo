import { imageUrl } from "../sanity.ts";
import type { ColorCarouselBlock, ColorCarouselItem } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * "Shop by category / color" — a row of round chip thumbnails with a
 * label underneath each. Renders a hierarchy of fills per tile:
 *
 *   1. `fileReference` (image) — the richest variant; used when authors
 *      supplied a photo crop.
 *   2. `hexValue` — the per-item explicit hex the colorCarousel schema
 *      already carries (e.g. "#c53030").
 *   3. Name-derived hex — for items without either image or hex, map
 *      common color words ("Red", "Green", "Neutral", …) to a palette
 *      value. Covers AEM authoring gaps where the hex wasn't stamped.
 *   4. `surface-muted` — final fallback when nothing resolves.
 *
 * Color-filled chips get a subtle inset ring so white / neutral tiles
 * remain visible against the cream section background.
 */

/**
 * Color-name → hex map used when an item has neither an image nor an
 * explicit `hexValue` but carries a recognizable color name. Values are
 * tuned to read well at chip size and against the `surface-cream`
 * section background (not the pure Tailwind palette — those tend to
 * feel neon next to the muted DB aesthetic).
 */
const NAME_TO_HEX: Record<string, string> = {
  black: "#111827",
  blue: "#2c5282",
  blush: "#ebb8af",
  burgundy: "#7b2737",
  champagne: "#efd9b4",
  coral: "#e5736b",
  cream: "#f4ead5",
  floral: "#ebb8af",
  gold: "#d4af36",
  green: "#6b8e76",
  grey: "#9ca3af",
  gray: "#9ca3af",
  ivory: "#f5eed6",
  lavender: "#d8cfe7",
  multicolor: "#ebb8af",
  navy: "#1a365d",
  neutral: "#d6d3d1",
  nude: "#e4c9b5",
  orange: "#d97a49",
  pink: "#f0b7cb",
  purple: "#6b46c1",
  red: "#c53030",
  rose: "#d48a9b",
  sage: "#c9d8cf",
  silver: "#c6cbd0",
  taupe: "#b8a798",
  teal: "#2c7a7b",
  white: "#ffffff",
  yellow: "#e3c766",
};

function tileColor(item: ColorCarouselItem): string | null {
  if (typeof item.hexValue === "string" && /^#[0-9a-f]{3,8}$/i.test(item.hexValue.trim())) {
    return item.hexValue.trim();
  }
  if (typeof item.name === "string") {
    const key = item.name.trim().toLowerCase();
    if (NAME_TO_HEX[key]) return NAME_TO_HEX[key];
  }
  return null;
}

export function ColorCarousel({ block }: { block: ColorCarouselBlock }) {
  const items = block.colors ?? [];
  return (
    <section className="bg-[color:var(--color-surface-cream)] py-16 md:py-20">
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        {block.headline2 ? (
          <div className="mb-10 md:mb-14 text-center">
            <p className="label-eyebrow mb-3">Shop by category</p>
            <h2 className="text-3xl md:text-[2.5rem] font-normal leading-[1.1] text-[color:var(--color-on-surface)]">
              {block.headline2}
            </h2>
            {block.description ? (
              <div className="mx-auto mt-4 max-w-2xl text-[color:var(--color-on-surface-muted)]">
                <PortableText value={block.description} />
              </div>
            ) : null}
          </div>
        ) : null}

        <ul className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 md:gap-x-6 md:gap-y-10">
          {items.map((item) => (
            <CategoryChip key={item._key} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function CategoryChip({ item }: { item: ColorCarouselItem }) {
  const img = item.fileReference ? imageUrl(item.fileReference, { width: 320 }) : undefined;
  const color = !img ? tileColor(item) : null;

  return (
    <li>
      <a href={item.link ?? "#"} className="group flex flex-col items-center">
        <div
          className="aspect-square w-full overflow-hidden rounded-full bg-[color:var(--color-surface-muted)] ring-1 ring-inset ring-black/5"
          style={color ? { backgroundColor: color } : undefined}
        >
          {img ? (
            <img
              src={img}
              alt={item.name ?? ""}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
              loading="lazy"
            />
          ) : null}
        </div>
        <p className="mt-3 text-center text-sm font-medium capitalize text-[color:var(--color-on-surface)]">
          {item.name}
        </p>
      </a>
    </li>
  );
}
