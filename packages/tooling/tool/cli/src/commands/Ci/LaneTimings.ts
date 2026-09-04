/**
 * Hosted CI lane timings collected per job with attempt-aware provenance.
 *
 * **Details**
 *
 * The lane-timings numbers this repo reasons about used to be gathered ad hoc
 * from `gh run`, and one of those numbers was an artifact. Run-level
 * `run_started_at - created_at` read 18–21 minutes on three Check runs during
 * an Actions incident and 0s on others; every "delayed" run was `run_attempt`
 * 2–3 and every 0s run was attempt 1. GitHub *rewrites* `run_started_at` on
 * re-dispatch, so the metric was measuring time-until-a-human-clicked-rerun,
 * not runner wait. Actual pickup, measured at job level in the same window, was
 * 19–67 seconds — and "PRs are blocked because no runners are available" was
 * falsified as a justification for an entire project.
 *
 * The correction is structural, not procedural: the attempt filter lives in the
 * collector, so a reader cannot forget it. {@link ciLaneTimingRow} returns
 * `pickupSeconds: None` for any job on attempt 2 or later, and every aggregate
 * derives from those rows rather than from raw timestamps.
 *
 * Rows are read from `/repos/{owner}/{repo}/actions/runs/{run_id}/jobs`, which
 * carries `run_attempt`, per-step timings, and the runner labels — everything
 * below except peak RSS.
 *
 * **Gotchas**
 *
 * During an incident *no* Actions timestamp is trustworthy unaudited: job
 * records have been observed with a `created_at` postdating their own
 * `completed_at`. Negative durations are therefore dropped to `None` rather
 * than recorded as negative numbers or clamped to zero, so a garbled record
 * reads as missing data instead of as a fast job.
 *
 * Peak RSS is not in any Actions API. It is carried here as an optional column
 * fed by an out-of-band report so the schema is honest about what a row can
 * hold, and it stays `None` until a runner-side step emits one.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { Console, Context, DateTime, Duration, Effect, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { Command, Flag } from "effect/unstable/cli";
import { ChildProcessSpawner } from "effect/unstable/process";
import { detectGithubJobShapeClass, GithubJobRecord, GithubJobStepRecord } from "../../internal/github/index.ts";
import { runRepoCommandCapture } from "../../internal/repo-run/index.ts";
import { CiCommandError } from "./Ci.errors.ts";
import type * as SchemaAST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Ci/LaneTimings");

/**
 * Where a job ran, as far as its runner labels can prove.
 *
 * **Details**
 *
 * `managed` means a runner this repository operates — the self-hosted burst
 * fleet — and is the population the infra-success rate is computed over,
 * because it is the only one whose infrastructure failures are ours to fix.
 * `github-hosted` is GitHub's own pool. `unknown` is the honest answer for a
 * job whose labels prove neither, and it is excluded from the rate rather than
 * bucketed into whichever side would look better.
 *
 * **Example** (List the runner classes)
 *
 * ```ts
 * import { CiRunnerClass } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiRunnerClass.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiRunnerClass = LiteralKit(["managed", "github-hosted", "unknown"]).pipe(
  $I.annoteSchema("CiRunnerClass", {
    title: "CI Runner Class",
    description: "Which runner pool a hosted job ran on, as far as its labels can prove.",
  })
);

/**
 * Where a job ran, as far as its runner labels can prove.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiRunnerClass = typeof CiRunnerClass.Type;

/**
 * One hosted job as returned by the Actions jobs REST endpoint.
 *
 * **Details**
 *
 * Field names are the wire names on purpose: this is the decode boundary, and
 * `run_attempt` is the field whose omission is the whole point of this module.
 *
 * **Example** (Describe one collected job)
 *
 * ```ts
 * import { CiWorkflowJob } from "@beep/repo-cli/commands/Ci"
 *
 * const job = CiWorkflowJob.make({
 *   completed_at: "2026-08-06T12:10:00Z",
 *   conclusion: "success",
 *   created_at: "2026-08-06T12:00:00Z",
 *   id: 991,
 *   name: "Test Unit",
 *   run_attempt: 1,
 *   run_id: 42,
 *   started_at: "2026-08-06T12:00:30Z",
 *   status: "completed",
 * })
 * console.log(job.run_attempt)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiWorkflowJob extends S.Class<CiWorkflowJob>($I`CiWorkflowJob`)(
  {
    completed_at: S.NullOr(S.String),
    conclusion: S.NullOr(S.String),
    created_at: S.String,
    id: S.Finite,
    labels: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults([])),
    name: S.String,
    run_attempt: S.Finite,
    run_id: S.Finite,
    runner_name: S.NullOr(S.String).pipe(SchemaUtils.withKeyDefaults(null)),
    started_at: S.NullOr(S.String),
    status: S.String,
    steps: S.Array(
      S.Struct({
        completed_at: S.NullOr(S.String).pipe(SchemaUtils.withKeyDefaults(null)),
        conclusion: S.NullOr(S.String),
        name: S.String,
        started_at: S.NullOr(S.String).pipe(SchemaUtils.withKeyDefaults(null)),
      })
    ).pipe(SchemaUtils.withKeyDefaults([])),
  },
  $I.annote("CiWorkflowJob", {
    description: "One hosted job as returned by the GitHub Actions jobs REST endpoint.",
  })
) {}

const CiWorkflowAttemptOneJob = CiWorkflowJob.mapFields((fields) => ({
  ...fields,
  run_attempt: S.Literal(1),
})).annotate(
  $I.annote("CiWorkflowAttemptOneJob", {
    description: "A structurally selected GitHub Actions job from the first workflow-run attempt.",
  })
);
type CiWorkflowAttemptOneJob = typeof CiWorkflowAttemptOneJob.Type;

const isCiWorkflowAttemptOneJob = S.is(CiWorkflowAttemptOneJob);

/**
 * One page of the Actions jobs REST endpoint.
 *
 * **Example** (Describe an empty page)
 *
 * ```ts
 * import { CiWorkflowJobsPage } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiWorkflowJobsPage.make({ jobs: [], total_count: 0 }).total_count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiWorkflowJobsPage extends S.Class<CiWorkflowJobsPage>($I`CiWorkflowJobsPage`)(
  {
    jobs: S.Array(CiWorkflowJob),
    total_count: S.Finite.pipe(SchemaUtils.withKeyDefaults(0)),
  },
  $I.annote("CiWorkflowJobsPage", {
    description: "One page of jobs returned by the GitHub Actions jobs REST endpoint.",
  })
) {}

/**
 * One collected lane timing row, with every derived column already filtered.
 *
 * **Details**
 *
 * `pickupSeconds` is `None` for every attempt after the first, which is the
 * attempt-1 filter applied where it belongs. A reader summing this column can
 * no longer produce the artifact that falsified the runner-capacity claim,
 * because the poisoned values are not in the column to begin with.
 *
 * **Example** (Read a collected row)
 *
 * ```ts
 * import { CiLaneTimingRow } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const row = CiLaneTimingRow.make({
 *   conclusion: "success",
 *   infraFailure: false,
 *   jobId: 991,
 *   jobName: "Test Unit",
 *   runAttempt: 1,
 *   runId: 42,
 *   runnerClass: "managed",
 * })
 * console.log(O.isNone(row.pickupSeconds))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneTimingRow extends S.Class<CiLaneTimingRow>($I`CiLaneTimingRow`)(
  {
    conclusion: S.String,
    durationSeconds: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    infraFailure: S.Boolean,
    installSeconds: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    jobId: S.Finite,
    jobName: S.String,
    peakRssBytes: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    pickupSeconds: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    runAttempt: S.Finite,
    runId: S.Finite,
    runnerClass: CiRunnerClass,
    setupSeconds: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("CiLaneTimingRow", {
    description: "One hosted lane timing row with attempt-filtered pickup latency and per-phase seconds.",
  })
) {}

/**
 * Aggregates over one collected set of lane timing rows.
 *
 * **Example** (Read an empty report)
 *
 * ```ts
 * import { CiLaneTimingsReport } from "@beep/repo-cli/commands/Ci"
 *
 * const report = CiLaneTimingsReport.make({
 *   attemptOneJobCount: 0,
 *   jobCount: 0,
 *   managedInfraFailureCount: 0,
 *   managedJobCount: 0,
 *   rows: [],
 *   schemaVersion: "ci-lane-timings/v1",
 * })
 * console.log(report.schemaVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneTimingsReport extends S.Class<CiLaneTimingsReport>($I`CiLaneTimingsReport`)(
  {
    attemptOneJobCount: S.Finite,
    jobCount: S.Finite,
    managedInfraFailureCount: S.Finite,
    managedInfraSuccessRate: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    managedJobCount: S.Finite,
    medianAttemptOnePickupSeconds: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    rows: S.Array(CiLaneTimingRow),
    schemaVersion: S.Literal("ci-lane-timings/v1"),
  },
  $I.annote("CiLaneTimingsReport", {
    description: "Aggregates over one collected set of hosted lane timing rows.",
  })
) {}

const MANAGED_RUNNER_LABEL_PATTERN = /^(?:self-hosted|beep-)/u;
const GITHUB_HOSTED_LABEL_PATTERN = /^(?:ubuntu|windows|macos)-/u;
const SETUP_STEP_PATTERN = /^set up (?:job|runner)\b/u;
const INSTALL_STEP_PATTERN = /\b(?:bun install|install dependencies|setup-bun|npm ci|pnpm install)\b/u;

const epochMillis = (value: string | null): O.Option<number> =>
  pipe(O.fromNullishOr(value), O.filter(Str.isNonEmpty), O.flatMap(DateTime.make), O.map(DateTime.toEpochMillis));

/**
 * Seconds between two Actions timestamps, refusing garbled records.
 *
 * **Details**
 *
 * A negative span is not a fast job, it is a corrupt record — job payloads with
 * a `created_at` postdating their own `completed_at` were observed during a
 * live incident. Returning `None` keeps that fact distinguishable from zero.
 *
 * **Example** (Measure a thirty-second span)
 *
 * ```ts
 * import { ciTimestampSpanSeconds } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciTimestampSpanSeconds("2026-08-06T12:00:00Z", "2026-08-06T12:00:30Z"))
 * ```
 *
 * @param from - Earlier ISO timestamp, or null when absent.
 * @param to - Later ISO timestamp, or null when absent.
 * @returns Whole seconds between them, or `None` when absent or inverted.
 * @category mapping
 * @since 0.0.0
 */
export const ciTimestampSpanSeconds: {
  (to: string | null): (from: string | null) => O.Option<number>;
  (from: string | null, to: string | null): O.Option<number>;
} = dual(
  2,
  (from: string | null, to: string | null): O.Option<number> =>
    pipe(
      O.zipWith(epochMillis(from), epochMillis(to), (start, end) => (end - start) / 1_000),
      O.filter((seconds) => seconds >= 0)
    )
);

/**
 * Pickup latency for a job, defined only on the first attempt.
 *
 * **Details**
 *
 * This is the module's central law and the reason it exists. `run_started_at`
 * is rewritten when a run is re-dispatched, so any latency derived from a later
 * attempt measures how long a human took to click rerun. The filter lives here
 * so that no reader can reintroduce the artifact by forgetting it.
 *
 * Measured at job level (`started_at - created_at`) rather than run level,
 * because that is the number that survived audit during the incident: 19–67
 * seconds, against a run-level reading of 18–21 minutes for the same window.
 *
 * **Example** (Refuse pickup latency for a re-dispatched attempt)
 *
 * ```ts
 * import { attemptOnePickupSeconds, CiWorkflowJob } from "@beep/repo-cli/commands/Ci"
 *
 * const job = CiWorkflowJob.make({
 *   completed_at: "2026-08-06T12:10:00Z",
 *   conclusion: "success",
 *   created_at: "2026-08-06T12:00:00Z",
 *   id: 991,
 *   name: "Test Unit",
 *   run_attempt: 2,
 *   run_id: 42,
 *   started_at: "2026-08-06T12:18:00Z",
 *   status: "completed",
 * })
 * console.log(attemptOnePickupSeconds(job))
 * ```
 *
 * @param job - One collected job record.
 * @returns Seconds the job waited for a runner, or `None` past attempt 1.
 * @category mapping
 * @since 0.0.0
 */
export const attemptOnePickupSeconds = (job: CiWorkflowJob): O.Option<number> =>
  isCiWorkflowAttemptOneJob(job) ? ciTimestampSpanSeconds(job.created_at, job.started_at) : O.none();

const stepSecondsMatching = (job: CiWorkflowJob, pattern: RegExp): O.Option<number> =>
  pipe(
    job.steps,
    A.filter((step) => pattern.test(Str.toLowerCase(Str.trim(step.name)))),
    A.map((step) => ciTimestampSpanSeconds(step.started_at, step.completed_at)),
    A.getSomes,
    (seconds) => (A.isReadonlyArrayEmpty(seconds) ? O.none() : O.some(A.reduce(seconds, 0, (total, s) => total + s)))
  );

/**
 * Classify a job's runner pool from its labels.
 *
 * **Details**
 *
 * Labels are the only pool evidence a job record carries. A `self-hosted` label
 * or a fleet label this repo assigns marks a managed runner; GitHub's own image
 * labels mark the hosted pool; anything else stays `unknown` rather than being
 * guessed into a bucket that would move an infra-success rate.
 *
 * **Example** (Classify a self-hosted job)
 *
 * ```ts
 * import { ciRunnerClassForLabels } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciRunnerClassForLabels(["self-hosted", "linux"]))
 * ```
 *
 * @param labels - Runner labels the job requested.
 * @returns The runner pool the labels prove.
 * @category mapping
 * @since 0.0.0
 */
export const ciRunnerClassForLabels = (labels: ReadonlyArray<string>): CiRunnerClass => {
  const normalized = A.map(labels, (label) => Str.toLowerCase(Str.trim(label)));
  if (A.some(normalized, (label) => MANAGED_RUNNER_LABEL_PATTERN.test(label))) {
    return CiRunnerClass.Enum.managed;
  }
  return A.some(normalized, (label) => GITHUB_HOSTED_LABEL_PATTERN.test(label))
    ? CiRunnerClass.Enum["github-hosted"]
    : CiRunnerClass.Enum.unknown;
};

const jobShapeRecord = (job: CiWorkflowJob): GithubJobRecord =>
  GithubJobRecord.make({
    conclusion: job.conclusion,
    databaseId: job.id,
    name: job.name,
    status: job.status,
    steps: A.map(job.steps, (step) => GithubJobStepRecord.make({ conclusion: step.conclusion, name: step.name })),
  });

/**
 * Derive one lane-timing row from a collected job record.
 *
 * **Details**
 *
 * `infraFailure` reuses the shared job-shape classifier rather than restating
 * its rules, so the collector and the merge loop can never disagree about what
 * counts as an infrastructure failure — a control-plane setup failure, a lost
 * runner, or an install that died before any lane ran.
 *
 * **Example** (Derive a row from a first-attempt job)
 *
 * ```ts
 * import { ciLaneTimingRow, CiWorkflowJob } from "@beep/repo-cli/commands/Ci"
 *
 * const job = CiWorkflowJob.make({
 *   completed_at: "2026-08-06T12:10:00Z",
 *   conclusion: "success",
 *   created_at: "2026-08-06T12:00:00Z",
 *   id: 991,
 *   labels: ["self-hosted"],
 *   name: "Test Unit",
 *   run_attempt: 1,
 *   run_id: 42,
 *   started_at: "2026-08-06T12:00:30Z",
 *   status: "completed",
 * })
 * console.log(ciLaneTimingRow(job).runnerClass)
 * ```
 *
 * @param job - One collected job record.
 * @returns The row, with every derived column already filtered.
 * @category mapping
 * @since 0.0.0
 */
export const ciLaneTimingRow = (job: CiWorkflowJob): CiLaneTimingRow =>
  CiLaneTimingRow.make({
    conclusion: O.getOrElse(O.fromNullishOr(job.conclusion), () => job.status),
    durationSeconds: ciTimestampSpanSeconds(job.started_at, job.completed_at),
    infraFailure: O.isSome(detectGithubJobShapeClass(jobShapeRecord(job))),
    installSeconds: stepSecondsMatching(job, INSTALL_STEP_PATTERN),
    jobId: job.id,
    jobName: job.name,
    peakRssBytes: O.none(),
    pickupSeconds: attemptOnePickupSeconds(job),
    runAttempt: job.run_attempt,
    runId: job.run_id,
    runnerClass: ciRunnerClassForLabels(job.labels),
    setupSeconds: stepSecondsMatching(job, SETUP_STEP_PATTERN),
  });

/**
 * Attach out-of-band peak RSS measurements to collected rows.
 *
 * **When to use**
 *
 * Use when a runner-side step has written per-job peak RSS somewhere the
 * collector can read. No Actions API reports it, so without such a report every
 * row's `peakRssBytes` stays `None` — which is the honest value, not a zero.
 *
 * **Example** (Attach one measurement)
 *
 * ```ts
 * import { ciLaneTimingRow, CiWorkflowJob, withCiLanePeakRss } from "@beep/repo-cli/commands/Ci"
 *
 * const job = CiWorkflowJob.make({
 *   completed_at: "2026-08-06T12:10:00Z",
 *   conclusion: "success",
 *   created_at: "2026-08-06T12:00:00Z",
 *   id: 991,
 *   name: "Test Unit",
 *   run_attempt: 1,
 *   run_id: 42,
 *   started_at: "2026-08-06T12:00:30Z",
 *   status: "completed",
 * })
 * const rows = withCiLanePeakRss([ciLaneTimingRow(job)], { "Test Unit": 25_000_000_000 })
 * console.log(rows[0]?.peakRssBytes)
 * ```
 *
 * @param rows - Rows derived from collected jobs.
 * @param peakRssByJobName - Peak resident set size in bytes, keyed by job name.
 * @returns The same rows with peak RSS filled in where a measurement exists.
 * @category mapping
 * @since 0.0.0
 */
export const withCiLanePeakRss: {
  (
    peakRssByJobName: Readonly<Record<string, number>>
  ): (rows: ReadonlyArray<CiLaneTimingRow>) => ReadonlyArray<CiLaneTimingRow>;
  (
    rows: ReadonlyArray<CiLaneTimingRow>,
    peakRssByJobName: Readonly<Record<string, number>>
  ): ReadonlyArray<CiLaneTimingRow>;
} = dual(
  2,
  (
    rows: ReadonlyArray<CiLaneTimingRow>,
    peakRssByJobName: Readonly<Record<string, number>>
  ): ReadonlyArray<CiLaneTimingRow> =>
    A.map(rows, (row) => CiLaneTimingRow.make({ ...row, peakRssBytes: O.fromNullishOr(peakRssByJobName[row.jobName]) }))
);

const numberOrder = Order.Number;

const medianOf = (values: ReadonlyArray<number>): O.Option<number> =>
  pipe(A.sort(values, numberOrder), (sorted) => {
    const length = A.length(sorted);
    if (length === 0) {
      return O.none();
    }
    const middle = Math.floor(length / 2);
    return length % 2 === 0
      ? O.zipWith(
          O.fromNullishOr(sorted[middle - 1]),
          O.fromNullishOr(sorted[middle]),
          (left, right) => (left + right) / 2
        )
      : O.fromNullishOr(sorted[middle]);
  });

/**
 * Aggregate collected rows into the report operators read.
 *
 * **Details**
 *
 * The median pickup is taken over `pickupSeconds`, which already excludes every
 * attempt past the first, so the aggregate inherits the filter rather than
 * reapplying it. The managed-runner infra-success rate is the share of jobs on
 * runners this repo operates that did *not* fail before the repository ran; it
 * is `None` when no managed job was collected, because a rate over zero jobs is
 * not zero.
 *
 * **Example** (Aggregate an empty collection)
 *
 * ```ts
 * import { ciLaneTimingsReport } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciLaneTimingsReport([]).jobCount)
 * ```
 *
 * @param rows - Rows derived from collected jobs.
 * @returns The aggregate report.
 * @category mapping
 * @since 0.0.0
 */
export const ciLaneTimingsReport = (rows: ReadonlyArray<CiLaneTimingRow>): CiLaneTimingsReport => {
  const managed = A.filter(rows, (row) => row.runnerClass === "managed");
  const managedInfraFailureCount = A.length(A.filter(managed, (row) => row.infraFailure));
  const managedJobCount = A.length(managed);
  return CiLaneTimingsReport.make({
    attemptOneJobCount: A.length(A.filter(rows, (row) => row.runAttempt === 1)),
    jobCount: A.length(rows),
    managedInfraFailureCount,
    managedInfraSuccessRate:
      managedJobCount === 0 ? O.none() : O.some((managedJobCount - managedInfraFailureCount) / managedJobCount),
    managedJobCount,
    medianAttemptOnePickupSeconds: medianOf(A.getSomes(A.map(rows, (row) => row.pickupSeconds))),
    rows,
    schemaVersion: "ci-lane-timings/v1",
  });
};

const TSV_COLUMNS = [
  "runId",
  "runAttempt",
  "jobId",
  "jobName",
  "conclusion",
  "runnerClass",
  "infraFailure",
  "pickupSeconds",
  "setupSeconds",
  "installSeconds",
  "durationSeconds",
  "peakRssBytes",
] as const;

const tsvCell = (value: O.Option<number>): string => O.match(value, { onNone: () => "", onSome: String });

const TSV_FORMULA_PREFIXES = ["=", "+", "-", "@"] as const;

const tsvStringCell = (value: string): string => {
  const sanitized = Str.replaceAll(/[\t\r\n]/gu, " ")(value);
  return A.some(TSV_FORMULA_PREFIXES, (prefix) => Str.startsWith(prefix)(sanitized)) ? `'${sanitized}` : sanitized;
};

/**
 * Render collected rows as the TSV this repo's timing analyses consume.
 *
 * **Details**
 *
 * An absent measurement renders as an empty cell rather than `0`, so a
 * spreadsheet average over `pickupSeconds` skips re-dispatched attempts instead
 * of pulling the mean toward zero — the filter surviving all the way to the
 * last consumer. String cells are single-line and formula-leading values are
 * prefixed with a single quote so spreadsheet import treats them as text.
 *
 * **Example** (Render the header row)
 *
 * ```ts
 * import { renderCiLaneTimingsTsv } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(renderCiLaneTimingsTsv([]))
 * ```
 *
 * @param rows - Rows derived from collected jobs.
 * @returns A tab-separated table with one header row.
 * @category formatting
 * @since 0.0.0
 */
export const renderCiLaneTimingsTsv = (rows: ReadonlyArray<CiLaneTimingRow>): string =>
  A.join(
    [
      A.join(A.map(TSV_COLUMNS, tsvStringCell), "\t"),
      ...A.map(rows, (row) =>
        A.join(
          [
            String(row.runId),
            String(row.runAttempt),
            String(row.jobId),
            tsvStringCell(row.jobName),
            tsvStringCell(row.conclusion),
            tsvStringCell(row.runnerClass),
            String(row.infraFailure),
            tsvCell(row.pickupSeconds),
            tsvCell(row.setupSeconds),
            tsvCell(row.installSeconds),
            tsvCell(row.durationSeconds),
            tsvCell(row.peakRssBytes),
          ],
          "\t"
        )
      ),
    ],
    "\n"
  );

/**
 * Render the operator summary for one collected report.
 *
 * **Example** (Summarize an empty report)
 *
 * ```ts
 * import { ciLaneTimingsReport, renderCiLaneTimingsSummary } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(renderCiLaneTimingsSummary(ciLaneTimingsReport([])))
 * ```
 *
 * @param report - The aggregate report.
 * @returns A compact multi-line summary.
 * @category formatting
 * @since 0.0.0
 */
export const renderCiLaneTimingsSummary = (report: CiLaneTimingsReport): string =>
  A.join(
    [
      "ci lane timings",
      `- jobs: ${report.jobCount} (${report.attemptOneJobCount} on attempt 1)`,
      `- median attempt-1 pickup: ${O.match(report.medianAttemptOnePickupSeconds, {
        onNone: () => "no attempt-1 job carried both timestamps",
        onSome: (seconds) => `${seconds}s`,
      })}`,
      `- managed-runner jobs: ${report.managedJobCount} (${report.managedInfraFailureCount} infra failures)`,
      `- managed-runner infra success: ${O.match(report.managedInfraSuccessRate, {
        onNone: () => "no managed-runner jobs collected",
        onSome: (rate) => `${(rate * 100).toFixed(1)}%`,
      })}`,
    ],
    "\n"
  );

/**
 * Decode one page of the Actions jobs REST endpoint.
 *
 * **Example** (Reference the decoder)
 *
 * ```ts
 * import { decodeCiWorkflowJobsPage } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(decodeCiWorkflowJobsPage("{\"jobs\":[]}")))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeCiWorkflowJobsPage: {
  (options?: SchemaAST.ParseOptions): (input: unknown) => Effect.Effect<CiWorkflowJobsPage, S.SchemaError>;
  (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<CiWorkflowJobsPage, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(CiWorkflowJobsPage)));

class CiWorkflowRun extends S.Class<CiWorkflowRun>($I`CiWorkflowRun`)(
  { id: S.Finite },
  $I.annote("CiWorkflowRun", { description: "One workflow run identifier read while collecting lane timings." })
) {}

class CiWorkflowRunsPage extends S.Class<CiWorkflowRunsPage>($I`CiWorkflowRunsPage`)(
  { workflow_runs: S.Array(CiWorkflowRun) },
  $I.annote("CiWorkflowRunsPage", { description: "One page of workflow runs read while collecting lane timings." })
) {}

const decodeCiWorkflowRunsPage = S.decodeUnknownEffect(S.fromJsonString(CiWorkflowRunsPage));

const CI_WORKFLOW_RUNS_JQ = "{total_count,workflow_runs:[.workflow_runs[]|{created_at,event,head_sha,id,run_attempt}]}";
const CI_LEGACY_WORKFLOW_JOBS_JQ =
  "{total_count,jobs:[.jobs[]|{completed_at,conclusion,created_at,id,labels,name,run_attempt,run_id,runner_name,started_at,status,steps}]}";
const CI_WINDOW_WORKFLOW_JOBS_JQ =
  "{total_count,jobs:[.jobs[]|{completed_at,conclusion,created_at,id,name,run_attempt,run_id,started_at,status}]}";
const CI_BRANCH_RULES_JQ = "[.[]|{ruleset_id,type}+(if .parameters==null then {} else {parameters} end)]";

const ghApiJson = Effect.fn("Ci.laneTimingsGhApi")(function* (
  repoRoot: string,
  endpoint: string,
  jqProjection: O.Option<string>
): Effect.fn.Return<string, CiCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const args = A.appendAll(
    ["api", endpoint],
    A.flatMap(O.toArray(jqProjection), (projection) => ["--jq", projection])
  );
  const result = yield* runRepoCommandCapture("gh", args, repoRoot).pipe(
    CiCommandError.mapError(`Failed to run gh api ${endpoint}.`)
  );
  if (result.exitCode !== 0 || result.truncated) {
    return yield* CiCommandError.make({
      message: result.truncated
        ? `gh api ${endpoint} returned a truncated response.`
        : `gh api ${endpoint} exited ${result.exitCode}: ${result.output}`,
    });
  }
  return result.output;
});

type CiWorkflowJobsPageFetcher<Requirements> = (
  repoRoot: string,
  runId: number,
  perPage: number,
  pageNumber: number
) => Effect.Effect<string, CiCommandError, Requirements>;

const ciWorkflowJobsEndpoint = (runId: number, perPage: number, pageNumber: number): string =>
  `repos/{owner}/{repo}/actions/runs/${runId}/jobs?filter=all&per_page=${perPage}&page=${pageNumber}`;

const fetchLegacyCiWorkflowJobsPage = Effect.fn("Ci.fetchLegacyCiWorkflowJobsPage")(function* (
  repoRoot: string,
  runId: number,
  perPage: number,
  pageNumber: number
): Effect.fn.Return<string, CiCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* ghApiJson(
    repoRoot,
    ciWorkflowJobsEndpoint(runId, perPage, pageNumber),
    O.some(CI_LEGACY_WORKFLOW_JOBS_JQ)
  );
});

const collectCiWorkflowJobPages = Effect.fn("Ci.collectCiWorkflowJobPages")(function* <Requirements>(
  fetchPage: CiWorkflowJobsPageFetcher<Requirements>,
  repoRoot: string,
  runId: number,
  perPage: number,
  pageNumber = 1,
  collected: ReadonlyArray<CiWorkflowJob> = A.empty()
): Effect.fn.Return<ReadonlyArray<CiWorkflowJob>, CiCommandError, Requirements> {
  const json = yield* fetchPage(repoRoot, runId, perPage, pageNumber);
  const page = yield* decodeCiWorkflowJobsPage(json).pipe(
    CiCommandError.mapError(`Failed to decode jobs page ${pageNumber} for run ${runId}.`)
  );
  const jobs = A.appendAll(collected, page.jobs);
  if (A.length(jobs) >= page.total_count) {
    return jobs;
  }
  return yield* A.match(page.jobs, {
    onEmpty: () =>
      CiCommandError.make({
        message: `Jobs pagination for run ${runId} ended after ${A.length(jobs)} of ${page.total_count} jobs.`,
      }),
    onNonEmpty: () => collectCiWorkflowJobPages(fetchPage, repoRoot, runId, perPage, pageNumber + 1, jobs),
  });
});

/**
 * Collect lane timings for the most recent workflow runs.
 *
 * **When to use**
 *
 * Use to refresh the timing corpus this repo's CI analyses read, or to check a
 * claim about runner wait before it justifies a project. Every derived column
 * is already filtered, so the rows can be consumed directly.
 *
 * **Gotchas**
 *
 * Reads jobs, not runs, for the pickup number. The run-level record is the one
 * GitHub rewrites on re-dispatch; the job record carries `run_attempt`, which
 * is what makes the filter possible at all.
 *
 * API failures, truncated captures, and invalid payloads fail the collection.
 * Returning an empty or partial corpus would make unavailable evidence look
 * like a successful observation of zero runs or jobs.
 *
 * **Example** (Collect timings through the test seam)
 *
 * ```ts
 * import { collectCiLaneTimings } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const collected = collectCiLaneTimings(".", 5).pipe(Effect.map((report) => report.jobCount))
 * console.log(Effect.isEffect(collected))
 * ```
 *
 * @param repoRoot - Repository root the `gh` calls run in.
 * @param runLimit - How many recent workflow runs to read jobs for.
 * @returns The aggregate report over every job that could be collected.
 * @category use-cases
 * @since 0.0.0
 */
export const collectCiLaneTimings = Effect.fn("Ci.collectCiLaneTimings")(function* (
  repoRoot: string,
  runLimit: number
): Effect.fn.Return<CiLaneTimingsReport, CiCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  if (runLimit < 1 || runLimit > 100) {
    return yield* CiCommandError.make({ message: `--runs must be between 1 and 100; received ${runLimit}.` });
  }
  const runsJson = yield* ghApiJson(
    repoRoot,
    `repos/{owner}/{repo}/actions/runs?per_page=${runLimit}`,
    O.some(CI_WORKFLOW_RUNS_JQ)
  );
  const runs = yield* decodeCiWorkflowRunsPage(runsJson).pipe(
    Effect.map((page) => page.workflow_runs),
    CiCommandError.mapError("Failed to decode the workflow-runs response.")
  );
  const jobPages = yield* Effect.forEach(
    runs,
    (run) => collectCiWorkflowJobPages(fetchLegacyCiWorkflowJobsPage, repoRoot, run.id, 100),
    { concurrency: 4 }
  );
  return ciLaneTimingsReport(A.map(A.flatten(jobPages), ciLaneTimingRow));
});

/**
 * Event selection for a bounded workflow-run census.
 *
 * **Example** (List supported census event selections)
 *
 * ```ts
 * import { CiLaneTimingWindowEvent } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiLaneTimingWindowEvent.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiLaneTimingWindowEvent = LiteralKit(["pull_request", "push", "all"]).pipe(
  $I.annoteSchema("CiLaneTimingWindowEvent", {
    description: "Workflow event population selected for a bounded CI lane-timing census.",
  })
);

/**
 * Event selection for a bounded workflow-run census.
 *
 * **Example** (Type a pull-request census selection)
 *
 * ```ts
 * import type { CiLaneTimingWindowEvent } from "@beep/repo-cli/commands/Ci"
 *
 * const event: CiLaneTimingWindowEvent = "pull_request"
 * console.log(event)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiLaneTimingWindowEvent = typeof CiLaneTimingWindowEvent.Type;

const CiLaneTimingWindowRunEvent = LiteralKit(["pull_request", "push"]).pipe(
  $I.annoteSchema("CiLaneTimingWindowRunEvent", {
    description: "Concrete GitHub Actions event retained on a census run and every derived row.",
  })
);

const NonNegativeTimingSeconds = S.Finite.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("NonNegativeTimingSeconds", {
    description: "Non-negative elapsed seconds admitted into a CI timing observation.",
  })
);

/**
 * Validated bounds and filters for a half-open workflow-run census.
 *
 * **Details**
 *
 * The decoded interval is UTC and half-open: a run at `since` is eligible and
 * a run at `until` is not. Push selections without an explicit branch query
 * `main`; pull-request selections remain unbounded by branch unless supplied.
 *
 * **Example** (Describe one UTC census window)
 *
 * ```ts
 * import { CiLaneTimingWindowOptions } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const options = CiLaneTimingWindowOptions.make({
 *   branch: O.none(),
 *   event: "all",
 *   headSha: O.none(),
 *   since: DateTime.makeUnsafe("2026-09-04T00:00:00Z"),
 *   until: DateTime.makeUnsafe("2026-09-11T00:00:00Z"),
 *   workflow: "check.yml",
 * })
 * console.log(options.event)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneTimingWindowOptions extends S.Class<CiLaneTimingWindowOptions>($I`CiLaneTimingWindowOptions`)(
  {
    branch: S.OptionFromOptionalKey(S.NonEmptyString),
    event: CiLaneTimingWindowEvent,
    headSha: S.OptionFromOptionalKey(S.NonEmptyString),
    since: S.DateTimeUtcFromString,
    until: S.DateTimeUtcFromString,
    workflow: S.NonEmptyString,
  },
  $I.annote("CiLaneTimingWindowOptions", {
    description: "Validated UTC interval, workflow, event, branch, and head filters for a lane-timing census.",
  })
) {}

/**
 * Workflow-run provenance retained before the jobs join.
 *
 * **Example** (Construct one run provenance record)
 *
 * ```ts
 * import { CiWorkflowWindowRun } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 *
 * const run = CiWorkflowWindowRun.make({
 *   created_at: DateTime.makeUnsafe("2026-09-04T00:00:00Z"),
 *   event: "pull_request",
 *   head_sha: "0123456789abcdef",
 *   id: 42,
 *   run_attempt: 1,
 * })
 * console.log(run.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiWorkflowWindowRun extends S.Class<CiWorkflowWindowRun>($I`CiWorkflowWindowRun`)(
  {
    created_at: S.DateTimeUtcFromString,
    event: CiLaneTimingWindowRunEvent,
    head_sha: S.NonEmptyString,
    id: S.Finite,
    run_attempt: S.Finite,
  },
  $I.annote("CiWorkflowWindowRun", {
    description: "Workflow-run identity, event, head, creation time, and attempt retained by the census.",
  })
) {}

/**
 * One ordered workflow run paired with its isolated jobs buffer.
 *
 * **Example** (Pair a run with an empty jobs buffer)
 *
 * ```ts
 * import { CiWorkflowWindowRun, CiWorkflowWindowRunJobs } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 *
 * const run = CiWorkflowWindowRun.make({
 *   created_at: DateTime.makeUnsafe("2026-09-04T00:00:00Z"),
 *   event: "push",
 *   head_sha: "0123456789abcdef",
 *   id: 42,
 *   run_attempt: 1,
 * })
 * console.log(CiWorkflowWindowRunJobs.make({ jobs: [], run }).jobs.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiWorkflowWindowRunJobs extends S.Class<CiWorkflowWindowRunJobs>($I`CiWorkflowWindowRunJobs`)(
  {
    jobs: S.Array(CiWorkflowJob),
    run: CiWorkflowWindowRun,
  },
  $I.annote("CiWorkflowWindowRunJobs", {
    description: "One ordered workflow run and the fully paginated jobs fetched into its isolated buffer.",
  })
) {}

const CiLaneTimingAttributionKind = LiteralKit([
  "failure",
  "cancelled",
  "later-attempt",
  "invalid-span",
  "incomplete-effective-span",
]).pipe(
  $I.annoteSchema("CiLaneTimingAttributionKind", {
    description: "Reason a required-lane observation stays outside the successful attempt-one percentile population.",
  })
);

const timingRowProvenanceFields = {
  event: CiLaneTimingWindowRunEvent,
  headSha: S.NonEmptyString,
  lane: S.NonEmptyString,
  runAttempt: S.Finite,
  runCreatedAt: S.DateTimeUtc,
  runId: S.Finite,
};

class CiLaneTimingDurationRow extends S.Class<CiLaneTimingDurationRow>($I`CiLaneTimingDurationRow`)(
  {
    ...timingRowProvenanceFields,
    population: S.tag("duration"),
    conclusion: S.Literal("success"),
    durationSeconds: NonNegativeTimingSeconds,
    jobName: S.NonEmptyString,
    pickupSeconds: S.Option(NonNegativeTimingSeconds),
    runAttempt: S.Literal(1),
  },
  $I.annote("CiLaneTimingDurationRow", {
    description: "Attempt-one successful non-negative required-lane duration with complete workflow-run provenance.",
  })
) {}

class CiLaneTimingAttributionRow extends S.Class<CiLaneTimingAttributionRow>($I`CiLaneTimingAttributionRow`)(
  {
    ...timingRowProvenanceFields,
    population: S.tag("attribution"),
    attribution: CiLaneTimingAttributionKind,
    conclusion: S.String,
    jobName: S.NonEmptyString,
  },
  $I.annote("CiLaneTimingAttributionRow", {
    description: "Excluded required-lane observation with provenance and a schema-bounded attribution reason.",
  })
) {}

class CiLaneTimingPickupRow extends S.Class<CiLaneTimingPickupRow>($I`CiLaneTimingPickupRow`)(
  {
    ...timingRowProvenanceFields,
    population: S.tag("pickup"),
    conclusion: S.String,
    jobName: S.NonEmptyString,
    pickupSeconds: NonNegativeTimingSeconds,
    runAttempt: S.Literal(1),
  },
  $I.annote("CiLaneTimingPickupRow", {
    description: "Attempt-one shard pickup latency retained separately from every required-lane wall duration.",
  })
) {}

const CiLaneTimingWindowRow = S.Union([
  CiLaneTimingDurationRow,
  CiLaneTimingAttributionRow,
  CiLaneTimingPickupRow,
]).pipe(
  S.toTaggedUnion("population"),
  $I.annoteSchema("CiLaneTimingWindowRow", {
    description: "Derived duration, attribution, or pickup observation with complete run provenance.",
  })
);
type CiLaneTimingWindowRow = typeof CiLaneTimingWindowRow.Type;

/**
 * Nearest-rank latency statistics for one required lane.
 *
 * **Example** (Describe an empty fail-closed lane)
 *
 * ```ts
 * import { CiLaneTimingWindowStat } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const stat = CiLaneTimingWindowStat.make({
 *   lane: "Lint",
 *   maxSeconds: O.none(),
 *   n: 0,
 *   p50Seconds: O.none(),
 *   p95Seconds: O.none(),
 *   pr: 0,
 *   push: 0,
 *   state: "Breach",
 * })
 * console.log(stat.state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneTimingWindowStat extends S.Class<CiLaneTimingWindowStat>($I`CiLaneTimingWindowStat`)(
  {
    lane: S.NonEmptyString,
    maxSeconds: S.Option(NonNegativeTimingSeconds),
    n: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    p50Seconds: S.Option(NonNegativeTimingSeconds),
    p95Seconds: S.Option(NonNegativeTimingSeconds),
    pr: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    push: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    state: LiteralKit(["Pass", "Breach"]),
  },
  $I.annote("CiLaneTimingWindowStat", {
    description: "Per-required-lane count split and nearest-rank latency statistics against the 20-minute charter.",
  })
) {}

/**
 * Excluded-observation counts for one required lane.
 *
 * **Example** (Describe a lane without excluded observations)
 *
 * ```ts
 * import { CiLaneTimingAttributionStat } from "@beep/repo-cli/commands/Ci"
 *
 * const stat = CiLaneTimingAttributionStat.make({
 *   cancellations: 0,
 *   failures: 0,
 *   incompleteEffectiveSpans: 0,
 *   invalidSpans: 0,
 *   lane: "Lint",
 *   laterCancellations: 0,
 *   laterFailures: 0,
 *   laterAttempts: 0,
 *   laterSuccesses: 0,
 * })
 * console.log(stat.laterAttempts)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneTimingAttributionStat extends S.Class<CiLaneTimingAttributionStat>($I`CiLaneTimingAttributionStat`)(
  {
    cancellations: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    failures: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    incompleteEffectiveSpans: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    invalidSpans: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    lane: S.NonEmptyString,
    laterCancellations: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    laterFailures: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    laterAttempts: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    laterSuccesses: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  },
  $I.annote("CiLaneTimingAttributionStat", {
    description: "Failure, cancellation, later-attempt outcome, invalid-span, and incomplete-span counts for one lane.",
  })
) {}

/**
 * Shard pickup statistics used by the five-minute queue tripwire.
 *
 * **Example** (Describe an unavailable pickup population)
 *
 * ```ts
 * import { CiLaneTimingPickupStat } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const stat = CiLaneTimingPickupStat.make({
 *   breached: false,
 *   maxSeconds: O.none(),
 *   n: 0,
 *   p50Seconds: O.none(),
 *   p95Seconds: O.none(),
 * })
 * console.log(stat.n)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneTimingPickupStat extends S.Class<CiLaneTimingPickupStat>($I`CiLaneTimingPickupStat`)(
  {
    breached: S.Boolean,
    maxSeconds: S.Option(NonNegativeTimingSeconds),
    n: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    p50Seconds: S.Option(NonNegativeTimingSeconds),
    p95Seconds: S.Option(NonNegativeTimingSeconds),
  },
  $I.annote("CiLaneTimingPickupStat", {
    description: "Nearest-rank shard pickup statistics and the greater-than-five-minute queue tripwire verdict.",
  })
) {}

/**
 * Reproducible admission-census report over one bounded UTC window.
 *
 * **Details**
 *
 * Raw Actions pages and job buffers are not retained. The report holds only
 * schema-classified duration, attribution, and shard-pickup rows plus their
 * aggregates, preserving provenance without turning API payloads into a
 * long-lived in-memory corpus.
 *
 * **Example** (Build a report effect)
 *
 * ```ts
 * import { buildCiLaneTimingWindowReport } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const report = buildCiLaneTimingWindowReport([], [])
 * console.log(Effect.isEffect(report))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneTimingWindowReport extends S.Class<CiLaneTimingWindowReport>($I`CiLaneTimingWindowReport`)(
  {
    attribution: S.Array(CiLaneTimingAttributionStat),
    contextCount: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    laneStats: S.Array(CiLaneTimingWindowStat),
    pickup: CiLaneTimingPickupStat,
    requiredContexts: S.Array(S.NonEmptyString),
    rows: S.Array(CiLaneTimingWindowRow),
    runCount: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    schemaVersion: S.Literal("ci-lane-timing-window/v1"),
  },
  $I.annote("CiLaneTimingWindowReport", {
    description: "Derived rows and aggregates for a bounded admission census over the live required-context set.",
  })
) {}

const CI_LANE_TIMING_RULESET_ID = 10_240_248;
const CI_LANE_TIMING_REQUIRED_CONTEXT_COUNT = 18;
const CI_LANE_TIMING_CHARTER = Duration.minutes(20);
const CI_LANE_TIMING_QUEUE_TRIPWIRE = Duration.minutes(5);
const CI_LANE_TIMING_JOB_FETCH_CONCURRENCY = 8;
const HEAVY_LANE_PREFIX = "Heavy / ";

class CiEffectiveLaneSpec extends S.Class<CiEffectiveLaneSpec>($I`CiEffectiveLaneSpec`)(
  {
    aggregator: S.NonEmptyString,
    lane: S.NonEmptyString,
    shards: S.NonEmptyArray(S.NonEmptyString),
  },
  $I.annote("CiEffectiveLaneSpec", {
    description: "Required aggregator and complete shard-name set used to derive one effective lane span.",
  })
) {}

const CI_EFFECTIVE_LANE_SPECS: ReadonlyArray<CiEffectiveLaneSpec> = [
  CiEffectiveLaneSpec.make({ aggregator: "Lint", lane: "Lint", shards: ["Lint (lint-a)", "Lint (lint-b)"] }),
  CiEffectiveLaneSpec.make({
    aggregator: "Test Unit",
    lane: "Test Unit",
    shards: ["Test Unit (repo-cli)", "Test Unit (unit-a)", "Test Unit (unit-b)"],
  }),
];

class CiWorkflowWindowRunsPage extends S.Class<CiWorkflowWindowRunsPage>($I`CiWorkflowWindowRunsPage`)(
  {
    total_count: S.Finite,
    workflow_runs: S.Array(CiWorkflowWindowRun),
  },
  $I.annote("CiWorkflowWindowRunsPage", {
    description: "One paginated GitHub Actions workflow-runs response for a bounded census query.",
  })
) {}

class CiRequiredStatusCheck extends S.Class<CiRequiredStatusCheck>($I`CiRequiredStatusCheck`)(
  { context: S.NonEmptyString },
  $I.annote("CiRequiredStatusCheck", {
    description: "One required status-check context returned by an effective branch rule.",
  })
) {}

class CiBranchRuleParameters extends S.Class<CiBranchRuleParameters>($I`CiBranchRuleParameters`)(
  {
    required_status_checks: S.Array(CiRequiredStatusCheck).pipe(SchemaUtils.withKeyDefaults([])),
  },
  $I.annote("CiBranchRuleParameters", {
    description: "Required-status-check parameters retained from an effective branch rule.",
  })
) {}

class CiBranchRule extends S.Class<CiBranchRule>($I`CiBranchRule`)(
  {
    parameters: S.OptionFromOptionalKey(CiBranchRuleParameters),
    ruleset_id: S.Finite,
    type: S.String,
  },
  $I.annote("CiBranchRule", {
    description: "Effective GitHub branch rule carrying its source ruleset identifier and optional parameters.",
  })
) {}

const decodeCiWorkflowWindowRunsPage = S.decodeUnknownEffect(S.fromJsonString(CiWorkflowWindowRunsPage));
const decodeCiBranchRules = S.decodeUnknownEffect(S.fromJsonString(S.Array(CiBranchRule)));

/**
 * GitHub JSON boundary used by the bounded lane-timing collector.
 *
 * **Example** (Name the client operation)
 *
 * ```ts
 * import type { CiLaneTimingGithubClientShape } from "@beep/repo-cli/commands/Ci"
 *
 * const operation = <K extends keyof CiLaneTimingGithubClientShape>(name: K): K => name
 * console.log(operation("getJson"))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface CiLaneTimingGithubClientShape {
  readonly getJson: (
    repoRoot: string,
    endpoint: string,
    jqProjection: O.Option<string>
  ) => Effect.Effect<string, CiCommandError>;
}

/**
 * Service tag for paginated lane-timing GitHub reads.
 *
 * **Example** (Access the client service)
 *
 * ```ts
 * import { CiLaneTimingGithubClient } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.service(CiLaneTimingGithubClient)))
 * ```
 *
 * @category clients
 * @since 0.0.0
 */
export class CiLaneTimingGithubClient extends Context.Service<
  CiLaneTimingGithubClient,
  CiLaneTimingGithubClientShape
>()($I`CiLaneTimingGithubClient`) {}

const makeCiLaneTimingGithubClient = Effect.fn("CiLaneTimingGithubClient.make")(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return CiLaneTimingGithubClient.of({
    getJson: Effect.fn("CiLaneTimingGithubClient.getJson")((repoRoot, endpoint, jqProjection) =>
      ghApiJson(repoRoot, endpoint, jqProjection).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      )
    ),
  });
});

const normalizeRequiredLaneName = (name: string): string =>
  Str.startsWith(HEAVY_LANE_PREFIX)(name) ? Str.slice(Str.length(HEAVY_LANE_PREFIX))(name) : name;

const effectiveLaneSpecForJobName = (name: string): O.Option<CiEffectiveLaneSpec> =>
  A.findFirst(
    CI_EFFECTIVE_LANE_SPECS,
    (spec) =>
      Str.equivalence(spec.aggregator, name) || A.some(spec.shards, (shardName) => Str.equivalence(shardName, name))
  );

const windowRunOrder = Order.combine(
  Order.mapInput(Order.Number, (run: CiWorkflowWindowRun) => DateTime.toEpochMillis(run.created_at)),
  Order.mapInput(Order.Number, (run: CiWorkflowWindowRun) => run.id)
);

const windowEventsFor = (event: CiLaneTimingWindowEvent): ReadonlyArray<typeof CiLaneTimingWindowRunEvent.Type> =>
  CiLaneTimingWindowEvent.$match(event, {
    all: () => CiLaneTimingWindowRunEvent.Options,
    pull_request: () => [CiLaneTimingWindowRunEvent.Enum.pull_request],
    push: () => [CiLaneTimingWindowRunEvent.Enum.push],
  });

const branchForWindowEvent = (
  options: CiLaneTimingWindowOptions,
  event: typeof CiLaneTimingWindowRunEvent.Type
): O.Option<string> =>
  CiLaneTimingWindowRunEvent.$match(event, {
    pull_request: () => options.branch,
    push: () => O.orElse(options.branch, () => O.some("main")),
  });

const workflowRunsEndpoint = (
  options: CiLaneTimingWindowOptions,
  event: typeof CiLaneTimingWindowRunEvent.Type,
  pageNumber: number
): string => {
  const query = [
    `created=${encodeURIComponent(`${DateTime.formatIso(options.since)}..${DateTime.formatIso(options.until)}`)}`,
    `event=${event}`,
    ...A.map(O.toArray(branchForWindowEvent(options, event)), (branch) => `branch=${encodeURIComponent(branch)}`),
    "per_page=100",
    `page=${pageNumber}`,
  ];
  return `repos/{owner}/{repo}/actions/workflows/${encodeURIComponent(options.workflow)}/runs?${A.join(query, "&")}`;
};

const runIsInsideWindow = (options: CiLaneTimingWindowOptions, run: CiWorkflowWindowRun): boolean => {
  const createdAt = DateTime.toEpochMillis(run.created_at);
  const insideBounds =
    createdAt >= DateTime.toEpochMillis(options.since) && createdAt < DateTime.toEpochMillis(options.until);
  const matchesHead = O.match(options.headSha, {
    onNone: () => true,
    onSome: (headSha) => Str.equivalence(headSha, run.head_sha),
  });
  return insideBounds && matchesHead;
};

const collectCiWorkflowWindowRunPages = Effect.fn("Ci.collectCiWorkflowWindowRunPages")(function* (
  repoRoot: string,
  options: CiLaneTimingWindowOptions,
  event: typeof CiLaneTimingWindowRunEvent.Type,
  pageNumber: number,
  fetchedCount: number,
  collected: ReadonlyArray<CiWorkflowWindowRun>
): Effect.fn.Return<ReadonlyArray<CiWorkflowWindowRun>, CiCommandError, CiLaneTimingGithubClient> {
  const github = yield* CiLaneTimingGithubClient;
  const endpoint = workflowRunsEndpoint(options, event, pageNumber);
  const json = yield* github.getJson(repoRoot, endpoint, O.some(CI_WORKFLOW_RUNS_JQ));
  const page = yield* decodeCiWorkflowWindowRunsPage(json).pipe(
    CiCommandError.mapError(`Failed to decode ${event} workflow-runs page ${pageNumber}.`)
  );
  const nextFetchedCount = fetchedCount + A.length(page.workflow_runs);
  const nextCollected = A.appendAll(
    collected,
    A.filter(page.workflow_runs, (run) => runIsInsideWindow(options, run))
  );
  if (nextFetchedCount >= page.total_count) {
    return nextCollected;
  }
  return yield* A.match(page.workflow_runs, {
    onEmpty: () =>
      CiCommandError.make({
        message: `${event} workflow-runs pagination ended after ${nextFetchedCount} of ${page.total_count} runs.`,
      }),
    onNonEmpty: () =>
      collectCiWorkflowWindowRunPages(repoRoot, options, event, pageNumber + 1, nextFetchedCount, nextCollected),
  });
});

const collectCiWorkflowWindowRuns = Effect.fn("Ci.collectCiWorkflowWindowRuns")(function* (
  repoRoot: string,
  options: CiLaneTimingWindowOptions
): Effect.fn.Return<ReadonlyArray<CiWorkflowWindowRun>, CiCommandError, CiLaneTimingGithubClient> {
  const eventRuns = yield* Effect.forEach(
    windowEventsFor(options.event),
    (event) => collectCiWorkflowWindowRunPages(repoRoot, options, event, 1, 0, A.empty()),
    { concurrency: 2 }
  );
  const indexed = A.reduce(A.flatten(eventRuns), HashMap.empty<number, CiWorkflowWindowRun>(), (runs, run) =>
    HashMap.set(runs, run.id, run)
  );
  return A.sort(A.fromIterable(HashMap.values(indexed)), windowRunOrder);
});

const fetchCiWorkflowWindowJobsPage = Effect.fn("Ci.fetchCiWorkflowWindowJobsPage")(function* (
  repoRoot: string,
  runId: number,
  perPage: number,
  pageNumber: number
): Effect.fn.Return<string, CiCommandError, CiLaneTimingGithubClient> {
  const github = yield* CiLaneTimingGithubClient;
  return yield* github.getJson(
    repoRoot,
    ciWorkflowJobsEndpoint(runId, perPage, pageNumber),
    O.some(CI_WINDOW_WORKFLOW_JOBS_JQ)
  );
});

const collectRequiredContexts = Effect.fn("Ci.collectRequiredContexts")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, CiCommandError, CiLaneTimingGithubClient> {
  const github = yield* CiLaneTimingGithubClient;
  const endpoint = "repos/{owner}/{repo}/rules/branches/main";
  const json = yield* github.getJson(repoRoot, endpoint, O.some(CI_BRANCH_RULES_JQ));
  const rules = yield* decodeCiBranchRules(json).pipe(
    CiCommandError.mapError(`Failed to decode the effective rules returned by ${endpoint}.`)
  );
  return pipe(
    rules,
    A.filter(
      (rule) => rule.ruleset_id === CI_LANE_TIMING_RULESET_ID && Str.equivalence(rule.type, "required_status_checks")
    ),
    A.flatMap((rule) =>
      O.match(rule.parameters, {
        onNone: A.empty<string>,
        onSome: (parameters) => A.map(parameters.required_status_checks, (check) => check.context),
      })
    )
  );
});

const actionConclusion = (job: CiWorkflowJob): string => O.getOrElse(O.fromNullishOr(job.conclusion), () => job.status);

const laterAttemptRowForJob = (
  run: CiWorkflowWindowRun,
  lane: string,
  job: CiWorkflowJob
): CiLaneTimingAttributionRow =>
  CiLaneTimingAttributionRow.make({
    attribution: "later-attempt",
    conclusion: actionConclusion(job),
    event: run.event,
    headSha: run.head_sha,
    jobName: job.name,
    lane,
    runAttempt: job.run_attempt,
    runCreatedAt: run.created_at,
    runId: run.id,
  });

const durationRowForAttemptOneJob = (
  run: CiWorkflowWindowRun,
  lane: string,
  job: CiWorkflowAttemptOneJob
): CiLaneTimingWindowRow => {
  const conclusion = actionConclusion(job);
  if (!Str.equivalence(conclusion, "success")) {
    return CiLaneTimingAttributionRow.make({
      attribution: Str.equivalence(conclusion, "cancelled") ? "cancelled" : "failure",
      conclusion,
      event: run.event,
      headSha: run.head_sha,
      jobName: job.name,
      lane,
      runAttempt: 1,
      runCreatedAt: run.created_at,
      runId: run.id,
    });
  }
  return O.match(ciTimestampSpanSeconds(job.started_at, job.completed_at), {
    onNone: () =>
      CiLaneTimingAttributionRow.make({
        attribution: "invalid-span",
        conclusion,
        event: run.event,
        headSha: run.head_sha,
        jobName: job.name,
        lane,
        runAttempt: 1,
        runCreatedAt: run.created_at,
        runId: run.id,
      }),
    onSome: (durationSeconds) =>
      CiLaneTimingDurationRow.make({
        conclusion: "success",
        durationSeconds,
        event: run.event,
        headSha: run.head_sha,
        jobName: job.name,
        lane,
        pickupSeconds: attemptOnePickupSeconds(job),
        runAttempt: 1,
        runCreatedAt: run.created_at,
        runId: run.id,
      }),
  });
};

const attemptOneJobNamed = (
  jobs: ReadonlyArray<CiWorkflowAttemptOneJob>,
  name: string
): O.Option<CiWorkflowAttemptOneJob> => {
  const matches = A.filter(jobs, (job) => Str.equivalence(job.name, name));
  return A.length(matches) === 1 ? A.head(matches) : O.none();
};

const incompleteEffectiveRow = (run: CiWorkflowWindowRun, spec: CiEffectiveLaneSpec): CiLaneTimingAttributionRow =>
  CiLaneTimingAttributionRow.make({
    attribution: "incomplete-effective-span",
    conclusion: "incomplete",
    event: run.event,
    headSha: run.head_sha,
    jobName: spec.aggregator,
    lane: spec.lane,
    runAttempt: 1,
    runCreatedAt: run.created_at,
    runId: run.id,
  });

const effectiveDurationRow = (
  run: CiWorkflowWindowRun,
  jobs: ReadonlyArray<CiWorkflowAttemptOneJob>,
  spec: CiEffectiveLaneSpec
): CiLaneTimingWindowRow => {
  const expectedNames = A.prepend(spec.shards, spec.aggregator);
  const componentOptions = A.map(expectedNames, (name) => attemptOneJobNamed(jobs, name));
  const components = A.getSomes(componentOptions);
  if (A.length(components) !== A.length(expectedNames)) {
    return incompleteEffectiveRow(run, spec);
  }
  const conclusions = A.map(components, actionConclusion);
  if (!A.every(conclusions, (conclusion) => Str.equivalence(conclusion, "success"))) {
    const cancelled = A.some(conclusions, (conclusion) => Str.equivalence(conclusion, "cancelled"));
    return CiLaneTimingAttributionRow.make({
      attribution: cancelled ? "cancelled" : "failure",
      conclusion: cancelled ? "cancelled" : "failure",
      event: run.event,
      headSha: run.head_sha,
      jobName: spec.aggregator,
      lane: spec.lane,
      runAttempt: 1,
      runCreatedAt: run.created_at,
      runId: run.id,
    });
  }
  const shardStartedAtMillis = A.getSomes(
    A.map(spec.shards, (shardName) =>
      O.flatMap(attemptOneJobNamed(jobs, shardName), (job) => epochMillis(job.started_at))
    )
  );
  const aggregatorCompletedAtMillis = O.flatMap(attemptOneJobNamed(jobs, spec.aggregator), (job) =>
    epochMillis(job.completed_at)
  );
  const earliestStartedAtMillis = A.head(A.sort(shardStartedAtMillis, Order.Number));
  const durationSeconds = pipe(
    O.zipWith(
      earliestStartedAtMillis,
      aggregatorCompletedAtMillis,
      (startedAt, completedAt) => (completedAt - startedAt) / 1_000
    ),
    O.filter((seconds) => seconds >= 0),
    O.filter(() => A.length(shardStartedAtMillis) === A.length(spec.shards))
  );
  return O.match(durationSeconds, {
    onNone: () =>
      CiLaneTimingAttributionRow.make({
        attribution: "invalid-span",
        conclusion: "success",
        event: run.event,
        headSha: run.head_sha,
        jobName: spec.aggregator,
        lane: spec.lane,
        runAttempt: 1,
        runCreatedAt: run.created_at,
        runId: run.id,
      }),
    onSome: (seconds) =>
      CiLaneTimingDurationRow.make({
        conclusion: "success",
        durationSeconds: seconds,
        event: run.event,
        headSha: run.head_sha,
        jobName: spec.aggregator,
        lane: spec.lane,
        pickupSeconds: O.none(),
        runAttempt: 1,
        runCreatedAt: run.created_at,
        runId: run.id,
      }),
  });
};

const shardPickupRows = (
  run: CiWorkflowWindowRun,
  jobs: ReadonlyArray<CiWorkflowAttemptOneJob>
): ReadonlyArray<CiLaneTimingPickupRow> =>
  A.flatMap(CI_EFFECTIVE_LANE_SPECS, (spec) =>
    pipe(
      jobs,
      A.filter((job) => A.some(spec.shards, (shardName) => Str.equivalence(shardName, job.name))),
      A.map((job) =>
        O.map(attemptOnePickupSeconds(job), (pickupSeconds) =>
          CiLaneTimingPickupRow.make({
            conclusion: actionConclusion(job),
            event: run.event,
            headSha: run.head_sha,
            jobName: job.name,
            lane: spec.lane,
            pickupSeconds,
            runAttempt: 1,
            runCreatedAt: run.created_at,
            runId: run.id,
          })
        )
      ),
      A.getSomes
    )
  );

const laterEffectiveRows = (
  requiredContexts: HashSet.HashSet<string>,
  runJobs: CiWorkflowWindowRunJobs
): ReadonlyArray<CiLaneTimingAttributionRow> =>
  pipe(
    CI_EFFECTIVE_LANE_SPECS,
    A.filter((spec) => HashSet.has(requiredContexts, spec.lane)),
    A.flatMap((spec) => {
      const componentNames = A.prepend(spec.shards, spec.aggregator);
      const laterComponents = A.filter(
        runJobs.jobs,
        (job) =>
          !isCiWorkflowAttemptOneJob(job) &&
          A.some(componentNames, (componentName) => Str.equivalence(componentName, job.name))
      );
      const laterAttempts = A.dedupe(A.map(laterComponents, (job) => job.run_attempt));
      return pipe(
        laterAttempts,
        A.map((runAttempt) =>
          pipe(
            A.findFirst(
              laterComponents,
              (job) => job.run_attempt === runAttempt && Str.equivalence(job.name, spec.aggregator)
            ),
            O.orElse(() => A.findFirst(laterComponents, (job) => job.run_attempt === runAttempt)),
            O.map((job) => laterAttemptRowForJob(runJobs.run, spec.lane, job))
          )
        ),
        A.getSomes
      );
    })
  );

const rowsForRun = (
  requiredContexts: HashSet.HashSet<string>,
  runJobs: CiWorkflowWindowRunJobs
): ReadonlyArray<CiLaneTimingWindowRow> => {
  const attemptOneJobs = A.filter(runJobs.jobs, isCiWorkflowAttemptOneJob);
  const ordinaryRows = pipe(
    runJobs.jobs,
    A.map((job) => {
      const effectiveSpec = effectiveLaneSpecForJobName(job.name);
      const lane = O.match(effectiveSpec, {
        onNone: () => normalizeRequiredLaneName(job.name),
        onSome: (spec) => spec.lane,
      });
      if (!HashSet.has(requiredContexts, lane)) {
        return O.none<CiLaneTimingWindowRow>();
      }
      if (O.isSome(effectiveSpec)) {
        return O.none<CiLaneTimingWindowRow>();
      }
      return O.some(
        isCiWorkflowAttemptOneJob(job)
          ? durationRowForAttemptOneJob(runJobs.run, lane, job)
          : laterAttemptRowForJob(runJobs.run, lane, job)
      );
    }),
    A.getSomes
  );
  const effectiveRows = pipe(
    CI_EFFECTIVE_LANE_SPECS,
    A.filter((spec) => HashSet.has(requiredContexts, spec.lane)),
    A.map((spec) => effectiveDurationRow(runJobs.run, attemptOneJobs, spec))
  );
  return A.appendAll(
    A.appendAll(A.appendAll(ordinaryRows, effectiveRows), laterEffectiveRows(requiredContexts, runJobs)),
    shardPickupRows(runJobs.run, attemptOneJobs)
  );
};

const isDurationWindowRow = S.is(CiLaneTimingDurationRow);
const isAttributionWindowRow = S.is(CiLaneTimingAttributionRow);
const isPickupWindowRow = S.is(CiLaneTimingPickupRow);

const nearestRank = (values: ReadonlyArray<number>, quantile: number): O.Option<number> => {
  const sorted = A.sort(values, Order.Number);
  return A.length(sorted) === 0 ? O.none() : O.fromNullishOr(sorted[Math.ceil(quantile * A.length(sorted)) - 1]);
};

const timingWindowStat = (rows: ReadonlyArray<CiLaneTimingDurationRow>, lane: string): CiLaneTimingWindowStat => {
  const laneRows = A.filter(rows, (row) => Str.equivalence(row.lane, lane));
  const durations = A.map(laneRows, (row) => row.durationSeconds);
  const p95Seconds = nearestRank(durations, 0.95);
  return CiLaneTimingWindowStat.make({
    lane,
    maxSeconds: A.last(A.sort(durations, Order.Number)),
    n: A.length(laneRows),
    p50Seconds: nearestRank(durations, 0.5),
    p95Seconds,
    pr: A.length(A.filter(laneRows, (row) => Str.equivalence(row.event, "pull_request"))),
    push: A.length(A.filter(laneRows, (row) => Str.equivalence(row.event, "push"))),
    state: O.exists(p95Seconds, (seconds) => seconds < Duration.toSeconds(CI_LANE_TIMING_CHARTER)) ? "Pass" : "Breach",
  });
};

const timingAttributionStat = (
  rows: ReadonlyArray<CiLaneTimingAttributionRow>,
  lane: string
): CiLaneTimingAttributionStat => {
  const laneRows = A.filter(rows, (row) => Str.equivalence(row.lane, lane));
  const count = (kind: typeof CiLaneTimingAttributionKind.Type): number =>
    A.length(A.filter(laneRows, (row) => Str.equivalence(row.attribution, kind)));
  return CiLaneTimingAttributionStat.make({
    cancellations: count("cancelled"),
    failures: count("failure"),
    incompleteEffectiveSpans: count("incomplete-effective-span"),
    invalidSpans: count("invalid-span"),
    lane,
    laterCancellations: A.length(
      A.filter(
        laneRows,
        (row) => Str.equivalence(row.attribution, "later-attempt") && Str.equivalence(row.conclusion, "cancelled")
      )
    ),
    laterFailures: A.length(
      A.filter(
        laneRows,
        (row) => Str.equivalence(row.attribution, "later-attempt") && Str.equivalence(row.conclusion, "failure")
      )
    ),
    laterAttempts: count("later-attempt"),
    laterSuccesses: A.length(
      A.filter(
        laneRows,
        (row) => Str.equivalence(row.attribution, "later-attempt") && Str.equivalence(row.conclusion, "success")
      )
    ),
  });
};

const timingPickupStat = (rows: ReadonlyArray<CiLaneTimingPickupRow>): CiLaneTimingPickupStat => {
  const pickups = A.map(rows, (row) => row.pickupSeconds);
  const p95Seconds = nearestRank(pickups, 0.95);
  return CiLaneTimingPickupStat.make({
    breached: O.exists(p95Seconds, (seconds) => seconds > Duration.toSeconds(CI_LANE_TIMING_QUEUE_TRIPWIRE)),
    maxSeconds: A.last(A.sort(pickups, Order.Number)),
    n: A.length(pickups),
    p50Seconds: nearestRank(pickups, 0.5),
    p95Seconds,
  });
};

const assertRequiredContextCount = (requiredContexts: HashSet.HashSet<string>): Effect.Effect<void, CiCommandError> =>
  HashSet.size(requiredContexts) === CI_LANE_TIMING_REQUIRED_CONTEXT_COUNT
    ? Effect.void
    : CiCommandError.make({
        message: `Ruleset ${CI_LANE_TIMING_RULESET_ID} must expose exactly ${CI_LANE_TIMING_REQUIRED_CONTEXT_COUNT} required contexts; observed ${HashSet.size(requiredContexts)}.`,
      });

const reportFromRows = Effect.fn("Ci.reportFromLaneTimingWindowRows")(function* (
  requiredContextSet: HashSet.HashSet<string>,
  runCount: number,
  rows: ReadonlyArray<CiLaneTimingWindowRow>
): Effect.fn.Return<CiLaneTimingWindowReport, CiCommandError> {
  yield* assertRequiredContextCount(requiredContextSet);
  const requiredContexts = A.sort(A.fromIterable(requiredContextSet), Order.String);
  const durationRows = A.filter(rows, isDurationWindowRow);
  const attributionRows = A.filter(rows, isAttributionWindowRow);
  const pickupRows = A.filter(rows, isPickupWindowRow);
  return CiLaneTimingWindowReport.make({
    attribution: A.map(requiredContexts, (lane) => timingAttributionStat(attributionRows, lane)),
    contextCount: HashSet.size(requiredContextSet),
    laneStats: A.map(requiredContexts, (lane) => timingWindowStat(durationRows, lane)),
    pickup: timingPickupStat(pickupRows),
    requiredContexts,
    rows,
    runCount,
    schemaVersion: "ci-lane-timing-window/v1",
  });
});

/**
 * Build a census report from already joined run/job buffers.
 *
 * **Details**
 *
 * This is the deterministic test and offline-analysis seam. It normalizes the
 * reusable-workflow prefix, replaces sharded `Lint` and `Test Unit` aggregator
 * spans with their effective critical paths, and rejects any required-context
 * set whose normalized cardinality is not exactly 18.
 *
 * **Example** (Observe the fail-closed context assertion)
 *
 * ```ts
 * import { buildCiLaneTimingWindowReport } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const report = buildCiLaneTimingWindowReport([], [])
 * console.log(Effect.isEffect(report))
 * ```
 *
 * @param requiredContexts - Live contexts read from ruleset `10240248`.
 * @param runs - Ordered workflow runs paired with isolated paginated job buffers.
 * @returns The schema-classified census report, or a fail-closed cardinality error.
 * @category mapping
 * @since 0.0.0
 */
export const buildCiLaneTimingWindowReport = Effect.fn("Ci.buildCiLaneTimingWindowReport")(function* (
  requiredContexts: ReadonlyArray<string>,
  runs: ReadonlyArray<CiWorkflowWindowRunJobs>
): Effect.fn.Return<CiLaneTimingWindowReport, CiCommandError> {
  const requiredContextSet = HashSet.fromIterable(A.map(requiredContexts, normalizeRequiredLaneName));
  yield* assertRequiredContextCount(requiredContextSet);
  const rows = A.flatMap(runs, (runJobs) => rowsForRun(requiredContextSet, runJobs));
  return yield* reportFromRows(requiredContextSet, A.length(runs), rows);
});

const collectCiLaneTimingWindowWithClient = Effect.fn("Ci.collectCiLaneTimingWindowWithClient")(function* (
  repoRoot: string,
  options: CiLaneTimingWindowOptions
): Effect.fn.Return<CiLaneTimingWindowReport, CiCommandError, CiLaneTimingGithubClient> {
  if (DateTime.toEpochMillis(options.since) >= DateTime.toEpochMillis(options.until)) {
    return yield* CiCommandError.make({ message: "--since must be earlier than --until." });
  }
  const requiredContexts = yield* collectRequiredContexts(repoRoot);
  const requiredContextSet = HashSet.fromIterable(A.map(requiredContexts, normalizeRequiredLaneName));
  yield* assertRequiredContextCount(requiredContextSet);
  const runs = yield* collectCiWorkflowWindowRuns(repoRoot, options);
  const rows = yield* pipe(
    Stream.fromIterable(runs),
    Stream.mapEffect(
      Effect.fnUntraced(function* (run) {
        const jobs = yield* collectCiWorkflowJobPages(fetchCiWorkflowWindowJobsPage, repoRoot, run.id, 100);
        return CiWorkflowWindowRunJobs.make({ jobs, run });
      }),
      { concurrency: CI_LANE_TIMING_JOB_FETCH_CONCURRENCY, unordered: false }
    ),
    Stream.runFold(A.empty<CiLaneTimingWindowRow>, (collected, runJobs) =>
      A.appendAll(collected, rowsForRun(requiredContextSet, runJobs))
    )
  );
  return yield* reportFromRows(requiredContextSet, A.length(runs), rows);
});

/**
 * Collect a paginated admission census for one half-open UTC window.
 *
 * **Details**
 *
 * The live ruleset is checked before workflow runs are fetched. Run pages are
 * de-duplicated and ordered, then each run's paginated jobs are fetched with
 * bounded concurrency into an isolated buffer. Ordered stream reduction keeps
 * concurrent writers away from shared output while retaining derived row
 * provenance and discarding raw pages.
 *
 * **Example** (Prepare a collection effect)
 *
 * ```ts
 * import { CiLaneTimingWindowOptions, collectCiLaneTimingWindow } from "@beep/repo-cli/commands/Ci"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const options = CiLaneTimingWindowOptions.make({
 *   branch: O.none(),
 *   event: "all",
 *   headSha: O.none(),
 *   since: DateTime.makeUnsafe("2026-09-04T00:00:00Z"),
 *   until: DateTime.makeUnsafe("2026-09-11T00:00:00Z"),
 *   workflow: "check.yml",
 * })
 * console.log(Effect.isEffect(collectCiLaneTimingWindow(".", options)))
 * ```
 *
 * @param repoRoot - Repository root from which the captured `gh api` calls run.
 * @param options - Validated workflow, event, interval, branch, and head filters.
 * @returns The derived report after complete pagination and fail-closed ruleset validation.
 * @category use-cases
 * @since 0.0.0
 */
export const collectCiLaneTimingWindow = Effect.fn("Ci.collectCiLaneTimingWindow")(function* (
  repoRoot: string,
  options: CiLaneTimingWindowOptions
): Effect.fn.Return<CiLaneTimingWindowReport, CiCommandError, CiLaneTimingGithubClient> {
  return yield* collectCiLaneTimingWindowWithClient(repoRoot, options);
});

const roundedDuration = (seconds: number): string => {
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}m${Str.padStart(2, "0")(`${remainder}`)}s`;
};

const renderTimingOption = (seconds: O.Option<number>): string =>
  O.match(seconds, { onNone: () => "—", onSome: roundedDuration });

const renderMarkdownP95 = (stat: CiLaneTimingWindowStat): string => {
  const rendered = renderTimingOption(stat.p95Seconds);
  return Str.equivalence(stat.state, "Breach") ? `**${rendered}**` : rendered;
};

const renderMarkdownState = (state: CiLaneTimingWindowStat["state"]): string =>
  Str.equivalence(state, "Breach") ? "**Breach**" : state;

const renderSuccessfulDurationsMarkdown = (report: CiLaneTimingWindowReport): ReadonlyArray<string> => [
  "## Successful attempt-one durations",
  "",
  "| Required lane | n | PR | Push | p50 | p95 | Max | P3 state |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ...A.map(
    report.laneStats,
    (stat) =>
      `| ${stat.lane} | ${stat.n} | ${stat.pr} | ${stat.push} | ${renderTimingOption(stat.p50Seconds)} | ${renderMarkdownP95(stat)} | ${renderTimingOption(stat.maxSeconds)} | ${renderMarkdownState(stat.state)} |`
  ),
];

const renderAttemptOneAttributionMarkdown = (report: CiLaneTimingWindowReport): ReadonlyArray<string> => [
  "## Attempt-one failures and cancellations",
  "",
  "| Required lane | Failures | Cancellations | Invalid spans | Incomplete shard sets |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...A.map(
    report.attribution,
    (stat) =>
      `| ${stat.lane} | ${stat.failures} | ${stat.cancellations} | ${stat.invalidSpans} | ${stat.incompleteEffectiveSpans} |`
  ),
];

const renderLaterAttemptsMarkdown = (report: CiLaneTimingWindowReport): ReadonlyArray<string> => [
  "## Later attempts",
  "",
  "| Required lane | Success | Failure | Cancelled |",
  "| --- | ---: | ---: | ---: |",
  ...A.map(
    report.attribution,
    (stat) => `| ${stat.lane} | ${stat.laterSuccesses} | ${stat.laterFailures} | ${stat.laterCancellations} |`
  ),
];

const renderQueueTripwire = (pickup: CiLaneTimingPickupStat): string =>
  O.match(pickup.p95Seconds, {
    onNone: () => "Queue tripwire: unavailable — no attempt-one shard pickup carried both timestamps.",
    onSome: (seconds) =>
      `Queue tripwire: ${pickup.breached ? "Breach" : "Pass"} — shard pickup p95 ${roundedDuration(seconds)} ${pickup.breached ? ">" : "≤"} 5m00s (n=${pickup.n}).`,
  });

/**
 * Render a census report as paste-ready admission Markdown.
 *
 * **Details**
 *
 * The duration and attribution tables preserve the headings and column shapes
 * used by `research/current-ruleset-week-p95.md`. Later attempts remain a
 * separate current-report-shaped table, and the shard-pickup tripwire is a
 * line outside every wall-duration percentile.
 *
 * **Example** (Render report Markdown through the builder)
 *
 * ```ts
 * import { buildCiLaneTimingWindowReport, renderCiLaneTimingWindowMarkdown } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const rendered = buildCiLaneTimingWindowReport([], []).pipe(Effect.map(renderCiLaneTimingWindowMarkdown))
 * console.log(Effect.isEffect(rendered))
 * ```
 *
 * @param report - Derived admission census report.
 * @returns Markdown duration, attribution, later-attempt tables, and queue tripwire.
 * @category formatting
 * @since 0.0.0
 */
export const renderCiLaneTimingWindowMarkdown = (report: CiLaneTimingWindowReport): string =>
  A.join(
    [
      ...renderSuccessfulDurationsMarkdown(report),
      "",
      ...renderAttemptOneAttributionMarkdown(report),
      "",
      ...renderLaterAttemptsMarkdown(report),
      "",
      renderQueueTripwire(report.pickup),
    ],
    "\n"
  );

/**
 * Render a compact operator summary for a bounded admission census.
 *
 * **Example** (Prepare summary rendering)
 *
 * ```ts
 * import { buildCiLaneTimingWindowReport, renderCiLaneTimingWindowSummary } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const rendered = buildCiLaneTimingWindowReport([], []).pipe(Effect.map(renderCiLaneTimingWindowSummary))
 * console.log(Effect.isEffect(rendered))
 * ```
 *
 * @param report - Derived admission census report.
 * @returns Operator summary followed by the admission tables.
 * @category formatting
 * @since 0.0.0
 */
export const renderCiLaneTimingWindowSummary = (report: CiLaneTimingWindowReport): string =>
  A.join(
    [
      "ci lane timing window",
      `- runs: ${report.runCount}`,
      `- required contexts: ${report.contextCount} (expected ${CI_LANE_TIMING_REQUIRED_CONTEXT_COUNT})`,
      `- successful attempt-one lane rows: ${A.length(A.filter(report.rows, isDurationWindowRow))}`,
      `- attributed rows: ${A.length(A.filter(report.rows, isAttributionWindowRow))}`,
      `- ${renderQueueTripwire(report.pickup)}`,
      "",
      renderCiLaneTimingWindowMarkdown(report),
    ],
    "\n"
  );

const WINDOW_TSV_COLUMNS = [
  "population",
  "lane",
  "runId",
  "runAttempt",
  "event",
  "headSha",
  "runCreatedAt",
  "jobName",
  "conclusion",
  "attribution",
  "durationSeconds",
  "pickupSeconds",
] as const;

const renderWindowRowTsv = (row: CiLaneTimingWindowRow): string =>
  CiLaneTimingWindowRow.match(row, {
    attribution: (attribution) =>
      A.join(
        [
          "attribution",
          tsvStringCell(attribution.lane),
          `${attribution.runId}`,
          `${attribution.runAttempt}`,
          attribution.event,
          tsvStringCell(attribution.headSha),
          DateTime.formatIso(attribution.runCreatedAt),
          tsvStringCell(attribution.jobName),
          tsvStringCell(attribution.conclusion),
          attribution.attribution,
          "",
          "",
        ],
        "\t"
      ),
    duration: (duration) =>
      A.join(
        [
          "duration",
          tsvStringCell(duration.lane),
          `${duration.runId}`,
          "1",
          duration.event,
          tsvStringCell(duration.headSha),
          DateTime.formatIso(duration.runCreatedAt),
          tsvStringCell(duration.jobName),
          "success",
          "",
          `${duration.durationSeconds}`,
          tsvCell(duration.pickupSeconds),
        ],
        "\t"
      ),
    pickup: (pickup) =>
      A.join(
        [
          "pickup",
          tsvStringCell(pickup.lane),
          `${pickup.runId}`,
          "1",
          pickup.event,
          tsvStringCell(pickup.headSha),
          DateTime.formatIso(pickup.runCreatedAt),
          tsvStringCell(pickup.jobName),
          tsvStringCell(pickup.conclusion),
          "",
          "",
          `${pickup.pickupSeconds}`,
        ],
        "\t"
      ),
  });

/**
 * Render every derived census row as provenance-preserving TSV.
 *
 * **Details**
 *
 * Duration, attribution, and pickup rows share one stable header. Empty cells
 * preserve semantic absence: pickup never enters `durationSeconds`, and an
 * excluded observation never impersonates a zero-duration success.
 *
 * **Example** (Render a TSV header through the builder)
 *
 * ```ts
 * import { buildCiLaneTimingWindowReport, renderCiLaneTimingWindowTsv } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * const rendered = buildCiLaneTimingWindowReport([], []).pipe(Effect.map(renderCiLaneTimingWindowTsv))
 * console.log(Effect.isEffect(rendered))
 * ```
 *
 * @param report - Derived admission census report.
 * @returns Tab-separated derived rows with complete workflow-run provenance.
 * @category formatting
 * @since 0.0.0
 */
export const renderCiLaneTimingWindowTsv = (report: CiLaneTimingWindowReport): string =>
  A.join([A.join(WINDOW_TSV_COLUMNS, "\t"), ...A.map(report.rows, renderWindowRowTsv)], "\n");

const decodeCiLaneTimingWindowOptions = Effect.fn("Ci.decodeCiLaneTimingWindowOptions")(function* (
  input: unknown
): Effect.fn.Return<CiLaneTimingWindowOptions, CiCommandError> {
  const options = yield* S.decodeUnknownEffect(CiLaneTimingWindowOptions)(input).pipe(
    CiCommandError.mapError("--window requires valid --since and --until UTC timestamps.")
  );
  if (DateTime.toEpochMillis(options.since) >= DateTime.toEpochMillis(options.until)) {
    return yield* CiCommandError.make({ message: "--since must be earlier than --until." });
  }
  return options;
});

const runLimitFlag = Flag.integer("runs").pipe(
  Flag.withDescription("How many recent workflow runs to read jobs for (1-100)"),
  Flag.withDefault(20)
);

const tsvFlag = Flag.boolean("tsv").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the collected rows as TSV instead of the operator summary")
);

const windowFlag = Flag.boolean("window").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Collect a bounded workflow-run census instead of the recent-runs report")
);

const workflowFlag = Flag.string("workflow").pipe(
  Flag.withDefault("check.yml"),
  Flag.withDescription("Workflow file used by the bounded census")
);

const eventFlag = Flag.choice("event", CiLaneTimingWindowEvent.Options).pipe(
  Flag.withDefault(CiLaneTimingWindowEvent.Enum.all),
  Flag.withDescription("Workflow event population used by the bounded census")
);

const branchFlag = Flag.string("branch").pipe(
  Flag.optional,
  Flag.withDescription("Optional workflow head branch; push waves default to main")
);

const sinceFlag = Flag.string("since").pipe(
  Flag.optional,
  Flag.withDescription("Inclusive UTC created_at boundary for --window")
);

const untilFlag = Flag.string("until").pipe(
  Flag.optional,
  Flag.withDescription("Exclusive UTC created_at boundary for --window")
);

const headShaFlag = Flag.string("head-sha").pipe(
  Flag.optional,
  Flag.withDescription("Optional exact workflow run head SHA for --window")
);

const markdownFlag = Flag.boolean("markdown").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the bounded census as admission-document Markdown")
);

/**
 * `beep ci lane-timings` — collect hosted lane timings with attempt-1 filtering.
 *
 * **Example** (Reference the command)
 *
 * ```ts
 * import { ciLaneTimingsCommand } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(typeof ciLaneTimingsCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciLaneTimingsCommand = Command.make(
  "lane-timings",
  {
    branch: branchFlag,
    event: eventFlag,
    headSha: headShaFlag,
    markdown: markdownFlag,
    runs: runLimitFlag,
    since: sinceFlag,
    tsv: tsvFlag,
    until: untilFlag,
    window: windowFlag,
    workflow: workflowFlag,
  },
  Effect.fnUntraced(function* ({ branch, event, headSha, markdown, runs, since, tsv, until, window, workflow }) {
    const repoRoot = yield* findRepoRoot().pipe(Effect.orElseSucceed(() => process.cwd()));
    if (!window) {
      const report = yield* collectCiLaneTimings(repoRoot, runs);
      yield* Console.log(tsv ? renderCiLaneTimingsTsv(report.rows) : renderCiLaneTimingsSummary(report));
      return;
    }
    if (tsv && markdown) {
      return yield* CiCommandError.make({ message: "Choose only one of --tsv or --markdown." });
    }
    const options = yield* decodeCiLaneTimingWindowOptions({
      event,
      workflow,
      ...O.getSomesStruct({ branch, headSha, since, until }),
    });
    const githubClient = yield* makeCiLaneTimingGithubClient();
    const windowReport = yield* collectCiLaneTimingWindow(repoRoot, options).pipe(
      Effect.provideService(CiLaneTimingGithubClient, githubClient)
    );
    yield* Console.log(
      tsv
        ? renderCiLaneTimingWindowTsv(windowReport)
        : markdown
          ? renderCiLaneTimingWindowMarkdown(windowReport)
          : renderCiLaneTimingWindowSummary(windowReport)
    );
  })
).pipe(
  Command.withDescription("Collect recent hosted lane timings or a bounded admission census with attempt filtering")
);
