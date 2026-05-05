import type { PortableTextBlock } from "@portabletext/react";
import type { AemBoxLike, ExpanderBlock } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

interface CollectedItem {
  _key: string;
  panelTitle?: string;
  /** Portable Text from the registry-driven coercion — preferred. */
  blocks?: PortableTextBlock[];
  /** Raw HTML from legacy migrations (registry-less or pre-coercion). */
  html?: string;
}

/**
 * Accordion. AEM nests one box per item; the schema walker emits them
 * either in a clean `block.items[]` (modern shape, container-children)
 * or as variable `box` / `item_*` keys (legacy). Each box carries
 * `panelTitle` (lifted from AEM's `cq:panelTitle`) for the question and
 * a `text` payload for the answer — Portable Text when the registry
 * coerced it, raw HTML otherwise.
 *
 * Renders native `<details>` + `<summary>` so keyboard / screen-reader
 * behavior is correct without JS. The first item starts open. Falls
 * back to a visible "no panels" placeholder so empty / mis-shaped data
 * doesn't silently disappear from the page.
 */
export function Expander({ block }: { block: ExpanderBlock }) {
  const items = collectItems(block);
  const headline = block.headline2?.trim() || block.headline1?.trim();
  if (items.length === 0) {
    return (
      <section className="bg-[color:var(--color-surface)] py-12 md:py-16">
        <div className="mx-auto max-w-4xl px-6 md:px-10">
          {headline ? (
            <h2 className="mb-6 text-center text-2xl font-semibold text-[color:var(--color-on-surface)] md:text-3xl">
              {headline}
            </h2>
          ) : null}
          <p className="rounded-lg border border-dashed border-[color:var(--color-on-surface)]/20 px-5 py-4 text-center text-sm text-[color:var(--color-on-surface-muted)]">
            Expander block had no resolvable panels.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className="bg-[color:var(--color-surface)] py-12 md:py-16">
      <div className="mx-auto max-w-4xl px-6 md:px-10">
        {headline ? (
          <h2 className="mb-8 text-center text-2xl font-semibold text-[color:var(--color-on-surface)] md:text-3xl">
            {headline}
          </h2>
        ) : null}
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li
              key={item._key}
              className="overflow-hidden rounded-lg bg-[color:var(--color-surface-cream)]"
            >
              <details open={i === 0} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-base font-medium text-[color:var(--color-on-surface)] [&::-webkit-details-marker]:hidden">
                  <span>{item.panelTitle?.trim() || `Question ${i + 1}`}</span>
                  <span
                    aria-hidden
                    className="text-xl text-[color:var(--color-primary)] transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <div className="px-5 pb-5 text-[0.95rem] leading-[1.65] text-[color:var(--color-on-surface)] [&_p]:mb-3 [&_p:last-child]:mb-0 [&_a]:text-[color:var(--color-primary)] [&_a]:underline [&_a]:underline-offset-4">
                  {item.blocks ? (
                    <PortableText value={item.blocks} />
                  ) : item.html ? (
                    <div dangerouslySetInnerHTML={{ __html: item.html }} />
                  ) : null}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Walk an expander block to extract all answer panels. Three shapes
 * coexist depending on when the data was migrated:
 *
 *  1. Modern (current): `block.items[]` — each box has `panelTitle`
 *     and either a direct `text` (PT/HTML) or a nested `items[]` whose
 *     first child carries `text`.
 *  2. Legacy slot: `block.box` + variable `item_*` keys, each pointing
 *     at a box whose `text` lives one level down under `content_*`.
 *  3. Anything with a `text` field anywhere in the box — handled by
 *     {@link readPanel} via a one-level descent.
 */
function collectItems(block: ExpanderBlock): CollectedItem[] {
  const out: CollectedItem[] = [];

  if (Array.isArray(block.items)) {
    for (const box of block.items) {
      const panel = readPanel(box);
      if (panel) out.push(panel);
    }
    if (out.length > 0) return out;
  }

  // Legacy fallback: variable key shape.
  if (block.box) {
    const panel = readPanel(block.box as unknown as AemBoxLike);
    if (panel) out.push(panel);
  }
  for (const key of Object.keys(block)) {
    if (!key.startsWith("item_")) continue;
    const panel = readPanel(block[key] as AemBoxLike);
    if (panel) out.push(panel);
  }
  return out;
}

function readPanel(box: AemBoxLike | undefined): CollectedItem | undefined {
  if (!box || typeof box !== "object") return undefined;
  const panelTitle = typeof box.panelTitle === "string" ? box.panelTitle : undefined;

  // Direct `text` on the box (legacy or already-flattened).
  const direct = readText(box.text);
  if (direct) return { _key: box._key, panelTitle, ...direct };

  // Nested `items[]` (modern container-children shape).
  if (Array.isArray(box.items)) {
    for (const child of box.items) {
      const t = readText(child?.text);
      if (t) return { _key: box._key, panelTitle, ...t };
    }
  }

  // Legacy variable `content_*` key — one level down.
  const rec = box as unknown as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    if (k === "_key" || k === "_type" || k === "panelTitle" || k === "items") continue;
    const v = rec[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const t = readText((v as AemBoxLike).text);
      if (t) return { _key: box._key, panelTitle, ...t };
    }
  }

  // No text found, but a panelTitle is still worth surfacing as an
  // empty panel so the operator notices the gap rather than getting
  // a silent omission.
  if (panelTitle) return { _key: box._key, panelTitle };
  return undefined;
}

function readText(text: unknown): { blocks?: PortableTextBlock[]; html?: string } | undefined {
  if (Array.isArray(text) && text.length > 0) {
    return { blocks: text as PortableTextBlock[] };
  }
  if (typeof text === "string" && text.trim()) {
    return { html: text };
  }
  return undefined;
}
