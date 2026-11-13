/**
 * Schema contracts for the skill effect probe: harness input, run records and
 * the clustered paired-difference report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as S from "effect/Schema";
import { AgentEffectivenessEvalScoreReport } from "../AgentEffectiveness.schemas.ts";

const $I = $RepoCliId.create("commands/AgentEffectiveness/internal/SkillProbeSchemas");

const Count = S.Int.check(S.isGreaterThanOrEqualTo(0));
const NonNegative = S.Finite.check(S.isGreaterThanOrEqualTo(0));

/**
 * Probe cell: A is the archived prompt, B adds the Code Laws, C adds the skill to B.
 *
 * **Example** (Check a cell)
 *
 * ```ts
 * import { SkillProbeCell } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(SkillProbeCell.is.C("C")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillProbeCell = LiteralKit(["A", "B", "C"]).pipe(
  $I.annoteSchema("SkillProbeCell", {
    description: "Probe cell: A archived prompt, B prompt plus Code Laws, C as B with the skill available.",
  })
);

/**
 * Probe cell type.
 *
 * **Example** (Type a cell)
 *
 * ```ts
 * import type { SkillProbeCell } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const cell: SkillProbeCell = "B"
 * console.log(cell) // "B"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillProbeCell = typeof SkillProbeCell.Type;

/**
 * Paired contrast between two cells, later cell minus earlier cell.
 *
 * **Example** (Check a contrast)
 *
 * ```ts
 * import { SkillProbeContrast } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(SkillProbeContrast.is["C-B"]("C-B")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillProbeContrast = LiteralKit(["C-B", "B-A"]).pipe(
  $I.annoteSchema("SkillProbeContrast", {
    description: "Paired contrast between two cells: C-B is the production question, B-A the guidance response.",
  })
);

/**
 * Paired contrast type.
 *
 * **Example** (Type a contrast)
 *
 * ```ts
 * import type { SkillProbeContrast } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const contrast: SkillProbeContrast = "B-A"
 * console.log(contrast) // "B-A"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillProbeContrast = typeof SkillProbeContrast.Type;

/**
 * Per-run measure reported by the probe.
 *
 * **Example** (Check a measure)
 *
 * ```ts
 * import { SkillProbeMeasure } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(SkillProbeMeasure.is["all-lanes"]("all-lanes")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillProbeMeasure = LiteralKit(["all-lanes", "lane-fraction", "turns", "wall-seconds"]).pipe(
  $I.annoteSchema("SkillProbeMeasure", {
    description: "Per-run measure: all-lanes pass (primary), lane fraction, turns and wall seconds.",
  })
);

/**
 * Per-run measure type.
 *
 * **Example** (Type a measure)
 *
 * ```ts
 * import type { SkillProbeMeasure } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const measure: SkillProbeMeasure = "turns"
 * console.log(measure) // "turns"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillProbeMeasure = typeof SkillProbeMeasure.Type;

/**
 * One grader verdict from a `claude plugin eval` run.
 *
 * **Example** (Decode a grader verdict)
 *
 * ```ts
 * import { PluginEvalGraderResult } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const grader = PluginEvalGraderResult.make({ name: "skill-fired", passed: true })
 * console.log(grader.passed) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginEvalGraderResult extends S.Opaque<PluginEvalGraderResult, { readonly brand: unique symbol }>()(
  S.Struct({ name: S.String, passed: S.Boolean }).pipe(
    $I.annoteSchema("PluginEvalGraderResult", {
      description: "One grader verdict from a claude plugin eval run; unknown fields are ignored.",
    })
  )
) {}

/**
 * One agent run in a `claude plugin eval --json` result.
 *
 * **Details**
 *
 * `tracePath` is `<kept dir>/out/trace.jsonl`; it is the only field that ties
 * a run to the directory `--keep-temp` preserved.
 *
 * **Example** (Make a harness run)
 *
 * ```ts
 * import { PluginEvalRun } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const run = PluginEvalRun.make({
 *   turns: 9,
 *   costUsd: 0.12,
 *   durationSeconds: 30,
 *   startedAt: "2026-11-13T00:00:00.000Z",
 *   error: null,
 *   tracePath: "/kept/claude-eval-abc/out/trace.jsonl",
 *   graders: []
 * })
 * console.log(run.turns) // 9
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginEvalRun extends S.Opaque<PluginEvalRun, { readonly brand: unique symbol }>()(
  S.Struct({
    turns: Count,
    costUsd: NonNegative,
    durationSeconds: NonNegative,
    startedAt: S.String,
    error: S.NullOr(S.String),
    tracePath: S.String,
    graders: ArrayKeyDefaultEmpty(PluginEvalGraderResult),
  }).pipe(
    $I.annoteSchema("PluginEvalRun", {
      description: "One agent run in a claude plugin eval JSON result; tracePath locates its kept directory.",
    })
  )
) {}

/**
 * One case in a `claude plugin eval --json` result with its runs per arm.
 *
 * **Example** (Make a harness case)
 *
 * ```ts
 * import { PluginEvalCase } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const evalCase = PluginEvalCase.make({ name: "task-a", arms: {} })
 * console.log(evalCase.name) // "task-a"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginEvalCase extends S.Opaque<PluginEvalCase, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    arms: S.Struct({
      with: PluginEvalRun.pipe(S.Array, S.optionalKey),
      without: PluginEvalRun.pipe(S.Array, S.optionalKey),
    }),
  }).pipe(
    $I.annoteSchema("PluginEvalCase", {
      description: "One case in a claude plugin eval JSON result with its runs per arm.",
    })
  )
) {}

/**
 * The parts of a `claude plugin eval --json` result the probe reads.
 *
 * **Example** (Make a harness result)
 *
 * ```ts
 * import { PluginEvalResult } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const result = PluginEvalResult.make({
 *   claudeVersion: "2.1.323",
 *   suite: { ablation: "none", modelOverride: "claude-opus-5-5" },
 *   cases: []
 * })
 * console.log(result.claudeVersion) // "2.1.323"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginEvalResult extends S.Opaque<PluginEvalResult, { readonly brand: unique symbol }>()(
  S.Struct({
    claudeVersion: S.NonEmptyString,
    suite: S.Struct({ ablation: S.String, modelOverride: S.NullOr(S.String) }),
    cases: S.Array(PluginEvalCase),
  }).pipe(
    $I.annoteSchema("PluginEvalResult", {
      description: "The fields of a claude plugin eval JSON result that tie runs to cases, arms and kept directories.",
    })
  )
) {}

/**
 * Staging receipt for one probe suite: what was hashed and which tasks it holds.
 *
 * **Example** (Make a stage receipt)
 *
 * ```ts
 * import { SkillProbeStage } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const stage = SkillProbeStage.make({
 *   schemaVersion: "skill-probe-stage/v1",
 *   skillSha256: "a".repeat(64),
 *   lawsSha256: "b".repeat(64),
 *   tasks: [{ id: "sfv4-normalization-003", family: "normalization", fixture: "goals/x", taskPath: "goals/x.json" }]
 * })
 * console.log(stage.tasks.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbeStage extends S.Opaque<SkillProbeStage, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("skill-probe-stage/v1"),
    skillSha256: Sha256Hex,
    lawsSha256: Sha256Hex,
    tasks: S.Array(
      S.Struct({
        id: S.NonEmptyString,
        family: S.NonEmptyString,
        fixture: S.NonEmptyString,
        taskPath: S.NonEmptyString,
      })
    ),
  }).pipe(
    $I.annoteSchema("SkillProbeStage", {
      description: "Staging receipt for one probe suite: skill and laws hashes and the staged tasks.",
    })
  )
) {}

/**
 * Fingerprint carried by every probe run record.
 *
 * **Example** (Make a fingerprint)
 *
 * ```ts
 * import { SkillProbeFingerprint } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const fingerprint = SkillProbeFingerprint.make({
 *   modelId: "claude-opus-5-5",
 *   claudeVersion: "2.1.323",
 *   skillSha256: "a".repeat(64),
 *   lawsSha256: "b".repeat(64)
 * })
 * console.log(fingerprint.modelId) // "claude-opus-5-5"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbeFingerprint extends S.Opaque<SkillProbeFingerprint, { readonly brand: unique symbol }>()(
  S.Struct({
    modelId: S.NonEmptyString,
    claudeVersion: S.NonEmptyString,
    skillSha256: Sha256Hex,
    lawsSha256: Sha256Hex,
  }).pipe(
    $I.annoteSchema("SkillProbeFingerprint", {
      description: "Model id, Claude Code version, skill content hash and laws text hash for one run.",
    })
  )
) {}

/**
 * Scored or excluded outcome of one probe run.
 *
 * **Example** (Make an excluded outcome)
 *
 * ```ts
 * import { SkillProbeOutcome } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const outcome = SkillProbeOutcome.cases.Excluded.make({ reason: "rate limit" })
 * console.log(outcome._tag) // "Excluded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillProbeOutcome = S.TaggedUnion({
  Scored: { report: AgentEffectivenessEvalScoreReport, allLanesPass: S.Boolean, laneFraction: NonNegative },
  Excluded: { reason: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("SkillProbeOutcome", {
    description: "Scored law-scorer outcome of a run, or the reason the analysis rule excludes it.",
  })
);

/**
 * Scored or excluded outcome type.
 *
 * **Example** (Type an outcome)
 *
 * ```ts
 * import { SkillProbeOutcome } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const outcome: SkillProbeOutcome = SkillProbeOutcome.cases.Excluded.make({ reason: "overloaded" })
 * console.log(outcome.reason) // "overloaded"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillProbeOutcome = typeof SkillProbeOutcome.Type;

/**
 * One probe run tied to its task, cell, harness invocation and kept directory.
 *
 * **Details**
 *
 * `keptDir` is the kept directory's basename, never an absolute path, so
 * records can be committed to a public repository. `slot` names the planned
 * run a record fills (`<task>#<cell>#<n>`) and `attempt` counts tries of that
 * slot: a rerun of an excluded run is the same slot with the next attempt.
 *
 * **Example** (Make a run record)
 *
 * ```ts
 * import { SkillProbeFingerprint, SkillProbeOutcome, SkillProbeRunRecord } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const record = SkillProbeRunRecord.make({
 *   schemaVersion: "skill-probe-run/v1",
 *   taskId: "sfv4-normalization-003",
 *   family: "normalization",
 *   cell: "C",
 *   invocation: "p2-laws-1",
 *   runIndex: 0,
 *   slot: "sfv4-normalization-003#C#0",
 *   attempt: 1,
 *   keptDir: "claude-eval-abc",
 *   scorerProfile: "skill-probe-scorer/v2",
 *   fingerprint: SkillProbeFingerprint.make({
 *     modelId: "claude-opus-5-5",
 *     claudeVersion: "2.1.323",
 *     skillSha256: "a".repeat(64),
 *     lawsSha256: "b".repeat(64)
 *   }),
 *   fired: true,
 *   anySkillFired: true,
 *   turns: 11,
 *   durationSeconds: 48,
 *   costUsd: 0.22,
 *   startedAt: "2026-11-13T00:00:00.000Z",
 *   outcome: SkillProbeOutcome.cases.Excluded.make({ reason: "rate limit" })
 * })
 * console.log(record.cell) // "C"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbeRunRecord extends S.Opaque<SkillProbeRunRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("skill-probe-run/v1"),
    taskId: S.NonEmptyString,
    family: S.NonEmptyString,
    cell: SkillProbeCell,
    invocation: S.NonEmptyString,
    runIndex: Count,
    slot: S.NonEmptyString,
    attempt: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    keptDir: S.NonEmptyString,
    scorerProfile: S.NonEmptyString,
    fingerprint: SkillProbeFingerprint,
    fired: S.Boolean,
    anySkillFired: S.Boolean,
    turns: Count,
    durationSeconds: NonNegative,
    costUsd: NonNegative,
    startedAt: S.String,
    outcome: SkillProbeOutcome,
  }).pipe(
    $I.annoteSchema("SkillProbeRunRecord", {
      description: "One probe run tied to its task, cell, harness invocation, run index and kept directory.",
    })
  )
) {}

/**
 * A mean with its standard error and 95% interval.
 *
 * **Example** (Make an estimate)
 *
 * ```ts
 * import { SkillProbeEstimate } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const estimate = SkillProbeEstimate.make({ n: 5, mean: 0.4, standardError: 0.2, lower: 0, upper: 0.8 })
 * console.log(estimate.mean) // 0.4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbeEstimate extends S.Opaque<SkillProbeEstimate, { readonly brand: unique symbol }>()(
  S.Struct({ n: Count, mean: S.Finite, standardError: NonNegative, lower: S.Finite, upper: S.Finite }).pipe(
    $I.annoteSchema("SkillProbeEstimate", {
      description: "A mean over n values with its standard error and 95% interval.",
    })
  )
) {}

/**
 * Per task and cell summary of counted runs.
 *
 * **Example** (Read a cell summary field)
 *
 * ```ts
 * import { SkillProbeCellSummary } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(Object.keys(SkillProbeCellSummary.fields).includes("allLanes")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbeCellSummary extends S.Opaque<SkillProbeCellSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    taskId: S.NonEmptyString,
    family: S.NonEmptyString,
    cell: SkillProbeCell,
    counted: Count,
    excluded: Count,
    fired: Count,
    allLanes: SkillProbeEstimate,
    laneFraction: SkillProbeEstimate,
    turns: SkillProbeEstimate,
    wallSeconds: SkillProbeEstimate,
  }).pipe(
    $I.annoteSchema("SkillProbeCellSummary", {
      description: "Counted, excluded and fired runs with the four measures for one task and cell.",
    })
  )
) {}

/**
 * A paired difference at task, family or overall scope.
 *
 * **Details**
 *
 * `scope` is a task id, a family name or `overall`. Overall differences carry
 * the family-clustered interval in `estimate` and the unclustered one in
 * `unclustered`; task and family differences repeat `estimate` there.
 * `families` counts the families that contribute; the clustered interval is
 * undefined below two and no verdict reads it then.
 *
 * **Example** (Read a difference field)
 *
 * ```ts
 * import { SkillProbeDifference } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(Object.keys(SkillProbeDifference.fields).includes("unclustered")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbeDifference extends S.Opaque<SkillProbeDifference, { readonly brand: unique symbol }>()(
  S.Struct({
    level: LiteralKit(["task", "family", "overall"]),
    scope: S.NonEmptyString,
    contrast: SkillProbeContrast,
    measure: SkillProbeMeasure,
    families: Count,
    estimate: SkillProbeEstimate,
    unclustered: SkillProbeEstimate,
  }).pipe(
    $I.annoteSchema("SkillProbeDifference", {
      description: "Paired difference of one measure at task, family or overall level with its interval.",
    })
  )
) {}

/**
 * Verdict against the decision rule.
 *
 * **Example** (Make a null verdict)
 *
 * ```ts
 * import { SkillProbeVerdict } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const verdict = SkillProbeVerdict.cases.Null.make({
 *   difference: 0.02,
 *   lower: -0.1,
 *   harm: false,
 *   reason: "below threshold"
 * })
 * console.log(verdict._tag) // "Null"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillProbeVerdict = S.TaggedUnion({
  Insensitive: { sensitiveTasks: Count, reason: S.NonEmptyString },
  Effect: { difference: S.Finite, lower: S.Finite },
  Null: { difference: S.Finite, lower: S.Finite, harm: S.Boolean, reason: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("SkillProbeVerdict", {
    description:
      "Insensitive when too few tasks pass all lanes in B or C; else Effect when C-B all-lanes meets the threshold with a clustered lower bound above zero; else Null, flagged as harm when the interval lies below zero.",
  })
);

/**
 * Verdict type.
 *
 * **Example** (Type a verdict)
 *
 * ```ts
 * import { SkillProbeVerdict } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const verdict: SkillProbeVerdict = SkillProbeVerdict.cases.Effect.make({ difference: 0.2, lower: 0.05 })
 * console.log(verdict.difference) // 0.2
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillProbeVerdict = typeof SkillProbeVerdict.Type;

/**
 * Share of a task and cell's counted runs that scored 1 on each lane.
 *
 * **Example** (Read a lane census field)
 *
 * ```ts
 * import { SkillProbeLaneCensus } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(Object.keys(SkillProbeLaneCensus.fields).includes("tsgo")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbeLaneCensus extends S.Opaque<SkillProbeLaneCensus, { readonly brand: unique symbol }>()(
  S.Struct({
    taskId: S.NonEmptyString,
    family: S.NonEmptyString,
    cell: SkillProbeCell,
    counted: Count,
    completion: NonNegative,
    schemaFirst: NonNegative,
    tsgo: NonNegative,
    biome: NonNegative,
    allLanes: NonNegative,
  }).pipe(
    $I.annoteSchema("SkillProbeLaneCensus", {
      description: "Share of a task and cell's counted runs that scored 1 on each lane and on all lanes.",
    })
  )
) {}

/**
 * The probe report: cell summaries, paired differences and the verdict.
 *
 * **Example** (Read a report field)
 *
 * ```ts
 * import { SkillProbeReport } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(Object.keys(SkillProbeReport.fields).includes("verdict")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbeReport extends S.Opaque<SkillProbeReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("skill-probe-report/v1"),
    scorerProfile: S.NonEmptyString,
    fingerprints: S.Array(SkillProbeFingerprint),
    countedRuns: Count,
    excludedRuns: Count,
    cells: S.Array(SkillProbeCellSummary),
    laneCensus: S.Array(SkillProbeLaneCensus),
    differences: S.Array(SkillProbeDifference),
    firedOnly: S.Array(SkillProbeDifference),
    firedRate: SkillProbeEstimate,
    firedRateGate: S.Boolean,
    verdict: SkillProbeVerdict,
  }).pipe(
    $I.annoteSchema("SkillProbeReport", {
      description: "Cell summaries, paired differences, fired rate and the verdict against the decision rule.",
    })
  )
) {}

/**
 * Preflight result for one task: the untouched fixture and the known-good solution.
 *
 * **Details**
 *
 * A task passes when the untouched fixture is not all-lanes clean and misses
 * its completion contract, and the known-good solution scores 1 on every lane.
 *
 * **Example** (Read a preflight row field)
 *
 * ```ts
 * import { SkillProbePreflightRow } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(Object.keys(SkillProbePreflightRow.fields).includes("passed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbePreflightRow extends S.Opaque<SkillProbePreflightRow, { readonly brand: unique symbol }>()(
  S.Struct({
    taskId: S.NonEmptyString,
    family: S.NonEmptyString,
    fixture: AgentEffectivenessEvalScoreReport,
    knownGood: S.OptionFromNullOr(AgentEffectivenessEvalScoreReport),
    knownGoodFiles: S.Array(S.Struct({ path: S.NonEmptyString, sha256: Sha256Hex })),
    passed: S.Boolean,
    reason: S.String,
  }).pipe(
    $I.annoteSchema("SkillProbePreflightRow", {
      description: "Scorer reports for one task's untouched fixture and known-good solution, with the verdict.",
    })
  )
) {}

/**
 * Preflight receipt for every staged task.
 *
 * **Example** (Read a preflight field)
 *
 * ```ts
 * import { SkillProbePreflight } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(Object.keys(SkillProbePreflight.fields).includes("dropped")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbePreflight extends S.Opaque<SkillProbePreflight, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("skill-probe-preflight/v1"),
    rows: S.Array(SkillProbePreflightRow),
    dropped: S.Array(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("SkillProbePreflight", {
      description: "Preflight rows for every staged task and the tasks that failed and are dropped.",
    })
  )
) {}
