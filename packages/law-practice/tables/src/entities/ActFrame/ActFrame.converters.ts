/**
 * Law-practice ActFrame row converters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ActFrame } from "@beep/law-practice-domain/entities/ActFrame";
import { Result } from "effect";
import * as S from "effect/Schema";
import type { Table } from "./ActFrame.table.ts";

/**
 * Selected law-practice ActFrame row.
 *
 * **Example** (Collect selected rows)
 *
 * ```ts
 * import type { ActFrameRow } from "@beep/law-practice-tables/entities/ActFrame"
 *
 * const rows: ReadonlyArray<ActFrameRow> = []
 * console.log(rows.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ActFrameRow = typeof Table.$inferSelect;

/**
 * Insertable law-practice ActFrame row.
 *
 * **Example** (Collect insert rows)
 *
 * ```ts
 * import type { ActFrameInsert } from "@beep/law-practice-tables/entities/ActFrame"
 *
 * const inserts: ReadonlyArray<ActFrameInsert> = []
 * console.log(inserts.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ActFrameInsert = typeof Table.$inferInsert;

const encodeActFrame = S.encodeResult(ActFrame);

/**
 * Convert an act frame entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the column shape
 * {@link Table} projects. The database-managed `id` is dropped so the insert
 * defers to the table sequence.
 *
 * **Gotchas**
 *
 * There is no update counterpart, and there deliberately never will be: a second reading of the
 * same provision is a new frame, because editing this one would silently
 * rewrite what an interpreter is on record as having read.
 *
 * **Example** (Encode a decoded row back into an insert)
 *
 * ```ts
 * import {
 *   fromActFrameRow,
 *   toActFrameInsert
 * } from "@beep/law-practice-tables/entities/ActFrame"
 * import { Result } from "effect"
 *
 * const insert = Result.flatMap(fromActFrameRow({}), toActFrameInsert)
 * console.log(Result.isFailure(insert)) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toActFrameInsert = (frame: ActFrame): Result.Result<ActFrameInsert, S.SchemaError> =>
  Result.map(encodeActFrame(frame), (encoded): ActFrameInsert => {
    const { id: _id, ...insert } = encoded;
    return insert;
  });

/**
 * Convert a selected persistence row into an act frame entity.
 *
 * **Details**
 *
 * The input is `unknown` rather than {@link ActFrameRow} because the driver hands
 * back untrusted values; every jsonb column is re-decoded through the entity
 * schema rather than trusted as its declared column type.
 *
 * **Gotchas**
 *
 * Every set-valued field in the payload is stored as a JSON array and decoded
 * back into a `HashSet` here. It is `HashSet` from `@beep/schema` that makes
 * that work: `effect/Schema`'s own `HashSet` encodes to a tagged wrapper no
 * decoder accepts, so a field declared with it cannot survive a row trip.
 *
 * **Example** (Reject a row that records no reading)
 *
 * ```ts
 * import { fromActFrameRow } from "@beep/law-practice-tables/entities/ActFrame"
 * import { Result } from "effect"
 *
 * console.log(Result.isFailure(fromActFrameRow({}))) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromActFrameRow: (row: unknown) => Result.Result<ActFrame, S.SchemaError> =
  S.decodeUnknownResult(ActFrame);
