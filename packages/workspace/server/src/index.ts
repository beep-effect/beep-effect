/**
 * Package entry point for `@beep/workspace-server`.
 *
 * @packageDocumentation
 * @category handlers
 * @since 0.0.0
 */

/**
 * Package version for the workspace server role.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/workspace-server"
 *
 * console.log(VERSION)
 * ```
 *
 * @category handlers
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Direct Thread server namespace export.
 *
 * @category handlers
 * @since 0.0.0
 */
export * as Thread from "./aggregates/Thread/index.ts";
/**
 * Workspace vault exports.
 *
 * @category repositories
 * @since 0.0.0
 */
export * as Workspace from "./aggregates/Workspace/index.ts";
/**
 * Workspace server layer export.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Layer.ts";
/**
 * Workspace-backed canonical source-text resolver exports.
 *
 * @category adapters
 * @since 0.0.0
 */
export * as SourceText from "./SourceText/index.ts";
