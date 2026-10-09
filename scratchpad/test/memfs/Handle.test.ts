// @effect-diagnostics strictEffectProvide:skip-file asyncFunction:skip-file
// MemoryFileSystem.makeHandle (inside Effect) and makeSync (at describe
// scope): every view over one volume, and the node-shaped mutators.

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { runMutation } from "../../effected/memfs/internal/ports.ts";
import { denied, thrown } from "./helpers.ts";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

describe("MemoryFileSystem.makeHandle", () => {
	it.effect("returns every view over one volume, seeded", () =>
		Effect.gen(function* () {
			const handle = yield* MemoryFileSystem.makeHandle({ "/a.txt": "a" });
			yield* handle.fileSystem.writeFileString("/b.txt", "b");
			assert.deepStrictEqual(handle.volume.paths(), ["/a.txt", "/b.txt"]);
			assert.strictEqual(handle.sync.readFile("/b.txt"), "b");
			handle.write("/c/d.txt", "d");
			assert.strictEqual(yield* handle.fileSystem.readFileString("/c/d.txt"), "d");
		}),
	);

	it.effect("makeHandle() builds an empty volume", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle();
			assert.deepStrictEqual(volume.paths(), []);
		}),
	);

	it.effect("handle.layer provides FileSystem, Volume and Path over the SAME volume, stable across provides", () =>
		Effect.gen(function* () {
			const handle = yield* MemoryFileSystem.makeHandle();
			yield* Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				yield* fs.writeFileString("/w.txt", "w");
			}).pipe(Effect.provide(handle.layer));
			const seen = yield* Effect.gen(function* () {
				const volume = yield* MemoryFileSystem.Volume;
				const path = yield* Path.Path;
				return [volume.text("/w.txt"), path.join("/a", "b")] as const;
			}).pipe(Effect.provide(handle.layer));
			assert.deepStrictEqual(seen, ["w", "/a/b"]);
			assert.strictEqual(handle.volume.text("/w.txt"), "w");
		}),
	);

	it.effect("with faults: fileSystem is faulted, the setup mutators are not", () =>
		Effect.gen(function* () {
			const handle = yield* MemoryFileSystem.makeHandle(
				{},
				{ faults: { writeFile: (path) => Effect.fail(denied("writeFile", path)) } },
			);
			handle.write("/setup.txt", "setup");
			assert.strictEqual(handle.volume.text("/setup.txt"), "setup");
			const error = yield* Effect.flip(handle.fileSystem.writeFileString("/x.txt", "x"));
			assert.strictEqual(error.reason._tag, "PermissionDenied");
		}),
	);

	it.effect("fails typed on a contradictory seed", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(MemoryFileSystem.makeHandle({ "/a": "file", "/a/b": "child" }));
			assert.strictEqual(error.reason._tag, "AlreadyExists");
		}),
	);
});

describe("MemoryFileSystem.makeHandle — the volume half", () => {
	it.effect("the value-level pair shares one volume, seeded or bare", () =>
		Effect.gen(function* () {
			const bare = yield* MemoryFileSystem.makeHandle();
			yield* bare.fileSystem.writeFileString("/direct.txt", "by value");
			assert.strictEqual(bare.volume.text("/direct.txt"), "by value");

			const seeded = yield* MemoryFileSystem.makeHandle({ "/seed.txt": "seeded" });
			assert.strictEqual(seeded.volume.text("/seed.txt"), "seeded");
			// The two pairs are independent volumes.
			assert.isFalse(seeded.volume.has("/direct.txt"));
			assert.isFalse(bare.volume.has("/seed.txt"));
		}),
	);

	it.effect("makeHandle fails typed on a contradictory seed", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(MemoryFileSystem.makeHandle({ "/a": "file", "/a/b": "child" }));
			assert.strictEqual(error._tag, "PlatformError");
			assert.strictEqual(error.reason._tag, "AlreadyExists");
		}),
	);
});

describe("MemoryFileSystem.makeSync", () => {
	it("builds synchronously at describe scope with root", () => {
		const vol = MemoryFileSystem.makeSync({ "package.json": "{}" }, { root: "/ws-1/repo" });
		assert.strictEqual(vol.volume.text("/ws-1/repo/package.json"), "{}");
		assert.isTrue(vol.sync.exists("/ws-1/repo/package.json"));
	});

	it("mutators write through to the same volume the ports read", () => {
		const vol = MemoryFileSystem.makeSync();
		vol.write("/r/pkg/package.json", '{"name":"a"}');
		assert.strictEqual(vol.sync.readFile("/r/pkg/package.json"), '{"name":"a"}');
		vol.write("/r/pkg/package.json", '{"name":"b"}');
		assert.strictEqual(vol.volume.text("/r/pkg/package.json"), '{"name":"b"}');
		vol.mkdir("/r/pkg/__test__");
		assert.isTrue(vol.volume.isDirectory("/r/pkg/__test__"));
		vol.symlink("/r/pkg", "/r/link");
		assert.isTrue(vol.sync.isDirectory("/r/link"));
		vol.remove("/r/pkg");
		assert.isFalse(vol.sync.exists("/r/pkg/package.json"));
	});

	it("mutator failures throw node-shaped errors, not FiberFailure", () => {
		const vol = MemoryFileSystem.makeSync({ "/f": "x" });
		const missing = thrown(() => vol.remove("/nope"));
		assert.strictEqual(missing.code, "ENOENT");
		assert.strictEqual(missing.path, "/nope");
		// node's rmSync reports the lstat it fails in, not "rm".
		assert.strictEqual(missing.syscall, "lstat");
		assert.notStrictEqual(missing.name, "FiberFailure");
		const underFile = thrown(() => vol.write("/f/child.txt", ""));
		assert.strictEqual(underFile.code, "ENOTDIR");
		assert.strictEqual(underFile.path, "/f/child.txt");
		assert.strictEqual(underFile.syscall, "open");
		assert.strictEqual(thrown(() => vol.write("/f/a/b.txt", "")).code, "ENOTDIR");
		assert.strictEqual(thrown(() => vol.symlink("/x", "/f/l")).code, "ENOTDIR");
	});

	it("a contradictory seed throws a node-shaped error synchronously", () => {
		// Seeding "/a/b" needs "/a" as a directory; a recursive mkdir over the
		// file "/a" is EEXIST, as `mkdirSync({ recursive: true })` reports it.
		const e = thrown(() => MemoryFileSystem.makeSync({ "/a": "x", "/a/b": "y" }));
		assert.strictEqual(e.code, "EEXIST");
		// node's syscall for the failing seed step, never the Effect method name.
		assert.strictEqual(e.syscall, "mkdir");
		assert.strictEqual(e.path, "/a");
		assert.notStrictEqual(e.name, "FiberFailure");
		assert.isUndefined(e._tag);
	});

	it("each seed step reports node's syscall: an invalid directory mode fails in chmod", () => {
		const e = thrown(() => MemoryFileSystem.makeSync({ "/d": MemoryFileSystem.directory({ mode: -1 }) }));
		assert.strictEqual(e.code, "EINVAL");
		assert.strictEqual(e.syscall, "chmod");
	});

	it("a bad root is EINVAL, node-shaped, naming the root", () => {
		const e = thrown(() => MemoryFileSystem.makeSync({ a: "" }, { root: "ws" }));
		assert.strictEqual(e.code, "EINVAL");
		assert.strictEqual(e.syscall, "seed");
		assert.strictEqual(e.path, "ws");
		assert.include(String(e.message), "'ws'");
		assert.isUndefined(e._tag);
	});

	it("a bad seed key is EINVAL naming the key in the path slot and the message", () => {
		const e = thrown(() => MemoryFileSystem.makeSync({ "/abs.txt": "" }, { root: "/ws" }));
		assert.strictEqual(e.code, "EINVAL");
		assert.strictEqual(e.path, "/abs.txt");
		assert.include(String(e.message), "'/abs.txt'");
	});

	it("mutators resolve relative paths against root; absolute paths are unchanged", () => {
		const vol = MemoryFileSystem.makeSync({ "a.ts": "x" }, { root: "/r/" });
		assert.strictEqual(vol.root, "/r");
		vol.write("rel.ts", "y");
		assert.strictEqual(vol.volume.text("/r/rel.ts"), "y");
		assert.isUndefined(vol.volume.text("/rel.ts"));
		vol.write("/abs.ts", "z");
		assert.strictEqual(vol.volume.text("/abs.ts"), "z");
		vol.mkdir("sub/deep");
		assert.isTrue(vol.volume.isDirectory("/r/sub/deep"));
		vol.symlink("../target/text", "sub/link");
		// Only the link path resolves; the target text is stored verbatim.
		assert.strictEqual(vol.volume.readLink("/r/sub/link"), "../target/text");
		vol.remove("rel.ts");
		assert.isFalse(vol.volume.has("/r/rel.ts"));
	});

	it("mutator paths resolve '..' AFTER following links, POSIX-style — relative and absolute alike", () => {
		const vol = MemoryFileSystem.makeSync({ link: MemoryFileSystem.symlink("/elsewhere/dir") }, { root: "/r" });
		vol.mkdir("/elsewhere/dir");
		vol.write("link/../x.txt", "x");
		vol.write("/r/link/../y.txt", "y");
		assert.strictEqual(vol.volume.text("/elsewhere/x.txt"), "x");
		assert.strictEqual(vol.volume.text("/elsewhere/y.txt"), "y");
		assert.isFalse(vol.volume.has("/r/x.txt"));
		// A missing parent reached through the link is created where the link leads.
		vol.write("link/../made/z.txt", "z");
		assert.strictEqual(vol.volume.text("/elsewhere/made/z.txt"), "z");
		assert.isFalse(vol.volume.has("/r/made"));
		// A parent that exists lexically but not after resolution is still created.
		vol.mkdir("/r/only-here");
		vol.write("link/../only-here/w.txt", "w");
		assert.strictEqual(vol.volume.text("/elsewhere/only-here/w.txt"), "w");
	});

	it("a dangling-link parent is ENOENT and a looping-link parent is ELOOP — never mkdir over the link", () => {
		const vol = MemoryFileSystem.makeSync(
			{ dang: MemoryFileSystem.symlink("/missing"), loop: MemoryFileSystem.symlink("/r/loop") },
			{ root: "/r" },
		);
		const dangling = thrown(() => vol.write("dang/x.txt", ""));
		assert.strictEqual(dangling.code, "ENOENT");
		assert.strictEqual(dangling.syscall, "open");
		assert.strictEqual(dangling.path, "dang/x.txt");
		assert.strictEqual(vol.volume.readLink("/r/dang"), "/missing");
		assert.isFalse(vol.volume.has("/missing"));
		assert.strictEqual(thrown(() => vol.write("loop/x.txt", "")).code, "ELOOP");
		assert.strictEqual(vol.volume.readLink("/r/loop"), "/r/loop");
	});

	it("a dangling or looping link ABOVE the parent reaches the call itself: ENOENT / ELOOP on open and symlink", () => {
		const vol = MemoryFileSystem.makeSync(
			{ dang: MemoryFileSystem.symlink("/missing"), loop: MemoryFileSystem.symlink("/r/loop") },
			{ root: "/r" },
		);
		const cases = [
			["dang/sub/x.txt", "ENOENT"],
			["loop/sub/x.txt", "ELOOP"],
		] as const;
		for (const [path, code] of cases) {
			const written = thrown(() => vol.write(path, ""));
			assert.strictEqual(written.code, code, `write ${path}`);
			assert.strictEqual(written.syscall, "open", `write ${path}`);
			assert.strictEqual(written.path, path);
			const linked = thrown(() => vol.symlink("t", path));
			assert.strictEqual(linked.code, code, `symlink ${path}`);
			assert.strictEqual(linked.syscall, "symlink", `symlink ${path}`);
			assert.strictEqual(linked.path, path);
		}
		assert.isFalse(vol.volume.has("/missing"));
		assert.strictEqual(vol.volume.readLink("/r/dang"), "/missing");
		assert.strictEqual(vol.volume.readLink("/r/loop"), "/r/loop");
		// A genuinely absent ancestor chain is still created.
		vol.write("a/b/c/x.txt", "x");
		assert.strictEqual(vol.volume.text("/r/a/b/c/x.txt"), "x");
		// A file two levels up is still ENOTDIR, as writeFileSync reports.
		vol.write("f", "");
		assert.strictEqual(thrown(() => vol.write("f/a/b.txt", "")).code, "ENOTDIR");
	});

	it("without a root, a relative mutator path resolves from / and creates nothing else", () => {
		const vol = MemoryFileSystem.makeSync();
		assert.isUndefined(vol.root);
		vol.write("rel.ts", "y");
		assert.strictEqual(vol.volume.text("/rel.ts"), "y");
		assert.isFalse(vol.volume.has("/r"));
		vol.write("dir/child.ts", "c");
		assert.strictEqual(vol.volume.text("/dir/child.ts"), "c");
	});

	it("a relative mutator failure reports the caller's path", () => {
		const vol = MemoryFileSystem.makeSync({ f: "x" }, { root: "/r" });
		const e = thrown(() => vol.write("f/child.txt", ""));
		assert.strictEqual(e.code, "ENOTDIR");
		assert.strictEqual(e.path, "f/child.txt");
	});

	it("withFaults returns faulted ports over the same volume; the handle's own ports stay unfaulted", async () => {
		const vol = MemoryFileSystem.makeSync({ "/a.txt": "a" });
		const { sync, promises } = vol.withFaults({
			sync: {
				readFile: (path) => {
					throw MemoryFileSystem.errno("EACCES", "open", path);
				},
			},
			promises: {
				stat: (path) => {
					throw MemoryFileSystem.errno("EACCES", "stat", path);
				},
			},
		});
		assert.strictEqual(thrown(() => sync.readFile("/a.txt")).code, "EACCES");
		assert.strictEqual(vol.sync.readFile("/a.txt"), "a");
		// same volume: a later write is visible through the faulted pair
		vol.write("/b.txt", "b");
		assert.isTrue(sync.exists("/b.txt"));
		let pending: Promise<unknown> | undefined;
		try {
			pending = promises.stat("/a.txt");
		} catch {
			assert.fail("a sync-throwing promises fault must reject, not throw");
		}
		assert.isDefined(pending);
		const rejected = await pending.then(
			() => undefined,
			(e: { code?: string }) => e.code,
		);
		assert.strictEqual(rejected, "EACCES");
		assert.isTrue((await vol.promises.stat("/a.txt")).isFile());
		assert.throws(
			() => vol.withFaults({ sync: deliberatelyInvalid<never>({ readFileSting: () => undefined }) }),
			RangeError,
			/readFileSting/,
		);
	});

	it("write accepts bytes", () => {
		const vol = MemoryFileSystem.makeSync();
		vol.write("/b/data.bin", new Uint8Array([1, 2, 3]));
		assert.deepStrictEqual([...(vol.volume.bytes("/b/data.bin") ?? [])], [1, 2, 3]);
	});

	it("mkdir over a file and symlink onto an existing path are EEXIST", () => {
		const vol = MemoryFileSystem.makeSync({ "/f": "x" });
		assert.strictEqual(thrown(() => vol.mkdir("/f")).code, "EEXIST");
		assert.strictEqual(thrown(() => vol.symlink("/x", "/f")).code, "EEXIST");
	});

	it.effect("layer is stable across provides: two programs, one volume", () =>
		Effect.gen(function* () {
			const vol = MemoryFileSystem.makeSync();
			const write = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				yield* fs.makeDirectory(path.join("/data", "repo"), { recursive: true });
			});
			const read = Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				return yield* fs.exists("/data/repo");
			});
			yield* write.pipe(Effect.provide(vol.layer));
			assert.isTrue(yield* read.pipe(Effect.provide(vol.layer)));
			assert.isTrue(vol.volume.isDirectory("/data/repo"));
		}),
	);

	it("a Promise-style suite needs no Effect import to mutate and read", async () => {
		const vol = MemoryFileSystem.makeSync({ "src/a.ts": "" }, { root: "/p" });
		const before = await vol.promises.readdir("/p/src");
		vol.write("/p/src/b.ts", "");
		const after = await vol.promises.readdir("/p/src");
		assert.deepStrictEqual([before, after], [["a.ts"], ["a.ts", "b.ts"]]);
	});
});

describe("runMutation", () => {
	it("rethrows a defect unchanged rather than converting it to an errno", () => {
		const defect = new Error("boom");
		const e = thrown(() => runMutation(Effect.die(defect), "writeFile", "/x"));
		assert.strictEqual(e, defect);
	});

	it("a typed failure without an errno cause takes its code from the tag", () => {
		const code = (tag: "NotFound" | "AlreadyExists" | "PermissionDenied" | "Unknown") =>
			thrown(() =>
				runMutation(
					Effect.fail(PlatformError.systemError({ _tag: tag, module: "FileSystem", method: "m" })),
					"makeDirectory",
					"/x",
				),
			).code;
		assert.strictEqual(code("NotFound"), "ENOENT");
		assert.strictEqual(code("AlreadyExists"), "EEXIST");
		assert.strictEqual(code("PermissionDenied"), "EACCES");
		assert.strictEqual(code("Unknown"), "EIO");
	});

	it("a BadArgument is EINVAL", () => {
		const bad = PlatformError.badArgument({ module: "FileSystem", method: "m", description: "d" });
		assert.strictEqual(thrown(() => runMutation(Effect.fail(bad), "makeDirectory", "/x")).code, "EINVAL");
	});
});
