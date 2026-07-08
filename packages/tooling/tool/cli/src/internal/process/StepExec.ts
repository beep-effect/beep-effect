/**
 * One consolidated `ChildProcess` runner for the repo CLI.
 *
 * Every command group previously hand-rolled its own subprocess capture loop
 * (bounded and unbounded stdout/stderr folds, must-succeed vs best-effort exit
 * handling, inherited-stdio steps). This module is the single sanctioned home
 * for that machinery. It stays deliberately behavior-preserving: the buffer
 * caps, truncation notices, stream-combination strategy, trimming, and env/cwd
 * handling that diverged across call sites are all parameters here, so a call
 * site can be migrated onto {@link runCaptured} / {@link runCapturedStreams} /
 * {@link runToExit} without changing what it emits.
 *
 * The runner never picks its own error type: it fails with the underlying
 * `PlatformError` from the spawner and leaves domain error mapping to the
 * caller (`.pipe(Effect.mapError(MyError.new(...)))`). Nonzero exit codes are
 * returned in the result, not raised — the `must-succeed` variant is
 * {@link ensureZeroExit} with a caller-supplied tagged error, and the
 * `best-effort` variant is the same result piped through `Effect.option` or
 * `Effect.orElseSucceed`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { thunkEmptyStr } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, pipe, Stream } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess } from "effect/unstable/process";
import type * as PlatformError from "effect/PlatformError";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("internal/process/StepExec");

/**
 * Stdin disposition understood by the step runner.
 *
 * @category models
 * @since 0.0.0
 */
export type StepStdio = "inherit" | "pipe" | "ignore";

/**
 * Which streams {@link runCaptured} folds, and how.
 *
 * `"all"` folds the spawner's interleaved `handle.all` stream (used by most
 * grouped step runners). `"merge"` decodes `stdout` and `stderr` separately and
 * merges the decoded text streams (used by the repo-run executor); the two
 * differ only in where the UTF-8 decode boundary falls, so the mode is
 * preserved rather than unified. `"stdout"` folds `stdout` alone and leaves
 * `stderr` ignored (used by the git line readers).
 *
 * @category models
 * @since 0.0.0
 */
export type CaptureSource = "all" | "merge" | "stdout";

/**
 * A character cap plus the notice appended once captured output overflows it.
 *
 * @example
 * ```ts
 * import { OutputBound } from "@beep/repo-cli/internal/process"
 *
 * const bound = OutputBound.make({ maxChars: 4096, truncatedNotice: "\n[cli] truncated" })
 * console.log(bound.maxChars)
 * ```
 * @category models
 * @since 0.0.0
 */
export class OutputBound extends S.Class<OutputBound>($I`OutputBound`)(
  {
    maxChars: S.Finite,
    truncatedNotice: S.String,
  },
  $I.annote("OutputBound", {
    description: "Character cap and the notice appended once captured subprocess output overflows it.",
  })
) {}

/**
 * Accumulator produced by the bounded output fold.
 *
 * @example
 * ```ts
 * import { BoundedOutput } from "@beep/repo-cli/internal/process"
 *
 * const state = BoundedOutput.make({ text: "captured", truncated: false })
 * console.log(state.truncated)
 * ```
 * @category models
 * @since 0.0.0
 */
export class BoundedOutput extends S.Class<BoundedOutput>($I`BoundedOutput`)(
  {
    text: S.String,
    truncated: S.Boolean,
  },
  $I.annote("BoundedOutput", {
    description: "Accumulator produced by the bounded subprocess output fold.",
  })
) {}

/**
 * Combined captured subprocess result.
 *
 * @example
 * ```ts
 * import { CapturedStep } from "@beep/repo-cli/internal/process"
 *
 * const result = CapturedStep.make({ exitCode: 0, output: "ok", truncated: false })
 * console.log(result.exitCode)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CapturedStep extends S.Class<CapturedStep>($I`CapturedStep`)(
  {
    exitCode: S.Finite,
    output: S.String,
    truncated: S.Boolean,
  },
  $I.annote("CapturedStep", {
    description: "Combined captured subprocess result: exit code, folded output, and truncation flag.",
  })
) {}

/**
 * Captured subprocess result with stdout and stderr kept separate.
 *
 * @example
 * ```ts
 * import { CapturedStreams } from "@beep/repo-cli/internal/process"
 *
 * const result = CapturedStreams.make({ exitCode: 0, stdout: "out", stderr: "" })
 * console.log(result.stdout)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CapturedStreams extends S.Class<CapturedStreams>($I`CapturedStreams`)(
  {
    exitCode: S.Finite,
    stdout: S.String,
    stderr: S.String,
  },
  $I.annote("CapturedStreams", {
    description: "Captured subprocess result with stdout and stderr kept separate.",
  })
) {}

/**
 * Planned subprocess invocation shared by repo-quality command families.
 *
 * @remarks
 * This is the sanctioned home for the quality step model. Quality task
 * adapters, GitHub-check lanes, and operational helpers may still render their
 * own labels and errors, but they all describe child processes with this shape
 * so cross-group consumers do not deep-import `commands/Quality/Tasks`.
 *
 * @example
 * ```ts
 * import { QualityTaskStep } from "@beep/repo-cli/internal/process"
 *
 * const step = QualityTaskStep.make({
 *   label: "check",
 *   command: "bunx",
 *   args: ["turbo", "run", "check"],
 *   cwd: "/repo"
 * })
 * console.log(step.label)
 * ```
 * @category models
 * @since 0.0.0
 */
export class QualityTaskStep extends S.Class<QualityTaskStep>($I`QualityTaskStep`)(
  {
    label: S.String,
    command: S.String,
    args: S.Array(S.String),
    cwd: S.String,
    env: S.optionalKey(S.Record(S.String, S.Union([S.String, S.Undefined]))),
    useLocalEnv: S.optionalKey(S.Boolean),
  },
  $I.annote("QualityTaskStep", {
    description: "Planned subprocess invocation shared by repo-quality command families.",
  })
) {}

/**
 * Empty bounded-output accumulator seed.
 *
 * @example
 * ```ts
 * import { emptyBoundedOutput } from "@beep/repo-cli/internal/process"
 *
 * console.log(emptyBoundedOutput.truncated)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const emptyBoundedOutput = BoundedOutput.make({
  text: "",
  truncated: false,
});

/**
 * The 512 KiB repo-run output bound, matching the shared run executor.
 *
 * @example
 * ```ts
 * import { repoRunOutputBound } from "@beep/repo-cli/internal/process"
 *
 * console.log(repoRunOutputBound.maxChars)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const repoRunOutputBound = OutputBound.make({
  maxChars: 512 * 1024,
  truncatedNotice: `\n[repo-run] output truncated after ${512 * 1024} characters`,
});

/**
 * The 256 KiB grouped-step output bound, matching the quality task runner.
 *
 * @example
 * ```ts
 * import { qualityStepOutputBound } from "@beep/repo-cli/internal/process"
 *
 * console.log(qualityStepOutputBound.maxChars)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const qualityStepOutputBound = OutputBound.make({
  maxChars: 256 * 1024,
  truncatedNotice: `\n[beep-cli] output truncated after ${256 * 1024} characters`,
});

/**
 * Reducer that appends a decoded chunk while enforcing an output bound.
 *
 * Once the accumulated text reaches the bound the reducer appends the bound's
 * truncation notice, flips `truncated`, and ignores every later chunk. Behavior
 * matches the hand-rolled `appendOutputChunk` folds it replaces.
 *
 * @param bound - Character cap and truncation notice to enforce.
 * @returns A fold step over `(state, chunk)`.
 * @example
 * ```ts
 * import { boundedChunkReducer, emptyBoundedOutput, OutputBound } from "@beep/repo-cli/internal/process"
 *
 * const step = boundedChunkReducer(OutputBound.make({ maxChars: 4, truncatedNotice: "!" }))
 * console.log(step(emptyBoundedOutput, "abcdef"))
 * ```
 * @category folding
 * @since 0.0.0
 */
export const boundedChunkReducer =
  (bound: OutputBound) =>
  (state: BoundedOutput, chunk: string): BoundedOutput => {
    if (state.truncated) {
      return state;
    }

    const remaining = bound.maxChars - Str.length(state.text);
    if (remaining <= 0) {
      return BoundedOutput.make({
        text: `${state.text}${bound.truncatedNotice}`,
        truncated: true,
      });
    }

    if (Str.length(chunk) <= remaining) {
      return BoundedOutput.make({
        text: `${state.text}${chunk}`,
        truncated: false,
      });
    }

    return BoundedOutput.make({
      text: `${state.text}${Str.slice(0, remaining)(chunk)}${bound.truncatedNotice}`,
      truncated: true,
    });
  };

/**
 * Fold a byte stream into decoded text bounded by a character cap.
 *
 * @param bound - Character cap and truncation notice to enforce.
 * @returns A function folding a byte stream into a {@link BoundedOutput}.
 * @example
 * ```ts
 * import { collectBoundedText, repoRunOutputBound } from "@beep/repo-cli/internal/process"
 * import { Stream } from "effect"
 *
 * const fold = collectBoundedText(repoRunOutputBound)
 * console.log(fold(Stream.make(new TextEncoder().encode("hi"))))
 * ```
 * @category streams
 * @since 0.0.0
 */
export const collectBoundedText =
  (bound: OutputBound) =>
  <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<BoundedOutput, E> =>
    stream.pipe(
      Stream.decodeText(),
      Stream.runFold(() => emptyBoundedOutput, boundedChunkReducer(bound))
    );

/**
 * Fold a byte stream into its full decoded text, unbounded.
 *
 * Replaces the group-private `collectText` helpers duplicated across the
 * command groups.
 *
 * @param stream - Byte stream to decode and concatenate.
 * @returns Effect yielding the accumulated text.
 * @example
 * ```ts
 * import { collectText } from "@beep/repo-cli/internal/process"
 * import { Stream } from "effect"
 *
 * console.log(collectText(Stream.make(new TextEncoder().encode("hi"))))
 * ```
 * @category streams
 * @since 0.0.0
 */
export const collectText = <E, R>(stream: Stream.Stream<Uint8Array, E, R>): Effect.Effect<string, E, R> =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(thunkEmptyStr, (acc, chunk) => `${acc}${chunk}`)
  );

/**
 * Render an argv as a single space-joined command line for logs and errors.
 *
 * @param command - Executable name or path.
 * @param args - Command arguments.
 * @returns Space-joined command line.
 * @example
 * ```ts
 * import { formatCommandLine } from "@beep/repo-cli/internal/process"
 *
 * console.log(formatCommandLine("git", ["status", "--short"]))
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const formatCommandLine: {
  (command: string, args: ReadonlyArray<string>): string;
  (args: ReadonlyArray<string>): (command: string) => string;
} = dual(2, (command: string, args: ReadonlyArray<string>): string => A.join([command, ...args], " "));

type SpawnFields = {
  readonly cwd?: string | undefined;
  readonly env?: Record<string, string | undefined> | undefined;
  readonly extendEnv?: boolean | undefined;
  readonly stdin?: StepStdio | undefined;
};

const spawnFields = (options: SpawnFields) =>
  O.getSomesStruct({
    cwd: O.fromUndefinedOr(options.cwd),
    env: O.fromUndefinedOr(options.env),
    extendEnv: O.fromUndefinedOr(options.extendEnv),
    stdin: O.fromUndefinedOr(options.stdin),
  });

const decodedText = <E>(stream: Stream.Stream<Uint8Array, E>): Stream.Stream<string, E> =>
  stream.pipe(Stream.decodeText());

const captureTextStream = (
  handle: ChildProcessSpawner.ChildProcessHandle,
  source: CaptureSource
): Stream.Stream<string, PlatformError.PlatformError> => {
  if (source === "merge") {
    return decodedText(handle.stdout).pipe(Stream.merge(decodedText(handle.stderr)));
  }
  if (source === "stdout") {
    return decodedText(handle.stdout);
  }
  return decodedText(handle.all);
};

const foldDecodedText = <E>(
  stream: Stream.Stream<string, E>,
  bound: OutputBound | undefined,
  tee: boolean
): Effect.Effect<BoundedOutput, E> => {
  if (bound !== undefined) {
    const append = boundedChunkReducer(bound);
    return stream.pipe(
      Stream.runFold(
        () => emptyBoundedOutput,
        (state: BoundedOutput, chunk: string) => {
          if (tee) {
            process.stdout.write(chunk);
          }
          return append(state, chunk);
        }
      )
    );
  }

  return pipe(
    stream,
    Stream.runFold(thunkEmptyStr, (acc: string, chunk: string) => {
      if (tee) {
        process.stdout.write(chunk);
      }
      return `${acc}${chunk}`;
    }),
    Effect.map((text) => BoundedOutput.make({ text, truncated: false }))
  );
};

/**
 * Options for {@link runCaptured}.
 *
 * @category models
 * @since 0.0.0
 */
export type RunCapturedOptions = SpawnFields & {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly source?: CaptureSource | undefined;
  readonly bound?: OutputBound | undefined;
  readonly trim?: boolean | undefined;
  readonly tee?: boolean | undefined;
};

/**
 * Spawn a command and capture combined stdout+stderr into one string.
 *
 * Nonzero exit codes are represented in the result; only spawn/stream failures
 * reach the `PlatformError` channel (map them to a domain error at the call
 * site). Set `bound` to cap the buffer, `trim` to trim the captured text, and
 * `tee` to stream chunks to the parent stdout while capturing.
 *
 * @param options - Command, spawn fields, and capture configuration.
 * @returns Captured combined output, exit code, and truncation flag.
 * @example
 * ```ts
 * import { runCaptured, repoRunOutputBound } from "@beep/repo-cli/internal/process"
 *
 * const captured = runCaptured({
 *   command: "git",
 *   args: ["status", "--short"],
 *   cwd: process.cwd(),
 *   source: "merge",
 *   bound: repoRunOutputBound,
 *   trim: true
 * })
 * console.log(captured)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const runCaptured = Effect.fn("StepExec.runCaptured")(function* (
  options: RunCapturedOptions
): Effect.fn.Return<CapturedStep, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner> {
  const source = options.source ?? "all";
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(options.command, [...options.args], {
        ...spawnFields(options),
        stdout: "pipe",
        stderr: source === "stdout" ? "ignore" : "pipe",
      });
      const [captured, exitCode] = yield* Effect.all(
        [foldDecodedText(captureTextStream(handle, source), options.bound, options.tee ?? false), handle.exitCode],
        { concurrency: "unbounded" }
      );
      return CapturedStep.make({
        exitCode,
        output: options.trim === true ? Str.trim(captured.text) : captured.text,
        truncated: captured.truncated,
      });
    })
  );
});

/**
 * Options for {@link runCapturedStreams}.
 *
 * @category models
 * @since 0.0.0
 */
export type RunCapturedStreamsOptions = SpawnFields & {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly bound?: OutputBound | undefined;
  readonly trim?: boolean | undefined;
};

/**
 * Spawn a command and capture stdout and stderr as separate strings.
 *
 * Used by call sites that need to keep the two streams apart (for example
 * distinct error excerpts). Nonzero exit codes are represented in the result.
 *
 * @param options - Command, spawn fields, and capture configuration.
 * @returns Captured stdout, stderr, and exit code.
 * @example
 * ```ts
 * import { runCapturedStreams } from "@beep/repo-cli/internal/process"
 *
 * const captured = runCapturedStreams({
 *   command: "bun",
 *   args: ["--version"],
 *   cwd: process.cwd(),
 *   extendEnv: true
 * })
 * console.log(captured)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const runCapturedStreams = Effect.fn("StepExec.runCapturedStreams")(function* (
  options: RunCapturedStreamsOptions
): Effect.fn.Return<CapturedStreams, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(options.command, [...options.args], {
        ...spawnFields(options),
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [
          foldDecodedText(decodedText(handle.stdout), options.bound, false),
          foldDecodedText(decodedText(handle.stderr), options.bound, false),
          handle.exitCode,
        ],
        { concurrency: "unbounded" }
      );
      return CapturedStreams.make({
        exitCode,
        stdout: options.trim === true ? Str.trim(stdout.text) : stdout.text,
        stderr: options.trim === true ? Str.trim(stderr.text) : stderr.text,
      });
    })
  );
});

/**
 * Options for {@link runToExit}.
 *
 * @category models
 * @since 0.0.0
 */
export type RunToExitOptions = SpawnFields & {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly stdio: "inherit" | "ignore";
};

/**
 * Spawn a command with inherited or ignored stdio and return its exit code.
 *
 * The `inherited-stdio` variant: nothing is captured, output flows straight to
 * the parent (or is discarded). Nonzero exit codes are returned, not raised.
 *
 * @param options - Command, spawn fields, and stdio disposition.
 * @returns The subprocess exit code.
 * @example
 * ```ts
 * import { runToExit } from "@beep/repo-cli/internal/process"
 *
 * const exitCode = runToExit({
 *   command: "bun",
 *   args: ["install"],
 *   cwd: process.cwd(),
 *   stdio: "inherit"
 * })
 * console.log(exitCode)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const runToExit = Effect.fn("StepExec.runToExit")(function* (
  options: RunToExitOptions
): Effect.fn.Return<number, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(options.command, [...options.args], {
        ...spawnFields(options),
        stdout: options.stdio,
        stderr: options.stdio,
      });
      return yield* handle.exitCode;
    })
  );
});

/**
 * Fail with a caller-supplied tagged error when a captured step exited nonzero.
 *
 * The `must-succeed` variant: thread a {@link CapturedStep} /
 * {@link CapturedStreams} (or any `{ exitCode }`) through this to turn a
 * nonzero exit into the command group's own error type.
 *
 * @example
 * ```ts
 * import { ensureZeroExit, runCaptured } from "@beep/repo-cli/internal/process"
 * import { Effect } from "effect"
 *
 * const proven = runCaptured({ command: "git", args: ["status"] }).pipe(
 *   Effect.flatMap(ensureZeroExit((exitCode) => new Error(`git failed (${exitCode})`)))
 * )
 * console.log(proven)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const ensureZeroExit: {
  <A extends { readonly exitCode: number }, E>(self: A, onNonZero: (exitCode: number) => E): Effect.Effect<A, E>;
  <E>(onNonZero: (exitCode: number) => E): <A extends { readonly exitCode: number }>(self: A) => Effect.Effect<A, E>;
} = dual(
  2,
  <A extends { readonly exitCode: number }, E>(self: A, onNonZero: (exitCode: number) => E): Effect.Effect<A, E> =>
    self.exitCode === 0 ? Effect.succeed(self) : Effect.fail(onNonZero(self.exitCode))
);
