/**
 * SyncOperation table mapping.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import * as DomainSyncOperation from "@beep/documents-domain/entities/SyncOperation";
import { toPgTable } from "@beep/effect-drizzle/pg";
import { getTableName } from "drizzle-orm";

/**
 * Drizzle table projection for documents SyncOperation entities.
 *
 * **Example** (Verify table projection columns)
 *
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
export const syncOperationTable = toPgTable(DomainSyncOperation.SyncOperation);

/**
 * Physical Postgres table name derived from the SyncOperation entity definition.
 *
 * **Example** (Verify physical table name)
 *
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
export const SYNC_OPERATION_TABLE_NAME = getTableName(syncOperationTable);
