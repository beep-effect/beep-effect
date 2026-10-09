import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MemoryFileSystem } from "../../effected/memfs/MemoryFileSystem.ts";

it.effect("the utility class has no instance state even under reflective construction", () => Effect.sync(() => {
  assert.strictEqual(Object.getPrototypeOf(Reflect.construct(MemoryFileSystem, [])), MemoryFileSystem.prototype);
}));

it.effect("recursive mkdir reports the blocking file after a normalized empty prefix", () => Effect.gen(function* () {
  const handle = yield* MemoryFileSystem.makeHandle({ "/file": "content" });
  assert.throws(() => handle.mkdir("//file/child"), /ENOTDIR/);
  assert.strictEqual(handle.volume.text("/file"), "content");
}));

it.effect("invalid seed times retain the BadArgument-to-EINVAL translation", () => Effect.sync(() => {
  assert.throws(() => MemoryFileSystem.makeSync({ "/file": MemoryFileSystem.file("content", { mtime: NaN }) }), /EINVAL/);
}));
