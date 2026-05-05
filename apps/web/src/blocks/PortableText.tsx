import { PortableText as PortableTextBase, type PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock } from "@portabletext/react";

/**
 * Shared Portable Text renderer. All headings/paragraphs fall back to the
 * single-family sans stack declared in `styles.css` (Inter stand-in for
 * Objektiv Mk2). No serif anywhere — matches the production site. Links
 * inherit the `primary` wine with a hover underline rather than a
 * persistent one; that keeps paragraph copy quiet.
 */
const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => (
      <p className="text-[1.0625rem] leading-[1.6] text-[color:var(--color-on-surface)] mb-5 last:mb-0">
        {children}
      </p>
    ),
    h1: ({ children }) => (
      <h1 className="text-4xl md:text-5xl font-light leading-[1.05] tracking-[-0.01em] mb-6">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-3xl md:text-4xl font-normal leading-[1.1] mb-5">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-2xl md:text-3xl font-medium leading-[1.15] mb-4">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-xl font-semibold leading-[1.3] mb-3">{children}</h4>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-[color:var(--color-accent-blush)] pl-6 my-6 italic text-lg leading-relaxed text-[color:var(--color-on-surface-muted)]">
        {children}
      </blockquote>
    ),
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    underline: ({ children }) => <span className="underline decoration-1 underline-offset-2">{children}</span>,
    link: ({ value, children }) => (
      <a
        href={value?.href ?? "#"}
        className="text-[color:var(--color-primary)] underline-offset-4 decoration-[1.5px] decoration-transparent hover:decoration-[color:var(--color-primary)] underline transition-colors duration-200"
      >
        {children}
      </a>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc pl-6 space-y-2 mb-5 marker:text-[color:var(--color-primary)]">
        {children}
      </ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal pl-6 space-y-2 mb-5 marker:text-[color:var(--color-on-surface-muted)]">
        {children}
      </ol>
    ),
  },
};

export function PortableText({ value }: { value?: PortableTextBlock[] }) {
  if (!value?.length) return null;
  const cleaned = value.filter((block) => {
    if (block._type !== "block") return true;
    const spans = (block as unknown as { children?: Array<{ text?: string }> }).children ?? [];
    return spans.some((s) => (s.text ?? "").trim().length > 0);
  });
  if (cleaned.length === 0) return null;
  return <PortableTextBase value={cleaned} components={components} />;
}
