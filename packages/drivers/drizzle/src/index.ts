/**
 * `@beep/drizzle` driver-level capability wrapper for product-neutral database execution.
 *
 * **Details**
 *
 * Import from this package boundary for the stable Drizzle driver surface.
 * `Drizzle` owns execution and transaction ports, `DrizzleError` owns
 * technical failure normalization. Product table projection lives in
 * `@beep/effect-drizzle`.
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
