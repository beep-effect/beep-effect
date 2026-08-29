/**
 * Documents persistence boundary for DMS sync-state table projections.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

/**
 * Documents entity table metadata namespaces.
 *
 * **Example** (Log SyncItem table name)
 *
 * ```ts
 * import { Entities } from "@beep/documents-tables"
 *
 * console.log(Entities.SyncItem.SYNC_ITEM_TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as Entities from "./entities/index.ts";
/**
 * Documents Drizzle schema aggregate exports.
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./tables.ts";
