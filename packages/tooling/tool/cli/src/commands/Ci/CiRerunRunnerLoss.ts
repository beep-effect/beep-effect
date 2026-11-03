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
 * appends it to `$GITHUB_STEP_SUMMARY` through `ActionOutputs` when that is set. Every verdict exits
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

import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { BoolKeyDefaultFalse } from "@beep/schema/SchemaUtils/withKeyDefaults";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";
import { CiRunnerOutputsLive } from "./CiRunnerOutputs.ts";
import { CiWorkflowJobsPage, ghApiJson, githubStatusSuffix, withCiGithub } from "./LaneTimings.ts";
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
} from "./RunnerLossRerun.ts";
import type * as FileSystem from "effect/FileSystem";
import type { CiWorkflowJob } from "./LaneTimings.ts";
import type { RunnerLossFailedJob } from "./RunnerLossRerun.ts";

const $I = $RepoCliId.create("commands/Ci/CiRerunRunnerLoss");

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
 * judges a newer attempt. `stepSummary` is whether `$GITHUB_STEP_SUMMARY` is
 * set, so the decision is appended to it through `ActionOutputs`.
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
export class CiRerunRunnerLossInput extends S.Opaque<CiRerunRunnerLossInput, { readonly brand: unique symbol }>()(
  S.Struct({
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
    stepSummary: BoolKeyDefaultFalse,
    cwd: S.String,
  }).pipe(
    $I.annoteSchema("CiRerunRunnerLossInput", {
      description: "Resolved flags and environment of one ci rerun-runner-loss invocation.",
    })
  )
) {}

class RunnerLossPullRequest extends S.Opaque<RunnerLossPullRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    number: S.Finite,
    state: S.String,
    head_sha: S.String,
    head_ref: S.String,
    head_owner: S.NullOr(S.String),
  }).pipe(
    $I.annoteSchema("RunnerLossPullRequest", {
      description: "The state, head SHA, and head branch of one pull request read by the runner-loss head gate.",
    })
  )
) {}

// The REST shapes the head gate reads; each is projected onto the decision's own model.
const RepositoryOwner = S.NullOr(S.Struct({ owner: S.Struct({ login: S.String }) }));
const RunWire = S.Struct({
  id: S.Finite,
  name: S.String,
  event: S.String,
  status: S.String,
  conclusion: S.NullOr(S.String),
  run_attempt: S.Finite,
  head_sha: S.String,
  head_branch: S.NullOr(S.String),
  head_repository: RepositoryOwner,
  pull_requests: S.Array(S.Struct({ number: S.Finite })),
}).pipe($I.annoteSchema("RunnerLossRunWire", { description: "The workflow-run REST fields the decision reads." }));
const PullRequestWire = S.Struct({
  number: S.Finite,
  state: S.String,
  head: S.Struct({ sha: S.String, ref: S.String, repo: RepositoryOwner }),
}).pipe($I.annoteSchema("RunnerLossPullRequestWire", { description: "The pull-request REST fields the gate reads." }));
const AnnotationWire = S.Struct({ message: S.String }).pipe(
  $I.annoteSchema("RunnerLossAnnotationWire", { description: "One check-run annotation's message." })
);
const BranchRefWire = S.Struct({ object: S.Struct({ sha: S.String }) }).pipe(
  $I.annoteSchema("RunnerLossBranchRefWire", { description: "The tip commit of one branch ref." })
);

const ownerLogin = (repository: typeof RepositoryOwner.Type): string | null => repository?.owner.login ?? null;
const pullRequestOf = (wire: typeof PullRequestWire.Type): RunnerLossPullRequest =>
  RunnerLossPullRequest.make({
    number: wire.number,
    state: wire.state,
    head_sha: wire.head.sha,
    head_ref: wire.head.ref,
    head_owner: ownerLogin(wire.head.repo),
  });

const decodeRun = S.decodeUnknownEffect(RunWire);
const decodeJobsPage = S.decodeUnknownEffect(CiWorkflowJobsPage);
const decodeAnnotations = S.decodeUnknownEffect(S.Array(AnnotationWire));
const decodePullRequest = S.decodeUnknownEffect(PullRequestWire);
const decodePullRequests = S.decodeUnknownEffect(S.Array(PullRequestWire));
const decodeBranchRef = S.decodeUnknownEffect(BranchRefWire);

type GhRequirements = GitHubClient | Repo;

const readRun = Effect.fn("Ci.rerunRunnerLoss.readRun")(function* (
  runId: number
): Effect.fn.Return<RunnerLossRun, CiCommandError, GhRequirements> {
  const output = yield* ghApiJson(`repos/{owner}/{repo}/actions/runs/${runId}`);
  const wire = yield* decodeRun(output).pipe(CiCommandError.mapError(`Failed to decode workflow run ${runId}.`));
  return RunnerLossRun.make({
    id: wire.id,
    name: wire.name,
    event: wire.event,
    status: wire.status,
    conclusion: wire.conclusion,
    run_attempt: wire.run_attempt,
    head_sha: wire.head_sha,
    head_branch: wire.head_branch,
    head_owner: ownerLogin(wire.head_repository),
    pull_requests: A.map(wire.pull_requests, (pull) => pull.number),
  });
});

const readJobsPage = Effect.fn("Ci.rerunRunnerLoss.readJobsPage")(function* (
  runId: number,
  attempt: number,
  page: number
): Effect.fn.Return<CiWorkflowJobsPage, CiCommandError, GhRequirements> {
  const output = yield* ghApiJson(
    `repos/{owner}/{repo}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=${JOBS_PER_PAGE}&page=${page}`
  );
  return yield* decodeJobsPage(output).pipe(
    CiCommandError.mapError(`Failed to decode jobs page ${page} of run ${runId} attempt ${attempt}.`)
  );
});

const readAttemptJobs = (
  runId: number,
  attempt: number
): Effect.Effect<ReadonlyArray<CiWorkflowJob>, CiCommandError, GhRequirements> => {
  const go = (
    page: number,
    collected: ReadonlyArray<CiWorkflowJob>
  ): Effect.Effect<ReadonlyArray<CiWorkflowJob>, CiCommandError, GhRequirements> =>
    readJobsPage(runId, attempt, page).pipe(
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
  jobId: number,
  page: number
): Effect.fn.Return<ReadonlyArray<string>, CiCommandError, GhRequirements> {
  const output = yield* ghApiJson(
    `repos/{owner}/{repo}/check-runs/${jobId}/annotations?per_page=${ANNOTATIONS_PER_PAGE}&page=${page}`
  );
  return yield* decodeAnnotations(output).pipe(
    Effect.map(A.map((annotation) => annotation.message)),
    CiCommandError.mapError(`Failed to decode annotations page ${page} of job ${jobId}.`)
  );
});

// The lost-communication annotation can sit behind other annotations, so every
// page is read; a short page is the last one.
const readAnnotations = (jobId: number): Effect.Effect<ReadonlyArray<string>, CiCommandError, GhRequirements> => {
  const go = (
    page: number,
    collected: ReadonlyArray<string>
  ): Effect.Effect<ReadonlyArray<string>, CiCommandError, GhRequirements> =>
    readAnnotationsPage(jobId, page).pipe(
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
  run: RunnerLossRun,
  attempt: number
): Effect.fn.Return<ReadonlyArray<RunnerLossFailedJob>, CiCommandError, GhRequirements> {
  if (Str.toLowerCase(run.status) !== "completed" || run.conclusion !== "failure") {
    return A.empty();
  }
  // Every attempt up to the evaluated one: a rerun attempt copies the jobs it
  // did not re-run without their annotations, so a copied job is judged by
  // its original, and each job's prior reruns are counted across attempts.
  const runJobs = yield* Effect.forEach(A.range(1, attempt), (each) => readAttemptJobs(run.id, each), {
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
      return readAnnotations(annotatedId).pipe(
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
  run: RunnerLossRun
): Effect.fn.Return<RunnerLossHead, CiCommandError, GhRequirements> {
  const listed = yield* Effect.forEach(
    run.pull_requests,
    Effect.fnUntraced(function* (number) {
      const output = yield* ghApiJson(`repos/{owner}/{repo}/pulls/${number}`);
      return yield* decodePullRequest(output).pipe(
        Effect.map(pullRequestOf),
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
          `repos/{owner}/{repo}/pulls?state=open&per_page=10&head=${encodeURIComponent(`${run.head_owner}:${run.head_branch}`)}`
        ).pipe(
          Effect.flatMap((output) =>
            decodePullRequests(output).pipe(
              Effect.map(A.map(pullRequestOf)),
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
  run: RunnerLossRun,
  branch: string
): Effect.fn.Return<RunnerLossHead, CiCommandError, GhRequirements> {
  const output = yield* ghApiJson(`repos/{owner}/{repo}/git/ref/heads/${branch}`);
  const ref = yield* decodeBranchRef(output).pipe(CiCommandError.mapError(`Failed to decode the tip of ${branch}.`));
  return ref.object.sha === run.head_sha
    ? RunnerLossHead.make({ status: "current" })
    : RunnerLossHead.make({ status: "superseded", currentSha: O.some(ref.object.sha) });
});

const readHead = (run: RunnerLossRun): Effect.Effect<RunnerLossHead, CiCommandError, GhRequirements> => {
  if (run.event === "pull_request") {
    return readPullRequestHead(run);
  }
  if (run.event === "push" && run.head_branch !== null) {
    return readBranchHead(run, run.head_branch);
  }
  return Effect.succeed(RunnerLossHead.make({ status: "unsupported-event" }));
};

// `gh run rerun --job <id>`: the job and the jobs that depend on it run again.
const requestRerun = Effect.fn("Ci.rerunRunnerLoss.requestRerun")(function* (
  jobId: number
): Effect.fn.Return<void, CiCommandError, GhRequirements> {
  const client = yield* GitHubClient;
  const { owner, repo } = yield* Repo;
  yield* client
    .requestDecoded("POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun", { owner, repo, job_id: jobId }, S.Unknown)
    .pipe(
      Effect.mapError((error) =>
        CiCommandError.make({
          message: `GitHub API rerun of job ${jobId} failed${githubStatusSuffix(error)}: ${error.reason}`,
        })
      )
    );
});

/**
 * Read a workflow run, decide its runner-loss rerun, request the rerun of the
 * chosen lost job unless the input is a dry run, and report the outcome.
 *
 * **Example** (Reference the runner)
 *
 * ```ts
 * import { CiRerunRunnerLossInput, runCiRerunRunnerLoss } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect";
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
): Effect.fn.Return<RunnerLossRerunReport, CiCommandError, ActionOutputs | GhRequirements> {
  const run = yield* readRun(input.runId);
  const attempt = O.getOrElse(input.attempt, () => run.run_attempt);
  const failedJobs = yield* readFailedJobs(run, attempt);
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
  const decision = unchecked.reason === "head-unchecked" ? yield* Effect.map(readHead(run), decide) : unchecked;
  if (O.isSome(decision.rerunJob) && !input.dryRun) {
    yield* requestRerun(decision.rerunJob.value.id);
  }
  const report = RunnerLossRerunReport.make({ decision, dryRun: input.dryRun });
  const summary = renderRunnerLossRerunSummary(report);
  yield* Console.log(summary);
  if (input.stepSummary) {
    const outputs = yield* ActionOutputs;
    yield* outputs
      .summary(summary)
      .pipe(CiCommandError.mapError("Failed to append the rerun decision to $GITHUB_STEP_SUMMARY."));
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
  const stepSummary = yield* Config.option(Config.String("GITHUB_STEP_SUMMARY")).pipe(
    Effect.orElseSucceed(O.none<string>),
    Effect.map(O.exists(Str.isNonEmpty))
  );
  return CiRerunRunnerLossInput.make({
    runId: flags.runId,
    attempt: flags.attempt,
    maxAttempt: flags.maxAttempt,
    maxJobReruns: flags.maxJobReruns,
    dryRun: flags.dryRun,
    stepSummary,
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
 * import * as Command from "effect/cli/Command";
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
      Effect.flatMap((input) => runCiRerunRunnerLoss(input).pipe(withCiGithub(input.cwd))),
      Effect.catchTag("CiCommandError", reportCiCommandError)
    )
).pipe(
  Command.withDescription("Re-run the jobs of a completed workflow run that lost their runner"),
  Command.provide(CiRunnerOutputsLive)
);
