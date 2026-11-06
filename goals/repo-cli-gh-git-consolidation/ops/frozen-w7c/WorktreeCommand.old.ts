/**
 * Frozen pre-W7 git bodies for `ops/worktree-differential-w7.ts`, from
 * `packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts` at the lane base 8602b24203 (the W7 kit head).
 *
 * `failOnNonZeroExit` and `runStreamingStep` are verbatim; the git steps of `addWorktree` (the origin/main fetch with
 * its tracking-commit fallback, the base resolve and the worktree add), the doctor's status and prune dry-run reads,
 * the new-worktree submodule update and the doctor's local-config read are lifted into named functions with the same
 * argv, runner and failure message. `runWorktreeGitCapture` comes from `WorktreeService.old.ts`.
 */

import { A, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { WorktreeCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Worktree/Worktree.errors.ts";
import { runRepoCommandStreamingCapture } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";
import { runWorktreeGitCapture } from "./WorktreeService.old.ts";

const failOnNonZeroExit = Effect.fn("Frozen.failOnNonZeroExit")(function* (
  commandText: string,
  failMessage: string,
  exitCode: number
): Effect.fn.Return<void, WorktreeCommandError> {
  if (exitCode !== 0) {
    return yield* WorktreeCommandError.make({
      message: `${failMessage} (exit ${exitCode}).`,
      command: commandText,
      exitCode,
    });
  }
});

const runStreamingStep = Effect.fn("Frozen.runStreamingStep")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  failMessage: string
) {
  const commandText = A.join([command, ...args], " ");
  const result = yield* runRepoCommandStreamingCapture(command, args, cwd).pipe(
    Effect.mapError(WorktreeCommandError.new(failMessage, { command: commandText }))
  );
  yield* failOnNonZeroExit(commandText, failMessage, result.exitCode);
});

/** `addWorktree`'s origin/main refresh: a failed fetch falls back to an existing tracking commit. */
export const refreshOriginMain = (cwd: string) =>
  runStreamingStep(
    "git",
    ["fetch", "--quiet", "--force", "origin", "main:refs/remotes/origin/main"],
    cwd,
    "Failed to fetch origin/main for the new worktree."
  ).pipe(
    Effect.as("fetched" as const),
    Effect.catchTag("WorktreeCommandError", () =>
      runWorktreeGitCapture(
        cwd,
        ["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"],
        "Failed to fetch origin/main and no usable tracking base exists."
      ).pipe(Effect.as("stale-tracking" as const))
    )
  );

/** `addWorktree`'s base resolve. */
export const resolveBase = (cwd: string, base: string) =>
  runWorktreeGitCapture(
    cwd,
    ["rev-parse", "--verify", `${base}^{commit}`],
    "Failed to resolve the worktree base."
  ).pipe(Effect.map(Str.trim));

/** `addWorktree`'s worktree add on a new branch at the resolved base. */
export const addAtBase = (cwd: string, targetPath: string, branch: string, baseSha: string) =>
  runStreamingStep(
    "git",
    ["worktree", "add", targetPath, "-b", branch, baseSha],
    cwd,
    "Failed to add the git worktree."
  );

/** `inspectWorktreeEntry`'s change count. */
export const doctorChangeCount = (cwd: string) =>
  runWorktreeGitCapture(cwd, ["status", "--porcelain"], `Failed to inspect ${cwd}.`).pipe(
    Effect.map((output) => A.filter(Str.split(output, "\n"), Str.isNonEmpty).length)
  );

/** `worktreeDoctorReportForContext`'s prune dry run. */
export const pruneDryRun = (cwd: string) =>
  runWorktreeGitCapture(cwd, ["worktree", "prune", "--dry-run"], "Failed to compute prunable worktrees.").pipe(
    Effect.map((output) => A.filter(Str.split(output, "\n"), Str.isNonEmpty))
  );

/** `runWorktreeNew`'s submodule update. */
export const updateSubmodules = (cwd: string) =>
  runStreamingStep(
    "git",
    ["submodule", "update", "--init", "--recursive"],
    cwd,
    "Failed to update submodules in the new worktree."
  );

/** `runWorktreeDoctor`'s merge-driver line. */
export const mergeDriverLine = (cwd: string) =>
  runWorktreeGitCapture(cwd, ["config", "--local", "--list"], "Cannot inspect local merge-driver config.").pipe(
    Effect.map((config) => A.findFirst(Str.split(config, "\n"), Str.startsWith("merge.regenerate.driver=")))
  );
