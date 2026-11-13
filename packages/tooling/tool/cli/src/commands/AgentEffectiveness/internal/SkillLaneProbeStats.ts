/**
 * Arithmetic for the skill lane probe.
 *
 * Implements the Decision Rule of `goals/skill-lane-probe/SPEC.md`: lane
 * fraction per run, task differences C minus B, a within-task permutation
 * test with a fixed seed, the fixed-task interval, Holm-adjusted family tests
 * and the four outcomes in their order.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Random from "effect/Random";
import * as R from "effect/Record";
import { roundScore } from "./EvalScoring.ts";
import {
  SkillLaneFamilyTest,
  SkillLanePermutationResult,
  SkillLanePermutationTest,
  SkillLaneProbeReport,
  SkillLaneProbeTask,
  SkillLaneProbeVerdict,
  SkillLaneTaskValues,
} from "./SkillLaneProbeSchemas.ts";
import { SkillProbeEstimate, SkillProbeOutcome } from "./SkillProbeSchemas.ts";
import { buildSkillProbeReport, estimateClusteredMean, sampleMean, sampleVariance } from "./SkillProbeStats.ts";
import type { SkillLaneProbeOptions } from "./SkillLaneProbeSchemas.ts";
import type { SkillProbeRunRecord } from "./SkillProbeSchemas.ts";

/**
 * Seed of the relabelings, fixed by the Decision Rule.
 *
 * @category constants
 * @since 0.0.0
 */
export const SKILL_LANE_PROBE_SEED = 20261113;
/**
 * Relabelings drawn by the test, fixed by the Decision Rule.
 *
 * @category constants
 * @since 0.0.0
 */
export const SKILL_LANE_PROBE_RELABELINGS = 100000;
/**
 * Most scored-run attempts, counted and excluded together.
 *
 * @category constants
 * @since 0.0.0
 */
export const SKILL_LANE_PROBE_MAX_ATTEMPTS = 144;
const ALPHA = 0.05;
const EFFECT_THRESHOLD = 0.1;
const RUNS_PER_CELL = 5;
const COMPLETE_TASK_FLOOR = 10;
const NORMAL_975 = 1.96;

const taskDifference = (task: SkillLaneTaskValues): number => sampleMean(task.valuesC) - sampleMean(task.valuesB);

/**
 * `D` with the fixed-task interval `D ± 1.96 * SE`, where
 * `SE = sqrt(sum_t (var_C(t)/n_C(t) + var_B(t)/n_B(t))) / T`.
 *
 * **Details**
 *
 * The tasks are the whole population, so run-to-run noise is the only
 * uncertainty. Sample variances are over runs; a cell with one run adds none.
 *
 * **Example** (Two tasks)
 *
 * ```ts
 * import { fixedTaskInterval, SkillLaneTaskValues } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const interval = fixedTaskInterval([
 *   SkillLaneTaskValues.make({ taskId: "a", family: "f", valuesB: [0.2, 0.4], valuesC: [0.6, 0.8] }),
 *   SkillLaneTaskValues.make({ taskId: "b", family: "g", valuesB: [0.5, 0.5, 0.5], valuesC: [0.5, 0.7] })
 * ])
 * console.log(interval.mean) // 0.25
 * ```
 *
 * @param tasks - Counted tasks with runs in both cells.
 * @returns The estimate over `T` tasks; an empty input is a zero-width interval at 0.
 * @category statistics
 * @since 0.0.0
 */
export const fixedTaskInterval = (tasks: ReadonlyArray<SkillLaneTaskValues>): SkillProbeEstimate => {
  const count = A.length(tasks);
  const center = sampleMean(A.map(tasks, taskDifference));
  const standardError =
    count === 0
      ? 0
      : Math.sqrt(
          Num.sumAll(
            A.map(
              tasks,
              (task) =>
                sampleVariance(task.valuesC) / A.length(task.valuesC) +
                sampleVariance(task.valuesB) / A.length(task.valuesB)
            )
          )
        ) / count;
  return SkillProbeEstimate.make({
    n: count,
    mean: roundScore(center),
    standardError: roundScore(standardError),
    lower: roundScore(center - NORMAL_975 * standardError),
    upper: roundScore(center + NORMAL_975 * standardError),
  });
};

/**
 * Holm step-down adjustment of a family of p-values, in input order.
 *
 * **Example** (Four families)
 *
 * ```ts
 * import { holmAdjust } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(holmAdjust([0.01, 0.04, 0.03, 0.005])) // [0.03, 0.06, 0.06, 0.02]
 * ```
 *
 * @param pValues - Unadjusted p-values.
 * @returns Adjusted p-values capped at 1, monotone in the sorted order.
 * @category statistics
 * @since 0.0.0
 */
export const holmAdjust = (pValues: ReadonlyArray<number>): ReadonlyArray<number> => {
  const m = A.length(pValues);
  const ranked = A.sort(
    A.map(pValues, (pValue, index) => ({ pValue, index })),
    Order.mapInput(Order.Number, (entry: { readonly pValue: number }) => entry.pValue)
  );
  const adjusted = A.reduce(
    ranked,
    { running: 0, entries: A.empty<{ readonly index: number; readonly value: number }>() },
    (state, entry, rank) => {
      const running = Math.min(1, Math.max(state.running, (m - rank) * entry.pValue));
      return { running, entries: A.append(state.entries, { index: entry.index, value: roundScore(running) }) };
    }
  ).entries;
  return A.map(
    A.sort(
      adjusted,
      Order.mapInput(Order.Number, (entry: { readonly index: number }) => entry.index)
    ),
    (entry) => entry.value
  );
};

const pValueOf = (exceed: number, relabelings: number): number => roundScore((1 + exceed) / (1 + relabelings));

type NextDouble = () => number;

// Fisher-Yates over the whole buffer, one draw per position from the top down.
const shuffleInPlace = (buffer: Float64Array, nextDouble: NextDouble): void => {
  for (let i = buffer.length - 1; i >= 1; i--) {
    const j = Math.min(i, Math.floor(nextDouble() * (i + 1)));
    const value = buffer[i]!;
    buffer[i] = buffer[j]!;
    buffer[j] = value;
  }
};

const sumRange = (buffer: Float64Array, from: number, to: number): number => {
  let sum = 0;
  for (let i = from; i < to; i++) sum += buffer[i]!;
  return sum;
};

// Mean of the first `sizeC` entries minus the mean of the rest.
const splitDifference = (buffer: Float64Array, sizeC: number): number =>
  sumRange(buffer, 0, sizeC) / sizeC - sumRange(buffer, sizeC, buffer.length) / (buffer.length - sizeC);

type RelabelingPlan = {
  readonly pooled: ReadonlyArray<Float64Array>;
  readonly buffers: ReadonlyArray<Float64Array>;
  readonly sizesC: ReadonlyArray<number>;
  readonly familyOf: ReadonlyArray<number>;
  readonly familySums: Float64Array;
};

// One relabeling of every task in input order; fills `familySums`, returns the overall sum.
const drawRelabeling = (plan: RelabelingPlan, nextDouble: NextDouble): number => {
  plan.familySums.fill(0);
  let overallSum = 0;
  for (let t = 0; t < plan.pooled.length; t++) {
    const buffer = plan.buffers[t]!;
    buffer.set(plan.pooled[t]!);
    shuffleInPlace(buffer, nextDouble);
    const difference = splitDifference(buffer, plan.sizesC[t]!);
    overallSum += difference;
    plan.familySums[plan.familyOf[t]!]! += difference;
  }
  return overallSum;
};

const countFamilyExceedances = (
  familySums: Float64Array,
  familySizes: ReadonlyArray<number>,
  observedFamilies: ReadonlyArray<number>,
  exceedFamilies: Float64Array
): void => {
  for (let f = 0; f < familySums.length; f++) {
    if (Math.abs(roundScore(familySums[f]! / familySizes[f]!)) >= observedFamilies[f]!) exceedFamilies[f]!++;
  }
};

/**
 * The within-task permutation test: each relabeling shuffles every task's
 * pooled runs and splits them back into cells of the original sizes.
 *
 * **Details**
 *
 * Every relabeling draws every task once, tasks in input order, each a
 * Fisher-Yates shuffle of the task's C runs followed by its B runs, so the
 * draws depend only on the seed and the input. The overall statistic is `D`,
 * a family's statistic the mean of its task differences; all share the same
 * relabelings. A relabeling counts when `|D*| >= |D|` after both are rounded
 * to six decimals, and `p = (1 + count) / (1 + relabelings)`. Run it under
 * `Random.withSeed` for a reproducible p-value. With no tasks nothing is
 * drawn and `p = 1`, with no families. The loop is imperative
 * because it runs about ten million draws.
 *
 * **Example** (Seeded test)
 *
 * ```ts
 * import { SkillLaneTaskValues, skillLanePermutationTest } from "@beep/repo-cli/test/AgentEffectiveness"
 * import * as Effect from "effect/Effect"
 * import * as Random from "effect/Random"
 *
 * const program = skillLanePermutationTest(
 *   [SkillLaneTaskValues.make({ taskId: "a", family: "f", valuesB: [0, 0], valuesC: [1, 1] })],
 *   1000
 * ).pipe(Random.withSeed(20261113))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param tasks - Counted tasks with runs in both cells.
 * @param relabelings - Number of random relabelings.
 * @returns The overall p-value and one p-value per family.
 * @category statistics
 * @since 0.0.0
 */
export const skillLanePermutationTest: {
  (relabelings: number): (tasks: ReadonlyArray<SkillLaneTaskValues>) => Effect.Effect<SkillLanePermutationResult>;
  (tasks: ReadonlyArray<SkillLaneTaskValues>, relabelings: number): Effect.Effect<SkillLanePermutationResult>;
} = dual(
  2,
  Effect.fnUntraced(function* (tasks: ReadonlyArray<SkillLaneTaskValues>, relabelings: number) {
    // No tasks: the statistic is undefined, so nothing is drawn and nothing is detected.
    if (!A.isReadonlyArrayNonEmpty(tasks)) return SkillLanePermutationResult.make({ pValue: 1, familyPValues: {} });
    const random = yield* Random.Random;
    const families = A.sort(A.dedupe(A.map(tasks, (task) => task.family)), Order.String);
    // A family's index is its rank among the sorted distinct families.
    const familyOf = A.map(tasks, (task) => A.length(A.filter(families, (family) => family < task.family)));
    const familySizes = A.map(families, (family) => A.length(A.filter(tasks, (task) => task.family === family)));
    const observed = A.map(tasks, taskDifference);
    const observedOverall = Math.abs(roundScore(sampleMean(observed)));
    const observedFamilies = A.map(families, (family) =>
      Math.abs(
        roundScore(
          sampleMean(
            A.map(
              A.filter(tasks, (task) => task.family === family),
              taskDifference
            )
          )
        )
      )
    );
    const pooled = A.map(tasks, (task) => Float64Array.from([...task.valuesC, ...task.valuesB]));
    const familySums = new Float64Array(A.length(families));
    const plan: RelabelingPlan = {
      pooled,
      buffers: A.map(pooled, (values) => new Float64Array(values.length)),
      sizesC: A.map(tasks, (task) => A.length(task.valuesC)),
      familyOf,
      familySums,
    };
    const nextDouble: NextDouble = () => random.nextDoubleUnsafe();
    let exceedOverall = 0;
    const exceedFamilies = new Float64Array(A.length(families));
    for (let draw = 0; draw < relabelings; draw++) {
      const overallSum = drawRelabeling(plan, nextDouble);
      if (Math.abs(roundScore(overallSum / pooled.length)) >= observedOverall) exceedOverall++;
      countFamilyExceedances(familySums, familySizes, observedFamilies, exceedFamilies);
    }
    return SkillLanePermutationResult.make({
      pValue: pValueOf(exceedOverall, relabelings),
      familyPValues: R.fromEntries(
        A.map(A.zip(families, Array.from(exceedFamilies)), ([family, exceed]) => [
          family,
          pValueOf(exceed, relabelings),
        ])
      ),
    });
  })
);

/**
 * The verdict in the Decision Rule's order: Incomplete, Effect, Small effect, Null.
 *
 * **Details**
 *
 * `missing` names the tasks without 5 counted runs in both cells. A
 * difference is detected when `p < 0.05`. A detected difference below zero is
 * a Null flagged as harm; a detected difference of exactly zero is a Null.
 *
 * **Example** (A detected large difference)
 *
 * ```ts
 * import { decideSkillLaneProbe } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(decideSkillLaneProbe({ completeTasks: 12, missing: [], difference: 0.2, pValue: 0.001 })._tag) // "Effect"
 * ```
 *
 * @param input - Complete-task count, missing tasks, `D` and the overall p-value.
 * @returns The verdict.
 * @category statistics
 * @since 0.0.0
 */
export const decideSkillLaneProbe = (input: {
  readonly completeTasks: number;
  readonly missing: ReadonlyArray<string>;
  readonly difference: number;
  readonly pValue: number;
}): SkillLaneProbeVerdict => {
  const difference = roundScore(input.difference);
  const detected = input.pValue < ALPHA;
  if (input.completeTasks < COMPLETE_TASK_FLOOR) {
    return SkillLaneProbeVerdict.cases.Incomplete.make({
      completeTasks: input.completeTasks,
      required: COMPLETE_TASK_FLOOR,
      missing: input.missing,
    });
  }
  if (detected && difference >= EFFECT_THRESHOLD) {
    return SkillLaneProbeVerdict.cases.Effect.make({ difference, pValue: input.pValue });
  }
  if (detected && difference > 0) {
    return SkillLaneProbeVerdict.cases.SmallEffect.make({ difference, pValue: input.pValue });
  }
  return SkillLaneProbeVerdict.cases.Null.make({ difference, pValue: input.pValue, harm: detected && difference < 0 });
};

const laneValues = (records: ReadonlyArray<SkillProbeRunRecord>): ReadonlyArray<number> =>
  A.getSomes(
    A.map(records, (record) =>
      SkillProbeOutcome.guards.Scored(record.outcome) ? O.some(record.outcome.laneFraction) : O.none()
    )
  );

/**
 * Build the lane probe report from run records under the lane probe's rule.
 *
 * **Details**
 *
 * Only cells B and C enter the primary; excluded runs are counted, never
 * scored. A task counts when it has counted runs in both cells. The secondary
 * rows come from the first probe's report builder, without its verdict. A
 * pilot report carries no verdict and says so in `note`.
 *
 * **Example** (Report no records)
 *
 * ```ts
 * import { buildSkillLaneProbeReport, SkillLaneProbeOptions } from "@beep/repo-cli/test/AgentEffectiveness"
 * import * as Effect from "effect/Effect"
 *
 * const program = buildSkillLaneProbeReport(
 *   [],
 *   SkillLaneProbeOptions.make({ data: "pilot", seed: 20261113, relabelings: 10 })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param records - Run records from cells B and C.
 * @param options - Data label, seed and relabeling count.
 * @returns Task rows, `D` with its test and intervals, family tests, secondary rows and the verdict on scored data.
 * @category statistics
 * @since 0.0.0
 */
export const buildSkillLaneProbeReport: {
  (
    options: SkillLaneProbeOptions
  ): (records: ReadonlyArray<SkillProbeRunRecord>) => Effect.Effect<SkillLaneProbeReport>;
  (records: ReadonlyArray<SkillProbeRunRecord>, options: SkillLaneProbeOptions): Effect.Effect<SkillLaneProbeReport>;
} = dual(
  2,
  Effect.fnUntraced(function* (records: ReadonlyArray<SkillProbeRunRecord>, options: SkillLaneProbeOptions) {
    const base = buildSkillProbeReport(records, "all-lanes");
    const byTask = A.groupBy(records, (record) => record.taskId);
    const taskIds = A.sort(R.keys(byTask), Order.String);
    const perTask = A.getSomes(
      A.map(taskIds, (taskId) =>
        pipe(
          R.get(byTask, taskId),
          O.map((members) =>
            SkillLaneTaskValues.make({
              taskId,
              family: A.headNonEmpty(members).family,
              valuesB: laneValues(A.filter(members, (record) => record.cell === "B")),
              valuesC: laneValues(A.filter(members, (record) => record.cell === "C")),
            })
          )
        )
      )
    );
    const counted = A.filter(
      perTask,
      (task) => A.isReadonlyArrayNonEmpty(task.valuesB) && A.isReadonlyArrayNonEmpty(task.valuesC)
    );
    const complete = A.filter(
      perTask,
      (task) => A.length(task.valuesB) >= RUNS_PER_CELL && A.length(task.valuesC) >= RUNS_PER_CELL
    );
    const missing = A.filter(
      A.map(perTask, (task) => task.taskId),
      (taskId) => !A.some(complete, (task) => task.taskId === taskId)
    );
    const difference = fixedTaskInterval(counted);
    const permutation = yield* skillLanePermutationTest(counted, options.relabelings).pipe(
      Random.withSeed(options.seed)
    );
    const familyPValues = R.toEntries(permutation.familyPValues);
    const adjusted = holmAdjust(A.map(familyPValues, ([, pValue]) => pValue));
    const families = A.map(A.zip(familyPValues, adjusted), ([[family, pValue], adjustedPValue]) => {
      const members = A.filter(counted, (task) => task.family === family);
      const familyDifference = roundScore(sampleMean(A.map(members, taskDifference)));
      return SkillLaneFamilyTest.make({
        family,
        tasks: A.length(members),
        difference: familyDifference,
        pValue,
        adjustedPValue,
        keep: adjustedPValue < ALPHA && familyDifference > 0,
      });
    });
    const scored = options.data === "scored";
    return SkillLaneProbeReport.make({
      schemaVersion: "skill-lane-probe-report/v1",
      data: options.data,
      note: scored
        ? "Scored runs under the lane probe's Decision Rule."
        : "Pilot data: decides nothing, carries no verdict and is not evidence.",
      primary: "lane-fraction",
      scorerProfile: base.scorerProfile,
      fingerprints: base.fingerprints,
      attempts: A.length(records),
      countedRuns: base.countedRuns,
      excludedRuns: base.excludedRuns,
      completeTasks: A.length(complete),
      tasks: A.map(perTask, (task) =>
        SkillLaneProbeTask.make({
          taskId: task.taskId,
          family: task.family,
          countedB: A.length(task.valuesB),
          countedC: A.length(task.valuesC),
          meanB: roundScore(sampleMean(task.valuesB)),
          meanC: roundScore(sampleMean(task.valuesC)),
          difference: roundScore(taskDifference(task)),
          standardError: roundScore(
            Math.sqrt(
              (A.isReadonlyArrayNonEmpty(task.valuesC) ? sampleVariance(task.valuesC) / A.length(task.valuesC) : 0) +
                (A.isReadonlyArrayNonEmpty(task.valuesB) ? sampleVariance(task.valuesB) / A.length(task.valuesB) : 0)
            )
          ),
        })
      ),
      difference,
      test: SkillLanePermutationTest.make({
        seed: options.seed,
        relabelings: options.relabelings,
        pValue: permutation.pValue,
        detected: permutation.pValue < ALPHA,
      }),
      families,
      clustered: estimateClusteredMean(
        A.map(counted, (task) => ({ cluster: task.family, value: taskDifference(task) }))
      ),
      secondary: A.filter(base.differences, (row) => row.level === "overall" && row.contrast === "C-B"),
      firedOnly: base.firedOnly,
      cells: A.filter(base.cells, (cell) => cell.cell !== "A"),
      laneCensus: A.filter(base.laneCensus, (cell) => cell.cell !== "A"),
      firedRate: base.firedRate,
      firedRateGate: base.firedRateGate,
      verdict: scored
        ? O.some(
            decideSkillLaneProbe({
              completeTasks: A.length(complete),
              missing,
              difference: difference.mean,
              pValue: permutation.pValue,
            })
          )
        : O.none(),
    });
  })
);
