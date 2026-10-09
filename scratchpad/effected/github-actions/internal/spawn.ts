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
import type * as PlatformError from "effect/PlatformError";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Function from "effect/Function";
import type { ChildProcess, ChildProcessSpawner } from "effect/process";

/**
 * What one run produced: stdout and stderr interleaved, and the exit code.
 * @category models
 * @since 0.0.0
 */
export interface SpawnOnceResult {
	readonly output: string;
	readonly code: number;
}

/**
 * Spawn `command` once, drain `stdout`+`stderr`, then read the exit code from
 * the same handle. Never fails on a non-zero exit — that is the caller's
 * policy.
 *
 * **Example** (Construct a single-spawn program)
 *
 * ```ts
 * import { spawnOnce } from "@beep/scratchpad/effected/github-actions/internal/spawn"
 * import * as Effect from "effect/Effect"
 * import { ChildProcess, ChildProcessSpawner } from "effect/process"
 *
 * const program = Effect.flatMap(ChildProcessSpawner.ChildProcessSpawner, (spawner) =>
 *   spawnOnce(spawner, ChildProcess.make("tar", ["--version"]))
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category processes
 * @since 0.0.0
 */
export const spawnOnce: {
	(spawner: ChildProcessSpawner.ChildProcessSpawner["Service"], command: ChildProcess.Command): Effect.Effect<SpawnOnceResult, PlatformError.PlatformError>;
	(command: ChildProcess.Command): (spawner: ChildProcessSpawner.ChildProcessSpawner["Service"]) => Effect.Effect<SpawnOnceResult, PlatformError.PlatformError>;
} = Function.dual(2, (
	spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
	command: ChildProcess.Command,
): Effect.Effect<SpawnOnceResult, PlatformError.PlatformError> =>
	Effect.scoped(
		Effect.gen(function* () {
			const handle = yield* spawner.spawn(command);
			const output = yield* handle.all.pipe(Stream.decodeText, Stream.mkString);
			const code = yield* handle.exitCode;
			return { output, code };
		}),
	));
