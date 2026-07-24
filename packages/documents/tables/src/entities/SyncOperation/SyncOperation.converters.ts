/**
 * Documents SyncOperation row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { SyncOperation } from "@beep/documents-domain/entities/SyncOperation";
import * as S from "effect/Schema";
import type { syncOperationTable } from "./SyncOperation.table.ts";

/**
 * Selected documents SyncOperation row.
 *
 * @example
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
 * @example
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

const encodeSyncOperation = S.encodeSync(SyncOperation);
const decodeSyncOperationRow = S.decodeUnknownSync(SyncOperation);

/**
 * Convert a SyncOperation entity into its persistence insert row.
 *
 * The schema-first entity is its own row codec: encoding yields the field-key
 * shape accepted by {@link syncOperationTable}, whose metadata carries the
 * physical SQL column names. The database-managed `id` (SERIAL) is dropped so
 * the insert defers to the sequence.
 *
 * @example
 * ```ts
 * import { fromSyncOperationRow, toSyncOperationInsert } from "@beep/documents-tables/entities/SyncOperation"
 * import type { SyncOperationRow } from "@beep/documents-tables/entities/SyncOperation"
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
 * const insert = toSyncOperationInsert(fromSyncOperationRow(row))
 * console.log("id" in insert) // false
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toSyncOperationInsert = (syncOperation: SyncOperation): SyncOperationInsert => {
  const { id: _id, ...rest } = encodeSyncOperation(syncOperation);
  return rest as SyncOperationInsert;
};

/**
 * Convert a selected persistence row into a SyncOperation entity.
 *
 * @example
 * ```ts
 * import { fromSyncOperationRow } from "@beep/documents-tables/entities/SyncOperation"
 * import type { SyncOperationRow } from "@beep/documents-tables/entities/SyncOperation"
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
 * console.log(syncOperation.status)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromSyncOperationRow = (row: SyncOperationRow): SyncOperation => decodeSyncOperationRow(row);
