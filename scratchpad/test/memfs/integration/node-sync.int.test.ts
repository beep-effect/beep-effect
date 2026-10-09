// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file
// The differential oracle for NodeSyncFileSystem: every read member it serves
// must agree with @effect/platform-node's NodeFileSystem on the same real
// directory — success values identical, failures identical in tag, method and
// errno. The node adapter is the reference; a mismatch is a NodeSyncFileSystem
// bug. Everything lives under one os.tmpdir() fixture.

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import { NodeSyncFileSystem } from "../../../effected/memfs/NodeSyncFileSystem.ts";

let d: string;
beforeAll(() => {
	d = mkdtempSync(join(tmpdir(), "memfs-node-sync-"));
	writeFileSync(join(d, "f.txt"), "hello");
	mkdirSync(join(d, "dir"));
	writeFileSync(join(d, "dir", "inner.txt"), "x");
	symlinkSync(join(d, "dir"), join(d, "to-dir"));
	symlinkSync(join(d, "missing"), join(d, "dangling"));
});
afterAll(() => rmSync(d, { recursive: true, force: true }));

const both = <A>(op: (fs: FileSystem.FileSystem) => Effect.Effect<A, PlatformError.PlatformError>) => {
	const program = Effect.gen(function* () {
		return yield* op(yield* FileSystem.FileSystem);
	});
	return Effect.all([
		Effect.exit(program.pipe(Effect.provide(NodeFileSystem.layer))),
		Effect.exit(program.pipe(Effect.provide(NodeSyncFileSystem.layer))),
	]);
};

const failureShape = (exit: Exit.Exit<unknown, PlatformError.PlatformError>) => {
	if (Exit.isSuccess(exit)) return "success";
	const failure = exit.cause.reasons.find(Cause.isFailReason);
	const error = failure?.error;
	const cause = error?.reason.cause;
	return {
		kind: error?._tag,
		reasonTag: error?.reason._tag,
		method: error?.reason.method,
		code: P.hasProperty(cause, "code") ? cause.code : undefined,
		syscall: P.hasProperty(cause, "syscall") ? cause.syscall : undefined,
	};
};

describe("NodeSyncFileSystem agrees with NodeFileSystem", () => {
	// Paths under test: fixture entries, plus two argument errors node rejects
	// before any syscall (a NUL byte, a non-string) — BadArgument, not errno.
	const paths: ReadonlyArray<readonly [label: string, path: () => string]> = [
		...["f.txt", "dir", "to-dir", "dangling", "nope", "f.txt/child"].map((p) => [p, () => join(d, p)] as const),
		["NUL byte", () => join(d, "a\0b")],
		["non-string", () => 42 as unknown as string],
	];
	for (const [p, path] of paths) {
		it.effect(`stat ${p}: File.Info or failure identical`, () =>
			Effect.gen(function* () {
				const [a, b] = yield* both((fs) => fs.stat(path()));
				if (Exit.isSuccess(a)) assert.deepStrictEqual(Exit.isSuccess(b) ? b.value : b, a.value);
				else assert.deepStrictEqual(failureShape(b), failureShape(a));
			}),
		);
		it.effect(`exists ${p}`, () =>
			Effect.gen(function* () {
				const [a, b] = yield* both((fs) => fs.exists(path()));
				if (Exit.isSuccess(a)) assert.deepStrictEqual(b, a);
				else assert.deepStrictEqual(failureShape(b), failureShape(a));
			}),
		);
		it.effect(`readFile ${p}`, () =>
			Effect.gen(function* () {
				const [a, b] = yield* both((fs) => fs.readFile(path()));
				if (Exit.isSuccess(a)) assert.deepStrictEqual(b, a);
				else assert.deepStrictEqual(failureShape(b), failureShape(a));
			}),
		);
		it.effect(`readDirectory ${p}`, () =>
			Effect.gen(function* () {
				const [a, b] = yield* both((fs) => fs.readDirectory(path()));
				if (Exit.isSuccess(a) && Exit.isSuccess(b)) assert.deepStrictEqual([...b.value].sort(), [...a.value].sort());
				else assert.deepStrictEqual(failureShape(b), failureShape(a));
			}),
		);
		it.effect(`readFileString ${p}`, () =>
			Effect.gen(function* () {
				const [a, b] = yield* both((fs) => fs.readFileString(path()));
				if (Exit.isSuccess(a)) assert.deepStrictEqual(b, a);
				else assert.deepStrictEqual(failureShape(b), failureShape(a));
			}),
		);
		it.effect(`readLink ${p}`, () =>
			Effect.gen(function* () {
				const [a, b] = yield* both((fs) => fs.readLink(path()));
				if (Exit.isSuccess(a)) assert.deepStrictEqual(b, a);
				else assert.deepStrictEqual(failureShape(b), failureShape(a));
			}),
		);
		it.effect(`realPath ${p}`, () =>
			Effect.gen(function* () {
				const [a, b] = yield* both((fs) => fs.realPath(path()));
				if (Exit.isSuccess(a)) assert.deepStrictEqual(b, a);
				else assert.deepStrictEqual(failureShape(b), failureShape(a));
			}),
		);
	}

	it.effect("readDirectory, plain and recursive", () =>
		Effect.gen(function* () {
			for (const options of [undefined, { recursive: true }] as const) {
				const [a, b] = yield* both((fs) => fs.readDirectory(d, options));
				assert.isTrue(Exit.isSuccess(a) && Exit.isSuccess(b));
				if (Exit.isSuccess(a) && Exit.isSuccess(b)) assert.deepStrictEqual([...b.value].sort(), [...a.value].sort());
			}
		}),
	);

	it.effect("readDirectory of a missing directory fails identically", () =>
		Effect.gen(function* () {
			const [a, b] = yield* both((fs) => fs.readDirectory(join(d, "nope")));
			assert.deepStrictEqual(failureShape(b), failureShape(a));
			assert.notStrictEqual(failureShape(a), "success");
		}),
	);

	it.effect("realPath through a link", () =>
		Effect.gen(function* () {
			const [a, b] = yield* both((fs) => fs.realPath(join(d, "to-dir", "inner.txt")));
			assert.isTrue(Exit.isSuccess(a));
			assert.deepStrictEqual(b, a);
		}),
	);

	// The node adapter wraps the JS `fs.realpath`, which never canonicalizes
	// case; `realpathSync.native` would. On a case-folding host (default APFS)
	// this pins the JS form; on a case-sensitive host both fail NotFound alike.
	it.effect("realPath keeps the queried case, like the node adapter", () =>
		Effect.gen(function* () {
			const [a, b] = yield* both((fs) => fs.realPath(join(d, "DIR", "INNER.txt")));
			if (Exit.isSuccess(a)) assert.deepStrictEqual(b, a);
			else assert.deepStrictEqual(failureShape(b), failureShape(a));
		}),
	);

	it("the fileSystem value reads directly, without a layer", () => {
		const viaValue = Effect.runSync(NodeSyncFileSystem.fileSystem.readFileString(join(d, "f.txt")));
		assert.strictEqual(viaValue, "hello");
	});

	it("runs under Effect.runSync", () => {
		const program = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			return yield* fs.readFileString(join(d, "f.txt"));
		});
		assert.strictEqual(Effect.runSync(program.pipe(Effect.provide(NodeSyncFileSystem.layer))), "hello");
	});

	for (const [member, run] of [
		["writeFileString", (fs: FileSystem.FileSystem) => fs.writeFileString(join(d, "w.txt"), "")],
		["makeDirectory", (fs: FileSystem.FileSystem) => fs.makeDirectory(join(d, "new"))],
		["remove", (fs: FileSystem.FileSystem) => fs.remove(join(d, "f.txt"))],
		["rename", (fs: FileSystem.FileSystem) => fs.rename(join(d, "f.txt"), join(d, "g.txt"))],
		["copyFile", (fs: FileSystem.FileSystem) => fs.copyFile(join(d, "f.txt"), join(d, "g.txt"))],
		["makeTempDirectory", (fs: FileSystem.FileSystem) => fs.makeTempDirectory()],
	] as const) {
		it(`${member} is a defect, not a typed failure, and touches nothing`, () => {
			const program = Effect.gen(function* () {
				return yield* run(yield* FileSystem.FileSystem);
			});
			const before = readdirSync(d).sort();
			const exit = Effect.runSyncExit(program.pipe(Effect.provide(NodeSyncFileSystem.layer)));
			assert.isTrue(Exit.isFailure(exit) && Cause.hasDies(exit.cause));
			assert.isFalse(Exit.isFailure(exit) && Cause.hasFails(exit.cause));
			assert.deepStrictEqual(readdirSync(d).sort(), before);
			assert.strictEqual(readFileSync(join(d, "f.txt"), "utf8"), "hello");
		});
	}
});
