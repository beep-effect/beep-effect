import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as R from "effect/Record";
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

	it.effect("keeps high-fanout inspection paths sorted after links and namespace changes", () =>
		Effect.gen(function* () {
			const { fileSystem, volume } = yield* MemoryFileSystem.makeHandle();
			yield* fileSystem.makeDirectory("/wide/nested", { recursive: true });
			const names: Array<string> = [];
			for (let index = 255; index >= 0; index--) {
				const name = `entry-${String(index).padStart(3, "0")}`;
				names.unshift(name);
				yield* fileSystem.writeFileString(`/wide/${name}`, name);
			}
			yield* fileSystem.writeFileString("/wide/nested/z", "nested");
			yield* fileSystem.link("/wide/entry-128", "/wide/nested/hard-link");
			yield* fileSystem.symlink("/wide", "/alias");
			yield* fileSystem.rename("/wide/entry-000", "/wide/renamed");
			yield* fileSystem.remove("/wide/entry-001");
			const expected = A.sort([
				...names.slice(2).map((name) => `/wide/${name}`),
				"/wide/nested/hard-link",
				"/wide/nested/z",
				"/wide/renamed",
			], Order.String);
			assert.deepStrictEqual(volume.paths(), expected);
			const snapshot = volume.snapshot();
			assert.deepStrictEqual(A.sort(R.keys(snapshot), Order.String), expected);
			assert.strictEqual(volume.text("/wide/nested/hard-link"), "entry-128");
			assert.strictEqual(volume.text("/wide/renamed"), "entry-000");
			assert.strictEqual(volume.has("/wide/entry-001"), false);
			assert.strictEqual(volume.text("/alias/entry-128"), undefined);
			assert.deepStrictEqual(yield* fileSystem.readDirectory("/wide"), [...names.slice(2), "nested", "renamed"]);
			assert.deepStrictEqual(volume.paths(), expected);
		}),
	);
});
