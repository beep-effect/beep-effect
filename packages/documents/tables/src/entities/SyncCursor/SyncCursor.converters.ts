/**
 * Documents SyncCursor row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { SyncCursor } from "@beep/documents-domain/entities/SyncCursor";
import * as S from "effect/Schema";
import type { syncCursorTable } from "./SyncCursor.table.js";

/**
 * Selected documents SyncCursor row.
 *
 * @example
 * ```ts
 * import type { syncCursorTable, SyncCursorRow } from "@beep/documents-tables/entities/SyncCursor"
 *
 * type RowMatchesTable = SyncCursorRow extends typeof syncCursorTable.$inferSelect ? true : false
 * const rowMatchesTable: RowMatchesTable = true
 *
 * console.log(rowMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type SyncCursorRow = typeof syncCursorTable.$inferSelect;

/**
 * Insertable documents SyncCursor row.
 *
 * @example
 * ```ts
 * import type { syncCursorTable, SyncCursorInsert } from "@beep/documents-tables/entities/SyncCursor"
 *
 * type InsertMatchesTable = SyncCursorInsert extends typeof syncCursorTable.$inferInsert ? true : false
 * const insertMatchesTable: InsertMatchesTable = true
 *
 * console.log(insertMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type SyncCursorInsert = typeof syncCursorTable.$inferInsert;

const encodeSyncCursor = S.encodeSync(SyncCursor);
const decodeSyncCursorRow = S.decodeUnknownSync(SyncCursor);

/**
 * Convert a SyncCursor entity into its persistence insert row.
 *
 * The schema-first entity is its own row codec: encoding yields the field-key
 * shape accepted by {@link syncCursorTable}, whose metadata carries the
 * physical SQL column names. The database-managed `id` (SERIAL) is dropped so
 * the insert defers to the sequence.
 *
 * @example
 * ```ts
 * import { fromSyncCursorRow, toSyncCursorInsert } from "@beep/documents-tables/entities/SyncCursor"
 * import type { SyncCursorRow } from "@beep/documents-tables/entities/SyncCursor"
 *
 * const row = {
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "DocumentsSyncCursor",
 *   id: 1,
 *   lastError: null,
 *   lastEventId: null,
 *   orgId: 1,
 *   provider: "box",
 *   publicId: "documents_sync_cursor_a1",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   status: "active",
 *   streamPosition: "now",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   workspaceId: 2
 * } satisfies SyncCursorRow
 *
 * const insert = toSyncCursorInsert(fromSyncCursorRow(row))
 * console.log("id" in insert) // false
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toSyncCursorInsert = (syncCursor: SyncCursor): SyncCursorInsert => {
  const { id: _id, ...rest } = encodeSyncCursor(syncCursor);
  return rest as SyncCursorInsert;
};

/**
 * Convert a selected persistence row into a SyncCursor entity.
 *
 * @example
 * ```ts
 * import { fromSyncCursorRow } from "@beep/documents-tables/entities/SyncCursor"
 * import type { SyncCursorRow } from "@beep/documents-tables/entities/SyncCursor"
 *
 * const row = {
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: "DocumentsSyncCursor",
 *   id: 1,
 *   lastError: "box: stream position expired",
 *   lastEventId: "evt-99",
 *   orgId: 1,
 *   provider: "box",
 *   publicId: "documents_sync_cursor_a1",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   status: "error",
 *   streamPosition: "1152922976252290886",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" },
 *   workspaceId: 2
 * } satisfies SyncCursorRow
 *
 * const syncCursor = fromSyncCursorRow(row)
 * console.log(syncCursor.status)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromSyncCursorRow = (row: SyncCursorRow): SyncCursor => decodeSyncCursorRow(row);
