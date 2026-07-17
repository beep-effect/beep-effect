/**
 * Client-facing facade for the architecture lab proof slice.
 *
 * @remarks
 * This entry point exposes the package version and namespace barrels for
 * browser or edge clients that need WorkItem command/query contracts without
 * depending on server repository layers.
 *
 * @packageDocumentation
 * @category clients
 * @since 0.0.0
 */

/**
 * Static version marker for the architecture lab client facade.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/architecture-lab-client"
 *
 * const isInitialClientBuild = VERSION === "0.0.0"
 * console.log(isInitialClientBuild) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Namespace barrel for WorkItem client contracts.
 *
 * @remarks
 * The exported namespace keeps WorkItem client symbols grouped at the package
 * root while the owning declarations remain documented in the aggregate module.
 *
 * @category clients
 * @since 0.0.0
 */
export * as WorkItem from "./aggregates/WorkItem/index.ts";
