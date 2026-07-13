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

/**
 * Runtime Lexical node rendering the `artifact-ref` block as a chip.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./artifact-ref-node.tsx";
/**
 * The feature-flagged chat composer surface: config, commands, toolbar, typeahead, attachments, and send.
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
export * from "./code-block-node.tsx";
/**
 * The code block a reader actually gets: long lines scroll, and the snippet can be copied.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./code-block-view.tsx";
/**
 * Composer primitives: an editable Lexical surface wired with the v1 node registration and theme.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./composer.tsx";
/**
 * Read-only Lexical decorator node rendering a `language="mermaid"` code block as a diagram.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./mermaid-node.tsx";
/**
 * Mermaid diagram renderer shared by persisted editor and streaming chat surfaces.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./mermaid-view.tsx";
/**
 * Node registration for the `@beep/lexical-schema` v1 vocabulary.
 *
 * @category constants
 * @since 0.0.0
 */
export * from "./nodes.ts";
/**
 * Editor theme reusing the `@beep/ui` editor substrate theme.
 *
 * @category themes
 * @since 0.0.0
 */
export * from "./theme.ts";
/**
 * Read-only viewer rendering a `@beep/lexical-schema` serialized editor state.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./viewer.tsx";
/**
 * YouTube iframe embed used by editor and streaming chat surfaces.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./youtube-embed.tsx";
/**
 * Runtime Lexical node for `@beep/lexical-schema` YouTube embeds.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./youtube-node.tsx";
