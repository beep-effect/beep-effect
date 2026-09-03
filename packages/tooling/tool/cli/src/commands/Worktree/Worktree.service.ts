/**
 * Preservation-first removal service for managed Git worktrees.
 *
 * Archive mode makes the target commit reachable through a create-only ref,
 * writes tracked and untracked residue outside the checkout, and only then
 * allows forced Git removal. Legacy removal keeps its existing refusal and
 * `--force` behavior.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { ISOStr } from "@beep/schema/Timestamp";
import { A, O, Str } from "@beep/utils";
import { Config, Context, DateTime, Effect, FileSystem, Layer, Match, Path } from "effect";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import {
  collectUntrackedPaths,
  resolveGitCommit,
  runGitOutput,
  runGitRawOutput,
} from "../../internal/repo-run/index.ts";
import { WorktreeCommandError, WorktreeDirtyError, WorktreePreservationError } from "./Worktree.errors.ts";
import {
  WorktreeArchivePlan,
  WorktreeRemovalReceipt,
  WorktreeResidueManifest,
  WorktreeResidueReason,
} from "./Worktree.schemas.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/index.ts";
import type { WorktreeRemovalRequest, WorktreeResidueReason as WorktreeResidueReasonType } from "./Worktree.schemas.ts";

const $I = $RepoCliId.create("commands/Worktree/Worktree.service");

const RESIDUE_ROOT_ENV = "BEEP_WORKTREE_RESIDUE_ROOT";

const GitCountFromString = S.FiniteFromString.pipe(
  S.decodeTo(NonNegativeInt),
  $I.annoteSchema("GitCountFromString", {
    description: "Non-negative integer count decoded from Git command output.",
  })
);

const decodeGitCount = S.decodeUnknownEffect(GitCountFromString);
const decodeGitObjectId = S.decodeUnknownEffect(GitObjectId);
const decodeIsoString = S.decodeUnknownEffect(ISOStr);
const encodeResidueManifest = S.encodeEffect(S.fromJsonString(WorktreeResidueManifest, { space: 2 }));

/**
 * Build the `git worktree remove` argument vector, optionally forced.
 *
 * **Example** (Forced removal carries an extra flag)
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
 * @param force - Whether to pass `--force` so removal ignores dirty state.
 * @returns The `git` argument vector (excluding the `git` executable).
 * @category utilities
 * @since 0.0.0
 */
export const worktreeRemoveArgs: {
  (force: boolean): (targetPath: string) => ReadonlyArray<string>;
  (targetPath: string, force: boolean): ReadonlyArray<string>;
} = dual(
  2,
  (targetPath: string, force: boolean): ReadonlyArray<string> =>
    force ? ["worktree", "remove", "--force", targetPath] : ["worktree", "remove", targetPath]
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
 * Build branch deletion arguments with option parsing terminated.
 *
 * **Example** (Delete an archived branch)
 *
 * ```ts
 * import { worktreeBranchDeleteArgs } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(worktreeBranchDeleteArgs("feat/feature-x"))
 * // ["branch", "-D", "--", "feat/feature-x"]
 * ```
 *
 * @param branch - Local branch to delete after archive removal.
 * @returns `git branch -D` arguments with an option terminator.
 * @category utilities
 * @since 0.0.0
 */
export const worktreeBranchDeleteArgs = (branch: string): ReadonlyArray<string> => ["branch", "-D", "--", branch];

/**
 * Build the deterministic archive-ref and filesystem layout for a retirement.
 *
 * **Example** (Plan residue paths)
 *
 * ```ts
 * import { worktreeArchivePlan } from "@beep/repo-cli/commands/Worktree"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.map(Path.Path, (path) =>
 *   worktreeArchivePlan(path, "/cache", "beep-effect", "feature-x", "20260902-123456")
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param path - Platform path service used to build native filesystem paths.
 * @param residueBaseRoot - Configured base directory for all worktree residue.
 * @param repoBasename - Basename of the repository's main checkout.
 * @param name - Managed worktree name.
 * @param stamp - UTC `YYYYMMDD-HHMMSS` retirement stamp.
 * @returns The archive ref, residue directory, and artifact paths.
 * @category utilities
 * @since 0.0.0
 */
export const worktreeArchivePlan: {
  (path: Path.Path, residueBaseRoot: string, repoBasename: string, name: string, stamp: string): WorktreeArchivePlan;
  (
    residueBaseRoot: string,
    repoBasename: string,
    name: string,
    stamp: string
  ): (path: Path.Path) => WorktreeArchivePlan;
} = dual(5, (path: Path.Path, residueBaseRoot: string, repoBasename: string, name: string, stamp: string) => {
  const residueRoot = path.join(residueBaseRoot, repoBasename, `${name}-${stamp}`);
  return WorktreeArchivePlan.make({
    archiveRef: `refs/archive/worktrees/${name}/${stamp}`,
    residueRoot,
    patchPath: path.join(residueRoot, "tracked.patch"),
    untrackedRoot: path.join(residueRoot, "untracked"),
    manifestPath: path.join(residueRoot, "manifest.json"),
  });
});

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

type WorktreeRemovalServiceRequirements = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;

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

const residueBaseRoot = Effect.fn("WorktreeRemovalService.residueBaseRoot")(function* (): Effect.fn.Return<
  string,
  WorktreePreservationError,
  Path.Path
> {
  const path = yield* Path.Path;
  const configured = yield* Config.option(Config.string(RESIDUE_ROOT_ENV)).pipe(
    Effect.mapError((cause) =>
      WorktreePreservationError.new("resolve-residue-root", `Could not read ${RESIDUE_ROOT_ENV}.`, { cause })
    )
  );
  const explicit = O.filter(configured, Str.isNonEmpty);
  if (O.isSome(explicit)) {
    return path.resolve(explicit.value);
  }
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
  return path.join(path.resolve(home.value), ".cache", "beep", "worktree-residue");
});

const isContainedRelativePath = (path: Path.Path, root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return Str.isNonEmpty(relative) && !Str.startsWith("..")(relative) && !path.isAbsolute(relative);
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
  untrackedFiles: ReadonlyArray<string>
): Effect.fn.Return<
  WorktreeResidueManifest,
  WorktreePreservationError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const now = yield* DateTime.now;
  const archivedAt = yield* decodeIsoString(DateTime.formatIso(now)).pipe(
    Effect.mapError((cause) =>
      WorktreePreservationError.new("prepare-residue", "Current time was not a valid ISO timestamp.", { cause })
    )
  );
  const baseRoot = yield* residueBaseRoot();
  const plan = worktreeArchivePlan(
    path,
    baseRoot,
    path.basename(request.mainCheckout),
    request.name,
    archiveStamp(now)
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
  const statusArgs = ["status", "--porcelain", "--untracked-files=all"];
  const statusOutput = yield* runGitOutput(targetPath, statusArgs, adapter);
  return A.filter(Str.split(statusOutput, "\n"), Str.isNonEmpty);
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
): Effect.fn.Return<
  WorktreeResidueManifest,
  WorktreePreservationError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const trackedPatch = yield* runGitRawOutput(
    request.targetPath,
    ["diff", "--binary", "HEAD", "--"],
    preservationErrorAdapter("inspect-residue", "Failed to capture tracked worktree residue.", request.targetPath)
  );
  const untrackedFiles = yield* collectUntrackedPaths(
    request.targetPath,
    preservationErrorAdapter("inspect-residue", "Failed to list untracked worktree residue.", request.targetPath)
  );
  return yield* preserveResidue(request, head, reason, trackedPatch, untrackedFiles);
});

const preserveArchiveResidue = Effect.fn("WorktreeRemovalService.preserveArchiveResidue")(function* (
  request: WorktreeRemovalRequest,
  head: GitObjectId,
  reason: WorktreeResidueReasonType,
  needsPreservation: boolean
): Effect.fn.Return<
  O.Option<WorktreeResidueManifest>,
  WorktreePreservationError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* Bool.match(needsPreservation, {
    onFalse: () => Effect.succeed(O.none<WorktreeResidueManifest>()),
    onTrue: () => captureAndPreserveResidue(request, head, reason).pipe(Effect.map(O.some)),
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
  force: boolean
): Effect.fn.Return<void, WorktreeCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* runWorktreeGitCapture(
    request.mainCheckout,
    worktreeRemoveArgs(request.targetPath, force),
    "Failed to remove the git worktree."
  );
});

const pruneWorktreeMetadata = Effect.fn("WorktreeRemovalService.pruneWorktreeMetadata")(function* (
  mainCheckout: string
): Effect.fn.Return<void, WorktreeCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* runWorktreeGitCapture(mainCheckout, ["worktree", "prune"], "Failed to prune git worktree metadata.");
});

const deleteArchivedBranch = Effect.fn("WorktreeRemovalService.deleteArchivedBranch")(function* (
  request: WorktreeRemovalRequest
): Effect.fn.Return<boolean, WorktreeCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const branch = O.filter(request.branch, () => request.deleteBranch);
  return yield* O.match(branch, {
    onNone: () => Effect.succeed(false),
    onSome: (branchName) =>
      runWorktreeGitCapture(
        request.mainCheckout,
        worktreeBranchDeleteArgs(branchName),
        `Failed to delete archived branch ${branchName}.`
      ).pipe(Effect.as(true)),
  });
});

const removeForcedLegacyWorktree = Effect.fn("WorktreeRemovalService.removeForcedLegacyWorktree")(function* (
  request: WorktreeRemovalRequest
): Effect.fn.Return<WorktreeRemovalReceipt, WorktreeCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* removeWorktree(request, true);
  return makeRemovalReceipt(request, WorktreeResidueReason.Enum.clean, O.none(), false);
});

const removeLegacyWorktree = Effect.fn("WorktreeRemovalService.removeLegacyWorktree")(function* (
  request: WorktreeRemovalRequest
): Effect.fn.Return<
  WorktreeRemovalReceipt,
  WorktreeCommandError | WorktreeDirtyError,
  ChildProcessSpawner.ChildProcessSpawner
> {
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

const removeArchivedWorktree = Effect.fn("WorktreeRemovalService.removeArchivedWorktree")(function* (
  request: WorktreeRemovalRequest
): Effect.fn.Return<
  WorktreeRemovalReceipt,
  WorktreeCommandError | WorktreePreservationError,
  WorktreeRemovalServiceRequirements
> {
  const changes = yield* inspectRemovalChanges(
    request.targetPath,
    preservationErrorAdapter("inspect-residue", `Failed to inspect ${request.targetPath}.`, request.targetPath)
  );
  const head = yield* inspectArchiveHead(request);
  const [reason, manifest] = yield* planArchiveRemoval(request, head, A.isReadonlyArrayNonEmpty(changes));
  yield* removeWorktree(request, O.isSome(manifest));
  yield* pruneWorktreeMetadata(request.mainCheckout);
  const branchDeleted = yield* deleteArchivedBranch(request);
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
  return yield* Match.value(request).pipe(
    Match.when({ archive: false, force: true }, () => removeForcedLegacyWorktree(request)),
    Match.when({ archive: false }, () => removeLegacyWorktree(request)),
    Match.orElse(() => removeArchivedWorktree(request))
  );
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
