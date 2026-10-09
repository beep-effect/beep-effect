// Kit-owned test helpers shared across suites. The upstream-ported
// MemoryFileSystem.test.ts keeps its own watch collector.

import type { FileSystem } from "effect";
import { Effect, Fiber, PlatformError, Stream } from "effect";

/** Runs `f`, which must throw, and returns what it threw. */
export const thrown = (f: () => unknown): { code?: string; syscall?: string; path?: string; name?: string } => {
	try {
		f();
	} catch (e) {
		return e as { code?: string; syscall?: string; path?: string; name?: string };
	}
	throw new Error("expected a throw");
};

/** A typed PermissionDenied failure for a fault handler. */
export const denied = (method: string, path: string): PlatformError.PlatformError =>
	PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method, pathOrDescriptor: path });

/**
 * Collects the first `count` watch events `mutation` causes. Subscription
 * registration is made deterministic before mutating: under v4's cooperative
 * FIFO scheduler `yieldNow` parks the parent behind the child, which runs to its
 * first real suspension — past the watcher registration — so no event can be
 * published before the watcher exists.
 */
export const collectWatch = Effect.fnUntraced(function* (
	fs: FileSystem.FileSystem,
	path: string,
	options: FileSystem.WatchOptions | undefined,
	count: number,
	mutation: Effect.Effect<void, PlatformError.PlatformError>,
) {
	const events = yield* fs
		.watch(path, options)
		.pipe(Stream.take(count), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
	yield* Effect.yieldNow;
	yield* mutation;
	return Array.from(yield* Fiber.join(events));
});

/**
 * The first event a watcher sees after `probe`. `sentinel` is a mutation the
 * watcher matches in any engine, so a dropped probe event surfaces as the
 * sentinel's event — a clean assertion failure instead of a hang.
 */
export const firstEvent = Effect.fnUntraced(function* (
	fs: FileSystem.FileSystem,
	path: string,
	options: FileSystem.WatchOptions | undefined,
	probe: Effect.Effect<void, PlatformError.PlatformError>,
	sentinel: Effect.Effect<void, PlatformError.PlatformError>,
) {
	const events = yield* fs
		.watch(path, options)
		.pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
	yield* Effect.yieldNow;
	yield* probe;
	yield* sentinel;
	const [event] = Array.from(yield* Fiber.join(events));
	return event;
});
