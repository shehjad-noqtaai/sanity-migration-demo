import type { IconGridBlock } from "../types.ts";

/**
 * Multi-icon row (e.g. measurement tips, value props). Authored items
 * live in a nested AEM structure that the current registry doesn't
 * surface flat — until they're threaded through, render the headline
 * + a placeholder column count derived from the block's `columns`
 * field so the section keeps its intended footprint instead of
 * collapsing to nothing.
 */
export function IconGrid({ block }: { block: IconGridBlock }) {
  const cols = Math.max(1, Math.min(parseInt(block.columns ?? "3", 10) || 3, 6));
  const align = block.textAlign ?? "center";
  return (
    <section className="bg-[color:var(--color-surface)] py-12 md:py-16">
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        {block.headline2 ? (
          <h2
            className={`text-2xl md:text-3xl font-normal capitalize leading-tight text-[color:var(--color-on-surface)] mb-8 ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}`}
          >
            {block.headline2}
          </h2>
        ) : null}
        <div
          className="grid gap-6 md:gap-10"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-3 text-center">
              <div className="h-14 w-14 rounded-full bg-[color:var(--color-surface-muted)]" />
              <div className="h-3 w-1/2 rounded bg-[color:var(--color-surface-muted)]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
