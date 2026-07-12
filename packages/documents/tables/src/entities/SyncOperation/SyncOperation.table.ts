/**
 * SyncOperation table mapping.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import { EntityTable } from "@beep/drizzle";

/**
 * Drizzle table projection for documents SyncOperation entities.
 *
 * @example
 * ```ts
 * import { syncOperationTable } from "@beep/documents-tables/entities/SyncOperation"
 * import { getColumns, getTableName } from "drizzle-orm"
 *
 * const columns = getColumns(syncOperationTable)
 * const tableName = getTableName(syncOperationTable)
 * if (tableName !== "documents_sync_operation" || columns.idempotencyKey.name !== "idempotency_key") {
 *   throw new Error("unexpected SyncOperation table projection")
 * }
 *
 * console.log(`${tableName}:${columns.idempotencyKey.name}`)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const syncOperationTable = EntityTable.pgTableFrom(DomainSyncOperation.SyncOperation);

/**
 * Physical Postgres table name derived from the SyncOperation entity definition.
 *
 * @example
 * ```ts
 * import { SYNC_OPERATION_TABLE_NAME } from "@beep/documents-tables/entities/SyncOperation"
 *
 * const tableName = SYNC_OPERATION_TABLE_NAME
 * if (tableName !== "documents_sync_operation") {
 *   throw new Error("unexpected SyncOperation table name")
 * }
 *
 * console.log(tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const SYNC_OPERATION_TABLE_NAME = syncOperationTable.definition.tableName;
