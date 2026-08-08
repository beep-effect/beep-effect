/**
 * Public Anthropic Claude driver entry point for configuration, layers, repair
 * helpers, and typed technical errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Package version published by the `@beep/anthropic` entry point.
 *
 * **Example** (Build package coordinate string)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { VERSION } from "@beep/anthropic"
 *
 * const packageCoordinate = `@beep/anthropic@${VERSION}`
 *
 * strictEqual(packageCoordinate, "@beep/anthropic@0.0.0")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Runtime configuration exports for Anthropic model defaults, retry defaults,
 * and usage-pricing metadata.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./Anthropic.config.ts";
/**
 * Typed technical errors surfaced by the Anthropic repair boundary.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Anthropic.errors.ts";
/**
 * Product-neutral Anthropic forced-tool repair utilities.
 *
 * @category combinators
 * @since 0.0.0
 */
export * from "./Anthropic.repair.ts";
/**
 * Effect AI client, language-model layer, and acquisition retry-plan exports.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Anthropic.service.ts";
