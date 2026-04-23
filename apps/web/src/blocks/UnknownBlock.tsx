import type { UnknownBlock as UnknownBlockType } from "../types.ts";

/**
 * Fallback renderer for block types this demo hasn't built a primitive
 * for yet (wyngExperience, heroVideoBanner, iconGrid, etc.). Surfaces the
 * `_type` as a muted label so we can see the gap on the page and decide
 * whether to build the primitive next.
 */
export function UnknownBlock({ block }: { block: UnknownBlockType }) {
  return (
    <section className="bg-[color:var(--color-surface-cream)] py-10">
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        <p className="label-eyebrow mb-2">Unstyled block</p>
        <p className="text-sm text-[color:var(--color-on-surface-muted)]">
          <code>_type: "{String(block._type)}"</code> — no dedicated renderer yet.
        </p>
      </div>
    </section>
  );
}
