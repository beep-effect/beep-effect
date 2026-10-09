import { assert, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import { GlobSet } from "../../../effected/glob/index.ts";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import { enumerate } from "../../../effected/workspaces/internal/enumerate.ts";
import { Traversal } from "../../../effected/workspaces/internal/traverse.ts";

const error = (tag: "NotFound" | "PermissionDenied", path: string) => PlatformError.systemError({ _tag: tag, module: "FileSystem", method: "readDirectory", pathOrDescriptor: path });
const layer = Layer.merge(MemoryFileSystem.layerWith({ "/repo/a/package.json": "{}", "/repo/b/package.json": "{}", "/repo/plain": "file" }, {
  faults: (base) => ({
    exists: (path) => path.includes("faulty") ? Effect.fail(error("PermissionDenied", path)) : base.exists(path),
    readDirectory: (path) => path === "/repo/a" ? Effect.fail(error("NotFound", path)) : path === "/repo/b" ? Effect.fail(error("PermissionDenied", path)) : base.readDirectory(path),
  }),
}), Path.layer);
it.layer(layer, { timeout: "30 seconds" })((it) => {
  it.effect("excluded, missing, and failed literal probes do not fabricate packages", () => Effect.gen(function* () {
    const globs = yield* GlobSet.compile(["a", "missing", "faulty", "!a"]);
    assert.deepStrictEqual(yield* enumerate(globs)("/repo"), []);
  }));
  it.effect("a missing root reports its absolute path", () => Effect.gen(function* () {
    const globs = yield* GlobSet.compile(["*"]);
    const failure = yield* Effect.flip(enumerate("/missing", globs));
    assert.strictEqual(failure.kind, "missingBaseDir");
    assert.strictEqual(failure.detail, "/missing");
  }));
  it.effect("vanished directories are benign while unreadable descendants fail closed", () => Effect.gen(function* () {
    assert.deepStrictEqual(yield* enumerate("/repo", yield* GlobSet.compile(["a/**"])), []);
    const failure = yield* Effect.flip(enumerate("/repo", yield* GlobSet.compile(["b/**"])));
    assert.strictEqual(failure.kind, "unreadableDirectory");
    assert.strictEqual(failure.detail, "b");
  }));
  it.effect("the root itself is named when its listing fails", () => Effect.gen(function* () {
    const failure = yield* Effect.flip(enumerate("/repo/b", yield* GlobSet.compile(["**"])));
    assert.strictEqual(failure.detail, "/repo/b");
  }));
  it.effect("a shared traversal budget stop is preserved with its wildcard pattern", () => Effect.gen(function* () {
    yield* Effect.acquireRelease(Effect.sync(() => vi.spyOn(Traversal.prototype, "charge").mockReturnValueOnce({ kind: "budgetExceeded", detail: "visited directory limit" })), (spy) => Effect.sync(() => spy.mockRestore()));
    const failure = yield* Effect.flip(enumerate("/repo", yield* GlobSet.compile(["*"])));
    assert.deepStrictEqual(failure, { kind: "budgetExceeded", detail: "visited directory limit", pattern: "*" });
  }));
});
