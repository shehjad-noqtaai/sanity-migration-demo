import { imageUrl } from "../sanity.ts";
import type { PhotoLayoutBlock, SanityImageRef } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * Editorial photo block. AEM stores three numbered image slots
 * (`fileReference1..3`) with optional per-slot links + label text. We
 * render a centered headline section at the top, then a two-column
 * editorial layout below that pairs the available images with the
 * copy: image 1 sits beside the body text + image 2 (paired with
 * `imageText2`); image 3 closes the section as a full-width CTA tile
 * when present.
 *
 * Slots without a `fileReference` are skipped silently — common when
 * the author only populated some of the three.
 */
export function PhotoLayout({ block }: { block: PhotoLayoutBlock }) {
  const headline = block.headline2?.trim();
  const eyebrow = block.headline1?.trim();
  const subhead = block.sansSerifHeadline?.trim();

  const slot1 = pickSlot(block, 1);
  const slot2 = pickSlot(block, 2);
  const slot3 = pickSlot(block, 3);

  const hasHeader = Boolean(eyebrow || headline || subhead || block.description?.length);
  const hasMedia = Boolean(slot1 || slot2 || slot3 || block.imageText2?.length);
  if (!hasHeader && !hasMedia) return null;

  const pt = block.removeTopPadding ? "pt-2 md:pt-4" : "pt-12 md:pt-20";
  const pb = block.removeBottomPadding ? "pb-2 md:pb-4" : "pb-12 md:pb-20";

  return (
    <section className={`bg-[color:var(--color-surface)] ${pt} ${pb}`}>
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        {hasHeader ? (
          <header className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
            {eyebrow ? (
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-on-surface-muted)]">
                {eyebrow}
              </p>
            ) : null}
            {headline ? (
              <h2 className="mt-3 text-[2rem] font-semibold leading-[1.08] tracking-[-0.01em] text-[color:var(--color-on-surface)] md:text-[3rem]">
                {headline}
              </h2>
            ) : null}
            {subhead ? (
              <p className="mt-4 text-base text-[color:var(--color-on-surface-muted)] md:text-lg">
                {subhead}
              </p>
            ) : null}
            {block.description?.length ? (
              <div className="mt-4 text-base leading-relaxed text-[color:var(--color-on-surface-muted)] md:text-lg">
                <PortableText value={block.description} />
              </div>
            ) : null}
          </header>
        ) : null}

        {hasMedia ? (
          <div className="grid gap-6 md:grid-cols-2 md:gap-10">
            {slot1 ? <SlotTile slot={slot1} aspect="aspect-[3/4]" priority /> : null}
            <div className="flex flex-col gap-6">
              {block.imageText2?.length ? (
                <div className="text-base leading-relaxed text-[color:var(--color-on-surface-muted)] md:text-lg [&_p]:mb-3 [&_p:last-child]:mb-0">
                  <PortableText value={block.imageText2} />
                </div>
              ) : null}
              {slot2 ? <SlotTile slot={slot2} aspect="aspect-square" /> : null}
              {slot3 ? <SlotTile slot={slot3} aspect="aspect-[4/3]" /> : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface ResolvedSlot {
  image: SanityImageRef;
  href?: string;
  label?: string;
  alt: string;
}

function pickSlot(block: PhotoLayoutBlock, n: 1 | 2 | 3): ResolvedSlot | undefined {
  // Same-keyed properties as numbered fields. Cast to a record so we can
  // index by computed key without a sprawling switch.
  const rec = block as unknown as Record<string, unknown>;
  const image = rec[`fileReference${n}`] as SanityImageRef | undefined;
  if (!image) return undefined;
  const href =
    (rec[`imageLink${n}`] as string | undefined) ??
    (rec[`link${n}`] as string | undefined);
  const label = rec[`linkTitle${n}`] as string | undefined;
  return {
    image,
    href: href?.trim() || undefined,
    label: label?.trim() || undefined,
    alt: label?.trim() || block.headline2?.trim() || "",
  };
}

function SlotTile({
  slot,
  aspect,
  priority,
}: {
  slot: ResolvedSlot;
  aspect: string;
  priority?: boolean;
}) {
  const url = imageUrl(slot.image, { width: 1200 });
  const tile = (
    <figure className="group relative overflow-hidden rounded-lg bg-[color:var(--color-surface-muted)]">
      <div className={`relative w-full ${aspect}`}>
        <img
          src={url}
          alt={slot.alt}
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </div>
      {slot.label ? (
        <figcaption className="px-5 py-4 text-sm font-medium uppercase tracking-[0.16em] text-[color:var(--color-on-surface)]">
          {slot.label}
        </figcaption>
      ) : null}
    </figure>
  );
  return slot.href ? (
    <a href={slot.href} aria-label={slot.label ?? (slot.alt || undefined)} className="block">
      {tile}
    </a>
  ) : (
    tile
  );
}
