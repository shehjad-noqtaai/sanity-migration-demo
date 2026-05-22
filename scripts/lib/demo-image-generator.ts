/**
 * Procedural animated GIFs for the committed demo tenant — no AEM downloads,
 * no customer photography or UI screenshots with text.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { GIFEncoder, applyPalette, quantize } from "gifenc";

export type DemoLayoutKind =
  | "icon"
  | "hero-desktop"
  | "hero-mobile"
  | "hero-tablet"
  | "banner-wide"
  | "tile-circle"
  | "partner"
  | "module"
  | "event"
  | "content"
  | "thumbnail"
  | "site-b";

export const DEMO_LAYOUT_KINDS: DemoLayoutKind[] = [
  "icon",
  "hero-desktop",
  "hero-mobile",
  "hero-tablet",
  "banner-wide",
  "tile-circle",
  "partner",
  "module",
  "event",
  "content",
  "thumbnail",
  "site-b",
];

const LAYOUT_SIZE: Record<DemoLayoutKind, [number, number]> = {
  icon: [128, 128],
  "hero-desktop": [960, 300],
  "hero-mobile": [480, 640],
  "hero-tablet": [768, 432],
  "banner-wide": [960, 240],
  "tile-circle": [400, 400],
  partner: [336, 504],
  module: [720, 450],
  event: [960, 540],
  content: [800, 500],
  thumbnail: [320, 240],
  "site-b": [800, 500],
};

const PALETTES: Record<DemoLayoutKind, Array<[number, number, number]>> = {
  icon: [
    [37, 99, 235],
    [14, 165, 233],
    [99, 102, 241],
  ],
  "hero-desktop": [
    [30, 64, 175],
    [59, 130, 246],
    [96, 165, 250],
  ],
  "hero-mobile": [
    [6, 78, 59],
    [16, 185, 129],
    [52, 211, 153],
  ],
  "hero-tablet": [
    [76, 29, 149],
    [124, 58, 237],
    [167, 139, 250],
  ],
  "banner-wide": [
    [154, 52, 18],
    [234, 88, 12],
    [251, 146, 60],
  ],
  "tile-circle": [
    [190, 24, 93],
    [236, 72, 153],
    [244, 114, 182],
  ],
  partner: [
    [21, 94, 117],
    [8, 145, 178],
    [34, 211, 238],
  ],
  module: [
    [55, 48, 163],
    [79, 70, 229],
    [129, 140, 248],
  ],
  event: [
    [88, 28, 135],
    [168, 85, 247],
    [192, 132, 252],
  ],
  content: [
    [71, 85, 105],
    [100, 116, 139],
    [148, 163, 184],
  ],
  thumbnail: [
    [15, 118, 110],
    [20, 184, 166],
    [45, 212, 191],
  ],
  "site-b": [
    [127, 29, 29],
    [220, 38, 38],
    [248, 113, 113],
  ],
};

const FRAME_COUNT = 12;
const FRAME_DELAY_MS = 90;

/** Classify a scrubbed DAM path (pre-generated canonical path) into a layout bucket. */
export function classifyDemoLayout(scrubbedPath: string): DemoLayoutKind {
  const p = scrubbedPath.toLowerCase();

  if (p.includes("/site-b/") || p.startsWith("/content/dam/demo/site-b")) {
    if (p.includes("desktop")) return "hero-desktop";
    if (p.includes("mobile")) return "hero-mobile";
    if (p.includes("thumbnail")) return "thumbnail";
    if (p.includes("/_icons/") || p.includes("icon") || p.endsWith(".png")) return "icon";
    return "site-b";
  }

  if (p.includes("/_icons/") || /\/[^/]*icon[^/]*\.(png|jpg|gif|svg)/i.test(scrubbedPath)) {
    return "icon";
  }
  if (p.includes("desktop") || p.includes("_desktop")) return "hero-desktop";
  if (p.includes("mobile") || p.includes("_mobile")) return "hero-mobile";
  if (p.includes("tablet")) return "hero-tablet";
  if (p.includes("site-promos") || p.includes("hp-banner") || p.includes("hp-banners")) {
    return "banner-wide";
  }
  if (p.includes("circle") || p.includes("_sbc") || p.includes("sbc_")) return "tile-circle";
  if (p.includes("partners/") || p.includes("our_partners")) return "partner";
  if (p.includes("/events/") || p.includes("-lp/")) return "event";
  if (p.includes("module")) return "module";
  if (p.includes("thumbnail")) return "thumbnail";
  if (p.includes("faq/") || p.includes("appointment-faq")) return "content";
  return "content";
}

export function generatedDamPath(kind: DemoLayoutKind): string {
  return `/content/dam/demo/_generated/${kind}.gif`;
}

function renderFrame(
  kind: DemoLayoutKind,
  width: number,
  height: number,
  frame: number,
): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  const colors = PALETTES[kind];
  const t = frame / FRAME_COUNT;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const nx = x / width;
      const ny = y / height;
      let r = 0;
      let g = 0;
      let b = 0;

      if (kind === "icon") {
        const cx = 0.5;
        const cy = 0.5;
        const dist = Math.hypot(nx - cx, ny - cy);
        const ring = Math.sin((dist * 14 - t * 6) * Math.PI) * 0.5 + 0.5;
        const c = colors[Math.floor(ring * colors.length) % colors.length]!;
        r = c[0];
        g = c[1];
        b = c[2];
      } else if (kind === "tile-circle") {
        const cx = 0.5;
        const cy = 0.5;
        const dist = Math.hypot(nx - cx, ny - cy);
        if (dist > 0.48) {
          r = 245;
          g = 247;
          b = 250;
        } else {
          const angle = Math.atan2(ny - cy, nx - cx);
          const band = Math.sin(angle * 3 + t * Math.PI * 2) * 0.5 + 0.5;
          const c = colors[Math.floor(band * colors.length) % colors.length]!;
          r = c[0];
          g = c[1];
          b = c[2];
        }
      } else if (kind === "banner-wide" || kind === "hero-desktop") {
        const wave = Math.sin((nx * 4 + t * 2) * Math.PI) * 0.5 + 0.5;
        const c = colors[Math.floor(wave * colors.length) % colors.length]!;
        r = c[0];
        g = c[1];
        b = c[2];
      } else if (kind === "hero-mobile" || kind === "partner") {
        const wave = Math.sin((ny * 3 + t * 2) * Math.PI) * 0.5 + 0.5;
        const c = colors[Math.floor(wave * colors.length) % colors.length]!;
        r = c[0];
        g = c[1];
        b = c[2];
      } else {
        const mix = (nx + ny + t) % 1;
        const c1 = colors[0]!;
        const c2 = colors[1]!;
        const c3 = colors[2]!;
        if (mix < 0.33) {
          r = c1[0];
          g = c1[1];
          b = c1[2];
        } else if (mix < 0.66) {
          r = c2[0];
          g = c2[1];
          b = c2[2];
        } else {
          r = c3[0];
          g = c3[1];
          b = c3[2];
        }
        const ripple = Math.sin((nx * 6 + ny * 4 + t * 4) * Math.PI) * 20;
        r = Math.min(255, Math.max(0, r + ripple));
        g = Math.min(255, Math.max(0, g + ripple));
        b = Math.min(255, Math.max(0, b + ripple));
      }

      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = 255;
    }
  }

  return rgba;
}

export function writeAnimatedLayoutGif(destFile: string, kind: DemoLayoutKind): void {
  const [width, height] = LAYOUT_SIZE[kind];
  const gif = GIFEncoder();

  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    const rgba = renderFrame(kind, width, height, frame);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, width, height, {
      palette,
      delay: FRAME_DELAY_MS,
      repeat: 0,
    });
  }

  gif.finish();
  mkdirSync(dirname(destFile), { recursive: true });
  writeFileSync(destFile, Buffer.from(gif.bytes()));
}
