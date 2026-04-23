import type { PortableTextBlock } from "@portabletext/react";

export interface SanityImageRef {
  _type: "image" | "file";
  asset: { _type: "reference"; _ref: string };
}

export interface BaseBlock {
  _type: string;
  _key: string;
}

export interface PromoBgImage {
  _key: string;
  fileReference?: SanityImageRef;
  fileReferenceAemPath?: string;
  imageLink?: string;
  /** AEM authoring hint: which breakpoint this image is intended for. */
  visible?: "desktop" | "mobile" | string;
  alignment?: string;
}

export interface PromoButton {
  _key: string;
  text?: string;
  link?: string;
  /**
   * AEM button style hint. Real data uses `ghost` (outlined) and `link`
   * (inline text link); `button` is the filled-primary variant.
   */
  type?: "button" | "ghost" | "link" | string;
  ariaLabel?: string;
  buttonHexColor?: string;
  ctaTextHexColor?: string;
}

export interface PromoBlock extends BaseBlock {
  _type: "promo";
  headline1?: string;
  headline2?: string;
  description?: PortableTextBlock[];
  /** Legacy single-image shape, still rendered when bgImages isn't present. */
  fileReference?: SanityImageRef;
  fileReferenceAemPath?: string;
  imageLink?: string;
  link?: string;
  /** Responsive banner variants (desktop + mobile), authored as a multifield. */
  bgImages?: PromoBgImage[];
  /** CTA row. Multiple buttons, each with its own style hint. */
  buttons?: PromoButton[];
  tagLevel?: string;
  align?: "left" | "center" | "right";
  size?: string;
  theme?: string;
  backgroundColor?: string;
  copySize?: string;
}

export interface HrBlock extends BaseBlock {
  _type: "hr";
  mt?: number;
  mb?: number;
  ml?: number;
  mr?: number;
  pt?: number;
  pb?: number;
  pl?: number;
  pr?: number;
  color?: string;
}

export interface ColorCarouselItem {
  _key: string;
  name?: string;
  link?: string;
  fileReference?: SanityImageRef;
  fileReferenceAemPath?: string;
  hexValue?: string;
  description?: string;
}

export interface ColorCarouselBlock extends BaseBlock {
  _type: "colorCarousel";
  headline1?: string;
  headline2?: string;
  description?: PortableTextBlock[];
  colors?: ColorCarouselItem[];
  theme?: string;
  removeTopPadding?: boolean;
  removeBottomPadding?: boolean;
}

export interface VariableColumnItem {
  _key: string;
  headline?: string;
  imageLink?: string;
  fileReference?: SanityImageRef;
  fileReferenceAemPath?: string;
  columnText?: PortableTextBlock[];
  cta?: Array<{
    _key: string;
    type?: "button" | "link";
    text?: string;
    link?: string;
    ariaLabel?: string;
  }>;
}

export interface VariableColumnBlock extends BaseBlock {
  _type: "variableColumn";
  headline1?: string;
  headline2?: string;
  description?: PortableTextBlock[];
  columnContents?: VariableColumnItem[];
  columns?: string;
  removeTopPadding?: boolean;
  removeBottomPadding?: boolean;
}

/**
 * Sanity file ref (video, etc). Same shape as image but `_type: "file"`.
 */
export interface SanityFileRef {
  _type: "file";
  asset: { _type: "reference"; _ref: string };
}

export interface SanityVideoPlayback {
  _id: string;
  _key: string;
  policy?: "public" | "signed";
}

/**
 * Themed video hero with up to three overlay text lines and an optional
 * still-image poster. AEM authors choose which line acts as the
 * headline via `tagLevel`; we render line two as the prominent headline
 * by convention (matches what production renders).
 */
export interface HeroVideoBannerBlock extends BaseBlock {
  _type: "heroVideoBanner";
  fileReference?: SanityFileRef;
  fileReferenceAemPath?: string;
  thumbnail?: SanityImageRef;
  lineOneText?: string;
  lineTwoText?: string;
  lineThreeText?: string;
  lineOneTextColorHex?: string;
  lineTwoTextColorHex?: string;
  lineThreeTextColorHex?: string;
  textAlign?: "left" | "center" | "right";
  contentPosition?: "left" | "center" | "right";
  textBackgroundColor?: string;
  textColor?: string;
  fullWidth?: boolean;
  autoPlay?: boolean;
  loopVideo?: boolean;
  playWithSound?: boolean;
  showSoundIcon?: boolean;
  buttonHeightDesktop?: number;
  tagLevel?: string;
}

/**
 * UGC / curated gallery widget. Production embeds a third-party feed
 * (Crowdriff) via `galleryTag` (raw HTML); we render the headline and
 * a placeholder grid since the script doesn't run inside this preview.
 */
export interface GalleryBlock extends BaseBlock {
  _type: "gallery";
  headline1?: string;
  headline2?: string;
  galleryTag?: string;
  theme?: string;
  removeTopPadding?: boolean;
  removeBottomPadding?: boolean;
}

/**
 * Server-rendered product strip on production (catalog feed). The
 * authored block carries layout metadata only — actual products come
 * from the product service. We render the headline + a styled slot
 * placeholder so the page rhythm is preserved.
 */
export interface ProductCarouselBlock extends BaseBlock {
  _type: "productCarousel";
  headline1?: string;
  headline2?: string;
  description?: PortableTextBlock[];
  columns?: string;
  layoutWidth?: string;
  mobileLayout?: string;
  theme?: string;
  removeTopPadding?: boolean;
  removeBottomPadding?: boolean;
}

/**
 * Multi-icon row (e.g. measurement tips, value props). On the
 * inspiration page the actual icons aren't on the top-level block
 * (they live nested in a way our flat schema doesn't surface yet).
 * We render headline + a placeholder column count so the section
 * still occupies its intended footprint.
 */
export interface IconGridBlock extends BaseBlock {
  _type: "iconGrid";
  headline1?: string;
  headline2?: string;
  columns?: string;
  textAlign?: "left" | "center" | "right";
  theme?: string;
  removeTopPadding?: string | boolean;
  removeBottomPadding?: string | boolean;
}

/**
 * Fallback shape for any block this demo doesn't have a dedicated
 * renderer for. Kept separate from the discriminated union so TypeScript
 * can narrow the known `_type`s cleanly in the dispatcher switch.
 */
export interface UnknownBlock extends BaseBlock {
  [key: string]: unknown;
}

export type PageBlock =
  | PromoBlock
  | HrBlock
  | ColorCarouselBlock
  | VariableColumnBlock
  | HeroVideoBannerBlock
  | GalleryBlock
  | ProductCarouselBlock
  | IconGridBlock;

export interface PageDoc {
  _id: string;
  _type: "page";
  title?: string;
  slug?: { current: string };
  pageBuilder?: Array<PageBlock | UnknownBlock>;
}
