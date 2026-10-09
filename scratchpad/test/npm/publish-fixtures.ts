import { Crypto, Effect, Layer, PlatformError, Sink, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

/** One scripted outcome for a spawned command. */
export type ScriptResult =
	| { readonly stdout?: string; readonly stderr?: string; readonly exit?: number }
	| PlatformError.PlatformError;

/** What the scripted spawner was asked to run. */
export interface SpawnRecord {
	readonly command: string;
	readonly args: ReadonlyArray<string>;
	readonly cwd: string | undefined;
	readonly env: Record<string, string | undefined> | undefined;
	readonly extendEnv: boolean | undefined;
}

export interface ScriptedSpawner {
	readonly layer: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>;
	readonly spawns: ReadonlyArray<SpawnRecord>;
}

/**
 * A scripted `ChildProcessSpawner` that records every invocation — including
 * argv, so "the token never reached the command line" is an assertion rather
 * than a hope.
 */
export const scripted = (script: (command: string, args: ReadonlyArray<string>) => ScriptResult): ScriptedSpawner => {
	const spawns: Array<SpawnRecord> = [];
	const layer = Layer.succeed(
		ChildProcessSpawner.ChildProcessSpawner,
		ChildProcessSpawner.make((command) => {
			if (!ChildProcess.isStandardCommand(command)) {
				return Effect.die("piped commands are not scripted by this fixture");
			}
			return Effect.suspend(() => {
				spawns.push({
					command: command.command,
					args: command.args,
					cwd: command.options.cwd,
					env: command.options.env,
					extendEnv: command.options.extendEnv,
				});
				const result = script(command.command, command.args);
				if (result instanceof PlatformError.PlatformError) return Effect.fail(result);
				const bytes = (text: string) => (text === "" ? Stream.empty : Stream.make(new TextEncoder().encode(text)));
				return Effect.succeed(
					ChildProcessSpawner.makeHandle({
						pid: ChildProcessSpawner.ProcessId(99),
						exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(result.exit ?? 0)),
						isRunning: Effect.succeed(false),
						kill: () => Effect.void,
						stdin: Sink.drain,
						stdout: bytes(result.stdout ?? ""),
						stderr: bytes(result.stderr ?? ""),
						all: bytes(`${result.stdout ?? ""}${result.stderr ?? ""}`),
						getInputFd: () => Sink.drain,
						getOutputFd: () => Stream.empty,
						unref: Effect.succeed(Effect.void),
					}),
				);
			});
		}),
	);
	return { layer, spawns };
};

/**
 * A deterministic `Crypto` whose digest is the byte length repeated — enough to
 * prove the digest is computed from the tarball's bytes and hex-encoded,
 * without asserting a real SHA-256 in a unit test.
 */
export const fakeCrypto = Layer.succeed(
	Crypto.Crypto,
	Crypto.make({
		randomBytes: (size) => new Uint8Array(size),
		digest: (_algorithm, data) => Effect.succeed(new Uint8Array([data.length & 0xff, 0xab])),
	}),
);
