/**
 * Fail-closed classifier and retirement workflow for registered worktrees.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import { GitObjectId } from "@beep/schema/Conformance";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as N from "effect/Number";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { runRepoCommandCapture, scanProcessAttachments } from "../../internal/repo-run/index.ts";
import { classifyFleetLiveness } from "./Fleet.service.ts";
import { WorktreeReapCandidate, WorktreeReapClass, WorktreeReapReport } from "./Reap.schemas.ts";
import { WorktreeCommandError } from "./Worktree.errors.ts";
import { FleetLivenessReadings, WorktreeRemovalRequest } from "./Worktree.schemas.ts";
import { branchPullRequests, listRepositoryWorktrees, WorktreeRemovalService } from "./Worktree.service.ts";
import type { GitShape } from "@beep/git/Git";
import type { DomainError } from "@beep/repo-utils";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { WorktreeReapSkipReason } from "./Reap.schemas.ts";
import type { FleetLivenessVerdict, FleetProbeReading, WorktreeListEntry } from "./Worktree.schemas.ts";

const isFinite = S.is(S.Finite);

const $I = $RepoCliId.create("commands/Worktree/Reap.service");

type ProbeCapture = {
  readonly exitCode: number;
  readonly output: string;
  readonly truncated: boolean;
};

type ReapCommandRunner = (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
) => Effect.Effect<ProbeCapture, DomainError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner>;

type ReapPullRequestState = "merged" | "open";

type ReapPullRequestLister = (
  cwd: string,
  branch: string,
  state: ReapPullRequestState
) => Effect.Effect<O.Option<ReadonlyArray<GhPr>>, never, ChildProcessSpawner.ChildProcessSpawner>;

type ReapLivenessRequest = {
  readonly targetPath: string;
  readonly idleHours: O.Option<number>;
};

type ReapLivenessProber = (
  request: ReapLivenessRequest
) => Effect.Effect<FleetLivenessVerdict, never, FileSystem.FileSystem>;

type WorktreeReapRunOptions = {
  readonly apply?: boolean;
  readonly idleHours?: number;
  readonly nowMillis?: number;
  readonly probeLiveness?: ReapLivenessProber;
  readonly listPullRequests?: ReapPullRequestLister;
  readonly runCommand?: ReapCommandRunner;
  readonly startFrom?: string;
};

type AssessContext = {
  readonly fs: FileSystem.FileSystem;
  readonly git: GitShape;
  readonly idleThreshold: Duration.Duration;
  readonly nowMillis: number;
  readonly path: Path.Path;
  readonly prober: ReapLivenessProber;
  readonly pullRequests: ReapPullRequestLister;
  readonly runner: ReapCommandRunner;
};

type PrClassification = {
  readonly reapClass: WorktreeReapClass;
  readonly prNumber: O.Option<number>;
  readonly failed: boolean;
  readonly reusedBranch: boolean;
  readonly mergedHead: O.Option<GitObjectId>;
};

type IdleReading = {
  readonly hours: O.Option<number>;
  readonly failed: boolean;
};

type ProbeSkip = {
  readonly reason: WorktreeReapSkipReason;
  readonly warning: string;
};

type EvidenceProbe =
  | { readonly _tag: "skipped"; readonly skip: ProbeSkip; readonly pr: O.Option<PrClassification> }
  | {
      readonly _tag: "probed";
      readonly pr: PrClassification;
      readonly dirty: boolean;
      readonly idleHours: O.Option<number>;
    };

type CandidateAssessment = {
  readonly candidate: WorktreeReapCandidate;
  readonly warnings: ReadonlyArray<string>;
  readonly authorizedHead: O.Option<GitObjectId>;
};

/**
 * The pull-request fields reap reads: the number and the head sha GitHub recorded.
 *
 * **Example** (Describe a merged pull request at a head)
 *
 * ```ts
 * import { WorktreeReapPullRequest } from "@beep/repo-cli/commands/Worktree"
 * import { GitObjectId } from "@beep/schema/Conformance"
 *
 * const row = WorktreeReapPullRequest.make({
 *   number: 101,
 *   headRefOid: GitObjectId.make("1ed08f66df016a18c6d7d56bd97aa778912cb37b"),
 * })
 * console.log(row.number) // 101
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeReapPullRequest extends S.Opaque<WorktreeReapPullRequest, { readonly brand: unique symbol }>()(
  S.Struct({ number: S.Int, headRefOid: GitObjectId }).pipe(
    $I.annoteSchema("WorktreeReapPullRequest", {
      description: "The pull-request number and recorded head sha a worktree reap classification reads.",
    })
  )
) {}

type GhPr = WorktreeReapPullRequest;

const decodeGhPr = S.decodeUnknownEffect(WorktreeReapPullRequest);

// `gh pr list --state <s> --limit 1` read the newest row only; GitHub lists newest first and
// has no `merged` state, so merged rows are the closed ones that merged.
const githubPullRequests: ReapPullRequestLister = Effect.fnUntraced(function* (cwd, branch, state) {
  const listed = yield* branchPullRequests(cwd, branch, state === "open" ? "open" : "closed");
  return yield* O.match(listed, {
    onNone: () => Effect.succeedNone,
    onSome: (rows) =>
      Effect.forEach(
        A.take(
          A.filter(rows, (row) => state === "open" || row.merged),
          1
        ),
        (row) => decodeGhPr({ number: row.number, headRefOid: row.headSha })
      ).pipe(Effect.option),
  });
});

const successfulOutput = Effect.fn("WorktreeReap.successfulOutput")(function* (
  runner: ReapCommandRunner,
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
): Effect.fn.Return<O.Option<string>, never, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runner(command, args, cwd).pipe(Effect.option);
  return O.flatMap(result, (capture) =>
    capture.exitCode === 0 && !capture.truncated ? O.some(capture.output) : O.none()
  );
});

const classifyPr = Effect.fn("WorktreeReap.classifyPr")(function* (
  ctx: AssessContext,
  cwd: string,
  branch: string
): Effect.fn.Return<PrClassification, never, ChildProcessSpawner.ChildProcessSpawner> {
  // Open must win over merged: a revived branch can carry an old merged PR AND a live
  // open PR, and retiring it would delete in-flight work along with its branch.
  const open = yield* ctx.pullRequests(cwd, branch, "open");
  if (O.isNone(open)) {
    return { reapClass: "unknown", prNumber: O.none(), failed: true, reusedBranch: false, mergedHead: O.none() };
  }
  const openPr = A.head(open.value);
  if (O.isSome(openPr)) {
    return {
      reapClass: "open-pr",
      prNumber: O.some(openPr.value.number),
      failed: false,
      reusedBranch: false,
      mergedHead: O.none(),
    };
  }
  const merged = yield* ctx.pullRequests(cwd, branch, "merged");
  if (O.isNone(merged)) {
    return { reapClass: "unknown", prNumber: O.none(), failed: true, reusedBranch: false, mergedHead: O.none() };
  }
  const mergedPr = A.head(merged.value);
  if (O.isNone(mergedPr)) {
    return { reapClass: "no-pr", prNumber: O.none(), failed: false, reusedBranch: false, mergedHead: O.none() };
  }
  // A historical merge only authorizes retirement of the exact snapshot it merged: a
  // branch reused or advanced after that PR merged carries commits the PR never
  // reviewed. HEAD is probed live here — not taken from the scan-time listing — so the
  // pre-apply recheck re-ties authority to the checkout as it exists at removal time;
  // the residual instant after this probe is fenced inside the removal service, which
  // atomically renames the checkout aside before capturing its archive and deletes
  // the branch ref with an atomic compare-and-swap on the authorized object id.
  const head = yield* ctx.git.revParse(cwd, "HEAD").pipe(Effect.option);
  return {
    reapClass: "merged-pr",
    prNumber: O.some(mergedPr.value.number),
    failed: false,
    reusedBranch: !O.exists(head, (sha) => Str.Equivalence(Str.trim(sha), mergedPr.value.headRefOid)),
    mergedHead: O.some(mergedPr.value.headRefOid),
  };
});

const readIdleHours = Effect.fn("WorktreeReap.readIdleHours")(function* (
  git: GitShape,
  fs: FileSystem.FileSystem,
  path: Path.Path,
  entry: WorktreeListEntry,
  nowMillis: number
): Effect.fn.Return<IdleReading, never, never> {
  const commits = yield* git.log(entry.path, { limit: 1, omitPaths: true }).pipe(Effect.option);
  const headPathOutput = yield* git.gitDir(entry.path, { path: "HEAD" }).pipe(Effect.option);
  if (O.isNone(commits) || O.isNone(headPathOutput)) {
    return { hours: O.none(), failed: true };
  }
  const commitMillis = O.map(A.head(commits.value), (commit) => DateTime.toEpochMillis(commit.committedAt));
  const headPath = Str.trim(headPathOutput.value);
  if (O.isNone(commitMillis) || Str.isEmpty(headPath)) {
    return { hours: O.none(), failed: true };
  }
  const headInfo = yield* fs.stat(path.resolve(headPath)).pipe(Effect.option);
  const headMtime = pipe(
    headInfo,
    O.flatMap((info) => info.mtime),
    O.map(DateTime.fromDateUnsafe),
    O.map(DateTime.toEpochMillis)
  );
  if (O.isNone(headMtime)) {
    return { hours: O.none(), failed: true };
  }
  const newestMillis = N.max(commitMillis.value, headMtime.value);
  const age = Duration.millis(N.max(0, nowMillis - newestMillis));
  return { hours: O.some(age.pipe(Duration.toHours)), failed: false };
});

const measureBytes = Effect.fn("WorktreeReap.measureBytes")(function* (
  runner: ReapCommandRunner,
  entry: WorktreeListEntry
): Effect.fn.Return<O.Option<number>, never, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* successfulOutput(runner, "du", ["-sb", "--", entry.path], entry.path);
  return pipe(
    output,
    O.flatMap((value) => A.head(Str.split(Str.trim(value), /\s+/u))),
    O.flatMap(N.parse)
  );
});

// The cheap cwd-only form of the shared scan: it runs once per candidate, and the
// removal service repeats the thorough cwd+descriptor form inside its fence.
const scanProcessCwdMatches = (targetPath: string): Effect.Effect<O.Option<number>, never, FileSystem.FileSystem> =>
  scanProcessAttachments({ directory: targetPath, kinds: ["cwd"] }).pipe(Effect.map(O.map(A.length)));

/**
 * Classify one directory's liveness from a same-uid process-cwd scan plus its idle age.
 *
 * **Details**
 *
 * Unreadable `/proc` entries are dropped rather than failing the scan: every
 * host permanently carries pids whose cwd is unreadable by construction —
 * foreign uids and this user's own ptrace-protected processes (systemd
 * --user, gpg-agent, every 1Password op) — so a fail-closed rule for them
 * would make retirement unreachable on every pass. The comparison target is
 * resolved through realPath because the kernel fully resolves cwd links.
 * Only a failure to list `/proc` or resolve the target withholds the
 * evidence. Verdicts follow `classifyFleetLiveness`: any positive evidence
 * is live, complete negatives are dormant, anything else is unknown.
 *
 * **Example** (Probe the invoking process's own directory)
 *
 * ```ts
 * import { probeWorktreeLiveness } from "@beep/repo-cli/commands/Worktree"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(probeWorktreeLiveness({ targetPath: process.cwd(), idleHours: O.some(400) }))) // true
 * ```
 *
 * @param request - Target directory and its already-measured idle age.
 * @returns The classified liveness verdict for the directory.
 * @category utilities
 * @since 0.0.0
 */
export const probeWorktreeLiveness: ReapLivenessProber = Effect.fnUntraced(function* (
  request: ReapLivenessRequest
): Effect.fn.Return<FleetLivenessVerdict, never, FileSystem.FileSystem> {
  const matches = yield* scanProcessCwdMatches(request.targetPath);
  return classifyFleetLiveness(
    FleetLivenessReadings.make({
      processMatches: O.getOrElse(matches, () => 0),
      processScanComplete: O.isSome(matches),
      sessionMatches: 0,
      transcript: { _tag: "absent" },
      worktreeMtime: O.match(request.idleHours, {
        onNone: (): FleetProbeReading => ({ _tag: "failed" }),
        onSome: (hours): FleetProbeReading => ({ _tag: "measured", ageSeconds: hours * 3_600 }),
      }),
    })
  );
});

const livenessSkipReason = (verdict: FleetLivenessVerdict): O.Option<WorktreeReapSkipReason> =>
  Match.value(verdict.status).pipe(
    Match.when("dormant", O.none<WorktreeReapSkipReason>),
    Match.when("live", () => O.some<WorktreeReapSkipReason>("live-session")),
    Match.orElse(() => O.some<WorktreeReapSkipReason>("liveness-unknown"))
  );

const classSkipReason = (reapClass: WorktreeReapClass): O.Option<WorktreeReapSkipReason> =>
  WorktreeReapClass.match(reapClass, {
    "merged-pr": O.none<WorktreeReapSkipReason>,
    "open-pr": () => O.some<WorktreeReapSkipReason>("open-pr"),
    "no-pr": () => O.some<WorktreeReapSkipReason>("no-pr"),
    unknown: () => O.some<WorktreeReapSkipReason>("gh-probe-failed"),
  });

const probeDirectory = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  targetPath: string
): Effect.fn.Return<O.Option<ProbeSkip>, never, never> {
  const status = yield* Effect.result(fs.stat(targetPath));
  if (Result.isFailure(status)) {
    const reason: WorktreeReapSkipReason = Match.value(status.failure.reason._tag).pipe(
      Match.when("NotFound", () => "missing-directory" as const),
      Match.orElse(() => "filesystem-probe-failed" as const)
    );
    return O.some({ reason, warning: `${reason}: could not inspect ${targetPath}.` });
  }
  return status.success.type === "Directory"
    ? O.none()
    : O.some({ reason: "missing-directory" as const, warning: `missing-directory: ${targetPath} is not a directory.` });
});

const probeEvidence = Effect.fnUntraced(function* (
  ctx: AssessContext,
  entry: WorktreeListEntry,
  branch: string
): Effect.fn.Return<EvidenceProbe, never, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const pr = yield* classifyPr(ctx, entry.path, branch);
  if (pr.failed) {
    return {
      _tag: "skipped",
      skip: {
        reason: "gh-probe-failed",
        warning: `gh-probe-failed: could not classify pull requests for ${branch} at ${entry.path}.`,
      },
      pr: O.none(),
    };
  }
  const status = yield* ctx.git
    .status(entry.path, { untrackedFiles: "all", ignoreSubmodules: "none" })
    .pipe(Effect.option);
  if (O.isNone(status)) {
    return {
      _tag: "skipped",
      skip: {
        reason: "git-probe-failed",
        warning: `git-probe-failed: could not inspect worktree status at ${entry.path}.`,
      },
      pr: O.some(pr),
    };
  }
  const idle = yield* readIdleHours(ctx.git, ctx.fs, ctx.path, entry, ctx.nowMillis);
  if (idle.failed) {
    return {
      _tag: "skipped",
      skip: {
        reason: "idle-probe-failed",
        warning: `idle-probe-failed: could not establish commit and HEAD-file activity for ${entry.path}.`,
      },
      pr: O.some(pr),
    };
  }
  return { _tag: "probed", pr, dirty: A.isReadonlyArrayNonEmpty(status.value), idleHours: idle.hours };
});

const eligibilitySkipReason = (
  evidence: Extract<EvidenceProbe, { _tag: "probed" }>,
  idleThreshold: Duration.Duration
): O.Option<WorktreeReapSkipReason> =>
  O.firstSomeOf([
    evidence.dirty ? O.some<WorktreeReapSkipReason>("dirty-tree") : O.none(),
    classSkipReason(evidence.pr.reapClass),
    evidence.pr.reusedBranch ? O.some<WorktreeReapSkipReason>("reused-branch") : O.none(),
    O.exists(evidence.idleHours, (hours) => hours < Duration.toHours(idleThreshold))
      ? O.some<WorktreeReapSkipReason>("too-young")
      : O.none(),
  ]);

const assessCandidate = Effect.fn("WorktreeReap.assessCandidate")(function* (
  ctx: AssessContext,
  entry: WorktreeListEntry,
  includeBytes: boolean
): Effect.fn.Return<
  CandidateAssessment,
  never,
  FileSystem.FileSystem | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  const branch = O.fromNullishOr(entry.branch);
  const base = {
    path: entry.path,
    branch,
    reapClass: "unknown" as const,
    prNumber: O.none<number>(),
    idleHours: O.none<number>(),
    bytes: O.none<number>(),
    retired: false,
  };
  if (entry.locked) {
    return {
      candidate: WorktreeReapCandidate.make({ ...base, skipReason: O.some("locked") }),
      warnings: A.empty(),
      authorizedHead: O.none(),
    };
  }
  if (O.isNone(branch)) {
    return {
      candidate: WorktreeReapCandidate.make({ ...base, skipReason: O.some("detached-head") }),
      warnings: A.empty(),
      authorizedHead: O.none(),
    };
  }
  const directorySkip = yield* probeDirectory(ctx.fs, entry.path);
  if (O.isSome(directorySkip)) {
    return {
      candidate: WorktreeReapCandidate.make({ ...base, skipReason: O.some(directorySkip.value.reason) }),
      warnings: [directorySkip.value.warning],
      authorizedHead: O.none(),
    };
  }
  const evidence = yield* probeEvidence(ctx, entry, branch.value);
  if (evidence._tag === "skipped") {
    const prFields = pipe(
      evidence.pr,
      O.map((pr) => ({ reapClass: pr.reapClass, prNumber: pr.prNumber })),
      O.getOrElse(() => ({}))
    );
    return {
      candidate: WorktreeReapCandidate.make({ ...base, ...prFields, skipReason: O.some(evidence.skip.reason) }),
      warnings: [evidence.skip.warning],
      authorizedHead: O.none(),
    };
  }
  const enriched = {
    ...base,
    reapClass: evidence.pr.reapClass,
    prNumber: evidence.pr.prNumber,
    idleHours: evidence.idleHours,
  };
  const skipReason = eligibilitySkipReason(evidence, ctx.idleThreshold);
  if (O.isSome(skipReason)) {
    return {
      candidate: WorktreeReapCandidate.make({ ...enriched, skipReason }),
      warnings: A.empty(),
      authorizedHead: O.none(),
    };
  }
  const prober1 = yield* ctx.prober({ targetPath: entry.path, idleHours: evidence.idleHours });
  const liveness = livenessSkipReason(prober1);
  if (O.isSome(liveness)) {
    return {
      candidate: WorktreeReapCandidate.make({ ...enriched, skipReason: liveness }),
      warnings: A.empty(),
      authorizedHead: O.none(),
    };
  }
  if (!includeBytes) {
    return {
      candidate: WorktreeReapCandidate.make({ ...enriched, skipReason: O.none() }),
      warnings: A.empty(),
      authorizedHead: evidence.pr.mergedHead,
    };
  }
  // Size is reporting-only evidence: a failed measurement must never block retirement.
  const bytes = yield* measureBytes(ctx.runner, entry);
  return O.match(bytes, {
    onNone: (): CandidateAssessment => ({
      candidate: WorktreeReapCandidate.make({ ...enriched, skipReason: O.none() }),
      warnings: [`size-probe-failed: could not measure eligible worktree ${entry.path}; retirement is unaffected.`],
      authorizedHead: evidence.pr.mergedHead,
    }),
    onSome: (measuredBytes): CandidateAssessment => ({
      candidate: WorktreeReapCandidate.make({ ...enriched, bytes: O.some(measuredBytes), skipReason: O.none() }),
      warnings: A.empty(),
      authorizedHead: evidence.pr.mergedHead,
    }),
  });
});

const retirementOutcome = Effect.fnUntraced(function* (
  ctx: AssessContext,
  entry: WorktreeListEntry,
  assessed: WorktreeReapCandidate,
  failure: { readonly message: string }
): Effect.fn.Return<CandidateAssessment, never, never> {
  const pipe2 = yield* ctx.fs.exists(entry.path).pipe(Effect.option);
  const present = O.getOrElse(pipe2, () => true);
  if (present) {
    return {
      candidate: WorktreeReapCandidate.make({ ...assessed, skipReason: O.some("retirement-failed") }),
      warnings: [`retirement-failed: ${entry.path}: ${failure.message}`],
      authorizedHead: O.none(),
    };
  }
  // The checkout is already gone: report the retirement so callers do not retry a
  // removal Git can no longer perform, and surface the failed cleanup loudly.
  return {
    candidate: WorktreeReapCandidate.make({ ...assessed, retired: true }),
    warnings: [`retirement-cleanup-failed: ${entry.path} was removed but follow-up cleanup failed: ${failure.message}`],
    authorizedHead: O.none(),
  };
});

const assessmentWarnings = (assessments: ReadonlyArray<CandidateAssessment>): ReadonlyArray<string> =>
  A.flatten(A.map(assessments, (assessment) => assessment.warnings));

const summarizeOutcomes = (
  apply: boolean,
  assessed: ReadonlyArray<CandidateAssessment>,
  outcomes: ReadonlyArray<CandidateAssessment>
): Pick<WorktreeReapReport, "candidates" | "reclaimableBytes" | "reclaimedBytes" | "retiredCount" | "warnings"> => {
  const rows = A.map(outcomes, (assessment) => assessment.candidate);
  const retired = A.filter(rows, (candidate) => candidate.retired);
  const measured = (candidates: ReadonlyArray<WorktreeReapCandidate>): number =>
    A.reduce(candidates, 0, (total, candidate) => total + O.getOrElse(candidate.bytes, () => 0));
  return {
    candidates: rows,
    reclaimableBytes: measured(A.map(assessed, (assessment) => assessment.candidate)),
    reclaimedBytes: measured(retired),
    retiredCount: A.length(retired),
    warnings: apply
      ? A.appendAll(assessmentWarnings(assessed), assessmentWarnings(outcomes))
      : assessmentWarnings(outcomes),
  };
};

const applyCandidate = Effect.fn("WorktreeReap.applyCandidate")(function* (
  ctx: AssessContext,
  removalService: typeof WorktreeRemovalService.Service,
  mainCheckout: string,
  entry: WorktreeListEntry,
  assessed: WorktreeReapCandidate
): Effect.fn.Return<
  CandidateAssessment,
  never,
  FileSystem.FileSystem | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  if (O.isSome(assessed.skipReason)) {
    return { candidate: assessed, warnings: A.empty(), authorizedHead: O.none() };
  }
  const rechecked = yield* assessCandidate(ctx, entry, false);
  if (O.isSome(rechecked.candidate.skipReason)) {
    // Report the rechecked classification, not the stale pre-apply one, so the row's
    // class and skip reason always describe the same observation; measured bytes stay.
    return {
      candidate: WorktreeReapCandidate.make({ ...rechecked.candidate, bytes: assessed.bytes }),
      warnings: A.append(rechecked.warnings, `eligibility changed before retirement: ${entry.path}.`),
      authorizedHead: O.none(),
    };
  }
  const authorized = rechecked.authorizedHead;
  if (O.isNone(authorized)) {
    return {
      candidate: WorktreeReapCandidate.make({ ...assessed, skipReason: O.some("retirement-failed") }),
      warnings: [`retirement-failed: ${entry.path}: eligible candidate carried no authorized HEAD.`],
      authorizedHead: O.none(),
    };
  }
  const removal = yield* Effect.result(
    removalService.remove(
      WorktreeRemovalRequest.make({
        name: ctx.path.basename(entry.path),
        targetPath: entry.path,
        mainCheckout,
        branch: O.fromNullishOr(entry.branch),
        archive: true,
        deleteBranch: true,
        // The removal service re-reads HEAD at removal time, refuses outright when it
        // no longer equals this merged-PR-authorized object id, and deletes the branch
        // ref with an atomic compare-and-swap on the same id — a checkout advancing at
        // any point up to the final ref update fails the removal instead of losing work.
        expectedHead: authorized,
      })
    )
  );
  if (Result.isSuccess(removal)) {
    return {
      candidate: WorktreeReapCandidate.make({ ...assessed, retired: true }),
      warnings: A.empty(),
      authorizedHead: authorized,
    };
  }
  return yield* retirementOutcome(ctx, entry, assessed, removal.failure);
});

// The injectable probes, each defaulting to its live implementation.
const reapSeams = (options: WorktreeReapRunOptions): Pick<AssessContext, "prober" | "pullRequests" | "runner"> => ({
  prober: options.probeLiveness ?? probeWorktreeLiveness,
  pullRequests: options.listPullRequests ?? githubPullRequests,
  runner: options.runCommand ?? runRepoCommandCapture,
});

/**
 * Classify registered worktrees and optionally retire fully evidenced merged-PR candidates.
 *
 * **Details**
 *
 * The main checkout, the invoking checkout, and locked worktrees are excluded.
 * Eligibility requires a merged PR whose final head equals the checkout's HEAD
 * as probed live at classification time (a branch reused or advanced after its
 * merge skips as `reused-branch`), no open PR on the branch, a clean tree,
 * idleness beyond the threshold, and a dormant liveness verdict from the
 * same-uid process-cwd probe (`classifyFleetLiveness` semantics; a live or
 * unknown verdict skips the candidate). Byte measurement is reporting-only —
 * a failed `du` leaves the candidate eligible with `bytes` absent. Apply mode
 * revalidates every eligible candidate immediately before calling the shared
 * archive-first removal service with branch deletion enabled and the removal
 * request pinned to the merged PR's authorized head — the service re-reads
 * HEAD at removal time, refuses when the checkout advanced past that
 * authority, and deletes the branch ref via an atomic compare-and-swap on the
 * same object id — and reports a
 * retirement whose checkout was removed but whose follow-up cleanup failed as
 * retired with a loud warning instead of pretending the directory remains.
 *
 * **Example** (Build a dry-run janitor effect)
 *
 * ```ts
 * import { runWorktreeReap } from "@beep/repo-cli/commands/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runWorktreeReap())) // true
 * ```
 *
 * @param options - Optional apply, idle threshold, clock, liveness prober, pull-request lister, size-probe command runner, and repository-root seams.
 * @returns A versioned, auditable worktree-reap report.
 * @category workflows
 * @since 0.0.0
 */
export const runWorktreeReap = Effect.fn("WorktreeReap.runWorktreeReap")(function* (
  options: WorktreeReapRunOptions = {}
): Effect.fn.Return<
  WorktreeReapReport,
  WorktreeCommandError,
  | FileSystem.FileSystem
  | Path.Path
  | SecureRandom.SecureRandom
  | ChildProcessSpawner.ChildProcessSpawner
  | Git
  | WorktreeRemovalService
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const git = yield* Git;
  const removalService = yield* WorktreeRemovalService;
  const { currentRoot, entries } = yield* listRepositoryWorktrees(
    options.startFrom,
    "Failed to list registered git worktrees."
  );
  const mainCheckout = O.getOrElse(
    O.map(A.head(entries), (entry) => entry.path),
    () => currentRoot
  );
  const candidates = A.filter(
    A.drop(entries, 1),
    (entry) => !Str.Equivalence(path.resolve(entry.path), path.resolve(currentRoot))
  );
  const idleThresholdHours = options.idleHours ?? 48;
  if (!isFinite(idleThresholdHours) || idleThresholdHours < 0) {
    return yield* WorktreeCommandError.make({ message: "--idle-hours must be a non-negative finite number." });
  }
  const ctx: AssessContext = {
    fs,
    git,
    idleThreshold: Duration.hours(idleThresholdHours),
    nowMillis: options.nowMillis ?? (yield* Clock.currentTimeMillis),
    path,
    ...reapSeams(options),
  };
  const assessed = yield* Effect.forEach(
    candidates,
    Effect.fn("WorktreeReap.assessRegisteredWorktree")(function* (entry) {
      return yield* assessCandidate(ctx, entry, true);
    }),
    { concurrency: 4 }
  );
  const apply = options.apply ?? false;
  const outcomes = apply
    ? yield* Effect.forEach(
        A.zip(candidates, assessed),
        Effect.fn("WorktreeReap.applyRegisteredWorktree")(function* ([entry, assessment]) {
          return yield* applyCandidate(ctx, removalService, mainCheckout, entry, assessment.candidate);
        }),
        { concurrency: 1 }
      )
    : assessed;
  const now3 = yield* DateTime.now;
  const scannedAt = DateTime.formatIso(now3);
  return WorktreeReapReport.make({
    scannedAt,
    mainCheckout,
    invokingWorktree: currentRoot,
    idleThresholdHours,
    applied: apply,
    ...summarizeOutcomes(apply, assessed, outcomes),
  });
});
