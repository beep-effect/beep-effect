import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { thrown } from "./helpers.ts";

const seeded = MemoryFileSystem.makeHandle({
	"/d/f.txt": MemoryFileSystem.file("abc", { mtime: 1_000 }),
	"/d/link": MemoryFileSystem.symlink("/d/f.txt"),
	"/d/wide": MemoryFileSystem.symlink("/d/é.txt"),
	"/d/empty": MemoryFileSystem.directory(),
});

describe("volume.lstat", () => {
	it.effect("is literal: a link reports symlink, never its target", () =>
		Effect.gen(function* () {
			const { volume } = yield* seeded;
			assert.deepStrictEqual(volume.lstat("/d/f.txt"), { kind: "file", mtimeMs: 1_000, size: 3 });
			assert.strictEqual(volume.lstat("/d/link")?.kind, "symlink");
			assert.strictEqual(volume.lstat("/d/link")?.size, "/d/f.txt".length);
			assert.strictEqual(volume.lstat("/d/empty")?.kind, "directory");
		}),
	);

	it.effect("a symlink's size is its target's UTF-8 byte length, not its character count", () =>
		Effect.gen(function* () {
			const { volume } = yield* seeded;
			assert.strictEqual("/d/é.txt".length, 8);
			assert.strictEqual(volume.lstat("/d/wide")?.size, 9);
		}),
	);

	it.effect("the root is a directory of size 0", () =>
		Effect.gen(function* () {
			const { volume } = yield* seeded;
			const root = volume.lstat("/");
			assert.strictEqual(root?.kind, "directory");
			assert.strictEqual(root?.size, 0);
		}),
	);

	it.effect("absence is undefined", () =>
		Effect.gen(function* () {
			const { volume } = yield* seeded;
			assert.isUndefined(volume.lstat("/nope"));
		}),
	);
});

describe("MemoryFileSystem.errno", () => {
	it("builds a node-shaped error", () => {
		const e = MemoryFileSystem.errno("EACCES", "open", "/secret.ts");
		assert.instanceOf(e, Error);
		assert.strictEqual(e.code, "EACCES");
		assert.strictEqual(e.syscall, "open");
		assert.strictEqual(e.path, "/secret.ts");
		assert.strictEqual(e.message, "EACCES: permission denied, open '/secret.ts'");
	});

	it("an unmapped code keeps node's format with the description 'error'", () => {
		const e = MemoryFileSystem.errno("EXDEV", "rename", "/a");
		assert.strictEqual(e.message, "EXDEV: error, rename '/a'");
		assert.strictEqual(e.code, "EXDEV");
	});

	it("a descriptor-based syscall carries no path, like node's read EISDIR", () => {
		const e = MemoryFileSystem.errno("EISDIR", "read");
		assert.strictEqual(e.message, "EISDIR: illegal operation on a directory, read");
		assert.isFalse("path" in e);
	});
});

const tree = MemoryFileSystem.makeHandle({
	"/r/file.txt": MemoryFileSystem.file("hello", { mtime: 5_000 }),
	"/r/dir/inner.txt": "x",
	"/r/to-dir": MemoryFileSystem.symlink("/r/dir"),
	"/r/dangling": MemoryFileSystem.symlink("/r/missing"),
	"/r/loop-a": MemoryFileSystem.symlink("/r/loop-b"),
	"/r/loop-b": MemoryFileSystem.symlink("/r/loop-a"),
});

describe("sync port stat/lstat", () => {
	it.effect("stat follows links; lstat does not", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const sync = MemoryFileSystem.syncFileSystem(volume);
			assert.isTrue(sync.stat("/r/to-dir").isDirectory());
			assert.isFalse(sync.stat("/r/to-dir").isSymbolicLink());
			assert.isTrue(sync.lstat("/r/to-dir").isSymbolicLink());
			assert.isFalse(sync.lstat("/r/to-dir").isDirectory());
			assert.strictEqual(sync.stat("/r/file.txt").mtimeMs, 5_000);
			assert.strictEqual(sync.stat("/r/file.txt").size, 5);
		}),
	);

	it.effect("absence throws ENOENT with code/syscall/path", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const sync = MemoryFileSystem.syncFileSystem(volume);
			assert.deepInclude(
				thrown(() => sync.stat("/r/nope")),
				{ code: "ENOENT", syscall: "stat", path: "/r/nope" },
			);
			assert.deepInclude(
				thrown(() => sync.stat("/r/dangling")),
				{ code: "ENOENT", syscall: "stat" },
			);
			assert.strictEqual(sync.lstat("/r/dangling").isSymbolicLink(), true);
		}),
	);

	it.effect("a path through a file is ENOTDIR; a cycle is ELOOP; exists stays false for both", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const sync = MemoryFileSystem.syncFileSystem(volume);
			assert.strictEqual(thrown(() => sync.stat("/r/file.txt/child")).code, "ENOTDIR");
			assert.strictEqual(thrown(() => sync.stat("/r/loop-a")).code, "ELOOP");
			assert.isFalse(sync.exists("/r/file.txt/child"));
			assert.isFalse(sync.exists("/r/loop-a"));
		}),
	);

	it.effect("a cycle spread across nested link targets still terminates as ELOOP", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({
				"/c/a": MemoryFileSystem.symlink("/c/b/x"),
				"/c/b": MemoryFileSystem.symlink("/c/a"),
			});
			const sync = MemoryFileSystem.syncFileSystem(volume);
			assert.strictEqual(thrown(() => sync.stat("/c/a")).code, "ELOOP");
		}),
	);

	it.effect("readFile and readDirectory throw node's syscalls (open, read, scandir)", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const sync = MemoryFileSystem.syncFileSystem(volume);
			assert.deepInclude(
				thrown(() => sync.readFile("/r/nope")),
				{ code: "ENOENT", syscall: "open" },
			);
			assert.deepInclude(
				thrown(() => sync.readFile("/r/dir")),
				{ code: "EISDIR", syscall: "read" },
			);
			assert.deepInclude(
				thrown(() => sync.readDirectory("/r/nope")),
				{ code: "ENOENT", syscall: "scandir" },
			);
			assert.deepInclude(
				thrown(() => sync.readDirectory("/r/file.txt")),
				{ code: "ENOTDIR", syscall: "scandir" },
			);
		}),
	);
});

describe("sync port faults", () => {
	it.effect("a handler throwing errno replaces one path; others delegate", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const sync = MemoryFileSystem.syncFileSystem(volume, {
				faults: {
					readFile: (path) => {
						if (path.endsWith("file.txt")) throw MemoryFileSystem.errno("EACCES", "open", path);
						return undefined;
					},
				},
			});
			assert.deepInclude(
				thrown(() => sync.readFile("/r/file.txt")),
				{ code: "EACCES", syscall: "open" },
			);
			assert.strictEqual(sync.readFile("/r/dir/inner.txt"), "x");
			assert.isTrue(sync.exists("/r/file.txt"));
		}),
	);

	it.effect("a handler may return a replacement value", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const sync = MemoryFileSystem.syncFileSystem(volume, { faults: { exists: () => false } });
			assert.isFalse(sync.exists("/r/file.txt"));
		}),
	);
});

describe("unknown fault keys are a wiring bug", () => {
	const typo = { readFileSting: () => undefined } as never;

	it.effect("a port rejects an unknown member name at construction, naming it", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			assert.throws(() => MemoryFileSystem.syncFileSystem(volume, { faults: typo }), RangeError, /readFileSting/);
			assert.throws(() => MemoryFileSystem.promisesFileSystem(volume, { faults: typo }), RangeError, /readFileSting/);
		}),
	);

	it.effect("makeFaulty rejects an unknown method name at construction, naming it", () =>
		Effect.gen(function* () {
			const fs = yield* MemoryFileSystem.make;
			assert.throws(() => MemoryFileSystem.makeFaulty(fs, typo), RangeError, /readFileSting/);
			assert.throws(() => MemoryFileSystem.makeFaulty(fs, () => typo), RangeError, /readFileSting/);
		}),
	);
});

describe("sync port members are unbound-safe", () => {
	it.effect("every member works when detached from the port object", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const { exists, readFile, readDirectory, isDirectory, stat, lstat } = MemoryFileSystem.syncFileSystem(volume);
			assert.isTrue(exists("/r/file.txt"));
			assert.strictEqual(readFile("/r/file.txt"), "hello");
			assert.deepStrictEqual(readDirectory("/r/dir"), ["inner.txt"]);
			assert.isTrue(isDirectory("/r/dir"));
			assert.isTrue(stat("/r/file.txt").isFile());
			assert.isTrue(lstat("/r/to-dir").isSymbolicLink());
		}),
	);
});

describe("promises port", () => {
	it.effect("readdir withFileTypes gives literal dirents", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const fsp = MemoryFileSystem.promisesFileSystem(volume);
			const dirents = yield* Effect.promise(() => fsp.readdir("/r", { withFileTypes: true }));
			const link = dirents.find((d) => d.name === "to-dir");
			assert.isDefined(link);
			assert.isTrue(link?.isSymbolicLink());
			assert.isFalse(link?.isDirectory());
			assert.isFalse(link?.isFile());
			assert.isTrue(dirents.find((d) => d.name === "file.txt")?.isFile());
			assert.deepStrictEqual(yield* Effect.promise(() => fsp.readdir("/r/dir")), ["inner.txt"]);
		}),
	);

	it.effect("rejects with node-shaped errors", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const fsp = MemoryFileSystem.promisesFileSystem(volume);
			const error = yield* Effect.flip(
				Effect.tryPromise({ try: () => fsp.stat("/r/nope"), catch: (e) => e as { code: string; syscall: string } }),
			);
			assert.strictEqual(error.code, "ENOENT");
			assert.strictEqual(error.syscall, "stat");
			const notDir = yield* Effect.flip(
				Effect.tryPromise({ try: () => fsp.readdir("/r/file.txt"), catch: (e) => e as { code: string } }),
			);
			assert.strictEqual(notDir.code, "ENOTDIR");
		}),
	);

	it.effect("stat follows, lstat does not, readFile reads through links", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const fsp = MemoryFileSystem.promisesFileSystem(volume);
			assert.isTrue((yield* Effect.promise(() => fsp.stat("/r/to-dir"))).isDirectory());
			assert.isTrue((yield* Effect.promise(() => fsp.lstat("/r/to-dir"))).isSymbolicLink());
			assert.strictEqual(yield* Effect.promise(() => fsp.readFile("/r/to-dir/inner.txt", "utf8")), "x");
		}),
	);

	it.effect("faults reject through the promise, other paths delegate", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const fsp = MemoryFileSystem.promisesFileSystem(volume, {
				faults: {
					stat: (path) =>
						path === "/r/dir" ? Promise.reject(MemoryFileSystem.errno("EACCES", "stat", path)) : undefined,
				},
			});
			const error = yield* Effect.flip(
				Effect.tryPromise({ try: () => fsp.stat("/r/dir"), catch: (e) => e as { code: string } }),
			);
			assert.strictEqual(error.code, "EACCES");
			assert.isTrue((yield* Effect.promise(() => fsp.stat("/r/file.txt"))).isFile());
		}),
	);

	it.effect("a plain readdir fault may replace the result with a names array", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const fsp = MemoryFileSystem.promisesFileSystem(volume, {
				faults: {
					readdir: (path, options) =>
						path === "/r/dir" && options === undefined ? Promise.resolve(["fake.txt"]) : undefined,
				},
			});
			assert.deepStrictEqual(yield* Effect.promise(() => fsp.readdir("/r/dir")), ["fake.txt"]);
			const dirents = yield* Effect.promise(() => fsp.readdir("/r/dir", { withFileTypes: true }));
			assert.deepStrictEqual(
				dirents.map((d) => d.name),
				["inner.txt"],
			);
		}),
	);

	it.effect("readFile without an encoding resolves bytes, with one a string — node's overloads", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const fsp = MemoryFileSystem.promisesFileSystem(volume);
			const bytes = yield* Effect.promise(() => fsp.readFile("/r/file.txt"));
			assert.instanceOf(bytes, Uint8Array);
			assert.deepStrictEqual([...bytes], [...new TextEncoder().encode("hello")]);
			assert.strictEqual(yield* Effect.promise(() => fsp.readFile("/r/file.txt", "utf8")), "hello");
			assert.strictEqual(yield* Effect.promise(() => fsp.readFile("/r/file.txt", "utf-8")), "hello");
			assert.strictEqual(yield* Effect.promise(() => fsp.readFile("/r/file.txt", { encoding: "utf8" })), "hello");
		}),
	);

	it.effect("readFile picks the string form only for a string encoding or { encoding: string }", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const fsp = MemoryFileSystem.promisesFileSystem(volume);
			const loose = fsp.readFile as (path: string, options?: unknown) => Promise<unknown>;
			assert.instanceOf(yield* Effect.promise(() => loose("/r/file.txt", { flag: "r" })), Uint8Array);
			assert.instanceOf(yield* Effect.promise(() => loose("/r/file.txt", null)), Uint8Array);
			assert.strictEqual(yield* Effect.promise(() => loose("/r/file.txt", { encoding: "utf8" })), "hello");
		}),
	);

	it.effect("a trailing slash on a file is ENOTDIR and exists is false; on a directory it lists", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const sync = MemoryFileSystem.syncFileSystem(volume);
			assert.isFalse(sync.exists("/r/file.txt/"));
			assert.deepInclude(
				thrown(() => sync.stat("/r/file.txt/")),
				{ code: "ENOTDIR", syscall: "stat" },
			);
			// The slash makes even lstat follow the final link, as on node.
			assert.isTrue(sync.lstat("/r/to-dir/").isDirectory());
			assert.isTrue(sync.lstat("/r/to-dir").isSymbolicLink());
			assert.deepStrictEqual([...sync.readDirectory("/r/dir/")], ["inner.txt"]);
		}),
	);

	it.effect("a fault handler that throws synchronously rejects, never throws", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const fsp = MemoryFileSystem.promisesFileSystem(volume, {
				faults: {
					stat: (path) => {
						throw MemoryFileSystem.errno("EACCES", "stat", path);
					},
				},
			});
			let pending: Promise<unknown> | undefined;
			try {
				pending = fsp.stat("/r/dir");
			} catch {
				assert.fail("the call threw synchronously instead of returning a rejected promise");
			}
			const error = yield* Effect.flip(
				Effect.tryPromise({ try: () => pending as Promise<unknown>, catch: (e) => e as { code: string } }),
			);
			assert.strictEqual(error.code, "EACCES");
		}),
	);

	it.effect("members are unbound-safe", () =>
		Effect.gen(function* () {
			const { volume } = yield* tree;
			const { readdir, stat, lstat, readFile } = MemoryFileSystem.promisesFileSystem(volume);
			assert.deepStrictEqual(yield* Effect.promise(() => readdir("/r/dir")), ["inner.txt"]);
			assert.isTrue((yield* Effect.promise(() => stat("/r/file.txt"))).isFile());
			assert.isTrue((yield* Effect.promise(() => lstat("/r/to-dir"))).isSymbolicLink());
			assert.strictEqual(yield* Effect.promise(() => readFile("/r/file.txt", "utf8")), "hello");
		}),
	);
});

// The sync filesystem port (effected#396 item 1b): the volume exposed through
// the six-operation `node:fs` sync subset, for code that takes an injected
// port instead of requiring `FileSystem` from the environment. Structural
// satisfaction only — this package imports nothing from the kit.
describe("MemoryFileSystem.syncFileSystem", () => {
	const seed = {
		"/repo/package.json": `{ "name": "root" }`,
		"/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
		"/repo/packages": MemoryFileSystem.directory(),
		"/repo/latest": MemoryFileSystem.symlink("/repo/package.json"),
	} as const;

	const withSync = <A>(use: (sync: ReturnType<typeof MemoryFileSystem.syncFileSystem>) => A) =>
		Effect.map(MemoryFileSystem.makeHandle(seed), ({ volume }) => use(MemoryFileSystem.syncFileSystem(volume)));

	it.effect("reads files and lists directories by name, sorted", () =>
		Effect.gen(function* () {
			yield* withSync((sync) => {
				assert.strictEqual(sync.readFile("/repo/package.json"), `{ "name": "root" }`);
				assert.deepStrictEqual(sync.readDirectory("/repo"), [
					"latest",
					"package.json",
					"packages",
					"pnpm-workspace.yaml",
				]);
				assert.isTrue(sync.exists("/repo/package.json"));
				assert.isTrue(sync.isDirectory("/repo/packages"));
				assert.isFalse(sync.isDirectory("/repo/package.json"));
			});
		}),
	);

	it.effect("an empty directory lists [] — never confused with an absent one", () =>
		Effect.gen(function* () {
			yield* withSync((sync) => {
				assert.deepStrictEqual(sync.readDirectory("/repo/packages"), []);
				assert.throws(() => sync.readDirectory("/repo/absent"), /ENOENT/);
			});
		}),
	);

	it.effect('HONEST ABSENCE: an unseeded path throws rather than answering ""', () =>
		Effect.gen(function* () {
			yield* withSync((sync) => {
				assert.isFalse(sync.exists("/repo/absent"));
				assert.throws(() => sync.readFile("/repo/absent"), /ENOENT/);
				// Reading a directory as a file is EISDIR in readFileSync — verified
				// against real node:fs — not ENOTDIR, and certainly not "".
				assert.throws(() => sync.readFile("/repo/packages"), /EISDIR/);
			});
		}),
	);

	it.effect("a symbolic link is listed by its own name and reads through to its target", () =>
		Effect.gen(function* () {
			yield* withSync((sync) => {
				assert.isTrue(sync.exists("/repo/latest"));
				// The PORT follows links even though the view under it is literal:
				// this one points at a file, so it is not a directory but IS readable.
				assert.isFalse(sync.isDirectory("/repo/latest"));
				assert.strictEqual(sync.readFile("/repo/latest"), `{ "name": "root" }`);
			});
		}),
	);

	// THE REGRESSION THIS PORT SHIPPED WITH (caught in review of #445): the view
	// underneath is deliberately literal, and answering literally here made a
	// symlinked package directory invisible to any consumer enumerating a
	// workspace — the exact failure a naive dirent fast path causes, reached
	// through the test double instead. Verified against real node:fs, which
	// resolves all four operations through links.
	it.effect("FOLLOWS LINKS like stat: a link to a directory is a directory and lists its target", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({
				"/real/pkg/package.json": `{ "name": "@x/a" }`,
				"/links/pkg": MemoryFileSystem.symlink("/real/pkg"),
			});
			const sync = MemoryFileSystem.syncFileSystem(volume);

			assert.isTrue(sync.isDirectory("/links/pkg"), "a link to a directory must read as a directory");
			assert.deepStrictEqual(sync.readDirectory("/links/pkg"), ["package.json"]);
			assert.strictEqual(sync.readFile("/links/pkg/package.json"), `{ "name": "@x/a" }`);

			// The literal view keeps its own contract underneath, unchanged.
			assert.isFalse(volume.isDirectory("/links/pkg"));
			assert.strictEqual(volume.readLink("/links/pkg"), "/real/pkg");
		}),
	);

	it.effect("a dangling link is ABSENT to the port, though the literal view still sees it", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({
				"/dangling": MemoryFileSystem.symlink("/nowhere"),
			});
			const sync = MemoryFileSystem.syncFileSystem(volume);

			// existsSync answers false for a dangling link; the port matches it.
			assert.isFalse(sync.exists("/dangling"));
			assert.isFalse(sync.isDirectory("/dangling"));
			assert.throws(() => sync.readFile("/dangling"), /ENOENT/);
			// …while the view, being literal, reports the link itself as present.
			assert.isTrue(volume.has("/dangling"));
		}),
	);

	it.effect("a relative link target resolves against the link's own directory", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({
				"/a/b/target.txt": "found",
				"/a/b/rel": MemoryFileSystem.symlink("target.txt"),
			});
			const sync = MemoryFileSystem.syncFileSystem(volume);
			assert.strictEqual(sync.readFile("/a/b/rel"), "found");
		}),
	);

	it.effect("a link cycle is absent to exists and ELOOP to readFile, as on a real filesystem", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle({
				"/loop/a": MemoryFileSystem.symlink("/loop/b"),
				"/loop/b": MemoryFileSystem.symlink("/loop/a"),
			});
			const sync = MemoryFileSystem.syncFileSystem(volume);
			assert.isFalse(sync.exists("/loop/a"));
			assert.throws(() => sync.readFile("/loop/a"), /ELOOP/);
		}),
	);

	it.effect("the virtual root lists its top-level entries", () =>
		Effect.gen(function* () {
			yield* withSync((sync) => {
				// "/" must not build the prefix "//", which would match nothing.
				assert.include(sync.readDirectory("/"), "repo");
				assert.isTrue(sync.isDirectory("/"));
			});
		}),
	);

	it.effect("thrown absence carries the node:fs errno fields a port consumer may inspect", () =>
		Effect.gen(function* () {
			yield* withSync((sync) => {
				try {
					sync.readFile("/repo/absent");
					assert.fail("readFile should have thrown on an unseeded path");
				} catch (error) {
					assert.strictEqual((error as { code?: string }).code, "ENOENT");
					assert.strictEqual((error as { syscall?: string }).syscall, "open");
					assert.strictEqual((error as { path?: string }).path, "/repo/absent");
				}
			});
		}),
	);
});
