// Run a command ONCE and collect its interleaved output alongside its exit
// code — the shape every archiver call in this package needs.
//
// **One spawn, not two — load-bearing.** The spawner's convenience members
// each spawn independently: `string` collects output without inspecting the
// exit code, and `exitCode` runs the command AGAIN (core's
import type * as ChildProcess from "effect/process/ChildProcess";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

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
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import type * as PlatformError from "effect/PlatformError";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Function from "effect/Function";
const $I = $ScratchpadId.create("effected/github-actions/internal/spawn");

/**
 * What one run produced: stdout and stderr interleaved, and the exit code.
 * **Example** (Validate SpawnOnceResult input)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import * as Console from "effect/Console";
 * import * as Effect from "effect/Effect";
 * import { SpawnOnceResult } from "@beep/scratchpad/effected/github-actions/internal/spawn";
 *
 * const input = { output: "installed", code: 0 };
 * Effect.runSync(Console.log(S.is(SpawnOnceResult)(input))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SpawnOnceResult = S.Struct({
	output: S.String.annotateKey({ description: "The interleaved stdout and stderr from one spawn." }),
	code: S.Finite.annotateKey({ description: "The same spawn's finite exit code, without applying caller policy." }),
}).annotate($I.annote("SpawnOnceResult", { description: "The plain-object output and exit code collected from one spawn handle." }));

/**
 * The plain-object result accepted by {@link SpawnOnceResult}.
 * @category type-level
 * @since 0.0.0
 */
export type SpawnOnceResult = typeof SpawnOnceResult.Type;

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
 * import * as ChildProcess from "effect/process/ChildProcess";
 * import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
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
