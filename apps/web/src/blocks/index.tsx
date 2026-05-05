import type {
  ColorCarouselBlock,
  ExpanderBlock,
  FaqHubBlock,
  FeatureCardBlock,
  GalleryBlock,
  HeroVideoBannerBlock,
  HrBlock,
  IconGridBlock,
  PhotoLayoutBlock,
  ProductCarouselBlock,
  PromoBlock,
  QuoteBlock,
  ResourcesColumnListBlock,
  SectionHeadlineBlock,
  UnknownBlock as UnknownBlockType,
  VariableColumnBlock,
} from "../types.ts";
import { ColorCarousel } from "./ColorCarousel.tsx";
import { Expander } from "./Expander.tsx";
import { FaqHub } from "./FaqHub.tsx";
import { FeatureCard } from "./FeatureCard.tsx";
import { Gallery } from "./Gallery.tsx";
import { HeroVideoBanner } from "./HeroVideoBanner.tsx";
import { Hr } from "./Hr.tsx";
import { IconGrid } from "./IconGrid.tsx";
import { PhotoLayout } from "./PhotoLayout.tsx";
import { ProductCarousel } from "./ProductCarousel.tsx";
import { Promo } from "./Promo.tsx";
import { Quote } from "./Quote.tsx";
import { ResourcesColumnList } from "./ResourcesColumnList.tsx";
import { SectionHeadline } from "./SectionHeadline.tsx";
import { UnknownBlock } from "./UnknownBlock.tsx";
import { VariableColumn } from "./VariableColumn.tsx";

/**
 * Dispatcher — maps a pageBuilder block's `_type` to its renderer.
 * The input is a loose record (a Sanity pageBuilder item is genuinely
 * opaque at the type system level); each case casts to the known shape
 * so the dispatcher stays concise without dropping safety at the block
 * boundary.
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
    case "faqHub":
      return <FaqHub block={block as unknown as FaqHubBlock} />;
    case "expander":
      return <Expander block={block as unknown as ExpanderBlock} />;
    case "quote":
      return <Quote block={block as unknown as QuoteBlock} />;
    case "resourcesColumnList":
      return (
        <ResourcesColumnList block={block as unknown as ResourcesColumnListBlock} />
      );
    case "sectionHeadline":
      return <SectionHeadline block={block as unknown as SectionHeadlineBlock} />;
    case "featureCard":
      return <FeatureCard block={block as unknown as FeatureCardBlock} />;
    case "photoLayout":
      return <PhotoLayout block={block as unknown as PhotoLayoutBlock} />;
    default:
      return <UnknownBlock block={block as UnknownBlockType} />;
  }
}
