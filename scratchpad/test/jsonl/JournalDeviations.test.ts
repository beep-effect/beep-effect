// Pins for the jsonl deviation review: the lab-only behaviours reverted to
// upstream (D15 omission, D16 Duration.Input), the kept deviations that were
// unpinned (D11, D17, D26), and the paged historical read recorded as a
// deviation (ND02: a change beneath an in-flight read is observable).
import { fcRuns } from "@beep/fc-runs";
import { assert, it } from "@effect/vitest";
import { assertFailure, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import type * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as PubSub from "effect/PubSub";
import * as References from "effect/References";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { InvalidSlice, JournalConfig } from "../../effected/jsonl/index.ts";
import { externalAppend, line, memory, open, path } from "./fixtures.ts";

const encoder = new TextEncoder();
const byteLength = (text: string): number => encoder.encode(text).length;
/** `count` consecutive records, rounds 0 to count - 1, all carrying `label`. */
const records = (count: number, label: string): string =>
  A.join(
    A.makeBy(count, (round) => line(round, label)),
    ""
  );
/** More than one default read window, so a query pages. */
const PAGED = 300;
const next = "/journal/next.jsonl";

// D11: a U+FEFF that is not the file's leading BOM is line content.
it.effect("a non-leading U+FEFF is line content for query and for a cursor at its line", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const first = byteLength(line(1));
    yield* fs.writeFileString(path, line(1) + "﻿" + line(2) + line(3));
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    for (const cursor of [0, first]) {
      const failure = yield* journal.query({ cursor }).pipe(Stream.runCollect, Effect.flip);
      assert.deepStrictEqual(
        failure._tag === "MalformedLine" ? [failure._tag, failure.line.offset] : failure._tag,
        ["MalformedLine", first]
      );
    }
  })
);
it.effect("ingestion skips a foreign U+FEFF-led record and keeps physical offsets", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1));
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    const reader = yield* journal
      .changes()
      .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    const foreign = "﻿" + line(2, "foreign");
    yield* externalAppend(fs, foreign);
    const ours = yield* journal.append("noted", { round: 3, label: "ours" });
    assert.strictEqual(ours.line.offset, byteLength(line(1) + foreign));
    assert.deepStrictEqual(yield* Fiber.join(reader), [ours]);
  })
);

// D15 reverted: an explicitly undefined optional key behaves as an omitted one.
it.effect("explicitly undefined configuration keys behave as omitted ones", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const watched = yield* Deferred.make<string>();
    const journal = yield* open(
      {
        ...fs,
        watch: (target) =>
          Stream.concat(Stream.fromEffect(Deferred.succeed(watched, target)).pipe(Stream.drain), Stream.never),
      },
      { path, directory: undefined, capacity: undefined, shutdownPublishTimeout: undefined }
    );
    assert.strictEqual(yield* Deferred.await(watched), "/journal");
    yield* journal.create;
    const appended = yield* journal.append("noted", { round: 1, label: "a" });
    assert.deepStrictEqual(yield* Stream.runCollect(journal.query()), [appended]);
  })
);
it.effect("explicitly undefined slice keys select what omitted keys select", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1) + line(2));
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    const unset = { events: undefined, scopes: undefined, from: undefined, to: undefined, cursor: undefined };
    assert.deepStrictEqual(yield* Stream.runCollect(journal.query(unset)), yield* Stream.runCollect(journal.query()));
    // An undefined cursor is no cursor: subscriptions start live, without replay.
    const changes = yield* journal
      .changes(unset)
      .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    const projection = yield* journal
      .projection(0, (count) => count + 1, unset)
      .pipe(Stream.take(2), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    for (let turn = 0; turn < 8; turn++) yield* Effect.yieldNow;
    const live = yield* journal.append("noted", { round: 3, label: "live" });
    assert.deepStrictEqual(yield* Fiber.join(changes), [live]);
    assert.deepStrictEqual(yield* Fiber.join(projection), [0, 1]);
  })
);

// D16 reverted: shutdownPublishTimeout accepts Duration.Input and decodes it.
for (const [label, timeout] of [
  ["a millisecond number", 100],
  ["a duration string", "100 millis"],
  ["a Duration", Duration.millis(100)],
] as const) {
  it.effect(`shutdownPublishTimeout as ${label} bounds shutdown at 100 millis`, () =>
    Effect.gen(function* () {
      const fs = yield* memory();
      const scope = yield* Scope.make();
      const journal = yield* open(fs, { path, capacity: 1, shutdownPublishTimeout: timeout }).pipe(
        Effect.provideService(Scope.Scope, scope)
      );
      yield* journal.create;
      // A subscriber that never takes fills the one-slot hub and stalls publication.
      yield* PubSub.subscribe(journal.hub);
      yield* journal.append("noted", { round: 1, label: "a" });
      const stalled = yield* journal
        .append("noted", { round: 2, label: "b" })
        .pipe(Effect.forkChild({ startImmediately: true }));
      const closing = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild({ startImmediately: true }));
      for (let turn = 0; turn < 8; turn++) yield* Effect.yieldNow;
      yield* TestClock.adjust(Duration.millis(99));
      assert.isUndefined(closing.pollUnsafe(), "shutdown still waits before the bound");
      yield* TestClock.adjust(Duration.millis(1));
      yield* Fiber.join(closing);
      yield* Fiber.interrupt(stalled);
    })
  );
}
// Upstream accepts these at construction and dies at scope close when
// Duration.fromInput throws inside the shutdown finalizer (probe 29).
for (const [label, timeout] of [
  ["a template-typed string Effect cannot parse", "1e3 seconds"],
  ["a tuple whose nanoseconds overflow", [1e300, 0]],
  ["an object whose nanoseconds overflow", { seconds: 1e300, nanoseconds: 1 }],
] as const) {
  it.effect(`shutdownPublishTimeout as ${label} fails InvalidJournalConfig`, () =>
    Effect.gen(function* () {
      const fs = yield* memory();
      assertFailure(
        (yield* Effect.result(open(fs, { path, shutdownPublishTimeout: timeout }))).pipe(
          Result.mapError((error) => error._tag)
        ),
        "InvalidJournalConfig"
      );
    })
  );
}
it.effect.prop(
  "an admitted Duration.Input builds a journal exactly when Duration.fromInput converts it",
  [JournalConfig.fields.shutdownPublishTimeout],
  ([timeout]) =>
    Effect.gen(function* () {
      const fs = yield* memory();
      const built = yield* Effect.result(
        open({ ...fs, watch: () => Stream.never }, { path, shutdownPublishTimeout: timeout })
      );
      const converts = P.isUndefined(timeout) || O.isSome(Duration.fromInput(timeout));
      assert.strictEqual(
        Result.match(built, { onSuccess: () => "built", onFailure: (error) => error._tag }),
        converts ? "built" : "InvalidJournalConfig"
      );
    }),
  { arbitrary: fcRuns(25) }
);

// D17: an untyped caller's selection is decoded. Method parameters are compared
// bivariantly, so the real readers satisfy this interface without an assertion,
// exactly as a JavaScript caller reaches them.
interface UntypedSlice {
  readonly from?: string | DateTime.Utc | undefined;
}
interface UntypedReaders {
  query(slice: UntypedSlice): Stream.Stream<unknown, unknown>;
  changes(slice: UntypedSlice): Stream.Stream<unknown, unknown>;
  projection(initial: number, fold: (state: number) => number, slice: UntypedSlice): Stream.Stream<number, unknown>;
}
it.effect("an untyped from string fails InvalidSlice on every reader", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1));
    const untyped: UntypedReaders = yield* open({ ...fs, watch: () => Stream.never });
    const slice = { from: "2026-01-01" };
    for (const reading of [
      untyped.query(slice).pipe(Stream.as(undefined)),
      untyped.changes(slice).pipe(Stream.as(undefined)),
      untyped.projection(0, identity, slice).pipe(Stream.as(undefined)),
    ]) {
      assertTrue(S.is(InvalidSlice)(yield* reading.pipe(Stream.runCollect, Effect.flip)));
    }
  })
);

// D26: a resync and a stopped watcher are observable as WARN lines.
it.effect("a resync and a stopped watcher log WARN lines with their annotations", () =>
  Effect.gen(function* () {
    const logged: Array<readonly [string, unknown, Readonly<Record<string, unknown>>]> = [];
    const stopped = yield* Deferred.make<void>();
    const capture = Logger.make<unknown, void>((options) => {
      const message = O.getOrUndefined(A.head(A.ensure(options.message)));
      logged.push([options.logLevel, message, { ...options.fiber.getRef(References.CurrentLogAnnotations) }]);
      if (message === "Journal watcher stopped after immediate completions") Deferred.doneUnsafe(stopped, Exit.void);
    });
    const history = line(1) + line(2);
    yield* Effect.gen(function* () {
      const fs = yield* memory();
      yield* fs.writeFileString(path, history);
      // A watch that ends at once exhausts the bounded re-arm loop.
      const journal = yield* open({ ...fs, watch: () => Stream.empty });
      yield* Deferred.await(stopped);
      yield* fs.writeFileString(path, line(1));
      const refusal = yield* Effect.flip(journal.append("noted", { round: 3, label: "refused" }));
      assert.strictEqual(refusal._tag, "JournalResync");
    }).pipe(Effect.withLogger(capture));
    assert.deepStrictEqual(logged, [
      ["Warn", "Journal watcher stopped after immediate completions", { path, rearms: 9 }],
      [
        "Warn",
        "Journal source requires resynchronization",
        { path, reason: "truncated", expected: byteLength(history), actual: byteLength(line(1)) },
      ],
    ]);
  })
);

// ND02 recorded as a deviation: paged reads go through one handle opened when
// the range is sampled, so a replacement cannot leak in and a truncation fails.
it.effect("a query truncated beneath a paged read fails JournalResync after its emitted pages", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const history = records(PAGED, "old");
    yield* fs.writeFileString(path, history);
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    const seen: Array<number> = [];
    const failure = yield* journal.query({ events: ["noted"] }).pipe(
      Stream.tap((row) =>
        Effect.sync(() => seen.push(row.data.round)).pipe(
          Effect.andThen(row.data.round === 10 ? fs.writeFileString(path, "") : Effect.void)
        )
      ),
      Stream.runDrain,
      Effect.flip
    );
    assert.deepStrictEqual(
      failure._tag === "JournalResync" ? [failure.reason, failure.expected, failure.actual] : failure._tag,
      ["truncated", byteLength(history), 0]
    );
    assert.isAbove(seen.length, 10, "the first page was emitted before the short page");
    assert.isBelow(seen.length, PAGED, "nothing past the truncation was emitted");
    assert.deepStrictEqual(seen, A.makeBy(seen.length, identity));
  })
);
it.effect("a replay truncated beneath a paged read fails JournalResync", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const history = records(PAGED, "old");
    yield* fs.writeFileString(path, history);
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    const failure = yield* journal.changes({ events: ["noted"], cursor: 0 }).pipe(
      Stream.tap((row) => (row.data.round === 10 ? fs.writeFileString(path, "") : Effect.void)),
      Stream.runDrain,
      Effect.flip
    );
    assert.deepStrictEqual(
      failure._tag === "JournalResync" ? [failure.reason, failure.expected, failure.actual] : failure._tag,
      ["truncated", byteLength(history), 0]
    );
  })
);
it.effect("a query replaced beneath a paged read keeps returning the sampled file", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, records(PAGED, "old"));
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    const rows = yield* journal.query({ events: ["noted"] }).pipe(
      Stream.tap((row) =>
        row.data.round === 10
          ? fs.writeFileString(next, records(PAGED, "new")).pipe(Effect.andThen(fs.rename(next, path)))
          : Effect.void
      ),
      Stream.runCollect
    );
    assert.deepStrictEqual(
      A.map(rows, (row) => [row.data.round, row.data.label]),
      A.makeBy(PAGED, (round) => [round, "old"])
    );
    assert.strictEqual(yield* fs.readFileString(path), records(PAGED, "new"));
  })
);
it.effect("a replacement between sampling a range and pinning it fails JournalResync", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const sampled = records(3, "old");
    const replacement = records(5, "new");
    yield* fs.writeFileString(path, sampled);
    let opens = 0;
    let armed = false;
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: () => Stream.never,
      // Opens: the BOM probe, then the pinned handle. Replace the file just before the second.
      open: Effect.fn("JsonlTest.replaceBeforePin")(function* (target, options) {
        if (armed && options?.flag === "r" && ++opens === 2) {
          armed = false;
          yield* fs.writeFileString(next, replacement);
          yield* fs.rename(next, path);
        }
        return yield* fs.open(target, options);
      }),
    };
    const journal = yield* open(decorated);
    armed = true;
    const failure = yield* journal.query().pipe(Stream.runCollect, Effect.flip);
    assert.deepStrictEqual(
      failure._tag === "JournalResync" ? [failure.reason, failure.expected, failure.actual] : failure._tag,
      ["replaced", byteLength(sampled), byteLength(replacement)]
    );
  })
);

// Review round 1 (R1): a reader takes the BOM width and the identity of a file
// through one handle. Probing the path for the BOM and again for the metadata
// straddled a rename-over, and the old file's BOM width was then applied to the
// replacement: three bytes off, on a file whose identity looked unchanged.
//
// The decoration renames a BOM-less file over the journal as soon as the next
// armed read returns. The first read of a query, and of the seed, is the BOM
// probe, so the rename lands inside the sample.
const replacingAfterNextRead = (
  fs: FileSystem.FileSystem,
  replacement: string,
  trigger: { armed: boolean }
): FileSystem.FileSystem => ({
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
          writeAll: (bytes) => handle.writeAll(bytes),
          truncate: (length) => handle.truncate(length),
          readAlloc: Effect.fn("JsonlTest.replaceAfterBomProbe")(function* (size) {
            const bytes = yield* handle.readAlloc(size);
            if (trigger.armed) {
              trigger.armed = false;
              yield* fs.writeFileString(next, replacement);
              yield* fs.rename(next, path);
            }
            return bytes;
          }),
        })
      )
    ),
});
it.effect("a BOM file replaced by a BOM-less one after its BOM probe fails JournalResync, then reads logically", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const replacement = line(7);
    yield* fs.writeFileString(path, "\ufeff" + line(1));
    const trigger = { armed: false };
    const journal = yield* open(replacingAfterNextRead(fs, replacement, trigger));
    trigger.armed = true;
    const failure = yield* journal.query().pipe(Stream.runCollect, Effect.flip);
    assert.isFalse(trigger.armed, "the replacement landed between the BOM probe and the rest of the sample");
    assert.deepStrictEqual(
      failure._tag === "JournalResync" ? [failure.reason, failure.expected, failure.actual] : failure._tag,
      ["replaced", byteLength(line(1)), byteLength(replacement)]
    );
    // A retry over the now stable replacement reads it at its own logical offsets.
    assert.deepStrictEqual(
      A.map(yield* journal.query({ events: ["noted"] }).pipe(Stream.runCollect), (row) => [
        row.data.round,
        row.line.offset,
        row.line.end,
      ]),
      [[7, 0, byteLength(replacement)]]
    );
  })
);
it.effect("a BOM file replaced by a BOM-less one after the seed's BOM probe resyncs, then appends logically", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const replacement = line(7);
    yield* fs.writeFileString(path, "\ufeff" + line(1));
    const observed = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const trigger = { armed: true };
    let watching = false;
    let gated = false;
    const replacing = replacingAfterNextRead(fs, replacement, trigger);
    const journal = yield* open({
      ...replacing,
      watch: () => {
        watching = true;
        return Stream.never;
      },
      // Park the supervisor's first catch-up at its metadata sample, so a live
      // reader can subscribe before that catch-up reports what it finds.
      stat: Effect.fn("JsonlTest.gateCatchUpStat")(function* (target) {
        if (watching && !gated) {
          gated = true;
          yield* Deferred.succeed(observed, undefined);
          yield* Deferred.await(release);
        }
        return yield* fs.stat(target);
      }),
    });
    assert.isFalse(trigger.armed, "the replacement landed inside the seed's sample");
    yield* Deferred.await(observed);
    const reader = yield* journal
      .changes()
      .pipe(Stream.take(1), Stream.runCollect, Effect.result, Effect.forkChild({ startImmediately: true }));
    yield* Deferred.succeed(release, undefined);
    const appended = yield* journal.append("noted", { round: 8, label: "ours" });
    // The seed kept the identity of the file whose BOM it read, so the catch-up
    // sees the replacement instead of reading it with the old file's BOM width.
    assertFailure(
      Result.mapError(yield* Fiber.join(reader), (error) =>
        error._tag === "JournalResync" ? [error.reason, error.expected, error.actual] : error._tag
      ),
      ["replaced", 0, byteLength(replacement)]
    );
    // Append and query then agree on the replacement's logical offsets.
    assert.deepStrictEqual(
      [appended.line.offset, appended.line.end],
      [byteLength(replacement), byteLength(replacement) + byteLength(line(8, "ours"))]
    );
    assert.deepStrictEqual(
      A.map(yield* journal.query({ events: ["noted"] }).pipe(Stream.runCollect), (row) => [
        row.data.round,
        row.line.offset,
        row.line.end,
      ]),
      [
        [7, 0, byteLength(replacement)],
        [8, appended.line.offset, appended.line.end],
      ]
    );
  })
);
