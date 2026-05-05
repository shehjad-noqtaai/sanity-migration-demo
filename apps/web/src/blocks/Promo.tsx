import { imageUrl } from "../sanity.ts";
import type { PromoBgImage, PromoBlock, PromoButton } from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * Promo — David's Bridal hero / feature banner.
 *
 * Real AEM data shape is responsive-banner-heavy:
 *   - `bgImages[]` carries desktop + mobile variants (each with a
 *     `visible: "desktop"|"mobile"` marker) that together become one
 *     responsive `<picture>`; the copy is typically baked into the
 *     image itself.
 *   - `buttons[]` renders as a CTA row below the banner. Each button
 *     carries a `type` hint — `button` (filled primary), `ghost`
 *     (outlined), `link` (inline tertiary).
 *   - `headline1` / `headline2` / `description` / `link` may all be
 *     empty on banner-style promos but present on text-heavy ones;
 *     each is rendered only when populated so both shapes degrade
 *     gracefully.
 *
 * Layout: full-width image band → optional copy → CTA row. No
 * overlapping / editorial tricks — production DB keeps copy on the
 * image and CTAs below.
 */
export function Promo({ block }: { block: PromoBlock }) {
  const desktopImage = pickImage(block.bgImages, ["desktop"]);
  const mobileImage = pickImage(block.bgImages, ["mobile"]);
  // Normalize the legacy top-level `fileReference` into a PromoBgImage
  // shape so the banner renderer takes a single type.
  const fallbackBanner: PromoBgImage | undefined = block.fileReference
    ? { _key: "__fallback", fileReference: block.fileReference }
    : undefined;
  const image = desktopImage ?? fallbackBanner;
  const imageLink = block.bgImages?.find((b) => b.imageLink)?.imageLink ?? block.link;

  const copy = {
    h1: block.headline1?.trim(),
    h2: block.headline2?.trim(),
    description: block.description,
  };
  const hasCopy = Boolean(copy.h1 || copy.h2 || copy.description?.length);

  const buttons = (block.buttons ?? []).filter((b) => b.text && b.link);
  const hasCtaRow = buttons.length > 0 || Boolean(block.link && !buttons.length);

  // Nothing to show? Render nothing (no empty placeholder rail).
  if (!image && !hasCopy && !hasCtaRow) return null;

  return (
    <section className="bg-[color:var(--color-surface)] py-10 md:py-14">
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        {image ? (
          <PromoBanner
            href={imageLink}
            desktop={image}
            mobile={mobileImage?.fileReference ? mobileImage : undefined}
            alt={copy.h1 ?? copy.h2 ?? ""}
          />
        ) : null}

        {hasCopy ? (
          <div
            className={`mt-8 max-w-3xl ${block.align === "center" ? "mx-auto text-center" : block.align === "right" ? "ml-auto text-right" : ""}`}
          >
            {copy.h1 ? (
              <h2 className="text-[2rem] md:text-[2.5rem] font-light leading-[1.08] tracking-[-0.01em] text-[color:var(--color-on-surface)]">
                {copy.h1}
              </h2>
            ) : null}
            {copy.h2 ? (
              <p className="mt-3 text-lg md:text-xl text-[color:var(--color-on-surface-muted)]">
                {copy.h2}
              </p>
            ) : null}
            {copy.description ? (
              <div className="mt-4">
                <PortableText value={copy.description} />
              </div>
            ) : null}
          </div>
        ) : null}

        {hasCtaRow ? (
          <div
            className={`mt-6 flex flex-wrap gap-3 ${block.align === "center" ? "justify-center" : block.align === "right" ? "justify-end" : ""}`}
          >
            {buttons.length > 0
              ? buttons.map((cta) => <Cta key={cta._key} cta={cta} />)
              : block.link
                ? (
                    <a href={block.link} className="cta-primary inline-flex items-center">
                      Shop now
                    </a>
                  )
                : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Pick the first `bgImages` entry whose `visible` marker is in the
 * allow-list AND whose `fileReference` resolves. Falls back to the
 * first entry with a `fileReference` if nothing in the allow-list
 * matches (handles the case where authors left `visible` blank).
 */
function pickImage(
  images: PromoBgImage[] | undefined,
  preferredVisibility: string[],
): PromoBgImage | undefined {
  if (!images?.length) return undefined;
  const preferred = images.find(
    (b) => b.fileReference && b.visible && preferredVisibility.includes(b.visible),
  );
  if (preferred) return preferred;
  return images.find((b) => b.fileReference);
}

function PromoBanner({
  href,
  desktop,
  mobile,
  alt,
}: {
  href?: string;
  desktop: PromoBgImage;
  mobile?: PromoBgImage;
  alt: string;
}) {
  const desktopUrl = desktop.fileReference ? imageUrl(desktop.fileReference, { width: 2160 }) : undefined;
  const mobileUrl = mobile?.fileReference ? imageUrl(mobile.fileReference, { width: 900 }) : undefined;
  if (!desktopUrl) return null;

  // Wrap in an anchor only when a destination is set — otherwise a
  // promo with no link still renders as a static banner.
  const content = (
    <picture>
      {mobileUrl ? <source media="(max-width: 767px)" srcSet={mobileUrl} /> : null}
      <img
        src={desktopUrl}
        alt={alt}
        className="h-auto w-full object-cover"
        loading="lazy"
      />
    </picture>
  );

  return (
    <div className="overflow-hidden rounded-lg bg-[color:var(--color-surface-muted)]">
      {href ? (
        <a href={href} aria-label={alt || undefined} className="block">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

function Cta({ cta }: { cta: PromoButton }) {
  // `button` → filled primary; `ghost` → outlined; `link` → tertiary
  // text link. AEM sometimes ships unknown hints; treat those as the
  // safer `ghost` default rather than a prominent filled CTA.
  const kind =
    cta.type === "button" ? "primary" : cta.type === "link" ? "link" : "outline";
  const base = "inline-flex items-center";
  const cls =
    kind === "primary"
      ? `cta-primary ${base}`
      : kind === "outline"
        ? `cta-outline ${base}`
        : `${base} text-sm font-medium text-[color:var(--color-primary)] underline underline-offset-4 decoration-transparent hover:decoration-[color:var(--color-primary)] transition-colors duration-200`;
  return (
    <a
      href={cta.link ?? "#"}
      aria-label={cta.ariaLabel}
      className={cls}
    >
      {cta.text}
    </a>
  );
}
