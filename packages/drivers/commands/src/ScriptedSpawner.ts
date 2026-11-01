/**
 * A scripted `ChildProcessSpawner` test double that answers commands from a
 * script and records every spawn.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CommandsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { ExitCode, RunOptions } from "./Run.ts";
import type * as CommandLine from "effect/process/CommandLine";
import type * as Types from "effect/Types";

const $I = $CommandsId.create("ScriptedSpawner");

/** A pipeline reached a test double that only scripts standard commands. */
class ScriptedPipelineError extends S.TaggedError<ScriptedPipelineError, { readonly brand: unique symbol }>(
  $I`ScriptedPipelineError`
)(
  "ScriptedPipelineError",
  { message: S.String },
  $I.annoteError<ScriptedPipelineError>("ScriptedPipelineError", {
    description: "A piped command reached the standard-command-only scripted spawner.",
  })
) {}

/**
 * One scripted completed run: optional output, exit code and hang flag.
 *
 * **Details**
 *
 * `stdout` and `stderr` default to empty and `exit` to `0`, so `{}` scripts a
 * silent success. `hang: true` makes the handle's `exitCode` never resolve.
 *
 * **Example** (Build a scripted completed run)
 *
 * ```ts
 * import { ScriptCompletion } from "@beep/commands/ScriptedSpawner";
 *
 * const completion = ScriptCompletion.make({ stdout: "ok", exit: 0 });
 * console.log(completion.stdout) // ok
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ScriptCompletion extends S.Opaque<ScriptCompletion, { readonly brand: unique symbol }>()(
  S.Struct({
    stdout: S.optionalKey(S.String).pipe(
      $I.annoteKey("ScriptCompletion.stdout", { description: "Scripted standard output." })
    ),
    stderr: S.optionalKey(S.String).pipe(
      $I.annoteKey("ScriptCompletion.stderr", { description: "Scripted standard error." })
    ),
    exit: S.optionalKey(ExitCode).pipe(
      $I.annoteKey("ScriptCompletion.exit", { description: "Scripted integer process exit code." })
    ),
    hang: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("ScriptCompletion.hang", { description: "Whether exitCode remains unresolved." })
    ),
  }).pipe(
    $I.annoteSchema("ScriptCompletion", {
      description: "A scripted completed run with optional output, exit code and hang flag.",
    })
  )
) {}

/**
 * One scripted outcome for a spawned command.
 *
 * **Details**
 *
 * A completed run is an object of optional fields — `stdout` and `stderr`
 * default to empty, `exit` to `0`, so `{}` scripts a silent success. Setting
 * `hang: true` makes the handle's `exitCode` never resolve, which exercises a
 * caller-supplied timeout (pair it with `TestClock` from `effect/testing`).
 * Returning a `PlatformError` instead fails the spawn itself — the shape of an
 * absent executable ({@link ScriptedSpawner.notFound}) or a permission failure
 * ({@link ScriptedSpawner.permissionDenied}).
 *
 * **Example** (Decode a silent success script)
 *
 * ```ts
 * import { ScriptResult } from "@beep/commands/ScriptedSpawner";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ScriptResult)({})) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ScriptResult = S.Union([S.instanceOf(PlatformError.PlatformError), ScriptCompletion]).pipe(
  $I.annoteSchema("ScriptResult", { description: "A scripted completed run or an opaque platform spawn failure." })
);
/**
 * Decoded scripted spawn outcome.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ScriptResult = typeof ScriptResult.Type;

/**
 * Type-level companions of {@link (ScriptResult:variable)}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScriptResult {
  /**
   * The plain shape a script returns: a `PlatformError`, or an object literal
   * of optional `stdout`, `stderr`, `exit` and `hang`.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ScriptResult.Encoded;
}

/**
 * The script a {@link ScriptedSpawner} answers spawns from: the executable and
 * argv in, the encoded side of a {@link ScriptResult} out.
 *
 * **Details**
 *
 * Scripts return plain object literals (`{ stdout: "ok\n" }`) or a
 * `PlatformError`; the encoded side of {@link ScriptResult} is exactly that
 * shape, so a script never has to call {@link ScriptCompletion.make}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type SpawnScript = (command: string, args: ReadonlyArray<string>) => ScriptResult.Encoded;

/** Platform stream/sink carriers validate their runtime identity; generic channels remain opaque. */
const InputStream = S.declare<Stream.Stream<Uint8Array, PlatformError.PlatformError>>(
  (input): input is Stream.Stream<Uint8Array, PlatformError.PlatformError> => Stream.isStream(input)
).pipe($I.annoteSchema("InputStream", { description: "Opaque platform byte input stream." }));
const OutputSink = S.declare<Sink.Sink<Uint8Array, Uint8Array, never, PlatformError.PlatformError>>(
  (input): input is Sink.Sink<Uint8Array, Uint8Array, never, PlatformError.PlatformError> => Sink.isSink(input)
).pipe($I.annoteSchema("OutputSink", { description: "Opaque platform byte output sink." }));
const StdioMode = LiteralKit(["pipe", "inherit", "ignore", "overlapped"]).pipe(
  $I.annoteSchema("StdioMode", { description: "Platform standard-stream modes." })
);
const CommandInput = S.Union([StdioMode, InputStream]).pipe(
  $I.annoteSchema("CommandInput", { description: "Platform stdin carrier." })
);
const CommandOutput = S.Union([StdioMode, OutputSink]).pipe(
  $I.annoteSchema("CommandOutput", { description: "Platform stdout/stderr carrier." })
);
const Encoding = LiteralKit([
  "ascii",
  "utf8",
  "utf-8",
  "utf16le",
  "utf-16le",
  "ucs2",
  "ucs-2",
  "base64",
  "base64url",
  "latin1",
  "binary",
  "hex",
]).pipe($I.annoteSchema("Encoding", { description: "Platform buffer encodings." }));
const Signal = LiteralKit([
  "SIGABRT",
  "SIGALRM",
  "SIGBUS",
  "SIGCHLD",
  "SIGCONT",
  "SIGFPE",
  "SIGHUP",
  "SIGILL",
  "SIGINT",
  "SIGIO",
  "SIGIOT",
  "SIGKILL",
  "SIGPIPE",
  "SIGPOLL",
  "SIGPROF",
  "SIGPWR",
  "SIGQUIT",
  "SIGSEGV",
  "SIGSTKFLT",
  "SIGSTOP",
  "SIGSYS",
  "SIGTERM",
  "SIGTRAP",
  "SIGTSTP",
  "SIGTTIN",
  "SIGTTOU",
  "SIGUNUSED",
  "SIGURG",
  "SIGUSR1",
  "SIGUSR2",
  "SIGVTALRM",
  "SIGWINCH",
  "SIGXCPU",
  "SIGXFSZ",
  "SIGBREAK",
  "SIGLOST",
  "SIGINFO",
]).pipe($I.annoteSchema("Signal", { description: "Platform process termination signals." }));
/** Mutable environment records match core CommandOptions rather than a readonly replacement. */
const Environment = S.Record(S.String, S.UndefinedOr(S.String)).pipe(
  $I.annoteSchema("Environment", {
    description: "Platform environment values, including explicitly undefined entries.",
  })
);
/** Core command environments may carry `Redacted` words, which the spawner unwraps before the child sees them. */
const CommandEnvironment = S.Record(S.String, S.UndefinedOr(S.Union([S.String, S.Redacted(S.String)]))).pipe(
  $I.annoteSchema("CommandEnvironment", {
    description: "Platform command environment values, including redacted and explicitly undefined entries.",
  })
);
const wordValue = (word: CommandLine.Word): string => (Redacted.isRedacted(word) ? Redacted.value(word) : word);
const envValue = (value: CommandLine.Word | undefined): string | undefined =>
  P.isUndefined(value) ? value : wordValue(value);
/** Core's numeric-template keys include whitespace and radix spellings, unlike Schema's numeric template matcher. */
const AdditionalFdKey = S.TemplateLiteral([
  "fd",
  S.String.check(
    S.isPattern(
      /^\s*(?:[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|0[xX][\da-fA-F]+|0[bB][01]+|0[oO][0-7]+|\s)\s*$/u,
      $I.annote("AdditionalFdNumber", {
        message: "Additional FD number",
        description: "A numeric-template spelling, including whitespace, radix prefixes and exponents.",
      })
    )
  ),
]).pipe(
  $I.annoteSchema("AdditionalFdKey", {
    description: "Core fd${number} option keys without narrowing their numeric spellings.",
  })
);
/** Validate all known platform options while retaining the original external object. */
const CommandOptions = S.Struct({
  killSignal: S.optionalKey(Signal),
  forceKillAfter: RunOptions.fields.timeout,
  cwd: S.optionalKey(S.String),
  env: S.optionalKey(CommandEnvironment),
  extendEnv: S.optionalKey(S.Boolean),
  shell: S.optionalKey(S.Union([S.Boolean, S.String])),
  detached: S.optionalKey(S.Boolean),
  windowsHide: S.optionalKey(S.Boolean),
  stdin: S.optionalKey(
    S.Union([
      CommandInput,
      S.Struct({ stream: CommandInput, endOnDone: S.optionalKey(S.Boolean), encoding: S.optionalKey(Encoding) }),
    ])
  ),
  stdout: S.optionalKey(S.Union([CommandOutput, S.Struct({ stream: S.optionalKey(CommandOutput) })])),
  stderr: S.optionalKey(S.Union([CommandOutput, S.Struct({ stream: S.optionalKey(CommandOutput) })])),
  additionalFds: S.optionalKey(
    S.Record(
      AdditionalFdKey,
      S.Union([
        S.Struct({ type: S.tag("input"), stream: S.optionalKey(InputStream) }),
        S.Struct({ type: S.tag("output"), sink: S.optionalKey(OutputSink) }),
      ])
    )
  ),
}).pipe(
  S.is,
  S.declare<ChildProcess.CommandOptions>,
  $I.annoteSchema("CommandOptions", {
    description: "Opaque complete platform command options checked against their known shape.",
  })
);

/**
 * What the scripted spawner observed for one spawn, in call order.
 *
 * **Details**
 *
 * `cwd`, `env` and `extendEnv` are conveniences lifted from `options`, which
 * carries the full `ChildProcess.CommandOptions` exactly as the spawner
 * received them. A spawn is recorded when it *runs* — a failed spawn (the
 * script returned a `PlatformError`) is still a record, which is what makes
 * probe-counting assertions honest.
 *
 * **Example** (Validate a recorded spawn)
 *
 * ```ts
 * import { SpawnRecord } from "@beep/commands/ScriptedSpawner";
 * import * as S from "effect/Schema";
 *
 * const record = { command: "git", args: [], cwd: undefined, env: undefined, extendEnv: undefined, options: {}, unrefed: false };
 * console.log(S.is(SpawnRecord)(record)) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SpawnRecord extends S.Opaque<SpawnRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The executable. */
    command: S.String.pipe($I.annoteKey("SpawnRecord.command", { description: "The spawned executable." })),
    /** The argv, exactly as spawned. */
    args: S.Array(S.String).pipe($I.annoteKey("SpawnRecord.args", { description: "Arguments exactly as spawned." })),
    /** The working directory, when set. */
    cwd: S.UndefinedOr(S.String).pipe(
      $I.annoteKey("SpawnRecord.cwd", { description: "The working directory, when set." })
    ),
    /** The environment, when set. */
    env: S.UndefinedOr(Environment).pipe(
      $I.annoteKey("SpawnRecord.env", { description: "The environment, when set." })
    ),
    /** Whether parent environment extension was requested. */
    extendEnv: S.UndefinedOr(S.Boolean).pipe(
      $I.annoteKey("SpawnRecord.extendEnv", { description: "Whether parent environment extension was requested." })
    ),
    /** The full options exactly as received. */
    options: CommandOptions.pipe(
      $I.annoteKey("SpawnRecord.options", { description: "The complete platform command options." })
    ),
    /** Set when the handle's unref effect actually runs. */
    unrefed: S.Boolean.pipe(
      $I.annoteKey("SpawnRecord.unrefed", { description: "Live state set when unref actually runs." })
    ),
  }).pipe(
    $I.annoteSchema("SpawnRecord", { description: "An observed spawn with its full options and live unref state." })
  )
) {}

// Implementation of the byte streams a handle serves; one UTF-8 chunk.
const bytes = (text: string): Stream.Stream<Uint8Array, PlatformError.PlatformError> =>
  text === "" ? Stream.empty : Stream.make(new TextEncoder().encode(text));

// Implementation of ScriptedSpawner.notFound / permissionDenied.
const spawnError: {
  (tag: "NotFound" | "PermissionDenied", command: string, code: string): PlatformError.PlatformError;
  (command: string, code: string): (tag: "NotFound" | "PermissionDenied") => PlatformError.PlatformError;
} = dual(
  3,
  (tag: "NotFound" | "PermissionDenied", command: string, code: string): PlatformError.PlatformError =>
    PlatformError.systemError({
      _tag: tag,
      module: "ChildProcess",
      method: "spawn",
      description: `spawn ${command} ${code}`,
    })
);

/**
 * A scripted `ChildProcessSpawner` test double: script each spawn's outcome,
 * read back what was spawned.
 *
 * **Details**
 *
 * `Run` is deliberately free functions over core's `ChildProcessSpawner` —
 * there is no runner service in this package to stub, so the seam a test
 * replaces is the spawner itself. Hand-scripting core's contract means
 * implementing every field of `ChildProcessSpawner.makeHandle` in every suite;
 * this double packages that once. It is the test-side analogue of `makeTest`
 * on a service: it implements nothing for production — it *provides* core's
 * own service, answering from the caller's script.
 *
 * Every recorder is `Effect.suspend`/`Effect.sync`-wrapped, so a spawn is
 * recorded when the effect RUNS, never when it is merely constructed — an
 * eager recorder reports calls that never happened.
 *
 * **Limitation:** only standard commands are scripted. A piped command
 * (`ChildProcess.pipeTo`) reaching the spawner dies with a clear message —
 * script each side separately, or run the pipeline e2e against a real
 * platform layer.
 *
 * **Example** (Script a Git revision lookup and inspect its spawn)
 *
 * ```ts
 * import { Run } from "@beep/commands/Run";
 * import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
 * import * as ChildProcess from "effect/process/ChildProcess";
 * import * as Effect from "effect/Effect";
 *
 *
 * const spawner = ScriptedSpawner.make(() => ({ stdout: "abc123\n" }));
 * const program = Run.text(ChildProcess.make("git", ["rev-parse", "HEAD"])).pipe(Effect.provide(spawner.layer));
 * const result = await Effect.runPromise(program);
 * console.log(`${result} ${spawner.spawns[0]?.command} ${spawner.spawns[0]?.args.join(" ")}`) // abc123 git rev-parse HEAD
 * ```
 *
 * @public
 * @category testing
 * @since 0.0.0
 */
export class ScriptedSpawner {
  /**
   * A Layer providing core's `ChildProcessSpawner`, answering from the script.
   *
   * **Example** (Provide the scripted spawner layer)
   *
   * ```ts
   * import { Run } from "@beep/commands/Run";
   * import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
   * import * as ChildProcess from "effect/process/ChildProcess";
   * import * as Effect from "effect/Effect";
   *
   *
   * const spawner = ScriptedSpawner.make(() => ({ stdout: "abc123\n" }));
   * const program = Run.text(ChildProcess.make("git", ["rev-parse", "HEAD"])).pipe(Effect.provide(spawner.layer));
   * const result = await Effect.runPromise(program);
   * console.log(`${result} ${spawner.spawns[0]?.command} ${spawner.spawns[0]?.args.join(" ")}`) // abc123 git rev-parse HEAD
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  readonly layer: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>;
  /**
   * The spawns observed so far, in call order. Reads live — assert after running.
   *
   * **Example** (Observe spawns after execution)
   *
   * ```ts
   * import { Run } from "@beep/commands/Run";
   * import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
   * import * as ChildProcess from "effect/process/ChildProcess";
   * import * as Effect from "effect/Effect";
   *
   *
   * const spawner = ScriptedSpawner.make(() => ({ stdout: "abc123\n" }));
   * const program = Run.text(ChildProcess.make("git", ["rev-parse", "HEAD"])).pipe(Effect.provide(spawner.layer));
   * const result = await Effect.runPromise(program);
   * console.log(`${result} ${spawner.spawns[0]?.command} ${spawner.spawns[0]?.args.join(" ")}`) // abc123 git rev-parse HEAD
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  readonly spawns: ReadonlyArray<SpawnRecord>;

  private constructor(layer: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>, spawns: ReadonlyArray<SpawnRecord>) {
    this.layer = layer;
    this.spawns = spawns;
  }

  /**
   * A scripted spawner: `script` receives the executable and argv of each
   * spawn and returns either a completed-run {@link ScriptResult} or a
   * `PlatformError` to fail the spawn with.
   *
   * **Details**
   *
   * The handle a completed run serves reports `pid` `4242`, `isRunning`
   * `false`, and drains `stdin`; `exitCode` resolves to the scripted `exit`
   * (or never, under `hang: true`). Running the handle's `unref` — as
   * `Run.detach` does — flips the record's `unrefed` flag.
   *
   * **Example** (Create a silent success spawner)
   *
   * ```ts
   * import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
   *
   * const spawner = ScriptedSpawner.make(() => ({}));
   * console.log(spawner.spawns.length) // 0
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make = (script: SpawnScript): ScriptedSpawner => {
    const spawns: Array<SpawnRecord> = [];
    const layer = Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) {
          return Effect.die(
            ScriptedPipelineError.make({
              message:
                "ScriptedSpawner scripts standard commands only — a piped command (ChildProcess.pipeTo) reached the spawner. Script each side separately, or run the pipeline e2e against a real platform layer.",
            })
          );
        }
        // A real spawner hands the child unwrapped values, so the record and the
        // script see the plain strings the process would receive.
        const args = A.map(command.args, wordValue);
        const env = P.isUndefined(command.options.env) ? undefined : R.map(command.options.env, envValue);
        return Effect.suspend(() => {
          // Mutable on purpose: `unrefed` is live state, flipped below when the
          // handle's unref effect runs.
          const record: Types.Mutable<SpawnRecord> = SpawnRecord.make({
            command: command.command,
            args,
            cwd: command.options.cwd,
            env,
            extendEnv: command.options.extendEnv,
            options: command.options,
            unrefed: false,
          });
          spawns.push(record);
          const result = script(command.command, args);
          if (result instanceof PlatformError.PlatformError) {
            return Effect.fail(result);
          }
          return Effect.succeed(
            ChildProcessSpawner.makeHandle({
              pid: ChildProcessSpawner.ProcessId(4242),
              exitCode:
                result.hang === true ? Effect.never : Effect.succeed(ChildProcessSpawner.ExitCode(result.exit ?? 0)),
              isRunning: Effect.succeed(false),
              kill: () => Effect.void,
              stdin: Sink.drain,
              stdout: bytes(result.stdout ?? ""),
              stderr: bytes(result.stderr ?? ""),
              all: bytes(`${result.stdout ?? ""}${result.stderr ?? ""}`),
              getInputFd: () => Sink.drain,
              getOutputFd: () => Stream.empty,
              // `unref` yields a Reref effect; the record flips when unref RUNS.
              unref: Effect.sync(() => {
                record.unrefed = true;
                return Effect.void;
              }),
            })
          );
        });
      })
    );
    return new ScriptedSpawner(layer, spawns);
  };

  /**
   * `PlatformError` for an executable that is not on PATH — the shape the
   * platform backend maps ENOENT to, and the shape `ToolDiscovery` classifies
   * as "absent".
   *
   * **Example** (Script an absent executable)
   *
   * ```ts
   * import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
   *
   * const error = ScriptedSpawner.notFound("tool");
   * console.log(error.reason._tag) // NotFound
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly notFound = (command: string): PlatformError.PlatformError =>
    spawnError("NotFound", command, "ENOENT");

  /**
   * `PlatformError` for a spawn that failed for a reason other than absence —
   * the tool exists but could not be run.
   *
   * **Example** (Script a permission failure)
   *
   * ```ts
   * import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
   *
   * const error = ScriptedSpawner.permissionDenied("tool");
   * console.log(error.reason._tag) // PermissionDenied
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly permissionDenied = (command: string): PlatformError.PlatformError =>
    spawnError("PermissionDenied", command, "EACCES");
}
