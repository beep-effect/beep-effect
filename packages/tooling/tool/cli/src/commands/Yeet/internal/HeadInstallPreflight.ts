/**
 * Clean-HEAD frozen-lockfile install preflight for Yeet publish and verify.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { O } from "@beep/utils";
import { Console, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import { commandTextForStep, RepoStepRunResult, runRepoCommandCapture } from "../../../internal/repo-run/index.js";
import { YeetCommandError } from "../Yeet.errors.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoPlanStep, RepoRunContext } from "../../../internal/repo-run/index.js";

/**
 * Stable plan-step identifier for the clean-HEAD install preflight.
 *
 * @category configuration
 * @since 0.0.0
 */
export const HEAD_INSTALL_PREFLIGHT_STEP_ID = "publish:00-head-install-preflight" as const;

/**
 * Actionable failure text recognized by Yeet's failure-hint classifier.
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const HEAD_INSTALL_PREFLIGHT_FAILURE_HINT =
  "Frozen-lockfile clean-HEAD install preflight failed. The lockfile/manifest state committed on HEAD may be incomplete. Commit or restage the required lockfile and manifest changes; if needed, run `bun install` and restage `bun.lock`." as const;

const renderCommandOutput = (label: string, output: string): string =>
  A.join([`[head-install-preflight] ${label}`, output], "\n");

const cleanupWarning = (label: string, exitCode: O.Option<number>): O.Option<string> =>
  O.match(exitCode, {
    onNone: () => O.some(`${label} could not run`),
    onSome: (code) => (code === 0 ? O.none() : O.some(`${label} exited ${code}`)),
  });

const persistOutput = Effect.fn("Yeet.persistHeadInstallPreflightOutput")(function* (
  rawOutputPath: O.Option<string>,
  output: string
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  if (O.isNone(rawOutputPath)) {
    return;
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(path.dirname(rawOutputPath.value), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new("Failed to create the head-install preflight log directory.")));
  yield* fs
    .writeFileString(rawOutputPath.value, output)
    .pipe(Effect.mapError(YeetCommandError.new("Failed to write the head-install preflight log.")));
});

/**
 * Install the committed repository tree in a detached temporary worktree.
 *
 * The temporary checkout is always removed and pruned, including when the
 * frozen install fails.
 *
 * @param context - Repository context whose committed HEAD is checked.
 * @param step - Planned preflight lane recorded in run artifacts.
 * @param rawOutputPath - Optional Yeet log artifact path.
 * @returns A normal repo-step result so failure packets and verdicts use the
 * standard lane path.
 * @category execution
 * @since 0.0.0
 */
export const executeHeadInstallPreflight = Effect.fn("Yeet.executeHeadInstallPreflight")(function* (
  context: RepoRunContext,
  step: RepoPlanStep,
  rawOutputPath: O.Option<string> = O.none()
): Effect.fn.Return<
  RepoStepRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const commandText = commandTextForStep(step);
  const tempRoot = yield* fs
    .makeTempDirectory({ prefix: "beep-yeet-head-install-" })
    .pipe(Effect.mapError(YeetCommandError.new("Failed to create the head-install preflight temp directory.")));
  const worktreePath = path.join(tempRoot, "checkout");

  return yield* Effect.acquireUseRelease(
    Effect.succeed(worktreePath),
    Effect.fnUntraced(function* (checkout: string) {
      const add = yield* runRepoCommandCapture(
        "git",
        ["worktree", "add", "--detach", checkout, "HEAD"],
        context.repoRoot
      ).pipe(Effect.mapError(YeetCommandError.new("Failed to create the clean-HEAD preflight worktree.")));
      const addOutput = renderCommandOutput("git worktree add --detach <tmp> HEAD", add.output);
      if (add.exitCode !== 0) {
        const output = A.join([addOutput, HEAD_INSTALL_PREFLIGHT_FAILURE_HINT], "\n");
        yield* persistOutput(rawOutputPath, output);
        yield* Console.log(output);
        return RepoStepRunResult.make({
          stepId: step.id,
          commandText,
          exitCode: add.exitCode,
          output,
          truncated: add.truncated,
          ...O.getSomesStruct({ rawOutputRef: rawOutputPath }),
        });
      }

      const install = yield* runRepoCommandCapture("bun", ["install", "--frozen-lockfile"], checkout).pipe(
        Effect.mapError(YeetCommandError.new("Failed to spawn the frozen-lockfile clean-HEAD install."))
      );
      const installOutput = renderCommandOutput("bun install --frozen-lockfile", install.output);
      const output =
        install.exitCode === 0
          ? A.join([addOutput, installOutput], "\n")
          : A.join([addOutput, installOutput, HEAD_INSTALL_PREFLIGHT_FAILURE_HINT], "\n");
      yield* persistOutput(rawOutputPath, output);
      yield* Console.log(output);
      return RepoStepRunResult.make({
        stepId: step.id,
        commandText,
        exitCode: install.exitCode,
        output,
        truncated: add.truncated || install.truncated,
        ...O.getSomesStruct({ rawOutputRef: rawOutputPath }),
      });
    }),
    Effect.fnUntraced(function* (checkout: string) {
      const remove = yield* runRepoCommandCapture(
        "git",
        ["worktree", "remove", "--force", checkout],
        context.repoRoot
      ).pipe(
        Effect.map((result) => result.exitCode),
        Effect.option
      );
      yield* runRepoCommandCapture("git", ["worktree", "prune"], context.repoRoot).pipe(Effect.ignore);
      const removedTemp = yield* fs.remove(tempRoot, { recursive: true }).pipe(Effect.as(0), Effect.option);
      const warnings = A.getSomes([
        cleanupWarning("`git worktree remove --force`", remove),
        cleanupWarning("temp directory removal", removedTemp),
      ]);
      if (A.isReadonlyArrayEmpty(warnings)) {
        return;
      }
      yield* Console.log(
        `[head-install-preflight] cleanup warning: ${A.join(warnings, "; ")} — a stale entry may remain under .git/worktrees; run \`git worktree prune\` and remove ${tempRoot} manually.`
      );
    })
  );
});
