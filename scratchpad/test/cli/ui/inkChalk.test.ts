import { NodeFileSystem } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import { holdChalkLevel } from "../../../effected/cli/ui/internal/ink.ts";
import { inkChalk, resolveInkEntry } from "../../../effected/cli/ui/internal/inkChalk.ts";
import { capturing } from "../helpers/live.ts";

/** What Vite's module runner (which evaluates a Vitest reporter) does when asked to `import.meta.resolve`. */
const unsupported = (): string => {
	throw new Error('[module runner] "import.meta.resolve" is not supported.');
};

describe("resolving Ink's chalk where import.meta.resolve is unavailable", () => {
	it.layer(NodeFileSystem.layer, { timeout: "30 seconds" })((it) => {
		it.effect("Ink's entry is still found, through CommonJS resolution from the kit, and it is the same file", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const native = yield* fs.realPath(resolveInkEntry());
				assert.strictEqual(yield* fs.realPath(resolveInkEntry(unsupported)), native, "a resolver that throws");
				assert.strictEqual(yield* fs.realPath(resolveInkEntry(undefined)), native, "no resolver at all");
				assert.match(native, /[\\/]ink[\\/]build[\\/]index\.js$/, "control: it is Ink's own entry");
			}),
		);

		it.effect("Ink's own chalk is resolved through the fallback, the very instance the native path finds", () =>
			Effect.gen(function* () {
				const native = yield* inkChalk();
				const fallback = yield* inkChalk(() => resolveInkEntry(unsupported));
				assertSome(native, O.getOrUndefined(native));
				assertSome(fallback, O.getOrUndefined(fallback));
				assert.strictEqual(O.getOrUndefined(fallback), O.getOrUndefined(native), "one chalk, not a copy");
			}),
		);

		it.effect("uses the injected FileSystem realpath and retains the unresolved-chalk fallback on service failure", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const paths: Array<string> = [];
				const tracked = FileSystem.makeNoop({
					realPath: (path) => {
						paths.push(path);
						return fs.realPath(path);
					},
				});
				const native = yield* inkChalk();
				const injected = yield* inkChalk().pipe(Effect.provideService(FileSystem.FileSystem, tracked));
				assertSome(injected, O.getOrUndefined(injected));
				assert.strictEqual(O.getOrUndefined(injected), O.getOrUndefined(native), "the injected realpath still selects Ink's shared chalk");
				assert.lengthOf(paths, 1, "the supplied FileSystem resolves the import's realpath");
				const missing = yield* inkChalk().pipe(Effect.provideService(FileSystem.FileSystem, FileSystem.makeNoop({})));
				assertNone(missing);
			}),
		);

		it.effect("holding the level on the chalk the fallback found logs no warning", () =>
			Effect.gen(function* () {
				const found = yield* inkChalk(() => resolveInkEntry(unsupported));
				const log = capturing();
				yield* holdChalkLevel(found, "none").pipe(Effect.provideService(Console.Console, log.console));
				assert.deepStrictEqual(log.lines, [], "no warning, no line at all");
			}),
		);

		it.effect("control: with nothing resolved, holding the level does warn, once", () =>
			Effect.gen(function* () {
				const log = capturing();
				yield* holdChalkLevel(O.none(), "none").pipe(
					Effect.provideService(Console.Console, log.console),
				);
				yield* holdChalkLevel(O.none(), "none").pipe(
					Effect.provideService(Console.Console, log.console),
				);
				assert.strictEqual(log.lines.filter((line) => line.includes("could not resolve the chalk")).length, 1);
			}),
		);
	});
});
