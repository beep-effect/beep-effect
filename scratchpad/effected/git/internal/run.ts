import type { PlatformError } from "effect";
import { Effect, Stream } from "effect";
import type { ChildProcess } from "effect/process";
import { ChildProcessSpawner } from "effect/process";

/**
 * The stdout, stderr, and exit code of one completed run of a `Command`,
 * collected separately (never interleaved).
 */
export interface Collected {
	readonly stdout: string;
	readonly stderr: string;
	readonly exitCode: number;
}

/**
 * Spawns `command` and collects its stdout, stderr, and exit code as a single
 * triple.
 *
 * @remarks
 * Collection is concurrent (`{ concurrency: "unbounded" }`) — this is
 * load-bearing, not a style choice. Reading stdout, stderr, and exit code
 * sequentially can deadlock the moment either pipe's OS buffer fills:
 * upstream `git` blocks writing to a full pipe while nothing is draining it,
 * and the sequential reader that would drain it is still waiting on the
 * *other* stream to finish first.
 */
export const runCollected = (
	command: ChildProcess.Command,
): Effect.Effect<Collected, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner> =>
	Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const handle = yield* spawner.spawn(command);
			// { concurrency: "unbounded" } is load-bearing: collecting these three
			// sequentially would deadlock the moment a real OS pipe buffer fills
			// (upstream git blocks writing while nothing drains it, and the
			// sequential reader that would drain it is still waiting on the other
			// stream). No mock test can regress this — it needs a real pipe. The
			// regression guard is the dedicated "runCollected drains stdout and
			// stderr concurrently under simultaneous backpressure on both pipes"
			// test in __test__/integration/Git.int.test.ts (G5) — it puts pressure
			// on BOTH pipes at once, which is what actually discriminates this
			// option; a large-output-on-one-stream case does not.
			const [stdout, stderr, exitCode] = yield* Effect.all(
				[
					Stream.mkString(Stream.decodeText(handle.stdout)),
					Stream.mkString(Stream.decodeText(handle.stderr)),
					handle.exitCode,
				],
				{ concurrency: "unbounded" },
			);
			return { stdout, stderr, exitCode: Number(exitCode) };
		}),
	);

/**
 * Whether `command` can be run at all — any COMPLETED run, regardless of exit
 * code, proves the command exists. Only a `PlatformError` (spawn itself
 * failing — e.g. the executable is not found) means `command` is
 * unavailable.
 */
export const available = (
	command: ChildProcess.Command,
): Effect.Effect<boolean, never, ChildProcessSpawner.ChildProcessSpawner> =>
	runCollected(command).pipe(
		Effect.map(() => true),
		Effect.catch(() => Effect.succeed(false)),
	);
