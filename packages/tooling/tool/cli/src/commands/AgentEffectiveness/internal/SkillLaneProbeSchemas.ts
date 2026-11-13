/**
 * Schema contracts for the skill lane probe: lane fraction as the primary, a
 * within-task permutation test, a fixed-task interval and the four-outcome
 * verdict of `goals/skill-lane-probe/SPEC.md`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import {
  SkillProbeCellSummary,
  SkillProbeDifference,
  SkillProbeEstimate,
  SkillProbeFingerprint,
  SkillProbeLaneCensus,
} from "./SkillProbeSchemas.ts";

const $I = $RepoCliId.create("commands/AgentEffectiveness/internal/SkillLaneProbeSchemas");

const Count = S.Int.check(S.isGreaterThanOrEqualTo(0));
const Probability = S.Finite.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(1));
const LaneFraction = S.Finite.check(S.isGreaterThanOrEqualTo(0));
const Relabelings = S.Int.check(S.isGreaterThanOrEqualTo(1));

/**
 * Primary measure a probe report reads: the pass candidates of the first
 * probe, or the lane fraction of the lane probe.
 *
 * **Example** (Check a report primary)
 *
 * ```ts
 * import { SkillProbeReportPrimary } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(SkillProbeReportPrimary.is["lane-fraction"]("lane-fraction")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillProbeReportPrimary = LiteralKit(["all-lanes", "law-pass", "lane-fraction"]).pipe(
  $I.annoteSchema("SkillProbeReportPrimary", {
    description:
      "Primary a probe report reads: all-lanes or law pass under the first probe's rule, lane fraction under the lane probe's rule.",
  })
);

/**
 * Report primary type.
 *
 * **Example** (Type a report primary)
 *
 * ```ts
 * import type { SkillProbeReportPrimary } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const primary: SkillProbeReportPrimary = "lane-fraction"
 * console.log(primary) // "lane-fraction"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillProbeReportPrimary = typeof SkillProbeReportPrimary.Type;

/**
 * Whether a lane report reads scored runs or pilot runs that decide nothing.
 *
 * **Example** (Check a data label)
 *
 * ```ts
 * import { SkillLaneProbeData } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(SkillLaneProbeData.is.pilot("pilot")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillLaneProbeData = LiteralKit(["pilot", "scored"]).pipe(
  $I.annoteSchema("SkillLaneProbeData", {
    description: "pilot: the report decides nothing and carries no verdict; scored: the verdict is read.",
  })
);

/**
 * Data label type.
 *
 * **Example** (Type a data label)
 *
 * ```ts
 * import type { SkillLaneProbeData } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const data: SkillLaneProbeData = "scored"
 * console.log(data) // "scored"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillLaneProbeData = typeof SkillLaneProbeData.Type;

/**
 * One task's counted lane fractions per cell, the unit the permutation test
 * relabels.
 *
 * **Example** (Make a task's values)
 *
 * ```ts
 * import { SkillLaneTaskValues } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const task = SkillLaneTaskValues.make({ taskId: "a", family: "f", valuesB: [0.2, 0.4], valuesC: [0.6, 0.8] })
 * console.log(task.valuesC.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillLaneTaskValues extends S.Opaque<SkillLaneTaskValues, { readonly brand: unique symbol }>()(
  S.Struct({
    taskId: S.NonEmptyString,
    family: S.NonEmptyString,
    valuesB: S.Array(LaneFraction),
    valuesC: S.Array(LaneFraction),
  }).pipe(
    $I.annoteSchema("SkillLaneTaskValues", {
      description: "A task's family and the lane fractions of its counted runs in cells B and C.",
    })
  )
) {}

/**
 * Overall and per-family permutation p-values for lane-fraction differences.
 *
 * **Example** (Make a permutation result)
 *
 * ```ts
 * import { SkillLanePermutationResult } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const result = SkillLanePermutationResult.make({ pValue: 0.2, familyPValues: { f: 0.4 } })
 * console.log(result.familyPValues.f) // 0.4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillLanePermutationResult extends S.Opaque<
  SkillLanePermutationResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    pValue: Probability,
    familyPValues: S.Record(S.String, Probability),
  }).pipe(
    $I.annoteSchema("SkillLanePermutationResult", {
      description: "Two-sided permutation p-value of the overall difference and one p-value per family.",
    })
  )
) {}

/**
 * Options for a lane probe report.
 *
 * **Example** (Make pilot options)
 *
 * ```ts
 * import { SkillLaneProbeOptions } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const options = SkillLaneProbeOptions.make({ data: "pilot", seed: 20261113, relabelings: 100000 })
 * console.log(options.data) // "pilot"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillLaneProbeOptions extends S.Opaque<SkillLaneProbeOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    data: SkillLaneProbeData,
    seed: S.Int,
    relabelings: Relabelings,
  }).pipe(
    $I.annoteSchema("SkillLaneProbeOptions", {
      description: "Data label, permutation seed and relabeling count of a lane probe report.",
    })
  )
) {}

/**
 * One task's lane-fraction difference, C minus B, over its counted runs.
 *
 * **Details**
 *
 * `standardError` is `sqrt(var_C/n_C + var_B/n_B)` with sample variances over
 * runs; a cell with one run contributes no variance.
 *
 * **Example** (Read a task row field)
 *
 * ```ts
 * import { SkillLaneProbeTask } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(Object.keys(SkillLaneProbeTask.fields).includes("difference")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillLaneProbeTask extends S.Opaque<SkillLaneProbeTask, { readonly brand: unique symbol }>()(
  S.Struct({
    taskId: S.NonEmptyString,
    family: S.NonEmptyString,
    countedB: Count,
    countedC: Count,
    meanB: S.Finite,
    meanC: S.Finite,
    difference: S.Finite,
    standardError: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
  }).pipe(
    $I.annoteSchema("SkillLaneProbeTask", {
      description: "Counted runs, cell means and the C minus B lane-fraction difference of one task.",
    })
  )
) {}

/**
 * The within-task permutation test of the overall difference.
 *
 * **Example** (Make a test result)
 *
 * ```ts
 * import { SkillLanePermutationTest } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const test = SkillLanePermutationTest.make({ seed: 20261113, relabelings: 100000, pValue: 0.2, detected: false })
 * console.log(test.detected) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillLanePermutationTest extends S.Opaque<SkillLanePermutationTest, { readonly brand: unique symbol }>()(
  S.Struct({
    seed: S.Int,
    relabelings: Relabelings,
    pValue: Probability,
    detected: S.Boolean,
  }).pipe(
    $I.annoteSchema("SkillLanePermutationTest", {
      description:
        "Seed, relabeling count and two-sided p-value of the within-task permutation test; detected when p < 0.05.",
    })
  )
) {}

/**
 * One family's difference with its permutation p-value and Holm adjustment.
 *
 * **Details**
 *
 * `keep` marks a family whose adjusted p-value is below 0.05 with a positive
 * difference: on a Null, the prune proposal names it as guidance to keep.
 *
 * **Example** (Read a family test field)
 *
 * ```ts
 * import { SkillLaneFamilyTest } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(Object.keys(SkillLaneFamilyTest.fields).includes("adjustedPValue")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillLaneFamilyTest extends S.Opaque<SkillLaneFamilyTest, { readonly brand: unique symbol }>()(
  S.Struct({
    family: S.NonEmptyString,
    tasks: Count,
    difference: S.Finite,
    pValue: Probability,
    adjustedPValue: Probability,
    keep: S.Boolean,
  }).pipe(
    $I.annoteSchema("SkillLaneFamilyTest", {
      description:
        "A family's mean task difference, its permutation p-value, the Holm-adjusted p-value and the keep flag.",
    })
  )
) {}

/**
 * Verdict against the lane probe's Decision Rule, checked in tag order.
 *
 * **Example** (Make a null verdict)
 *
 * ```ts
 * import { SkillLaneProbeVerdict } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const verdict = SkillLaneProbeVerdict.cases.Null.make({ difference: 0.01, pValue: 0.4, harm: false })
 * console.log(verdict._tag) // "Null"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillLaneProbeVerdict = S.TaggedUnion({
  Incomplete: { completeTasks: Count, required: Count, missing: S.Array(S.NonEmptyString) },
  Effect: { difference: S.Finite, pValue: Probability },
  SmallEffect: { difference: S.Finite, pValue: Probability },
  Null: { difference: S.Finite, pValue: Probability, harm: S.Boolean },
}).pipe(
  $I.annoteSchema("SkillLaneProbeVerdict", {
    description:
      "Incomplete when fewer than 10 tasks have 5 counted runs in both cells; Effect when detected and D >= 0.10; SmallEffect when detected and 0 < D < 0.10; else Null, flagged as harm when detected below zero.",
  })
);

/**
 * Lane probe verdict type.
 *
 * **Example** (Type a verdict)
 *
 * ```ts
 * import { SkillLaneProbeVerdict } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const verdict: SkillLaneProbeVerdict = SkillLaneProbeVerdict.cases.Effect.make({ difference: 0.2, pValue: 0.001 })
 * console.log(verdict.difference) // 0.2
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillLaneProbeVerdict = typeof SkillLaneProbeVerdict.Type;

/**
 * The lane probe report: the primary with its test and interval, the
 * secondary measures, and the verdict on scored data.
 *
 * **Details**
 *
 * `difference` is `D` with the fixed-task interval `D ± 1.96 * SE`;
 * `clustered` is the first probe's family-clustered interval on the same
 * task differences, reported as a generalisation line. `secondary` holds the
 * overall C minus B rows of every measure, `firedOnly` the same over fired
 * cell C runs. A pilot report has no verdict.
 *
 * **Example** (Read a lane report field)
 *
 * ```ts
 * import { SkillLaneProbeReport } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(Object.keys(SkillLaneProbeReport.fields).includes("test")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillLaneProbeReport extends S.Opaque<SkillLaneProbeReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("skill-lane-probe-report/v1"),
    data: SkillLaneProbeData,
    note: S.NonEmptyString,
    primary: S.tag("lane-fraction"),
    scorerProfile: S.NonEmptyString,
    fingerprints: S.Array(SkillProbeFingerprint),
    attempts: Count,
    countedRuns: Count,
    excludedRuns: Count,
    completeTasks: Count,
    tasks: S.Array(SkillLaneProbeTask),
    difference: SkillProbeEstimate,
    test: SkillLanePermutationTest,
    families: S.Array(SkillLaneFamilyTest),
    clustered: SkillProbeEstimate,
    secondary: S.Array(SkillProbeDifference),
    firedOnly: S.Array(SkillProbeDifference),
    cells: S.Array(SkillProbeCellSummary),
    laneCensus: S.Array(SkillProbeLaneCensus),
    firedRate: SkillProbeEstimate,
    firedRateGate: S.Boolean,
    verdict: S.OptionFromNullOr(SkillLaneProbeVerdict),
  }).pipe(
    $I.annoteSchema("SkillLaneProbeReport", {
      description:
        "Lane-fraction difference with its permutation test, fixed-task and clustered intervals, family tests, secondary measures and the verdict.",
    })
  )
) {}
