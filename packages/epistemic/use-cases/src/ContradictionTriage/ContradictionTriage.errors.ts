/**
 * Contradiction-triage typed failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ContradictionCandidateKey } from "@beep/epistemic-domain/values/Contradiction";
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $EpistemicUseCasesId.create("ContradictionTriage/ContradictionTriage.errors");
const ContradictionTriageOperationBase = LiteralKit(["submit", "list", "get", "review"]);

/**
 * Bounded contradiction repository operations.
 *
 * **Example** (Log review enum member)
 *
 * ```ts
 * import { ContradictionTriageOperation } from "@beep/epistemic-use-cases/server"
 *
 * console.log(ContradictionTriageOperation.Enum.review)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContradictionTriageOperation = ContradictionTriageOperationBase.pipe(
  $I.annoteSchema("ContradictionTriageOperation", {
    description: "Bounded contradiction-triage repository operation vocabulary.",
  }),
  SchemaUtils.withLiteralKitStatics(ContradictionTriageOperationBase)
);

/**
 * Runtime type for {@link ContradictionTriageOperation}.
 *
 * **Example** (Assign submit operation type)
 *
 * ```ts
 * import type { ContradictionTriageOperation } from "@beep/epistemic-use-cases/server"
 *
 * const operation: ContradictionTriageOperation = "submit"
 * console.log(operation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionTriageOperation = typeof ContradictionTriageOperation.Type;

const ContradictionRepositoryUnavailableFields = {
  cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description: "Optional driver defect retained for boundary diagnostics." })
  ),
  operation: ContradictionTriageOperation.annotateKey({
    description: "Repository operation that could not be served.",
  }),
  reason: S.NonEmptyString.annotateKey({
    description: "Non-empty repository availability diagnostic.",
  }),
} satisfies S.Struct.Fields;
const ContradictionRepositoryUnavailableEquivalenceFields = {
  operation: ContradictionRepositoryUnavailableFields.operation,
  reason: ContradictionRepositoryUnavailableFields.reason,
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameContradictionRepositoryUnavailableFields = S.toEquivalence(
  S.TaggedStruct("ContradictionRepositoryUnavailable", ContradictionRepositoryUnavailableEquivalenceFields)
);
const sameContradictionRepositoryUnavailable = (
  self: ContradictionRepositoryUnavailable,
  that: ContradictionRepositoryUnavailable
): boolean => sameContradictionRepositoryUnavailableFields(self, that);

/**
 * Raised when the contradiction repository cannot serve an operation.
 *
 * **Example** (Construct unavailable repository error)
 *
 * ```ts
 * import { ContradictionRepositoryUnavailable } from "@beep/epistemic-use-cases/server"
 *
 * const failure = ContradictionRepositoryUnavailable.make({
 *   operation: "submit",
 *   reason: "database unavailable"
 * })
 * console.log(failure._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ContradictionRepositoryUnavailable extends S.TaggedError<ContradictionRepositoryUnavailable>(
  $I`ContradictionRepositoryUnavailable`
)(
  "ContradictionRepositoryUnavailable",
  ContradictionRepositoryUnavailableFields,
  $I.annoteClass<
    S.declare<ContradictionRepositoryUnavailable>,
    readonly [S.TaggedStruct<"ContradictionRepositoryUnavailable", typeof ContradictionRepositoryUnavailableFields>]
  >("ContradictionRepositoryUnavailable", {
    description: "The contradiction repository could not serve an operation.",
    toEquivalence: () => sameContradictionRepositoryUnavailable,
  })
) {
  static readonly is = S.is(ContradictionRepositoryUnavailable);

  /**
   * Build an operation-scoped repository failure.
   *
   * **Example** (Build during-scoped failure)
   *
   * ```ts
   * import { ContradictionRepositoryUnavailable } from "@beep/epistemic-use-cases/server"
   *
   * console.log(ContradictionRepositoryUnavailable.during("review", "database unavailable").operation)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static during(operation: ContradictionTriageOperation, reason: string, cause?: unknown) {
    return ContradictionRepositoryUnavailable.make({
      cause: O.fromUndefinedOr(cause),
      operation,
      reason,
    });
  }
}

const ContradictionReviewConflictReasonBase = LiteralKit([
  "not-found",
  "already-resolved",
  "stale-candidate",
  "belief-mismatch",
  "proposal-not-found",
  "proposal-digest-mismatch",
]);

/**
 * Bounded reasons a contradiction review can lose its optimistic race.
 *
 * **Example** (Access already-resolved enum)
 *
 * ```ts
 * import { ContradictionReviewConflictReason } from "@beep/epistemic-use-cases/server"
 *
 * console.log(ContradictionReviewConflictReason.Enum["already-resolved"])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContradictionReviewConflictReason = ContradictionReviewConflictReasonBase.pipe(
  $I.annoteSchema("ContradictionReviewConflictReason", {
    description: "Bounded reasons a contradiction review cannot be applied to current state.",
  }),
  SchemaUtils.withLiteralKitStatics(ContradictionReviewConflictReasonBase)
);

/**
 * Runtime type for {@link ContradictionReviewConflictReason}.
 *
 * **Example** (Assign not-found reason type)
 *
 * ```ts
 * import type { ContradictionReviewConflictReason } from "@beep/epistemic-use-cases/server"
 *
 * const reason: ContradictionReviewConflictReason = "not-found"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionReviewConflictReason = typeof ContradictionReviewConflictReason.Type;

const ContradictionReviewConflictFields = {
  candidateId: Epistemic.ContradictionCandidateId.annotateKey({
    description: "Candidate whose review could not be applied.",
  }),
  reason: ContradictionReviewConflictReason.annotateKey({
    description: "Why the optimistic review no longer applies.",
  }),
} satisfies S.Struct.Fields;
const sameContradictionReviewConflictFields = S.toEquivalence(
  S.TaggedStruct("ContradictionReviewConflict", ContradictionReviewConflictFields)
);
const sameContradictionReviewConflict = (
  self: ContradictionReviewConflict,
  that: ContradictionReviewConflict
): boolean => sameContradictionReviewConflictFields(self, that);

/**
 * Typed optimistic conflict raised when a review no longer applies.
 *
 * **Example** (Construct review conflict error)
 *
 * ```ts
 * import { ContradictionReviewConflict } from "@beep/epistemic-use-cases/server"
 *
 * const conflict = ContradictionReviewConflict.make({ candidateId: 1, reason: "not-found" })
 * console.log(conflict.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ContradictionReviewConflict extends S.TaggedError<ContradictionReviewConflict>(
  $I`ContradictionReviewConflict`
)(
  "ContradictionReviewConflict",
  ContradictionReviewConflictFields,
  $I.annoteClass<
    S.declare<ContradictionReviewConflict>,
    readonly [S.TaggedStruct<"ContradictionReviewConflict", typeof ContradictionReviewConflictFields>]
  >("ContradictionReviewConflict", {
    description: "An optimistic contradiction review no longer applies to current persisted state.",
    toEquivalence: () => sameContradictionReviewConflict,
  })
) {
  static readonly is = S.is(ContradictionReviewConflict);
}

const ContradictionSubmissionConflictReasonBase = LiteralKit([
  "belief-mismatch",
  "candidate-predates-input",
  "candidate-payload-mismatch",
  "receipt-predates-candidate",
  "receipt-key-reused",
]);

/**
 * Bounded reasons an immutable contradiction submission is refused.
 *
 * **Example** (Validate receipt-key-reused reason)
 *
 * ```ts
 * import { ContradictionSubmissionConflictReason } from "@beep/epistemic-use-cases/server"
 *
 * const reason = ContradictionSubmissionConflictReason.Enum["receipt-key-reused"]
 * console.log(ContradictionSubmissionConflictReason.is["receipt-key-reused"](reason)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContradictionSubmissionConflictReason = ContradictionSubmissionConflictReasonBase.pipe(
  $I.annoteSchema("ContradictionSubmissionConflictReason", {
    description: "Why an immutable candidate or receipt submission conflicts with persisted state.",
  }),
  SchemaUtils.withLiteralKitStatics(ContradictionSubmissionConflictReasonBase)
);

/**
 * Runtime type for {@link ContradictionSubmissionConflictReason}.
 *
 * **Example** (Type and guard reused key)
 *
 * ```ts
 * import {
 *   ContradictionSubmissionConflictReason,
 *   type ContradictionSubmissionConflictReason as SubmissionConflictReasonValue,
 * } from "@beep/epistemic-use-cases/server"
 *
 * const reason: SubmissionConflictReasonValue = ContradictionSubmissionConflictReason.Enum["receipt-key-reused"]
 * console.log(ContradictionSubmissionConflictReason.is["receipt-key-reused"](reason)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionSubmissionConflictReason = typeof ContradictionSubmissionConflictReason.Type;

const ContradictionSubmissionConflictFields = {
  candidateKey: ContradictionCandidateKey.annotateKey({
    description: "Canonical candidate identity whose submission conflicted.",
  }),
  reason: ContradictionSubmissionConflictReason.annotateKey({
    description: "Bounded immutable-submission conflict reason.",
  }),
} satisfies S.Struct.Fields;
const sameContradictionSubmissionConflictFields = S.toEquivalence(
  S.TaggedStruct("ContradictionSubmissionConflict", ContradictionSubmissionConflictFields)
);
const sameContradictionSubmissionConflict = (
  self: ContradictionSubmissionConflict,
  that: ContradictionSubmissionConflict
): boolean => sameContradictionSubmissionConflictFields(self, that);

/**
 * Typed immutable-submission conflict.
 *
 * **Example** (Construct submission conflict error)
 *
 * ```ts
 * import { ContradictionCandidateKey } from "@beep/epistemic-domain/values/Contradiction"
 * import { ContradictionSubmissionConflict } from "@beep/epistemic-use-cases/server"
 * import * as Str from "effect/String"
 *
 * const conflict = ContradictionSubmissionConflict.make({
 *   candidateKey: ContradictionCandidateKey.make(Str.repeat(64)("a")),
 *   reason: "candidate-payload-mismatch",
 * })
 *
 * console.log(ContradictionSubmissionConflict.is(conflict)) // true
 * console.log(conflict.reason) // "candidate-payload-mismatch"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ContradictionSubmissionConflict extends S.TaggedError<ContradictionSubmissionConflict>(
  $I`ContradictionSubmissionConflict`
)(
  "ContradictionSubmissionConflict",
  ContradictionSubmissionConflictFields,
  $I.annoteClass<
    S.declare<ContradictionSubmissionConflict>,
    readonly [S.TaggedStruct<"ContradictionSubmissionConflict", typeof ContradictionSubmissionConflictFields>]
  >("ContradictionSubmissionConflict", {
    description: "A contradiction submission tried to mutate an identity or reuse a receipt inconsistently.",
    toEquivalence: () => sameContradictionSubmissionConflict,
  })
) {
  static readonly is = S.is(ContradictionSubmissionConflict);
}
