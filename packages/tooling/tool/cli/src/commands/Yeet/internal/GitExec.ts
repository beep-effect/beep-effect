/**
 * Yeet-specific adapters over shared Git execution helpers.
 *
 * Two tiers live here. The argv runners (`runGitOutput`, `runGitFoldedStdout`, `runGitPathList`)
 * wrap repo-run's bounded capture with Yeet's `YeetCommandError` wording. The typed readers
 * (`refreshBaseRef`, `currentYeetBranch`, `currentCommitSha`, the `collect*` trio) and the mutation
 * reader {@link captureGitKitExit} run through `@beep/git`'s `Git` service and fold its typed errors
 * back through the same adapter (repo-cli-gh-git-consolidation W1b, SPEC D-09), so every exported
 * name keeps its error wording.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git, GitOptions } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { $RepoCliId } from "@beep/identity/packages";
import { guardLiteralArg } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  adaptGitKitError,
  collectUntrackedPaths as collectGitUntrackedPaths,
  collectStagedPaths,
  collectUnstagedPaths,
  currentBranch,
  isSafeOriginBranch,
  originBranchFromBase,
  runGitFoldedStdout as runSharedGitFoldedStdout,
  runGitOutput as runSharedGitOutput,
  runGitPathList as runSharedGitPathList,
  safeOriginBranchFromBase,
} from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import type { GitShape } from "@beep/git/Git";
import type { GitInvocation } from "@beep/git/GitCommand";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RunFoldedStdoutOptions } from "../../../internal/process/StepExec.ts";
import type { GitCommandErrorAdapter, GitKitError, RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/GitExec");

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
 * **Example** (Map git status length)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { runGitOutput } from "@beep/repo-cli/test/Yeet"
 *
 * const statusLength = runGitOutput(".", ["status", "--short"]).pipe(
 *   Effect.map((output) => output.length)
 * )
 * ```
 *
 * @category execution
 * @since 0.0.0
 */
export const runGitOutput = Effect.fn("Yeet.runGitOutput")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<string, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom> {
  return yield* runSharedGitOutput(repoRoot, args, gitErrorAdapter);
});

/**
 * Run Git with Yeet's error wording and fold its stdout while it streams.
 *
 * **Details**
 *
 * The unbounded counterpart of {@link runGitOutput} for output Yeet only needs reduced, such as a
 * digest of a diff larger than the repo-run capture limit.
 *
 * **Example** (Count diff bytes)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as Stream from "effect/Stream";
 * import { runGitFoldedStdout } from "@beep/repo-cli/test/Yeet"
 *
 * const size = runGitFoldedStdout(".", ["diff", "HEAD~1", "HEAD"], (stdout) =>
 *   stdout.pipe(
 *     Stream.runFold(() => 0, (total: number, chunk: Uint8Array) => total + chunk.length),
 *     Effect.map(String)
 *   )
 * )
 * ```
 *
 * @category execution
 * @since 0.0.0
 */
export const runGitFoldedStdout = Effect.fn("Yeet.runGitFoldedStdout")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>,
  fold: RunFoldedStdoutOptions["fold"]
): Effect.fn.Return<string, YeetCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runSharedGitFoldedStdout(repoRoot, args, gitErrorAdapter, fold);
});

/**
 * Run Git and parse Yeet's NUL-delimited path output.
 *
 * **Example** (Count NUL-delimited paths)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { runGitPathList } from "@beep/repo-cli/test/Yeet"
 *
 * const changedPaths = runGitPathList(".", ["diff", "--name-only", "-z"]).pipe(
 *   Effect.map((paths) => paths.length)
 * )
 * ```
 *
 * @category execution
 * @since 0.0.0
 */
export const runGitPathList = Effect.fn("Yeet.runGitPathList")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<
  ReadonlyArray<string>,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
> {
  return yield* runSharedGitPathList(repoRoot, args, gitErrorAdapter);
});

/**
 * Collect staged publish paths with Yeet's Git error adapter.
 *
 * **Example** (Count staged publish paths)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { collectStagedPublishPaths } from "@beep/repo-cli/test/Yeet"
 *
 * const stagedPathCount = collectStagedPublishPaths(".").pipe(
 *   Effect.map((paths) => paths.length)
 * )
 * ```
 *
 * @category changed-files
 * @since 0.0.0
 */
export const collectStagedPublishPaths = Effect.fn("Yeet.collectStagedPublishPaths")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<string>,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | Git
> {
  return yield* collectStagedPaths(repoRoot, gitErrorAdapter);
});

/**
 * Collect unstaged tracked publish paths with Yeet's Git error adapter.
 *
 * **Example** (Count unstaged tracked paths)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { collectUnstagedTrackedPaths } from "@beep/repo-cli/test/Yeet"
 *
 * const unstagedPathCount = collectUnstagedTrackedPaths(".").pipe(
 *   Effect.map((paths) => paths.length)
 * )
 * ```
 *
 * @category changed-files
 * @since 0.0.0
 */
export const collectUnstagedTrackedPaths = Effect.fn("Yeet.collectUnstagedTrackedPaths")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<string>,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | Git
> {
  return yield* collectUnstagedPaths(repoRoot, gitErrorAdapter);
});

/**
 * Collect untracked publish paths with Yeet's Git error adapter.
 *
 * **Example** (Count untracked publish paths)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { collectUntrackedPaths } from "@beep/repo-cli/test/Yeet"
 *
 * const untrackedPathCount = collectUntrackedPaths(".").pipe(
 *   Effect.map((paths) => paths.length)
 * )
 * ```
 *
 * @category changed-files
 * @since 0.0.0
 */
export const collectUntrackedPaths = Effect.fn("Yeet.collectUntrackedPaths")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<string>,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | Git
> {
  return yield* collectGitUntrackedPaths(repoRoot, gitErrorAdapter);
});

/**
 * Trim a string into `Some` when it is non-empty.
 *
 * **Example** (Trim non-empty Option)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { optionFromNonEmpty } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * strictEqual(O.getOrThrow(optionFromNonEmpty(" main ")), "main")
 * strictEqual(O.isNone(optionFromNonEmpty("   ")), true)
 * ```
 *
 * @param value - Candidate branch, ref, or CLI text value to trim before
 * checking for useful content.
 * @returns `Some` with the trimmed text, or `None` when the trimmed input is
 * empty.
 * @category parsing
 * @since 0.0.0
 */
export const optionFromNonEmpty = (value: string): O.Option<string> =>
  pipe(O.some(Str.trim(value)), O.filter(Str.isNonEmpty));

/**
 * Extract and validate the `origin/<branch>` ref from a `--base` value.
 *
 * **Example** (Parse origin branch base)
 *
 * ```ts
 * import { safeOriginBranchFromBaseForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(safeOriginBranchFromBaseForTesting("origin/main"))
 * ```
 *
 * @param base - The raw `--base` value (e.g. `main` or `origin/main`).
 * @returns `Option.some(branch)` for a safe `origin/<branch>` ref, otherwise `Option.none()`.
 * @category testing
 * @since 0.0.0
 */
export const safeOriginBranchFromBaseForTesting = safeOriginBranchFromBase;

/**
 * The `GitOptions` for Yeet's long-running git mutations: a 15-minute per-run
 * timeout instead of the kit's 30-second default, with the default output bound.
 *
 * **Details**
 *
 * `Git.layer` at the runtime edge runs every call under the default 30 s
 * timeout, which the old unbounded repo-run capture never had. Two Yeet steps
 * legitimately outlive it: the head-install preflight's `worktree add` and
 * `worktree remove --force` (the remove deletes a checkout that `bun install`
 * just filled with about 227k entries) and `refreshBaseRef`'s network fetch.
 * Those sites build their own `Git` from these options (SPEC D-09) instead of
 * taking the edge instance.
 *
 * **Example** (Read the patient timeout)
 *
 * ```ts
 * import { PATIENT_GIT_OPTIONS } from "@beep/repo-cli/test/Yeet"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMinutes(PATIENT_GIT_OPTIONS.timeout)) // 15
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PATIENT_GIT_OPTIONS: GitOptions = GitOptions.make({ timeout: Duration.minutes(15) });

/**
 * A `Git` service under {@link PATIENT_GIT_OPTIONS}, built from the ambient spawner.
 *
 * **Example** (Build the patient service)
 *
 * ```ts
 * import { patientGit } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(patientGit)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const patientGit: Effect.Effect<GitShape, never, ChildProcessSpawner.ChildProcessSpawner> =
  Git.makeWith(PATIENT_GIT_OPTIONS);

/**
 * Refresh the configured base ref, preserving Yeet's unsafe-ref errors.
 *
 * **Details**
 *
 * An `origin/<branch>` base runs `Git.fetch` against remote `origin` with the explicit refspec
 * `refs/heads/<branch>:refs/remotes/origin/<branch>`, which materializes `origin/<branch>` under a
 * single-branch clone too. Any other base is verified in place with
 * `Git.revParse(repoRoot, base)`; a base git would read as an option is refused before any spawn
 * and reaches Yeet as the spawn-failure wording.
 *
 * **Example** (Refresh origin main ref)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { refreshBaseRef } from "@beep/repo-cli/test/Yeet"
 *
 * const refreshMain = refreshBaseRef(".", "origin/main").pipe(
 *   Effect.as("base-ref refreshed")
 * )
 * ```
 *
 * @category execution
 * @since 0.0.0
 */
export const refreshBaseRef = Effect.fn("Yeet.refreshBaseRef")(function* (
  repoRoot: string,
  base: string
): Effect.fn.Return<void, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  // A network fetch may outlive the edge instance's 30 s timeout (SPEC D-09).
  const git = yield* patientGit;
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
    const refspec = `refs/heads/${safeBranch}:refs/remotes/origin/${safeBranch}`;
    yield* git
      .fetch(repoRoot, { remote: "origin", ref: refspec })
      .pipe(Effect.mapError(adaptGitKitError(GitCommand.fetch("origin", refspec), gitErrorAdapter)));
    return;
  }

  yield* git
    .revParse(repoRoot, base)
    .pipe(Effect.mapError(adaptGitKitError(GitCommand.revParse(base), gitErrorAdapter)));
});

/**
 * Read the current branch using Yeet's historical `rev-parse --abbrev-ref`.
 *
 * **Example** (Read trimmed branch name)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { currentYeetBranch } from "@beep/repo-cli/test/Yeet"
 *
 * const branchName = currentYeetBranch(".").pipe(
 *   Effect.map((branch) => branch.trim())
 * )
 * ```
 *
 * @category execution
 * @since 0.0.0
 */
export const currentYeetBranch = Effect.fn("Yeet.currentYeetBranch")(function* (
  repoRoot: string
): Effect.fn.Return<
  string,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | Git
> {
  return yield* currentBranch(repoRoot, gitErrorAdapter, "abbrev-ref").pipe(Effect.map(Str.trim));
});

/**
 * Read the current commit SHA.
 *
 * **Details**
 *
 * Runs `Git.revParse(repoRoot, "HEAD")` (`rev-parse --verify HEAD`); an unborn repository reaches
 * Yeet as the exit-128 wording the bounded `rev-parse HEAD` capture produced.
 *
 * **Example** (Map commit SHA length)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
 *
 * @param context - Repo-run context whose root determines where Git reads
 * `HEAD`.
 * @returns The trimmed commit SHA from `git rev-parse --verify HEAD`.
 * @category execution
 * @since 0.0.0
 */
export const currentCommitSha = Effect.fn("Yeet.currentCommitSha")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, YeetCommandError, Git> {
  const git = yield* Git;
  return yield* git
    .revParse(context.repoRoot, "HEAD")
    .pipe(Effect.mapError(adaptGitKitError(GitCommand.revParse("HEAD"), gitErrorAdapter)));
});

/**
 * Return whether `bun.lock` changed between the configured base and head.
 *
 * **Details**
 *
 * Runs `Git.changedFiles(repoRoot, { base, head, pathspec: ["bun.lock"] })` (the G7 pathspec,
 * repo-cli-gh-git-consolidation W2, SPEC D-10); any failure reads as "unchanged", as the tolerant
 * capture it replaces did.
 *
 * **Example** (Detect bun.lock changes)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
 *
 * @category execution
 * @since 0.0.0
 */
export const lockfileChangedSinceBase = Effect.fn("Yeet.lockfileChangedSinceBase")(function* (
  context: RepoRunContext
): Effect.fn.Return<boolean, YeetCommandError, Git> {
  const git = yield* Git;
  const changed = yield* git
    .changedFiles(context.repoRoot, { base: context.base, head: context.head, pathspec: ["bun.lock"] })
    .pipe(Effect.orElseSucceed(A.empty<string>));
  return A.isReadonlyArrayNonEmpty(changed);
});

/**
 * The exit a repo-run capture reported for a git mutation: its code and the text git printed.
 *
 * **Example** (Represent a successful mutation without captured output)
 *
 * ```ts
 * import { GitKitExit } from "@beep/repo-cli/test/Yeet"
 *
 * const exit = GitKitExit.make({ exitCode: 0, output: "" })
 * console.log(exit.exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GitKitExit extends S.Opaque<GitKitExit, { readonly brand: unique symbol }>()(
  S.Struct({
    exitCode: S.Finite,
    output: S.String,
  }).pipe(
    $I.annoteSchema("GitKitExit", {
      description: "A Git mutation's finite exit code and output, with empty output for a successful kit call.",
    })
  )
) {}

const exitZero: Result.Result<GitKitExit, YeetCommandError> = Result.succeed(
  GitKitExit.make({ exitCode: 0, output: "" })
);

const kitExitAdapter = (failedToRun: string): GitCommandErrorAdapter<Result.Result<GitKitExit, YeetCommandError>> => ({
  onSpawnFailure: () => (cause) => Result.fail(YeetCommandError.new(failedToRun)(cause)),
  onNonZeroExit: ({ exitCode, output }) => Result.succeed(GitKitExit.make({ exitCode, output })),
  onTruncated: O.none(),
});

/**
 * Read a `Git` mutation's outcome the way Yeet read a `runRepoCommandCapture` of the same argv.
 *
 * **Details**
 *
 * A `Git` mutation member (`worktreeAdd`, `worktreeRemove`, ...) succeeds as `void` and fails with
 * the kit's typed errors. Yeet's preflight and teardown steps branch on the exit code and render the
 * text git printed, so this folds the member back onto that shape through {@link adaptGitKitError}:
 * success is exit 0 with no output (the kit does not surface a zero-exit transcript), a failure git
 * reported is its exit code with the kit's stderr (128 with the typed message for an unknown ref or a
 * non-repository), and a failure where git never ran (spawn failure, timeout, a pre-spawn refusal of
 * an option-like argument) is `YeetCommandError` with `failedToRun` as its message, the wording the
 * capture's spawn failure carried.
 *
 * **Example** (Read a worktree removal's exit code)
 *
 * ```ts
 * import { Git } from "@beep/git/Git"
 * import { GitCommand } from "@beep/git/GitCommand"
 * import { captureGitKitExit } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const exitCode = Effect.flatMap(Git, (git) =>
 *   git.worktreeRemove("/repo", "/repo/.beep/preview", { force: true }).pipe(
 *     captureGitKitExit(GitCommand.worktreeRemove("/repo/.beep/preview", true), "Failed to run git worktree remove."),
 *     Effect.map((exit) => exit.exitCode)
 *   )
 * )
 * console.log(Effect.isEffect(exitCode)) // true
 * ```
 *
 * @param self - The kit mutation whose outcome is read.
 * @param invocation - The kit invocation the member ran, for the redacted command line.
 * @param failedToRun - Yeet's message when git never ran.
 * @returns The exit view of the mutation, or `YeetCommandError` when git never ran.
 * @category execution
 * @since 0.0.0
 */
export const captureGitKitExit: {
  <R>(
    self: Effect.Effect<void, GitKitError, R>,
    invocation: GitInvocation,
    failedToRun: string
  ): Effect.Effect<GitKitExit, YeetCommandError, R>;
  (
    invocation: GitInvocation,
    failedToRun: string
  ): <R>(self: Effect.Effect<void, GitKitError, R>) => Effect.Effect<GitKitExit, YeetCommandError, R>;
} = dual(
  3,
  <R>(
    self: Effect.Effect<void, GitKitError, R>,
    invocation: GitInvocation,
    failedToRun: string
  ): Effect.Effect<GitKitExit, YeetCommandError, R> =>
    self.pipe(
      Effect.as(exitZero),
      Effect.catch((error) => Effect.succeed(adaptGitKitError(error, invocation, kitExitAdapter(failedToRun)))),
      Effect.flatMap(Effect.fromResult)
    )
);
