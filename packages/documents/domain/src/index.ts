/**
 * Package entry point for `@beep/documents-domain`.
 *
 * @packageDocumentation
 * @category aggregates
 * @since 0.0.0
 */

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
export * as VaultSync from "./aggregates/VaultSync/index.ts";
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
