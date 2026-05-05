import { imageUrl } from "../sanity.ts";
import type { FaqHubBlock, FaqHubSection } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * FAQ hub — the canonical block on /faq. A grid of section cards
 * (returns & exchanges, your order, your account, …), each with an
 * icon, a title, and a list of nested links to the actual answer
 * pages. Production handles deep-link routing; the preview just
 * surfaces the link text + href so the page structure is faithful.
 */
export function FaqHub({ block }: { block: FaqHubBlock }) {
  const sections = block.sections ?? [];
  return (
    <section
      className={`bg-[color:var(--color-surface)] ${block.removeTopPadding ? "pt-4" : "pt-12 md:pt-16"} ${block.removeBottomPadding ? "pb-4" : "pb-16 md:pb-20"}`}
    >
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        {block.headline1 ? (
          <h1 className="text-3xl md:text-[2.5rem] font-light leading-[1.1] tracking-[-0.01em] capitalize text-[color:var(--color-on-surface)]">
            {block.headline1}
          </h1>
        ) : null}
        {block.description ? (
          <div className="mt-3 max-w-2xl text-[color:var(--color-on-surface-muted)]">
            <PortableText value={block.description} />
          </div>
        ) : null}

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 md:gap-8">
          {sections.map((section) => (
            <FaqSection key={section._key} section={section} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ section }: { section: FaqHubSection }) {
  const icon = section.fileReference ? imageUrl(section.fileReference, { width: 96 }) : undefined;
  const links = section.nestedLinks ?? [];
  return (
    <article className="rounded-lg bg-[color:var(--color-surface-cream)] p-6 md:p-7">
      <header className="flex items-center gap-3">
        {icon ? (
          <img
            src={icon}
            alt=""
            aria-hidden
            className="h-10 w-10 object-contain"
            loading="lazy"
          />
        ) : (
          <span
            aria-hidden
            className="h-10 w-10 rounded-full bg-[color:var(--color-surface-muted)]"
          />
        )}
        {section.sectionTitle ? (
          <h2 className="text-base font-semibold uppercase tracking-wide text-[color:var(--color-on-surface)]">
            {section.sectionTitle}
          </h2>
        ) : null}
      </header>
      {links.length > 0 ? (
        <ul className="mt-5 space-y-3 text-sm">
          {links.map((link) => (
            <li key={link._key}>
              <a
                href={link.link ? `/${link.link.replace(/^\/+/, "")}` : "#"}
                className="text-[color:var(--color-on-surface)] hover:text-[color:var(--color-primary)] transition-colors"
              >
                {link.text ?? link.link}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
