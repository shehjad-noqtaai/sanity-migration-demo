import { imageUrl } from "../sanity.ts";
import type {
  FeatureCardBlock,
  FeatureCardMediaItem,
  PromoButton,
} from "../types.ts";
import { PortableText } from "./PortableText.tsx";

/**
 * Two-column feature row. AEM ships a `mediaItems[]` (each item with a
 * `visible: desktop|mobile` hint and optional `videoAssetPreviewImage`
 * poster); we use the first desktop-visible image, falling back to any
 * entry with a resolvable asset, then to the optional preview image.
 *
 * `layoutArrangement = img_left | img_right` flips the column order
 * (default: image right). `cardBackground` is rendered as a soft tinted
 * panel so adjacent feature cards alternate the way production renders.
 */
export function FeatureCard({ block }: { block: FeatureCardBlock }) {
  const media = pickMedia(block.mediaItems);
  const mediaUrl = media?.fileReference
    ? imageUrl(media.fileReference, { width: 1200 })
    : media?.videoAssetPreviewImage
      ? imageUrl(media.videoAssetPreviewImage, { width: 1200 })
      : undefined;

  const headline = block.headline?.trim();
  const overline = block.overline?.trim();
  const buttons = (block.buttons ?? []).filter((b) => b.text && b.link);
  const hasCopy = Boolean(headline || overline || block.bodyText?.length || buttons.length);

  if (!mediaUrl && !hasCopy) return null;

  const imageRight = block.layoutArrangement !== "img_left";
  const align =
    block.textAlign === "center"
      ? "text-center items-center"
      : block.textAlign === "right"
        ? "text-right items-end"
        : "text-left items-start";

  const pt = block.removeTopPadding ? "pt-2 md:pt-4" : "pt-10 md:pt-14";
  const pb = block.removeBottomPadding ? "pb-2 md:pb-4" : "pb-10 md:pb-14";
  const panel = panelClass(block.cardBackground);

  return (
    <section className={`bg-[color:var(--color-surface)] ${pt} ${pb}`}>
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        <div
          className={`grid items-stretch overflow-hidden rounded-lg ${panel} md:grid-cols-2`}
        >
          {mediaUrl ? (
            <div
              className={`relative aspect-[16/10] w-full md:aspect-auto md:min-h-[28rem] ${
                imageRight ? "md:order-2" : "md:order-1"
              }`}
            >
              <img
                src={mediaUrl}
                alt={media?.title ?? headline ?? ""}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null}

          {hasCopy ? (
            <div
              className={`flex flex-col justify-center gap-4 p-8 md:p-12 ${align} ${
                imageRight ? "md:order-1" : "md:order-2"
              }`}
            >
              {overline ? (
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-on-surface-muted)]">
                  {overline}
                </p>
              ) : null}
              {headline ? (
                <h3 className="text-2xl font-semibold leading-[1.12] tracking-[-0.01em] text-[color:var(--color-on-surface)] md:text-[2rem]">
                  {headline}
                </h3>
              ) : null}
              {block.bodyText?.length ? (
                <div className="max-w-prose text-base leading-relaxed text-[color:var(--color-on-surface-muted)]">
                  <PortableText value={block.bodyText} />
                </div>
              ) : null}
              {buttons.length ? (
                <div className="mt-2 flex flex-wrap gap-3">
                  {buttons.map((cta) => <Cta key={cta._key} cta={cta} />)}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function pickMedia(items?: FeatureCardMediaItem[]): FeatureCardMediaItem | undefined {
  if (!items?.length) return undefined;
  const desktop = items.find((m) => m.visible === "desktop" && (m.fileReference || m.videoAssetPreviewImage));
  if (desktop) return desktop;
  return items.find((m) => m.fileReference || m.videoAssetPreviewImage);
}

function panelClass(bg?: string): string {
  // AEM card-background tokens map onto our surface tokens. `secondaryLight`
  // is the warm cream tint shown in the screenshot; unknown values fall
  // back to muted surface so the card still reads as a panel.
  switch (bg) {
    case "secondaryLight":
      return "bg-[color:var(--color-surface-warm,var(--color-surface-muted))]";
    case "primaryLight":
      return "bg-[color:var(--color-primary-light,var(--color-surface-muted))]";
    case "white":
      return "bg-white";
    default:
      return "bg-[color:var(--color-surface-muted)]";
  }
}

function Cta({ cta }: { cta: PromoButton }) {
  const kind =
    cta.type === "button" ? "primary" : cta.type === "link" ? "link" : "outline";
  const base = "inline-flex items-center";
  const cls =
    kind === "primary"
      ? `cta-primary ${base}`
      : kind === "outline"
        ? `cta-outline ${base}`
        : `${base} text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--color-on-surface)] underline underline-offset-[6px] decoration-[color:var(--color-on-surface)]/40 hover:decoration-[color:var(--color-on-surface)] transition-colors duration-200`;
  return (
    <a href={cta.link ?? "#"} aria-label={cta.ariaLabel} className={cls}>
      {cta.text}
    </a>
  );
}
