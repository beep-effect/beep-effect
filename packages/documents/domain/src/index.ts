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
export * from "./aggregates/Document/index.js";
/**
 * IntakeBatch aggregate exports.
 *
 * @category aggregates
 * @since 0.0.0
 */
export * from "./aggregates/IntakeBatch/index.js";
/**
 * Aggregate namespace exports.
 *
 * @category aggregates
 * @since 0.0.0
 */
export * as Aggregates from "./aggregates/index.js";
/**
 * Entity namespace exports.
 *
 * @category entities
 * @since 0.0.0
 */
export * as Entities from "./entities/index.js";
/**
 * Identity namespace exports.
 *
 * @category entity-ids
 * @since 0.0.0
 */
export * as Identity from "./identity/index.js";
/**
 * Value-object namespace exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * as Values from "./values/index.js";
