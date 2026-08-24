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

  it.effect(
    "rejects duplicate, unordered, ordinal-overflow, count-overflow, operation-overflow, and time-overflow",
    () =>
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

        const duplicate = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(duplicateInput).pipe(Effect.flip);
        const unordered = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(unorderedInput).pipe(Effect.flip);
        const ordinalOverflow = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(ordinalOverflowInput).pipe(
          Effect.flip
        );
        const countOverflow = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(countOverflowInput).pipe(
          Effect.flip
        );
        const operationOverflow = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(operationOverflowInput).pipe(
          Effect.flip
        );
        const timeOverflow = yield* S.decodeUnknownEffect(FailureReceiptPredicate)(timeOverflowInput).pipe(Effect.flip);

        expect(duplicate.message).toContain("within budget");
        expect(unordered.message).toContain("within budget");
        expect(ordinalOverflow.message).toContain("within budget");
        expect(countOverflow.message).toContain("within budget");
        expect(operationOverflow.message).toContain("within budget");
        expect(timeOverflow.message).toContain("within budget");
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
