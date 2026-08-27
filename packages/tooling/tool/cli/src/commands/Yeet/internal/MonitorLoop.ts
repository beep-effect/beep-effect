/**
 * The `yeet monitor --until-merged` merge loop.
 *
 * Plain `yeet monitor` watches one head SHA and exits on the first red, so every
 * fix wave costs the operator a manual re-arm. The merge loop instead follows
 * the pull request itself: it re-reads status each poll, picks up whatever head
 * SHA the branch now carries, and only stops when the PR reaches a terminal
 * state — `MERGED` (which hands off to the post-merge sweep), `CLOSED`, or an
 * operator interrupt.
 *
 * **Details**
 *
 * A red wave is triaged, not surrendered to. Each failed job is matched against
 * the flake fingerprints this repo has evidence for and a match buys exactly one
 * rerun per job per head SHA. Anything else is reported as "needs code fix" and
 * the loop keeps following, so the operator sees the classification instead of a
 * dead session. Classification is job-level, not run-level: a completed red job
 * is triaged on the poll after it concludes, while sibling jobs are still
 * running — the loop never waits for the workflow run's own conclusion to say
 * what already failed.
 *
 * Fingerprints come in two families, and the cheap family is consulted first.
 * *Shape* fingerprints (`setup-5xx`, `runner-loss`) read only the job record the
 * loop already fetched, so they cost no extra request; *log* fingerprints
 * (`ts2589-no-location`, `ci-timeout`) need the failing-step log. Ordering them
 * shape-first is not only a saving: a job the control plane killed before any
 * step concluded frequently has no fetchable log at all, so a log-first loop
 * classifies exactly the failures it can most safely rerun as "needs code fix".
 *
 * **Gotchas**
 *
 * Reruns go through `gh run rerun --job <databaseId>`, never
 * `gh run rerun --failed`. `--failed` reruns *every* failed job in the workflow
 * run, which re-executes genuine reds coexisting with the flake and silently
 * spends a budget that is defined per job — the bound would stop being a bound.
 *
 * The budget is in-memory and keyed by `(headSha, jobName)`, so a new push
 * earns a fresh rerun allowance by construction and a resumed session starts
 * from zero. That is deliberate: the budget exists to stop this loop from
 * spinning, not to be a durable ledger.
 *
 * The key uses the job *name*, never the `databaseId`, because a job record is
 * per-attempt: rerunning creates a new workflow-run attempt whose jobs carry
 * fresh ids. Keying on the id would make every rerun's own output miss the
 * budget it just spent, and the bound would be unbounded. The executed command
 * still addresses the id — execution is attempt-scoped, only the idempotency
 * key is not.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Console, Duration, Effect, flow, HashSet, Match, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  detectGithubJobShapeClass,
  GithubJobRecord,
  GithubJobShapeClass,
  githubConclusion,
  githubJobShapeEvidence,
} from "../../../internal/github/index.ts";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { detectNoLocationTs2589Flake } from "../../Quality/internal/FlakeQuarantine.ts";
import {
  collectRemoteWorkflowRuns,
  collectYeetStatus,
  renderYeetStatusSummary,
  writeYeetStatusSnapshot,
} from "./Status.ts";
import { executeSweep } from "./Sweep.ts";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetCommandError } from "../Yeet.errors.ts";
import type { YeetStatusSnapshot } from "./Status.ts";
import type { YeetMergeReady } from "./Verdict.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/MonitorLoop");

const mergeLoopPollInterval = Duration.seconds(30);

/**
 * Environment-only failure signatures the merge loop is allowed to rerun.
 *
 * **Details**
 *
 * Every member is an evidence-backed class, not a guess. `ts2589-no-location`
 * is the Effect-patched native compiler counting instantiations across parallel
 * checker threads and tipping a near-ceiling package over the limit — it emits
 * `error TS2589` with no file location and never reproduces standalone.
 * `ci-timeout` is a heavy or property-based suite exceeding a runner limit that
 * it clears locally in seconds. The remaining three are shape classes shared
 * with the lane-timings collector and defined in `internal/github/JobShape`:
 * `setup-5xx`, `runner-loss`, and `install-failure`.
 *
 * `ts2306-not-a-module` was a member while `tsc -b`/`tsgo -b` subgraph builds
 * could tear a sibling package's emitted d.ts (six occurrences, 2026-08-14/16).
 * The single-project emit law removed every cross-package writer, so a TS2306
 * is a real signal again and the class was retired — do not re-admit it
 * without new torn-write evidence.
 *
 * Anything outside this domain is a code failure by default. Widening it is a
 * decision, not a convenience: every member is a licence to spend a rerun.
 *
 * **Gotchas**
 *
 * `setup-5xx` and `runner-loss` are the *safest* members despite being newer
 * than the log fingerprints, because both describe a job in which zero
 * repository commands executed — there is no branch state a rerun could paper
 * over. That is a stronger argument than the TS2589 fingerprint has, which
 * reruns a compiler that did run.
 *
 * `install-failure` is the weakest member and is admitted on population
 * grounds rather than proof: a broken lockfile matches it and no rerun will fix
 * that. The bound is what makes it safe to admit — one rerun per job per head
 * SHA, after which the second occurrence reports `rerun-spent` and the operator
 * sees a real signal instead of a loop.
 *
 * **Example** (List the fingerprinted flake classes)
 *
 * ```ts
 * import { YeetMonitorFlakeClass } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetMonitorFlakeClass.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMonitorFlakeClass = LiteralKit([
  "ts2589-no-location",
  "ci-timeout",
  "setup-5xx",
  "runner-loss",
  "install-failure",
]).pipe(
  $I.annoteSchema("YeetMonitorFlakeClass", {
    title: "Yeet Monitor Flake Class",
    description: "One environment-only failure signature the merge loop may rerun once per job per head SHA.",
  })
);

/**
 * Environment-only failure signatures the merge loop is allowed to rerun.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetMonitorFlakeClass = typeof YeetMonitorFlakeClass.Type;

/**
 * Terminal pull request states that end a merge loop.
 *
 * **Example** (List the terminal states)
 *
 * ```ts
 * import { YeetMonitorTerminalState } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetMonitorTerminalState.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMonitorTerminalState = LiteralKit(["merged", "closed"]).pipe(
  $I.annoteSchema("YeetMonitorTerminalState", {
    title: "Yeet Monitor Terminal State",
    description: "Pull request state that ends the merge loop.",
  })
);

/**
 * Terminal pull request states that end a merge loop.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetMonitorTerminalState = typeof YeetMonitorTerminalState.Type;

const GITHUB_LOG_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z ?/u;
const GITHUB_LOG_COMMAND_MARKER_PATTERN = /^##\[[a-z]+\] ?/u;
const GITHUB_LOG_JOB_STEP_PREFIX_PATTERN = /^[^\t]*\t[^\t]*\t/u;

const CI_TIMEOUT_PATTERNS: ReadonlyArray<RegExp> = [
  /has exceeded the maximum execution time/u,
  /The action '[^']*' has timed out/u,
  /Test timed out in \d+\s*ms/u,
  /Hook timed out in \d+\s*ms/u,
  /timed out after \d+\s*(?:ms|s|m|seconds?|minutes?)/u,
];

const stripGithubLogPrefix: (line: string) => string = flow(
  Str.replace(GITHUB_LOG_JOB_STEP_PREFIX_PATTERN, ""),
  Str.replace(GITHUB_LOG_TIMESTAMP_PATTERN, ""),
  Str.replace(GITHUB_LOG_COMMAND_MARKER_PATTERN, "")
);

/**
 * Strip GitHub Actions log decoration so a job log reads like local output.
 *
 * **Details**
 *
 * `gh run view --log` prefixes every line with `<job>\t<step>\t`, a UTC
 * timestamp, and sometimes a `##[error]` workflow-command marker. Left in
 * place they defeat the Turbo `<package>:<task>: ` prefix match the TS2589
 * detector relies on, which downgrades a quarantinable flake into an
 * unrecognised diagnostic.
 *
 * **Example** (Normalize one decorated line)
 *
 * ```ts
 * import { stripYeetMonitorLogDecoration } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(stripYeetMonitorLogDecoration("2026-08-04T12:00:00.1234567Z ##[error]boom"))
 * ```
 *
 * @param log - Raw job log text as returned by `gh run view --log-failed`.
 * @returns The same log with per-line GitHub decoration removed.
 * @category formatting
 * @since 0.0.0
 */
export const stripYeetMonitorLogDecoration = (log: string): string =>
  pipe(Str.split(/\r?\n/u)(log), A.map(stripGithubLogPrefix), A.join("\n"));

/**
 * Classify a failed job's log against the merge loop's flake fingerprints.
 *
 * **Details**
 *
 * The TS2589 arm delegates to the quality lane's
 * `detectNoLocationTs2589Flake`, so the strictness rules stay defined in one
 * place: every TS2589 line must be attributed to a Turbo task, no other TS
 * diagnostic may appear, and Turbo's `Failed:` footer must agree.
 *
 * **Gotchas**
 *
 * Returning `None` is the safe answer and the caller must treat it as "needs
 * code fix". A truncated log capture must never reach here — the TS2589 rules
 * include "no other diagnostic *anywhere* in the output", which a truncated
 * capture cannot establish.
 *
 * **Example** (Recognize a timed-out suite)
 *
 * ```ts
 * import { detectYeetMonitorFlakeClass } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(detectYeetMonitorFlakeClass("Test timed out in 5000ms"))
 * ```
 *
 * @param log - Failing-step log for one job.
 * @returns The matched flake class, or `None` when the failure is not one.
 * @category detection
 * @since 0.0.0
 */
export const detectYeetMonitorFlakeClass = (log: string): O.Option<YeetMonitorFlakeClass> => {
  const normalized = stripYeetMonitorLogDecoration(log);
  if (O.isSome(detectNoLocationTs2589Flake(normalized))) {
    return O.some(YeetMonitorFlakeClass.Enum["ts2589-no-location"]);
  }
  return A.some(CI_TIMEOUT_PATTERNS, (pattern) => pattern.test(normalized))
    ? O.some(YeetMonitorFlakeClass.Enum["ci-timeout"])
    : O.none();
};

/**
 * A failed hosted job, already classified against the flake fingerprints.
 *
 * **Details**
 *
 * `logPending` records the one state that is neither a classification nor a
 * verdict: the job is red, no shape fingerprint matched, and its failing-step
 * log could not be fetched *while the parent run is still in progress* — log
 * materialization lags job completion by a few seconds. The planner turns it
 * into an `awaiting-log` decision instead of the conservative
 * "needs code fix", because the next poll can genuinely change the answer.
 * Once the parent run has concluded, an unreadable log stops being pending and
 * the conservative reading stands.
 *
 * **Example** (Describe an unclassified red job)
 *
 * ```ts
 * import { YeetMonitorFailedJob } from "@beep/repo-cli/test/Yeet"
 *
 * const job = YeetMonitorFailedJob.make({ databaseId: 991, name: "Check" })
 * console.log(job.flakeClass)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorFailedJob extends S.Class<YeetMonitorFailedJob>($I`YeetMonitorFailedJob`)(
  {
    databaseId: S.Finite,
    name: S.String,
    flakeClass: YeetMonitorFlakeClass.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    logPending: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("YeetMonitorFailedJob", {
    description: "One failed hosted job paired with the flake class its log matched, if any.",
  })
) {}

/**
 * A job the loop will rerun once, having matched a flake fingerprint.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorRerunJob extends S.Class<YeetMonitorRerunJob>($I`YeetMonitorRerunJob`)(
  {
    status: S.tag("rerun"),
    databaseId: S.Finite,
    name: S.String,
    flakeClass: YeetMonitorFlakeClass,
    command: S.NonEmptyString,
  },
  $I.annote("YeetMonitorRerunJob", {
    description: "A flake-matching job the merge loop reruns once for this head SHA.",
  })
) {}

/**
 * A job that matched a fingerprint but already spent its rerun on this SHA.
 *
 * **Details**
 *
 * A second identical failure at the same SHA is evidence against the
 * environment-only reading: the loop reports it and stops paying for it.
 * "Identical" is judged by job name, so the rerun's own attempt — a fresh
 * `databaseId` for the same logical job — lands here rather than buying
 * another allowance.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorRerunSpent extends S.Class<YeetMonitorRerunSpent>($I`YeetMonitorRerunSpent`)(
  {
    status: S.tag("rerun-spent"),
    databaseId: S.Finite,
    name: S.String,
    flakeClass: YeetMonitorFlakeClass,
  },
  $I.annote("YeetMonitorRerunSpent", {
    description: "A flake-matching job whose one rerun for this head SHA is already spent.",
  })
) {}

/**
 * A red job whose log matched no fingerprint: the branch needs a code fix.
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorNeedsCodeFix extends S.Class<YeetMonitorNeedsCodeFix>($I`YeetMonitorNeedsCodeFix`)(
  {
    status: S.tag("needs-code-fix"),
    databaseId: S.Finite,
    name: S.String,
  },
  $I.annote("YeetMonitorNeedsCodeFix", {
    description: "A red job the merge loop refuses to rerun because its failure matched no known flake class.",
  })
) {}

/**
 * A red job whose failing-step log is not fetchable yet: reclassify next poll.
 *
 * **Details**
 *
 * Only reachable while the parent workflow run is still in progress — the loop
 * now classifies completed red jobs without waiting for the run's own
 * conclusion, and GitHub materializes a job's log a few seconds after the job
 * completes. The decision spends nothing and asserts nothing: the same job is
 * classified again on the next poll, when the log usually exists.
 *
 * **Example** (Defer a red job)
 *
 * ```ts
 * import { YeetMonitorAwaitingLog } from "@beep/repo-cli/test/Yeet"
 *
 * const decision = YeetMonitorAwaitingLog.make({ databaseId: 991, name: "Check" })
 * console.log(decision.status) // "awaiting-log"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorAwaitingLog extends S.Class<YeetMonitorAwaitingLog>($I`YeetMonitorAwaitingLog`)(
  {
    status: S.tag("awaiting-log"),
    databaseId: S.Finite,
    name: S.String,
  },
  $I.annote("YeetMonitorAwaitingLog", {
    description: "A red job inside an in-progress run whose failing-step log is not yet fetchable.",
  })
) {}

/**
 * What the merge loop decided about one red job.
 *
 * **Example** (Decode a needs-code-fix decision)
 *
 * ```ts
 * import { YeetMonitorJobDecision } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(YeetMonitorJobDecision)({
 *   status: "needs-code-fix",
 *   databaseId: 991,
 *   name: "Check",
 * })
 * console.log(decoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetMonitorJobDecision = S.Union([
  YeetMonitorRerunJob,
  YeetMonitorRerunSpent,
  YeetMonitorNeedsCodeFix,
  YeetMonitorAwaitingLog,
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("YeetMonitorJobDecision", {
    description: "What the merge loop decided about one red hosted job.",
  })
);

/**
 * What the merge loop decided about one red job.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetMonitorJobDecision = typeof YeetMonitorJobDecision.Type;

/**
 * The set of `(head SHA, job name)` pairs whose single rerun is already spent.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetMonitorRerunBudget = HashSet.HashSet<string>;

/**
 * A merge loop that has spent no reruns yet.
 *
 * **Example** (Start a fresh budget)
 *
 * ```ts
 * import { emptyYeetMonitorRerunBudget } from "@beep/repo-cli/test/Yeet"
 * import { HashSet } from "effect"
 *
 * console.log(HashSet.size(emptyYeetMonitorRerunBudget))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const emptyYeetMonitorRerunBudget: YeetMonitorRerunBudget = HashSet.empty<string>();

/**
 * Build the budget key that scopes one rerun to one job at one head SHA.
 *
 * **Details**
 *
 * The job identity in the key is `job.name`, not `job.databaseId`, because
 * GitHub job records are per-attempt. `gh run rerun --job <id>` creates a new
 * attempt of the workflow run, and the next `gh run view --json jobs` returns
 * the same logical job under a *new* `databaseId`. Keyed on the id, the very
 * failure a rerun produced would miss the budget entry that rerun spent, and
 * the loop could rerun the same job forever at one head SHA. The name is the
 * identifier stable across attempts, so it is what bounds the allowance.
 *
 * **Gotchas**
 *
 * Matrix jobs sharing a `name` collide into one allowance — deliberately
 * chosen: a collision under-spends (one rerun covers the shard family) whereas
 * an id-key over-spends without limit, and only one of those two failure
 * directions is a bound.
 *
 * **Example** (Key one job at one SHA)
 *
 * ```ts
 * import { yeetMonitorRerunKey } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetMonitorRerunKey("abc123", "Check"))
 * ```
 *
 * @param headSha - Head SHA the failing job ran against.
 * @param jobName - GitHub job `name`, stable across workflow-run attempts.
 * @returns The budget key for that pair.
 * @category constructors
 * @since 0.0.0
 */
export const yeetMonitorRerunKey: {
  (jobName: string): (headSha: string) => string;
  (headSha: string, jobName: string): string;
} = dual(2, (headSha: string, jobName: string): string => `${headSha}#${jobName}`);

/**
 * Build the job-scoped rerun command for one failing job.
 *
 * **Gotchas**
 *
 * Job-scoped on purpose. `gh run rerun <runId> --failed` reruns every failed
 * job in the run, so a genuine red sharing the run with a flake would be
 * re-executed as a side effect of the flake's allowance.
 *
 * **Example** (Build the job-scoped rerun)
 *
 * ```ts
 * import { yeetMonitorRerunCommand } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetMonitorRerunCommand(991))
 * ```
 *
 * @param databaseId - GitHub job `databaseId` to rerun.
 * @returns The `gh run rerun --job` invocation.
 * @category constructors
 * @since 0.0.0
 */
export const yeetMonitorRerunCommand = (databaseId: number): string => `gh run rerun --job ${databaseId}`;

/**
 * A batch of job decisions paired with the budget they left behind.
 */
interface YeetMonitorRerunPlan {
  readonly budget: YeetMonitorRerunBudget;
  readonly decisions: ReadonlyArray<YeetMonitorJobDecision>;
}

/**
 * Decide, for every red job at one head SHA, whether to rerun it.
 *
 * **Details**
 *
 * The one pure decision in the merge loop, and the reason "one rerun per job
 * per SHA" is a property rather than a hope: the returned budget is the input
 * budget plus every key this call approved, so feeding it back is the only way
 * to keep looping and a second call over the same SHA and job name can only
 * return `rerun-spent`.
 *
 * **Gotchas**
 *
 * The budget key is `(headSha, job.name)`, so the refusal holds across the new
 * `databaseId` the rerun's own attempt produces — see `yeetMonitorRerunKey`.
 * The approved `command` still targets `job.databaseId`, which is the only
 * thing `gh run rerun --job` can address.
 *
 * **Example** (Approve one rerun, then refuse the second)
 *
 * ```ts
 * import { emptyYeetMonitorRerunBudget, planYeetMonitorReruns, YeetMonitorFailedJob } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const job = YeetMonitorFailedJob.make({ databaseId: 991, name: "Check", flakeClass: O.some("ci-timeout") })
 * const first = planYeetMonitorReruns(emptyYeetMonitorRerunBudget, "abc123", [job])
 * const second = planYeetMonitorReruns(first.budget, "abc123", [job])
 * console.log(second.decisions[0]?.status)
 * ```
 *
 * @param budget - Reruns already spent in this session.
 * @param headSha - Head SHA the red jobs ran against.
 * @param jobs - Classified red jobs for that SHA.
 * @returns One decision per job plus the budget after the batch.
 * @category planning
 * @since 0.0.0
 */
export const planYeetMonitorReruns: {
  (
    headSha: string,
    jobs: ReadonlyArray<YeetMonitorFailedJob>
  ): (budget: YeetMonitorRerunBudget) => YeetMonitorRerunPlan;
  (budget: YeetMonitorRerunBudget, headSha: string, jobs: ReadonlyArray<YeetMonitorFailedJob>): YeetMonitorRerunPlan;
} = dual(
  3,
  (budget: YeetMonitorRerunBudget, headSha: string, jobs: ReadonlyArray<YeetMonitorFailedJob>): YeetMonitorRerunPlan =>
    A.reduce(jobs, { budget, decisions: A.empty<YeetMonitorJobDecision>() }, (plan, job) =>
      job.logPending
        ? {
            budget: plan.budget,
            decisions: A.append(
              plan.decisions,
              YeetMonitorAwaitingLog.make({ databaseId: job.databaseId, name: job.name })
            ),
          }
        : O.match(job.flakeClass, {
            onNone: () => ({
              budget: plan.budget,
              decisions: A.append(
                plan.decisions,
                YeetMonitorNeedsCodeFix.make({ databaseId: job.databaseId, name: job.name })
              ),
            }),
            onSome: (flakeClass) => {
              const key = yeetMonitorRerunKey(headSha, job.name);
              return HashSet.has(plan.budget, key)
                ? {
                    budget: plan.budget,
                    decisions: A.append(
                      plan.decisions,
                      YeetMonitorRerunSpent.make({ databaseId: job.databaseId, flakeClass, name: job.name })
                    ),
                  }
                : {
                    budget: HashSet.add(plan.budget, key),
                    decisions: A.append(
                      plan.decisions,
                      YeetMonitorRerunJob.make({
                        command: yeetMonitorRerunCommand(job.databaseId),
                        databaseId: job.databaseId,
                        flakeClass,
                        name: job.name,
                      })
                    ),
                  };
            },
          })
    )
);

const isGithubJobShapeClass = S.is(GithubJobShapeClass);

/**
 * Append the observed mechanism when the matched class is a shape class.
 *
 * The class name says what shape was seen; the evidence says what that shape
 * has historically meant, which is what decides whether an operator
 * investigates or waits out the rerun. Log fingerprints carry their evidence in
 * the log the operator can already read, so they get no suffix.
 *
 * @param flakeClass - The class the failing job matched.
 * @returns A parenthesized mechanism, or the empty string for log classes.
 */
const flakeEvidenceSuffix = (flakeClass: YeetMonitorFlakeClass): string =>
  isGithubJobShapeClass(flakeClass) ? ` (${githubJobShapeEvidence(flakeClass)})` : Str.empty;

/**
 * Render one merge-loop job decision as an operator line.
 *
 * **Example** (Render a refused red)
 *
 * ```ts
 * import { renderYeetMonitorJobDecision, YeetMonitorNeedsCodeFix } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetMonitorJobDecision(YeetMonitorNeedsCodeFix.make({ databaseId: 991, name: "Check" })))
 * ```
 *
 * @param decision - The decision to render.
 * @returns A single-line operator string.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetMonitorJobDecision = (decision: YeetMonitorJobDecision): string =>
  Match.value(decision).pipe(
    Match.discriminatorsExhaustive("status")({
      rerun: (value) =>
        `[yeet] ${value.name}: ${value.flakeClass} flake fingerprint matched${flakeEvidenceSuffix(value.flakeClass)}; rerunning once -> ${value.command}`,
      "rerun-spent": (value) =>
        `[yeet] ${value.name}: ${value.flakeClass} matched again at this SHA; rerun budget spent, needs attention`,
      "needs-code-fix": (value) => `[yeet] ${value.name}: red with no known flake fingerprint; needs code fix`,
      "awaiting-log": (value) =>
        `[yeet] ${value.name}: red; failing-step log not available yet (run still in progress), reclassifying next poll`,
    })
  );

/**
 * Read the terminal merge-loop state out of a `gh pr view` state string.
 *
 * **Example** (Recognize a merged pull request)
 *
 * ```ts
 * import { yeetMonitorTerminalState } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(yeetMonitorTerminalState(O.some("MERGED")))
 * ```
 *
 * @param state - `gh pr view --json state` value, when it was read.
 * @returns The terminal state, or `None` while the pull request is still open.
 * @category predicates
 * @since 0.0.0
 */
export const yeetMonitorTerminalState: (state: O.Option<string>) => O.Option<YeetMonitorTerminalState> = flow(
  O.map(Str.toUpperCase),
  O.flatMap((value) =>
    value === "MERGED"
      ? O.some(YeetMonitorTerminalState.Enum.merged)
      : value === "CLOSED"
        ? O.some(YeetMonitorTerminalState.Enum.closed)
        : O.none()
  )
);

class GhMonitorRunJobs extends S.Class<GhMonitorRunJobs>($I`GhMonitorRunJobs`)(
  { jobs: S.Array(GithubJobRecord) },
  $I.annote("GhMonitorRunJobs", { description: "Job list of one workflow run used by the yeet merge loop." })
) {}

const decodeGhMonitorRunJobs = S.decodeUnknownEffect(S.fromJsonString(GhMonitorRunJobs));

const jobIsRed = (job: GithubJobRecord): boolean =>
  O.exists(githubConclusion(job.conclusion), (conclusion) =>
    A.contains(["failure", "timed_out", "cancelled"], conclusion)
  );

const runJobs = Effect.fn("YeetMonitorLoop.runJobs")(function* (
  context: RepoRunContext,
  runDatabaseId: number
): Effect.fn.Return<ReadonlyArray<GithubJobRecord>, never, ChildProcessSpawner.ChildProcessSpawner> {
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

/**
 * Classify one failed job, reading its record before reaching for its log.
 *
 * The shape fingerprints are consulted first because they are free — the record
 * is already in hand — and because a job the control plane killed before any
 * step concluded often has no fetchable log to classify from at all.
 *
 * When the shape proves nothing, the failing-step log decides. `--log-failed`
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
): Effect.fn.Return<YeetMonitorFailedJob, never, ChildProcessSpawner.ChildProcessSpawner> {
  const shapeClass = detectGithubJobShapeClass(job);
  if (O.isSome(shapeClass)) {
    return YeetMonitorFailedJob.make({ databaseId: job.databaseId, flakeClass: shapeClass, name: job.name });
  }
  const result = yield* runRepoCommandCapture(
    "gh",
    ["run", "view", "--job", `${job.databaseId}`, "--log-failed"],
    context.repoRoot
  ).pipe(Effect.orElseSucceed(() => ({ exitCode: 1, output: Str.empty, truncated: false })));
  const logUnavailable = result.exitCode !== 0 || result.truncated;
  const flakeClass = logUnavailable ? O.none<YeetMonitorFlakeClass>() : detectYeetMonitorFlakeClass(result.output);
  return YeetMonitorFailedJob.make({
    databaseId: job.databaseId,
    flakeClass,
    // A truncated capture is definitive evidence that the log is too large for
    // the classifier; polling again cannot make that same capture complete.
    // Only a failed fetch can still be the short materialization lag we defer.
    logPending: result.exitCode !== 0 && !result.truncated && !runCompleted,
    name: job.name,
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
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.succeed(collectYeetMonitorFailedJobs))) // true
 * ```
 *
 * @param context - Yeet run context naming the branch and repo root.
 * @param headSha - The head SHA whose red jobs are collected.
 * @returns One classified record per red job at that head.
 * @category execution
 * @since 0.0.0
 */
export const collectYeetMonitorFailedJobs = Effect.fn("YeetMonitorLoop.collectFailedJobs")(function* (
  context: RepoRunContext,
  headSha: string
): Effect.fn.Return<ReadonlyArray<YeetMonitorFailedJob>, never, ChildProcessSpawner.ChildProcessSpawner> {
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
): Effect.fn.Return<boolean, never, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture("gh", ["run", "rerun", "--job", `${databaseId}`], context.repoRoot).pipe(
    Effect.orElseSucceed(() => ({ exitCode: 1, output: Str.empty, truncated: false }))
  );
  if (result.exitCode !== 0) {
    yield* Console.log(
      `[yeet] rerun of job ${databaseId} was rejected; leaving it red and refunding its allowance for a later poll`
    );
    return false;
  }
  return true;
});

/**
 * Print one job decision and execute its rerun when it carries one.
 *
 * **Details**
 *
 * Returns the budget key to refund when an approved rerun was rejected —
 * GitHub refuses `gh run rerun --job` while the parent run is still active,
 * and a spent allowance for a rerun that never happened would convert the
 * mid-run early report into a permanently unhealable red. The caller removes
 * refunded keys from the plan's budget so a later poll retries the rerun.
 *
 * **Example** (Build the applier effect)
 *
 * ```ts
 * import { applyYeetMonitorJobDecision } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.succeed(applyYeetMonitorJobDecision))) // true
 * ```
 *
 * @param context - Yeet run context naming the repo root.
 * @param decision - The decision to report and, for `rerun`, execute.
 * @param headSha - The head SHA the decision's budget key is scoped to.
 * @returns The budget key to refund, or `None` when nothing needs refunding.
 * @category execution
 * @since 0.0.0
 */
export const applyYeetMonitorJobDecision = Effect.fn("YeetMonitorLoop.applyDecision")(function* (
  context: RepoRunContext,
  decision: YeetMonitorJobDecision,
  headSha: string
): Effect.fn.Return<O.Option<string>, never, ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log(renderYeetMonitorJobDecision(decision));
  if (decision.status !== "rerun") {
    return O.none();
  }
  const accepted = yield* rerunJob(context, decision.databaseId);
  return accepted ? O.none() : O.some(yeetMonitorRerunKey(headSha, decision.name));
});

/**
 * Options for one `yeet monitor --until-merged` session.
 *
 * **Details**
 *
 * `onMerged` defaults to `executeSweep` from `internal/Sweep.ts` — the merged
 * path is the sweep, not a variant of it. The seam exists so a test can drive
 * the merged branch of the loop without a real clone to sweep, and so an
 * operator-authorized wrapper can substitute a plan-only run.
 */
interface YeetMonitorUntilMergedOptions {
  readonly onMerged?:
    | ((
        context: RepoRunContext
      ) => Effect.Effect<
        unknown,
        YeetCommandError,
        FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
      >)
    | undefined;
  readonly pollInterval?: Duration.Duration | undefined;
}

const renderMergeReadyGateDetail = (mergeReady: YeetMergeReady): string =>
  O.match(mergeReady.failing, {
    onNone: () => "[yeet] merge-ready: every hard criterion is green; awaiting the operator's merge",
    onSome: (failing) => `[yeet] not merge-ready: blocked on ${failing}`,
  });

const renderMergeReadyGate = (snapshot: YeetStatusSnapshot): string =>
  pipe(
    snapshot.mergeReady,
    O.match({
      onNone: () => "[yeet] merge readiness is unknown; the PR could not be read",
      onSome: renderMergeReadyGateDetail,
    })
  );

const pollUntilMerged = Effect.fn("YeetMonitorLoop.poll")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions,
  budget: YeetMonitorRerunBudget
): Effect.fn.Return<
  { readonly budget: YeetMonitorRerunBudget; readonly terminal: O.Option<YeetMonitorTerminalState> },
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const snapshot = yield* collectYeetStatus(context, true);
  yield* writeYeetStatusSnapshot(snapshot);
  yield* Console.log(renderYeetStatusSummary(snapshot));
  const terminal = yeetMonitorTerminalState(O.fromUndefinedOr(snapshot.remote.state));
  if (O.exists(terminal, (state) => state === YeetMonitorTerminalState.Enum.merged)) {
    yield* Console.log("[yeet] pull request is MERGED; running the post-merge workspace sweep");
    yield* O.getOrElse(O.fromNullishOr(options.onMerged), () => executeSweep)(context);
    return { budget, terminal };
  }
  if (O.isSome(terminal)) {
    yield* Console.log("[yeet] pull request is CLOSED without merging; ending the merge loop");
    return { budget, terminal };
  }
  yield* Console.log(renderMergeReadyGate(snapshot));
  const headSha = snapshot.remote.headSha;
  const failingCheckCount = O.getOrElse(O.fromUndefinedOr(snapshot.remote.failingCheckCount), () => 0);
  if (failingCheckCount === 0 || O.isNone(headSha)) {
    return { budget, terminal };
  }
  const failedJobs = yield* collectYeetMonitorFailedJobs(context, headSha.value);
  const plan = planYeetMonitorReruns(budget, headSha.value, failedJobs);
  const refunds = yield* Effect.forEach(
    plan.decisions,
    (decision) => applyYeetMonitorJobDecision(context, decision, headSha.value),
    { concurrency: 1 }
  );
  // A refunded key restores the one-rerun allowance the plan spent on a rerun
  // GitHub rejected, so a later poll — typically after the parent run finally
  // concludes — can execute it instead of reporting `rerun-spent` forever.
  return { budget: A.reduce(A.getSomes(refunds), plan.budget, (spent, key) => HashSet.remove(spent, key)), terminal };
});

/**
 * Follow a pull request through its fix waves until it merges or closes.
 *
 * **When to use**
 *
 * Behind `yeet monitor --until-merged`, when the operator wants one session to
 * babysit the whole treadmill instead of re-arming a fresh monitor after every
 * push.
 *
 * **Details**
 *
 * Each poll re-reads `yeet status --remote`, so a push landing mid-session is
 * picked up without restarting: the new head SHA simply becomes the budget
 * scope for the next red wave. The loop ends on `MERGED` (after the sweep it was
 * handed), on `CLOSED`, or when the operator interrupts the fiber.
 *
 * **Example** (Reference the merge loop)
 *
 * ```ts
 * import { runYeetMonitorUntilMerged } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(runYeetMonitorUntilMerged)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Yeet run context for the branch being followed.
 * @param options - Post-merge sweep seam and optional poll interval.
 * @returns The terminal state that ended the loop.
 * @category streams
 * @since 0.0.0
 */
export const runYeetMonitorUntilMerged = Effect.fn("Yeet.runMonitorUntilMerged")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions
): Effect.fn.Return<
  YeetMonitorTerminalState,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const interval = O.getOrElse(O.fromNullishOr(options.pollInterval), () => mergeLoopPollInterval);
  const followFrom = (
    budget: YeetMonitorRerunBudget
  ): Effect.Effect<
    YeetMonitorTerminalState,
    YeetCommandError,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > =>
    pollUntilMerged(context, options, budget).pipe(
      Effect.flatMap((next) =>
        O.match(next.terminal, {
          onNone: () => Effect.sleep(interval).pipe(Effect.andThen(Effect.suspend(() => followFrom(next.budget)))),
          onSome: Effect.succeed,
        })
      )
    );
  return yield* followFrom(emptyYeetMonitorRerunBudget);
});
