/**
 * Documents SyncOperation row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { SyncOperation } from "@beep/documents-domain/entities/SyncOperation";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { SyncOperationConverterError } from "./SyncOperation.errors.ts";
import type { syncOperationTable } from "./SyncOperation.table.ts";

/**
 * Selected documents SyncOperation row.
 *
 * **Example** (Row matches table select)
 *
 * ```ts
 * import type { syncOperationTable, SyncOperationRow } from "@beep/documents-tables/entities/SyncOperation"
 *
 * type RowMatchesTable = SyncOperationRow extends typeof syncOperationTable.$inferSelect ? true : false
 * const rowMatchesTable: RowMatchesTable = true
 *
 * console.log(rowMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type SyncOperationRow = typeof syncOperationTable.$inferSelect;

/**
 * Insertable documents SyncOperation row.
 *
 * **Example** (Insert matches table insert)
 *
 * ```ts
 * import type { syncOperationTable, SyncOperationInsert } from "@beep/documents-tables/entities/SyncOperation"
 *
 * type InsertMatchesTable = SyncOperationInsert extends typeof syncOperationTable.$inferInsert ? true : false
 * const insertMatchesTable: InsertMatchesTable = true
 *
 * console.log(insertMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type SyncOperationInsert = typeof syncOperationTable.$inferInsert;

const encodeSyncOperation = S.encodeResult(SyncOperation);
const decodeSyncOperationRow = S.decodeUnknownResult(SyncOperation);

/**
 * Convert a SyncOperation entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the field-key
 * shape accepted by {@link syncOperationTable}, whose metadata carries the
 * physical SQL column names. The database-managed `id` (SERIAL) is dropped so
 * the insert defers to the sequence.
 *
 * **Example** (Insert drops managed id)
 *
 * ```ts
 * import { fromSyncOperationRow, toSyncOperationInsert } from "@beep/documents-tables/entities/SyncOperation"
 * import type { SyncOperationRow } from "@beep/documents-tables/entities/SyncOperation"
 * import * as Result from "effect/Result"
 *
 * const row = {
 *   attemptCount: 0,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "DocumentsSyncOperation",
 *   id: 1,
 *   idempotencyKey: "sync-item-1:uploadFile:1",
 *   inputContentDigest: "abc123",
 *   inputGeneration: 1,
 *   lastError: null,
 *   operationType: "uploadFile",
 *   orgId: 1,
 *   provider: "box",
 *   publicId: "documents_sync_operation_a1",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   status: "queued",
 *   syncItemId: 1,
 *   targetName: "complaint.pdf",
 *   targetParentRelPath: "matters/client-default",
 *   targetRelPath: "matters/client-default/complaint.pdf",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   workspaceId: 2
 * } satisfies SyncOperationRow
 *
 * const insert = Result.flatMap(fromSyncOperationRow(row), toSyncOperationInsert)
 * console.log(Result.isSuccess(insert) && !("id" in insert.success))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toSyncOperationInsert = (
  syncOperation: SyncOperation
): Result.Result<SyncOperationInsert, SyncOperationConverterError> =>
  Result.mapError(
    Result.map(encodeSyncOperation(syncOperation), (encoded): SyncOperationInsert => {
      const { id: _id, ...insert } = encoded;
      return insert;
    }),
    SyncOperationConverterError.fromSchemaError
  );

/**
 * Convert a selected persistence row into a SyncOperation entity.
 *
 * **Example** (Convert row to entity)
 *
 * ```ts
 * import { fromSyncOperationRow } from "@beep/documents-tables/entities/SyncOperation"
 * import type { SyncOperationRow } from "@beep/documents-tables/entities/SyncOperation"
 * import * as Result from "effect/Result"
 *
 * const row = {
 *   attemptCount: 2,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "DocumentsSyncOperation",
 *   id: 1,
 *   idempotencyKey: "sync-item-1:createFolder:1",
 *   inputContentDigest: null,
 *   inputGeneration: 1,
 *   lastError: "box: 503 service unavailable",
 *   operationType: "createFolder",
 *   orgId: 1,
 *   provider: "box",
 *   publicId: "documents_sync_operation_a1",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   status: "failed",
 *   syncItemId: 1,
 *   targetName: "client-default",
 *   targetParentRelPath: null,
 *   targetRelPath: "matters/client-default",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   workspaceId: 2
 * } satisfies SyncOperationRow
 *
 * const syncOperation = fromSyncOperationRow(row)
 * console.log(Result.isSuccess(syncOperation) && syncOperation.success.status)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromSyncOperationRow = (
  row: SyncOperationRow
): Result.Result<SyncOperation, SyncOperationConverterError> =>
  Result.mapError(decodeSyncOperationRow(row), SyncOperationConverterError.fromSchemaError);
