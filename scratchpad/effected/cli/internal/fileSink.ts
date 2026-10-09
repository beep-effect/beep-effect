import { CommandNeutralizer } from "../../github-commands/index.ts";
import type { LogLevel, Scope } from "effect";
import { Cause, Console, Effect, Exit, Fiber, FileSystem, Logger, Path, Queue } from "effect";
import { sanitize } from "../Fmt.ts";
import { formatNdjson, passes } from "./diagnostics.ts";

/** How long closing the scope waits for queued lines to reach the file before giving up on a hung filesystem. */
const CLOSE_TIMEOUT = "2 seconds";

/**
 * An asynchronous NDJSON file logger.
 *
 * @remarks
 * `Logger.make` takes a synchronous callback, so the logger only offers the line to a queue; a fiber scoped to the
 * layer drains it and appends each batch with `FileSystem.writeFileString(..., { flag: "a" })`. The first write
 * error prints one stderr line and disables the sink: later lines, including any still queued, are discarded
 * without a message. A defect from the filesystem counts as a write error. Closing the scope ends the queue and
 * waits for the drain for at most two seconds, so lines queued before the close are flushed unless the sink had
 * already disabled itself or the filesystem hangs; past the bound the drain is interrupted and the rest is lost.
 *
 * The stderr line is held to the rules of every other kit write: the path (which a workflow can set through an env
 * var) and the error's message are sanitised, and the line is neutralized when `underActions` says the drain's fiber
 * runs under GitHub Actions, the same decision the diagnostics sink makes.
 *
 * @internal
 */
export const makeFileSink = (
	path: string,
	installed: LogLevel.LogLevel,
	underActions: (fiber: Fiber.Fiber<unknown, unknown>) => boolean,
): Effect.Effect<Logger.Logger<unknown, void>, never, FileSystem.FileSystem | Path.Path | Scope.Scope> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const location = yield* Path.Path;
		const queue = yield* Queue.unbounded<string, Cause.Done>();
		let disabled = false;

		// The parent directory is made once, before the first append; a failure there disables the sink like any other.
		let directoryMade = false;
		const append = (lines: ReadonlyArray<string>) =>
			Effect.gen(function* () {
				if (!directoryMade) {
					yield* fs.makeDirectory(location.dirname(path), { recursive: true });
					directoryMade = true;
				}
				yield* fs.writeFileString(path, lines.map((line) => `${line}\n`).join(""), { flag: "a" });
			});

		const drain = Effect.gen(function* () {
			while (true) {
				// Fails with Done once the queue has ended and emptied, which stops the loop.
				const batch = yield* Queue.takeAll(queue);
				if (disabled) continue;
				// Exit, not Effect.result: a defect from the filesystem is handled like a write error, not left to kill
				// the drain (which would leave the queue to grow unbounded and the close to wait on it).
				const exit = yield* Effect.exit(append(batch));
				if (Exit.isFailure(exit)) {
					disabled = true;
					const error = Cause.squash(exit.cause);
					const message = error instanceof Error ? error.message : String(error);
					const line = sanitize(`diagnostics log file ${path} failed: ${message}; further file logging disabled`);
					yield* Effect.withFiber((self) => Console.error(underActions(self) ? CommandNeutralizer.text(line) : line));
				}
			}
		}).pipe(Effect.ignore);

		const fiber = yield* Effect.forkScoped(drain);
		// Runs before the fork's own interrupt: end the queue and give the drain a bounded time to write what is left.
		// A hung filesystem must not hang process exit, so past the bound the drain is interrupted with the scope and
		// whatever it had not written is lost.
		yield* Effect.addFinalizer(() =>
			Queue.end(queue).pipe(Effect.andThen(Fiber.join(fiber).pipe(Effect.timeout(CLOSE_TIMEOUT))), Effect.ignore),
		);

		return Logger.make<unknown, void>((record) => {
			if (!passes(record, installed)) return;
			Queue.offerUnsafe(queue, formatNdjson(record));
		});
	});
