/**
 * Package entry point for `@beep/documents-domain`.
 *
 * @packageDocumentation
 * @category aggregates
 * @since 0.0.0
 */

/**
 * @category aggregates
 * @since 0.0.0
 */
export * from "./aggregates/Document/index.ts";
/**
 * @category aggregates
 * @since 0.0.0
 */
export * from "./aggregates/IntakeBatch/index.ts";
/**
 * @category aggregates
 * @since 0.0.0
 */
export * as Aggregates from "./aggregates/index.ts";
export * as VaultSync from "./aggregates/VaultSync/index.ts";
/**
 * @category entities
 * @since 0.0.0
 */
export * as Entities from "./entities/index.ts";
/**
 * @category value-objects
 * @since 0.0.0
 */
export * as Values from "./values/index.ts";
