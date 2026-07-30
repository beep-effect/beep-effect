/**
 * Contradiction entity row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import {
  ContradictionCandidate,
  ContradictionDisposition,
  ContradictionReceipt,
} from "@beep/epistemic-domain/entities/Contradiction";
import { Result, SchemaIssue } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { candidateTable, dispositionTable, receiptTable } from "./Contradiction.table.ts";

/**
 * Selected contradiction-candidate row.
 *
 * @example
 * ```ts
 * import type { ContradictionCandidateRow } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * const rows: ReadonlyArray<ContradictionCandidateRow> = []
 * console.log(rows.length)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ContradictionCandidateRow = typeof candidateTable.$inferSelect;

/**
 * Insertable contradiction-candidate row.
 *
 * @example
 * ```ts
 * import type { ContradictionCandidateInsert } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * const rows: ReadonlyArray<ContradictionCandidateInsert> = []
 * console.log(rows.length)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ContradictionCandidateInsert = typeof candidateTable.$inferInsert;

/**
 * Selected contradiction-receipt row.
 *
 * @example
 * ```ts
 * import type { ContradictionReceiptRow } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * const rows: ReadonlyArray<ContradictionReceiptRow> = []
 * console.log(rows.length)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ContradictionReceiptRow = typeof receiptTable.$inferSelect;

/**
 * Insertable contradiction-receipt row.
 *
 * @example
 * ```ts
 * import type { ContradictionReceiptInsert } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * const rows: ReadonlyArray<ContradictionReceiptInsert> = []
 * console.log(rows.length)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ContradictionReceiptInsert = typeof receiptTable.$inferInsert;

/**
 * Selected contradiction-disposition row.
 *
 * @example
 * ```ts
 * import type { ContradictionDispositionRow } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * const rows: ReadonlyArray<ContradictionDispositionRow> = []
 * console.log(rows.length)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ContradictionDispositionRow = typeof dispositionTable.$inferSelect;

/**
 * Insertable contradiction-disposition row.
 *
 * @example
 * ```ts
 * import type { ContradictionDispositionInsert } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * const rows: ReadonlyArray<ContradictionDispositionInsert> = []
 * console.log(rows.length)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type ContradictionDispositionInsert = typeof dispositionTable.$inferInsert;

const encodeCandidate = S.encodeResult(ContradictionCandidate);
const decodeCandidate = S.decodeUnknownResult(ContradictionCandidate);
const encodeReceipt = S.encodeResult(ContradictionReceipt);
const decodeReceipt = S.decodeUnknownResult(ContradictionReceipt);
const encodeDisposition = S.encodeResult(ContradictionDisposition);
const decodeDisposition = S.decodeUnknownResult(ContradictionDisposition);

const validateCandidateSeals = (
  candidate: ContradictionCandidate
): Result.Result<ContradictionCandidate, S.SchemaError> =>
  Result.flatMap(candidate.hasValidSeals(), (isValid) =>
    isValid
      ? Result.succeed(candidate)
      : Result.fail(
          new S.SchemaError(
            new SchemaIssue.InvalidValue(O.some(candidate.candidateKey), {
              message:
                "Contradiction candidate has a non-canonical pair or a key/digest that does not seal its persisted payload.",
            })
          )
        )
  );

/**
 * Convert a contradiction candidate to a database insert.
 *
 * @remarks
 * Candidates with a non-canonical pair or stale payload seals are rejected.
 * Successful inserts omit the database-generated numeric identifier.
 *
 * @example
 * ```ts
 * import type { ContradictionCandidate } from "@beep/epistemic-domain/entities/Contradiction"
 * import { toContradictionCandidateInsert } from "@beep/epistemic-tables/entities/Contradiction"
 * import * as Result from "effect/Result"
 *
 * const persistableCandidateKey = (candidate: ContradictionCandidate) => {
 *   return Result.match(toContradictionCandidateInsert(candidate), {
 *     onFailure: () => "rejected",
 *     onSuccess: (insert) => "id" in insert ? "unexpected generated id" : insert.candidateKey
 *   })
 * }
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const toContradictionCandidateInsert = (
  candidate: ContradictionCandidate
): Result.Result<ContradictionCandidateInsert, S.SchemaError> =>
  Result.map(
    Result.flatMap(validateCandidateSeals(candidate), encodeCandidate),
    (encoded): ContradictionCandidateInsert => {
      const { id: _id, ...insert } = encoded;
      return insert;
    }
  );

/**
 * Decode a selected contradiction candidate row.
 *
 * @remarks
 * Decoding validates both the row shape and every digest/key seal before
 * returning the domain entity.
 *
 * @example
 * ```ts
 * import { fromContradictionCandidateRow } from "@beep/epistemic-tables/entities/Contradiction"
 * import * as Result from "effect/Result"
 *
 * const decoded = fromContradictionCandidateRow({})
 * console.log(Result.isFailure(decoded)) // true
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const fromContradictionCandidateRow = (row: unknown): Result.Result<ContradictionCandidate, S.SchemaError> =>
  Result.flatMap(decodeCandidate(row), validateCandidateSeals);

/**
 * Convert a contradiction receipt to a database insert.
 *
 * @example
 * ```ts
 * import { toContradictionReceiptInsert } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * console.log(typeof toContradictionReceiptInsert)
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const toContradictionReceiptInsert = (
  receipt: ContradictionReceipt
): Result.Result<ContradictionReceiptInsert, S.SchemaError> =>
  Result.map(encodeReceipt(receipt), (encoded): ContradictionReceiptInsert => {
    const { id: _id, ...insert } = encoded;
    return insert;
  });

/**
 * Decode a selected contradiction receipt row.
 *
 * @example
 * ```ts
 * import { fromContradictionReceiptRow } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * console.log(typeof fromContradictionReceiptRow)
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const fromContradictionReceiptRow = (row: unknown): Result.Result<ContradictionReceipt, S.SchemaError> =>
  decodeReceipt(row);

/**
 * Convert a contradiction disposition to a database insert.
 *
 * @example
 * ```ts
 * import { toContradictionDispositionInsert } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * console.log(typeof toContradictionDispositionInsert)
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const toContradictionDispositionInsert = (
  disposition: ContradictionDisposition
): Result.Result<ContradictionDispositionInsert, S.SchemaError> =>
  Result.map(encodeDisposition(disposition), (encoded): ContradictionDispositionInsert => {
    const { id: _id, ...insert } = encoded;
    return insert;
  });

/**
 * Decode a selected contradiction disposition row.
 *
 * @example
 * ```ts
 * import { fromContradictionDispositionRow } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * console.log(typeof fromContradictionDispositionRow)
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const fromContradictionDispositionRow = (row: unknown): Result.Result<ContradictionDisposition, S.SchemaError> =>
  decodeDisposition(row);
