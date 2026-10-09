import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CacheKey, CacheKeyBadPatternError, CacheKeyReadError } from "../../effected/github-actions/CacheKey.ts";
it.effect("cache errors name the failed input and digest defaults to eight hex digits", () => Effect.sync(() => {
  assert.strictEqual(CacheKeyReadError.make({ path: "lock" }).message, 'Could not read "lock" while deriving a cache key');
  assert.strictEqual(CacheKeyBadPatternError.make({ pattern: "[" }).message, '"[" is not a usable glob pattern');
  assert.strictEqual(CacheKey.digest("abc"), "ba7816bf");
}));

import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { systemError } from "effect/PlatformError";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";

it.layer(Layer.mergeAll(MemoryFileSystem.layerWith({ "/ws/a.txt": "a", "/ws/b.lock": "b" }), Path.layer), { timeout: "30 seconds" })((it) => {
  it.effect("a negated brace alternative filters without expanding the workspace", () => Effect.gen(function* () {
    assert.deepStrictEqual(yield* CacheKey.matchingFiles({ workspace: "/ws", patterns: ["{!*.txt,*.lock}"] }), ["/ws/b.lock"]);
  }));
});
it.layer(Layer.mergeAll(MemoryFileSystem.layerWith({ "/ws/a.txt": "a" }, {
  faults: { readDirectory: (path) => Effect.fail(systemError({
    _tag: "PermissionDenied", module: "FileSystem", method: "readDirectory", pathOrDescriptor: path,
  })) },
}), Path.layer), { timeout: "30 seconds" })((it) => {
  it.effect("a failed wildcard walk reports the directory that could not be read", () => Effect.gen(function* () {
    const error = yield* Effect.flip(CacheKey.matchingFiles({ workspace: "/ws", patterns: ["**/*.txt"] }));
    assert.instanceOf(error, CacheKeyReadError);
    assert.strictEqual(error.path, "/ws");
  }));
});
