/**
 * Preservation-first removal service for managed Git worktrees.
 *
 * Archive mode atomically renames the checkout aside first, so nothing new can
 * land under the original path, refuses while any same-uid process still holds
 * the fenced copy by cwd or open descriptor, then captures the fenced copy: the
 * target commit becomes reachable through a create-only ref, tracked and
 * untracked residue is written outside the checkout, and only then is the
 * fenced copy deleted and its branch ref removed by compare-and-swap on the
 * archived head.
 * Plain removal keeps its existing refusal when the target has uncommitted
 * changes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { ISOStr } from "@beep/schema/Timestamp";
import { A, O, Str } from "@beep/utils";
import { Config, Context, DateTime, Effect, FileSystem, Layer, Match, Path, pipe, Result } from "effect";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import {
  collectUntrackedPaths,
  ProcessAttachmentKind,
  resolveGitCommit,
  runGitOutput,
  runGitRawOutput,
  scanProcessAttachments,
} from "../../internal/repo-run/index.ts";
import { WorktreeCommandError, WorktreeDirtyError, WorktreePreservationError } from "./Worktree.errors.ts";
import {
  WorktreeArchivePlan,
  WorktreeRemovalReceipt,
  WorktreeRemovalRequest,
  WorktreeRepositoryHash,
  WorktreeResidueManifest,
  WorktreeResidueReason,
} from "./Worktree.schemas.ts";
import type { Crypto } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GitCommandErrorAdapter, ProcessAttachment } from "../../internal/repo-run/index.ts";
import type { WorktreeResidueReason as WorktreeResidueReasonType } from "./Worktree.schemas.ts";

const $I = $RepoCliId.create("commands/Worktree/Worktree.service");

const RESIDUE_ROOT_ENV = "BEEP_WORKTREE_RESIDUE_ROOT";
const textEncoder = new TextEncoder();

const GitCountFromString = S.FiniteFromString.pipe(
  S.decodeTo(NonNegativeInt),
  $I.annoteSchema("GitCountFromString", {
    description: "Non-negative integer count decoded from Git command output.",
  })
);

const decodeGitCount = S.decodeUnknownEffect(GitCountFromString);
const decodeGitObjectId = S.decodeUnknownEffect(GitObjectId);
const decodeIsoString = S.decodeUnknownEffect(ISOStr);
const decodeSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeWorktreeRepositoryHash = S.decodeUnknownEffect(WorktreeRepositoryHash);
const encodeResidueManifest = S.encodeEffect(S.fromJsonString(WorktreeResidueManifest, { space: 2 }));

/**
 * Build the `git worktree remove` argument vector after optional preservation.
 *
 * **Example** (Preserved residue permits dirty removal)
 *
 * ```ts
 * import { worktreeRemoveArgs } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(worktreeRemoveArgs("/repo-worktrees/feature-x", true))
 * // ["worktree", "remove", "--force", "/repo-worktrees/feature-x"]
 * console.log(worktreeRemoveArgs("/repo-worktrees/feature-x", false).length) // 3
 * ```
 *
 * @param targetPath - Absolute path of the worktree to remove.
 * @param allowDirtyRemoval - Whether preservation completed so Git may remove dirty state.
 * @returns The `git` argument vector (excluding the `git` executable).
 * @category utilities
 * @since 0.0.0
 */
export const worktreeRemoveArgs: {
  (allowDirtyRemoval: boolean): (targetPath: string) => ReadonlyArray<string>;
  (targetPath: string, allowDirtyRemoval: boolean): ReadonlyArray<string>;
} = dual(
  2,
  (targetPath: string, allowDirtyRemoval: boolean): ReadonlyArray<string> =>
    allowDirtyRemoval ? ["worktree", "remove", "--force", targetPath] : ["worktree", "remove", targetPath]
);

/**
 * Suggested command an operator can run to delete a retired branch.
 *
 * **Example** (Render the cleanup hint after a removal)
 *
 * ```ts
 * import { branchDeleteCommand } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(branchDeleteCommand("feat/feature-x")) // "git branch -D feat/feature-x"
 * ```
 *
 * @param branch - Branch left behind after a worktree is removed.
 * @returns The `git branch -D <branch>` command string.
 * @category utilities
 * @since 0.0.0
 */
export const branchDeleteCommand = (branch: string): string => `git branch -D ${branch}`;

/**
 * Build the create-only `git update-ref` arguments for an archive reference.
 *
 * **Details**
 *
 * The all-zero old object id requires the ref not to exist, so a same-second
 * archive collision fails without replacing the earlier retirement ref.
 *
 * **Example** (Require a new SHA-1 archive ref)
 *
 * ```ts
 * import { worktreeArchiveRefArgs } from "@beep/repo-cli/commands/Worktree"
 *
 * const args = worktreeArchiveRefArgs(
 *   "refs/archive/worktrees/feature-x/20260902-123456",
 *   "1ed08f66df016a18c6d7d56bd97aa778912cb37b"
 * )
 * console.log(args[3]?.length) // 40
 * ```
 *
 * @param archiveRef - Full archive reference to create.
 * @param head - Full Git object id the new reference must retain.
 * @returns Create-only `git update-ref` arguments.
 * @category utilities
 * @since 0.0.0
 */
export const worktreeArchiveRefArgs: {
  (head: GitObjectId): (archiveRef: string) => ReadonlyArray<string>;
  (archiveRef: string, head: GitObjectId): ReadonlyArray<string>;
} = dual(
  2,
  (archiveRef: string, head: GitObjectId): ReadonlyArray<string> => [
    "update-ref",
    archiveRef,
    head,
    Str.repeat(head.length)("0"),
  ]
);

/**
 * Build an atomic compare-and-swap branch-deletion argument list.
 *
 * **Details**
 *
 * `git update-ref -d <ref> <expected>` deletes the ref only while it still
 * equals the expected object id, under git's own ref locking. A branch that
 * advanced after its removal was authorized therefore fails the deletion
 * atomically instead of having its new commits orphaned — the non-atomic
 * `git branch -D` cannot make that guarantee.
 *
 * **Example** (Delete an archived branch at its archived head)
 *
 * ```ts
 * import { worktreeBranchDeleteArgs } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(worktreeBranchDeleteArgs("feat/feature-x", "1ed08f66df016a18c6d7d56bd97aa778912cb37b")[1]) // "-d"
 * ```
 *
 * @param branch - Local branch to delete after archive removal.
 * @param head - Object id the branch must still point at for the deletion to apply.
 * @returns `git update-ref -d` compare-and-swap arguments.
 * @category utilities
 * @since 0.0.0
 */
export const worktreeBranchDeleteArgs: {
  (head: string): (branch: string) => ReadonlyArray<string>;
  (branch: string, head: string): ReadonlyArray<string>;
} = dual(
  2,
  (branch: string, head: string): ReadonlyArray<string> => ["update-ref", "-d", `refs/heads/${branch}`, head]
);

/**
 * Build the deterministic archive-ref and filesystem layout for a retirement.
 *
 * **Example** (Plan residue paths)
 *
 * ```ts
 * import { WorktreeRepositoryHash, worktreeArchivePlan } from "@beep/repo-cli/commands/Worktree"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.map(Path.Path, (path) =>
 *   worktreeArchivePlan(
 *     path,
 *     "/cache",
 *     "beep-effect",
 *     WorktreeRepositoryHash.make("0123456789ab"),
 *     "feature-x",
 *     "20260902-123456"
 *   )
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param path - Platform path service used to build native filesystem paths.
 * @param residueBaseRoot - Configured base directory for all worktree residue.
 * @param repoBasename - Basename of the repository's main checkout.
 * @param repositoryHash - First 12 hex digits of the absolute main-checkout identity hash.
 * @param name - Managed worktree name.
 * @param stamp - UTC `YYYYMMDD-HHMMSS` retirement stamp.
 * @returns The archive ref, residue directory, and artifact paths.
 * @category utilities
 * @since 0.0.0
 */
export const worktreeArchivePlan: {
  (
    path: Path.Path,
    residueBaseRoot: string,
    repoBasename: string,
    repositoryHash: WorktreeRepositoryHash,
    name: string,
    stamp: string
  ): WorktreeArchivePlan;
  (
    residueBaseRoot: string,
    repoBasename: string,
    repositoryHash: WorktreeRepositoryHash,
    name: string,
    stamp: string
  ): (path: Path.Path) => WorktreeArchivePlan;
} = dual(
  6,
  (
    path: Path.Path,
    residueBaseRoot: string,
    repoBasename: string,
    repositoryHash: WorktreeRepositoryHash,
    name: string,
    stamp: string
  ) => {
    const sanitizedName = pipe(
      name,
      Str.replaceAll(/[^0-9A-Za-z._-]+/gu, "-"),
      Str.replaceAll(/-+/gu, "-"),
      Str.replaceAll(/\.{2,}/gu, "-"),
      Str.replaceAll(/-+/gu, "-"),
      Str.replaceAll(/^[.-]+|[.-]+$/gu, "")
    );
    const nonEmptyName = Str.isEmpty(sanitizedName) ? "worktree" : sanitizedName;
    const refName = Str.endsWith(".lock")(nonEmptyName) ? `${nonEmptyName}-worktree` : nonEmptyName;
    const residueRoot = path.join(residueBaseRoot, `${repoBasename}-${repositoryHash}`, `${name}-${stamp}`);
    return WorktreeArchivePlan.make({
      archiveRef: `refs/archive/worktrees/${refName}/${stamp}`,
      residueRoot,
      patchPath: path.join(residueRoot, "tracked.patch"),
      untrackedRoot: path.join(residueRoot, "untracked"),
      manifestPath: path.join(residueRoot, "manifest.json"),
    });
  }
);

const residueReasonMatcher = Match.type<{ readonly dirty: boolean; readonly unpushed: boolean }>().pipe(
  Match.when({ dirty: true, unpushed: true }, () => WorktreeResidueReason.Enum["dirty+unpushed"]),
  Match.when({ dirty: true }, () => WorktreeResidueReason.Enum.dirty),
  Match.when({ unpushed: true }, () => WorktreeResidueReason.Enum["unpushed-commits"]),
  Match.orElse(() => WorktreeResidueReason.Enum.clean)
);

/**
 * Classify the state that makes archive retirement necessary.
 *
 * **Example** (Classify dirty and unpushed state)
 *
 * ```ts
 * import { worktreeResidueReason } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(worktreeResidueReason(true, true)) // "dirty+unpushed"
 * console.log(worktreeResidueReason(false, false)) // "clean"
 * ```
 *
 * @param dirty - Whether tracked or untracked changes are present.
 * @param unpushed - Whether commits are absent from `origin/main` or the branch upstream.
 * @returns The manifest reason literal.
 * @category utilities
 * @since 0.0.0
 */
export const worktreeResidueReason: {
  (dirty: boolean, unpushed: boolean): WorktreeResidueReasonType;
  (unpushed: boolean): (dirty: boolean) => WorktreeResidueReasonType;
} = dual(
  2,
  (dirty: boolean, unpushed: boolean): WorktreeResidueReasonType => residueReasonMatcher({ dirty, unpushed })
);

/**
 * Service contract for legacy and preservation-first worktree removal.
 *
 * @category services
 * @since 0.0.0
 */
export interface WorktreeRemovalServiceShape {
  /** Inspect whether `HEAD` contains commits absent from `origin/main` or its upstream. @since 0.0.0 */
  readonly hasUnpushedCommits: (
    targetPath: string,
    branch: O.Option<string>
  ) => Effect.Effect<boolean, WorktreeCommandError>;
  /**
   * Remove one resolved managed worktree, preserving residue first when
   * archive mode finds dirty state or unpushed commits.
   *
   * @since 0.0.0
   */
  readonly remove: (
    request: WorktreeRemovalRequest
  ) => Effect.Effect<WorktreeRemovalReceipt, WorktreeCommandError | WorktreeDirtyError | WorktreePreservationError>;
}

/**
 * Service tag for worktree removal and retirement inspection.
 *
 * **Example** (Access the removal service)
 *
 * ```ts
 * import { WorktreeRemovalService } from "@beep/repo-cli/commands/Worktree"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = Effect.map(WorktreeRemovalService, (service) => service.hasUnpushedCommits("/repo", O.none()))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WorktreeRemovalService extends Context.Service<WorktreeRemovalService, WorktreeRemovalServiceShape>()(
  $I`WorktreeRemovalService`
) {}

type WorktreeRemovalServiceRequirements =
  | Crypto.Crypto
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner;

const commandErrorAdapter = (failMessage: string): GitCommandErrorAdapter<WorktreeCommandError> => ({
  onSpawnFailure: (commandLine) => WorktreeCommandError.new(failMessage, { command: commandLine }),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    WorktreeCommandError.make({ message: `${failMessage} (exit ${exitCode}).`, command: commandLine, exitCode }),
  onTruncated: O.none(),
});

const preservationErrorAdapter = (
  step: WorktreePreservationError["step"],
  failMessage: string,
  path?: string
): GitCommandErrorAdapter<WorktreePreservationError> => ({
  onSpawnFailure: (commandLine) => (cause) =>
    WorktreePreservationError.new(step, `${failMessage} Command: ${commandLine}.`, {
      cause,
      ...O.getSomesStruct({ path: O.fromUndefinedOr(path) }),
    }),
  onNonZeroExit: ({ commandLine, exitCode, output }) =>
    WorktreePreservationError.new(step, `${failMessage} Command: ${commandLine}; exit ${exitCode}. ${output}`, {
      ...O.getSomesStruct({ path: O.fromUndefinedOr(path) }),
    }),
  onTruncated: O.none(),
});

/**
 * Run a captured Git command with the Worktree command's typed error boundary.
 *
 * **Example** (Build a captured status operation)
 *
 * ```ts
 * import { runWorktreeGitCapture } from "@beep/repo-cli/commands/Worktree"
 * import { Effect } from "effect"
 *
 * const operation = runWorktreeGitCapture("/repo", ["status", "--short"], "Could not inspect the repo.")
 * console.log(Effect.isEffect(operation)) // true
 * ```
 *
 * @param cwd - Checkout from which Git should run.
 * @param args - Git arguments excluding the executable.
 * @param failMessage - Message attached to spawn and non-zero-exit failures.
 * @returns Captured and trimmed Git output.
 * @category commands
 * @since 0.0.0
 */
export const runWorktreeGitCapture = Effect.fn("WorktreeRemovalService.runWorktreeGitCapture")(function* (
  cwd: string,
  args: ReadonlyArray<string>,
  failMessage: string
): Effect.fn.Return<string, WorktreeCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitOutput(cwd, args, commandErrorAdapter(failMessage));
});

const runPreservationCommand = Effect.fn("WorktreeRemovalService.runPreservationCommand")(function* (
  cwd: string,
  args: ReadonlyArray<string>,
  step: WorktreePreservationError["step"],
  failMessage: string,
  affectedPath?: string
): Effect.fn.Return<string, WorktreePreservationError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitOutput(cwd, args, preservationErrorAdapter(step, failMessage, affectedPath));
});

const decodeCount = Effect.fn("WorktreeRemovalService.decodeCount")(function* (
  output: string,
  step: WorktreePreservationError["step"]
): Effect.fn.Return<NonNegativeInt, WorktreePreservationError> {
  return yield* decodeGitCount(Str.trim(output)).pipe(
    Effect.mapError((cause) => WorktreePreservationError.new(step, "Git returned an invalid commit count.", { cause }))
  );
});

const countCommits = Effect.fn("WorktreeRemovalService.countCommits")(function* (
  targetPath: string,
  revision: string,
  step: WorktreePreservationError["step"]
): Effect.fn.Return<NonNegativeInt, WorktreePreservationError, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* runPreservationCommand(
    targetPath,
    ["rev-list", "--count", revision, "--"],
    step,
    `Failed to count commits in ${revision}.`,
    targetPath
  );
  return yield* decodeCount(output, step);
});

const inspectUnpushed = Effect.fn("WorktreeRemovalService.inspectUnpushed")(function* (
  targetPath: string,
  branch: O.Option<string>
): Effect.fn.Return<boolean, WorktreePreservationError, ChildProcessSpawner.ChildProcessSpawner> {
  const originMain = yield* runPreservationCommand(
    targetPath,
    ["for-each-ref", "--format=%(objectname)", "refs/remotes/origin/main"],
    "inspect-origin-main",
    "Failed to inspect origin/main.",
    targetPath
  );
  const originMainRevision = Str.isNonEmpty(Str.trim(originMain)) ? "origin/main..HEAD" : "HEAD";
  const originMainCount = yield* countCommits(targetPath, originMainRevision, "inspect-origin-main");

  const upstreamCount = yield* O.match(branch, {
    onNone: () => Effect.succeed(NonNegativeInt.make(0)),
    onSome: Effect.fn("WorktreeRemovalService.inspectBranchUpstream")(function* (branchName) {
      const upstream = yield* runPreservationCommand(
        targetPath,
        ["for-each-ref", "--format=%(upstream)", `refs/heads/${branchName}`],
        "inspect-upstream",
        `Failed to inspect the upstream for ${branchName}.`,
        targetPath
      );
      const upstreamRef = Str.trim(upstream);
      return Str.isEmpty(upstreamRef)
        ? NonNegativeInt.make(0)
        : yield* countCommits(targetPath, `${upstreamRef}..HEAD`, "inspect-upstream");
    }),
  });

  return originMainCount > 0 || upstreamCount > 0;
});

const inspectUnpushedAsCommandError = Effect.fn("WorktreeRemovalService.inspectUnpushedAsCommandError")(function* (
  targetPath: string,
  branch: O.Option<string>
): Effect.fn.Return<boolean, WorktreeCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* inspectUnpushed(targetPath, branch).pipe(
    Effect.mapError((error) =>
      WorktreeCommandError.make({
        message: error.message,
        ...O.getSomesStruct({ path: O.fromUndefinedOr(error.path) }),
        cause: error,
      })
    )
  );
});

const archiveStamp = (dateTime: DateTime.DateTime): string => {
  const pad = (part: keyof DateTime.DateTime.PartsWithWeekday): string =>
    Str.padStart(2, "0")(`${DateTime.getPartUtc(dateTime, part)}`);
  return `${DateTime.getPartUtc(dateTime, "year")}${pad("month")}${pad("day")}-${pad("hour")}${pad("minute")}${pad("second")}`;
};

const pathIsEqualOrWithin = (path: Path.Path, root: string, candidate: string): boolean => {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    Str.isEmpty(relative) ||
    (!path.isAbsolute(relative) && !Str.Equivalence(relative, "..") && !Str.startsWith(`..${path.sep}`)(relative))
  );
};

const residueBaseRoot = Effect.fn("WorktreeRemovalService.residueBaseRoot")(function* (
  targetPath: string
): Effect.fn.Return<string, WorktreePreservationError, Path.Path> {
  const path = yield* Path.Path;
  const configured = yield* Config.option(Config.string(RESIDUE_ROOT_ENV)).pipe(
    Effect.mapError((cause) =>
      WorktreePreservationError.new("resolve-residue-root", `Could not read ${RESIDUE_ROOT_ENV}.`, { cause })
    )
  );
  const explicit = O.filter(configured, Str.isNonEmpty);
  let root: string;
  if (O.isSome(explicit)) {
    root = path.resolve(explicit.value);
  } else {
    const configuredHome = yield* Config.option(Config.string("HOME")).pipe(
      Effect.mapError((cause) =>
        WorktreePreservationError.new("resolve-residue-root", "HOME is required for the default residue root.", {
          cause,
        })
      )
    );
    const home = O.filter(configuredHome, Str.isNonEmpty);
    if (O.isNone(home)) {
      return yield* WorktreePreservationError.new(
        "resolve-residue-root",
        "HOME is required for the default residue root."
      );
    }
    root = path.join(path.resolve(home.value), ".cache", "beep", "worktree-residue");
  }

  if (pathIsEqualOrWithin(path, targetPath, root)) {
    return yield* WorktreePreservationError.new(
      "resolve-residue-root",
      `Refused residue root inside the retiring worktree: ${root}. Choose a path outside ${path.resolve(targetPath)}.`,
      { path: root }
    );
  }
  return root;
});

const isContainedRelativePath = (path: Path.Path, root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return Str.isNonEmpty(relative) && pathIsEqualOrWithin(path, root, candidate);
};

const copyUntrackedFiles = Effect.fn("WorktreeRemovalService.copyUntrackedFiles")(function* (
  targetPath: string,
  plan: WorktreeArchivePlan,
  untrackedFiles: ReadonlyArray<string>
): Effect.fn.Return<void, WorktreePreservationError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  for (const relativePath of untrackedFiles) {
    const source = path.join(targetPath, relativePath);
    const destination = path.join(plan.untrackedRoot, relativePath);
    if (!isContainedRelativePath(path, plan.untrackedRoot, destination)) {
      return yield* WorktreePreservationError.new(
        "copy-untracked-files",
        `Refused untracked path outside the residue root: ${relativePath}.`,
        { path: destination }
      );
    }
    yield* fs.makeDirectory(path.dirname(destination), { recursive: true }).pipe(
      Effect.mapError((cause) =>
        WorktreePreservationError.new("copy-untracked-files", `Could not prepare ${relativePath}.`, {
          cause,
          path: destination,
        })
      )
    );
    yield* fs.copy(source, destination).pipe(
      Effect.mapError((cause) =>
        WorktreePreservationError.new("copy-untracked-files", `Could not copy ${relativePath}.`, {
          cause,
          path: destination,
        })
      )
    );
  }
});

const preserveResidue = Effect.fn("WorktreeRemovalService.preserveResidue")(function* (
  request: WorktreeRemovalRequest,
  head: GitObjectId,
  reason: WorktreeResidueReasonType,
  trackedPatch: string,
  untrackedFiles: ReadonlyArray<string>,
  baseRoot: string
): Effect.fn.Return<WorktreeResidueManifest, WorktreePreservationError, WorktreeRemovalServiceRequirements> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const now = yield* DateTime.now;
  const archivedAt = yield* decodeIsoString(DateTime.formatIso(now)).pipe(
    Effect.mapError((cause) =>
      WorktreePreservationError.new("prepare-residue", "Current time was not a valid ISO timestamp.", { cause })
    )
  );
  const mainCheckout = path.resolve(request.mainCheckout);
  const repositoryDigest = yield* decodeSha256HexFromBytes(textEncoder.encode(mainCheckout)).pipe(
    Effect.mapError((cause) =>
      WorktreePreservationError.new("prepare-residue", "Could not hash the repository identity.", {
        cause,
        path: mainCheckout,
      })
    )
  );
  const repositoryHash = yield* decodeWorktreeRepositoryHash(Str.slice(0, 12)(repositoryDigest)).pipe(
    Effect.mapError((cause) =>
      WorktreePreservationError.new("prepare-residue", "Could not derive the short repository identity.", {
        cause,
        path: mainCheckout,
      })
    )
  );
  const plan = worktreeArchivePlan(
    path,
    baseRoot,
    path.basename(mainCheckout),
    repositoryHash,
    request.name,
    archiveStamp(now)
  );

  yield* runPreservationCommand(
    request.mainCheckout,
    ["check-ref-format", plan.archiveRef],
    "create-archive-ref",
    `Archive ref ${plan.archiveRef} was not accepted by git check-ref-format.`
  );
  yield* runPreservationCommand(
    request.mainCheckout,
    worktreeArchiveRefArgs(plan.archiveRef, head),
    "create-archive-ref",
    `Could not create archive ref ${plan.archiveRef}.`
  );
  yield* fs.makeDirectory(plan.residueRoot, { recursive: true }).pipe(
    Effect.mapError((cause) =>
      WorktreePreservationError.new("prepare-residue", "Could not create the residue directory.", {
        cause,
        path: plan.residueRoot,
      })
    )
  );

  const patchPath = Str.isEmpty(trackedPatch) ? O.none<string>() : O.some(plan.patchPath);
  if (O.isSome(patchPath)) {
    yield* fs.writeFileString(patchPath.value, trackedPatch).pipe(
      Effect.mapError((cause) =>
        WorktreePreservationError.new("write-tracked-patch", "Could not write the tracked binary patch.", {
          cause,
          path: patchPath.value,
        })
      )
    );
  }
  yield* copyUntrackedFiles(request.targetPath, plan, untrackedFiles);

  const manifest = WorktreeResidueManifest.make({
    name: request.name,
    branch: request.branch,
    head,
    archivedAt,
    archiveRef: plan.archiveRef,
    repositoryHash,
    patchPath,
    untrackedFiles,
    residueRoot: plan.residueRoot,
    reason,
  });
  const manifestJson = yield* encodeResidueManifest(manifest).pipe(
    Effect.mapError((cause) =>
      WorktreePreservationError.new("write-manifest", "Could not encode the residue manifest.", {
        cause,
        path: plan.manifestPath,
      })
    )
  );
  yield* fs.writeFileString(plan.manifestPath, `${manifestJson}\n`).pipe(
    Effect.mapError((cause) =>
      WorktreePreservationError.new("write-manifest", "Could not write the residue manifest.", {
        cause,
        path: plan.manifestPath,
      })
    )
  );
  return manifest;
});

const validateRemovalRequest = Effect.fn("WorktreeRemovalService.validateRemovalRequest")(function* (
  request: WorktreeRemovalRequest
): Effect.fn.Return<void, WorktreeCommandError> {
  if (!request.archive && request.deleteBranch) {
    return yield* WorktreeCommandError.make({
      message: "--delete-branch requires --archive so branch deletion cannot discard unreachable commits.",
      path: request.targetPath,
    });
  }
});

const makeRemovalReceipt = (
  request: WorktreeRemovalRequest,
  reason: WorktreeResidueReasonType,
  manifest: O.Option<WorktreeResidueManifest>,
  branchDeleted: boolean
): WorktreeRemovalReceipt =>
  WorktreeRemovalReceipt.make({
    targetPath: request.targetPath,
    branch: request.branch,
    reason,
    manifest,
    branchDeleted,
  });

const inspectRemovalChanges = Effect.fn("WorktreeRemovalService.inspectRemovalChanges")(function* <Error>(
  targetPath: string,
  adapter: GitCommandErrorAdapter<Error>
): Effect.fn.Return<ReadonlyArray<string>, Error, ChildProcessSpawner.ChildProcessSpawner> {
  const statusArgs = ["status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"];
  const statusOutput = yield* runGitOutput(targetPath, statusArgs, adapter);
  return A.filter(Str.split(statusOutput, "\n"), Str.isNonEmpty);
});

const assertNoDirtySubmodules = Effect.fn("WorktreeRemovalService.assertNoDirtySubmodules")(function* (
  request: WorktreeRemovalRequest
): Effect.fn.Return<void, WorktreePreservationError, Path.Path | ChildProcessSpawner.ChildProcessSpawner> {
  const path = yield* Path.Path;
  yield* runPreservationCommand(
    request.targetPath,
    ["submodule", "status", "--recursive"],
    "inspect-submodules",
    "Failed to inspect recursive submodule state.",
    request.targetPath
  );
  const dirtySubmoduleOutput = yield* runGitRawOutput(
    request.targetPath,
    [
      "submodule",
      "foreach",
      "--quiet",
      "--recursive",
      'status=$(git status --porcelain --untracked-files=all --ignore-submodules=all) || exit $?; test -z "$status" || printf "%s\\0" "$displaypath"',
    ],
    preservationErrorAdapter(
      "inspect-submodules",
      "Failed to inspect initialized submodules for uncommitted work.",
      request.targetPath
    )
  );
  const dirtySubmodule = A.head(A.filter(Str.split(dirtySubmoduleOutput, "\0"), Str.isNonEmpty));
  if (O.isSome(dirtySubmodule)) {
    const submodulePath = path.join(request.targetPath, dirtySubmodule.value);
    return yield* WorktreePreservationError.new(
      "inspect-submodules",
      `Submodule ${dirtySubmodule.value} has uncommitted work; commit or clean it before retrying archive retirement.`,
      { path: submodulePath }
    );
  }
});

const inspectArchiveHead = Effect.fn("WorktreeRemovalService.inspectArchiveHead")(function* (
  request: WorktreeRemovalRequest
): Effect.fn.Return<GitObjectId, WorktreePreservationError, ChildProcessSpawner.ChildProcessSpawner> {
  const headOutput = yield* resolveGitCommit(
    request.targetPath,
    "HEAD",
    preservationErrorAdapter("inspect-head", "Failed to resolve the worktree HEAD.", request.targetPath)
  );
  return yield* decodeGitObjectId(Str.trim(headOutput)).pipe(
    Effect.mapError((cause) =>
      WorktreePreservationError.new("inspect-head", "Git returned an invalid full object id for HEAD.", {
        cause,
        path: request.targetPath,
      })
    )
  );
});

const captureAndPreserveResidue = Effect.fn("WorktreeRemovalService.captureAndPreserveResidue")(function* (
  request: WorktreeRemovalRequest,
  head: GitObjectId,
  reason: WorktreeResidueReasonType
): Effect.fn.Return<WorktreeResidueManifest, WorktreePreservationError, WorktreeRemovalServiceRequirements> {
  const baseRoot = yield* residueBaseRoot(request.targetPath);
  const trackedPatch = yield* runGitRawOutput(
    request.targetPath,
    ["diff", "--binary", "HEAD", "--"],
    preservationErrorAdapter("inspect-residue", "Failed to capture tracked worktree residue.", request.targetPath)
  );
  const untrackedFiles = yield* collectUntrackedPaths(
    request.targetPath,
    preservationErrorAdapter("inspect-residue", "Failed to list untracked worktree residue.", request.targetPath)
  );
  return yield* preserveResidue(request, head, reason, trackedPatch, untrackedFiles, baseRoot);
});

const preserveArchiveResidue = Effect.fn("WorktreeRemovalService.preserveArchiveResidue")(function* (
  request: WorktreeRemovalRequest,
  head: GitObjectId,
  reason: WorktreeResidueReasonType,
  needsPreservation: boolean
): Effect.fn.Return<O.Option<WorktreeResidueManifest>, WorktreePreservationError, WorktreeRemovalServiceRequirements> {
  return yield* Bool.match(needsPreservation, {
    onFalse: () => Effect.succeed(O.none<WorktreeResidueManifest>()),
    onTrue: () => captureAndPreserveResidue(request, head, reason).pipe(Effect.asSome),
  });
});

const planArchiveRemoval = Effect.fn("WorktreeRemovalService.planArchiveRemoval")(function* (
  request: WorktreeRemovalRequest,
  head: GitObjectId,
  dirty: boolean
): Effect.fn.Return<
  readonly [WorktreeResidueReasonType, O.Option<WorktreeResidueManifest>],
  WorktreePreservationError,
  WorktreeRemovalServiceRequirements
> {
  const unpushed = yield* inspectUnpushed(request.targetPath, request.branch);
  const reason = worktreeResidueReason(dirty, unpushed);
  const manifest = yield* preserveArchiveResidue(request, head, reason, dirty || unpushed);
  return [reason, manifest];
});

const removeWorktree = Effect.fn("WorktreeRemovalService.removeWorktree")(function* (
  request: WorktreeRemovalRequest,
  allowDirtyRemoval: boolean
): Effect.fn.Return<void, WorktreeCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* runWorktreeGitCapture(
    request.mainCheckout,
    worktreeRemoveArgs(request.targetPath, allowDirtyRemoval),
    "Failed to remove the git worktree."
  );
});

const pruneWorktreeMetadata = Effect.fn("WorktreeRemovalService.pruneWorktreeMetadata")(function* (
  mainCheckout: string
): Effect.fn.Return<void, WorktreeCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* runWorktreeGitCapture(mainCheckout, ["worktree", "prune"], "Failed to prune git worktree metadata.");
});

const deleteArchivedBranch = Effect.fn("WorktreeRemovalService.deleteArchivedBranch")(function* (
  request: WorktreeRemovalRequest,
  head: GitObjectId
): Effect.fn.Return<boolean, WorktreeCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const branch = O.filter(request.branch, () => request.deleteBranch);
  return yield* O.match(branch, {
    onNone: () => Effect.succeed(false),
    onSome: (branchName) =>
      runWorktreeGitCapture(
        request.mainCheckout,
        worktreeBranchDeleteArgs(branchName, head),
        `Failed to delete archived branch ${branchName}: it no longer points at the archived head ${head}.`
      ).pipe(Effect.as(true)),
  });
});

const assertAuthorizedHead = Effect.fnUntraced(function* (
  request: WorktreeRemovalRequest,
  head: string
): Effect.fn.Return<void, WorktreeCommandError, never> {
  const expected = request.expectedHead;
  if (O.isSome(expected) && !Str.Equivalence(head, expected.value)) {
    return yield* WorktreeCommandError.make({
      message: `Refusing to remove ${request.targetPath}: HEAD ${head} is not the authorized ${expected.value}; the checkout changed after its removal was decided.`,
    });
  }
});

const removeLegacyWorktree = Effect.fn("WorktreeRemovalService.removeLegacyWorktree")(function* (
  request: WorktreeRemovalRequest
): Effect.fn.Return<
  WorktreeRemovalReceipt,
  WorktreeCommandError | WorktreeDirtyError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  if (O.isSome(request.expectedHead)) {
    const head = yield* resolveGitCommit(
      request.targetPath,
      "HEAD",
      commandErrorAdapter(`Failed to resolve HEAD for ${request.targetPath}.`)
    );
    yield* assertAuthorizedHead(request, Str.trim(head));
  }
  const changes = yield* inspectRemovalChanges(
    request.targetPath,
    commandErrorAdapter(`Failed to inspect ${request.targetPath}.`)
  );
  return yield* A.match(changes, {
    onEmpty: () =>
      removeWorktree(request, false).pipe(
        Effect.as(makeRemovalReceipt(request, WorktreeResidueReason.Enum.clean, O.none(), false))
      ),
    onNonEmpty: (dirtyChanges) => WorktreeDirtyError.new(request.targetPath, A.length(dirtyChanges)),
  });
});

const MAX_REPORTED_HOLDERS = 8;

const describeAttachedProcesses = (attachments: A.NonEmptyReadonlyArray<ProcessAttachment>): string => {
  const holders = A.dedupeWith(attachments, (left, right) => left.pid === right.pid);
  const shown = A.take(holders, MAX_REPORTED_HOLDERS);
  const listed = A.join(
    A.map(shown, (holder) => `pid ${holder.pid} via ${holder.kind}`),
    ", "
  );
  const hidden = A.length(holders) - A.length(shown);
  return hidden > 0 ? `${listed} and ${hidden} more` : listed;
};

const assertQuiescentFence = Effect.fnUntraced(function* (
  request: WorktreeRemovalRequest,
  fencedPath: string
): Effect.fn.Return<void, WorktreeCommandError, FileSystem.FileSystem> {
  const scan = yield* scanProcessAttachments({ directory: fencedPath, kinds: ProcessAttachmentKind.Options });
  if (O.isNone(scan)) {
    return yield* WorktreeCommandError.make({
      message: `Refusing to retire ${request.targetPath}: the processes attached to it could not be enumerated, so the archive cannot be proven complete.`,
    });
  }
  if (A.isReadonlyArrayNonEmpty(scan.value)) {
    return yield* WorktreeCommandError.make({
      message: `Refusing to retire ${request.targetPath}: ${describeAttachedProcesses(scan.value)} still hold it, and any write they make after the archive is captured would be deleted with the fenced copy.`,
    });
  }
});

const fencedArchivePlan = Effect.fn("WorktreeRemovalService.fencedArchivePlan")(function* (
  request: WorktreeRemovalRequest,
  fenced: WorktreeRemovalRequest
): Effect.fn.Return<
  readonly [WorktreeResidueReasonType, O.Option<WorktreeResidueManifest>, GitObjectId],
  WorktreeCommandError | WorktreePreservationError,
  WorktreeRemovalServiceRequirements
> {
  // The fence froze the writer set: nothing reaches the retiring tree by path any
  // more, so the processes attached to it now — by cwd or an open descriptor — are
  // exactly the ones able to write after the residue below is captured. The archive
  // is complete only if that set is empty, so any holder refuses the retirement (the
  // caller renames the checkout back) instead of racing its writes to the deletion.
  yield* assertQuiescentFence(request, fenced.targetPath);
  const changes = yield* inspectRemovalChanges(
    fenced.targetPath,
    preservationErrorAdapter("inspect-residue", `Failed to inspect ${fenced.targetPath}.`, fenced.targetPath)
  );
  const head = yield* inspectArchiveHead(fenced);
  // Authority is re-tied to the state actually being archived: the fenced HEAD must
  // still be the object id the caller's decision was made under.
  yield* assertAuthorizedHead(request, head);
  const [reason, manifest] = yield* planArchiveRemoval(fenced, head, A.isReadonlyArrayNonEmpty(changes));
  return [reason, manifest, head] as const;
});

const removeArchivedWorktree = Effect.fn("WorktreeRemovalService.removeArchivedWorktree")(function* (
  request: WorktreeRemovalRequest
): Effect.fn.Return<
  WorktreeRemovalReceipt,
  WorktreeCommandError | WorktreePreservationError,
  WorktreeRemovalServiceRequirements
> {
  const fs = yield* FileSystem.FileSystem;
  yield* assertNoDirtySubmodules(request);
  const preFenceHead = yield* inspectArchiveHead(request);
  // Fail fast before mutating anything when the checkout already advanced past the
  // caller's authority; the binding check runs again inside the fence below.
  yield* assertAuthorizedHead(request, preFenceHead);
  // Validate the residue root against the ORIGINAL path before fencing: the fenced
  // copy carries a different name, so the containment refusal below would no longer
  // recognize a root configured inside the retiring worktree.
  yield* residueBaseRoot(request.targetPath);
  // ATOMIC FENCE: rename the checkout aside before capturing anything. After this
  // instant no new file can appear under the original path, while writers holding the
  // directory as cwd or via open descriptors follow the inode into the fenced copy
  // instead of losing data — so the residue captured below is complete by
  // construction, closing the capture-to-removal window a re-verification cannot.
  const stamp = DateTime.toEpochMillis(yield* DateTime.now);
  const retirePath = `${request.targetPath}.retiring-${stamp}`;
  yield* fs
    .rename(request.targetPath, retirePath)
    .pipe(
      Effect.mapError((cause) =>
        WorktreeCommandError.make({ message: `Failed to fence ${request.targetPath} for retirement: ${cause.message}` })
      )
    );
  const fenced = WorktreeRemovalRequest.make({ ...request, targetPath: retirePath });
  const planned = yield* Effect.result(fencedArchivePlan(request, fenced));
  if (Result.isFailure(planned)) {
    // A refusal inside the fence restores the checkout exactly where it was; a failed
    // restore must name the fenced path loudly so nothing is presumed lost.
    yield* fs.rename(retirePath, request.targetPath).pipe(
      Effect.mapError(() =>
        WorktreeCommandError.make({
          message: `Retirement of ${request.targetPath} failed AND the checkout could not be restored; it remains intact at ${retirePath}.`,
        })
      )
    );
    return yield* planned.failure;
  }
  const [reason, manifest, head] = planned.success;
  yield* fs.remove(retirePath, { recursive: true }).pipe(
    Effect.mapError(() =>
      WorktreeCommandError.make({
        message: `Archived ${request.targetPath} but could not delete the fenced copy; it remains at ${retirePath}.`,
      })
    )
  );
  yield* pruneWorktreeMetadata(request.mainCheckout);
  // New commits can never be orphaned by any of the above: directory removal leaves
  // the shared object store intact, and the branch ref falls only to this
  // compare-and-swap on the archived head.
  const branchDeleted = yield* deleteArchivedBranch(request, head);
  return makeRemovalReceipt(request, reason, manifest, branchDeleted);
});

const removeImpl = Effect.fn("WorktreeRemovalService.remove")(function* (
  request: WorktreeRemovalRequest
): Effect.fn.Return<
  WorktreeRemovalReceipt,
  WorktreeCommandError | WorktreeDirtyError | WorktreePreservationError,
  WorktreeRemovalServiceRequirements
> {
  yield* validateRemovalRequest(request);
  return yield* Bool.match(request.archive, {
    onFalse: () => removeLegacyWorktree(request),
    onTrue: () => removeArchivedWorktree(request),
  });
});

const makeWorktreeRemovalService = Effect.fn("WorktreeRemovalService.make")(function* () {
  const runtimeContext = yield* Effect.context<WorktreeRemovalServiceRequirements>();
  return WorktreeRemovalService.of({
    remove: Effect.fn("WorktreeRemovalService.remove")((request) =>
      removeImpl(request).pipe(Effect.provide(runtimeContext))
    ),
    hasUnpushedCommits: Effect.fn("WorktreeRemovalService.hasUnpushedCommits")((targetPath, branch) =>
      inspectUnpushedAsCommandError(targetPath, branch).pipe(Effect.provide(runtimeContext))
    ),
  });
});

/**
 * Live layer for preservation-first worktree removal.
 *
 * **Example** (Reference the live removal layer)
 *
 * ```ts
 * import { WorktreeRemovalServiceLive } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(typeof WorktreeRemovalServiceLive) // "object"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorktreeRemovalServiceLive: Layer.Layer<
  WorktreeRemovalService,
  never,
  WorktreeRemovalServiceRequirements
> = Layer.effect(WorktreeRemovalService, makeWorktreeRemovalService());
