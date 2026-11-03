// Adapted from upstream ReadSurfaces.test.ts (MIT).
import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { externalAppend, line, memory, open, path } from "./fixtures.ts";

it.effect("query tiles history, resumes at boundaries and skips a partial cursor line", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    yield* journal.create;
    const one = yield* journal.append("noted", { round: 1, label: "a" });
    const two = yield* journal.append("noted", { round: 2, label: "b" });
    yield* journal.append("noted", { round: 3, label: "c" });
    assert.strictEqual(two.line.offset, one.line.end);
    const resultCollect = yield* Stream.runCollect(journal.query());
    assert.deepStrictEqual(
      A.map(resultCollect, (row) => row.data),
      [
        { round: 1, label: "a" },
        { round: 2, label: "b" },
        { round: 3, label: "c" },
      ]
    );
    for (const cursor of [one.line.end, one.line.end - 1]) {
      const rows = yield* Stream.runCollect(journal.query({ events: ["noted"], cursor }));
      assert.deepStrictEqual(
        A.map(rows, (row) => row.data.round),
        [2, 3]
      );
    }
    const resultCollect1 = yield* Stream.runCollect(journal.query({ events: [] }));
    assert.deepStrictEqual(resultCollect1, []);
  })
);
it.effect("time slices are inclusive at from and exclusive at to", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    yield* journal.create;
    for (const round of [1, 2, 3]) {
      yield* TestClock.setTime(round * 1000);
      yield* journal.append("noted", { round, label: "a" });
    }
    const first = yield* Stream.runCollect(
      journal.query({ events: ["noted"], from: DateTime.makeUnsafe(1000), to: DateTime.makeUnsafe(2000) })
    );
    const second = yield* Stream.runCollect(
      journal.query({ events: ["noted"], from: DateTime.makeUnsafe(2000), to: DateTime.makeUnsafe(4000) })
    );
    assert.deepStrictEqual(
      A.map(first, (row) => row.data.round),
      [1]
    );
    assert.deepStrictEqual(
      A.map(second, (row) => row.data.round),
      [2, 3]
    );
  })
);
it.effect("frame filters skip invalid payloads while an unfiltered read reports them", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(
      path,
      `${line(1)}{"at":"2026-01-01T00:00:00Z","event":"ended","scope":"bad","data":"not-null"}\n`
    );
    const journal = yield* open(fs);
    assert.strictEqual((yield* Stream.runCollect(journal.query({ events: ["noted"] }))).length, 1);
    const resultCollect2 = yield* Stream.runCollect(journal.query({ scopes: ["absent"] }));
    assert.deepStrictEqual(resultCollect2, []);
    assertFailure(
      (yield* journal.query().pipe(Stream.runCollect, Effect.result)).pipe(Result.mapError((error) => error._tag)),
      "InvalidData"
    );
  })
);
it.effect("live changes end on a terminal event excluded by the filter", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    yield* journal.create;
    const reader = yield* journal
      .changes({ events: ["noted"] })
      .pipe(Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    yield* journal.append("noted", { round: 1, label: "a" });
    yield* journal.append("ended", null);
    const join3 = yield* Fiber.join(reader);
    assert.deepStrictEqual(
      A.map(join3, (row) => row.data.round),
      [1]
    );
    const resultCollect4 = yield* Stream.runCollect(journal.changes());
    assert.deepStrictEqual(resultCollect4, []);
  })
);
it.effect("cursor replay and live appends form one projection", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    yield* journal.create;
    const first = yield* journal.append("noted", { round: 1, label: "a" });
    yield* journal.append("noted", { round: 2, label: "a" });
    const reader = yield* journal
      .projection(0, (sum, row) => sum + row.data.round, { events: ["noted"], cursor: first.line.end })
      .pipe(Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    yield* journal.append("noted", { round: 3, label: "a" });
    yield* journal.append("ended", null);
    const join5 = yield* Fiber.join(reader);
    assert.deepStrictEqual(join5, [0, 2, 5]);
  })
);

// One read barrier decorates the shared filesystem. It does not duplicate storage,
// file metadata, append semantics or watcher behavior from MemoryFileSystem.
const gateRead = Effect.fn("JsonlTest.gateRead")(function* (fs: FileSystem.FileSystem) {
  const entered = yield* Deferred.make<void>();
  const release = yield* Deferred.make<void>();
  let armed = false;
  const decorated: FileSystem.FileSystem = {
    ...fs,
    watch: () => Stream.never,
    open: (target, options) =>
      fs.open(target, options).pipe(
        Effect.map(
          (handle): FileSystem.File => ({
            [FileSystem.FileTypeId]: FileSystem.FileTypeId,
            stat: handle.stat,
            sync: handle.sync,
            seek: (offset, from) => handle.seek(offset, from),
            read: (buffer) => handle.read(buffer),
            write: (buffer) => handle.write(buffer),
            writeAll: (buffer) => handle.writeAll(buffer),
            truncate: (length) => handle.truncate(length),
            readAlloc: Effect.fn("JsonlTest.readAlloc")(function* (size: number) {
              if (armed && size > 3) {
                armed = false;
                yield* Deferred.succeed(entered, undefined);
                yield* Deferred.await(release);
              }
              return yield* handle.readAlloc(size);
            }),
          })
        )
      ),
  };
  return {
    fs: decorated,
    entered,
    release,
    arm: Effect.sync(() => {
      armed = true;
    }),
  };
});
it.effect("a query reads only the size it statted even if an append lands during read", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1));
    const gate = yield* gateRead(fs);
    const journal = yield* open(gate.fs);
    yield* gate.arm;
    const reading = yield* journal
      .query({ events: ["noted"] })
      .pipe(Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    yield* Deferred.await(gate.entered);
    yield* externalAppend(fs, line(2));
    yield* Deferred.succeed(gate.release, undefined);
    const join6 = yield* Fiber.join(reading);
    assert.deepStrictEqual(
      A.map(join6, (row) => row.data.round),
      [1]
    );
    const resultCollect7 = yield* Stream.runCollect(journal.query({ events: ["noted"] }));
    assert.deepStrictEqual(
      A.map(resultCollect7, (row) => row.data.round),
      [1, 2]
    );
  })
);
it.effect("an append during replay is delivered exactly once at the live join", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1));
    const gate = yield* gateRead(fs);
    const journal = yield* open(gate.fs);
    yield* gate.arm;
    const reading = yield* journal
      .changes({ events: ["noted"], cursor: 0 })
      .pipe(Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    yield* Deferred.await(gate.entered);
    yield* journal.append("noted", { round: 2, label: "during" });
    yield* Deferred.succeed(gate.release, undefined);
    yield* journal.append("ended", null);
    const join8 = yield* Fiber.join(reading);
    assert.deepStrictEqual(
      A.map(join8, (row) => row.data.round),
      [1, 2]
    );
  })
);
