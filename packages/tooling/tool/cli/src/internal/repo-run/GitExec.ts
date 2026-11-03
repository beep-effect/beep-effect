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
 * Two layers live here. The generic argv runners (`runGitOutput`, `runGitPathList`,
 * `runGitLines`, `runGitRawOutput`, `runGitFoldedStdout`, `writeGitArchive`,
 * `guardCloneLocalGitAttributes`) are repo-cli's bounded child-process owner for
 * arbitrary git argv. The typed readers (`resolveGitCommit`, `resolveGitMergeBase`,
 * `readGitTree`, `readGitRenames`, the `collect*Paths` trio, `currentBranch`'s
 * `abbrev-ref` mode and `ensureOriginMain`) each map to one `@beep/git` member and
 * run through the `Git` service; {@link adaptGitKitError} folds the kit's typed
 * errors back through the caller's adapter so no call site changes shape
 * (repo-cli-gh-git-consolidation W1a, SPEC D-08).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { $RepoCliId } from "@beep/identity/packages";
import {
  formatCommandLine,
  OutputBound,
  repoRunOutputBound,
  runCaptured,
  runCapturedStreams,
  runFoldedStdout,
} from "@beep/repo-cli-kit/process/StepExec";
import { isOptionLike } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type {
  GitCommandError,
  LsTreeEntry,
  NameStatusEntry,
  NotARepositoryError,
  UnknownRefError,
} from "@beep/git/Git";
import type { GitInvocation } from "@beep/git/GitCommand";
import type {
  RunCapturedOptions,
  RunCapturedStreamsOptions,
  RunFoldedStdoutOptions,
} from "@beep/repo-cli-kit/process/StepExec";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as PlatformError from "effect/PlatformError";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("internal/repo-run/GitExec");

/** One parsed entry from `git ls-tree -r -z --full-tree`. @category models @since 0.0.0 */
export class GitTreeEntry extends S.Opaque<GitTreeEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.String,
    objectType: S.String,
    objectId: S.String,
    path: S.String,
  }).pipe(
    $I.annoteSchema("GitTreeEntry", {
      description: "Git tree mode, object type, object id, and exact repository-relative path.",
    })
  )
) {}

/** One rename from `git diff --name-status -z --find-renames`. @category models @since 0.0.0 */
export class GitRenameEntry extends S.Opaque<GitRenameEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    sourcePath: S.String,
    targetPath: S.String,
    score: S.Natural,
  }).pipe(
    $I.annoteSchema("GitRenameEntry", {
      description: "Rename source, target, and similarity score parsed from Git's NUL-delimited output.",
    })
  )
) {}

const parseGitTreeEntry = (record: string): O.Option<GitTreeEntry> => {
  const match = /^([0-9]{6}) ([a-z]+) ([0-9a-f]+)\t([^\0]+)$/u.exec(record);
  if (
    match === null ||
    !P.isString(match[1]) ||
    !P.isString(match[2]) ||
    !P.isString(match[3]) ||
    !P.isString(match[4])
  ) {
    return O.none();
  }
  return O.some(
    GitTreeEntry.make({
      mode: match[1],
      objectType: match[2],
      objectId: match[3],
      path: match[4],
    })
  );
};

/** Parse exact NUL-delimited recursive tree output, failing with `None` on any malformed record. @category parsing @since 0.0.0 */
export const gitTreeEntriesFromNulOutput = (output: string): O.Option<ReadonlyArray<GitTreeEntry>> => {
  if (Str.isEmpty(output)) {
    return O.some(A.empty<GitTreeEntry>());
  }
  if (!Str.endsWith("\0")(output)) {
    return O.none();
  }
  const records = A.dropRight(Str.split("\0")(output), 1);
  const entries = A.getSomes(A.map(records, parseGitTreeEntry));
  return A.length(entries) === A.length(records) ? O.some(entries) : O.none();
};

/** The `GitTreeEntry` view of one kit `LsTreeEntry`: the repo-cli field names consumers already read. */
const gitTreeEntryFromLsTree = (entry: LsTreeEntry): GitTreeEntry =>
  GitTreeEntry.make({ mode: entry.mode, objectType: entry.type, objectId: entry.oid, path: entry.path });

/** Git only reports rename similarity inside `[50, 100]`; the old parser refused anything else, so this does too. */
const isRenameScore = (score: number): boolean => score >= 50 && score <= 100;

/**
 * The `GitRenameEntry` view of one kit `NameStatusEntry`: `None` for every non-rename row (copies
 * included), `Some(None)` for a rename whose source path or in-band score is missing (the kit
 * carries `score` only when git printed digits), and `Some(Some(entry))` for a well-formed rename.
 */
const gitRenameEntryFromNameStatus = (entry: NameStatusEntry): O.Option<O.Option<GitRenameEntry>> =>
  entry.status === "renamed"
    ? O.some(
        O.map(
          O.all({
            sourcePath: O.fromUndefinedOr(entry.oldPath),
            score: O.filter(O.fromUndefinedOr(entry.score), isRenameScore),
          }),
          ({ sourcePath, score }) =>
            GitRenameEntry.make({ sourcePath, targetPath: entry.path, score: S.Natural.make(score) })
        )
      )
    : O.none();

/** Rename rows of one kit name-status listing, or `None` when a rename row is malformed. */
const gitRenameEntriesFromNameStatus = (
  entries: ReadonlyArray<NameStatusEntry>
): O.Option<ReadonlyArray<GitRenameEntry>> => O.all(A.getSomes(A.map(entries, gitRenameEntryFromNameStatus)));

/**
 * Maps a git subprocess failure onto a command group's own error type.
 *
 * **Details**
 *
 * Leaving `onTruncated` as `O.none()` means bounded output is accepted silently; supplying a handler
 * turns truncation into a failure, which is what a caller that must see complete output wants.
 *
 * **Example** (Adapt git failures to a command group's error)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import type { GitCommandErrorAdapter } from "@beep/repo-cli/test/RepoRun"
 *
 * const adapter: GitCommandErrorAdapter<Error> = {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`spawn ${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * }
 *
 * console.log(O.isNone(adapter.onTruncated)) // true
 * ```
 *
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
 * The errors a `@beep/git` member can fail with; {@link adaptGitKitError} folds every one of them.
 *
 * @category models
 * @since 0.0.0
 */
export type GitKitError = GitCommandError | NotARepositoryError | UnknownRefError;

/** Whether a value is one of the kit's typed git errors (the dual's data-first discriminator). */
const isGitKitError = (value: unknown): value is GitKitError =>
  P.isTagged("GitCommandError")(value) ||
  P.isTagged("UnknownRefError")(value) ||
  P.isTagged("NotARepositoryError")(value);

/** A kit parser refusal: `detail` reads `unparseable <what> output: <reason>` after a zero-exit run. */
const isUnparseableOutput = (failure: GitCommandError): boolean =>
  O.exists(O.fromUndefinedOr(failure.detail), Str.startsWith("unparseable"));

/**
 * Folds a `@beep/git` failure through a command group's {@link GitCommandErrorAdapter}.
 *
 * **Details**
 *
 * The typed readers in this module run through the `Git` service but keep the adapter contract their
 * callers already satisfy, so one fold maps the kit's errors onto the adapter's three hooks:
 *
 * - a `GitCommandError` of kind `"truncated"` is `onTruncated` when the adapter sets it, otherwise
 *   `onNonZeroExit` with exit code 1 and the kit's `detail` as the output (the bounded capture it
 *   replaces had no separate signal for a caller that accepts truncation silently);
 * - a `GitCommandError` whose `detail` starts with `unparseable` (the kit's fail-closed parsers) is
 *   `onMalformed` when the reader supplies one;
 * - any other `GitCommandError` carrying an `exitCode` is `onNonZeroExit` with that code and the kit's
 *   stderr as the output;
 * - a `GitCommandError` without an `exitCode` (a spawn failure, a timeout or a pre-spawn refusal of an
 *   option-like argument) is `onSpawnFailure`, with the error itself as the cause;
 * - `UnknownRefError` and `NotARepositoryError` are `onNonZeroExit` with exit code 128, git's own code
 *   for both, and the typed error's message as the output.
 *
 * `commandLine` is `git` plus the invocation's redacted argv, so the adapter sees the argv the kit ran
 * rather than the argv the pre-W1a reader used to run.
 *
 * **Example** (Fold an unknown ref onto a command group's error)
 *
 * ```ts
 * import { GitCommand } from "@beep/git/GitCommand"
 * import { UnknownRefError } from "@beep/git/Git"
 * import { adaptGitKitError } from "@beep/repo-cli/test/RepoRun"
 * import * as O from "effect/Option"
 *
 * const fold = adaptGitKitError(GitCommand.revParse("nope", { peel: "commit" }), {
 *   onSpawnFailure: (commandLine) => () => `spawn ${commandLine}`,
 *   onNonZeroExit: ({ exitCode, output }) => `exit ${exitCode}: ${output}`,
 *   onTruncated: O.none()
 * })
 *
 * console.log(fold(UnknownRefError.make({ ref: "nope", cwd: "/repo" }))) // "exit 128: unknown ref 'nope' in /repo"
 * ```
 *
 * @param invocation - The kit invocation the member ran, for the redacted command line.
 * @param adapter - Error adapter for the calling command group.
 * @param onMalformed - Where a reader parses output, the error for a kit parser refusal.
 * @returns The adapter's error for one kit failure.
 * @category execution
 * @since 0.0.0
 */
export const adaptGitKitError: {
  <E>(
    error: GitKitError,
    invocation: GitInvocation,
    adapter: GitCommandErrorAdapter<E>,
    onMalformed?: O.Option<() => E>
  ): E;
  <E>(
    invocation: GitInvocation,
    adapter: GitCommandErrorAdapter<E>,
    onMalformed?: O.Option<() => E>
  ): (error: GitKitError) => E;
} = dual(
  (args) => isGitKitError(args[0]),
  <E>(
    error: GitKitError,
    invocation: GitInvocation,
    adapter: GitCommandErrorAdapter<E>,
    onMalformed: O.Option<() => E> = O.none()
  ): E => {
    const commandLine = formatCommandLine("git", invocation.redactedArgs);
    if (!P.isTagged("GitCommandError")(error)) {
      return adapter.onNonZeroExit({ commandLine, exitCode: 128, output: error.message });
    }
    if (error.kind === "truncated") {
      return O.match(adapter.onTruncated, {
        onNone: () =>
          adapter.onNonZeroExit({
            commandLine,
            exitCode: 1,
            output: O.getOrElse(O.fromUndefinedOr(error.detail), () => ""),
          }),
        onSome: (toError) => toError(commandLine),
      });
    }
    if (O.isSome(onMalformed) && isUnparseableOutput(error)) {
      return onMalformed.value();
    }
    return O.match(O.fromUndefinedOr(error.exitCode), {
      onNone: () => adapter.onSpawnFailure(commandLine)(error),
      onSome: (exitCode) => adapter.onNonZeroExit({ commandLine, exitCode, output: error.stderr }),
    });
  }
);

/**
 * Filters empties, dedupes, and sorts a path list into a stable canonical order.
 *
 * **Example** (Canonicalize a noisy path list)
 *
 * ```ts
 * import { sortedUniquePaths } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(sortedUniquePaths(["src/z.ts", "src/a.ts", "src/a.ts", ""]))
 * // [ "src/a.ts", "src/z.ts" ]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const sortedUniquePaths: (paths: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.filter(Str.isNonEmpty),
  A.dedupe,
  A.sort(Order.String)
);

/**
 * Parses NUL-delimited (`-z`) git path output into sorted, unique paths.
 *
 * **Details**
 *
 * NUL delimiting is what makes paths containing spaces or quotes survive intact, so every path
 * reader in this module asks git for `-z` output rather than newline-separated names.
 *
 * **Example** (Read a NUL-delimited path list)
 *
 * ```ts
 * import { gitPathListFromNulOutput } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(gitPathListFromNulOutput("src/z.ts\0src/a.ts\0src/a.ts\0"))
 * // [ "src/a.ts", "src/z.ts" ]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const gitPathListFromNulOutput: (output: string) => ReadonlyArray<string> = flow(
  Str.split("\0"),
  sortedUniquePaths
);

/**
 * Splits captured git output into trimmed, non-empty lines.
 *
 * **Details**
 *
 * This is the default line parser for {@link runGitLines}, matching the newline-based readers used
 * by the package-verify and docgen quality scanners.
 *
 * **Example** (Normalize ragged git stdout)
 *
 * ```ts
 * import { gitLinesFromOutput } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(gitLinesFromOutput("a\n  b  \n\nc\n")) // [ "a", "b", "c" ]
 * ```
 *
 * @param output - Raw captured stdout.
 * @returns Trimmed, non-empty lines.
 * @category parsing
 * @since 0.0.0
 */
export const gitLinesFromOutput = (output: string): ReadonlyArray<string> =>
  pipe(Str.split(/\r?\n/)(output), A.map(Str.trim), A.filter(Str.isNonEmpty));

/** One captured git invocation reduced to the fields the shared failure policy reads. */
type GitCaptureOutcome = {
  readonly exitCode: number;
  readonly parsed: string;
  readonly failureOutput: string;
  readonly truncated: boolean;
};

/**
 * Shared spawn-capture-then-adapt path behind every combined-output runner in this module: only the
 * capture profile differs between them, so the command line, spawn-failure mapping, and
 * exit/truncation handling live here once.
 */
const runGitCaptured = <E>(
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>,
  capture: Omit<RunCapturedOptions, "command" | "args">
): Effect.Effect<string, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> => {
  const commandLine = formatCommandLine("git", args);
  return runCaptured({ command: "git", args, ...capture }).pipe(
    Effect.mapError(adapter.onSpawnFailure(commandLine)),
    Effect.flatMap((captured) =>
      failFromOutcome(
        {
          exitCode: captured.exitCode,
          parsed: captured.output,
          failureOutput: captured.output,
          truncated: captured.truncated,
        },
        commandLine,
        adapter
      )
    )
  );
};

/**
 * Same path for runners whose output is machine-read: stdout and stderr are captured separately and
 * only stdout is returned, so a zero-exit git diagnostic (`GIT_TRACE`, hook or advice notices,
 * `warning:` lines) can never be folded into NUL-delimited records or a single-token ref. stderr is
 * kept solely for the nonzero-exit message.
 */
const runGitStructured = <E>(
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>,
  capture: Omit<RunCapturedStreamsOptions, "command" | "args">
): Effect.Effect<string, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> => {
  const commandLine = formatCommandLine("git", args);
  return runCapturedStreams({ command: "git", args, ...capture }).pipe(
    Effect.mapError(adapter.onSpawnFailure(commandLine)),
    Effect.flatMap((captured) =>
      failFromOutcome(
        {
          exitCode: captured.exitCode,
          parsed: captured.stdout,
          failureOutput: `${captured.stdout}${captured.stderr}`,
          truncated: captured.truncated,
        },
        commandLine,
        adapter
      )
    )
  );
};

/** The bounded, trimmed, stdin-inheriting profile every structured reader shares with {@link runGitOutput}. */
const structuredCapture = (cwd: string): Omit<RunCapturedStreamsOptions, "command" | "args"> => ({
  cwd,
  extendEnv: true,
  stdin: "inherit",
  bound: repoRunOutputBound,
  trim: true,
});

// Large merges can contain thousands of long filenames. Only the machine-read
// path stream gets this budget; stderr and general Git output keep their cap.
const gitPathOutputBound = OutputBound.make({
  maxChars: 8 * 1024 * 1024,
  truncatedNotice: "\n[repo-run] Git filename inventory exceeded 8 MiB",
});

const failFromOutcome = <E>(
  outcome: GitCaptureOutcome,
  commandLine: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.Effect<string, E> => {
  if (outcome.exitCode !== 0) {
    return Effect.fail(
      adapter.onNonZeroExit({ commandLine, exitCode: outcome.exitCode, output: outcome.failureOutput })
    );
  }
  return O.match(adapter.onTruncated, {
    onNone: () => Effect.succeed(outcome.parsed),
    onSome: (toError) => (outcome.truncated ? Effect.fail(toError(commandLine)) : Effect.succeed(outcome.parsed)),
  });
};

/**
 * Runs a git command and returns its trimmed, bounded, merged output.
 *
 * **Details**
 *
 * Uses the 512 KiB {@link repoRunOutputBound} with merged stdout and stderr, `stdin` inherited, and
 * `extendEnv` on — the profile the yeet and worktree groups rely on. Nonzero exits fail through
 * `adapter.onNonZeroExit`; truncation fails only when `adapter.onTruncated` is set.
 *
 * **Example** (Capture a short status)
 *
 * ```ts
 * import { runGitOutput } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const status = runGitOutput(process.cwd(), ["status", "--short"], {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 *
 * console.log(Effect.isEffect(status)) // true
 * ```
 *
 * @param cwd - Working directory.
 * @param args - Git arguments, excluding the `git` executable.
 * @param adapter - Error adapter for the calling command group.
 * @returns Trimmed combined output on a zero exit.
 * @category execution
 * @since 0.0.0
 */
export const runGitOutput = Effect.fn("GitExec.runGitOutput")(function* <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<string, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitCaptured(args, adapter, {
    cwd,
    extendEnv: true,
    stdin: "inherit",
    source: "merge",
    bound: repoRunOutputBound,
    trim: true,
  });
});

/**
 * Runs a git command and parses NUL-delimited path output.
 *
 * **Details**
 *
 * Reads stdout alone. `-z` records are machine-read, so a zero-exit diagnostic on stderr must not
 * become a phantom path; stderr surfaces only in the nonzero-exit message. Filename stdout is
 * bounded at 8 MiB, while stderr retains the generic repo-run bound. Configured truncation
 * adapters still reject incomplete inventories rather than parsing their clipped paths.
 *
 * **Example** (List staged paths)
 *
 * ```ts
 * import { runGitPathList } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const staged = runGitPathList(process.cwd(), ["diff", "--cached", "--name-only", "-z"], {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 *
 * console.log(Effect.isEffect(staged)) // true
 * ```
 *
 * @param cwd - Working directory.
 * @param args - Git arguments, which must include `-z`.
 * @param adapter - Error adapter for the calling command group.
 * @returns Sorted, unique paths on a zero exit.
 * @category execution
 * @since 0.0.0
 */
export const runGitPathList = Effect.fn("GitExec.runGitPathList")(function* <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<ReadonlyArray<string>, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* runGitStructured(args, adapter, { ...structuredCapture(cwd), stdoutBound: gitPathOutputBound });
  return gitPathListFromNulOutput(output);
});

/**
 * Runs a git command and parses its stdout into lines.
 *
 * **Details**
 *
 * Uses the unbounded stdout-only profile — stderr is ignored — that the package-verify and docgen
 * scanners rely on. Pass `parseLines` to diverge from the default {@link gitLinesFromOutput}, for
 * example to normalize path separators.
 *
 * **Example** (List untracked files)
 *
 * ```ts
 * import { runGitLines } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const untracked = runGitLines(process.cwd(), ["ls-files", "--others", "--exclude-standard"], {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 *
 * console.log(Effect.isEffect(untracked)) // true
 * ```
 *
 * @param cwd - Working directory.
 * @param args - Git arguments, excluding the `git` executable.
 * @param adapter - Error adapter for the calling command group.
 * @param parseLines - Line parser applied to captured stdout on a zero exit.
 * @returns Parsed lines on a zero exit.
 * @category execution
 * @since 0.0.0
 */
export const runGitLines = Effect.fn("GitExec.runGitLines")(function* <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>,
  parseLines: (output: string) => ReadonlyArray<string> = gitLinesFromOutput
): Effect.fn.Return<ReadonlyArray<string>, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* runGitCaptured(args, adapter, { cwd, source: "stdout" });
  return parseLines(output);
});

/** Run a Git command with unbounded, untrimmed stdout, keeping stderr out of the parsed text. @category execution @since 0.0.0 */
export const runGitRawOutput = Effect.fn("GitExec.runGitRawOutput")(function* <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<string, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitStructured(args, adapter, { cwd, stdin: "ignore" });
});

/**
 * Runs a git command and folds its stdout while it streams instead of capturing it.
 *
 * **Details**
 *
 * For output that can exceed any capture bound but is only needed reduced, such as a digest of a
 * whole diff. stdout never enters a buffer, so no truncation is possible and `adapter.onTruncated`
 * is never consulted; stderr is bounded and used only for the nonzero-exit message.
 *
 * **Example** (Count diff bytes without capturing them)
 *
 * ```ts
 * import { runGitFoldedStdout } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as Stream from "effect/Stream"
 *
 * const size = runGitFoldedStdout(
 *   process.cwd(),
 *   ["diff", "HEAD~1", "HEAD"],
 *   {
 *     onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *     onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *     onTruncated: O.none()
 *   },
 *   (stdout) =>
 *     stdout.pipe(
 *       Stream.runFold(() => 0, (total: number, chunk: Uint8Array) => total + chunk.length),
 *       Effect.map(String)
 *     )
 * )
 *
 * console.log(Effect.isEffect(size)) // true
 * ```
 *
 * @param cwd - Working directory.
 * @param args - Git arguments, excluding the `git` executable.
 * @param adapter - Error adapter for the calling command group.
 * @param fold - Reduces the streamed stdout bytes to one value.
 * @returns The folded value on a zero exit.
 * @category execution
 * @since 0.0.0
 */
export const runGitFoldedStdout = Effect.fn("GitExec.runGitFoldedStdout")(function* <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>,
  fold: RunFoldedStdoutOptions["fold"]
): Effect.fn.Return<string, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const commandLine = formatCommandLine("git", args);
  const folded = yield* runFoldedStdout({ command: "git", args, cwd, extendEnv: true, stdin: "ignore", fold }).pipe(
    Effect.mapError(adapter.onSpawnFailure(commandLine))
  );
  return yield* failFromOutcome(
    { exitCode: folded.exitCode, parsed: folded.value, failureOutput: folded.stderr, truncated: false },
    commandLine,
    adapter
  );
});

/**
 * Resolve a ref to a verified commit without allowing option reinterpretation.
 *
 * **Details**
 *
 * Runs `Git.revParse(cwd, ref, { peel: "commit" })` (`rev-parse --verify --end-of-options
 * <ref>^{commit}`); an unknown ref reaches the adapter as a 128 exit whose output is the kit's
 * `unknown ref` message, and an option-like ref is refused before any spawn (`onSpawnFailure`).
 *
 * @category execution
 * @since 0.0.0
 */
export const resolveGitCommit = Effect.fn("GitExec.resolveGitCommit")(function* <E>(
  cwd: string,
  ref: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<string, E, Git> {
  const git = yield* Git;
  return yield* git
    .revParse(cwd, ref, { peel: "commit" })
    .pipe(Effect.mapError(adaptGitKitError(GitCommand.revParse(ref, { peel: "commit" }), adapter)));
});

/**
 * Resolve the merge base of two refs without allowing option reinterpretation.
 *
 * **Details**
 *
 * Runs `Git.mergeBase(cwd, leftRef, rightRef)`, which keeps the loud contract every caller relies
 * on: two refs with no common ancestor fail through `onNonZeroExit` with git's silent exit 1, and an
 * option-like ref is refused before any spawn instead of being shielded by `--`.
 *
 * @category execution
 * @since 0.0.0
 */
export const resolveGitMergeBase = Effect.fn("GitExec.resolveGitMergeBase")(function* <E>(
  cwd: string,
  leftRef: string,
  rightRef: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<string, E, Git> {
  const git = yield* Git;
  return yield* git
    .mergeBase(cwd, leftRef, rightRef)
    .pipe(Effect.mapError(adaptGitKitError(GitCommand.mergeBase(leftRef, rightRef), adapter)));
});

/**
 * Config flags pinning archive bytes to the repository's canonical form.
 *
 * **Details**
 *
 * `git archive` consults ambient host state that silently changes the bytes it emits for
 * byte-identical objects. End-of-line config (`core.autocrlf`, `core.eol`) rewrites text blobs
 * declared `* text=auto`; the global attributes file (`core.attributesFile`, defaulting to
 * `$XDG_CONFIG_HOME/git/attributes` even when no config names it) can attach `eol=crlf` to paths,
 * and an attribute-level `eol` overrides both config keys; `tar.umask` rewrites tar header mode
 * bits. Every consumer that compares archive bytes exactly then reports drift no source edit can
 * clear. Pinning all four keys per invocation keeps one archive canonical without disturbing the
 * ambient config other Git children legitimately read: `-c` outranks every config file, and a set
 * `core.attributesFile` replaces the entire global attributes layer, XDG default path included.
 * `tar.umask=0002` restates Git's own default (entry modes 664/775), so the pin is byte-neutral on
 * clean hosts. The system attributes file has no `-c` escape hatch; {@link gitArchiveEnv} closes it.
 *
 * @category execution
 * @since 0.0.0
 */
const CANONICAL_ARCHIVE_CONFIG: ReadonlyArray<string> = [
  "-c",
  "core.autocrlf=false",
  "-c",
  "core.eol=lf",
  "-c",
  "core.attributesFile=/dev/null",
  "-c",
  "tar.umask=0002",
];

/**
 * Environment overrides completing the archive byte-canonicality contract.
 *
 * **Details**
 *
 * The system-level attributes file (`$(prefix)/etc/gitattributes`) is the one attribute layer
 * without a `-c` override, so it is disabled through the environment. The archive spawn extends the
 * ambient environment with these pairs rather than replacing it, so `PATH` resolution and
 * credential helpers keep working. Clone-local `.git/info/attributes` outranks every layer and no
 * invocation can disable it; it is absent from fresh clones and outside this contract.
 *
 * **Example** (The env pairs with the argument vector)
 *
 * ```ts
 * import { gitArchiveEnv } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(gitArchiveEnv.GIT_ATTR_NOSYSTEM) // "1"
 * ```
 *
 * @category execution
 * @since 0.0.0
 */
export const gitArchiveEnv: { readonly GIT_ATTR_NOSYSTEM: "1" } = { GIT_ATTR_NOSYSTEM: "1" };

/**
 * Argument vector writing one commit's canonical tar archive.
 *
 * **Details**
 *
 * The canonicality overrides lead the vector because Git only honours `-c` before the subcommand.
 * Keeping the vector a pure value lets the byte-canonicality contract be asserted without spawning
 * a process. The vector pairs with {@link gitArchiveEnv}, which covers the one layer `-c` cannot
 * reach.
 *
 * **Example** (The overrides lead the subcommand)
 *
 * ```ts
 * import { gitArchiveArgs } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(gitArchiveArgs("/tmp/base.tar", "HEAD")[0]) // "-c"
 * ```
 *
 * @param archivePath - Absolute path the tar is written to.
 * @param commit - Commit-ish whose tree is archived.
 * @returns The full `git` argument vector, end-of-line overrides first.
 * @category execution
 * @since 0.0.0
 */
export const gitArchiveArgs: {
  (archivePath: string, commit: string): ReadonlyArray<string>;
  (commit: string): (archivePath: string) => ReadonlyArray<string>;
} = dual(
  2,
  (archivePath: string, commit: string): ReadonlyArray<string> => [
    ...CANONICAL_ARCHIVE_CONFIG,
    "archive",
    "--format=tar",
    `--output=${archivePath}`,
    commit,
  ]
);

/** Write one verified commit as a tar archive under the canonical byte contract. @category execution @since 0.0.0 */
export const writeGitArchive = Effect.fn("GitExec.writeGitArchive")(function* <E>(
  cwd: string,
  commit: string,
  archivePath: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<void, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  yield* runGitStructured(gitArchiveArgs(archivePath, commit), adapter, {
    cwd,
    stdin: "ignore",
    env: gitArchiveEnv,
    extendEnv: true,
  });
});

/**
 * Fails closed when a non-empty clone-local `info/attributes` file would poison archive bytes.
 *
 * **Details**
 *
 * The clone-local attributes file outranks every attribute layer {@link gitArchiveArgs} and
 * {@link gitArchiveEnv} pin, and no git invocation can disable it (measured against git 2.55.0).
 * The path is resolved through `git rev-parse --git-path info/attributes` so worktrees reach the
 * shared common-dir file, then stat'd: an absent or empty file passes — fresh clones and CI never
 * carry one, so the guard is vacuously green there — while a non-empty file fails with the resolved
 * path. A stat failure other than not-found also fails closed via `onStatFailure`: a file that
 * cannot be verified cannot be proven inert.
 *
 * @category execution
 * @since 0.0.0
 */
export const guardCloneLocalGitAttributes = Effect.fn("GitExec.guardCloneLocalGitAttributes")(function* <E, EDirty>(
  cwd: string,
  adapter: GitCommandErrorAdapter<E>,
  onCloneLocalAttributes: (attributesPath: string) => EDirty,
  onStatFailure: (attributesPath: string) => (cause: PlatformError.PlatformError) => E
): Effect.fn.Return<
  void,
  E | EDirty,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const gitPath = yield* runGitStructured(
    ["rev-parse", "--git-path", "info/attributes"],
    adapter,
    structuredCapture(cwd)
  );
  const attributesPath = path.isAbsolute(gitPath) ? gitPath : path.join(cwd, gitPath);
  const nonEmpty = yield* fs.stat(attributesPath).pipe(
    Effect.map((info) => info.size > BigInt(0)),
    Effect.catchIf(
      (error) => error.reason._tag === "NotFound",
      () => Effect.succeed(false)
    ),
    Effect.mapError(onStatFailure(attributesPath))
  );
  if (nonEmpty) {
    return yield* Effect.fail(onCloneLocalAttributes(attributesPath));
  }
});

/**
 * Read and strictly parse one recursive full Git tree.
 *
 * **Details**
 *
 * Runs `Git.lsTree` (`ls-tree -r -z <commit>`) from the repository root that `Git.repoRoot(cwd)`
 * (`rev-parse --show-toplevel`) resolves, so the listing stays whole-tree and repository-relative
 * exactly as the pre-W1a `--full-tree` argv made it, whatever `cwd` is. Each `LsTreeEntry` is
 * mapped onto {@link GitTreeEntry}; the kit's parser is fail-closed, so a record it cannot read
 * becomes `onMalformed()`.
 *
 * @category execution
 * @since 0.0.0
 */
export const readGitTree = Effect.fn("GitExec.readGitTree")(function* <E>(
  cwd: string,
  commit: string,
  adapter: GitCommandErrorAdapter<E>,
  onMalformed: () => E
): Effect.fn.Return<ReadonlyArray<GitTreeEntry>, E, Git> {
  const git = yield* Git;
  const root = yield* git.repoRoot(cwd).pipe(Effect.mapError(adaptGitKitError(GitCommand.repoRoot(), adapter)));
  const entries = yield* git
    .lsTree(root, commit)
    .pipe(Effect.mapError(adaptGitKitError(GitCommand.lsTree(commit), adapter, O.some(onMalformed))));
  return A.map(entries, gitTreeEntryFromLsTree);
});

/**
 * Read and strictly parse the rename table for one paired diff and path scope.
 *
 * **Details**
 *
 * Runs `Git.nameStatus(cwd, { base, head, findRenames: 50, pathspec })` (`diff --name-status -z
 * --no-relative --find-renames=50% <base>...<head> -- <pathspec>`) and keeps the renamed rows as
 * {@link GitRenameEntry}; copies and every other status are consumed and ignored. A rename row
 * without its source path or an in-band similarity score, like output the kit's parser refuses, is
 * `onMalformed()`.
 *
 * **Gotchas**
 *
 * The kit diffs the merge-base range (`base...head`), where the pre-W1a reader diffed `base head`
 * directly. The two agree whenever `base` is an ancestor of `head`, which holds for every caller that
 * passes a merge base; a `base` on a diverged branch now diffs from the fork point instead.
 *
 * @category execution
 * @since 0.0.0
 */
export const readGitRenames = Effect.fn("GitExec.readGitRenames")(function* <E>(
  cwd: string,
  baseCommit: string,
  headCommit: string,
  pathspec: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>,
  onMalformed: () => E
): Effect.fn.Return<ReadonlyArray<GitRenameEntry>, E, Git> {
  const git = yield* Git;
  const entries = yield* git
    .nameStatus(cwd, { base: baseCommit, head: headCommit, findRenames: 50, pathspec })
    .pipe(
      Effect.mapError(
        adaptGitKitError(
          GitCommand.nameStatus(baseCommit, headCommit, false, { findRenames: 50, pathspec }),
          adapter,
          O.some(onMalformed)
        )
      )
    );
  return yield* Effect.fromOption(gitRenameEntriesFromNameStatus(entries), () => onMalformed());
});

/**
 * Collects staged path names via `Git.stagedChanges` (`git diff --name-only -z --no-relative --cached`).
 *
 * **Example** (Read the staged path set)
 *
 * ```ts
 * import { collectStagedPaths } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const staged = collectStagedPaths(process.cwd(), {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 *
 * console.log(Effect.isEffect(staged)) // true
 * ```
 *
 * @param cwd - Working directory.
 * @param adapter - Error adapter for the calling command group.
 * @returns Sorted, unique staged paths.
 * @category changed-files
 * @since 0.0.0
 */
export const collectStagedPaths = Effect.fn("GitExec.collectStagedPaths")(function* <E>(
  cwd: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<ReadonlyArray<string>, E, Git> {
  const git = yield* Git;
  const paths = yield* git
    .stagedChanges(cwd)
    .pipe(Effect.mapError(adaptGitKitError(GitCommand.stagedChanges(), adapter)));
  return sortedUniquePaths(paths);
});

/**
 * Collects unstaged tracked path names via `Git.unstagedChanges` (`git diff --name-only -z --no-relative`).
 *
 * **Example** (Read the unstaged tracked path set)
 *
 * ```ts
 * import { collectUnstagedPaths } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const unstaged = collectUnstagedPaths(process.cwd(), {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 *
 * console.log(Effect.isEffect(unstaged)) // true
 * ```
 *
 * @param cwd - Working directory.
 * @param adapter - Error adapter for the calling command group.
 * @returns Sorted, unique unstaged tracked paths.
 * @category changed-files
 * @since 0.0.0
 */
export const collectUnstagedPaths = Effect.fn("GitExec.collectUnstagedPaths")(function* <E>(
  cwd: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<ReadonlyArray<string>, E, Git> {
  const git = yield* Git;
  const paths = yield* git
    .unstagedChanges(cwd)
    .pipe(Effect.mapError(adaptGitKitError(GitCommand.unstagedChanges(), adapter)));
  return sortedUniquePaths(paths);
});

/**
 * Collects untracked path names via `Git.untrackedFiles` (`git ls-files --others --exclude-standard -z --full-name`).
 *
 * **Details**
 *
 * `--exclude-standard` applies the repository's ignore rules, so ignored build output never enters
 * the dirty-path union.
 *
 * **Example** (Read the untracked path set)
 *
 * ```ts
 * import { collectUntrackedPaths } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const untracked = collectUntrackedPaths(process.cwd(), {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 *
 * console.log(Effect.isEffect(untracked)) // true
 * ```
 *
 * @param cwd - Working directory.
 * @param adapter - Error adapter for the calling command group.
 * @returns Sorted, unique untracked paths.
 * @category changed-files
 * @since 0.0.0
 */
export const collectUntrackedPaths = Effect.fn("GitExec.collectUntrackedPaths")(function* <E>(
  cwd: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<ReadonlyArray<string>, E, Git> {
  const git = yield* Git;
  const paths = yield* git
    .untrackedFiles(cwd)
    .pipe(Effect.mapError(adaptGitKitError(GitCommand.untrackedFiles(), adapter)));
  return sortedUniquePaths(paths);
});

/**
 * How {@link currentBranch} reads the checked-out branch name.
 *
 * @category models
 * @since 0.0.0
 */
export type CurrentBranchRef = "abbrev-ref" | "show-current";

/**
 * Reads the current branch name.
 *
 * **Details**
 *
 * `"abbrev-ref"` runs `Git.currentBranch` (`git rev-parse --abbrev-ref HEAD`), restoring the
 * literal `HEAD` the kit degrades to `Option.none` on a detached HEAD; `"show-current"` runs
 * `git branch --show-current` through the bounded capture, since the kit has no member for it. Both
 * forms are kept because they differ on a detached HEAD: the former reports `HEAD`, the latter
 * reports an empty string.
 *
 * **Example** (Read the checked-out branch)
 *
 * ```ts
 * import { currentBranch } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const branch = currentBranch(process.cwd(), {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 *
 * console.log(Effect.isEffect(branch)) // true
 * ```
 *
 * @param cwd - Working directory.
 * @param adapter - Error adapter for the calling command group.
 * @param ref - Which git incantation to read the branch with.
 * @returns The current branch name on a zero exit.
 * @category execution
 * @since 0.0.0
 */
export const currentBranch = Effect.fn("GitExec.currentBranch")(function* <E>(
  cwd: string,
  adapter: GitCommandErrorAdapter<E>,
  ref: CurrentBranchRef = "abbrev-ref"
): Effect.fn.Return<string, E, Git | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  if (ref === "show-current") {
    return yield* runGitOutput(cwd, ["branch", "--show-current"], adapter);
  }
  const git = yield* Git;
  const branch = yield* git
    .currentBranch(cwd)
    .pipe(Effect.mapError(adaptGitKitError(GitCommand.currentBranch(), adapter)));
  return O.getOrElse(branch, () => "HEAD");
});

const ORIGIN_REMOTE = "origin";
const ORIGIN_MAIN_REFSPEC = "main:refs/remotes/origin/main";

/**
 * Refreshes `origin/main`, unshallowing the clone first when needed.
 *
 * **Details**
 *
 * Runs `Git.isShallow` (`git rev-parse --is-shallow-repository`), then a conditional
 * `Git.fetchUnshallow` (`git fetch --unshallow origin`), then `Git.fetch` (`git fetch origin
 * main:refs/remotes/origin/main`). The kit's fetch argv carries no `--quiet`, so fetch progress
 * reaches stderr where the pre-W1a reader silenced it. The unshallow step is what makes merge-base
 * resolution reliable on a CI clone.
 *
 * **Example** (Refresh the base ref before a range diff)
 *
 * ```ts
 * import { ensureOriginMain } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const refreshed = ensureOriginMain(process.cwd(), {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 *
 * console.log(Effect.isEffect(refreshed)) // true
 * ```
 *
 * @param cwd - Working directory.
 * @param adapter - Error adapter for the calling command group.
 * @effects Fetches from `origin` and updates the local `origin/main` remote-tracking ref.
 * @category execution
 * @since 0.0.0
 */
export const ensureOriginMain = Effect.fn("GitExec.ensureOriginMain")(function* <E>(
  cwd: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<void, E, Git> {
  const git = yield* Git;
  const shallow = yield* git.isShallow(cwd).pipe(Effect.mapError(adaptGitKitError(GitCommand.isShallow(), adapter)));
  if (shallow) {
    yield* git
      .fetchUnshallow(cwd, { remote: ORIGIN_REMOTE })
      .pipe(Effect.mapError(adaptGitKitError(GitCommand.fetchUnshallow(ORIGIN_REMOTE), adapter)));
  }
  yield* git
    .fetch(cwd, { remote: ORIGIN_REMOTE, ref: ORIGIN_MAIN_REFSPEC })
    .pipe(Effect.mapError(adaptGitKitError(GitCommand.fetch(ORIGIN_REMOTE, ORIGIN_MAIN_REFSPEC), adapter)));
});

const originRefPrefix = "origin/" as const;

// Reject any character that git refname rules forbid or that lets a branch be
// reparsed as a fetch option/refspec: control/whitespace, `:` (refspec
// separator), and the `~^?*[\` revision/glob metacharacters.
const unsafeRefnameChar = /[\s:~^?*[\]\\]/u;

/**
 * Whether a branch name is a safe plain ref under `origin/`.
 *
 * **Details**
 *
 * Option-like names, git refname metacharacters, `..`, and leading, trailing, or `.lock` violations
 * are all rejected, so a caller-supplied base ref cannot be reparsed as a fetch option or refspec.
 *
 * **Example** (Reject an option-like branch name)
 *
 * ```ts
 * import { isSafeOriginBranch } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(isSafeOriginBranch("main")) // true
 * console.log(isSafeOriginBranch("--upload-pack=x")) // false
 * ```
 *
 * @param branch - Branch name, without the `origin/` prefix.
 * @returns Whether the branch is safe to interpolate into a git refspec.
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
 * Extracts the branch name from an `origin/<branch>` base ref.
 *
 * **Gotchas**
 *
 * This performs no safety validation; use {@link safeOriginBranchFromBase} before interpolating the
 * result into a refspec.
 *
 * **Example** (Strip the remote prefix)
 *
 * ```ts
 * import { originBranchFromBase } from "@beep/repo-cli/test/RepoRun"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(originBranchFromBase("origin/main"))) // "main"
 * console.log(O.isNone(originBranchFromBase("HEAD"))) // true
 * ```
 *
 * @param base - Base ref such as `origin/main`.
 * @returns The branch name when the base is a non-empty `origin/` ref.
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
 * Extracts a validated safe branch name from an `origin/<branch>` base ref.
 *
 * **When to use**
 *
 * Use whenever a caller-supplied base ref will be interpolated into a fetch refspec, so an
 * option-like or metacharacter-bearing name is rejected before it reaches git.
 *
 * **Example** (Accept a plain branch and reject an unsafe one)
 *
 * ```ts
 * import { safeOriginBranchFromBase } from "@beep/repo-cli/test/RepoRun"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(safeOriginBranchFromBase("origin/main"))) // "main"
 * console.log(O.isNone(safeOriginBranchFromBase("origin/--x"))) // true
 * ```
 *
 * @param base - Base ref such as `origin/main`.
 * @returns The branch name when it is an `origin/` ref that passes {@link isSafeOriginBranch}.
 * @category validation
 * @since 0.0.0
 */
export const safeOriginBranchFromBase = (base: string): O.Option<string> =>
  pipe(originBranchFromBase(base), O.filter(isSafeOriginBranch));
