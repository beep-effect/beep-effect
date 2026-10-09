// Adaptation-ledger entry: watch honors core's WatchOptions.recursive, where
// upstream ignored it.

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { collectWatch } from "./helpers.ts";

describe("watch honors WatchOptions.recursive — the port adaptation", () => {
	it.effect("a non-recursive directory watch reports direct children only", () =>
		Effect.gen(function* () {
			const fs = yield* MemoryFileSystem.makeWith({ "/root/sub/existing.txt": "x" });

			// The nested write happens FIRST: if non-recursive delivered nested
			// events, it would be the collected one. Collecting the later direct
			// event proves the nested write was skipped.
			const events = yield* collectWatch(
				fs,
				"/root",
				undefined,
				1,
				Effect.gen(function* () {
					yield* fs.writeFileString("/root/sub/nested.txt", "nested");
					yield* fs.writeFileString("/root/direct.txt", "direct");
				}),
			);

			assert.deepStrictEqual(events, [{ _tag: "Create", path: "/root/direct.txt" }]);
		}),
	);

	it.effect("recursive: true reports nested descendants", () =>
		Effect.gen(function* () {
			const fs = yield* MemoryFileSystem.makeWith({ "/root/sub/existing.txt": "x" });

			const events = yield* collectWatch(
				fs,
				"/root",
				{ recursive: true },
				2,
				Effect.gen(function* () {
					yield* fs.writeFileString("/root/sub/nested.txt", "nested");
					yield* fs.writeFileString("/root/direct.txt", "direct");
				}),
			);

			assert.deepStrictEqual(events, [
				{ _tag: "Create", path: "/root/sub/nested.txt" },
				{ _tag: "Create", path: "/root/direct.txt" },
			]);
		}),
	);

	it.effect("a file watch still reports its own updates", () =>
		Effect.gen(function* () {
			const fs = yield* MemoryFileSystem.makeWith({ "/file.txt": "original" });

			const events = yield* collectWatch(fs, "/file.txt", undefined, 1, fs.writeFileString("/file.txt", "updated"));

			assert.deepStrictEqual(events, [{ _tag: "Update", path: "/file.txt" }]);
		}),
	);
});
