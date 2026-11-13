/**
 * Paired-difference arithmetic for the skill effect probe.
 *
 * Implements `goals/skill-effect-probe/research/2026-11-12-analysis-rule.md`:
 * task-level pairing, a family-clustered interval on the overall mean, and
 * the verdict against the decision rule.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import * as Eq from "effect/Equal";
import { dual, pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import { roundScore } from "./EvalScoring.ts";
import {
  SkillProbeCellSummary,
  SkillProbeDifference,
  SkillProbeEstimate,
  SkillProbeLaneCensus,
  SkillProbeOutcome,
  SkillProbeReport,
  SkillProbeVerdict,
} from "./SkillProbeSchemas.ts";
import type {
  SkillProbeCell,
  SkillProbeContrast,
  SkillProbeFingerprint,
  SkillProbeMeasure,
  SkillProbeRunRecord,
} from "./SkillProbeSchemas.ts";

/** Effect threshold on the overall C-B all-lanes difference. */
const EFFECT_THRESHOLD = 0.1;
/** Tasks that must show an all-lanes pass in B or C before Effect or Null is read. */
const SENSITIVE_TASK_FLOOR = 4;
/** Fired-rate gate on counted cell C runs. */
const FIRED_RATE_GATE = 0.8;
const NORMAL_975 = 1.96;
// Student t 0.975 quantiles for 1..30 degrees of freedom.
const T_975 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11,
  2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];

const SkillProbeCellOrder: ReadonlyArray<SkillProbeCell> = ["A", "B", "C"];
const MEASURES: ReadonlyArray<SkillProbeMeasure> = ["all-lanes", "lane-fraction", "turns", "wall-seconds"];
const CONTRASTS: ReadonlyArray<readonly [SkillProbeContrast, SkillProbeCell, SkillProbeCell]> = [
  ["C-B", "C", "B"],
  ["B-A", "B", "A"],
];

/**
 * Two-sided 95% Student t critical value; the normal value past 30 degrees of freedom.
 *
 * **Example** (Critical value for four clusters)
 *
 * ```ts
 * import { tCritical975 } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(tCritical975(3)) // 3.182
 * ```
 *
 * @param degreesOfFreedom - Degrees of freedom, at least 1 for a finite value.
 * @returns The 0.975 quantile, or 0 when there are no degrees of freedom.
 * @category statistics
 * @since 0.0.0
 */
export const tCritical975 = (degreesOfFreedom: number): number =>
  degreesOfFreedom < 1
    ? 0
    : pipe(
        A.get(T_975, degreesOfFreedom - 1),
        O.getOrElse(() => NORMAL_975)
      );

const mean = (values: ReadonlyArray<number>): number =>
  A.isReadonlyArrayNonEmpty(values) ? Num.sumAll(values) / A.length(values) : 0;

const sampleVariance = (values: ReadonlyArray<number>): number => {
  const n = A.length(values);
  if (n < 2) return 0;
  const center = mean(values);
  return Num.sumAll(A.map(values, (value) => (value - center) ** 2)) / (n - 1);
};

const makeEstimate = (n: number, center: number, standardError: number, critical: number): SkillProbeEstimate =>
  SkillProbeEstimate.make({
    n,
    mean: roundScore(center),
    standardError: roundScore(standardError),
    lower: roundScore(center - critical * standardError),
    upper: roundScore(center + critical * standardError),
  });

/**
 * Mean of values with `sd / sqrt(n)` and a caller-chosen critical value.
 *
 * **Example** (Normal interval over runs)
 *
 * ```ts
 * import { estimateMean } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(estimateMean([1, 0, 1, 1, 0], 1.96).mean) // 0.6
 * ```
 *
 * @param values - Observations.
 * @param critical - Critical value multiplying the standard error.
 * @returns The estimate; an empty input has n 0 and a zero-width interval at 0.
 * @category statistics
 * @since 0.0.0
 */
export const estimateMean: {
  (critical: number): (values: ReadonlyArray<number>) => SkillProbeEstimate;
  (values: ReadonlyArray<number>, critical: number): SkillProbeEstimate;
} = dual(2, (values: ReadonlyArray<number>, critical: number): SkillProbeEstimate => {
  const n = A.length(values);
  return makeEstimate(n, mean(values), n < 2 ? 0 : Math.sqrt(sampleVariance(values) / n), critical);
});

/**
 * Mean over clusters' members with the cluster-robust standard error and a
 * Student t interval on clusters minus one degrees of freedom.
 *
 * **Details**
 *
 * `SE = sqrt(G/(G-1) * sum_g (sum_{t in g} (d_t - d))^2) / T` (Miller 2024,
 * clustered questions). With one cluster the standard error is 0 and the
 * interval collapses; the caller reports that, not the decision.
 *
 * **Example** (Four families of three tasks)
 *
 * ```ts
 * import { estimateClusteredMean } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const estimate = estimateClusteredMean([
 *   { cluster: "a", value: 0.2 },
 *   { cluster: "a", value: 0 },
 *   { cluster: "b", value: 0.1 },
 *   { cluster: "b", value: 0.1 }
 * ])
 * console.log(estimate.mean) // 0.1
 * ```
 *
 * @param points - Values tagged with their cluster.
 * @returns Mean, cluster-robust standard error and Student t interval over the points.
 * @category statistics
 * @since 0.0.0
 */
export const estimateClusteredMean = (
  points: ReadonlyArray<{ readonly cluster: string; readonly value: number }>
): SkillProbeEstimate => {
  const total = A.length(points);
  const center = mean(A.map(points, (point) => point.value));
  const clusterSums = pipe(
    A.groupBy(points, (point) => point.cluster),
    R.values,
    A.map((members) => Num.sumAll(A.map(members, (point) => point.value - center)))
  );
  const clusters = A.length(clusterSums);
  const standardError =
    clusters < 2 || total === 0
      ? 0
      : Math.sqrt((clusters / (clusters - 1)) * Num.sumAll(A.map(clusterSums, (sum) => sum ** 2))) / total;
  return makeEstimate(total, center, standardError, tCritical975(clusters - 1));
};

const measureValue: Record<
  SkillProbeMeasure,
  (record: SkillProbeRunRecord, scored: typeof SkillProbeOutcome.cases.Scored.Type) => number
> = {
  "all-lanes": (_record, scored) => (scored.allLanesPass ? 1 : 0),
  "lane-fraction": (_record, scored) => scored.laneFraction,
  turns: (record) => record.turns,
  "wall-seconds": (record) => record.durationSeconds,
};

const measureOf = (record: SkillProbeRunRecord, measure: SkillProbeMeasure): O.Option<number> =>
  SkillProbeOutcome.guards.Scored(record.outcome) ? O.some(measureValue[measure](record, record.outcome)) : O.none();

type TaskDifference = {
  readonly taskId: string;
  readonly family: string;
  readonly contrast: SkillProbeContrast;
  readonly measure: SkillProbeMeasure;
  readonly value: number;
  readonly standardError: number;
};

const isCounted = (record: SkillProbeRunRecord): boolean => SkillProbeOutcome.guards.Scored(record.outcome);
const cellKey = (taskId: string, cell: SkillProbeCell): string => `${taskId}\u0000${cell}`;
const contrastMeasureKey = (diff: TaskDifference): string => `${diff.contrast}\u0000${diff.measure}`;
const familyKey = (diff: TaskDifference): string => diff.family;

const laneShare = (
  counted: ReadonlyArray<SkillProbeRunRecord>,
  passes: (scored: typeof SkillProbeOutcome.cases.Scored.Type) => boolean
): number =>
  A.isReadonlyArrayNonEmpty(counted)
    ? roundScore(
        A.length(
          A.filter(counted, (record) => SkillProbeOutcome.guards.Scored(record.outcome) && passes(record.outcome))
        ) / A.length(counted)
      )
    : 0;

const censusCell = (
  taskId: string,
  family: string,
  cell: SkillProbeCell,
  records: ReadonlyArray<SkillProbeRunRecord>
): SkillProbeLaneCensus => {
  const counted = A.filter(records, isCounted);
  return SkillProbeLaneCensus.make({
    taskId,
    family,
    cell,
    counted: A.length(counted),
    completion: laneShare(counted, (scored) => scored.report.breakdown.completion === 1),
    schemaFirst: laneShare(counted, (scored) => scored.report.breakdown.schemaFirst === 1),
    tsgo: laneShare(counted, (scored) => scored.report.breakdown.tsgo === 1),
    biome: laneShare(counted, (scored) => scored.report.breakdown.biome === 1),
    allLanes: laneShare(counted, (scored) => scored.allLanesPass),
  });
};

const summarizeCell = (
  taskId: string,
  family: string,
  cell: SkillProbeCell,
  records: ReadonlyArray<SkillProbeRunRecord>
): SkillProbeCellSummary => {
  const counted = A.filter(records, isCounted);
  const values = (measure: SkillProbeMeasure): ReadonlyArray<number> =>
    A.getSomes(A.map(counted, (record) => measureOf(record, measure)));
  return SkillProbeCellSummary.make({
    taskId,
    family,
    cell,
    counted: A.length(counted),
    excluded: A.length(records) - A.length(counted),
    fired: A.length(A.filter(counted, (record) => record.fired)),
    allLanes: estimateMean(values("all-lanes"), NORMAL_975),
    laneFraction: estimateMean(values("lane-fraction"), NORMAL_975),
    turns: estimateMean(values("turns"), NORMAL_975),
    wallSeconds: estimateMean(values("wall-seconds"), NORMAL_975),
  });
};

const taskDifferences = (
  tasks: ReadonlyArray<readonly [string, string]>,
  groups: Record<string, ReadonlyArray<SkillProbeRunRecord>>
): ReadonlyArray<TaskDifference> =>
  A.flatMap(tasks, ([taskId, family]) =>
    A.flatMap(CONTRASTS, ([contrast, later, earlier]) =>
      A.getSomes(
        A.map(MEASURES, (measure): O.Option<TaskDifference> => {
          const valuesFor = (cell: SkillProbeCell): ReadonlyArray<number> =>
            pipe(
              R.get(groups, cellKey(taskId, cell)),
              O.getOrElse(A.empty<SkillProbeRunRecord>),
              A.map((record) => measureOf(record, measure)),
              A.getSomes
            );
          const laterValues = valuesFor(later);
          const earlierValues = valuesFor(earlier);
          if (!A.isReadonlyArrayNonEmpty(laterValues) || !A.isReadonlyArrayNonEmpty(earlierValues)) return O.none();
          return O.some({
            taskId,
            family,
            contrast,
            measure,
            value: mean(laterValues) - mean(earlierValues),
            standardError: Math.sqrt(
              sampleVariance(laterValues) / A.length(laterValues) +
                sampleVariance(earlierValues) / A.length(earlierValues)
            ),
          });
        })
      )
    )
  );

const differenceRows = (diffs: ReadonlyArray<TaskDifference>): ReadonlyArray<SkillProbeDifference> => {
  const taskRows = A.map(diffs, (diff) => {
    const estimate = makeEstimate(1, diff.value, diff.standardError, NORMAL_975);
    return SkillProbeDifference.make({
      level: "task",
      scope: diff.taskId,
      contrast: diff.contrast,
      measure: diff.measure,
      families: 1,
      estimate,
      unclustered: estimate,
    });
  });
  const byContrastMeasure = A.groupBy(diffs, contrastMeasureKey);
  const familyRows = pipe(
    R.values(byContrastMeasure),
    A.flatMap((members) =>
      pipe(
        R.values(A.groupBy(members, familyKey)),
        A.map((familyMembers) => {
          const first = A.headNonEmpty(familyMembers);
          const estimate = estimateMean(
            A.map(familyMembers, (diff) => diff.value),
            tCritical975(A.length(familyMembers) - 1)
          );
          return SkillProbeDifference.make({
            level: "family",
            scope: first.family,
            contrast: first.contrast,
            measure: first.measure,
            families: 1,
            estimate,
            unclustered: estimate,
          });
        })
      )
    )
  );
  const overallRows = A.map(R.values(byContrastMeasure), (members) => {
    const first = A.headNonEmpty(members);
    return SkillProbeDifference.make({
      level: "overall",
      scope: "overall",
      contrast: first.contrast,
      measure: first.measure,
      families: A.length(A.dedupe(A.map(members, familyKey))),
      estimate: estimateClusteredMean(A.map(members, (diff) => ({ cluster: diff.family, value: diff.value }))),
      unclustered: estimateMean(
        A.map(members, (diff) => diff.value),
        tCritical975(A.length(members) - 1)
      ),
    });
  });
  return A.appendAll(A.appendAll(taskRows, familyRows), overallRows);
};

const verdictOf = (differences: ReadonlyArray<SkillProbeDifference>, sensitiveTasks: number): SkillProbeVerdict =>
  sensitiveTasks < SENSITIVE_TASK_FLOOR
    ? SkillProbeVerdict.cases.Insensitive.make({
        sensitiveTasks,
        reason: `${sensitiveTasks} counted tasks have an all-lanes pass among their B and C runs; the floor is ${SENSITIVE_TASK_FLOOR}.`,
      })
    : pipe(
        differences,
        A.findFirst((row) => row.level === "overall" && row.contrast === "C-B" && row.measure === "all-lanes"),
        O.match({
          onNone: () =>
            SkillProbeVerdict.cases.Null.make({
              difference: 0,
              lower: 0,
              harm: false,
              reason: "No task has counted B and C runs.",
            }),
          onSome: ({ estimate, families }) =>
            families < 2
              ? SkillProbeVerdict.cases.Null.make({
                  difference: estimate.mean,
                  lower: estimate.lower,
                  harm: false,
                  reason: `Only ${families} family contributes paired differences; the clustered interval is undefined.`,
                })
              : estimate.mean >= EFFECT_THRESHOLD && estimate.lower > 0
                ? SkillProbeVerdict.cases.Effect.make({ difference: estimate.mean, lower: estimate.lower })
                : SkillProbeVerdict.cases.Null.make({
                    difference: estimate.mean,
                    lower: estimate.lower,
                    harm: estimate.upper < 0,
                    reason:
                      estimate.mean < EFFECT_THRESHOLD
                        ? `C-B all-lanes ${estimate.mean} is below ${EFFECT_THRESHOLD}.`
                        : `The clustered interval's lower end ${estimate.lower} does not exclude zero.`,
                  }),
        })
      );

const fingerprintKey = (fingerprint: SkillProbeFingerprint): string =>
  `${fingerprint.modelId}|${fingerprint.claudeVersion}|${fingerprint.skillSha256}|${fingerprint.lawsSha256}`;

/**
 * Build the probe report from run records under the committed analysis rule.
 *
 * **Details**
 *
 * Excluded runs are counted but never scored. Pairing is at the task level:
 * each task's difference is the later cell's mean minus the earlier cell's
 * mean. The overall interval clusters tasks by family. The verdict reads the
 * overall C-B all-lanes difference; the fired-rate gate reads counted cell C
 * runs. Values are rounded to six decimals before any threshold comparison.
 *
 * **Example** (Report an empty probe)
 *
 * ```ts
 * import { buildSkillProbeReport } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(buildSkillProbeReport([]).verdict._tag) // "Null"
 * ```
 *
 * @param records - Run records from every cell.
 * @returns The report with summaries, differences, fired rate and verdict.
 * @category statistics
 * @since 0.0.0
 */
export const buildSkillProbeReport = (records: ReadonlyArray<SkillProbeRunRecord>): SkillProbeReport => {
  const groups = A.groupBy(records, (record) => cellKey(record.taskId, record.cell));
  const tasks = pipe(
    records,
    A.map((record) => [record.taskId, record.family] as const),
    A.dedupeWith(([left], [right]) => Eq.equals(left, right)),
    A.sort(Order.mapInput(Order.String, ([taskId]: readonly [string, string]) => taskId))
  );
  const cells = A.flatMap(tasks, ([taskId, family]) =>
    A.getSomes(
      A.map(SkillProbeCellOrder, (cell) =>
        O.map(R.get(groups, cellKey(taskId, cell)), (members) => summarizeCell(taskId, family, cell, members))
      )
    )
  );
  const laneCensus = A.flatMap(tasks, ([taskId, family]) =>
    A.getSomes(
      A.map(SkillProbeCellOrder, (cell) =>
        O.map(R.get(groups, cellKey(taskId, cell)), (members) => censusCell(taskId, family, cell, members))
      )
    )
  );
  const sensitiveTasks = A.length(
    A.filter(tasks, ([taskId]) =>
      A.some(
        records,
        (record) =>
          record.taskId === taskId &&
          record.cell !== "A" &&
          SkillProbeOutcome.guards.Scored(record.outcome) &&
          record.outcome.allLanesPass
      )
    )
  );
  const differences = differenceRows(taskDifferences(tasks, groups));
  const firedGroups = R.map(groups, (members) => A.filter(members, (record) => record.cell !== "C" || record.fired));
  const firedOnly = A.filter(
    differenceRows(taskDifferences(tasks, firedGroups)),
    (row) => row.level === "overall" && row.contrast === "C-B"
  );
  const countedC = A.filter(records, (record) => record.cell === "C" && isCounted(record));
  const firedRate = estimateMean(
    A.map(countedC, (record) => (record.fired ? 1 : 0)),
    NORMAL_975
  );
  const counted = A.length(A.filter(records, isCounted));
  return SkillProbeReport.make({
    schemaVersion: "skill-probe-report/v1",
    scorerProfile: pipe(
      A.head(records),
      O.map((record) => record.scorerProfile),
      O.getOrElse(() => "none")
    ),
    fingerprints: A.dedupeWith(
      A.map(records, (record): SkillProbeFingerprint => record.fingerprint),
      (left: SkillProbeFingerprint, right: SkillProbeFingerprint) => fingerprintKey(left) === fingerprintKey(right)
    ),
    countedRuns: counted,
    excludedRuns: A.length(records) - counted,
    cells,
    laneCensus,
    differences,
    firedOnly,
    firedRate,
    firedRateGate: A.isReadonlyArrayNonEmpty(countedC) && firedRate.mean < FIRED_RATE_GATE,
    verdict: verdictOf(differences, sensitiveTasks),
  });
};

/** Most tries of one planned run: the original and two reruns. */
const MAX_ATTEMPTS_PER_SLOT = 3;
/** Most scored-run attempts the probe may record, counted and excluded together. */
const MAX_SCORED_ATTEMPTS = 216;

const duplicatesOf = (keys: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(
    A.groupBy(keys, (key: string): string => key),
    R.values,
    A.filter((group) => A.length(group) > 1),
    A.map(A.headNonEmpty)
  );

const distinctValues = (values: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(A.dedupe(values), Order.String);

/**
 * Check run records against the analysis rule before they are pooled.
 *
 * **Details**
 *
 * Rejects duplicate run identities and kept directories, slots whose attempts
 * are not 1..n with only the last one scored, more than three attempts of a
 * slot or 216 attempts in all, records of tasks the preflight dropped, and a
 * mixture of scorer profiles, skill hashes, laws hashes or models. A Claude
 * Code version change is allowed and reported through the fingerprints.
 *
 * **Example** (Validate no records)
 *
 * ```ts
 * import { validateSkillProbeRecords } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(validateSkillProbeRecords([], [])) // []
 * ```
 *
 * @param records - Run records to pool.
 * @param droppedTasks - Task ids the preflight dropped.
 * @returns One message per problem; empty when the records may be pooled.
 * @category statistics
 * @since 0.0.0
 */
export const validateSkillProbeRecords: {
  (droppedTasks: ReadonlyArray<string>): (records: ReadonlyArray<SkillProbeRunRecord>) => ReadonlyArray<string>;
  (records: ReadonlyArray<SkillProbeRunRecord>, droppedTasks: ReadonlyArray<string>): ReadonlyArray<string>;
} = dual(
  2,
  (records: ReadonlyArray<SkillProbeRunRecord>, droppedTasks: ReadonlyArray<string>): ReadonlyArray<string> => {
    const identities = duplicatesOf(
      A.map(records, (record) => `${record.invocation}/${record.taskId}/${record.cell}/${record.runIndex}`)
    );
    const keptDirs = duplicatesOf(
      pipe(
        records,
        A.map((record) => record.keptDir),
        A.filter((dir) => dir !== "none")
      )
    );
    const slotAttempts = duplicatesOf(A.map(records, (record) => `${record.slot}@${record.attempt}`));
    const slotProblems = pipe(
      A.groupBy(records, (record): string => record.slot),
      R.values,
      A.flatMap((group) => {
        const ordered = A.sort(
          group,
          Order.mapInput(Order.Number, (record: SkillProbeRunRecord) => record.attempt)
        );
        const slot = A.headNonEmpty(group).slot;
        const attempts = A.map(ordered, (record) => record.attempt);
        const contiguous = A.every(attempts, (attempt, index) => attempt === index + 1);
        const earlyScored = A.some(A.dropRight(ordered, 1), (record) =>
          SkillProbeOutcome.guards.Scored(record.outcome)
        );
        return A.getSomes([
          contiguous
            ? O.none()
            : O.some(`Slot ${slot} has attempts ${A.join(A.map(attempts, String), ",")}, not 1..n.`),
          A.length(group) > MAX_ATTEMPTS_PER_SLOT
            ? O.some(`Slot ${slot} has ${A.length(group)} attempts; the cap is ${MAX_ATTEMPTS_PER_SLOT}.`)
            : O.none(),
          earlyScored ? O.some(`Slot ${slot} was rerun after a scored attempt.`) : O.none(),
        ]);
      })
    );
    const mixtures = A.getSomes(
      A.map(
        [
          ["scorer profiles", A.map(records, (record) => record.scorerProfile)],
          ["skill hashes", A.map(records, (record) => record.fingerprint.skillSha256)],
          ["laws hashes", A.map(records, (record) => record.fingerprint.lawsSha256)],
          ["models", A.map(records, (record) => record.fingerprint.modelId)],
        ] as const,
        ([label, values]) => {
          const distinct = distinctValues(values);
          return A.length(distinct) > 1 ? O.some(`Records mix ${label}: ${A.join(distinct, ", ")}.`) : O.none();
        }
      )
    );
    const dropped = distinctValues(
      pipe(
        records,
        A.filter((record) => A.contains(droppedTasks, record.taskId)),
        A.map((record) => record.taskId)
      )
    );
    return A.flatten([
      A.map(identities, (identity) => `Duplicate run identity ${identity}.`),
      A.map(keptDirs, (dir) => `Kept directory ${dir} is assigned to more than one record.`),
      A.map(slotAttempts, (slotAttempt) => `Duplicate slot attempt ${slotAttempt}.`),
      slotProblems,
      A.length(records) > MAX_SCORED_ATTEMPTS
        ? [`${A.length(records)} attempts exceed the cap of ${MAX_SCORED_ATTEMPTS}.`]
        : A.empty<string>(),
      mixtures,
      A.map(dropped, (taskId) => `Task ${taskId} was dropped by preflight but has records.`),
    ]);
  }
);
