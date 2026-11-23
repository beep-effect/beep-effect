import { fcRuns } from "@beep/fc-runs";
import { InvalidSlice, JournalConfig } from "@beep/jsonl";
import { assert, it } from "@effect/vitest";
import { assertFailure, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
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
import { externalAppend, line, memory, open, path } from "./fixtures.ts";
import type * as DateTime from "effect/DateTime";

const encoder = new TextEncoder();
const byteLength = (text: string): number => encoder.encode(text).length;
const records = (count: number, label: string): string =>
  A.join(
    A.makeBy(count, (round) => line(round, label)),
    ""
  );
const MULTI_WINDOW_RECORDS = 300;
const next = "/journal/next.jsonl";

it.effect("D11: a non-leading U+FEFF is line content for query and for a cursor at its line", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const first = byteLength(line(1));
    yield* fs.writeFileString(path, `${line(1)}﻿${line(2)}${line(3)}`);
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    for (const cursor of [0, first]) {
      const failure = yield* journal.query({ cursor }).pipe(Stream.runCollect, Effect.flip);
      assert.deepStrictEqual(failure._tag === "MalformedLine" ? [failure._tag, failure.line.offset] : failure._tag, [
        "MalformedLine",
        first,
      ]);
    }
  })
);
it.effect("D11: ingestion skips a foreign U+FEFF-led record and keeps physical offsets", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1));
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    const reader = yield* journal
      .changes()
      .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    const foreign = `﻿${line(2, "foreign")}`;
    yield* externalAppend(fs, foreign);
    const ours = yield* journal.append("noted", { round: 3, label: "ours" });
    assert.strictEqual(ours.line.offset, byteLength(line(1) + foreign));
    const join1 = yield* Fiber.join(reader);
    assert.deepStrictEqual(join1, [ours]);
  })
);

it.effect("D15 kept (EF-40): explicitly undefined configuration keys are rejected, not read as omissions", () =>
  Effect.sync(() => {
    for (const key of ["directory", "capacity", "shutdownPublishTimeout"]) {
      const decoded = S.decodeExit(JournalConfig)({ path, [key]: undefined });
      decoded.pipe(Exit.isFailure, assertTrue);
    }
  })
);
it.effect("EF-40 exception: an undefined Duration.DurationObject component still decodes", () =>
  Effect.sync(() => {
    const decoded = S.decodeExit(JournalConfig)({
      path,
      shutdownPublishTimeout: { seconds: 1, minutes: undefined },
    });
    decoded.pipe(Exit.isSuccess, assertTrue);
  })
);

for (const [label, timeout] of [
  ["a millisecond number", 100],
  ["a duration string", "100 millis"],
  ["a Duration", Duration.millis(100)],
] as const) {
  it.effect(`D16 reverted: shutdownPublishTimeout as ${label} decodes and bounds shutdown at 100 millis`, () =>
    Effect.gen(function* () {
      const fs = yield* memory();
      const scope = yield* Scope.make();
      const journal = yield* open(fs, { path, capacity: 1, shutdownPublishTimeout: timeout }).pipe(
        Effect.provideService(Scope.Scope, scope)
      );
      yield* journal.create;
      const nonTakingSubscriberStallsOneSlotHub = PubSub.subscribe(journal.hub);
      yield* nonTakingSubscriberStallsOneSlotHub;
      yield* journal.append("noted", { round: 1, label: "a" });
      const stalled = yield* journal
        .append("noted", { round: 2, label: "b" })
        .pipe(Effect.forkChild({ startImmediately: true }));
      const closing = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild({ startImmediately: true }));
      for (let turn = 0; turn < 8; turn++) {
        yield* Effect.yieldNow;
      }
      yield* TestClock.adjust(Duration.millis(99));
      assert.isUndefined(closing.pollUnsafe(), "shutdown still waits before the bound");
      yield* TestClock.adjust(Duration.millis(1));
      yield* Fiber.join(closing);
      yield* Fiber.interrupt(stalled);
    })
  );
}
for (const [label, timeout] of [["a template-typed string Effect cannot parse", "1e3 seconds"]] as const) {
  it.effect(`shutdownPublishTimeout as ${label} fails InvalidJournalConfig where upstream dies at scope close`, () =>
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
for (const [label, timeout] of [
  ["a tuple whose nanoseconds overflow", [1e300, 0]],
  ["an object whose nanoseconds overflow", { seconds: 1e300, nanoseconds: 1 }],
] as const) {
  it.effect(`shutdownPublishTimeout as ${label} saturates to an infinite bound and builds`, () =>
    Effect.gen(function* () {
      assertTrue(O.exists(Duration.fromInput(timeout), Duration.equals(Duration.infinity)));
      const fs = yield* memory();
      const journal = yield* open({ ...fs, watch: () => Stream.never }, { path, shutdownPublishTimeout: timeout });
      yield* journal.create;
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

interface UntypedSlice {
  readonly from?: string | DateTime.Utc | undefined;
}
interface BivariantJavaScriptCallerReaders {
  changes(slice: UntypedSlice): Stream.Stream<unknown, unknown>;
  projection(initial: number, fold: (state: number) => number, slice: UntypedSlice): Stream.Stream<number, unknown>;
  query(slice: UntypedSlice): Stream.Stream<unknown, unknown>;
}
it.effect("D17: an untyped JavaScript caller's from string is decoded and fails InvalidSlice on every reader", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1));
    const untyped: BivariantJavaScriptCallerReaders = yield* open({ ...fs, watch: () => Stream.never });
    const slice = { from: "2026-01-01" };
    for (const reading of [
      untyped.query(slice).pipe(Stream.as(undefined)),
      untyped.changes(slice).pipe(Stream.as(undefined)),
      untyped.projection(0, identity, slice).pipe(Stream.as(undefined)),
    ]) {
      const argument = S.is(InvalidSlice);
      const pipe1 = yield* reading.pipe(Stream.runCollect, Effect.flip);
      assertTrue(argument(pipe1));
    }
  })
);

it.effect("D26: a resync and a stopped watcher log WARN lines with their annotations", () =>
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
      const watchEndingAtOnceExhaustsRearms = () => Stream.empty;
      const journal = yield* open({ ...fs, watch: watchEndingAtOnceExhaustsRearms });
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

it.effect("ND02: a query truncated beneath a paged read fails JournalResync after its emitted pages", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const history = records(MULTI_WINDOW_RECORDS, "old");
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
    assert.isBelow(seen.length, MULTI_WINDOW_RECORDS, "nothing past the truncation was emitted");
    assert.deepStrictEqual(seen, A.makeBy(seen.length, identity));
  })
);
it.effect("ND02: a replay truncated beneath a paged read fails JournalResync", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const history = records(MULTI_WINDOW_RECORDS, "old");
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
it.effect("ND02: a query replaced beneath a paged read keeps returning the sampled file through its one handle", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, records(MULTI_WINDOW_RECORDS, "old"));
    const journal = yield* open({ ...fs, watch: () => Stream.never });
    const rows = yield* journal.query({ events: ["noted"] }).pipe(
      Stream.tap((row) =>
        row.data.round === 10
          ? fs.writeFileString(next, records(MULTI_WINDOW_RECORDS, "new")).pipe(Effect.andThen(fs.rename(next, path)))
          : Effect.void
      ),
      Stream.runCollect
    );
    assert.deepStrictEqual(
      A.map(rows, (row) => [row.data.round, row.data.label]),
      A.makeBy(MULTI_WINDOW_RECORDS, (round) => [round, "old"])
    );
    const readFileString2 = yield* fs.readFileString(path);
    assert.strictEqual(readFileString2, records(MULTI_WINDOW_RECORDS, "new"));
  })
);
it.effect("a replacement between sampling a range and pinning it fails JournalResync", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const sampled = records(3, "old");
    const replacement = records(5, "new");
    yield* fs.writeFileString(path, sampled);
    const pinnedHandleOpenAfterBomProbe = 2;
    let opens = 0;
    let armed = false;
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: () => Stream.never,
      open: Effect.fn("JsonlTest.replaceBeforePin")(function* (target, options) {
        if (armed && options?.flag === "r" && ++opens === pinnedHandleOpenAfterBomProbe) {
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

const replacingAfterBomProbeRead = (
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
    yield* fs.writeFileString(path, `\ufeff${line(1)}`);
    const trigger = { armed: false };
    const journal = yield* open(replacingAfterBomProbeRead(fs, replacement, trigger));
    trigger.armed = true;
    const failure = yield* journal.query().pipe(Stream.runCollect, Effect.flip);
    assert.isFalse(
      trigger.armed,
      "the replacement landed between the BOM probe and the rest of the sample, which must share one handle"
    );
    assert.deepStrictEqual(
      failure._tag === "JournalResync" ? [failure.reason, failure.expected, failure.actual] : failure._tag,
      ["replaced", byteLength(line(1)), byteLength(replacement)]
    );
    const pipe3 = yield* journal.query({ events: ["noted"] }).pipe(Stream.runCollect);
    assert.deepStrictEqual(
      A.map(pipe3, (row) => [row.data.round, row.line.offset, row.line.end]),
      [[7, 0, byteLength(replacement)]],
      "a retry over the now stable replacement reads it at its own logical offsets"
    );
  })
);
it.effect("a BOM file replaced by a BOM-less one after the seed's BOM probe resyncs, then appends logically", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const replacement = line(7);
    yield* fs.writeFileString(path, `\ufeff${line(1)}`);
    const catchUpParkedBeforeReporting = yield* Deferred.make<void>();
    const releaseParkedCatchUp = yield* Deferred.make<void>();
    const trigger = { armed: true };
    let watching = false;
    let gated = false;
    const replacing = replacingAfterBomProbeRead(fs, replacement, trigger);
    const journal = yield* open({
      ...replacing,
      watch: (_target, options) =>
        Stream.never.pipe(
          Stream.onStart(
            Effect.sync(() => {
              watching = true;
              options?.onReady?.();
            })
          )
        ),
      stat: Effect.fn("JsonlTest.gateCatchUpStat")(function* (target) {
        if (watching && !gated) {
          gated = true;
          yield* Deferred.succeed(catchUpParkedBeforeReporting, undefined);
          yield* Deferred.await(releaseParkedCatchUp);
        }
        return yield* fs.stat(target);
      }),
    });
    assert.isFalse(trigger.armed, "the replacement landed inside the seed's sample");
    yield* Deferred.await(catchUpParkedBeforeReporting);
    const reader = yield* journal
      .changes()
      .pipe(Stream.take(1), Stream.runCollect, Effect.result, Effect.forkChild({ startImmediately: true }));
    yield* Deferred.succeed(releaseParkedCatchUp, undefined);
    const appended = yield* journal.append("noted", { round: 8, label: "ours" });
    const catchUpAgainstSeedIdentity = yield* Fiber.join(reader);
    assertFailure(
      Result.mapError(catchUpAgainstSeedIdentity, (error) =>
        error._tag === "JournalResync" ? [error.reason, error.expected, error.actual] : error._tag
      ),
      ["replaced", 0, byteLength(replacement)]
    );
    assert.deepStrictEqual(
      [appended.line.offset, appended.line.end],
      [byteLength(replacement), byteLength(replacement) + byteLength(line(8, "ours"))],
      "append and query agree on the replacement's logical offsets"
    );
    const pipe5 = yield* journal.query({ events: ["noted"] }).pipe(Stream.runCollect);
    assert.deepStrictEqual(
      A.map(pipe5, (row) => [row.data.round, row.line.offset, row.line.end]),
      [
        [7, 0, byteLength(replacement)],
        [8, appended.line.offset, appended.line.end],
      ]
    );
  })
);
