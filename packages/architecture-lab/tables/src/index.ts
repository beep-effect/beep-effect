/**
 * Package entry point for `@beep/architecture-lab-tables`.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

/**
 * Package version constant published by the architecture lab tables entry point.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/architecture-lab-tables"
 *
 * const version: typeof VERSION = "0.0.0"
 * if (version !== VERSION) {
 *   throw new Error("unexpected tables package version")
 * }
 *
 * console.log(version)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Direct WorkItem table namespace export.
 *
 * @category tables
 * @since 0.0.0
 */
export * as WorkItem from "./aggregates/WorkItem/index.ts";
/**
 * Direct Worker table namespace export.
 *
 * @category tables
 * @since 0.0.0
 */
export * as Worker from "./entities/Worker/index.ts";
/**
 * Architecture lab Drizzle schema exports.
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./tables.ts";
