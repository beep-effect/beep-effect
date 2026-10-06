import { Journal, JsonlEvent } from "@beep/scratchpad/effected/jsonl/index";
import { assert, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type * as PlatformError from "effect/PlatformError";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { $I, externalAppend, line, memory, open, path } from "./fixtures.ts";

it.effect("patches initialize empty state, replace scalar state and retain the last snapshot", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    yield* journal.create;
    yield* journal.create;
    assert.deepStrictEqual((yield* journal.appendPatch("noted", { round: 1, label: "initial" })).data, {
      round: 1,
      label: "initial",
    });
    yield* journal.append("reopened", null);
    const replaced = yield* journal.appendPatch("noted", { round: 2, label: "replacement" });
    assert.deepStrictEqual(replaced.data, { round: 2, label: "replacement" });
    assertFailure(
      (yield* Effect.result(journal.appendPatch("noted", { round: Number.NaN }))).pipe(
        Result.mapError((error) => error._tag)
      ),
      "InvalidData"
    );
    assertSome(
      O.map(yield* SubscriptionRef.get(journal.latest), (row) => row.data),
      replaced.data
    );
  })
);
it.effect("empty reads, past-end cursors and whitespace history yield no envelopes", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    yield* journal.create;
    assert.deepStrictEqual(yield* Stream.runCollect(journal.query()), []);
    yield* fs.writeFileString(path, "\n \t\r\n" + line(1));
    assert.strictEqual((yield* Stream.runCollect(journal.query())).length, 1);
    yield* fs.writeFileString(path, line(1));
    assert.deepStrictEqual(yield* Stream.runCollect(journal.query({ cursor: 1 })), []);
    assert.deepStrictEqual(yield* Stream.runCollect(journal.query({ cursor: 10000 })), []);
  })
);
it.effect("scope filters select scoped appends on historical and live surfaces", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    yield* journal.create;
    yield* journal.append("noted", { round: 1, label: "mail" }, { scope: "mail" });
    yield* journal.append("noted", { round: 2, label: "other" }, { scope: "other" });
    yield* journal.append("ended", null, { scope: "other" });
    assert.deepStrictEqual(
      A.map(yield* Stream.runCollect(journal.changes({ cursor: 0, scopes: ["mail"] })), (row) => row.scope),
      ["mail"]
    );
  })
);
it.effect("closed changes replay only when a cursor is requested", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const scope = yield* Scope.make();
    const journal = yield* open(fs).pipe(Effect.provideService(Scope.Scope, scope));
    yield* journal.create;
    yield* journal.append("noted", { round: 1, label: "a" });
    yield* Scope.close(scope, Exit.void);
    assert.deepStrictEqual(yield* Stream.runCollect(journal.changes()), []);
    assert.strictEqual((yield* Stream.runCollect(journal.changes({ cursor: 0 }))).length, 1);
  })
);
it.effect("local append catches up blank, unknown and corrupt foreign lines before publishing", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const decorated: FileSystem.FileSystem = { ...fs, watch: () => Stream.never };
    const journal = yield* open(decorated);
    yield* journal.create;
    yield* externalAppend(fs, " \n{}\n" + line(1));
    const next = yield* journal.append("noted", { round: 2, label: "ours" });
    assert.strictEqual(next.line.offset, new TextEncoder().encode(" \n{}\n" + line(1)).length);
    assertSome(
      O.map(yield* SubscriptionRef.get(journal.latest), (row) => row.data),
      next.data
    );
  })
);
for (const target of ["events.jsonl", "/events.jsonl", "\\events.jsonl"]) {
  it.effect(`missing journal derives an activation directory for ${target}`, () =>
    Effect.gen(function* () {
      const fs = yield* memory();
      const registered = yield* Deferred.make<string>();
      const decorated: FileSystem.FileSystem = {
        ...fs,
        watch: (directory) => Stream.fromEffect(Deferred.succeed(registered, directory)).pipe(Stream.drain),
      };
      const journal = yield* open(decorated, { path: target });
      assert.strictEqual(
        yield* Deferred.await(registered),
        target === "events.jsonl" ? "." : target === "/events.jsonl" ? "/" : "\\"
      );
      assertNone(yield* SubscriptionRef.get(journal.latest));
    })
  );
}
it.effect("a lossy payload codec fails validation before bytes are written", () =>
  Effect.gen(function* () {
    class BinaryJournal extends Journal.Service<BinaryJournal>()($I`BinaryJournal`, {
      events: [JsonlEvent.make("binary", { data: S.Uint8Array })],
    }) {}
    const fs = yield* memory();
    const context = yield* Layer.build(
      BinaryJournal.layer({ path }).pipe(Layer.provide(Layer.succeed(FileSystem.FileSystem, fs)))
    );
    const journal = Context.get(context, BinaryJournal);
    yield* journal.create;
    assertFailure(
      (yield* Effect.result(journal.append("binary", new Uint8Array([1, 2])))).pipe(
        Result.mapError((error) => error._tag)
      ),
      "InvalidData"
    );
    assert.strictEqual(yield* fs.readFileString(path), "");
    assertNone(yield* SubscriptionRef.get(journal.latest));
  })
);
it.effect("an immediately ending activation watch rearms finitely and preserves local operations", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const registrations = yield* Queue.unbounded<void>();
    const stopped = yield* Deferred.make<void>();
    let count = 0;
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: () =>
        Stream.fromEffect(
          Effect.gen(function* () {
            count++;
            yield* Queue.offer(registrations, undefined);
            return { _tag: "Update", path } satisfies FileSystem.WatchEvent;
          })
        ).pipe(
          Stream.onEnd(
            Effect.gen(function* () {
              if (count === 9) yield* Deferred.succeed(stopped, undefined);
            })
          )
        ),
    };
    const journal = yield* open(decorated);
    for (const _ of A.range(1, 9)) yield* Queue.take(registrations);
    yield* Deferred.await(stopped);
    assert.strictEqual(count, 9);
    yield* journal.create;
    yield* journal.append("noted", { round: 1, label: "still writable" });
  })
);
it.effect("an append queued behind an in-flight write is refused once shutdown starts", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const entered = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    let gate = false;
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
              writeAll: Effect.fn("JsonlTest.blockWrite")(function* (bytes) {
                if (gate) {
                  gate = false;
                  yield* Deferred.succeed(entered, undefined);
                  yield* Deferred.await(release);
                }
                yield* handle.writeAll(bytes);
              }),
            })
          )
        ),
    };
    const scope = yield* Scope.make();
    const journal = yield* open(decorated).pipe(Effect.provideService(Scope.Scope, scope));
    yield* journal.create;
    gate = true;
    const writing = yield* journal
      .append("noted", { round: 1, label: "accepted" })
      .pipe(Effect.forkChild({ startImmediately: true }));
    yield* Deferred.await(entered);
    const queued = yield* journal
      .append("noted", { round: 2, label: "queued" })
      .pipe(Effect.result, Effect.forkChild({ startImmediately: true }));
    const closing = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild({ startImmediately: true }));
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(writing);
    assertFailure(
      Result.mapError(yield* Fiber.join(queued), (error) => error._tag),
      "JournalClosed"
    );
    yield* Fiber.join(closing);
    assert.strictEqual((yield* Stream.runCollect(journal.query())).length, 1);
  })
);
it.effect("a file disappearing between the existence check and seed refresh remains a missing journal", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, "\ufeff" + line(1));
    let checks = 0;
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: () => Stream.never,
      exists: Effect.fn("JsonlTest.removeBeforeRefresh")(function* (target) {
        checks++;
        if (checks === 2) yield* fs.remove(target);
        return yield* fs.exists(target);
      }),
    };
    const journal = yield* open(decorated);
    assertNone(yield* SubscriptionRef.get(journal.latest));
    assertFailure(
      (yield* Effect.result(journal.append("noted", { round: 1, label: "missing" }))).pipe(
        Result.mapError((error) => error._tag)
      ),
      "JournalNotFound"
    );
    yield* journal.create;
    assert.strictEqual((yield* journal.append("noted", { round: 1, label: "recreated" })).line.offset, 0);
  })
);

// Storage and metadata are real MemoryFileSystem operations. Only the watch
// lifecycle is controlled: the first registration ends after its mutation,
// and the second registration signals that both ingestion passes completed.
const endingWatch = Effect.fn("JsonlTest.endingWatch")(function* (
  fs: FileSystem.FileSystem,
  mutate: Effect.Effect<void, PlatformError.PlatformError, Scope.Scope>,
  nextTarget = path
) {
  const rearmed = yield* Deferred.make<void>();
  let watches = 0;
  const decorated: FileSystem.FileSystem = {
    ...fs,
    watch: (target) =>
      Stream.unwrap(
        Effect.gen(function* () {
          watches++;
          if (watches === 1) {
            yield* mutate;
            return Stream.succeed({ _tag: "Update", path } satisfies FileSystem.WatchEvent);
          }
          assert.strictEqual(target, nextTarget);
          yield* Deferred.succeed(rearmed, undefined);
          return Stream.never;
        })
      ),
  };
  const journal = yield* open(decorated);
  yield* Deferred.await(rearmed);
  return journal;
});
it.effect("an ending watch ingests foreign blank and corrupt records without advancing latest", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, "");
    const journal = yield* endingWatch(fs, externalAppend(fs, " \n{}\n"));
    assertNone(yield* SubscriptionRef.get(journal.latest));
    assert.strictEqual((yield* journal.append("noted", { round: 1, label: "a" })).line.offset, 5);
  })
);
it.effect("a watch ending after removal can rearm over the missing journal", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, "");
    const journal = yield* endingWatch(fs, fs.remove(path), "/journal");
    assertNone(yield* SubscriptionRef.get(journal.latest));
    yield* journal.create;
    yield* journal.append("noted", { round: 1, label: "recreated" });
  })
);
it.effect("a torn foreign line holds the cursor until its bytes are completed", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, "");
    const whole = line(1);
    const journal = yield* endingWatch(fs, externalAppend(fs, Str.slice(0, 20)(whole)));
    assertNone(yield* SubscriptionRef.get(journal.latest));
    yield* externalAppend(fs, Str.slice(20)(whole));
    const next = yield* journal.append("noted", { round: 2, label: "a" });
    assert.strictEqual(next.line.offset, new TextEncoder().encode(whole).length);
    assert.deepStrictEqual(
      A.map(yield* Stream.runCollect(journal.query({ events: ["noted"] })), (row) => row.data.round),
      [1, 2]
    );
  })
);
it.effect("a completed truncation resync clears latest and resumes writes on the current file", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1) + line(2));
    const journal = yield* endingWatch(fs, fs.writeFileString(path, ""));
    assertNone(yield* SubscriptionRef.get(journal.latest));
    assert.strictEqual((yield* journal.append("noted", { round: 3, label: "new file" })).line.offset, 0);
  })
);
