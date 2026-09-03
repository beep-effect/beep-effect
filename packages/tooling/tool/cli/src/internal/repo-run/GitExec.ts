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

import { $RepoCliId } from "@beep/identity/packages";
import { isOptionLike } from "@beep/repo-utils";
import { NonNegativeInt } from "@beep/schema";
import { Effect, FileSystem, flow, Number as N, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { formatCommandLine, repoRunOutputBound, runCaptured, runCapturedStreams } from "../process/StepExec.ts";
import type * as PlatformError from "effect/PlatformError";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RunCapturedOptions, RunCapturedStreamsOptions } from "../process/StepExec.ts";

const $I = $RepoCliId.create("internal/repo-run/GitExec");

/** One parsed entry from `git ls-tree -r -z --full-tree`. @category models @since 0.0.0 */
export class GitTreeEntry extends S.Class<GitTreeEntry>($I`GitTreeEntry`)(
  {
    mode: S.String,
    objectType: S.String,
    objectId: S.String,
    path: S.String,
  },
  $I.annote("GitTreeEntry", {
    description: "Git tree mode, object type, object id, and exact repository-relative path.",
  })
) {}

/** One rename from `git diff --name-status -z --find-renames`. @category models @since 0.0.0 */
export class GitRenameEntry extends S.Class<GitRenameEntry>($I`GitRenameEntry`)(
  {
    sourcePath: S.String,
    targetPath: S.String,
    score: NonNegativeInt,
  },
  $I.annote("GitRenameEntry", {
    description: "Rename source, target, and similarity score parsed from Git's NUL-delimited output.",
  })
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

const GIT_RENAME_STATUS = /^R([0-9]+)$/u;
const GIT_COPY_STATUS = /^C[0-9]+$/u;
const GIT_SINGLE_STATUS = /^[ADMTUXB]$/u;

/** Path fields that follow one status field: two for renames and copies, one for every other tracked status. */
const nameStatusPathCount = (status: string): O.Option<number> => {
  if (GIT_RENAME_STATUS.test(status) || GIT_COPY_STATUS.test(status)) {
    return O.some(2);
  }
  return GIT_SINGLE_STATUS.test(status) ? O.some(1) : O.none();
};

/** Similarity score carried by a rename status, rejecting anything outside Git's `[50, 100]` band. */
const renameScoreFromStatus = (status: string): O.Option<number> => {
  const match = GIT_RENAME_STATUS.exec(status);
  if (match === null || !P.isString(match[1])) {
    return O.none();
  }
  return pipe(
    N.parse(match[1]),
    O.filter((score) => score >= 50 && score <= 100)
  );
};

/** One consumed name-status record: how many fields it spans, and the rename it carries (copies carry none). */
type GitNameStatusRecord = {
  readonly width: number;
  readonly rename: O.Option<GitRenameEntry>;
};

const readNameStatusRecord = (fields: ReadonlyArray<string>, index: number): O.Option<GitNameStatusRecord> => {
  const status = fields[index];
  if (!P.isString(status)) {
    return O.none();
  }
  const pathCount = nameStatusPathCount(status);
  const sourcePath = fields[index + 1];
  if (O.isNone(pathCount) || !P.isString(sourcePath)) {
    return O.none();
  }
  const width = pathCount.value + 1;
  if (pathCount.value === 1) {
    return O.some({ width, rename: O.none<GitRenameEntry>() });
  }
  const targetPath = fields[index + 2];
  if (!P.isString(targetPath)) {
    return O.none();
  }
  if (!GIT_RENAME_STATUS.test(status)) {
    return O.some({ width, rename: O.none<GitRenameEntry>() });
  }
  return O.map(renameScoreFromStatus(status), (score) => ({
    width,
    rename: O.some(GitRenameEntry.make({ sourcePath, targetPath, score: NonNegativeInt.make(score) })),
  }));
};

/** Parse rename-only rows from exact NUL-delimited name-status output. Copies are consumed but ignored. @category parsing @since 0.0.0 */
export const gitRenameEntriesFromNulOutput = (output: string): O.Option<ReadonlyArray<GitRenameEntry>> => {
  if (Str.isEmpty(output)) {
    return O.some(A.empty<GitRenameEntry>());
  }
  if (!Str.endsWith("\0")(output)) {
    return O.none();
  }
  const fields = A.dropRight(Str.split("\0")(output), 1);
  let index = 0;
  let renames = A.empty<GitRenameEntry>();

  while (index < A.length(fields)) {
    const record = readNameStatusRecord(fields, index);
    if (O.isNone(record)) {
      return O.none();
    }
    index += record.value.width;
    renames = A.appendAll(renames, O.toArray(record.value.rename));
  }

  return O.some(renames);
};

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
 * import type { GitCommandErrorAdapter } from "@beep/repo-cli/internal/repo-run"
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
 * Filters empties, dedupes, and sorts a path list into a stable canonical order.
 *
 * **Example** (Canonicalize a noisy path list)
 *
 * ```ts
 * import { sortedUniquePaths } from "@beep/repo-cli/internal/repo-run"
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
 * import { gitPathListFromNulOutput } from "@beep/repo-cli/internal/repo-run"
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
 * import { gitLinesFromOutput } from "@beep/repo-cli/internal/repo-run"
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
): Effect.Effect<string, E, ChildProcessSpawner.ChildProcessSpawner> => {
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
): Effect.Effect<string, E, ChildProcessSpawner.ChildProcessSpawner> => {
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
 * import { runGitOutput } from "@beep/repo-cli/internal/repo-run"
 * import { Effect } from "effect"
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
): Effect.fn.Return<string, E, ChildProcessSpawner.ChildProcessSpawner> {
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
 * become a phantom path; stderr surfaces only in the nonzero-exit message.
 *
 * **Example** (List staged paths)
 *
 * ```ts
 * import { runGitPathList } from "@beep/repo-cli/internal/repo-run"
 * import { Effect } from "effect"
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
): Effect.fn.Return<ReadonlyArray<string>, E, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* runGitStructured(args, adapter, structuredCapture(cwd));
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
 * import { runGitLines } from "@beep/repo-cli/internal/repo-run"
 * import { Effect } from "effect"
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
): Effect.fn.Return<ReadonlyArray<string>, E, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* runGitCaptured(args, adapter, { cwd, source: "stdout" });
  return parseLines(output);
});

/** Run a Git command with unbounded, untrimmed stdout, keeping stderr out of the parsed text. @category execution @since 0.0.0 */
export const runGitRawOutput = Effect.fn("GitExec.runGitRawOutput")(function* <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<string, E, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitStructured(args, adapter, { cwd, stdin: "ignore" });
});

/** Resolve a ref to a verified commit without allowing option reinterpretation. @category execution @since 0.0.0 */
export const resolveGitCommit = Effect.fn("GitExec.resolveGitCommit")(function* <E>(
  cwd: string,
  ref: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<string, E, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitStructured(
    ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`],
    adapter,
    structuredCapture(cwd)
  );
});

/** Resolve the merge base of two refs without allowing option reinterpretation. @category execution @since 0.0.0 */
export const resolveGitMergeBase = Effect.fn("GitExec.resolveGitMergeBase")(function* <E>(
  cwd: string,
  leftRef: string,
  rightRef: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<string, E, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitStructured(["merge-base", "--", leftRef, rightRef], adapter, structuredCapture(cwd));
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
): Effect.fn.Return<void, E, ChildProcessSpawner.ChildProcessSpawner> {
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
): Effect.fn.Return<void, E | EDirty, ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path> {
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

/** Read and strictly parse one recursive full Git tree. @category execution @since 0.0.0 */
export const readGitTree = Effect.fn("GitExec.readGitTree")(function* <E>(
  cwd: string,
  commit: string,
  adapter: GitCommandErrorAdapter<E>,
  onMalformed: () => E
): Effect.fn.Return<ReadonlyArray<GitTreeEntry>, E, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* runGitRawOutput(cwd, ["ls-tree", "-r", "-z", "--full-tree", commit], adapter);
  return yield* Effect.fromOption(gitTreeEntriesFromNulOutput(output), () => onMalformed());
});

/** Read and strictly parse the rename table for one paired diff and path scope. @category execution @since 0.0.0 */
export const readGitRenames = Effect.fn("GitExec.readGitRenames")(function* <E>(
  cwd: string,
  baseCommit: string,
  headCommit: string,
  pathspec: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>,
  onMalformed: () => E
): Effect.fn.Return<ReadonlyArray<GitRenameEntry>, E, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* runGitRawOutput(
    cwd,
    ["diff", "--name-status", "-z", "--find-renames=50%", baseCommit, headCommit, "--", ...pathspec],
    adapter
  );
  return yield* Effect.fromOption(gitRenameEntriesFromNulOutput(output), () => onMalformed());
});

/**
 * Collects staged path names via `git diff --cached --name-only -z`.
 *
 * **Example** (Read the staged path set)
 *
 * ```ts
 * import { collectStagedPaths } from "@beep/repo-cli/internal/repo-run"
 * import { Effect } from "effect"
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
): Effect.fn.Return<ReadonlyArray<string>, E, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitPathList(cwd, ["diff", "--cached", "--name-only", "-z"], adapter);
});

/**
 * Collects unstaged tracked path names via `git diff --name-only -z`.
 *
 * **Example** (Read the unstaged tracked path set)
 *
 * ```ts
 * import { collectUnstagedPaths } from "@beep/repo-cli/internal/repo-run"
 * import { Effect } from "effect"
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
): Effect.fn.Return<ReadonlyArray<string>, E, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitPathList(cwd, ["diff", "--name-only", "-z"], adapter);
});

/**
 * Collects untracked path names via `git ls-files --others --exclude-standard -z`.
 *
 * **Details**
 *
 * `--exclude-standard` applies the repository's ignore rules, so ignored build output never enters
 * the dirty-path union.
 *
 * **Example** (Read the untracked path set)
 *
 * ```ts
 * import { collectUntrackedPaths } from "@beep/repo-cli/internal/repo-run"
 * import { Effect } from "effect"
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
): Effect.fn.Return<ReadonlyArray<string>, E, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitPathList(cwd, ["ls-files", "--others", "--exclude-standard", "-z"], adapter);
});

/**
 * Collects the sorted, unique union of staged, unstaged, and untracked paths.
 *
 * **When to use**
 *
 * Use when a gate must consider everything a commit could pick up, not only what is already staged.
 *
 * **Example** (Read the whole dirty-worktree path union)
 *
 * ```ts
 * import { collectDirtyPaths } from "@beep/repo-cli/internal/repo-run"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const dirty = collectDirtyPaths(process.cwd(), {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * })
 *
 * console.log(Effect.isEffect(dirty)) // true
 * ```
 *
 * @param cwd - Working directory.
 * @param adapter - Error adapter for the calling command group.
 * @returns The dirty-worktree path union.
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
 * Collects changed paths for a diff range via `git diff --name-only -z <range>`.
 *
 * **Example** (Restrict a range diff to one path)
 *
 * ```ts
 * import { collectChangedPathsSinceBase } from "@beep/repo-cli/internal/repo-run"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const changed = collectChangedPathsSinceBase(process.cwd(), "origin/main...HEAD", {
 *   onSpawnFailure: (commandLine) => (cause) => new Error(`${commandLine}: ${String(cause)}`),
 *   onNonZeroExit: ({ commandLine, exitCode }) => new Error(`${commandLine} exit ${exitCode}`),
 *   onTruncated: O.none()
 * }, ["bun.lock"])
 *
 * console.log(Effect.isEffect(changed)) // true
 * ```
 *
 * @param cwd - Working directory.
 * @param range - A diff range such as `origin/main...HEAD` or `<mergeBase>..HEAD`.
 * @param adapter - Error adapter for the calling command group.
 * @param pathspec - Optional pathspec appended after `--`.
 * @returns Sorted, unique changed paths on a zero exit.
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
 * Reads the current branch name.
 *
 * **Details**
 *
 * `"abbrev-ref"` runs `git rev-parse --abbrev-ref HEAD` and `"show-current"` runs
 * `git branch --show-current`. Both forms are kept because they differ on a detached HEAD: the
 * former reports `HEAD`, the latter reports an empty string.
 *
 * **Example** (Read the checked-out branch)
 *
 * ```ts
 * import { currentBranch } from "@beep/repo-cli/internal/repo-run"
 * import { Effect } from "effect"
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
): Effect.fn.Return<string, E, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitOutput(
    cwd,
    ref === "show-current" ? ["branch", "--show-current"] : ["rev-parse", "--abbrev-ref", "HEAD"],
    adapter
  );
});

/**
 * Refreshes `origin/main`, unshallowing the clone first when needed.
 *
 * **Details**
 *
 * Runs `git rev-parse --is-shallow-repository`, then a conditional
 * `git fetch origin --quiet --unshallow`, then `git fetch origin main:refs/remotes/origin/main
 * --quiet`, all through the bounded capture profile. The unshallow step is what makes merge-base
 * resolution reliable on a CI clone.
 *
 * **Example** (Refresh the base ref before a range diff)
 *
 * ```ts
 * import { ensureOriginMain } from "@beep/repo-cli/internal/repo-run"
 * import { Effect } from "effect"
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
 * **Details**
 *
 * Option-like names, git refname metacharacters, `..`, and leading, trailing, or `.lock` violations
 * are all rejected, so a caller-supplied base ref cannot be reparsed as a fetch option or refspec.
 *
 * **Example** (Reject an option-like branch name)
 *
 * ```ts
 * import { isSafeOriginBranch } from "@beep/repo-cli/internal/repo-run"
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
 * import { originBranchFromBase } from "@beep/repo-cli/internal/repo-run"
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
 * import { safeOriginBranchFromBase } from "@beep/repo-cli/internal/repo-run"
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
