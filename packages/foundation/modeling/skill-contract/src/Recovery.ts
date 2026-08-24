/**
 * Bounded-recovery policy, budget, attempt, and failure receipt schemas.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SkillContractId } from "@beep/identity/packages";
import { PosInt } from "@beep/schema/Int";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { NonNegativeInt } from "@beep/schema/Number";
import { ISOStr } from "@beep/schema/Timestamp";
import { Duration, HashSet, Tuple } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import { EvidenceReceipt, EvidenceSubject } from "./EvidenceReceipt.ts";
import { EvidencePredicateType } from "./Gate.ts";

const $I = $SkillContractId.create("Recovery");

const BudgetDurationCheck = S.makeFilter(
  (duration: Duration.Duration) => Duration.isFinite(duration) && !Duration.isNegative(duration),
  {
    identifier: $I`BudgetDurationCheck`,
    title: "Recovery budget duration",
    description: "Recovery budget durations must be finite and greater than or equal to zero.",
    message: "Recovery budget durations must be finite and non-negative",
  }
);

/**
 * Finite non-negative duration encoded as milliseconds.
 *
 * **Example** (Construct a budget duration)
 *
 * ```ts
 * import { BudgetDuration } from "@beep/skill-contract"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMillis(BudgetDuration.make(Duration.seconds(5)))) // 5000
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BudgetDuration = S.DurationFromMillis.check(BudgetDurationCheck).pipe(
  $I.annoteSchema("BudgetDuration", {
    description: "Finite non-negative recovery budget duration encoded as milliseconds.",
    toArbitrary: () => (fc) => fc.nat({ max: 86_400_000 }).map(Duration.millis),
  })
);

/**
 * Runtime type decoded by {@link BudgetDuration}.
 *
 * @category models
 * @since 0.0.0
 */
export type BudgetDuration = typeof BudgetDuration.Type;

/**
 * Hard attempt, operation, and time limits for bounded recovery.
 *
 * **Example** (Inspect recovery budget fields)
 *
 * ```ts
 * import { RecoveryBudget } from "@beep/skill-contract"
 *
 * console.log(RecoveryBudget.fields.maxAttempts !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RecoveryBudget extends S.Class<RecoveryBudget>($I`RecoveryBudget`)(
  {
    maxAttempts: PosInt,
    maxOperations: PosInt,
    perAttemptTimeout: BudgetDuration,
    totalTimeout: BudgetDuration,
  },
  $I.annote("RecoveryBudget", {
    description: "Hard attempt, operation, per-attempt, and total-time limits for bounded recovery.",
  })
) {}

/**
 * Recovery budget consumed by a terminal failure.
 *
 * **Example** (Inspect consumed budget fields)
 *
 * ```ts
 * import { RecoveryBudgetConsumed } from "@beep/skill-contract"
 *
 * console.log(RecoveryBudgetConsumed.fields.elapsed !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RecoveryBudgetConsumed extends S.Class<RecoveryBudgetConsumed>($I`RecoveryBudgetConsumed`)(
  {
    attempts: NonNegativeInt,
    elapsed: BudgetDuration,
    operations: NonNegativeInt,
  },
  $I.annote("RecoveryBudgetConsumed", {
    description: "Attempt, operation, and elapsed-time budget consumed by a recovery sequence.",
  })
) {}

/**
 * Closed outcome vocabulary for one recovery attempt.
 *
 * **Example** (Inspect attempt outcomes)
 *
 * ```ts
 * import { RecoveryAttemptOutcome } from "@beep/skill-contract"
 *
 * console.log(RecoveryAttemptOutcome.Options) // ["succeeded", "failed", "aborted"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RecoveryAttemptOutcome = LiteralKit(["succeeded", "failed", "aborted"]).pipe(
  $I.annoteSchema("RecoveryAttemptOutcome", {
    description: "Closed outcome vocabulary for a bounded-recovery attempt.",
  })
);

/**
 * Runtime type decoded by {@link RecoveryAttemptOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type RecoveryAttemptOutcome = typeof RecoveryAttemptOutcome.Type;

/**
 * Auditable outcome and observations for one recovery attempt.
 *
 * **Example** (Inspect recovery attempt fields)
 *
 * ```ts
 * import { RecoveryAttemptReceipt } from "@beep/skill-contract"
 *
 * console.log(RecoveryAttemptReceipt.fields.observations !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RecoveryAttemptReceipt extends S.Class<RecoveryAttemptReceipt>($I`RecoveryAttemptReceipt`)(
  {
    attempt: PosInt,
    endedAt: ISOStr,
    observations: S.Array(EvidenceSubject),
    operations: NonNegativeInt,
    outcome: RecoveryAttemptOutcome,
    reason: S.OptionFromOptionalKey(S.NonEmptyString),
    startedAt: ISOStr,
  },
  $I.annote("RecoveryAttemptReceipt", {
    description: "Auditable timestamps, outcome, operation count, and evidence observations for one attempt.",
  })
) {}

/**
 * Closed reason vocabulary for terminal recovery failure.
 *
 * **Example** (Inspect terminal failure reasons)
 *
 * ```ts
 * import { FailureTerminalReason } from "@beep/skill-contract"
 *
 * console.log(FailureTerminalReason.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FailureTerminalReason = LiteralKit([
  "attempt-budget-exhausted",
  "operation-budget-exhausted",
  "time-budget-exhausted",
  "non-retryable-failure",
  "cancelled",
]).pipe(
  $I.annoteSchema("FailureTerminalReason", {
    description: "Closed reason vocabulary for a recovery sequence that terminated without success.",
  })
);

/**
 * Runtime type decoded by {@link FailureTerminalReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type FailureTerminalReason = typeof FailureTerminalReason.Type;

const FailureReceiptPredicateFields = S.Struct({
  attempts: S.Array(RecoveryAttemptReceipt),
  budget: RecoveryBudget,
  consumed: RecoveryBudgetConsumed,
  partialEffects: S.Array(EvidenceSubject),
  reason: S.NonEmptyString,
  terminalReason: FailureTerminalReason,
});

const RecoveryBudgetCoherenceCheck = S.makeFilter(
  (failure: typeof FailureReceiptPredicateFields.Type) => {
    const attemptOrdinals = A.map(failure.attempts, (attempt) => attempt.attempt);
    const unique = Eq.equals(HashSet.size(HashSet.fromIterable(attemptOrdinals)), A.length(attemptOrdinals));
    const ordered = A.every(
      A.zipWith(failure.attempts, A.drop(failure.attempts, 1), (left, right) => left.attempt < right.attempt),
      (isOrdered) => isOrdered
    );
    const attemptsWithinBudget =
      failure.consumed.attempts <= failure.budget.maxAttempts &&
      A.every(failure.attempts, (attempt) => attempt.attempt <= failure.budget.maxAttempts);
    const operationsWithinBudget = failure.consumed.operations <= failure.budget.maxOperations;
    const elapsedWithinBudget = Duration.isLessThanOrEqualTo(failure.consumed.elapsed, failure.budget.totalTimeout);

    return unique && ordered && attemptsWithinBudget && operationsWithinBudget && elapsedWithinBudget
      ? undefined
      : {
          path: ["consumed"],
          issue:
            "Recovery attempts must be unique and ordered, and consumed counts and duration must remain within budget.",
        };
  },
  {
    identifier: $I`RecoveryBudgetCoherenceCheck`,
    title: "Recovery budget coherence",
    description: "Recovery attempts and consumed resources cannot exceed their declared bounded-recovery budget.",
  }
);

/**
 * Predicate recording a bounded-recovery terminal failure and partial effects.
 *
 * **Example** (Inspect failure predicate fields)
 *
 * ```ts
 * import { FailureReceiptPredicate } from "@beep/skill-contract"
 *
 * console.log(FailureReceiptPredicate.fields.partialEffects !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FailureReceiptPredicate extends S.Class<FailureReceiptPredicate>($I`FailureReceiptPredicate`)(
  FailureReceiptPredicateFields.check(RecoveryBudgetCoherenceCheck),
  $I.annote("FailureReceiptPredicate", {
    description: "Coherent budget, attempt history, partial effects, and terminal reason for failed recovery.",
  })
) {}

/**
 * Canonical predicate identity of {@link FailureReceipt}.
 *
 * **Example** (Inspect failure predicate identity)
 *
 * ```ts
 * import { FailurePredicateType } from "@beep/skill-contract"
 *
 * console.log(FailurePredicateType)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FailurePredicateType = EvidencePredicateType.make(
  "https://beep-effect.dev/skill-contract/evidence/failure/v1"
);

/**
 * Unsigned digest-bound receipt carrying a coherent terminal failure predicate.
 *
 * **Example** (Inspect the pinned failure predicate field)
 *
 * ```ts
 * import { FailureReceipt } from "@beep/skill-contract"
 *
 * console.log(FailureReceipt.fields.predicateType !== undefined) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FailureReceipt = EvidenceReceipt(FailurePredicateType, FailureReceiptPredicate);

/**
 * Runtime type decoded by {@link FailureReceipt}.
 *
 * @category models
 * @since 0.0.0
 */
export type FailureReceipt = typeof FailureReceipt.Type;

/**
 * Explicit policy value disabling recovery.
 *
 * **Example** (Disable recovery)
 *
 * ```ts
 * import { NoRecoveryPolicy } from "@beep/skill-contract"
 *
 * console.log(NoRecoveryPolicy.make({}).mode) // "none"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NoRecoveryPolicy extends S.Class<NoRecoveryPolicy>($I`NoRecoveryPolicy`)(
  { mode: S.tag("none") },
  $I.annote("NoRecoveryPolicy", {
    description: "Explicit policy value disabling recovery for a skill contract.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Policy value allowing recovery only within a declared budget.
 *
 * **Example** (Inspect bounded recovery fields)
 *
 * ```ts
 * import { BoundedRecoveryPolicy } from "@beep/skill-contract"
 *
 * console.log(BoundedRecoveryPolicy.fields.budget !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoundedRecoveryPolicy extends S.Class<BoundedRecoveryPolicy>($I`BoundedRecoveryPolicy`)(
  {
    budget: RecoveryBudget,
    mode: S.tag("bounded"),
  },
  $I.annote("BoundedRecoveryPolicy", {
    description: "Recovery policy constrained by hard attempt, operation, and time budgets.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Persisted recovery policy without a recovery engine.
 *
 * **Gotchas**
 *
 * This package defines budget shapes only. Scheduling, retry, timeout, and
 * cancellation behavior remain deferred until a real consumer exists.
 *
 * **Example** (Inspect recovery policy variants)
 *
 * ```ts
 * import { RecoveryPolicy } from "@beep/skill-contract"
 *
 * console.log(RecoveryPolicy.discriminants) // ["none", "bounded"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RecoveryPolicy = LiteralKit(["none", "bounded"])
  .mapMembers(Tuple.evolve([NoRecoveryPolicy.thunkThis, BoundedRecoveryPolicy.thunkThis]))
  .pipe(
    S.toTaggedUnion("mode"),
    $I.annoteSchema("RecoveryPolicy", {
      description: "Explicit no-recovery or bounded-recovery policy; execution remains deferred.",
    })
  );

/**
 * Runtime type decoded by {@link RecoveryPolicy}.
 *
 * @category models
 * @since 0.0.0
 */
export type RecoveryPolicy = typeof RecoveryPolicy.Type;
