import { imageUrl } from "../sanity.ts";
import type { VariableColumnBlock, VariableColumnItem } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * Variable column — multi-item storytelling block. Columns render as full-
 * width "chapters" on mobile, then fan out into a breathable grid on
 * desktop. No dividers between columns (DESIGN.md §5 "negative space
 * rule"); white space carries the separation.
 */
export function VariableColumn({ block }: { block: VariableColumnBlock }) {
  const items = block.columnContents ?? [];
  const cols = Math.min(items.length, 4);

  return (
    <section
      className={`bg-[color:var(--color-surface-container-lowest)] ${block.removeTopPadding ? "pt-4" : "pt-20 md:pt-28"} ${block.removeBottomPadding ? "pb-4" : "pb-20 md:pb-28"}`}
    >
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        {block.headline1 || block.headline2 ? (
          <div className="mb-14 md:mb-20">
            {block.headline1 ? (
              <p className="label-caps mb-2">{block.headline1}</p>
            ) : null}
            {block.headline2 ? (
              <h2 className="font-display text-3xl md:text-5xl leading-[1.1] tracking-[-0.01em] max-w-3xl">
                {block.headline2}
              </h2>
            ) : null}
            {block.description ? (
              <div className="mt-6 max-w-2xl">
                <PortableText value={block.description} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          className={`grid gap-10 md:gap-16 ${cols >= 4 ? "md:grid-cols-4" : cols === 3 ? "md:grid-cols-3" : cols === 2 ? "md:grid-cols-2" : "md:grid-cols-1"}`}
        >
          {items.map((item) => (
            <Column key={item._key} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Column({ item }: { item: VariableColumnItem }) {
  const img = item.fileReference ? imageUrl(item.fileReference, { width: 720 }) : undefined;
  return (
    <article className="flex flex-col">
      {img ? (
        <a
          href={item.imageLink ?? "#"}
          className="overflow-hidden rounded-[2px] bg-[color:var(--color-surface-container-low)]"
        >
          <img
            src={img}
            alt={item.headline ?? ""}
            className="aspect-[4/5] h-auto w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
            loading="lazy"
          />
        </a>
      ) : null}
      {item.headline ? (
        <h3 className="mt-6 font-display text-2xl leading-tight">{item.headline}</h3>
      ) : null}
      {item.columnText ? (
        <div className="mt-3">
          <PortableText value={item.columnText} />
        </div>
      ) : null}
      {item.cta && item.cta.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-4">
          {item.cta.map((cta) =>
            cta.type === "button" ? (
              <a
                key={cta._key}
                href={cta.link ?? "#"}
                aria-label={cta.ariaLabel}
                className="cta-satin inline-flex items-center px-5 py-2.5 font-body text-sm font-medium"
              >
                {cta.text}
              </a>
            ) : (
              <a
                key={cta._key}
                href={cta.link ?? "#"}
                aria-label={cta.ariaLabel}
                className="relative font-body text-sm text-[color:var(--color-primary)] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-full after:bg-[color:var(--color-primary)] after:transition-all after:duration-300 hover:after:w-0"
              >
                {cta.text}
              </a>
            ),
          )}
        </div>
      ) : null}
    </article>
  );
}
