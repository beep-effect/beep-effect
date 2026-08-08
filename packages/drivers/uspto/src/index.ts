/**
 * USPTO Open Data Portal driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Runtime configuration for the USPTO driver.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./Uspto.config.ts";
/**
 * Typed USPTO driver errors.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Uspto.errors.ts";
/**
 * Schema models for USPTO responses and identifiers.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Uspto.models.ts";
/**
 * Effect service for USPTO Open Data Portal endpoints.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Uspto.service.ts";

/**
 * Package version.
 *
 * **Example** (Import and log version)
 *
 * ```ts
 * import { VERSION } from "@beep/uspto"
 *
 * console.log(VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
