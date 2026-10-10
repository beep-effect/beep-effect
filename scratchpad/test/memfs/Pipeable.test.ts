import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { errnoError, nodeErrno } from "../../effected/memfs/internal/errno.ts";
import { assertKnownFaultKeys, wrapFaulty } from "../../effected/memfs/internal/faults.ts";
import { resolvePath, runMutation, runNode, withFaults } from "../../effected/memfs/internal/ports.ts";
import { applyRoot } from "../../effected/memfs/internal/seed.ts";
import { denied, thrown } from "./helpers.ts";

describe("memfs pipeable helpers", () => {
	it("preserves errno metadata and descriptions in both call forms", () => {
		for (const description of [undefined, "ENOENT", "custom description"]) {
			const direct = errnoError("readFile", "/missing", "ENOENT", description);
			const piped = pipe("readFile", errnoError("/missing", "ENOENT", description));
			assert.deepStrictEqual(piped.reason, direct.reason);
		}
		for (const path of [undefined, "/missing"]) {
			const direct = nodeErrno("ENOENT", "open", path);
			const piped = pipe("ENOENT", nodeErrno("open", path));
			assert.strictEqual(piped.message, direct.message);
			assert.strictEqual(piped.code, direct.code);
			assert.strictEqual(piped.errno, direct.errno);
			assert.strictEqual(piped.path, direct.path);
		}
		assert.deepStrictEqual(pipe("readFile", denied("/missing")).reason, denied("readFile", "/missing").reason);
	});

	it("preserves root normalization and validation in both call forms", () => {
		const seed = { "a.txt": "a" };
		for (const root of [undefined, "/work/./repo", "relative"]) {
			assert.deepStrictEqual(pipe(seed, applyRoot(root)), applyRoot(seed, root));
		}
	});

	it.effect("dispatches fault wrappers with omitted and explicit async options", () => Effect.gen(function* () {
		const port = { read: () => "original" };
		const faults = { read: () => "fault" };
		assert.strictEqual(pipe(port, withFaults<typeof port>(undefined, "port")), port);
		assert.strictEqual(pipe(port, withFaults<typeof port>(faults, "port")).read(), "fault");
		assert.strictEqual(pipe(port, withFaults<typeof port>(faults, "port", false)).read(), "fault");
		assert.strictEqual(yield* Effect.promise(() => Promise.resolve(pipe(port, withFaults<typeof port>(faults, "port", true)).read())), "fault");
		pipe(faults, assertKnownFaultKeys(port, "port"));
		assert.strictEqual(
			thrown(() => pipe({ missing: () => undefined }, assertKnownFaultKeys(port, "port"))).message,
			thrown(() => assertKnownFaultKeys({ missing: () => undefined }, port, "port")).message,
		);
	}));

	it.effect("preserves link resolution, filesystem faults and synchronous error translation", () =>
		Effect.gen(function* () {
			const { fileSystem, volume } = yield* MemoryFileSystem.makeHandle({ "/a.txt": "a" });
			yield* fileSystem.symlink("/a.txt", "/link");
			for (const followFinal of [undefined, false, true]) {
				assert.deepStrictEqual(pipe(volume, resolvePath("/link", followFinal)), resolvePath(volume, "/link", followFinal));
			}
			assert.deepStrictEqual(pipe(volume, resolvePath("/link")), resolvePath(volume, "/link"));
			const faulty = pipe(fileSystem, wrapFaulty({ readFile: () => Effect.fail(denied("readFile", "/a.txt")) }));
			assert.strictEqual((yield* Effect.flip(faulty.readFile("/a.txt"))).reason._tag, "PermissionDenied");
			assert.strictEqual(pipe(Effect.succeed(42), runNode(() => ({ syscall: "read", path: "/a.txt" }))), 42);
			pipe(Effect.void, runMutation("writeFile", "/a.txt"));
			assert.strictEqual(
				thrown(() => pipe(Effect.fail(denied("writeFile", "/a.txt")), runMutation("writeFile", "/a.txt"))).code,
				"EACCES",
			);
		}),
	);
});
