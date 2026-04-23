import { imageUrl } from "../sanity.ts";
import type { ColorCarouselBlock, ColorCarouselItem } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * "Shop by category" — the production DB home has a row of round
 * circular thumbnails with a label underneath each. Every chip is a link
 * to a collection. Background is the `surface-cream` band so it lifts
 * against the white hero. Chip count wraps naturally; no offsets or
 * "editorial" tricks — this is a friendly retail grid.
 */
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
  return (
    <li>
      <a href={item.link ?? "#"} className="group flex flex-col items-center">
        <div className="aspect-square w-full overflow-hidden rounded-full bg-[color:var(--color-surface-muted)]">
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
