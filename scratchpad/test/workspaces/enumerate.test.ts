import { assert, describe, it } from "@effect/vitest";
import { GlobSet } from "../../effected/glob/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { enumerate } from "../../effected/workspaces/internal/enumerate.ts";

const literals = Array.from({ length: 24 }, (_, index) => `packages/pkg-${index}`);

const tree = literals.reduce<Record<string, string>>(
	(acc, literal, index) => {
		acc[`/repo/${literal}/package.json`] = JSON.stringify({ name: `@x/pkg-${index}`, version: "1.0.0" });
		return acc;
	},
	{ "/repo/package.json": JSON.stringify({ name: "root", version: "1.0.0" }) },
);

describe("enumerate — literal pattern probes", () => {
	let inFlight = 0;
	let maxInFlight = 0;
	// A spy, not a stub: the faults factory hands the handler the unfaulted
	// volume, so every probe is counted and then answered by the real `exists`.
	const Counted = Layer.mergeAll(
		MemoryFileSystem.layerWith(tree, {
			faults: (base) => ({
				exists: Effect.fn("exists")(function* (path: string) {
					inFlight += 1;
					maxInFlight = Math.max(maxInFlight, inFlight);
					yield* Effect.yieldNow;
					const exists = yield* base.exists(path);
					inFlight -= 1;
					return exists;
				}),
			}),
		}),
		Path.layer,
	);

	it.layer(Counted, { timeout: "30 seconds" })((it) => {
		it.effect("checks literal package candidates with overlapping exists probes", () =>
			Effect.gen(function* () {
				const globs = yield* GlobSet.compile(literals);
				const directories = yield* enumerate("/repo", globs);

				assert.deepStrictEqual(
					directories.map((directory) => directory.relativePath),
					[...literals].sort(),
				);
				assert.isAbove(maxInFlight, 1, "expected literal package checks to overlap");
			}),
		);
	});
});
