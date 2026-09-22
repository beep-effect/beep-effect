/**
 * Workspace Turn row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { Turn } from "@beep/workspace-domain/entities/Turn";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { TurnConverterError } from "./Turn.errors.ts";
import type { Table } from "./Turn.table.ts";

/**
 * Selected workspace Turn row.
 *
 * **Example** (Row matches table select)
 *
 * ```ts
 * import type { Table, TurnRow } from "@beep/workspace-tables/entities/Turn"
 *
 * type RowMatchesTable = TurnRow extends typeof Table.$inferSelect ? true : false
 * const rowMatchesTable: RowMatchesTable = true
 *
 * console.log(rowMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type TurnRow = typeof Table.$inferSelect;

/**
 * Insertable workspace Turn row.
 *
 * **Example** (Insert matches table insert)
 *
 * ```ts
 * import type { Table, TurnInsert } from "@beep/workspace-tables/entities/Turn"
 *
 * type InsertMatchesTable = TurnInsert extends typeof Table.$inferInsert ? true : false
 * const insertMatchesTable: InsertMatchesTable = true
 *
 * console.log(insertMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type TurnInsert = typeof Table.$inferInsert;

const encodeTurn = S.encodeResult(Turn);
const decodeTurnRow = S.decodeUnknownResult(Turn);

/**
 * Convert a Turn entity into its persistence insert row.
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
 * import { Turn } from "@beep/workspace-domain/entities/Turn"
 * import { toTurnInsert } from "@beep/workspace-tables/entities/Turn"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const principal = { component: "Runtime", kind: "System" }
 * const turn = Result.getOrThrow(S.decodeUnknownResult(Turn)({
 *   createdAt: 1,
 *   createdByPrincipal: principal,
 *   entityType: "WorkspaceTurn",
 *   id: 12,
 *   items: [{ itemType: "message", messageId: 11 }],
 *   orgId: 1,
 *   parentTurnId: null,
 *   publicId: "workspace_turn_a12",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   threadId: 10,
 *   turnIndex: 0,
 *   updatedAt: 2,
 *   updatedByPrincipal: principal
 * }))
 *
 * const insert = toTurnInsert(turn)
 * console.log(Result.getOrThrow(insert).parentTurnId)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toTurnInsert = (turn: Turn): Result.Result<TurnInsert, TurnConverterError> =>
  Result.mapError(
    Result.map(
      encodeTurn(turn),
      (encoded): TurnInsert => ({
        createdAt: encoded.createdAt,
        createdByPrincipal: encoded.createdByPrincipal,
        entityType: encoded.entityType,
        items: encoded.items,
        orgId: encoded.orgId,
        parentTurnId: encoded.parentTurnId,
        publicId: encoded.publicId,
        rowVersion: encoded.rowVersion,
        schemaVersion: encoded.schemaVersion,
        source: encoded.source,
        threadId: encoded.threadId,
        turnIndex: encoded.turnIndex,
        updatedAt: encoded.updatedAt,
        updatedByPrincipal: encoded.updatedByPrincipal,
      })
    ),
    TurnConverterError.fromSchemaError
  );

/**
 * Convert a selected persistence row into a Turn entity.
 *
 * **Example** (Convert row to entity)
 *
 * ```ts
 * import { fromTurnRow, type TurnRow } from "@beep/workspace-tables/entities/Turn"
 * import * as Result from "effect/Result"
 *
 * const row = {
 *   createdAt: 1,
 *   createdByPrincipal: { component: "Runtime", kind: "System" },
 *   entityType: "WorkspaceTurn",
 *   id: 12,
 *   items: [{ itemType: "message", messageId: 11 }],
 *   orgId: 1,
 *   parentTurnId: null,
 *   publicId: "workspace_turn_a12",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   threadId: 10,
 *   turnIndex: 0,
 *   updatedAt: 2,
 *   updatedByPrincipal: { component: "Runtime", kind: "System" }
 * } satisfies TurnRow
 *
 * const turn = fromTurnRow(row)
 * console.log(Result.getOrThrow(turn).items[0]?.itemType)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromTurnRow = (row: TurnRow): Result.Result<Turn, TurnConverterError> =>
  Result.mapError(decodeTurnRow(row), TurnConverterError.fromSchemaError);
