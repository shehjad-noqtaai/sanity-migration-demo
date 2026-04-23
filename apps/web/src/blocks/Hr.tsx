import type { HrBlock } from "../types.ts";

/**
 * HR — spacing divider. DESIGN.md forbids 1px borders for section breaks,
 * so we render a transparent gap when `color === "transparent"` (the
 * overwhelmingly common authored value) and a subtle tonal band otherwise.
 * Author-set padding values from AEM come through as numbers; we interpret
 * them as Tailwind's spacing scale (× 4 = px) capped to the max scale.
 */
function toSpacingClass(n: number | undefined, prefix: string): string {
  if (!n) return "";
  const rem = Math.min(n, 40);
  return `${prefix}-[${rem * 0.25}rem]`;
}

export function Hr({ block }: { block: HrBlock }) {
  const isTransparent = (block.color ?? "transparent") === "transparent";
  const pad = [
    toSpacingClass(block.pt, "pt"),
    toSpacingClass(block.pb, "pb"),
    toSpacingClass(block.mt, "mt"),
    toSpacingClass(block.mb, "mb"),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`${pad} ${isTransparent ? "" : "bg-[color:var(--color-surface-container-low)]"} `}
    />
  );
}
