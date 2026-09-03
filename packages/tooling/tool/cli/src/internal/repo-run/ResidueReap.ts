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
import {
  ResidueReapAgeDays,
  ResidueReapCandidate,
  ResidueReapClass,
  ResidueReapReport,
} from "./ResidueReap.schemas.ts";
import type { ResidueReapAction, ResidueReapSkipReason } from "./ResidueReap.schemas.ts";

const DEFAULT_MAX_AGE_DAYS = 30;
const DEFAULT_TURBO_MAX_AGE_DAYS = 14;
const DEFAULT_CENSUS_ENTRY_CAP = 100_000;
const CENSUS_DEPTH_CAP = 12;
const PROC_ROOT = "/proc";

const DurableBeepCacheName = LiteralKit(["handoffs", "head-install", "uv"]);
const isDurableBeepCacheName = S.is(DurableBeepCacheName);
const ProcPidName = S.String.check(S.isPattern(/^[0-9]+$/u));
const isProcPidName = S.is(ProcPidName);

type CwdProbe = (candidatePath: string) => Effect.Effect<O.Option<boolean>, never, FileSystem.FileSystem | Path.Path>;

type Census = {
  readonly bytes: number;
  readonly entriesScanned: number;
  readonly newestFileMillis: O.Option<number>;
  readonly skipReason: O.Option<ResidueReapSkipReason>;
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
        return combineCensus(accumulator, { ...nested, entriesScanned: nested.entriesScanned + 1 });
      }
      if (!Str.Equivalence(stat.success.type, "File")) {
        return combineCensus(accumulator, {
          ...emptyCensus(),
          entriesScanned: 1,
          skipReason: O.some("census-failed"),
        });
      }
      return combineCensus(accumulator, {
        bytes: bytesFromInfo(stat.success),
        entriesScanned: 1,
        newestFileMillis: mtimeMillis(stat.success),
        skipReason: O.isSome(mtimeMillis(stat.success)) ? O.none() : O.some("census-failed"),
      });
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
): Effect.fn.Return<ReadonlyArray<ResidueReapCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs.exists(directory).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return A.empty();
  }
  const listing = yield* Effect.result(fs.readDirectory(directory));
  if (Result.isFailure(listing)) {
    return [candidate(root, directory, "codex-sessions", "skip", { skipReason: "census-failed" })];
  }
  if (A.length(listing.success) > remainingEntries) {
    return [
      candidate(root, directory, "codex-sessions", "skip", {
        entriesScanned: A.length(listing.success),
        skipReason: "census-overflow",
      }),
    ];
  }
  return A.flatten(
    yield* Effect.forEach(
      listing.success,
      Effect.fnUntraced(function* (name) {
        const entryPath = path.join(directory, name);
        if (O.isSome(yield* fs.readLink(entryPath).pipe(Effect.option))) {
          return [candidate(root, entryPath, "codex-sessions", "skip", { skipReason: "wrong-shape" })];
        }
        const stat = yield* Effect.result(fs.stat(entryPath));
        if (Result.isFailure(stat)) {
          return [candidate(root, entryPath, "codex-sessions", "skip", { skipReason: "stat-failed" })];
        }
        if (Str.Equivalence(stat.success.type, "Directory")) {
          return yield* discoverSessionTree(
            root,
            entryPath,
            nowMillis,
            thresholdDays,
            remainingEntries - A.length(listing.success)
          );
        }
        return Str.Equivalence(stat.success.type, "File")
          ? [classifyFile(path, root, entryPath, "codex-sessions", stat.success, nowMillis, thresholdDays)]
          : [candidate(root, entryPath, "codex-sessions", "skip", { skipReason: "wrong-shape" })];
      }),
      { concurrency: 8 }
    )
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
  const canonical = yield* fs.realPath(candidatePath).pipe(Effect.option);
  if (
    O.isNone(canonical) ||
    !Str.Equivalence(canonical.value, path.normalize(candidatePath)) ||
    !pathIsStrictlyWithin(path, root, canonical.value)
  ) {
    return O.none();
  }
  const stat = yield* fs.stat(canonical.value).pipe(Effect.option);
  return O.exists(stat, (info) => Str.Equivalence(info.type, "Directory")) ? canonical : O.none();
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
  if (A.some(readings, Result.isFailure)) {
    return O.none();
  }
  return O.some(
    A.some(A.getSuccesses(readings), (cwd) => {
      const relative = path.relative(candidatePath, cwd);
      return Str.isEmpty(relative) || (!path.isAbsolute(relative) && !Str.startsWith(`..${path.sep}`)(relative));
    })
  );
});

const directoryCandidate = Effect.fnUntraced(function* (
  root: string,
  candidatePath: string,
  reapClass: "codex-worktrees" | "beep-cache-disposable",
  nowMillis: number,
  thresholdDays: number,
  entryCap: number,
  cwdProbe: CwdProbe
): Effect.fn.Return<ResidueReapCandidate, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const initialStat = yield* Effect.result(fs.stat(candidatePath));
  if (Result.isFailure(initialStat)) {
    return candidate(root, candidatePath, reapClass, "skip", { skipReason: "stat-failed" });
  }
  if (!Str.Equivalence(initialStat.success.type, "Directory")) {
    return candidate(root, candidatePath, reapClass, "skip", { skipReason: "wrong-shape" });
  }
  const canonical = yield* canonicalDirectory(root, candidatePath);
  if (O.isNone(canonical)) {
    return candidate(root, candidatePath, reapClass, "skip", { skipReason: "wrong-shape" });
  }
  const census = yield* censusDirectory(canonical.value, entryCap);
  if (O.isSome(census.skipReason)) {
    return candidate(root, canonical.value, reapClass, "skip", {
      bytes: census.bytes,
      entriesScanned: census.entriesScanned,
      skipReason: census.skipReason.value,
    });
  }
  const rootStat = yield* fs.stat(canonical.value).pipe(Effect.option);
  if (O.isNone(rootStat)) {
    return candidate(root, canonical.value, reapClass, "skip", {
      bytes: census.bytes,
      entriesScanned: census.entriesScanned,
      skipReason: "stat-failed",
    });
  }
  const newest = O.orElse(census.newestFileMillis, () => pipe(rootStat, O.flatMap(mtimeMillis)));
  if (O.isNone(newest)) {
    return candidate(root, canonical.value, reapClass, "skip", { skipReason: "stat-failed" });
  }
  const measuredAge = ageDays(nowMillis, newest.value);
  if (measuredAge < thresholdDays) {
    return candidate(root, canonical.value, reapClass, "skip", {
      ageDays: measuredAge,
      bytes: census.bytes,
      entriesScanned: census.entriesScanned,
      skipReason: "too-young",
    });
  }
  if (ResidueReapClass.is["codex-worktrees"](reapClass)) {
    const live = yield* cwdProbe(canonical.value);
    if (O.isNone(live)) {
      return candidate(root, canonical.value, reapClass, "skip", {
        ageDays: measuredAge,
        entriesScanned: census.entriesScanned,
        skipReason: "process-probe-failed",
      });
    }
    if (live.value) {
      return candidate(root, canonical.value, reapClass, "skip", {
        ageDays: measuredAge,
        entriesScanned: census.entriesScanned,
        skipReason: "live-cwd-ref",
      });
    }
  }
  return candidate(root, canonical.value, reapClass, "remove-dir", {
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
): Effect.fn.Return<ReadonlyArray<ResidueReapCandidate>, never, FileSystem.FileSystem | Path.Path> {
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
  thresholdDays: number
): Effect.fn.Return<ReadonlyArray<ResidueReapCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const cacheRoot = path.join(repoRoot, ".turbo", "cache");
  const exists = yield* fs.exists(cacheRoot).pipe(Effect.orElseSucceed(() => false));
  if (!exists) {
    return A.empty();
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
      if (!Str.Equivalence(stat.value.type, "File") && !Str.Equivalence(stat.value.type, "Directory")) {
        return candidate(cacheRoot, entryPath, "turbo-cache", "skip", { skipReason: "wrong-shape" });
      }
      const classified = classifyFile(path, cacheRoot, entryPath, "turbo-cache", stat.value, nowMillis, thresholdDays);
      return Str.Equivalence(stat.value.type, "Directory") && Str.Equivalence(classified.action, "remove-file")
        ? ResidueReapCandidate.make({ ...classified, action: "remove-dir" })
        : classified;
    }),
    { concurrency: 8 }
  );
});

const reassessCandidate = Effect.fnUntraced(function* (
  assessed: ResidueReapCandidate,
  nowMillis: number,
  maxAgeDays: number,
  turboMaxAgeDays: number,
  entryCap: number,
  cwdProbe: CwdProbe
): Effect.fn.Return<ResidueReapCandidate, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (Str.Equivalence(assessed.action, "skip")) {
    return assessed;
  }
  if (!pathIsStrictlyWithin(path, assessed.root, assessed.path)) {
    return ResidueReapCandidate.make({ ...assessed, action: "skip", skipReason: "path-changed" });
  }
  if (ResidueReapClass.is["codex-sessions"](assessed.reapClass)) {
    if (protectedSessionName(path, assessed.path) || O.isSome(yield* fs.readLink(assessed.path).pipe(Effect.option))) {
      return ResidueReapCandidate.make({ ...assessed, action: "skip", skipReason: "path-changed" });
    }
    const stat = yield* fs.stat(assessed.path).pipe(Effect.option);
    return O.filter(stat, (info) => Str.Equivalence(info.type, "File")).pipe(
      O.map((info) =>
        classifyFile(path, assessed.root, assessed.path, assessed.reapClass, info, nowMillis, maxAgeDays)
      ),
      O.getOrElse(() => ResidueReapCandidate.make({ ...assessed, action: "skip", skipReason: "path-changed" }))
    );
  }
  if (ResidueReapClass.is["turbo-cache"](assessed.reapClass)) {
    const stat = yield* fs.stat(assessed.path).pipe(Effect.option);
    if (O.isNone(stat) || O.isSome(yield* fs.readLink(assessed.path).pipe(Effect.option))) {
      return ResidueReapCandidate.make({ ...assessed, action: "skip", skipReason: "path-changed" });
    }
    const checked = classifyFile(
      path,
      assessed.root,
      assessed.path,
      assessed.reapClass,
      stat.value,
      nowMillis,
      turboMaxAgeDays
    );
    return Str.Equivalence(stat.value.type, "Directory") && Str.Equivalence(checked.action, "remove-file")
      ? ResidueReapCandidate.make({ ...checked, action: "remove-dir" })
      : checked;
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
): Effect.fn.Return<AppliedCandidate, never, FileSystem.FileSystem | Path.Path> {
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
  const homeRoot = path.resolve(O.isSome(configuredHome) ? configuredHome.value : yield* Config.string("HOME"));
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
    ? A.flatten(
        yield* Effect.forEach(
          [path.join(codexRoot, "sessions"), path.join(codexRoot, "archived_sessions")],
          (root) => discoverSessionTree(root, root, nowMillis, maxAgeDays, entryCap),
          { concurrency: 2 }
        )
      )
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
    ? yield* turboCandidates(resolvedRepoRoot, nowMillis, turboMaxAgeDays)
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
