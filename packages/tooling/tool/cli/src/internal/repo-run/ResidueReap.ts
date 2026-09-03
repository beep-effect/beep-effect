/**
 * Conservative janitor for bounded, explicitly owned home-residue classes.
 *
 * Discovery is closed over Codex session files, Codex worktree directories,
 * this checkout's Turbo cache entries, and non-durable top-level beep cache
 * directories. Every removal is age-gated and revalidated immediately before
 * mutation; recursive idleness scans and Linux cwd probes fail closed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as BI from "effect/BigInt";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as N from "effect/Number";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "./RepoRun.executor.ts";
import {
  ResidueReapAgeDays,
  ResidueReapCandidate,
  ResidueReapClass,
  ResidueReapHomeRoot,
  ResidueReapReport,
} from "./ResidueReap.schemas.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ResidueReapAction, ResidueReapSkipReason } from "./ResidueReap.schemas.ts";

const DEFAULT_MAX_AGE_DAYS = 30;
const DEFAULT_TURBO_MAX_AGE_DAYS = 14;
const DEFAULT_CENSUS_ENTRY_CAP = 100_000;
const CENSUS_DEPTH_CAP = 12;
const PROC_ROOT = "/proc";

// worktree-residue holds archive-first worktree retirement manifests, patches, and
// preserved untracked files: an old archive is often the only remaining copy of that work.
const DurableBeepCacheName = LiteralKit(["handoffs", "head-install", "uv", "worktree-residue"]);
const isDurableBeepCacheName = S.is(DurableBeepCacheName);
const ProcPidName = S.String.check(S.isPattern(/^[0-9]+$/u));
const isProcPidName = S.is(ProcPidName);

type CwdProbe = (candidatePath: string) => Effect.Effect<O.Option<boolean>, never, FileSystem.FileSystem | Path.Path>;

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
      O.match(right, { onNone: () => left, onSome: (rightValue) => O.some(N.max(leftValue, rightValue)) }),
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
    readonly entriesScanned?: number;
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

const procCwdProbe = Effect.fnUntraced(function* (
  candidatePath: string
): Effect.fn.Return<O.Option<boolean>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const listing = yield* Effect.result(fs.readDirectory(PROC_ROOT));
  if (Result.isFailure(listing)) {
    return O.none();
  }
  const readings = yield* Effect.forEach(
    A.filter(listing.success, isProcPidName),
    Effect.fnUntraced(function* (pid) {
      return yield* Effect.result(fs.readLink(path.join(PROC_ROOT, pid, "cwd")));
    }),
    { concurrency: 16 }
  );
  // Individual unreadable pids are EXPECTED on a real host — other users' daemons,
  // kernel threads, processes exiting mid-scan — and must not withhold the verdict, or
  // the probe fails closed on every pass and retirement becomes unreachable. Residue
  // under $HOME belongs to this user, whose own processes are always readable; only a
  // failure to list /proc at all makes the census meaningless.
  return O.some(
    A.some(A.getSuccesses(readings), (cwd) => {
      const relative = path.relative(candidatePath, cwd);
      return Str.isEmpty(relative) || (!path.isAbsolute(relative) && !Str.startsWith(`..${path.sep}`)(relative));
    })
  );
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
): Effect.fn.Return<O.Option<ResidueReapSkipReason>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const readings = yield* Effect.forEach(
    gitMarkers,
    (marker) =>
      runRepoCommandCapture(
        "git",
        ["status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"],
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
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
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
  reapClass: "codex-worktrees" | "beep-cache-disposable",
  nowMillis: number,
  thresholdDays: number,
  entryCap: number,
  cwdProbe: CwdProbe
): Effect.fn.Return<
  ReadonlyArray<ResidueReapCandidate>,
  never,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs.exists(root).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return A.empty();
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
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
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
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
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

const reassessCandidate = Effect.fnUntraced(function* (
  assessed: ResidueReapCandidate,
  nowMillis: number,
  maxAgeDays: number,
  turboMaxAgeDays: number,
  entryCap: number,
  cwdProbe: CwdProbe
): Effect.fn.Return<
  ResidueReapCandidate,
  never,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  if (Str.Equivalence(assessed.action, "skip")) {
    return assessed;
  }
  if (!pathIsStrictlyWithin(path, assessed.root, assessed.path)) {
    return ResidueReapCandidate.make({ ...assessed, action: "skip", skipReason: "path-changed" });
  }
  if (ResidueReapClass.is["codex-sessions"](assessed.reapClass)) {
    return yield* reassessSessionFile(assessed, nowMillis, maxAgeDays);
  }
  if (ResidueReapClass.is["turbo-cache"](assessed.reapClass)) {
    return yield* reassessTurboEntry(assessed, nowMillis, turboMaxAgeDays, entryCap, cwdProbe);
  }
  return yield* directoryCandidate(
    assessed.root,
    assessed.path,
    assessed.reapClass,
    nowMillis,
    maxAgeDays,
    entryCap,
    cwdProbe
  );
});

const applyCandidate = Effect.fnUntraced(function* (
  assessed: ResidueReapCandidate,
  nowMillis: number,
  maxAgeDays: number,
  turboMaxAgeDays: number,
  entryCap: number,
  cwdProbe: CwdProbe
): Effect.fn.Return<
  AppliedCandidate,
  never,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const rechecked = yield* reassessCandidate(assessed, nowMillis, maxAgeDays, turboMaxAgeDays, entryCap, cwdProbe);
  if (Str.Equivalence(rechecked.action, "skip")) {
    return {
      candidate: rechecked,
      reaped: false,
      reclaimedBytes: 0,
      warnings: Str.Equivalence(assessed.action, "skip")
        ? A.empty()
        : [`Skipped ${assessed.path}: eligibility changed before removal.`],
    };
  }
  const removed = yield* fs
    .remove(rechecked.path, { force: false, recursive: Str.Equivalence(rechecked.action, "remove-dir") })
    .pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false)
    );
  if (!removed) {
    return {
      candidate: ResidueReapCandidate.make({ ...rechecked, action: "skip", skipReason: "removal-failed" }),
      reaped: false,
      reclaimedBytes: 0,
      warnings: [`Failed to remove ${rechecked.path}.`],
    };
  }
  return {
    candidate: rechecked,
    reaped: true,
    reclaimedBytes: O.getOrElse(O.fromUndefinedOr(rechecked.bytes), () => 0),
    warnings: A.empty(),
  };
});

/**
 * Discover bounded home residue, classify it with complete safety evidence,
 * and optionally remove eligible entries.
 *
 * **Details**
 *
 * Version 1 deliberately does not VACUUM SQLite databases, sweep Turbo caches
 * across other checkouts, or perform size-based eviction. It removes only by
 * age or bounded newest-file idleness within the four explicit classes.
 * `homeRoot`, `repoRoot`, `nowMillis`, `censusEntryCap`, and `probeLiveCwd`
 * are injection seams for hermetic tests; production resolves HOME through
 * `Config` plus `Path` and the current checkout through `findRepoRoot`.
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
 * @param options - Optional injected roots, thresholds, class filter, clock, probes, and apply mode.
 * @returns A versioned report containing every candidate action and skip reason.
 * @category workflows
 * @since 0.0.0
 */
export const runResidueReap = Effect.fn("ResidueReap.runResidueReap")(function* (
  options: {
    readonly apply?: boolean;
    readonly censusEntryCap?: number;
    readonly classes?: ReadonlyArray<ResidueReapClass>;
    readonly homeRoot?: string;
    readonly maxAgeDays?: number;
    readonly nowMillis?: number;
    readonly probeLiveCwd?: CwdProbe;
    readonly repoRoot?: string;
    readonly turboMaxAgeDays?: number;
  } = {}
) {
  const path = yield* Path.Path;
  const configuredHome = O.fromUndefinedOr(options.homeRoot);
  // An empty or relative HOME must fail closed here: resolving it would silently make
  // the current working directory the cleanup root.
  const homeRoot = path.resolve(
    yield* S.decodeEffect(ResidueReapHomeRoot)(
      O.isSome(configuredHome) ? configuredHome.value : yield* Config.string("HOME")
    )
  );
  const repoRoot = path.resolve(O.getOrElse(O.fromUndefinedOr(options.repoRoot), () => ""));
  const resolvedRepoRoot =
    Str.isNonEmpty(repoRoot) && O.isSome(O.fromUndefinedOr(options.repoRoot)) ? repoRoot : yield* findRepoRoot();
  const maxAgeDays = yield* S.decodeEffect(ResidueReapAgeDays)(
    O.getOrElse(O.fromUndefinedOr(options.maxAgeDays), () => DEFAULT_MAX_AGE_DAYS)
  );
  const turboMaxAgeDays = yield* S.decodeEffect(ResidueReapAgeDays)(
    O.getOrElse(O.fromUndefinedOr(options.turboMaxAgeDays), () => DEFAULT_TURBO_MAX_AGE_DAYS)
  );
  const classes = A.match(O.getOrElse(O.fromUndefinedOr(options.classes), A.empty<ResidueReapClass>), {
    onEmpty: () => ResidueReapClass.Options,
    onNonEmpty: (requested) => requested,
  });
  const includes = (reapClass: ResidueReapClass): boolean => A.contains(classes, reapClass);
  const now = yield* Clock.currentTimeMillis;
  const nowMillis = O.getOrElse(O.fromUndefinedOr(options.nowMillis), () => now);
  const entryCap = O.getOrElse(O.fromUndefinedOr(options.censusEntryCap), () => DEFAULT_CENSUS_ENTRY_CAP);
  const cwdProbe = O.getOrElse(O.fromUndefinedOr(options.probeLiveCwd), () => procCwdProbe);
  const codexRoot = path.join(homeRoot, ".codex");
  const beepCacheRoot = path.join(homeRoot, ".cache", "beep");

  const sessions = includes("codex-sessions")
    ? (yield* Effect.reduce(
        [path.join(codexRoot, "sessions"), path.join(codexRoot, "archived_sessions")],
        (): SessionScan => ({ candidates: A.empty(), remaining: entryCap }),
        Effect.fnUntraced(function* (scan: SessionScan, root: string) {
          const nested = yield* discoverSessionTree(root, root, nowMillis, maxAgeDays, scan.remaining);
          return { candidates: A.appendAll(scan.candidates, nested.candidates), remaining: nested.remaining };
        })
      )).candidates
    : A.empty<ResidueReapCandidate>();
  const worktrees = includes("codex-worktrees")
    ? yield* topLevelDirectoryCandidates(
        path.join(codexRoot, "worktrees"),
        "codex-worktrees",
        nowMillis,
        maxAgeDays,
        entryCap,
        cwdProbe
      )
    : A.empty<ResidueReapCandidate>();
  const turbo = includes("turbo-cache")
    ? yield* turboCandidates(resolvedRepoRoot, nowMillis, turboMaxAgeDays, entryCap, cwdProbe)
    : A.empty<ResidueReapCandidate>();
  const beepCache = includes("beep-cache-disposable")
    ? yield* topLevelDirectoryCandidates(
        beepCacheRoot,
        "beep-cache-disposable",
        nowMillis,
        maxAgeDays,
        entryCap,
        cwdProbe
      )
    : A.empty<ResidueReapCandidate>();
  const discovered = A.appendAll(A.appendAll(sessions, worktrees), A.appendAll(turbo, beepCache));
  const apply = O.getOrElse(O.fromUndefinedOr(options.apply), () => false);
  const outcomes = apply
    ? yield* Effect.forEach(
        discovered,
        (entry) => applyCandidate(entry, nowMillis, maxAgeDays, turboMaxAgeDays, entryCap, cwdProbe),
        { concurrency: 1 }
      )
    : A.map(
        discovered,
        (entry): AppliedCandidate => ({ candidate: entry, reaped: false, reclaimedBytes: 0, warnings: A.empty() })
      );
  const scannedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  return ResidueReapReport.make({
    scannedAt,
    homeRoot,
    repoRoot: resolvedRepoRoot,
    maxAgeDays,
    turboMaxAgeDays,
    applied: apply,
    classes,
    candidates: A.map(outcomes, (outcome) => outcome.candidate),
    reapedCount: A.length(A.filter(outcomes, (outcome) => outcome.reaped)),
    reclaimedBytes: A.reduce(outcomes, 0, (total, outcome) => total + outcome.reclaimedBytes),
    warnings: A.flatten(A.map(outcomes, (outcome) => outcome.warnings)),
  });
});
