/**
 * libpff file-processing driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Deterministic EML assembly for pffexport-exported items.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Libpff.eml.ts";
/**
 * Translation from technical libpff failures to operation errors.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Libpff.error-translation.ts";
/**
 * Typed libpff driver errors.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Libpff.errors.ts";
/**
 * JSONL metadata records for pffexport-exported items.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Libpff.messages.ts";
/**
 * Real pffexport-backed PST archive export engine.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Libpff.pffexport.ts";
/**
 * libpff-backed file-processing engine scaffold.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Libpff.service.ts";

/**
 * Package version.
 *
 * **Example** (Import and log VERSION)
 *
 * ```ts
 * import { VERSION } from "@beep/libpff"
 *
 * console.log(VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
