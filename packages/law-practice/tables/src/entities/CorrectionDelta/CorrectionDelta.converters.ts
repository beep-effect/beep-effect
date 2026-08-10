/**
 * Law-practice CorrectionDelta row converters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CorrectionDelta } from "@beep/law-practice-domain/entities/CorrectionDelta";
import { Result } from "effect";
import * as S from "effect/Schema";
import type { Table } from "./CorrectionDelta.table.ts";

/**
 * Selected law-practice CorrectionDelta row.
 *
 * **Example** (Collect selected rows)
 *
 * ```ts
 * import type { CorrectionDeltaRow } from "@beep/law-practice-tables/entities/CorrectionDelta"
 *
 * const rows: ReadonlyArray<CorrectionDeltaRow> = []
 * console.log(rows.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type CorrectionDeltaRow = typeof Table.$inferSelect;

/**
 * Insertable law-practice CorrectionDelta row.
 *
 * **Example** (Collect insert rows)
 *
 * ```ts
 * import type { CorrectionDeltaInsert } from "@beep/law-practice-tables/entities/CorrectionDelta"
 *
 * const inserts: ReadonlyArray<CorrectionDeltaInsert> = []
 * console.log(inserts.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type CorrectionDeltaInsert = typeof Table.$inferInsert;

const encodeCorrectionDelta = S.encodeResult(CorrectionDelta);

/**
 * Convert a correction delta entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the column shape
 * {@link Table} projects. The database-managed `id` is dropped so the insert
 * defers to the table sequence.
 *
 * **Gotchas**
 *
 * There is no update counterpart, and there deliberately never will be: a revised correction is a
 * new row whose `supersedes` names the prior one.
 *
 * **Example** (Encode a decoded row back into an insert)
 *
 * ```ts
 * import {
 *   fromCorrectionDeltaRow,
 *   toCorrectionDeltaInsert
 * } from "@beep/law-practice-tables/entities/CorrectionDelta"
 * import { Result } from "effect"
 *
 * const insert = Result.flatMap(fromCorrectionDeltaRow({}), toCorrectionDeltaInsert)
 * console.log(Result.isFailure(insert)) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toCorrectionDeltaInsert = (delta: CorrectionDelta): Result.Result<CorrectionDeltaInsert, S.SchemaError> =>
  Result.map(encodeCorrectionDelta(delta), (encoded): CorrectionDeltaInsert => {
    const { id: _id, ...insert } = encoded;
    return insert;
  });

/**
 * Convert a selected persistence row into a correction delta entity.
 *
 * **Details**
 *
 * The input is `unknown` rather than {@link CorrectionDeltaRow} because the driver hands
 * back untrusted values; every jsonb column is re-decoded through the entity
 * schema rather than trusted as its declared column type.
 *
 * **Gotchas**
 *
 * A delta names the elements it touched, one pointer each. A row whose
 * `corrected_elements` decoded to an empty list is refused here rather than
 * read as a correction that touched nothing.
 *
 * **Example** (Reject a row that records no correction)
 *
 * ```ts
 * import { fromCorrectionDeltaRow } from "@beep/law-practice-tables/entities/CorrectionDelta"
 * import { Result } from "effect"
 *
 * console.log(Result.isFailure(fromCorrectionDeltaRow({}))) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromCorrectionDeltaRow: (row: unknown) => Result.Result<CorrectionDelta, S.SchemaError> =
  S.decodeUnknownResult(CorrectionDelta);
