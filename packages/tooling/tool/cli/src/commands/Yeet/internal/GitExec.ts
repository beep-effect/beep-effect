/**
 * Yeet-specific adapters over shared Git execution helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { guardLiteralArg } from "@beep/repo-utils";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import {
  collectUntrackedPaths as collectGitUntrackedPaths,
  collectStagedPaths,
  collectUnstagedPaths,
  currentBranch,
  isSafeOriginBranch,
  originBranchFromBase,
  runGitOutput as runSharedGitOutput,
  runGitPathList as runSharedGitPathList,
  safeOriginBranchFromBase,
} from "../../../internal/repo-run/index.js";
import { YeetCommandError } from "../Yeet.errors.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GitCommandErrorAdapter, RepoRunContext } from "../../../internal/repo-run/index.js";

const gitErrorAdapter: GitCommandErrorAdapter<YeetCommandError> = {
  onSpawnFailure: (commandLine) => YeetCommandError.new(`Failed to run ${commandLine}.`),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    YeetCommandError.make({
      message: `${commandLine} failed with exit code ${exitCode}.`,
      command: commandLine,
      exitCode,
    }),
  onTruncated: O.some((commandLine) =>
    YeetCommandError.make({
      message: `${commandLine} output exceeded the repo-run capture limit.`,
      command: commandLine,
      exitCode: 1,
    })
  ),
};

/**
 * Run Git with Yeet's historical bounded-output error wording.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { runGitOutput } from "@beep/repo-cli/test/Yeet"
 *
 * const statusLength = runGitOutput(".", ["status", "--short"]).pipe(
 *   Effect.map((output) => output.length)
 * )
 * ```
 * @category execution
 * @since 0.0.0
 */
export const runGitOutput = Effect.fn("Yeet.runGitOutput")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<string, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runSharedGitOutput(repoRoot, args, gitErrorAdapter);
});

/**
 * Run Git and parse Yeet's NUL-delimited path output.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { runGitPathList } from "@beep/repo-cli/test/Yeet"
 *
 * const changedPaths = runGitPathList(".", ["diff", "--name-only", "-z"]).pipe(
 *   Effect.map((paths) => paths.length)
 * )
 * ```
 * @category execution
 * @since 0.0.0
 */
export const runGitPathList = Effect.fn("Yeet.runGitPathList")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runSharedGitPathList(repoRoot, args, gitErrorAdapter);
});

/**
 * Collect staged publish paths with Yeet's Git error adapter.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { collectStagedPublishPaths } from "@beep/repo-cli/test/Yeet"
 *
 * const stagedPathCount = collectStagedPublishPaths(".").pipe(
 *   Effect.map((paths) => paths.length)
 * )
 * ```
 * @category changed-files
 * @since 0.0.0
 */
export const collectStagedPublishPaths = Effect.fn("Yeet.collectStagedPublishPaths")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* collectStagedPaths(repoRoot, gitErrorAdapter);
});

/**
 * Collect unstaged tracked publish paths with Yeet's Git error adapter.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { collectUnstagedTrackedPaths } from "@beep/repo-cli/test/Yeet"
 *
 * const unstagedPathCount = collectUnstagedTrackedPaths(".").pipe(
 *   Effect.map((paths) => paths.length)
 * )
 * ```
 * @category changed-files
 * @since 0.0.0
 */
export const collectUnstagedTrackedPaths = Effect.fn("Yeet.collectUnstagedTrackedPaths")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* collectUnstagedPaths(repoRoot, gitErrorAdapter);
});

/**
 * Collect untracked publish paths with Yeet's Git error adapter.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { collectUntrackedPaths } from "@beep/repo-cli/test/Yeet"
 *
 * const untrackedPathCount = collectUntrackedPaths(".").pipe(
 *   Effect.map((paths) => paths.length)
 * )
 * ```
 * @category changed-files
 * @since 0.0.0
 */
export const collectUntrackedPaths = Effect.fn("Yeet.collectUntrackedPaths")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* collectGitUntrackedPaths(repoRoot, gitErrorAdapter);
});

/**
 * Trim a string into `Some` when it is non-empty.
 *
 * @param value - Candidate branch, ref, or CLI text value to trim before
 * checking for useful content.
 * @returns `Some` with the trimmed text, or `None` when the trimmed input is
 * empty.
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { optionFromNonEmpty } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * strictEqual(O.getOrThrow(optionFromNonEmpty(" main ")), "main")
 * strictEqual(O.isNone(optionFromNonEmpty("   ")), true)
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const optionFromNonEmpty = (value: string): O.Option<string> =>
  pipe(O.some(Str.trim(value)), O.filter(Str.isNonEmpty));

/**
 * Extract and validate the `origin/<branch>` ref from a `--base` value.
 *
 * @param base - The raw `--base` value (e.g. `main` or `origin/main`).
 * @returns `Option.some(branch)` for a safe `origin/<branch>` ref, otherwise `Option.none()`.
 * @example
 * ```ts
 * import { safeOriginBranchFromBaseForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(safeOriginBranchFromBaseForTesting("origin/main"))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const safeOriginBranchFromBaseForTesting = safeOriginBranchFromBase;

/**
 * Refresh the configured base ref, preserving Yeet's unsafe-ref errors.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { refreshBaseRef } from "@beep/repo-cli/test/Yeet"
 *
 * const refreshMain = refreshBaseRef(".", "origin/main").pipe(
 *   Effect.as("base-ref refreshed")
 * )
 * ```
 * @category execution
 * @since 0.0.0
 */
export const refreshBaseRef = Effect.fn("Yeet.refreshBaseRef")(function* (
  repoRoot: string,
  base: string
): Effect.fn.Return<void, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const originBranch = originBranchFromBase(base);
  if (O.isSome(originBranch)) {
    if (!isSafeOriginBranch(originBranch.value)) {
      return yield* YeetCommandError.make({
        message: `yeet refuses an unsafe base ref "${base}". Use a plain branch under origin/ such as origin/main.`,
        command: "git fetch origin",
        exitCode: 1,
      });
    }
    const safeBranch = yield* guardLiteralArg(originBranch.value).pipe(
      Effect.mapError(
        YeetCommandError.new(`yeet refuses an option-like base ref "${base}". Use a plain branch under origin/.`)
      )
    );
    yield* runGitOutput(repoRoot, [
      "fetch",
      "--quiet",
      "--no-tags",
      "origin",
      `refs/heads/${safeBranch}:refs/remotes/origin/${safeBranch}`,
    ]);
    return;
  }

  yield* runGitOutput(repoRoot, ["rev-parse", "--verify", "--end-of-options", base]);
});

/**
 * Read the current branch using Yeet's historical `rev-parse --abbrev-ref`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { currentYeetBranch } from "@beep/repo-cli/test/Yeet"
 *
 * const branchName = currentYeetBranch(".").pipe(
 *   Effect.map((branch) => branch.trim())
 * )
 * ```
 * @category execution
 * @since 0.0.0
 */
export const currentYeetBranch = Effect.fn("Yeet.currentYeetBranch")(function* (
  repoRoot: string
): Effect.fn.Return<string, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* currentBranch(repoRoot, gitErrorAdapter, "abbrev-ref").pipe(Effect.map(Str.trim));
});

/**
 * Read the current commit SHA.
 *
 * @param context - Repo-run context whose root determines where Git reads
 * `HEAD`.
 * @returns The trimmed commit SHA from `git rev-parse HEAD`.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { currentCommitSha } from "@beep/repo-cli/test/Yeet"
 *
 * const shaLength = currentCommitSha({
 *   base: "origin/main",
 *   branch: "feature",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], packages: [], tasks: [] }
 * }).pipe(Effect.map((sha) => sha.length))
 * ```
 * @category execution
 * @since 0.0.0
 */
export const currentCommitSha = (context: RepoRunContext) =>
  runGitOutput(context.repoRoot, ["rev-parse", "HEAD"]).pipe(Effect.map(Str.trim));

/**
 * Return whether `bun.lock` changed between the configured base and head.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { lockfileChangedSinceBase } from "@beep/repo-cli/test/Yeet"
 *
 * const lockfileChanged = lockfileChangedSinceBase({
 *   base: "origin/main",
 *   branch: "feature",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], packages: [], tasks: [] }
 * }).pipe(Effect.map(Boolean))
 * ```
 * @category execution
 * @since 0.0.0
 */
export const lockfileChangedSinceBase = Effect.fn("Yeet.lockfileChangedSinceBase")(function* (
  context: RepoRunContext
): Effect.fn.Return<boolean, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const changed = yield* runGitPathList(context.repoRoot, [
    "diff",
    "--name-only",
    "-z",
    `${context.base}...${context.head}`,
    "--",
    "bun.lock",
  ]).pipe(Effect.orElseSucceed(A.empty<string>));
  return !A.isReadonlyArrayEmpty(changed);
});
