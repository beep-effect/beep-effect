/**
 * Runtime Lexical node for `@beep/lexical-schema` YouTube embeds.
 *
 * @packageDocumentation \@beep/editor/youtube-node
 * @since 0.0.0
 */
"use client";

import { YouTubeNode as YouTubeNodeSchema } from "@beep/lexical-schema";
import { O } from "@beep/utils";
import { BlockWithAlignableContents } from "@lexical/react/LexicalBlockWithAlignableContents";
import { DecoratorBlockNode } from "@lexical/react/LexicalDecoratorBlockNode";
import { Result } from "effect";
import * as S from "effect/Schema";
import { YOUTUBE_EMBED_SANDBOX, YouTubeEmbed, youtubeEmbedUrl, youtubeWatchUrl } from "./youtube-embed.tsx";
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  ElementFormatType,
  LexicalEditor,
  LexicalNode,
  NodeKey,
} from "lexical";
import type { JSX } from "react";

/**
 * Serialized wire shape of {@link YouTubeNode}.
 *
 * @example
 * ```ts
 * import type { SerializedYouTubeNode } from "@beep/editor/youtube-node"
 *
 * const payload = {
 *   type: "youtube",
 *   version: 1,
 *   videoID: "M7lc1UVf-VE",
 *   format: "",
 * } satisfies SerializedYouTubeNode
 *
 * const videoID: string = payload.videoID
 * console.log(videoID) // "M7lc1UVf-VE"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SerializedYouTubeNode = YouTubeNodeSchema.Encoded;

const decodeYouTubeNode = S.decodeUnknownOption(YouTubeNodeSchema);
const decodeYouTubeNodeResult = S.decodeUnknownResult(YouTubeNodeSchema);
const encodeYouTubeNodeResult = S.encodeUnknownResult(YouTubeNodeSchema);
const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

const decodedYouTubeNode = (videoID: unknown, format: unknown = "") =>
  decodeYouTubeNode({ type: "youtube", version: 1, videoID, format });

const invalidYouTubeNode = (): YouTubeNode => new YouTubeNode("");
const youtubeWrapperAttribute = "data-lexical-youtube-wrapper";

/**
 * Block-level Lexical decorator node for YouTube embeds.
 *
 * @example
 * ```tsx
 * import { $createYouTubeNode } from "@beep/editor/youtube-node"
 *
 * console.log($createYouTubeNode("M7lc1UVf-VE").getType()) // "youtube"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export class YouTubeNode extends DecoratorBlockNode {
  __id: string;

  constructor(id: string, format?: ElementFormatType, key?: NodeKey) {
    super(format, key);
    this.__id = id;
  }

  static override getType(): string {
    return "youtube";
  }

  static override clone(node: YouTubeNode): YouTubeNode {
    return new YouTubeNode(node.__id, node.__format, node.__key);
  }

  static override importDOM(): DOMConversionMap | null {
    return {
      figure: (node: Node) => {
        const id = node instanceof HTMLElement ? node.getAttribute(youtubeWrapperAttribute) : null;
        if (id === null) return null;
        const decoded = decodedYouTubeNode(id);
        return {
          conversion: (): DOMConversionOutput => ({
            after: () => [],
            node: O.match(decoded, {
              onNone: () => null,
              onSome: ({ videoID }) => $createYouTubeNode(videoID),
            }),
          }),
          priority: 1,
        };
      },
      iframe: (node: Node) => {
        const id = node instanceof HTMLIFrameElement ? node.getAttribute("data-lexical-youtube") : null;
        if (id === null || O.isNone(decodedYouTubeNode(id))) return null;
        return {
          conversion: (): DOMConversionOutput => ({ node: $createYouTubeNode(id) }),
          priority: 1,
        };
      },
    };
  }

  // Lexical 0.46 widened the base `importJSON` parameter to
  // `SerializedLexicalNode & Record<string, unknown>`; mirror the intersection so
  // the narrowed (schema-pinned, interface-backed) wire shape stays bivariant.
  static override importJSON(serializedNode: SerializedYouTubeNode & Record<string, unknown>): YouTubeNode {
    return O.match(decodeYouTubeNode(serializedNode), {
      onNone: invalidYouTubeNode,
      onSome: (decoded) => new YouTubeNode(decoded.videoID, decoded.format),
    });
  }

  override exportJSON(): SerializedYouTubeNode {
    const decoded = Result.getOrThrowWith(
      decodeYouTubeNodeResult({ ...super.exportJSON(), type: "youtube", videoID: this.__id }),
      schemaIssueToError
    );
    return Result.getOrThrowWith(encodeYouTubeNodeResult(decoded), schemaIssueToError);
  }

  override exportDOM(): DOMExportOutput {
    const decoded = decodedYouTubeNode(this.__id, this.__format);
    if (O.isNone(decoded)) {
      const fallback = document.createElement("span");
      fallback.textContent = "Video unavailable";
      return { element: fallback };
    }
    const container = document.createElement("figure");
    container.setAttribute(youtubeWrapperAttribute, decoded.value.videoID);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("data-lexical-youtube", decoded.value.videoID);
    iframe.setAttribute("width", "560");
    iframe.setAttribute("height", "315");
    iframe.setAttribute("src", youtubeEmbedUrl(decoded.value.videoID));
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    );
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.setAttribute("sandbox", YOUTUBE_EMBED_SANDBOX);
    iframe.setAttribute("title", "YouTube video");

    const watch = document.createElement("a");
    watch.setAttribute("href", youtubeWatchUrl(decoded.value.videoID));
    watch.setAttribute("target", "_blank");
    watch.setAttribute("rel", "noreferrer noopener");
    watch.textContent = "Watch on YouTube";

    container.append(iframe, watch);
    return { element: container };
  }

  getId(): string {
    return this.getLatest().__id;
  }

  override getTextContent(): string {
    return O.isSome(decodedYouTubeNode(this.__id))
      ? `https://www.youtube.com/watch?v=${this.__id}`
      : "Video unavailable";
  }

  override decorate(_editor: LexicalEditor, config: EditorConfig): JSX.Element {
    const embedBlockTheme = config.theme.embedBlock ?? {};
    const className = {
      base: embedBlockTheme.base ?? "",
      focus: embedBlockTheme.focus ?? "",
    };

    return (
      <BlockWithAlignableContents className={className} format={this.__format} nodeKey={this.getKey()}>
        <YouTubeEmbed videoID={this.__id} />
      </BlockWithAlignableContents>
    );
  }
}

/**
 * Create a YouTube embed node.
 *
 * @example
 * ```tsx
 * import { $createYouTubeNode } from "@beep/editor/youtube-node"
 *
 * const node = $createYouTubeNode("M7lc1UVf-VE")
 * console.log(node.getId()) // "M7lc1UVf-VE"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const $createYouTubeNode = (videoID: SerializedYouTubeNode["videoID"]): YouTubeNode =>
  O.match(decodedYouTubeNode(videoID), {
    onNone: invalidYouTubeNode,
    onSome: (decoded) => new YouTubeNode(decoded.videoID, decoded.format),
  });

/**
 * Type guard for {@link YouTubeNode}.
 *
 * @example
 * ```tsx
 * import { $createYouTubeNode, $isYouTubeNode } from "@beep/editor/youtube-node"
 *
 * console.log($isYouTubeNode($createYouTubeNode("M7lc1UVf-VE"))) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const $isYouTubeNode = (node: LexicalNode | null | undefined): node is YouTubeNode =>
  node instanceof YouTubeNode;
