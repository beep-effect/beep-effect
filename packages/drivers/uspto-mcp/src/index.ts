/**
 * `@beep/uspto-mcp` public package entrypoint.
 *
 * **Details**
 *
 * Thin MCP host wiring `@beep/uspto` through `@beep/mcp-kit`: credential-keyed
 * composition, the `api_key_required` envelope, and progressive field-tier
 * projection against USPTO's `documentBag`-shaped file-wrapper responses.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * @since 0.0.0
 * @category layers
 */
export * from "./Server.ts";
/**
 * @since 0.0.0
 * @category schemas
 */
export * from "./UsptoDocumentTiers.ts";
/**
 * @since 0.0.0
 * @category layers
 */
export { UsptoToolkitHandlersLive } from "./UsptoHandlers.ts";
/**
 * @since 0.0.0
 * @category configuration
 */
export * from "./UsptoSourceAuth.ts";
/**
 * @since 0.0.0
 * @category tools
 */
export * from "./UsptoTools.ts";
