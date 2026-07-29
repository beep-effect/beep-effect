/**
 * React editor kit on Lexical for schema-first rich text: a read-only viewer
 * and composer primitives (theme, node registration, markdown shortcuts)
 * over the `@beep/lexical-schema` v1 vocabulary.
 *
 * @packageDocumentation \@beep/editor
 * @since 0.0.0
 */

/**
 * Package version.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/editor"
 *
 * const packageVersion: "0.0.0" = VERSION
 * console.log(packageVersion) // "0.0.0"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

export {
  /**
   * @deprecated Import {@link $createArtifactRefNode} from @beep/editor/artifact-ref-node.
   * @since 0.0.0
   */
  $createArtifactRefNode,
  /**
   * @deprecated Import {@link $isArtifactRefNode} from @beep/editor/artifact-ref-node.
   * @since 0.0.0
   */
  $isArtifactRefNode,
  /**
   * @deprecated Import {@link ArtifactRefNode} from @beep/editor/artifact-ref-node.
   * @since 0.0.0
   */
  ArtifactRefNode,
  /**
   * @deprecated Import {@link ArtifactRefNodeCreateInput} from @beep/editor/artifact-ref-node.
   * @since 0.0.0
   */
  type ArtifactRefNodeCreateInput,
  /**
   * @deprecated Import {@link SerializedArtifactRefNode} from @beep/editor/artifact-ref-node.
   * @since 0.0.0
   */
  type SerializedArtifactRefNode,
} from "./artifact-ref-node.tsx";
/**
 * The chat facade owns the compiler-visible migration metadata for every chat
 * symbol; export-star preserves those annotated alias symbols at the root.
 *
 * @since 0.0.0
 */
export * from "./chat/index.ts";
export {
  /**
   * @deprecated Import {@link $createCodeBlockNode} from @beep/editor/code-block-node.
   * @since 0.0.0
   */
  $createCodeBlockNode,
  /**
   * @deprecated Import {@link $isCodeBlockNode} from @beep/editor/code-block-node.
   * @since 0.0.0
   */
  $isCodeBlockNode,
  /**
   * @deprecated Import {@link CodeBlockNode} from @beep/editor/code-block-node.
   * @since 0.0.0
   */
  CodeBlockNode,
  /**
   * @deprecated Import {@link SerializedCodeBlockNode} from @beep/editor/code-block-node.
   * @since 0.0.0
   */
  SerializedCodeBlockNode,
} from "./code-block-node.tsx";
export {
  /**
   * @deprecated Import {@link CodeBlockView} from @beep/editor/code-block-view.
   * @since 0.0.0
   */
  CodeBlockView,
} from "./code-block-view.tsx";
export {
  /**
   * @deprecated Import {@link EditorComposer} from @beep/editor/composer.
   * @since 0.0.0
   */
  EditorComposer,
  /**
   * @deprecated Import {@link EditorComposerProps} from @beep/editor/composer.
   * @since 0.0.0
   */
  type EditorComposerProps,
  /**
   * @deprecated Import {@link EditorWireComposer} from @beep/editor/composer.
   * @since 0.0.0
   */
  EditorWireComposer,
  /**
   * @deprecated Import {@link EditorWireComposerProps} from @beep/editor/composer.
   * @since 0.0.0
   */
  type EditorWireComposerProps,
  /**
   * @deprecated Import {@link markdownTransformers} from @beep/editor/composer.
   * @since 0.0.0
   */
  markdownTransformers,
} from "./composer.tsx";
export {
  /**
   * @deprecated Import {@link $createMermaidNode} from @beep/editor/mermaid-node.
   * @since 0.0.0
   */
  $createMermaidNode,
  /**
   * @deprecated Import {@link $isMermaidNode} from @beep/editor/mermaid-node.
   * @since 0.0.0
   */
  $isMermaidNode,
  /**
   * @deprecated Import {@link MermaidNode} from @beep/editor/mermaid-node.
   * @since 0.0.0
   */
  MermaidNode,
  /**
   * @deprecated Import {@link SerializedMermaidNode} from @beep/editor/mermaid-node.
   * @since 0.0.0
   */
  SerializedMermaidNode,
} from "./mermaid-node.tsx";
export {
  /**
   * @deprecated Import {@link MermaidRenderError} from @beep/editor/mermaid-view.
   * @since 0.0.0
   */
  MermaidRenderError,
  /**
   * @deprecated Import {@link MermaidView} from @beep/editor/mermaid-view.
   * @since 0.0.0
   */
  MermaidView,
} from "./mermaid-view.tsx";
export {
  /**
   * @deprecated Import {@link editorNodes} from @beep/editor/nodes.
   * @since 0.0.0
   */
  editorNodes,
} from "./nodes.ts";
export {
  /**
   * @deprecated Import {@link decodeEditorStateForRuntime} from @beep/editor/runtime.
   * @since 0.0.0
   */
  decodeEditorStateForRuntime,
} from "./runtime.ts";
export {
  /**
   * @deprecated Import {@link editorTheme} from @beep/editor/theme.
   * @since 0.0.0
   */
  editorTheme,
} from "./theme.ts";
export {
  /**
   * @deprecated Import {@link EditorCompatibilityViewer} from @beep/editor/viewer.
   * @since 0.0.0
   */
  EditorCompatibilityViewer,
  /**
   * @deprecated Import {@link EditorCompatibilityViewerProps} from @beep/editor/viewer.
   * @since 0.0.0
   */
  type EditorCompatibilityViewerProps,
  /**
   * @deprecated Import {@link EditorViewer} from @beep/editor/viewer.
   * @since 0.0.0
   */
  EditorViewer,
  /**
   * @deprecated Import {@link EditorViewerProps} from @beep/editor/viewer.
   * @since 0.0.0
   */
  type EditorViewerProps,
  /**
   * @deprecated Import {@link EditorWireViewer} from @beep/editor/viewer.
   * @since 0.0.0
   */
  EditorWireViewer,
  /**
   * @deprecated Import {@link EditorWireViewerProps} from @beep/editor/viewer.
   * @since 0.0.0
   */
  type EditorWireViewerProps,
} from "./viewer.tsx";
export {
  /**
   * @deprecated Import {@link YOUTUBE_EMBED_SANDBOX} from @beep/editor/youtube-embed.
   * @since 0.0.0
   */
  YOUTUBE_EMBED_SANDBOX,
  /**
   * @deprecated Import {@link YOUTUBE_WATCH_EVENT} from @beep/editor/youtube-embed.
   * @since 0.0.0
   */
  YOUTUBE_WATCH_EVENT,
  /**
   * @deprecated Import {@link YouTubeEmbed} from @beep/editor/youtube-embed.
   * @since 0.0.0
   */
  YouTubeEmbed,
  /**
   * @deprecated Import {@link YouTubeEmbedProps} from @beep/editor/youtube-embed.
   * @since 0.0.0
   */
  type YouTubeEmbedProps,
  /**
   * @deprecated Import {@link YouTubeWatchRequest} from @beep/editor/youtube-embed.
   * @since 0.0.0
   */
  YouTubeWatchRequest,
  /**
   * @deprecated Import {@link YouTubeWatchUrl} from @beep/editor/youtube-embed.
   * @since 0.0.0
   */
  YouTubeWatchUrl,
  /**
   * @deprecated Import {@link youtubeEmbedUrl} from @beep/editor/youtube-embed.
   * @since 0.0.0
   */
  youtubeEmbedUrl,
  /**
   * @deprecated Import {@link youtubeWatchUrl} from @beep/editor/youtube-embed.
   * @since 0.0.0
   */
  youtubeWatchUrl,
} from "./youtube-embed.tsx";
export {
  /**
   * @deprecated Import {@link $createYouTubeNode} from @beep/editor/youtube-node.
   * @since 0.0.0
   */
  $createYouTubeNode,
  /**
   * @deprecated Import {@link $isYouTubeNode} from @beep/editor/youtube-node.
   * @since 0.0.0
   */
  $isYouTubeNode,
  /**
   * @deprecated Import {@link SerializedYouTubeNode} from @beep/editor/youtube-node.
   * @since 0.0.0
   */
  type SerializedYouTubeNode,
  /**
   * @deprecated Import {@link YouTubeNode} from @beep/editor/youtube-node.
   * @since 0.0.0
   */
  YouTubeNode,
} from "./youtube-node.tsx";
