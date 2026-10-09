// Run a command ONCE and collect its interleaved output alongside its exit
// code — the shape every archiver call in this package needs.
//
// **One spawn, not two — load-bearing.** The spawner's convenience members
// each spawn independently: `string` collects output without inspecting the
// exit code, and `exitCode` runs the command AGAIN (core's
// `ChildProcessSpawner.make` derives both from `spawn`). Calling them
// back-to-back double-executes every archive operation — harmless for
// idempotent `tar`/`unzip -o`, but .NET's `ZipFile.ExtractToDirectory`
// refuses to overwrite, so the second run fails on Windows while the
// captured "complaint" is the FIRST run's silent success. Output
// and exit code must come from the same `spawn` handle, and this is the one
// place that discipline is spelled.
//
// Output is drained BEFORE the exit code is awaited, so a chatty command
// cannot deadlock on a full pipe; the stream ends at exit. The caller applies
// its own exit-code policy (the cache tolerates `tar -k`'s exit 1) and maps
// the `PlatformError` into its own error class.
import type { PlatformError } from "effect";
import { Effect, Stream } from "effect";
import type { ChildProcess, ChildProcessSpawner } from "effect/process";

/** What one run produced: stdout and stderr interleaved, and the exit code. */
export interface SpawnOnceResult {
	readonly output: string;
	readonly code: number;
}

/**
 * Spawn `command` once, drain `stdout`+`stderr`, then read the exit code from
 * the same handle. Never fails on a non-zero exit — that is the caller's
 * policy.
 */
export const spawnOnce = (
	spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
	command: ChildProcess.Command,
): Effect.Effect<SpawnOnceResult, PlatformError.PlatformError> =>
	Effect.scoped(
		Effect.gen(function* () {
			const handle = yield* spawner.spawn(command);
			const output = yield* Stream.mkString(Stream.decodeText(handle.all));
			const code = yield* handle.exitCode;
			return { output, code };
		}),
	);
