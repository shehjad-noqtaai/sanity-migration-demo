import { PortableText as PortableTextBase, type PortableTextComponents } from "@portabletext/react";
import type { PortableTextBlock } from "@portabletext/react";

/**
 * Shared Portable Text renderer. Keeps the block-level type ramp and link
 * treatment in one place so every richtext field in the home page (promo
 * descriptions, columnText in variableColumn, etc.) picks up the same
 * editorial voice — serif for h1/h2, Manrope for body, `primary` for links
 * with the expanding-underline per DESIGN.md §5 Tertiary CTA.
 */
const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => (
      <p className="text-[1.0625rem] leading-[1.7] text-[color:var(--color-on-surface)]/85 mb-5 last:mb-0">
        {children}
      </p>
    ),
    h1: ({ children }) => (
      <h1 className="font-display text-4xl md:text-5xl leading-[1.05] tracking-[-0.01em] mb-6">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="font-display text-3xl md:text-4xl leading-[1.1] mb-5">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-display text-2xl md:text-3xl leading-[1.15] mb-4">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="font-body font-semibold text-xl leading-[1.3] mb-3">{children}</h4>
    ),
    blockquote: ({ children }) => (
      <blockquote className="font-display italic text-xl leading-relaxed my-6 pl-6 text-[color:var(--color-on-surface-variant)]">
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
        className="relative text-[color:var(--color-primary)] no-underline after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-[color:var(--color-primary)] after:transition-all after:duration-300 hover:after:w-full"
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
      <ol className="list-decimal pl-6 space-y-2 mb-5 marker:text-[color:var(--color-on-surface-variant)]">
        {children}
      </ol>
    ),
  },
};

export function PortableText({ value }: { value?: PortableTextBlock[] }) {
  if (!value?.length) return null;
  // Strip fully-empty blocks — AEM richtext fields almost always arrive
  // with a handful of `<p>&nbsp;</p>` blocks prepended; rendering them as
  // empty paragraphs wrecks the careful vertical rhythm.
  const cleaned = value.filter((block) => {
    if (block._type !== "block") return true;
    const spans = (block as unknown as { children?: Array<{ text?: string }> }).children ?? [];
    return spans.some((s) => (s.text ?? "").trim().length > 0);
  });
  if (cleaned.length === 0) return null;
  return <PortableTextBase value={cleaned} components={components} />;
}
