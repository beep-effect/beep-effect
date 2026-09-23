/**
 * Workspace Thread table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Thread row converter exports.
 *
 * **Example** (Import converter exports)
 *
 * ```ts
 * import * as Thread from "@beep/workspace-tables/entities/Thread"
 *
 * console.log(Thread.toThreadInsert)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./Thread.converters.ts";
/**
 * Thread converter error exports.
 *
 * **Example** (Import Thread converter error)
 *
 * ```ts
 * import * as Thread from "@beep/workspace-tables/entities/Thread"
 *
 * console.log(Thread.ThreadConverterError._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Thread.errors.ts";
/**
 * Thread table exports.
 *
 * **Example** (Import table exports)
 *
 * ```ts
 * import * as Thread from "@beep/workspace-tables/entities/Thread"
 *
 * console.log(Thread.TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./Thread.table.ts";
