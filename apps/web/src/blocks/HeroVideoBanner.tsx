import { useEffect, useState } from "react";
import { sanity, imageUrl } from "../sanity.ts";
import type { HeroVideoBannerBlock, SanityVideoPlayback } from "../types.ts";

/**
 * Video hero banner — autoplaying muted background video with up to
 * three overlay text lines. Mirrors the production layout: video on
 * one side, text panel on the other, panel positioned per
 * `contentPosition`.
 *
 * Video resolution: Sanity stores video assets via Mux; the playback
 * URL lives on the asset doc under `metadata.playbacks[].\_id`. We
 * dereference the asset to grab the public playback id and stream
 * via `https://stream.mux.com/{id}.m3u8`. Safari plays HLS natively;
 * other browsers show the poster (would need hls.js for full
 * playback — out of scope for the preview).
 *
 * `playWithSound` is intentionally ignored — autoplay with sound is
 * blocked by every modern browser without a user gesture, so we
 * always start muted regardless of the AEM toggle.
 */
export function HeroVideoBanner({ block }: { block: HeroVideoBannerBlock }) {
  const videoUrl = useVideoUrl(block.fileReference?.asset?._ref);
  const poster = block.thumbnail ? imageUrl(block.thumbnail, { width: 1400 }) : undefined;

  const right = block.contentPosition === "right";
  const center = block.contentPosition === "center";
  const align = block.textAlign ?? "left";
  const bg = block.textBackgroundColor ?? "var(--color-surface-cream)";
  const fg = block.textColor && block.textColor.startsWith("#") ? block.textColor : "var(--color-on-surface)";

  return (
    <section className="bg-[color:var(--color-surface)] py-10 md:py-14">
      <div
        className={`mx-auto grid max-w-[88rem] gap-0 px-6 md:px-10 ${center ? "md:grid-cols-1" : "md:grid-cols-2"}`}
      >
        {videoUrl || poster ? (
          <div
            className={`overflow-hidden rounded-lg bg-[color:var(--color-surface-muted)] ${right ? "md:order-2" : ""}`}
          >
            <video
              src={videoUrl}
              poster={poster}
              autoPlay={block.autoPlay !== false}
              loop={block.loopVideo !== false}
              muted
              playsInline
              className="h-full w-full object-cover aspect-[4/5] md:aspect-square"
            />
          </div>
        ) : null}
        <div
          className={`flex flex-col justify-center p-8 md:p-12 ${align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start text-left"}`}
          style={{ backgroundColor: bg, color: fg }}
        >
          {block.lineOneText ? (
            <p className="label-eyebrow mb-2" style={{ color: fg, opacity: 0.75 }}>
              {block.lineOneText}
            </p>
          ) : null}
          {block.lineTwoText ? (
            <h2
              className="text-3xl md:text-[2.5rem] font-light leading-[1.1] tracking-[-0.01em]"
              style={{ color: fg }}
            >
              {block.lineTwoText}
            </h2>
          ) : null}
          {block.lineThreeText ? (
            <p
              className="mt-4 max-w-prose text-base leading-relaxed"
              style={{ color: fg, opacity: 0.85 }}
            >
              {block.lineThreeText}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Resolve a Sanity video asset to a Mux HLS playback URL. Looks up the
 * asset doc to read `metadata.playbacks[]`, picks the first `public`
 * playback entry, and synthesizes the stream URL. Returns undefined
 * while the lookup is in flight or if no public playback is available
 * (signed-only assets need a separate token flow).
 */
function useVideoUrl(ref: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    sanity
      .fetch<{ playbacks?: SanityVideoPlayback[] } | null>(
        `*[_id == $id][0].metadata{playbacks}`,
        { id: ref },
      )
      .then((meta) => {
        if (cancelled) return;
        const publicPlayback = meta?.playbacks?.find((p) => p.policy === "public");
        if (publicPlayback?._id) {
          setUrl(`https://stream.mux.com/${publicPlayback._id}.m3u8`);
        }
      })
      .catch(() => {
        /* leave url undefined; poster still renders */
      });
    return () => {
      cancelled = true;
    };
  }, [ref]);
  return url;
}
