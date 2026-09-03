/**
 * Fail-closed classifier and retirement workflow for registered worktrees.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { NonEmptyTrimmedStr } from "@beep/schema/String";
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
import { runRepoCommandCapture } from "../../internal/repo-run/index.ts";
import { classifyFleetLiveness } from "./Fleet.service.ts";
import { WorktreeReapCandidate, WorktreeReapClass, WorktreeReapReport } from "./Reap.schemas.ts";
import { WorktreeCommandError } from "./Worktree.errors.ts";
import { FleetLivenessReadings, parseWorktreePorcelain, WorktreeRemovalRequest } from "./Worktree.schemas.ts";
import { runWorktreeGitCapture, WorktreeRemovalService } from "./Worktree.service.ts";
import type { DomainError } from "@beep/repo-utils";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { WorktreeReapSkipReason } from "./Reap.schemas.ts";
import type { FleetLivenessVerdict, FleetProbeReading, WorktreeListEntry } from "./Worktree.schemas.ts";

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
) => Effect.Effect<ProbeCapture, DomainError, ChildProcessSpawner.ChildProcessSpawner>;

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
  readonly runCommand?: ReapCommandRunner;
  readonly startFrom?: string;
};

type AssessContext = {
  readonly fs: FileSystem.FileSystem;
  readonly idleThreshold: Duration.Duration;
  readonly nowMillis: number;
  readonly path: Path.Path;
  readonly prober: ReapLivenessProber;
  readonly runner: ReapCommandRunner;
};

type PrClassification = {
  readonly reapClass: WorktreeReapClass;
  readonly prNumber: O.Option<number>;
  readonly failed: boolean;
  readonly reusedBranch: boolean;
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
};

class GhPr extends S.Class<GhPr>($I`GhPr`)(
  { number: S.Int, headRefOid: S.String },
  $I.annote("GhPr", {
    description: "Minimal pull-request row decoded from gh pr list JSON output.",
  })
) {}

const decodeGhPrList = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhPr)));

const successfulOutput = Effect.fn("WorktreeReap.successfulOutput")(function* (
  runner: ReapCommandRunner,
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
): Effect.fn.Return<O.Option<string>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runner(command, args, cwd).pipe(Effect.option);
  return O.flatMap(result, (capture) =>
    capture.exitCode === 0 && !capture.truncated ? O.some(capture.output) : O.none()
  );
});

const ghPrList = Effect.fn("WorktreeReap.ghPrList")(function* (
  runner: ReapCommandRunner,
  cwd: string,
  branch: string,
  state: "merged" | "open"
): Effect.fn.Return<O.Option<ReadonlyArray<GhPr>>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* successfulOutput(
    runner,
    "gh",
    ["pr", "list", "--head", branch, "--state", state, "--json", "number,headRefOid", "--limit", "1"],
    cwd
  );
  if (O.isNone(output)) {
    return O.none();
  }
  return yield* decodeGhPrList(output.value).pipe(Effect.option);
});

const classifyPr = Effect.fn("WorktreeReap.classifyPr")(function* (
  runner: ReapCommandRunner,
  cwd: string,
  branch: string,
  head: O.Option<string>
): Effect.fn.Return<PrClassification, never, ChildProcessSpawner.ChildProcessSpawner> {
  // Open must win over merged: a revived branch can carry an old merged PR AND a live
  // open PR, and retiring it would delete in-flight work along with its branch.
  const open = yield* ghPrList(runner, cwd, branch, "open");
  if (O.isNone(open)) {
    return { reapClass: "unknown", prNumber: O.none(), failed: true, reusedBranch: false };
  }
  const openPr = A.head(open.value);
  if (O.isSome(openPr)) {
    return { reapClass: "open-pr", prNumber: O.some(openPr.value.number), failed: false, reusedBranch: false };
  }
  const merged = yield* ghPrList(runner, cwd, branch, "merged");
  if (O.isNone(merged)) {
    return { reapClass: "unknown", prNumber: O.none(), failed: true, reusedBranch: false };
  }
  const mergedPr = A.head(merged.value);
  return O.match(mergedPr, {
    onNone: (): PrClassification => ({ reapClass: "no-pr", prNumber: O.none(), failed: false, reusedBranch: false }),
    onSome: (pr): PrClassification => ({
      reapClass: "merged-pr",
      prNumber: O.some(pr.number),
      failed: false,
      // A historical merge only authorizes retirement of the exact snapshot it merged:
      // a branch reused or advanced after that PR merged carries commits the PR never
      // reviewed, so its checkout must not inherit the merged PR's retirement authority.
      reusedBranch: !O.exists(head, (sha) => Str.Equivalence(sha, pr.headRefOid)),
    }),
  });
});

const readIdleHours = Effect.fn("WorktreeReap.readIdleHours")(function* (
  runner: ReapCommandRunner,
  fs: FileSystem.FileSystem,
  path: Path.Path,
  entry: WorktreeListEntry,
  nowMillis: number
): Effect.fn.Return<IdleReading, never, ChildProcessSpawner.ChildProcessSpawner> {
  const commitOutput = yield* successfulOutput(runner, "git", ["log", "-1", "--format=%ct", "HEAD"], entry.path);
  const headPathOutput = yield* successfulOutput(
    runner,
    "git",
    ["rev-parse", "--path-format=absolute", "--git-path", "HEAD"],
    entry.path
  );
  if (O.isNone(commitOutput) || O.isNone(headPathOutput)) {
    return { hours: O.none(), failed: true };
  }
  const commitSeconds = N.parse(Str.trim(commitOutput.value));
  const headPath = Str.trim(headPathOutput.value);
  if (O.isNone(commitSeconds) || Str.isEmpty(headPath)) {
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
  const newestMillis = N.max(commitSeconds.value * 1_000, headMtime.value);
  const age = Duration.millis(N.max(0, nowMillis - newestMillis));
  return { hours: O.some(age.pipe(Duration.toHours)), failed: false };
});

const measureBytes = Effect.fn("WorktreeReap.measureBytes")(function* (
  runner: ReapCommandRunner,
  entry: WorktreeListEntry
): Effect.fn.Return<O.Option<number>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* successfulOutput(runner, "du", ["-sb", "--", entry.path], entry.path);
  return pipe(
    output,
    O.flatMap((value) => A.head(Str.split(Str.trim(value), /\s+/u))),
    O.flatMap(N.parse)
  );
});

const PID_DIRECTORY_NAME = /^[0-9]+$/;

const readPidCwd = Effect.fnUntraced(function* (
  pid: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readLink(`/proc/${pid}/cwd`).pipe(Effect.option);
});

const scanProcessCwdMatches = Effect.fnUntraced(function* (
  targetPath: string
): Effect.fn.Return<O.Option<number>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const names = yield* fs.readDirectory("/proc").pipe(Effect.option);
  if (O.isNone(names)) {
    return O.none();
  }
  const pids = A.filter(names.value, (name) => PID_DIRECTORY_NAME.test(name));
  const cwds = A.getSomes(yield* Effect.forEach(pids, readPidCwd));
  return O.some(
    A.length(A.filter(cwds, (cwd) => Str.Equivalence(cwd, targetPath) || Str.startsWith(`${targetPath}/`)(cwd)))
  );
});

/**
 * Classify one directory's liveness from a same-uid process-cwd scan plus its idle age.
 *
 * **Details**
 *
 * Unreadable `/proc` entries (other users' daemons) do NOT mark the scan
 * incomplete, unlike the fleet-status probes — agent processes run as this
 * user, and a reading that goes unknown whenever root owns a process would
 * make retirement unreachable. Only a failure to list `/proc` at all
 * withholds the process evidence. Verdicts follow `classifyFleetLiveness`:
 * any positive evidence is live, complete negatives are dormant, anything
 * else is unknown.
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
    Match.when("dormant", () => O.none<WorktreeReapSkipReason>()),
    Match.when("live", () => O.some<WorktreeReapSkipReason>("live-session")),
    Match.orElse(() => O.some<WorktreeReapSkipReason>("liveness-unknown"))
  );

const classSkipReason = (reapClass: WorktreeReapClass): O.Option<WorktreeReapSkipReason> =>
  WorktreeReapClass.$match(reapClass, {
    "merged-pr": () => O.none<WorktreeReapSkipReason>(),
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
): Effect.fn.Return<EvidenceProbe, never, ChildProcessSpawner.ChildProcessSpawner> {
  const pr = yield* classifyPr(ctx.runner, entry.path, branch, O.fromNullishOr(entry.head));
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
  const status = yield* successfulOutput(
    ctx.runner,
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"],
    entry.path
  );
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
  const idle = yield* readIdleHours(ctx.runner, ctx.fs, ctx.path, entry, ctx.nowMillis);
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
  return { _tag: "probed", pr, dirty: Str.isNonEmpty(Str.trim(status.value)), idleHours: idle.hours };
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
): Effect.fn.Return<CandidateAssessment, never, FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner> {
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
    return { candidate: WorktreeReapCandidate.make({ ...base, skipReason: O.some("locked") }), warnings: A.empty() };
  }
  if (O.isNone(branch)) {
    return {
      candidate: WorktreeReapCandidate.make({ ...base, skipReason: O.some("detached-head") }),
      warnings: A.empty(),
    };
  }
  const directorySkip = yield* probeDirectory(ctx.fs, entry.path);
  if (O.isSome(directorySkip)) {
    return {
      candidate: WorktreeReapCandidate.make({ ...base, skipReason: O.some(directorySkip.value.reason) }),
      warnings: [directorySkip.value.warning],
    };
  }
  const evidence = yield* probeEvidence(ctx, entry, branch.value);
  if (evidence._tag === "skipped") {
    const prFields = O.match(evidence.pr, {
      onNone: () => ({}),
      onSome: (pr) => ({ reapClass: pr.reapClass, prNumber: pr.prNumber }),
    });
    return {
      candidate: WorktreeReapCandidate.make({ ...base, ...prFields, skipReason: O.some(evidence.skip.reason) }),
      warnings: [evidence.skip.warning],
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
    return { candidate: WorktreeReapCandidate.make({ ...enriched, skipReason }), warnings: A.empty() };
  }
  const liveness = livenessSkipReason(yield* ctx.prober({ targetPath: entry.path, idleHours: evidence.idleHours }));
  if (O.isSome(liveness)) {
    return { candidate: WorktreeReapCandidate.make({ ...enriched, skipReason: liveness }), warnings: A.empty() };
  }
  if (!includeBytes) {
    return { candidate: WorktreeReapCandidate.make({ ...enriched, skipReason: O.none() }), warnings: A.empty() };
  }
  // Size is reporting-only evidence: a failed measurement must never block retirement.
  const bytes = yield* measureBytes(ctx.runner, entry);
  return O.match(bytes, {
    onNone: (): CandidateAssessment => ({
      candidate: WorktreeReapCandidate.make({ ...enriched, skipReason: O.none() }),
      warnings: [`size-probe-failed: could not measure eligible worktree ${entry.path}; retirement is unaffected.`],
    }),
    onSome: (measuredBytes): CandidateAssessment => ({
      candidate: WorktreeReapCandidate.make({ ...enriched, bytes: O.some(measuredBytes), skipReason: O.none() }),
      warnings: A.empty(),
    }),
  });
});

const retirementOutcome = Effect.fnUntraced(function* (
  ctx: AssessContext,
  entry: WorktreeListEntry,
  assessed: WorktreeReapCandidate,
  failure: { readonly message: string }
): Effect.fn.Return<CandidateAssessment, never, never> {
  const present = O.getOrElse(yield* ctx.fs.exists(entry.path).pipe(Effect.option), () => true);
  if (present) {
    return {
      candidate: WorktreeReapCandidate.make({ ...assessed, skipReason: O.some("retirement-failed") }),
      warnings: [`retirement-failed: ${entry.path}: ${failure.message}`],
    };
  }
  // The checkout is already gone: report the retirement so callers do not retry a
  // removal Git can no longer perform, and surface the failed cleanup loudly.
  return {
    candidate: WorktreeReapCandidate.make({ ...assessed, retired: true }),
    warnings: [`retirement-cleanup-failed: ${entry.path} was removed but follow-up cleanup failed: ${failure.message}`],
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
): Effect.fn.Return<CandidateAssessment, never, FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner> {
  if (O.isSome(assessed.skipReason)) {
    return { candidate: assessed, warnings: A.empty() };
  }
  const rechecked = yield* assessCandidate(ctx, entry, false);
  if (O.isSome(rechecked.candidate.skipReason)) {
    // Report the rechecked classification, not the stale pre-apply one, so the row's
    // class and skip reason always describe the same observation; measured bytes stay.
    return {
      candidate: WorktreeReapCandidate.make({ ...rechecked.candidate, bytes: assessed.bytes }),
      warnings: A.append(rechecked.warnings, `eligibility changed before retirement: ${entry.path}.`),
    };
  }
  const removal = yield* Effect.result(
    removalService.remove(
      WorktreeRemovalRequest.make({
        name: NonEmptyTrimmedStr.make(ctx.path.basename(entry.path)),
        targetPath: entry.path,
        mainCheckout,
        branch: O.fromNullishOr(entry.branch),
        archive: true,
        deleteBranch: true,
      })
    )
  );
  if (Result.isSuccess(removal)) {
    return { candidate: WorktreeReapCandidate.make({ ...assessed, retired: true }), warnings: A.empty() };
  }
  return yield* retirementOutcome(ctx, entry, assessed, removal.failure);
});

/**
 * Classify registered worktrees and optionally retire fully evidenced merged-PR candidates.
 *
 * **Details**
 *
 * The main checkout, the invoking checkout, and locked worktrees are excluded.
 * Eligibility requires a merged PR whose final head is the checkout's current
 * HEAD (a branch reused after its merge skips as `reused-branch`), no open PR
 * on the branch, a clean tree,
 * idleness beyond the threshold, and a dormant liveness verdict from the
 * same-uid process-cwd probe (`classifyFleetLiveness` semantics; a live or
 * unknown verdict skips the candidate). Byte measurement is reporting-only —
 * a failed `du` leaves the candidate eligible with `bytes` absent. Apply mode
 * revalidates every eligible candidate immediately before calling the shared
 * archive-first removal service with branch deletion enabled, and reports a
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
 * @param options - Optional apply, idle threshold, clock, liveness prober, command runner, and repository-root seams.
 * @returns A versioned, auditable worktree-reap report.
 * @category workflows
 * @since 0.0.0
 */
export const runWorktreeReap = Effect.fn("WorktreeReap.runWorktreeReap")(function* (
  options: WorktreeReapRunOptions = {}
): Effect.fn.Return<
  WorktreeReapReport,
  WorktreeCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | WorktreeRemovalService
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const removalService = yield* WorktreeRemovalService;
  const currentRoot = yield* findRepoRoot(options.startFrom).pipe(
    Effect.mapError(WorktreeCommandError.new("Failed to locate the current repository root."))
  );
  const porcelain = yield* runWorktreeGitCapture(
    currentRoot,
    ["worktree", "list", "--porcelain"],
    "Failed to list registered git worktrees."
  );
  const entries = parseWorktreePorcelain(porcelain);
  const mainCheckout = O.getOrElse(
    O.map(A.head(entries), (entry) => entry.path),
    () => currentRoot
  );
  const candidates = A.filter(
    A.drop(entries, 1),
    (entry) => !Str.Equivalence(path.resolve(entry.path), path.resolve(currentRoot))
  );
  const idleThresholdHours = options.idleHours ?? 48;
  if (!S.is(S.Finite)(idleThresholdHours) || idleThresholdHours < 0) {
    return yield* WorktreeCommandError.make({ message: "--idle-hours must be a non-negative finite number." });
  }
  const clockNow = yield* Clock.currentTimeMillis;
  const ctx: AssessContext = {
    fs,
    idleThreshold: Duration.hours(idleThresholdHours),
    nowMillis: options.nowMillis ?? clockNow,
    path,
    prober: options.probeLiveness ?? probeWorktreeLiveness,
    runner: options.runCommand ?? runRepoCommandCapture,
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
  const scannedAt = DateTime.formatIso(yield* DateTime.now);
  return WorktreeReapReport.make({
    scannedAt,
    mainCheckout,
    invokingWorktree: currentRoot,
    idleThresholdHours,
    applied: apply,
    ...summarizeOutcomes(apply, assessed, outcomes),
  });
});
