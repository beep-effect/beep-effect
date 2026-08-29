/**
 * Law-practice LegalPositionRelator row converters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LegalPositionRelator } from "@beep/law-practice-domain/entities/LegalPositionRelator";
import { Result } from "effect";
import * as S from "effect/Schema";
import type { Table } from "./LegalPositionRelator.table.ts";

/**
 * Selected law-practice LegalPositionRelator row.
 *
 * **Example** (Collect selected rows)
 *
 * ```ts
 * import type { LegalPositionRelatorRow } from "@beep/law-practice-tables/entities/LegalPositionRelator"
 *
 * const rows: ReadonlyArray<LegalPositionRelatorRow> = []
 * console.log(rows.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type LegalPositionRelatorRow = typeof Table.$inferSelect;

/**
 * Insertable law-practice LegalPositionRelator row.
 *
 * **Example** (Collect insert rows)
 *
 * ```ts
 * import type { LegalPositionRelatorInsert } from "@beep/law-practice-tables/entities/LegalPositionRelator"
 *
 * const inserts: ReadonlyArray<LegalPositionRelatorInsert> = []
 * console.log(inserts.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type LegalPositionRelatorInsert = typeof Table.$inferInsert;

const encodeLegalPositionRelator = S.encodeResult(LegalPositionRelator);

/**
 * Convert a stored legal relation entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the column shape
 * {@link Table} projects. The database-managed `id` is dropped so the insert
 * defers to the table sequence.
 *
 * **Gotchas**
 *
 * There is no update counterpart, and there deliberately never will be: a stored relation is
 * superseded by a new record rather than amended, and the correlative and
 * opposite readings are derived views that are never written at all.
 *
 * **Example** (Encode a decoded row back into an insert)
 *
 * ```ts
 * import {
 *   fromLegalPositionRelatorRow,
 *   toLegalPositionRelatorInsert
 * } from "@beep/law-practice-tables/entities/LegalPositionRelator"
 * import { Result } from "effect"
 *
 * const insert = Result.flatMap(fromLegalPositionRelatorRow({}), toLegalPositionRelatorInsert)
 * console.log(Result.isFailure(insert)) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toLegalPositionRelatorInsert = (
  relator: LegalPositionRelator
): Result.Result<LegalPositionRelatorInsert, S.SchemaError> =>
  Result.map(encodeLegalPositionRelator(relator), (encoded): LegalPositionRelatorInsert => {
    const { id: _id, ...insert } = encoded;
    return insert;
  });

/**
 * Convert a selected persistence row into a stored legal relation entity.
 *
 * **Details**
 *
 * The input is `unknown` rather than {@link LegalPositionRelatorRow} because the driver hands
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
 * **Example** (Reject a row that records no relation)
 *
 * ```ts
 * import { fromLegalPositionRelatorRow } from "@beep/law-practice-tables/entities/LegalPositionRelator"
 * import { Result } from "effect"
 *
 * console.log(Result.isFailure(fromLegalPositionRelatorRow({}))) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromLegalPositionRelatorRow: (row: unknown) => Result.Result<LegalPositionRelator, S.SchemaError> =
  S.decodeUnknownResult(LegalPositionRelator);
