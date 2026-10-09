/**
 * Conservative janitor for bounded home residue and owner-verified checkout archives.
 *
 * Discovery is closed over Codex session files, Codex worktree directories,
 * each checkout's Turbo cache entries, Turbo run summaries, and interrupted
 * merged-preview worktrees, the shared Turbo cache, retained qualification
 * dependency views, and non-durable top-level beep cache directories. Every
 * removal is age-, size-, or retention-gated and revalidated immediately before
 * mutation. Checkout QA, qualification, generated output, jobs, ledgers and PID
 * records use persisted v3 reports and inode-bound archive intents under
 * `.beep/residue-reap/<run-id>/`; resume reconciles interruptions and restore
 * returns preserved data. Fleet checkout archives require a run from their owner.
 * Recursive idleness scans, pid probes, and Linux cwd probes fail
 * closed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as BI from "effect/BigInt";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as N from "effect/Number";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ReplyDrafts } from "../../commands/Yeet/internal/Reply.schemas.ts";
import { withJournalFileLock } from "./AdmissionJournal.ts";
import {
  BoundMoveOutcome,
  directoryIdentity,
  openDirectoryHandle,
  removeThroughDirectoryHandle,
  renameBoundEntry,
  sameDirectoryIdentity,
  syncDirectoryHandle,
  unlinkBoundFile,
} from "./DirectoryHandle.ts";
import { isRegisteredWorktree, removeGitWorktree } from "./GitWorktree.ts";
import { publishJournalTextAtomically } from "./JournalFile.ts";
import { invokerAncestryPids, ProcessAttachmentKind, scanProcessAttachments } from "./ProcessAttachment.ts";
import { runRepoCommandCapture, runRepoCommandCaptureRaw } from "./RepoRun.executor.ts";
import {
  QualificationViewReceipt,
  ResidueArchiveError,
  ResidueArchiveIntent,
  ResidueReapAction,
  ResidueReapAgeDays,
  ResidueReapByteCap,
  ResidueReapCandidate,
  ResidueReapClass,
  ResidueReapHomeRoot,
  ResidueReapKeepCount,
  ResidueReapReport,
  ResidueRetentionRuling,
} from "./ResidueReap.schemas.ts";
import type { ChildProcessSpawner } from "effect/process";
import type * as Scope from "effect/Scope";
import type { BoundRemovalOutcome, DirectoryHandleError, DirectoryIdentity } from "./DirectoryHandle.ts";
import type { QualitySchedulerError } from "./QualityScheduler.schemas.ts";
import type { ResidueReapSkipReason } from "./ResidueReap.schemas.ts";

const $I = $RepoCliId.create("internal/repo-run/ResidueReap");

const decodeResidueReapAgeDays = S.decodeEffect(ResidueReapAgeDays);
const decodeResidueReapHomeRoot = S.decodeEffect(ResidueReapHomeRoot);
const decodeResidueReapByteCap = S.decodeEffect(ResidueReapByteCap);
const decodeResidueReapKeepCount = S.decodeEffect(ResidueReapKeepCount);
const decodeQualificationViewReceiptJson = S.decodeEffect(S.fromJsonString(QualificationViewReceipt));

const DEFAULT_MAX_AGE_DAYS = 30;
const DEFAULT_TURBO_MAX_AGE_DAYS = 14;
const DEFAULT_TURBO_RUNS_MAX_AGE_DAYS = 1;
const DEFAULT_SHARED_TURBO_MAX_AGE_DAYS = 14;
const DEFAULT_SHARED_TURBO_MAX_BYTES = 20 * 1024 ** 3;
const DEFAULT_QUALIFICATION_VIEWS_KEEP = 2;
// Size eviction never touches an entry written within the last day: turbo may still
// be writing that key, and "oldest" here means oldest-written, not least-recently-read.
const SHARED_TURBO_EVICTION_FLOOR_DAYS = 1;
const MERGED_PREVIEW_MIN_AGE_DAYS = 1;
const DEFAULT_CENSUS_ENTRY_CAP = 100_000;
const CENSUS_DEPTH_CAP = 12;
const PROC_ROOT = "/proc";
const MERGED_PREVIEW_PREFIX = "merged-preview-";
const QUALIFICATION_VIEW_PREFIX = "view-";
const TURBO_RUN_SUMMARY_SUFFIX = ".json";
// The archive leads so a group interrupted mid-eviction is a clean turbo cache miss.
const SHARED_TURBO_MEMBER_SUFFIXES = [".tar.zst", "-meta.json", "-manifest.json"] as const;
const SHARED_TURBO_ARCHIVE_SUFFIX = ".tar.zst";

// worktree-residue holds archive-first worktree retirement manifests, patches, and
// preserved untracked files: an old archive is often the only remaining copy of that work.
// turbo and turbo-qualification are owned by the shared-turbo-cache and
// qualification-views classes, which evict inside them; codex-security is the Codex
// security runtime's state directory; effect-vitest-canon and boolean-creep hold
// evidence cited by open goal packets. None of them may ever be reaped whole.
const DurableBeepCacheName = LiteralKit([
  "handoffs",
  "head-install",
  "uv",
  "worktree-residue",
  "turbo",
  "turbo-qualification",
  "codex-security",
  "effect-vitest-canon",
  "boolean-creep",
  "rsc",
]);
const isDurableBeepCacheName = S.is(DurableBeepCacheName);
const ProcPidName = S.String.check(S.isPattern(/^[0-9]+$/u));
const isProcPidName = S.is(ProcPidName);
const MergedPreviewName = S.String.check(S.isPattern(/^merged-preview-[0-9]+$/u));
const isMergedPreviewName = S.is(MergedPreviewName);
// Classes whose candidates live inside one checkout; that checkout is their apply boundary.
const CheckoutResidueClass = LiteralKit([
  "checkout-qa",
  "checkout-qualification",
  "checkout-generated",
  "checkout-jobs",
  "checkout-ledgers",
  "checkout-pids",
  "checkout-material",
]);
const isCheckoutResidueClass = S.is(CheckoutResidueClass);
const RepoScopedResidueClass = LiteralKit([
  "turbo-cache",
  "turbo-runs",
  "merged-preview",
  ...CheckoutResidueClass.literals,
]);
const isRepoScopedResidueClass = S.is(RepoScopedResidueClass);

type CwdProbe = (candidatePath: string) => Effect.Effect<O.Option<boolean>, never, FileSystem.FileSystem | Path.Path>;

type PidProbe = (pid: string) => Effect.Effect<O.Option<boolean>, never, FileSystem.FileSystem | Path.Path>;

// Internal evaluation policy shared by discovery and apply-time reassessment.
type ReapPolicy = {
  readonly cwdProbe: CwdProbe;
  readonly entryCap: number;
  readonly homeBoundary: string;
  readonly maxAgeDays: number;
  readonly nowMillis: number;
  readonly pidProbe: PidProbe;
  readonly qualificationViewsKeep: number;
  readonly turboMaxAgeDays: number;
  readonly turboRunsMaxAgeDays: number;
};

type DiscoveryRequirements =
  | FileSystem.FileSystem
  | Path.Path
  | Crypto.Crypto
  | ChildProcessSpawner.ChildProcessSpawner;

type Discovered = {
  readonly candidates: ReadonlyArray<ResidueReapCandidate>;
  readonly warnings: ReadonlyArray<string>;
};

type SharedTurboMember = {
  readonly bytes: number;
  readonly groupKey: string;
  readonly isArchive: boolean;
  readonly mtimeMillis: number;
  readonly path: string;
};

type SharedTurboGroup = {
  readonly ageDays: number;
  readonly bytes: number;
  readonly key: string;
  readonly members: ReadonlyArray<SharedTurboMember>;
  readonly newestMillis: number;
};

type SizeEviction = {
  readonly remaining: number;
  readonly verdicts: ReadonlyArray<readonly [SharedTurboGroup, O.Option<ResidueReapSkipReason>]>;
};

type QualificationView = {
  readonly modifiedMillis: number;
  readonly path: string;
};

type Census = {
  readonly bytes: number;
  readonly entriesScanned: number;
  readonly gitMarkers: ReadonlyArray<string>;
  readonly newestFileMillis: O.Option<number>;
  readonly skipReason: O.Option<ResidueReapSkipReason>;
};

type SessionScan = {
  readonly candidates: ReadonlyArray<ResidueReapCandidate>;
  readonly remaining: number;
};

type AppliedCandidate = {
  readonly candidate: ResidueReapCandidate;
  readonly reaped: boolean;
  readonly reclaimedBytes: number;
  readonly warnings: ReadonlyArray<string>;
};

const emptyCensus = (): Census => ({
  bytes: 0,
  entriesScanned: 0,
  gitMarkers: A.empty(),
  newestFileMillis: O.none(),
  skipReason: O.none(),
});

const pathIsStrictlyWithin = (path: Path.Path, root: string, candidate: string): boolean => {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    Str.isNonEmpty(relative) &&
    !path.isAbsolute(relative) &&
    !Str.Equivalence(relative, "..") &&
    !Str.startsWith(`..${path.sep}`)(relative)
  );
};

const mtimeMillis = (info: FileSystem.File.Info): O.Option<number> =>
  pipe(
    info.mtime,
    O.map((mtime) => mtime.getTime())
  );

const ageDays = (nowMillis: number, modifiedMillis: number): number =>
  Duration.toDays(Duration.millis(N.max(0, nowMillis - modifiedMillis)));

const bytesFromInfo = (info: FileSystem.File.Info): number => O.getOrElse(BI.toNumber(info.size), () => 0);

const newestOption = (left: O.Option<number>, right: O.Option<number>): O.Option<number> =>
  O.match(left, {
    onNone: () => right,
    onSome: (leftValue) =>
      pipe(
        right,
        O.map((rightValue) => N.max(leftValue, rightValue)),
        O.orElse(() => left)
      ),
  });

const combineCensus = (left: Census, right: Census): Census => ({
  bytes: left.bytes + right.bytes,
  entriesScanned: left.entriesScanned + right.entriesScanned,
  gitMarkers: A.appendAll(left.gitMarkers, right.gitMarkers),
  newestFileMillis: newestOption(left.newestFileMillis, right.newestFileMillis),
  skipReason: O.firstSomeOf([left.skipReason, right.skipReason]),
});

const censusDirectory = Effect.fnUntraced(function* (
  directory: string,
  entryCap: number,
  depth = 0
): Effect.fn.Return<Census, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (depth > CENSUS_DEPTH_CAP) {
    return { ...emptyCensus(), skipReason: O.some("census-overflow") };
  }
  const listing = yield* Effect.result(fs.readDirectory(directory));
  if (Result.isFailure(listing)) {
    return { ...emptyCensus(), skipReason: O.some("census-failed") };
  }
  if (A.length(listing.success) > entryCap) {
    return { ...emptyCensus(), entriesScanned: A.length(listing.success), skipReason: O.some("census-overflow") };
  }
  return yield* Effect.reduce(
    listing.success,
    emptyCensus,
    Effect.fnUntraced(function* (accumulator: Census, name: string) {
      // Record the directory owning any `.git` entry so retirement can demand a clean
      // `git status` from every embedded checkout before its container is removed.
      const withMarkers = (entry: Census): Census =>
        Str.Equivalence(name, ".git") ? { ...entry, gitMarkers: A.append(entry.gitMarkers, directory) } : entry;
      if (O.isSome(accumulator.skipReason)) {
        return accumulator;
      }
      const remaining = entryCap - accumulator.entriesScanned;
      if (remaining <= 0) {
        return { ...accumulator, skipReason: O.some("census-overflow") };
      }
      const entryPath = path.join(directory, name);
      if (O.isSome(yield* fs.readLink(entryPath).pipe(Effect.option))) {
        return combineCensus(accumulator, {
          ...emptyCensus(),
          entriesScanned: 1,
          skipReason: O.some("census-failed"),
        });
      }
      const stat = yield* Effect.result(fs.stat(entryPath));
      if (Result.isFailure(stat)) {
        return combineCensus(accumulator, {
          ...emptyCensus(),
          entriesScanned: 1,
          skipReason: O.some("census-failed"),
        });
      }
      if (Str.Equivalence(stat.success.type, "Directory")) {
        const nested = yield* censusDirectory(entryPath, remaining - 1, depth + 1);
        return combineCensus(accumulator, withMarkers({ ...nested, entriesScanned: nested.entriesScanned + 1 }));
      }
      if (!Str.Equivalence(stat.success.type, "File")) {
        return combineCensus(accumulator, {
          ...emptyCensus(),
          entriesScanned: 1,
          skipReason: O.some("census-failed"),
        });
      }
      return combineCensus(
        accumulator,
        withMarkers({
          ...emptyCensus(),
          bytes: bytesFromInfo(stat.success),
          entriesScanned: 1,
          newestFileMillis: mtimeMillis(stat.success),
          skipReason: O.isSome(mtimeMillis(stat.success)) ? O.none() : O.some("census-failed"),
        })
      );
    })
  );
});

const protectedSessionName = (path: Path.Path, candidatePath: string): boolean => {
  const name = path.basename(candidatePath);
  return (
    Str.Equivalence(name, "config.toml") ||
    Str.includes("auth")(Str.toLowerCase(name)) ||
    Str.includes(".sqlite")(Str.toLowerCase(name))
  );
};

const candidate = (
  root: string,
  candidatePath: string,
  reapClass: ResidueReapClass,
  action: ResidueReapAction,
  options: {
    readonly ageDays?: number;
    readonly bytes?: number;
    readonly checkoutRoot?: string;
    readonly entriesScanned?: number;
    readonly groupKey?: string;
    readonly mtimeMillis?: number;
    readonly skipReason?: ResidueReapSkipReason;
  } = {}
): ResidueReapCandidate =>
  ResidueReapCandidate.make({
    root,
    path: candidatePath,
    reapClass,
    action,
    ...options,
  });

const classifyFile = (
  path: Path.Path,
  root: string,
  candidatePath: string,
  reapClass: ResidueReapClass,
  info: FileSystem.File.Info,
  nowMillis: number,
  thresholdDays: number
): ResidueReapCandidate => {
  if (ResidueReapClass.is["codex-sessions"](reapClass) && protectedSessionName(path, candidatePath)) {
    return candidate(root, candidatePath, reapClass, "skip", { skipReason: "protected-name" });
  }
  const modified = mtimeMillis(info);
  if (O.isNone(modified)) {
    return candidate(root, candidatePath, reapClass, "skip", { skipReason: "stat-failed" });
  }
  const measuredAge = ageDays(nowMillis, modified.value);
  return measuredAge >= thresholdDays
    ? candidate(root, candidatePath, reapClass, "remove-file", {
        ageDays: measuredAge,
        bytes: bytesFromInfo(info),
      })
    : candidate(root, candidatePath, reapClass, "skip", { ageDays: measuredAge, skipReason: "too-young" });
};

const discoverSessionTree = Effect.fnUntraced(function* (
  root: string,
  directory: string,
  nowMillis: number,
  thresholdDays: number,
  remainingEntries: number
): Effect.fn.Return<SessionScan, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs.exists(directory).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return { candidates: A.empty(), remaining: remainingEntries };
  }
  const listing = yield* Effect.result(fs.readDirectory(directory));
  if (Result.isFailure(listing)) {
    return {
      candidates: [candidate(root, directory, "codex-sessions", "skip", { skipReason: "census-failed" })],
      remaining: remainingEntries,
    };
  }
  if (A.length(listing.success) > remainingEntries) {
    return {
      candidates: [
        candidate(root, directory, "codex-sessions", "skip", {
          entriesScanned: A.length(listing.success),
          skipReason: "census-overflow",
        }),
      ],
      remaining: 0,
    };
  }
  // The traversal is sequential so every branch draws from ONE shared budget: sibling
  // subtrees each seeing the full remainder is how a census cap gets exceeded.
  return yield* Effect.reduce(
    listing.success,
    (): SessionScan => ({ candidates: A.empty(), remaining: remainingEntries - A.length(listing.success) }),
    Effect.fnUntraced(function* (scan: SessionScan, name: string) {
      const entryPath = path.join(directory, name);
      const skipped = (reason: ResidueReapSkipReason): SessionScan => ({
        candidates: A.append(
          scan.candidates,
          candidate(root, entryPath, "codex-sessions", "skip", { skipReason: reason })
        ),
        remaining: scan.remaining,
      });
      if (O.isSome(yield* fs.readLink(entryPath).pipe(Effect.option))) {
        return skipped("wrong-shape");
      }
      const stat = yield* Effect.result(fs.stat(entryPath));
      if (Result.isFailure(stat)) {
        return skipped("stat-failed");
      }
      if (Str.Equivalence(stat.success.type, "Directory")) {
        const nested = yield* discoverSessionTree(root, entryPath, nowMillis, thresholdDays, scan.remaining);
        return { candidates: A.appendAll(scan.candidates, nested.candidates), remaining: nested.remaining };
      }
      if (!Str.Equivalence(stat.success.type, "File")) {
        return skipped("wrong-shape");
      }
      return {
        candidates: A.append(
          scan.candidates,
          classifyFile(path, root, entryPath, "codex-sessions", stat.success, nowMillis, thresholdDays)
        ),
        remaining: scan.remaining,
      };
    })
  );
});

const canonicalDirectory = Effect.fnUntraced(function* (
  root: string,
  candidatePath: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (O.isSome(yield* fs.readLink(candidatePath).pipe(Effect.option))) {
    return O.none();
  }
  // Resolve BOTH sides before the containment check: a symlinked HOME or temp root must
  // not disqualify every candidate under it, while a candidate escaping the root through
  // a linked ancestor must still be rejected. The accepted value stays the lexical path
  // so reports, revalidation, and removal all speak the operator's own path.
  const rootReal = yield* fs.realPath(root).pipe(Effect.option);
  const canonical = yield* fs.realPath(candidatePath).pipe(Effect.option);
  if (O.isNone(rootReal) || O.isNone(canonical) || !pathIsStrictlyWithin(path, rootReal.value, canonical.value)) {
    return O.none();
  }
  const stat = yield* fs.stat(candidatePath).pipe(Effect.option);
  return O.exists(stat, (info) => Str.Equivalence(info.type, "Directory"))
    ? O.some(path.normalize(candidatePath))
    : O.none();
});

const cwdWithin = (path: Path.Path, candidatePath: string, cwd: string): boolean => {
  const relative = path.relative(candidatePath, cwd);
  return Str.isEmpty(relative) || (!path.isAbsolute(relative) && !Str.startsWith(`..${path.sep}`)(relative));
};

const procCwdProbe = Effect.fnUntraced(function* (
  candidatePath: string
): Effect.fn.Return<O.Option<boolean>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const listing = yield* Effect.result(fs.readDirectory(PROC_ROOT));
  // /proc/<pid>/cwd targets are fully resolved by the kernel, so the candidate must be
  // resolved too or a symlinked HOME would make every live directory look idle.
  const resolvedCandidate = yield* fs.realPath(candidatePath).pipe(Effect.option);
  if (Result.isFailure(listing) || O.isNone(resolvedCandidate)) {
    return O.none();
  }
  const ancestry = yield* invokerAncestryPids();
  const cwds = A.getSomes(
    yield* Effect.forEach(
      A.filter(
        listing.success,
        (pid) => isProcPidName(pid) && O.exists(N.parse(pid), (parsed) => !HashSet.has(ancestry, parsed))
      ),
      Effect.fnUntraced(function* (pid) {
        return yield* fs.readLink(path.join(PROC_ROOT, pid, "cwd")).pipe(Effect.option);
      }),
      { concurrency: 16 }
    )
  );
  // Unreadable pids are dropped, never fail-closed: measurement on a healthy host
  // shows a permanent population of unreadable-by-construction pids — every foreign
  // uid, plus this user's own ptrace-protected processes (systemd --user, sd-pam, the
  // compositor, gpg-agent, every 1Password op) — so any fail-closed rule for them
  // wedges the probe on every pass and makes retirement unreachable. The guarded
  // population (this user's agent processes working in this user's residue) is
  // dumpable and observable, and the one protected kind that plausibly occupies a
  // candidate, an op-run wrapper, spawns dumpable children that inherit and expose
  // the same cwd to this probe.
  return O.some(A.some(cwds, (cwd) => cwdWithin(path, resolvedCandidate.value, cwd)));
});

const canonicalDirectoryShape = Effect.fnUntraced(function* (
  root: string,
  candidatePath: string
): Effect.fn.Return<Result.Result<string, ResidueReapSkipReason>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const initialStat = yield* Effect.result(fs.stat(candidatePath));
  if (Result.isFailure(initialStat)) {
    return Result.fail<ResidueReapSkipReason>("stat-failed");
  }
  if (!Str.Equivalence(initialStat.success.type, "Directory")) {
    return Result.fail<ResidueReapSkipReason>("wrong-shape");
  }
  const canonical = yield* canonicalDirectory(root, candidatePath);
  return O.match(canonical, {
    onNone: (): Result.Result<string, ResidueReapSkipReason> => Result.fail("wrong-shape"),
    onSome: (value): Result.Result<string, ResidueReapSkipReason> => Result.succeed(value),
  });
});

const gitCleanSkip = Effect.fnUntraced(function* (
  gitMarkers: ReadonlyArray<string>
): Effect.fn.Return<O.Option<ResidueReapSkipReason>, never, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const readings = yield* Effect.forEach(
    gitMarkers,
    (marker) =>
      runRepoCommandCapture(
        "git",
        ["--no-optional-locks", "status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"],
        marker
      ).pipe(Effect.option),
    { concurrency: 2 }
  );
  if (A.some(readings, (reading) => O.isNone(reading) || reading.value.exitCode !== 0 || reading.value.truncated)) {
    return O.some("git-probe-failed");
  }
  return A.some(A.getSomes(readings), (capture) => Str.isNonEmpty(Str.trim(capture.output)))
    ? O.some("dirty-tree")
    : O.none();
});

const directoryLivenessSkip = Effect.fnUntraced(function* (
  candidatePath: string,
  cwdProbe: CwdProbe
): Effect.fn.Return<O.Option<ResidueReapSkipReason>, never, FileSystem.FileSystem | Path.Path> {
  const live = yield* cwdProbe(candidatePath);
  return O.match(live, {
    onNone: () => O.some<ResidueReapSkipReason>("process-probe-failed"),
    onSome: (isLive) => (isLive ? O.some<ResidueReapSkipReason>("live-cwd-ref") : O.none<ResidueReapSkipReason>()),
  });
});

const directoryCandidate = Effect.fnUntraced(function* (
  root: string,
  candidatePath: string,
  reapClass: ResidueReapClass,
  nowMillis: number,
  thresholdDays: number,
  entryCap: number,
  cwdProbe: CwdProbe
): Effect.fn.Return<
  ResidueReapCandidate,
  never,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const shape = yield* canonicalDirectoryShape(root, candidatePath);
  if (Result.isFailure(shape)) {
    return candidate(root, candidatePath, reapClass, "skip", { skipReason: shape.failure });
  }
  const census = yield* censusDirectory(shape.success, entryCap);
  if (O.isSome(census.skipReason)) {
    return candidate(root, shape.success, reapClass, "skip", {
      bytes: census.bytes,
      entriesScanned: census.entriesScanned,
      skipReason: census.skipReason.value,
    });
  }
  const rootStat = yield* fs.stat(shape.success).pipe(Effect.option);
  const newest = O.orElse(census.newestFileMillis, () => O.flatMap(rootStat, mtimeMillis));
  if (O.isNone(newest)) {
    return candidate(root, shape.success, reapClass, "skip", {
      bytes: census.bytes,
      entriesScanned: census.entriesScanned,
      skipReason: "stat-failed",
    });
  }
  const measuredAge = ageDays(nowMillis, newest.value);
  if (measuredAge < thresholdDays) {
    return candidate(root, shape.success, reapClass, "skip", {
      ageDays: measuredAge,
      bytes: census.bytes,
      entriesScanned: census.entriesScanned,
      skipReason: "too-young",
    });
  }
  // Every embedded git checkout must prove itself clean before its container may go:
  // uncommitted or untracked work inside a dormant directory is preserved, and a
  // checkout git can no longer read fails closed rather than being deleted blind.
  const gitSkip = yield* gitCleanSkip(census.gitMarkers);
  if (O.isSome(gitSkip)) {
    return candidate(root, shape.success, reapClass, "skip", {
      ageDays: measuredAge,
      bytes: census.bytes,
      entriesScanned: census.entriesScanned,
      skipReason: gitSkip.value,
    });
  }
  const liveness = yield* directoryLivenessSkip(shape.success, cwdProbe);
  if (O.isSome(liveness)) {
    return candidate(root, shape.success, reapClass, "skip", {
      ageDays: measuredAge,
      entriesScanned: census.entriesScanned,
      skipReason: liveness.value,
    });
  }
  return candidate(root, shape.success, reapClass, "remove-dir", {
    ageDays: measuredAge,
    bytes: census.bytes,
    entriesScanned: census.entriesScanned,
  });
});

const topLevelDirectoryCandidates = Effect.fnUntraced(function* (
  root: string,
  homeBoundary: string,
  reapClass: "codex-worktrees" | "beep-cache-disposable",
  nowMillis: number,
  thresholdDays: number,
  entryCap: number,
  cwdProbe: CwdProbe
): Effect.fn.Return<
  ReadonlyArray<ResidueReapCandidate>,
  never,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs.exists(root).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return A.empty();
  }
  if (O.isNone(yield* canonicalDirectory(homeBoundary, root))) {
    return [candidate(root, root, reapClass, "skip", { skipReason: "path-changed" })];
  }
  const listing = yield* Effect.result(fs.readDirectory(root));
  if (Result.isFailure(listing)) {
    return [candidate(root, root, reapClass, "skip", { skipReason: "census-failed" })];
  }
  return yield* Effect.forEach(
    A.filter(
      listing.success,
      (name) => !ResidueReapClass.is["beep-cache-disposable"](reapClass) || !isDurableBeepCacheName(name)
    ),
    Effect.fnUntraced(function* (name) {
      const candidatePath = path.join(root, name);
      return yield* directoryCandidate(root, candidatePath, reapClass, nowMillis, thresholdDays, entryCap, cwdProbe);
    }),
    { concurrency: 4 }
  );
});

const turboCandidates = Effect.fnUntraced(function* (
  repoRoot: string,
  nowMillis: number,
  thresholdDays: number,
  entryCap: number,
  cwdProbe: CwdProbe
): Effect.fn.Return<
  ReadonlyArray<ResidueReapCandidate>,
  never,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const cacheRoot = path.join(repoRoot, ".turbo", "cache");
  const exists = yield* fs.exists(cacheRoot).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return A.empty();
  }
  // A symlinked cache root would let removal reach an external shared cache while the
  // report claims the entries belong to this checkout: resolve and constrain it first.
  const constrainedRoot = yield* canonicalDirectory(repoRoot, cacheRoot);
  if (O.isNone(constrainedRoot)) {
    return [candidate(cacheRoot, cacheRoot, "turbo-cache", "skip", { skipReason: "wrong-shape" })];
  }
  const listing = yield* Effect.result(fs.readDirectory(cacheRoot));
  if (Result.isFailure(listing)) {
    return [candidate(cacheRoot, cacheRoot, "turbo-cache", "skip", { skipReason: "census-failed" })];
  }
  return yield* Effect.forEach(
    listing.success,
    Effect.fnUntraced(function* (name) {
      const entryPath = path.join(cacheRoot, name);
      if (O.isSome(yield* fs.readLink(entryPath).pipe(Effect.option))) {
        return candidate(cacheRoot, entryPath, "turbo-cache", "skip", { skipReason: "wrong-shape" });
      }
      const stat = yield* fs.stat(entryPath).pipe(Effect.option);
      if (O.isNone(stat)) {
        return candidate(cacheRoot, entryPath, "turbo-cache", "skip", { skipReason: "stat-failed" });
      }
      if (Str.Equivalence(stat.value.type, "Directory")) {
        // A directory entry's own mtime can stay old while fresh files land inside it:
        // classify by newest descendant through the shared directory workflow.
        return yield* directoryCandidate(
          cacheRoot,
          entryPath,
          "turbo-cache",
          nowMillis,
          thresholdDays,
          entryCap,
          cwdProbe
        );
      }
      return Str.Equivalence(stat.value.type, "File")
        ? classifyFile(path, cacheRoot, entryPath, "turbo-cache", stat.value, nowMillis, thresholdDays)
        : candidate(cacheRoot, entryPath, "turbo-cache", "skip", { skipReason: "wrong-shape" });
    }),
    { concurrency: 8 }
  );
});

const resolvedOrLexical = Effect.fnUntraced(function* (
  candidatePath: string
): Effect.fn.Return<string, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return O.getOrElse(yield* fs.realPath(candidatePath).pipe(Effect.option), () => path.resolve(candidatePath));
});

const rootModifiedMillis = Effect.fnUntraced(function* (
  candidatePath: string
): Effect.fn.Return<O.Option<number>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return O.flatMap(yield* fs.stat(candidatePath).pipe(Effect.option), mtimeMillis);
});

const procPidProbe = Effect.fnUntraced(function* (
  pid: string
): Effect.fn.Return<O.Option<boolean>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.exists(path.join(PROC_ROOT, pid)).pipe(Effect.option);
});

const pidLivenessSkip = Effect.fnUntraced(function* (
  pid: string,
  pidProbe: PidProbe
): Effect.fn.Return<O.Option<ResidueReapSkipReason>, never, FileSystem.FileSystem | Path.Path> {
  const alive = yield* pidProbe(pid);
  return O.match(alive, {
    onNone: () => O.some<ResidueReapSkipReason>("process-probe-failed"),
    onSome: (isAlive) => (isAlive ? O.some<ResidueReapSkipReason>("pid-alive") : O.none<ResidueReapSkipReason>()),
  });
});

const mergedPreviewCandidate = Effect.fnUntraced(function* (
  root: string,
  candidatePath: string,
  checkoutRoot: string,
  policy: ReapPolicy
): Effect.fn.Return<ResidueReapCandidate, never, DiscoveryRequirements> {
  const path = yield* Path.Path;
  const shape = yield* canonicalDirectoryShape(root, candidatePath);
  if (Result.isFailure(shape)) {
    return candidate(root, candidatePath, "merged-preview", "skip", { skipReason: shape.failure });
  }
  const skip = (skipReason: ResidueReapSkipReason, measuredAge = O.none<number>()): ResidueReapCandidate =>
    candidate(root, shape.success, "merged-preview", "skip", {
      ...O.getSomesStruct({ ageDays: measuredAge }),
      skipReason,
    });
  // No census: an installed preview carries a full node_modules tree that overflows it.
  // The root and its `.git` link file are written when the preview is checked out.
  const modified = newestOption(
    yield* rootModifiedMillis(shape.success),
    yield* rootModifiedMillis(path.join(shape.success, ".git"))
  );
  if (O.isNone(modified)) {
    return skip("stat-failed");
  }
  const measuredAge = ageDays(policy.nowMillis, modified.value);
  if (measuredAge < MERGED_PREVIEW_MIN_AGE_DAYS) {
    return skip("too-young", O.some(measuredAge));
  }
  const owner = Str.slice(Str.length(MERGED_PREVIEW_PREFIX))(path.basename(shape.success));
  const ownerSkip = yield* pidLivenessSkip(owner, policy.pidProbe);
  if (O.isSome(ownerSkip)) {
    return skip(ownerSkip.value, O.some(measuredAge));
  }
  const liveness = yield* directoryLivenessSkip(shape.success, policy.cwdProbe);
  if (O.isSome(liveness)) {
    return skip(liveness.value, O.some(measuredAge));
  }
  // The preview is a synthetic merge commit and `--force` is its designed teardown, so
  // no clean-tree gate applies; an unknown registration fails closed.
  const registered = yield* isRegisteredWorktree(checkoutRoot, shape.success);
  return O.match(registered, {
    onNone: () => skip("git-probe-failed", O.some(measuredAge)),
    onSome: (isRegistered) =>
      candidate(root, shape.success, "merged-preview", isRegistered ? "worktree-remove" : "remove-dir", {
        ageDays: measuredAge,
      }),
  });
});

const mergedPreviewCandidates = Effect.fnUntraced(function* (
  checkoutRoot: string,
  policy: ReapPolicy
): Effect.fn.Return<ReadonlyArray<ResidueReapCandidate>, never, DiscoveryRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const yeetRoot = path.join(checkoutRoot, ".beep", "yeet");
  const exists = yield* fs.exists(yeetRoot).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return A.empty();
  }
  if (O.isNone(yield* canonicalDirectory(checkoutRoot, yeetRoot))) {
    return [candidate(yeetRoot, yeetRoot, "merged-preview", "skip", { skipReason: "wrong-shape" })];
  }
  const listing = yield* Effect.result(fs.readDirectory(yeetRoot));
  if (Result.isFailure(listing)) {
    return [candidate(yeetRoot, yeetRoot, "merged-preview", "skip", { skipReason: "census-failed" })];
  }
  return yield* Effect.forEach(
    A.filter(listing.success, isMergedPreviewName),
    (name) => mergedPreviewCandidate(yeetRoot, path.join(yeetRoot, name), checkoutRoot, policy),
    { concurrency: 4 }
  );
});

const turboRunEntry = Effect.fnUntraced(function* (
  runsRoot: string,
  entryPath: string,
  thresholdDays: number,
  nowMillis: number
): Effect.fn.Return<ResidueReapCandidate, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (O.isSome(yield* fs.readLink(entryPath).pipe(Effect.option))) {
    return candidate(runsRoot, entryPath, "turbo-runs", "skip", { skipReason: "wrong-shape" });
  }
  const stat = yield* fs.stat(entryPath).pipe(Effect.option);
  if (O.isNone(stat)) {
    return candidate(runsRoot, entryPath, "turbo-runs", "skip", { skipReason: "stat-failed" });
  }
  return Str.Equivalence(stat.value.type, "File") && Str.endsWith(TURBO_RUN_SUMMARY_SUFFIX)(entryPath)
    ? classifyFile(path, runsRoot, entryPath, "turbo-runs", stat.value, nowMillis, thresholdDays)
    : candidate(runsRoot, entryPath, "turbo-runs", "skip", { skipReason: "wrong-shape" });
});

const turboRunCandidates = Effect.fnUntraced(function* (
  checkoutRoot: string,
  policy: ReapPolicy
): Effect.fn.Return<ReadonlyArray<ResidueReapCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runsRoot = path.join(checkoutRoot, ".turbo", "runs");
  const exists = yield* fs.exists(runsRoot).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return A.empty();
  }
  // Same constraint as the per-checkout cache: a linked runs root must never let
  // removal reach files the report attributes to this checkout.
  if (O.isNone(yield* canonicalDirectory(checkoutRoot, runsRoot))) {
    return [candidate(runsRoot, runsRoot, "turbo-runs", "skip", { skipReason: "wrong-shape" })];
  }
  const listing = yield* Effect.result(fs.readDirectory(runsRoot));
  if (Result.isFailure(listing)) {
    return [candidate(runsRoot, runsRoot, "turbo-runs", "skip", { skipReason: "census-failed" })];
  }
  return yield* Effect.forEach(
    listing.success,
    (name) => turboRunEntry(runsRoot, path.join(runsRoot, name), policy.turboRunsMaxAgeDays, policy.nowMillis),
    { concurrency: 8 }
  );
});

const sharedTurboGroupKey = (name: string): O.Option<{ readonly key: string; readonly isArchive: boolean }> =>
  pipe(
    A.findFirst(
      SHARED_TURBO_MEMBER_SUFFIXES,
      (suffix) => Str.endsWith(suffix)(name) && Str.length(name) > Str.length(suffix)
    ),
    O.map((suffix) => ({
      key: Str.slice(0, Str.length(name) - Str.length(suffix))(name),
      isArchive: Str.Equivalence(suffix, SHARED_TURBO_ARCHIVE_SUFFIX),
    }))
  );

const sharedTurboEntry = Effect.fnUntraced(function* (
  cacheRoot: string,
  name: string
): Effect.fn.Return<Result.Result<SharedTurboMember, ResidueReapCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entryPath = path.join(cacheRoot, name);
  const skip = (skipReason: ResidueReapSkipReason): Result.Result<SharedTurboMember, ResidueReapCandidate> =>
    Result.fail(candidate(cacheRoot, entryPath, "shared-turbo-cache", "skip", { skipReason }));
  const key = sharedTurboGroupKey(name);
  if (O.isNone(key) || O.isSome(yield* fs.readLink(entryPath).pipe(Effect.option))) {
    return skip("wrong-shape");
  }
  const stat = yield* fs.stat(entryPath).pipe(Effect.option);
  if (O.isNone(stat)) {
    return skip("stat-failed");
  }
  if (!Str.Equivalence(stat.value.type, "File")) {
    return skip("wrong-shape");
  }
  const modified = mtimeMillis(stat.value);
  if (O.isNone(modified)) {
    return skip("stat-failed");
  }
  return Result.succeed({
    bytes: bytesFromInfo(stat.value),
    groupKey: key.value.key,
    isArchive: key.value.isArchive,
    mtimeMillis: modified.value,
    path: entryPath,
  });
});

const sharedTurboGroup = (nowMillis: number, members: A.NonEmptyReadonlyArray<SharedTurboMember>): SharedTurboGroup => {
  const newestMillis = A.reduce(members, 0, (newest, member) => N.max(newest, member.mtimeMillis));
  return {
    ageDays: ageDays(nowMillis, newestMillis),
    bytes: A.reduce(members, 0, (total, member) => total + member.bytes),
    key: A.headNonEmpty(members).groupKey,
    members: A.sort(
      members,
      Order.mapInput(N.Order, (member: SharedTurboMember) => (member.isArchive ? 0 : 1))
    ),
    newestMillis,
  };
};

const byNewestWrite = Order.mapInput(N.Order, (group: SharedTurboGroup) => group.newestMillis);

// Pass 2 of the shared-cache eviction: walk the age survivors oldest-written first and
// evict until the remainder fits the budget, never touching an entry under the floor.
const evictToBudget = (survivors: ReadonlyArray<SharedTurboGroup>, maxBytes: number): SizeEviction =>
  A.reduce(
    A.sort(survivors, byNewestWrite),
    {
      remaining: A.reduce(survivors, 0, (total, group) => total + group.bytes),
      verdicts: A.empty(),
    } satisfies SizeEviction,
    (state: SizeEviction, group): SizeEviction =>
      state.remaining > maxBytes && group.ageDays >= SHARED_TURBO_EVICTION_FLOOR_DAYS
        ? { remaining: state.remaining - group.bytes, verdicts: A.append(state.verdicts, [group, O.none()] as const) }
        : {
            remaining: state.remaining,
            verdicts: A.append(state.verdicts, [
              group,
              O.some<ResidueReapSkipReason>(
                group.ageDays >= SHARED_TURBO_EVICTION_FLOOR_DAYS ? "within-size-budget" : "too-young"
              ),
            ] as const),
          }
  );

const sharedTurboCacheCandidates = Effect.fnUntraced(function* (
  cacheRoot: string,
  policy: ReapPolicy,
  maxAgeDays: number,
  maxBytes: number
): Effect.fn.Return<Discovered, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs.exists(cacheRoot).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return { candidates: A.empty(), warnings: A.empty() };
  }
  if (!path.isAbsolute(cacheRoot) || O.isNone(yield* canonicalDirectory(policy.homeBoundary, cacheRoot))) {
    return {
      candidates: [candidate(cacheRoot, cacheRoot, "shared-turbo-cache", "skip", { skipReason: "path-changed" })],
      warnings: [`Skipped shared Turbo cache ${cacheRoot}: it is not a directory inside the home root.`],
    };
  }
  const listing = yield* Effect.result(fs.readDirectory(cacheRoot));
  if (Result.isFailure(listing)) {
    return {
      candidates: [candidate(cacheRoot, cacheRoot, "shared-turbo-cache", "skip", { skipReason: "census-failed" })],
      warnings: A.empty(),
    };
  }
  const entries = yield* Effect.forEach(listing.success, (name) => sharedTurboEntry(cacheRoot, name), {
    concurrency: 8,
  });
  const groups = A.map(R.values(A.groupBy(A.getSuccesses(entries), (member) => member.groupKey)), (members) =>
    sharedTurboGroup(policy.nowMillis, members)
  );
  const aged = A.filter(groups, (group) => group.ageDays >= maxAgeDays);
  const survivors = A.filter(groups, (group) => group.ageDays < maxAgeDays);
  const verdicts = A.sort(
    A.appendAll(
      A.map(aged, (group) => [group, O.none<ResidueReapSkipReason>()] as const),
      evictToBudget(survivors, maxBytes).verdicts
    ),
    Order.mapInput(byNewestWrite, ([group]: readonly [SharedTurboGroup, O.Option<ResidueReapSkipReason>]) => group)
  );
  const grouped = A.flatMap(verdicts, ([group, skipReason]) =>
    A.map(group.members, (member) =>
      candidate(cacheRoot, member.path, "shared-turbo-cache", O.isSome(skipReason) ? "skip" : "remove-file", {
        ageDays: group.ageDays,
        bytes: member.bytes,
        groupKey: group.key,
        mtimeMillis: member.mtimeMillis,
        ...O.getSomesStruct({ skipReason }),
      })
    )
  );
  return { candidates: A.appendAll(A.getFailures(entries), grouped), warnings: A.empty() };
});

// Views cited by any qualification receipt, resolved; `None` when any receipt is
// unreadable or malformed, so a view is never reaped on incomplete evidence.
const citedQualificationViews = Effect.fnUntraced(function* (
  evidenceRoot: string
): Effect.fn.Return<O.Option<ReadonlyArray<string>>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs.exists(evidenceRoot).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return O.some(A.empty());
  }
  const listing = yield* fs.readDirectory(evidenceRoot).pipe(Effect.option);
  if (O.isNone(listing)) {
    return O.none();
  }
  const citations = yield* Effect.forEach(
    listing.value,
    Effect.fnUntraced(function* (name) {
      const receiptPath = path.join(evidenceRoot, name, "dependencies.json");
      if (!(yield* fs.exists(receiptPath).pipe(Effect.orElseSucceed(() => false)))) {
        return O.some(O.none<string>());
      }
      const receipt = yield* fs
        .readFileString(receiptPath)
        .pipe(Effect.flatMap(decodeQualificationViewReceiptJson), Effect.option);
      return O.isSome(receipt) ? O.some(O.some(yield* resolvedOrLexical(receipt.value.directory))) : O.none();
    }),
    { concurrency: 4 }
  );
  return O.map(O.all(citations), A.getSomes);
});

const qualificationView = Effect.fnUntraced(function* (
  viewsRoot: string,
  candidatePath: string
): Effect.fn.Return<Result.Result<QualificationView, ResidueReapCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const shape = yield* canonicalDirectoryShape(viewsRoot, candidatePath);
  if (Result.isFailure(shape)) {
    return Result.fail(
      candidate(viewsRoot, candidatePath, "qualification-views", "skip", { skipReason: shape.failure })
    );
  }
  // A view's root mtime is its creation time: the archive copy preserves source mtimes
  // inside, and a census would overflow on the full node_modules tree anyway.
  const modified = yield* rootModifiedMillis(shape.success);
  return O.match(modified, {
    onNone: (): Result.Result<QualificationView, ResidueReapCandidate> =>
      Result.fail(candidate(viewsRoot, shape.success, "qualification-views", "skip", { skipReason: "stat-failed" })),
    onSome: (modifiedMillis): Result.Result<QualificationView, ResidueReapCandidate> =>
      Result.succeed({ modifiedMillis, path: shape.success }),
  });
});

const assessQualificationViews = Effect.fnUntraced(function* (
  qualificationRoot: string,
  policy: ReapPolicy,
  selected: (candidatePath: string) => boolean
): Effect.fn.Return<ReadonlyArray<ResidueReapCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const viewsRoot = path.join(qualificationRoot, "dependencies");
  const exists = yield* fs.exists(viewsRoot).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return A.empty();
  }
  if (O.isNone(yield* canonicalDirectory(policy.homeBoundary, viewsRoot))) {
    return [candidate(viewsRoot, viewsRoot, "qualification-views", "skip", { skipReason: "path-changed" })];
  }
  const listing = yield* Effect.result(fs.readDirectory(viewsRoot));
  if (Result.isFailure(listing)) {
    return [candidate(viewsRoot, viewsRoot, "qualification-views", "skip", { skipReason: "census-failed" })];
  }
  const views = yield* Effect.forEach(
    A.filter(listing.success, Str.startsWith(QUALIFICATION_VIEW_PREFIX)),
    (name) => qualificationView(viewsRoot, path.join(viewsRoot, name)),
    { concurrency: 4 }
  );
  const ordered = A.sort(
    A.getSuccesses(views),
    Order.flip(Order.mapInput(N.Order, (view: QualificationView) => view.modifiedMillis))
  );
  const cited = yield* citedQualificationViews(path.join(qualificationRoot, "evidence"));
  const assessed = yield* Effect.forEach(
    A.filter(
      A.map(ordered, (view, index) => [view, index] as const),
      ([view]) => selected(view.path)
    ),
    Effect.fnUntraced(function* ([view, index]) {
      const measuredAge = ageDays(policy.nowMillis, view.modifiedMillis);
      const skip = (skipReason: ResidueReapSkipReason): ResidueReapCandidate =>
        candidate(viewsRoot, view.path, "qualification-views", "skip", { ageDays: measuredAge, skipReason });
      if (O.isNone(cited)) {
        return skip("census-failed");
      }
      if (index < policy.qualificationViewsKeep) {
        return skip("kept-newest");
      }
      if (A.contains(cited.value, yield* resolvedOrLexical(view.path))) {
        return skip("evidence-referenced");
      }
      const liveness = yield* directoryLivenessSkip(view.path, policy.cwdProbe);
      return O.isSome(liveness)
        ? skip(liveness.value)
        : candidate(viewsRoot, view.path, "qualification-views", "remove-dir", { ageDays: measuredAge });
    }),
    { concurrency: 1 }
  );
  return A.appendAll(
    A.filter(A.getFailures(views), (entry) => selected(entry.path)),
    assessed
  );
});

const reassessSessionFile = Effect.fnUntraced(function* (
  assessed: ResidueReapCandidate,
  nowMillis: number,
  maxAgeDays: number
): Effect.fn.Return<ResidueReapCandidate, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (protectedSessionName(path, assessed.path) || O.isSome(yield* fs.readLink(assessed.path).pipe(Effect.option))) {
    return ResidueReapCandidate.make({ ...assessed, action: "skip", skipReason: "path-changed" });
  }
  const stat = yield* fs.stat(assessed.path).pipe(Effect.option);
  return O.filter(stat, (info) => Str.Equivalence(info.type, "File")).pipe(
    O.map((info) => classifyFile(path, assessed.root, assessed.path, assessed.reapClass, info, nowMillis, maxAgeDays)),
    O.getOrElse(() => ResidueReapCandidate.make({ ...assessed, action: "skip", skipReason: "path-changed" }))
  );
});

const reassessTurboEntry = Effect.fnUntraced(function* (
  assessed: ResidueReapCandidate,
  nowMillis: number,
  turboMaxAgeDays: number,
  entryCap: number,
  cwdProbe: CwdProbe
): Effect.fn.Return<
  ResidueReapCandidate,
  never,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stat = yield* fs.stat(assessed.path).pipe(Effect.option);
  if (O.isNone(stat) || O.isSome(yield* fs.readLink(assessed.path).pipe(Effect.option))) {
    return ResidueReapCandidate.make({ ...assessed, action: "skip", skipReason: "path-changed" });
  }
  if (Str.Equivalence(stat.value.type, "Directory")) {
    return yield* directoryCandidate(
      assessed.root,
      assessed.path,
      assessed.reapClass,
      nowMillis,
      turboMaxAgeDays,
      entryCap,
      cwdProbe
    );
  }
  return Str.Equivalence(stat.value.type, "File")
    ? classifyFile(path, assessed.root, assessed.path, assessed.reapClass, stat.value, nowMillis, turboMaxAgeDays)
    : ResidueReapCandidate.make({ ...assessed, action: "skip", skipReason: "path-changed" });
});

const pathChanged = (assessed: ResidueReapCandidate): ResidueReapCandidate =>
  ResidueReapCandidate.make({ ...assessed, action: "skip", skipReason: "path-changed" });

const reassessTurboRun = Effect.fnUntraced(function* (
  assessed: ResidueReapCandidate,
  policy: ReapPolicy
): Effect.fn.Return<ResidueReapCandidate, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(assessed.path).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return pathChanged(assessed);
  }
  return yield* turboRunEntry(assessed.root, assessed.path, policy.turboRunsMaxAgeDays, policy.nowMillis);
});

// The eviction set is a snapshot and is not recomputed here: an entry turbo rewrote
// since the assessment (a changed mtime) is kept, and new writes only overshoot the cap.
const reassessSharedTurboMember = Effect.fnUntraced(function* (
  assessed: ResidueReapCandidate
): Effect.fn.Return<ResidueReapCandidate, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  if (O.isSome(yield* fs.readLink(assessed.path).pipe(Effect.option))) {
    return pathChanged(assessed);
  }
  const stat = yield* fs.stat(assessed.path).pipe(Effect.option);
  const unchanged = O.exists(
    stat,
    (info) =>
      Str.Equivalence(info.type, "File") &&
      O.exists(mtimeMillis(info), (modified) =>
        O.exists(O.fromUndefinedOr(assessed.mtimeMillis), (assessedMillis) => modified === assessedMillis)
      )
  );
  return unchanged ? assessed : pathChanged(assessed);
});

const reassessMergedPreview = Effect.fnUntraced(function* (
  assessed: ResidueReapCandidate,
  policy: ReapPolicy
): Effect.fn.Return<ResidueReapCandidate, never, DiscoveryRequirements> {
  const checkoutRoot = O.fromUndefinedOr(assessed.checkoutRoot);
  if (O.isNone(checkoutRoot)) {
    return pathChanged(assessed);
  }
  return yield* mergedPreviewCandidate(assessed.root, assessed.path, checkoutRoot.value, policy);
});

// Re-lists the views so newest-N and the cited set reflect the tree at apply time.
const reassessQualificationView = Effect.fnUntraced(function* (
  assessed: ResidueReapCandidate,
  policy: ReapPolicy
): Effect.fn.Return<ResidueReapCandidate, never, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const rechecked = yield* assessQualificationViews(path.dirname(assessed.root), policy, (candidatePath) =>
    Str.Equivalence(candidatePath, assessed.path)
  );
  return O.getOrElse(A.head(rechecked), () => pathChanged(assessed));
});

const reassessCandidate = Effect.fnUntraced(function* (
  assessed: ResidueReapCandidate,
  policy: ReapPolicy
): Effect.fn.Return<ResidueReapCandidate, never, DiscoveryRequirements> {
  const path = yield* Path.Path;
  if (Str.Equivalence(assessed.action, "skip")) {
    return assessed;
  }
  if (!pathIsStrictlyWithin(path, assessed.root, assessed.path)) {
    return pathChanged(assessed);
  }
  const rechecked = yield* Match.value(assessed.reapClass).pipe(
    Match.when(isCheckoutResidueClass, () => assessCheckoutResidue(assessed, policy)),
    Match.when("codex-sessions", () => reassessSessionFile(assessed, policy.nowMillis, policy.maxAgeDays)),
    Match.when("turbo-cache", () =>
      reassessTurboEntry(assessed, policy.nowMillis, policy.turboMaxAgeDays, policy.entryCap, policy.cwdProbe)
    ),
    Match.when("turbo-runs", () => reassessTurboRun(assessed, policy)),
    Match.when("shared-turbo-cache", () => reassessSharedTurboMember(assessed)),
    Match.when("merged-preview", () => reassessMergedPreview(assessed, policy)),
    Match.when("qualification-views", () => reassessQualificationView(assessed, policy)),
    Match.whenOr("codex-worktrees", "beep-cache-disposable", (reapClass) =>
      directoryCandidate(
        assessed.root,
        assessed.path,
        reapClass,
        policy.nowMillis,
        policy.maxAgeDays,
        policy.entryCap,
        policy.cwdProbe
      )
    ),
    Match.exhaustive
  );
  // Reassessment rebuilds candidates from the filesystem; the owning checkout is
  // discovery context, so it carries over for the removal and the report.
  return ResidueReapCandidate.make({
    ...rechecked,
    ...O.getSomesStruct({
      checkoutRoot: O.fromUndefinedOr(assessed.checkoutRoot),
      recoveryDestination: O.fromUndefinedOr(assessed.recoveryDestination),
    }),
  });
});

// Internal apply-time shape (never decoded or serialized): the resolved candidate and
// the identity of the inode every apply-time check ran against.
type ResolvedApplyTarget = {
  readonly candidate: ResidueReapCandidate;
  readonly identity: DirectoryIdentity;
};

type ApplyRemovalOutcome = BoundRemovalOutcome | "worktree-remove-failed";

const resolveApplyTarget = Effect.fnUntraced(function* (
  assessed: ResidueReapCandidate,
  outerBoundary: O.Option<string>
): Effect.fn.Return<O.Option<ResolvedApplyTarget>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // The candidate itself must not be a link (its target was never assessed), and its
  // ancestors are resolved exactly once here so that every apply-time check AND the
  // removal share one symlink-free path: an ancestor link repointed after reassessment
  // can then neither redirect the checks to one directory nor the deletion to another.
  if (O.isSome(yield* fs.readLink(assessed.path).pipe(Effect.option))) {
    return O.none();
  }
  const root = yield* fs.realPath(assessed.root).pipe(Effect.option);
  const target = yield* fs.realPath(assessed.path).pipe(Effect.option);
  if (O.isNone(root) || O.isNone(target) || !pathIsStrictlyWithin(path, root.value, target.value)) {
    return O.none();
  }
  if (O.isNone(outerBoundary) || !pathIsStrictlyWithin(path, outerBoundary.value, root.value)) {
    return O.none();
  }
  // The inode behind the resolved path is what the removal is later bound to, so an
  // entry renamed into that path after the checks carries another identity and is
  // never touched.
  const identity = O.flatMap(yield* fs.stat(target.value).pipe(Effect.option), directoryIdentity);
  return O.map(identity, (bound) => ({
    candidate: ResidueReapCandidate.make({ ...assessed, root: root.value, path: target.value }),
    identity: bound,
  }));
});

// `git worktree remove --force` resolves the path itself, so it cannot be bound to the
// checked inode; the identity check runs immediately before it. A failed teardown is
// reported and left in place: falling back to a raw tree removal would strand the
// worktree registration and bypass git's own bookkeeping.
const removeRegisteredWorktree = Effect.fnUntraced(function* (
  candidate: ResidueReapCandidate
): Effect.fn.Return<ApplyRemovalOutcome, never, DiscoveryRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const checkoutRoot = O.fromUndefinedOr(candidate.checkoutRoot);
  if (O.isNone(checkoutRoot)) {
    return "worktree-remove-failed";
  }
  const removed = yield* removeGitWorktree(checkoutRoot.value, candidate.path);
  const remains = yield* fs.exists(candidate.path).pipe(Effect.orElseSucceed(() => true));
  return removed && !remains ? "removed" : "worktree-remove-failed";
});

const removeResolvedCandidate = Effect.fnUntraced(function* (
  candidate: ResidueReapCandidate,
  identity: DirectoryIdentity
): Effect.fn.Return<ApplyRemovalOutcome, never, DiscoveryRequirements | Scope.Scope> {
  if (ResidueReapAction.is["remove-file"](candidate.action)) {
    // A file is unlinked through its bound parent, and only while the entry there is
    // still the regular file whose inode the checks ran against.
    return yield* unlinkBoundFile(candidate.path, identity);
  }
  // A tree is emptied through a descriptor bound to the inode the checks ran against.
  // The O_NOFOLLOW open refuses a link swapped into the path, and a directory renamed
  // into it has another identity; either is left alone and reported as a changed path.
  const handle = yield* openDirectoryHandle(candidate.path);
  if (O.isNone(handle) || !sameDirectoryIdentity(handle.value.identity, identity)) {
    return "identity-changed";
  }
  return ResidueReapAction.is["worktree-remove"](candidate.action)
    ? yield* removeRegisteredWorktree(candidate)
    : yield* removeThroughDirectoryHandle(handle.value, candidate.path);
});

const applyCandidate = Effect.fnUntraced(function* (
  assessed: ResidueReapCandidate,
  outerBoundary: O.Option<string>,
  policy: ReapPolicy,
  checkpoint: (phase: "intent" | "moved") => Effect.Effect<void>
): Effect.fn.Return<AppliedCandidate, never, DiscoveryRequirements | ResidueArchive> {
  // Reports keep speaking the operator's lexical path even though the checks and the
  // removal below run on the resolved one.
  const reported = (candidate: ResidueReapCandidate): ResidueReapCandidate =>
    ResidueReapCandidate.make({ ...candidate, root: assessed.root, path: assessed.path });
  const resolved = yield* resolveApplyTarget(assessed, outerBoundary);
  if (O.isNone(resolved)) {
    return {
      candidate: pathChanged(assessed),
      reaped: false,
      reclaimedBytes: 0,
      warnings: [`Skipped ${assessed.path}: path changed before removal.`],
    };
  }
  const rechecked = yield* reassessCandidate(resolved.value.candidate, policy);
  if (Str.Equivalence(rechecked.action, "skip")) {
    return {
      candidate: reported(rechecked),
      reaped: false,
      reclaimedBytes: 0,
      warnings: Str.Equivalence(assessed.action, "skip")
        ? A.empty()
        : [`Skipped ${assessed.path}: eligibility changed before removal.`],
    };
  }
  const skipped = (skipReason: ResidueReapSkipReason, warning: string): AppliedCandidate => ({
    candidate: reported(ResidueReapCandidate.make({ ...rechecked, action: "skip", skipReason })),
    reaped: false,
    reclaimedBytes: 0,
    warnings: [warning],
  });
  if (ResidueReapAction.is["archive-move"](rechecked.action)) {
    const archive = yield* ResidueArchive;
    const destination = O.fromUndefinedOr(assessed.recoveryDestination);
    if (O.isNone(destination)) return skipped("path-changed", "Archive destination missing.");
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const archiveParent = yield* fs.realPath(path.dirname(destination.value)).pipe(Effect.option);
    if (O.isNone(archiveParent)) return skipped("path-changed", "Archive parent disappeared.");
    const resolvedDestination = path.join(archiveParent.value, path.basename(destination.value));
    const journalPath = `${resolvedDestination}.intent.json`;
    const intent = ResidueArchiveIntent.make({
      source: rechecked.path,
      lexicalSource: assessed.path,
      destination: resolvedDestination,
      dev: resolved.value.identity.dev,
      ino: resolved.value.identity.ino,
      phase: "intent",
    });
    const result = yield* Effect.result(
      Effect.gen(function* () {
        yield* archive.publish(journalPath, yield* encodeIntent(intent), "residue archive intent");
        yield* checkpoint("intent");
        const moved = yield* archive
          .move(intent.source, intent.destination, resolved.value.identity)
          .pipe(Effect.scoped);
        if (!BoundMoveOutcome.is.moved(moved) && !BoundMoveOutcome.is["moved-unsynced"](moved))
          return yield* ResidueArchiveError.make({
            message: `Archive move refused: ${moved}`,
            skipReason: BoundMoveOutcome.is["identity-changed"](moved) ? "path-changed" : "removal-failed",
          });
        // Reuse the Worktree retirement fence's attachment scanner after rename:
        // processes follow the inode, so no live writer can hide behind the old path.
        const attachments = yield* scanProcessAttachments({
          directory: intent.destination,
          kinds: ProcessAttachmentKind.literals,
        });
        if (O.isNone(attachments) || A.isReadonlyArrayNonEmpty(attachments.value)) {
          const rolledBack = yield* archive
            .move(intent.destination, intent.source, resolved.value.identity)
            .pipe(Effect.scoped);
          const restored = BoundMoveOutcome.is.moved(rolledBack) || BoundMoveOutcome.is["moved-unsynced"](rolledBack);
          if (restored) {
            yield* syncDirectory(path.dirname(intent.source));
            yield* syncDirectory(path.dirname(intent.destination));
          }
          yield* archive.publish(
            journalPath,
            yield* encodeIntent(ResidueArchiveIntent.make({ ...intent, phase: restored ? "restored" : "fenced-live" })),
            "residue live fence refusal"
          );
          return yield* ResidueArchiveError.make({
            message: `Archive has a live or unknown writer; rollback outcome: ${rolledBack}`,
            skipReason: "lock-held",
          });
        }
        yield* syncDirectory(path.dirname(intent.source));
        yield* syncDirectory(path.dirname(intent.destination));
        yield* archive.publish(
          journalPath,
          yield* encodeIntent(ResidueArchiveIntent.make({ ...intent, phase: "moved" })),
          "residue archive move"
        );
        yield* checkpoint("moved");
        return true;
      })
    );
    if (Result.isFailure(result)) {
      const journal = yield* fs.readFileString(journalPath).pipe(Effect.flatMap(decodeIntent), Effect.option);
      const phase = O.match(journal, { onNone: () => "unpublished", onSome: (row) => row.phase });
      return skipped(
        isResidueArchiveError(result.failure)
          ? optionOr(result.failure.skipReason, "removal-failed")
          : "removal-failed",
        `${result.failure.message}; phase=${phase}; intent=${journalPath}; resume or restore this run.`
      );
    }
    // Archive movement frees no filesystem blocks. Attribute moved bytes separately
    // via the candidate metadata; reclaimedBytes remains zero until an owner purges.
    return {
      candidate: reported(ResidueReapCandidate.make({ ...rechecked, recoveryDestination: destination.value })),
      reaped: true,
      reclaimedBytes: 0,
      warnings: [],
    };
  }
  const outcome = yield* removeResolvedCandidate(rechecked, resolved.value.identity).pipe(Effect.scoped);
  return Match.value(outcome).pipe(
    Match.when("removed", () => ({
      candidate: reported(rechecked),
      reaped: true,
      reclaimedBytes: O.getOrElse(O.fromUndefinedOr(rechecked.bytes), () => 0),
      warnings: A.empty<string>(),
    })),
    Match.when("identity-changed", () =>
      skipped("path-changed", `Skipped ${assessed.path}: path changed before removal.`)
    ),
    Match.when("removal-failed", () => skipped("removal-failed", `Failed to remove ${assessed.path}.`)),
    Match.when("worktree-remove-failed", () =>
      skipped("worktree-remove-failed", `Failed to remove worktree ${assessed.path}; it was left in place.`)
    ),
    Match.exhaustive
  );
});

type CheckoutRoot = {
  readonly lexical: string;
  readonly real: string;
};

// One entry per distinct real checkout: a clone reached through two lexical paths is
// swept once, under the spelling the caller named first; the result is sorted.
const distinctCheckoutRoots = Effect.fnUntraced(function* (
  roots: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const resolved = yield* Effect.forEach(
    A.map(roots, (root) => path.resolve(root)),
    Effect.fnUntraced(function* (lexical): Effect.fn.Return<CheckoutRoot, never, FileSystem.FileSystem | Path.Path> {
      return { lexical, real: yield* resolvedOrLexical(lexical) };
    })
  );
  return A.sort(
    A.map(
      A.dedupeWith(resolved, (left, right) => Str.Equivalence(left.real, right.real)),
      (root) => root.lexical
    ),
    Order.String
  );
});

// Checkout liveness is deliberately conservative: seven days of newest .beep
// writes count as live. Retention/journal writes themselves do not renew activity.
const CHECKOUT_LIVE_DAYS = 7;
const BookkeepingDirectory = LiteralKit(["residue-reap", "retention"]);
const CheckoutContainer = LiteralKit(["qa", "qualification", "ci"]);
const NonTerminalState = LiteralKit(["active", "paused", "unknown", "unverified"]);
const isBookkeepingDirectory = S.is(BookkeepingDirectory);
const isCheckoutContainer = S.is(CheckoutContainer);
const isNonTerminalState = S.is(NonTerminalState);
const decodeRuling = S.decodeEffect(S.fromJsonString(ResidueRetentionRuling));
const rulingEquivalent = S.toEquivalence(ResidueRetentionRuling);
const decodeDrafts = S.decodeEffect(S.fromJsonString(ReplyDrafts));
const decodeLegacyEmptyDrafts = S.decodeEffect(
  S.fromJsonString(S.Union([S.Array(S.Never), S.Record(S.String, S.Never)]))
);

const ProtectedResidueName = LiteralKit([
  "inbox",
  "reply-drafts.json",
  "packets",
  "lane-proofs.json",
  "proof-ledger.ndjson",
  "residue-reap",
  "retention",
]);
const isProtectedResidueName = S.is(ProtectedResidueName);
const decodeRulings = S.decodeEffect(S.fromJsonString(S.Array(ResidueRetentionRuling)));
const encodeIntent = S.encodeEffect(S.fromJsonString(ResidueArchiveIntent));
const isResidueArchiveError = S.is(ResidueArchiveError);
const decodeIntent = S.decodeEffect(S.fromJsonString(ResidueArchiveIntent));
const encodeReport = S.encodeEffect(S.fromJsonString(ResidueReapReport));
const decodeReport = S.decodeEffect(S.fromJsonString(ResidueReapReport));

const syncDirectory = (directory: string) => Effect.scoped(syncDirectoryHandle(directory));
const publishArchiveText = Effect.fnUntraced(function* (target: string, content: string, label: string) {
  const path = yield* Path.Path;
  yield* publishJournalTextAtomically(target, content, label);
  // Unlike general journals, archive intents require this sync to succeed before
  // the source inode can move. Failure leaves the original source untouched.
  yield* syncDirectory(path.dirname(target));
});
const ensureArchiveDirectories = Effect.fnUntraced(function* (checkout: string, runId?: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dirs = [path.join(checkout, ".beep"), path.join(checkout, ".beep", "residue-reap")];
  const all = O.match(O.fromUndefinedOr(runId), {
    onNone: () => dirs,
    onSome: (id) =>
      A.appendAll(dirs, [
        path.join(checkout, ".beep", "residue-reap", id),
        path.join(checkout, ".beep", "residue-reap", id, "archive"),
      ]),
  });
  yield* Effect.forEach(
    all,
    Effect.fnUntraced(function* (dir) {
      if (O.isSome(yield* fs.readLink(dir).pipe(Effect.option)))
        return yield* ResidueArchiveError.make({ message: "Archive directory is a symlink" });
      if (!(yield* fs.exists(dir)))
        yield* fs
          .makeDirectory(dir)
          .pipe(
            Effect.catch((error) =>
              Str.Equivalence(error.reason._tag, "AlreadyExists") ? Effect.void : Effect.fail(error)
            )
          );
      if (O.isSome(yield* fs.readLink(dir).pipe(Effect.option)))
        return yield* ResidueArchiveError.make({ message: "Archive directory became a symlink" });
      if (O.isNone(yield* canonicalDirectory(checkout, dir)))
        return yield* ResidueArchiveError.make({ message: "Archive directory escaped checkout" });
      yield* syncDirectory(dir);
      yield* syncDirectory(path.dirname(dir));
    }),
    { discard: true }
  );
});

// The service contract separates durable publication from the inode-bound fence.
// Tests inject checkpoints, never weaker production liveness decisions.
class ResidueArchive extends Context.Service<
  ResidueArchive,
  {
    readonly publish: (
      target: string,
      content: string,
      label: string
    ) => Effect.Effect<void, QualitySchedulerError | DirectoryHandleError>;
    readonly move: (
      source: string,
      destination: string,
      expected: DirectoryIdentity
    ) => Effect.Effect<BoundMoveOutcome, never, Scope.Scope>;
  }
>()($I`ResidueArchive`) {}
const makeResidueArchive = Effect.fnUntraced(function* () {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const crypto = yield* Crypto.Crypto;
  return ResidueArchive.of({
    publish: (target, content, label) =>
      publishArchiveText(target, content, label).pipe(
        Effect.provideService(Path.Path, path),
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Crypto.Crypto, crypto)
      ),
    move: (source, destination, expected) =>
      renameBoundEntry(source, destination, expected).pipe(Effect.provideService(Path.Path, path)),
  });
});

const classifyCheckoutName = (name: string): ResidueReapClass =>
  Match.value(name).pipe(
    Match.when("qa", () => CheckoutResidueClass.Enum["checkout-qa"]),
    Match.when(Str.startsWith("qualification"), () => CheckoutResidueClass.Enum["checkout-qualification"]),
    Match.when("ci", () => CheckoutResidueClass.Enum["checkout-generated"]),
    Match.when("yeet", () => CheckoutResidueClass.Enum["checkout-jobs"]),
    Match.when(Str.includes("worktree"), () => CheckoutResidueClass.Enum["checkout-ledgers"]),
    Match.whenOr("run", Str.endsWith(".pid"), () => CheckoutResidueClass.Enum["checkout-pids"]),
    Match.orElse(() => CheckoutResidueClass.Enum["checkout-material"])
  );

const readRuling = Effect.fnUntraced(function* (entry: ResidueReapCandidate) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const checkout = optionOr(entry.checkoutRoot, path.dirname(entry.root));
  const realRoot = yield* fs.realPath(checkout).pipe(Effect.option);
  const realTarget = yield* fs.realPath(entry.path).pipe(Effect.option);
  if (O.isNone(realRoot) || O.isNone(realTarget)) return O.none<ResidueRetentionRuling>();
  const realCheckout = realRoot.value;
  const realEntry = realTarget.value;
  const content = yield* fs
    .readFileString(path.join(realCheckout, ".beep", "retention", `${entry.reapClass}.json`))
    .pipe(Effect.option);
  if (O.isNone(content)) return O.none<ResidueRetentionRuling>();
  const rulings = yield* decodeRulings(content.value).pipe(Effect.option);
  return O.flatMap(
    rulings,
    A.findFirst((ruling) => Str.Equivalence(ruling.path, path.relative(realCheckout, realEntry)))
  );
});

// Index relative citations across all authored evidence roots. A failed listing or
// read fails the assessment closed, rather than treating an unreadable index as empty.
const citationSkip = Effect.fnUntraced(function* (checkout: string, candidatePath: string, authority: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const realRoot = yield* fs.realPath(checkout).pipe(Effect.option);
  const realTarget = yield* fs.realPath(candidatePath).pipe(Effect.option);
  if (O.isNone(realRoot) || O.isNone(realTarget)) return O.some<ResidueReapSkipReason>("path-changed");
  const relative = path.relative(realRoot.value, realTarget.value);
  const listing = yield* runRepoCommandCaptureRaw(
    "git",
    [
      "ls-files",
      "-s",
      "-z",
      "--",
      "goals",
      "explorations",
      "research",
      "harness-ledger",
      "standards",
      "docs",
      ".patterns",
      "AGENTS.md",
    ],
    checkout
  ).pipe(Effect.option);
  if (O.isNone(listing) || !N.Equivalence(listing.value.exitCode, 0) || listing.value.truncated)
    return O.some<ResidueReapSkipReason>("census-failed");
  const names = A.filter(
    A.getSomes(
      A.map(Str.split("\0")(listing.value.output), (record) =>
        O.flatMap(Str.match(/^100(?:644|755) [a-f0-9]+ [0-3]\t([\s\S]+)$/u)(record), (match) => A.get(match, 1))
      )
    ),
    (name) => !Str.Equivalence(name, authority)
  );
  const documents = yield* Effect.forEach(
    names,
    (name) => fs.readFileString(path.join(checkout, name)).pipe(Effect.option),
    { concurrency: 8 }
  );
  if (A.some(documents, O.isNone)) return O.some<ResidueReapSkipReason>("census-failed");
  // A citation to a parent protects descendants, and a descendant citation protects
  // the container. Match .beep-relative tails even when a receipt names another clone.
  const cited = A.some(A.getSomes(documents), (text) => {
    if (Str.includes(relative)(text)) return true;
    const references = O.getOrElse(Str.match(/\.beep\/[^\s"\x27`<>[\]()]+/gu)(text), () => A.empty<string>());
    return A.some(references, (reference) => {
      const ref = Str.replace(/[.,;:)/-]+$/u, "")(reference);
      return (
        Str.Equivalence(ref, relative) || Str.startsWith(`${ref}/`)(relative) || Str.startsWith(`${relative}/`)(ref)
      );
    });
  });
  return cited ? O.some<ResidueReapSkipReason>("evidence-referenced") : O.none<ResidueReapSkipReason>();
});

const checkoutSafetySkip = Effect.fnUntraced(function* (
  entry: ResidueReapCandidate,
  policy: ReapPolicy,
  authority: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const realRoot = yield* fs.realPath(optionOr(entry.checkoutRoot, path.dirname(entry.root))).pipe(Effect.option);
  if (O.isNone(realRoot)) return O.some<ResidueReapSkipReason>("path-changed");
  const checkout = realRoot.value;
  const beep = path.join(checkout, ".beep");
  const realEntry = yield* fs.realPath(entry.path).pipe(Effect.option);
  if (O.isNone(realEntry)) return O.some<ResidueReapSkipReason>("path-changed");
  // Prune durable archive/ruling bookkeeping before traversing or charging the cap.
  const pending = [""];
  const beneath: Array<string> = [];
  let opaque = HashSet.empty<string>();
  while (A.isReadonlyArrayNonEmpty(pending)) {
    const parent = pending.pop() ?? "";
    const listing = yield* fs.readDirectory(path.join(beep, parent)).pipe(Effect.option);
    if (O.isNone(listing)) return O.some<ResidueReapSkipReason>("census-failed");
    for (const child of listing.value) {
      if (Str.isEmpty(parent) && isBookkeepingDirectory(child)) continue;
      const name = path.join(parent, child);
      beneath.push(name);
      if (N.greaterThan(A.length(beneath), policy.entryCap)) return O.some<ResidueReapSkipReason>("census-overflow");
      const absolute = path.join(beep, name);
      if (O.isSome(yield* fs.readLink(absolute).pipe(Effect.option))) continue;
      const info = yield* fs.stat(absolute).pipe(Effect.option);
      if (O.isNone(info)) return O.some<ResidueReapSkipReason>("stat-failed");
      if (Str.Equivalence(info.value.type, "Directory")) {
        const markerExists = yield* fs.exists(path.join(absolute, ".git")).pipe(Effect.option);
        if (O.isNone(markerExists)) return O.some<ResidueReapSkipReason>("stat-failed");
        const embedded = markerExists.value;
        if (embedded && !Str.Equivalence(absolute, realEntry.value) && cwdWithin(path, absolute, realEntry.value))
          return O.some<ResidueReapSkipReason>("protected-name");
        if (!cwdWithin(path, realEntry.value, absolute) && (Str.Equivalence(child, "node_modules") || embedded)) {
          opaque = HashSet.add(opaque, name);
          if (embedded) {
            const marker = path.join(name, ".git");
            beneath.push(marker);
            opaque = HashSet.add(opaque, marker);
            if (N.greaterThan(A.length(beneath), policy.entryCap))
              return O.some<ResidueReapSkipReason>("census-overflow");
          }
        } else pending.push(name);
      }
    }
  }
  // Never archive a container holding protected state, even when a ruling exists.
  const protectedChild = A.some(beneath, (name) => {
    const absolute = path.join(beep, name);
    return cwdWithin(path, realEntry.value, absolute) && A.some(Str.split(path.sep)(name), isProtectedResidueName);
  });
  if (protectedChild) return O.some<ResidueReapSkipReason>("protected-name");
  for (const name of beneath) {
    const absolute = path.join(beep, name);
    if (O.isSome(yield* fs.readLink(absolute).pipe(Effect.option))) continue;
    if (Str.endsWith(".lock")(name)) {
      const holder = yield* runRepoCommandCapture("fuser", ["-s", "--", absolute], checkout).pipe(Effect.option);
      if (O.isNone(holder) || N.greaterThan(holder.value.exitCode, 1))
        return O.some<ResidueReapSkipReason>("process-probe-failed");
      if (N.Equivalence(holder.value.exitCode, 0)) return O.some<ResidueReapSkipReason>("lock-held");
    }
    if (Str.endsWith(".pid")(name) || Str.Equivalence(path.basename(name), "pid")) {
      const pid = yield* fs.readFileString(absolute).pipe(Effect.option);
      if (O.isNone(pid) || !isProcPidName(Str.trim(pid.value)))
        return O.some<ResidueReapSkipReason>("process-probe-failed");
      const alive = yield* policy.pidProbe(Str.trim(pid.value));
      if (O.isNone(alive)) return O.some<ResidueReapSkipReason>("process-probe-failed");
      if (alive.value) return O.some<ResidueReapSkipReason>("pid-alive");
    }
  }
  const drafts = path.join(beep, "yeet", "reply-drafts.json");
  if (yield* fs.exists(drafts).pipe(Effect.orElseSucceed(() => true))) {
    const draftText = yield* fs.readFileString(drafts).pipe(Effect.option);
    if (O.isNone(draftText)) return O.some<ResidueReapSkipReason>("draft-unresolved");
    const decoded = yield* decodeDrafts(draftText.value).pipe(Effect.option);
    const legacy = yield* decodeLegacyEmptyDrafts(draftText.value).pipe(Effect.option);
    if (!O.exists(decoded, (document) => A.isReadonlyArrayEmpty(document.drafts)) && O.isNone(legacy))
      return O.some<ResidueReapSkipReason>("draft-unresolved");
  }
  const holders = yield* scanProcessAttachments({ directory: entry.path, kinds: ProcessAttachmentKind.literals });
  if (O.isNone(holders)) return O.some<ResidueReapSkipReason>("process-probe-failed");
  if (A.isReadonlyArrayNonEmpty(holders.value)) return O.some<ResidueReapSkipReason>("lock-held");
  const live = yield* directoryLivenessSkip(checkout, policy.cwdProbe);
  if (O.isSome(live)) return live;
  const dirty = yield* gitCleanSkip([checkout]);
  if (O.isSome(dirty)) return dirty;
  for (const name of beneath) {
    if (O.isSome(yield* fs.readLink(path.join(beep, name)).pipe(Effect.option))) continue;
    const info = yield* fs.stat(path.join(beep, name)).pipe(Effect.option);
    if (O.isNone(info) || O.isNone(mtimeMillis(info.value))) return O.some<ResidueReapSkipReason>("stat-failed");
    if (
      (!Str.Equivalence(info.value.type, "Directory") || HashSet.has(opaque, name)) &&
      O.exists(mtimeMillis(info.value), (time) => ageDays(policy.nowMillis, time) < CHECKOUT_LIVE_DAYS)
    )
      return O.some<ResidueReapSkipReason>("checkout-recent-write");
  }
  return yield* citationSkip(checkout, entry.path, authority);
});

const assessCheckoutResidue = Effect.fnUntraced(function* (entry: ResidueReapCandidate, policy: ReapPolicy) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ruling = yield* readRuling(entry);
  const info = yield* fs.stat(entry.path).pipe(Effect.option);
  const tree = O.exists(info, (stat) => Str.Equivalence(stat.type, "Directory"))
    ? yield* censusDirectory(entry.path, policy.entryCap)
    : emptyCensus();
  const bytes = O.isSome(info) && Str.Equivalence(info.value.type, "File") ? bytesFromInfo(info.value) : tree.bytes;
  const apparent = yield* runRepoCommandCapture(
    "du",
    ["-B1", "--apparent-size", "-s", "--", entry.path],
    optionOr(entry.checkoutRoot, entry.root)
  ).pipe(Effect.option);
  const apparentBytes = O.flatMap(apparent, (capture) =>
    N.Equivalence(capture.exitCode, 0)
      ? O.flatMap(Str.match(/^\s*(\d+)/u)(capture.output), (match) => O.flatMap(A.get(match, 1), N.parse))
      : O.none()
  );
  const btrfs = yield* runRepoCommandCapture(
    "btrfs",
    ["filesystem", "du", "--raw", "-s", entry.path],
    optionOr(entry.checkoutRoot, entry.root)
  ).pipe(Effect.option);
  const exclusive = O.flatMap(btrfs, (capture) =>
    N.Equivalence(capture.exitCode, 0)
      ? O.flatMap(Str.match(/\n\s*\d+\s+(\d+)\s+\d+\s/u)(capture.output), (match) =>
          O.flatMap(A.get(match, 1), N.parse)
        )
      : O.none()
  );
  const enriched = ResidueReapCandidate.make({
    ...entry,
    bytes: O.getOrElse(apparentBytes, () => bytes),
    ...O.getSomesStruct({ bytesExclusive: exclusive }),
    owner: O.match(ruling, { onNone: () => "owner-unverified", onSome: (r) => r.owner }),
    terminalState: O.match(ruling, { onNone: () => "unverified", onSome: (r) => r.state }),
    retentionReason: O.match(ruling, { onNone: () => "owner-ruling-required", onSome: (r) => r.reason }),
  });
  const skip = (reason: ResidueReapSkipReason) =>
    ResidueReapCandidate.make({ ...enriched, action: "skip", skipReason: reason });
  if (O.isNone(info)) return skip("stat-failed");
  if (O.isSome(yield* fs.readLink(entry.path).pipe(Effect.option))) return skip("path-changed");
  if (O.isSome(tree.skipReason)) return skip(tree.skipReason.value);
  if (
    O.isNone(ruling) ||
    Str.Equivalence(ruling.value.disposition, "retain") ||
    Str.Equivalence(entry.reapClass, "checkout-material")
  )
    return skip("owner-ruling-required");
  if (isNonTerminalState(ruling.value.state)) return skip("terminal-state-unverified");
  const checkout = optionOr(entry.checkoutRoot, path.dirname(entry.root));
  if (
    !pathIsStrictlyWithin(path, checkout, path.resolve(checkout, ruling.value.evidence)) ||
    !Str.Equivalence(ruling.value.evidence, path.relative(checkout, path.resolve(checkout, ruling.value.evidence))) ||
    O.isSome(yield* fs.readLink(path.join(checkout, ruling.value.evidence)).pipe(Effect.option))
  )
    return skip("owner-ruling-required");
  const proof = yield* runRepoCommandCapture(
    "git",
    ["--literal-pathspecs", "ls-files", "--error-unmatch", "--", ruling.value.evidence],
    checkout
  ).pipe(Effect.option);
  if (!O.exists(proof, (capture) => N.Equivalence(capture.exitCode, 0) && !capture.truncated))
    return skip("terminal-state-unverified");
  const proofText = yield* fs.readFileString(path.join(checkout, ruling.value.evidence)).pipe(Effect.option);
  const proved = O.isSome(proofText)
    ? yield* decodeRuling(proofText.value).pipe(Effect.option)
    : O.none<ResidueRetentionRuling>();
  if (!O.exists(proved, (receipt) => rulingEquivalent(ruling.value, receipt))) return skip("terminal-state-unverified");
  const nestedDirty = yield* gitCleanSkip(tree.gitMarkers);
  if (O.isSome(nestedDirty)) return skip(nestedDirty.value);
  const nestedProtection = yield* Effect.forEach(
    tree.gitMarkers,
    Effect.fnUntraced(function* (marker) {
      const dotgit = yield* fs.stat(path.join(marker, ".git")).pipe(Effect.option);
      const registered = yield* isRegisteredWorktree(checkout, marker);
      if (O.isNone(registered)) return O.some<ResidueReapSkipReason>("git-probe-failed");
      if (O.exists(dotgit, (stat) => Str.Equivalence(stat.type, "File")) || registered.value)
        return O.some<ResidueReapSkipReason>("protected-name");
      const linked = yield* runRepoCommandCapture(
        "git",
        ["--no-optional-locks", "worktree", "list", "--porcelain"],
        marker
      ).pipe(Effect.option);
      if (O.isNone(linked) || !N.Equivalence(linked.value.exitCode, 0) || linked.value.truncated)
        return O.some<ResidueReapSkipReason>("git-probe-failed");
      if (N.greaterThan(A.length(A.filter(Str.split("\n")(linked.value.output), Str.startsWith("worktree "))), 1))
        return O.some<ResidueReapSkipReason>("protected-name");
      return O.none<ResidueReapSkipReason>();
    })
  );
  const nestedSkip = A.head(A.getSomes(nestedProtection));
  if (O.isSome(nestedSkip)) return skip(nestedSkip.value);
  const safety = yield* checkoutSafetySkip(enriched, policy, ruling.value.evidence);
  if (O.isSome(safety)) return skip(safety.value);
  const newest = O.orElse(tree.newestFileMillis, () => O.flatMap(info, mtimeMillis));
  if (O.isNone(newest) || ageDays(policy.nowMillis, newest.value) < policy.maxAgeDays) return skip("too-young");
  return ResidueReapCandidate.make({
    ...enriched,
    ageDays: ageDays(policy.nowMillis, newest.value),
    action: "archive-move",
    mtimeMillis: newest.value,
  });
});

const checkoutResidueCandidates = Effect.fnUntraced(function* (
  checkout: string,
  includes: (reapClass: ResidueReapClass) => boolean,
  policy: ReapPolicy
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(checkout, ".beep");
  if (!(yield* fs.exists(root).pipe(Effect.orElseSucceed(() => false)))) return A.empty<ResidueReapCandidate>();
  const listing = yield* fs.readDirectory(root).pipe(Effect.orElseSucceed(() => A.empty<string>()));
  const groups = yield* Effect.forEach(
    A.filter(listing, (name) => !isProtectedResidueName(name) && includes(classifyCheckoutName(name))),
    Effect.fnUntraced(function* (name) {
      const reapClass = classifyCheckoutName(name);
      const top = path.join(root, name);
      const scoped = isCheckoutContainer(name)
        ? O.some(top)
        : Str.Equivalence(name, "yeet")
          ? O.some(path.join(top, "jobs"))
          : O.none<string>();
      const nested = O.isSome(scoped)
        ? yield* fs.readDirectory(scoped.value).pipe(Effect.option)
        : O.none<ReadonlyArray<string>>();
      const targets = O.isSome(nested)
        ? A.map(nested.value, (child) =>
            path.join(
              O.getOrElse(scoped, () => top),
              child
            )
          )
        : [top];
      return yield* Effect.forEach(
        targets,
        (target) =>
          assessCheckoutResidue(candidate(root, target, reapClass, "skip", { checkoutRoot: checkout }), policy),
        { concurrency: 1 }
      );
    }),
    { concurrency: 1 }
  );
  return A.flatten(groups);
});

const repoScopedCandidates = Effect.fnUntraced(function* (
  checkoutRoot: string,
  includes: (reapClass: ResidueReapClass) => boolean,
  policy: ReapPolicy
): Effect.fn.Return<ReadonlyArray<ResidueReapCandidate>, never, DiscoveryRequirements> {
  const turbo = includes("turbo-cache")
    ? yield* turboCandidates(checkoutRoot, policy.nowMillis, policy.turboMaxAgeDays, policy.entryCap, policy.cwdProbe)
    : A.empty<ResidueReapCandidate>();
  const runs = includes("turbo-runs")
    ? yield* turboRunCandidates(checkoutRoot, policy)
    : A.empty<ResidueReapCandidate>();
  const previews = includes("merged-preview")
    ? yield* mergedPreviewCandidates(checkoutRoot, policy)
    : A.empty<ResidueReapCandidate>();
  const checkout = yield* checkoutResidueCandidates(checkoutRoot, includes, policy);
  return A.map(A.appendAll(A.appendAll(A.appendAll(turbo, runs), previews), checkout), (entry) =>
    ResidueReapCandidate.make({ ...entry, checkoutRoot })
  );
});

type ResidueReapOptions = {
  readonly apply?: boolean;
  readonly resume?: string;
  readonly restore?: string;
  readonly archiveCheckpoint?: (phase: "intent" | "moved") => Effect.Effect<void>;
  readonly censusEntryCap?: number;
  readonly checkoutRoots?: ReadonlyArray<string>;
  readonly classes?: ReadonlyArray<ResidueReapClass>;
  readonly fleet?: boolean;
  readonly homeRoot?: string;
  readonly maxAgeDays?: number;
  readonly nowMillis?: number;
  readonly probeLiveCwd?: CwdProbe;
  readonly probePidAlive?: PidProbe;
  readonly qualificationViewsKeep?: number;
  readonly repoRoot?: string;
  readonly sharedTurboCacheRoot?: string;
  readonly sharedTurboMaxAgeDays?: number;
  readonly sharedTurboMaxBytes?: number;
  readonly turboMaxAgeDays?: number;
  readonly turboRunsMaxAgeDays?: number;
};

// Internal resolved run settings (never decoded or serialized).
type ResidueReapSettings = {
  readonly runId: string;
  readonly beepCacheRoot: string;
  readonly checkoutRoots: ReadonlyArray<string>;
  readonly classes: ReadonlyArray<ResidueReapClass>;
  readonly codexRoot: string;
  readonly homeRoot: string;
  readonly policy: ReapPolicy;
  readonly repoRoot: string;
  readonly sharedTurboCacheRoot: string;
  readonly sharedTurboMaxAgeDays: number;
  readonly sharedTurboMaxBytes: number;
};

const optionOr = <A>(value: A | undefined, fallback: A): A => O.getOrElse(O.fromUndefinedOr(value), () => fallback);

const nonEmptyOr = <A>(requested: ReadonlyArray<A> | undefined, fallback: ReadonlyArray<A>): ReadonlyArray<A> =>
  A.match(optionOr(requested, A.empty<A>()), { onEmpty: () => fallback, onNonEmpty: (values) => values });

const resolveHomeRoot = Effect.fnUntraced(function* (options: ResidueReapOptions) {
  const path = yield* Path.Path;
  // An empty or relative HOME must fail closed here: resolving it would silently make
  // the current working directory the cleanup root.
  const configured = O.fromUndefinedOr(options.homeRoot);
  return path.resolve(
    yield* decodeResidueReapHomeRoot(O.isSome(configured) ? configured.value : yield* Config.String("HOME"))
  );
});

const resolveRepoRoot = Effect.fnUntraced(function* (options: ResidueReapOptions) {
  const path = yield* Path.Path;
  const repoRoot = path.resolve(optionOr(options.repoRoot, ""));
  return Str.isNonEmpty(repoRoot) && O.isSome(O.fromUndefinedOr(options.repoRoot)) ? repoRoot : yield* findRepoRoot();
});

const resolveSharedTurboCacheRoot = Effect.fnUntraced(function* (options: ResidueReapOptions, beepCacheRoot: string) {
  const path = yield* Path.Path;
  const configured = O.fromUndefinedOr(options.sharedTurboCacheRoot);
  return O.isSome(configured)
    ? configured.value
    : O.getOrElse(O.filter(yield* Config.option(Config.String("TURBO_CACHE_DIR")), Str.isNonEmpty), () =>
        path.join(beepCacheRoot, "turbo")
      );
});

const resolveSettings = Effect.fnUntraced(function* (options: ResidueReapOptions) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const homeRoot = yield* resolveHomeRoot(options);
  const repoRoot = yield* resolveRepoRoot(options);
  const beepCacheRoot = path.join(homeRoot, ".cache", "beep");
  const now = yield* Clock.currentTimeMillis;
  const policy: ReapPolicy = {
    cwdProbe: optionOr<CwdProbe>(options.probeLiveCwd, procCwdProbe),
    entryCap: optionOr(options.censusEntryCap, DEFAULT_CENSUS_ENTRY_CAP),
    homeBoundary: yield* fs.realPath(homeRoot),
    maxAgeDays: yield* decodeResidueReapAgeDays(optionOr(options.maxAgeDays, DEFAULT_MAX_AGE_DAYS)),
    nowMillis: optionOr(options.nowMillis, now),
    pidProbe: optionOr<PidProbe>(options.probePidAlive, procPidProbe),
    qualificationViewsKeep: yield* decodeResidueReapKeepCount(
      optionOr(options.qualificationViewsKeep, DEFAULT_QUALIFICATION_VIEWS_KEEP)
    ),
    turboMaxAgeDays: yield* decodeResidueReapAgeDays(optionOr(options.turboMaxAgeDays, DEFAULT_TURBO_MAX_AGE_DAYS)),
    turboRunsMaxAgeDays: yield* decodeResidueReapAgeDays(
      optionOr(options.turboRunsMaxAgeDays, DEFAULT_TURBO_RUNS_MAX_AGE_DAYS)
    ),
  };
  return {
    runId: yield* (yield* Crypto.Crypto).randomUUIDv4,
    beepCacheRoot,
    checkoutRoots: yield* distinctCheckoutRoots(nonEmptyOr(options.checkoutRoots, [repoRoot])),
    classes: nonEmptyOr(options.classes, ResidueReapClass.literals),
    codexRoot: path.join(homeRoot, ".codex"),
    homeRoot,
    policy,
    repoRoot,
    sharedTurboCacheRoot: yield* resolveSharedTurboCacheRoot(options, beepCacheRoot),
    sharedTurboMaxAgeDays: yield* decodeResidueReapAgeDays(
      optionOr(options.sharedTurboMaxAgeDays, DEFAULT_SHARED_TURBO_MAX_AGE_DAYS)
    ),
    sharedTurboMaxBytes: yield* decodeResidueReapByteCap(
      optionOr(options.sharedTurboMaxBytes, DEFAULT_SHARED_TURBO_MAX_BYTES)
    ),
  } satisfies ResidueReapSettings;
});

const noDiscovery: Discovered = { candidates: A.empty(), warnings: A.empty() };

// Run one class's discovery only when the class is selected.
const whenIncluded = <E, R>(
  settings: ResidueReapSettings,
  reapClass: ResidueReapClass,
  discover: () => Effect.Effect<Discovered, E, R>
): Effect.Effect<Discovered, E, R> =>
  A.contains(settings.classes, reapClass) ? discover() : Effect.succeed(noDiscovery);

const discovered = (candidates: ReadonlyArray<ResidueReapCandidate>): Discovered => ({
  candidates,
  warnings: A.empty(),
});

const sessionCandidates = Effect.fnUntraced(function* (settings: ResidueReapSettings) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { policy } = settings;
  const scan = yield* Effect.reduce(
    [path.join(settings.codexRoot, "sessions"), path.join(settings.codexRoot, "archived_sessions")],
    (): SessionScan => ({ candidates: A.empty(), remaining: policy.entryCap }),
    Effect.fnUntraced(function* (scan: SessionScan, root: string) {
      if (!(yield* fs.exists(root))) return scan;
      if (O.isNone(yield* canonicalDirectory(policy.homeBoundary, root))) {
        return {
          candidates: A.append(
            scan.candidates,
            candidate(root, root, "codex-sessions", "skip", { skipReason: "path-changed" })
          ),
          remaining: scan.remaining,
        };
      }
      const nested = yield* discoverSessionTree(root, root, policy.nowMillis, policy.maxAgeDays, scan.remaining);
      return { candidates: A.appendAll(scan.candidates, nested.candidates), remaining: nested.remaining };
    })
  );
  return scan.candidates;
});

const topLevelDiscovery = (
  settings: ResidueReapSettings,
  root: string,
  reapClass: "codex-worktrees" | "beep-cache-disposable"
) =>
  whenIncluded(settings, reapClass, () =>
    topLevelDirectoryCandidates(
      root,
      settings.policy.homeBoundary,
      reapClass,
      settings.policy.nowMillis,
      settings.policy.maxAgeDays,
      settings.policy.entryCap,
      settings.policy.cwdProbe
    ).pipe(Effect.map(discovered))
  );

// Every selected class in report order: home Codex residue, each checkout's repository-scoped
// residue, then the beep cache classes.
const discoverResidue = Effect.fnUntraced(function* (settings: ResidueReapSettings) {
  const path = yield* Path.Path;
  const includes = (reapClass: ResidueReapClass): boolean => A.contains(settings.classes, reapClass);
  const parts = yield* Effect.all([
    whenIncluded(settings, "codex-sessions", () => sessionCandidates(settings).pipe(Effect.map(discovered))),
    topLevelDiscovery(settings, path.join(settings.codexRoot, "worktrees"), "codex-worktrees"),
    Effect.forEach(
      settings.checkoutRoots,
      (checkoutRoot) => repoScopedCandidates(checkoutRoot, includes, settings.policy),
      { concurrency: 2 }
    ).pipe(Effect.map(flow(A.flatten, discovered))),
    topLevelDiscovery(settings, settings.beepCacheRoot, "beep-cache-disposable"),
    whenIncluded(settings, "shared-turbo-cache", () =>
      sharedTurboCacheCandidates(
        settings.sharedTurboCacheRoot,
        settings.policy,
        settings.sharedTurboMaxAgeDays,
        settings.sharedTurboMaxBytes
      )
    ),
    whenIncluded(settings, "qualification-views", () =>
      assessQualificationViews(
        path.join(settings.beepCacheRoot, "turbo-qualification"),
        settings.policy,
        () => true
      ).pipe(Effect.map(discovered))
    ),
  ]);
  return {
    candidates: A.flatMap(parts, (part) => part.candidates),
    warnings: A.flatMap(parts, (part) => part.warnings),
  };
});

const unapplied = (entry: ResidueReapCandidate): AppliedCandidate => ({
  candidate: entry,
  reaped: false,
  reclaimedBytes: 0,
  warnings: A.empty(),
});

// Repository-scoped candidates are bounded by their own checkout; everything else by home.
const outerBoundaryFor = Effect.fnUntraced(function* (
  settings: ResidueReapSettings,
  entry: ResidueReapCandidate
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return isRepoScopedResidueClass(entry.reapClass)
    ? yield* fs.realPath(optionOr(entry.checkoutRoot, settings.repoRoot)).pipe(Effect.option)
    : O.some(settings.policy.homeBoundary);
});

const applyResidue = (
  settings: ResidueReapSettings,
  candidates: ReadonlyArray<ResidueReapCandidate>,
  apply: boolean,
  checkpoint: (phase: "intent" | "moved") => Effect.Effect<void>
): Effect.Effect<ReadonlyArray<AppliedCandidate>, never, DiscoveryRequirements | ResidueArchive> =>
  apply
    ? Effect.forEach(
        candidates,
        Effect.fnUntraced(function* (entry) {
          return yield* applyCandidate(entry, yield* outerBoundaryFor(settings, entry), settings.policy, checkpoint);
        }),
        { concurrency: 1 }
      )
    : Effect.succeed(A.map(candidates, unapplied));

const runDirectory = (path: Path.Path, checkout: string, runId: string): string =>
  path.join(checkout, ".beep", "residue-reap", runId);
const isRunId = S.is(S.String.check(S.isPattern(/^[a-f0-9-]{36}$/u)));

const recoverArchiveRun = Effect.fnUntraced(function* (settings: ResidueReapSettings, runId: string, restore: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const archive = yield* ResidueArchive;
  const refuse = (message: string, skipReason: ResidueReapSkipReason = "removal-failed") =>
    ResidueArchiveError.make({ message, skipReason });
  if (!isRunId(runId)) return yield* refuse("Invalid residue archive run id");
  const root = runDirectory(path, settings.repoRoot, runId);
  if (!(yield* fs.exists(path.join(root, "plan.json"))))
    return yield* refuse("Archive plan.json does not exist; recovery creates no run");
  yield* ensureArchiveDirectories(settings.repoRoot, runId);
  const report = yield* decodeReport(yield* fs.readFileString(path.join(root, "plan.json")));
  if (!Str.Equivalence(report.repoRoot, settings.repoRoot) || !Str.Equivalence(optionOr(report.runId, ""), runId))
    return yield* refuse("Archive report owner mismatch");
  const rows = yield* Effect.forEach(
    report.candidates,
    Effect.fnUntraced(function* (entry, index) {
      const operation = Effect.gen(function* () {
        if (!isCheckoutResidueClass(entry.reapClass))
          return ResidueReapCandidate.make({
            ...entry,
            action: "skip",
            retentionReason: "class does not use archive recovery",
          });
        const destination = path.join(root, "archive", `${index}`);
        const journalPath = `${destination}.intent.json`;
        const owner = optionOr(entry.checkoutRoot, settings.repoRoot);
        const realOwner = yield* fs.realPath(owner);
        if (!Str.Equivalence(realOwner, yield* fs.realPath(settings.repoRoot)))
          return ResidueReapCandidate.make({
            ...entry,
            action: "skip",
            skipReason: "foreign-owner",
            retentionReason: "fleet observation only; recover from the owning checkout",
          });
        const boundary = yield* fs.realPath(path.join(owner, ".beep"));
        const resolvedSource = path.join(yield* fs.realPath(path.dirname(entry.path)), path.basename(entry.path));
        const resolvedDestination = path.join(
          yield* fs.realPath(path.dirname(destination)),
          path.basename(destination)
        );
        if (
          !A.contains(report.checkoutRoots, owner) ||
          !pathIsStrictlyWithin(path, boundary, resolvedSource) ||
          cwdWithin(path, path.join(boundary, "residue-reap"), resolvedSource)
        )
          return yield* refuse("Archive source boundary mismatch", "path-changed");
        if (!(yield* fs.exists(journalPath))) {
          if (restore || !ResidueReapAction.is["archive-move"](entry.action))
            return ResidueReapCandidate.make({
              ...entry,
              action: "skip",
              retentionReason: "no archive intent; source retained",
            });
          return (yield* applyCandidate(entry, O.some(realOwner), settings.policy, () => Effect.void)).candidate;
        }
        const intent = yield* decodeIntent(yield* fs.readFileString(journalPath));
        if (
          !Str.Equivalence(intent.lexicalSource, entry.path) ||
          !Str.Equivalence(intent.source, resolvedSource) ||
          !Str.Equivalence(intent.destination, resolvedDestination)
        )
          return yield* refuse("Archive intent boundary mismatch", "path-changed");
        if (Str.Equivalence(intent.phase, "restored"))
          return ResidueReapCandidate.make({
            ...entry,
            action: "skip",
            retentionReason: "already restored; resume never rearchives",
          });
        if (!restore && Str.Equivalence(intent.phase, "fenced-live"))
          return ResidueReapCandidate.make({
            ...entry,
            action: "skip",
            skipReason: "lock-held",
            retentionReason: "fenced-live; restore or start a new run",
          });
        const identityAt = Effect.fnUntraced(function* (target: string) {
          if (O.isSome(yield* fs.readLink(target).pipe(Effect.option))) return false;
          return O.exists(O.flatMap(yield* fs.stat(target).pipe(Effect.option), directoryIdentity), (identity) =>
            sameDirectoryIdentity(identity, intent)
          );
        });
        const sourceMatches = yield* identityAt(intent.source);
        const archived = yield* identityAt(intent.destination);
        if (restore && archived) {
          if (yield* fs.exists(intent.source))
            return yield* refuse("Restore refuses an occupied source", "path-changed");
          const moved = yield* archive.move(intent.destination, intent.source, intent).pipe(Effect.scoped);
          if (!BoundMoveOutcome.is.moved(moved) && !BoundMoveOutcome.is["moved-unsynced"](moved))
            return yield* refuse(
              `Restore failed: ${moved}; archive intent retained`,
              BoundMoveOutcome.is["identity-changed"](moved) || BoundMoveOutcome.is["destination-occupied"](moved)
                ? "path-changed"
                : "removal-failed"
            );
          yield* syncDirectory(path.dirname(intent.source));
          yield* syncDirectory(path.dirname(intent.destination));
          yield* archive.publish(
            journalPath,
            yield* encodeIntent(ResidueArchiveIntent.make({ ...intent, phase: "restored" })),
            "residue archive restore"
          );
          return ResidueReapCandidate.make({ ...entry, action: "skip", retentionReason: "restored from archive" });
        }
        if (archived && !(yield* fs.exists(intent.source))) {
          const holders = yield* scanProcessAttachments({
            directory: intent.destination,
            kinds: ProcessAttachmentKind.literals,
          });
          if (O.isNone(holders) || A.isReadonlyArrayNonEmpty(holders.value)) {
            yield* archive.publish(
              journalPath,
              yield* encodeIntent(ResidueArchiveIntent.make({ ...intent, phase: "fenced-live" })),
              "live archive preserved"
            );
            return yield* refuse("Archived inode has live or unknown writers; preserved for restore", "lock-held");
          }
          yield* syncDirectory(path.dirname(intent.source));
          yield* syncDirectory(path.dirname(intent.destination));
          yield* archive.publish(
            journalPath,
            yield* encodeIntent(ResidueArchiveIntent.make({ ...intent, phase: "moved" })),
            "reconciled residue archive move"
          );
          return ResidueReapCandidate.make({ ...entry, action: "archive-move", recoveryDestination: destination });
        }
        if (sourceMatches && !(yield* fs.exists(intent.destination))) {
          if (restore) {
            yield* archive.publish(
              journalPath,
              yield* encodeIntent(ResidueArchiveIntent.make({ ...intent, phase: "restored" })),
              "reconciled residue restore"
            );
            return ResidueReapCandidate.make({ ...entry, action: "skip", retentionReason: "source retained" });
          }
          return (yield* applyCandidate(entry, O.some(realOwner), settings.policy, () => Effect.void)).candidate;
        }
        return yield* refuse(
          "Archive source or destination identity changed; manual recovery required",
          "path-changed"
        );
      });
      const result = yield* Effect.result(operation);
      return Result.isSuccess(result)
        ? { candidate: result.success, warnings: A.empty<string>() }
        : {
            candidate: ResidueReapCandidate.make({
              ...entry,
              action: "skip",
              skipReason: isResidueArchiveError(result.failure)
                ? optionOr(result.failure.skipReason, "removal-failed")
                : "removal-failed",
            }),
            warnings: [`${entry.path}: ${result.failure.message}`],
          };
    }),
    { concurrency: 1 }
  );
  const warnings = A.flatMap(rows, (row) => row.warnings);
  const crypto = yield* Crypto.Crypto;
  const recoveryPath = path.join(root, `recovery-${yield* crypto.randomUUIDv4}.json`);
  const result = ResidueReapReport.make({
    ...report,
    reportPath: recoveryPath,
    applied: true,
    mode: restore ? "restore" : "resume",
    candidates: A.map(rows, (row) => row.candidate),
    reapedCount: A.length(A.filter(rows, (row) => ResidueReapAction.is["archive-move"](row.candidate.action))),
    reclaimedBytes: 0,
    warnings: A.appendAll(report.warnings, warnings),
  });
  yield* archive.publish(recoveryPath, yield* encodeReport(result), "residue recovery report");
  if (A.isReadonlyArrayNonEmpty(warnings)) return yield* refuse(A.join(warnings, "\n"));
  return result;
});

const withArchiveLocks = Effect.fnUntraced(function* <A, E, R>(
  settings: ResidueReapSettings,
  effect: Effect.Effect<A, E, R>
) {
  const path = yield* Path.Path;
  yield* ensureArchiveDirectories(settings.repoRoot);
  // Serialize only the invoking owner's archives; foreign fleet roots are read-only.
  return yield* withJournalFileLock(
    path.join(settings.repoRoot, ".beep", "residue-reap", "archive.lock"),
    () => effect
  );
});

const executeResidueReap = Effect.fnUntraced(function* (settings: ResidueReapSettings, options: ResidueReapOptions) {
  const apply = optionOr(options.apply, false);
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const archive = yield* ResidueArchive;
  const beepRoot = path.join(settings.repoRoot, ".beep");
  if (O.isSome(yield* fs.readLink(beepRoot).pipe(Effect.option)))
    return yield* ResidueArchiveError.make({ message: "Checkout .beep is a symlink" });
  const resume = O.fromUndefinedOr(options.resume);
  const restore = O.fromUndefinedOr(options.restore);
  if (O.isSome(resume) || O.isSome(restore)) {
    if (O.isSome(resume) && O.isSome(restore))
      return yield* ResidueArchiveError.make({ message: "Choose resume or restore, not both" });
    const id = O.getOrElse(
      O.orElse(restore, () => resume),
      () => ""
    );
    if (!isRunId(id)) return yield* ResidueArchiveError.make({ message: "Invalid residue archive run id" });
    return yield* recoverArchiveRun(settings, id, O.isSome(restore));
  }
  const found = yield* discoverResidue(settings);
  const runRoot = runDirectory(path, settings.repoRoot, settings.runId);
  const reportPath = path.join(runRoot, "report.json");
  const ownerRoot = yield* fs.realPath(settings.repoRoot);
  const candidates = yield* Effect.forEach(
    found.candidates,
    Effect.fnUntraced(function* (entry, index) {
      if (!isCheckoutResidueClass(entry.reapClass)) return entry;
      const owner = yield* fs.realPath(optionOr(entry.checkoutRoot, settings.repoRoot));
      if (!Str.Equivalence(owner, ownerRoot))
        return ResidueReapCandidate.make({
          ...entry,
          action: "skip",
          skipReason: "foreign-owner",
          retentionReason: "fleet observation only; archive from the owning checkout",
        });
      return ResidueReapCandidate.make({ ...entry, recoveryDestination: path.join(runRoot, "archive", `${index}`) });
    })
  );
  const scannedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const makeReport = (outcomes: ReadonlyArray<AppliedCandidate>, applied: boolean) =>
    ResidueReapReport.make({
      runId: settings.runId,
      reportPath,
      scannedAt,
      homeRoot: settings.homeRoot,
      repoRoot: settings.repoRoot,
      maxAgeDays: settings.policy.maxAgeDays,
      turboMaxAgeDays: settings.policy.turboMaxAgeDays,
      turboRunsMaxAgeDays: settings.policy.turboRunsMaxAgeDays,
      sharedTurboCacheRoot: settings.sharedTurboCacheRoot,
      sharedTurboMaxAgeDays: settings.sharedTurboMaxAgeDays,
      sharedTurboMaxBytes: settings.sharedTurboMaxBytes,
      qualificationViewsKeep: settings.policy.qualificationViewsKeep,
      fleet: optionOr(options.fleet, false),
      checkoutRoots: settings.checkoutRoots,
      applied,
      mode: applied ? "apply" : "dry-run",
      classes: settings.classes,
      candidates: A.map(outcomes, (outcome) => outcome.candidate),
      reapedCount: A.length(A.filter(outcomes, (outcome) => outcome.reaped)),
      reclaimedBytes: A.reduce(outcomes, 0, (total, outcome) => total + outcome.reclaimedBytes),
      warnings: A.appendAll(
        found.warnings,
        A.flatMap(outcomes, (outcome) => outcome.warnings)
      ),
    });
  yield* ensureArchiveDirectories(settings.repoRoot, settings.runId);
  // Persist the complete dry run before mutation: kill after the first intent still
  // leaves a readable source/destination plan for every row.
  const dryRun = makeReport(A.map(candidates, unapplied), false);
  yield* archive.publish(path.join(runRoot, "plan.json"), yield* encodeReport(dryRun), "residue immutable plan");
  if (!apply) {
    yield* archive.publish(reportPath, yield* encodeReport(dryRun), "residue dry-run report");
    return dryRun;
  }
  const outcomes = yield* applyResidue(
    settings,
    candidates,
    true,
    optionOr(options.archiveCheckpoint, () => Effect.void)
  );
  const report = makeReport(outcomes, true);
  yield* archive.publish(reportPath, yield* encodeReport(report), "residue applied report");
  return report;
});

/**
 * Discover bounded home residue, classify it with complete safety evidence,
 * and optionally remove eligible entries.
 *
 * **Details**
 *
 * Checkout archive classes persist ownership, terminal state, safety decisions and
 * recovery destinations in immutable `.beep/residue-reap/<run-id>/plan.json` and
 * the initial `report.json`, including dry runs. `resume` reconciles durable intents;
 * `restore` returns archived inodes. Each recovery writes `recovery-<uuid>.json`.
 * Fleet discovery observes other owners; checkout archives apply only in the
 * invoking owner checkout. Run reports and archives remain durable until a separate
 * owner retention decision authorizes their retirement.
 *
 * Repository-scoped classes (`turbo-cache`, `turbo-runs`, `merged-preview`)
 * are discovered in every checkout named by `checkoutRoots` (deduplicated by
 * real path; the current checkout when omitted), and each candidate's apply
 * boundary is its own checkout. The shared Turbo cache is aged and then
 * size-evicted oldest-written first down to `sharedTurboMaxBytes`, never below a
 * one-day floor. Qualification views keep the newest `qualificationViewsKeep`
 * plus every view an evidence receipt cites. SQLite databases are never
 * VACUUMed. `homeRoot`, `repoRoot`, `checkoutRoots`, `sharedTurboCacheRoot`,
 * `nowMillis`, `censusEntryCap`, `probeLiveCwd`, and `probePidAlive` are
 * injection seams for hermetic tests; production resolves HOME and
 * `TURBO_CACHE_DIR` through `Config` and the current checkout through
 * `findRepoRoot`.
 *
 * **Example** (Build a dry-run effect)
 *
 * ```ts
 * import { runResidueReap } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runResidueReap())) // true
 * ```
 *
 * @param options - Optional injected roots, thresholds, budgets, class filter, clock, probes, and apply mode.
 * @returns A versioned report containing every candidate action and skip reason.
 * @category workflows
 * @since 0.0.0
 */
export const runResidueReap = Effect.fn("ResidueReap.runResidueReap")(function* (options: ResidueReapOptions = {}) {
  const settings = yield* resolveSettings(options);
  const archive = yield* makeResidueArchive();
  const operation = executeResidueReap(settings, options);
  const mutate =
    optionOr(options.apply, false) ||
    O.isSome(O.fromUndefinedOr(options.resume)) ||
    O.isSome(O.fromUndefinedOr(options.restore));
  return yield* (mutate ? withArchiveLocks(settings, operation) : operation).pipe(
    Effect.scoped,
    Effect.provideService(ResidueArchive, archive)
  );
});
