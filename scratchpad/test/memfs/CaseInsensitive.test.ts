// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { caseInsensitiveSuite } from "./CaseInsensitiveContract.ts";
import { firstEvent } from "./helpers.ts";

// The host-proven contract (integration/case-insensitive.int.test.ts) against
// the memory engine built with `caseSensitive: false`.
caseInsensitiveSuite("memory", MemoryFileSystem.layerWith({}, { caseSensitive: false }));

describe("case-insensitive facade", () => {
	it.effect("the view and both ports fold", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({ "/Repo/Docs.json": "{}" }, { caseSensitive: false });
			assert.strictEqual(volume.text("/repo/docs.JSON"), "{}");
			assert.isTrue(volume.has("/REPO"));
			assert.isTrue(volume.isDirectory("/rEpO"));
			assert.deepStrictEqual(volume.readDirectory("/repo"), ["Docs.json"]);
			assert.deepStrictEqual(volume.paths(), ["/Repo/Docs.json"]);
			assert.deepStrictEqual(Object.keys(volume.snapshot()), ["/Repo/Docs.json"]);
			assert.strictEqual(volume.lstat("/REPO/DOCS.JSON")?.kind, "file");
			assert.strictEqual(MemoryFileSystem.syncFileSystem(volume).readFile("/repo/docs.json"), "{}");
			assert.deepStrictEqual(MemoryFileSystem.syncFileSystem(volume).readDirectory("/REPO"), ["Docs.json"]);
		}),
	);

	it.effect("the promises port folds", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({ "/Repo/Docs.json": "{}" }, { caseSensitive: false });
			const promises = MemoryFileSystem.promisesFileSystem(volume);
			const text = yield* Effect.promise(() => promises.readFile("/repo/DOCS.json", "utf8"));
			assert.strictEqual(text, "{}");
			assert.deepStrictEqual(yield* Effect.promise(() => promises.readdir("/REPO")), ["Docs.json"]);
			assert.isTrue((yield* Effect.promise(() => promises.stat("/rEpO"))).isDirectory());
			const [dirent] = yield* Effect.promise(() => promises.readdir("/REPO", { withFileTypes: true }));
			assert.strictEqual(dirent?.name, "Docs.json");
			assert.isTrue(dirent?.isFile());
		}),
	);

	it.effect("seed keys differing only by case address one entry", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle(
				{ "/a/X.txt": "1", "/a/x.txt": "2" },
				{ caseSensitive: false },
			);
			assert.deepStrictEqual(volume.paths(), ["/a/X.txt"]);
			assert.strictEqual(volume.text("/a/x.txt"), "2");
		}),
	);

	it.effect("the default stays case-sensitive", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({ "/Docs.json": "{}" });
			assert.isUndefined(volume.text("/docs.json"));
			assert.isFalse(volume.has("/DOCS.JSON"));
		}),
	);
});

describe("case-insensitive watch", () => {
	const Volume = MemoryFileSystem.layerWith(
		{ "/Repo/Docs.json": "{}", "/Repo/Sub/Deep.json": "{}" },
		{ caseSensitive: false },
	);

	it.effect("a watch in one spelling sees a write in another", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const event = yield* firstEvent(
				fs,
				"/repo",
				undefined,
				fs.writeFileString("/Repo/Docs.json", "1"),
				fs.writeFileString("/repo/sentinel.txt", ""),
			);
			assert.strictEqual(event?._tag, "Update");
			assert.strictEqual(event?.path.toLowerCase(), "/repo/docs.json");
		}).pipe(Effect.provide(Volume)),
	);

	it.effect("a watch in one spelling sees a remove in another", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const event = yield* firstEvent(
				fs,
				"/Repo",
				undefined,
				fs.remove("/repo/docs.json"),
				fs.writeFileString("/Repo/sentinel.txt", ""),
			);
			assert.strictEqual(event?._tag, "Remove");
			assert.strictEqual(event?.path.toLowerCase(), "/repo/docs.json");
		}).pipe(Effect.provide(Volume)),
	);

	it.effect("a recursive watch in one spelling sees a nested write in another", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const event = yield* firstEvent(
				fs,
				"/repo",
				{ recursive: true },
				fs.writeFileString("/REPO/SUB/deep.json", "1"),
				fs.writeFileString("/repo/sentinel.txt", ""),
			);
			assert.strictEqual(event?._tag, "Update");
			assert.strictEqual(event?.path.toLowerCase(), "/repo/sub/deep.json");
		}).pipe(Effect.provide(Volume)),
	);
});
