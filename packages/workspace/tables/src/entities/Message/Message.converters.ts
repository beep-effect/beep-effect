/**
 * Workspace Message row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { Message } from "@beep/workspace-domain/entities/Message";
import * as S from "effect/Schema";
import type { Table } from "./Message.table.ts";

/**
 * Selected workspace Message row.
 *
 * @example
 * ```ts
 * import type { MessageRow, Table } from "@beep/workspace-tables/entities/Message"
 *
 * type RowMatchesTable = MessageRow extends typeof Table.$inferSelect ? true : false
 * const rowMatchesTable: RowMatchesTable = true
 *
 * console.log(rowMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type MessageRow = typeof Table.$inferSelect;

/**
 * Insertable workspace Message row.
 *
 * @example
 * ```ts
 * import type { MessageInsert, Table } from "@beep/workspace-tables/entities/Message"
 *
 * type InsertMatchesTable = MessageInsert extends typeof Table.$inferInsert ? true : false
 * const insertMatchesTable: InsertMatchesTable = true
 *
 * console.log(insertMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type MessageInsert = typeof Table.$inferInsert;

const encodeMessage = S.encodeSync(Message);
const decodeMessageRow = S.decodeUnknownSync(Message);

/**
 * Convert a Message entity into its persistence insert row.
 *
 * The schema-first entity is its own row codec: encoding yields the field-key
 * shape accepted by {@link Table}, whose metadata carries the physical SQL
 * column names. The database-managed `id` (SERIAL) is dropped so the insert
 * defers to the sequence.
 *
 * @example
 * ```ts
 * import { Message } from "@beep/workspace-domain/entities/Message"
 * import { toMessageInsert } from "@beep/workspace-tables/entities/Message"
 * import * as S from "effect/Schema"
 *
 * const principal = { component: "Runtime", kind: "System" }
 * const message = S.decodeUnknownSync(Message)({
 *   content: {
 *     _tag: "document",
 *     children: [{ _tag: "p", children: [{ _tag: "text", value: "Hello thread" }] }]
 *   },
 *   createdAt: 1,
 *   createdByPrincipal: principal,
 *   entityType: "WorkspaceMessage",
 *   id: 11,
 *   orgId: 1,
 *   publicId: "workspace_message_a11",
 *   role: "assistant",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   threadId: 10,
 *   turnId: 12,
 *   updatedAt: 2,
 *   updatedByPrincipal: principal
 * })
 *
 * const insert = toMessageInsert(message)
 * console.log(insert.turnId)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toMessageInsert = (message: Message): MessageInsert => {
  const encoded = encodeMessage(message);

  return {
    content: encoded.content,
    createdAt: encoded.createdAt,
    createdByPrincipal: encoded.createdByPrincipal,
    entityType: encoded.entityType,
    orgId: encoded.orgId,
    publicId: encoded.publicId,
    role: encoded.role,
    rowVersion: encoded.rowVersion,
    schemaVersion: encoded.schemaVersion,
    source: encoded.source,
    threadId: encoded.threadId,
    turnId: encoded.turnId,
    updatedAt: encoded.updatedAt,
    updatedByPrincipal: encoded.updatedByPrincipal,
  } satisfies MessageInsert;
};

/**
 * Convert a selected persistence row into a Message entity.
 *
 * @example
 * ```ts
 * import { fromMessageRow, type MessageRow } from "@beep/workspace-tables/entities/Message"
 *
 * const row = {
 *   content: {
 *     _tag: "document",
 *     children: [{ _tag: "p", children: [{ _tag: "text", value: "Hello thread" }] }]
 *   },
 *   createdAt: 1,
 *   createdByPrincipal: { component: "Runtime", kind: "System" },
 *   entityType: "WorkspaceMessage",
 *   id: 11,
 *   orgId: 1,
 *   publicId: "workspace_message_a11",
 *   role: "assistant",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   threadId: 10,
 *   turnId: 12,
 *   updatedAt: 2,
 *   updatedByPrincipal: { component: "Runtime", kind: "System" }
 * } satisfies MessageRow
 *
 * const message = fromMessageRow(row)
 * console.log(message.role)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromMessageRow = (row: MessageRow): Message => decodeMessageRow(row);
