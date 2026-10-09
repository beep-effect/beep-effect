import { realpathSync } from "node:fs";
import { assert, describe, it } from "@effect/vitest";
import { Console, Effect, Option } from "effect";
import { holdChalkLevel } from "../../../effected/cli/ui/internal/ink.ts";
import { inkChalk, resolveInkEntry } from "../../../effected/cli/ui/internal/inkChalk.ts";
import { capturing } from "../helpers/live.ts";

/** What Vite's module runner (which evaluates a Vitest reporter) does when asked to `import.meta.resolve`. */
const unsupported = (): string => {
	throw new Error('[module runner] "import.meta.resolve" is not supported.');
};

describe("resolving Ink's chalk where import.meta.resolve is unavailable", () => {
	it("Ink's entry is still found, through CommonJS resolution from the kit, and it is the same file", () => {
		const native = realpathSync(resolveInkEntry());
		assert.strictEqual(realpathSync(resolveInkEntry(unsupported)), native, "a resolver that throws");
		assert.strictEqual(realpathSync(resolveInkEntry(undefined)), native, "no resolver at all");
		assert.match(native, /[\\/]ink[\\/]build[\\/]index\.js$/, "control: it is Ink's own entry");
	});

	it.effect("Ink's own chalk is resolved through the fallback, the very instance the native path finds", () =>
		Effect.gen(function* () {
			const native = yield* Effect.promise(() => inkChalk());
			const fallback = yield* Effect.promise(() => inkChalk(() => resolveInkEntry(unsupported)));
			assert.isTrue(Option.isSome(native), "control: the native path resolves it");
			assert.isTrue(Option.isSome(fallback), "the fallback resolves it too");
			assert.strictEqual(Option.getOrUndefined(fallback), Option.getOrUndefined(native), "one chalk, not a copy");
		}),
	);

	it.effect("holding the level on the chalk the fallback found logs no warning", () =>
		Effect.gen(function* () {
			const found = yield* Effect.promise(() => inkChalk(() => resolveInkEntry(unsupported)));
			const log = capturing();
			yield* Effect.scoped(holdChalkLevel(found, "none")).pipe(Effect.provideService(Console.Console, log.console));
			assert.deepStrictEqual(log.lines, [], "no warning, no line at all");
		}),
	);

	it.effect("control: with nothing resolved, holding the level does warn, once", () =>
		Effect.gen(function* () {
			const log = capturing();
			yield* Effect.scoped(holdChalkLevel(Option.none(), "none")).pipe(
				Effect.provideService(Console.Console, log.console),
			);
			yield* Effect.scoped(holdChalkLevel(Option.none(), "none")).pipe(
				Effect.provideService(Console.Console, log.console),
			);
			assert.strictEqual(log.lines.filter((line) => line.includes("could not resolve the chalk")).length, 1);
		}),
	);
});
