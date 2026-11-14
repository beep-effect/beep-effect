/**
 * The per-check cost ledger (`beep ci ledger`, MEAS-05 of
 * goals/certainty-scorecard).
 *
 * **Details**
 *
 * One fold ({@link foldCiLedger}) turns captured workflow runs into rows at
 * (lane, partition) grain through the lane map (`CiLaneJobs.ts`) and the route
 * census's job attribution, so the ledger, the census and the scorecard read
 * one map. Each job's minutes land in exactly one row or in the run's support
 * or unknown minutes. The empty-leg row joins every Test Unit and Test
 * Integration partition job to the run's `Test Plan` output. Sources the fold
 * does not join yet are reported as `absent` rows. The ledger is attribution
 * evidence: nothing in proof authorization reads it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError } from "./Ci.errors.ts";
import { CiSupportJobName, ciCallerJobName, ciJobPartition, ciLaneShardJobName } from "./CiLaneJobs.ts";
import { CI_LANE_PARTITIONS } from "./CiLanePartitions.ts";
import {
  CiLedgerCapture,
  CiLedgerLanePlan,
  CiLedgerPartitionProof,
  CiLedgerPlannedLane,
  CiLedgerReport,
  CiLedgerRow,
  CiLedgerRun,
  CiLedgerRunRow,
  CiLedgerSourceRow,
  CiLedgerTestPlan,
} from "./CostLedger.schemas.ts";
import {
  CiLaneTimingGithubClient,
  CiWorkflowWindowRun,
  collectCiWorkflowRunAttemptJobs,
  makeCiLaneTimingGithubClient,
  withCiGithub,
} from "./LaneTimings.ts";
import { hostedJobAttribution } from "./RouteCensus.ts";
import type { CiLaneId } from "./CiLane.ts";
import type { CiLedgerLegTasks, CiLedgerSourceKind, CiLedgerSourceStatus } from "./CostLedger.schemas.ts";
import type { CiWorkflowJob } from "./LaneTimings.ts";
import type { RouteJobClass } from "./Route.schemas.ts";

const $I = $RepoCliId.create("commands/Ci/CostLedger");

const isPlannedLane = S.is(CiLedgerPlannedLane);

// The partitions a plan allocates whether or not its selection reached them: the Test Integration
// bins without a shard (`int-rest`), which run every package the sharded bins do not own.
const CATCH_ALL_PARTITIONS: ReadonlyArray<readonly [CiLedgerPlannedLane, string]> = pipe(
  CI_LANE_PARTITIONS,
  A.filter((partition) => partition.lane === "test-integration" && partition.shard === undefined),
  A.map((partition) => ["test-integration", partition.id] as const)
);
const legKey = (lane: string, partition: string): string => `${lane}\u0000${partition}`;
const CATCH_ALL_KEYS = HashSet.fromIterable(A.map(CATCH_ALL_PARTITIONS, ([lane, id]) => legKey(lane, id)));

// ---------------------------------------------------------------------------------------------
// Test Plan and partition log lines
// ---------------------------------------------------------------------------------------------

// `publish` in check.yml's Test Plan job: `test_unit: 3 of 24 partitions: unit-a unit-b unit-c`.
const PUBLISHED_PLAN = /(test_unit|test_integration): \d+ of \d+ partitions:(.*)$/;
// `planCiLanePartitions`: `[ci] test-integration plan: 1 partition(s) for 0 selected task(s) of 24: int-rest`.
const PLAN_STEP = /\[ci\] (test-unit|test-integration) plan: \d+ partition\(s\) for (\d+) selected task\(s\) of (\d+)/;
// `runCiPartitionedLane`: `[ci] test-integration partition union proved: 24 executable tasks, 0 selected, 0 in int-rest.`
const PARTITION_PROOF =
  /\[ci\] (test-unit|test-integration) partition union proved: \d+ executable tasks, (\d+) selected, (\d+) in ([^ .]+)\./;

// The Test Plan job publishes each lane's plan under its output name.
const CiLedgerPlanOutput = LiteralKit(["test_unit", "test_integration"]).pipe(
  $I.annoteSchema("CiLedgerPlanOutput", {
    description: "The Test Plan job output that publishes one planned lane's partitions.",
  })
);

const plannedLaneOfOutput = (output: typeof CiLedgerPlanOutput.Type): CiLedgerPlannedLane =>
  CiLedgerPlanOutput.match(output, {
    test_integration: (): CiLedgerPlannedLane => "test-integration",
    test_unit: (): CiLedgerPlannedLane => "test-unit",
  });

const TaskCount = S.NumberFromString.pipe(S.check(S.isInt(), S.isGreaterThanOrEqualTo(0)));

// Each pattern's match, decoded as the tuple of the whole line and its groups.
const decodePublishedPlan = S.decodeUnknownOption(S.Tuple([S.String, CiLedgerPlanOutput, S.String]));
const decodePlanStep = S.decodeUnknownOption(S.Tuple([S.String, CiLedgerPlannedLane, TaskCount, TaskCount]));
const decodePartitionProof = S.decodeUnknownOption(
  S.Tuple([S.String, CiLedgerPlannedLane, TaskCount, TaskCount, S.NonEmptyString])
);

const decodedLines = <A>(
  log: string,
  pattern: RegExp,
  decode: (groups: ReadonlyArray<string | undefined>) => O.Option<A>
): ReadonlyArray<A> =>
  A.getSomes(
    A.map(Str.split(log, "\n"), (line) =>
      O.flatMap(Str.match(pattern)(line), (groups) => decode(A.fromIterable(groups)))
    )
  );

const planStepCounts = (
  log: string,
  lane: CiLedgerPlannedLane
): { readonly laneTasks: O.Option<number>; readonly selectedTasks: O.Option<number> } =>
  O.match(
    A.findFirst(decodedLines(log, PLAN_STEP, decodePlanStep), ([, stepLane]) => stepLane === lane),
    {
      onNone: () => ({ laneTasks: O.none(), selectedTasks: O.none() }),
      onSome: ([, , selected, total]) => ({ laneTasks: O.some(total), selectedTasks: O.some(selected) }),
    }
  );

/**
 * Read a run's `Test Plan` job log into its published plan.
 *
 * **Details**
 *
 * Each lane's entry comes from the plan's published line; its task counts come
 * from the plan step's own line when the log has one (pull-request runs). The
 * GitHub log prefixes each line with a timestamp, so the lines are matched
 * anywhere on the line. A log with no published line is no plan.
 *
 * **Example** (Read a plan that selected no integration task)
 *
 * ```ts
 * import { parseCiLedgerTestPlan } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const log = A.join(
 *   [
 *   "2026-11-14T14:32:20Z [ci] test-integration plan: 1 partition(s) for 0 selected task(s) of 24: int-rest",
 *   "2026-11-14T14:32:21Z test_integration: 1 of 20 partitions: int-rest",
 *   ],
 *   "\n"
 * )
 * const plan = O.getOrThrow(parseCiLedgerTestPlan(log))
 * console.log(plan.lanes[0]?.partitions) // ["int-rest"]
 * ```
 *
 * @param log - The Test Plan job's log text.
 * @returns The plan, or `None` when the log publishes none.
 * @category parsing
 * @since 0.0.0
 */
export const parseCiLedgerTestPlan = (log: string): O.Option<CiLedgerTestPlan> =>
  pipe(
    decodedLines(log, PUBLISHED_PLAN, decodePublishedPlan),
    A.map(([, output, partitions]) => {
      const lane = plannedLaneOfOutput(output);
      return CiLedgerLanePlan.make({
        ...planStepCounts(log, lane),
        lane,
        partitions: A.filter(Str.split(partitions, " "), Str.isNonEmpty),
      });
    }),
    O.liftPredicate(A.isReadonlyArrayNonEmpty),
    O.map((lanes) => CiLedgerTestPlan.make({ lanes }))
  );

/**
 * Read every partition selection line of a partition job's log.
 *
 * **Example** (Read an empty catch-all partition)
 *
 * ```ts
 * import { parseCiLedgerPartitionProofs } from "@beep/repo-cli/commands/Ci"
 *
 * const log = "[ci] test-integration partition union proved: 24 executable tasks, 0 selected, 0 in int-rest."
 * console.log(parseCiLedgerPartitionProofs(log)[0]?.partitionTasks) // 0
 * ```
 *
 * @param log - A partition job's log text.
 * @returns One proof per selection line, in log order.
 * @category parsing
 * @since 0.0.0
 */
export const parseCiLedgerPartitionProofs = (log: string): ReadonlyArray<CiLedgerPartitionProof> =>
  A.map(
    decodedLines(log, PARTITION_PROOF, decodePartitionProof),
    ([, lane, selectedTasks, partitionTasks, partition]) =>
      CiLedgerPartitionProof.make({ lane, partition, partitionTasks, selectedTasks })
  );

// ---------------------------------------------------------------------------------------------
// The fold
// ---------------------------------------------------------------------------------------------

const instant = (value: string | null): O.Option<number> =>
  O.map(O.flatMap(O.fromNullOr(value), DateTime.make), DateTime.toEpochMillis);

// A skipped job lists a completion before its start, so it costs nothing.
const jobMs = (job: CiWorkflowJob): number =>
  O.getOrElse(
    O.map(O.all([instant(job.started_at), instant(job.completed_at)]), ([started, completed]) =>
      Num.max(0, completed - started)
    ),
    () => 0
  );

const isSkipped = (job: CiWorkflowJob): boolean => job.conclusion === "skipped";

// A rerun attempt lists the jobs it did not re-execute again, under its own attempt number with the
// earlier attempt's name and timestamps. Two jobs of one attempt with the same name and timestamps
// (skipped matrix jobs) are two jobs.
const isRerunCopy = (jobs: ReadonlyArray<CiWorkflowJob>, job: CiWorkflowJob): boolean =>
  A.some(
    jobs,
    (earlier) =>
      earlier.run_attempt < job.run_attempt &&
      Str.Equivalence(earlier.name, job.name) &&
      earlier.started_at === job.started_at &&
      earlier.completed_at === job.completed_at
  );

// The executed listing of a job: the latest attempt that ran it, never a skipped job or a rerun copy.
const latestJobNamed = (jobs: ReadonlyArray<CiWorkflowJob>, name: string): O.Option<CiWorkflowJob> =>
  A.last(
    A.sort(
      A.filter(jobs, (job) => Str.Equivalence(job.name, name) && !isSkipped(job) && !isRerunCopy(jobs, job)),
      Order.mapInput(Order.Number, (job: CiWorkflowJob) => job.run_attempt)
    )
  );

interface CostedJob {
  readonly job: CiWorkflowJob;
  readonly jobClass: RouteJobClass;
  readonly lane: O.Option<CiLaneId>;
  readonly ms: number;
  readonly partition: O.Option<string>;
}

const costJob = (job: CiWorkflowJob): CostedJob => {
  const attribution = hostedJobAttribution(job.name);
  return {
    job,
    jobClass: attribution.jobClass,
    lane: attribution.lane,
    ms: jobMs(job),
    partition: ciJobPartition(job.name),
  };
};

const msOf = (jobs: ReadonlyArray<{ readonly ms: number }>): number => Num.sumAll(A.map(jobs, (costed) => costed.ms));

const ofClass = (jobs: ReadonlyArray<CostedJob>, jobClass: RouteJobClass): ReadonlyArray<CostedJob> =>
  A.filter(jobs, (costed) => Str.Equivalence(costed.jobClass, jobClass));

const proofVerdict = (run: CiLedgerRun, lane: CiLedgerPlannedLane, partition: string): O.Option<CiLedgerLegTasks> =>
  O.map(
    A.findFirst(run.partitionProofs, (proof) => proof.lane === lane && Str.Equivalence(proof.partition, partition)),
    (proof): CiLedgerLegTasks => (proof.partitionTasks === 0 ? "empty" : "selected")
  );

// A plan allocates a sharded partition only for its selected packages, so it had tasks; a lane plan
// that selected none makes every leg it allocated empty; the catch-all partition is allocated either way.
const lanePlanVerdict = (plan: CiLedgerLanePlan, partition: string): O.Option<CiLedgerLegTasks> =>
  Match.value({
    catchAll: HashSet.has(CATCH_ALL_KEYS, legKey(plan.lane, partition)),
    noneSelected: O.exists(plan.selectedTasks, (count) => count === 0),
    planned: A.contains(plan.partitions, partition),
  }).pipe(
    Match.when({ noneSelected: true }, (): O.Option<CiLedgerLegTasks> => O.some("empty")),
    Match.when({ catchAll: false, planned: true }, (): O.Option<CiLedgerLegTasks> => O.some("selected")),
    Match.orElse(O.none<CiLedgerLegTasks>)
  );

const planVerdict = (run: CiLedgerRun, lane: CiLedgerPlannedLane, partition: string): O.Option<CiLedgerLegTasks> =>
  pipe(
    run.testPlan,
    O.flatMap((plan) => A.findFirst(plan.lanes, (entry) => entry.lane === lane)),
    O.flatMap((plan) => lanePlanVerdict(plan, partition))
  );

const legTasksOf = (run: CiLedgerRun, lane: CiLaneId, partition: O.Option<string>): O.Option<CiLedgerLegTasks> =>
  pipe(
    O.all({ lane: O.liftPredicate(lane, isPlannedLane), partition }),
    O.map(({ lane: planned, partition: id }) =>
      O.getOrElse(
        O.orElse(proofVerdict(run, planned, id), () => planVerdict(run, planned, id)),
        (): CiLedgerLegTasks => "undetermined"
      )
    )
  );

const rowOrder = Order.combine(
  Order.mapInput(Order.String, (row: CiLedgerRow) => row.lane),
  Order.mapInput(Order.String, (row: CiLedgerRow) => O.getOrElse(row.partition, () => ""))
);

interface LaneJob {
  readonly lane: CiLaneId;
  readonly ms: number;
  readonly partition: O.Option<string>;
}

const laneJobsOf = (costed: ReadonlyArray<CostedJob>): ReadonlyArray<LaneJob> =>
  A.getSomes(A.map(costed, ({ lane, ms, partition }) => O.map(lane, (id): LaneJob => ({ lane: id, ms, partition }))));

const rowsOf = (run: CiLedgerRun, laneJobs: ReadonlyArray<LaneJob>): ReadonlyArray<CiLedgerRow> =>
  pipe(
    A.groupBy(laneJobs, (job) =>
      legKey(
        job.lane,
        O.getOrElse(job.partition, () => "")
      )
    ),
    R.values,
    A.map((group) => {
      const { lane, partition } = A.headNonEmpty(group);
      return CiLedgerRow.make({
        grain: O.isSome(partition) ? "partition" : "lane",
        jobs: group.length,
        lane,
        legTasks: legTasksOf(run, lane, partition),
        ms: msOf(group),
        partition,
        source: "hosted-jobs",
      });
    }),
    A.sort(rowOrder)
  );

const shareOf = (part: number, total: number): O.Option<number> =>
  O.map(O.liftPredicate(total, Num.isGreaterThan(0)), (whole) => part / whole);

const rowsWithTasks = (rows: ReadonlyArray<CiLedgerRow>, tasks: CiLedgerLegTasks): ReadonlyArray<CiLedgerRow> =>
  A.filter(rows, (row) => O.contains(row.legTasks, tasks));

// A caller job with no runner whose called jobs (`<caller> / <job>`) are listed is a wrapper: the
// called jobs carry the runner time, so its wall time is never added to theirs.
const wrapperNames = (jobs: ReadonlyArray<CiWorkflowJob>): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.getSomes(A.map(jobs, (job) => ciCallerJobName(job.name))));

const isWrapper =
  (callers: HashSet.HashSet<string>) =>
  (job: CiWorkflowJob): boolean =>
    A.isReadonlyArrayEmpty(job.labels) && HashSet.has(callers, job.name);

/**
 * Fold one captured run into its ledger rows and conservation census.
 *
 * **Details**
 *
 * Rerun copies are dropped first (a later attempt's listing of a job with the
 * same name and timestamps as an earlier attempt's); skipped jobs
 * cost nothing and are counted apart; wrappers are measured apart. Every other
 * job is attributed by the route census's `hostedJobAttribution`: a lane job
 * joins the row of its lane and partition, a support or unknown job adds to
 * those minutes. The lane, support and unknown minutes sum to `totalMs`, so no
 * job is dropped and none is counted twice.
 *
 * **Example** (Fold a run with an aggregate and one partition)
 *
 * ```ts
 * import { CiLedgerRun, CiWorkflowJob, CiWorkflowWindowRun, foldCiLedgerRun } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 *
 * const job = (id: number, name: string, started_at: string, completed_at: string) =>
 *   CiWorkflowJob.make({
 *     completed_at,
 *     conclusion: "success",
 *     created_at: started_at,
 *     id,
 *     labels: ["ubuntu-24.04"],
 *     name,
 *     run_attempt: 1,
 *     run_id: 1,
 *     started_at,
 *     status: "completed",
 *   })
 * const row = foldCiLedgerRun(
 *   CiLedgerRun.make({
 *     jobs: [
 *       job(1, "Lint (lint-a)", "2026-11-14T10:00:00Z", "2026-11-14T10:01:00Z"),
 *       job(2, "Lint", "2026-11-14T10:01:00Z", "2026-11-14T10:01:10Z"),
 *     ],
 *     run: CiWorkflowWindowRun.make({
 *       created_at: DateTime.makeUnsafe("2026-11-14T10:00:00Z"),
 *       event: "pull_request",
 *       head_sha: "0f0e0d0c0b0a09080706050403020100ffeeddcc",
 *       id: 1,
 *       run_attempt: 1,
 *     }),
 *   })
 * )
 * console.log(row.laneMs) // 70000
 * console.log(row.rows.length) // 2
 * ```
 *
 * @param run - One captured run.
 * @returns The run's rows, census and empty legs.
 * @category use-cases
 * @since 0.0.0
 */
export const foldCiLedgerRun = (run: CiLedgerRun): CiLedgerRunRow => {
  const distinct = A.filter(run.jobs, (job) => !isRerunCopy(run.jobs, job));
  const executed = A.filter(distinct, (job) => !isSkipped(job));
  const wrapper = isWrapper(wrapperNames(executed));
  const wrappers = A.filter(executed, wrapper);
  const costed = A.map(
    A.filter(executed, (job) => !wrapper(job)),
    costJob
  );
  const lane = laneJobsOf(costed);
  const known = msOf(lane) + msOf(ofClass(costed, "support"));
  const unknown = ofClass(costed, "unknown");
  const rows = rowsOf(run, lane);
  const undetermined = rowsWithTasks(rows, "undetermined");
  const empty = rowsWithTasks(rows, "empty");
  return CiLedgerRunRow.make({
    attempt: run.run.run_attempt,
    emptyLegMs: O.as(O.liftPredicate(undetermined, A.isReadonlyArrayEmpty), Num.sumAll(A.map(empty, (row) => row.ms))),
    emptyLegs: empty.length,
    event: run.run.event,
    headSha: run.run.head_sha,
    jobs: distinct.length,
    laneMs: msOf(lane),
    laneShare: shareOf(msOf(lane), msOf(costed)),
    mappedShare: shareOf(known, msOf(costed)),
    partial: A.isReadonlyArrayNonEmpty(run.partialReads),
    rerunCopies: run.jobs.length - distinct.length,
    rows,
    runId: run.run.id,
    skippedJobs: distinct.length - executed.length,
    supportMs: msOf(ofClass(costed, "support")),
    testPlan: testPlanStatus(run),
    totalMs: msOf(costed),
    undeterminedLegs: undetermined.length,
    unknownMs: msOf(unknown),
    unknownNames: A.sort(A.dedupe(A.map(unknown, (costed) => costed.job.name)), Order.String),
    wrapperJobs: wrappers.length,
    wrapperMs: Num.sumAll(A.map(wrappers, jobMs)),
  });
};

const readStatus = (read: number, total: number): CiLedgerSourceStatus =>
  Match.value({ none: read === 0, all: read === total }).pipe(
    Match.when({ none: true }, (): CiLedgerSourceStatus => "absent"),
    Match.when({ all: true }, (): CiLedgerSourceStatus => "present"),
    Match.orElse((): CiLedgerSourceStatus => "partial")
  );

// The parts of a run's Test Plan join: its Test Plan output, then the selection line of each catch-all
// partition job the run executed. Each part names itself, so a source row can say which one is missing.
const testPlanParts = (run: CiLedgerRun): ReadonlyArray<readonly [string, boolean]> => [
  ["Test Plan output", O.isSome(run.testPlan)],
  ...A.flatMap(CATCH_ALL_PARTITIONS, ([lane, partition]) =>
    A.map(O.toArray(latestJobNamed(run.jobs, ciLaneShardJobName(partition, lane))), (): readonly [string, boolean] => [
      `${lane} ${partition} selection line`,
      A.some(run.partitionProofs, (proof) => proof.lane === lane && Str.Equivalence(proof.partition, partition)),
    ])
  ),
];

const readParts = (parts: ReadonlyArray<readonly [string, boolean]>): number =>
  A.filter(parts, ([, read]) => read).length;

const testPlanStatus = (run: CiLedgerRun): CiLedgerSourceStatus => {
  const parts = testPlanParts(run);
  return readStatus(readParts(parts), parts.length);
};

// A run read every attempt it had, or names each attempt whose jobs read failed.
const attemptsRead = (run: CiLedgerRun): number => Num.max(0, run.run.run_attempt - run.partialReads.length);

// `<part> (<n> of <runs> runs)` for every part some run could not read.
const missingParts = (runs: ReadonlyArray<CiLedgerRun>): ReadonlyArray<string> =>
  pipe(
    A.flatMap(runs, (run) => A.filter(testPlanParts(run), ([, read]) => !read)),
    A.groupBy(([part]) => part),
    R.toEntries,
    A.map(([part, missing]) => `${part} (${missing.length} of ${runs.length} runs)`)
  );

const withMissing = (note: string, missing: ReadonlyArray<string>): string =>
  A.match(missing, {
    onEmpty: () => note,
    onNonEmpty: (parts) => `${note}; missing: ${A.join(parts, ", ")}`,
  });

// Sources this fold does not join yet, each with the lever that would supply it.
const UNJOINED_SOURCES: ReadonlyArray<readonly [CiLedgerSourceKind, string]> = [
  ["turbo-tasks", "per-task hosted Turbo rows are MEAS-06, still open: unit-results.json is uploaded only on failure"],
  ["final-check", "local final-check attempts (MEAS-07 journals) are not joined by this fold"],
  ["economics", "local Yeet attempt lanes are not joined by this fold"],
  ["psi", "pressure samples are MEAS-08, which depends on this ledger and is still open"],
];

const sourceRows = (runs: ReadonlyArray<CiLedgerRun>): ReadonlyArray<CiLedgerSourceRow> => {
  const attempts = Num.sumAll(A.map(runs, (run) => run.run.run_attempt));
  const read = Num.sumAll(A.map(runs, attemptsRead));
  const parts = A.flatMap(runs, testPlanParts);
  return [
    CiLedgerSourceRow.make({
      note: withMissing(
        "per-attempt jobs listing of each run",
        A.map(A.filter([attempts - read], Num.isGreaterThan(0)), (unread) => `${unread} of ${attempts} attempts`)
      ),
      runs: A.filter(runs, (run) => A.isReadonlyArrayEmpty(run.partialReads)).length,
      source: "hosted-jobs",
      status: readStatus(read, attempts),
    }),
    CiLedgerSourceRow.make({
      note: withMissing("Test Plan output and the catch-all partition's selection line", missingParts(runs)),
      runs: A.filter(runs, (run) => testPlanStatus(run) === "present").length,
      source: "test-plan",
      status: readStatus(readParts(parts), parts.length),
    }),
    ...A.map(UNJOINED_SOURCES, ([source, note]) => CiLedgerSourceRow.make({ note, runs: 0, source, status: "absent" })),
  ];
};

/**
 * Fold a capture into its cost ledger.
 *
 * **Example** (Fold an empty capture)
 *
 * ```ts
 * import { CiLedgerCapture, foldCiLedger } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 *
 * const report = foldCiLedger(
 *   CiLedgerCapture.make({
 *     capturedAt: DateTime.makeUnsafe("2026-11-14T15:00:00Z"),
 *     runs: [],
 *     schemaVersion: "ci-ledger-capture/v1",
 *   })
 * )
 * console.log(report.sources.length) // 6, every one absent
 * ```
 *
 * @param capture - The captured runs.
 * @returns One run row per captured run and every source's read status.
 * @category use-cases
 * @since 0.0.0
 */
export const foldCiLedger = (capture: CiLedgerCapture): CiLedgerReport =>
  CiLedgerReport.make({
    capturedAt: capture.capturedAt,
    runs: A.map(capture.runs, foldCiLedgerRun),
    schemaVersion: "ci-ledger-report/v1",
    sources: sourceRows(capture.runs),
  });

// ---------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------

const minutes = (ms: number): string => `${Num.round(ms / 60_000, 1)}`;

const percent = (share: O.Option<number>): string =>
  O.getOrElse(
    O.map(share, (value) => `${Num.round(value * 100, 2)}%`),
    () => "n/a"
  );

const emptyLegCell = (row: CiLedgerRunRow): string =>
  O.getOrElse(O.map(row.emptyLegMs, minutes), () => `undetermined (${row.undeterminedLegs} legs)`);

const runLine = (row: CiLedgerRunRow): string =>
  `| ${row.runId} | ${row.event} | ${row.attempt} | ${row.jobs} | ${minutes(row.totalMs)} | ${minutes(row.laneMs)} | ${minutes(row.supportMs)} | ${minutes(row.unknownMs)} | ${percent(row.mappedShare)} | ${percent(row.laneShare)} | ${emptyLegCell(row)} |${row.partial ? " partial |" : " |"}`;

/**
 * Render a cost ledger as Markdown: the source table, then one census line
 * per run.
 *
 * **Example** (Render an empty ledger)
 *
 * ```ts
 * import { CiLedgerCapture, foldCiLedger, renderCiLedgerMarkdown } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 *
 * const capture = CiLedgerCapture.make({
 *   capturedAt: DateTime.makeUnsafe("2026-11-14T15:00:00Z"),
 *   runs: [],
 *   schemaVersion: "ci-ledger-capture/v1",
 * })
 * console.log(renderCiLedgerMarkdown(foldCiLedger(capture)).startsWith("# ci ledger")) // true
 * ```
 *
 * @param report - The folded ledger to print.
 * @returns Markdown text.
 * @category formatting
 * @since 0.0.0
 */
export const renderCiLedgerMarkdown = (report: CiLedgerReport): string =>
  A.join(
    [
      `# ci ledger ${DateTime.formatIso(report.capturedAt)}`,
      "",
      "| source | status | runs | note |",
      "| --- | --- | --- | --- |",
      ...A.map(report.sources, (row) => `| ${row.source} | ${row.status} | ${row.runs} | ${row.note} |`),
      "",
      "| run | event | attempt | jobs | total min | lane min | support min | unknown min | mapped | lane share | empty-leg min | read |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      ...A.map(report.runs, runLine),
      ...A.flatMap(report.runs, (row) =>
        A.map(
          O.toArray(A.match(row.unknownNames, { onEmpty: O.none, onNonEmpty: O.some })),
          (names) => `- run ${row.runId} unknown jobs: ${A.join(names, ", ")}`
        )
      ),
    ],
    "\n"
  );

// ---------------------------------------------------------------------------------------------
// The live reader
// ---------------------------------------------------------------------------------------------

/**
 * Service shape of the ledger's capture reader.
 *
 * **Example** (Name the capture operation)
 *
 * ```ts
 * import type { CiLedgerReaderShape } from "@beep/repo-cli/commands/Ci"
 *
 * const operation = <K extends keyof CiLedgerReaderShape>(name: K): K => name
 * console.log(operation("capture"))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface CiLedgerReaderShape {
  readonly capture: (runIds: A.NonEmptyReadonlyArray<number>) => Effect.Effect<CiLedgerCapture, CiCommandError>;
}

/**
 * The reader a cost ledger is folded from.
 *
 * **Details**
 *
 * The live implementation ({@link makeCiLedgerReader}) reads each run, its
 * jobs attempt by attempt (pages of 30 when 100 fail), the log of its latest
 * `Test Plan` job and the log of its latest catch-all partition job. A log it
 * cannot read leaves that join absent rather than failing the capture. Tests
 * and replays provide a capture directly.
 *
 * **Example** (Access the reader service)
 *
 * ```ts
 * import { CiLedgerReader } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.service(CiLedgerReader)))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CiLedgerReader extends Context.Service<CiLedgerReader, CiLedgerReaderShape>()($I`CiLedgerReader`) {}

const decodeRun = S.decodeUnknownEffect(CiWorkflowWindowRun);

const readJobLog = Effect.fn("CiLedgerReader.readJobLog")(function* (job: CiWorkflowJob) {
  const client = yield* GitHubClient;
  const { owner, repo } = yield* Repo;
  return yield* client
    .requestDecoded("GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs", { owner, repo, job_id: job.id }, S.String)
    .pipe(Effect.option);
});

const readOptionalLog = (job: O.Option<CiWorkflowJob>) =>
  O.match(job, { onNone: () => Effect.succeedNone, onSome: readJobLog });

const readRun = Effect.fn("CiLedgerReader.readRun")(function* (runId: number) {
  const github = yield* CiLaneTimingGithubClient;
  const run = yield* github
    .getJson(`repos/{owner}/{repo}/actions/runs/${runId}`)
    .pipe(Effect.flatMap(flow(decodeRun, CiCommandError.mapError(`Cannot decode run ${runId}.`))));
  const read = yield* collectCiWorkflowRunAttemptJobs(run.id, run.run_attempt);
  const planLog = yield* readOptionalLog(latestJobNamed(read.jobs, CiSupportJobName.Enum["Test Plan"]));
  const catchAllLogs = yield* Effect.forEach(CATCH_ALL_PARTITIONS, ([lane, partition]) =>
    readOptionalLog(latestJobNamed(read.jobs, ciLaneShardJobName(partition, lane)))
  );
  return CiLedgerRun.make({
    jobs: read.jobs,
    partialReads: read.partialReads,
    partitionProofs: A.flatMap(A.getSomes(catchAllLogs), parseCiLedgerPartitionProofs),
    run,
    testPlan: O.flatMap(planLog, parseCiLedgerTestPlan),
  });
});

/**
 * Build the live {@link CiLedgerReader} over the ambient GitHub client and
 * repository.
 *
 * **Example** (Reference the constructor)
 *
 * ```ts
 * import { makeCiLedgerReader } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof makeCiLedgerReader)
 * ```
 *
 * @returns A reader whose reads use the ambient `GitHubClient` and `Repo`.
 * @category constructors
 * @since 0.0.0
 */
export const makeCiLedgerReader = Effect.fn("CiLedgerReader.make")(function* () {
  const context = yield* Effect.context<GitHubClient | Repo>();
  const github = yield* makeCiLaneTimingGithubClient();
  return CiLedgerReader.of({
    capture: Effect.fn("CiLedgerReader.capture")(function* (runIds) {
      const runs = yield* Effect.forEach(runIds, readRun, { concurrency: 2 }).pipe(
        Effect.provideService(CiLaneTimingGithubClient, github),
        Effect.provideContext(context)
      );
      const capturedAt = yield* DateTime.now;
      return CiLedgerCapture.make({ capturedAt, runs, schemaVersion: "ci-ledger-capture/v1" });
    }),
  });
});

const decodeCapture = S.decodeUnknownEffect(S.fromJsonString(CiLedgerCapture));
const encodeCapture = S.encodeEffect(S.fromJsonString(CiLedgerCapture, { space: 2 }));
const encodeReport = S.encodeEffect(S.fromJsonString(CiLedgerReport, { space: 2 }));

/**
 * Decode a ledger capture from JSON text.
 *
 * **Example** (Reject an empty document)
 *
 * ```ts
 * import { decodeCiLedgerCapture } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(decodeCiLedgerCapture("{}")))
 * ```
 *
 * @param text - Capture JSON as `--write-capture` writes it.
 * @returns The decoded capture.
 * @category encoding
 * @since 0.0.0
 */
export const decodeCiLedgerCapture = (text: string): Effect.Effect<CiLedgerCapture, CiCommandError> =>
  decodeCapture(text).pipe(CiCommandError.mapError("Failed to decode the ledger capture."));

const captureLive = Effect.fn("Ci.ledgerCaptureLive")(function* (runIds: ReadonlyArray<number>) {
  const ids = yield* Effect.fromOption(A.match(runIds, { onEmpty: O.none, onNonEmpty: O.some })).pipe(
    CiCommandError.mapError("Pass at least one --run <id>, or --capture <file>.")
  );
  const repoRoot = yield* findRepoRoot().pipe(Effect.orElseSucceed(() => process.cwd()));
  return yield* makeCiLedgerReader().pipe(
    Effect.flatMap((reader) => reader.capture(ids)),
    withCiGithub(repoRoot)
  );
});

const readCaptureFile = Effect.fn("Ci.ledgerReadCapture")(function* (file: string, runIds: ReadonlyArray<number>) {
  if (A.isReadonlyArrayNonEmpty(runIds)) {
    return yield* CiCommandError.make({ message: "--capture replays a capture; it cannot be combined with --run." });
  }
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(file)
    .pipe(CiCommandError.mapError(`Failed to read ${file}.`), Effect.flatMap(decodeCiLedgerCapture));
});

/**
 * `beep ci ledger` — the per-check cost ledger of named workflow runs.
 *
 * **Details**
 *
 * With `--run` (repeatable) it captures the runs live under the checkout's
 * GitHub identity; with `--capture` it replays a captured file and reads
 * nothing. `--write-capture` saves the live capture. The reads are background
 * reads under `goals/github-budget-ledger`'s reserve signal: a run costs one
 * run read, its attempts' job pages and up to two log reads.
 *
 * **Example** (Reference the command)
 *
 * ```ts
 * import { ciLedgerCommand } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof ciLedgerCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciLedgerCommand = Command.make(
  "ledger",
  {
    capture: Flag.String("capture").pipe(
      Flag.optional,
      Flag.withDescription("Replay a captured ledger JSON instead of reading GitHub")
    ),
    json: Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the ledger as JSON")),
    run: Flag.Int("run").pipe(Flag.atLeast(0), Flag.withDescription("Workflow run id to read; repeat for each run")),
    writeCapture: Flag.String("write-capture").pipe(
      Flag.optional,
      Flag.withDescription("Write the live capture JSON to this path")
    ),
  },
  Effect.fnUntraced(function* ({ capture, json, run, writeCapture }) {
    const fs = yield* FileSystem.FileSystem;
    const captured = yield* O.match(capture, {
      onNone: () => captureLive(run),
      onSome: (file) => readCaptureFile(file, run),
    });
    if (O.isSome(writeCapture)) {
      const text = yield* encodeCapture(captured).pipe(CiCommandError.mapError("Failed to encode the ledger capture."));
      yield* fs
        .writeFileString(writeCapture.value, `${text}\n`)
        .pipe(CiCommandError.mapError(`Failed to write ${writeCapture.value}.`));
    }
    const report = foldCiLedger(captured);
    const text = json
      ? yield* encodeReport(report).pipe(CiCommandError.mapError("Failed to encode the ledger."))
      : renderCiLedgerMarkdown(report);
    yield* Console.log(text);
  })
).pipe(Command.withDescription("Per-check cost ledger of workflow runs at (lane, partition) grain"));
