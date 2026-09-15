/**
 * Read-only comparison of declared convention experiment receipts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Console, Effect, FileSystem, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { AgentEffectivenessEvalScorerError } from "../AgentEffectiveness.errors.ts";
import {
  AgentConventionComparison,
  AgentConventionControls,
  AgentConventionDifferences,
  AgentConventionTrial,
} from "../AgentEffectiveness.schemas.ts";
import type { AgentConventionMeasurements } from "../AgentEffectiveness.schemas.ts";

const controlsEqual = S.toEquivalence(AgentConventionControls);
const Decision = AgentConventionComparison.fields.result;
const Refusal = Decision.cases.Incomparable.fields.reasons.value;
const Surface = Decision.cases.Comparable.fields.changedSurface;
const isFraction = S.is(S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })));
const decodeTrial = S.decodeUnknownEffect(S.fromJsonString(AgentConventionTrial));
const encodeComparison = S.encodeEffect(S.fromJsonString(AgentConventionComparison));

const measuredDifference = (baseline: O.Option<number>, candidate: O.Option<number>) =>
  O.zipWith(baseline, candidate, (before, after) => after - before);

const hasValidScore = (trial: AgentConventionTrial) =>
  A.every([trial.evaluation.score, ...R.values(trial.evaluation.breakdown)], isFraction);

const acceptanceCount = (
  trial: AgentConventionTrial,
  outcome: typeof AgentConventionMeasurements.fields.acceptance.value.Type
) =>
  pipe(
    trial.controls.acceptanceChecks,
    A.dedupe,
    A.filter((check) =>
      Eq.equals(
        pipe(
          R.get(trial.measurements.acceptance, check),
          O.getOrElse(() => "not-run")
        ),
        outcome
      )
    ),
    A.length
  );

const differences = (baseline: AgentConventionTrial, candidate: AgentConventionTrial) => {
  const before = baseline.measurements;
  const after = candidate.measurements;
  const oldScore = baseline.evaluation.breakdown;
  const newScore = candidate.evaluation.breakdown;
  return AgentConventionDifferences.make({
    completion: newScore.completion - oldScore.completion,
    schemaFirst: newScore.schemaFirst - oldScore.schemaFirst,
    tsgo: newScore.tsgo - oldScore.tsgo,
    biome: newScore.biome - oldScore.biome,
    violationCount: A.length(candidate.evaluation.violations) - A.length(baseline.evaluation.violations),
    acceptancePassed: acceptanceCount(candidate, "passed") - acceptanceCount(baseline, "passed"),
    acceptanceFailed: acceptanceCount(candidate, "failed") - acceptanceCount(baseline, "failed"),
    acceptanceNotRun: acceptanceCount(candidate, "not-run") - acceptanceCount(baseline, "not-run"),
    elapsedMs: after.elapsedMs - before.elapsedMs,
    inputTokens: measuredDifference(before.inputTokens, after.inputTokens),
    outputTokens: measuredDifference(before.outputTokens, after.outputTokens),
    introducedDefects: measuredDifference(before.introducedDefects, after.introducedDefects),
    humanInterventions: measuredDifference(before.humanInterventions, after.humanInterventions),
  });
};

/**
 * Compare one declared pair only when controls match and one surface changed.
 *
 * **Details**
 *
 * Differences are candidate minus baseline. Completion, law fractions, and
 * passed checks favor increases; defects, interventions, time, and token counts
 * favor decreases. The original scorer score is retained only in each receipt.
 *
 * **Example** (Compose a decoded comparison)
 *
 * ```ts
 * import { AgentConventionTrial } from "@beep/repo-cli/commands/AgentEffectiveness"
 * import { compareAgentConventionTrials } from "@beep/repo-cli/test/AgentEffectiveness"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(AgentConventionTrial)
 * const compare = (before: unknown, after: unknown) => Effect.gen(function* () {
 *   const baseline = yield* decode(before)
 *   const candidate = yield* decode(after)
 *   return compareAgentConventionTrials(baseline, candidate).result
 * })
 * console.log(Effect.isEffect(compare({}, {}))) // true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const compareAgentConventionTrials: {
  (baseline: AgentConventionTrial, candidate: AgentConventionTrial): AgentConventionComparison;
  (candidate: AgentConventionTrial): (baseline: AgentConventionTrial) => AgentConventionComparison;
} = dual(2, (baseline: AgentConventionTrial, candidate: AgentConventionTrial): AgentConventionComparison => {
  const changedSurfaces = A.filter(
    Surface.Options,
    (surface) => !Eq.equals(baseline.variant[surface], candidate.variant[surface])
  );
  let reasons = A.empty<typeof Refusal.Type>();
  if (!controlsEqual(baseline.controls, candidate.controls)) reasons = A.append(reasons, "controls-differ");
  if (!Eq.equals(baseline.pairId, candidate.pairId)) reasons = A.append(reasons, "pair-differs");
  if (Eq.equals(baseline.runId, candidate.runId)) reasons = A.append(reasons, "run-reused");
  if (
    !Eq.equals(baseline.evaluation.taskId, baseline.controls.task.id) ||
    !Eq.equals(candidate.evaluation.taskId, candidate.controls.task.id)
  )
    reasons = A.append(reasons, "task-mismatch");
  if (!hasValidScore(baseline) || !hasValidScore(candidate)) reasons = A.append(reasons, "invalid-score");
  if (A.length(changedSurfaces) !== 1) reasons = A.append(reasons, "surface-count");
  const result = A.match(reasons, {
    onEmpty: () =>
      A.match(changedSurfaces, {
        onEmpty: () => Decision.cases.Incomparable.make({ reasons: ["surface-count"] }),
        onNonEmpty: ([changedSurface]) =>
          Decision.cases.Comparable.make({
            changedSurface,
            differences: differences(baseline, candidate),
          }),
      }),
    onNonEmpty: (reasons) => Decision.cases.Incomparable.make({ reasons }),
  });
  return AgentConventionComparison.make({
    schemaVersion: "agent-convention-comparison/v1",
    baseline,
    candidate,
    result,
  });
});

const readTrial = Effect.fn("AgentConventionComparison.readTrial")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(file)
    .pipe(
      Effect.flatMap(decodeTrial),
      Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Cannot read convention trial receipt.", { file }))
    );
});

/**
 * Read two receipts and print their schema-validated comparison as JSON.
 *
 * **Details**
 *
 * With `failIncomparable`, a refused pairing still prints its report before
 * failing the command. Set it to false to succeed whenever a report is produced.
 *
 * **Example** (Prepare a local receipt comparison)
 *
 * ```ts
 * import { runAgentConventionComparison } from "@beep/repo-cli/test/AgentEffectiveness"
 * import { Effect } from "effect"
 *
 * const program = runAgentConventionComparison("baseline.json", "candidate.json", false)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const runAgentConventionComparison = Effect.fn("AgentConventionComparison.run")(function* (
  baselineFile: string,
  candidateFile: string,
  failIncomparable: boolean
) {
  const baseline = yield* readTrial(baselineFile);
  const candidate = yield* readTrial(candidateFile);
  const comparison = compareAgentConventionTrials(baseline, candidate);
  const json = yield* encodeComparison(comparison).pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Cannot encode convention comparison."))
  );
  yield* Console.log(json);
  if (failIncomparable && Decision.guards.Incomparable(comparison.result)) {
    return yield* AgentEffectivenessEvalScorerError.new(
      `Convention trials are incomparable: ${A.join(comparison.result.reasons, ", ")}.`,
      { exitCode: 1 }
    );
  }
  return comparison;
});
