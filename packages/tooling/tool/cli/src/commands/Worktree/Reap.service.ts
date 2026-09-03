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
import { WorktreeReapCandidate, WorktreeReapClass, WorktreeReapReport } from "./Reap.schemas.ts";
import { WorktreeCommandError } from "./Worktree.errors.ts";
import { parseWorktreePorcelain, WorktreeRemovalRequest } from "./Worktree.schemas.ts";
import { runWorktreeGitCapture, WorktreeRemovalService } from "./Worktree.service.ts";
import type { DomainError } from "@beep/repo-utils";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { WorktreeReapSkipReason } from "./Reap.schemas.ts";
import type { WorktreeListEntry } from "./Worktree.schemas.ts";
import type { WorktreeRemovalServiceShape } from "./Worktree.service.ts";

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

type WorktreeReapRunOptions = {
  readonly apply?: boolean;
  readonly idleHours?: number;
  readonly nowMillis?: number;
  readonly runCommand?: ReapCommandRunner;
  readonly startFrom?: string;
};

type PrClassification = {
  readonly reapClass: WorktreeReapClass;
  readonly prNumber: O.Option<number>;
  readonly failed: boolean;
};

type IdleReading = {
  readonly hours: O.Option<number>;
  readonly failed: boolean;
};

type CandidateAssessment = {
  readonly candidate: WorktreeReapCandidate;
  readonly warnings: ReadonlyArray<string>;
};

class GhPr extends S.Class<GhPr>($I`GhPr`)(
  { number: S.Int },
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
    ["pr", "list", "--head", branch, "--state", state, "--json", "number", "--limit", "1"],
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
  branch: string
): Effect.fn.Return<PrClassification, never, ChildProcessSpawner.ChildProcessSpawner> {
  // Open must win over merged: a revived branch can carry an old merged PR AND a live
  // open PR, and retiring it would delete in-flight work along with its branch.
  const open = yield* ghPrList(runner, cwd, branch, "open");
  if (O.isNone(open)) {
    return { reapClass: "unknown", prNumber: O.none(), failed: true };
  }
  const openPr = A.head(open.value);
  if (O.isSome(openPr)) {
    return { reapClass: "open-pr", prNumber: O.some(openPr.value.number), failed: false };
  }
  const merged = yield* ghPrList(runner, cwd, branch, "merged");
  if (O.isNone(merged)) {
    return { reapClass: "unknown", prNumber: O.none(), failed: true };
  }
  const mergedPr = A.head(merged.value);
  return O.match(mergedPr, {
    onNone: (): PrClassification => ({ reapClass: "no-pr", prNumber: O.none(), failed: false }),
    onSome: (pr): PrClassification => ({ reapClass: "merged-pr", prNumber: O.some(pr.number), failed: false }),
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

const classSkipReason = (reapClass: WorktreeReapClass): O.Option<WorktreeReapSkipReason> =>
  WorktreeReapClass.$match(reapClass, {
    "merged-pr": () => O.none<WorktreeReapSkipReason>(),
    "open-pr": () => O.some<WorktreeReapSkipReason>("open-pr"),
    "no-pr": () => O.some<WorktreeReapSkipReason>("no-pr"),
    unknown: () => O.some<WorktreeReapSkipReason>("gh-probe-failed"),
  });

const assessCandidate = Effect.fn("WorktreeReap.assessCandidate")(function* (
  runner: ReapCommandRunner,
  fs: FileSystem.FileSystem,
  path: Path.Path,
  entry: WorktreeListEntry,
  idleThreshold: Duration.Duration,
  nowMillis: number,
  includeBytes: boolean
): Effect.fn.Return<CandidateAssessment, never, ChildProcessSpawner.ChildProcessSpawner> {
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
  if (O.isNone(branch)) {
    return {
      candidate: WorktreeReapCandidate.make({ ...base, skipReason: O.some("detached-head") }),
      warnings: A.empty(),
    };
  }

  const pathStatus = yield* Effect.result(fs.stat(entry.path));
  if (Result.isFailure(pathStatus)) {
    const reason: WorktreeReapSkipReason = Match.value(pathStatus.failure.reason._tag).pipe(
      Match.when("NotFound", () => "missing-directory" as const),
      Match.orElse(() => "filesystem-probe-failed" as const)
    );
    return {
      candidate: WorktreeReapCandidate.make({ ...base, skipReason: O.some(reason) }),
      warnings: [`${reason}: could not inspect ${entry.path}.`],
    };
  }
  if (pathStatus.success.type !== "Directory") {
    return {
      candidate: WorktreeReapCandidate.make({ ...base, skipReason: O.some("missing-directory") }),
      warnings: [`missing-directory: ${entry.path} is not a directory.`],
    };
  }

  const pr = yield* classifyPr(runner, entry.path, branch.value);
  if (pr.failed) {
    return {
      candidate: WorktreeReapCandidate.make({ ...base, skipReason: O.some("gh-probe-failed") }),
      warnings: [`gh-probe-failed: could not classify pull requests for ${branch.value} at ${entry.path}.`],
    };
  }

  const status = yield* successfulOutput(
    runner,
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"],
    entry.path
  );
  if (O.isNone(status)) {
    return {
      candidate: WorktreeReapCandidate.make({
        ...base,
        reapClass: pr.reapClass,
        prNumber: pr.prNumber,
        skipReason: O.some("git-probe-failed"),
      }),
      warnings: [`git-probe-failed: could not inspect worktree status at ${entry.path}.`],
    };
  }

  const idle = yield* readIdleHours(runner, fs, path, entry, nowMillis);
  if (idle.failed) {
    return {
      candidate: WorktreeReapCandidate.make({
        ...base,
        reapClass: pr.reapClass,
        prNumber: pr.prNumber,
        skipReason: O.some("idle-probe-failed"),
      }),
      warnings: [`idle-probe-failed: could not establish commit and HEAD-file activity for ${entry.path}.`],
    };
  }

  const dirty = Str.isNonEmpty(Str.trim(status.value));
  const tooYoung = O.exists(idle.hours, (hours) => hours < Duration.toHours(idleThreshold));
  const skipReason = O.firstSomeOf([
    dirty ? O.some<WorktreeReapSkipReason>("dirty-tree") : O.none(),
    classSkipReason(pr.reapClass),
    tooYoung ? O.some<WorktreeReapSkipReason>("too-young") : O.none(),
  ]);
  if (O.isSome(skipReason) || !includeBytes) {
    return {
      candidate: WorktreeReapCandidate.make({
        ...base,
        reapClass: pr.reapClass,
        prNumber: pr.prNumber,
        idleHours: idle.hours,
        skipReason,
      }),
      warnings: A.empty(),
    };
  }

  const bytes = yield* measureBytes(runner, entry);
  return O.match(bytes, {
    onNone: (): CandidateAssessment => ({
      candidate: WorktreeReapCandidate.make({
        ...base,
        reapClass: pr.reapClass,
        prNumber: pr.prNumber,
        idleHours: idle.hours,
        skipReason: O.some("size-probe-failed"),
      }),
      warnings: [`size-probe-failed: could not measure eligible worktree ${entry.path}.`],
    }),
    onSome: (measuredBytes): CandidateAssessment => ({
      candidate: WorktreeReapCandidate.make({
        ...base,
        reapClass: pr.reapClass,
        prNumber: pr.prNumber,
        idleHours: idle.hours,
        bytes: O.some(measuredBytes),
        skipReason: O.none(),
      }),
      warnings: A.empty(),
    }),
  });
});

const applyCandidate = Effect.fn("WorktreeReap.applyCandidate")(function* (
  runner: ReapCommandRunner,
  fs: FileSystem.FileSystem,
  path: Path.Path,
  removalService: WorktreeRemovalServiceShape,
  mainCheckout: string,
  entry: WorktreeListEntry,
  assessed: WorktreeReapCandidate,
  idleThreshold: Duration.Duration,
  nowMillis: number
): Effect.fn.Return<CandidateAssessment, never, ChildProcessSpawner.ChildProcessSpawner> {
  if (O.isSome(assessed.skipReason)) {
    return { candidate: assessed, warnings: A.empty() };
  }
  const rechecked = yield* assessCandidate(runner, fs, path, entry, idleThreshold, nowMillis, false);
  if (O.isSome(rechecked.candidate.skipReason)) {
    return {
      candidate: WorktreeReapCandidate.make({
        ...assessed,
        skipReason: rechecked.candidate.skipReason,
      }),
      warnings: A.append(rechecked.warnings, `eligibility changed before retirement: ${entry.path}.`),
    };
  }
  const branch = O.fromNullishOr(entry.branch);
  const removal = yield* Effect.result(
    removalService.remove(
      WorktreeRemovalRequest.make({
        name: NonEmptyTrimmedStr.make(path.basename(entry.path)),
        targetPath: entry.path,
        mainCheckout,
        branch,
        archive: true,
        deleteBranch: true,
      })
    )
  );
  return Result.match(removal, {
    onFailure: (error): CandidateAssessment => ({
      candidate: WorktreeReapCandidate.make({ ...assessed, skipReason: O.some("retirement-failed") }),
      warnings: [`retirement-failed: ${entry.path}: ${error.message}`],
    }),
    onSuccess: (): CandidateAssessment => ({
      candidate: WorktreeReapCandidate.make({ ...assessed, retired: true }),
      warnings: A.empty(),
    }),
  });
});

/**
 * Classify registered worktrees and optionally retire fully evidenced merged-PR candidates.
 *
 * **Details**
 *
 * The main checkout and invoking checkout are excluded. Dry-run is the default.
 * Apply mode revalidates every eligible candidate immediately before calling
 * the shared archive-first removal service with branch deletion enabled.
 *
 * **Example** (Build a dry-run janitor effect)
 *
 * ```ts
 * import { runWorktreeReap } from "@beep/repo-cli/commands/Worktree"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runWorktreeReap())) // true
 * ```
 *
 * @param options - Optional apply, idle threshold, clock, command runner, and repository-root seams.
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
  const runner = options.runCommand ?? runRepoCommandCapture;
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
  const idleThreshold = Duration.hours(idleThresholdHours);
  const clockNow = yield* Clock.currentTimeMillis;
  const nowMillis = options.nowMillis ?? clockNow;
  const assessed = yield* Effect.forEach(
    candidates,
    Effect.fn("WorktreeReap.assessRegisteredWorktree")(function* (entry) {
      return yield* assessCandidate(runner, fs, path, entry, idleThreshold, nowMillis, true);
    }),
    { concurrency: 4 }
  );
  const apply = options.apply ?? false;
  const outcomes = apply
    ? yield* Effect.forEach(
        A.zip(candidates, assessed),
        Effect.fn("WorktreeReap.applyRegisteredWorktree")(function* ([entry, assessment]) {
          return yield* applyCandidate(
            runner,
            fs,
            path,
            removalService,
            mainCheckout,
            entry,
            assessment.candidate,
            idleThreshold,
            nowMillis
          );
        }),
        { concurrency: 1 }
      )
    : assessed;
  const rows = A.map(outcomes, (assessment) => assessment.candidate);
  const reclaimableBytes = A.reduce(
    assessed,
    0,
    (total, assessment) => total + O.getOrElse(assessment.candidate.bytes, () => 0)
  );
  const reclaimedBytes = A.reduce(
    rows,
    0,
    (total, candidate) => total + (candidate.retired ? O.getOrElse(candidate.bytes, () => 0) : 0)
  );
  const warnings = apply
    ? A.appendAll(
        A.flatten(A.map(assessed, (assessment) => assessment.warnings)),
        A.flatten(A.map(outcomes, (assessment) => assessment.warnings))
      )
    : A.flatten(A.map(outcomes, (assessment) => assessment.warnings));
  const scannedAt = DateTime.formatIso(yield* DateTime.now);
  return WorktreeReapReport.make({
    scannedAt,
    mainCheckout,
    invokingWorktree: currentRoot,
    idleThresholdHours,
    applied: apply,
    candidates: rows,
    retiredCount: A.length(A.filter(rows, (candidate) => candidate.retired)),
    reclaimableBytes,
    reclaimedBytes,
    warnings,
  });
});
