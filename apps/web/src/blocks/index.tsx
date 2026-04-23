import type {
  ColorCarouselBlock,
  HrBlock,
  PromoBlock,
  UnknownBlock as UnknownBlockType,
  VariableColumnBlock,
} from "../types.ts";
import { ColorCarousel } from "./ColorCarousel.tsx";
import { Hr } from "./Hr.tsx";
import { Promo } from "./Promo.tsx";
import { UnknownBlock } from "./UnknownBlock.tsx";
import { VariableColumn } from "./VariableColumn.tsx";

/**
 * Dispatcher — maps a pageBuilder block's `_type` to its renderer. New
 * block types land here first as `UnknownBlock` (visible placeholder in
 * the UI), so missing primitives surface immediately instead of rendering
 * as blank space. We accept a loose record-shaped input (a Sanity doc's
 * pageBuilder item is genuinely opaque at the type system level) and cast
 * to the known block type per case — TS can't narrow `_type: string` to
 * a literal inside the switch, so explicit casts keep the dispatcher
 * concise without dropping safety at the block boundary.
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
    default:
      return <UnknownBlock block={block as UnknownBlockType} />;
  }
}
