/**
 * Frozen pre-W6 bodies for `ops/yeet-gh-seams-differential-w6.ts`: the `gh` reads and writes of
 * `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts` (the run job list, the failed-job log and its
 * per-job endpoint fallback, the job classification and collection, the job rerun, and the head commit's committer
 * date), verbatim from the lane base 641180ade6 (W5 head) except for import paths and the identity namespace. Only
 * these bodies are frozen: the rest of the loop is unchanged by W6. `classifyNormalizedLog` and its timeout patterns
 * are copied because the live module keeps them private; `readPushedAt` is exported here so the differential can
 * drive it.
 */

import { $RepoCliId } from "@beep/identity/packages";
import { OutputBound, repoRunOutputBound, runCaptured } from "@beep/repo-cli-kit/process/StepExec";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { detectNoLocationTs2589Flake } from "../../../../packages/tooling/tool/cli/src/commands/Quality/internal/FlakeQuarantine.ts";
import {
  isolateYeetMonitorJobLogFailure,
  renderYeetMonitorJobDecision,
  stripYeetMonitorLogDecoration,
  YeetMonitorFailedJob,
  YeetMonitorFlakeClass,
} from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts";
import { collectRemoteWorkflowRuns } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts";
import {
  detectGithubJobShapeClass,
  GithubJobRecord,
  githubConclusion,
} from "../../../../packages/tooling/tool/cli/src/internal/github/index.ts";
import { runRepoCommandCapture } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { YeetMonitorJobDecision } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts";
import type { RepoRunContext } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";

const $I = $RepoCliId.create("goals/repo-cli-gh-git-consolidation/ops/frozen-w6/MonitorLoop.old");

const CI_TIMEOUT_PATTERNS: ReadonlyArray<RegExp> = [
  /has exceeded the maximum execution time/u,
  /The action '[^']*' has timed out/u,
  /Test timed out in \d+\s*ms/u,
  /Hook timed out in \d+\s*ms/u,
  /timed out after \d+\s*(?:ms|s|m|seconds?|minutes?)/u,
];

const classifyNormalizedLog = (normalized: string): O.Option<YeetMonitorFlakeClass> => {
  if (O.isSome(detectNoLocationTs2589Flake(normalized))) {
    return O.some(YeetMonitorFlakeClass.Enum["ts2589-no-location"]);
  }
  return A.some(CI_TIMEOUT_PATTERNS, (pattern) => pattern.test(normalized))
    ? O.some(YeetMonitorFlakeClass.Enum["ci-timeout"])
    : O.none();
};

class GhMonitorRunJobs extends S.Opaque<GhMonitorRunJobs, { readonly brand: unique symbol }>()(
  S.Struct({ jobs: S.Array(GithubJobRecord) }).pipe(
    $I.annoteSchema("GhMonitorRunJobs", { description: "Job list of one workflow run used by the yeet merge loop." })
  )
) {}

const decodeGhMonitorRunJobs = S.decodeUnknownEffect(S.fromJsonString(GhMonitorRunJobs));

const jobIsRed = (job: GithubJobRecord): boolean =>
  O.exists(githubConclusion(job.conclusion), (conclusion) =>
    A.contains(["failure", "timed_out", "cancelled"], conclusion)
  );

const runJobs = Effect.fn("YeetMonitorLoop.runJobs")(function* (
  context: RepoRunContext,
  runDatabaseId: number
): Effect.fn.Return<
  ReadonlyArray<GithubJobRecord>,
  never,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  const result = yield* runRepoCommandCapture(
    "gh",
    ["run", "view", `${runDatabaseId}`, "--json", "jobs"],
    context.repoRoot
  ).pipe(Effect.orElseSucceed(() => ({ exitCode: 1, output: Str.empty, truncated: false })));
  if (result.exitCode !== 0 || result.truncated) {
    return A.empty();
  }
  return yield* decodeGhMonitorRunJobs(result.output).pipe(
    Effect.map((payload) => payload.jobs),
    Effect.orElseSucceed(A.empty<GithubJobRecord>)
  );
});

// A whole-job log routinely runs to megabytes; the bound only guards memory.
// The failing-step region is cut out of the complete text afterwards, so this
// capture must not truncate where the repo-run bound would.
const jobEndpointLogBound = OutputBound.make({
  maxChars: 64 * 1024 * 1024,
  truncatedNotice: `\n[yeet] job log truncated after ${64 * 1024 * 1024} characters`,
});

const unreadableJobLog = { exitCode: 1, output: Str.empty, truncated: false };

/**
 * Read a failed job's failing-step log, normalized for the flake classifier.
 *
 * `gh run view --job <id> --log-failed` is asked first and keeps its existing
 * reading. It refuses (non-zero exit) while the parent run is still in
 * progress ("run … is still in progress; logs will be available when it is
 * complete") — a `gh` restriction, not a GitHub one — so any failure falls
 * back to the per-job
 * endpoint, which serves a completed job's log mid-run. `--allow-escape-sequences`
 * is load-bearing: without it `gh api` refuses a log containing terminal escapes
 * and prints nothing on stdout. A failed fallback, or a log whose failing step
 * cannot be bounded, reads as an unreadable log,
 * so a job whose log has not materialized yet still reads as pending mid-run
 * and as "needs code fix" once the run has concluded.
 */
const readFailedJobLog = Effect.fn("YeetMonitorLoop.readFailedJobLog")(function* (
  context: RepoRunContext,
  jobDatabaseId: number
): Effect.fn.Return<
  { readonly exitCode: number; readonly output: string; readonly truncated: boolean },
  never,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  const primary = yield* runRepoCommandCapture(
    "gh",
    ["run", "view", "--job", `${jobDatabaseId}`, "--log-failed"],
    context.repoRoot
  ).pipe(Effect.orElseSucceed(() => unreadableJobLog));
  // Only the exit code says `gh` refused: a successful body may itself contain
  // "is still in progress" on some log line.
  if (primary.exitCode === 0 || primary.truncated) {
    return { ...primary, output: stripYeetMonitorLogDecoration(primary.output) };
  }
  const fallback = yield* runCaptured({
    command: "gh",
    args: ["api", "--allow-escape-sequences", `repos/{owner}/{repo}/actions/jobs/${jobDatabaseId}/logs`],
    cwd: context.repoRoot,
    source: "stdout",
    bound: jobEndpointLogBound,
    trim: false,
  }).pipe(Effect.orElseSucceed(() => unreadableJobLog));
  if (fallback.exitCode !== 0 || fallback.truncated) {
    return unreadableJobLog;
  }
  // An unbounded failing step reads as unreadable, so it stays pending until
  // `--log-failed` answers after the run. The bounded step is held to the
  // primary read's bound, so a job reads the same mid-run as it will then.
  return O.match(isolateYeetMonitorJobLogFailure(fallback.output), {
    onNone: () => unreadableJobLog,
    onSome: (region) => ({ exitCode: 0, output: region, truncated: region.length > repoRunOutputBound.maxChars }),
  });
});

/**
 * Classify one failed job, reading its record before reaching for its log.
 *
 * The shape fingerprints are consulted first because they are free — the record
 * is already in hand — and because a job the control plane killed before any
 * step concluded often has no fetchable log to classify from at all.
 *
 * When the shape proves nothing, the failing-step log decides; mid-run it
 * comes from the per-job endpoint (see `readFailedJobLog`). `--log-failed`
 * rather than `--log`: only the failing steps are relevant, and a whole-job log
 * routinely overruns the repo-run capture bound. A truncated or unavailable
 * capture yields `None`, which the planner reads as "needs code fix" — the
 * conservative direction — unless the parent run is still in progress, where
 * the same unavailable capture marks the job `logPending`: GitHub materializes
 * a completed job's log a few seconds after the job ends, so the next poll can
 * genuinely change the answer and nothing should be concluded from the lag.
 */
const classifyJob = Effect.fn("YeetMonitorLoop.classifyJob")(function* (
  context: RepoRunContext,
  job: GithubJobRecord,
  runCompleted: boolean
): Effect.fn.Return<YeetMonitorFailedJob, never, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const shapeClass = detectGithubJobShapeClass(job);
  if (O.isSome(shapeClass)) {
    return YeetMonitorFailedJob.make({
      databaseId: job.databaseId,
      flakeClass: shapeClass,
      name: job.name,
      runCompleted,
    });
  }
  const result = yield* readFailedJobLog(context, job.databaseId);
  const logUnavailable = result.exitCode !== 0 || result.truncated;
  const flakeClass = logUnavailable ? O.none<YeetMonitorFlakeClass>() : classifyNormalizedLog(result.output);
  return YeetMonitorFailedJob.make({
    databaseId: job.databaseId,
    flakeClass,
    // A truncated capture is definitive evidence that the log is too large for
    // the classifier; polling again cannot make that same capture complete.
    // Only a failed fetch can still be the short materialization lag we defer.
    logPending: result.exitCode !== 0 && !result.truncated && !runCompleted,
    name: job.name,
    runCompleted,
  });
});

/**
 * Collect and classify the current head's red jobs, mid-run included.
 *
 * **Details**
 *
 * Selection is job-level, not run-level: the candidates are the current head's
 * concluded-failed runs *and* its still-running ones, because a completed red
 * job inside an in-progress run is exactly the early signal the merge loop
 * exists to surface — waiting for the run's own conclusion used to cost the
 * whole remaining workflow duration. Jobs without a terminal red conclusion
 * are ignored, so an in-progress run contributes only what has actually
 * failed.
 *
 * **Example** (Build the collector effect)
 *
 * ```ts
 * import { collectYeetMonitorFailedJobs } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(Effect.succeed(collectYeetMonitorFailedJobs))) // true
 * ```
 *
 * @param context - Yeet run context naming the branch and repo root.
 * @param headSha - The head SHA whose red jobs are collected.
 * @returns One classified record per red job at that head.
 * @category services
 * @since 0.0.0
 */
export const collectYeetMonitorFailedJobs = Effect.fn("YeetMonitorLoop.collectFailedJobs")(function* (
  context: RepoRunContext,
  headSha: string
): Effect.fn.Return<
  ReadonlyArray<YeetMonitorFailedJob>,
  never,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  const runs = yield* collectRemoteWorkflowRuns(context);
  const candidateRuns = A.filter(
    runs,
    (run) => run.headSha === headSha && (run.conclusion === "failure" || run.status !== "completed")
  );
  const jobs = yield* Effect.forEach(
    candidateRuns,
    (run) =>
      runJobs(context, run.databaseId).pipe(
        Effect.map(A.map((job) => ({ job, runCompleted: run.status === "completed" })))
      ),
    { concurrency: 2 }
  );
  return yield* Effect.forEach(
    pipe(
      jobs,
      A.flatten,
      A.filter(({ job }) => jobIsRed(job))
    ),
    ({ job, runCompleted }) => classifyJob(context, job, runCompleted),
    { concurrency: 2 }
  );
});

const rerunJob = Effect.fn("YeetMonitorLoop.rerunJob")(function* (
  context: RepoRunContext,
  databaseId: number
): Effect.fn.Return<void, never, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture("gh", ["run", "rerun", "--job", `${databaseId}`], context.repoRoot).pipe(
    Effect.orElseSucceed(() => ({ exitCode: 1, output: Str.empty, truncated: false }))
  );
  if (result.exitCode !== 0) {
    yield* Console.log(
      `[yeet] rerun of job ${databaseId} was rejected; leaving it red with its allowance spent to avoid an unbounded retry loop`
    );
  }
});

/**
 * Print one job decision and execute its rerun when it carries one.
 *
 * **Details**
 *
 * Known flakes inside an active parent run are deferred before reaching this
 * function. A rejected rerun against a completed run leaves the allowance
 * spent, because authentication, stale-job, and permission failures are
 * permanent until external state changes and must not become a polling loop.
 *
 * **Example** (Build the applier effect)
 *
 * ```ts
 * import { applyYeetMonitorJobDecision } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(Effect.succeed(applyYeetMonitorJobDecision))) // true
 * ```
 *
 * @param context - Yeet run context naming the repo root.
 * @param decision - The decision to report and, for `rerun`, execute.
 * @returns Nothing once the decision has been reported and any rerun attempted.
 * @category services
 * @since 0.0.0
 */
export const applyYeetMonitorJobDecision = Effect.fn("YeetMonitorLoop.applyDecision")(function* (
  context: RepoRunContext,
  decision: YeetMonitorJobDecision
): Effect.fn.Return<void, never, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log(renderYeetMonitorJobDecision(decision));
  if (decision.status !== "rerun") {
    return;
  }
  yield* rerunJob(context, decision.databaseId);
});

export const readPushedAt = Effect.fn("YeetMonitorLoop.readPushedAt")(function* (
  context: RepoRunContext,
  headSha: string,
  capture: typeof runRepoCommandCapture
) {
  return yield* capture(
    "gh",
    ["api", `repos/{owner}/{repo}/commits/${headSha}`, "--jq", ".commit.committer.date"],
    context.repoRoot
  ).pipe(
    Effect.map((result) =>
      result.exitCode === 0 && !result.truncated
        ? DateTime.make(Str.trim(result.output)).pipe(O.map(DateTime.formatIso))
        : O.none<string>()
    ),
    Effect.orElseSucceed(O.none<string>)
  );
});
