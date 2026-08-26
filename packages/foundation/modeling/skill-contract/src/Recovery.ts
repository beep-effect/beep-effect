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
import { DateTime, Duration, Number as Num, Predicate, Tuple } from "effect";
import * as A from "effect/Array";
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
 * ```ts import.meta.vitest name="Construct a budget duration"
 * import { BudgetDuration } from "@beep/skill-contract"
 * import * as Duration from "effect/Duration"
 *
 * Duration.toMillis(BudgetDuration.make(Duration.seconds(5))) // => 5000
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
 * ```ts import.meta.vitest name="Inspect recovery budget fields"
 * import { RecoveryBudget } from "@beep/skill-contract"
 *
 * RecoveryBudget.fields.maxAttempts !== undefined // => true
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
 * ```ts import.meta.vitest name="Inspect consumed budget fields"
 * import { RecoveryBudgetConsumed } from "@beep/skill-contract"
 *
 * RecoveryBudgetConsumed.fields.elapsed !== undefined // => true
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
 * ```ts import.meta.vitest name="Inspect attempt outcomes"
 * import { RecoveryAttemptOutcome } from "@beep/skill-contract"
 *
 * RecoveryAttemptOutcome.Options // => ["succeeded", "failed", "aborted"]
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
 * ```ts import.meta.vitest name="Inspect recovery attempt fields"
 * import { RecoveryAttemptReceipt } from "@beep/skill-contract"
 *
 * RecoveryAttemptReceipt.fields.observations !== undefined // => true
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
    const attemptsContiguous = A.every(failure.attempts, (attempt, index) =>
      Num.Equivalence(attempt.attempt, Num.increment(index))
    );
    const attemptTimings = A.map(failure.attempts, (attempt) => {
      const startedAt = DateTime.makeUnsafe(attempt.startedAt);
      const endedAt = DateTime.makeUnsafe(attempt.endedAt);
      return { elapsed: DateTime.distance(startedAt, endedAt), endedAt, startedAt };
    });
    const attemptTimingsWithinBudget = A.every(
      attemptTimings,
      ({ elapsed }) =>
        !Duration.isNegative(elapsed) && Duration.isLessThanOrEqualTo(elapsed, failure.budget.perAttemptTimeout)
    );
    const attemptsChronological = A.every(
      A.zip(attemptTimings, A.drop(attemptTimings, 1)),
      ([left, right]) => !Duration.isNegative(DateTime.distance(left.endedAt, right.startedAt))
    );
    const observedElapsed = A.match(attemptTimings, {
      onEmpty: () => Duration.zero,
      onNonEmpty: (timings) => DateTime.distance(A.headNonEmpty(timings).startedAt, A.lastNonEmpty(timings).endedAt),
    });
    const observedOperations = Num.sumAll(A.map(failure.attempts, (attempt) => attempt.operations));
    const consumedMatchesHistory =
      Num.Equivalence(failure.consumed.attempts, A.length(failure.attempts)) &&
      Num.Equivalence(failure.consumed.operations, observedOperations) &&
      Duration.equals(failure.consumed.elapsed, observedElapsed);
    const attemptsWithinBudget = Num.isLessThanOrEqualTo(failure.consumed.attempts, failure.budget.maxAttempts);
    const operationsWithinBudget = Num.isLessThanOrEqualTo(failure.consumed.operations, failure.budget.maxOperations);
    const elapsedWithinBudget = Duration.isLessThanOrEqualTo(failure.consumed.elapsed, failure.budget.totalTimeout);
    const terminalReasonMatchesBudget = FailureTerminalReason.$match(failure.terminalReason, {
      "attempt-budget-exhausted": () =>
        Num.isGreaterThanOrEqualTo(failure.consumed.attempts, failure.budget.maxAttempts),
      cancelled: () => true,
      "non-retryable-failure": () => true,
      "operation-budget-exhausted": () =>
        Num.isGreaterThanOrEqualTo(failure.consumed.operations, failure.budget.maxOperations),
      "time-budget-exhausted": () =>
        Duration.isGreaterThanOrEqualTo(failure.consumed.elapsed, failure.budget.totalTimeout),
    });

    return A.every(
      [
        attemptsContiguous,
        attemptTimingsWithinBudget,
        attemptsChronological,
        consumedMatchesHistory,
        attemptsWithinBudget,
        operationsWithinBudget,
        elapsedWithinBudget,
        terminalReasonMatchesBudget,
      ],
      Predicate.isTruthy
    )
      ? undefined
      : {
          path: ["consumed"],
          issue:
            "Recovery history, consumed resources, per-attempt timing, and terminal reason must agree with the declared budget.",
        };
  },
  {
    identifier: $I`RecoveryBudgetCoherenceCheck`,
    title: "Recovery budget coherence",
    description: "Recovery attempt history, consumed resources, timing, and terminal reason agree with the budget.",
  }
);

/**
 * Predicate recording a bounded-recovery terminal failure and partial effects.
 *
 * **Example** (Inspect failure predicate fields)
 *
 * ```ts import.meta.vitest name="Inspect failure predicate fields"
 * import { FailureReceiptPredicate } from "@beep/skill-contract"
 *
 * FailureReceiptPredicate.fields.partialEffects !== undefined // => true
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
 * ```ts import.meta.vitest name="Inspect the pinned failure predicate field"
 * import { FailureReceipt } from "@beep/skill-contract"
 *
 * FailureReceipt.fields.predicateType !== undefined // => true
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
 * ```ts import.meta.vitest name="Disable recovery"
 * import { NoRecoveryPolicy } from "@beep/skill-contract"
 *
 * NoRecoveryPolicy.make({}).mode // => "none"
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
 * ```ts import.meta.vitest name="Inspect bounded recovery fields"
 * import { BoundedRecoveryPolicy } from "@beep/skill-contract"
 *
 * BoundedRecoveryPolicy.fields.budget !== undefined // => true
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
 * ```ts import.meta.vitest name="Inspect recovery policy variants"
 * import { RecoveryPolicy } from "@beep/skill-contract"
 *
 * RecoveryPolicy.discriminants // => ["none", "bounded"]
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
