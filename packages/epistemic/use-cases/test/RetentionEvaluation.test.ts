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
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { keyB, makeCalibration, makeSnapshot, policyInput, provideFixture, queryInput } from "./helpers/Retention.ts";

const baseline = Effect.fn("EvaluationTest.baseline")(function* (knownAt: number) {
  return yield* generateRetentionReport(
    yield* S.decodeEffect(RetentionQuery)({
      ...queryInput,
      logicalKeys: [keyB],
      knownAt,
    }),
    O.none()
  ).pipe(provideFixture(yield* makeSnapshot(), O.none()));
});

describe("offline retention evaluation", () => {
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
        expect(result.policyDigest).toBe(yield* retentionPolicyDigest(policy));
        expect(result.baseline.admission.state).toBe("inert");
        expect(report.rows[0]?.tier).toBe("unclassified");
        assertNone(report.pressureRatio);
        expect(yield* S.encodeEffect(RetentionEvaluation)(result)).not.toHaveProperty("approvedBy");
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
      const admitted = yield* generateRetentionReport(
        yield* S.decodeEffect(RetentionQuery)(queryInput),
        O.some(policy)
      ).pipe(provideFixture(yield* makeSnapshot(), O.some(yield* makeCalibration())));
      assertTrue(yield* Effect.isFailure(evaluateRetentionCandidate(admitted, policy)));
      const report = yield* baseline(1500);
      assertTrue(
        yield* Effect.isFailure(
          evaluateRetentionCandidate(RetentionReport.make({ ...report, payloadBytes: 0 }), policy)
        )
      );
    })
  );
  it.effect("rejects receipt field drift using the shipped contract", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(RetentionCalibration)(yield* makeCalibration());
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
      const report = yield* generateRetentionReport(
        yield* S.decodeEffect(RetentionQuery)({ ...queryInput, logicalKeys: [] }),
        O.none()
      ).pipe(provideFixture(yield* makeSnapshot(), O.none()));
      const result = yield* evaluateRetentionCandidate(report, yield* S.decodeEffect(RetentionPolicy)(policyInput));
      expect(result.rows).toEqual([]);
      expect(result.pressureRatio).toBe(0);
      expect(A.every(result.tiers, (tier) => tier.count === 0)).toBe(true);
    })
  );
});
