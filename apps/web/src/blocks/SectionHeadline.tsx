import type { SectionHeadlineBlock } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * Centered text-only section break. Renders `headline2` as the display
 * heading (matches the AEM convention on travel/landing pages where
 * `headline1` is reserved for the eyebrow / overline).
 */
export function SectionHeadline({ block }: { block: SectionHeadlineBlock }) {
  const eyebrow = block.headline1?.trim();
  const headline = block.headline2?.trim();
  const hasDescription = Boolean(block.description?.length);
  if (!eyebrow && !headline && !hasDescription) return null;

  const pt = block.removeTopPadding ? "pt-2 md:pt-4" : "pt-12 md:pt-20";
  const pb = block.removeBottomPadding ? "pb-2 md:pb-4" : "pb-12 md:pb-20";

  return (
    <section className={`bg-[color:var(--color-surface)] ${pt} ${pb}`}>
      <div className="mx-auto max-w-3xl px-6 text-center md:px-10">
        {eyebrow ? (
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-on-surface-muted)]">
            {eyebrow}
          </p>
        ) : null}
        {headline ? (
          <h2 className="mt-3 text-[2rem] font-semibold leading-[1.08] tracking-[-0.01em] text-[color:var(--color-on-surface)] md:text-[3rem]">
            {headline}
          </h2>
        ) : null}
        {hasDescription ? (
          <div className="mt-5 text-base leading-relaxed text-[color:var(--color-on-surface-muted)] md:text-lg">
            <PortableText value={block.description!} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
