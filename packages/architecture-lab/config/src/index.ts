/**
 * Package entry point for `@beep/architecture-lab-config`.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

/**
 * Package version marker for the architecture lab config role.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/architecture-lab-config"
 *
 * const isInitialProofVersion = VERSION === "0.0.0"
 *
 * console.log(isInitialProofVersion) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Browser-safe WorkItem public configuration exports.
 *
 * @example
 * ```ts
 * import {
 *   defaultWorkItemPublicConfig,
 *   WorkItemPublicConfig,
 * } from "@beep/architecture-lab-config"
 *
 * const config = WorkItemPublicConfig.make({
 *   assignmentEnabled: defaultWorkItemPublicConfig.assignmentEnabled,
 *   reopenCompletedEnabled: true,
 * })
 *
 * console.log(config.reopenCompletedEnabled)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export { defaultWorkItemPublicConfig, WorkItemPublicConfig } from "./public.ts";
