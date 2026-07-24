/**
 * Documents SyncItem row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { SyncItem } from "@beep/documents-domain/entities/SyncItem";
import * as S from "effect/Schema";
import type { syncItemTable } from "./SyncItem.table.ts";

/**
 * Selected documents SyncItem row.
 *
 * @example
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
 * @example
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

const encodeSyncItem = S.encodeSync(SyncItem);
const decodeSyncItemRow = S.decodeUnknownSync(SyncItem);

/**
 * Convert a SyncItem entity into its persistence insert row.
 *
 * The schema-first entity is its own row codec: encoding yields the field-key
 * shape accepted by {@link syncItemTable}, whose metadata carries the physical
 * SQL column names. The database-managed `id` (SERIAL) is dropped so the
 * insert defers to the sequence.
 *
 * @example
 * ```ts
 * import { fromSyncItemRow, toSyncItemInsert } from "@beep/documents-tables/entities/SyncItem"
 * import type { SyncItemRow } from "@beep/documents-tables/entities/SyncItem"
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
 * const insert = toSyncItemInsert(fromSyncItemRow(row))
 * console.log("id" in insert) // false
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toSyncItemInsert = (syncItem: SyncItem): SyncItemInsert => {
  const { id: _id, ...rest } = encodeSyncItem(syncItem);
  return rest as SyncItemInsert;
};

/**
 * Convert a selected persistence row into a SyncItem entity.
 *
 * @example
 * ```ts
 * import { fromSyncItemRow } from "@beep/documents-tables/entities/SyncItem"
 * import type { SyncItemRow } from "@beep/documents-tables/entities/SyncItem"
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
 * console.log(syncItem.syncState)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromSyncItemRow = (row: SyncItemRow): SyncItem => decodeSyncItemRow(row);
