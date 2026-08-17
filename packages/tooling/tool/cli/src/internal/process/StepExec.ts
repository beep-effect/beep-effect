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
import { LiteralKit } from "@beep/schema";
import { thunkEmptyStr } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, pipe, Stream } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess } from "effect/unstable/process";
import type { Duration } from "effect";
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
 * **Details**
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
 * **Example** (Cap captured output at 4 KiB)
 *
 * ```ts
 * import { OutputBound } from "@beep/repo-cli/internal/process"
 *
 * const bound = OutputBound.make({ maxChars: 4096, truncatedNotice: "\n[cli] truncated" })
 * console.log(bound.maxChars)
 * ```
 *
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
 * **Example** (Seed a fold accumulator)
 *
 * ```ts
 * import { BoundedOutput } from "@beep/repo-cli/internal/process"
 *
 * const state = BoundedOutput.make({ text: "captured", truncated: false })
 * console.log(state.truncated)
 * ```
 *
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
 * **Example** (Read a captured exit code)
 *
 * ```ts
 * import { CapturedStep } from "@beep/repo-cli/internal/process"
 *
 * const result = CapturedStep.make({ exitCode: 0, output: "ok", truncated: false })
 * console.log(result.exitCode)
 * ```
 *
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
 * **Example** (Read stdout without stderr noise)
 *
 * ```ts
 * import { CapturedStreams } from "@beep/repo-cli/internal/process"
 *
 * const result = CapturedStreams.make({ exitCode: 0, stdout: "out", stderr: "", truncated: false })
 * console.log(result.stdout)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapturedStreams extends S.Class<CapturedStreams>($I`CapturedStreams`)(
  {
    exitCode: S.Finite,
    stdout: S.String,
    stderr: S.String,
    truncated: S.Boolean,
  },
  $I.annote("CapturedStreams", {
    description:
      "Captured subprocess result with stdout and stderr kept separate, flagged when either stream hit the bound.",
  })
) {}

/**
 * Flake-quarantine policy a quality step may opt into.
 *
 * **Details**
 *
 * A policy names one established environment-only failure signature. When a
 * policy-carrying step fails and its captured output matches the signature,
 * the runner may rerun the failing scope standalone once and record the
 * incident as an environment flake instead of failing the group.
 *
 * **Example** (Narrow a policy literal)
 *
 * ```ts
 * import { StepFlakeQuarantinePolicy } from "@beep/repo-cli/internal/process"
 *
 * console.log(StepFlakeQuarantinePolicy.is["ts2589-no-location"]("ts2589-no-location"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StepFlakeQuarantinePolicy = LiteralKit(["ts2589-no-location"]).pipe(
  $I.annoteSchema("StepFlakeQuarantinePolicy", {
    description: "Named environment-only failure signature a quality step may quarantine on.",
  })
);

/**
 * Flake-quarantine policy a quality step may opt into.
 *
 * @category models
 * @since 0.0.0
 */
export type StepFlakeQuarantinePolicy = typeof StepFlakeQuarantinePolicy.Type;

/**
 * Planned subprocess invocation shared by repo-quality command families.
 *
 * **Details**
 *
 * This is the sanctioned home for the quality step model. Quality task
 * adapters, GitHub-check lanes, and operational helpers may still render their
 * own labels and errors, but they all describe child processes with this shape
 * so cross-group consumers do not deep-import `commands/Quality/Tasks`.
 *
 * **Example** (Plan a turbo check step)
 *
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
 *
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
    flakeQuarantine: S.optionalKey(StepFlakeQuarantinePolicy),
  },
  $I.annote("QualityTaskStep", {
    description: "Planned subprocess invocation shared by repo-quality command families.",
  })
) {}

/**
 * Empty bounded-output accumulator seed.
 *
 * **Example** (Start a fold from the untruncated seed)
 *
 * ```ts
 * import { emptyBoundedOutput } from "@beep/repo-cli/internal/process"
 *
 * console.log(emptyBoundedOutput.truncated)
 * ```
 *
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
 * **Example** (Read the repo-run character cap)
 *
 * ```ts
 * import { repoRunOutputBound } from "@beep/repo-cli/internal/process"
 *
 * console.log(repoRunOutputBound.maxChars)
 * ```
 *
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
 * **Example** (Read the grouped-step character cap)
 *
 * ```ts
 * import { qualityStepOutputBound } from "@beep/repo-cli/internal/process"
 *
 * console.log(qualityStepOutputBound.maxChars)
 * ```
 *
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
 * **Details**
 *
 * Once the accumulated text reaches the bound the reducer appends the bound's
 * truncation notice, flips `truncated`, and ignores every later chunk. Behavior
 * matches the hand-rolled `appendOutputChunk` folds it replaces.
 *
 * **Example** (Overflow a four-character bound)
 *
 * ```ts
 * import { boundedChunkReducer, emptyBoundedOutput, OutputBound } from "@beep/repo-cli/internal/process"
 *
 * const step = boundedChunkReducer(OutputBound.make({ maxChars: 4, truncatedNotice: "!" }))
 * console.log(step(emptyBoundedOutput, "abcdef"))
 * ```
 *
 * @param bound - Character cap and truncation notice to enforce.
 * @returns A fold step over `(state, chunk)`.
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
 * **Example** (Fold a byte stream under the repo-run bound)
 *
 * ```ts
 * import { collectBoundedText, repoRunOutputBound } from "@beep/repo-cli/internal/process"
 * import { Stream } from "effect"
 *
 * const fold = collectBoundedText(repoRunOutputBound)
 * console.log(fold(Stream.make(new TextEncoder().encode("hi"))))
 * ```
 *
 * @param bound - Character cap and truncation notice to enforce.
 * @returns A function folding a byte stream into a {@link BoundedOutput}.
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
 * **Details**
 *
 * Nothing caps the accumulator, so this suits streams whose size is known to be
 * small; use {@link collectBoundedText} wherever a subprocess can emit an
 * arbitrarily large log. It is the shared replacement for the group-private
 * `collectText` helpers that were duplicated across the command groups.
 *
 * **Example** (Collect a short stream in full)
 *
 * ```ts
 * import { collectText } from "@beep/repo-cli/internal/process"
 * import { Stream } from "effect"
 *
 * console.log(collectText(Stream.make(new TextEncoder().encode("hi"))))
 * ```
 *
 * @param stream - Byte stream to decode and concatenate.
 * @returns Effect yielding the accumulated text.
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
 * **Example** (Render a git invocation for an error message)
 *
 * ```ts
 * import { formatCommandLine } from "@beep/repo-cli/internal/process"
 *
 * console.log(formatCommandLine("git", ["status", "--short"]))
 * ```
 *
 * @param command - Executable name or path.
 * @param args - Command arguments.
 * @returns Space-joined command line.
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

/**
 * Defect raised when a capture pipe stays open after the child exited and its process group was
 * reaped — an escaped descendant (double-fork or `setsid` daemon) still holds the write end.
 *
 * @category errors
 * @since 0.0.0
 */
class CapturePipeWedgedError extends S.TaggedError<CapturePipeWedgedError>($I`CapturePipeWedgedError`)(
  "CapturePipeWedgedError",
  {
    commandLine: S.String,
    message: S.String,
  },
  $I.annote("CapturePipeWedgedError", {
    description:
      "Capture pipe still open after child exit and process-group reap; an escaped descendant holds the write end.",
  })
) {}

/** Grace for inherited-pipe stragglers to close the capture after the child exits, before its process group is reaped. */
const CAPTURE_DRAIN_GRACE: Duration.Input = "2 seconds";
/** Grace after the group reap for the kernel to deliver EOF before the capture is declared wedged. */
const CAPTURE_REAP_GRACE: Duration.Input = "3 seconds";

/**
 * Bounds a capture stream's lifetime to its child process.
 *
 * **Details**
 *
 * A capture completes only at pipe EOF, and EOF requires every inherited copy of the write end to
 * close — not just the direct child. A child that exits successfully gets no process-group cleanup
 * from the spawner (its cleanup is interrupt/nonzero-only), and the child's own success hard-exit
 * can orphan a grandchild that still holds the write end, leaving the fold waiting forever while
 * the lane sits silent (Lint Policy jobs 94646234791 and 95354812245: every policy step logged
 * done, then 29-40 minutes of nothing until job cleanup reaped the wedged wrapper chain). Spawns
 * are detached session leaders, so the CI runner's own `setsid` group reap cannot reach them
 * either. After the child exits, stragglers get a short drain grace; then the child's process
 * group is reaped so the kernel closes surviving write ends and the capture ends with its text
 * intact. A descendant that escaped the group too (double-fork or its own `setsid`) becomes a loud
 * defect naming the command instead of a silent hang. On the normal path the deadline is forked by
 * `Stream.interruptWhen` and interrupted the moment the stream ends — it costs nothing.
 */
const capturePipeDeadline = (
  handle: ChildProcessSpawner.ChildProcessHandle,
  commandLine: string
): Effect.Effect<never, PlatformError.PlatformError> =>
  handle.exitCode.pipe(
    Effect.andThen(Effect.sleep(CAPTURE_DRAIN_GRACE)),
    Effect.andThen(Effect.ignore(handle.kill({ forceKillAfter: "1 second" }))),
    Effect.andThen(Effect.sleep(CAPTURE_REAP_GRACE)),
    Effect.andThen(
      Effect.die(
        CapturePipeWedgedError.make({
          commandLine,
          message: `${commandLine}: capture pipe still open after child exit and process-group reap — an escaped descendant (double-fork or setsid daemon) still holds the write end`,
        })
      )
    )
  );

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
 * **Details**
 *
 * Nonzero exit codes are represented in the result; only spawn/stream failures
 * reach the `PlatformError` channel (map them to a domain error at the call
 * site). Set `bound` to cap the buffer, `trim` to trim the captured text, and
 * `tee` to stream chunks to the parent stdout while capturing. Stdin defaults
 * to `"ignore"` so noninteractive capture cannot inherit or leave an unread
 * pipe accidentally.
 *
 * **Example** (Capture a trimmed git status)
 *
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
 *
 * @param options - Command, spawn fields, and capture configuration.
 * @returns Captured combined output, exit code, and truncation flag.
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
        stdin: options.stdin ?? "ignore",
        stdout: "pipe",
        stderr: source === "stdout" ? "ignore" : "pipe",
      });
      const deadline = capturePipeDeadline(handle, formatCommandLine(options.command, options.args));
      const [captured, exitCode] = yield* Effect.all(
        [
          foldDecodedText(
            captureTextStream(handle, source).pipe(Stream.interruptWhen(deadline)),
            options.bound,
            options.tee ?? false
          ),
          handle.exitCode,
        ],
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
 * **Details**
 *
 * Used by call sites that need to keep the two streams apart (for example
 * distinct error excerpts, or structured stdout a parser reads while stderr
 * stays diagnostic). Nonzero exit codes are represented in the result, stdin
 * defaults to `"ignore"`, and `truncated` reports whether `bound` clipped
 * either stream.
 *
 * **Example** (Capture a version probe with streams kept apart)
 *
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
 *
 * @param options - Command, spawn fields, and capture configuration.
 * @returns Captured stdout, stderr, exit code, and truncation flag.
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
        stdin: options.stdin ?? "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      const deadline = capturePipeDeadline(handle, formatCommandLine(options.command, options.args));
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [
          foldDecodedText(decodedText(handle.stdout).pipe(Stream.interruptWhen(deadline)), options.bound, false),
          foldDecodedText(decodedText(handle.stderr).pipe(Stream.interruptWhen(deadline)), options.bound, false),
          handle.exitCode,
        ],
        { concurrency: "unbounded" }
      );
      return CapturedStreams.make({
        exitCode,
        stdout: options.trim === true ? Str.trim(stdout.text) : stdout.text,
        stderr: options.trim === true ? Str.trim(stderr.text) : stderr.text,
        truncated: stdout.truncated || stderr.truncated,
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
  /**
   * Escalate to `SIGKILL` this long after the scope closes and the child is
   * sent `SIGTERM`.
   *
   * Interrupting a `runToExit` closes the child's scope, which signals the
   * process group and then waits for the exit event. Without this, a child that
   * ignores `SIGTERM` makes that wait unbounded, so a caller-side timeout
   * cannot actually reclaim the process. Left `undefined`, behaviour is
   * unchanged.
   */
  readonly forceKillAfter?: Duration.Input | undefined;
};

/**
 * Spawn a command with inherited or ignored stdio and return its exit code.
 *
 * **Details**
 *
 * The `inherited-stdio` variant: nothing is captured, output flows straight to
 * the parent (or is discarded). Stdin defaults to the selected stdio mode.
 * Nonzero exit codes are returned, not raised.
 *
 * **Example** (Run an installer with inherited stdio)
 *
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
 *
 * @param options - Command, spawn fields, and stdio disposition.
 * @returns The subprocess exit code.
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
        ...(P.isUndefined(options.forceKillAfter) ? {} : { forceKillAfter: options.forceKillAfter }),
        stdin: options.stdin ?? options.stdio,
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
 * **Details**
 *
 * The `must-succeed` variant: thread a {@link CapturedStep} /
 * {@link CapturedStreams} (or any `{ exitCode }`) through this to turn a
 * nonzero exit into the command group's own error type.
 *
 * **Example** (Turn a nonzero git exit into a typed failure)
 *
 * ```ts
 * import { ensureZeroExit, runCaptured } from "@beep/repo-cli/internal/process"
 * import { Effect } from "effect"
 *
 * const proven = runCaptured({ command: "git", args: ["status"] }).pipe(
 *   Effect.flatMap(ensureZeroExit((exitCode) => new Error(`git failed (${exitCode})`)))
 * )
 * console.log(proven)
 * ```
 *
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
