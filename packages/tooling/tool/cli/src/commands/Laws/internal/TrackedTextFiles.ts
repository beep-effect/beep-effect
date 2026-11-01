/**
 * Shared tracked-text-file scaffolding for repo-wide text laws.
 *
 * **Details**
 *
 * Owns the pieces every git-tracked text law repeats: listing regular index
 * entries with `git ls-files -z --stage`, the NotFound-tolerant working-tree
 * read with NUL binary detection, the concurrent scan driver, and the
 * 1-based line/column locator. Each law passes its own error adapter, error
 * mapper, skip predicate, and text scanner, so it keeps its tagged execution
 * error, messages, finding schema, and suggestions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as F from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { runGitRawOutput } from "../../../internal/repo-run/GitExec.ts";
import type { Err } from "@beep/utils";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../../internal/repo-run/GitExec.ts";

const NEWLINE_PATTERN = /\n/gu;

/** `git ls-files --stage` modes of regular files; symlinks (120000) and gitlinks (160000) carry no text. */
const REGULAR_FILE_MODES = ["100644", "100755"];

const STAGE_RECORD_PATTERN = /^(\d{6}) [0-9a-f]+ \d\t(.+)$/su;

const READ_CONCURRENCY = 32;

const textDecoder = new TextDecoder();

type FileOutcome<Finding> = {
  readonly binary: boolean;
  readonly findings: ReadonlyArray<Finding>;
};

/**
 * Offsets at which each line of a text starts; the first line starts at 0.
 *
 * **Example** (Find line starts)
 *
 * ```ts
 * import { lineStartOffsets } from "@beep/repo-cli/test/Laws"
 *
 * console.log(lineStartOffsets("ab\ncd\n")) // [ 0, 3, 6 ]
 * ```
 *
 * @param content - The file's text.
 * @returns Line start offsets in ascending order.
 * @category utilities
 * @since 0.0.0
 */
export const lineStartOffsets = (content: string): ReadonlyArray<number> =>
  A.prepend(
    A.getSomes(
      A.map(A.fromIterable(F.pipe(content, Str.matchAll(NEWLINE_PATTERN))), (match) =>
        O.map(O.fromNullishOr(match.index), (index) => index + 1)
      )
    ),
    0
  );

/**
 * Locate a match index as a 1-based line and column.
 *
 * **Details**
 *
 * Columns count UTF-16 code units from the start of the line.
 *
 * **Example** (Locate a match on the second line)
 *
 * ```ts
 * import { lineStartOffsets, locateIndex } from "@beep/repo-cli/test/Laws"
 *
 * console.log(locateIndex(lineStartOffsets("ab\ncd\n"), 4)) // { line: 2, column: 2 }
 * ```
 *
 * **Example** (Locate in a pipeline)
 *
 * ```ts
 * import { pipe } from "effect/Function"
 * import { lineStartOffsets, locateIndex } from "@beep/repo-cli/test/Laws"
 *
 * console.log(pipe(lineStartOffsets("ab\ncd\n"), locateIndex(0))) // { line: 1, column: 1 }
 * ```
 *
 * @param lineStarts - Offsets from {@link lineStartOffsets}.
 * @param index - Match index in the text.
 * @returns The 1-based line and column of the index.
 * @category utilities
 * @since 0.0.0
 */
export const locateIndex: {
  (index: number): (lineStarts: ReadonlyArray<number>) => { readonly line: number; readonly column: number };
  (lineStarts: ReadonlyArray<number>, index: number): { readonly line: number; readonly column: number };
} = F.dual(
  2,
  (lineStarts: ReadonlyArray<number>, index: number): { readonly line: number; readonly column: number } => {
    const lineIndex = F.pipe(
      A.findLastIndex(lineStarts, (start) => start <= index),
      O.getOrElse(() => 0)
    );
    const lineStart = F.pipe(
      A.get(lineStarts, lineIndex),
      O.getOrElse(() => 0)
    );
    return { line: lineIndex + 1, column: index - lineStart + 1 };
  }
);

/**
 * Build a git error adapter that reports spawn failures and nonzero exits as plain messages.
 *
 * **Example** (Adapt a tagged error constructor)
 *
 * ```ts
 * import { RetiredEffectPathsExecutionError } from "@beep/repo-cli/commands/Laws/Laws.errors"
 * import { messageGitErrorAdapter } from "@beep/repo-cli/test/Laws"
 *
 * const adapter = messageGitErrorAdapter(RetiredEffectPathsExecutionError.new)
 * console.log(adapter.onNonZeroExit({ commandLine: "git ls-files", exitCode: 128, output: "" }).message)
 * // "git ls-files failed with exit code 128."
 * ```
 *
 * @param makeError - Builds the law's error from a message.
 * @returns An adapter that never reports truncation.
 * @category utilities
 * @since 0.0.0
 */
export const messageGitErrorAdapter = <E>(makeError: (message: string) => E): GitCommandErrorAdapter<E> => ({
  onSpawnFailure: (commandLine) => () => makeError(`Failed to spawn ${commandLine}.`),
  onNonZeroExit: ({ commandLine, exitCode }) => makeError(`${commandLine} failed with exit code ${exitCode}.`),
  onTruncated: O.none(),
});

const regularFileFromStageRecord = (record: string): O.Option<string> =>
  F.pipe(
    O.fromNullishOr(STAGE_RECORD_PATTERN.exec(record)),
    O.filter((match) => A.contains(REGULAR_FILE_MODES, match[1])),
    O.flatMap((match) => O.fromNullishOr(match[2]))
  );

const listTrackedRegularFiles = Effect.fn("TrackedTextFiles.listTrackedRegularFiles")(function* <E>(
  repoRoot: string,
  gitErrors: GitCommandErrorAdapter<E>
) {
  const output = yield* runGitRawOutput(repoRoot, ["ls-files", "-z", "--stage"], gitErrors);
  return F.pipe(
    Str.split("\0")(output),
    A.filter(Str.isNonEmpty),
    A.map(regularFileFromStageRecord),
    A.getSomes,
    A.dedupe
  );
});

/**
 * Run a text scanner over every git-tracked regular text file of a repository.
 *
 * **Details**
 *
 * Locates the repository root, lists index entries with
 * `git ls-files --stage`, keeps regular files, splits off the files
 * `isSkipped` accepts, reads the rest concurrently, skips index entries
 * deleted from the working tree and any file containing a NUL byte, and
 * hands the decoded text to
 * `scan`. `mapError` maps the root lookup and read failures into the law's
 * own error with a message prefix.
 *
 * **Example** (Count TODO markers in tracked files)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { RetiredEffectPathsExecutionError } from "@beep/repo-cli/commands/Laws/Laws.errors"
 * import { messageGitErrorAdapter, scanTrackedTextFiles } from "@beep/repo-cli/test/Laws"
 *
 * const program = scanTrackedTextFiles({
 *   cwd: process.cwd(),
 *   gitErrors: messageGitErrorAdapter(RetiredEffectPathsExecutionError.new),
 *   mapError: RetiredEffectPathsExecutionError.mapError,
 *   isSkipped: (file) => file.startsWith("vendor/"),
 *   scan: (file, content) => (content.includes("TODO") ? [file] : []),
 * })
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Repository location, the law's error handling, skip predicate, and scanner.
 * @returns Effect with the findings and the scanned, binary, and skipped file counts.
 * @category utilities
 * @since 0.0.0
 */
export const scanTrackedTextFiles = Effect.fn("TrackedTextFiles.scanTrackedTextFiles")(function* <Finding, E>(options: {
  readonly cwd: string;
  readonly gitErrors: GitCommandErrorAdapter<E>;
  readonly mapError: Err.ErrorMapper<E, [message: string]>;
  readonly isSkipped: (file: string) => boolean;
  readonly scan: (file: string, content: string) => ReadonlyArray<Finding>;
}): Effect.fn.Return<
  {
    readonly scannedFiles: number;
    readonly skippedBinaryFiles: number;
    readonly skippedFiles: number;
    readonly findings: ReadonlyArray<Finding>;
  },
  E,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot(options.cwd).pipe(options.mapError("Failed to locate the repository root"));
  const tracked = yield* listTrackedRegularFiles(repoRoot, options.gitErrors);
  const scanFile = (file: string) =>
    fs.readFile(path.join(repoRoot, file)).pipe(
      Effect.asSome,
      Effect.catchIf(
        (error) => error.reason._tag === "NotFound",
        () => Effect.succeed(O.none<Uint8Array>())
      ),
      options.mapError(`Failed to read ${file}`),
      Effect.map(
        O.map(
          (content): FileOutcome<Finding> =>
            content.includes(0)
              ? { binary: true, findings: A.empty() }
              : { binary: false, findings: options.scan(file, textDecoder.decode(content)) }
        )
      )
    );
  const outcomes = yield* Effect.forEach(A.filter(tracked, P.not(options.isSkipped)), scanFile, {
    concurrency: READ_CONCURRENCY,
  });
  const present = A.getSomes(outcomes);
  return {
    scannedFiles: A.length(present),
    skippedBinaryFiles: A.length(A.filter(present, (outcome) => outcome.binary)),
    skippedFiles: A.length(A.filter(tracked, options.isSkipped)),
    findings: A.flatMap(present, (outcome) => outcome.findings),
  };
});
