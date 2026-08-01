/**
 * `@beep/gov-legal-mcp` public package entrypoint.
 *
 * Thin Effect-native stdio host exposing four bounded read-only tools from the
 * public GovInfo and eCFR drivers through `@beep/mcp-kit` gated composition and
 * sanitized dispatch.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Thin driver-delegating handler layers.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Handlers.ts";
/**
 * Stdio server configuration and layer constructor.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Server.ts";
/**
 * Frozen source-auth registrations.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./SourceAuth.ts";
/**
 * Deterministic name generation and collision reports.
 *
 * @category normalization
 * @since 0.0.0
 */
export * from "./ToolNames.ts";
/**
 * Frozen four-tool declarations and source toolkits.
 *
 * @category tools
 * @since 0.0.0
 */
export * from "./Tools.ts";

/**
 * Package version.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/gov-legal-mcp"
 *
 * console.log(VERSION)
 * // "0.0.0"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0";
