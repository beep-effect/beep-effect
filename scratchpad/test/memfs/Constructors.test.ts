// @effect-diagnostics strictEffectProvide:skip-file
// The constructor set: make/layer (the upstream mirror), makeWith/layerWith
// (seed optional; root, caseSensitive and faults in one options bag),
// makeHandle/makeSync (every view over one volume). Every memory layer also
// publishes MemoryFileSystem.Volume.

import { assert, describe, it } from "@effect/vitest";
import type * as Layer from "effect/Layer";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { denied } from "./helpers.ts";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

describe("every memory layer publishes Volume", () => {
	it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
		it.effect("layer: Volume inspects the volume backing FileSystem", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const volume = yield* MemoryFileSystem.Volume;
				yield* fs.writeFileString("/a.txt", "written");
				assert.strictEqual(volume.text("/a.txt"), "written");
			}),
		);
	});

	it.layer(MemoryFileSystem.layerWith({ "/a.txt": "a" }), { timeout: "30 seconds" })((it) => {
		it.effect("layerWith: seeded, and Volume sees both seed and writes", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const volume = yield* MemoryFileSystem.Volume;
				yield* fs.writeFileString("/b.txt", "b");
				assert.deepStrictEqual(volume.paths(), ["/a.txt", "/b.txt"]);
			}),
		);
	});

	const asFileSystemOnly: Layer.Layer<FileSystem.FileSystem> = MemoryFileSystem.layerWith({ "/a.txt": "a" });
	it.layer(asFileSystemOnly, { timeout: "30 seconds" })((it) => {
		it.effect("a layer providing Volume is still assignable where Layer<FileSystem> is expected", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const text = yield* fs.readFileString("/a.txt");
				assert.strictEqual(text, "a");
			}),
		);
	});
});

describe("the seed is optional", () => {
	it.effect("makeWith() and makeWith(undefined, options) build empty volumes", () =>
		Effect.gen(function* () {
			const plain = yield* MemoryFileSystem.makeWith();
			assert.isFalse(yield* plain.exists("/a.txt"));
			const folded = yield* MemoryFileSystem.makeWith(undefined, { caseSensitive: false });
			yield* folded.writeFileString("/Docs.json", "{}");
			assert.strictEqual(yield* folded.readFileString("/docs.json"), "{}");
		}),
	);

	it.layer(MemoryFileSystem.layerWith(undefined, { root: "/ws" }), { timeout: "30 seconds" })((it) => {
		it.effect("layerWith(undefined, options) applies the options", () =>
			Effect.gen(function* () {
				const volume = yield* MemoryFileSystem.Volume;
				assert.isTrue(volume.isDirectory("/ws"));
			}),
		);
	});
});

describe("options.faults", () => {
	it.layer(
		MemoryFileSystem.layerWith(
			{ "/locked-seed.txt": "seeded" },
			{
				faults: {
					writeFile: (path) => (path.startsWith("/locked") ? Effect.fail(denied("writeFile", path)) : undefined),
				},
			},
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("layerWith: FileSystem is faulted, Volume inspects the raw volume beneath", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const volume = yield* MemoryFileSystem.Volume;
				yield* fs.writeFileString("/ok.txt", "ok");
				const error = yield* Effect.flip(fs.writeFileString("/locked.txt", "x"));
				assert.strictEqual(error.reason._tag, "PermissionDenied");
				assert.strictEqual(volume.text("/ok.txt"), "ok");
				assert.isUndefined(volume.text("/locked.txt"));
				// The seed is written beneath the faults, never through them.
				assert.strictEqual(volume.text("/locked-seed.txt"), "seeded");
			}),
		);
	});

	it.layer(
		MemoryFileSystem.layerWith(
			{ "a.json": "{}" },
			{ root: "/ws", faults: { readFile: (path) => Effect.fail(denied("readFile", path)) } },
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("layerWith: root and faults combine", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const error = yield* Effect.flip(fs.readFileString("/ws/a.json"));
				assert.strictEqual(error.reason._tag, "PermissionDenied");
			}),
		);
	});

	it.effect("makeWith: returns the faulted filesystem, transient faults armed per call", () =>
		Effect.gen(function* () {
			const options = { faults: { readFile: MemoryFileSystem.failTimes(1, denied("readFile", "/a.txt")) } };
			const first = yield* MemoryFileSystem.makeWith({ "/a.txt": "a" }, options);
			assert.strictEqual((yield* Effect.flip(first.readFileString("/a.txt"))).reason._tag, "PermissionDenied");
			assert.strictEqual(yield* first.readFileString("/a.txt"), "a");
			const second = yield* MemoryFileSystem.makeWith({ "/a.txt": "a" }, options);
			assert.strictEqual((yield* Effect.flip(second.readFileString("/a.txt"))).reason._tag, "PermissionDenied");
		}),
	);

	it.effect("an unknown fault key is a wiring bug: the layer dies at build, naming it", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(
				Effect.provide(
					Effect.void,
					MemoryFileSystem.layerWith(undefined, {
						faults: deliberatelyInvalid<never>({ readFileSting: () => undefined }),
					}),
				),
			);
			if (!Exit.isFailure(exit)) return assert.fail("expected the layer build to die");
			assert.isTrue(Cause.hasDies(exit.cause));
			assert.match(String(Cause.squash(exit.cause)), /readFileSting/);
		}),
	);

	it.effect("a faults factory receives the unfaulted filesystem", () =>
		Effect.gen(function* () {
			const fs = yield* MemoryFileSystem.makeWith(
				{ "/real.txt": "real" },
				{
					faults: (base) => ({ readFile: (path) => (path === "/alias.txt" ? base.readFile("/real.txt") : undefined) }),
				},
			);
			assert.strictEqual(yield* fs.readFileString("/alias.txt"), "real");
		}),
	);
});

describe("MemoryFileSystem.layerWith", () => {
	const Seeded = MemoryFileSystem.layerWith({ "/seed.txt": "seeded" });

	it.layer(Seeded, { timeout: "30 seconds" })((it) => {
		it.effect("provides FileSystem backed by the seeded volume", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				assert.strictEqual(yield* fs.readFileString("/seed.txt"), "seeded");
			}),
		);
	});

	it.effect("each provide of the layer builds an isolated volume", () =>
		Effect.gen(function* () {
			// Effect.provide does not memoize: two provides of ONE layer const are
			// two volumes. (Sharing happens through layer-graph memoization — the
			// suite-boundary `layer(...)` block — and is documented on the facade.)
			yield* Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				yield* fs.writeFileString("/scratch.txt", "first volume");
			}).pipe(Effect.provide(Seeded));

			const seen = yield* Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				return yield* fs.exists("/scratch.txt");
			}).pipe(Effect.provide(Seeded));

			assert.isFalse(seen);
		}),
	);

	it.effect("a contradictory seed dies — a wiring bug, not a live failure", () =>
		Effect.gen(function* () {
			const Broken = MemoryFileSystem.layerWith({ "/a": "file", "/a/b": "child" });
			const exit = yield* Effect.exit(
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					return yield* fs.exists("/a");
				}).pipe(Effect.provide(Broken)),
			);
			if (!Exit.isFailure(exit)) {
				assert.fail("expected the contradictory seed to die");
			}
			assert.isTrue(Cause.hasDies(exit.cause));
			assert.isFalse(Cause.hasFails(exit.cause));
		}),
	);
});
