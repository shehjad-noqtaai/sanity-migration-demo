import type { AemBoxLike, ResourcesColumnListBlock } from "../types.ts";

/**
 * Multi-column resource cards. AEM stores items under variable keys
 * (`resources-column-item`, `resources-column-item_<n>`); each item
 * holds an HTML `text` field via a nested `content_*` box. We flatten
 * the lot into a card grid — narrative text on a cream surface with
 * inline links pointing at relevant policies.
 */
export function ResourcesColumnList({ block }: { block: ResourcesColumnListBlock }) {
  const items = collectColumnItems(block);
  if (items.length === 0) return null;
  const cols = Math.min(items.length, 3);
  return (
    <section
      className={`bg-[color:var(--color-surface)] ${block.removeTopPadding ? "pt-4" : "pt-12 md:pt-16"} ${block.removeBottomPadding ? "pb-4" : "pb-12 md:pb-16"}`}
    >
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        <div
          className="grid gap-6 md:gap-8"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {items.map((item) => (
            <article
              key={item._key}
              className="rounded-lg bg-[color:var(--color-surface-cream)] p-6 md:p-7 text-[0.95rem] leading-[1.65] text-[color:var(--color-on-surface)] [&_p]:mb-3 [&_p:last-child]:mb-0 [&_a]:text-[color:var(--color-primary)] [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: item.text ?? "" }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function collectColumnItems(block: ResourcesColumnListBlock): AemBoxLike[] {
  const out: AemBoxLike[] = [];
  function pushItem(item: unknown): void {
    if (!item || typeof item !== "object") return;
    const rec = item as Record<string, unknown>;
    // The AEM item object holds one or more `content_*` boxes; collect
    // each box's text individually so multi-paragraph items render as
    // distinct cards (matches production layout).
    for (const k of Object.keys(rec)) {
      if (k === "_key") continue;
      const v = rec[k];
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      const inner = v as Record<string, unknown>;
      if (typeof inner.text === "string" && inner.text.trim()) {
        out.push({ _key: String(inner._key ?? `${rec._key}-${k}`), text: inner.text });
      }
    }
  }
  for (const key of Object.keys(block)) {
    if (!key.startsWith("resources-column-item")) continue;
    pushItem(block[key]);
  }
  return out;
}
