/**
 * Law-practice CandorDisposition row converters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CandorDisposition } from "@beep/law-practice-domain/entities/CandorDisposition";
import { Result } from "effect";
import * as S from "effect/Schema";
import type { Table } from "./CandorDisposition.table.ts";

/**
 * Selected law-practice CandorDisposition row.
 *
 * **Example** (Collect selected rows)
 *
 * ```ts
 * import type { CandorDispositionRow } from "@beep/law-practice-tables/entities/CandorDisposition"
 *
 * const rows: ReadonlyArray<CandorDispositionRow> = []
 * console.log(rows.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type CandorDispositionRow = typeof Table.$inferSelect;

/**
 * Insertable law-practice CandorDisposition row.
 *
 * **Example** (Collect insert rows)
 *
 * ```ts
 * import type { CandorDispositionInsert } from "@beep/law-practice-tables/entities/CandorDisposition"
 *
 * const inserts: ReadonlyArray<CandorDispositionInsert> = []
 * console.log(inserts.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type CandorDispositionInsert = typeof Table.$inferInsert;

const encodeCandorDisposition = S.encodeResult(CandorDisposition);

/**
 * Convert a CandorDisposition entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the column shape
 * {@link Table} projects. The database-managed `id` is dropped so the insert
 * defers to the table sequence.
 *
 * **Gotchas**
 *
 * There is no update counterpart, and there deliberately never will be: a
 * revised judgment is a new row whose `supersedes` names the prior one.
 *
 * **Example** (Encode a decoded row back into an insert)
 *
 * ```ts
 * import {
 *   fromCandorDispositionRow,
 *   toCandorDispositionInsert
 * } from "@beep/law-practice-tables/entities/CandorDisposition"
 * import { Result } from "effect"
 *
 * const insert = Result.flatMap(fromCandorDispositionRow({}), toCandorDispositionInsert)
 * console.log(Result.isFailure(insert)) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toCandorDispositionInsert = (
  disposition: CandorDisposition
): Result.Result<CandorDispositionInsert, S.SchemaError> =>
  Result.map(encodeCandorDisposition(disposition), (encoded): CandorDispositionInsert => {
    const { id: _id, ...insert } = encoded;
    return insert;
  });

/**
 * Convert a selected persistence row into a CandorDisposition entity.
 *
 * **Details**
 *
 * The input is `unknown` rather than {@link CandorDispositionRow} because the
 * driver hands back untrusted values; every jsonb column is re-decoded through
 * the entity schema rather than trusted as its declared column type.
 *
 * **Example** (Reject a row that carries no recorded judgment)
 *
 * ```ts
 * import { fromCandorDispositionRow } from "@beep/law-practice-tables/entities/CandorDisposition"
 * import { Result } from "effect"
 *
 * console.log(Result.isFailure(fromCandorDispositionRow({}))) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromCandorDispositionRow: (row: unknown) => Result.Result<CandorDisposition, S.SchemaError> =
  S.decodeUnknownResult(CandorDisposition);
