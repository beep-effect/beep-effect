/**
 * `bun run beep ci rerun-runner-loss`: re-run the jobs of a completed
 * workflow run that failed because their runner died.
 *
 * **Details**
 *
 * The `Rerun Runner Loss` workflow runs this on every completed `Check` and
 * `Heavy Admit` run. It reads the run, the evaluated attempt's jobs, and each
 * failed job's check-run annotations, decides with
 * {@link decideRunnerLossRerun}, requests one `gh run rerun --job <id>` for
 * the lost job it chose unless `--dry-run` was passed, prints the report, and
 * appends it to `$GITHUB_STEP_SUMMARY` when that is set. Every verdict exits
 * 0; only unreadable GitHub state or a refused rerun exits non-zero.
 *
 * **Gotchas**
 *
 * `gh` resolves `{owner}/{repo}` from `GH_REPO` or the checkout's remote. The
 * head gate is read last and only when every earlier gate passed, so a green
 * or capped run costs one API call.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { Config, Console, Effect, FileSystem, pipe } from "effect";
import * as A from "effect/Array";
import { Command, Flag } from "effect/cli";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { ghOutput } from "../../internal/github/index.ts";
import { CiCommandError } from "./Ci.errors.ts";
import { CiWorkflowJobsPage, ghApiJson } from "./LaneTimings.ts";
import {
  decideRunnerLossRerun,
  RUNNER_LOSS_MAX_JOB_RERUNS,
  RUNNER_LOSS_RERUN_MAX_ATTEMPT,
  RunnerLossHead,
  RunnerLossJobEvidence,
  RunnerLossRerunInput,
  RunnerLossRerunReport,
  RunnerLossRun,
  renderRunnerLossRerunSummary,
  runnerLossCopiedFrom,
  runnerLossFailedJob,
  runnerLossJobReruns,
  runnerLossRerunArgs,
} from "./RunnerLossRerun.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { CiWorkflowJob } from "./LaneTimings.ts";
import type { RunnerLossFailedJob } from "./RunnerLossRerun.ts";

const $I = $RepoCliId.create("commands/Ci/CiRerunRunnerLoss");

const RUN_JQ =
  "{id,name,event,status,conclusion,run_attempt,head_sha,head_branch,head_owner:.head_repository.owner.login,pull_requests:[.pull_requests[].number]}";
const JOBS_JQ =
  "{total_count,jobs:[.jobs[]|{completed_at,conclusion,created_at,id,labels,name,run_attempt,run_id,runner_name,started_at,status,steps}]}";
const ANNOTATIONS_JQ = "[.[].message]";
const PULL_REQUEST_JQ = "{number,state,head_sha:.head.sha,head_ref:.head.ref,head_owner:.head.repo.owner.login}";
const PULL_REQUESTS_JQ = "[.[]|{number,state,head_sha:.head.sha,head_ref:.head.ref,head_owner:.head.repo.owner.login}]";
const BRANCH_REF_JQ = "{sha:.object.sha}";
const JOBS_PER_PAGE = 100;
const ANNOTATIONS_PER_PAGE = 100;
// Ten pages bound the loop; a failed heavy job carries one or two annotations.
const ANNOTATIONS_MAX_PAGES = 10;
// Ten pages is 1000 jobs; a Check run has about forty.
const JOBS_MAX_PAGES = 10;

/**
 * The resolved inputs of one `ci rerun-runner-loss` invocation.
 *
 * **Details**
 *
 * `attempt` is `None` to evaluate the run's latest attempt; the workflow
 * passes the attempt whose completion triggered it, so a late event never
 * judges a newer attempt. `stepSummaryPath` is `$GITHUB_STEP_SUMMARY` when set.
 *
 * **Example** (A dry run of one run)
 *
 * ```ts
 * import { CiRerunRunnerLossInput } from "@beep/repo-cli/commands/Ci"
 *
 * const input = CiRerunRunnerLossInput.make({ runId: 36763005302, dryRun: true, cwd: "." })
 * console.log(input.maxJobReruns) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiRerunRunnerLossInput extends S.Class<CiRerunRunnerLossInput>($I`CiRerunRunnerLossInput`)(
  {
    runId: S.Finite,
    attempt: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    maxAttempt: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(RUNNER_LOSS_RERUN_MAX_ATTEMPT)),
      S.withDecodingDefaultTypeKey(Effect.succeed(RUNNER_LOSS_RERUN_MAX_ATTEMPT))
    ),
    dryRun: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    maxJobReruns: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(RUNNER_LOSS_MAX_JOB_RERUNS)),
      S.withDecodingDefaultTypeKey(Effect.succeed(RUNNER_LOSS_MAX_JOB_RERUNS))
    ),
    stepSummaryPath: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    cwd: S.String,
  },
  $I.annote("CiRerunRunnerLossInput", {
    description: "Resolved flags and environment of one ci rerun-runner-loss invocation.",
  })
) {}

class RunnerLossPullRequest extends S.Class<RunnerLossPullRequest>($I`RunnerLossPullRequest`)(
  { number: S.Finite, state: S.String, head_sha: S.String, head_ref: S.String, head_owner: S.NullOr(S.String) },
  $I.annote("RunnerLossPullRequest", {
    description: "The state, head SHA, and head branch of one pull request read by the runner-loss head gate.",
  })
) {}

class RunnerLossBranchRef extends S.Class<RunnerLossBranchRef>($I`RunnerLossBranchRef`)(
  { sha: S.String },
  $I.annote("RunnerLossBranchRef", { description: "The tip SHA of one branch read by the runner-loss head gate." })
) {}

const decodeRun = S.decodeUnknownEffect(S.fromJsonString(RunnerLossRun));
const decodeJobsPage = S.decodeUnknownEffect(S.fromJsonString(CiWorkflowJobsPage));
const decodeAnnotations = S.decodeUnknownEffect(S.fromJsonString(S.Array(S.String)));
const decodePullRequest = S.decodeUnknownEffect(S.fromJsonString(RunnerLossPullRequest));
const decodePullRequests = S.decodeUnknownEffect(S.fromJsonString(S.Array(RunnerLossPullRequest)));
const decodeBranchRef = S.decodeUnknownEffect(S.fromJsonString(RunnerLossBranchRef));

type GhRequirements = Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner;

const readRun = Effect.fn("Ci.rerunRunnerLoss.readRun")(function* (
  cwd: string,
  runId: number
): Effect.fn.Return<RunnerLossRun, CiCommandError, GhRequirements> {
  const output = yield* ghApiJson(cwd, `repos/{owner}/{repo}/actions/runs/${runId}`, O.some(RUN_JQ));
  return yield* decodeRun(output).pipe(CiCommandError.mapError(`Failed to decode workflow run ${runId}.`));
});

const readJobsPage = Effect.fn("Ci.rerunRunnerLoss.readJobsPage")(function* (
  cwd: string,
  runId: number,
  attempt: number,
  page: number
): Effect.fn.Return<CiWorkflowJobsPage, CiCommandError, GhRequirements> {
  const output = yield* ghApiJson(
    cwd,
    `repos/{owner}/{repo}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=${JOBS_PER_PAGE}&page=${page}`,
    O.some(JOBS_JQ)
  );
  return yield* decodeJobsPage(output).pipe(
    CiCommandError.mapError(`Failed to decode jobs page ${page} of run ${runId} attempt ${attempt}.`)
  );
});

const readAttemptJobs = (
  cwd: string,
  runId: number,
  attempt: number
): Effect.Effect<ReadonlyArray<CiWorkflowJob>, CiCommandError, GhRequirements> => {
  const go = (
    page: number,
    collected: ReadonlyArray<CiWorkflowJob>
  ): Effect.Effect<ReadonlyArray<CiWorkflowJob>, CiCommandError, GhRequirements> =>
    readJobsPage(cwd, runId, attempt, page).pipe(
      Effect.flatMap((jobsPage) => {
        const jobs = A.appendAll(collected, jobsPage.jobs);
        return A.length(jobs) < jobsPage.total_count &&
          A.isReadonlyArrayNonEmpty(jobsPage.jobs) &&
          page < JOBS_MAX_PAGES
          ? go(page + 1, jobs)
          : Effect.succeed(jobs);
      })
    );
  return go(1, A.empty());
};

const readAnnotationsPage = Effect.fn("Ci.rerunRunnerLoss.readAnnotationsPage")(function* (
  cwd: string,
  jobId: number,
  page: number
): Effect.fn.Return<ReadonlyArray<string>, CiCommandError, GhRequirements> {
  const output = yield* ghApiJson(
    cwd,
    `repos/{owner}/{repo}/check-runs/${jobId}/annotations?per_page=${ANNOTATIONS_PER_PAGE}&page=${page}`,
    O.some(ANNOTATIONS_JQ)
  );
  return yield* decodeAnnotations(output).pipe(
    CiCommandError.mapError(`Failed to decode annotations page ${page} of job ${jobId}.`)
  );
});

// The lost-communication annotation can sit behind other annotations, so every
// page is read; a short page is the last one.
const readAnnotations = (
  cwd: string,
  jobId: number
): Effect.Effect<ReadonlyArray<string>, CiCommandError, GhRequirements> => {
  const go = (
    page: number,
    collected: ReadonlyArray<string>
  ): Effect.Effect<ReadonlyArray<string>, CiCommandError, GhRequirements> =>
    readAnnotationsPage(cwd, jobId, page).pipe(
      Effect.flatMap((messages) => {
        const all = A.appendAll(collected, messages);
        return A.length(messages) === ANNOTATIONS_PER_PAGE && page < ANNOTATIONS_MAX_PAGES
          ? go(page + 1, all)
          : Effect.succeed(all);
      })
    );
  return go(1, A.empty());
};

const isFailedJob = (job: CiWorkflowJob): boolean =>
  O.exists(O.fromNullishOr(job.conclusion), (conclusion) => Str.toLowerCase(conclusion) === "failure");

const readFailedJobs = Effect.fn("Ci.rerunRunnerLoss.readFailedJobs")(function* (
  cwd: string,
  run: RunnerLossRun,
  attempt: number
): Effect.fn.Return<ReadonlyArray<RunnerLossFailedJob>, CiCommandError, GhRequirements> {
  if (Str.toLowerCase(run.status) !== "completed" || run.conclusion !== "failure") {
    return A.empty();
  }
  // Every attempt up to the evaluated one: a rerun attempt copies the jobs it
  // did not re-run without their annotations, so a copied job is judged by
  // its original, and each job's prior reruns are counted across attempts.
  const runJobs = yield* Effect.forEach(A.range(1, attempt), (each) => readAttemptJobs(cwd, run.id, each), {
    concurrency: 2,
  }).pipe(Effect.map(A.flatten));
  return yield* Effect.forEach(
    A.filter(runJobs, (job) => job.run_attempt === attempt && isFailedJob(job)),
    (job) => {
      const annotatedId = pipe(
        runnerLossCopiedFrom(job, runJobs),
        O.map((origin) => origin.id),
        O.getOrElse(() => job.id)
      );
      return readAnnotations(cwd, annotatedId).pipe(
        Effect.map((annotations) =>
          runnerLossFailedJob(
            job,
            RunnerLossJobEvidence.make({ annotations, reruns: runnerLossJobReruns(job, runJobs) })
          )
        )
      );
    },
    { concurrency: 4 }
  );
});

const readPullRequestHead = Effect.fn("Ci.rerunRunnerLoss.readPullRequestHead")(function* (
  cwd: string,
  run: RunnerLossRun
): Effect.fn.Return<RunnerLossHead, CiCommandError, GhRequirements> {
  const listed = yield* Effect.forEach(
    run.pull_requests,
    Effect.fnUntraced(function* (number) {
      const output = yield* ghApiJson(cwd, `repos/{owner}/{repo}/pulls/${number}`, O.some(PULL_REQUEST_JQ));
      return yield* decodePullRequest(output).pipe(
        CiCommandError.mapError(`Failed to decode pull request #${number}.`)
      );
    })
  );
  // Only the pull requests the run belongs to decide: the ones whose head is
  // the run's own branch. Another pull request on the same commit has its own
  // concurrency group, so its head says nothing about this run.
  const ownsRun = (pullRequest: RunnerLossPullRequest) =>
    pullRequest.head_ref === run.head_branch && pullRequest.head_owner === run.head_owner;
  const owning = A.filter(listed, ownsRun);
  // A fork pull request is absent from the run's `pull_requests`; find it by
  // the head label instead.
  const found =
    A.isReadonlyArrayNonEmpty(owning) || run.head_owner === null || run.head_branch === null
      ? owning
      : yield* ghApiJson(
          cwd,
          `repos/{owner}/{repo}/pulls?state=open&per_page=10&head=${encodeURIComponent(`${run.head_owner}:${run.head_branch}`)}`,
          O.some(PULL_REQUESTS_JQ)
        ).pipe(
          Effect.flatMap((output) =>
            decodePullRequests(output).pipe(
              CiCommandError.mapError(`Failed to decode open pull requests for ${run.head_branch}.`)
            )
          ),
          Effect.map(A.filter(ownsRun))
        );
  const open = A.filter(found, (pullRequest) => Str.toLowerCase(pullRequest.state) === "open");
  if (A.isReadonlyArrayEmpty(open)) {
    return RunnerLossHead.make({ status: "no-open-pull-request" });
  }
  return pipe(
    A.findFirst(open, (pullRequest) => pullRequest.head_sha !== run.head_sha),
    O.match({
      onNone: () => RunnerLossHead.make({ status: "current" }),
      onSome: (pullRequest) => RunnerLossHead.make({ status: "superseded", currentSha: O.some(pullRequest.head_sha) }),
    })
  );
});

const readBranchHead = Effect.fn("Ci.rerunRunnerLoss.readBranchHead")(function* (
  cwd: string,
  run: RunnerLossRun,
  branch: string
): Effect.fn.Return<RunnerLossHead, CiCommandError, GhRequirements> {
  const output = yield* ghApiJson(cwd, `repos/{owner}/{repo}/git/ref/heads/${branch}`, O.some(BRANCH_REF_JQ));
  const ref = yield* decodeBranchRef(output).pipe(CiCommandError.mapError(`Failed to decode the tip of ${branch}.`));
  return ref.sha === run.head_sha
    ? RunnerLossHead.make({ status: "current" })
    : RunnerLossHead.make({ status: "superseded", currentSha: O.some(ref.sha) });
});

const readHead = (cwd: string, run: RunnerLossRun): Effect.Effect<RunnerLossHead, CiCommandError, GhRequirements> => {
  if (run.event === "pull_request") {
    return readPullRequestHead(cwd, run);
  }
  if (run.event === "push" && run.head_branch !== null) {
    return readBranchHead(cwd, run, run.head_branch);
  }
  return Effect.succeed(RunnerLossHead.make({ status: "unsupported-event" }));
};

const requestRerun = Effect.fn("Ci.rerunRunnerLoss.requestRerun")(function* (
  cwd: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<void, CiCommandError, GhRequirements> {
  yield* ghOutput({
    args,
    cwd,
    label: `gh ${A.join(args, " ")}`,
    onFailure: (failure) =>
      CiCommandError.make({
        message:
          failure._tag === "nonzero-exit"
            ? `${failure.command} exited ${failure.exitCode}: ${failure.output}`
            : `${failure.command} failed (${failure._tag}).`,
      }),
  });
});

/**
 * Read a workflow run, decide its runner-loss rerun, request the rerun of the
 * chosen lost job unless the input is a dry run, and report the outcome.
 *
 * **Example** (Reference the runner)
 *
 * ```ts
 * import { CiRerunRunnerLossInput, runCiRerunRunnerLoss } from "@beep/repo-cli/commands/Ci"
 * import { Effect } from "effect"
 *
 * const program = runCiRerunRunnerLoss(CiRerunRunnerLossInput.make({ runId: 1, dryRun: true, cwd: "." }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param input - The resolved flags and environment.
 * @returns The decision and whether its rerun was only reported.
 * @category use-cases
 * @since 0.0.0
 */
export const runCiRerunRunnerLoss = Effect.fn("Ci.runCiRerunRunnerLoss")(function* (
  input: CiRerunRunnerLossInput
): Effect.fn.Return<RunnerLossRerunReport, CiCommandError, FileSystem.FileSystem | GhRequirements> {
  const run = yield* readRun(input.cwd, input.runId);
  const attempt = O.getOrElse(input.attempt, () => run.run_attempt);
  const failedJobs = yield* readFailedJobs(input.cwd, run, attempt);
  const decide = (head: RunnerLossHead) =>
    decideRunnerLossRerun(
      RunnerLossRerunInput.make({
        run,
        attempt,
        maxAttempt: input.maxAttempt,
        maxJobReruns: input.maxJobReruns,
        failedJobs,
        head,
      })
    );
  const unchecked = decide(RunnerLossHead.make({ status: "unchecked" }));
  const decision = unchecked.reason === "head-unchecked" ? decide(yield* readHead(input.cwd, run)) : unchecked;
  const rerunArgs = runnerLossRerunArgs(decision);
  if (O.isSome(rerunArgs) && !input.dryRun) {
    yield* requestRerun(input.cwd, rerunArgs.value);
  }
  const report = RunnerLossRerunReport.make({ decision, dryRun: input.dryRun });
  const summary = renderRunnerLossRerunSummary(report);
  yield* Console.log(summary);
  if (O.isSome(input.stepSummaryPath)) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs
      .writeFileString(input.stepSummaryPath.value, summary, { flag: "a" })
      .pipe(CiCommandError.mapError(`Failed to append the rerun decision to ${input.stepSummaryPath.value}.`));
  }
  return report;
});

interface CiRerunRunnerLossFlags {
  readonly attempt: O.Option<number>;
  readonly dryRun: boolean;
  readonly maxAttempt: number;
  readonly maxJobReruns: number;
  readonly runId: number;
}

const resolveCiRerunRunnerLossInput = Effect.fn("Ci.resolveCiRerunRunnerLossInput")(function* (
  flags: CiRerunRunnerLossFlags
): Effect.fn.Return<CiRerunRunnerLossInput, CiCommandError, FileSystem.FileSystem> {
  const cwd = yield* findRepoRoot().pipe(CiCommandError.mapError("Failed to locate repository root."));
  const stepSummaryPath = yield* Config.option(Config.String("GITHUB_STEP_SUMMARY")).pipe(
    Effect.orElseSucceed(O.none<string>),
    Effect.map(O.filter(Str.isNonEmpty))
  );
  return CiRerunRunnerLossInput.make({
    runId: flags.runId,
    attempt: flags.attempt,
    maxAttempt: flags.maxAttempt,
    maxJobReruns: flags.maxJobReruns,
    dryRun: flags.dryRun,
    stepSummaryPath,
    cwd,
  });
});

/**
 * The `ci rerun-runner-loss` subcommand.
 *
 * **Example** (Register the subcommand)
 *
 * ```ts
 * import { ciRerunRunnerLossCommand } from "@beep/repo-cli/commands/Ci"
 * import { Command } from "effect/cli"
 *
 * const ci = Command.make("ci").pipe(Command.withSubcommands([ciRerunRunnerLossCommand]))
 * console.log(typeof ci) // "object"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciRerunRunnerLossCommand = Command.make(
  "rerun-runner-loss",
  {
    runId: Flag.Int("run-id").pipe(Flag.withDescription("Workflow run id to evaluate")),
    attempt: Flag.Int("attempt").pipe(
      Flag.optional,
      Flag.withDescription("Run attempt to evaluate (default: the run's latest attempt)")
    ),
    maxAttempt: Flag.Int("max-attempt").pipe(
      Flag.withDefault(RUNNER_LOSS_RERUN_MAX_ATTEMPT),
      Flag.withDescription("Run-attempt ceiling: no rerun once the run reaches this attempt")
    ),
    maxJobReruns: Flag.Int("max-job-reruns").pipe(
      Flag.withDefault(RUNNER_LOSS_MAX_JOB_RERUNS),
      Flag.withDescription("How many times one job, followed across attempts, is re-run for runner loss")
    ),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Report the decision without requesting the rerun")
    ),
  },
  (flags) =>
    pipe(
      resolveCiRerunRunnerLossInput(flags),
      Effect.flatMap(runCiRerunRunnerLoss),
      Effect.catchTag("CiCommandError", (error) =>
        Console.error(`[ci] ${error.message}`).pipe(Effect.andThen(failWithReportedExit(`[ci] ${error.message}`)))
      )
    )
).pipe(Command.withDescription("Re-run the jobs of a completed workflow run that lost their runner"));
