import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as P from "effect/Predicate";
import { RunOptions } from "./Run.ts";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $ScratchpadId.create("effected/commands/ScriptedSpawner");

/** A pipeline reached a test double that only scripts standard commands. */
class ScriptedPipelineError extends S.TaggedError<ScriptedPipelineError>($I`ScriptedPipelineError`)(
	"ScriptedPipelineError",
	{ message: S.String },
	$I.annote("ScriptedPipelineError", { description: "A piped command reached the standard-command-only scripted spawner." }),
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
 * import { ScriptResult } from "@beep/scratchpad/effected/commands/ScriptedSpawner";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ScriptResult)({})) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ScriptResult = S.Union([
 S.instanceOf(PlatformError.PlatformError),
 S.Struct({
  stdout: S.optional(S.String).annotateKey({ description: "Scripted standard output." }),
  stderr: S.optional(S.String).annotateKey({ description: "Scripted standard error." }),
  exit: S.optional(S.declare(P.isNumber)).annotateKey({ description: "Scripted exit number, preserving the upstream domain." }),
  hang: S.optional(S.Boolean).annotateKey({ description: "Whether exitCode remains unresolved." }),
 }),
]).pipe($I.annoteSchema("ScriptResult", { description: "A scripted completed run or an opaque platform spawn failure." }));
/**
 * Decoded scripted spawn outcome.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ScriptResult = typeof ScriptResult.Type;

/**
 * The script a {@link ScriptedSpawner} answers spawns from: the executable and
 * argv in, a {@link ScriptResult} out.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type SpawnScript = (command: string, args: ReadonlyArray<string>) => ScriptResult;

/** Platform stream/sink carriers validate their runtime identity; generic channels remain opaque. */
const InputStream = S.declare<Stream.Stream<Uint8Array, PlatformError.PlatformError>>(
 (input): input is Stream.Stream<Uint8Array, PlatformError.PlatformError> => Stream.isStream(input),
).pipe($I.annoteSchema("InputStream", { description: "Opaque platform byte input stream." }));
const OutputSink = S.declare<Sink.Sink<Uint8Array, Uint8Array, never, PlatformError.PlatformError>>(
 (input): input is Sink.Sink<Uint8Array, Uint8Array, never, PlatformError.PlatformError> => Sink.isSink(input),
).pipe($I.annoteSchema("OutputSink", { description: "Opaque platform byte output sink." }));
const StdioMode = LiteralKit(["pipe", "inherit", "ignore", "overlapped"]).pipe(
 $I.annoteSchema("StdioMode", { description: "Platform standard-stream modes." }),
);
const CommandInput = S.Union([StdioMode, InputStream]).pipe($I.annoteSchema("CommandInput", { description: "Platform stdin carrier." }));
const CommandOutput = S.Union([StdioMode, OutputSink]).pipe($I.annoteSchema("CommandOutput", { description: "Platform stdout/stderr carrier." }));
const Encoding = LiteralKit(["ascii", "utf8", "utf-8", "utf16le", "utf-16le", "ucs2", "ucs-2", "base64", "base64url", "latin1", "binary", "hex"]).pipe(
 $I.annoteSchema("Encoding", { description: "Platform buffer encodings." }),
);
const Signal = LiteralKit(["SIGABRT", "SIGALRM", "SIGBUS", "SIGCHLD", "SIGCONT", "SIGFPE", "SIGHUP", "SIGILL", "SIGINT", "SIGIO", "SIGIOT", "SIGKILL", "SIGPIPE", "SIGPOLL", "SIGPROF", "SIGPWR", "SIGQUIT", "SIGSEGV", "SIGSTKFLT", "SIGSTOP", "SIGSYS", "SIGTERM", "SIGTRAP", "SIGTSTP", "SIGTTIN", "SIGTTOU", "SIGUNUSED", "SIGURG", "SIGUSR1", "SIGUSR2", "SIGVTALRM", "SIGWINCH", "SIGXCPU", "SIGXFSZ", "SIGBREAK", "SIGLOST", "SIGINFO"]).pipe(
 $I.annoteSchema("Signal", { description: "Platform process termination signals." }),
);
/** Mutable environment records match core CommandOptions rather than a readonly replacement. */
const Environment = S.Record(S.String, S.UndefinedOr(S.String)).pipe(
 $I.annoteSchema("Environment", { description: "Platform environment values, including explicitly undefined entries." }),
);
/** Validate all known platform options while retaining the original external object. */
const CommandOptions = S.Struct({
 killSignal: S.optional(Signal),
 forceKillAfter: RunOptions.fields.timeout,
 cwd: S.optional(S.String), env: S.optional(Environment), extendEnv: S.optional(S.Boolean),
 shell: S.optional(S.Union([S.Boolean, S.String])), detached: S.optional(S.Boolean), windowsHide: S.optional(S.Boolean),
 stdin: S.optional(S.Union([CommandInput, S.Struct({ stream: CommandInput, endOnDone: S.optional(S.Boolean), encoding: S.optional(Encoding) })])),
 stdout: S.optional(S.Union([CommandOutput, S.Struct({ stream: S.optional(CommandOutput) })])),
 stderr: S.optional(S.Union([CommandOutput, S.Struct({ stream: S.optional(CommandOutput) })])),
 additionalFds: S.optional(S.Record(S.TemplateLiteral(["fd", S.Finite]), S.Union([
  S.Struct({ type: S.Literal("input"), stream: S.optional(InputStream) }),
  S.Struct({ type: S.Literal("output"), sink: S.optional(OutputSink) }),
 ]))),
}).pipe(S.is, S.declare<ChildProcess.CommandOptions>, $I.annoteSchema("CommandOptions", { description: "Opaque complete platform command options checked against their known shape." }));

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
 * import { SpawnRecord } from "@beep/scratchpad/effected/commands/ScriptedSpawner";
 * import * as S from "effect/Schema";
 *
 * const record = { command: "git", args: [], cwd: undefined, env: undefined, extendEnv: undefined, options: {}, unrefed: false };
 * console.log(S.is(SpawnRecord)(record)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const SpawnRecord = S.Struct({
 /** The executable. */
 command: S.String.annotateKey({ description: "The spawned executable." }),
 /** The argv, exactly as spawned. */
 args: S.Array(S.String).annotateKey({ description: "Arguments exactly as spawned." }),
 /** The working directory, when set. */
 cwd: S.UndefinedOr(S.String).annotateKey({ description: "The working directory, when set." }),
 /** The environment, when set. */
 env: S.UndefinedOr(Environment).annotateKey({ description: "The environment, when set." }),
 /** Whether parent environment extension was requested. */
 extendEnv: S.UndefinedOr(S.Boolean).annotateKey({ description: "Whether parent environment extension was requested." }),
 /** The full options exactly as received. */
 options: CommandOptions.annotateKey({ description: "The complete platform command options." }),
 /** Set when the handle's unref effect actually runs. */
 unrefed: S.Boolean.annotateKey({ description: "Live state set when unref actually runs." }),
}).pipe($I.annoteSchema("SpawnRecord", { description: "An observed spawn with its full options and live unref state." }));
/**
 * Decoded spawn observation including live unref state.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SpawnRecord = typeof SpawnRecord.Type;

// Implementation of the byte streams a handle serves; one UTF-8 chunk.
const bytes = (text: string): Stream.Stream<Uint8Array, PlatformError.PlatformError> =>
	text === "" ? Stream.empty : Stream.make(new TextEncoder().encode(text));

// Implementation of ScriptedSpawner.notFound / permissionDenied.
const spawnError = (tag: "NotFound" | "PermissionDenied", command: string, code: string): PlatformError.PlatformError =>
	PlatformError.systemError({
		_tag: tag,
		module: "ChildProcess",
		method: "spawn",
		description: `spawn ${command} ${code}`,
	});

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
 * import { Run } from "@beep/scratchpad/effected/commands/Run";
 * import { ScriptedSpawner } from "@beep/scratchpad/effected/commands/ScriptedSpawner";
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
	 * import { Run } from "@beep/scratchpad/effected/commands/Run";
	 * import { ScriptedSpawner } from "@beep/scratchpad/effected/commands/ScriptedSpawner";
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
	 * import { Run } from "@beep/scratchpad/effected/commands/Run";
	 * import { ScriptedSpawner } from "@beep/scratchpad/effected/commands/ScriptedSpawner";
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
	 * import { ScriptedSpawner } from "@beep/scratchpad/effected/commands/ScriptedSpawner";
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
							message: "ScriptedSpawner scripts standard commands only — a piped command (ChildProcess.pipeTo) reached the spawner. Script each side separately, or run the pipeline e2e against a real platform layer.",
						}),
					);
				}
				return Effect.suspend(() => {
					const record = {
						command: command.command,
						args: command.args,
						cwd: command.options.cwd,
						env: command.options.env,
						extendEnv: command.options.extendEnv,
						options: command.options,
						unrefed: false,
					};
					spawns.push(record);
					const result = script(command.command, command.args);
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
						}),
					);
				});
			}),
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
	 * import { ScriptedSpawner } from "@beep/scratchpad/effected/commands/ScriptedSpawner";
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
	 * import { ScriptedSpawner } from "@beep/scratchpad/effected/commands/ScriptedSpawner";
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
