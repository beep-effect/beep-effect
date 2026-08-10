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
import { A, Str } from "@beep/utils";
import { Console, DateTime, Effect, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { detectGithubJobShapeClass, GithubJobRecord, GithubJobStepRecord } from "../../internal/github/index.ts";
import { runRepoCommandCapture } from "../../internal/repo-run/index.ts";
import { CiCommandError } from "./Ci.errors.ts";
import type * as SchemaAST from "effect/SchemaAST";
import type { ChildProcessSpawner } from "effect/unstable/process";

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
  job.run_attempt === 1 ? ciTimestampSpanSeconds(job.created_at, job.started_at) : O.none();

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

/**
 * Render collected rows as the TSV this repo's timing analyses consume.
 *
 * **Details**
 *
 * An absent measurement renders as an empty cell rather than `0`, so a
 * spreadsheet average over `pickupSeconds` skips re-dispatched attempts instead
 * of pulling the mean toward zero — the filter surviving all the way to the
 * last consumer.
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
      A.join(TSV_COLUMNS, "\t"),
      ...A.map(rows, (row) =>
        A.join(
          [
            String(row.runId),
            String(row.runAttempt),
            String(row.jobId),
            row.jobName,
            row.conclusion,
            row.runnerClass,
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
 * import { Effect } from "effect"
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

const ghApiJson = Effect.fn("Ci.laneTimingsGhApi")(function* (
  repoRoot: string,
  endpoint: string
): Effect.fn.Return<string, CiCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture("gh", ["api", endpoint], repoRoot).pipe(
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

const collectCiWorkflowJobPages = Effect.fn("Ci.collectCiWorkflowJobPages")(function* (
  repoRoot: string,
  runId: number,
  pageNumber: number,
  collected: ReadonlyArray<CiWorkflowJob>
): Effect.fn.Return<ReadonlyArray<CiWorkflowJob>, CiCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const endpoint = `repos/{owner}/{repo}/actions/runs/${runId}/jobs?filter=all&per_page=100&page=${pageNumber}`;
  const json = yield* ghApiJson(repoRoot, endpoint);
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
    onNonEmpty: () => collectCiWorkflowJobPages(repoRoot, runId, pageNumber + 1, jobs),
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
 * import { Effect } from "effect"
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
  const runsJson = yield* ghApiJson(repoRoot, `repos/{owner}/{repo}/actions/runs?per_page=${runLimit}`);
  const runs = yield* decodeCiWorkflowRunsPage(runsJson).pipe(
    Effect.map((page) => page.workflow_runs),
    CiCommandError.mapError("Failed to decode the workflow-runs response.")
  );
  const jobPages = yield* Effect.forEach(runs, (run) => collectCiWorkflowJobPages(repoRoot, run.id, 1, A.empty()), {
    concurrency: 4,
  });
  return ciLaneTimingsReport(A.map(A.flatten(jobPages), ciLaneTimingRow));
});

const runLimitFlag = Flag.integer("runs").pipe(
  Flag.withDescription("How many recent workflow runs to read jobs for (1-100)"),
  Flag.withDefault(20)
);

const tsvFlag = Flag.boolean("tsv").pipe(
  Flag.withDescription("Print the collected rows as TSV instead of the operator summary")
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
  { runs: runLimitFlag, tsv: tsvFlag },
  Effect.fnUntraced(function* ({ runs, tsv }) {
    const repoRoot = yield* findRepoRoot().pipe(Effect.orElseSucceed(() => process.cwd()));
    const report = yield* collectCiLaneTimings(repoRoot, runs);
    yield* Console.log(tsv ? renderCiLaneTimingsTsv(report.rows) : renderCiLaneTimingsSummary(report));
  })
).pipe(Command.withDescription("Collect hosted lane timings, with pickup latency filtered to run attempt 1"));
