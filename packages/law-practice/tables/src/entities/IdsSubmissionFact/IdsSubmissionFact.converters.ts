/**
 * Law-practice IdsSubmissionFact row converters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IdsSubmissionFact } from "@beep/law-practice-domain/entities/IdsSubmissionFact";
import { Result } from "effect";
import * as S from "effect/Schema";
import type { Table } from "./IdsSubmissionFact.table.ts";

/**
 * Selected law-practice IdsSubmissionFact row.
 *
 * **Example** (Collect selected rows)
 *
 * ```ts
 * import type { IdsSubmissionFactRow } from "@beep/law-practice-tables/entities/IdsSubmissionFact"
 *
 * const rows: ReadonlyArray<IdsSubmissionFactRow> = []
 * console.log(rows.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type IdsSubmissionFactRow = typeof Table.$inferSelect;

/**
 * Insertable law-practice IdsSubmissionFact row.
 *
 * **Example** (Collect insert rows)
 *
 * ```ts
 * import type { IdsSubmissionFactInsert } from "@beep/law-practice-tables/entities/IdsSubmissionFact"
 *
 * const inserts: ReadonlyArray<IdsSubmissionFactInsert> = []
 * console.log(inserts.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type IdsSubmissionFactInsert = typeof Table.$inferInsert;

const encodeIdsSubmissionFact = S.encodeResult(IdsSubmissionFact);

/**
 * Convert an IdsSubmissionFact entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the column shape
 * {@link Table} projects. The database-managed `id` is dropped so the insert
 * defers to the table sequence.
 *
 * **Gotchas**
 *
 * A supplemental or correcting submission is a separate insert carrying its own
 * `operativeDate`, never an update to the row it follows.
 *
 * **Example** (Encode a decoded row back into an insert)
 *
 * ```ts
 * import {
 *   fromIdsSubmissionFactRow,
 *   toIdsSubmissionFactInsert
 * } from "@beep/law-practice-tables/entities/IdsSubmissionFact"
 * import { Result } from "effect"
 *
 * const insert = Result.flatMap(fromIdsSubmissionFactRow({}), toIdsSubmissionFactInsert)
 * console.log(Result.isFailure(insert)) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toIdsSubmissionFactInsert = (
  fact: IdsSubmissionFact
): Result.Result<IdsSubmissionFactInsert, S.SchemaError> =>
  Result.map(encodeIdsSubmissionFact(fact), (encoded): IdsSubmissionFactInsert => {
    const { id: _id, ...insert } = encoded;
    return insert;
  });

/**
 * Convert a selected persistence row into an IdsSubmissionFact entity.
 *
 * **Details**
 *
 * The input is `unknown` rather than {@link IdsSubmissionFactRow} because the
 * driver hands back untrusted values; every jsonb column is re-decoded through
 * the entity schema rather than trusted as its declared column type.
 *
 * **Example** (Reject a row that carries no recorded submission facts)
 *
 * ```ts
 * import { fromIdsSubmissionFactRow } from "@beep/law-practice-tables/entities/IdsSubmissionFact"
 * import { Result } from "effect"
 *
 * console.log(Result.isFailure(fromIdsSubmissionFactRow({}))) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromIdsSubmissionFactRow: (row: unknown) => Result.Result<IdsSubmissionFact, S.SchemaError> =
  S.decodeUnknownResult(IdsSubmissionFact);
