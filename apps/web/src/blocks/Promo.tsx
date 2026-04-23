import { imageUrl } from "../sanity.ts";
import type { PromoBlock } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * Promo — hero / feature card. Matches the production DB layout: large
 * image, copy column beside (not overlapping), soft-corner rounding on
 * the image frame, `cta-primary` pill CTA. Alternates image side when
 * `align === "right"` so adjacent promos in a stack don't march in a
 * single direction.
 */
export function Promo({ block }: { block: PromoBlock }) {
  const image = block.fileReference ? imageUrl(block.fileReference, { width: 1400 }) : undefined;
  const alignedRight = block.align === "right";

  return (
    <section className="bg-[color:var(--color-surface)] py-16 md:py-20">
      <div className="mx-auto grid max-w-[88rem] grid-cols-1 gap-10 px-6 md:grid-cols-12 md:gap-14 md:px-10">
        {image ? (
          <div className={`md:col-span-7 ${alignedRight ? "md:order-2" : ""}`}>
            <div className="overflow-hidden rounded-lg bg-[color:var(--color-surface-muted)]">
              <img
                src={image}
                alt={block.headline1 ?? ""}
                className="h-auto w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        ) : null}

        <div className={`flex flex-col justify-center md:col-span-5 ${alignedRight ? "md:order-1" : ""}`}>
          {block.headline1 ? (
            <h2 className="text-[2.25rem] md:text-[3rem] font-light leading-[1.05] tracking-[-0.01em] text-[color:var(--color-on-surface)]">
              {block.headline1}
            </h2>
          ) : null}
          {block.headline2 ? (
            <p className="mt-3 text-lg md:text-xl font-normal text-[color:var(--color-on-surface-muted)]">
              {block.headline2}
            </p>
          ) : null}
          {block.description ? (
            <div className="mt-5">
              <PortableText value={block.description} />
            </div>
          ) : null}
          {block.link ? (
            <div className="mt-6">
              <a href={block.link} className="cta-primary inline-flex items-center">
                Shop now
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
