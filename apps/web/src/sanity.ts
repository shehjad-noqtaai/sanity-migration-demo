import { createClient, type SanityClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";

/**
 * Public-read Sanity client. No token — the demo only reads published docs
 * from the dataset the migration pipeline writes to. Follow the same
 * pattern as `hydrogen-sanity`'s `createSanityContext` for SSR setups when
 * the project grows: env-driven config + single-flight fetch cache. Keeping
 * it minimal here since this runs in the browser.
 */
const projectId = import.meta.env.VITE_SANITY_PROJECT_ID as string | undefined;
const dataset = (import.meta.env.VITE_SANITY_DATASET as string | undefined) ?? "production";

if (!projectId) {
  throw new Error(
    "VITE_SANITY_PROJECT_ID is not set. Populate apps/web/.env (or examples/davids-bridal/.env — the dev server falls back to it).",
  );
}

/**
 * In dev, route every Sanity API call through the Vite server's `/sanity-api`
 * proxy so the browser never issues a cross-origin request directly to
 * `*.apicdn.sanity.io`. That avoids needing to register `http://localhost:4321`
 * as a CORS origin on every Sanity project the demo points at. In prod the
 * client talks to the CDN subdomain directly (the default behavior).
 */
const proxyHost =
  import.meta.env.DEV && typeof window !== "undefined"
    ? `${window.location.origin}/sanity-api`
    : undefined;

export const sanity: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion: "2024-01-01",
  useCdn: true,
  perspective: "published",
  ...(proxyHost ? { apiHost: proxyHost, useProjectHostname: false } : {}),
});

const builder = imageUrlBuilder(sanity);

/**
 * Small image URL helper. Every block that holds a `fileReference`-shaped
 * Sanity image ref goes through here so CDN params (width, quality,
 * format) stay consistent across blocks.
 */
export function imageUrl(
  source: SanityImageSource,
  opts: { width?: number; quality?: number } = {},
): string {
  let u = builder.image(source);
  if (opts.width) u = u.width(opts.width);
  u = u.quality(opts.quality ?? 82).auto("format");
  return u.url();
}
