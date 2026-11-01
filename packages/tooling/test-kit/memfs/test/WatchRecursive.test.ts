// Adaptation-ledger entry: watch honors core's WatchOptions.recursive, where
// upstream ignored it.

import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import { collectWatch } from "./helpers.ts";

describe("watch readiness", () => {
  it.effect("signals after subscription and retains the first mutation without yielding", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.makeWith({ "/file.txt": "original" });
      const ready = yield* Deferred.make<void>();
      let calls = 0;
      const watch = fs.watch("/file.txt", {
        onReady: () => {
          calls++;
          Deferred.doneUnsafe(ready, Exit.void);
        },
      });
      assert.strictEqual(calls, 0);
      const events = yield* watch.pipe(Stream.take(2), Stream.runCollect, Effect.forkChild);
      yield* Deferred.await(ready);
      yield* fs.writeFileString("/file.txt", "first");
      yield* fs.writeFileString("/file.txt", "second");
      assert.deepStrictEqual(yield* Fiber.join(events), [
        { _tag: "Update", path: "/file.txt" },
        { _tag: "Update", path: "/file.txt" },
      ]);
      assert.strictEqual(calls, 1);
    })
  );

  it.effect("does not signal readiness when the watched path cannot be acquired", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.make;
      let calls = 0;
      const result = yield* fs.watch("/missing", { onReady: () => calls++ }).pipe(Stream.runCollect, Effect.result);
      assertFailure(
        Result.mapError(result, (error) => error.reason._tag),
        "NotFound"
      );
      assert.strictEqual(calls, 0);
    })
  );
});

describe("watch honors WatchOptions.recursive — the port adaptation", () => {
  it.effect("a non-recursive directory watch reports direct children only", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.makeWith({ "/root/sub/existing.txt": "x" });

      // The nested write happens FIRST: if non-recursive delivered nested
      // events, it would be the collected one. Collecting the later direct
      // event proves the nested write was skipped.
      const events = yield* collectWatch(
        fs,
        "/root",
        undefined,
        1,
        Effect.gen(function* () {
          yield* fs.writeFileString("/root/sub/nested.txt", "nested");
          yield* fs.writeFileString("/root/direct.txt", "direct");
        })
      );

      assert.deepStrictEqual(events, [{ _tag: "Create", path: "/root/direct.txt" }]);
    })
  );

  it.effect("recursive: true reports nested descendants", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.makeWith({ "/root/sub/existing.txt": "x" });

      const events = yield* collectWatch(
        fs,
        "/root",
        { recursive: true },
        2,
        Effect.gen(function* () {
          yield* fs.writeFileString("/root/sub/nested.txt", "nested");
          yield* fs.writeFileString("/root/direct.txt", "direct");
        })
      );

      assert.deepStrictEqual(events, [
        { _tag: "Create", path: "/root/sub/nested.txt" },
        { _tag: "Create", path: "/root/direct.txt" },
      ]);
    })
  );

  it.effect("a file watch still reports its own updates", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.makeWith({ "/file.txt": "original" });

      const events = yield* collectWatch(fs, "/file.txt", undefined, 1, fs.writeFileString("/file.txt", "updated"));

      assert.deepStrictEqual(events, [{ _tag: "Update", path: "/file.txt" }]);
    })
  );
});

describe("independent identical watch subscriptions", () => {
  it.effect("same-path same-option watchers each receive the full ordered event sequence", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.makeWith({ "/root/sub": MemoryFileSystem.directory() });
      const first = yield* fs
        .watch("/root", { recursive: true })
        .pipe(Stream.take(2), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
      const second = yield* fs
        .watch("/root", { recursive: true })
        .pipe(Stream.take(2), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
      yield* Effect.yieldNow;
      yield* fs.writeFileString("/root/sub/first", "one");
      yield* fs.writeFileString("/root/sub/second", "two");
      const expected = [
        { _tag: "Create", path: "/root/sub/first" },
        { _tag: "Create", path: "/root/sub/second" },
      ];
      assert.deepStrictEqual(yield* Fiber.join(first), expected);
      assert.deepStrictEqual(yield* Fiber.join(second), expected);
    })
  );

  it.effect("closing one identical subscription leaves the other registered", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.makeWith({ "/root/sub": MemoryFileSystem.directory() });
      const first = yield* fs
        .watch("/root", { recursive: true })
        .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
      const second = yield* fs
        .watch("/root", { recursive: true })
        .pipe(Stream.take(2), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
      yield* Effect.yieldNow;
      yield* fs.writeFileString("/root/sub/shared", "one");
      assert.deepStrictEqual(yield* Fiber.join(first), [{ _tag: "Create", path: "/root/sub/shared" }]);
      yield* fs.writeFileString("/root/sub/surviving", "two");
      assert.deepStrictEqual(yield* Fiber.join(second), [
        { _tag: "Create", path: "/root/sub/shared" },
        { _tag: "Create", path: "/root/sub/surviving" },
      ]);
    })
  );
});
