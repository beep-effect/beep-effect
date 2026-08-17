/**
 * SyncCursor table mapping.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import * as DomainSyncCursor from "@beep/documents-domain/entities/SyncCursor";
import { toPgTable } from "@beep/effect-drizzle/pg";
import { getTableName } from "drizzle-orm";

/**
 * Drizzle table projection for documents SyncCursor entities.
 *
 * **Example** (Validate SyncCursor table projection)
 *
 * ```ts
 * import { syncCursorTable } from "@beep/documents-tables/entities/SyncCursor"
 * import { getColumns, getTableName } from "drizzle-orm"
 *
 * const columns = getColumns(syncCursorTable)
 * const tableName = getTableName(syncCursorTable)
 * if (tableName !== "documents_sync_cursor" || columns.streamPosition.name !== "stream_position") {
 *   throw new Error("unexpected SyncCursor table projection")
 * }
 *
 * console.log(`${tableName}:${columns.streamPosition.name}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const syncCursorTable = toPgTable(DomainSyncCursor.SyncCursor);

/**
 * Physical Postgres table name derived from the SyncCursor entity definition.
 *
 * **Example** (Validate SyncCursor table name)
 *
 * ```ts
 * import { SYNC_CURSOR_TABLE_NAME } from "@beep/documents-tables/entities/SyncCursor"
 *
 * const tableName = SYNC_CURSOR_TABLE_NAME
 * if (tableName !== "documents_sync_cursor") {
 *   throw new Error("unexpected SyncCursor table name")
 * }
 *
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const SYNC_CURSOR_TABLE_NAME = getTableName(syncCursorTable);
