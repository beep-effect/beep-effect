/**
 * Node-safe graph-3d driver entrypoint: projection schemas, synthetic
 * fixtures, and typed errors. The renderer itself lives behind
 * `@beep/graph-3d/browser` per driver law.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Typed graph-3d driver errors.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Graph3D.errors.ts";
/**
 * Typed-array 3D graph projections and synthetic graph fixtures.
 *
 * @category projections
 * @since 0.0.0
 */
export * from "./Graph3D.projection.ts";
