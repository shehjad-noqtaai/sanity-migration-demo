import type { QuoteBlock } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * Centered testimonial quote. Theme picks the band background:
 * `claret` / `wine` → primary wine fill with white text, anything
 * else → cream band. Optional decorative quotation marks; size
 * scales the typography.
 */
export function Quote({ block }: { block: QuoteBlock }) {
  const onWine = block.theme === "claret" || block.backgroundColor === "wine";
  const align = block.align ?? "center";
  const sizeClass =
    block.size === "large"
      ? "text-2xl md:text-[2rem]"
      : block.size === "small"
        ? "text-lg"
        : "text-xl md:text-2xl";
  return (
    <section
      className={`py-16 md:py-20 ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}`}
      style={{
        backgroundColor: onWine ? "var(--color-primary)" : "var(--color-surface-cream)",
        color: onWine ? "var(--color-on-primary)" : "var(--color-on-surface)",
      }}
    >
      <div className="mx-auto max-w-3xl px-6 md:px-10">
        {block.quotationMarksEnabled ? (
          <p
            aria-hidden
            className="mb-3 text-5xl leading-none"
            style={{ color: onWine ? "rgba(255,255,255,0.55)" : "var(--color-primary)" }}
          >
            “
          </p>
        ) : null}
        <blockquote className={`${sizeClass} font-light italic leading-snug`}>
          {block.quote ? <PortableText value={block.quote} /> : null}
        </blockquote>
      </div>
    </section>
  );
}
