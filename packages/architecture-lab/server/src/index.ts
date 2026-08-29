/**
 * Package entry point for `@beep/architecture-lab-server`.
 *
 * @packageDocumentation
 * @category handlers
 * @since 0.0.0
 */

/**
 * Package version for the architecture lab server role.
 *
 * **Example** (Importing and checking VERSION)
 *
 * ```ts
 * import { VERSION } from "@beep/architecture-lab-server"
 *
 * const version = VERSION
 *
 * console.log(version === "0.0.0") // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Direct WorkItem server namespace export.
 *
 * @category handlers
 * @since 0.0.0
 */
export * as WorkItem from "./aggregates/WorkItem/index.ts";
/**
 * Direct Worker server namespace export.
 *
 * @category handlers
 * @since 0.0.0
 */
export * as Worker from "./entities/Worker/index.ts";
/**
 * Architecture lab server layer export.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Layer.ts";
