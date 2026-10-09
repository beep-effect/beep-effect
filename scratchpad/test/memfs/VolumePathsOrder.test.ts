import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";

describe("MemoryFileSystem.Volume.paths", () => {
	it.effect("sorts unsorted seed and written paths by UTF-16 code units", () =>
		Effect.gen(function* () {
			const { fileSystem, volume } = yield* MemoryFileSystem.makeHandle({
				"/z.txt": "z",
				"/\uE000.txt": "private-use",
				"/a2.txt": "a2",
				"/\u{1F600}.txt": "emoji",
				"/ä.txt": "accent",
				"/a10.txt": "a10",
				"/Z.txt": "uppercase",
				"/a.txt": "a",
			});
			yield* fileSystem.writeFileString("/A.txt", "written");
			assert.deepStrictEqual(volume.paths(), [
				"/A.txt",
				"/Z.txt",
				"/a.txt",
				"/a10.txt",
				"/a2.txt",
				"/z.txt",
				"/ä.txt",
				"/\u{1F600}.txt",
				"/\uE000.txt",
			]);
		}),
	);
});
