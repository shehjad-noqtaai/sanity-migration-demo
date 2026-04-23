import type { ProductCarouselBlock } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * Product strip — production fills this from a runtime catalog feed.
 * The authored block carries layout metadata (columns, theme) and
 * headlines; actual products are out of scope for the migration
 * preview. Render the headline + a styled placeholder grid sized to
 * the requested column count so the page rhythm stays right and the
 * intent is obvious.
 *
 * Theme picks the band background — `seashell` is the cream `#faf4ef`
 * variant the production site uses for these strips.
 */
export function ProductCarousel({ block }: { block: ProductCarouselBlock }) {
  const cols = Math.max(1, Math.min(parseInt(block.columns ?? "5", 10) || 5, 6));
  const themeBg = themeToSurface(block.theme);

  return (
    <section
      className={`${block.removeTopPadding ? "pt-4" : "pt-16 md:pt-20"} ${block.removeBottomPadding ? "pb-4" : "pb-16 md:pb-20"}`}
      style={{ backgroundColor: themeBg }}
    >
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        {block.headline2 ? (
          <div className="mb-10">
            <p className="label-eyebrow mb-2">Shop the edit</p>
            <h2 className="text-2xl md:text-[2rem] font-normal leading-[1.1] text-[color:var(--color-on-surface)]">
              {block.headline2}
            </h2>
            {block.description ? (
              <div className="mt-3 max-w-2xl text-[color:var(--color-on-surface-muted)]">
                <PortableText value={block.description} />
              </div>
            ) : null}
          </div>
        ) : null}
        <div
          className="grid gap-4 md:gap-6"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className="aspect-[3/4] rounded-lg bg-[color:var(--color-surface-muted)]" />
              <div className="h-3 w-3/4 rounded bg-[color:var(--color-surface-muted)]" />
              <div className="h-3 w-1/3 rounded bg-[color:var(--color-surface-muted)]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Map AEM theme tokens to a CSS color. Production has many themed
 * variants; we honor the common ones used on inspiration and fall
 * back to `surface` for anything we haven't seen yet.
 */
function themeToSurface(theme?: string): string {
  switch (theme) {
    case "seashell":
    case "seashell-cropped":
    case "seashell-no-card":
    case "seashell-alt":
      return "var(--color-surface-cream)";
    case "claret":
    case "claret-alt":
      return "var(--color-primary)";
    case "mocassin":
    case "mocassin-alt":
      return "#efd9b4";
    case "black":
    case "black-alt":
      return "var(--color-on-surface)";
    case "white":
    default:
      return "var(--color-surface)";
  }
}
