/**
 * YouTube iframe embed used by editor and streaming chat surfaces.
 *
 * @packageDocumentation \@beep/editor/youtube-embed
 * @since 0.0.0
 */
"use client";

import type { JSX } from "react";

const youtubeEmbedUrl = (videoID: string): string => `https://www.youtube-nocookie.com/embed/${videoID}`;

const youtubeWatchUrl = (videoID: string): string => `https://www.youtube.com/watch?v=${videoID}`;

/**
 * Least-privilege frame policy. The embed is model-controlled content, so the
 * frame gets only what playback needs: scripts, its own origin (which is
 * YouTube's, not ours), fullscreen presentation, and the ability to open the
 * video in a new tab. It cannot navigate the top-level page or submit forms.
 */
const YOUTUBE_SANDBOX =
  "allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox";

/**
 * Renders a privacy-enhanced YouTube iframe from a bare video id.
 *
 * @remarks
 * A watch link sits under the player because an embed can refuse to play for
 * reasons the app cannot see or fix — an uploader who disabled embedding, a
 * region block, or an origin the video does not accept — and an iframe reading
 * only "Video unavailable" leaves the viewer with nothing to click.
 *
 * @example
 * ```tsx
 * import { YouTubeEmbed } from "@beep/editor/youtube-embed"
 *
 * const props = { videoID: "dQw4w9WgXcQ" }
 * const embed = <YouTubeEmbed {...props} />
 *
 * console.log(props.videoID) // "dQw4w9WgXcQ"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function YouTubeEmbed({ videoID }: { readonly videoID: string }): JSX.Element {
  return (
    <div className="my-3">
      <div className="aspect-video w-full overflow-hidden rounded border bg-muted">
        <iframe
          className="h-full w-full"
          title="YouTube video"
          src={youtubeEmbedUrl(videoID)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox={YOUTUBE_SANDBOX}
        />
      </div>
      <a
        className="text-muted-foreground hover:text-foreground mt-1 inline-block text-xs underline"
        href={youtubeWatchUrl(videoID)}
        target="_blank"
        rel="noreferrer noopener"
      >
        Watch on YouTube
      </a>
    </div>
  );
}
