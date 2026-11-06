// Ported from Effect-TS/effect PR #6573 (pinned head
// c0528bd5cf12154aa95a7ceec243fd2045876853), upstream source
// packages/effect/test/MemoryFileSystem.test.ts — the memory-specific adapter
// tests. Copyright: Effectful Technologies Inc. License: MIT.
//
// Port notes: upstream's top-level `it.layer(...)` becomes the kit's
// suite-boundary `layer(...)`; `MemoryFileSystem` imports from this package
// instead of `effect/MemoryFileSystem`. The suite body is upstream's.

import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, layer } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import type * as PlatformError from "effect/PlatformError";

const encoder = new TextEncoder();

const watchEvents = Effect.fnUntraced(function* (
  path: string,
  count: number,
  mutation: Effect.Effect<void, PlatformError.PlatformError>
) {
  const fs = yield* FileSystem.FileSystem;
  const events = yield* fs
    .watch(path)
    .pipe(Stream.take(count), Stream.runCollect, Effect.forkChild({ startImmediately: true }));

  // PORT NOTE: upstream mutates immediately after the fork; the port yields
  // once so the child provably registers its subscription first (the FIFO
  // scheduler runs it to its first real suspension, past `watchers.add`).
  yield* Effect.yieldNow;
  yield* mutation;
  const join1 = yield* Fiber.join(events);
  return Array.from(join1);
});

layer(MemoryFileSystem.layer, { timeout: "30 seconds" })("FileSystem (memory-specific)", (it) => {
  describe("POSIX filesystem profile", () => {
    it.effect("should resolve dot, dot-dot, and repeated separators", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory("/paths/child", { recursive: true });
        yield* fs.writeFileString("/paths/parent.txt", "parent");
        yield* fs.writeFileString("/paths/child/./file.txt", "child");

        const realPath2 = yield* fs.realPath("/paths/child/../parent.txt");
        assert.strictEqual(realPath2, "/paths/parent.txt");
        const realPath3 = yield* fs.realPath("/paths//child//file.txt");
        assert.strictEqual(realPath3, "/paths/child/file.txt");
      })
    );

    it.effect("should operate on a final symbolic link itself when removing or renaming it", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString("/target.txt", "target");
        yield* fs.symlink("target.txt", "/link.txt");

        yield* fs.rename("/link.txt", "/renamed-link.txt");
        const readLink4 = yield* fs.readLink("/renamed-link.txt");
        assert.strictEqual(readLink4, "target.txt");
        const readFileString5 = yield* fs.readFileString("/target.txt");
        assert.strictEqual(readFileString5, "target");

        yield* fs.remove("/renamed-link.txt");
        const readFileString6 = yield* fs.readFileString("/target.txt");
        assert.strictEqual(readFileString6, "target");
      })
    );

    it.effect("should reject exclusive creation when a dangling symbolic link exists", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.symlink("missing.txt", "/dangling-link.txt");

        const exit = yield* Effect.exit(fs.writeFileString("/dangling-link.txt", "content", { flag: "wx" }));
        assertExitFailure(exit, Cause.fail(exit.pipe(Exit.findError, Result.getOrThrow)));
        const readLink7 = yield* fs.readLink("/dangling-link.txt");
        assert.strictEqual(readLink7, "missing.txt");
        const exists8 = yield* fs.exists("/missing.txt");
        assert.isFalse(exists8);
      })
    );

    it.effect("should leave both names unchanged when renaming one hard link over another", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString("/source.txt", "content");
        yield* fs.link("/source.txt", "/destination.txt");

        yield* fs.rename("/source.txt", "/destination.txt");

        const readFileString9 = yield* fs.readFileString("/source.txt");
        assert.strictEqual(readFileString9, "content");
        const readFileString10 = yield* fs.readFileString("/destination.txt");
        assert.strictEqual(readFileString10, "content");
      })
    );
  });

  it.effect("should provide one isolated virtual volume per fresh layer", () =>
    Effect.gen(function* () {
      const pipe11 = yield* MemoryFileSystem.layer.pipe(Layer.fresh, Layer.build);
      const first = Context.get(pipe11, FileSystem.FileSystem);
      yield* first.writeFileString("/shared.txt", "shared");
      const readFileString12 = yield* first.readFileString("/shared.txt");
      assert.strictEqual(readFileString12, "shared");

      const pipe13 = yield* MemoryFileSystem.layer.pipe(Layer.fresh, Layer.build);
      const fresh = Context.get(pipe13, FileSystem.FileSystem);
      const existsInFreshVolume = yield* fresh.exists("/shared.txt");

      assert.isFalse(existsInFreshVolume);
    })
  );

  it.effect("should serialize concurrent appends and exclusive creates", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const appendPath = "/concurrent-append.txt";
      const createPath = "/exclusive-create.txt";
      yield* fs.writeFileString(appendPath, "");
      const first = yield* fs.open(appendPath, { flag: "a" });
      const second = yield* fs.open(appendPath, { flag: "a" });

      yield* Effect.all([first.writeAll(encoder.encode("A")), second.writeAll(encoder.encode("B"))], {
        concurrency: "unbounded",
        discard: true,
      });

      const creates = yield* Effect.all(
        [
          fs.writeFileString(createPath, "first", { flag: "wx" }).pipe(Effect.result),
          fs.writeFileString(createPath, "second", { flag: "wx" }).pipe(Effect.result),
        ],
        { concurrency: "unbounded" }
      );

      const contents = yield* fs.readFileString(appendPath);
      assert.isTrue(contents === "AB" || contents === "BA");
      assert.strictEqual(A.filter(creates, Result.isSuccess).length, 1);
      assert.strictEqual(A.filter(creates, Result.isFailure).length, 1);
    })
  );

  it.effect("should leave bytes unchanged when file-size mutations are invalid", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = "/invalid-size.txt";
      yield* fs.writeFileString(path, "content");
      const file = yield* fs.open(path, { flag: "r+" });

      yield* file.seek(BigInt(Number.MAX_SAFE_INTEGER), "start");
      const writeExit = yield* Effect.exit(file.writeAll(new Uint8Array([1])));
      assertExitFailure(writeExit, Cause.fail(writeExit.pipe(Exit.findError, Result.getOrThrow)));

      // A negative length is NOT invalid: node clamps it to 0 (pinned in
      // ErrnoParityContract.ts), so only non-integers and unsafe integers stay here.
      for (const size of [1.5, Number.MAX_SAFE_INTEGER + 1]) {
        const exit = yield* Effect.exit(file.truncate(size));
        const error = exit.pipe(Exit.findError, Result.getOrThrow);
        assertExitFailure(exit, Cause.fail(error));
        assert.strictEqual(error.reason._tag, "BadArgument");
        assert.strictEqual(error.reason.method, "truncate");
      }

      const readFileString14 = yield* fs.readFileString(path);
      assert.strictEqual(readFileString14, "content");
    })
  );

  it.effect("should store POSIX metadata without enforcing a virtual user identity", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* TestClock.setTime(1_000);
      yield* fs.writeFileString("/metadata.txt", "content");
      yield* fs.chmod("/metadata.txt", 0o000);
      yield* fs.chown("/metadata.txt", 42, 84);
      yield* fs.utimes("/metadata.txt", 1, 2);

      const info = yield* fs.stat("/metadata.txt");
      assert.strictEqual(info.mode & 0o7777, 0o000);
      assert.strictEqual(O.getOrThrow(info.uid), 42);
      assert.strictEqual(O.getOrThrow(info.gid), 84);
      assert.strictEqual(O.getOrThrow(info.atime).getTime(), 1_000);
      assert.strictEqual(O.getOrThrow(info.mtime).getTime(), 2_000);

      yield* fs.access("/metadata.txt", { readable: true, writable: true });
    })
  );

  it.effect("should not traverse directory symbolic links while globbing", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory("/glob/real", { recursive: true });
      yield* fs.writeFileString("/glob/real/file.ts", "content");
      yield* fs.symlink("real", "/glob/linked");

      const glob15 = yield* fs.glob("**/*.ts", { root: "/glob" });
      assert.deepStrictEqual(glob15, ["real/file.ts"]);
    })
  );

  it.effect("should publish committed normalized events for memory mutations", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory("/watch-events");

      const events = yield* watchEvents(
        "/watch-events",
        6,
        Effect.gen(function* () {
          yield* fs.writeFileString("/watch-events/file.txt", "content");
          yield* fs.writeFileString("/watch-events/file.txt", "updated");
          yield* fs.remove("/watch-events/file.txt");
          yield* fs.writeFileString("/watch-events/old.txt", "content");
          yield* fs.rename("/watch-events/old.txt", "/watch-events/new.txt");
        })
      );

      assert.deepStrictEqual(events, [
        { _tag: "Create", path: "/watch-events/file.txt" },
        { _tag: "Update", path: "/watch-events/file.txt" },
        { _tag: "Remove", path: "/watch-events/file.txt" },
        { _tag: "Create", path: "/watch-events/old.txt" },
        { _tag: "Remove", path: "/watch-events/old.txt" },
        { _tag: "Create", path: "/watch-events/new.txt" },
      ]);
    })
  );

  it.effect("should publish updates through every current hard-link path", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString("/original.txt", "content");
      yield* fs.link("/original.txt", "/alias.txt");

      const events = yield* watchEvents("/alias.txt", 1, fs.writeFileString("/original.txt", "updated"));

      assert.deepStrictEqual(events, [{ _tag: "Update", path: "/alias.txt" }]);
    })
  );
});
