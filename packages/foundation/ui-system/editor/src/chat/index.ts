/**
 * Feature-flagged chat composer surface for `@beep/editor`: the generic
 * mechanism (config, commands, toolbar, slash/mention typeahead menus, attachment
 * capture, send/character-count) that an app configures and injects product
 * meaning into. The bare `EditorComposer` remains for non-chat consumers.
 *
 * @packageDocumentation \@beep/editor/chat
 * @since 0.0.0
 */

/**
 * Chat state atoms for the feature-flagged composer.
 *
 * @category atoms
 * @since 0.0.0
 */
export * from "./atoms.ts";
/**
 * The pure attachment model and capture-time validation for the chat composer.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./attachment-model.ts";
/**
 * Attachment capture plugins and the chip/thumbnail strip UI for the chat composer.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./attachments.tsx";
/**
 * The feature-flagged `ChatComposer` chat input surface built on the v1 Lexical vocabulary.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./chat-composer.tsx";
/**
 * Lexical commands the chat composer dispatches so consumers can wire send and stop.
 *
 * @category constants
 * @since 0.0.0
 */
export * from "./commands.ts";
/**
 * Schema-first UI configuration models for the feature-flagged chat composer.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./config.ts";
/**
 * Enter-to-send key handling and the live character count for the chat composer.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./send.tsx";
/**
 * The default `/` slash command set covering the baseline formatting and block-insert items.
 *
 * @category constants
 * @since 0.0.0
 */
export * from "./slash-items.tsx";
/**
 * The fixed formatting toolbar mounted above the chat composer editable surface.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./toolbar.tsx";
/**
 * The `/` slash and `@` mention typeahead menus for the chat composer.
 *
 * @category components
 * @since 0.0.0
 */
export * from "./typeahead.tsx";
