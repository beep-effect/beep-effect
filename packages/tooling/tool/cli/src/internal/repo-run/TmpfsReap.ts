/**
 * Conservative janitor for known temporary artifacts on Linux tmpfs roots.
 *
 * Discovery is closed over six explicit artifact families across `/tmp` and
 * a distinct absolute `TMPDIR`. Reaping requires
 * classification, an old-enough idleness clock, zero live `/proc` cwd or file
 * descriptor references, and no matching kernel lock. Linked Git worktrees go
 * through `git worktree remove`; arbitrary directories are never touched.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { BigInt, Clock, Config, DateTime, Duration, Effect, FileSystem, Number as N, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { WORKTREES_ROOT_SUFFIX } from "../../commands/Worktree/Worktree.constants.ts";
import { runRepoCommandCapture } from "./RepoRun.executor.ts";
import { TmpfsReapCandidate, TmpfsReapClass, TmpfsReapReport } from "./TmpfsReap.schemas.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { TmpfsReapSkipReason } from "./TmpfsReap.schemas.ts";

const $I = $RepoCliId.create("internal/repo-run/TmpfsReap");

const HEAD_INSTALL_PREFIX = "beep-yeet-head-install-";
const FALLOW_CACHE_PREFIX = "fallow-audit-base-cache-";
const SCOPED_TEMP_PREFIXES = [
  "beep-knowledge-refs-",
  "beep-knowledge-semantic-delta-",
  "beep-research-history-",
  "beep-fallow-audit-diff-",
  "beep-docgen-worker-eval-",
  "agent-effectiveness-schema-first-",
];
const GIT_WORKTREE_MARKER = "/.git/worktrees/";
const VitestForksChild = LiteralKit(["ssr", "client"]);
const PROC_ROOT = "/proc";
const PROC_LOCKS = "/proc/locks";
const DANGLING_STUB_ENTRY_LIMIT = 16;
const DANGLING_STUB_BYTE_LIMIT = FileSystem.Size(1024 * 1024);

const ProcPidName = S.String.pipe(
  S.check(S.isPattern(/^[0-9]+$/u)),
  $I.annoteSchema("ProcPidName", {
    description: "Decimal process directory name under Linux procfs.",
  })
);
const isProcPidName = S.is(ProcPidName);

const VitestForksTmpName = S.String.pipe(
  S.check(S.isPattern(/^[A-Za-z0-9_-]{21}$/u)),
  $I.annoteSchema("VitestForksTmpName", {
    description: "A 21-character name from Nano ID's URL-safe default alphabet.",
  })
);
const isVitestForksTmpName = S.is(VitestForksTmpName);

type DiscoveredCandidate = {
  readonly root: string;
  readonly path: string;
  readonly reapClass: TmpfsReapClass;
  readonly idleSinceMillis: number;
  readonly classified: boolean;
  readonly shapeSkipReason: O.Option<TmpfsReapSkipReason>;
  readonly parentRepo: O.Option<string>;
};

type ProcessReferences = {
  readonly cwdTargets: ReadonlyArray<string>;
  readonly fdTargets: ReadonlyArray<string>;
};

type ProcReferenceSnapshot = ProcessReferences & {
  readonly vitestRunning: boolean;
};

type ProcessCommandLineListing = () => Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path>;

type TmpfsRootsResolution = {
  readonly roots: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
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

type DanglingStubCensus = {
  readonly bytes: bigint;
  readonly complete: boolean;
  readonly entries: number;
};

type ApplyOutcome = {
  readonly reaped: boolean;
  readonly warnings: ReadonlyArray<string>;
};

const emptyApplyOutcome = (warning: string): ApplyOutcome => ({ reaped: false, warnings: [warning] });

const sameCandidatePath = (left: DiscoveredCandidate, right: DiscoveredCandidate): boolean =>
  Str.Equivalence(left.path, right.path);

const pathHasPrefix = (target: string, candidate: string, separator: string): boolean =>
  Str.Equivalence(target, candidate) || Str.startsWith(`${candidate}${separator}`)(target);

const pathIsWithin = (pathService: Path.Path, root: string, candidate: string): boolean => {
  const relative = pathService.relative(root, pathService.resolve(candidate));
  return (
    Str.isEmpty(relative) ||
    (!pathService.isAbsolute(relative) &&
      !Str.Equivalence(relative, "..") &&
      !Str.startsWith(`..${pathService.sep}`)(relative))
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
    O.exists((info) => Str.Equivalence(info.type, "Directory"))
  );
});

const statIsMissing = Effect.fnUntraced(function* (
  entryPath: string
): Effect.fn.Return<O.Option<boolean>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.stat(entryPath).pipe(
    Effect.as(O.some(false)),
    Effect.catch((error) =>
      Str.Equivalence(error.reason._tag, "NotFound") ? Effect.succeedSome(true) : Effect.succeed(O.none<boolean>())
    )
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

const gitDirFromGitFile = (pathService: Path.Path, candidatePath: string, content: string): O.Option<string> =>
  pipe(
    Str.trim(content),
    O.liftPredicate(Str.startsWith("gitdir:")),
    O.map((line) => Str.trim(Str.slice(Str.length("gitdir:"))(line))),
    O.filter(Str.isNonEmpty),
    O.map((target) =>
      pathService.isAbsolute(target) ? pathService.normalize(target) : pathService.resolve(candidatePath, target)
    )
  );

const gitDirForCandidate = Effect.fnUntraced(function* (
  candidatePath: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const gitFile = pathService.join(candidatePath, ".git");
  const gitFileInfo = yield* fs.stat(gitFile).pipe(Effect.option);
  const gitFileContent = yield* pipe(
    gitFileInfo,
    O.filter((info) => Str.Equivalence(info.type, "File")),
    O.match({
      onNone: () => Effect.succeed(O.none<string>()),
      onSome: () => fs.readFileString(gitFile).pipe(Effect.option),
    })
  );
  return pipe(
    gitFileContent,
    O.flatMap((content) => gitDirFromGitFile(pathService, candidatePath, content))
  );
});

const optionalStatIsMissing = (entryPath: O.Option<string>) =>
  O.match(entryPath, {
    onNone: () => Effect.succeed(O.none<boolean>()),
    onSome: statIsMissing,
  });

const skipReasonWhen = (condition: boolean, reason: TmpfsReapSkipReason): O.Option<TmpfsReapSkipReason> =>
  condition ? O.some(reason) : O.none();

const danglingStubShape = (
  gitDirMissing: O.Option<boolean>,
  parentRepoMissing: O.Option<boolean>
): Pick<DiscoveredCandidate, "classified" | "shapeSkipReason"> => {
  const classified = O.contains(gitDirMissing, true) && O.contains(parentRepoMissing, true);
  const shapeSkipReason = O.firstSomeOf([
    skipReasonWhen(O.contains(gitDirMissing, false), "gitdir-target-exists"),
    skipReasonWhen(O.contains(gitDirMissing, true) && O.contains(parentRepoMissing, false), "parent-repo-present"),
    O.some<TmpfsReapSkipReason>("wrong-shape"),
  ]);
  return { classified, shapeSkipReason: classified ? O.none() : shapeSkipReason };
};

const censusWithinLimits = (census: DanglingStubCensus): boolean =>
  census.complete &&
  census.entries <= DANGLING_STUB_ENTRY_LIMIT &&
  BigInt.isLessThanOrEqualTo(census.bytes, DANGLING_STUB_BYTE_LIMIT);

const censusEntry = Effect.fnUntraced(function* (
  candidateRoot: string,
  entryPath: string,
  census: DanglingStubCensus
): Effect.fn.Return<DanglingStubCensus, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  if (O.isSome(yield* fs.readLink(entryPath).pipe(Effect.option))) {
    return { ...census, complete: false };
  }
  const info = yield* fs.stat(entryPath).pipe(Effect.option);
  if (O.isNone(info)) {
    return { ...census, complete: false };
  }
  const next = {
    bytes: Str.Equivalence(info.value.type, "Directory") ? census.bytes : BigInt.sum(census.bytes, info.value.size),
    complete: true,
    entries: N.increment(census.entries),
  } satisfies DanglingStubCensus;
  return Str.Equivalence(info.value.type, "Directory") && censusWithinLimits(next)
    ? yield* censusDirectory(candidateRoot, entryPath, next)
    : next;
});

const censusDirectory = Effect.fnUntraced(function* (
  candidateRoot: string,
  directory: string,
  initial: DanglingStubCensus
): Effect.fn.Return<DanglingStubCensus, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const names = yield* readDirectoryOption(directory);
  if (O.isNone(names)) {
    return { ...initial, complete: false };
  }
  return yield* Effect.reduce(
    names.value,
    () => initial,
    (census, name) => {
      if (!censusWithinLimits(census)) {
        return Effect.succeed(census);
      }
      const entryPath = pathService.join(directory, name);
      return Str.Equivalence(directory, candidateRoot) && Str.Equivalence(name, ".git")
        ? fs.stat(entryPath).pipe(
            Effect.option,
            Effect.map(
              O.match({
                onNone: () => ({ ...census, complete: false }),
                onSome: (info) => ({ ...census, bytes: BigInt.sum(census.bytes, info.size) }),
              })
            )
          )
        : censusEntry(candidateRoot, entryPath, census);
    }
  );
});

const danglingStubContentsWithinLimits = Effect.fnUntraced(function* (
  candidatePath: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  const census = yield* censusDirectory(candidatePath, candidatePath, {
    bytes: BigInt.BigInt(0),
    complete: true,
    entries: 0,
  });
  return censusWithinLimits(census);
});

const discoverGitWorktree = Effect.fnUntraced(function* (
  root: string,
  candidatePath: string,
  idleSinceMillis: number
): Effect.fn.Return<O.Option<DiscoveredCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const gitFile = pathService.join(candidatePath, ".git");
  const info = yield* fs.stat(gitFile).pipe(Effect.option);
  if (!O.exists(info, (value) => Str.Equivalence(value.type, "File"))) {
    return O.none();
  }
  const content = yield* fs.readFileString(gitFile).pipe(Effect.option);
  return pipe(
    content,
    O.flatMap((value) => gitDirFromGitFile(pathService, candidatePath, value)),
    O.map((gitDir): DiscoveredCandidate => {
      const parentRepo = parentRepoFromGitDir(pathService, candidatePath, gitDir);
      return {
        root,
        path: candidatePath,
        reapClass: "git-worktree",
        idleSinceMillis,
        classified: O.isSome(parentRepo),
        shapeSkipReason: O.none(),
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

const discoverVitestForksTmp = Effect.fnUntraced(function* (
  root: string,
  candidatePath: string,
  name: string,
  idleSinceMillis: number
): Effect.fn.Return<O.Option<DiscoveredCandidate>, never, FileSystem.FileSystem | Path.Path> {
  if (!isVitestForksTmpName(name)) {
    return O.none();
  }
  const pathService = yield* Path.Path;
  const children = yield* directoryNames(candidatePath);
  const childDirectories = yield* Effect.forEach(
    children,
    (child) => isDirectory(pathService.join(candidatePath, child)),
    { concurrency: 2 }
  );
  const hasVitestShape =
    !A.isReadonlyArrayEmpty(children) &&
    A.every(children, (child) => VitestForksChild.is.ssr(child) || VitestForksChild.is.client(child)) &&
    A.every(childDirectories, (isChildDirectory) => isChildDirectory);
  if (!hasVitestShape) {
    return O.none();
  }
  const childMtimes = yield* Effect.forEach(
    children,
    (child) => statMtimeMillis(pathService.join(candidatePath, child)),
    { concurrency: 2 }
  );
  if (A.length(A.getSomes(childMtimes)) !== A.length(children)) {
    return O.none();
  }
  return O.some({
    root,
    path: candidatePath,
    reapClass: "vitest-forks-tmp",
    idleSinceMillis: newestMillis(A.getSomes(childMtimes), idleSinceMillis),
    classified: true,
    shapeSkipReason: O.none(),
    parentRepo: O.none(),
  });
});

const discoverDanglingWorktreeStub = Effect.fnUntraced(function* (
  root: string,
  candidatePath: string,
  idleSinceMillis: number
): Effect.fn.Return<DiscoveredCandidate, never, FileSystem.FileSystem | Path.Path> {
  const pathService = yield* Path.Path;
  const gitDir = yield* gitDirForCandidate(candidatePath);
  const parentRepo = pipe(
    gitDir,
    O.flatMap((target) => parentRepoFromGitDir(pathService, candidatePath, target))
  );
  const gitDirMissing = yield* optionalStatIsMissing(gitDir);
  const parentRepoMissing = yield* optionalStatIsMissing(parentRepo);
  const shape = danglingStubShape(gitDirMissing, parentRepoMissing);
  const contentsWithinLimits = shape.classified ? yield* danglingStubContentsWithinLimits(candidatePath) : false;
  return {
    root,
    path: candidatePath,
    reapClass: "dangling-worktree-stub",
    idleSinceMillis,
    classified: shape.classified && contentsWithinLimits,
    shapeSkipReason: shape.classified && !contentsWithinLimits ? O.some("contents-present") : shape.shapeSkipReason,
    parentRepo,
  };
});

const discoverWorktreeStubs = Effect.fnUntraced(function* (
  root: string,
  topLevelNames: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<DiscoveredCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const pathService = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const worktreesRoots = A.filter(topLevelNames, Str.endsWith(WORKTREES_ROOT_SUFFIX));
  return A.flatten(
    yield* Effect.forEach(
      worktreesRoots,
      Effect.fnUntraced(function* (worktreesRootName: string) {
        const configuredWorktreesRoot = pathService.join(root, worktreesRootName);
        if (!(yield* isDirectory(configuredWorktreesRoot))) {
          return A.empty<DiscoveredCandidate>();
        }
        const canonicalWorktreesRoot = yield* fs.realPath(configuredWorktreesRoot).pipe(Effect.option);
        if (O.isNone(canonicalWorktreesRoot)) {
          return A.empty<DiscoveredCandidate>();
        }
        if (!pathIsWithin(pathService, root, canonicalWorktreesRoot.value)) {
          return A.of<DiscoveredCandidate>({
            root,
            path: canonicalWorktreesRoot.value,
            reapClass: "dangling-worktree-stub",
            idleSinceMillis: O.getOrElse(yield* statMtimeMillis(canonicalWorktreesRoot.value), () => 0),
            classified: false,
            shapeSkipReason: O.some("wrong-shape"),
            parentRepo: O.none(),
          });
        }
        const worktreesRoot = canonicalWorktreesRoot.value;
        const names = yield* directoryNames(worktreesRoot);
        const directoryEntries = A.filter(
          yield* Effect.forEach(
            names,
            Effect.fnUntraced(function* (name: string) {
              const entryPath = pathService.join(worktreesRoot, name);
              return (yield* isDirectory(entryPath)) ? O.some(entryPath) : O.none<string>();
            }),
            { concurrency: 16 }
          ),
          O.isSome
        );
        const candidates = yield* Effect.forEach(
          A.map(directoryEntries, (entry) => entry.value),
          Effect.fnUntraced(function* (name: string) {
            const canonicalCandidate = yield* fs.realPath(name).pipe(Effect.option);
            if (O.isNone(canonicalCandidate)) {
              return O.none<DiscoveredCandidate>();
            }
            const candidatePath = canonicalCandidate.value;
            const idleSinceMillis = O.getOrElse(yield* statMtimeMillis(candidatePath), () => 0);
            if (!pathIsWithin(pathService, worktreesRoot, candidatePath)) {
              return O.some<DiscoveredCandidate>({
                root,
                path: candidatePath,
                reapClass: "dangling-worktree-stub",
                idleSinceMillis,
                classified: false,
                shapeSkipReason: O.some("wrong-shape"),
                parentRepo: O.none(),
              });
            }
            return O.some(yield* discoverDanglingWorktreeStub(root, candidatePath, idleSinceMillis));
          }),
          { concurrency: 16 }
        );
        return A.getSomes(candidates);
      }),
      { concurrency: 8 }
    )
  );
});

const canonicalDirectoryWithin = Effect.fnUntraced(function* (
  root: string,
  candidatePath: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  if (O.isSome(yield* fs.readLink(candidatePath).pipe(Effect.option))) {
    return O.none();
  }
  const canonicalPath = yield* fs.realPath(candidatePath).pipe(Effect.option);
  if (
    O.isNone(canonicalPath) ||
    !Str.Equivalence(canonicalPath.value, pathService.normalize(candidatePath)) ||
    !pathIsWithin(pathService, root, canonicalPath.value) ||
    !(yield* isDirectory(canonicalPath.value))
  ) {
    return O.none();
  }
  return canonicalPath;
});

const classifyTopLevelDirectory = Effect.fnUntraced(function* (
  root: string,
  name: string,
  siblingNames: ReadonlyArray<string>
): Effect.fn.Return<O.Option<DiscoveredCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const pathService = yield* Path.Path;
  const canonicalPath = yield* canonicalDirectoryWithin(root, pathService.join(root, name));
  if (O.isNone(canonicalPath)) {
    return O.none();
  }
  const candidatePath = canonicalPath.value;
  const candidateMtime = O.getOrElse(yield* statMtimeMillis(candidatePath), () => 0);
  if (Str.startsWith(HEAD_INSTALL_PREFIX)(name)) {
    return O.some({
      root,
      path: candidatePath,
      reapClass: "head-install",
      idleSinceMillis: candidateMtime,
      classified: true,
      shapeSkipReason: O.none(),
      parentRepo: O.none(),
    });
  }
  if (Str.startsWith(FALLOW_CACHE_PREFIX)(name)) {
    return O.some({
      root,
      path: candidatePath,
      reapClass: "fallow-cache",
      idleSinceMillis: yield* fallowIdleSinceMillis(candidatePath, candidateMtime, siblingNames),
      classified: true,
      shapeSkipReason: O.none(),
      parentRepo: O.none(),
    });
  }
  if (isScopedTempName(name)) {
    return O.some({
      root,
      path: candidatePath,
      reapClass: "scoped-temp",
      idleSinceMillis: candidateMtime,
      classified: true,
      shapeSkipReason: O.none(),
      parentRepo: O.none(),
    });
  }
  const vitest = yield* discoverVitestForksTmp(root, candidatePath, name, candidateMtime);
  return O.isSome(vitest) ? vitest : yield* discoverGitWorktree(root, candidatePath, candidateMtime);
});

const discoverTopLevel = Effect.fnUntraced(function* (
  root: string
): Effect.fn.Return<ReadonlyArray<DiscoveredCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const names = yield* directoryNames(root);
  const topLevel = A.getSomes(
    yield* Effect.forEach(names, (name) => classifyTopLevelDirectory(root, name, names), { concurrency: 16 })
  );
  return A.appendAll(topLevel, yield* discoverWorktreeStubs(root, names));
});

const discoverCacheHeadInstalls = Effect.fnUntraced(function* (
  cacheRoot: string
): Effect.fn.Return<ReadonlyArray<DiscoveredCandidate>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const canonicalCacheRoot = yield* fs.realPath(cacheRoot).pipe(Effect.orElseSucceed(() => cacheRoot));
  const configuredBase = pathService.join(canonicalCacheRoot, "beep", "head-install");
  const base = yield* fs.realPath(configuredBase).pipe(Effect.orElseSucceed(() => configuredBase));
  if (!pathIsWithin(pathService, canonicalCacheRoot, base)) {
    return A.empty();
  }
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
  const pathService = yield* Path.Path;
  const lexicalPaths = A.filter(A.dedupe(candidatePaths), (candidate) => pathIsWithin(pathService, tmpRoot, candidate));
  const canonicalPaths = A.getSomes(
    yield* Effect.forEach(lexicalPaths, (candidate) => canonicalDirectoryWithin(tmpRoot, candidate), {
      concurrency: 16,
    })
  );
  return A.getSomes(
    yield* Effect.forEach(
      canonicalPaths,
      Effect.fnUntraced(function* (candidatePath: string) {
        const mtime = O.getOrElse(yield* statMtimeMillis(candidatePath), () => 0);
        return yield* discoverGitWorktree(tmpRoot, candidatePath, mtime);
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
): Effect.fn.Return<ProcessReferences, never, FileSystem.FileSystem | Path.Path> {
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

const listHostProcessCommandLines = Effect.fnUntraced(function* (): Effect.fn.Return<
  ReadonlyArray<string>,
  never,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const pids = A.filter(yield* directoryNames(PROC_ROOT), isProcPidName);
  return A.getSomes(
    yield* Effect.forEach(
      pids,
      (pid) => fs.readFileString(pathService.join(PROC_ROOT, pid, "cmdline")).pipe(Effect.option),
      { concurrency: 16 }
    )
  );
});

const scanProcReferences = Effect.fnUntraced(function* (
  processListing: ProcessCommandLineListing
): Effect.fn.Return<ProcReferenceSnapshot, never, FileSystem.FileSystem | Path.Path> {
  const pathService = yield* Path.Path;
  const pids = A.filter(yield* directoryNames(PROC_ROOT), isProcPidName);
  const snapshots = yield* Effect.forEach(pids, (pid) => processReferences(pathService.join(PROC_ROOT, pid)), {
    concurrency: 16,
  });
  const commandLines = yield* processListing();
  return {
    cwdTargets: A.flatten(A.map(snapshots, (snapshot) => snapshot.cwdTargets)),
    fdTargets: A.flatten(A.map(snapshots, (snapshot) => snapshot.fdTargets)),
    vitestRunning: A.some(commandLines, Str.includes("vitest")),
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
  if (!Str.Equivalence(candidate.reapClass, "fallow-cache")) {
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

const worktreeIsDirty = Effect.fnUntraced(function* (
  candidate: DiscoveredCandidate
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  if (!Str.Equivalence(candidate.reapClass, "git-worktree") || O.isNone(candidate.parentRepo)) {
    return false;
  }
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const gitFileContent = yield* fs.readFileString(pathService.join(candidate.path, ".git")).pipe(Effect.option);
  const gitDir = pipe(
    gitFileContent,
    O.flatMap((content) => gitDirFromGitFile(pathService, candidate.path, content))
  );
  const locked = yield* pipe(
    gitDir,
    O.match({
      onNone: () => Effect.succeed(false),
      onSome: (dir) => Effect.map(Effect.option(fs.stat(pathService.join(dir, "locked"))), O.isSome),
    })
  );
  if (locked) {
    return true;
  }
  const status = yield* runRepoCommandCapture(
    "git",
    ["-C", candidate.path, "status", "--porcelain", "--no-renames"],
    candidate.parentRepo.value
  ).pipe(Effect.option);
  return O.match(status, {
    // A worktree whose status cannot be read is treated as dirty: never
    // force-remove what cannot be proven clean.
    onNone: () => true,
    onSome: (capture) => capture.exitCode !== 0 || Str.isNonEmpty(Str.trim(capture.output)),
  });
});

const thresholdFor = (reapClass: TmpfsReapClass): Duration.Duration =>
  TmpfsReapClass.$match(reapClass, {
    "git-worktree": () => Duration.hours(2),
    "head-install": () => Duration.hours(1),
    "fallow-cache": () => Duration.hours(6),
    "scoped-temp": () => Duration.hours(2),
    "vitest-forks-tmp": () => Duration.hours(24),
    "dangling-worktree-stub": () => Duration.hours(2),
  });

const classificationSkipReason = (
  candidate: DiscoveredCandidate,
  vitestRunning: boolean
): O.Option<TmpfsReapSkipReason> =>
  O.firstSomeOf([
    candidate.shapeSkipReason,
    candidate.classified ? O.none<TmpfsReapSkipReason>() : O.some<TmpfsReapSkipReason>("unclassified"),
    TmpfsReapClass.$match(candidate.reapClass, {
      "git-worktree": O.none<TmpfsReapSkipReason>,
      "head-install": O.none<TmpfsReapSkipReason>,
      "fallow-cache": O.none<TmpfsReapSkipReason>,
      "scoped-temp": O.none<TmpfsReapSkipReason>,
      "vitest-forks-tmp": () => skipReasonWhen(vitestRunning, "live-runner"),
      "dangling-worktree-stub": O.none<TmpfsReapSkipReason>,
    }),
  ]);

const livenessSkipReason = (liveness: CandidateLiveness): O.Option<TmpfsReapSkipReason> => {
  if (liveness.cwdCount > 0) {
    return O.some("live-cwd-ref");
  }
  if (liveness.fdCount > 0) {
    return O.some("live-fd-ref");
  }
  return liveness.liveFlock ? O.some("live-flock") : O.none();
};

const stateSkipReason = (
  candidate: DiscoveredCandidate,
  ageHours: number,
  dirtyWorktree: boolean
): O.Option<TmpfsReapSkipReason> => {
  if (dirtyWorktree) {
    return O.some("dirty-worktree");
  }
  return ageHours < Duration.toHours(thresholdFor(candidate.reapClass)) ? O.some("too-young") : O.none();
};

const skipReasonFor = (
  candidate: DiscoveredCandidate,
  ageHours: number,
  liveness: CandidateLiveness,
  dirtyWorktree: boolean,
  vitestRunning: boolean
): O.Option<TmpfsReapSkipReason> =>
  O.firstSomeOf([
    classificationSkipReason(candidate, vitestRunning),
    livenessSkipReason(liveness),
    stateSkipReason(candidate, ageHours, dirtyWorktree),
  ]);

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

const releaseNestedHeadInstallCheckout = Effect.fnUntraced(function* (
  candidate: DiscoveredCandidate
): Effect.fn.Return<
  ReadonlyArray<string>,
  never,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (!Str.Equivalence(candidate.reapClass, "head-install")) {
    return A.empty();
  }
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const checkout = pathService.join(candidate.path, "checkout");
  const canonicalCheckout = yield* canonicalDirectoryWithin(candidate.path, checkout);
  if (O.isNone(canonicalCheckout)) {
    return (yield* fs.exists(checkout).pipe(Effect.orElseSucceed(() => false)))
      ? [`Skipped unsafe nested head-install checkout ${checkout}.`]
      : A.empty();
  }
  const nested = yield* discoverGitWorktree(candidate.path, canonicalCheckout.value, candidate.idleSinceMillis);
  if (O.isNone(nested) || O.isNone(nested.value.parentRepo)) {
    return A.empty();
  }
  const outcome = yield* removeGitWorktreeCandidate(nested.value);
  return outcome.reaped
    ? outcome.warnings
    : A.append(outcome.warnings, `Nested head-install checkout ${checkout} was not released through Git.`);
});

const removeDirectoryCandidate = Effect.fnUntraced(function* (
  candidate: DiscoveredCandidate,
  nestedWarnings: ReadonlyArray<string> = A.empty()
): Effect.fn.Return<ApplyOutcome, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const extras = Str.Equivalence(candidate.reapClass, "fallow-cache")
    ? yield* fallowSiblingArtifacts(candidate.path)
    : A.empty();
  const removed = yield* fs.remove(candidate.path, { force: true, recursive: true }).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false)
  );
  if (!removed) {
    return { reaped: false, warnings: A.append(nestedWarnings, `Failed to remove ${candidate.path}.`) };
  }
  yield* Effect.forEach(extras, (extra) => fs.remove(extra, { force: true, recursive: true }).pipe(Effect.ignore), {
    discard: true,
    concurrency: 4,
  });
  if (!Str.Equivalence(candidate.reapClass, "dangling-worktree-stub")) {
    return { reaped: true, warnings: nestedWarnings };
  }
  const parent = pathService.dirname(candidate.path);
  const parentEntries = yield* readDirectoryOption(parent);
  if (O.isNone(parentEntries)) {
    return {
      reaped: true,
      warnings: A.append(nestedWarnings, `Could not verify whether dangling-stub container ${parent} is empty.`),
    };
  }
  if (!A.isReadonlyArrayEmpty(parentEntries.value) || !pathIsWithin(pathService, candidate.root, parent)) {
    return { reaped: true, warnings: nestedWarnings };
  }
  yield* fs.remove(parent).pipe(Effect.ignore);
  return { reaped: true, warnings: nestedWarnings };
});

const removeGitWorktreeCandidate = Effect.fnUntraced(function* (
  candidate: DiscoveredCandidate
): Effect.fn.Return<ApplyOutcome, never, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  if (!(yield* candidatePathIsStillSafe(candidate))) {
    return emptyApplyOutcome(`Skipped ${candidate.path}: worktree path changed or escaped its discovery root.`);
  }
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

const candidatePathIsStillSafe = Effect.fnUntraced(function* (
  candidate: DiscoveredCandidate
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  if (O.isSome(yield* fs.readLink(candidate.path).pipe(Effect.option))) {
    return false;
  }
  return pipe(
    yield* fs.realPath(candidate.path).pipe(Effect.option),
    O.exists(
      (canonicalPath) =>
        Str.Equivalence(canonicalPath, candidate.path) && pathIsWithin(pathService, candidate.root, canonicalPath)
    )
  );
});

const applyCandidate = Effect.fnUntraced(function* (
  candidate: MeasuredCandidate
): Effect.fn.Return<ApplyOutcome, never, FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  if (O.isSome(candidate.skipReason)) {
    return { reaped: false, warnings: [] };
  }
  if (!(yield* candidatePathIsStillSafe(candidate.discovered))) {
    return emptyApplyOutcome(`Skipped ${candidate.discovered.path}: path changed or escaped its discovery root.`);
  }
  if (Str.Equivalence(candidate.discovered.reapClass, "git-worktree")) {
    return yield* removeGitWorktreeCandidate(candidate.discovered);
  }
  const nestedWarnings = yield* releaseNestedHeadInstallCheckout(candidate.discovered);
  return yield* removeDirectoryCandidate(candidate.discovered, nestedWarnings);
});

const candidateModel = (candidate: MeasuredCandidate): TmpfsReapCandidate =>
  TmpfsReapCandidate.make({
    root: candidate.discovered.root,
    path: candidate.discovered.path,
    reapClass: candidate.discovered.reapClass,
    ageHours: candidate.ageHours,
    refCount: candidate.liveness.cwdCount + candidate.liveness.fdCount,
    action: O.isSome(candidate.skipReason)
      ? "skip"
      : Str.Equivalence(candidate.discovered.reapClass, "git-worktree")
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
  const home = O.filter(yield* Config.option(Config.string("HOME")), Str.isNonEmpty);
  if (O.isSome(home)) {
    return pathService.join(pathService.resolve(home.value), ".cache");
  }
  const tmpFallback = yield* Config.string("TMPDIR").pipe(Config.withDefault("/tmp"));
  return pathService.resolve(tmpFallback);
});

const configuredPath = (name: string) =>
  Config.option(Config.string(name)).pipe(
    Effect.orElseSucceed(() => O.none()),
    Effect.map(O.filter(Str.isNonEmpty))
  );

const canonicalRoot = Effect.fnUntraced(function* (
  root: string
): Effect.fn.Return<string, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  return O.getOrElse(yield* fs.realPath(root).pipe(Effect.option), () => pathService.resolve(root));
});

const unsafeTmpRootWarning = (
  pathService: Path.Path,
  configuredRoot: string,
  canonicalHome: O.Option<string>,
  canonicalCheckout: O.Option<string>
): O.Option<string> => {
  if (Str.Equivalence(configuredRoot, pathService.parse(configuredRoot).root)) {
    return O.some("Dropped TMPDIR because it resolves to the filesystem root.");
  }
  if (O.exists(canonicalHome, (home) => Str.Equivalence(configuredRoot, home))) {
    return O.some("Dropped TMPDIR because it resolves to HOME.");
  }
  if (O.exists(canonicalHome, (home) => pathIsWithin(pathService, configuredRoot, home))) {
    return O.some("Dropped TMPDIR because it is an ancestor of HOME.");
  }
  return O.exists(canonicalCheckout, (checkout) => pathIsWithin(pathService, configuredRoot, checkout))
    ? O.some("Dropped TMPDIR because it contains the invoking checkout.")
    : O.none();
};

const resolveAmbientTmpfsRoots = Effect.fnUntraced(function* (
  systemTmpRoot: string
): Effect.fn.Return<TmpfsRootsResolution, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const configuredTmpRoot = yield* configuredPath("TMPDIR");
  if (O.isNone(configuredTmpRoot)) {
    return { roots: [systemTmpRoot], warnings: A.empty() };
  }
  if (!pathService.isAbsolute(configuredTmpRoot.value)) {
    return { roots: [systemTmpRoot], warnings: ["Dropped TMPDIR because it is not an absolute path."] };
  }
  const canonicalConfiguredRoot = yield* fs.realPath(configuredTmpRoot.value).pipe(Effect.option);
  if (O.isNone(canonicalConfiguredRoot)) {
    return { roots: [systemTmpRoot], warnings: ["Dropped TMPDIR because its canonical path is unreadable."] };
  }
  const configuredRoot = canonicalConfiguredRoot.value;
  if (Str.Equivalence(configuredRoot, systemTmpRoot)) {
    return { roots: [systemTmpRoot], warnings: A.empty() };
  }
  const configuredHome = yield* configuredPath("HOME");
  const canonicalHome = yield* pipe(
    configuredHome,
    O.match({
      onNone: () => Effect.succeed(O.none<string>()),
      onSome: (home) => fs.realPath(home).pipe(Effect.option),
    })
  );
  const canonicalCheckout = yield* fs.realPath(process.cwd()).pipe(Effect.option);
  const warning = unsafeTmpRootWarning(pathService, configuredRoot, canonicalHome, canonicalCheckout);
  return O.match(warning, {
    onNone: () => ({ roots: A.dedupe([systemTmpRoot, configuredRoot]), warnings: A.empty() }),
    onSome: (message) => ({ roots: [systemTmpRoot], warnings: [message] }),
  });
});

const resolveTmpfsRoots = Effect.fnUntraced(function* (
  explicitTmpRoot: O.Option<string>,
  systemTmpRootOverride: O.Option<string>
): Effect.fn.Return<TmpfsRootsResolution, never, FileSystem.FileSystem | Path.Path> {
  if (O.isSome(explicitTmpRoot)) {
    return {
      roots: [yield* canonicalRoot(explicitTmpRoot.value)],
      warnings: A.empty(),
    };
  }
  const configuredSystemRoot = O.getOrElse(systemTmpRootOverride, () => "/tmp");
  return yield* resolveAmbientTmpfsRoots(yield* canonicalRoot(configuredSystemRoot));
});

/**
 * Discover known temporary artifacts, prove conjunctive idleness, and optionally reap them.
 *
 * Dry-run is the default. Production scans `/tmp` and a distinct absolute
 * `TMPDIR`. Tests may supply an isolated `tmpRoot`, which deliberately disables
 * ambient multi-root discovery, plus `cacheRoot`, `nowMillis`, and the
 * `systemTmpRoot` seam values. Sweep
 * may additionally pass the current repository's
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
    readonly listProcessCommandLines?: ProcessCommandLineListing;
    readonly nowMillis?: number;
    readonly systemTmpRoot?: string;
    readonly tmpRoot?: string;
  } = {}
) {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const requestedTmpRoot = O.fromUndefinedOr(options.tmpRoot);
  const rootResolution = yield* resolveTmpfsRoots(requestedTmpRoot, O.fromUndefinedOr(options.systemTmpRoot));
  const tmpRoots = rootResolution.roots;
  const tmpRoot = O.getOrThrow(A.head(tmpRoots));
  const classes = O.getOrElse(O.fromUndefinedOr(options.classes), () => TmpfsReapClass.Options);
  const includeClass = (reapClass: TmpfsReapClass): boolean => A.contains(classes, reapClass);
  const explicitGitWorktreePaths = O.fromUndefinedOr(options.gitWorktreePaths);

  const tmpCandidates = A.flatten(
    yield* Effect.forEach(
      tmpRoots,
      (root) =>
        O.isSome(explicitGitWorktreePaths)
          ? discoverExplicitGitWorktrees(root, explicitGitWorktreePaths.value)
          : discoverTopLevel(root),
      { concurrency: 2 }
    )
  );
  const cacheCandidates = includeClass("head-install")
    ? yield* discoverCacheHeadInstalls(yield* resolveBeepCacheRoot(options.cacheRoot))
    : A.empty<DiscoveredCandidate>();
  const discovered = A.filter(
    A.dedupeWith(A.appendAll(tmpCandidates, cacheCandidates), sameCandidatePath),
    (candidate) => includeClass(candidate.reapClass)
  );

  const processListing: ProcessCommandLineListing = O.getOrElse(
    O.fromUndefinedOr(options.listProcessCommandLines),
    () => listHostProcessCommandLines
  );
  const proc = yield* scanProcReferences(processListing);
  const heldLockInodes = lockInodes(yield* fs.readFileString(PROC_LOCKS));
  const nowMillis = yield* Clock.currentTimeMillis;
  const effectiveNowMillis = O.getOrElse(O.fromUndefinedOr(options.nowMillis), () => nowMillis);
  const measured = yield* Effect.forEach(
    discovered,
    Effect.fnUntraced(function* (candidate: DiscoveredCandidate) {
      const liveness = yield* candidateLiveness(candidate, proc, heldLockInodes, pathService.sep);
      const ageHours = Duration.toHours(Duration.millis(N.max(0, effectiveNowMillis - candidate.idleSinceMillis)));
      const dirtyWorktree = yield* worktreeIsDirty(candidate);
      const skipReason = skipReasonFor(candidate, ageHours, liveness, dirtyWorktree, proc.vitestRunning);
      const bytes =
        O.isNone(skipReason) && !Str.Equivalence(candidate.reapClass, "git-worktree")
          ? yield* measureBytes(candidate.path)
          : O.none<number>();
      return {
        discovered: candidate,
        ageHours,
        bytes,
        liveness,
        skipReason,
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
    tmpRoots,
    applied: apply,
    candidates: A.map(measured, candidateModel),
    reapedCount: A.length(reapedIndexes),
    reclaimedBytes,
    warnings: A.appendAll(rootResolution.warnings, A.flatten(A.map(outcomes, (outcome) => outcome.warnings))),
  });
});
