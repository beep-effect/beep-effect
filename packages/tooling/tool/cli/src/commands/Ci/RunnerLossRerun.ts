/**
 * Runner-loss rerun: the one decision that says whether a completed workflow
 * run gets a job re-run because its runner died, not because its code failed.
 *
 * **Details**
 *
 * The heavy pool runs on Spot capacity, and an eviction mid-job surfaces in
 * GitHub only as a `failure` with the check-run annotation "The self-hosted
 * runner lost communication with the server", nine to ten minutes later. The
 * `Rerun Runner Loss` workflow runs `bun run beep ci rerun-runner-loss` on
 * every completed `Check` and `Heavy Admit` run; this module is the pure half
 * of that command, so every gate is unit-tested without GitHub.
 *
 * A job counts as lost only when three facts agree: it concluded `failure`,
 * one of its annotations carries the lost-communication message, and none of
 * its steps concluded `failure`. The last fact keeps a job that produced a
 * real red from being re-run on the strength of an annotation alone. Only
 * lost jobs are ever re-run, one `gh run rerun --job <id>` per evaluation;
 * every other red stays red.
 *
 * Retries are bounded per job: a job, followed across attempts by name, is
 * re-run at most {@link RUNNER_LOSS_MAX_JOB_RERUNS} times. The run's attempt
 * count has a separate ceiling, {@link RUNNER_LOSS_RERUN_MAX_ATTEMPT}, so no
 * run can loop.
 *
 * **Gotchas**
 *
 * The head gate is what keeps a rerun from doing harm. Re-running an old
 * head's run puts it back in the branch's concurrency group, where it cancels
 * the current head's run (observed 2026-09-30). So a pull-request run reruns
 * only while its SHA is still the head of an open pull request, and a push
 * run only while its SHA is still the branch tip.
 *
 * GitHub accepts one job rerun per run at a time, and each one creates a new
 * attempt that copies the jobs it did not re-run under new ids and without
 * their annotations. Lost jobs beyond the one re-run now are therefore picked
 * up when that attempt completes, through {@link runnerLossCopiedFrom}.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect, Order, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { githubConclusion, githubJobHasFailedStep } from "../../internal/github/index.ts";
import { ciWorkflowJobShapeRecord } from "./LaneTimings.ts";
import type { CiWorkflowJob } from "./LaneTimings.ts";

const $I = $RepoCliId.create("commands/Ci/RunnerLossRerun");

/**
 * The run-attempt ceiling: no rerun is requested once a run reaches it.
 *
 * **Details**
 *
 * A safety bound on the whole run, separate from the per-job bound. Three
 * jobs each lost three times need ten attempts, so a run this unlucky stops
 * at the ceiling and names the jobs it leaves red.
 *
 * **Example** (Print the ceiling)
 *
 * ```ts
 * import { RUNNER_LOSS_RERUN_MAX_ATTEMPT } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(RUNNER_LOSS_RERUN_MAX_ATTEMPT) // 8
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RUNNER_LOSS_RERUN_MAX_ATTEMPT = 8;

/**
 * How many times one job is re-run for runner loss.
 *
 * **Example** (Print the per-job bound)
 *
 * ```ts
 * import { RUNNER_LOSS_MAX_JOB_RERUNS } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(RUNNER_LOSS_MAX_JOB_RERUNS) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RUNNER_LOSS_MAX_JOB_RERUNS = 3;

/**
 * Matches GitHub's check-run annotation for a runner that stopped reporting.
 *
 * **Details**
 *
 * Self-hosted jobs read "The self-hosted runner lost communication with the
 * server"; hosted jobs read "The hosted runner: <name> lost communication
 * with the server". Both are runner loss, so the pattern keys on the shared
 * phrase.
 *
 * **Example** (Recognise the annotation)
 *
 * ```ts
 * import { RUNNER_LOSS_ANNOTATION_PATTERN } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(RUNNER_LOSS_ANNOTATION_PATTERN.test("The self-hosted runner lost communication with the server.")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RUNNER_LOSS_ANNOTATION_PATTERN = /lost communication with the server/iu;

/**
 * Why the rerun did or did not happen.
 *
 * **Details**
 *
 * `runner-loss` is the only reason that reruns. The skip reasons follow the
 * gate order: `run-not-completed`, `run-not-failed`, `no-runner-loss`,
 * `job-reruns-exhausted` (every lost job already used its reruns),
 * `attempt-already-rerun` (a newer attempt exists), `attempt-cap` (the run
 * reached the attempt ceiling), then the head gate (`superseded-head`,
 * `no-open-pull-request`, `unsupported-event`). `head-unchecked` means every
 * gate before the head gate passed and the head has not been read yet; the
 * command reads it and decides again.
 *
 * **Example** (Check a reason)
 *
 * ```ts
 * import { RunnerLossRerunReason } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(RunnerLossRerunReason.is["attempt-cap"]("attempt-cap")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunnerLossRerunReason = LiteralKit([
  "runner-loss",
  "run-not-completed",
  "run-not-failed",
  "no-runner-loss",
  "job-reruns-exhausted",
  "attempt-already-rerun",
  "attempt-cap",
  "superseded-head",
  "no-open-pull-request",
  "unsupported-event",
  "head-unchecked",
]).pipe(
  $I.annoteSchema("RunnerLossRerunReason", {
    title: "Runner Loss Rerun Reason",
    description: "Why a completed workflow run was or was not re-run for runner loss.",
  })
);

/**
 * Why the rerun did or did not happen.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RunnerLossRerunReason = typeof RunnerLossRerunReason.Type;

/**
 * What the head gate learned about a run's SHA.
 *
 * **Example** (Check a head status)
 *
 * ```ts
 * import { RunnerLossHeadStatus } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(RunnerLossHeadStatus.is.current("current")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunnerLossHeadStatus = LiteralKit([
  "current",
  "superseded",
  "no-open-pull-request",
  "unsupported-event",
  "unchecked",
]).pipe(
  $I.annoteSchema("RunnerLossHeadStatus", {
    title: "Runner Loss Head Status",
    description: "Whether a run's SHA is still the head of its pull request or branch.",
  })
);

/**
 * What the head gate learned about a run's SHA.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RunnerLossHeadStatus = typeof RunnerLossHeadStatus.Type;

/**
 * The head gate's finding for one run.
 *
 * **Details**
 *
 * `currentSha` is the head that superseded the run, when the gate read one.
 *
 * **Example** (A superseded head)
 *
 * ```ts
 * import { RunnerLossHead } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const head = RunnerLossHead.make({ status: "superseded", currentSha: O.some("def456") })
 * console.log(head.status) // "superseded"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerLossHead extends S.Class<RunnerLossHead>($I`RunnerLossHead`)(
  {
    status: RunnerLossHeadStatus,
    currentSha: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("RunnerLossHead", {
    description: "Whether a workflow run's SHA is still the head of its pull request or branch.",
  })
) {}

const runnerLossRunPullRequestsDefault = A.empty<number>();
/**
 * The fields of a workflow run the rerun decision reads.
 *
 * **Details**
 *
 * Decoded from `gh api repos/{owner}/{repo}/actions/runs/<id>` through a
 * `--jq` projection. `run_attempt` is the run's latest attempt. `pull_requests`
 * holds pull-request numbers and is empty for fork pull requests, which the
 * head gate then looks up by `head_owner:head_branch`.
 *
 * **Example** (A failed pull-request run)
 *
 * ```ts
 * import { RunnerLossRun } from "@beep/repo-cli/commands/Ci"
 *
 * const run = RunnerLossRun.make({
 *   id: 36763005302,
 *   name: "Check",
 *   event: "pull_request",
 *   status: "completed",
 *   conclusion: "failure",
 *   run_attempt: 1,
 *   head_sha: "c81bbe770a",
 *   head_branch: "refactor/literal-kit-trim",
 *   head_owner: "beep-effect",
 *   pull_requests: [1338],
 * })
 * console.log(run.pull_requests) // [1338]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerLossRun extends S.Class<RunnerLossRun>($I`RunnerLossRun`)(
  {
    id: S.Finite,
    name: S.String,
    event: S.String,
    status: S.String,
    conclusion: S.NullOr(S.String),
    run_attempt: S.Finite,
    head_sha: S.String,
    head_branch: S.NullOr(S.String),
    head_owner: S.NullOr(S.String),
    pull_requests: S.Array(S.Finite).pipe(
      S.withConstructorDefault(Effect.succeed(runnerLossRunPullRequestsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(runnerLossRunPullRequestsDefault))
    ),
  },
  $I.annote("RunnerLossRun", {
    description: "The fields of a GitHub Actions workflow run the runner-loss rerun decision reads.",
  })
) {}

/**
 * One failed job of the evaluated attempt, with its runner-loss verdict.
 *
 * **Details**
 *
 * `reruns` counts how often this job, followed across attempts by name, has
 * already been re-run (see {@link runnerLossJobReruns}).
 *
 * **Example** (A lost job)
 *
 * ```ts
 * import { RunnerLossFailedJob } from "@beep/repo-cli/commands/Ci"
 *
 * const job = RunnerLossFailedJob.make({
 *   id: 110050993181,
 *   name: "Heavy / Lint Policy",
 *   runnerName: "beep-ci-i-0747b6f71d6489e73",
 *   runnerLoss: true,
 * })
 * console.log(job.reruns) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerLossFailedJob extends S.Class<RunnerLossFailedJob>($I`RunnerLossFailedJob`)(
  {
    id: S.Finite,
    name: S.String,
    runnerName: S.NullOr(S.String),
    runnerLoss: S.Boolean,
    reruns: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(0)), S.withDecodingDefaultTypeKey(Effect.succeed(0))),
  },
  $I.annote("RunnerLossFailedJob", {
    description: "One failed job of a workflow-run attempt, whether its runner was lost, and its prior reruns.",
  })
) {}

/**
 * Everything the rerun decision reads.
 *
 * **Details**
 *
 * `attempt` is the attempt whose jobs were read; it equals `run.run_attempt`
 * unless an older attempt is being evaluated. `maxAttempt` is the run-attempt
 * ceiling and `maxJobReruns` the per-job bound.
 *
 * **Example** (An input whose head is not read yet)
 *
 * ```ts
 * import { RunnerLossHead, RunnerLossRerunInput, RunnerLossRun } from "@beep/repo-cli/commands/Ci"
 *
 * const input = RunnerLossRerunInput.make({
 *   run: RunnerLossRun.make({
 *     id: 1,
 *     name: "Check",
 *     event: "push",
 *     status: "completed",
 *     conclusion: "success",
 *     run_attempt: 1,
 *     head_sha: "abc",
 *     head_branch: "main",
 *     head_owner: "beep-effect",
 *   }),
 *   attempt: 1,
 *   failedJobs: [],
 *   head: RunnerLossHead.make({ status: "unchecked" }),
 * })
 * console.log(input.maxJobReruns) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerLossRerunInput extends S.Class<RunnerLossRerunInput>($I`RunnerLossRerunInput`)(
  {
    run: RunnerLossRun,
    attempt: S.Finite,
    maxAttempt: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(RUNNER_LOSS_RERUN_MAX_ATTEMPT)),
      S.withDecodingDefaultTypeKey(Effect.succeed(RUNNER_LOSS_RERUN_MAX_ATTEMPT))
    ),
    maxJobReruns: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(RUNNER_LOSS_MAX_JOB_RERUNS)),
      S.withDecodingDefaultTypeKey(Effect.succeed(RUNNER_LOSS_MAX_JOB_RERUNS))
    ),
    failedJobs: S.Array(RunnerLossFailedJob),
    head: RunnerLossHead,
  },
  $I.annote("RunnerLossRerunInput", {
    description: "The run, attempt, failed jobs, bounds, and head finding the runner-loss rerun decision reads.",
  })
) {}

/**
 * The rerun decision for one workflow-run attempt.
 *
 * **Details**
 *
 * `rerun` is true only for reason `runner-loss`, and then `rerunJob` is the
 * one lost job re-run now: the one with the fewest prior reruns. Every other
 * lost job under its bound waits for the next attempt. `otherFailedJobs`
 * failed for another reason and are never re-run.
 *
 * **Example** (A skip)
 *
 * ```ts
 * import { RunnerLossRerunDecision } from "@beep/repo-cli/commands/Ci"
 *
 * const decision = RunnerLossRerunDecision.make({
 *   rerun: false,
 *   reason: "run-not-failed",
 *   runId: 1,
 *   attempt: 1,
 *   maxAttempt: 8,
 *   maxJobReruns: 3,
 *   lostJobs: [],
 *   otherFailedJobs: [],
 * })
 * console.log(decision.reason) // "run-not-failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerLossRerunDecision extends S.Class<RunnerLossRerunDecision>($I`RunnerLossRerunDecision`)(
  {
    rerun: S.Boolean,
    reason: RunnerLossRerunReason,
    runId: S.Finite,
    attempt: S.Finite,
    maxAttempt: S.Finite,
    maxJobReruns: S.Finite,
    rerunJob: RunnerLossFailedJob.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    lostJobs: S.Array(RunnerLossFailedJob),
    otherFailedJobs: S.Array(RunnerLossFailedJob),
    head: RunnerLossHead.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("RunnerLossRerunDecision", {
    description: "Whether one lost job of a workflow-run attempt is re-run, with the jobs that decided it.",
  })
) {}

/**
 * A decision together with whether its rerun was only reported.
 *
 * **Example** (A dry run)
 *
 * ```ts
 * import { RunnerLossRerunDecision, RunnerLossRerunReport } from "@beep/repo-cli/commands/Ci"
 *
 * const report = RunnerLossRerunReport.make({
 *   decision: RunnerLossRerunDecision.make({
 *     rerun: false,
 *     reason: "run-not-failed",
 *     runId: 1,
 *     attempt: 1,
 *     maxAttempt: 8,
 *     maxJobReruns: 3,
 *     lostJobs: [],
 *     otherFailedJobs: [],
 *   }),
 *   dryRun: true,
 * })
 * console.log(report.dryRun) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerLossRerunReport extends S.Class<RunnerLossRerunReport>($I`RunnerLossRerunReport`)(
  {
    decision: RunnerLossRerunDecision,
    dryRun: S.Boolean,
  },
  $I.annote("RunnerLossRerunReport", {
    description: "A runner-loss rerun decision and whether its rerun was only reported.",
  })
) {}

/**
 * The evidence a failed job is judged on besides its own record.
 *
 * **Example** (A job lost once before)
 *
 * ```ts
 * import { RunnerLossJobEvidence } from "@beep/repo-cli/commands/Ci"
 *
 * const evidence = RunnerLossJobEvidence.make({ annotations: ["lost communication with the server"], reruns: 1 })
 * console.log(evidence.reruns) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerLossJobEvidence extends S.Class<RunnerLossJobEvidence>($I`RunnerLossJobEvidence`)(
  {
    annotations: S.Array(S.String),
    reruns: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(0)), S.withDecodingDefaultTypeKey(Effect.succeed(0))),
  },
  $I.annote("RunnerLossJobEvidence", {
    description: "The check-run annotation messages and prior rerun count a failed job is judged on.",
  })
) {}

const isCopyOf = (job: CiWorkflowJob) => (prior: CiWorkflowJob) =>
  prior.run_attempt < job.run_attempt &&
  prior.name === job.name &&
  prior.started_at === job.started_at &&
  prior.completed_at === job.completed_at;

/**
 * Find the job a rerun attempt copied a job from.
 *
 * **Details**
 *
 * A rerun attempt copies every job it does not re-run, under a new job id,
 * with the original's name, timestamps and conclusion but without its
 * check-run annotations. The original is the earliest job in `runJobs` with
 * the same name, `started_at` and `completed_at` from an earlier attempt; a
 * job that actually ran in its attempt matches none.
 *
 * **Example** (A copied job)
 *
 * ```ts
 * import { CiWorkflowJob, runnerLossCopiedFrom } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const job = (id: number, run_attempt: number) =>
 *   CiWorkflowJob.make({
 *     completed_at: "2026-09-30T20:18:51Z",
 *     conclusion: "failure",
 *     created_at: "2026-09-30T19:37:00Z",
 *     id,
 *     name: "Heavy / Docgen",
 *     run_attempt,
 *     run_id: 36763005302,
 *     started_at: "2026-09-30T20:00:50Z",
 *     status: "completed",
 *   })
 * console.log(O.map(runnerLossCopiedFrom(job(2, 2), [job(1, 1)]), (origin) => origin.id)) // Some(1)
 * ```
 *
 * @param job - A job of some attempt.
 * @param runJobs - Jobs of the run's attempts; later attempts are ignored.
 * @returns The original job, or `None` when the job ran in its attempt.
 * @category utilities
 * @since 0.0.0
 */
export const runnerLossCopiedFrom: {
  (runJobs: ReadonlyArray<CiWorkflowJob>): (job: CiWorkflowJob) => O.Option<CiWorkflowJob>;
  (job: CiWorkflowJob, runJobs: ReadonlyArray<CiWorkflowJob>): O.Option<CiWorkflowJob>;
} = dual(
  2,
  (job: CiWorkflowJob, runJobs: ReadonlyArray<CiWorkflowJob>): O.Option<CiWorkflowJob> =>
    job.started_at === null || job.completed_at === null
      ? O.none()
      : pipe(
          A.filter(runJobs, isCopyOf(job)),
          A.sort(Order.mapInput(Order.Number, (prior: CiWorkflowJob) => prior.run_attempt)),
          A.head
        )
);

/**
 * Count how often a job has already been re-run, following it across attempts.
 *
 * **Details**
 *
 * Every attempt after the first in which a job of the same name actually ran
 * (it is not a copy, see {@link runnerLossCopiedFrom}) is one rerun, up to and
 * including the job's own attempt.
 *
 * **Example** (A job re-run once)
 *
 * ```ts
 * import { CiWorkflowJob, runnerLossJobReruns } from "@beep/repo-cli/commands/Ci"
 *
 * const job = (id: number, run_attempt: number, started_at: string) =>
 *   CiWorkflowJob.make({
 *     completed_at: "2026-09-30T23:00:00Z",
 *     conclusion: "failure",
 *     created_at: "2026-09-30T19:37:00Z",
 *     id,
 *     name: "Heavy / Docgen",
 *     run_attempt,
 *     run_id: 36763005302,
 *     started_at,
 *     status: "completed",
 *   })
 * const first = job(1, 1, "2026-09-30T20:00:00Z")
 * const rerun = job(2, 2, "2026-09-30T21:00:00Z")
 * console.log(runnerLossJobReruns(rerun, [first, rerun])) // 1
 * ```
 *
 * @param job - A job of the evaluated attempt.
 * @param runJobs - Every job of the run's attempts up to the evaluated one.
 * @returns The number of earlier reruns of the job, its own run included.
 * @category utilities
 * @since 0.0.0
 */
export const runnerLossJobReruns: {
  (runJobs: ReadonlyArray<CiWorkflowJob>): (job: CiWorkflowJob) => number;
  (job: CiWorkflowJob, runJobs: ReadonlyArray<CiWorkflowJob>): number;
} = dual(2, (job: CiWorkflowJob, runJobs: ReadonlyArray<CiWorkflowJob>): number =>
  A.length(
    A.filter(
      runJobs,
      (candidate) =>
        candidate.name === job.name &&
        candidate.run_attempt >= 2 &&
        candidate.run_attempt <= job.run_attempt &&
        O.isNone(runnerLossCopiedFrom(candidate, runJobs))
    )
  )
);

/**
 * Judge one failed REST job row against its annotation messages and reruns.
 *
 * **Details**
 *
 * The job is lost when it concluded `failure`, an annotation matches
 * {@link RUNNER_LOSS_ANNOTATION_PATTERN}, and no step concluded `failure`.
 * For a copied job, pass the annotations of the job it was copied from.
 *
 * **Example** (A job lost mid-step)
 *
 * ```ts
 * import { CiWorkflowJob, RunnerLossJobEvidence, runnerLossFailedJob } from "@beep/repo-cli/commands/Ci"
 *
 * const job = CiWorkflowJob.make({
 *   completed_at: "2026-09-30T20:01:54Z",
 *   conclusion: "failure",
 *   created_at: "2026-09-30T19:37:00Z",
 *   id: 110050993181,
 *   name: "Heavy / Lint Policy",
 *   run_attempt: 1,
 *   run_id: 36763005302,
 *   runner_name: "beep-ci-i-0747b6f71d6489e73",
 *   started_at: "2026-09-30T19:38:28Z",
 *   status: "completed",
 *   steps: [
 *     { name: "Set up job", conclusion: "success", started_at: null, completed_at: null },
 *     { name: "Run verification lane", conclusion: null, started_at: null, completed_at: null },
 *   ],
 * })
 * const evidence = RunnerLossJobEvidence.make({
 *   annotations: ["The self-hosted runner lost communication with the server."],
 * })
 * console.log(runnerLossFailedJob(job, evidence).runnerLoss) // true
 * ```
 *
 * @param job - One failed job row from the Actions jobs REST endpoint.
 * @param evidence - Its annotation messages and prior rerun count.
 * @returns The job with its runner-loss verdict.
 * @category utilities
 * @since 0.0.0
 */
export const runnerLossFailedJob: {
  (evidence: RunnerLossJobEvidence): (job: CiWorkflowJob) => RunnerLossFailedJob;
  (job: CiWorkflowJob, evidence: RunnerLossJobEvidence): RunnerLossFailedJob;
} = dual(
  2,
  (job: CiWorkflowJob, evidence: RunnerLossJobEvidence): RunnerLossFailedJob =>
    RunnerLossFailedJob.make({
      id: job.id,
      name: job.name,
      runnerName: job.runner_name,
      runnerLoss:
        O.exists(githubConclusion(job.conclusion), (value) => value === "failure") &&
        A.some(evidence.annotations, (message) => RUNNER_LOSS_ANNOTATION_PATTERN.test(message)) &&
        !githubJobHasFailedStep(ciWorkflowJobShapeRecord(job)),
      reruns: evidence.reruns,
    })
);

const reasonForHead = (status: RunnerLossHeadStatus): RunnerLossRerunReason =>
  RunnerLossHeadStatus.$match(status, {
    current: () => RunnerLossRerunReason.Enum["runner-loss"],
    superseded: () => RunnerLossRerunReason.Enum["superseded-head"],
    "no-open-pull-request": () => RunnerLossRerunReason.Enum["no-open-pull-request"],
    "unsupported-event": () => RunnerLossRerunReason.Enum["unsupported-event"],
    unchecked: () => RunnerLossRerunReason.Enum["head-unchecked"],
  });

const isRunConclusion = (run: RunnerLossRun, expected: string): boolean =>
  O.exists(githubConclusion(run.conclusion), (value) => value === expected);

const byReruns = Order.mapInput(Order.Number, (job: RunnerLossFailedJob) => job.reruns);

/**
 * Decide whether one lost job of a workflow-run attempt is re-run.
 *
 * **Details**
 *
 * Gates run in order and the first one that refuses names the reason: the run
 * must be completed and failed, at least one job lost and under the per-job
 * bound, the evaluated attempt the latest, the run below the attempt
 * ceiling, and the head still current. The job re-run is the eligible lost
 * job with the fewest prior reruns; no other failed job is ever re-run.
 *
 * **Example** (A run that succeeded)
 *
 * ```ts
 * import { decideRunnerLossRerun, RunnerLossHead, RunnerLossRerunInput, RunnerLossRun } from "@beep/repo-cli/commands/Ci"
 *
 * const decision = decideRunnerLossRerun(
 *   RunnerLossRerunInput.make({
 *     run: RunnerLossRun.make({
 *       id: 1,
 *       name: "Check",
 *       event: "push",
 *       status: "completed",
 *       conclusion: "success",
 *       run_attempt: 1,
 *       head_sha: "abc",
 *       head_branch: "main",
 *       head_owner: "beep-effect",
 *     }),
 *     attempt: 1,
 *     failedJobs: [],
 *     head: RunnerLossHead.make({ status: "unchecked" }),
 *   })
 * )
 * console.log(decision.reason) // "run-not-failed"
 * ```
 *
 * @param input - The run, attempt, failed jobs, bounds, and head finding.
 * @returns The decision, naming the first gate that refused or `runner-loss`.
 * @category use-cases
 * @since 0.0.0
 */
export const decideRunnerLossRerun = (input: RunnerLossRerunInput): RunnerLossRerunDecision => {
  const lostJobs = A.filter(input.failedJobs, (job) => job.runnerLoss);
  const otherFailedJobs = A.filter(input.failedJobs, (job) => !job.runnerLoss);
  const eligible = A.filter(lostJobs, (job) => job.reruns < input.maxJobReruns);
  const decision = (reason: RunnerLossRerunReason, head: O.Option<RunnerLossHead>) => {
    const rerun = reason === RunnerLossRerunReason.Enum["runner-loss"];
    return RunnerLossRerunDecision.make({
      rerun,
      reason,
      runId: input.run.id,
      attempt: input.attempt,
      maxAttempt: input.maxAttempt,
      maxJobReruns: input.maxJobReruns,
      rerunJob: rerun ? A.head(A.sort(eligible, byReruns)) : O.none(),
      lostJobs,
      otherFailedJobs,
      head,
    });
  };
  const skip = (reason: RunnerLossRerunReason) => decision(reason, O.none());
  if (Str.toLowerCase(input.run.status) !== "completed") {
    return skip(RunnerLossRerunReason.Enum["run-not-completed"]);
  }
  if (!isRunConclusion(input.run, "failure")) {
    return skip(RunnerLossRerunReason.Enum["run-not-failed"]);
  }
  if (A.isReadonlyArrayEmpty(lostJobs)) {
    return skip(RunnerLossRerunReason.Enum["no-runner-loss"]);
  }
  if (A.isReadonlyArrayEmpty(eligible)) {
    return skip(RunnerLossRerunReason.Enum["job-reruns-exhausted"]);
  }
  if (input.attempt < input.run.run_attempt) {
    return skip(RunnerLossRerunReason.Enum["attempt-already-rerun"]);
  }
  if (input.run.run_attempt >= input.maxAttempt) {
    return skip(RunnerLossRerunReason.Enum["attempt-cap"]);
  }
  return decision(reasonForHead(input.head.status), O.some(input.head));
};

/**
 * The `gh` arguments that request a decided rerun.
 *
 * **Details**
 *
 * Always `gh run rerun --job <id>` for the one lost job chosen. `--failed`
 * is never used: it would also re-run jobs that failed for a real reason and
 * hide their red.
 *
 * **Example** (One lost job)
 *
 * ```ts
 * import { RunnerLossFailedJob, RunnerLossRerunDecision, runnerLossRerunArgs } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const lost = RunnerLossFailedJob.make({ id: 9, name: "Heavy / Check", runnerName: null, runnerLoss: true })
 * const decision = RunnerLossRerunDecision.make({
 *   rerun: true,
 *   reason: "runner-loss",
 *   runId: 7,
 *   attempt: 1,
 *   maxAttempt: 8,
 *   maxJobReruns: 3,
 *   rerunJob: O.some(lost),
 *   lostJobs: [lost],
 *   otherFailedJobs: [],
 * })
 * console.log(runnerLossRerunArgs(decision)) // Some(["run", "rerun", "--job", "9"])
 * ```
 *
 * @param decision - A decision from {@link decideRunnerLossRerun}.
 * @returns The `gh` arguments, or `None` when the decision does not rerun.
 * @category formatting
 * @since 0.0.0
 */
export const runnerLossRerunArgs = (decision: RunnerLossRerunDecision): O.Option<ReadonlyArray<string>> =>
  O.map(decision.rerunJob, (job) => ["run", "rerun", "--job", `${job.id}`]);

const reasonSentence = (decision: RunnerLossRerunDecision): string =>
  RunnerLossRerunReason.$match(decision.reason, {
    "runner-loss": () => "a job lost its runner, is under its rerun bound, and the head is current",
    "run-not-completed": () => "the run has not completed",
    "run-not-failed": () => "the run did not fail",
    "no-runner-loss": () => "no failed job carries the lost-communication annotation without a failed step",
    "job-reruns-exhausted": () => `every lost job was already re-run ${decision.maxJobReruns} times`,
    "attempt-already-rerun": () => "a newer attempt of this run already exists",
    "attempt-cap": () => `the run reached attempt ${decision.maxAttempt}, the run ceiling`,
    "superseded-head": () =>
      "a newer commit superseded this run's head; re-running it would cancel the current head's run",
    "no-open-pull-request": () => "no open pull request has this run's head",
    "unsupported-event": () => "only pull_request and push runs are re-run",
    "head-unchecked": () => "the head was not read",
  });

const isExhausted = (decision: RunnerLossRerunDecision, job: RunnerLossFailedJob): boolean =>
  job.reruns >= decision.maxJobReruns;

const lostJobAction = (report: RunnerLossRerunReport, job: RunnerLossFailedJob): string => {
  const { decision } = report;
  if (isExhausted(decision, job)) {
    return `left red: re-run ${job.reruns} times already`;
  }
  if (decision.reason === RunnerLossRerunReason.Enum["attempt-cap"]) {
    return "left red: run ceiling reached";
  }
  if (O.exists(decision.rerunJob, (chosen) => chosen.id === job.id)) {
    return report.dryRun ? "would re-run" : "re-run requested";
  }
  return decision.rerun ? "waits for the next attempt" : "not re-run";
};

const jobRow = (job: RunnerLossFailedJob, action: string): string =>
  `| ${job.name} | \`${job.id}\` | ${job.runnerName ?? "unknown"} | ${job.runnerLoss ? "runner lost" : "failed"} | ${job.reruns} | ${action} |`;

const namesLine = (label: string, jobs: ReadonlyArray<RunnerLossFailedJob>): O.Option<string> =>
  A.isReadonlyArrayNonEmpty(jobs)
    ? O.some(
        `- ${label}: ${A.join(
          A.map(jobs, (job) => job.name),
          ", "
        )}`
      )
    : O.none();

/**
 * Render a rerun report as the Markdown the workflow writes to its job summary.
 *
 * **Details**
 *
 * Every failed job is listed with its runner, its loss verdict, its prior
 * reruns, and what was done about it. Jobs that failed for another reason and
 * lost jobs stopped by a bound are named as left red, so a rerun never hides
 * them.
 *
 * **Example** (Render a skip)
 *
 * ```ts
 * import { RunnerLossRerunDecision, RunnerLossRerunReport, renderRunnerLossRerunSummary } from "@beep/repo-cli/commands/Ci"
 *
 * const report = RunnerLossRerunReport.make({
 *   decision: RunnerLossRerunDecision.make({
 *     rerun: false,
 *     reason: "run-not-failed",
 *     runId: 1,
 *     attempt: 1,
 *     maxAttempt: 8,
 *     maxJobReruns: 3,
 *     lostJobs: [],
 *     otherFailedJobs: [],
 *   }),
 *   dryRun: true,
 * })
 * console.log(renderRunnerLossRerunSummary(report).startsWith("## Runner-loss rerun")) // true
 * ```
 *
 * @param report - A decision and whether its rerun was only reported.
 * @returns Markdown ending in a newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderRunnerLossRerunSummary = (report: RunnerLossRerunReport): string => {
  const { decision } = report;
  const verdict = O.match(decision.rerunJob, {
    onNone: () => "skipped",
    onSome: (job) => `${report.dryRun ? "would re-run" : "re-ran"} ${job.name} with \`gh run rerun --job ${job.id}\``,
  });
  const currentHead = pipe(
    decision.head,
    O.flatMap((head) => head.currentSha),
    O.map((sha) => `- Current head: \`${sha}\``)
  );
  const exhausted = A.filter(decision.lostJobs, (job) => isExhausted(decision, job));
  const ceilinged =
    decision.reason === RunnerLossRerunReason.Enum["attempt-cap"]
      ? A.filter(decision.lostJobs, (job) => !isExhausted(decision, job))
      : A.empty<RunnerLossFailedJob>();
  const rows = [
    ...A.map(decision.lostJobs, (job) => jobRow(job, lostJobAction(report, job))),
    ...A.map(decision.otherFailedJobs, (job) => jobRow(job, "left red: not runner loss")),
  ];
  const table = A.isReadonlyArrayNonEmpty(rows)
    ? ["", "| Job | Id | Runner | Failure | Reruns | Action |", "| --- | --- | --- | --- | --- | --- |", ...rows]
    : A.empty<string>();
  const lines = [
    "## Runner-loss rerun",
    "",
    `- Run: \`${decision.runId}\`, attempt ${decision.attempt} (run ceiling ${decision.maxAttempt}, ${decision.maxJobReruns} reruns per job)`,
    `- Verdict: ${verdict} (\`${decision.reason}\`): ${reasonSentence(decision)}`,
    ...O.toArray(currentHead),
    ...O.toArray(namesLine("Left red, failed for another reason (never re-run)", decision.otherFailedJobs)),
    ...O.toArray(namesLine(`Left red, re-run ${decision.maxJobReruns} times already`, exhausted)),
    ...O.toArray(namesLine("Left red, run ceiling reached", ceilinged)),
    ...table,
  ];
  return `${A.join(lines, "\n")}\n`;
};
