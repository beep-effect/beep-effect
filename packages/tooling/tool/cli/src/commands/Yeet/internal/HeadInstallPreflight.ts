/**
 * Clean-HEAD frozen-lockfile install preflight for Yeet publish and verify.
 *
 * The detached checkout and full install are minted beneath the persistent
 * cache root, not the tmpfs-backed system temporary directory. A crash can
 * therefore leak disk rather than zram; `beep quality tmpfs-reap` is the
 * janitor for abandoned head-install roots.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GitCommand } from "@beep/git/GitCommand";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant } from "effect/Function";
import * as Path from "effect/Path";
import {
  commandTextForStep,
  patientGit,
  RepoStepRunResult,
  resolveBeepCacheRoot,
  runRepoCommandCapture,
} from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { captureGitKitExit, currentCommitSha } from "./GitExec.ts";
import { clearHeadInstallReceipt, recordHeadInstallReceipt } from "./HeadInstallReceipt.ts";
import type { Git } from "@beep/git/Git";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RepoPlanStep, RepoRunContext } from "../../../internal/repo-run/index.ts";

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
const HEAD_INSTALL_PREFLIGHT_FAILURE_HINT =
  "Frozen-lockfile clean-HEAD install preflight failed. The lockfile/manifest state committed on HEAD may be incomplete. Commit or restage the required lockfile and manifest changes; if needed, run `bun install` and restage `bun.lock`." as const;

// An unresolvable HEAD still runs against `HEAD` so the worktree add reports it.
const unresolvedHead = constant("HEAD");

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
 * The temporary checkout is created on persistent disk and is always removed
 * and pruned, including when the frozen install fails. If the process crashes,
 * the tmpfs janitor reaps the abandoned cache root later.
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
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | SecureRandom.SecureRandom
  | Git
  | Digest.Digest
> {
  // The install pins the commit up front so its receipt names exactly what was
  // installed. An unresolvable HEAD still runs against `HEAD` and lets the
  // worktree add report the failure, as before.
  const commitSha = yield* currentCommitSha(context).pipe(Effect.option);
  const result = yield* installCleanHead(context, step, rawOutputPath, O.getOrElse(commitSha, unresolvedHead));
  // A failed install leaves no receipt behind, so a later verified-proof reuse
  // cannot skip this preflight on the strength of an older success.
  yield* O.match(
    O.filter(commitSha, () => result.exitCode === 0),
    {
      onNone: () => clearHeadInstallReceipt(context),
      onSome: (installed) =>
        recordHeadInstallReceipt(context, installed).pipe(
          Effect.ignore({ log: "Warn", message: "[head-install-preflight] install receipt not recorded" })
        ),
    }
  );
  return result;
});

const installCleanHead = Effect.fnUntraced(function* (
  context: RepoRunContext,
  step: RepoPlanStep,
  rawOutputPath: O.Option<string>,
  commitSha: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // The add fills nothing, but the remove deletes a checkout `bun install` just filled, which can
  // outlive the edge instance's 30 s timeout: run the lifecycle under the patient options (SPEC D-09).
  const git = yield* patientGit;
  const commandText = commandTextForStep(step);
  const cacheRoot = yield* resolveBeepCacheRoot().pipe(
    Effect.mapError(YeetCommandError.new("Failed to resolve the head-install preflight cache root."))
  );
  const headInstallBase = path.join(cacheRoot, "beep", "head-install");
  yield* fs
    .makeDirectory(headInstallBase, { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new("Failed to create the head-install preflight cache directory.")));
  const tempRoot = yield* fs
    .makeTempDirectory({ directory: headInstallBase, prefix: "beep-yeet-head-install-" })
    .pipe(Effect.mapError(YeetCommandError.new("Failed to create the head-install preflight temp directory.")));
  const worktreePath = path.join(tempRoot, "checkout");

  return yield* Effect.acquireUseRelease(
    Effect.succeed(worktreePath),
    Effect.fnUntraced(function* (checkout: string) {
      // `Git.worktreeAdd` surfaces no transcript on a zero exit, so the rendered block carries
      // git's text only when the add failed (SPEC D-09).
      const add = yield* git
        .worktreeAdd(context.repoRoot, checkout, { ref: commitSha, detach: true })
        .pipe(
          captureGitKitExit(
            GitCommand.worktreeAdd(checkout, commitSha, true),
            "Failed to create the clean-HEAD preflight worktree."
          )
        );
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
          truncated: false,
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
        truncated: install.truncated,
        ...O.getSomesStruct({ rawOutputRef: rawOutputPath }),
      });
    }),
    Effect.fnUntraced(function* (checkout: string) {
      const remove = yield* git.worktreeRemove(context.repoRoot, checkout, { force: true }).pipe(
        captureGitKitExit(GitCommand.worktreeRemove(checkout, true), "Failed to run git worktree remove."),
        Effect.map((exit) => exit.exitCode),
        Effect.option
      );
      yield* git.worktreePrune(context.repoRoot).pipe(Effect.ignore);
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
