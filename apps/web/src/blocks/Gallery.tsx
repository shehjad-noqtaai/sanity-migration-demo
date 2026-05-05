import type { GalleryBlock } from "../types.ts";

/**
 * UGC gallery — production embeds a third-party Crowdriff feed via
 * the raw `galleryTag` HTML (`<div data-crl8-container-id=…>`). That
 * widget needs its own JS bundle to populate, which we don't load in
 * this preview, so we render the headline plus a light placeholder
 * grid styled to match — keeps the page rhythm intact and signals
 * what would be there in production.
 */
export function Gallery({ block }: { block: GalleryBlock }) {
  const placeholderCount = 6;
  return (
    <section
      className={`bg-[color:var(--color-surface-cream)] ${block.removeTopPadding ? "pt-4" : "pt-16 md:pt-20"} ${block.removeBottomPadding ? "pb-4" : "pb-16 md:pb-20"}`}
    >
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        {block.headline2 ? (
          <div className="mb-10 text-center">
            <p className="label-eyebrow mb-2">From the community</p>
            <h2 className="text-3xl md:text-[2.5rem] font-normal leading-[1.1] text-[color:var(--color-on-surface)]">
              {block.headline2}
            </h2>
          </div>
        ) : null}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 md:gap-4">
          {Array.from({ length: placeholderCount }).map((_, i) => (
            <li
              key={i}
              className="aspect-square overflow-hidden rounded-md bg-[color:var(--color-surface-muted)]"
            />
          ))}
        </ul>
        {block.galleryTag ? (
          <p className="mt-6 text-center text-xs text-[color:var(--color-on-surface-muted)]">
            (Live feed renders via the Crowdriff widget on production.)
          </p>
        ) : null}
      </div>
    </section>
  );
}
