/**
 * Shared git subprocess helpers for the repo CLI, built on {@link runCaptured}.
 *
 * The command groups each grew their own `git` wrappers: a bounded merged
 * capture (yeet, worktree), an unbounded stdout-only line reader (package
 * verify, docgen), NUL-delimited path parsing, changed-files collectors, branch
 * reads, and origin-branch refname validation. This module hosts them once.
 *
 * Because every group keeps its own tagged error type — and its own exit /
 * truncation message wording — the runners take a {@link GitCommandErrorAdapter}
 * rather than picking an error type. Spawn failures, nonzero exits, and (opt-in)
 * truncation each route through the adapter, so a call site migrates onto these
 * helpers without changing the error it surfaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isOptionLike } from "@beep/repo-utils";
import { Effect, flow, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { formatCommandLine, repoRunOutputBound, runCaptured } from "../process/StepExec.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { CapturedStep } from "../process/StepExec.ts";

/**
 * Maps a git subprocess failure onto a command group's own error type.
 *
 * @example
 * ```ts
 * import type { GitCommandErrorAdapter } from "@beep/repo-cli/internal/repo-run"
 * import * as O from "effect/Option"
 *
 * const adapter: GitCommandErrorAdapter<Error> = {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`spawn ${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * }
 * console.log(adapter.onTruncated)
 * ```
 * @category models
 * @since 0.0.0
 */
export type GitCommandErrorAdapter<E> = {
  readonly onSpawnFailure: (commandLine: string) => (cause: unknown) => E;
  readonly onNonZeroExit: (input: {
    readonly commandLine: string;
    readonly exitCode: number;
    readonly output: string;
  }) => E;
  readonly onTruncated: O.Option<(commandLine: string) => E>;
};

/**
 * Filter empties, dedupe, and sort a path list into a stable canonical order.
 *
 * @example
 * ```ts
 * import { sortedUniquePaths } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(sortedUniquePaths(["src/z.ts", "src/a.ts", "src/a.ts", ""]))
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const sortedUniquePaths: (paths: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.filter(Str.isNonEmpty),
  A.dedupe,
  A.sort(Order.String)
);

/**
 * Parse NUL-delimited (`-z`) git path output into sorted, unique paths.
 *
 * @example
 * ```ts
 * import { gitPathListFromNulOutput } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(gitPathListFromNulOutput("src/z.ts\0src/a.ts\0src/a.ts\0"))
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const gitPathListFromNulOutput: (output: string) => ReadonlyArray<string> = flow(
  Str.split("\0"),
  sortedUniquePaths
);

/**
 * Split captured git output into trimmed, non-empty lines.
 *
 * The default line parser for {@link runGitLines}; matches the newline-based
 * readers used by the package-verify and docgen quality scanners.
 *
 * @param output - Raw captured stdout.
 * @returns Trimmed, non-empty lines.
 * @example
 * ```ts
 * import { gitLinesFromOutput } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(gitLinesFromOutput("a\n  b  \n\nc\n"))
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const gitLinesFromOutput = (output: string): ReadonlyArray<string> =>
  pipe(Str.split(/\r?\n/)(output), A.map(Str.trim), A.filter(Str.isNonEmpty));

const failFromCapture = <E>(
  captured: CapturedStep,
  commandLine: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.Effect<string, E> => {
  if (captured.exitCode !== 0) {
    return Effect.fail(adapter.onNonZeroExit({ commandLine, exitCode: captured.exitCode, output: captured.output }));
  }
  return O.match(adapter.onTruncated, {
    onNone: () => Effect.succeed(captured.output),
    onSome: (toError) => (captured.truncated ? Effect.fail(toError(commandLine)) : Effect.succeed(captured.output)),
  });
};

/**
 * Run a git command and return its trimmed, bounded, merged output.
 *
 * Uses the 512 KiB {@link repoRunOutputBound} with merged stdout+stderr, `stdin`
 * inherited, and `extendEnv` on — the profile the yeet and worktree groups rely
 * on. Nonzero exits fail through `adapter.onNonZeroExit`; truncation fails only
 * when `adapter.onTruncated` is set.
 *
 * @param cwd - Working directory.
 * @param args - Git arguments (excluding the `git` executable).
 * @param adapter - Error adapter for the calling command group.
 * @returns Trimmed combined output on a zero exit.
 * @example
 * ```ts
 * import { runGitOutput } from "@beep/repo-cli/internal/repo-run"
 * import * as O from "effect/Option"
 *
 * const status = runGitOutput(process.cwd(), ["status", "--short"], {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 * console.log(status)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const runGitOutput = Effect.fn("GitExec.runGitOutput")(function* <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<string, E, ChildProcessSpawner.ChildProcessSpawner> {
  const commandLine = formatCommandLine("git", args);
  const captured = yield* runCaptured({
    command: "git",
    args,
    cwd,
    extendEnv: true,
    stdin: "inherit",
    source: "merge",
    bound: repoRunOutputBound,
    trim: true,
  }).pipe(Effect.mapError(adapter.onSpawnFailure(commandLine)));
  return yield* failFromCapture(captured, commandLine, adapter);
});

/**
 * Run a git command and parse NUL-delimited path output.
 *
 * @param cwd - Working directory.
 * @param args - Git arguments (must include `-z`).
 * @param adapter - Error adapter for the calling command group.
 * @returns Sorted, unique paths on a zero exit.
 * @example
 * ```ts
 * import { runGitPathList } from "@beep/repo-cli/internal/repo-run"
 * import * as O from "effect/Option"
 *
 * const staged = runGitPathList(process.cwd(), ["diff", "--cached", "--name-only", "-z"], {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 * console.log(staged)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const runGitPathList = Effect.fn("GitExec.runGitPathList")(function* <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<ReadonlyArray<string>, E, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* runGitOutput(cwd, args, adapter);
  return gitPathListFromNulOutput(output);
});

/**
 * Run a git command and parse its stdout into lines.
 *
 * Uses the unbounded stdout-only profile (stderr ignored) the package-verify
 * and docgen scanners rely on. Provide `parseLines` to diverge from the default
 * {@link gitLinesFromOutput} (for example to normalize path separators).
 *
 * @param cwd - Working directory.
 * @param args - Git arguments (excluding the `git` executable).
 * @param adapter - Error adapter for the calling command group.
 * @param parseLines - Line parser applied to captured stdout on a zero exit.
 * @returns Parsed lines on a zero exit.
 * @example
 * ```ts
 * import { runGitLines } from "@beep/repo-cli/internal/repo-run"
 * import * as O from "effect/Option"
 *
 * const untracked = runGitLines(process.cwd(), ["ls-files", "--others", "--exclude-standard"], {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 * console.log(untracked)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const runGitLines = Effect.fn("GitExec.runGitLines")(function* <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>,
  parseLines: (output: string) => ReadonlyArray<string> = gitLinesFromOutput
): Effect.fn.Return<ReadonlyArray<string>, E, ChildProcessSpawner.ChildProcessSpawner> {
  const commandLine = formatCommandLine("git", args);
  const captured = yield* runCaptured({
    command: "git",
    args,
    cwd,
    source: "stdout",
  }).pipe(Effect.mapError(adapter.onSpawnFailure(commandLine)));
  const output = yield* failFromCapture(captured, commandLine, adapter);
  return parseLines(output);
});

/**
 * Collect staged path names (`git diff --cached --name-only -z`).
 *
 * @param cwd - Working directory.
 * @param adapter - Error adapter for the calling command group.
 * @returns Sorted, unique staged paths.
 * @example
 * ```ts
 * import { collectStagedPaths } from "@beep/repo-cli/internal/repo-run"
 * import * as O from "effect/Option"
 *
 * console.log(collectStagedPaths(process.cwd(), {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * }))
 * ```
 * @category changed-files
 * @since 0.0.0
 */
export const collectStagedPaths = Effect.fn("GitExec.collectStagedPaths")(function* <E>(
  cwd: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<ReadonlyArray<string>, E, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitPathList(cwd, ["diff", "--cached", "--name-only", "-z"], adapter);
});

/**
 * Collect unstaged tracked path names (`git diff --name-only -z`).
 *
 * @param cwd - Working directory.
 * @param adapter - Error adapter for the calling command group.
 * @returns Sorted, unique unstaged tracked paths.
 * @example
 * ```ts
 * import { collectUnstagedPaths } from "@beep/repo-cli/internal/repo-run"
 * import * as O from "effect/Option"
 *
 * console.log(collectUnstagedPaths(process.cwd(), {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * }))
 * ```
 * @category changed-files
 * @since 0.0.0
 */
export const collectUnstagedPaths = Effect.fn("GitExec.collectUnstagedPaths")(function* <E>(
  cwd: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<ReadonlyArray<string>, E, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitPathList(cwd, ["diff", "--name-only", "-z"], adapter);
});

/**
 * Collect untracked path names (`git ls-files --others --exclude-standard -z`).
 *
 * @param cwd - Working directory.
 * @param adapter - Error adapter for the calling command group.
 * @returns Sorted, unique untracked paths.
 * @example
 * ```ts
 * import { collectUntrackedPaths } from "@beep/repo-cli/internal/repo-run"
 * import * as O from "effect/Option"
 *
 * console.log(collectUntrackedPaths(process.cwd(), {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * }))
 * ```
 * @category changed-files
 * @since 0.0.0
 */
export const collectUntrackedPaths = Effect.fn("GitExec.collectUntrackedPaths")(function* <E>(
  cwd: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<ReadonlyArray<string>, E, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitPathList(cwd, ["ls-files", "--others", "--exclude-standard", "-z"], adapter);
});

/**
 * Collect the sorted, unique union of staged, unstaged, and untracked paths.
 *
 * @param cwd - Working directory.
 * @param adapter - Error adapter for the calling command group.
 * @returns The dirty-worktree path union.
 * @example
 * ```ts
 * import { collectDirtyPaths } from "@beep/repo-cli/internal/repo-run"
 * import * as O from "effect/Option"
 *
 * const dirty = collectDirtyPaths(process.cwd(), {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 * console.log(dirty)
 * ```
 * @category changed-files
 * @since 0.0.0
 */
export const collectDirtyPaths = Effect.fn("GitExec.collectDirtyPaths")(function* <E>(
  cwd: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<ReadonlyArray<string>, E, ChildProcessSpawner.ChildProcessSpawner> {
  const staged = yield* collectStagedPaths(cwd, adapter);
  const unstaged = yield* collectUnstagedPaths(cwd, adapter);
  const untracked = yield* collectUntrackedPaths(cwd, adapter);
  return sortedUniquePaths([...staged, ...unstaged, ...untracked]);
});

/**
 * Collect changed paths for a diff range (`git diff --name-only -z <range>`).
 *
 * @param cwd - Working directory.
 * @param range - A diff range such as `origin/main...HEAD` or `<mergeBase>..HEAD`.
 * @param adapter - Error adapter for the calling command group.
 * @param pathspec - Optional pathspec appended after `--`.
 * @returns Sorted, unique changed paths on a zero exit.
 * @example
 * ```ts
 * import { collectChangedPathsSinceBase } from "@beep/repo-cli/internal/repo-run"
 * import * as O from "effect/Option"
 *
 * const changed = collectChangedPathsSinceBase(process.cwd(), "origin/main...HEAD", {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * }, ["bun.lock"])
 * console.log(changed)
 * ```
 * @category changed-files
 * @since 0.0.0
 */
export const collectChangedPathsSinceBase = Effect.fn("GitExec.collectChangedPathsSinceBase")(function* <E>(
  cwd: string,
  range: string,
  adapter: GitCommandErrorAdapter<E>,
  pathspec: ReadonlyArray<string> = A.empty()
): Effect.fn.Return<ReadonlyArray<string>, E, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitPathList(
    cwd,
    ["diff", "--name-only", "-z", range, ...(A.isReadonlyArrayEmpty(pathspec) ? [] : ["--", ...pathspec])],
    adapter
  );
});

/**
 * How {@link currentBranch} reads the checked-out branch name.
 *
 * @category models
 * @since 0.0.0
 */
export type CurrentBranchRef = "abbrev-ref" | "show-current";

/**
 * Read the current branch name.
 *
 * `"abbrev-ref"` runs `git rev-parse --abbrev-ref HEAD`; `"show-current"` runs
 * `git branch --show-current` — the two forms the groups use are preserved.
 *
 * @param cwd - Working directory.
 * @param adapter - Error adapter for the calling command group.
 * @param ref - Which git incantation to read the branch with.
 * @returns The current branch name on a zero exit.
 * @example
 * ```ts
 * import { currentBranch } from "@beep/repo-cli/internal/repo-run"
 * import * as O from "effect/Option"
 *
 * const branch = currentBranch(process.cwd(), {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 * console.log(branch)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const currentBranch = Effect.fn("GitExec.currentBranch")(function* <E>(
  cwd: string,
  adapter: GitCommandErrorAdapter<E>,
  ref: CurrentBranchRef = "abbrev-ref"
): Effect.fn.Return<string, E, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitOutput(
    cwd,
    ref === "show-current" ? ["branch", "--show-current"] : ["rev-parse", "--abbrev-ref", "HEAD"],
    adapter
  );
});

/**
 * Refresh `origin/main`, unshallowing the clone first when needed.
 *
 * Runs `git rev-parse --is-shallow-repository`, a conditional
 * `git fetch origin --quiet --unshallow`, then
 * `git fetch origin main:refs/remotes/origin/main --quiet`, all via the bounded
 * capture profile.
 *
 * @param cwd - Working directory.
 * @param adapter - Error adapter for the calling command group.
 * @returns Completes once `origin/main` is refreshed.
 * @example
 * ```ts
 * import { ensureOriginMain } from "@beep/repo-cli/internal/repo-run"
 * import * as O from "effect/Option"
 *
 * const refreshed = ensureOriginMain(process.cwd(), {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 * console.log(refreshed)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const ensureOriginMain = Effect.fn("GitExec.ensureOriginMain")(function* <E>(
  cwd: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<void, E, ChildProcessSpawner.ChildProcessSpawner> {
  const shallow = yield* runGitOutput(cwd, ["rev-parse", "--is-shallow-repository"], adapter);
  if (shallow === "true") {
    yield* runGitOutput(cwd, ["fetch", "origin", "--quiet", "--unshallow"], adapter);
  }
  yield* runGitOutput(cwd, ["fetch", "origin", "main:refs/remotes/origin/main", "--quiet"], adapter);
});

const originRefPrefix = "origin/" as const;

// Reject any character that git refname rules forbid or that lets a branch be
// reparsed as a fetch option/refspec: control/whitespace, `:` (refspec
// separator), and the `~^?*[\` revision/glob metacharacters.
const unsafeRefnameChar = /[\s:~^?*[\]\\]/u;

/**
 * Whether a branch name is a safe plain ref under `origin/`.
 *
 * Rejects option-like names, git refname metacharacters, `..`, and leading /
 * trailing / `.lock` violations, so a caller-supplied base ref cannot be
 * reparsed as a fetch option or refspec.
 *
 * @param branch - Branch name (without the `origin/` prefix).
 * @returns Whether the branch is safe to interpolate into a git refspec.
 * @example
 * ```ts
 * import { isSafeOriginBranch } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(isSafeOriginBranch("main"), isSafeOriginBranch("--upload-pack=x"))
 * ```
 * @category validation
 * @since 0.0.0
 */
export const isSafeOriginBranch = (branch: string): boolean =>
  Str.isNonEmpty(branch) &&
  !isOptionLike(branch) &&
  O.isNone(Str.match(unsafeRefnameChar)(branch)) &&
  !Str.includes("..")(branch) &&
  !Str.startsWith("/")(branch) &&
  !Str.endsWith("/")(branch) &&
  !Str.endsWith(".lock")(branch);

/**
 * Extract the branch name from an `origin/<branch>` base ref.
 *
 * @param base - Base ref such as `origin/main`.
 * @returns The branch name when the base is a non-empty `origin/` ref.
 * @example
 * ```ts
 * import { originBranchFromBase } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(originBranchFromBase("origin/main"), originBranchFromBase("HEAD"))
 * ```
 * @category validation
 * @since 0.0.0
 */
export const originBranchFromBase = (base: string): O.Option<string> =>
  pipe(
    O.some(base),
    O.filter(Str.startsWith(originRefPrefix)),
    O.map(Str.replace(originRefPrefix, "")),
    O.filter(Str.isNonEmpty)
  );

/**
 * Extract a validated safe branch name from an `origin/<branch>` base ref.
 *
 * @param base - Base ref such as `origin/main`.
 * @returns The branch name when it is an `origin/` ref that passes
 * {@link isSafeOriginBranch}.
 * @example
 * ```ts
 * import { safeOriginBranchFromBase } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(safeOriginBranchFromBase("origin/main"), safeOriginBranchFromBase("origin/--x"))
 * ```
 * @category validation
 * @since 0.0.0
 */
export const safeOriginBranchFromBase = (base: string): O.Option<string> =>
  pipe(originBranchFromBase(base), O.filter(isSafeOriginBranch));
