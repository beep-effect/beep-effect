// Seeding: makeWith and layerWith seeds, the tagged entries (files with modes
// and mtimes, directories, symlinks) and the seed options (root).

import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, FileSystem } from "effect";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";

describe("MemoryFileSystem.makeWith", () => {
	it.effect("seeds files and creates their parent directories recursively", () =>
		Effect.gen(function* () {
			const fs = yield* MemoryFileSystem.makeWith({
				"/repo/package.json": `{ "name": "fixture" }`,
				"/repo/packages/a/index.ts": "export {}",
				"/bytes.bin": new Uint8Array([0, 42, 255]),
			});

			assert.strictEqual(yield* fs.readFileString("/repo/package.json"), `{ "name": "fixture" }`);
			assert.strictEqual(yield* fs.readFileString("/repo/packages/a/index.ts"), "export {}");
			assert.deepStrictEqual(yield* fs.readFile("/bytes.bin"), new Uint8Array([0, 42, 255]));
			assert.strictEqual((yield* fs.stat("/repo/packages/a")).type, "Directory");
		}),
	);

	it.effect("encodes string seeds as UTF-8", () =>
		Effect.gen(function* () {
			const fs = yield* MemoryFileSystem.makeWith({ "/utf8.txt": "héllo 👋" });
			assert.strictEqual(yield* fs.readFileString("/utf8.txt"), "héllo 👋");
			assert.strictEqual(Number((yield* fs.stat("/utf8.txt")).size), new TextEncoder().encode("héllo 👋").length);
		}),
	);

	it.effect("fails typed — never a defect — when the seed contradicts itself", () =>
		Effect.gen(function* () {
			// "/a" is seeded as a FILE, then "/a/b" needs it as a directory.
			const error = yield* Effect.flip(MemoryFileSystem.makeWith({ "/a": "file content", "/a/b": "child" }));
			assert.strictEqual(error._tag, "PlatformError");
			assert.strictEqual(error.reason._tag, "AlreadyExists");
		}),
	);
});

describe("tagged seed entries — directories, symlinks and modes", () => {
	it.effect("one seed literal describes a whole tree — files, empty dirs, symlinks, modes", () =>
		Effect.gen(function* () {
			// The downstream lockdown fixture, expressed as a single literal.
			const fs = yield* MemoryFileSystem.makeWith({
				"/root/.repos/blocked/src/a.ts": "export {}\n",
				"/root/.git/modules/.repos/blocked": MemoryFileSystem.directory(),
				"/root/tools/lock.sh": MemoryFileSystem.file("#!/bin/sh\n", { mode: 0o755 }),
				"/root/current": MemoryFileSystem.symlink("/root/.repos/blocked"),
			});

			assert.strictEqual(yield* fs.readFileString("/root/.repos/blocked/src/a.ts"), "export {}\n");
			assert.strictEqual((yield* fs.stat("/root/.git/modules/.repos/blocked")).type, "Directory");
			assert.strictEqual((yield* fs.stat("/root/tools/lock.sh")).mode & 0o7777, 0o755);
			assert.strictEqual(yield* fs.readLink("/root/current"), "/root/.repos/blocked");
		}),
	);

	it.effect("directory() seeds an empty directory — exists, is a directory, lists nothing", () =>
		Effect.gen(function* () {
			const fs = yield* MemoryFileSystem.makeWith({ "/empty": MemoryFileSystem.directory() });
			assert.isTrue(yield* fs.exists("/empty"));
			assert.strictEqual((yield* fs.stat("/empty")).type, "Directory");
			assert.deepStrictEqual(yield* fs.readDirectory("/empty"), []);
		}),
	);

	it.effect("symlink(target) answers readLink and reads through to the target", () =>
		Effect.gen(function* () {
			const fs = yield* MemoryFileSystem.makeWith({
				"/target.txt": "pointed-at",
				"/link.txt": MemoryFileSystem.symlink("/target.txt"),
			});
			assert.strictEqual(yield* fs.readLink("/link.txt"), "/target.txt");
			assert.strictEqual(yield* fs.readFileString("/link.txt"), "pointed-at");
			// stat follows the link; the entry itself is a SymbolicLink to readLink.
			assert.strictEqual((yield* fs.stat("/link.txt")).type, "File");
		}),
	);

	it.effect("a dangling symlink is legal — readLink answers, reading through fails NotFound", () =>
		Effect.gen(function* () {
			const fs = yield* MemoryFileSystem.makeWith({ "/dangling": MemoryFileSystem.symlink("/absent.txt") });
			assert.strictEqual(yield* fs.readLink("/dangling"), "/absent.txt");
			const error = yield* Effect.flip(fs.readFileString("/dangling"));
			assert.strictEqual(error.reason._tag, "NotFound");
		}),
	);

	it.effect("file and directory modes land in stat; untagged and unoptioned entries keep the defaults", () =>
		Effect.gen(function* () {
			const fs = yield* MemoryFileSystem.makeWith({
				"/locked.txt": MemoryFileSystem.file("read-only", { mode: 0o444 }),
				"/bin/run": MemoryFileSystem.file(new Uint8Array([0x7f, 0x45]), { mode: 0o755 }),
				"/plain.txt": MemoryFileSystem.file("plain"),
				"/legacy.txt": "legacy",
				"/locked-dir": MemoryFileSystem.directory({ mode: 0o555 }),
				"/default-dir": MemoryFileSystem.directory(),
			});

			assert.strictEqual((yield* fs.stat("/locked.txt")).mode & 0o7777, 0o444);
			assert.strictEqual(yield* fs.readFileString("/locked.txt"), "read-only");
			assert.strictEqual((yield* fs.stat("/bin/run")).mode & 0o7777, 0o755);
			assert.deepStrictEqual(yield* fs.readFile("/bin/run"), new Uint8Array([0x7f, 0x45]));
			assert.strictEqual((yield* fs.stat("/plain.txt")).mode & 0o7777, 0o644);
			assert.strictEqual((yield* fs.stat("/legacy.txt")).mode & 0o7777, 0o644);
			assert.strictEqual((yield* fs.stat("/locked-dir")).mode & 0o7777, 0o555);
			assert.strictEqual((yield* fs.stat("/locked-dir")).type, "Directory");
			assert.strictEqual((yield* fs.stat("/default-dir")).mode & 0o7777, 0o755);
			assert.strictEqual((yield* fs.stat("/default-dir")).type, "Directory");
		}),
	);

	it.effect("a directory mode applies even when the directory pre-exists as an earlier entry's parent", () =>
		Effect.gen(function* () {
			const fs = yield* MemoryFileSystem.makeWith({
				"/repo/src/index.ts": "export {}\n",
				"/repo/src": MemoryFileSystem.directory({ mode: 0o555 }),
			});
			assert.strictEqual((yield* fs.stat("/repo/src")).mode & 0o7777, 0o555);
			// The earlier child is untouched.
			assert.strictEqual(yield* fs.readFileString("/repo/src/index.ts"), "export {}\n");
		}),
	);

	it.effect("an invalid seed mode fails typed through makeWith, never a defect", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				MemoryFileSystem.makeWith({ "/bad.txt": MemoryFileSystem.file("x", { mode: -1 }) }),
			);
			assert.strictEqual(error._tag, "PlatformError");
			assert.strictEqual(error.reason._tag, "BadArgument");
		}),
	);

	it.effect("layerWith accepts tagged entries", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			assert.strictEqual((yield* fs.stat("/srv")).type, "Directory");
			assert.strictEqual(yield* fs.readLink("/etc/alias"), "/srv");
		}).pipe(
			Effect.provide(
				MemoryFileSystem.layerWith({
					"/srv": MemoryFileSystem.directory(),
					"/etc/alias": MemoryFileSystem.symlink("/srv"),
				}),
			),
		),
	);
});

describe("seed options: root", () => {
	it.effect("re-keys relative seed keys under root", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle(
				{ "package.json": "{}", "src/a.test.ts": "" },
				{ root: "/ws-1/repo" },
			);
			assert.deepStrictEqual(volume.paths(), ["/ws-1/repo/package.json", "/ws-1/repo/src/a.test.ts"]);
		}),
	);

	it.effect("creates the root even when the seed is empty", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({}, { root: "/pkg" });
			assert.isTrue(volume.isDirectory("/pkg"));
			assert.deepStrictEqual(volume.readDirectory("/pkg"), []);
		}),
	);

	it.effect("the empty key addresses the root itself", () =>
		Effect.gen(function* () {
			const { fileSystem, volume } = yield* MemoryFileSystem.makeHandle(
				{ "": MemoryFileSystem.directory({ mode: 0o700 }) },
				{ root: "/pkg" },
			);
			assert.isTrue(volume.isDirectory("/pkg"));
			const info = yield* fileSystem.stat("/pkg");
			assert.strictEqual(info.mode & 0o777, 0o700);
		}),
	);

	it.effect("the root is a join base, not a jail: a relative key may normalize outside it", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle(
				{ "package.json": "{}", "../extra-dir/a.ts": "x" },
				{ root: "/ws/repo" },
			);
			assert.deepStrictEqual(volume.paths(), ["/ws/extra-dir/a.ts", "/ws/repo/package.json"]);
		}),
	);

	it.effect("a key that dips out and back into the root is allowed", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({ "../ws/x.txt": "1" }, { root: "/ws" });
			assert.deepStrictEqual(volume.paths(), ["/ws/x.txt"]);
		}),
	);

	it.effect("layerWith forwards options to the Volume", () =>
		Effect.gen(function* () {
			const volume = yield* MemoryFileSystem.Volume;
			assert.deepStrictEqual(volume.paths(), ["/ws/a.txt"]);
		}).pipe(Effect.provide(MemoryFileSystem.layerWith({ "a.txt": "x" }, { root: "/ws" }))),
	);

	it.effect("layerWith forwards options alongside faults", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			assert.strictEqual(yield* fs.readFileString("/ws/a.txt"), "x");
		}).pipe(Effect.provide(MemoryFileSystem.layerWith({ "a.txt": "x" }, { root: "/ws", faults: {} }))),
	);

	it.effect("normalizes a root with a trailing slash or dot-dot", () =>
		Effect.gen(function* () {
			const a = yield* MemoryFileSystem.makeHandle({ "x.txt": "1" }, { root: "/ws/" });
			const b = yield* MemoryFileSystem.makeHandle({ "x.txt": "1" }, { root: "/ws/../ws" });
			assert.deepStrictEqual(a.volume.paths(), ["/ws/x.txt"]);
			assert.deepStrictEqual(b.volume.paths(), ["/ws/x.txt"]);
		}),
	);

	it.effect("an absolute key with a root is a typed BadArgument naming the key", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(MemoryFileSystem.makeWith({ "/abs.txt": "" }, { root: "/ws" }));
			assert.strictEqual(error.reason._tag, "BadArgument");
			assert.include(error.reason.message, "/abs.txt");
		}),
	);

	it.effect("a relative root is a typed BadArgument", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(MemoryFileSystem.makeWith({ a: "" }, { root: "ws" }));
			assert.strictEqual(error.reason._tag, "BadArgument");
		}),
	);

	it.effect("layerWith dies on a bad root (wiring-bug posture)", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(
				Effect.provide(
					Effect.gen(function* () {
						return yield* FileSystem.FileSystem;
					}),
					MemoryFileSystem.layerWith({ "/a": "" }, { root: "/ws" }),
				),
			);
			assert.isTrue(Exit.isFailure(exit) && Cause.hasDies(exit.cause));
		}),
	);

	it.effect("without options, behaviour is unchanged", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({ "/a/b.txt": "x" });
			assert.deepStrictEqual(volume.paths(), ["/a/b.txt"]);
		}),
	);
});
