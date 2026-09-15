import {
  AgentConventionComparison,
  AgentConventionControls,
  AgentConventionMeasurements,
  AgentConventionTrial,
  compareAgentConventionTrials,
} from "@beep/repo-cli/test/AgentEffectiveness";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import baselineInput from "./fixtures/agent-effectiveness/comparison/baseline.json";
import candidateInput from "./fixtures/agent-effectiveness/comparison/candidate.json";

const decodeTrial = S.decodeUnknownEffect(AgentConventionTrial);
const decodeComparison = S.decodeUnknownEffect(S.fromJsonString(AgentConventionComparison));
const encodeComparison = S.encodeEffect(S.fromJsonString(AgentConventionComparison));
const comparisonEqual = S.toEquivalence(AgentConventionComparison);
const Decision = AgentConventionComparison.fields.result;
const pair = Effect.all([decodeTrial(baselineInput), decodeTrial(candidateInput)]);
const compare = Effect.fn("ConventionComparisonTest.compare")(function* (candidate: unknown) {
  return compareAgentConventionTrials(yield* decodeTrial(baselineInput), yield* decodeTrial(candidate));
});

describe("declared convention comparisons", () => {
  it.effect(
    "preserves separate outcomes and unknown measurements through JSON",
    Effect.fnUntraced(function* () {
      const report = yield* compare(candidateInput);
      expect(report.result._tag).toBe("Comparable");
      if (Decision.guards.Comparable(report.result)) {
        expect(report.result.changedSurface).toBe("navigation");
        expect(report.result.differences.elapsedMs).toBe(-200);
        assertSome(report.result.differences.inputTokens, -20);
        assertNone(report.result.differences.introducedDefects);
        expect(report.result.differences.completion).toBe(0);
      }
      const restored = yield* decodeComparison(yield* encodeComparison(report));
      expect(comparisonEqual(report, restored)).toBe(true);
    })
  );
  it.effect(
    "counts absent acceptance checks as not run",
    Effect.fnUntraced(function* () {
      const report = yield* compare({
        ...candidateInput,
        measurements: { ...candidateInput.measurements, acceptance: {} },
      });
      if (Decision.guards.Comparable(report.result)) {
        expect(report.result.differences.acceptancePassed).toBe(-2);
        expect(report.result.differences.acceptanceNotRun).toBe(2);
      } else expect.unreachable();
    })
  );
  it.effect(
    "requires a changed surface and distinct run identities",
    Effect.fnUntraced(function* () {
      expect((yield* compare(baselineInput)).result).toEqual({
        _tag: "Incomparable",
        reasons: ["run-reused", "surface-count"],
      });
    })
  );
  it.effect(
    "refuses several convention changes in one pair",
    Effect.fnUntraced(function* () {
      const report = yield* compare({
        ...candidateInput,
        variant: { ...candidateInput.variant, guidance: candidateInput.variant.navigation },
      });
      expect(report.result).toEqual({ _tag: "Incomparable", reasons: ["surface-count"] });
    })
  );
  it.effect(
    "reports pair, task, and fraction mismatches together",
    Effect.fnUntraced(function* () {
      const report = yield* compare({
        ...candidateInput,
        pairId: "other",
        evaluation: { ...candidateInput.evaluation, taskId: "other", score: 10 },
      });
      expect(report.result).toEqual({
        _tag: "Incomparable",
        reasons: ["pair-differs", "task-mismatch", "invalid-score"],
      });
    })
  );
  it.effect(
    "detects changes to every declared control",
    Effect.fnUntraced(function* () {
      const [baseline, candidate] = yield* pair;
      const variants = [
        { model: "another-model" },
        { reasoningEffort: "high" },
        { tokenBudget: 1 },
        { timeBudgetMs: 1 },
        { acceptanceChecks: ["a-different-test"] },
        { safetyPolicyDigest: candidate.variant.navigation },
        { harnessDigest: candidate.variant.navigation },
        { environmentDigest: candidate.variant.navigation },
        { repositorySnapshot: candidate.variant.navigation },
        { task: { ...candidate.controls.task, prompt: "Another task" } },
      ];
      for (const change of variants) {
        const changed = AgentConventionTrial.make({
          ...candidate,
          controls: AgentConventionControls.make({ ...candidate.controls, ...change }),
        });
        expect(compareAgentConventionTrials(baseline, changed).result).toEqual({
          _tag: "Incomparable",
          reasons: ["controls-differ"],
        });
      }
    })
  );
  it.effect(
    "rejects invalid resource counts at the receipt boundary",
    Effect.fnUntraced(function* () {
      for (const inputTokens of [-1, 0.5, Number.POSITIVE_INFINITY]) {
        const result = yield* decodeTrial({
          ...candidateInput,
          measurements: { ...candidateInput.measurements, inputTokens },
        }).pipe(Effect.result);
        expect(result._tag).toBe("Failure");
      }
    })
  );
  it.effect.prop(
    "reversing a matched pair reverses measured differences",
    { elapsed: AgentConventionMeasurements.fields.elapsedMs },
    ({ elapsed }) =>
      Effect.gen(function* () {
        const [baseline, original] = yield* pair;
        const candidate = AgentConventionTrial.make({
          ...original,
          measurements: AgentConventionMeasurements.make({ ...original.measurements, elapsedMs: elapsed }),
        });
        const forward = compareAgentConventionTrials(baseline, candidate).result;
        const backward = compareAgentConventionTrials(baseline)(candidate).result;
        expect(forward._tag).toBe("Comparable");
        expect(backward._tag).toBe("Comparable");
        if (Decision.guards.Comparable(forward) && Decision.guards.Comparable(backward)) {
          expect(forward.differences.elapsedMs + backward.differences.elapsedMs).toBe(0);
        }
      }),
    { arbitrary: fcRuns(50) }
  );
});
