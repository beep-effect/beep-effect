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
import { UUID } from "@beep/schema/String";
import { Console, DateTime, Duration, Effect, flow, HashSet, Match, pipe, Ref } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { configStringOption } from "../../../internal/cli/EnvConfig.ts";
import {
  detectGithubJobShapeClass,
  GithubJobRecord,
  GithubJobShapeClass,
  githubConclusion,
  githubJobShapeEvidence,
} from "../../../internal/github/index.ts";
import { runRepoCommandCapture, runRepoCommandCaptureRaw } from "../../../internal/repo-run/index.ts";
import { decideHeavyAdmission, HeavyAdmission, HeavyAdmissionEvent } from "../../Ci/HeavyAdmission.ts";
import { detectNoLocationTs2589Flake } from "../../Quality/internal/FlakeQuarantine.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import {
  readYeetAckState,
  writeYeetAckReceipt,
  YeetAckClearedResolution,
  YeetAckFixResolution,
  YeetAckReceipt,
} from "./Ack.ts";
import { runYeetAutomaticCloseout } from "./Closeout.ts";
import { convergeYeetInbox, pollYeetPrCommentRows, YeetConvergeObservation, YeetPrCommentWindow } from "./Converge.ts";
import {
  appendYeetInboxRowOnce,
  YeetBaseConflictCapsule,
  YeetPrMergeReadyCapsule,
  YeetPrMergeReadyRow,
  yeetBaseConflictRowId,
  yeetInboxHoldsRow,
  yeetPrMergeReadyRowId,
} from "./Inbox.ts";
import {
  loadYeetInboxRowIds,
  loadYeetPrWave,
  loadYeetPushToAckTimeline,
  renderYeetPrWaveLine,
  YeetPrWaveReturn,
} from "./InboxView.ts";
import {
  readYeetMonitorActingLogin,
  replayYeetMonitorComments,
  YeetMonitorCommentConsumer,
} from "./MonitorComments.ts";
import {
  renderYeetHeadTimeline,
  renderYeetPushToAckTimeline,
  YEET_MONITOR_POLL_ERROR_BUDGET,
  YeetHeadTimeline,
  YeetMonitorAttachment,
  YeetMonitorTerminalState,
  YeetUntilMergedPolicy,
  yeetHeadTimelineStamp,
  yeetHeadTimelineStampRed,
  yeetMonitorLoopTerminals,
  yeetMonitorPolicyConverges,
  yeetMonitorPolicyTerminals,
  yeetPushToReadyMillis,
} from "./MonitorPolicy.ts";
import { PROOF_JOB_ENV } from "./ProofJob.ts";
import { updateProofJobBookkeeping } from "./ProofJobLauncher.ts";
import {
  dispatchYeetBaseConflict,
  stampYeetWaveRedSet,
  supersedeYeetDispatchState,
  yeetBaseConflictGeneration,
  yeetBaseConflictWalk,
  yeetRedSetKey,
  yeetWaveRedSetKey,
} from "./Remediation.ts";
import {
  deriveSettleVerdict,
  readYeetChangedPaths,
  readYeetRulesetRequiredContexts,
  rememberRegistered,
  renderYeetSettleDetail,
  YeetGatedContextFamily,
  YeetRulesetRequiredContexts,
  YeetSettleCheck,
  YeetSettleInput,
  YeetSettleVerdict,
  yeetBaseConflictFor,
  yeetBaseMergeableFor,
  yeetGatedFamiliesFor,
  yeetSettleCensusRequires,
  yeetSettleClockReset,
} from "./Settle.ts";
import {
  collectRemoteWorkflowRuns,
  collectYeetStatus,
  renderYeetStatusSummary,
  writeYeetStatusSnapshot,
  YeetStatusSnapshot,
} from "./Status.ts";
import { executeSweep } from "./Sweep.ts";
import {
  mergeReadyCriterionHolds,
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetMergeReadyCriterion,
} from "./Verdict.ts";
import { YeetWatchThread, yeetFirstRed } from "./WatchStream.ts";
import type { FileSystem, Path } from "effect";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetPrCommentRow } from "./Inbox.ts";
import type { YeetMonitorLoopPolicy } from "./MonitorPolicy.ts";
import type { YeetBaseConflictWalk } from "./Remediation.ts";
import type { YeetStatusReviewThread } from "./Status.ts";

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
 * @category predicates
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
 * `runCompleted` separately prevents a known-flake rerun from being attempted
 * while GitHub still rejects job reruns for the active parent run.
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
    runCompleted: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
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
 * A flake-matching job whose parent run must finish before GitHub can rerun it.
 *
 * **Details**
 *
 * The decision spends no rerun allowance. The next poll classifies the same
 * job again, and only a completed parent run can turn it into `rerun`. This
 * avoids hammering `gh run rerun --job` on every poll while the run is active.
 *
 * **Example** (Defer a rerun)
 *
 * ```ts
 * import { YeetMonitorAwaitingRun } from "@beep/repo-cli/test/Yeet"
 *
 * const decision = YeetMonitorAwaitingRun.make({ databaseId: 991, name: "Check" })
 * console.log(decision.status) // "awaiting-run"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetMonitorAwaitingRun extends S.Class<YeetMonitorAwaitingRun>($I`YeetMonitorAwaitingRun`)(
  {
    status: S.tag("awaiting-run"),
    databaseId: S.Finite,
    name: S.String,
  },
  $I.annote("YeetMonitorAwaitingRun", {
    description: "A flake-matching red job deferred until its parent workflow run completes.",
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
  YeetMonitorAwaitingRun,
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
 * @category utilities
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
 * @category utilities
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
 * @category utilities
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
 * @category utilities
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
        : !job.runCompleted && O.isSome(job.flakeClass)
          ? {
              budget: plan.budget,
              decisions: A.append(
                plan.decisions,
                YeetMonitorAwaitingRun.make({ databaseId: job.databaseId, name: job.name })
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
    Match.discriminator("status")(
      "rerun",
      (value) =>
        `[yeet] ${value.name}: ${value.flakeClass} flake fingerprint matched${flakeEvidenceSuffix(value.flakeClass)}; rerunning once -> ${value.command}`
    ),
    Match.discriminator("status")(
      "rerun-spent",
      (value) =>
        `[yeet] ${value.name}: ${value.flakeClass} matched again at this SHA; rerun budget spent, needs attention`
    ),
    Match.discriminator("status")(
      "needs-code-fix",
      (value) => `[yeet] ${value.name}: red with no known flake fingerprint; needs code fix`
    ),
    Match.discriminator("status")(
      "awaiting-log",
      (value) =>
        `[yeet] ${value.name}: red; failing-step log not available yet (run still in progress), reclassifying next poll`
    ),
    Match.discriminator("status")(
      "awaiting-run",
      (value) =>
        `[yeet] ${value.name}: known flake matched, but the parent run is still active; deferring rerun to the next poll`
    ),
    Match.exhaustive
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
): Effect.fn.Return<ReadonlyArray<GithubJobRecord>, never, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
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
): Effect.fn.Return<YeetMonitorFailedJob, never, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const shapeClass = detectGithubJobShapeClass(job);
  if (O.isSome(shapeClass)) {
    return YeetMonitorFailedJob.make({
      databaseId: job.databaseId,
      flakeClass: shapeClass,
      name: job.name,
      runCompleted,
    });
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
 * import { Effect } from "effect"
 *
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
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
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
): Effect.fn.Return<void, never, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
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
 * import { Effect } from "effect"
 *
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
): Effect.fn.Return<void, never, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log(renderYeetMonitorJobDecision(decision));
  if (decision.status !== "rerun") {
    return;
  }
  yield* rerunJob(context, decision.databaseId);
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
  // Whether the loop runs attached or inside a detached proof job; absent is
  // detached. The porcelain sets it from `BEEP_YEET_JOB_ID`. An attached
  // until-ready loop ends with `wave` on the first new wake-set inbox row on its
  // pull request, or on a changed required red set on the same head; a detached
  // one keeps polling and `yeet job wait` carries the wave. `waveRerunCommand`
  // is the re-run the attached gate line names.
  readonly attachment?: YeetMonitorAttachment | undefined;
  // Under until-ready, binds the pull request to the detached job this loop
  // runs in, once per head right after the wave record is pinned to it. The
  // seam lets a test observe the order without a job record.
  readonly bindPullRequest?:
    | ((
        context: RepoRunContext,
        prNumber: number
      ) => Effect.Effect<
        void,
        never,
        Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
      >)
    | undefined;
  readonly capture?: typeof runRepoCommandCapture | undefined;
  readonly closeout?: typeof runYeetAutomaticCloseout | undefined;
  readonly collectStatus?: typeof collectYeetStatus | undefined;
  // Under until-ready every poll turns new pull request comments into inbox rows
  // rather than replaying them (pr-event-awareness D13/D21/D32). `commentsSince`
  // starts the comment window: the monitor job's submit time, or the loop's
  // start when absent (an attached run). The `commentRows` seam lets a test
  // drive the consumer without a GitHub read.
  readonly commentRows?: typeof pollYeetPrCommentRows | undefined;
  readonly commentsSince?: string | undefined;
  readonly now?: Effect.Effect<DateTime.Utc> | undefined;
  readonly onMerged?:
    | ((
        context: RepoRunContext
      ) => Effect.Effect<
        unknown,
        YeetCommandError,
        Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
      >)
    | undefined;
  readonly policy?: YeetMonitorLoopPolicy | undefined;
  readonly pollInterval?: Duration.Duration | undefined;
  // Runs once, on the first cycle only, under until-merged: the durable comment
  // stream is replayed from that mode's own position where the session starts,
  // not on every poll, because after that this loop is attached and nothing can
  // be missed. The seam exists so a test can prove the call without a GitHub read.
  readonly replayComments?: typeof replayYeetMonitorComments | undefined;
  readonly rulesetRead?: typeof readYeetRulesetRequiredContexts | undefined;
  readonly waveRerunCommand?: string | undefined;
}

// The attached re-run when the porcelain names none: the canonical attached
// `--until-ready` recipe.
const defaultWaveRerunCommand = "bun run beep yeet monitor --until-ready";

// Inside a detached job, the job record learns the pull request only once the
// wave record is pinned to the head this loop observes. Binding earlier let
// `yeet job wait` read the previous head's rows, still live against the stale
// wave record, as a new wave the moment the job started. Outside a job this is
// a no-op, and a failed bind is reported, never fatal.
const bindMonitorJobPullRequest = (context: RepoRunContext, prNumber: number) =>
  updateProofJobBookkeeping(context.repoRoot, (launcher, jobId) => launcher.bindPullRequest(jobId, prNumber));

const renderMergeReadyGateDetail = (mergeReady: YeetMergeReady): string =>
  O.match(mergeReady.failing, {
    onNone: () => "[yeet] merge-ready: yes; every hard criterion is green; awaiting the operator's merge",
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

// `settleClockMs` is the origin of `waitedMs`: the first observation of the
// head, moved forward whenever the heavy admission verdict flips so time spent
// held never counts toward the settle budget (ttc B8). `changedPaths` is the
// merge-base diff read once per head; `families` are the gated families folded
// from the ruleset; `admission` is re-decided every poll from the snapshot's
// labels, the only admission input that changes without a push.
class MonitorHeadState extends S.Class<MonitorHeadState>($I`MonitorHeadState`)(
  {
    timeline: YeetHeadTimeline,
    firstObservedMs: S.Finite,
    settleClockMs: S.Finite,
    expected: YeetRulesetRequiredContexts.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    families: S.Array(YeetGatedContextFamily).pipe(SchemaUtils.withKeyDefaults(A.empty<YeetGatedContextFamily>())),
    changedPaths: S.Array(S.String).pipe(SchemaUtils.withKeyDefaults(A.empty<string>())),
    admission: HeavyAdmission.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    // Every check name ever reported for this head: an absent one later is pending, not missing.
    registered: S.HashSet(S.String).pipe(SchemaUtils.withKeyDefaults(HashSet.empty<string>())),
    announcedRow: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    // The head's open P0 base-conflict row (until-ready only): the id of the
    // latest conflict generation, written once when that conflict is first read
    // and reset when a `cleared` ack closes it, so a conflict that returns on
    // the same head writes the next generation.
    conflictRow: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    // Whether this loop already knows the head's conflict row, from writing it or
    // from an inbox lookup, so a restarted loop recalls it once, not every poll.
    conflictRecalled: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    // Whether this loop already said why a conflict on this head writes no row
    // (its generation carries another ack kind than `cleared`): once per head.
    conflictAckNoticed: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    // The conflict generations on this head whose ack receipt does not decode
    // and that this loop already named: the walk passes them silently on every
    // conflicted poll, so each is said once per head.
    conflictCorruptNoticed: S.HashSet(S.Int).pipe(SchemaUtils.withKeyDefaults(HashSet.empty<number>())),
    // Whether the wave record has been pinned to this head (until-ready only);
    // a new head starts unpinned, so the first converging poll supersedes.
    wavePinned: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    // The red set the last conclusive triage classified on this head; the same
    // set again skips the failed-job and log reads (the loop polls through reds).
    triagedReds: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    // The required red set an attached until-ready loop takes as already known
    // on this head, set when the head is pinned: the key an earlier monitor
    // stamped for it, or else this loop's first observation. A red set that
    // names a red beyond it is a new wave even if its row id was already there.
    waveRedSet: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    verdict: YeetSettleVerdict.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("MonitorHeadState", {
    description:
      "Cached ruleset, gated families, merge-base diff, admission, and first observations for the current head.",
  })
) {}

const decideMonitorAdmission = (snapshot: YeetStatusSnapshot, changedPaths: ReadonlyArray<string>): HeavyAdmission =>
  decideHeavyAdmission(
    HeavyAdmissionEvent.make({
      eventName: "pull_request",
      labels: snapshot.remote.labels,
      draft: snapshot.remote.isDraft ?? false,
      changedPaths,
    })
  );

const readPushedAt = Effect.fn("YeetMonitorLoop.readPushedAt")(function* (
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

class MonitorPoll extends S.Class<MonitorPoll>($I`MonitorPoll`)(
  {
    budget: S.HashSet(S.String),
    head: MonitorHeadState.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    terminal: YeetMonitorTerminalState.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    failure: YeetCommandError.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    // Whether this tick replayed the durable comment stream. The loop keeps
    // its first cycle open until a tick reports true, so a failed read or a
    // read without a pull request number cannot spend the one replay.
    replayed: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  },
  $I.annote("MonitorPoll", { description: "One loop tick, retaining per-head state across recoverable read failures." })
) {}

const requiredName = (snapshot: YeetStatusSnapshot, verdict: O.Option<YeetSettleVerdict>, name: string): boolean =>
  A.some(snapshot.remote.checks, (check) => check.required && check.name === name) ||
  yeetSettleCensusRequires(verdict, name);

const bindRequiredCensus = (snapshot: YeetStatusSnapshot, verdict: YeetSettleVerdict): YeetStatusSnapshot => {
  if (
    !A.some(
      snapshot.remote.checks,
      (check) => check.outcome === "fail" && requiredName(snapshot, O.some(verdict), check.name)
    )
  ) {
    return snapshot;
  }
  return YeetStatusSnapshot.make({
    ...snapshot,
    mergeReady: O.map(snapshot.mergeReady, (ready) => {
      const criteria = YeetMergeReadyCriteria.make({ ...ready.criteria, requiredChecksGreen: false });
      const failing = A.findFirst(
        YeetMergeReadyCriterion.Options,
        (criterion) => !mergeReadyCriterionHolds(criteria, criterion)
      );
      return YeetMergeReady.make({ ready: false, criteria, failing });
    }),
  });
};

// The one base-conflict reading per poll: the settle wait names it, and under
// until-ready the same reading writes and clears the head's conflict row.
const monitorBaseConflict = (snapshot: YeetStatusSnapshot): boolean =>
  yeetBaseConflictFor(
    O.fromUndefinedOr(snapshot.remote.mergeable),
    O.fromUndefinedOr(snapshot.remote.mergeStateStatus)
  );

// The settle rule reads only name, outcome, and required; the status snapshot
// carries each check's whole record for the inbox capsule.
const settleChecksOf = (snapshot: YeetStatusSnapshot): ReadonlyArray<YeetSettleCheck> =>
  A.map(snapshot.remote.checks, (check) =>
    YeetSettleCheck.make({ name: check.name, outcome: check.outcome, required: check.required })
  );

// One head's push → row → ack line (pr-event-awareness W1), printed when the
// loop leaves a head it never announced ready and beside the final gate line.
const reportMonitorPushToAck = Effect.fn("YeetMonitorLoop.reportPushToAck")(function* (
  context: RepoRunContext,
  timeline: YeetHeadTimeline,
  snapshot: YeetStatusSnapshot
) {
  const joined = yield* loadYeetPushToAckTimeline(
    context.repoRoot,
    timeline,
    O.fromUndefinedOr(snapshot.remote.number)
  );
  yield* Console.log(`[yeet] ${renderYeetPushToAckTimeline(joined)}`);
});

class MonitorObservation extends S.Class<MonitorObservation>($I`MonitorObservation`)(
  {
    snapshot: YeetStatusSnapshot,
    poll: MonitorPoll,
    at: S.String,
    millis: S.Finite,
  },
  $I.annote("MonitorObservation", { description: "Status, head state, and clock at one monitor observation." })
) {}

const observeMonitorHead = Effect.fn("YeetMonitorLoop.observeHead")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions,
  observation: MonitorObservation
) {
  const { snapshot, poll, at, millis } = observation;
  const headSha = snapshot.remote.headSha;
  if (O.isNone(headSha)) return observation;
  if (O.exists(poll.head, (head) => head.timeline.headSha === headSha.value)) return observation;
  const leaving = O.filter(poll.head, (head) => O.isNone(head.announcedRow));
  if (O.isSome(leaving)) {
    yield* reportMonitorPushToAck(context, leaving.value.timeline, snapshot);
  }
  const oldRow = O.flatMap(poll.head, (head) => head.announcedRow);
  if (O.isSome(oldRow)) {
    yield* writeYeetAckReceipt(
      context.repoRoot,
      YeetAckReceipt.make({
        id: oldRow.value,
        ackedAt: at,
        resolution: YeetAckFixResolution.make({ sha: headSha.value }),
      })
    );
  }
  const capture = options.capture ?? runRepoCommandCapture;
  const expected = yield* (options.rulesetRead ?? readYeetRulesetRequiredContexts)(context);
  const head = MonitorHeadState.make({
    timeline: YeetHeadTimeline.make({
      headSha: headSha.value,
      firstObservedAt: at,
      pushedAt: yield* readPushedAt(context, headSha.value, capture),
    }),
    firstObservedMs: millis,
    settleClockMs: millis,
    expected,
    families: O.match(expected, { onNone: A.empty<YeetGatedContextFamily>, onSome: yeetGatedFamiliesFor }),
    changedPaths: yield* readYeetChangedPaths(context, options.capture ?? runRepoCommandCaptureRaw),
  });
  return MonitorObservation.make({ ...observation, poll: MonitorPoll.make({ ...poll, head: O.some(head) }) });
});

const statusWatchThreads = (
  threads: O.Option<ReadonlyArray<YeetStatusReviewThread>>,
  state: YeetWatchThread["state"]
): ReadonlyArray<YeetWatchThread> =>
  pipe(
    O.getOrElse(threads, A.empty<YeetStatusReviewThread>),
    A.filter((thread) => Str.isNonEmpty(thread.threadId)),
    A.map((thread) => YeetWatchThread.make({ id: thread.threadId, state }))
  );

// The status snapshot narrowed to what convergence reads. The status gate
// already partitions threads with the watch's classifier, so its unresolved
// and follow-up lists are exactly the watch's outstanding states.
const monitorConvergeObservation = (snapshot: YeetStatusSnapshot): O.Option<YeetConvergeObservation> =>
  O.map(
    O.all({
      headSha: O.filter(snapshot.remote.headSha, Str.isNonEmpty),
      prNumber: O.fromUndefinedOr(snapshot.remote.number),
    }),
    ({ headSha, prNumber }) =>
      YeetConvergeObservation.make({
        checks: snapshot.remote.checks,
        headSha,
        mergeStateStatus: snapshot.remote.mergeStateStatus ?? "UNKNOWN",
        prNumber,
        threads: A.appendAll(
          statusWatchThreads(snapshot.remote.unresolvedThreads, "unresolved"),
          statusWatchThreads(snapshot.remote.followUpThreads, "resolved-follow-up")
        ),
      })
  );

const decodeUuidOption = S.decodeUnknownOption(UUID);

// The detached monitor job that writes a `cleared` receipt; both are absent
// when the loop runs attached.
const monitorJobAttribution = Effect.fn("YeetMonitorLoop.jobAttribution")(function* () {
  const jobId = O.flatMap(yield* configStringOption(PROOF_JOB_ENV.jobId), decodeUuidOption);
  const unit = O.filter(yield* configStringOption(PROOF_JOB_ENV.jobUnit), Str.isNonEmpty);
  return { jobId, unit };
});

// The row id of the head's latest conflict generation; `None` when the
// generation walk fails.
const monitorConflictRowId = (repoRoot: string, observed: YeetConvergeObservation) =>
  yeetBaseConflictGeneration(repoRoot, observed).pipe(
    Effect.flatMap((generation) =>
      yeetBaseConflictRowId({ generation, headSha: observed.headSha, prNumber: observed.prNumber })
    ),
    Effect.option
  );

// A restarted monitor has no memory of the head's conflict row. It recalls the
// latest generation's row when the inbox still holds it unacked: on the head's
// first positively mergeable poll, so a conflict that cleared while no monitor
// watched it can still be cleared, and on a conflicted poll whose dispatch
// found that row already written. Every earlier generation is already
// consumed (acked `cleared`, or with a receipt that does not decode), so only
// the latest is ever recalled, and only it is cleared. The first poll after a
// restart often reads UNKNOWN while GitHub recomputes, so the recall waits for
// a conclusive read instead of the first poll.
const recallMonitorConflictRow = Effect.fn("YeetMonitorLoop.recallConflictRow")(function* (
  repoRoot: string,
  observed: YeetConvergeObservation
) {
  const id = yield* monitorConflictRowId(repoRoot, observed);
  if (O.isNone(id) || !(yield* yeetInboxHoldsRow(repoRoot, id.value))) return O.none<string>();
  const ack = yield* readYeetAckState(repoRoot, id.value);
  return ack.acked ? O.none<string>() : id;
});

// A conflicted poll that wrote no row and recalled none: when the latest
// generation's row carries a decodable ack receipt of another kind than
// `cleared` (an operator acked it wontfix, waived it, ...), the append skips
// that id, the recall ignores it, and only a `cleared` receipt moves the head
// to the next generation, so the conflict raises nothing until a push. Say so
// once per head; the caller keeps the flag. Returns whether the line printed.
const noticeMonitorConflictAck = Effect.fn("YeetMonitorLoop.noticeConflictAck")(function* (
  repoRoot: string,
  observed: YeetConvergeObservation
) {
  const id = yield* monitorConflictRowId(repoRoot, observed);
  if (O.isNone(id)) return false;
  const ack = yield* readYeetAckState(repoRoot, id.value);
  const receipt = O.filter(O.fromNullOr(ack.receipt), (value) => value.resolution.kind !== "cleared");
  if (O.isNone(receipt)) return false;
  yield* Console.error(
    `[yeet] base conflict on head ${Str.slice(0, 7)(observed.headSha)} raises no new row: ${id.value} carries a ${receipt.value.resolution.kind} ack receipt, not cleared, so this head writes no further conflict row; the next push re-arms it`
  );
  return true;
});

// The generation walk counts an undecodable-but-acked receipt as consumed and
// returns it without printing, because the walk runs from the dispatch, the
// recall, and the ack notice on every conflicted poll. Name each such receipt
// once per head and generation; the caller keeps the noticed set.
const noticeMonitorCorruptReceipts = Effect.fn("YeetMonitorLoop.noticeCorruptReceipts")(function* (
  observed: YeetConvergeObservation,
  walk: YeetBaseConflictWalk,
  noticed: HashSet.HashSet<number>
) {
  const fresh = A.filter(walk.corruptReceipts, (receipt) => !HashSet.has(noticed, receipt.generation));
  yield* Effect.forEach(
    fresh,
    (receipt) =>
      Console.error(
        `[yeet] base-conflict ack receipt ${receipt.path} does not decode; counting conflict generation ${receipt.generation} on head ${Str.slice(0, 7)(observed.headSha)} as consumed`
      ),
    { discard: true }
  );
  return A.reduce(fresh, noticed, (acc, receipt) => HashSet.add(acc, receipt.generation));
});

// The conflict row's same-head clear (pr-event-awareness D17): the head read
// mergeable again without a push, so the loop acknowledges its own row, the
// latest conflict generation's (every earlier one already has its receipt),
// with a `cleared` receipt attributed to the monitor job. That receipt is what
// moves the head's next conflict to a new generation. A failed write keeps the
// row open and the next mergeable poll retries.
const clearMonitorConflictRow = Effect.fn("YeetMonitorLoop.clearConflictRow")(function* (
  repoRoot: string,
  id: string,
  observed: YeetConvergeObservation,
  snapshot: YeetStatusSnapshot,
  at: string
) {
  const attribution = yield* monitorJobAttribution();
  const written = yield* writeYeetAckReceipt(
    repoRoot,
    YeetAckReceipt.make({
      id,
      ackedAt: at,
      resolution: YeetAckClearedResolution.make({
        headSha: observed.headSha,
        mergeable: snapshot.remote.mergeable ?? "MERGEABLE",
        mergeStateStatus: snapshot.remote.mergeStateStatus ?? null,
        jobId: attribution.jobId,
        unit: attribution.unit,
      }),
    })
  ).pipe(
    Effect.as(true),
    Effect.catch((error) =>
      Console.error(`[yeet] failed to clear base-conflict row ${id}: ${error.message}; retrying next poll`).pipe(
        Effect.as(false)
      )
    )
  );
  if (written) {
    yield* Console.log(
      `[yeet] base conflict cleared on head ${Str.slice(0, 7)(observed.headSha)} without a push; row ${id} acked cleared`
    );
  }
  return written;
});

// The head's base-conflict row (pr-event-awareness D6/D17), from the same
// reading the settle wait uses. A conflict writes one P0 row per conflict
// generation on the head and joins it to the head's wave, so the fix push
// supersedes it with the rest of the wave. The same head read positively
// mergeable again clears it, and a conflict that returns on that head after
// the clear is the next generation: a new row and a new wave. The wait itself
// stays non-terminal and unbudgeted.
const convergeMonitorBaseConflict = Effect.fn("YeetMonitorLoop.convergeBaseConflict")(function* (
  context: RepoRunContext,
  observation: MonitorObservation,
  observed: YeetConvergeObservation,
  current: MonitorHeadState
) {
  const { snapshot, at } = observation;
  if (monitorBaseConflict(snapshot)) {
    if (O.isSome(current.conflictRow)) return current;
    const walk = yield* yeetBaseConflictWalk(context.repoRoot, observed).pipe(
      Effect.asSome,
      Effect.catch((error) =>
        Console.error(
          `[yeet] failed to derive the base-conflict generation for head ${Str.slice(0, 7)(observed.headSha)}: ${error.message}; retrying next poll`
        ).pipe(Effect.as(O.none<YeetBaseConflictWalk>()))
      )
    );
    const corruptNoticed = O.isSome(walk)
      ? yield* noticeMonitorCorruptReceipts(observed, walk.value, current.conflictCorruptNoticed)
      : current.conflictCorruptNoticed;
    const written = O.isSome(walk)
      ? yield* dispatchYeetBaseConflict(
          context.repoRoot,
          YeetBaseConflictCapsule.make({
            base: context.base,
            generation: walk.value.generation,
            headSha: observed.headSha,
            link: snapshot.remote.url ?? null,
            mergeable: snapshot.remote.mergeable ?? null,
            mergeStateStatus: snapshot.remote.mergeStateStatus ?? null,
            prNumber: observed.prNumber,
          }),
          at
        ).pipe(Effect.map(O.map((row) => row.id)))
      : O.none<string>();
    // `None` means this poll wrote nothing: the generation's row is already in
    // the inbox (a restarted loop), an ack receipt closes it, or the write
    // failed. Recall it only when it is live, so the guard above stops
    // re-dispatching and a later mergeable read clears it. A row closed by
    // another ack kind than `cleared` is not re-raised; the loop says so once.
    const open = O.isSome(written) ? written : yield* recallMonitorConflictRow(context.repoRoot, observed);
    const noticed =
      O.isNone(open) && !current.conflictAckNoticed
        ? yield* noticeMonitorConflictAck(context.repoRoot, observed)
        : current.conflictAckNoticed;
    return MonitorHeadState.make({
      ...current,
      conflictRow: open,
      conflictRecalled: true,
      conflictAckNoticed: noticed,
      conflictCorruptNoticed: corruptNoticed,
    });
  }
  const mergeable = yeetBaseMergeableFor(
    O.fromUndefinedOr(snapshot.remote.mergeable),
    O.fromUndefinedOr(snapshot.remote.mergeStateStatus)
  );
  if (!mergeable) return current;
  const open =
    O.isSome(current.conflictRow) || current.conflictRecalled
      ? current.conflictRow
      : yield* recallMonitorConflictRow(context.repoRoot, observed);
  const recalled = MonitorHeadState.make({ ...current, conflictRecalled: true });
  if (O.isNone(open)) return recalled;
  const cleared = yield* clearMonitorConflictRow(context.repoRoot, open.value, observed, snapshot, at);
  return MonitorHeadState.make({ ...recalled, conflictRow: cleared ? O.none() : open });
});

// The until-ready comment consumer's loop-scoped inputs: where the comment
// window starts, and the acting login once a read has named it. The login is
// read once per loop, not per poll; a failed read is retried on the next poll.
interface MonitorCommentConsumer {
  readonly actingLogin: Ref.Ref<O.Option<string>>;
  readonly since: string;
}

const monitorActingLogin = Effect.fn("YeetMonitorLoop.actingLogin")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions,
  consumer: MonitorCommentConsumer
) {
  const known = yield* Ref.get(consumer.actingLogin);
  if (O.isSome(known)) return known;
  const read = yield* readYeetMonitorActingLogin(context, options.capture ?? runRepoCommandCapture);
  yield* Ref.set(consumer.actingLogin, read);
  return read;
});

// The until-ready comment consumer (pr-event-awareness D13/D21/D32): each poll
// turns new top-level comments from people other than the acting login into P1
// `pr-comment` rows instead of printing them, from the mode's own watermark.
// Nothing here fails the loop: without a login, or on a failed read or append,
// the watermark holds and the next poll retries.
const convergeMonitorComments = Effect.fn("YeetMonitorLoop.convergeComments")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions,
  observed: YeetConvergeObservation,
  consumer: MonitorCommentConsumer,
  at: string
) {
  const actingLogin = yield* monitorActingLogin(context, options, consumer);
  if (O.isNone(actingLogin)) {
    return yield* Console.error(
      "[yeet] comment rows wait: gh could not name the acting login; the comment watermark holds and the next poll retries"
    );
  }
  const window = YeetPrCommentWindow.make({
    actingLogin: actingLogin.value,
    headSha: observed.headSha,
    prNumber: observed.prNumber,
    since: consumer.since,
  });
  const appended = yield* (options.commentRows ?? pollYeetPrCommentRows)(context, window, at).pipe(
    Effect.catch((error) =>
      Console.error(
        `[yeet] comment rows: ${error.message}; the comment watermark holds and the next poll retries`
      ).pipe(Effect.as(A.empty<YeetPrCommentRow>()))
    )
  );
  yield* Effect.forEach(
    appended,
    (row) =>
      Console.log(
        `[yeet] P1 pr-comment row ${row.id}: comment by @${row.capsule.author} on PR #${row.capsule.prNumber} ${row.capsule.link}`
      ),
    { discard: true }
  );
});

// Under until-ready the loop is the inbox producer (pr-event-awareness D2/D16):
// the first converging poll of each head pins the wave record to it, which
// supersedes the previous head's wave, and every poll converges the status
// snapshot and the new pull request comments into rows, then stamps the head's
// required red set on the record, after the rows, so a rerun that comes back
// red on the same head reaches both waiters as a new wave. That first poll then
// binds the pull request to a detached job, so the job's waiter first reads
// the inbox with the previous head's rows already superseded and this head's
// rows already written. Every step is idempotent and never fails the loop.
const convergeMonitorInbox = Effect.fn("YeetMonitorLoop.convergeInbox")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions,
  observation: MonitorObservation,
  comments: MonitorCommentConsumer
) {
  if (!yeetMonitorPolicyConverges(options.policy ?? YeetUntilMergedPolicy.make({}))) return observation;
  const observed = monitorConvergeObservation(observation.snapshot);
  const head = observation.poll.head;
  if (O.isNone(observed) || O.isNone(head)) return observation;
  const pinning = !head.value.wavePinned;
  if (pinning) {
    yield* supersedeYeetDispatchState(
      context.repoRoot,
      observed.value.headSha,
      observed.value.prNumber,
      observation.at
    );
  }
  yield* convergeYeetInbox(context, observed.value, observation.at);
  const redSet = yeetWaveRedSetKey(observed.value.checks);
  const stamped = yield* stampYeetWaveRedSet(context.repoRoot, observed.value, redSet, observation.at);
  const conflicted = yield* convergeMonitorBaseConflict(context, observation, observed.value, head.value);
  yield* convergeMonitorComments(context, options, observed.value, comments, observation.at);
  if (pinning) {
    yield* (options.bindPullRequest ?? bindMonitorJobPullRequest)(context, observed.value.prNumber);
  }
  return MonitorObservation.make({
    ...observation,
    poll: MonitorPoll.make({
      ...observation.poll,
      head: O.some(
        MonitorHeadState.make({
          ...conflicted,
          wavePinned: true,
          waveRedSet: pinning ? O.orElse(stamped, () => O.some(redSet)) : conflicted.waveRedSet,
        })
      ),
    }),
  });
});

// Re-decide heavy admission from this poll's labels; a verdict flip is logged
// and restarts the settle clock so time spent held never counts (ttc B8).
const admitMonitorHead = Effect.fn("YeetMonitorLoop.admitHead")(function* (
  observation: MonitorObservation,
  current: MonitorHeadState
) {
  const admission = decideMonitorAdmission(observation.snapshot, current.changedPaths);
  const previousVerdict = O.map(current.admission, (value) => value.verdict);
  const flipped = O.exists(previousVerdict, (value) => value !== admission.verdict);
  if (flipped) {
    yield* Console.log(`[yeet] heavy admission: ${O.getOrThrow(previousVerdict)} → ${admission.verdict}`);
  }
  const recall = rememberRegistered(current.registered, settleChecksOf(observation.snapshot));
  if (A.isReadonlyArrayNonEmpty(recall.recalled)) {
    yield* Console.log(
      `[yeet] rollup: ${A.length(recall.recalled)} registered context(s) absent this poll, kept pending`
    );
  }
  return MonitorHeadState.make({
    ...current,
    admission: O.some(admission),
    registered: recall.registered,
    settleClockMs: flipped ? observation.millis : current.settleClockMs,
  });
});

const settleMonitorHead = (
  observation: MonitorObservation,
  current: MonitorHeadState,
  policy: YeetMonitorLoopPolicy
): YeetSettleVerdict =>
  deriveSettleVerdict(
    YeetSettleInput.make({
      expected: current.expected,
      checks: rememberRegistered(current.registered, settleChecksOf(observation.snapshot)).checks,
      closeoutBound: O.exists(observation.snapshot.mergeReady, (ready) => ready.criteria.closeoutRun),
      waitedMs: observation.millis - current.settleClockMs,
      timeoutMs: policy.settleTimeoutMs,
      families: current.families,
      admission: current.admission,
      baseConflict: monitorBaseConflict(observation.snapshot),
    })
  );

// The budget resumed (held → admitted, conflict cleared, rollup flap): time
// spent suspended must not expire the very next verdict, so the clock restarts
// and the verdict is derived again from zero. An admission flip already reset
// the clock this poll, in which case there is nothing further to resume.
const resumeMonitorSettleClock = Effect.fn("YeetMonitorLoop.resumeSettleClock")(function* (
  observation: MonitorObservation,
  current: MonitorHeadState,
  policy: YeetMonitorLoopPolicy
) {
  if (current.settleClockMs === observation.millis) return current;
  if (!yeetSettleClockReset(current.verdict, settleMonitorHead(observation, current, policy))) return current;
  yield* Console.log("[yeet] settle budget resumed; clock reset");
  return MonitorHeadState.make({ ...current, settleClockMs: observation.millis });
});

const closeoutMonitorHead = Effect.fn("YeetMonitorLoop.closeoutHead")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions,
  observation: MonitorObservation,
  current: MonitorHeadState
) {
  const { poll } = observation;
  const closedOut = yield* (options.closeout ?? runYeetAutomaticCloseout)(context).pipe(Effect.result);
  if (Result.isFailure(closedOut)) {
    return Result.fail(MonitorPoll.make({ ...poll, failure: O.some(closedOut.failure) }));
  }
  const at = DateTime.formatIso(yield* options.now ?? DateTime.now);
  const timeline = yeetHeadTimelineStamp(O.getOrThrow(poll.head).timeline, "closeoutAt", at);
  const head = O.some(MonitorHeadState.make({ ...current, timeline }));
  const nextPoll = MonitorPoll.make({ ...poll, head });
  yield* Console.log(
    `[yeet] closeout: ${closedOut.success.report.issueCount} issue(s) for head ${Str.slice(0, 7)(current.timeline.headSha)}`
  );
  const reread = yield* (options.collectStatus ?? collectYeetStatus)(context, true).pipe(Effect.result);
  if (Result.isFailure(reread)) {
    return Result.fail(MonitorPoll.make({ ...nextPoll, failure: O.some(reread.failure) }));
  }
  // A push during closeout must never lend the old head's census or stamps to the new head.
  if (!O.contains(reread.success.remote.headSha, current.timeline.headSha)) return Result.fail(nextPoll);
  const now = yield* options.now ?? DateTime.now;
  return Result.succeed(
    MonitorObservation.make({
      snapshot: reread.success,
      poll: nextPoll,
      at: DateTime.formatIso(now),
      millis: DateTime.toEpochMillis(now),
    })
  );
});

const stampMonitorReadiness = Effect.fn("YeetMonitorLoop.stampReadiness")(function* (
  observation: MonitorObservation,
  current: MonitorHeadState,
  verdict: YeetSettleVerdict
) {
  const { at, poll } = observation;
  let snapshot = bindRequiredCensus(observation.snapshot, verdict);
  let timeline = O.getOrThrow(poll.head).timeline;
  const firstRed = yeetFirstRed(snapshot.remote.checks);
  if (O.isSome(firstRed)) {
    timeline = yeetHeadTimelineStampRed(timeline, firstRed.value);
  }
  if (O.exists(snapshot.mergeReady, (ready) => ready.criteria.closeoutRun)) {
    timeline = yeetHeadTimelineStamp(timeline, "closeoutAt", at);
  }
  if (O.isNone(verdict.reason) && O.exists(snapshot.mergeReady, (ready) => ready.ready)) {
    timeline = yeetHeadTimelineStamp(timeline, "readyAt", at);
  }
  yield* reportMonitorSettleTransition(current.verdict, verdict);
  const head = O.some(MonitorHeadState.make({ ...current, timeline, verdict: O.some(verdict) }));
  snapshot = YeetStatusSnapshot.make({ ...snapshot, timeline: O.some(timeline) });
  return MonitorObservation.make({ ...observation, snapshot, poll: MonitorPoll.make({ ...poll, head }) });
});

const reportMonitorSettleTransition = Effect.fn("YeetMonitorLoop.reportSettleTransition")(function* (
  previous: O.Option<YeetSettleVerdict>,
  verdict: YeetSettleVerdict
) {
  const to = O.getOrNull(verdict.reason);
  if (O.isNone(previous)) {
    if (to !== null) yield* Console.log(`[yeet] settle: ${to}`);
    return;
  }
  const from = O.getOrNull(previous.value.reason);
  if (from !== to) yield* Console.log(`[yeet] settle: ${from ?? "settled"} → ${to ?? "settled"}`);
});

const settleAndCloseoutMonitorHead = Effect.fn("YeetMonitorLoop.settleAndCloseout")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions,
  observation: MonitorObservation
) {
  if (O.isNone(observation.snapshot.remote.headSha)) return Result.succeed(observation);
  const admitted = yield* admitMonitorHead(observation, O.getOrThrow(observation.poll.head));
  const policy = options.policy ?? YeetUntilMergedPolicy.make({});
  const current = yield* resumeMonitorSettleClock(observation, admitted, policy);
  let verdict = settleMonitorHead(observation, current, policy);
  const timeline = verdict.settled
    ? yeetHeadTimelineStamp(current.timeline, "settledAt", observation.at)
    : current.timeline;
  let next = MonitorObservation.make({
    ...observation,
    poll: MonitorPoll.make({
      ...observation.poll,
      head: O.some(MonitorHeadState.make({ ...current, timeline, verdict: O.some(verdict) })),
    }),
  });
  const terminal = yeetMonitorTerminalState(O.fromUndefinedOr(observation.snapshot.remote.state));
  if (O.isNone(terminal) && O.contains(verdict.reason, "closeout-pending")) {
    const closedOut = yield* closeoutMonitorHead(context, options, next, current);
    if (Result.isFailure(closedOut)) return closedOut;
    next = closedOut.success;
    verdict = settleMonitorHead(next, current, policy);
  }
  return Result.succeed(yield* stampMonitorReadiness(next, current, verdict));
});

const reportMonitorObservation = Effect.fn("YeetMonitorLoop.reportObservation")(function* (
  observation: MonitorObservation
) {
  yield* writeYeetStatusSnapshot(observation.snapshot);
  yield* Console.log(renderYeetStatusSummary(observation.snapshot));
  const verdict = O.flatMap(observation.poll.head, (head) => head.verdict);
  const detail = O.match(verdict, { onNone: () => "", onSome: (value) => `; ${renderYeetSettleDetail(value)}` });
  yield* Console.log(`${renderMergeReadyGate(observation.snapshot)}${detail}`);
  return detail;
});

const decideMonitorTerminal = Effect.fn("YeetMonitorLoop.decideTerminal")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions,
  observation: MonitorObservation,
  detail: string
) {
  const { poll, snapshot } = observation;
  const terminals = yeetMonitorPolicyTerminals(options.policy ?? YeetUntilMergedPolicy.make({}));
  const terminal = yeetMonitorTerminalState(O.fromUndefinedOr(snapshot.remote.state));
  if (O.isSome(terminal)) {
    yield* Match.value(terminal.value).pipe(
      Match.when(
        "merged",
        Effect.fnUntraced(function* () {
          yield* Console.log("[yeet] pull request is MERGED; running the post-merge workspace sweep");
          yield* (options.onMerged ?? executeSweep)(context);
        })
      ),
      Match.orElse(() => Console.log("[yeet] pull request is CLOSED without merging; ending the merge loop"))
    );
    return O.some(
      MonitorPoll.make({ ...poll, terminal: O.filter(terminal, (value) => HashSet.has(terminals, value)) })
    );
  }
  const verdict = O.flatMap(poll.head, (head) => head.verdict);
  if (O.exists(verdict, (value) => O.contains(value.reason, "settle-timeout"))) {
    yield* Console.log(`[yeet] settle-timeout${detail}`);
    return O.some(MonitorPoll.make({ ...poll, terminal: O.some("settle-timeout") }));
  }
  return O.none<MonitorPoll>();
});

const announceMonitorReadiness = Effect.fn("YeetMonitorLoop.announceReadiness")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions,
  observation: MonitorObservation
) {
  const { snapshot, poll, at } = observation;
  const { head } = poll;
  const verdict = O.flatMap(head, (value) => value.verdict);
  if (O.isNone(head)) return poll;
  if (!O.exists(verdict, (value) => O.isNone(value.reason))) return poll;
  if (!O.exists(snapshot.mergeReady, (ready) => ready.ready)) return poll;
  const current = head.value;
  if (O.isSome(current.announcedRow) || snapshot.remote.number === undefined) return poll;
  const capsule = YeetPrMergeReadyCapsule.make({
    headSha: current.timeline.headSha,
    prNumber: snapshot.remote.number,
    url: snapshot.remote.url ?? null,
    readyAt: O.getOrThrow(current.timeline.readyAt),
    pushedAt: O.getOrNull(current.timeline.pushedAt),
    settledAt: O.getOrNull(current.timeline.settledAt),
    closeoutAt: O.getOrNull(current.timeline.closeoutAt),
    pushToReadyMs: O.getOrNull(yeetPushToReadyMillis(current.timeline)),
  });
  const id = yield* yeetPrMergeReadyRowId(capsule);
  yield* appendYeetInboxRowOnce(
    context.repoRoot,
    YeetPrMergeReadyRow.make({
      capsule,
      checkout: context.repoRoot,
      id,
      severity: "P1",
      ts: at,
    })
  );
  yield* Console.log(`${renderMergeReadyGate(snapshot)}; ${renderYeetHeadTimeline(current.timeline)}`);
  yield* reportMonitorPushToAck(context, current.timeline, snapshot);
  const terminals = yeetMonitorPolicyTerminals(options.policy ?? YeetUntilMergedPolicy.make({}));
  if (!HashSet.has(terminals, "ready")) {
    yield* Console.log(`[yeet] merge-ready announced for head ${Str.slice(0, 7)(current.timeline.headSha)}`);
  }
  return MonitorPoll.make({ ...poll, head: O.some(MonitorHeadState.make({ ...current, announcedRow: O.some(id) })) });
});

const monitorReadyTerminal = (observation: MonitorObservation, policy: YeetMonitorLoopPolicy) =>
  O.filter(
    O.some(YeetMonitorTerminalState.Enum.ready),
    () =>
      HashSet.has(yeetMonitorPolicyTerminals(policy), "ready") &&
      O.isSome(observation.snapshot.remote.headSha) &&
      O.exists(
        O.flatMap(observation.poll.head, (head) => head.verdict),
        (verdict) => O.isNone(verdict.reason)
      ) &&
      O.exists(observation.snapshot.mergeReady, (ready) => ready.ready)
  );

// One head's red set as triage sees it: each failing check's name, job link and
// completion stamp. A rerun, a new red, or a re-reported result changes it. The
// wave record keys the same entries for the failing required checks only.
const monitorRedSetKey = (snapshot: YeetStatusSnapshot): string =>
  yeetRedSetKey(A.filter(snapshot.remote.checks, (check) => check.outcome === "fail"));

// Every red job is a needs-code-fix or a spent rerun: re-reading the same red
// set cannot decide anything new. Pending logs, active runs and a rerun just
// issued are not conclusive, so those keep being re-read.
const monitorTriageConclusive = (decisions: ReadonlyArray<YeetMonitorJobDecision>): boolean =>
  A.isReadonlyArrayNonEmpty(decisions) &&
  A.every(decisions, (decision) => decision.status === "needs-code-fix" || decision.status === "rerun-spent");

const triageMonitorReds = Effect.fn("YeetMonitorLoop.triageReds")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions,
  observation: MonitorObservation
) {
  const { snapshot, poll } = observation;
  const { budget, head, replayed } = poll;
  const headSha = snapshot.remote.headSha;
  const policy = options.policy ?? YeetUntilMergedPolicy.make({});
  const readyTerminal = monitorReadyTerminal(observation, policy);
  const verdict = O.flatMap(head, (value) => value.verdict);
  if ((snapshot.remote.failingCheckCount ?? 0) === 0 || O.isNone(headSha)) {
    return MonitorPoll.make({ budget, head, terminal: readyTerminal, replayed });
  }
  // A red no longer ends the loop (pr-event-awareness D16), so the same red can
  // sit through many polls: once a triage of this red set was conclusive, skip
  // the run, job and failed-log reads until a rerun, a new red or a push moves it.
  const redSet = monitorRedSetKey(snapshot);
  if (O.exists(head, (value) => O.contains(value.triagedReds, redSet))) {
    return MonitorPoll.make({ budget, head, terminal: readyTerminal, replayed });
  }
  const failedJobs = yield* collectYeetMonitorFailedJobs(context, headSha.value);
  const plan = planYeetMonitorReruns(budget, headSha.value, failedJobs);
  yield* Effect.forEach(plan.decisions, (decision) => applyYeetMonitorJobDecision(context, decision), {
    concurrency: 1,
  });
  const requiredReds = A.filter(
    plan.decisions,
    (decision) =>
      (decision.status === "needs-code-fix" || decision.status === "rerun-spent") &&
      requiredName(snapshot, verdict, decision.name)
  );
  // A required red is not terminal (pr-event-awareness D16): under until-ready
  // the converged rows are the wave. A detached loop keeps polling for the fix
  // push; an attached one may stop on this poll with `wave`, so its line makes
  // no polling promise and the wave line that follows says it stopped.
  if (yeetMonitorPolicyConverges(policy) && A.isReadonlyArrayNonEmpty(requiredReds)) {
    yield* Console.log(
      `[yeet] required-red: ${A.join(
        A.map(requiredReds, (job) => job.name),
        ", "
      )}; not terminal under --until-ready: the wave is in the inbox${YeetMonitorAttachment.$match(
        options.attachment ?? YeetMonitorAttachment.Enum.detached,
        {
          attached: () => Str.empty,
          detached: () => " and the loop keeps polling for the fix push",
        }
      )}`
    );
  }
  const triaged = monitorTriageConclusive(plan.decisions)
    ? O.map(head, (value) => MonitorHeadState.make({ ...value, triagedReds: O.some(redSet) }))
    : head;
  return MonitorPoll.make({ budget: plan.budget, head: triaged, terminal: readyTerminal, replayed });
});

// An attached until-ready loop has no job for `yeet job wait` to return on, so
// it hands the wave back itself: the first poll whose inbox holds a wake-set
// row on this pull request that was not there when the loop started, or whose
// required red set names a red beyond the one the head was pinned with, ends
// the loop with `wave` (exit 2). The row selection is the job wait's, with the
// ids the inbox held at loop start in place of the ids a wait returned. The
// rows stay unacknowledged. Readiness and the pull-request terminals win.
const returnOnMonitorWave = Effect.fn("YeetMonitorLoop.returnOnWave")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions,
  snapshot: YeetStatusSnapshot,
  poll: MonitorPoll,
  scope: MonitorLoopScope
) {
  const prNumber = O.fromUndefinedOr(snapshot.remote.number);
  if (O.isSome(poll.terminal) || O.isNone(scope.waveBaseline) || O.isNone(prNumber)) return poll;
  const wave = yield* loadYeetPrWave(
    context.repoRoot,
    prNumber.value,
    scope.waveBaseline.value,
    O.flatMap(poll.head, (head) => head.waveRedSet)
  );
  if (O.isNone(wave)) return poll;
  yield* Console.log(
    renderYeetPrWaveLine(
      wave.value,
      YeetPrWaveReturn.Enum["attached-monitor"],
      options.waveRerunCommand ?? defaultWaveRerunCommand
    )
  );
  return MonitorPoll.make({ ...poll, terminal: O.some(YeetMonitorTerminalState.Enum.wave) });
});

// Loop-scoped inputs every poll reads: the comment consumer, and, for an
// attached until-ready loop only, the row ids the inbox held when the loop
// started, which never count as a new wave.
interface MonitorLoopScope {
  readonly comments: MonitorCommentConsumer;
  readonly waveBaseline: O.Option<HashSet.HashSet<string>>;
}

const pollUntilMerged = Effect.fn("YeetMonitorLoop.poll")(function* (
  context: RepoRunContext,
  options: YeetMonitorUntilMergedOptions,
  budget: YeetMonitorRerunBudget,
  previous: O.Option<MonitorHeadState>,
  firstCycle: boolean,
  scope: MonitorLoopScope
) {
  const collected = yield* (options.collectStatus ?? collectYeetStatus)(context, true).pipe(Effect.result);
  if (Result.isFailure(collected)) {
    return MonitorPoll.make({ budget, head: previous, failure: O.some(collected.failure) });
  }
  // The first poll is the first time this session knows the pull request
  // number, and the last moment before it starts reporting state the operator
  // will act on, so under until-merged the comments they missed are printed
  // here. Under until-ready the comment consumer turns them into inbox rows on
  // every poll instead (convergeMonitorInbox), so there is nothing to replay.
  let replayed = false;
  if (firstCycle && collected.success.remote.number !== undefined) {
    if (!yeetMonitorPolicyConverges(options.policy ?? YeetUntilMergedPolicy.make({}))) {
      yield* (options.replayComments ?? replayYeetMonitorComments)(
        context,
        collected.success.remote.number,
        YeetMonitorCommentConsumer.Enum["until-merged"]
      );
    }
    replayed = true;
  }
  const now = yield* options.now ?? DateTime.now;
  const observed = yield* observeMonitorHead(
    context,
    options,
    MonitorObservation.make({
      snapshot: collected.success,
      poll: MonitorPoll.make({ budget, head: previous, replayed }),
      at: DateTime.formatIso(now),
      millis: DateTime.toEpochMillis(now),
    })
  );
  const converged = yield* convergeMonitorInbox(context, options, observed, scope.comments);
  const settled = yield* settleAndCloseoutMonitorHead(context, options, converged);
  if (Result.isFailure(settled)) return settled.failure;
  const observation = settled.success;
  const detail = yield* reportMonitorObservation(observation);
  const terminal = yield* decideMonitorTerminal(context, options, observation, detail);
  if (O.isSome(terminal)) return terminal.value;
  const poll = yield* announceMonitorReadiness(context, options, observation);
  const triaged = yield* triageMonitorReds(context, options, MonitorObservation.make({ ...observation, poll }));
  return yield* returnOnMonitorWave(context, options, observation.snapshot, triaged, scope);
});

const stepMonitorFailureBudget = Effect.fn("YeetMonitorLoop.stepFailureBudget")(function* (
  next: MonitorPoll,
  failures: number
) {
  if (O.isNone(next.failure)) return 0;
  const count = failures + 1;
  yield* Console.error(
    `[yeet] poll failed (${count}/${YEET_MONITOR_POLL_ERROR_BUDGET}): ${next.failure.value.message}`
  );
  return count;
});

// Only the registration budget shortens a sleep: a registered check that is
// queued past the budget (ruling 49) keeps the normal interval, never a 0 ms spin.
const nextMonitorSleep = (next: MonitorPoll, interval: Duration.Duration): Duration.Duration => {
  if (O.isSome(next.failure)) return interval;
  // A held head has no budget to race: it sleeps the full interval and
  // re-reads the labels, since only the label can move it.
  const remaining = O.flatMap(next.head, (value) => value.verdict).pipe(
    O.filter((verdict) => !verdict.settled && verdict.budgetApplies),
    O.map((verdict) => Duration.millis(Math.max(0, verdict.timeoutMs - verdict.waitedMs)))
  );
  return O.match(remaining, { onNone: () => interval, onSome: Duration.min(interval) });
};

/**
 * Follow a pull request until its selected readiness or merge policy terminates.
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
 * scope for the next red wave. Settled heads receive a read-first closeout and
 * one durable readiness row. The policy selects whether readiness ends the
 * session; both policies bound unsettled waits and consecutive read errors.
 * Under `until-ready` the loop is also the inbox producer: every poll converges
 * the status snapshot into `check-failed`, `review-thread` and `base-drift`
 * rows, a base conflict writes one P0 `base-conflict` row per conflict on a
 * head (acked `cleared` by the loop if the same head turns mergeable again; a
 * conflict that returns on that head is the next generation's row), the first
 * poll of each head pins the wave record to it, every poll stamps the head's
 * required red set on the record, and a required red or a base conflict keeps
 * the loop polling instead of ending it. Inside a detached job that first poll
 * then binds the pull request to the job record, and `yeet job wait` hands the
 * wave back. An attached run (`attachment`) has no job, so it ends with `wave`
 * on the first new wake-set row on its pull request, or on a required red set
 * that names a red beyond the one the head was pinned with (a rerun that came
 * back red), printing the gate line with `waveRerunCommand`. Each poll also turns
 * new top-level comments from people other than the acting login, created
 * after `commentsSince` (the monitor job's submit time, or the loop's start),
 * into P1 `pr-comment` rows from the mode's own comment watermark, where
 * `until-merged` instead replays its first-cycle backlog to the log. Only an
 * already merged PR runs the supplied sweep.
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
 * @param options - Loop policy, injectable read boundaries, sweep seam, and poll interval.
 * @returns The terminal state that ended the loop.
 * @category streams
 * @since 0.0.0
 */
export const runYeetMonitorUntilMerged: {
  (
    options: YeetMonitorUntilMergedOptions
  ): (
    context: RepoRunContext
  ) => Effect.Effect<
    YeetMonitorTerminalState,
    YeetCommandError,
    Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >;
  (
    context: RepoRunContext,
    options: YeetMonitorUntilMergedOptions
  ): Effect.Effect<
    YeetMonitorTerminalState,
    YeetCommandError,
    Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >;
} = dual(
  2,
  Effect.fn("Yeet.runMonitorUntilMerged")(function* (
    context: RepoRunContext,
    options: YeetMonitorUntilMergedOptions
  ): Effect.fn.Return<
    YeetMonitorTerminalState,
    YeetCommandError,
    Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > {
    const interval = O.getOrElse(O.fromNullishOr(options.pollInterval), () => mergeLoopPollInterval);
    let budget = emptyYeetMonitorRerunBudget;
    let head = O.none<MonitorHeadState>();
    let failures = 0;
    let firstCycle = true;
    const terminals = yeetMonitorLoopTerminals(
      options.policy ?? YeetUntilMergedPolicy.make({}),
      options.attachment ?? YeetMonitorAttachment.Enum.detached
    );
    // Wall-clock loop start, not `options.now`, so the window never spends a
    // tick of an injected poll clock.
    const scope: MonitorLoopScope = {
      comments: {
        since: options.commentsSince ?? DateTime.formatIso(yield* DateTime.now),
        actingLogin: yield* Ref.make(O.none<string>()),
      },
      // Read before the first poll converges anything, so every row this loop
      // writes, and every row another writer adds meanwhile, counts as new.
      waveBaseline: HashSet.has(terminals, YeetMonitorTerminalState.Enum.wave)
        ? O.some(yield* loadYeetInboxRowIds(context.repoRoot))
        : O.none(),
    };
    while (true) {
      const next: MonitorPoll = yield* pollUntilMerged(context, options, budget, head, firstCycle, scope);
      firstCycle = firstCycle && !next.replayed;
      budget = next.budget;
      head = next.head;
      failures = yield* stepMonitorFailureBudget(next, failures);
      if (failures === YEET_MONITOR_POLL_ERROR_BUDGET) return "poll-error-budget";
      if (failures === 0 && O.isSome(next.terminal)) return next.terminal.value;
      yield* Effect.sleep(nextMonitorSleep(next, interval));
    }
  })
);
