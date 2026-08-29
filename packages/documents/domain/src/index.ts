/**
 * Package entry point for `@beep/documents-domain`.
 *
 * @packageDocumentation
 * @category aggregates
 * @since 0.0.0
 */

/**
 * Package version for `@beep/documents-domain`.
 *
 * **Example** (Import and log VERSION)
 *
 * ```ts
 * import { VERSION } from "@beep/documents-domain"
 *
 * console.log(VERSION)
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Document aggregate exports.
 *
 * @category aggregates
 * @since 0.0.0
 */
export * from "./aggregates/Document/index.ts";
/**
 * IntakeBatch aggregate exports.
 *
 * @category aggregates
 * @since 0.0.0
 */
export * from "./aggregates/IntakeBatch/index.ts";
/**
 * Aggregate namespace exports.
 *
 * @category aggregates
 * @since 0.0.0
 */
export * as Aggregates from "./aggregates/index.ts";
/**
 * Entity namespace exports.
 *
 * @category entities
 * @since 0.0.0
 */
export * as Entities from "./entities/index.ts";
/**
 * Value-object namespace exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * as Values from "./values/index.ts";
