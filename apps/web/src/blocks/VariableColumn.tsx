import { imageUrl } from "../sanity.ts";
import type { VariableColumnBlock, VariableColumnItem } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * Variable column — multi-item editorial row. Production DB uses these
 * for "From our blog" / "Shop the look" / "Real stories" strips: full-
 * width on mobile, 2-4 columns on desktop, cards on `surface` with soft
 * corners. Separation is whitespace; no hairlines or shadow stacks.
 */
export function VariableColumn({ block }: { block: VariableColumnBlock }) {
  const items = block.columnContents ?? [];
  const cols = Math.min(items.length, 4);

  return (
    <section
      className={`bg-[color:var(--color-surface)] ${block.removeTopPadding ? "pt-4" : "pt-16 md:pt-20"} ${block.removeBottomPadding ? "pb-4" : "pb-16 md:pb-20"}`}
    >
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        {block.headline1 || block.headline2 ? (
          <div className="mb-10 md:mb-14">
            {block.headline1 ? <p className="label-eyebrow mb-2">{block.headline1}</p> : null}
            {block.headline2 ? (
              <h2 className="text-3xl md:text-[2.5rem] font-normal leading-[1.1] max-w-3xl text-[color:var(--color-on-surface)]">
                {block.headline2}
              </h2>
            ) : null}
            {block.description ? (
              <div className="mt-4 max-w-2xl text-[color:var(--color-on-surface-muted)]">
                <PortableText value={block.description} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          className={`grid gap-8 md:gap-10 ${cols >= 4 ? "md:grid-cols-4" : cols === 3 ? "md:grid-cols-3" : cols === 2 ? "md:grid-cols-2" : "md:grid-cols-1"}`}
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
          className="overflow-hidden rounded-lg bg-[color:var(--color-surface-muted)]"
        >
          <img
            src={img}
            alt={item.headline ?? ""}
            className="aspect-[4/5] h-auto w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
            loading="lazy"
          />
        </a>
      ) : null}
      {item.headline ? (
        <h3 className="mt-5 text-xl font-medium leading-tight text-[color:var(--color-on-surface)]">
          {item.headline}
        </h3>
      ) : null}
      {item.columnText ? (
        <div className="mt-2 text-[color:var(--color-on-surface-muted)]">
          <PortableText value={item.columnText} />
        </div>
      ) : null}
      {item.cta && item.cta.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {item.cta.map((cta) =>
            cta.type === "button" ? (
              <a
                key={cta._key}
                href={cta.link ?? "#"}
                aria-label={cta.ariaLabel}
                className="cta-primary inline-flex items-center"
              >
                {cta.text}
              </a>
            ) : (
              <a
                key={cta._key}
                href={cta.link ?? "#"}
                aria-label={cta.ariaLabel}
                className="text-sm font-medium text-[color:var(--color-primary)] underline underline-offset-4 decoration-transparent hover:decoration-[color:var(--color-primary)] transition-colors duration-200"
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
