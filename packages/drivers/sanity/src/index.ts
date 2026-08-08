/**
 * Sanity content API driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Runtime configuration models and constants.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./Sanity.config.ts";
/**
 * Typed Sanity driver errors.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Sanity.errors.ts";
/**
 * Sanity content API service.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Sanity.service.ts";

/**
 * Package version.
 *
 * **Example** (Log package version)
 *
 * ```ts
 * import { VERSION } from "@beep/sanity"
 *
 * console.log(VERSION) // "0.0.0"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
