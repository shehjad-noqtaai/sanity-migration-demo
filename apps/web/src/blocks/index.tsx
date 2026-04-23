import type {
  ColorCarouselBlock,
  GalleryBlock,
  HeroVideoBannerBlock,
  HrBlock,
  IconGridBlock,
  ProductCarouselBlock,
  PromoBlock,
  UnknownBlock as UnknownBlockType,
  VariableColumnBlock,
} from "../types.ts";
import { ColorCarousel } from "./ColorCarousel.tsx";
import { Gallery } from "./Gallery.tsx";
import { HeroVideoBanner } from "./HeroVideoBanner.tsx";
import { Hr } from "./Hr.tsx";
import { IconGrid } from "./IconGrid.tsx";
import { ProductCarousel } from "./ProductCarousel.tsx";
import { Promo } from "./Promo.tsx";
import { UnknownBlock } from "./UnknownBlock.tsx";
import { VariableColumn } from "./VariableColumn.tsx";

/**
 * Dispatcher — maps a pageBuilder block's `_type` to its renderer. The
 * input is a loose record (a Sanity pageBuilder item is genuinely opaque
 * at the type system level); each case casts to the known shape so the
 * dispatcher stays concise without dropping safety at the block boundary.
 *
 * Unknown `_type`s fall through to `UnknownBlock`, which itself silently
 * returns null when the block has no real content (avoids polluting the
 * page with placeholder rails for empty heroSlide / mediaParagraph
 * authoring artifacts).
 */
type AnyBlock = { _type: string; _key: string; [key: string]: unknown };

export function Block({ block }: { block: AnyBlock }) {
  switch (block._type) {
    case "promo":
      return <Promo block={block as unknown as PromoBlock} />;
    case "hr":
      return <Hr block={block as unknown as HrBlock} />;
    case "colorCarousel":
      return <ColorCarousel block={block as unknown as ColorCarouselBlock} />;
    case "variableColumn":
      return <VariableColumn block={block as unknown as VariableColumnBlock} />;
    case "heroVideoBanner":
      return <HeroVideoBanner block={block as unknown as HeroVideoBannerBlock} />;
    case "gallery":
      return <Gallery block={block as unknown as GalleryBlock} />;
    case "productCarousel":
      return <ProductCarousel block={block as unknown as ProductCarouselBlock} />;
    case "iconGrid":
      return <IconGrid block={block as unknown as IconGridBlock} />;
    default:
      return <UnknownBlock block={block as UnknownBlockType} />;
  }
}
