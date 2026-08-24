import { PosInt } from "@beep/schema/Int";
import { NonNegativeInt } from "@beep/schema/Number";
import { Sha256Hex } from "@beep/schema/Sha256";
import { ISOStr } from "@beep/schema/Timestamp";
import {
  BoundedRecoveryPolicy,
  BudgetDuration,
  EvidenceDigest,
  EvidenceSubject,
  FailurePredicateType,
  FailureReceipt,
  FailureReceiptPredicate,
  NoRecoveryPolicy,
  RecoveryAttemptReceipt,
  RecoveryBudget,
  RecoveryBudgetConsumed,
  RecoveryPolicy,
} from "@beep/skill-contract";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const subject = EvidenceSubject.make({
  digest: EvidenceDigest.make({
    sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
  }),
  name: "recovery/attempts.json",
});
const budget = RecoveryBudget.make({
  maxAttempts: PosInt.make(2),
  maxOperations: PosInt.make(3),
  perAttemptTimeout: BudgetDuration.make(Duration.seconds(1)),
  totalTimeout: BudgetDuration.make(Duration.seconds(2)),
});
const consumed = RecoveryBudgetConsumed.make({
  attempts: NonNegativeInt.make(2),
  elapsed: BudgetDuration.make(Duration.seconds(2)),
  operations: NonNegativeInt.make(3),
});
const attempt = (ordinal: 1 | 2) =>
  RecoveryAttemptReceipt.make({
    attempt: PosInt.make(ordinal),
    endedAt: ISOStr.make(`2026-08-24T00:00:0${ordinal}.000Z`),
    observations: [subject],
    operations: NonNegativeInt.make(ordinal),
    outcome: ordinal === 1 ? "failed" : "aborted",
    reason: O.none(),
    startedAt: ISOStr.make(`2026-08-24T00:00:0${ordinal - 1}.000Z`),
  });
const failure = FailureReceiptPredicate.make({
  attempts: [attempt(1), attempt(2)],
  budget,
  consumed,
  partialEffects: [subject],
  reason: "The operation did not complete within its recovery budget.",
  terminalReason: "time-budget-exhausted",
});

describe("@beep/skill-contract Recovery", () => {
  it.effect("round-trips a coherent failure receipt with its pinned predicate identity", () =>
    Effect.gen(function* () {
      const receipt = FailureReceipt.make({
        predicate: failure,
        predicateType: FailurePredicateType,
        subject: [subject],
      });
      const encoded = yield* S.encodeUnknownEffect(FailureReceipt)(receipt);
      const decoded = yield* S.decodeEffect(FailureReceipt)(encoded);

      expect(S.toEquivalence(FailureReceipt)(decoded, receipt)).toBe(true);
      expect(decoded.predicateType).toBe(FailurePredicateType);
    })
  );

  it.effect("rejects negative and infinite budget durations and malformed attempt timestamps", () =>
    Effect.gen(function* () {
      const negative = yield* S.decodeEffect(BudgetDuration)(-1).pipe(Effect.flip);
      const infinite = yield* S.decodeEffect(BudgetDuration)(Number.POSITIVE_INFINITY).pipe(Effect.flip);
      const malformedAttemptInput: unknown = {
        attempt: 1,
        endedAt: "not-a-time",
        observations: [],
        operations: 0,
        outcome: "failed",
        startedAt: "also-not-a-time",
      };
      const malformedAttempt = yield* S.decodeUnknownEffect(RecoveryAttemptReceipt)(malformedAttemptInput).pipe(
        Effect.flip
      );

      expect(negative.message).toContain("non-negative");
      expect(infinite.message).toContain("non-negative");
      expect(malformedAttempt.message).toContain('["endedAt"]');
    })
  );

  it.effect("rejects history, counter, timing, and budget contradictions", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeUnknownEffect(FailureReceiptPredicate)(failure);
      const firstAttempt = encoded.attempts[0];
      const secondAttempt = encoded.attempts[1];
      const duplicateInput: unknown = { ...encoded, attempts: [firstAttempt, firstAttempt] };
      const unorderedInput: unknown = { ...encoded, attempts: [secondAttempt, firstAttempt] };
      const ordinalOverflowInput: unknown = {
        ...encoded,
        attempts: [{ ...secondAttempt, attempt: 3 }],
      };
      const countOverflowInput: unknown = { ...encoded, consumed: { ...encoded.consumed, attempts: 3 } };
      const operationOverflowInput: unknown = { ...encoded, consumed: { ...encoded.consumed, operations: 4 } };
      const timeOverflowInput: unknown = { ...encoded, consumed: { ...encoded.consumed, elapsed: 2_001 } };
      const countUnderrunInput: unknown = { ...encoded, consumed: { ...encoded.consumed, attempts: 0 } };
      const operationUnderrunInput: unknown = { ...encoded, consumed: { ...encoded.consumed, operations: 0 } };
      const elapsedMismatchInput: unknown = { ...encoded, consumed: { ...encoded.consumed, elapsed: 1_999 } };
      const perAttemptTimeoutInput: unknown = {
        ...encoded,
        attempts: [{ ...firstAttempt, endedAt: "2026-08-24T00:00:01.001Z" }, secondAttempt],
      };
      const reversedAttemptInput: unknown = {
        ...encoded,
        attempts: [{ ...firstAttempt, endedAt: "2026-08-23T23:59:59.000Z" }, secondAttempt],
      };
      const overlappingAttemptsInput: unknown = {
        ...encoded,
        attempts: [firstAttempt, { ...secondAttempt, startedAt: "2026-08-24T00:00:00.500Z" }],
      };

      const duplicate = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(duplicateInput).pipe(Effect.flip);
      const unordered = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(unorderedInput).pipe(Effect.flip);
      const ordinalOverflow = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(ordinalOverflowInput).pipe(
        Effect.flip
      );
      const countOverflow = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(countOverflowInput).pipe(Effect.flip);
      const operationOverflow = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(operationOverflowInput).pipe(
        Effect.flip
      );
      const timeOverflow = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(timeOverflowInput).pipe(Effect.flip);
      const countUnderrun = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(countUnderrunInput).pipe(Effect.flip);
      const operationUnderrun = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(operationUnderrunInput).pipe(
        Effect.flip
      );
      const elapsedMismatch = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(elapsedMismatchInput).pipe(
        Effect.flip
      );
      const perAttemptTimeout = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(perAttemptTimeoutInput).pipe(
        Effect.flip
      );
      const reversedAttempt = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(reversedAttemptInput).pipe(
        Effect.flip
      );
      const overlappingAttempts = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(overlappingAttemptsInput).pipe(
        Effect.flip
      );

      expect(duplicate.message).toContain("agree with the declared budget");
      expect(unordered.message).toContain("agree with the declared budget");
      expect(ordinalOverflow.message).toContain("agree with the declared budget");
      expect(countOverflow.message).toContain("agree with the declared budget");
      expect(operationOverflow.message).toContain("agree with the declared budget");
      expect(timeOverflow.message).toContain("agree with the declared budget");
      expect(countUnderrun.message).toContain("agree with the declared budget");
      expect(operationUnderrun.message).toContain("agree with the declared budget");
      expect(elapsedMismatch.message).toContain("agree with the declared budget");
      expect(perAttemptTimeout.message).toContain("agree with the declared budget");
      expect(reversedAttempt.message).toContain("agree with the declared budget");
      expect(overlappingAttempts.message).toContain("agree with the declared budget");
    })
  );

  it.effect("rejects exhaustion reasons that contradict the consumed budget", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeUnknownEffect(FailureReceiptPredicate)(failure);
      const attemptInput: unknown = {
        ...encoded,
        budget: { ...encoded.budget, maxAttempts: 3 },
        terminalReason: "attempt-budget-exhausted",
      };
      const operationInput: unknown = {
        ...encoded,
        budget: { ...encoded.budget, maxOperations: 4 },
        terminalReason: "operation-budget-exhausted",
      };
      const timeInput: unknown = {
        ...encoded,
        budget: { ...encoded.budget, totalTimeout: 3_000 },
        terminalReason: "time-budget-exhausted",
      };

      const attemptFailure = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(attemptInput).pipe(Effect.flip);
      const operationFailure = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(operationInput).pipe(Effect.flip);
      const timeFailure = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(timeInput).pipe(Effect.flip);

      expect(attemptFailure.message).toContain("terminal reason");
      expect(operationFailure.message).toContain("terminal reason");
      expect(timeFailure.message).toContain("terminal reason");
    })
  );

  it.effect("allows non-budget terminal reasons below the limits, including cancellation before an attempt", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeUnknownEffect(FailureReceiptPredicate)(failure);
      const relaxedBudget = { ...encoded.budget, maxAttempts: 3, maxOperations: 4, totalTimeout: 3_000 };
      const nonRetryableInput: unknown = {
        ...encoded,
        budget: relaxedBudget,
        terminalReason: "non-retryable-failure",
      };
      const cancelledInput: unknown = {
        ...encoded,
        attempts: [],
        budget: relaxedBudget,
        consumed: { attempts: 0, elapsed: 0, operations: 0 },
        terminalReason: "cancelled",
      };

      const nonRetryable = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(nonRetryableInput);
      const cancelled = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(cancelledInput);

      expect(nonRetryable.terminalReason).toBe("non-retryable-failure");
      expect(cancelled.attempts).toEqual([]);
    })
  );

  it("models explicit no-recovery and bounded policies without an engine", () => {
    const none = NoRecoveryPolicy.make({});
    const bounded = BoundedRecoveryPolicy.make({ budget });

    expect(RecoveryPolicy.match(none, { bounded: () => "bounded", none: () => "none" })).toBe("none");
    expect(RecoveryPolicy.match(bounded, { bounded: ({ budget: value }) => value.maxAttempts, none: () => 0 })).toBe(2);
  });

  it("round-trips schema-derived arbitrary recovery policies", () =>
    fc.assert(
      fc.property(S.toArbitrary(RecoveryPolicy)(fc), (candidate) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(RecoveryPolicy)(candidate));
        const decoded = Result.getOrThrow(S.decodeResult(RecoveryPolicy)(encoded));

        expect(S.toEquivalence(RecoveryPolicy)(decoded, candidate)).toBe(true);
      }),
      fcRuns(25)
    ));
});
