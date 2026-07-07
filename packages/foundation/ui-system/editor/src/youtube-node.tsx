/**
 * Runtime Lexical node for `@beep/lexical-schema` YouTube embeds.
 *
 * @packageDocumentation \@beep/editor/youtube-node
 * @since 0.0.0
 */
"use client";

import { BlockWithAlignableContents } from "@lexical/react/LexicalBlockWithAlignableContents";
import { DecoratorBlockNode } from "@lexical/react/LexicalDecoratorBlockNode";
import { YouTubeEmbed } from "./youtube-embed.tsx";
import type { YouTubeNode as YouTubeNodeSchema } from "@beep/lexical-schema";
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  ElementFormatType,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
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
 *   videoID: "dQw4w9WgXcQ",
 *   format: "",
 * } satisfies SerializedYouTubeNode
 *
 * const videoID: string = payload.videoID
 * console.log(videoID) // "dQw4w9WgXcQ"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SerializedYouTubeNode = YouTubeNodeSchema.Encoded;

/**
 * Block-level Lexical decorator node for YouTube embeds.
 *
 * @example
 * ```tsx
 * import { $createYouTubeNode } from "@beep/editor/youtube-node"
 *
 * console.log($createYouTubeNode("dQw4w9WgXcQ").getType()) // "youtube"
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
      iframe: (node: Node) => {
        const id = node instanceof HTMLIFrameElement ? node.getAttribute("data-lexical-youtube") : null;
        return id === null
          ? null
          : {
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
    return $createYouTubeNode(serializedNode.videoID).updateFromJSON(
      serializedNode as LexicalUpdateJSON<SerializedYouTubeNode>
    );
  }

  override exportJSON(): SerializedYouTubeNode {
    return {
      ...super.exportJSON(),
      type: "youtube",
      videoID: this.__id,
    };
  }

  override exportDOM(): DOMExportOutput {
    const element = document.createElement("iframe");
    element.setAttribute("data-lexical-youtube", this.__id);
    element.setAttribute("width", "560");
    element.setAttribute("height", "315");
    element.setAttribute("src", `https://www.youtube-nocookie.com/embed/${this.__id}`);
    element.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    );
    element.setAttribute("allowfullscreen", "true");
    element.setAttribute("title", "YouTube video");
    return { element };
  }

  getId(): string {
    return this.getLatest().__id;
  }

  override getTextContent(): string {
    return `https://www.youtube.com/watch?v=${this.__id}`;
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
 * const node = $createYouTubeNode("dQw4w9WgXcQ")
 * console.log(node.getId()) // "dQw4w9WgXcQ"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const $createYouTubeNode = (videoID: SerializedYouTubeNode["videoID"]): YouTubeNode => new YouTubeNode(videoID);

/**
 * Type guard for {@link YouTubeNode}.
 *
 * @example
 * ```tsx
 * import { $createYouTubeNode, $isYouTubeNode } from "@beep/editor/youtube-node"
 *
 * console.log($isYouTubeNode($createYouTubeNode("dQw4w9WgXcQ"))) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const $isYouTubeNode = (node: LexicalNode | null | undefined): node is YouTubeNode =>
  node instanceof YouTubeNode;
