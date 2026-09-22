/**
 * Documents SyncItem row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { SyncItem } from "@beep/documents-domain/entities/SyncItem";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { SyncItemConverterError } from "./SyncItem.errors.ts";
import type { syncItemTable } from "./SyncItem.table.ts";

/**
 * Selected documents SyncItem row.
 *
 * **Example** (Row type matches select)
 *
 * ```ts
 * import type { syncItemTable, SyncItemRow } from "@beep/documents-tables/entities/SyncItem"
 *
 * type RowMatchesTable = SyncItemRow extends typeof syncItemTable.$inferSelect ? true : false
 * const rowMatchesTable: RowMatchesTable = true
 *
 * console.log(rowMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type SyncItemRow = typeof syncItemTable.$inferSelect;

/**
 * Insertable documents SyncItem row.
 *
 * **Example** (Insert type matches table)
 *
 * ```ts
 * import type { syncItemTable, SyncItemInsert } from "@beep/documents-tables/entities/SyncItem"
 *
 * type InsertMatchesTable = SyncItemInsert extends typeof syncItemTable.$inferInsert ? true : false
 * const insertMatchesTable: InsertMatchesTable = true
 *
 * console.log(insertMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type SyncItemInsert = typeof syncItemTable.$inferInsert;

const encodeSyncItem = S.encodeResult(SyncItem);
const decodeSyncItemRow = S.decodeUnknownResult(SyncItem);

/**
 * Convert a SyncItem entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the field-key
 * shape accepted by {@link syncItemTable}, whose metadata carries the physical
 * SQL column names. The database-managed `id` (SERIAL) is dropped so the
 * insert defers to the sequence.
 *
 * **Example** (Insert omits database id)
 *
 * ```ts
 * import { fromSyncItemRow, toSyncItemInsert } from "@beep/documents-tables/entities/SyncItem"
 * import type { SyncItemRow } from "@beep/documents-tables/entities/SyncItem"
 * import { Result } from "effect"
 *
 * const row = {
 *   contentDigest: "abc123",
 *   contentSizeBytes: 2048,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "DocumentsSyncItem",
 *   id: 1,
 *   itemKind: "file",
 *   lastError: null,
 *   lastPushedDigest: null,
 *   lastPushedGeneration: null,
 *   localGeneration: 1,
 *   localRelPath: "matters/client-default/complaint.pdf",
 *   orgId: 1,
 *   provider: "box",
 *   publicId: "documents_sync_item_a1",
 *   remoteId: null,
 *   remoteName: null,
 *   remoteParentId: null,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   syncState: "pending",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   workspaceId: 2
 * } satisfies SyncItemRow
 *
 * const insert = Result.flatMap(fromSyncItemRow(row), toSyncItemInsert)
 * console.log(Result.isSuccess(insert) && !("id" in insert.success))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toSyncItemInsert = (syncItem: SyncItem): Result.Result<SyncItemInsert, SyncItemConverterError> =>
  Result.mapError(
    Result.map(encodeSyncItem(syncItem), (encoded): SyncItemInsert => {
      const { id: _id, ...insert } = encoded;
      return insert;
    }),
    SyncItemConverterError.fromSchemaError
  );

/**
 * Convert a selected persistence row into a SyncItem entity.
 *
 * **Example** (Decode row to entity)
 *
 * ```ts
 * import { fromSyncItemRow } from "@beep/documents-tables/entities/SyncItem"
 * import type { SyncItemRow } from "@beep/documents-tables/entities/SyncItem"
 * import { Result } from "effect"
 *
 * const row = {
 *   contentDigest: null,
 *   contentSizeBytes: null,
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "DocumentsSyncItem",
 *   id: 1,
 *   itemKind: "folder",
 *   lastError: null,
 *   lastPushedDigest: null,
 *   lastPushedGeneration: null,
 *   localGeneration: 1,
 *   localRelPath: "matters/client-default",
 *   orgId: 1,
 *   provider: "box",
 *   publicId: "documents_sync_item_a1",
 *   remoteId: null,
 *   remoteName: null,
 *   remoteParentId: null,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   syncState: "pending",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   workspaceId: 2
 * } satisfies SyncItemRow
 *
 * const syncItem = fromSyncItemRow(row)
 * console.log(Result.isSuccess(syncItem) && syncItem.success.syncState)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromSyncItemRow = (row: SyncItemRow): Result.Result<SyncItem, SyncItemConverterError> =>
  Result.mapError(decodeSyncItemRow(row), SyncItemConverterError.fromSchemaError);
