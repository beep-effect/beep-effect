import {
  RetentionCalibration,
  RetentionEvaluation,
  RetentionPolicy,
  RetentionQuery,
  RetentionReport,
  retentionPolicyDigest,
} from "@beep/epistemic-domain/values/Retention";
import { evaluateRetentionCandidate, generateRetentionReport } from "@beep/epistemic-use-cases/Retention";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { keyB, makeCalibration, makeSnapshot, policyInput, provideFixture, queryInput } from "./helpers/Retention.ts";

const baseline = Effect.fn("EvaluationTest.baseline")(function* (knownAt: number) {
  const value = yield* S.decodeEffect(RetentionQuery)({
    ...queryInput,
    logicalKeys: [keyB],
    knownAt,
  });
  const argument = generateRetentionReport(value, O.none());
  const madeSnapshot = yield* makeSnapshot();
  return yield* argument.pipe(provideFixture(madeSnapshot, O.none()));
});

describe("offline retention evaluation", () => {
  it.effect.prop(
    "keeps budget sensitivity separate from baseline authority and approval",
    [Arbitrary.schema(RetentionPolicy.fields.payloadBudgetBytes.check(S.isLessThanOrEqualTo(1_000_000)))],
    ([payloadBudgetBytes]) =>
      Effect.gen(function* () {
        const report = yield* baseline(1500);
        const before = yield* S.encodeEffect(RetentionReport)(report);
        const policy = yield* S.decodeEffect(RetentionPolicy)({ ...policyInput, payloadBudgetBytes });
        const result = yield* evaluateRetentionCandidate(report, policy);
        expect(result.pressureRatio).toBe(report.payloadBytes / payloadBudgetBytes);
        expect(result.baseline.admission.state).toBe("inert");
        const value1 = yield* S.encodeEffect(RetentionReport)(report);
        expect(value1).toEqual(before);
        const argument1 = S.decodeUnknownOption(RetentionCalibration);
        const value4 = yield* S.encodeEffect(RetentionEvaluation)(result);
        assertNone(argument1(value4));
      })
  );
  it.effect("shares inclusive cutoffs and rational decay without admitting a policy", () =>
    Effect.gen(function* () {
      const policy = yield* S.decodeEffect(RetentionPolicy)(policyInput);
      for (const [age, tier] of [
        [100, "hot"],
        [101, "warm"],
        [500, "warm"],
        [501, "cold"],
        [1000, "cold"],
        [1001, "evictable"],
      ] satisfies ReadonlyArray<readonly [number, string]>) {
        const report = yield* baseline(age + 1000);
        const result = yield* evaluateRetentionCandidate(report, policy);
        expect(result.rows[0]?.tier).toBe(tier);
        expect(O.getOrUndefined(result.rows[0]?.decay ?? O.none())).toBe(1 / (1 + age / 500));
        expect(result.pressureRatio).toBe(report.payloadBytes / 10);
        const expectation = expect(result.policyDigest);
        const retentionPolicyDigest5 = yield* retentionPolicyDigest(policy);
        expectation.toBe(retentionPolicyDigest5);
        expect(result.baseline.admission.state).toBe("inert");
        expect(report.rows[0]?.tier).toBe("unclassified");
        assertNone(report.pressureRatio);
        const value2 = yield* S.encodeEffect(RetentionEvaluation)(result);
        expect(value2).not.toHaveProperty("approvedBy");
      }
    })
  );
  it.effect("isolates the scale and budget sensitivities from age tiers", () =>
    Effect.gen(function* () {
      const report = yield* baseline(1500);
      const policy = yield* S.decodeEffect(RetentionPolicy)(policyInput);
      const initial = yield* evaluateRetentionCandidate(report, policy);
      const scaled = yield* evaluateRetentionCandidate(
        report,
        RetentionPolicy.make({ ...policy, decayScaleMillis: 1000 })
      );
      const budgeted = yield* evaluateRetentionCandidate(
        report,
        RetentionPolicy.make({ ...policy, payloadBudgetBytes: 20 })
      );
      expect(A.map(scaled.rows, (r) => r.tier)).toEqual(A.map(initial.rows, (r) => r.tier));
      expect(O.getOrUndefined(scaled.rows[0]?.decay ?? O.none())).toBe(2 / 3);
      expect(budgeted.pressureRatio).toBe(initial.pressureRatio / 2);
      expect(budgeted.rows).toEqual(initial.rows);
    })
  );
  it.effect("rejects admitted or inconsistent baselines", () =>
    Effect.gen(function* () {
      const policy = yield* S.decodeEffect(RetentionPolicy)(policyInput);
      const value3 = yield* S.decodeEffect(RetentionQuery)(queryInput);
      const argument2 = generateRetentionReport(value3, O.some(policy));
      const argument3 = yield* makeSnapshot();
      const madeCalibration = yield* makeCalibration();
      const admitted = yield* argument2.pipe(provideFixture(argument3, O.some(madeCalibration)));
      const isFailure4 = yield* Effect.isFailure(evaluateRetentionCandidate(admitted, policy));
      assertTrue(isFailure4);
      const report = yield* baseline(1500);
      const isFailure5 = yield* Effect.isFailure(
        evaluateRetentionCandidate(RetentionReport.make({ ...report, payloadBytes: 0 }), policy)
      );
      assertTrue(isFailure5);
    })
  );
  it.effect("rejects receipt field drift using the shipped contract", () =>
    Effect.gen(function* () {
      const argument4 = S.encodeEffect(RetentionCalibration);
      const madeCalibration6 = yield* makeCalibration();
      const encoded = yield* argument4(madeCalibration6);
      for (const patch of [
        { mechanism: "retention-v2" },
        { policyDigest: "bad" },
        { datasetDigest: "bad" },
        { evaluationReport: "" },
        { sampleCount: 0 },
        { approvedBy: { kind: "System", component: "Runtime" } },
        { approvedAt: "not-time" },
        { expiresAt: "not-time" },
        { purpose: "unknown" },
        { orgId: 0 },
      ]) {
        assertNone(S.decodeUnknownOption(RetentionCalibration)({ ...encoded, ...patch }));
      }
    })
  );
  it.effect("preserves an empty filtered baseline without inventing samples", () =>
    Effect.gen(function* () {
      const value6 = yield* S.decodeEffect(RetentionQuery)({ ...queryInput, logicalKeys: [] });
      const argument5 = generateRetentionReport(value6, O.none());
      const madeSnapshot7 = yield* makeSnapshot();
      const report = yield* argument5.pipe(provideFixture(madeSnapshot7, O.none()));
      const value7 = yield* S.decodeEffect(RetentionPolicy)(policyInput);
      const result = yield* evaluateRetentionCandidate(report, value7);
      expect(result.rows).toEqual([]);
      expect(result.pressureRatio).toBe(0);
      expect(A.every(result.tiers, (tier) => tier.count === 0)).toBe(true);
    })
  );
});
