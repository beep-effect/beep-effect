/**
 * Apache Tika file-processing driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Runtime configuration models and constants for the Tika driver.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./Tika.config.ts";
/**
 * Translation from Tika driver failures to file-processing operation errors.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Tika.error-translation.ts";
/**
 * Typed Tika driver errors.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Tika.errors.ts";
/**
 * Shared Apache Tika response parsing and output budget enforcement.
 *
 * @category combinators
 * @since 0.0.0
 */
export * from "./Tika.response.ts";
/**
 * Tika Server HTTP text and metadata extraction engine.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Tika.server.ts";
/**
 * Tika-backed file-processing engine scaffold.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Tika.service.ts";
/**
 * Real tika-app-backed text and metadata extraction engine.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Tika.tikaapp.ts";

/**
 * Package version.
 *
 * **Example** (Log package version)
 *
 * ```ts
 * import { VERSION } from "@beep/tika"
 *
 * console.log(VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
