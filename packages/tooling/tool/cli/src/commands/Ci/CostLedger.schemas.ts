/**
 * Schemas for the per-check cost ledger (`beep ci ledger`, MEAS-05).
 *
 * **Details**
 *
 * The ledger folds a workflow run's hosted jobs into rows at
 * (lane, partition) grain: a lane's reporting or aggregate job is one `lane`
 * row and each partition job is one `partition` row, so every job's minutes
 * land in exactly one row. Jobs outside every lane are `support` or
 * `unknown` minutes, never dropped. The capture schemas are the wire shapes
 * the live reader writes and the committed fixtures replay, so a replay and a
 * live run go through the same fold.
 *
 * The ledger is attribution evidence only. A row carries two separate,
 * optional digests (`hostedDigest`, `localDigest`) that are never compared
 * and have no derived equality, so the ledger cannot stand in for hosted and
 * local outcome parity. Sources the fold does not join yet are reported as
 * `absent` rows ({@link CiLedgerSourceRow}) instead of reading as zero.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CiLaneId } from "./CiLane.ts";
import { CiWorkflowJob, CiWorkflowPartialRead, CiWorkflowWindowRun } from "./LaneTimings.ts";

const $I = $RepoCliId.create("commands/Ci/CostLedger.schemas");

const NonNegativeInt = S.Int.check(S.isGreaterThanOrEqualTo(0));
const Share = S.Finite.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(1));

/**
 * A source the cost ledger reads or names as not yet joined.
 *
 * **Details**
 *
 * `hosted-jobs` is the per-attempt jobs listing of each run and `test-plan`
 * the run's `Test Plan` output (with the catch-all partition's own selection
 * line), the join behind the empty-leg row. `turbo-tasks` (MEAS-06),
 * `final-check` (MEAS-07 journals), `economics` (local Yeet attempt lanes) and
 * `psi` (MEAS-08) are the local and per-task sources the fold does not join
 * yet; they appear as `absent` rows.
 *
 * **Example** (List the ledger sources)
 *
 * ```ts
 * import { CiLedgerSourceKind } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiLedgerSourceKind.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiLedgerSourceKind = LiteralKit([
  "hosted-jobs",
  "test-plan",
  "turbo-tasks",
  "final-check",
  "economics",
  "psi",
]).pipe(
  $I.annoteSchema("CiLedgerSourceKind", {
    description: "A source the per-check cost ledger reads, or names as not yet joined.",
  })
);

/**
 * Type of {@link CiLedgerSourceKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type CiLedgerSourceKind = typeof CiLedgerSourceKind.Type;

/**
 * How much of a source the ledger read.
 *
 * **Details**
 *
 * `present`: read for every run. `partial`: read for some runs, or a read
 * failed for some attempt. `absent`: read for no run, including every source
 * the fold does not join yet.
 *
 * **Example** (Guard a source status)
 *
 * ```ts
 * import { CiLedgerSourceStatus } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiLedgerSourceStatus.is.absent("absent")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiLedgerSourceStatus = LiteralKit(["present", "partial", "absent"]).pipe(
  $I.annoteSchema("CiLedgerSourceStatus", {
    description: "present: read for every run; partial: for some runs or attempts; absent: for none.",
  })
);

/**
 * Type of {@link CiLedgerSourceStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type CiLedgerSourceStatus = typeof CiLedgerSourceStatus.Type;

/**
 * The lanes whose partitions `Test Plan` allocates.
 *
 * **Example** (Guard a planned lane)
 *
 * ```ts
 * import { CiLedgerPlannedLane } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiLedgerPlannedLane.is["test-unit"]("test-unit")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiLedgerPlannedLane = LiteralKit(["test-unit", "test-integration"]).pipe(
  $I.annoteSchema("CiLedgerPlannedLane", {
    description: "A lane whose partition jobs check.yml's Test Plan job allocates.",
  })
);

/**
 * Type of {@link CiLedgerPlannedLane}.
 *
 * @category models
 * @since 0.0.0
 */
export type CiLedgerPlannedLane = typeof CiLedgerPlannedLane.Type;

/**
 * Whether a planned partition job had tasks to run.
 *
 * **Details**
 *
 * `selected`: the partition's own selection line counts tasks, or the plan
 * allocated it because its packages were selected. `empty`: its selection
 * line counts no task, or its lane's plan selected no task at all (an empty
 * leg). `undetermined`: neither source can say, which is the catch-all
 * partition the plan always allocates when its own line was not read.
 *
 * **Example** (Guard an empty leg)
 *
 * ```ts
 * import { CiLedgerLegTasks } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiLedgerLegTasks.is.empty("empty")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiLedgerLegTasks = LiteralKit(["selected", "empty", "undetermined"]).pipe(
  $I.annoteSchema("CiLedgerLegTasks", {
    description: "selected: the partition had tasks; empty: none (an empty leg); undetermined: no source can say.",
  })
);

/**
 * Type of {@link CiLedgerLegTasks}.
 *
 * @category models
 * @since 0.0.0
 */
export type CiLedgerLegTasks = typeof CiLedgerLegTasks.Type;

/**
 * The grain of one ledger row.
 *
 * **Details**
 *
 * `lane`: a lane's own job, its reporting job or the aggregate that checks
 * its partitions (the umbrella). `partition`: one partition job. A lane's
 * minutes are the sum of its rows, so the umbrella is counted once, beside
 * its partitions, and never instead of or on top of them.
 *
 * **Example** (Guard a partition row)
 *
 * ```ts
 * import { CiLedgerGrain } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiLedgerGrain.is.partition("partition")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiLedgerGrain = LiteralKit(["lane", "partition"]).pipe(
  $I.annoteSchema("CiLedgerGrain", {
    description: "lane: a lane's reporting or aggregate job; partition: one partition job.",
  })
);

/**
 * Type of {@link CiLedgerGrain}.
 *
 * @category models
 * @since 0.0.0
 */
export type CiLedgerGrain = typeof CiLedgerGrain.Type;

/**
 * One lane's line of a run's `Test Plan` output.
 *
 * **Details**
 *
 * `partitions` is the published plan (`test_unit: 3 of 24 partitions: …`).
 * `selectedTasks` and `laneTasks` come from the plan step's own line,
 * `[ci] test-integration plan: 1 partition(s) for 0 selected task(s) of 24`,
 * which only pull-request runs print; a push run plans every partition and
 * leaves both absent.
 *
 * **Example** (A plan that selected no integration task)
 *
 * ```ts
 * import { CiLedgerLanePlan } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const plan = CiLedgerLanePlan.make({
 *   lane: "test-integration",
 *   laneTasks: O.some(24),
 *   partitions: ["int-rest"],
 *   selectedTasks: O.some(0),
 * })
 * console.log(plan.partitions)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLedgerLanePlan extends S.Opaque<CiLedgerLanePlan, { readonly brand: unique symbol }>()(
  S.Struct({
    lane: CiLedgerPlannedLane,
    laneTasks: NonNegativeInt.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    partitions: S.Array(S.NonEmptyString),
    selectedTasks: NonNegativeInt.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("CiLedgerLanePlan", {
      description: "One lane's published Test Plan partitions with the plan step's selected and lane task counts.",
    })
  )
) {}

/**
 * The `Test Plan` output of one run.
 *
 * **Example** (A plan for one lane)
 *
 * ```ts
 * import { CiLedgerLanePlan, CiLedgerTestPlan } from "@beep/repo-cli/commands/Ci"
 *
 * const plan = CiLedgerTestPlan.make({
 *   lanes: [CiLedgerLanePlan.make({ lane: "test-unit", partitions: ["unit-a"] })],
 * })
 * console.log(plan.lanes.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLedgerTestPlan extends S.Opaque<CiLedgerTestPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    lanes: S.Array(CiLedgerLanePlan),
  }).pipe(
    $I.annoteSchema("CiLedgerTestPlan", {
      description: "The Test Plan job's published partition plan, one entry per planned lane.",
    })
  )
) {}

/**
 * One partition job's own selection line.
 *
 * **Details**
 *
 * Every partition job prints a selection line,
 * `[ci] <lane> partition union proved: <n> executable tasks, <s> selected, <p> in <partition>.`,
 * and `partitionTasks` is its `<p>`, the tasks this partition runs.
 *
 * **Example** (An empty catch-all partition)
 *
 * ```ts
 * import { CiLedgerPartitionProof } from "@beep/repo-cli/commands/Ci"
 *
 * const proof = CiLedgerPartitionProof.make({
 *   lane: "test-integration",
 *   partition: "int-rest",
 *   partitionTasks: 0,
 *   selectedTasks: 0,
 * })
 * console.log(proof.partitionTasks)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLedgerPartitionProof extends S.Opaque<CiLedgerPartitionProof, { readonly brand: unique symbol }>()(
  S.Struct({
    lane: CiLedgerPlannedLane,
    partition: S.NonEmptyString,
    partitionTasks: NonNegativeInt,
    selectedTasks: NonNegativeInt,
  }).pipe(
    $I.annoteSchema("CiLedgerPartitionProof", {
      description: "A partition job's own selection line: the lane's selected tasks and the tasks this partition runs.",
    })
  )
) {}

const ledgerPartialReadsDefault: ReadonlyArray<CiWorkflowPartialRead> = [];
const ledgerPartitionProofsDefault: ReadonlyArray<CiLedgerPartitionProof> = [];

/**
 * One captured workflow run: its per-attempt job union and the Test Plan
 * join.
 *
 * **Details**
 *
 * `testPlan` is absent when the run has no readable `Test Plan` job.
 * `partitionProofs` holds the selection lines read from partition jobs; the
 * live reader reads only the catch-all partition's, the one partition a plan
 * allocates without a selected task.
 *
 * **Example** (A run with no jobs read)
 *
 * ```ts
 * import { CiLedgerRun, CiWorkflowWindowRun } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 *
 * const run = CiLedgerRun.make({
 *   jobs: [],
 *   run: CiWorkflowWindowRun.make({
 *     created_at: DateTime.makeUnsafe("2026-11-14T14:31:12Z"),
 *     event: "pull_request",
 *     head_sha: "0f0e0d0c0b0a09080706050403020100ffeeddcc",
 *     id: 43605277972,
 *     run_attempt: 1,
 *   }),
 * })
 * console.log(run.partitionProofs.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLedgerRun extends S.Opaque<CiLedgerRun, { readonly brand: unique symbol }>()(
  S.Struct({
    jobs: S.Array(CiWorkflowJob),
    partialReads: S.Array(CiWorkflowPartialRead).pipe(
      S.withConstructorDefault(Effect.succeed(ledgerPartialReadsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(ledgerPartialReadsDefault))
    ),
    partitionProofs: S.Array(CiLedgerPartitionProof).pipe(
      S.withConstructorDefault(Effect.succeed(ledgerPartitionProofsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(ledgerPartitionProofsDefault))
    ),
    run: CiWorkflowWindowRun,
    testPlan: CiLedgerTestPlan.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("CiLedgerRun", {
      description: "One workflow run's per-attempt job union with its Test Plan output and partition selection lines.",
    })
  )
) {}

/**
 * The captured runs one ledger is folded from.
 *
 * **Example** (An empty capture)
 *
 * ```ts
 * import { CiLedgerCapture } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 *
 * const capture = CiLedgerCapture.make({
 *   capturedAt: DateTime.makeUnsafe("2026-11-14T15:00:00Z"),
 *   runs: [],
 *   schemaVersion: "ci-ledger-capture/v1",
 * })
 * console.log(capture.runs.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLedgerCapture extends S.Opaque<CiLedgerCapture, { readonly brand: unique symbol }>()(
  S.Struct({
    capturedAt: S.DateTimeUtcFromString,
    runs: S.Array(CiLedgerRun),
    schemaVersion: S.tag("ci-ledger-capture/v1"),
  }).pipe(
    $I.annoteSchema("CiLedgerCapture", {
      description: "The workflow runs, jobs and Test Plan joins one cost ledger is folded from.",
    })
  )
) {}

/**
 * One (lane, partition) row of a run's ledger.
 *
 * **Details**
 *
 * `ms` is the machine time of the row's jobs, each job counted once.
 * `legTasks` is set on the partition rows of the planned lanes only.
 * `hostedDigest` and `localDigest` are separate on purpose and are never
 * compared: hosted test lanes have no input digest, and the ledger is not
 * parity evidence. The hosted fold sets neither.
 *
 * **Example** (A Test Integration catch-all row)
 *
 * ```ts
 * import { CiLedgerRow } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const row = CiLedgerRow.make({
 *   grain: "partition",
 *   jobs: 1,
 *   lane: "test-integration",
 *   legTasks: O.some("empty"),
 *   ms: 118000,
 *   partition: O.some("int-rest"),
 *   source: "hosted-jobs",
 * })
 * console.log(row.ms)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLedgerRow extends S.Opaque<CiLedgerRow, { readonly brand: unique symbol }>()(
  S.Struct({
    grain: CiLedgerGrain,
    hostedDigest: S.NonEmptyString.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    jobs: NonNegativeInt,
    lane: CiLaneId,
    legTasks: CiLedgerLegTasks.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    localDigest: S.NonEmptyString.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    ms: NonNegativeInt,
    partition: S.NonEmptyString.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    source: CiLedgerSourceKind,
  }).pipe(
    $I.annoteSchema("CiLedgerRow", {
      description: "One (lane, partition) row of a run's cost ledger with its jobs, machine time and leg verdict.",
    })
  )
) {}

/**
 * One run's ledger: its rows and the conservation census they sum to.
 *
 * **Details**
 *
 * `totalMs` is `laneMs + supportMs + unknownMs` over the run's executed jobs,
 * each counted once: a rerun attempt's copy of a job it did not re-execute
 * (same name and timestamps) is dropped and counted in `rerunCopies`, a
 * skipped job counts in `skippedJobs` with no time, and a caller job with no
 * runner whose called jobs are listed (`<caller> / <job>`) is a wrapper whose
 * wall time is `wrapperMs`, outside the total, because its called jobs carry
 * the runner time. `mappedShare` is the known share (lane plus support) of
 * `totalMs`, `laneShare` the lane share. `emptyLegMs` is the time of the
 * planned lanes' empty partition jobs, absent while any leg is undetermined.
 * `testPlan` counts the run's Test Plan join in parts, its Test Plan output
 * and the selection line of each catch-all partition job it executed:
 * `present` when every part was read, `partial` when some were, `absent`
 * when none was.
 *
 * **Example** (Read a run's mapped share)
 *
 * ```ts
 * import type { CiLedgerRunRow } from "@beep/repo-cli/commands/Ci"
 *
 * const mapped = (row: CiLedgerRunRow) => row.mappedShare
 * console.log(typeof mapped)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLedgerRunRow extends S.Opaque<CiLedgerRunRow, { readonly brand: unique symbol }>()(
  S.Struct({
    attempt: NonNegativeInt,
    emptyLegMs: S.OptionFromNullOr(NonNegativeInt),
    emptyLegs: NonNegativeInt,
    event: S.NonEmptyString,
    headSha: S.NonEmptyString,
    jobs: NonNegativeInt,
    laneMs: NonNegativeInt,
    laneShare: S.OptionFromNullOr(Share),
    mappedShare: S.OptionFromNullOr(Share),
    partial: S.Boolean,
    rerunCopies: NonNegativeInt,
    rows: S.Array(CiLedgerRow),
    runId: S.Finite,
    skippedJobs: NonNegativeInt,
    supportMs: NonNegativeInt,
    testPlan: CiLedgerSourceStatus,
    totalMs: NonNegativeInt,
    undeterminedLegs: NonNegativeInt,
    unknownMs: NonNegativeInt,
    unknownNames: S.Array(S.String),
    wrapperJobs: NonNegativeInt,
    wrapperMs: NonNegativeInt,
  }).pipe(
    $I.annoteSchema("CiLedgerRunRow", {
      description: "One run's (lane, partition) rows with the lane, support and unknown census and its empty legs.",
    })
  )
) {}

/**
 * One source of the ledger and how much of it was read.
 *
 * **Details**
 *
 * `status` is judged over every part the source covers, summed across the
 * runs (attempts for `hosted-jobs`; the Test Plan output and each executed
 * catch-all partition's selection line for `test-plan`), and `note` names
 * each part some run could not read. `runs` counts the runs read whole.
 *
 * **Example** (A source the fold does not join yet)
 *
 * ```ts
 * import { CiLedgerSourceRow } from "@beep/repo-cli/commands/Ci"
 *
 * const row = CiLedgerSourceRow.make({
 *   note: "MEAS-08 is open",
 *   runs: 0,
 *   source: "psi",
 *   status: "absent",
 * })
 * console.log(row.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLedgerSourceRow extends S.Opaque<CiLedgerSourceRow, { readonly brand: unique symbol }>()(
  S.Struct({
    note: S.NonEmptyString,
    runs: NonNegativeInt,
    source: CiLedgerSourceKind,
    status: CiLedgerSourceStatus,
  }).pipe(
    $I.annoteSchema("CiLedgerSourceRow", {
      description: "One ledger source, the runs it was read for and why it is partial or absent.",
    })
  )
) {}

/**
 * One cost ledger over a set of captured runs.
 *
 * **Example** (Read the source rows)
 *
 * ```ts
 * import type { CiLedgerReport } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * const absent = (report: CiLedgerReport) => A.filter(report.sources, (row) => row.status === "absent")
 * console.log(typeof absent)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLedgerReport extends S.Opaque<CiLedgerReport, { readonly brand: unique symbol }>()(
  S.Struct({
    capturedAt: S.DateTimeUtcFromString,
    runs: S.Array(CiLedgerRunRow),
    schemaVersion: S.tag("ci-ledger-report/v1"),
    sources: S.Array(CiLedgerSourceRow),
  }).pipe(
    $I.annoteSchema("CiLedgerReport", {
      description: "A per-check cost ledger: every source's read status and one row set per captured run.",
    })
  )
) {}
