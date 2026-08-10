/**
 * Workspace Thread row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { Thread } from "@beep/workspace-domain/entities/Thread";
import * as S from "effect/Schema";
import type { Table } from "./Thread.table.ts";

/**
 * Selected workspace Thread row.
 *
 * **Example** (Row matches table select)
 *
 * ```ts
 * import type { Table, ThreadRow } from "@beep/workspace-tables/entities/Thread"
 *
 * type RowMatchesTable = ThreadRow extends typeof Table.$inferSelect ? true : false
 * const rowMatchesTable: RowMatchesTable = true
 *
 * console.log(rowMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ThreadRow = typeof Table.$inferSelect;

/**
 * Insertable workspace Thread row.
 *
 * **Example** (Insert matches table insert)
 *
 * ```ts
 * import type { Table, ThreadInsert } from "@beep/workspace-tables/entities/Thread"
 *
 * type InsertMatchesTable = ThreadInsert extends typeof Table.$inferInsert ? true : false
 * const insertMatchesTable: InsertMatchesTable = true
 *
 * console.log(insertMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ThreadInsert = typeof Table.$inferInsert;

const encodeThread = S.encodeSync(Thread);
const decodeThreadRow = S.decodeUnknownSync(Thread);

/**
 * Convert a Thread entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the field-key
 * shape accepted by {@link Table}, whose metadata carries the physical SQL
 * column names. The database-managed `id` (SERIAL) is dropped so the insert
 * defers to the sequence.
 *
 * **Example** (Convert entity to insert)
 *
 * ```ts
 * import { Thread } from "@beep/workspace-domain/entities/Thread"
 * import { toThreadInsert } from "@beep/workspace-tables/entities/Thread"
 * import * as S from "effect/Schema"
 *
 * const principal = { component: "Runtime", kind: "System" }
 * const thread = S.decodeUnknownSync(Thread)({
 *   createdAt: 1,
 *   createdByPrincipal: principal,
 *   entityType: "WorkspaceThread",
 *   id: 10,
 *   orgId: 1,
 *   publicId: "workspace_thread_a10",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   title: "Matter intake",
 *   updatedAt: 2,
 *   updatedByPrincipal: principal,
 *   workspaceId: 2
 * })
 *
 * const insert = toThreadInsert(thread)
 * console.log(insert.workspaceId)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toThreadInsert = (thread: Thread): ThreadInsert => {
  const encoded = encodeThread(thread);

  return {
    createdAt: encoded.createdAt,
    createdByPrincipal: encoded.createdByPrincipal,
    entityType: encoded.entityType,
    orgId: encoded.orgId,
    publicId: encoded.publicId,
    rowVersion: encoded.rowVersion,
    schemaVersion: encoded.schemaVersion,
    source: encoded.source,
    title: encoded.title,
    updatedAt: encoded.updatedAt,
    updatedByPrincipal: encoded.updatedByPrincipal,
    workspaceId: encoded.workspaceId,
  } satisfies ThreadInsert;
};

/**
 * Convert a selected persistence row into a Thread entity.
 *
 * **Example** (Convert row to entity)
 *
 * ```ts
 * import { fromThreadRow, type ThreadRow } from "@beep/workspace-tables/entities/Thread"
 *
 * const row = {
 *   createdAt: 1,
 *   createdByPrincipal: { component: "Runtime", kind: "System" },
 *   entityType: "WorkspaceThread",
 *   id: 10,
 *   orgId: 1,
 *   publicId: "workspace_thread_a10",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   title: "Matter intake",
 *   updatedAt: 2,
 *   updatedByPrincipal: { component: "Runtime", kind: "System" },
 *   workspaceId: 2
 * } satisfies ThreadRow
 *
 * const thread = fromThreadRow(row)
 * console.log(thread.title)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromThreadRow = (row: ThreadRow): Thread => decodeThreadRow(row);
