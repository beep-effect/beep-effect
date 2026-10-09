import { Effect, Layer, PlatformError, Sink, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

/**
 * One scripted outcome for a spawned `git` invocation: a completed run
 * (stdout/stderr/exit, or `hang: true` to never resolve `exitCode` — used to
 * exercise a per-run timeout), or a `PlatformError` to fail the spawn itself
 * with.
 */
export type ScriptResult =
	| { readonly stdout?: string; readonly stderr?: string; readonly exit?: number; readonly hang?: boolean }
	| PlatformError.PlatformError;

/**
 * A scripted mock `ChildProcessSpawner`. `byArgs` receives the argv of the
 * spawned command and returns either a completed-run script (stdout/stderr/
 * exit, optionally hanging) or a `PlatformError` to fail the spawn with.
 */
export const scripted = (byArgs: (args: ReadonlyArray<string>) => ScriptResult) =>
	Layer.succeed(
		ChildProcessSpawner.ChildProcessSpawner,
		ChildProcessSpawner.make((command) => {
			if (!ChildProcess.isStandardCommand(command)) {
				return Effect.die("piped commands not scripted");
			}
			const result = byArgs(command.args);
			if (result instanceof PlatformError.PlatformError) {
				return Effect.fail(result);
			}
			return Effect.succeed(
				ChildProcessSpawner.makeHandle({
					pid: ChildProcessSpawner.ProcessId(1),
					exitCode:
						result.hang === true ? Effect.never : Effect.succeed(ChildProcessSpawner.ExitCode(result.exit ?? 0)),
					isRunning: Effect.succeed(false),
					kill: () => Effect.void,
					stdin: Sink.drain,
					stdout: Stream.make(new TextEncoder().encode(result.stdout ?? "")),
					stderr: Stream.make(new TextEncoder().encode(result.stderr ?? "")),
					all: Stream.make(new TextEncoder().encode(result.stdout ?? "")),
					getInputFd: () => Sink.drain,
					getOutputFd: () => Stream.empty,
					unref: Effect.succeed(Effect.void),
				}),
			);
		}),
	);
