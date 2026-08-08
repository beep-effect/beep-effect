/**
 * SyncConflict table mapping.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import { EntityTable } from "@beep/drizzle";

/**
 * Drizzle table projection for documents SyncConflict entities.
 *
 * **Example** (Validate table projection columns)
 *
 * ```ts
 * import { syncConflictTable } from "@beep/documents-tables/entities/SyncConflict"
 * import { getColumns, getTableName } from "drizzle-orm"
 *
 * const columns = getColumns(syncConflictTable)
 * const tableName = getTableName(syncConflictTable)
 * if (tableName !== "documents_sync_conflict" || columns.conflictKind.name !== "conflict_kind") {
 *   throw new Error("unexpected SyncConflict table projection")
 * }
 *
 * console.log(`${tableName}:${columns.conflictKind.name}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const syncConflictTable = EntityTable.pgTableFrom(DomainSyncConflict.SyncConflict);

/**
 * Physical Postgres table name derived from the SyncConflict entity definition.
 *
 * **Example** (Validate physical table name)
 *
 * ```ts
 * import { SYNC_CONFLICT_TABLE_NAME } from "@beep/documents-tables/entities/SyncConflict"
 *
 * const tableName = SYNC_CONFLICT_TABLE_NAME
 * if (tableName !== "documents_sync_conflict") {
 *   throw new Error("unexpected SyncConflict table name")
 * }
 *
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const SYNC_CONFLICT_TABLE_NAME = syncConflictTable.definition.tableName;
