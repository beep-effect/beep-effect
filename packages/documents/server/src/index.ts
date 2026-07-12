/**
 * Package entry point for `@beep/documents-server`.
 *
 * @packageDocumentation
 * @category handlers
 * @since 0.0.0
 */

/**
 * Package version for `@beep/documents-server`.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/documents-server"
 *
 * console.log(VERSION)
 * ```
 *
 * @category handlers
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Document server aggregate exports.
 *
 * @category handlers
 * @since 0.0.0
 */
export * from "./aggregates/Document/index.js";
/**
 * Vault sync server aggregate exports.
 *
 * @category handlers
 * @since 0.0.0
 */
export * from "./aggregates/Sync/index.js";
/**
 * Server layer exports.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Layer.js";
