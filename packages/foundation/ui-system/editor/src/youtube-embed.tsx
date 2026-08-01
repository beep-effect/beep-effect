/**
 * YouTube iframe embed used by editor and streaming chat surfaces.
 *
 * @packageDocumentation \@beep/editor/youtube-embed
 * @since 0.0.0
 */
"use client";

import { $EditorId } from "@beep/identity";
import { YouTubeNode as YouTubeNodeSchema } from "@beep/lexical-schema";
import { O, Str } from "@beep/utils";
import * as S from "effect/Schema";
import type { JSX, MouseEvent } from "react";

const youtubeWatchPrefix = "https://www.youtube.com/watch?v=";

/**
 * Constructs the privacy-enhanced embed URL for an already validated video id.
 *
 * @example
 * ```ts
 * import { youtubeEmbedUrl } from "@beep/editor/youtube-embed"
 *
 * console.log(youtubeEmbedUrl("M7lc1UVf-VE"))
 * // "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const youtubeEmbedUrl = (videoID: string): string => `https://www.youtube-nocookie.com/embed/${videoID}`;

/**
 * Constructs the canonical watch URL for an already validated video id.
 *
 * @example
 * ```ts
 * import { youtubeWatchUrl } from "@beep/editor/youtube-embed"
 *
 * console.log(youtubeWatchUrl("M7lc1UVf-VE"))
 * // "https://www.youtube.com/watch?v=M7lc1UVf-VE"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const youtubeWatchUrl = (videoID: string): string => `${youtubeWatchPrefix}${videoID}`;

const $I = $EditorId.create("youtube-embed");
const decodeYouTubeNode = S.decodeUnknownOption(YouTubeNodeSchema);

const canonicalYouTubeWatchUrl = S.makeFilter<string>(
  (url) => {
    if (!Str.startsWith(youtubeWatchPrefix)(url)) return false;
    const videoID = Str.slice(Str.length(youtubeWatchPrefix))(url);
    return O.exists(decodeYouTubeNode({ type: "youtube", version: 1, format: "", videoID }), (decoded) =>
      Str.Equivalence(url, youtubeWatchUrl(decoded.videoID))
    );
  },
  {
    identifier: $I`CanonicalYouTubeWatchUrlCheck`,
    title: "Canonical YouTube watch URL",
    description: "An exact youtube.com watch URL containing one validated 11-character video id.",
    message: "Expected an exact canonical YouTube watch URL.",
  }
);

/**
 * Exact canonical watch URL for a schema-validated YouTube video id.
 *
 * @example
 * ```ts
 * import { YouTubeWatchUrl } from "@beep/editor/youtube-embed"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(YouTubeWatchUrl)("https://www.youtube.com/watch?v=M7lc1UVf-VE")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const YouTubeWatchUrl = S.String.check(canonicalYouTubeWatchUrl).pipe(
  $I.annoteSchema("YouTubeWatchUrl", {
    description: "Exact canonical youtube.com watch URL containing a validated 11-character video id.",
  })
);

/**
 * Type for {@link YouTubeWatchUrl}.
 *
 * @example
 * ```ts
 * import type { YouTubeWatchUrl } from "@beep/editor/youtube-embed"
 *
 * const watchUrl: YouTubeWatchUrl = "https://www.youtube.com/watch?v=M7lc1UVf-VE"
 * console.log(watchUrl) // "https://www.youtube.com/watch?v=M7lc1UVf-VE"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type YouTubeWatchUrl = typeof YouTubeWatchUrl.Type;

/**
 * Cancelable DOM event emitted before the watch fallback opens a browser
 * window. Desktop shells can intercept this event with an Atom-owned listener
 * and delegate to a scoped native opener.
 *
 * @example
 * ```ts
 * import { YOUTUBE_WATCH_EVENT } from "@beep/editor/youtube-embed"
 *
 * const event = new CustomEvent(YOUTUBE_WATCH_EVENT, { cancelable: true })
 * console.log(event.type) // "beep:youtube-watch"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YOUTUBE_WATCH_EVENT = "beep:youtube-watch";

/**
 * Typed detail carried by {@link YOUTUBE_WATCH_EVENT}.
 *
 * @example
 * ```ts
 * import { YouTubeWatchRequest } from "@beep/editor/youtube-embed"
 *
 * const request = YouTubeWatchRequest.make({
 *   url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
 * })
 * console.log(request.url)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YouTubeWatchRequest extends S.Class<YouTubeWatchRequest>($I`YouTubeWatchRequest`)(
  {
    url: YouTubeWatchUrl.annotateKey({ description: "Canonical YouTube watch URL." }),
  },
  $I.annote("YouTubeWatchRequest", {
    description: "Typed request emitted when a user activates the YouTube watch fallback.",
  })
) {}

/**
 * Props for {@link YouTubeEmbed}.
 *
 * @example
 * ```ts
 * import type { YouTubeEmbedProps } from "@beep/editor/youtube-embed"
 *
 * const props: YouTubeEmbedProps = { videoID: "M7lc1UVf-VE" }
 * console.log(props.videoID)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface YouTubeEmbedProps {
  readonly videoID: string;
}

/**
 * Least-privilege frame policy. The embed is model-controlled content, so the
 * frame gets only what playback needs: scripts, its own origin (which is
 * YouTube's, not ours), and bounded popup escape for playback links. It cannot
 * navigate the top-level page or submit forms.
 *
 * @example
 * ```ts
 * import { YOUTUBE_EMBED_SANDBOX } from "@beep/editor/youtube-embed"
 *
 * console.log(YOUTUBE_EMBED_SANDBOX.includes("allow-top-navigation")) // false
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const YOUTUBE_EMBED_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

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
 * const props = { videoID: "M7lc1UVf-VE" }
 * const embed = <YouTubeEmbed {...props} />
 *
 * console.log(props.videoID) // "M7lc1UVf-VE"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function YouTubeEmbed({ videoID }: YouTubeEmbedProps): JSX.Element {
  const decoded = decodeYouTubeNode({ type: "youtube", version: 1, format: "", videoID });
  if (O.isNone(decoded)) {
    return (
      <div className="my-3 rounded border bg-muted p-3 text-sm text-muted-foreground" role="status">
        Video unavailable.
      </div>
    );
  }

  const safeVideoID = decoded.value.videoID;
  const watchUrl = youtubeWatchUrl(safeVideoID);
  const onWatch = (event: MouseEvent<HTMLAnchorElement>): void => {
    // Keep target=_blank out of the markup: WebKitGTK routes it through the
    // generic shell opener before React can cancel the navigation. The scoped
    // desktop event claims the request; ordinary browsers receive the explicit
    // fallback while the click still owns a user gesture.
    event.preventDefault();
    const request = new CustomEvent(YOUTUBE_WATCH_EVENT, {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: YouTubeWatchRequest.make({ url: watchUrl }),
    });
    if (event.currentTarget.dispatchEvent(request)) {
      globalThis.open(watchUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="my-3">
      <div className="aspect-video w-full overflow-hidden rounded border bg-muted">
        <iframe
          className="h-full w-full"
          title="YouTube video"
          src={youtubeEmbedUrl(safeVideoID)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox={YOUTUBE_EMBED_SANDBOX}
        />
      </div>
      <a
        className="text-muted-foreground hover:text-foreground mt-1 inline-block text-xs underline"
        href={watchUrl}
        rel="noreferrer noopener"
        onClick={onWatch}
      >
        Watch on YouTube
      </a>
    </div>
  );
}
