/**
 * Frozen pre-W7 git and gh bodies for `ops/worktree-differential-w7.ts`, from
 * `packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts` at the lane base 8602b24203 (the W7 kit head).
 *
 * The capture helpers (`runWorktreeGitCapture`, `runPreservationCommand`, `runPreservationProbe`), the probes built on
 * them (`countCommits`, `refExists`, `resolveOriginDefaultBranch`, `inspectRemovalChanges`, `assertNoDirtySubmodules`)
 * and the merged pull-request listing are verbatim except for import paths. The sites that sat inline in a larger
 * body (the upstream read, the archive-ref create, the common-dir reads, the tracked patch, worktree remove and prune,
 * the branch CAS delete and the merge-driver config writes) are lifted into named functions with the same argv,
 * adapter and failure message. The runners come from `GitRunners.old.ts`, inlined because the retirement deletes them.
 */

import { A, O, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { WorktreePreservationError } from "../../../../packages/tooling/tool/cli/src/commands/Worktree/Worktree.errors.ts";
import {
  WorktreeMergedPullRequest,
  worktreeGitErrorAdapter,
} from "../../../../packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts";
import { ghOutput } from "../../../../packages/tooling/tool/cli/src/internal/github/GhCommand.ts";
import { runGitOutput, runGitRawOutput } from "./GitRunners.old.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { WorktreeCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Worktree/Worktree.errors.ts";
import type { GitCommandErrorAdapter } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";

type Requirements = SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner;

const GitCountFromString = S.FiniteFromString.pipe(S.decodeTo(S.Natural));
const decodeGitCount = S.decodeUnknownEffect(GitCountFromString);

const MergedPullRequestRows = WorktreeMergedPullRequest.pipe(S.Array, S.fromJsonString);
const decodeMergedPullRequestRows = S.decodeUnknownEffect(MergedPullRequestRows);

/** `gh pr list --head <branch> --state merged --json number,headRefOid --limit 100`; any failure is `None`. */
export const mergedPullRequestsForBranch = Effect.fn("Frozen.mergedPullRequestsForBranch")(function* (
  cwd: string,
  branch: string
): Effect.fn.Return<O.Option<ReadonlyArray<WorktreeMergedPullRequest>>, never, Requirements> {
  return yield* ghOutput({
    args: ["pr", "list", "--head", branch, "--state", "merged", "--json", "number,headRefOid", "--limit", "100"],
    cwd,
    label: `gh pr list --head ${branch} --state merged`,
    onFailure: (failure) => failure,
  }).pipe(Effect.flatMap(decodeMergedPullRequestRows), Effect.option);
});

/** The preservation adapter, unchanged by W7 (the live module keeps the same body). */
export const preservationErrorAdapter = (
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

export const runWorktreeGitCapture = Effect.fn("Frozen.runWorktreeGitCapture")(function* (
  cwd: string,
  args: ReadonlyArray<string>,
  failMessage: string
): Effect.fn.Return<string, WorktreeCommandError, Requirements> {
  return yield* runGitOutput(cwd, args, worktreeGitErrorAdapter(failMessage));
});

const runPreservationCommand = Effect.fn("Frozen.runPreservationCommand")(function* (
  cwd: string,
  args: ReadonlyArray<string>,
  step: WorktreePreservationError["step"],
  failMessage: string,
  affectedPath?: string
): Effect.fn.Return<string, WorktreePreservationError, Requirements> {
  return yield* runGitOutput(cwd, args, preservationErrorAdapter(step, failMessage, affectedPath));
});

const runPreservationProbe = Effect.fn("Frozen.runPreservationProbe")(function* (
  cwd: string,
  args: ReadonlyArray<string>,
  step: WorktreePreservationError["step"],
  failMessage: string,
  affectedPath?: string
): Effect.fn.Return<string, WorktreePreservationError, Requirements> {
  const output = yield* runGitRawOutput(cwd, args, preservationErrorAdapter(step, failMessage, affectedPath));
  return Str.trim(output);
});

const decodeCount = Effect.fn("Frozen.decodeCount")(function* (
  output: string,
  step: WorktreePreservationError["step"]
): Effect.fn.Return<number, WorktreePreservationError> {
  return yield* decodeGitCount(Str.trim(output)).pipe(
    Effect.mapError((cause) => WorktreePreservationError.new(step, "Git returned an invalid commit count.", { cause }))
  );
});

export const countCommits = Effect.fn("Frozen.countCommits")(function* (
  targetPath: string,
  revision: string,
  step: WorktreePreservationError["step"]
): Effect.fn.Return<number, WorktreePreservationError, Requirements> {
  const output = yield* runPreservationProbe(
    targetPath,
    ["rev-list", "--count", revision, "--"],
    step,
    `Failed to count commits in ${revision}.`,
    targetPath
  );
  return yield* decodeCount(output, step);
});

const ORIGIN_DEFAULT_BRANCH = "main";

export const refExists = Effect.fn("Frozen.refExists")(function* (
  targetPath: string,
  ref: string,
  step: WorktreePreservationError["step"],
  failMessage: string
): Effect.fn.Return<boolean, WorktreePreservationError, Requirements> {
  const output = yield* runPreservationProbe(
    targetPath,
    ["for-each-ref", "--format=%(refname)", ref],
    step,
    failMessage,
    targetPath
  );
  return A.contains(Str.split(output, "\n"), ref);
});

export const resolveOriginDefaultBranch = Effect.fn("Frozen.resolveOriginDefaultBranch")(function* (
  targetPath: string
): Effect.fn.Return<string, WorktreePreservationError, Requirements> {
  const symref = yield* runPreservationProbe(
    targetPath,
    ["for-each-ref", "--format=%(symref:lstrip=3)", "refs/remotes/origin/HEAD"],
    "inspect-origin-main",
    "Failed to inspect origin/HEAD.",
    targetPath
  );
  return pipe(
    symref,
    O.liftPredicate(Str.isNonEmpty),
    O.getOrElse(() => ORIGIN_DEFAULT_BRANCH)
  );
});

/** The upstream read inside `inspectBranchUpstream`: the full upstream refname, or `""` when none is set. */
export const upstreamRef = Effect.fn("Frozen.upstreamRef")(function* (
  targetPath: string,
  branchName: string
): Effect.fn.Return<string, WorktreePreservationError, Requirements> {
  return yield* runPreservationProbe(
    targetPath,
    ["for-each-ref", "--format=%(upstream)", `refs/heads/${branchName}`],
    "inspect-upstream",
    `Failed to inspect the upstream for ${branchName}.`,
    targetPath
  );
});

const worktreeArchiveRefArgs = dual(
  2,
  (archiveRef: string, head: string): ReadonlyArray<string> => [
    "update-ref",
    archiveRef,
    head,
    Str.repeat(head.length)("0"),
  ]
);

/** The archive-ref create inside `preserveResidue`: `check-ref-format`, then the create-only `update-ref`. */
export const createArchiveRef = Effect.fn("Frozen.createArchiveRef")(function* (
  mainCheckout: string,
  archiveRef: string,
  head: string
): Effect.fn.Return<void, WorktreePreservationError, Requirements> {
  yield* runPreservationCommand(
    mainCheckout,
    ["check-ref-format", archiveRef],
    "create-archive-ref",
    `Archive ref ${archiveRef} was not accepted by git check-ref-format.`
  );
  yield* runPreservationCommand(
    mainCheckout,
    worktreeArchiveRefArgs(archiveRef, head),
    "create-archive-ref",
    `Could not create archive ref ${archiveRef}.`
  );
});

/** One of `validateRemovalRequest`'s two common-dir reads. */
export const commonDir = (cwd: string, failMessage: string) =>
  runWorktreeGitCapture(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"], failMessage);

export const inspectRemovalChanges = Effect.fn("Frozen.inspectRemovalChanges")(function* <Error>(
  targetPath: string,
  adapter: GitCommandErrorAdapter<Error>
): Effect.fn.Return<ReadonlyArray<string>, Error, Requirements> {
  const statusArgs = ["status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"];
  const statusOutput = yield* runGitOutput(targetPath, statusArgs, adapter);
  return A.filter(Str.split(statusOutput, "\n"), Str.isNonEmpty);
});

export const assertNoDirtySubmodules = Effect.fn("Frozen.assertNoDirtySubmodules")(function* (
  targetPath: string
): Effect.fn.Return<void, WorktreePreservationError, Path.Path | Requirements> {
  const path = yield* Path.Path;
  yield* runPreservationCommand(
    targetPath,
    ["submodule", "status", "--recursive"],
    "inspect-submodules",
    "Failed to inspect recursive submodule state.",
    targetPath
  );
  const dirtySubmoduleOutput = yield* runGitRawOutput(
    targetPath,
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
      targetPath
    )
  );
  const dirtySubmodule = A.head(A.filter(Str.split(dirtySubmoduleOutput, "\0"), Str.isNonEmpty));
  if (O.isSome(dirtySubmodule)) {
    const submodulePath = path.join(targetPath, dirtySubmodule.value);
    return yield* WorktreePreservationError.new(
      "inspect-submodules",
      `Submodule ${dirtySubmodule.value} has uncommitted work; commit or clean it before retrying archive retirement.`,
      { path: submodulePath }
    );
  }
});

/** The tracked residue patch read inside `captureAndPreserveResidue`. */
export const trackedPatch = (targetPath: string) =>
  runGitRawOutput(
    targetPath,
    ["diff", "--binary", "HEAD", "--"],
    preservationErrorAdapter("inspect-residue", "Failed to capture tracked worktree residue.", targetPath)
  );

/** `removeWorktree` after its request validation. */
export const removeWorktree = (mainCheckout: string, targetPath: string, allowDirtyRemoval: boolean) =>
  runWorktreeGitCapture(
    mainCheckout,
    allowDirtyRemoval ? ["worktree", "remove", "--force", targetPath] : ["worktree", "remove", targetPath],
    "Failed to remove the git worktree."
  );

export const pruneWorktreeMetadata = (mainCheckout: string) =>
  runWorktreeGitCapture(mainCheckout, ["worktree", "prune"], "Failed to prune git worktree metadata.");

/** `deleteArchivedBranch` with branch deletion requested. */
export const deleteArchivedBranch = (mainCheckout: string, branchName: string, head: string) =>
  runWorktreeGitCapture(
    mainCheckout,
    ["update-ref", "-d", `refs/heads/${branchName}`, head],
    `Failed to delete archived branch ${branchName}: it no longer points at the archived head ${head}.`
  ).pipe(Effect.as(true));

/** The config writes of `installRegenerateMergeDriver` (its adapter-script guard is unchanged). */
export const writeMergeDriverConfig = Effect.fn("Frozen.writeMergeDriverConfig")(function* (checkout: string) {
  for (const [key, value] of R.toEntries({
    name: "Regenerate pure repository projections",
    driver: "bash scripts/regenerate-merge-driver.sh %O %A %B %P",
    recursive: "binary",
  })) {
    yield* runWorktreeGitCapture(
      checkout,
      ["config", "--local", `merge.regenerate.${key}`, value],
      "Cannot install projection merge driver."
    );
  }
});
