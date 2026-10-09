import { Effect, Layer, PlatformError, Sink, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

/**
 * One scripted outcome for a spawned command.
 *
 * @remarks
 * A completed run is an object of optional fields — `stdout` and `stderr`
 * default to empty, `exit` to `0`, so `{}` scripts a silent success. Setting
 * `hang: true` makes the handle's `exitCode` never resolve, which exercises a
 * caller-supplied timeout (pair it with `TestClock` from `effect/testing`).
 * Returning a `PlatformError` instead fails the spawn itself — the shape of an
 * absent executable ({@link ScriptedSpawner.notFound}) or a permission failure
 * ({@link ScriptedSpawner.permissionDenied}).
 *
 * @public
 */
export type ScriptResult =
	| { readonly stdout?: string; readonly stderr?: string; readonly exit?: number; readonly hang?: boolean }
	| PlatformError.PlatformError;

/**
 * The script a {@link ScriptedSpawner} answers spawns from: the executable and
 * argv in, a {@link ScriptResult} out.
 *
 * @public
 */
export type SpawnScript = (command: string, args: ReadonlyArray<string>) => ScriptResult;

/**
 * What the scripted spawner observed for one spawn, in call order.
 *
 * @remarks
 * `cwd`, `env` and `extendEnv` are conveniences lifted from `options`, which
 * carries the full `ChildProcess.CommandOptions` exactly as the spawner
 * received them. A spawn is recorded when it *runs* — a failed spawn (the
 * script returned a `PlatformError`) is still a record, which is what makes
 * probe-counting assertions honest.
 *
 * @public
 */
export interface SpawnRecord {
	/** The executable. */
	readonly command: string;
	/** The argv, exactly as spawned. */
	readonly args: ReadonlyArray<string>;
	/** `options.cwd`, when one was set. */
	readonly cwd: string | undefined;
	/** `options.env`, when one was set. */
	readonly env: Record<string, string | undefined> | undefined;
	/** `options.extendEnv`, when one was set. */
	readonly extendEnv: boolean | undefined;
	/** The full `ChildProcess.CommandOptions` as the spawner received them. */
	readonly options: ChildProcess.CommandOptions;
	/** Set when the handle's `unref` effect actually RAN (not merely was built). */
	readonly unrefed: boolean;
}

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
 * @remarks
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
 * @example
 * ```ts
 * import { Run, ScriptedSpawner } from "./index.ts";
 * import { Effect } from "effect";
 * import { ChildProcess } from "effect/process";
 *
 * // One call scripts the whole spawner contract:
 * const spawner = ScriptedSpawner.make((command, args) =>
 *   command === "git" ? { stdout: "abc123\n" } : ScriptedSpawner.notFound(command),
 * );
 *
 * const program = Run.text(ChildProcess.make("git", ["rev-parse", "HEAD"])).pipe(
 *   Effect.provide(spawner.layer),
 * );
 *
 * const sha = await Effect.runPromise(program); // "abc123"
 * // spawner.spawns[0]?.command === "git"
 * // spawner.spawns[0]?.args     — ["rev-parse", "HEAD"]
 * ```
 *
 * @public
 */
export class ScriptedSpawner {
	/** A Layer providing core's `ChildProcessSpawner`, answering from the script. */
	readonly layer: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>;
	/** The spawns observed so far, in call order. Reads live — assert after running. */
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
	 * @remarks
	 * The handle a completed run serves reports `pid` `4242`, `isRunning`
	 * `false`, and drains `stdin`; `exitCode` resolves to the scripted `exit`
	 * (or never, under `hang: true`). Running the handle's `unref` — as
	 * `Run.detach` does — flips the record's `unrefed` flag.
	 */
	static readonly make = (script: SpawnScript): ScriptedSpawner => {
		const spawns: Array<SpawnRecord> = [];
		const layer = Layer.succeed(
			ChildProcessSpawner.ChildProcessSpawner,
			ChildProcessSpawner.make((command) => {
				if (!ChildProcess.isStandardCommand(command)) {
					return Effect.die(
						new Error(
							"ScriptedSpawner scripts standard commands only — a piped command (ChildProcess.pipeTo) reached the spawner. Script each side separately, or run the pipeline e2e against a real platform layer.",
						),
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
	 */
	static readonly notFound = (command: string): PlatformError.PlatformError =>
		spawnError("NotFound", command, "ENOENT");

	/**
	 * `PlatformError` for a spawn that failed for a reason other than absence —
	 * the tool exists but could not be run.
	 */
	static readonly permissionDenied = (command: string): PlatformError.PlatformError =>
		spawnError("PermissionDenied", command, "EACCES");
}
