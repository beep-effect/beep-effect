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
 * Thread table exports.
 *
 * **Example** (Import table exports)
 *
 * ```ts
 * import * as Thread from "@beep/workspace-tables/entities/Thread"
 *
 * console.log(Thread.Table.definition.entityId.entityType)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./Thread.table.ts";
