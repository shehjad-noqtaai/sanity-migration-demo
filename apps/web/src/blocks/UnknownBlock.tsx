import type { UnknownBlock as UnknownBlockType } from "../types.ts";

/**
 * Fallback renderer for block types this preview doesn't have a
 * dedicated primitive for yet. Two modes:
 *
 *   - **Empty placeholder block** (only structural / config fields,
 *     no actual content) → render nothing. Common for blocks like
 *     `heroSlide` or `mediaParagraph` whose authored arrays are empty
 *     in this dataset; rendering a warning rail in that case adds
 *     visual noise without surfacing a real gap.
 *   - **Has content** (a headline, body, items, etc.) → render a
 *     small inline notice so the missing primitive is discoverable
 *     without taking over the page.
 */
const STRUCTURAL_KEYS = new Set([
  "_key",
  "_type",
  "fileReferenceAemPath",
  "removeTopPadding",
  "removeBottomPadding",
  "theme",
  "textAlign",
  "tagLevel",
  "alignment",
  "contentPosition",
  "fullWidth",
  "layoutWidth",
  "columns",
  "mobileLayout",
  "tabletIconPosition",
  "desktopIconPosition",
  "buttonsBlockHeight",
  "buttonHeightDesktop",
  "buttonHeightMobile",
  "type",
  "size",
  "copySize",
  "backgroundColor",
  "textBackgroundColor",
  "textColor",
  "textType",
  "imageServerUrl",
  "autoPlay",
  "loopVideo",
  "playWithSound",
  "showSoundIcon",
  "lineOneTextFontFamily",
  "lineTwoTextFontFamily",
  "lineThreeTextFontFamily",
]);

function hasContent(block: UnknownBlockType): boolean {
  for (const [key, value] of Object.entries(block)) {
    if (STRUCTURAL_KEYS.has(key)) continue;
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    return true;
  }
  return false;
}

export function UnknownBlock({ block }: { block: UnknownBlockType }) {
  if (!hasContent(block)) return null;
  return (
    <section className="border-t border-[color:var(--color-outline)] py-6">
      <div className="mx-auto max-w-[88rem] px-6 md:px-10">
        <p className="text-xs text-[color:var(--color-on-surface-muted)]">
          <code className="font-mono">_type: "{String(block._type)}"</code>
          <span className="mx-2 opacity-60">·</span>
          no dedicated renderer yet
        </p>
      </div>
    </section>
  );
}
