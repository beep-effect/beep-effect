/**
 * Practice KG host resources: bundle loading, the long-lived PGlite and DuckDB
 * store layers, and the headless self-check, shared by every process that
 * mounts the practice KG toolkit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Bundle manifest loading.
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./PracticeKgHost.bundle.ts";
/**
 * Host startup failures.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./PracticeKgHost.errors.ts";
/**
 * Store and host resource layers.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./PracticeKgHost.layers.ts";
/**
 * Headless bundle self-check.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./PracticeKgHost.selfCheck.ts";
