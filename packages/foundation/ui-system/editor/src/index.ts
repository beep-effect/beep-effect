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
 * **Example** (Read package version)
 *
 * ```ts import.meta.vitest name="Read package version"
 * import { VERSION } from "@beep/editor"
 *
 * const packageVersion: "0.0.0" = VERSION
 * packageVersion // => "0.0.0"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Runtime Lexical node rendering the `artifact-ref` block as a chip.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import `$createArtifactRefNode` from `@beep/editor/artifact-ref-node`; see {@link ArtifactRefNode}.
   * @since 0.0.0
   */
  $createArtifactRefNode,
  /**
   * @deprecated Import `$isArtifactRefNode` from `@beep/editor/artifact-ref-node`; see {@link ArtifactRefNode}.
   * @since 0.0.0
   */
  $isArtifactRefNode,
  /**
   * @deprecated Import {@link ArtifactRefNode} from `@beep/editor/artifact-ref-node`.
   * @since 0.0.0
   */
  ArtifactRefNode,
  /**
   * @deprecated Import {@link ArtifactRefNodeCreateInput} from `@beep/editor/artifact-ref-node`.
   * @since 0.0.0
   */
  type ArtifactRefNodeCreateInput,
  /**
   * @deprecated Import {@link SerializedArtifactRefNode} from `@beep/editor/artifact-ref-node`.
   * @since 0.0.0
   */
  type SerializedArtifactRefNode,
} from "./artifact-ref-node.tsx";
/**
 * The capability facade owns compiler-visible migration metadata for capability
 * descriptors, resolver APIs, profiles, and projections; export-star preserves
 * those annotated aliases at the deprecated package root.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./capability/index.ts";
/**
 * The chat facade owns the compiler-visible migration metadata for every chat
 * symbol; export-star preserves those annotated alias symbols at the root.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./chat/index.ts";
/**
 * Read-only Lexical decorator node rendering a code block that scrolls and can be copied.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import `$createCodeBlockNode` from `@beep/editor/code-block-node`; see {@link CodeBlockNode}.
   * @since 0.0.0
   */
  $createCodeBlockNode,
  /**
   * @deprecated Import `$isCodeBlockNode` from `@beep/editor/code-block-node`; see {@link CodeBlockNode}.
   * @since 0.0.0
   */
  $isCodeBlockNode,
  /**
   * @deprecated Import {@link CodeBlockNode} from `@beep/editor/code-block-node`.
   * @since 0.0.0
   */
  CodeBlockNode,
  /**
   * @deprecated Import {@link SerializedCodeBlockNode} from `@beep/editor/code-block-node`.
   * @since 0.0.0
   */
  SerializedCodeBlockNode,
} from "./code-block-node.tsx";
/**
 * The code block a reader actually gets: long lines scroll, and the snippet can be copied.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link CodeBlockView} from `@beep/editor/code-block-view`.
   * @since 0.0.0
   */
  CodeBlockView,
} from "./code-block-view.tsx";
/**
 * Composer primitives: an editable Lexical surface wired with the v1 node registration and theme.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link EditorComposer} from `@beep/editor/composer`.
   * @since 0.0.0
   */
  EditorComposer,
  /**
   * @deprecated Import {@link EditorComposerProps} from `@beep/editor/composer`.
   * @since 0.0.0
   */
  type EditorComposerProps,
  /**
   * @deprecated Import {@link EditorWireComposer} from `@beep/editor/composer`.
   * @since 0.0.0
   */
  EditorWireComposer,
  /**
   * @deprecated Import {@link EditorWireComposerProps} from `@beep/editor/composer`.
   * @since 0.0.0
   */
  type EditorWireComposerProps,
  /**
   * @deprecated Import {@link markdownTransformers} from `@beep/editor/composer`.
   * @since 0.0.0
   */
  markdownTransformers,
} from "./composer.tsx";
/**
 * Read-only Lexical decorator node rendering a `language="mermaid"` code block as a diagram.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import `$createMermaidNode` from `@beep/editor/mermaid-node`; see {@link MermaidNode}.
   * @since 0.0.0
   */
  $createMermaidNode,
  /**
   * @deprecated Import `$isMermaidNode` from `@beep/editor/mermaid-node`; see {@link MermaidNode}.
   * @since 0.0.0
   */
  $isMermaidNode,
  /**
   * @deprecated Import {@link MermaidNode} from `@beep/editor/mermaid-node`.
   * @since 0.0.0
   */
  MermaidNode,
  /**
   * @deprecated Import {@link SerializedMermaidNode} from `@beep/editor/mermaid-node`.
   * @since 0.0.0
   */
  SerializedMermaidNode,
} from "./mermaid-node.tsx";
/**
 * Mermaid diagram renderer shared by persisted editor and streaming chat surfaces.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link MermaidRenderError} from `@beep/editor/mermaid-view`.
   * @since 0.0.0
   */
  MermaidRenderError,
  /**
   * @deprecated Import {@link MermaidView} from `@beep/editor/mermaid-view`.
   * @since 0.0.0
   */
  MermaidView,
} from "./mermaid-view.tsx";
/**
 * Node registration for the `@beep/lexical-schema` v1 vocabulary.
 *
 * @category constants
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link editorNodes} from `@beep/editor/nodes`.
   * @since 0.0.0
   */
  editorNodes,
} from "./nodes.ts";
/**
 * Runtime admission decoder for persisted editor state.
 *
 * @category validation
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link decodeEditorStateForRuntime} from `@beep/editor/runtime`.
   * @since 0.0.0
   */
  decodeEditorStateForRuntime,
} from "./runtime.ts";
/**
 * Editor theme reusing the `@beep/ui` editor substrate theme.
 *
 * @category themes
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link editorTheme} from `@beep/editor/theme`.
   * @since 0.0.0
   */
  editorTheme,
} from "./theme.ts";
/**
 * Read-only viewers for decoded and compatibility-checked editor states.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link EditorCompatibilityViewer} from `@beep/editor/viewer`.
   * @since 0.0.0
   */
  EditorCompatibilityViewer,
  /**
   * @deprecated Import {@link EditorCompatibilityViewerProps} from `@beep/editor/viewer`.
   * @since 0.0.0
   */
  type EditorCompatibilityViewerProps,
  /**
   * @deprecated Import {@link EditorViewer} from `@beep/editor/viewer`.
   * @since 0.0.0
   */
  EditorViewer,
  /**
   * @deprecated Import {@link EditorViewerProps} from `@beep/editor/viewer`.
   * @since 0.0.0
   */
  type EditorViewerProps,
  /**
   * @deprecated Import {@link EditorWireViewer} from `@beep/editor/viewer`.
   * @since 0.0.0
   */
  EditorWireViewer,
  /**
   * @deprecated Import {@link EditorWireViewerProps} from `@beep/editor/viewer`.
   * @since 0.0.0
   */
  type EditorWireViewerProps,
} from "./viewer.tsx";
/**
 * YouTube iframe embed used by editor and streaming chat surfaces.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link YOUTUBE_EMBED_SANDBOX} from `@beep/editor/youtube-embed`.
   * @since 0.0.0
   */
  YOUTUBE_EMBED_SANDBOX,
  /**
   * @deprecated Import {@link YOUTUBE_WATCH_EVENT} from `@beep/editor/youtube-embed`.
   * @since 0.0.0
   */
  YOUTUBE_WATCH_EVENT,
  /**
   * @deprecated Import {@link YouTubeEmbed} from `@beep/editor/youtube-embed`.
   * @since 0.0.0
   */
  YouTubeEmbed,
  /**
   * @deprecated Import {@link YouTubeEmbedProps} from `@beep/editor/youtube-embed`.
   * @since 0.0.0
   */
  type YouTubeEmbedProps,
  /**
   * @deprecated Import {@link YouTubeWatchRequest} from `@beep/editor/youtube-embed`.
   * @since 0.0.0
   */
  YouTubeWatchRequest,
  /**
   * @deprecated Import {@link YouTubeWatchUrl} from `@beep/editor/youtube-embed`.
   * @since 0.0.0
   */
  YouTubeWatchUrl,
  /**
   * @deprecated Import {@link youtubeEmbedUrl} from `@beep/editor/youtube-embed`.
   * @since 0.0.0
   */
  youtubeEmbedUrl,
  /**
   * @deprecated Import {@link youtubeWatchUrl} from `@beep/editor/youtube-embed`.
   * @since 0.0.0
   */
  youtubeWatchUrl,
} from "./youtube-embed.tsx";
/**
 * Runtime Lexical node for `@beep/lexical-schema` YouTube embeds.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import `$createYouTubeNode` from `@beep/editor/youtube-node`; see {@link YouTubeNode}.
   * @since 0.0.0
   */
  $createYouTubeNode,
  /**
   * @deprecated Import `$isYouTubeNode` from `@beep/editor/youtube-node`; see {@link YouTubeNode}.
   * @since 0.0.0
   */
  $isYouTubeNode,
  /**
   * @deprecated Import {@link SerializedYouTubeNode} from `@beep/editor/youtube-node`.
   * @since 0.0.0
   */
  type SerializedYouTubeNode,
  /**
   * @deprecated Import {@link YouTubeNode} from `@beep/editor/youtube-node`.
   * @since 0.0.0
   */
  YouTubeNode,
} from "./youtube-node.tsx";
