/**
 * `@beep/drizzle` driver-level capability wrapper for product-neutral database execution.
 *
 * **Details**
 *
 * Import from this package boundary for the stable Drizzle driver surface.
 * `Drizzle` owns execution and transaction ports, `DrizzleError` owns
 * technical failure normalization, and `EntityTable` owns metadata-only
 * schema-to-table projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Public Drizzle driver error exports.
 *
 * @since 0.0.0
 * @category errors
 */
export * from "./Drizzle.errors.ts";
/**
 * Public Drizzle driver service exports.
 *
 * @since 0.0.0
 * @category services
 */
export * from "./Drizzle.service.ts";
/**
 * Public schema-first Drizzle table projection exports.
 *
 * @since 0.0.0
 * @category tables
 */
export * as EntityTable from "./EntityTable.models.ts";
