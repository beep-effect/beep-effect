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
  hasValidSeals,
} from "@beep/epistemic-domain/entities/Contradiction";
import { DateTime, Match, pipe, Result, SchemaIssue } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual, identity } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import type { candidateTable, dispositionTable, receiptTable } from "./Contradiction.table.ts";

type ContradictionDispositionInsertContext = {
  readonly candidate: ContradictionCandidate;
  readonly edgeVersions: ReadonlyArray<EdgeVersion>;
};

/**
 * Selected contradiction-candidate row.
 *
 * **Example** (Empty candidate row array)
 *
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
 * **Example** (Empty candidate insert array)
 *
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
 * **Example** (Empty receipt row array)
 *
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
 * **Example** (Empty receipt insert array)
 *
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
 * **Example** (Empty disposition row array)
 *
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
 * **Example** (Empty disposition insert array)
 *
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
  Result.flatMap(hasValidSeals(candidate), (isValid) =>
    isValid
      ? Result.succeed(candidate)
      : Result.fail(
          new S.SchemaError(
            new SchemaIssue.InvalidValue({
              message:
                "Contradiction candidate has a non-canonical pair or a key/digest that does not seal its persisted payload.",
            })
          )
        )
  );

const validateDispositionCandidate = (
  disposition: ContradictionDisposition,
  candidate: ContradictionCandidate,
  edgeVersions: ReadonlyArray<EdgeVersion>
): Result.Result<ContradictionDisposition, S.SchemaError> =>
  Result.flatMap(validateCandidateSeals(candidate), () => {
    const decisionMatchesCandidate = Match.value(disposition.decision).pipe(
      Match.when({ status: "rejected" }, () => true),
      Match.when({ status: "superseded" }, (decision) =>
        pipe(
          O.all({
            former: A.findFirst(edgeVersions, (edge) => Eq.equals(edge.id, decision.formerEdgeVersionId)),
            proposal: A.findFirst(candidate.assessment.proposals, (proposal) =>
              Eq.equals(proposal.proposalId, decision.proposalId)
            ),
            replacement: A.findFirst(edgeVersions, (edge) => Eq.equals(edge.id, decision.replacementEdgeVersionId)),
          }),
          O.exists(({ former, proposal, replacement }) =>
            A.every(
              [
                Eq.equals(proposal.proposalDigest, decision.proposalDigest),
                Eq.equals(former.id, proposal.losingBelief.edgeVersionId),
                Eq.equals(former.orgId, candidate.orgId),
                Eq.equals(former.logicalKey, proposal.losingBelief.logicalKey),
                Eq.equals(former.version, proposal.losingBelief.version),
                !DateTime.isLessThan(disposition.resolvedAt, former.recordedAt),
                Eq.equals(former.expiredAt, O.some(disposition.resolvedAt)),
                Eq.equals(replacement.orgId, candidate.orgId),
                Eq.equals(replacement.logicalKey, former.logicalKey),
                Eq.equals(replacement.supersedesId, O.some(former.id)),
                Eq.equals(replacement.version, former.version + 1),
                Eq.equals(replacement.fact, proposal.fact),
                Eq.equals(replacement.validFrom, proposal.validFrom),
                Eq.equals(replacement.validTo, proposal.validTo),
                Eq.equals(replacement.createdAt, disposition.resolvedAt),
                Eq.equals(replacement.recordedAt, disposition.resolvedAt),
              ],
              identity
            )
          )
        )
      ),
      Match.exhaustive
    );

    return Eq.equals(disposition.candidateId, candidate.id) &&
      Eq.equals(disposition.orgId, candidate.orgId) &&
      !DateTime.isLessThan(disposition.resolvedAt, candidate.recordedAt) &&
      decisionMatchesCandidate
      ? Result.succeed(disposition)
      : Result.fail(
          new S.SchemaError(
            new SchemaIssue.InvalidValue({
              message:
                "Contradiction disposition must reference the supplied sealed candidate in the same organization, resolve at or after candidate.recordedAt, and bind any supersession to its selected proposal and closed former/replacement edge chain.",
            })
          )
        );
  });

const validateReceiptCandidate = (
  receipt: ContradictionReceipt,
  candidate: ContradictionCandidate
): Result.Result<ContradictionReceipt, S.SchemaError> =>
  Eq.equals(receipt.candidateId, candidate.id) &&
  Eq.equals(receipt.orgId, candidate.orgId) &&
  !DateTime.isLessThan(receipt.receivedAt, candidate.recordedAt)
    ? Result.succeed(receipt)
    : Result.fail(
        new S.SchemaError(
          new SchemaIssue.InvalidValue({
            message:
              "Contradiction receipt must reference the supplied candidate in the same organization and be received at or after candidate.recordedAt.",
          })
        )
      );

/**
 * Convert a contradiction candidate to a database insert.
 *
 * **Gotchas**
 *
 * Candidates with a non-canonical pair or stale payload seals are rejected.
 * Successful inserts omit the database-generated numeric identifier.
 *
 * **Example** (Map candidate to insert)
 *
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
 * **Details**
 *
 * Decoding validates both the row shape and every digest/key seal before
 * returning the domain entity.
 *
 * **Example** (Decode empty candidate row)
 *
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
 * **Details**
 *
 * The referenced candidate is required so identity, organization, and
 * transaction-time ordering are checked before the append-only write.
 *
 * **Example** (Inspect receipt insert mapper)
 *
 * ```ts
 * import { toContradictionReceiptInsert } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * console.log(typeof toContradictionReceiptInsert)
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const toContradictionReceiptInsert: {
  (
    receipt: ContradictionReceipt,
    candidate: ContradictionCandidate
  ): Result.Result<ContradictionReceiptInsert, S.SchemaError>;
  (
    candidate: ContradictionCandidate
  ): (receipt: ContradictionReceipt) => Result.Result<ContradictionReceiptInsert, S.SchemaError>;
} = dual(2, (receipt: ContradictionReceipt, candidate: ContradictionCandidate) =>
  Result.map(
    Result.flatMap(validateReceiptCandidate(receipt, candidate), encodeReceipt),
    (encoded): ContradictionReceiptInsert => {
      const { id: _id, ...insert } = encoded;
      return insert;
    }
  )
);

/**
 * Decode a selected contradiction receipt row.
 *
 * **Example** (Inspect receipt row decoder)
 *
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
 * **Details**
 *
 * The referenced candidate and edge context are required so identity,
 * organization, transaction-time ordering, and any selected supersession
 * proposal and edge chain are checked before the append-only write.
 *
 * **Example** (Inspect disposition insert mapper)
 *
 * ```ts
 * import { toContradictionDispositionInsert } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * console.log(typeof toContradictionDispositionInsert)
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const toContradictionDispositionInsert: {
  (
    disposition: ContradictionDisposition,
    context: ContradictionDispositionInsertContext
  ): Result.Result<ContradictionDispositionInsert, S.SchemaError>;
  (
    context: ContradictionDispositionInsertContext
  ): (disposition: ContradictionDisposition) => Result.Result<ContradictionDispositionInsert, S.SchemaError>;
} = dual(2, (disposition: ContradictionDisposition, context: ContradictionDispositionInsertContext) =>
  Result.map(
    Result.flatMap(
      validateDispositionCandidate(disposition, context.candidate, context.edgeVersions),
      encodeDisposition
    ),
    (encoded): ContradictionDispositionInsert => {
      const { id: _id, ...insert } = encoded;
      return insert;
    }
  )
);

/**
 * Decode a selected contradiction disposition row.
 *
 * **Example** (Inspect disposition row decoder)
 *
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
