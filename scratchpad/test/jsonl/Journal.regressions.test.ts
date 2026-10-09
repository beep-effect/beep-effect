import { Envelope } from "../../effected/jsonl/index.ts";
import { assert, it } from "@effect/vitest";
import { assertFailure, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { at, events, externalAppend, line, memory, open, path } from "./fixtures.ts";

it.effect("patch catches up a completed foreign snapshot before deriving data", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    yield* journal.create;
    yield* journal.append("noted", { round: 1, label: "old" });
    const reader = yield* journal
      .changes({ events: ["noted"] })
      .pipe(Stream.take(2), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    yield* externalAppend(fs, line(10, "foreign"));
    const patched = yield* journal.appendPatch("noted", { round: 11 });
    assert.deepStrictEqual(patched.data, { round: 11, label: "foreign" });
    assert.deepStrictEqual(
      A.map(yield* Fiber.join(reader), (row) => row.data.round),
      [10, 11]
    );
  })
);
it.effect("foreign terminal is published even when it refuses the attempted append", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    yield* journal.create;
    const reader = yield* journal.changes().pipe(Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    const terminal = yield* Envelope.encode({ at, event: "ended", data: null }, events);
    yield* externalAppend(fs, terminal);
    assertFailure(
      (yield* Effect.result(journal.append("noted", { round: 1, label: "refused" }))).pipe(
        Result.mapError((error) => error._tag)
      ),
      "TerminalViolation"
    );
    assert.strictEqual(yield* fs.readFileString(path), terminal);
    assert.deepStrictEqual(
      A.map(yield* Fiber.join(reader), (row) => row.event),
      ["ended"]
    );
    assert.isTrue(yield* journal.quiescent);
    yield* journal.append("reopened", null);
  })
);
it.effect("invalid patch still publishes foreign state without writing invalid bytes", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    yield* journal.create;
    const reader = yield* journal
      .changes({ events: ["noted"] })
      .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    yield* externalAppend(fs, line(10, "foreign"));
    assertFailure(
      (yield* Effect.result(journal.appendPatch("noted", { round: Number.NaN }))).pipe(
        Result.mapError((error) => error._tag)
      ),
      "InvalidData"
    );
    assert.strictEqual(yield* fs.readFileString(path), line(10, "foreign"));
    assert.deepStrictEqual(
      A.map(yield* Fiber.join(reader), (row) => row.data.round),
      [10]
    );
  })
);
for (const tail of ["{", "4", Str.slice(0, -1)(line(2))]) {
  it.effect(`unterminated tail ${Str.slice(0, 10)(tail)} refuses append without mutation`, () =>
    Effect.gen(function* () {
      const fs = yield* memory();
      const seed = line(1) + tail;
      yield* fs.writeFileString(path, seed);
      const journal = yield* open({ ...fs, watch: () => Stream.never });
      assertFailure(
        (yield* Effect.result(journal.append("noted", { round: 3, label: "refused" }))).pipe(
          Result.mapError((error) => error._tag)
        ),
        "JournalUnterminated"
      );
      assert.strictEqual(yield* fs.readFileString(path), seed);
      assert.deepStrictEqual(
        A.map(yield* Stream.runCollect(journal.query({ events: ["noted"] })), (row) => row.data.round),
        [1]
      );
    })
  );
}
for (const capacity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
  it.effect(`capacity ${capacity} fails through InvalidJournalConfig`, () =>
    Effect.gen(function* () {
      const fs = yield* memory();
      assertFailure(
        (yield* Effect.result(open(fs, { path, capacity }))).pipe(Result.mapError((error) => error._tag)),
        "InvalidJournalConfig"
      );
    })
  );
}
for (const cursor of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
  it.effect(`cursor ${cursor} fails through InvalidSlice on every reader`, () =>
    Effect.gen(function* () {
      const fs = yield* memory();
      const journal = yield* open(fs);
      yield* journal.create;
      for (const reading of [
        journal.query({ cursor }).pipe(Stream.as(undefined)),
        journal.changes({ cursor }).pipe(Stream.as(undefined)),
        journal.projection(0, (state) => state, { cursor }).pipe(Stream.as(undefined)),
      ]) {
        assertFailure(
          (yield* reading.pipe(Stream.runCollect, Effect.result)).pipe(Result.mapError((error) => error._tag)),
          "InvalidSlice"
        );
      }
    })
  );
}
for (const bom of ["", "\ufeff"]) {
  for (const cursor of [0, new TextEncoder().encode(line(1)).length]) {
    it.effect(`query and replay fix their sampled range with BOM${bom.length} cursor${cursor}`, () =>
      Effect.gen(function* () {
        const fs = yield* memory();
        yield* fs.writeFileString(path, bom + line(1) + line(2));
        let reads = 0;
        let armed = false;
        const decorated: FileSystem.FileSystem = {
          ...fs,
          watch: () => Stream.never,
          open: Effect.fn("JsonlTest.injectBeforeRange")(function* (target, options) {
            if (armed && options?.flag === "r" && ++reads === 2) {
              armed = false;
              yield* externalAppend(fs, line(3));
            }
            return yield* fs.open(target, options);
          }),
        };
        const journal = yield* open(decorated);
        armed = true;
        const expected = cursor === 0 ? [1, 2] : [2];
        assert.deepStrictEqual(
          A.map(yield* Stream.runCollect(journal.query({ events: ["noted"], cursor })), (row) => row.data.round),
          expected
        );
        yield* fs.writeFileString(path, bom + line(1) + line(2));
        reads = 0;
        armed = true;
        assert.deepStrictEqual(
          A.map(
            yield* journal.changes({ events: ["noted"], cursor }).pipe(Stream.take(expected.length), Stream.runCollect),
            (row) => row.data.round
          ),
          expected
        );
      })
    );
  }
}
it.effect("BOM file created after missing startup is readable and appends at logical offsets", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    yield* fs.writeFileString(path, "\ufeff" + line(1));
    assert.strictEqual((yield* Stream.runCollect(journal.query())).length, 1);
    const second = yield* journal.append("noted", { round: 2, label: "ours" });
    assert.strictEqual(second.line.offset, new TextEncoder().encode(line(1)).length);
  })
);
it.effect("postwrite growth returns typed conflict and next append reconciles physical order", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    let inject = false;
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
              readAlloc: (size) => handle.readAlloc(size),
              write: (buffer) => handle.write(buffer),
              truncate: (length) => handle.truncate(length),
              writeAll: Effect.fn("JsonlTest.injectAfterWrite")(function* (bytes) {
                yield* handle.writeAll(bytes);
                if (inject) {
                  inject = false;
                  yield* externalAppend(fs, line(2, "foreign"));
                }
              }),
            })
          )
        ),
    };
    const journal = yield* open(decorated);
    yield* journal.create;
    const reader = yield* journal
      .changes({ events: ["noted"] })
      .pipe(Stream.take(3), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    inject = true;
    assertFailure(
      (yield* Effect.result(journal.append("noted", { round: 1, label: "ours" }))).pipe(
        Result.mapError((error) => error._tag)
      ),
      "JournalWriteConflict"
    );
    yield* journal.append("noted", { round: 3, label: "ours" });
    const rows = yield* Fiber.join(reader);
    assert.deepStrictEqual(
      A.map(rows, (row) => row.data.round),
      [1, 2, 3]
    );
    assert.strictEqual(rows[0]?.line.offset, 0);
    assert.strictEqual(rows[1]?.line.offset, rows[0]?.line.end);
    assert.strictEqual(rows[2]?.line.offset, rows[1]?.line.end);
  })
);

for (const bom of ["", "\ufeff"]) {
  for (const terminal of [false, true]) {
    it.effect(`seeded unterminated ${terminal ? "terminal" : "Unicode snapshot"} completes with BOM${bom.length}`, () =>
      Effect.gen(function* () {
        const fs = yield* memory();
        const whole = terminal ? yield* Envelope.encode({ at, event: "ended", data: null }, events) : line(2, "😀完成");
        const torn = terminal ? Str.slice(0, -1)(whole) : Str.slice(0, 20)(whole);
        yield* fs.writeFileString(path, bom + line(1) + torn);
        const registered = yield* Deferred.make<void>();
        const decorated: FileSystem.FileSystem = {
          ...fs,
          watch: (target, options) =>
            Stream.unwrap(
              Effect.gen(function* () {
                const source = yield* fs.watch(target, options).pipe(Stream.toQueue({ capacity: "unbounded" }));
                yield* Deferred.succeed(registered, undefined);
                return Stream.fromQueue(source);
              })
            ),
        };
        const journal = yield* open(decorated);
        yield* Deferred.await(registered);
        assert.isFalse(yield* journal.quiescent);
        assertSome(
          O.map(yield* SubscriptionRef.get(journal.latest), (row) => row.event),
          "noted"
        );
        const reader = yield* journal
          .changes({ cursor: new TextEncoder().encode(line(1)).length })
          .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
        yield* externalAppend(fs, Str.slice(torn.length)(whole));
        const observed = yield* Fiber.join(reader);
        assert.deepStrictEqual(
          A.map(observed, (row) => row.event),
          [terminal ? "ended" : "noted"]
        );
        assertSome(
          O.map(yield* SubscriptionRef.get(journal.latest), (row) => row.event),
          terminal ? "ended" : "noted"
        );
        assert.strictEqual(yield* journal.quiescent, terminal);
      })
    );
  }
}
it.effect("growth after the seed read remains pending for the first catchup", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1));
    let inject = true;
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
              writeAll: (bytes) => handle.writeAll(bytes),
              write: (buffer) => handle.write(buffer),
              truncate: (length) => handle.truncate(length),
              readAlloc: Effect.fn("JsonlTest.growAfterSeedRead")(function* (size) {
                const bytes = yield* handle.readAlloc(size);
                if (inject && size > 3) {
                  inject = false;
                  yield* externalAppend(fs, line(2));
                }
                return bytes;
              }),
            })
          )
        ),
    };
    const journal = yield* open(decorated);
    const latest = yield* SubscriptionRef.changes(journal.latest).pipe(
      Stream.filter((value) => O.exists(value, (row) => row.event === "noted" && row.data.round === 2)),
      Stream.runHead
    );
    assertSome(O.flatten(latest).pipe(O.map((row) => row.event)), "noted");
  })
);

it.effect("a partial failed write leaves a recoverable tail that refuses later local appends", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    let fail = false;
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
              readAlloc: (size) => handle.readAlloc(size),
              write: (buffer) => handle.write(buffer),
              truncate: (length) => handle.truncate(length),
              writeAll: Effect.fn("JsonlTest.failPartialWrite")(function* (bytes) {
                if (fail) {
                  fail = false;
                  yield* handle.writeAll(bytes.subarray(0, 20));
                  // A real missing-resource failure supplies the injected platform error.
                  yield* fs.readFile("/journal/missing");
                }
                yield* handle.writeAll(bytes);
              }),
            })
          )
        ),
    };
    const journal = yield* open(decorated);
    yield* journal.create;
    fail = true;
    assertFailure(
      (yield* Effect.result(journal.append("noted", { round: 1, label: "partial" }))).pipe(
        Result.mapError((error) => error._tag)
      ),
      "PlatformError"
    );
    const prefix = yield* fs.readFileString(path);
    assertFailure(
      (yield* Effect.result(journal.append("noted", { round: 2, label: "refused" }))).pipe(
        Result.mapError((error) => error._tag)
      ),
      "JournalUnterminated"
    );
    assert.strictEqual(yield* fs.readFileString(path), prefix);
  })
);
it.effect("interrupting a suspended publisher passes its baton to later appends", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open({ ...fs, watch: () => Stream.never }, { path, capacity: 1 });
    yield* journal.create;
    const subscription = yield* PubSub.subscribe(journal.hub);
    yield* journal.append("noted", { round: 1, label: "filled" });
    const cancelled = yield* journal
      .append("noted", { round: 2, label: "cancelled" })
      .pipe(Effect.forkChild({ startImmediately: true }));
    yield* SubscriptionRef.changes(journal.latest).pipe(
      Stream.filter((value) => O.exists(value, (row) => row.event === "noted" && row.data.round === 2)),
      Stream.runHead
    );
    yield* Fiber.interrupt(cancelled);
    const later = yield* journal
      .append("noted", { round: 3, label: "later" })
      .pipe(Effect.forkChild({ startImmediately: true }));
    yield* PubSub.take(subscription);
    assert.strictEqual((yield* Fiber.join(later)).data.round, 3);
    yield* PubSub.take(subscription);
  })
);

it.effect("replacement of a BOM file reports the replacement's logical size", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, "\ufeff" + line(1));
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    yield* fs.writeFileString("/journal/new", "");
    yield* fs.rename("/journal/new", path);
    const result = yield* Effect.result(journal.append("noted", { round: 2, label: "refused" }));
    assertFailure(
      Result.mapError(result, (error) =>
        error._tag === "JournalResync" ? { reason: error.reason, actual: error.actual } : error._tag
      ),
      { reason: "replaced", actual: 0 }
    );
    assert.strictEqual((yield* journal.append("noted", { round: 2, label: "new" })).line.offset, 0);
  })
);
it.effect("replacement during the seed read retains the old identity for resync detection", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1));
    const observed = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    let replaced = false;
    let watching = false;
    let gated = false;
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: () => {
        watching = true;
        return Stream.never;
      },
      stat: Effect.fn("JsonlTest.gateReplacementStat")(function* (target) {
        if (watching && !gated) {
          gated = true;
          yield* Deferred.succeed(observed, undefined);
          yield* Deferred.await(release);
        }
        return yield* fs.stat(target);
      }),
      open: (target, options) =>
        fs.open(target, options).pipe(
          Effect.map(
            (handle): FileSystem.File => ({
              [FileSystem.FileTypeId]: FileSystem.FileTypeId,
              stat: handle.stat,
              sync: handle.sync,
              seek: (offset, from) => handle.seek(offset, from),
              read: (buffer) => handle.read(buffer),
              writeAll: (bytes) => handle.writeAll(bytes),
              write: (buffer) => handle.write(buffer),
              truncate: (length) => handle.truncate(length),
              readAlloc: Effect.fn("JsonlTest.replaceAfterSeedRead")(function* (size) {
                const bytes = yield* handle.readAlloc(size);
                if (!replaced && size > 3) {
                  replaced = true;
                  yield* fs.writeFileString("/journal/new", line(2) + line(3));
                  yield* fs.rename("/journal/new", path);
                }
                return bytes;
              }),
            })
          )
        ),
    };
    const journal = yield* open(decorated);
    yield* Deferred.await(observed);
    const reader = yield* journal
      .changes()
      .pipe(Stream.runCollect, Effect.result, Effect.forkChild({ startImmediately: true }));
    yield* Deferred.succeed(release, undefined);
    assertFailure(
      Result.mapError(yield* Fiber.join(reader), (error) =>
        error._tag === "JournalResync" ? error.reason : error._tag
      ),
      "replaced"
    );
    yield* journal.append("noted", { round: 4, label: "current file" });
    assert.deepStrictEqual(
      A.map(yield* Stream.runCollect(journal.query({ events: ["noted"] })), (row) => row.data.round),
      [2, 3, 4]
    );
  })
);

const invalidRecord = () => {
  const bytes = new TextEncoder().encode(line(2, "X"));
  bytes[O.getOrThrow(A.findFirstIndex(bytes, (byte) => byte === 88))] = 0xff;
  return bytes;
};
it.effect("invalid committed UTF8 fails layer construction without replacing payload bytes", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const bytes = invalidRecord();
    yield* fs.writeFile(path, bytes);
    assertFailure((yield* Effect.result(open(fs))).pipe(Result.mapError((error) => error._tag)), "InvalidUtf8");
    assert.deepStrictEqual(yield* fs.readFile(path), bytes);
  })
);
it.effect("query and append expose committed invalid UTF8 through their typed channels", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    yield* fs.writeFile(path, invalidRecord());
    assertFailure(
      (yield* journal.query().pipe(Stream.runCollect, Effect.result)).pipe(Result.mapError((error) => error._tag)),
      "InvalidUtf8"
    );
    const bytes = yield* fs.readFile(path);
    assertFailure(
      (yield* Effect.result(journal.append("noted", { round: 3, label: "refused" }))).pipe(
        Result.mapError((error) => error._tag)
      ),
      "InvalidUtf8"
    );
    assert.deepStrictEqual(yield* fs.readFile(path), bytes);
  })
);
it.effect("a watcher reports committed invalid UTF8 to existing subscribers", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, "");
    const registered = yield* Deferred.make<void>();
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: (target, options) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const source = yield* fs.watch(target, options).pipe(Stream.toQueue({ capacity: "unbounded" }));
            yield* Deferred.succeed(registered, undefined);
            return Stream.fromQueue(source);
          })
        ),
    };
    const journal = yield* open(decorated);
    yield* Deferred.await(registered);
    const reader = yield* journal
      .changes()
      .pipe(Stream.runCollect, Effect.result, Effect.forkChild({ startImmediately: true }));
    yield* fs.writeFile(path, invalidRecord());
    assertFailure(
      Result.mapError(yield* Fiber.join(reader), (error) => error._tag),
      "InvalidUtf8"
    );
  })
);
it.effect("a cursor inside an astral code point skips its physical partial line before decoding", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const first = line(1, "😀inside");
    yield* fs.writeFileString(path, first + line(2));
    const journal = yield* open(fs);
    const bytes = new TextEncoder().encode(first);
    const astral = O.getOrThrow(A.findFirstIndex(bytes, (byte) => byte === 0xf0));
    for (const cursor of [astral + 1, astral + 2, astral + 3]) {
      assert.deepStrictEqual(
        A.map(yield* Stream.runCollect(journal.query({ events: ["noted"], cursor })), (row) => row.data.round),
        [2]
      );
    }
  })
);
it.effect("an unfinished multibyte code point is held until its original writer completes the record", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const first = new TextEncoder().encode(line(1));
    const second = new TextEncoder().encode(line(2, "😀complete"));
    const astral = O.getOrThrow(A.findFirstIndex(second, (byte) => byte === 0xf0));
    const cut = astral + 2;
    yield* fs.writeFile(path, new Uint8Array([...first, ...second.subarray(0, cut)]));
    const registered = yield* Deferred.make<void>();
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: (target, options) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const source = yield* fs.watch(target, options).pipe(Stream.toQueue({ capacity: "unbounded" }));
            yield* Deferred.succeed(registered, undefined);
            return Stream.fromQueue(source);
          })
        ),
    };
    const journal = yield* open(decorated);
    yield* Deferred.await(registered);
    assert.deepStrictEqual(
      A.map(yield* Stream.runCollect(journal.query({ events: ["noted"] })), (row) => row.data.round),
      [1]
    );
    const refusal = yield* Effect.result(journal.append("noted", { round: 3, label: "refused" }));
    assertFailure(
      Result.mapError(refusal, (error) =>
        error._tag === "JournalUnterminated" ? [error.offset, error.end] : error._tag
      ),
      [first.length, first.length + cut]
    );
    const reader = yield* journal
      .changes({ events: ["noted"], cursor: first.length })
      .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    yield* fs.writeFile(path, second.subarray(cut), { flag: "a" });
    const completed = yield* Fiber.join(reader);
    assert.deepStrictEqual(
      A.map(completed, (row) => row.data),
      [{ round: 2, label: "😀complete" }]
    );
    assert.strictEqual(completed[0]?.line.offset, first.length);
    assert.strictEqual(completed[0]?.line.end, first.length + second.length);
  })
);

// Upstream semantics (D13 reverted): a cursor compares at-or-after against a
// line's start offset on the live half too, so a future cursor delivers nothing
// that starts below it, even a line that straddles it.
it.effect("future replay cursor delivers nothing that starts below the cursor", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1));
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    const cursor = 100000;
    const reader = yield* journal
      .changes({ cursor })
      .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    for (let turn = 0; turn < 8; turn++) yield* Effect.yieldNow;
    assert.deepStrictEqual(yield* journal.query({ cursor }).pipe(Stream.runCollect), []);
    const straddling = yield* journal.append("noted", { round: 2, label: Str.repeat(cursor)("x") });
    assert.isBelow(straddling.line.offset, cursor);
    assert.isAbove(straddling.line.end, cursor);
    const after = yield* journal.append("noted", { round: 3, label: "live" });
    assert.deepStrictEqual(yield* Fiber.join(reader), [after]);
    assert.deepStrictEqual(
      A.map(yield* journal.query({ events: ["noted"], cursor }).pipe(Stream.runCollect), (row) => row.data.round),
      [3]
    );
  })
);

it.effect("invalid UTF-8 suffix is withheld until the original writer commits LF", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const bytes = invalidRecord();
    yield* fs.writeFile(
      path,
      new Uint8Array([...new TextEncoder().encode(line(1)), ...bytes.subarray(0, bytes.length - 1)])
    );
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    assert.strictEqual(O.getOrThrow(yield* SubscriptionRef.get(journal.latest)).event, "noted");
    assert.deepStrictEqual(
      A.map(yield* journal.query({ events: ["noted"] }).pipe(Stream.runCollect), (row) => row.data.round),
      [1]
    );
    assertFailure(
      (yield* Effect.result(journal.append("noted", { round: 3, label: "refused" }))).pipe(
        Result.mapError((error) => error._tag)
      ),
      "JournalUnterminated"
    );
    yield* externalAppend(fs, "\n");
    assertFailure(
      (yield* journal.query().pipe(Stream.runCollect, Effect.result)).pipe(Result.mapError((error) => error._tag)),
      "InvalidUtf8"
    );
  })
);

it.effect("an unreadable existing journal fails layer construction with its platform error", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1));
    const unavailable: FileSystem.FileSystem = {
      ...fs,
      open: (target, options) => fs.open(target === path ? "/unavailable" : target, options),
    };
    assertFailure(
      (yield* Effect.result(open(unavailable))).pipe(Result.mapError((error) => error._tag)),
      "PlatformError"
    );
  })
);

it.effect("failed watcher registration is bounded and leaves local append usable", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, "");
    const stopped = yield* Deferred.make<void>();
    let registrations = 0;
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: () =>
        Stream.unwrap(
          Effect.gen(function* () {
            registrations++;
            if (registrations === 9) yield* Deferred.succeed(stopped, undefined);
            return fs.watch("/unavailable");
          })
        ),
    };
    const journal = yield* open(decorated);
    yield* Deferred.await(stopped);
    const appended = yield* journal.append("noted", { round: 1, label: "local" });
    assert.strictEqual(appended.data.round, 1);
    assert.strictEqual(registrations, 9);
  })
);

it.effect("explicit activation directory is watched for a missing journal", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.makeDirectory("/activation");
    const registered = yield* Deferred.make<string>();
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: (target) =>
        Stream.unwrap(
          Effect.gen(function* () {
            yield* Deferred.succeed(registered, target);
            return fs.watch(target);
          })
        ),
    };
    yield* open(decorated, { path, directory: "/activation" });
    assert.strictEqual(yield* Deferred.await(registered), "/activation");
  })
);

it.effect("overlapping repeated watch notifications publish each foreign line once", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, "");
    const registered = yield* Deferred.make<void>();
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: (target, options) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const queue = yield* fs.watch(target, options).pipe(Stream.toQueue({ capacity: "unbounded" }));
            yield* Deferred.succeed(registered, undefined);
            return Stream.fromQueue(queue).pipe(Stream.flatMap((event) => Stream.fromIterable([event, event, event])));
          })
        ),
    };
    const journal = yield* open(decorated);
    yield* Deferred.await(registered);
    const reader = yield* journal
      .changes({ events: ["noted"] })
      .pipe(Stream.take(3), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    yield* externalAppend(fs, line(1) + line(2));
    yield* journal.append("noted", { round: 3, label: "local" });
    assert.deepStrictEqual(
      A.map(yield* Fiber.join(reader), (row) => row.data.round),
      [1, 2, 3]
    );
  })
);

it.effect("query emits its first page without reading the rest of a large snapshot", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(
      path,
      A.join(
        A.makeBy(2000, (index) => line(index, "paged")),
        ""
      )
    );
    let armed = false;
    const requests: number[] = [];
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: () => Stream.never,
      open: (target, options) =>
        fs.open(target, options).pipe(
          Effect.map((handle) => ({
            [FileSystem.FileTypeId]: FileSystem.FileTypeId,
            stat: handle.stat,
            sync: handle.sync,
            seek: (offset, from) => handle.seek(offset, from),
            read: (buffer) => handle.read(buffer),
            write: (buffer) => handle.write(buffer),
            writeAll: (buffer) => handle.writeAll(buffer),
            truncate: (length) => handle.truncate(length),
            readAlloc: (size) => {
              if (armed) requests.push(Number(size));
              return handle.readAlloc(size);
            },
          }))
        ),
    };
    const journal = yield* open(decorated);
    armed = true;
    const rows = yield* journal.query({ events: ["noted"] }).pipe(Stream.take(1), Stream.runCollect);
    assert.strictEqual(O.getOrThrow(A.head(rows)).data.round, 0);
    assert.deepStrictEqual(requests, [3, 8192]);
  })
);

it.effect("query widens only for a record larger than its normal page", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const label = Str.repeat(70000)("x");
    yield* fs.writeFileString(path, line(1, label) + line(2));
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    const rows = yield* journal.query({ events: ["noted"] }).pipe(Stream.runCollect);
    assert.deepStrictEqual(
      A.map(rows, (row) => row.data.round),
      [1, 2]
    );
    assert.strictEqual(O.getOrThrow(A.head(rows)).data.label, label);
  })
);

it.effect("paged replay discards a long leading fragment before strict Unicode decoding", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const first = line(1, "😀" + Str.repeat(70000)("x"));
    yield* fs.writeFileString(path, first + line(2));
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    const bytes = new TextEncoder().encode(first);
    const cursor = O.getOrThrow(A.findFirstIndex(bytes, (byte) => byte === 0xf0)) + 1;
    assert.deepStrictEqual(
      A.map(yield* journal.query({ cursor, events: ["noted"] }).pipe(Stream.runCollect), (row) => row.data.round),
      [2]
    );
  })
);

it.effect("paged query delivers earlier pages before a terminated malformed record", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(
      path,
      A.join(
        A.makeBy(200, (index) => line(index)),
        ""
      ) + "{\n"
    );
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    const delivered: number[] = [];
    const reading = yield* journal.query({ events: ["noted"] }).pipe(
      Stream.tap((row) => Effect.sync(() => delivered.push(row.data.round))),
      Stream.runDrain,
      Effect.result
    );
    assertFailure(
      Result.mapError(reading, (error) => error._tag),
      "MalformedLine"
    );
    assert.deepStrictEqual(
      delivered,
      A.makeBy(200, (index) => index)
    );
  })
);
