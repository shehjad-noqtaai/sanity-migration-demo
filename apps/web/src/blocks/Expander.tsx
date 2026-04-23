import type { AemBoxLike, ExpanderBlock } from "../types.ts";

/**
 * Accordion. AEM nests one box per item under variable key shapes
 * (`box`, `item_<timestamp>`, etc.); each box has a `text` field of
 * raw HTML for the answer. Question text isn't surfaced in the
 * migrated shape — auto-numbered titles keep the section navigable
 * until question metadata is threaded through the registry.
 *
 * Renders native `<details>` + `<summary>` so keyboard / screen-
 * reader behavior is correct without JS. The first item starts open
 * (matches production's first-expanded behavior on /faq accordions).
 */
export function Expander({ block }: { block: ExpanderBlock }) {
  const items = collectItems(block);
  if (items.length === 0) return null;
  return (
    <section className="bg-[color:var(--color-surface)] py-12 md:py-16">
      <div className="mx-auto max-w-4xl px-6 md:px-10">
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li
              key={item._key}
              className="overflow-hidden rounded-lg bg-[color:var(--color-surface-cream)]"
            >
              <details open={i === 0} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-base font-medium text-[color:var(--color-on-surface)] [&::-webkit-details-marker]:hidden">
                  <span>Question {i + 1}</span>
                  <span
                    aria-hidden
                    className="text-xl text-[color:var(--color-primary)] transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <div
                  className="px-5 pb-5 text-[0.95rem] leading-[1.65] text-[color:var(--color-on-surface)] [&_p]:mb-3 [&_p:last-child]:mb-0 [&_a]:text-[color:var(--color-primary)] [&_a]:underline [&_a]:underline-offset-4"
                  dangerouslySetInnerHTML={{ __html: item.text ?? "" }}
                />
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Walk an `expander` block to extract all answer boxes. AEM stores
 * the first under `box` and the rest under variable `item_*` keys;
 * each box's content lives under another variable `content_*` key.
 * We flatten the lot into a list and drop entries with empty text
 * so blank authoring placeholders don't render as empty cards.
 */
function collectItems(block: ExpanderBlock): AemBoxLike[] {
  const out: AemBoxLike[] = [];
  function pushIfText(box: unknown): void {
    if (!box || typeof box !== "object") return;
    const rec = box as Record<string, unknown>;
    // Direct `text` field on the box itself.
    if (typeof rec.text === "string" && rec.text.trim()) {
      out.push({ _key: String(rec._key ?? out.length), text: rec.text });
      return;
    }
    // Otherwise look one level down at the variable `content_*` keys.
    for (const k of Object.keys(rec)) {
      if (k === "_key") continue;
      const v = rec[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const inner = v as Record<string, unknown>;
        if (typeof inner.text === "string" && inner.text.trim()) {
          out.push({ _key: String(inner._key ?? `${rec._key}-${k}`), text: inner.text });
          return;
        }
      }
    }
  }

  // First item lives under `box`.
  if (block.box) pushIfText(block.box);
  // Subsequent items live under arbitrary `item_*` keys.
  for (const key of Object.keys(block)) {
    if (!key.startsWith("item_")) continue;
    pushIfText(block[key]);
  }
  return out;
}
