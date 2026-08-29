/**
 * Law-practice LegalOppositionCandidate row converters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LegalOppositionCandidate } from "@beep/law-practice-domain/entities/LegalOppositionCandidate";
import { Result } from "effect";
import * as S from "effect/Schema";
import type { Table } from "./LegalOppositionCandidate.table.ts";

/**
 * Selected law-practice LegalOppositionCandidate row.
 *
 * **Example** (Collect selected rows)
 *
 * ```ts
 * import type { LegalOppositionCandidateRow } from "@beep/law-practice-tables/entities/LegalOppositionCandidate"
 *
 * const rows: ReadonlyArray<LegalOppositionCandidateRow> = []
 * console.log(rows.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type LegalOppositionCandidateRow = typeof Table.$inferSelect;

/**
 * Insertable law-practice LegalOppositionCandidate row.
 *
 * **Example** (Collect insert rows)
 *
 * ```ts
 * import type { LegalOppositionCandidateInsert } from "@beep/law-practice-tables/entities/LegalOppositionCandidate"
 *
 * const inserts: ReadonlyArray<LegalOppositionCandidateInsert> = []
 * console.log(inserts.length) // 0
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type LegalOppositionCandidateInsert = typeof Table.$inferInsert;

const encodeLegalOppositionCandidate = S.encodeResult(LegalOppositionCandidate);

/**
 * Convert a opposition candidate entity into its persistence insert row.
 *
 * **Details**
 *
 * The schema-first entity is its own row codec: encoding yields the column shape
 * {@link Table} projects. The database-managed `id` is dropped so the insert
 * defers to the table sequence.
 *
 * **Gotchas**
 *
 * There is no update counterpart, and there deliberately never will be: a second party's priority
 * basis and a later verdict-family assignment are their own appended rows,
 * so no row is ever rewritten to add one.
 *
 * **Example** (Encode a decoded row back into an insert)
 *
 * ```ts
 * import {
 *   fromLegalOppositionCandidateRow,
 *   toLegalOppositionCandidateInsert
 * } from "@beep/law-practice-tables/entities/LegalOppositionCandidate"
 * import { Result } from "effect"
 *
 * const insert = Result.flatMap(fromLegalOppositionCandidateRow({}), toLegalOppositionCandidateInsert)
 * console.log(Result.isFailure(insert)) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toLegalOppositionCandidateInsert = (
  candidate: LegalOppositionCandidate
): Result.Result<LegalOppositionCandidateInsert, S.SchemaError> =>
  Result.map(encodeLegalOppositionCandidate(candidate), (encoded): LegalOppositionCandidateInsert => {
    const { id: _id, ...insert } = encoded;
    return insert;
  });

/**
 * Convert a selected persistence row into a opposition candidate entity.
 *
 * **Details**
 *
 * The input is `unknown` rather than {@link LegalOppositionCandidateRow} because the driver hands
 * back untrusted values; every jsonb column is re-decoded through the entity
 * schema rather than trusted as its declared column type.
 *
 * **Gotchas**
 *
 * The screened pair is stored as a JSON array and decoded back into a
 * `HashSet` of exactly two ids, so the pair has no order in the row, in the
 * column, or in the decoded value. Nothing recovered from a row can be read
 * as one position taking precedence over the other.
 *
 * **Example** (Reject a row that names no screened pair)
 *
 * ```ts
 * import { fromLegalOppositionCandidateRow } from "@beep/law-practice-tables/entities/LegalOppositionCandidate"
 * import { Result } from "effect"
 *
 * console.log(Result.isFailure(fromLegalOppositionCandidateRow({}))) // true
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromLegalOppositionCandidateRow: (row: unknown) => Result.Result<LegalOppositionCandidate, S.SchemaError> =
  S.decodeUnknownResult(LegalOppositionCandidate);
