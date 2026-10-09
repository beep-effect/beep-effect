// Kit-owned extension of the differential oracle (the vendored contract suite in
// FileSystemContract.ts is upstream's and stays unedited). It pins the error
// SHAPE of every failure the audit found memfs and the node adapter disagreeing
// on — the `_tag`, the `method`, and the errno `code` on `reason.cause` — and
// runs unchanged against BOTH MemoryFileSystem.layer and @effect/platform-node's
// real filesystem. A case listed here is exercised on both; nothing in this file
// is a disclaimer.
//
// Expectations come in three shapes:
// - one outcome: both implementations, on every platform, agree on it;
// - `{ linux, darwin }`: the real platform disagrees with itself. memfs models
//   the Linux errno, and the node run asserts whichever platform it is on;
// - `{ memory, node }`: a KNOWN divergence memfs deliberately keeps. Both sides
//   are still asserted, so a change on either side fails here and forces the
//   decision to be revisited.
//
// `pathOrDescriptor` is deliberately not asserted: node's adapter reports the
// FIRST path argument of a two-path operation (rename, copy, copyFile, link,
// symlink), memfs the one the conflict concerns.

import { assert, describe, layer } from "@effect/vitest";
import type { Layer, Scope } from "effect";
import { Cause, Effect, Exit, Result, Stream } from "effect";
import * as FileSystem from "effect/FileSystem";
import type * as PlatformError from "effect/PlatformError";

type Implementation = "memory" | "node";

interface Failure {
	readonly tag: PlatformError.SystemErrorTag | "BadArgument";
	readonly method: string;
	/** The errno `code` expected on `reason.cause`; absent for a BadArgument. */
	readonly code?: string;
}

type Outcome = "success" | Failure;

type Expectation =
	| Outcome
	| { readonly linux: Outcome; readonly darwin: Outcome }
	| { readonly memory: Outcome; readonly node: Outcome };

interface Case {
	readonly name: string;
	readonly run: (
		fs: FileSystem.FileSystem,
		path: (...segments: ReadonlyArray<string>) => string,
	) => Effect.Effect<unknown, PlatformError.PlatformError, Scope.Scope>;
	readonly expect: Expectation;
	/** An extra assertion on the success value, when the value is the point. */
	readonly check?: (
		value: unknown,
		fs: FileSystem.FileSystem,
		path: (...segments: ReadonlyArray<string>) => string,
	) => Effect.Effect<void, PlatformError.PlatformError>;
}

const fail = (tag: Failure["tag"], method: string, code?: string): Failure =>
	code === undefined ? { tag, method } : { tag, method, code };

const resolveExpectation = (expectation: Expectation, implementation: Implementation): Outcome => {
	if (expectation === "success" || "tag" in expectation) return expectation;
	if ("memory" in expectation) return expectation[implementation];
	// memfs models Linux; the node run asserts the platform it runs on.
	if (implementation === "memory" || process.platform === "linux") return expectation.linux;
	if (process.platform === "darwin") return expectation.darwin;
	throw new Error(`no errno expectation for platform ${process.platform}`);
};

const bytes = new Uint8Array([1, 2, 3, 4]);

const withHandle = (
	fs: FileSystem.FileSystem,
	file: string,
	flag: FileSystem.OpenFlag,
	use: (handle: FileSystem.File) => Effect.Effect<unknown, PlatformError.PlatformError>,
) => Effect.flatMap(fs.open(file, { flag }), use);

// A handle whose scope has already closed: every operation on it is EBADF.
const closedHandle = (fs: FileSystem.FileSystem, file: string) => Effect.scoped(fs.open(file, { flag: "r" }));

const cases: ReadonlyArray<Case> = [
	// readLink on an entry that is not a symbolic link: EINVAL, which node maps to Unknown.
	{
		name: "readLink on a regular file",
		run: (fs, p) => fs.readLink(p("file")),
		expect: fail("Unknown", "readLink", "EINVAL"),
	},
	{
		name: "readLink on a directory",
		run: (fs, p) => fs.readLink(p("dir")),
		expect: fail("Unknown", "readLink", "EINVAL"),
	},
	{
		name: "readLink on a missing path",
		run: (fs, p) => fs.readLink(p("missing")),
		expect: fail("NotFound", "readLink", "ENOENT"),
	},
	{
		name: "readLink through a symlink loop",
		run: (fs, p) => fs.readLink(p("loop1", "x")),
		expect: fail("BadResource", "readLink", "ELOOP"),
	},

	// remove: fs.rm refuses every directory without `recursive`.
	{
		name: "remove a non-empty directory without recursive",
		run: (fs, p) => fs.remove(p("full")),
		expect: fail("Unknown", "remove", "ERR_FS_EISDIR"),
	},
	{
		name: "remove an empty directory without recursive",
		run: (fs, p) => fs.remove(p("empty")),
		expect: fail("Unknown", "remove", "ERR_FS_EISDIR"),
	},
	{
		name: "remove an empty directory with force but without recursive",
		run: (fs, p) => fs.remove(p("empty"), { force: true }),
		expect: fail("Unknown", "remove", "ERR_FS_EISDIR"),
	},
	{
		name: "remove an empty directory named with a trailing slash",
		run: (fs, p) => fs.remove(`${p("empty")}/`),
		expect: fail("Unknown", "remove", "ERR_FS_EISDIR"),
	},
	{
		name: "remove a directory named with a trailing slash recursively",
		run: (fs, p) => fs.remove(`${p("full")}/`, { recursive: true }),
		expect: "success",
		check: (_, fs, p) => Effect.map(fs.exists(p("full")), (exists) => assert.isFalse(exists)),
	},
	{
		name: "remove a file named with a trailing slash",
		run: (fs, p) => fs.remove(`${p("file")}/`),
		expect: fail("BadResource", "remove", "ENOTDIR"),
	},

	// makeDirectory: a non-directory earlier in the path is ENOTDIR; as the final component, EEXIST.
	{
		name: "makeDirectory beneath a file",
		run: (fs, p) => fs.makeDirectory(p("file", "child")),
		expect: fail("BadResource", "makeDirectory", "ENOTDIR"),
	},
	{
		name: "makeDirectory recursively beneath a file",
		run: (fs, p) => fs.makeDirectory(p("file", "child", "grandchild"), { recursive: true }),
		expect: fail("BadResource", "makeDirectory", "ENOTDIR"),
	},
	{
		name: "makeDirectory onto a file",
		run: (fs, p) => fs.makeDirectory(p("file")),
		expect: fail("AlreadyExists", "makeDirectory", "EEXIST"),
	},
	{
		name: "makeDirectory of the root",
		run: (fs) => fs.makeDirectory("/"),
		expect: fail("AlreadyExists", "makeDirectory", "EEXIST"),
	},
	{
		name: "makeDirectory of the root recursively",
		run: (fs) => fs.makeDirectory("/", { recursive: true }),
		expect: "success",
	},

	// makeDirectory through symbolic links (#891). The recursive walk follows a
	// link component: a dangling one is ENOENT as the final component and — the
	// node adapter's callback `fs.mkdir`, not `mkdirSync`, which says ENOENT —
	// ENOTDIR earlier in the path; a loop is ELOOP either way. Without
	// `recursive`, a link as the final component is simply an existing entry.
	{
		name: "makeDirectory recursively onto a dangling symlink",
		run: (fs, p) => fs.makeDirectory(p("dangling"), { recursive: true }),
		expect: fail("NotFound", "makeDirectory", "ENOENT"),
	},
	{
		name: "makeDirectory recursively beneath a dangling symlink",
		run: (fs, p) => fs.makeDirectory(p("dangling", "a", "b"), { recursive: true }),
		expect: fail("BadResource", "makeDirectory", "ENOTDIR"),
	},
	{
		name: "makeDirectory recursively onto a dangling symlink named with a trailing slash",
		run: (fs, p) => fs.makeDirectory(`${p("dangling")}/`, { recursive: true }),
		expect: { linux: fail("NotFound", "makeDirectory", "ENOENT"), darwin: "success" },
	},
	{
		name: "makeDirectory onto a dangling symlink",
		run: (fs, p) => fs.makeDirectory(p("dangling")),
		expect: fail("AlreadyExists", "makeDirectory", "EEXIST"),
	},
	{
		name: "makeDirectory beneath a dangling symlink",
		run: (fs, p) => fs.makeDirectory(p("dangling", "a")),
		expect: fail("NotFound", "makeDirectory", "ENOENT"),
	},
	{
		name: "makeDirectory recursively onto a symlink loop",
		run: (fs, p) => fs.makeDirectory(p("loop1"), { recursive: true }),
		expect: fail("BadResource", "makeDirectory", "ELOOP"),
	},
	{
		name: "makeDirectory recursively beneath a symlink loop",
		run: (fs, p) => fs.makeDirectory(p("loop1", "a", "b"), { recursive: true }),
		expect: fail("BadResource", "makeDirectory", "ELOOP"),
	},
	{
		name: "makeDirectory onto a symlink loop",
		run: (fs, p) => fs.makeDirectory(p("loop1")),
		expect: fail("AlreadyExists", "makeDirectory", "EEXIST"),
	},
	{
		name: "makeDirectory recursively onto a file",
		run: (fs, p) => fs.makeDirectory(p("file"), { recursive: true }),
		expect: fail("AlreadyExists", "makeDirectory", "EEXIST"),
	},
	{
		name: "makeDirectory recursively onto a symlink to a file",
		run: (fs, p) => fs.makeDirectory(p("filesym"), { recursive: true }),
		expect: fail("AlreadyExists", "makeDirectory", "EEXIST"),
	},
	{
		name: "makeDirectory recursively beneath a symlink to a file",
		run: (fs, p) => fs.makeDirectory(p("filesym", "a", "b"), { recursive: true }),
		expect: fail("BadResource", "makeDirectory", "ENOTDIR"),
	},
	{
		name: "makeDirectory recursively onto a symlink to a directory",
		run: (fs, p) => fs.makeDirectory(p("dirsym"), { recursive: true }),
		expect: "success",
	},
	{
		name: "makeDirectory recursively beneath a symlink to a directory",
		run: (fs, p) => fs.makeDirectory(p("dirsym", "a", "b"), { recursive: true }),
		expect: "success",
		check: (_, fs, p) => Effect.map(fs.exists(p("dir", "a", "b")), (exists) => assert.isTrue(exists)),
	},

	// rename
	{
		name: "rename a directory into itself",
		run: (fs, p) => fs.rename(p("dir"), p("dir", "sub")),
		expect: fail("Unknown", "rename", "EINVAL"),
	},
	{
		name: "rename a directory over a file",
		run: (fs, p) => fs.rename(p("dir"), p("file")),
		expect: fail("BadResource", "rename", "ENOTDIR"),
	},
	{
		name: "rename a file over a directory",
		run: (fs, p) => fs.rename(p("file"), p("dir")),
		expect: fail("BadResource", "rename", "EISDIR"),
	},
	{
		name: "rename a directory over a non-empty directory",
		run: (fs, p) => fs.rename(p("dir"), p("full")),
		expect: fail("Unknown", "rename", "ENOTEMPTY"),
	},
	{
		name: "rename a file beneath a file",
		run: (fs, p) => fs.rename(p("file"), p("file2", "x")),
		expect: fail("BadResource", "rename", "ENOTDIR"),
	},
	{
		name: "rename a directory named with a trailing slash",
		run: (fs, p) => fs.rename(`${p("dir")}/`, p("moved")),
		expect: "success",
	},
	{
		name: "rename a directory onto a new trailing-slash path",
		run: (fs, p) => fs.rename(p("dir"), `${p("moved")}/`),
		expect: "success",
	},
	{
		name: "rename a file named with a trailing slash",
		run: (fs, p) => fs.rename(`${p("file")}/`, p("moved")),
		expect: fail("BadResource", "rename", "ENOTDIR"),
	},
	{
		name: "rename a file onto a new trailing-slash path",
		run: (fs, p) => fs.rename(p("file"), `${p("moved")}/`),
		expect: { linux: fail("BadResource", "rename", "ENOTDIR"), darwin: fail("NotFound", "rename", "ENOENT") },
	},

	// copyFile
	{
		name: "copyFile from a directory",
		run: (fs, p) => fs.copyFile(p("dir"), p("out")),
		expect: { linux: fail("BadResource", "copyFile", "EISDIR"), darwin: fail("Unknown", "copyFile", "ENOTSUP") },
	},
	{
		name: "copyFile onto a directory",
		run: (fs, p) => fs.copyFile(p("file"), p("dir")),
		expect: fail("BadResource", "copyFile", "EISDIR"),
	},
	{
		name: "copyFile onto a new trailing-slash path",
		run: (fs, p) => fs.copyFile(p("file"), `${p("out")}/`),
		expect: { linux: fail("BadResource", "copyFile", "EISDIR"), darwin: fail("NotFound", "copyFile", "ENOENT") },
	},

	// copy (fs.cp): same-entry and kind mismatches fail before `overwrite` is consulted.
	{
		name: "copy a directory into itself",
		run: (fs, p) => fs.copy(p("full"), p("full", "sub")),
		expect: fail("Unknown", "copy", "ERR_FS_CP_EINVAL"),
	},
	{
		name: "copy a directory onto itself",
		run: (fs, p) => fs.copy(p("full"), p("full"), { overwrite: true }),
		expect: fail("Unknown", "copy", "ERR_FS_CP_EINVAL"),
	},
	{
		name: "copy a file onto itself",
		run: (fs, p) => fs.copy(p("file"), p("file")),
		expect: fail("Unknown", "copy", "ERR_FS_CP_EINVAL"),
	},
	{
		name: "copy a file onto its own hard link",
		run: (fs, p) =>
			Effect.andThen(fs.link(p("file"), p("hardlink")), fs.copy(p("file"), p("hardlink"), { overwrite: true })),
		expect: fail("Unknown", "copy", "ERR_FS_CP_EINVAL"),
	},
	{
		name: "copy a directory onto a file",
		run: (fs, p) => fs.copy(p("full"), p("file")),
		expect: fail("Unknown", "copy", "ERR_FS_CP_DIR_TO_NON_DIR"),
	},
	{
		name: "copy a directory onto a file with overwrite",
		run: (fs, p) => fs.copy(p("full"), p("file"), { overwrite: true }),
		expect: fail("Unknown", "copy", "ERR_FS_CP_DIR_TO_NON_DIR"),
	},
	{
		name: "copy a file onto a directory",
		run: (fs, p) => fs.copy(p("file"), p("dir")),
		expect: fail("Unknown", "copy", "ERR_FS_CP_NON_DIR_TO_DIR"),
	},
	{
		name: "copy a file onto a directory with overwrite",
		run: (fs, p) => fs.copy(p("file"), p("dir"), { overwrite: true }),
		expect: fail("Unknown", "copy", "ERR_FS_CP_NON_DIR_TO_DIR"),
	},
	{
		name: "copy a tree whose file lands on a nested directory",
		run: (fs, p) =>
			Effect.andThen(
				fs.makeDirectory(p("shadow", "a"), { recursive: true }),
				fs.copy(p("full"), p("shadow"), { overwrite: true }),
			),
		expect: fail("Unknown", "copy", "ERR_FS_CP_NON_DIR_TO_DIR"),
	},
	{
		name: "copy a tree whose directory lands on a nested file",
		run: (fs, p) =>
			Effect.andThen(
				fs.makeDirectory(p("shadow", "a"), { recursive: true }),
				fs.copy(p("shadow"), p("full"), { overwrite: true }),
			),
		expect: fail("Unknown", "copy", "ERR_FS_CP_DIR_TO_NON_DIR"),
	},
	{
		name: "copy a tree with a nested kind mismatch without overwrite",
		run: (fs, p) =>
			Effect.andThen(fs.makeDirectory(p("shadow", "a"), { recursive: true }), fs.copy(p("full"), p("shadow"))),
		expect: fail("Unknown", "copy", "ERR_FS_CP_NON_DIR_TO_DIR"),
	},
	// Known divergence: without `overwrite`, fs.cp silently keeps an existing
	// destination (and merges into an existing directory); memfs fails EEXIST.
	{
		name: "copy a file onto an existing file without overwrite",
		run: (fs, p) => fs.copy(p("file"), p("file2")),
		expect: { memory: fail("AlreadyExists", "copy", "EEXIST"), node: "success" },
	},
	{
		name: "copy a directory onto an existing directory without overwrite",
		run: (fs, p) => fs.copy(p("full"), p("full2")),
		expect: { memory: fail("AlreadyExists", "copy", "EEXIST"), node: "success" },
	},
	// Known divergence: fs.cp creates missing destination parents; memfs does not.
	{
		name: "copy into a missing parent directory",
		run: (fs, p) => fs.copy(p("file"), p("missing", "out")),
		expect: { memory: fail("NotFound", "copy", "ENOENT"), node: "success" },
	},

	// open, and the file handles it returns
	{
		name: "open a directory for writing",
		run: (fs, p) => fs.open(p("dir"), { flag: "w" }),
		expect: fail("BadResource", "open", "EISDIR"),
	},
	// Known divergence: node opens a directory read-only and fails on the first
	// read; memfs refuses at open. The tag and code agree, the method does not.
	{
		name: "open a directory for reading",
		run: (fs, p) => fs.open(p("dir"), { flag: "r" }),
		expect: { memory: fail("BadResource", "open", "EISDIR"), node: "success" },
	},
	{
		name: "stream a directory",
		run: (fs, p) => Stream.runDrain(fs.stream(p("dir"))),
		expect: { memory: fail("BadResource", "open", "EISDIR"), node: fail("BadResource", "readAlloc", "EISDIR") },
	},
	{
		name: "read from a write-only handle",
		run: (fs, p) => withHandle(fs, p("file"), "w", (h) => h.read(new Uint8Array(4))),
		expect: fail("Unknown", "read", "EBADF"),
	},
	{
		name: "readAlloc from a write-only handle",
		run: (fs, p) => withHandle(fs, p("file"), "w", (h) => h.readAlloc(4)),
		expect: fail("Unknown", "readAlloc", "EBADF"),
	},
	{
		name: "write to a read-only handle",
		run: (fs, p) => withHandle(fs, p("file"), "r", (h) => h.write(bytes)),
		expect: fail("Unknown", "write", "EBADF"),
	},
	{
		name: "writeAll to a read-only handle",
		run: (fs, p) => withHandle(fs, p("file"), "r", (h) => h.writeAll(bytes)),
		expect: fail("Unknown", "writeAll", "EBADF"),
	},
	{
		name: "truncate a read-only handle",
		run: (fs, p) => withHandle(fs, p("file"), "r", (h) => h.truncate(0)),
		expect: fail("Unknown", "truncate", "EINVAL"),
	},
	{
		name: "read from a closed handle",
		run: (fs, p) => Effect.flatMap(closedHandle(fs, p("file")), (h) => h.read(new Uint8Array(4))),
		expect: fail("Unknown", "read", "EBADF"),
	},
	{
		name: "stat a closed handle",
		run: (fs, p) => Effect.flatMap(closedHandle(fs, p("file")), (h) => h.stat),
		expect: fail("Unknown", "stat", "EBADF"),
	},

	// link and symlink
	{
		name: "link to a directory",
		run: (fs, p) => fs.link(p("dir"), p("dirlink")),
		expect: fail("Unknown", "link", "EPERM"),
	},
	{
		name: "link onto an existing entry",
		run: (fs, p) => fs.link(p("file"), p("file2")),
		expect: fail("AlreadyExists", "link", "EEXIST"),
	},
	{
		name: "link onto a new trailing-slash path",
		run: (fs, p) => fs.link(p("file"), `${p("new")}/`),
		expect: fail("NotFound", "link", "ENOENT"),
	},
	{
		name: "symlink onto an existing entry",
		run: (fs, p) => fs.symlink(p("file"), p("file2")),
		expect: fail("AlreadyExists", "symlink", "EEXIST"),
	},
	{
		name: "symlink onto a directory named with a trailing slash",
		run: (fs, p) => fs.symlink(p("file"), `${p("dir")}/`),
		expect: fail("AlreadyExists", "symlink", "EEXIST"),
	},
	{
		name: "symlink onto a new trailing-slash path",
		run: (fs, p) => fs.symlink(p("file"), `${p("new")}/`),
		expect: fail("NotFound", "symlink", "ENOENT"),
	},

	// writeFile / readFile / readDirectory / stat
	{
		name: "writeFile onto a directory named with a trailing slash",
		run: (fs, p) => fs.writeFileString(`${p("dir")}/`, "x"),
		expect: fail("BadResource", "writeFile", "EISDIR"),
	},
	{
		name: "writeFile onto a new trailing-slash path",
		run: (fs, p) => fs.writeFileString(`${p("new")}/`, "x"),
		expect: { linux: fail("BadResource", "writeFile", "EISDIR"), darwin: fail("NotFound", "writeFile", "ENOENT") },
	},
	{
		name: "readFile a path with a NUL byte",
		run: (fs, p) => fs.readFile(p("a\u0000b")),
		expect: fail("BadArgument", "readFile"),
	},
	{
		name: "writeFile a path with a NUL byte",
		run: (fs, p) => fs.writeFileString(p("a\u0000b"), "x"),
		expect: fail("BadArgument", "writeFile"),
	},
	{
		name: "readFile a directory",
		run: (fs, p) => fs.readFile(p("dir")),
		expect: fail("BadResource", "readFile", "EISDIR"),
	},
	{
		name: "readDirectory a file",
		run: (fs, p) => fs.readDirectory(p("file")),
		expect: fail("BadResource", "readDirectory", "ENOTDIR"),
	},
	{ name: "stat a symlink loop", run: (fs, p) => fs.stat(p("loop1")), expect: fail("BadResource", "stat", "ELOOP") },
	{
		name: "utimes beneath a file",
		run: (fs, p) => fs.utimes(p("file", "x"), 0, 0),
		expect: fail("BadResource", "utime", "ENOTDIR"),
	},
	{
		name: "makeTempDirectory inside a file",
		run: (fs, p) => fs.makeTempDirectory({ directory: p("file") }),
		expect: fail("BadResource", "makeTempDirectory", "ENOTDIR"),
	},
	{
		name: "truncate to a negative length",
		run: (fs, p) => fs.truncate(p("file"), -1),
		expect: "success",
		check: (_, fs, p) => Effect.map(fs.readFile(p("file")), (contents) => assert.strictEqual(contents.length, 0)),
	},

	{
		name: "truncate a handle to a negative length",
		run: (fs, p) => withHandle(fs, p("file"), "r+", (h) => h.truncate(-1)),
		expect: "success",
		check: (_, fs, p) => Effect.map(fs.readFile(p("file")), (contents) => assert.strictEqual(contents.length, 0)),
	},

	// glob never fails on its root: missing, non-directory and unresolvable roots match nothing.
	{
		name: "glob from a missing root",
		run: (fs, p) => fs.glob("*", { root: p("missing") }),
		expect: "success",
		check: (value) => Effect.sync(() => assert.deepStrictEqual(value, [])),
	},
	{
		name: "glob from a file root",
		run: (fs, p) => fs.glob("*", { root: p("file") }),
		expect: "success",
		check: (value) => Effect.sync(() => assert.deepStrictEqual(value, [])),
	},
	{
		name: "glob from a symlink-loop root",
		run: (fs, p) => fs.glob("*", { root: p("loop1") }),
		expect: "success",
		check: (value) => Effect.sync(() => assert.deepStrictEqual(value, [])),
	},
];

const seedTree = Effect.fnUntraced(function* (
	fs: FileSystem.FileSystem,
	p: (...segments: ReadonlyArray<string>) => string,
) {
	yield* fs.writeFileString(p("file"), "x");
	yield* fs.writeFileString(p("file2"), "y");
	yield* fs.makeDirectory(p("dir"));
	yield* fs.makeDirectory(p("empty"));
	yield* fs.makeDirectory(p("full"));
	yield* fs.writeFileString(p("full", "a"), "a");
	yield* fs.makeDirectory(p("full2"));
	yield* fs.writeFileString(p("full2", "b"), "b");
	yield* fs.symlink(p("loop2"), p("loop1"));
	yield* fs.symlink(p("loop1"), p("loop2"));
	yield* fs.symlink(p("nowhere"), p("dangling"));
	yield* fs.symlink(p("file"), p("filesym"));
	yield* fs.symlink(p("dir"), p("dirsym"));
});

const assertOutcome = (exit: Exit.Exit<unknown, PlatformError.PlatformError>, expected: Outcome): void => {
	if (expected === "success") {
		assert.isTrue(Exit.isSuccess(exit), Exit.isFailure(exit) ? `expected success, got ${String(exit.cause)}` : "");
		return;
	}
	if (Exit.isSuccess(exit)) {
		assert.fail(`expected a ${expected.tag} failure, got success`);
		return;
	}
	const found = Cause.findError(exit.cause);
	if (Result.isFailure(found)) {
		assert.fail(`expected a typed failure, got ${String(exit.cause)}`);
		return;
	}
	const error = found.success;
	assert.strictEqual(error._tag, "PlatformError");
	assert.strictEqual(error.reason._tag, expected.tag);
	assert.strictEqual(error.reason.method, expected.method);
	if (expected.code !== undefined) {
		const cause = error.reason.cause as { readonly code?: unknown } | undefined;
		assert.strictEqual(cause?.code, expected.code);
	}
};

export const errnoSuite = (implementation: Implementation, fsLayer: Layer.Layer<FileSystem.FileSystem, unknown>) =>
	layer(fsLayer, { timeout: { seconds: 30 } })(`FileSystem errno parity (${implementation})`, (it) => {
		describe("failure shape matches the node adapter", () => {
			for (const testCase of cases) {
				it.effect(testCase.name, () =>
					Effect.scoped(
						Effect.gen(function* () {
							const fs = yield* FileSystem.FileSystem;
							const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-filesystem-errno-" });
							const p = (...segments: ReadonlyArray<string>) => [root, ...segments].join("/");
							yield* seedTree(fs, p);
							const exit = yield* Effect.exit(Effect.scoped(testCase.run(fs, p)));
							assertOutcome(exit, resolveExpectation(testCase.expect, implementation));
							if (testCase.check !== undefined && Exit.isSuccess(exit)) {
								yield* testCase.check(exit.value, fs, p);
							}
						}),
					),
				);
			}
		});
	});
