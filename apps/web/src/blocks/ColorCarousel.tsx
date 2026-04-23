import { imageUrl } from "../sanity.ts";
import type { ColorCarouselBlock } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * Color carousel — the home page's "shop by category" grid. DESIGN.md
 * pushes us away from the e-commerce tile grid, so this renders as a
 * breathable masonry-ish layout: items flow with generous gaps, every
 * third tile nudges vertically to avoid the template grid look.
 */
export function ColorCarousel({ block }: { block: ColorCarouselBlock }) {
  const items = block.colors ?? [];
  return (
    <section className="bg-[color:var(--color-surface)] py-20 md:py-24">
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        {block.headline2 ? (
          <div className="mb-12 md:mb-16 text-center">
            <p className="label-caps mb-3">Curated edits</p>
            <h2 className="font-display text-3xl md:text-5xl leading-[1.1] tracking-[-0.01em]">
              {block.headline2}
            </h2>
            {block.description ? (
              <div className="mx-auto mt-5 max-w-2xl">
                <PortableText value={block.description} />
              </div>
            ) : null}
          </div>
        ) : null}

        <ul className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4 md:gap-x-8 md:gap-y-16 lg:grid-cols-6">
          {items.map((item, i) => {
            const img = item.fileReference
              ? imageUrl(item.fileReference, { width: 480 })
              : undefined;
            // Every third tile drops a touch — breaks the template grid.
            const offset = i % 3 === 1 ? "md:mt-8" : "";
            return (
              <li key={item._key} className={offset}>
                <a href={item.link ?? "#"} className="group block">
                  <div className="aspect-[3/4] overflow-hidden rounded-[2px] bg-[color:var(--color-surface-container-low)]">
                    {img ? (
                      <img
                        src={img}
                        alt={item.name ?? ""}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <p className="mt-4 font-display text-lg capitalize text-[color:var(--color-on-surface)]">
                    {item.name}
                  </p>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
