import type { Duration, Redacted } from "effect";
import { Effect, Function as Fn, PlatformError, Result, Schema, Stdio, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { OutputTooLarge, collectBounded } from "./internal/capture.ts";
import { REDACTED, Redaction } from "./Redaction.ts";

/**
 * Default ceiling on captured bytes per stream (16 MiB).
 *
 * @remarks
 * Collecting a child's output without a bound is a memory-exhaustion vector.
 * Output genuinely larger than this belongs on {@link Run.stream}, which never
 * accumulates.
 *
 * @public
 */
export const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

/** Characters shown from the tail of captured output in an error message. */
const MAX_MESSAGE_CHARS = 2000;

const JsonOutput = Schema.fromJsonString(Schema.Unknown);

/**
 * Policy for one run.
 *
 * @remarks
 * Deliberately narrow. Working directory, environment, stdin, shell mode and
 * kill signals are all `ChildProcess.CommandOptions` fields with core
 * combinators (`ChildProcess.setCwd`, `ChildProcess.setEnv`) — this package
 * consumes core's command vocabulary rather than re-declaring it. What remains
 * here is what a `Command` value cannot express. One caveat on that routing:
 * bare `ChildProcess.setEnv` replaces the child's WHOLE environment (it never
 * sets `extendEnv`, so the child loses `PATH` and `HOME`) — to add variables on
 * top of the parent environment, use `Run.extendEnv`.
 *
 * @public
 */
export interface RunOptions {
	/**
	 * Ceiling for the whole run.
	 *
	 * @remarks
	 * **There is no default.** A package-manager install and a `git rev-parse`
	 * cannot share one, so an unset `timeout` means no ceiling. When set, expiry
	 * closes the run's scope (killing the child) and fails with
	 * {@link CommandFailedError} of kind `"timeout"` rather than core's
	 * `TimeoutError`, so a caller's error channel stays this package's taxonomy.
	 */
	readonly timeout?: Duration.Input | undefined;
	/**
	 * Values scrubbed from captured output and from any error this run raises.
	 *
	 * @remarks
	 * Matching is by exact value, so a secret is removed wherever it appears —
	 * whichever flag carried it, and inside a larger string. The flag heuristic
	 * in {@link Redaction.scrubArgs} runs in addition, never instead.
	 */
	readonly redact?: ReadonlyArray<Redacted.Redacted<string>> | undefined;
	/** Per-stream captured-byte ceiling. Defaults to {@link DEFAULT_MAX_OUTPUT_BYTES}. */
	readonly maxOutputBytes?: number | undefined;
}

/**
 * What one completed run produced.
 *
 * @public
 */
export class CommandOutput extends Schema.Class<CommandOutput>("CommandOutput")({
	/** Captured standard output, redacted. */
	stdout: Schema.String,
	/** Captured standard error, redacted. */
	stderr: Schema.String,
	/** The process exit code. A non-zero value is NOT an error at this level. */
	exitCode: Schema.Finite,
}) {
	/** Whether the process exited zero. */
	get succeeded(): boolean {
		return this.exitCode === 0;
	}
}

/** The executable and argv an error should report for `command`. */
const describeCommand = (command: ChildProcess.Command): { command: string; args: ReadonlyArray<string> } => {
	if (ChildProcess.isStandardCommand(command)) {
		return { command: command.command, args: command.args };
	}
	const left = describeCommand(command.left);
	const right = describeCommand(command.right);
	// A pipeline has no single argv; report the shape so the message still names
	// what ran, with both sides' arguments dropped rather than merged.
	return { command: `${left.command} | ${right.command}`, args: [] };
};

/** argv as an error should store it: declared secrets removed, then the flag heuristic. */
const safeArgs = (
	args: ReadonlyArray<string>,
	secrets: ReadonlyArray<Redacted.Redacted<string>> | undefined,
): ReadonlyArray<string> => Redaction.scrubArgs(Redaction.applyArgs(args, secrets ?? []));

/** Captured text as an error should store it. */
const safeText = (text: string, secrets: ReadonlyArray<Redacted.Redacted<string>> | undefined): string =>
	Redaction.apply(text, secrets ?? []);

/** Tail-bounded rendering: tools write warnings first and the real error last. */
const tail = (text: string): string => {
	const trimmed = text.trim();
	if (trimmed.length <= MAX_MESSAGE_CHARS) return trimmed;
	return `...[${trimmed.length - MAX_MESSAGE_CHARS} chars truncated from head]...\n${trimmed.slice(-MAX_MESSAGE_CHARS)}`;
};

/**
 * A command that could not be run, or that ran and failed.
 *
 * @remarks
 * `kind` is the routing surface, never the message: `"nonZero"` (the process
 * ran and exited non-zero), `"spawn"` (it never started — the executable is
 * missing, or the platform refused), `"timeout"` (a caller-supplied ceiling
 * elapsed). Composed retry and fallback logic branches on `kind`; nothing in
 * this package asks a caller to match on prose.
 *
 * `args` is **always** stored redacted.
 *
 * @public
 */
export class CommandFailedError extends Schema.TaggedError<CommandFailedError>()("CommandFailedError", {
	/** Why it failed. */
	kind: Schema.Literals(["nonZero", "spawn", "timeout"]),
	/** The executable (or `"a | b"` for a pipeline). */
	command: Schema.String,
	/** argv, redacted. */
	args: Schema.Array(Schema.String),
	/** The exit code, when the process ran. */
	exitCode: Schema.optionalKey(Schema.Finite),
	/** Captured standard error, redacted, when the process ran. */
	stderr: Schema.optionalKey(Schema.String),
	/** Captured standard output, redacted, when the process ran. */
	stdout: Schema.optionalKey(Schema.String),
	/** The absorbed platform failure, for `"spawn"`. */
	cause: Schema.optionalKey(Schema.Defect()),
}) {
	/** The process ran and exited non-zero. */
	static readonly nonZero = (
		command: ChildProcess.Command,
		output: CommandOutput,
		secrets?: ReadonlyArray<Redacted.Redacted<string>> | undefined,
	): CommandFailedError => {
		const described = describeCommand(command);
		return CommandFailedError.make({
			kind: "nonZero",
			command: described.command,
			args: safeArgs(described.args, secrets),
			exitCode: output.exitCode,
			stderr: output.stderr,
			stdout: output.stdout,
		});
	};

	/** The process never started. */
	static readonly spawn = (
		command: ChildProcess.Command,
		cause: PlatformError.PlatformError,
		secrets?: ReadonlyArray<Redacted.Redacted<string>> | undefined,
	): CommandFailedError => {
		const described = describeCommand(command);
		return CommandFailedError.make({
			kind: "spawn",
			command: described.command,
			args: safeArgs(described.args, secrets),
			cause,
		});
	};

	/** A caller-supplied ceiling elapsed; the child was killed with its scope. */
	static readonly timedOut = (
		command: ChildProcess.Command,
		secrets?: ReadonlyArray<Redacted.Redacted<string>> | undefined,
	): CommandFailedError => {
		const described = describeCommand(command);
		return CommandFailedError.make({
			kind: "timeout",
			command: described.command,
			args: safeArgs(described.args, secrets),
		});
	};

	/**
	 * Whether this is a spawn failure caused by the executable not existing —
	 * the structural "tool is not installed" signal.
	 */
	get notFound(): boolean {
		return (
			this.kind === "spawn" &&
			this.cause instanceof PlatformError.PlatformError &&
			this.cause.reason._tag === "NotFound"
		);
	}

	/** Names the command and surfaces the tail of whichever stream carries the cause. */
	override get message(): string {
		const rendered = this.args.length > 0 ? `${this.command} ${this.args.join(" ")}` : this.command;
		const parts = [`Command "${rendered}" failed`];
		if (this.kind === "timeout") parts.push("(timed out)");
		if (this.exitCode !== undefined) parts.push(`(exit ${this.exitCode})`);
		// Prefer stderr; fall back to stdout, because npm and friends route real
		// errors there often enough that dropping it hides causes.
		const stderr = this.stderr?.trim();
		const stream = stderr !== undefined && stderr !== ""
			? this.stderr
			: (this.stdout?.trim() ?? "") !== "" ? this.stdout : undefined;
		if (stream !== undefined) parts.push(`:\n${tail(stream)}`);
		return parts.join(" ");
	}
}

/**
 * A command ran, but its output could not be used.
 *
 * @remarks
 * Separate from {@link CommandFailedError} because the process itself
 * succeeded: `"notJson"` (stdout is not JSON), `"schema"` (it is JSON but does
 * not decode), `"tooLarge"` (capture exceeded its byte budget). Keeping the two
 * distinguishable is the point — a schema drift and a crashed tool call for
 * different responses.
 *
 * The context fields (`exitCode`, `stderr`, `stdout`) are populated by
 * {@link Run.jsonLine}, whose payload framing parses regardless of exit code —
 * when no payload arrives, the exit code and captured streams are the only
 * evidence of what actually went wrong. Both streams are **always** stored
 * redacted.
 *
 * @public
 */
export class CommandOutputError extends Schema.TaggedError<CommandOutputError>()("CommandOutputError", {
	/** Which way the output was unusable. */
	kind: Schema.Literals(["notJson", "schema", "tooLarge"]),
	/** The executable that produced it. */
	command: Schema.String,
	/** The underlying parse or decode failure. */
	cause: Schema.optionalKey(Schema.Defect()),
	/** The exit code, when the combinator parses independently of it. */
	exitCode: Schema.optionalKey(Schema.Finite),
	/** Captured standard error, redacted, when the process ran. */
	stderr: Schema.optionalKey(Schema.String),
	/** Captured standard output, redacted, when the process ran. */
	stdout: Schema.optionalKey(Schema.String),
}) {
	override get message(): string {
		const parts: Array<string> = [];
		if (this.kind === "notJson") {
			parts.push(`Command "${this.command}" did not produce JSON`);
		} else if (this.kind === "schema") {
			parts.push(`Command "${this.command}" produced JSON that did not match the expected schema`);
		} else {
			parts.push(`Command "${this.command}" produced more output than the configured limit`);
		}
		if (this.exitCode !== undefined) parts.push(`(exit ${this.exitCode})`);
		if (this.stderr !== undefined && this.stderr.trim().length > 0) parts.push(`:\n${tail(this.stderr)}`);
		return parts.join(" ");
	}
}

/** Spawns, collects both streams concurrently, and awaits exit. */
const collectRaw = (
	command: ChildProcess.Command,
	options: RunOptions | undefined,
	tee: Stdio.Stdio | undefined,
): Effect.Effect<
	CommandOutput,
	PlatformError.PlatformError | OutputTooLarge,
	ChildProcessSpawner.ChildProcessSpawner
> =>
	Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const handle = yield* spawner.spawn(command);
			const limit = options?.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
			const out = tee === undefined ? handle.stdout : Stream.tapSink(handle.stdout, tee.stdout());
			const err = tee === undefined ? handle.stderr : Stream.tapSink(handle.stderr, tee.stderr());
			// { concurrency: "unbounded" } is load-bearing, not a style choice:
			// reading these sequentially deadlocks the moment either OS pipe
			// buffer fills — the child blocks writing to a full pipe while the
			// reader that would drain it is still waiting on the other stream.
			const [stdout, stderr, exitCode] = yield* Effect.all(
				[collectBounded(out, limit), collectBounded(err, limit), handle.exitCode],
				{ concurrency: "unbounded" },
			);
			const secrets = options?.redact;
			return CommandOutput.make({
				stdout: safeText(stdout, secrets),
				stderr: safeText(stderr, secrets),
				exitCode: Number(exitCode),
			});
		}),
	);

/** Maps the raw failure modes onto this package's taxonomy, and applies any ceiling. */
const collectClassified = (
	command: ChildProcess.Command,
	options: RunOptions | undefined,
	tee: Stdio.Stdio | undefined,
): Effect.Effect<CommandOutput, CommandFailedError | CommandOutputError, ChildProcessSpawner.ChildProcessSpawner> => {
	const described = describeCommand(command);
	const classified = collectRaw(command, options, tee).pipe(
		Effect.mapError((error) =>
			error instanceof OutputTooLarge
				? CommandOutputError.make({ kind: "tooLarge", command: described.command, cause: error })
				: CommandFailedError.spawn(command, error, options?.redact),
		),
	);
	return options?.timeout === undefined
		? classified
		: Effect.timeoutOrElse(classified, {
				duration: options.timeout,
				orElse: () => Effect.fail(CommandFailedError.timedOut(command, options.redact)),
			});
};

/** Fails a run whose process exited non-zero. */
const requireZero = (
	command: ChildProcess.Command,
	output: CommandOutput,
	options: RunOptions | undefined,
): Effect.Effect<CommandOutput, CommandFailedError> =>
	output.succeeded ? Effect.succeed(output) : Effect.fail(CommandFailedError.nonZero(command, output, options?.redact));

/** Span attributes: what ran and how many arguments — never the arguments. */
const annotate = (command: ChildProcess.Command): Effect.Effect<void> => {
	const described = describeCommand(command);
	return Effect.annotateCurrentSpan({ command: described.command, argc: described.args.length });
};

// Implementation of Run.collect; the public contract lives on the static.
const collect = Effect.fn("Run.collect")(function* (command: ChildProcess.Command, options?: RunOptions) {
	yield* annotate(command);
	return yield* collectClassified(command, options, undefined);
});

// Implementation of Run.collectTee; the public contract lives on the static.
const collectTee = Effect.fn("Run.collectTee")(function* (command: ChildProcess.Command, options?: RunOptions) {
	yield* annotate(command);
	const stdio = yield* Stdio.Stdio;
	return yield* collectClassified(command, options, stdio);
});

// Implementation of Run.text; the public contract lives on the static.
const text = Effect.fn("Run.text")(function* (command: ChildProcess.Command, options?: RunOptions) {
	yield* annotate(command);
	const output = yield* collectClassified(command, options, undefined);
	const checked = yield* requireZero(command, output, options);
	return checked.stdout.trim();
});

// Implementation of Run.lines; the public contract lives on the static.
const lines = Effect.fn("Run.lines")(function* (command: ChildProcess.Command, options?: RunOptions) {
	yield* annotate(command);
	const output = yield* collectClassified(command, options, undefined);
	const checked = yield* requireZero(command, output, options);
	return checked.stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
});

// Implementation of Run.json; the public contract lives on the static.
const json = Effect.fn("Run.json")(function* <A, I>(
	command: ChildProcess.Command,
	schema: Schema.Codec<A, I>,
	options?: RunOptions,
) {
	yield* annotate(command);
	const described = describeCommand(command);
	const output = yield* collectClassified(command, options, undefined);
	const checked = yield* requireZero(command, output, options);
	const parsed = yield* Schema.decodeEffect(JsonOutput)(checked.stdout).pipe(
		Effect.mapError((cause) => CommandOutputError.make({ kind: "notJson", command: described.command, cause })),
	);
	return yield* Schema.decodeUnknownEffect(schema)(parsed).pipe(
		Effect.mapError((cause) => CommandOutputError.make({ kind: "schema", command: described.command, cause })),
	);
});

// Implementation of Run.jsonLine; the public contract lives on the static.
const jsonLine = Effect.fn("Run.jsonLine")(function* <A, I>(
	command: ChildProcess.Command,
	schema: Schema.Codec<A, I>,
	options?: RunOptions,
) {
	yield* annotate(command);
	const described = describeCommand(command);
	const output = yield* collectClassified(command, options, undefined);
	// The run's context travels on every output error: when the payload line is
	// missing or unusable, the exit code and captured streams (already redacted
	// by collectClassified) are the only evidence of what actually went wrong.
	const context = { exitCode: output.exitCode, stderr: output.stderr, stdout: output.stdout };
	const candidates = output.stdout.split(/\r?\n/).filter((candidate) => candidate.trim().length > 0);
	if (candidates.length === 0) {
		return yield* CommandOutputError.make({
				kind: "notJson",
				command: described.command,
				cause: new Error("stdout carried no non-empty line"),
				...context,
			});
	}
	// Scan from the END: the first candidate that both JSON-parses and decodes
	// under the schema is the payload. The near-miss diagnostics below record
	// the FIRST failure of each kind encountered by the scan — i.e. the LAST
	// non-empty line's parse error and the LAST parseable line's decode issue —
	// because the line nearest the end is the most probable intended payload.
	let notJsonCause: unknown;
	let schemaCause: unknown;
	for (let index = candidates.length - 1; index >= 0; index--) {
		const candidate = candidates[index];
		if (candidate === undefined) continue;
		const parsed = yield* Effect.result(Schema.decodeEffect(JsonOutput)(candidate));
		if (Result.isFailure(parsed)) {
			notJsonCause ??= parsed.failure;
			continue;
		}
		const decoded = yield* Effect.result(Schema.decodeUnknownEffect(schema)(parsed.success));
		if (Result.isSuccess(decoded)) return decoded.success;
		schemaCause ??= decoded.failure;
	}
	// Nothing decoded anywhere. When at least one line parsed as JSON, the
	// near-miss is a schema drift — report kind "schema" with the last
	// parseable line's decode failure; otherwise nothing was JSON at all.
	return yield* schemaCause !== undefined
			? CommandOutputError.make({ kind: "schema", command: described.command, cause: schemaCause, ...context })
			: CommandOutputError.make({ kind: "notJson", command: described.command, cause: notJsonCause, ...context });
});

// Implementation of Run.exitCode; the public contract lives on the static.
const exitCode = Effect.fn("Run.exitCode")(function* (command: ChildProcess.Command, options?: RunOptions) {
	yield* annotate(command);
	const output = yield* collectClassified(command, options, undefined);
	return output.exitCode;
});

// Implementation of Run.succeeds; the public contract lives on the static.
const succeeds = Effect.fn("Run.succeeds")(function* (command: ChildProcess.Command, options?: RunOptions) {
	yield* annotate(command);
	return yield* collectClassified(command, options, undefined).pipe(
		Effect.map((output) => output.succeeded),
		Effect.orElseSucceed(() => false),
	);
});

// Implementation of Run.detach; the public contract lives on the static.
const detach = Effect.fn("Run.detach")(function* (command: ChildProcess.Command) {
	yield* annotate(command);
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const handle = yield* spawner.spawn(command);
			// Order is the whole point of this helper: the Node backend's release
			// checks an `isReferenced` flag and does NOT kill an unref'd child, so
			// unref must run BEFORE this scope closes. Reversed, the child dies
			// with the scope and nothing outlives the process.
				yield* Effect.asVoid(handle.unref);
			return handle.pid;
		}),
	).pipe(Effect.mapError((error) => CommandFailedError.spawn(command, error)));
});

// Implementation of Run.stream; the public contract lives on the static.
const stream = (
	command: ChildProcess.Command,
	options?: { readonly includeStderr?: boolean | undefined },
): Stream.Stream<string, CommandFailedError, ChildProcessSpawner.ChildProcessSpawner> =>
	Stream.unwrap(
		Effect.map(ChildProcessSpawner.ChildProcessSpawner, (spawner) =>
			spawner.streamLines(command, { includeStderr: options?.includeStderr ?? false }),
		),
	).pipe(Stream.mapError((error) => CommandFailedError.spawn(command, error)));

// Implementation of Run.extendEnv; the public contract lives on the static.
const extendEnv: {
	(env: Record<string, string>): (self: ChildProcess.Command) => ChildProcess.Command;
	(self: ChildProcess.Command, env: Record<string, string>): ChildProcess.Command;
} = Fn.dual(2, (self: ChildProcess.Command, env: Record<string, string>): ChildProcess.Command => {
	if (ChildProcess.isStandardCommand(self)) {
		const merged = self.options.env === undefined ? env : { ...self.options.env, ...env };
		return ChildProcess.make(self.command, self.args, { ...self.options, env: merged, extendEnv: true });
	}
	return ChildProcess.pipeTo(extendEnv(self.left, env), extendEnv(self.right, env), self.options);
});

/**
 * Structured running of core `ChildProcess.Command` values.
 *
 * @remarks
 * These are free functions over core's contract, **not** a service: core's
 * `ChildProcessSpawner` already is the subprocess service, and wrapping it in a
 * second one is the re-declaration this package exists not to repeat. Tests
 * script the spawner with {@link ScriptedSpawner}, not these.
 *
 * A non-zero exit is a *result* for {@link Run.collect}, {@link Run.exitCode},
 * {@link Run.succeeds} and {@link Run.jsonLine}, and a typed *failure* for
 * {@link Run.text}, {@link Run.lines} and {@link Run.json} — the split is
 * deliberate, matching core (where a non-zero exit is a success) at the
 * reporting level while giving the interpreting helpers the ergonomics callers
 * actually want.
 *
 * The interpreting helpers also **trim**: {@link Run.text} strips leading and
 * trailing whitespace from the whole result — not just a trailing newline —
 * and {@link Run.lines} trims each line. Fixed-column output whose first
 * column can be whitespace (`git status --porcelain`) silently loses that
 * column through either, producing plausible wrong values rather than an
 * error. Parse that kind of output from the untrimmed `stdout` of
 * {@link Run.collect}'s {@link CommandOutput} instead.
 *
 * @example
 * ```ts
 * import { Run } from "./index.ts";
 * import { NodeServices } from "@effect/platform-node";
 * import { Effect } from "effect";
 * import { ChildProcess } from "effect/process";
 *
 * const program = Effect.gen(function* () {
 *   const sha = yield* Run.text(ChildProcess.make("git", ["rev-parse", "HEAD"]), { timeout: "10 seconds" });
 *   const clean = yield* Run.succeeds(ChildProcess.make("git", ["diff", "--quiet"]));
 *   return { sha, clean };
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer)));
 * ```
 *
 * @public
 */
export class Run {
	private constructor() {}

	/**
	 * Spawns `command`, collects stdout and stderr concurrently, and resolves
	 * with the {@link CommandOutput} once the process exits.
	 *
	 * @remarks
	 * A non-zero exit is a *result* here, not a failure — see {@link Run}'s
	 * remarks for the split against {@link Run.text}, {@link Run.lines} and
	 * {@link Run.json}.
	 *
	 * The error union is honest but wider than any one configuration can fire:
	 * which arms are reachable depends on the options passed. For a call with
	 * no options, exactly two failure modes exist —
	 *
	 * - {@link CommandFailedError} of kind `"spawn"`: the process never started
	 *   (executable missing, platform refused), **or** the platform failed while
	 *   reading a stream or awaiting the exit — this arm absorbs every
	 *   `PlatformError`, not only spawn-time ones.
	 * - {@link CommandOutputError} of kind `"tooLarge"`: captured output
	 *   exceeded {@link RunOptions.maxOutputBytes} (default
	 *   {@link DEFAULT_MAX_OUTPUT_BYTES}).
	 *
	 * Setting {@link RunOptions.timeout} adds a third arm: kind `"timeout"`.
	 * No configuration makes this combinator fail with kind `"nonZero"` — a
	 * non-zero exit is a result — and kinds `"notJson"` / `"schema"` are
	 * exclusive to {@link Run.json} and {@link Run.jsonLine}. A catch written
	 * against an unconfigured call therefore needs only the two arms above;
	 * handling the full union there is defensive, not required.
	 */
	static readonly collect = collect;

	/**
	 * Like {@link Run.collect}, but also tees each stream to the `Stdio` in `R`
	 * as it arrives, for a caller that wants live output alongside the captured
	 * {@link CommandOutput}.
	 *
	 * @remarks
	 * Reachability of the error arms is exactly {@link Run.collect}'s, but the
	 * tee adds a second *source* for kind `"spawn"`: a failing `Stdio` sink
	 * (EPIPE when the host's own stdout is a closed pipe) is classified there
	 * too, even though the child started and ran.
	 */
	static readonly collectTee = collectTee;

	/**
	 * Runs `command` and resolves with trimmed stdout on a zero exit.
	 *
	 * @remarks
	 * A non-zero exit is a typed failure here — {@link CommandFailedError} —
	 * unlike {@link Run.collect}, {@link Run.exitCode} and {@link Run.succeeds},
	 * which treat it as a result.
	 *
	 * The trim strips **leading and trailing whitespace**, not just the trailing
	 * newline. For parse-sensitive output where leading whitespace is data
	 * (`git status --porcelain`, whose first entry's status column it would
	 * silently eat), use {@link Run.collect} and read its {@link CommandOutput}'s
	 * untrimmed `stdout` instead.
	 */
	static readonly text = text;

	/**
	 * Runs `command` and resolves with stdout split into trimmed, non-empty
	 * lines on a zero exit.
	 *
	 * @remarks
	 * A non-zero exit is a typed failure here — {@link CommandFailedError} —
	 * matching {@link Run.text} and {@link Run.json}.
	 */
	static readonly lines = lines;

	/**
	 * Runs `command`, parses stdout as JSON and decodes it against `schema` on
	 * a zero exit.
	 *
	 * @remarks
	 * Fails with {@link CommandOutputError} when stdout is not JSON or does not
	 * decode; a non-zero exit fails with {@link CommandFailedError}, matching
	 * {@link Run.text} and {@link Run.lines}.
	 *
	 * This parses the **whole** of stdout and requires a zero exit. For a
	 * protocol payload located by scanning stdout lines from the end — tolerant
	 * of noise around it and of a non-zero exit — use {@link Run.jsonLine}
	 * instead.
	 */
	static readonly json = json;

	/**
	 * Runs `command` and, **scanning stdout lines from the end**, resolves with
	 * the first line that both parses as JSON and decodes against `schema` —
	 * the framing variant of {@link Run.json}, for a child that reports through
	 * a single JSON protocol payload near the end of its output.
	 *
	 * @remarks
	 * The framing tolerates noise on **both sides** of the payload: noise before
	 * it (a subprocess-loaded hook's own `console.log`, a tool's warnings) and
	 * noise after it (a hook logging from `process.on("exit", ...)` fires after
	 * the payload has flushed). Lines are split on
	 * `\r?\n`, whitespace-only lines are dropped, and the scan runs from the last
	 * line backwards until one decodes. The tolerance is positional, not
	 * volumetric: the whole of stdout is still captured under
	 * {@link RunOptions.maxOutputBytes} (default
	 * {@link DEFAULT_MAX_OUTPUT_BYTES}, 16 MiB), so a child whose noise exceeds
	 * the ceiling fails typed as `"tooLarge"` before any line is examined —
	 * raise the ceiling for a child known to be loud in volume.
	 *
	 * The scan's consequence: when **multiple** lines decode under `schema`, the
	 * **last** one wins. A child must therefore never emit two schema-valid
	 * lines, and a consumer schema should be shaped so an accidental log line
	 * cannot satisfy it — a discriminated envelope with a required literal field
	 * (`ok: true | false`, the shape `@effected/workspaces`' `ReplayPayload`
	 * uses) rather than a permissive record a stray `console.log(someObject)`
	 * might match.
	 *
	 * Unlike {@link Run.json}, this parses **regardless of the exit code** — a
	 * deliberate posture, not an oversight. A protocol payload discriminates
	 * success in-band (its own `ok` field, its own error shape), so the payload
	 * outranks the exit code: a child that crashes *after* flushing its payload
	 * still reported, and a caller that wants exit-code semantics has
	 * {@link Run.json}. When no line decodes anywhere, the typed
	 * {@link CommandOutputError} carries the exit code and both captured streams
	 * (redacted) as context, so the failure is diagnosable without re-running.
	 * Its `kind` preserves the near-miss diagnostic: `"schema"` when at least
	 * one line parsed as JSON but none decoded — with the **last parseable
	 * line's** decode failure as `cause`, that line being the most probable
	 * intended payload — and `"notJson"` only when no non-empty line was JSON at
	 * all (carrying the last non-empty line's parse error). A spawn failure or
	 * an opted-in timeout still fails with {@link CommandFailedError}.
	 */
	static readonly jsonLine = jsonLine;

	/**
	 * Runs `command` and resolves with its exit code alone.
	 *
	 * @remarks
	 * A non-zero exit is a *result* here, not a failure — see {@link Run}'s
	 * remarks for the split against {@link Run.text}, {@link Run.lines} and
	 * {@link Run.json}.
	 */
	static readonly exitCode = exitCode;

	/**
	 * Runs `command` and resolves with whether it exited zero, collapsing a
	 * spawn or other classified failure to `false` rather than propagating it.
	 */
	static readonly succeeds = succeeds;

	/** Decoded stdout lines as they arrive, for output too large or too long-lived to collect. */
	static readonly stream = stream;

	/**
	 * Spawns `command` and resolves with its pid without waiting for exit.
	 *
	 * @remarks
	 * Unrefs the child **before** this scope closes, so it survives the
	 * caller's scope closing — the Node backend's release skips the kill for an
	 * unref'd child, and reversing that order kills it with the scope instead.
	 * Fails with {@link CommandFailedError} if the process never starts.
	 */
	static readonly detach = detach;

	/**
	 * Adds environment variables to a command WITHOUT losing the parent
	 * environment: merges `env` over any existing command environment (new values
	 * win, matching core's `ChildProcess.setEnv`) and sets `extendEnv: true`.
	 *
	 * @remarks
	 * This combinator exists because of a core trap: `ChildProcess.setEnv` merges
	 * into `options.env` but never sets `extendEnv`, and the Node spawner resolves
	 * the child environment as `extendEnv ? { ...process.env, ...env } : env` — so
	 * a command built with bare `setEnv({ SOME_VAR: x })` spawns a child whose
	 * ENTIRE environment is that one variable: no `PATH`, no `HOME`. The failure is
	 * silent at the type level and surfaces as "spawned tool cannot find its own
	 * binary" at runtime.
	 *
	 * Deliberately forces `extendEnv: true` even where construction set it `false`
	 * — inheriting the parent environment is this combinator's entire purpose. A
	 * caller who wants a hermetic environment uses core's `setEnv` or construction
	 * options (`ChildProcess.make(cmd, args, { env, extendEnv: false })`) directly.
	 *
	 * For a pipeline, applies to every command in the pipeline (mirroring core's
	 * `setEnv`), preserving the pipe's own options. Composes core's public
	 * vocabulary (`ChildProcess.make`, `ChildProcess.pipeTo`) — it re-declares
	 * nothing.
	 */
	static readonly extendEnv = extendEnv;

	/** Default ceiling on captured bytes per stream. See {@link DEFAULT_MAX_OUTPUT_BYTES}. */
	static readonly DEFAULT_MAX_OUTPUT_BYTES = DEFAULT_MAX_OUTPUT_BYTES;

	/** The placeholder written in place of a redacted secret. See {@link REDACTED}. */
	static readonly REDACTED = REDACTED;
}
