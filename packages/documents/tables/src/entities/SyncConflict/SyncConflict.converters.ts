/**
 * Documents SyncConflict row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { SyncConflict } from "@beep/documents-domain/entities/SyncConflict";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { SyncConflictConverterError } from "./SyncConflict.errors.ts";
import type { syncConflictTable } from "./SyncConflict.table.ts";

/**
 * Selected documents SyncConflict row.
 *
 * **Example** (Row matches table select)
 *
 * ```ts
 * import type { syncConflictTable, SyncConflictRow } from "@beep/documents-tables/entities/SyncConflict"
 *
 * type RowMatchesTable = SyncConflictRow extends typeof syncConflictTable.$inferSelect ? true : false
 * const rowMatchesTable: RowMatchesTable = true
 *
 * console.log(rowMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type SyncConflictRow = typeof syncConflictTable.$inferSelect;

/**
 * Insertable documents SyncConflict row.
 *
 * **Example** (Insert matches table insert)
 *
 * ```ts
 * import type { syncConflictTable, SyncConflictInsert } from "@beep/documents-tables/entities/SyncConflict"
 *
 * type InsertMatchesTable = SyncConflictInsert extends typeof syncConflictTable.$inferInsert ? true : false
 * const insertMatchesTable: InsertMatchesTable = true
 *
 * console.log(insertMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type SyncConflictInsert = typeof syncConflictTable.$inferInsert;

const encodeSyncConflict = S.encodeResult(SyncConflict);
const decodeSyncConflictRow = S.decodeUnknownResult(SyncConflict);

/**
 * Convert a SyncConflict entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the field-key
 * shape accepted by {@link syncConflictTable}, whose metadata carries the
 * physical SQL column names. The database-managed `id` (SERIAL) is dropped so
 * the insert defers to the sequence.
 *
 * **Example** (Insert drops managed id)
 *
 * ```ts
 * import { fromSyncConflictRow, toSyncConflictInsert } from "@beep/documents-tables/entities/SyncConflict"
 * import type { SyncConflictRow } from "@beep/documents-tables/entities/SyncConflict"
 * import * as Result from "effect/Result"
 *
 * const row = {
 *   conflictKind: "remoteEdit",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "DocumentsSyncConflict",
 *   id: 1,
 *   localRelPath: "matters/client-default/complaint.pdf",
 *   orgId: 1,
 *   provider: "box",
 *   publicId: "documents_sync_conflict_a1",
 *   remoteEventId: "evt-1",
 *   remoteId: "1234567890",
 *   remotePayload: { eventType: "ITEM_MODIFY" },
 *   resolutionStatus: "open",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   syncItemId: 1,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   workspaceId: 2
 * } satisfies SyncConflictRow
 *
 * const insert = Result.flatMap(fromSyncConflictRow(row), toSyncConflictInsert)
 * console.log(Result.isSuccess(insert) && !("id" in insert.success))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toSyncConflictInsert = (
  syncConflict: SyncConflict
): Result.Result<SyncConflictInsert, SyncConflictConverterError> =>
  Result.mapError(
    Result.map(encodeSyncConflict(syncConflict), (encoded): SyncConflictInsert => {
      const { id: _id, ...insert } = encoded;
      return insert;
    }),
    SyncConflictConverterError.fromSchemaError
  );

/**
 * Convert a selected persistence row into a SyncConflict entity.
 *
 * **Example** (Row to SyncConflict entity)
 *
 * ```ts
 * import { fromSyncConflictRow } from "@beep/documents-tables/entities/SyncConflict"
 * import type { SyncConflictRow } from "@beep/documents-tables/entities/SyncConflict"
 * import * as Result from "effect/Result"
 *
 * const row = {
 *   conflictKind: "remoteCreate",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "DocumentsSyncConflict",
 *   id: 1,
 *   localRelPath: null,
 *   orgId: 1,
 *   provider: "box",
 *   publicId: "documents_sync_conflict_a1",
 *   remoteEventId: null,
 *   remoteId: null,
 *   remotePayload: { eventType: "ITEM_CREATE" },
 *   resolutionStatus: "open",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   syncItemId: null,
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   workspaceId: 2
 * } satisfies SyncConflictRow
 *
 * const syncConflict = fromSyncConflictRow(row)
 * console.log(Result.isSuccess(syncConflict) && syncConflict.success.conflictKind)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromSyncConflictRow = (row: SyncConflictRow): Result.Result<SyncConflict, SyncConflictConverterError> =>
  Result.mapError(decodeSyncConflictRow(row), SyncConflictConverterError.fromSchemaError);
