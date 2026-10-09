// @effect-diagnostics nodeBuiltinImport:skip-file
// Differential oracle for the sync port: the same tree on a real tmpdir and in
// memfs, compared call for call. node is the reference; if they disagree the
// port is wrong, never the expectation.
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";

let host: string;
beforeAll(() => {
	host = mkdtempSync(join(tmpdir(), "memfs-ports-"));
	writeFileSync(join(host, "file.txt"), "hello");
	mkdirSync(join(host, "dir"));
	writeFileSync(join(host, "dir", "inner.txt"), "x");
	symlinkSync(join(host, "dir"), join(host, "to-dir"));
	symlinkSync(join(host, "missing"), join(host, "dangling"));
	symlinkSync(join(host, "loop-b"), join(host, "loop-a"));
	symlinkSync(join(host, "loop-a"), join(host, "loop-b"));
	symlinkSync(join(host, "file.txt", "child"), join(host, "bad-link"));
	symlinkSync(join(host, "nc-b", "x"), join(host, "nc-a"));
	symlinkSync(join(host, "nc-a"), join(host, "nc-b"));
});
afterAll(() => rmSync(host, { recursive: true, force: true }));

interface StatLike {
	isFile(): boolean;
	isDirectory(): boolean;
	isSymbolicLink(): boolean;
	size: number;
}

// `size` is compared for files only: a directory's size is host-defined.
const outcome = (f: () => unknown) => {
	try {
		const value = f();
		if (typeof value === "object" && value !== null && "isSymbolicLink" in value) {
			const s = value as StatLike;
			return {
				kind: s.isSymbolicLink() ? "symlink" : s.isDirectory() ? "directory" : "file",
				size: s.isFile() ? s.size : -1,
			};
		}
		return { value };
	} catch (e) {
		// The message is compared too, with the host prefix mapped onto the
		// memory tree's "/r": node's text is "<CODE>: <description>, <syscall> '<path>'".
		const error = e as { code: string; syscall: string; message: string; path?: string };
		return {
			code: error.code,
			syscall: error.syscall,
			message: error.message.split(host).join("/r"),
			path: error.path?.split(host).join("/r"),
		};
	}
};

// String concatenation, NOT path.join: join folds `..` lexically, which would
// hide the kernel's ENOTDIR for `file.txt/..`.
const hostPath = (name: string) => `${host}/${name}`;

const cases = [
	"file.txt",
	"dir",
	"to-dir",
	"dangling",
	"loop-a",
	"file.txt/child",
	"nope",
	"bad-link",
	"to-dir/inner.txt",
	"dir/..",
	"file.txt/..",
	"nc-a",
	// A trailing slash asserts "directory": node follows the final link and
	// fails ENOTDIR for a non-directory (even lstat), and lists a directory.
	"file.txt/",
	"dir/",
	"to-dir/",
];

const seed = {
	"/r/file.txt": "hello",
	"/r/dir/inner.txt": "x",
	"/r/to-dir": MemoryFileSystem.symlink("/r/dir"),
	"/r/dangling": MemoryFileSystem.symlink("/r/missing"),
	"/r/loop-a": MemoryFileSystem.symlink("/r/loop-b"),
	"/r/loop-b": MemoryFileSystem.symlink("/r/loop-a"),
	"/r/bad-link": MemoryFileSystem.symlink("/r/file.txt/child"),
	"/r/nc-a": MemoryFileSystem.symlink("/r/nc-b/x"),
	"/r/nc-b": MemoryFileSystem.symlink("/r/nc-a"),
};

describe("sync port parity with node:fs", () => {
	it.effect("agrees with statSync, lstatSync, readFileSync and readdirSync on every case", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle(seed);
			const sync = MemoryFileSystem.syncFileSystem(volume);
			for (const c of cases) {
				assert.deepStrictEqual(
					outcome(() => sync.stat(`/r/${c}`)),
					outcome(() => statSync(hostPath(c))),
					`stat ${c}`,
				);
				assert.deepStrictEqual(
					outcome(() => sync.lstat(`/r/${c}`)),
					outcome(() => lstatSync(hostPath(c))),
					`lstat ${c}`,
				);
				assert.deepStrictEqual(
					outcome(() => sync.readFile(`/r/${c}`)),
					outcome(() => readFileSync(hostPath(c), "utf8")),
					`readFile ${c}`,
				);
				assert.deepStrictEqual(
					outcome(() => [...sync.readDirectory(`/r/${c}`)].sort()),
					outcome(() => readdirSync(hostPath(c)).sort()),
					`readDirectory ${c}`,
				);
			}
		}),
	);

	it.effect("the promises port agrees with readdir, stat and readFile, dirents included", () =>
		Effect.gen(function* () {
			const { volume } = yield* MemoryFileSystem.makeHandle(seed);
			const fsp = MemoryFileSystem.promisesFileSystem(volume);
			const settled = (f: () => Promise<unknown>) =>
				Effect.promise(() =>
					f().then(
						(value) => ({ value }),
						(e: { code: string; syscall: string }) => ({ code: e.code, syscall: e.syscall }),
					),
				);
			const kinds = (d: { name: string; isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }) => [
				d.name,
				d.isSymbolicLink() ? "symlink" : d.isDirectory() ? "directory" : d.isFile() ? "file" : "other",
			];
			const memory = yield* Effect.promise(() => fsp.readdir("/r", { withFileTypes: true }));
			const real = readdirSync(host, { withFileTypes: true });
			assert.deepStrictEqual(memory.map(kinds).sort(), real.map(kinds).sort());
			for (const c of cases) {
				// readFile without an encoding: bytes on both sides.
				const memoryBytes = yield* settled(() => fsp.readFile(`/r/${c}`).then((b) => [...b]));
				const realBytes = yield* settled(() => Promise.resolve().then(() => [...readFileSync(hostPath(c))]));
				assert.deepStrictEqual(memoryBytes, realBytes, `promises readFile (no encoding) ${c}`);
				const memoryStat = yield* settled(() => fsp.stat(`/r/${c}`).then((s) => s.isFile()));
				const realStat = yield* settled(() => Promise.resolve().then(() => statSync(hostPath(c)).isFile()));
				assert.deepStrictEqual(memoryStat, realStat, `promises stat ${c}`);
				const memoryDir = yield* settled(() => fsp.readdir(`/r/${c}`).then((names) => [...names].sort()));
				const realDir = yield* settled(() => Promise.resolve().then(() => readdirSync(hostPath(c)).sort()));
				assert.deepStrictEqual(memoryDir, realDir, `promises readdir ${c}`);
			}
		}),
	);
});

describe("handle mutators resolve '..' after links, as the host does", () => {
	it("a write through link/.. lands where the link leads, on the host and in memfs", () => {
		const base = mkdtempSync(join(tmpdir(), "memfs-dotdot-"));
		try {
			mkdirSync(join(base, "elsewhere", "dir"), { recursive: true });
			mkdirSync(join(base, "r"));
			symlinkSync(join(base, "elsewhere", "dir"), join(base, "r", "link"));
			writeFileSync(`${base}/r/link/../abs.txt`, "h");
			assert.isTrue(existsSync(join(base, "elsewhere", "abs.txt")), "host: lands under elsewhere");
			assert.isFalse(existsSync(join(base, "r", "abs.txt")), "host: not under r");
		} finally {
			rmSync(base, { recursive: true, force: true });
		}
		const vol = MemoryFileSystem.makeSync({ link: MemoryFileSystem.symlink("/elsewhere/dir") }, { root: "/r" });
		vol.mkdir("/elsewhere/dir");
		vol.write("/r/link/../abs.txt", "m");
		vol.write("link/../rel.txt", "m");
		assert.isTrue(vol.volume.has("/elsewhere/abs.txt"));
		assert.isTrue(vol.volume.has("/elsewhere/rel.txt"));
		assert.isFalse(vol.volume.has("/r/rel.txt"));
	});
});

describe("handle mutators under a dangling or looping parent link, as the host reports", () => {
	it("dangling parent: ENOENT on open; loop parent: ELOOP — host and memfs", () => {
		const base = mkdtempSync(join(tmpdir(), "memfs-parentlink-"));
		const hostCode = (f: () => void) => {
			try {
				f();
				return "ok";
			} catch (e) {
				return (e as { code: string; syscall: string }).code;
			}
		};
		const hostCall = (f: () => void) => {
			try {
				f();
				return "ok";
			} catch (e) {
				const { code, syscall } = e as { code: string; syscall: string };
				return `${code} ${syscall}`;
			}
		};
		try {
			symlinkSync(join(base, "missing"), join(base, "dang"));
			symlinkSync(join(base, "loop"), join(base, "loop"));
			assert.strictEqual(
				hostCode(() => writeFileSync(`${base}/dang/x.txt`, "")),
				"ENOENT",
			);
			assert.strictEqual(
				hostCode(() => writeFileSync(`${base}/loop/x.txt`, "")),
				"ELOOP",
			);
			// A dangling or looping link ABOVE the direct parent.
			assert.strictEqual(
				hostCall(() => writeFileSync(`${base}/dang/sub/x.txt`, "")),
				"ENOENT open",
			);
			assert.strictEqual(
				hostCall(() => writeFileSync(`${base}/loop/sub/x.txt`, "")),
				"ELOOP open",
			);
			assert.strictEqual(
				hostCall(() => symlinkSync("t", `${base}/dang/sub/x.txt`)),
				"ENOENT symlink",
			);
			assert.strictEqual(
				hostCall(() => symlinkSync("t", `${base}/loop/sub/x.txt`)),
				"ELOOP symlink",
			);
		} finally {
			rmSync(base, { recursive: true, force: true });
		}
		const vol = MemoryFileSystem.makeSync(
			{ dang: MemoryFileSystem.symlink("/r/missing"), loop: MemoryFileSystem.symlink("/r/loop") },
			{ root: "/r" },
		);
		const memCode = (f: () => void) => {
			try {
				f();
				return "ok";
			} catch (e) {
				return (e as { code: string }).code;
			}
		};
		assert.strictEqual(
			memCode(() => vol.write("dang/x.txt", "")),
			"ENOENT",
		);
		assert.strictEqual(
			memCode(() => vol.write("loop/x.txt", "")),
			"ELOOP",
		);
		const memCall = (f: () => void) => {
			try {
				f();
				return "ok";
			} catch (e) {
				const { code, syscall } = e as { code: string; syscall: string };
				return `${code} ${syscall}`;
			}
		};
		assert.strictEqual(
			memCall(() => vol.write("dang/sub/x.txt", "")),
			"ENOENT open",
		);
		assert.strictEqual(
			memCall(() => vol.write("loop/sub/x.txt", "")),
			"ELOOP open",
		);
		assert.strictEqual(
			memCall(() => vol.symlink("t", "dang/sub/x.txt")),
			"ENOENT symlink",
		);
		assert.strictEqual(
			memCall(() => vol.symlink("t", "loop/sub/x.txt")),
			"ELOOP symlink",
		);
	});
});

describe("handle mkdir through links, as mkdirSync(p, { recursive: true }) reports (#891)", () => {
	// `mkdirSync` — not the adapter's callback `fs.mkdir` — is the reference
	// here: a dangling link earlier in the path is ENOENT for it, ENOTDIR for
	// the adapter (which the errno-parity contract pins for the engine).
	const paths = [
		"dang",
		"dang/a/b",
		"loop",
		"loop/a/b",
		"file",
		"file/a/b",
		"filesym",
		"filesym/a/b",
		"dirsym",
		"dirsym/a/b",
	] as const;
	const call = (f: () => void) => {
		try {
			f();
			return "ok";
		} catch (e) {
			const { code, syscall } = e as { code: string; syscall: string };
			return `${code} ${syscall}`;
		}
	};
	it("every path answers the host's code and syscall", () => {
		const base = mkdtempSync(join(tmpdir(), "memfs-mkdirlink-"));
		const host = new Map<string, string>();
		try {
			for (const path of paths) {
				const root = mkdtempSync(join(base, "case-"));
				symlinkSync(join(root, "missing"), join(root, "dang"));
				symlinkSync(join(root, "loop"), join(root, "loop"));
				writeFileSync(join(root, "file"), "x");
				symlinkSync(join(root, "file"), join(root, "filesym"));
				mkdirSync(join(root, "dir"));
				symlinkSync(join(root, "dir"), join(root, "dirsym"));
				host.set(
					path,
					call(() => mkdirSync(`${root}/${path}`, { recursive: true })),
				);
			}
		} finally {
			rmSync(base, { recursive: true, force: true });
		}
		for (const path of paths) {
			const vol = MemoryFileSystem.makeSync(
				{
					dang: MemoryFileSystem.symlink("/r/missing"),
					loop: MemoryFileSystem.symlink("/r/loop"),
					file: "x",
					filesym: MemoryFileSystem.symlink("/r/file"),
					"dir/.keep": "",
					dirsym: MemoryFileSystem.symlink("/r/dir"),
				},
				{ root: "/r" },
			);
			assert.strictEqual(
				call(() => vol.mkdir(path)),
				host.get(path),
				path,
			);
		}
		assert.deepStrictEqual(
			paths.map((path) => host.get(path)),
			[
				"ENOENT mkdir",
				"ENOENT mkdir",
				"ELOOP mkdir",
				"ELOOP mkdir",
				"EEXIST mkdir",
				"ENOTDIR mkdir",
				"EEXIST mkdir",
				"ENOTDIR mkdir",
				"ok",
				"ok",
			],
		);
	});
});
