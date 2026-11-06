/**
 * Frozen pre-W7 bodies for `ops/yeet-differential-w7.ts`: the merged-preview materializer (`createYeetMergePreview`) and its captures of
 * `packages/tooling/tool/cli/src/commands/Yeet/internal/MergedPreview.ts`, verbatim from the lane base 8602b24203 except for import paths, the
 * `old` name prefix, and the retiring Yeet `runGitOutput`/`runGitPathList` wrappers, which resolve to the inlined
 * copies in `GitRunners.old.ts`.
 */

import { GitCommand } from "@beep/git/GitCommand";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Str from "effect/String";
import {
  gitObjectIdFromOutput,
  parseYeetMergeTreeResult,
  renderYeetMergePreviewConflict,
  YEET_MERGED_PREVIEW_COMMIT_MESSAGE,
  YeetMergePreview,
  yeetMergedPreviewPath,
} from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/MergedPreview.ts";
import { YeetCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import {
  adaptGitKitError,
  patientGit,
  removeGitWorktree,
  runRepoCommandCapture,
} from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";
import { oldRunGitOutput } from "./GitRunners.old.ts";
import type { Git } from "@beep/git/Git";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type {
  GitCommandErrorAdapter,
  RepoRunContext,
} from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";

export const oldGitCapture = Effect.fn("Yeet.mergedPreviewGitCapture")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<
  { readonly exitCode: number; readonly output: string },
  never,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  const result = yield* runRepoCommandCapture("git", args, repoRoot).pipe(
    Effect.orElseSucceed(() => ({ exitCode: 128, output: "git could not be executed", truncated: false }))
  );
  return { exitCode: result.exitCode, output: result.output };
});

export const gitKitCaptureAdapter: GitCommandErrorAdapter<{ readonly exitCode: number; readonly output: string }> = {
  onSpawnFailure: () => () => ({ exitCode: 128, output: "git could not be executed" }),
  onNonZeroExit: ({ exitCode, output }) => ({ exitCode, output }),
  onTruncated: O.none(),
};

export const oldAddPreviewWorktree = Effect.fn("Yeet.mergedPreviewAddWorktree")(function* (
  repoRoot: string,
  worktreePath: string,
  commitSha: string
): Effect.fn.Return<
  { readonly exitCode: number; readonly output: string },
  never,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const git = yield* patientGit;
  return yield* git.worktreeAdd(repoRoot, worktreePath, { ref: commitSha, detach: true }).pipe(
    Effect.as({ exitCode: 0, output: "" }),
    Effect.catch((error) =>
      Effect.succeed(
        adaptGitKitError(error, GitCommand.worktreeAdd(worktreePath, commitSha, true), gitKitCaptureAdapter)
      )
    )
  );
});

export const oldRemoveMergePreviewWorktree = Effect.fn("Yeet.oldRemoveMergePreviewWorktree")(function* (
  context: RepoRunContext,
  worktreePath: string
): Effect.fn.Return<void, never, Git> {
  yield* removeGitWorktree(context.repoRoot, worktreePath);
});

export const oldCreateYeetMergePreview = Effect.fn("Yeet.oldCreateYeetMergePreview")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  YeetMergePreview,
  YeetCommandError,
  Path.Path | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git
> {
  const worktreePath = yield* yeetMergedPreviewPath(context);
  const headSha = yield* oldRunGitOutput(context.repoRoot, ["rev-parse", context.head]).pipe(Effect.map(Str.trim));
  const baseSha = yield* oldRunGitOutput(context.repoRoot, ["rev-parse", context.base]).pipe(
    Effect.mapBoth({
      onFailure: YeetCommandError.new(
        `yeet verify --merged could not resolve ${context.base}. Run git fetch origin first so the base ref exists locally.`
      ),
      onSuccess: Str.trim,
    })
  );

  const merge = yield* oldGitCapture(context.repoRoot, ["merge-tree", "--write-tree", baseSha, headSha]);
  const treeSha = yield* Match.value(parseYeetMergeTreeResult(merge.exitCode, merge.output)).pipe(
    Match.discriminator("status")("merged", (value) => Effect.succeed(value.treeSha)),
    Match.discriminator("status")("conflicted", (value) =>
      Effect.fail(
        YeetCommandError.make({
          message: renderYeetMergePreviewConflict(context.base, value),
          command: `git merge-tree --write-tree ${context.base} ${context.head}`,
          exitCode: 1,
        })
      )
    ),
    Match.discriminator("status")("unavailable", (value) =>
      Effect.fail(
        YeetCommandError.make({
          message: `yeet verify --merged could not compute the merge preview: ${value.detail}`,
          command: `git merge-tree --write-tree ${context.base} ${context.head}`,
          exitCode: 1,
        })
      )
    ),
    Match.exhaustive
  );

  const parents = baseSha === headSha ? ["-p", baseSha] : ["-p", baseSha, "-p", headSha];
  const committed = yield* oldGitCapture(context.repoRoot, [
    "commit-tree",
    treeSha,
    ...parents,
    "-m",
    YEET_MERGED_PREVIEW_COMMIT_MESSAGE,
  ]);
  const commitSha = yield* Effect.fromOption(gitObjectIdFromOutput(committed.output), () =>
    YeetCommandError.make({
      message: `yeet verify --merged could not commit the merge preview tree:\n${committed.output}`,
      command: `git commit-tree ${treeSha}`,
      exitCode: committed.exitCode === 0 ? 1 : committed.exitCode,
    })
  );

  yield* oldRemoveMergePreviewWorktree(context, worktreePath);
  const added = yield* oldAddPreviewWorktree(context.repoRoot, worktreePath, commitSha);
  if (added.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `yeet verify --merged could not check out the merge preview worktree:\n${added.output}`,
      command: `git worktree add --detach ${worktreePath} ${commitSha}`,
      exitCode: added.exitCode,
    });
  }

  return YeetMergePreview.make({ baseRef: context.base, baseSha, commitSha, headSha, treeSha, worktreePath });
});
