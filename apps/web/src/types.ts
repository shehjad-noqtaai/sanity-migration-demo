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
  | VariableColumnBlock;

export interface PageDoc {
  _id: string;
  _type: "page";
  title?: string;
  slug?: { current: string };
  pageBuilder?: Array<PageBlock | UnknownBlock>;
}
