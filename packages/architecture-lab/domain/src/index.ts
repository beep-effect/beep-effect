/**
 * Package entry point for `@beep/architecture-lab-domain`.
 *
 * @packageDocumentation
 * @category aggregates
 * @since 0.0.0
 */

/**
 * Aggregate namespace exports for the architecture lab domain package.
 *
 * @category aggregates
 * @since 0.0.0
 */
export * as Aggregates from "./aggregates/index.ts";
/**
 * @category aggregates
 * @since 0.0.0
 */
export * as WorkItem from "./aggregates/WorkItem/index.ts";
/**
 * Entity namespace exports for the architecture lab domain package.
 *
 * @category entities
 * @since 0.0.0
 */
export * as Entities from "./entities/index.ts";
/**
 * @category entities
 * @since 0.0.0
 */
export * as Worker from "./entities/Worker/index.ts";
/**
 * Value-object namespace exports for the architecture lab domain package.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * as Values from "./values/index.ts";
/**
 * @category value-objects
 * @since 0.0.0
 */
export * as WorkPriority from "./values/WorkPriority/index.ts";
