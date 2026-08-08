/**
 * SyncItem table mapping.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import * as DomainSyncItem from "@beep/documents-domain/entities/SyncItem";
import { EntityTable } from "@beep/drizzle";

/**
 * Drizzle table projection for documents SyncItem entities.
 *
 * **Example** (Validate SyncItem table projection)
 *
 * ```ts
 * import { syncItemTable } from "@beep/documents-tables/entities/SyncItem"
 * import { getColumns, getTableName } from "drizzle-orm"
 *
 * const columns = getColumns(syncItemTable)
 * const tableName = getTableName(syncItemTable)
 * if (tableName !== "documents_sync_item" || columns.localRelPath.name !== "local_rel_path") {
 *   throw new Error("unexpected SyncItem table projection")
 * }
 *
 * console.log(`${tableName}:${columns.localRelPath.name}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const syncItemTable = EntityTable.pgTableFrom(DomainSyncItem.SyncItem);

/**
 * Physical Postgres table name derived from the SyncItem entity definition.
 *
 * **Example** (Check physical table name)
 *
 * ```ts
 * import { SYNC_ITEM_TABLE_NAME } from "@beep/documents-tables/entities/SyncItem"
 *
 * const tableName = SYNC_ITEM_TABLE_NAME
 * if (tableName !== "documents_sync_item") {
 *   throw new Error("unexpected SyncItem table name")
 * }
 *
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const SYNC_ITEM_TABLE_NAME = syncItemTable.definition.tableName;
