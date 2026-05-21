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

export interface FaqHubNestedLink {
  _key: string;
  text?: string;
  link?: string;
}

export interface FaqHubSection {
  _key: string;
  sectionTitle?: string;
  fileReference?: SanityImageRef;
  fileReferenceAemPath?: string;
  nestedLinks?: FaqHubNestedLink[];
}

export interface FaqHubBlock extends BaseBlock {
  _type: "faqHub";
  headline1?: string;
  headline2?: string;
  description?: PortableTextBlock[];
  sections?: FaqHubSection[];
  buttons?: PromoButton[];
  removeTopPadding?: boolean;
  removeBottomPadding?: boolean;
}

/**
 * AEM `box` / `content` widget — generic rich-text container. Carries
 * the rendered text on its `text` field (Portable Text after the
 * registry-driven coercion; legacy migrations may still have the raw
 * HTML string). Used inside `expander` items.
 *
 * `panelTitle` is the optional heading for accordion / expander panels
 * (lifted from AEM's `cq:panelTitle`). Present on the wrapping box only
 * when the component is used as a panel child.
 *
 * `items` is the container-children array discovered by the schema
 * walker — when the box wraps another `content` node, the actual text
 * lives one level deeper rather than directly on the box.
 */
export interface AemBoxLike {
  _key: string;
  text?: string | PortableTextBlock[];
  align?: string;
  fontFamily?: string;
  fontWeight?: string;
  panelTitle?: string;
  items?: AemBoxLike[];
}

export interface ExpanderItem {
  _key: string;
  content?: AemBoxLike;
  /** AEM stores the box content under variable keys like `content_1747537251_c`. */
  [contentKey: string]: unknown;
}

export interface ExpanderBlock extends BaseBlock {
  _type: "expander";
  /**
   * Modern shape: container-children walker emits panel boxes here.
   * Legacy shape (pre-slot-discovery): first item under `box`, the rest
   * under variable `item_*` keys.
   */
  items?: AemBoxLike[];
  box?: ExpanderItem;
  expandedItems?: string[];
  headline1?: string;
  headline2?: string;
  removeTopPadding?: boolean;
  removeBottomPadding?: boolean;
  [itemKey: string]: unknown;
}

export interface QuoteBlock extends BaseBlock {
  _type: "quote";
  quote?: PortableTextBlock[];
  align?: "left" | "center" | "right";
  size?: string;
  theme?: string;
  backgroundColor?: string;
  quotationMarksEnabled?: boolean;
}

/**
 * Centered text-only section break — `headline2` is the prominent
 * display headline (David's Bridal pattern), `description` is a
 * supporting paragraph.
 */
export interface SectionHeadlineBlock extends BaseBlock {
  _type: "sectionHeadline";
  headline1?: string;
  headline2?: string;
  description?: PortableTextBlock[];
  theme?: string;
  removeTopPadding?: boolean;
  removeBottomPadding?: boolean;
}

export interface FeatureCardMediaItem {
  _key: string;
  fileReference?: SanityImageRef;
  fileReferenceAemPath?: string;
  visible?: "desktop" | "mobile" | string;
  title?: string;
  videoAssetPreviewImage?: SanityImageRef;
}

/**
 * Editorial photo block — three numbered image slots with optional
 * per-image links and labels, paired with a headline block (title +
 * sansSerifHeadline + description) at the top and a free-text copy
 * block (`imageText2`) that pairs with the middle image. AEM serializes
 * the slots as flat `fileReferenceN` / `imageLinkN` / `linkN` /
 * `linkTitleN` properties; we render whatever the author populated and
 * skip the rest.
 */
export interface PhotoLayoutBlock extends BaseBlock {
  _type: "photoLayout";
  headline1?: string;
  headline2?: string;
  sansSerifHeadline?: string;
  description?: PortableTextBlock[];
  imageText2?: PortableTextBlock[];
  fileReference1?: SanityImageRef;
  fileReference2?: SanityImageRef;
  fileReference3?: SanityImageRef;
  fileReference1AemPath?: string;
  fileReference2AemPath?: string;
  fileReference3AemPath?: string;
  imageLink1?: string;
  imageLink2?: string;
  imageLink3?: string;
  link1?: string;
  link2?: string;
  link3?: string;
  linkTitle1?: string;
  linkTitle2?: string;
  linkTitle3?: string;
  theme?: string;
  mobileLayout?: string;
  removeTopPadding?: boolean;
  removeBottomPadding?: boolean;
}

/**
 * Two-column feature row (image one side, copy + CTA on the other).
 * `layoutArrangement` decides which side the image lands on.
 */
export interface FeatureCardBlock extends BaseBlock {
  _type: "featureCard";
  headline?: string;
  overline?: string;
  bodyText?: PortableTextBlock[];
  mediaItems?: FeatureCardMediaItem[];
  buttons?: PromoButton[];
  layoutArrangement?: "img_left" | "img_right" | string;
  layoutType?: string;
  textAlign?: "left" | "center" | "right";
  cardBackground?: string;
  theme?: string;
  removeTopPadding?: boolean;
  removeBottomPadding?: boolean;
}

export interface ResourcesColumnListBlock extends BaseBlock {
  _type: "resourcesColumnList";
  removeTopPadding?: boolean;
  removeBottomPadding?: boolean;
  /** AEM nests one item under the static key `resources-column-item`. */
  "resources-column-item"?: { _key: string; content?: AemBoxLike; [k: string]: unknown };
  [columnKey: string]: unknown;
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
  | IconGridBlock
  | FaqHubBlock
  | ExpanderBlock
  | QuoteBlock
  | ResourcesColumnListBlock
  | SectionHeadlineBlock
  | FeatureCardBlock
  | PhotoLayoutBlock;

export interface PageDoc {
  _id: string;
  /**
   * `"page"` for tenants using the generic fallback document, or one of
   * the per-template names (e.g. `"spaPageTemplatePage"`,
   * `"planDetailsPage"`) when the tenant declared page-shells in
   * `aem-page-components.json`. The preview renders the same way
   * regardless — the discriminant matters for Studio structure, not for
   * frontend rendering.
   */
  _type: string;
  title?: string;
  slug?: { current: string };
  pageBuilder?: Array<PageBlock | UnknownBlock>;
  /**
   * Page-shell dialog values lifted from AEM `jcr:content` (e.g.
   * `pageTitle`, `navTitle`, `pwaOrientation`, `disableCache`). Present
   * only on per-template documents. Not rendered by the preview today,
   * but available for `<title>` / nav / metadata wiring as the demo grows.
   */
  pageProperties?: Record<string, unknown>;
  /** Lifted from AEM `jcr:content/cq:featuredimage`. Per-template docs only. */
  featuredImage?: SanityImageRef;
  /** Original AEM `cq:template` path; useful for debugging. */
  cqTemplate?: string;
}
