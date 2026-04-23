import { imageUrl } from "../sanity.ts";
import type { PromoBlock } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * Promo — the editorial hero card. Asymmetric split so image + copy never
 * line up in a dead-center grid (DESIGN.md §1 "planned serendipity"). When
 * `align` is set, the copy column flips to respect the author's intent
 * rather than force a single layout.
 */
export function Promo({ block }: { block: PromoBlock }) {
  const image = block.fileReference ? imageUrl(block.fileReference, { width: 1400 }) : undefined;
  const alignedRight = block.align === "right";

  return (
    <section className="bg-[color:var(--color-surface)] py-20 md:py-28">
      <div className="mx-auto grid max-w-[88rem] grid-cols-1 gap-12 px-6 md:grid-cols-12 md:gap-16 md:px-10">
        {image ? (
          <div
            className={`md:col-span-7 ${alignedRight ? "md:order-2" : ""}`}
            // Overlapping content — headline slightly overlaps image margin
            // via negative inline offset on the copy column below.
          >
            <div className="relative overflow-hidden bg-[color:var(--color-surface-container-low)]">
              <img
                src={image}
                alt={block.headline1 ?? ""}
                className="h-auto w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        ) : null}

        <div
          className={`flex flex-col justify-center md:col-span-5 ${
            alignedRight ? "md:order-1 md:pr-4 md:-ml-8" : "md:pl-4 md:-mr-8"
          }`}
        >
          {block.headline1 ? (
            <h2 className="font-display text-[2.75rem] leading-[1.05] md:text-[3.5rem] tracking-[-0.01em] text-[color:var(--color-on-surface)]">
              {block.headline1}
            </h2>
          ) : null}
          {block.headline2 ? (
            <p className="mt-3 font-body text-lg md:text-xl text-[color:var(--color-on-surface-variant)]">
              {block.headline2}
            </p>
          ) : null}
          {block.description ? (
            <div className="mt-6">
              <PortableText value={block.description} />
            </div>
          ) : null}
          {block.link ? (
            <div className="mt-8">
              <a
                href={block.link}
                className="cta-satin inline-flex items-center px-7 py-3 font-body text-sm font-medium tracking-wide"
              >
                Explore
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
