/**
 * Conservative janitor for known temporary artifacts on Linux tmpfs roots.
 *
 * Discovery is closed over four explicit artifact families. Reaping requires
 * classification, an old-enough idleness clock, zero live `/proc` cwd or file
 * descriptor references, and no matching kernel lock. Linked Git worktrees go
 * through `git worktree remove`; arbitrary directories are never touched.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import { Clock, Config, DateTime, Duration, Effect, FileSystem, Number as N, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "./RepoRun.executor.ts";
import { TmpfsReapCandidate, TmpfsReapClass, TmpfsReapReport } from "./TmpfsReap.schemas.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { TmpfsReapSkipReason } from "./TmpfsReap.schemas.ts";

const $I = $RepoCliId.create("internal/repo-run/TmpfsReap");

const HEAD_INSTALL_PREFIX = "beep-yeet-head-install-";
const FALLOW_CACHE_PREFIX = "fallow-audit-base-cache-";
const SCOPED_TEMP_PREFIXES = [
  "beep-knowledge-refs-",
  "beep-research-history-",
  "beep-fallow-audit-diff-",
  "beep-docgen-worker-eval-",
  "agent-effectiveness-schema-first-",
];
const GIT_WORKTREE_MARKER = "/.git/worktrees/";
const PROC_ROOT = "/proc";
const PROC_LOCKS = "/proc/locks";

const ProcPidName = S.String.pipe(
  S.check(S.isPattern(/^[0-9]+$/u)),
  $I.annoteSchema("ProcPidName", {
    description: "Decimal process directory name under Linux procfs.",
  })
);
const isProcPidName = S.is(ProcPidName);

type DiscoveredCandidate = {
  readonly path: string;
  readonly reapClass: TmpfsReapClass;
  readonly idleSinceMillis: number;
  readonly classified: boolean;
  readonly parentRepo: O.Option<string>;
};

type ProcReferenceSnapshot = {
  readonly cwdTargets: ReadonlyArray<string>;
  readonly fdTargets: ReadonlyArray<string>;
};

type CandidateLiveness = {
  readonly cwdCount: number;
  readonly fdCount: number;
  readonly liveFlock: boolean;
};

type MeasuredCandidate = {
  readonly discovered: DiscoveredCandidate;
  readonly ageHours: number;
  readonly bytes: O.Option<number>;
  readonly liveness: CandidateLiveness;
  readonly skipReason: O.Option<TmpfsReapSkipReason>;
};

type ApplyOutcome = {
  readonly reaped: boolean;
  readonly warnings: ReadonlyArray<string>;
};

const emptyApplyOutcome = (warning: string): ApplyOutcome => ({ reaped: false, warnings: [warning] });

const sameCandidatePath = (left: DiscoveredCandidate, right: DiscoveredCandidate): boolean => left.path === right.path;

const pathHasPrefix = (target: string, candidate: string, separator: string): boolean =>
  target === candidate || Str.startsWith(`${candidate}${separator}`)(target);

const pathIsWithin = (pathService: Path.Path, root: string, candidate: string): boolean => {
  const relative = pathService.relative(root, pathService.resolve(candidate));
  return (
    Str.isEmpty(relative) ||
    (!pathService.isAbsolute(relative) && relative !== ".." && !Str.startsWith(`..${pathService.sep}`)(relative))
  );
};

const newestMillis = (values: ReadonlyArray<number>, fallback: number): number =>
  A.match(values, {
    onEmpty: () => fallback,
    onNonEmpty: ([head, ...tail]) => A.reduce(tail, head, N.max),
  });

const statMtimeMillis = Effect.fnUntraced(function* (
  filePath: string
): Effect.fn.Return<O.Option<number>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(filePath).pipe(Effect.option);
  return pipe(
    info,
    O.flatMap((value) => value.mtime),
    O.map((mtime) => mtime.getTime())
  );
});

const readDirectoryOption = Effect.fnUntraced(function* (
  directory: string
): Effect.fn.Return<O.Option<ReadonlyArray<string>>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readDirectory(directory).pipe(Effect.option);
});

const directoryNames = Effect.fnUntraced(function* (
  directory: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem> {
  return O.getOrElse(yield* readDirectoryOption(directory), A.empty<string>);
});

const isDirectory = Effect.fnUntraced(function* (
  entryPath: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return pipe(
    yield* fs.stat(entryPath).pipe(Effect.option),
    O.exists((info) => info.type === "Directory")
  );
});

const parentRepoFromGitDir = (pathService: Path.Path, candidatePath: string, gitDir: string): O.Option<string> => {
  const resolved = pathService.isAbsolute(gitDir)
    ? pathService.normalize(gitDir)
    : pathService.resolve(candidatePath, gitDir);
  return pipe(
    Str.lastIndexOf(GIT_WORKTREE_MARKER)(resolved),
    O.map((markerIndex) => Str.slice(0, markerIndex)(resolved)),
    O.filter(Str.isNonEmpty)
  );
};

const discoverGitWorktree = Effect.fnUntraced(function* (
  candidatePath: string,
  idleSinceMillis: number
): Effect.fn.Return<O.Option<DiscoveredCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const gitFile = pathService.join(candidatePath, ".git");
  const info = yield* fs.stat(gitFile).pipe(Effect.option);
  if (!O.exists(info, (value) => value.type === "File")) {
    return O.none();
  }
  const content = yield* fs.readFileString(gitFile).pipe(Effect.option);
  return pipe(
    content,
    O.map(Str.trim),
    O.filter(Str.startsWith("gitdir:")),
    O.map((line): DiscoveredCandidate => {
      const gitDir = Str.trim(Str.slice(Str.length("gitdir:"))(line));
      const parentRepo = parentRepoFromGitDir(pathService, candidatePath, gitDir);
      return {
        path: candidatePath,
        reapClass: "git-worktree",
        idleSinceMillis,
        classified: O.isSome(parentRepo),
        parentRepo,
      };
    })
  );
});

const fallowLastUsedPaths = Effect.fnUntraced(function* (
  candidatePath: string,
  siblingNames: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const pathService = yield* Path.Path;
  const basename = pathService.basename(candidatePath);
  const insideNames = yield* directoryNames(candidatePath);
  const inside = A.map(A.filter(insideNames, Str.endsWith(".last-used")), (name) =>
    pathService.join(candidatePath, name)
  );
  const siblings = A.map(
    A.filter(siblingNames, (name) => Str.startsWith(basename)(name) && Str.endsWith(".last-used")(name)),
    (name) => pathService.join(pathService.dirname(candidatePath), name)
  );
  return A.dedupe(A.appendAll(inside, siblings));
});

const fallowIdleSinceMillis = Effect.fnUntraced(function* (
  candidatePath: string,
  candidateMtimeMillis: number,
  siblingNames: ReadonlyArray<string>
): Effect.fn.Return<number, never, FileSystem.FileSystem | Path.Path> {
  const lastUsedPaths = yield* fallowLastUsedPaths(candidatePath, siblingNames);
  const readings = A.getSomes(yield* Effect.forEach(lastUsedPaths, statMtimeMillis, { concurrency: 16 }));
  return newestMillis(readings, candidateMtimeMillis);
});

const isScopedTempName = (name: string): boolean =>
  A.some(SCOPED_TEMP_PREFIXES, (prefix) => Str.startsWith(prefix)(name));

const classifyTopLevelDirectory = Effect.fnUntraced(function* (
  root: string,
  name: string,
  siblingNames: ReadonlyArray<string>
): Effect.fn.Return<O.Option<DiscoveredCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const pathService = yield* Path.Path;
  const candidatePath = pathService.join(root, name);
  if (!(yield* isDirectory(candidatePath))) {
    return O.none();
  }
  const candidateMtime = O.getOrElse(yield* statMtimeMillis(candidatePath), () => 0);
  if (Str.startsWith(HEAD_INSTALL_PREFIX)(name)) {
    return O.some({
      path: candidatePath,
      reapClass: "head-install",
      idleSinceMillis: candidateMtime,
      classified: true,
      parentRepo: O.none(),
    });
  }
  if (Str.startsWith(FALLOW_CACHE_PREFIX)(name)) {
    return O.some({
      path: candidatePath,
      reapClass: "fallow-cache",
      idleSinceMillis: yield* fallowIdleSinceMillis(candidatePath, candidateMtime, siblingNames),
      classified: true,
      parentRepo: O.none(),
    });
  }
  if (isScopedTempName(name)) {
    return O.some({
      path: candidatePath,
      reapClass: "scoped-temp",
      idleSinceMillis: candidateMtime,
      classified: true,
      parentRepo: O.none(),
    });
  }
  return yield* discoverGitWorktree(candidatePath, candidateMtime);
});

const discoverTopLevel = Effect.fnUntraced(function* (
  root: string
): Effect.fn.Return<ReadonlyArray<DiscoveredCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const names = yield* directoryNames(root);
  return A.getSomes(
    yield* Effect.forEach(names, (name) => classifyTopLevelDirectory(root, name, names), { concurrency: 16 })
  );
});

const discoverCacheHeadInstalls = Effect.fnUntraced(function* (
  cacheRoot: string
): Effect.fn.Return<ReadonlyArray<DiscoveredCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const pathService = yield* Path.Path;
  const base = pathService.join(cacheRoot, "beep", "head-install");
  const names = yield* directoryNames(base);
  const headNames = A.filter(names, Str.startsWith(HEAD_INSTALL_PREFIX));
  return A.getSomes(
    yield* Effect.forEach(headNames, (name) => classifyTopLevelDirectory(base, name, names), { concurrency: 16 })
  );
});

const discoverExplicitGitWorktrees = Effect.fnUntraced(function* (
  tmpRoot: string,
  candidatePaths: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<DiscoveredCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const canonicalPaths = A.getSomes(
    yield* Effect.forEach(A.dedupe(candidatePaths), (candidate) => fs.realPath(candidate).pipe(Effect.option), {
      concurrency: 16,
    })
  );
  const safePaths = A.filter(canonicalPaths, (candidate) => pathIsWithin(pathService, tmpRoot, candidate));
  return A.getSomes(
    yield* Effect.forEach(
      safePaths,
      Effect.fnUntraced(function* (candidatePath: string) {
        if (!(yield* isDirectory(candidatePath))) {
          return O.none<DiscoveredCandidate>();
        }
        const mtime = O.getOrElse(yield* statMtimeMillis(candidatePath), () => 0);
        return yield* discoverGitWorktree(candidatePath, mtime);
      }),
      { concurrency: 16 }
    )
  );
});

const readLinkOption = Effect.fnUntraced(function* (
  linkPath: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readLink(linkPath).pipe(Effect.option);
});

const processReferences = Effect.fnUntraced(function* (
  procPath: string
): Effect.fn.Return<ProcReferenceSnapshot, never, FileSystem.FileSystem | Path.Path> {
  const pathService = yield* Path.Path;
  const cwd = yield* readLinkOption(pathService.join(procPath, "cwd"));
  const fdRoot = pathService.join(procPath, "fd");
  const fdNames = yield* directoryNames(fdRoot);
  const fdTargets = A.getSomes(
    yield* Effect.forEach(fdNames, (name) => readLinkOption(pathService.join(fdRoot, name)), { concurrency: 16 })
  );
  return {
    cwdTargets: O.match(cwd, { onNone: A.empty<string>, onSome: A.of }),
    fdTargets,
  };
});

const scanProcReferences = Effect.fnUntraced(function* (): Effect.fn.Return<
  ProcReferenceSnapshot,
  never,
  FileSystem.FileSystem | Path.Path
> {
  const pathService = yield* Path.Path;
  const pids = A.filter(yield* directoryNames(PROC_ROOT), isProcPidName);
  const snapshots = yield* Effect.forEach(pids, (pid) => processReferences(pathService.join(PROC_ROOT, pid)), {
    concurrency: 16,
  });
  return {
    cwdTargets: A.flatten(A.map(snapshots, (snapshot) => snapshot.cwdTargets)),
    fdTargets: A.flatten(A.map(snapshots, (snapshot) => snapshot.fdTargets)),
  };
});

const lockInodes = (locks: string): ReadonlyArray<number> =>
  A.dedupe(
    A.getSomes(
      A.map(Str.split(locks, "\n"), (line) =>
        pipe(
          Str.split(Str.trim(line), /\s+/u),
          A.findFirst((field) => A.length(Str.split(field, ":")) === 3),
          O.flatMap((deviceAndInode) => A.last(Str.split(deviceAndInode, ":"))),
          O.flatMap(N.parse)
        )
      )
    )
  );

const candidateLockInodes = Effect.fnUntraced(function* (
  candidate: DiscoveredCandidate
): Effect.fn.Return<ReadonlyArray<number>, never, FileSystem.FileSystem | Path.Path> {
  if (candidate.reapClass !== "fallow-cache") {
    return A.empty();
  }
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const paths = [`${candidate.path}.lock`, pathService.join(candidate.path, ".lock")];
  const infos = yield* Effect.forEach(paths, (lockPath) => fs.stat(lockPath).pipe(Effect.option), { concurrency: 2 });
  return A.getSomes(A.map(A.getSomes(infos), (info) => info.ino));
});

const candidateLiveness = Effect.fnUntraced(function* (
  candidate: DiscoveredCandidate,
  proc: ProcReferenceSnapshot,
  heldLockInodes: ReadonlyArray<number>,
  separator: string
): Effect.fn.Return<CandidateLiveness, never, FileSystem.FileSystem | Path.Path> {
  const cwdCount = A.length(A.filter(proc.cwdTargets, (target) => pathHasPrefix(target, candidate.path, separator)));
  const fdCount = A.length(A.filter(proc.fdTargets, (target) => pathHasPrefix(target, candidate.path, separator)));
  const ownLockInodes = yield* candidateLockInodes(candidate);
  return {
    cwdCount,
    fdCount,
    liveFlock: A.some(ownLockInodes, (inode) => A.contains(heldLockInodes, inode)),
  };
});

const thresholdFor = (reapClass: TmpfsReapClass): Duration.Duration =>
  TmpfsReapClass.$match(reapClass, {
    "git-worktree": () => Duration.hours(2),
    "head-install": () => Duration.hours(1),
    "fallow-cache": () => Duration.hours(6),
    "scoped-temp": () => Duration.hours(2),
  });

const skipReasonFor = (
  candidate: DiscoveredCandidate,
  ageHours: number,
  liveness: CandidateLiveness
): O.Option<TmpfsReapSkipReason> => {
  if (!candidate.classified) {
    return O.some("unclassified");
  }
  if (liveness.cwdCount > 0) {
    return O.some("live-cwd-ref");
  }
  if (liveness.fdCount > 0) {
    return O.some("live-fd-ref");
  }
  if (liveness.liveFlock) {
    return O.some("live-flock");
  }
  return ageHours < Duration.toHours(thresholdFor(candidate.reapClass)) ? O.some("too-young") : O.none();
};

const measureBytes = Effect.fnUntraced(function* (
  candidatePath: string
): Effect.fn.Return<O.Option<number>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* runRepoCommandCapture("du", ["-sb", "--", candidatePath], candidatePath).pipe(Effect.option);
  return pipe(
    result,
    O.filter((capture) => capture.exitCode === 0 && !capture.truncated),
    O.flatMap((capture) => A.head(Str.split(capture.output, /\s+/u))),
    O.flatMap(N.parse)
  );
});

const fallowSiblingArtifacts = Effect.fnUntraced(function* (
  candidatePath: string
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> {
  const pathService = yield* Path.Path;
  const parent = pathService.dirname(candidatePath);
  const basename = pathService.basename(candidatePath);
  const names = yield* directoryNames(parent);
  const lastUsed = A.map(
    A.filter(names, (name) => Str.startsWith(basename)(name) && Str.endsWith(".last-used")(name)),
    (name) => pathService.join(parent, name)
  );
  return A.appendAll([`${candidatePath}.lock`, `${candidatePath}.sha`], lastUsed);
});

const removeDirectoryCandidate = Effect.fnUntraced(function* (
  candidate: DiscoveredCandidate
): Effect.fn.Return<ApplyOutcome, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const extras = candidate.reapClass === "fallow-cache" ? yield* fallowSiblingArtifacts(candidate.path) : A.empty();
  const removed = yield* fs.remove(candidate.path, { force: true, recursive: true }).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
  if (!removed) {
    return emptyApplyOutcome(`Failed to remove ${candidate.path}.`);
  }
  yield* Effect.forEach(extras, (extra) => fs.remove(extra, { force: true, recursive: true }).pipe(Effect.ignore), {
    discard: true,
    concurrency: 4,
  });
  return { reaped: true, warnings: [] };
});

const removeGitWorktreeCandidate = Effect.fnUntraced(function* (
  candidate: DiscoveredCandidate
): Effect.fn.Return<ApplyOutcome, never, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  if (O.isNone(candidate.parentRepo)) {
    return emptyApplyOutcome(`Skipped unclassified Git worktree ${candidate.path}.`);
  }
  const parentRepo = candidate.parentRepo.value;
  const parentPresent = yield* fs.exists(pathService.join(parentRepo, ".git")).pipe(Effect.orElseSucceed(() => false));
  if (!parentPresent) {
    return yield* removeDirectoryCandidate(candidate);
  }
  const remove = yield* runRepoCommandCapture(
    "git",
    ["-C", parentRepo, "worktree", "remove", "--force", candidate.path],
    parentRepo
  ).pipe(Effect.option);
  if (O.isNone(remove) || remove.value.exitCode !== 0) {
    return emptyApplyOutcome(`Failed to remove Git worktree ${candidate.path} through ${parentRepo}.`);
  }
  const prune = yield* runRepoCommandCapture("git", ["-C", parentRepo, "worktree", "prune"], parentRepo).pipe(
    Effect.option
  );
  return {
    reaped: true,
    warnings:
      O.isSome(prune) && prune.value.exitCode === 0
        ? []
        : [`Removed ${candidate.path}, but Git worktree prune failed for ${parentRepo}.`],
  };
});

const applyCandidate = Effect.fnUntraced(function* (
  candidate: MeasuredCandidate
): Effect.fn.Return<ApplyOutcome, never, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  if (O.isSome(candidate.skipReason)) {
    return { reaped: false, warnings: [] };
  }
  return yield* candidate.discovered.reapClass === "git-worktree"
    ? removeGitWorktreeCandidate(candidate.discovered)
    : removeDirectoryCandidate(candidate.discovered);
});

const candidateModel = (candidate: MeasuredCandidate): TmpfsReapCandidate =>
  TmpfsReapCandidate.make({
    path: candidate.discovered.path,
    reapClass: candidate.discovered.reapClass,
    ageHours: candidate.ageHours,
    refCount: candidate.liveness.cwdCount + candidate.liveness.fdCount,
    action: O.isSome(candidate.skipReason)
      ? "skip"
      : candidate.discovered.reapClass === "git-worktree"
        ? "worktree-remove"
        : "remove-dir",
    ...O.getSomesStruct({
      skipReason: candidate.skipReason,
      parentRepo: candidate.discovered.parentRepo,
      bytes: candidate.bytes,
    }),
  });

/**
 * Resolve the cache root used for persistent beep temporary installations.
 *
 * `XDG_CACHE_HOME` wins when non-empty; otherwise the root is `$HOME/.cache`.
 * An explicit override bypasses ambient configuration for tests and callers
 * that already resolved policy.
 *
 * **Example** (Build the resolution effect)
 *
 * ```ts
 * import { resolveBeepCacheRoot } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(resolveBeepCacheRoot())) // true
 * ```
 *
 * @param override - Explicit cache root, primarily for fixture isolation.
 * @returns The absolute cache root.
 * @category configuration
 * @since 0.0.0
 */
export const resolveBeepCacheRoot = Effect.fn("TmpfsReap.resolveBeepCacheRoot")(function* (override?: string) {
  const pathService = yield* Path.Path;
  const explicit = O.fromUndefinedOr(override);
  if (O.isSome(explicit)) {
    return pathService.resolve(explicit.value);
  }
  const configured = yield* Config.option(Config.string("XDG_CACHE_HOME"));
  const cacheRoot = O.filter(configured, Str.isNonEmpty);
  if (O.isSome(cacheRoot)) {
    return pathService.resolve(cacheRoot.value);
  }
  const home = yield* Config.string("HOME");
  return pathService.join(pathService.resolve(home), ".cache");
});

/**
 * Discover known temporary artifacts, prove conjunctive idleness, and optionally reap them.
 *
 * Dry-run is the default. Tests may supply isolated `tmpRoot`, `cacheRoot`, and
 * `nowMillis` values. Sweep may additionally pass the current repository's
 * porcelain worktree paths and restrict the run to `git-worktree`, while the
 * same engine retains ownership of liveness, age, and removal semantics.
 *
 * **Example** (Build a dry-run janitor effect)
 *
 * ```ts
 * import { runTmpfsReap } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runTmpfsReap())) // true
 * ```
 *
 * @param options - Optional roots, clock, class filter, and apply flag.
 * @returns The encoded-report model for the completed scan.
 * @category workflows
 * @since 0.0.0
 */
export const runTmpfsReap = Effect.fn("TmpfsReap.runTmpfsReap")(function* (
  options: {
    readonly apply?: boolean;
    readonly cacheRoot?: string;
    readonly classes?: ReadonlyArray<TmpfsReapClass>;
    readonly gitWorktreePaths?: ReadonlyArray<string>;
    readonly nowMillis?: number;
    readonly tmpRoot?: string;
  } = {}
) {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const requestedTmpRoot = O.fromUndefinedOr(options.tmpRoot);
  const configuredTmpRoot = O.isSome(requestedTmpRoot)
    ? requestedTmpRoot.value
    : yield* Config.string("TMPDIR").pipe(Config.withDefault("/tmp"));
  const tmpRoot = yield* fs.realPath(configuredTmpRoot);
  const classes = O.getOrElse(O.fromUndefinedOr(options.classes), () => TmpfsReapClass.Options);
  const includeClass = (reapClass: TmpfsReapClass): boolean => A.contains(classes, reapClass);
  const explicitGitWorktreePaths = O.fromUndefinedOr(options.gitWorktreePaths);

  const tmpCandidates = O.isSome(explicitGitWorktreePaths)
    ? yield* discoverExplicitGitWorktrees(tmpRoot, explicitGitWorktreePaths.value)
    : yield* discoverTopLevel(tmpRoot);
  const cacheCandidates = includeClass("head-install")
    ? yield* discoverCacheHeadInstalls(yield* resolveBeepCacheRoot(options.cacheRoot))
    : A.empty<DiscoveredCandidate>();
  const discovered = A.filter(
    A.dedupeWith(A.appendAll(tmpCandidates, cacheCandidates), sameCandidatePath),
    (candidate) => includeClass(candidate.reapClass)
  );

  const proc = yield* scanProcReferences();
  const heldLockInodes = lockInodes(yield* fs.readFileString(PROC_LOCKS));
  const nowMillis = yield* Clock.currentTimeMillis;
  const effectiveNowMillis = O.getOrElse(O.fromUndefinedOr(options.nowMillis), () => nowMillis);
  const measured = yield* Effect.forEach(
    discovered,
    Effect.fnUntraced(function* (candidate: DiscoveredCandidate) {
      const liveness = yield* candidateLiveness(candidate, proc, heldLockInodes, pathService.sep);
      const ageHours = Duration.toHours(Duration.millis(N.max(0, effectiveNowMillis - candidate.idleSinceMillis)));
      const bytes = yield* measureBytes(candidate.path);
      return {
        discovered: candidate,
        ageHours,
        bytes,
        liveness,
        skipReason: skipReasonFor(candidate, ageHours, liveness),
      } satisfies MeasuredCandidate;
    }),
    { concurrency: 8 }
  );

  const apply = O.getOrElse(O.fromUndefinedOr(options.apply), () => false);
  const outcomes = apply
    ? yield* Effect.forEach(measured, applyCandidate)
    : A.map(measured, (): ApplyOutcome => ({ reaped: false, warnings: [] }));
  const reapedIndexes = A.map(
    A.filter(A.zip(measured, outcomes), ([, outcome]) => outcome.reaped),
    ([candidate]) => candidate
  );
  const reclaimedBytes = A.reduce(
    reapedIndexes,
    0,
    (total, candidate) => total + O.getOrElse(candidate.bytes, () => 0)
  );
  const scannedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  return TmpfsReapReport.make({
    scannedAt,
    tmpRoot,
    applied: apply,
    candidates: A.map(measured, candidateModel),
    reapedCount: A.length(reapedIndexes),
    reclaimedBytes,
    warnings: A.flatten(A.map(outcomes, (outcome) => outcome.warnings)),
  });
});
