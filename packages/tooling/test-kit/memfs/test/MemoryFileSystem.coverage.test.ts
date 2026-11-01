import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";

it.effect("the utility class has no instance state even under reflective construction", () =>
  Effect.sync(() => {
    assert.strictEqual(Object.getPrototypeOf(Reflect.construct(MemoryFileSystem, [])), MemoryFileSystem.prototype);
  })
);

it.effect("recursive mkdir reports the blocking file after a normalized empty prefix", () =>
  Effect.gen(function* () {
    const handle = yield* MemoryFileSystem.makeHandle({ "/file": "content" });
    assert.throws(() => handle.mkdir("//file/child"), /ENOTDIR/);
    assert.strictEqual(handle.volume.text("/file"), "content");
  })
);

it.effect("invalid seed times retain the BadArgument-to-EINVAL translation", () =>
  Effect.sync(() => {
    assert.throws(
      () => MemoryFileSystem.makeSync({ "/file": MemoryFileSystem.file("content", { mtime: Number.NaN }) }),
      /EINVAL/
    );
  })
);

it.layer(MemoryFileSystem.layerWith({ "/dir/file.txt": "x", "/dir/nested/inner.txt": "y" }))((it) =>
  it.effect("readDirectoryEntries reports each entry's own type and refuses a file path", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.symlink("/dir/file.txt", "/dir/link");
      const entries = yield* fs.readDirectoryEntries("/dir");
      const typeOf = (name: string) =>
        A.findFirst(entries, (entry) => entry.name === name).pipe(O.map((entry) => entry.type));
      assert.deepStrictEqual(typeOf("file.txt"), O.some("File"));
      assert.deepStrictEqual(typeOf("link"), O.some("SymbolicLink"));
      assert.deepStrictEqual(typeOf("nested"), O.some("Directory"));
      const failure = yield* Effect.flip(fs.readDirectoryEntries("/dir/file.txt"));
      assert.include(failure.message, "BadResource: FileSystem.readDirectoryEntries");
    })
  )
);
