// Adapted from upstream Journal.test.ts and ReadSurfaces.test.ts (MIT).

import { Journal, JournalClosed, JournalNotFound, JsonlEvent, Line, TerminalViolation } from "@beep/jsonl";
import { assert, describe, it } from "@effect/vitest";
import {
  assertExitSuccess,
  assertFailure,
  assertInstanceOf,
  assertNone,
  assertSome,
  assertTrue,
} from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as Tuple from "effect/Tuple";
import * as TestClock from "effect/testing/TestClock";
import { $I, line, memory, open, path, TestJournal } from "./fixtures.ts";
import type { EnvelopeUnion } from "@beep/jsonl";
import type { events } from "./fixtures.ts";

it.effect("constructs over a missing file, with explicit create/remove and typed append refusal", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    const got = yield* SubscriptionRef.get(journal.latest);
    assertNone(got);
    const result1 = yield* Effect.result(journal.append("noted", { round: 1, label: "a" }));
    assertFailure(result1, JournalNotFound.make({ path }));
    const exists2 = yield* fs.exists(path);
    assert.isFalse(exists2);
    yield* journal.create;
    yield* journal.append("noted", { round: 1, label: "a" });
    const exists3 = yield* fs.exists(path);
    assert.isTrue(exists3);
    yield* journal.remove;
    yield* journal.remove;
    const exists4 = yield* fs.exists(path);
    assert.isFalse(exists4);
  })
);
it.effect("stamps the TestClock instant and writes exactly one terminated line", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    yield* journal.create;
    yield* TestClock.setTime(123456789);
    const appended = yield* journal.append("noted", { round: 1, label: "a" });
    assert.strictEqual(DateTime.toEpochMillis(appended.at), 123456789);
    const readFileString5 = yield* fs.readFileString(path);
    assert.strictEqual(readFileString5, `${appended.line.text}\n`);
    const got6 = yield* SubscriptionRef.get(journal.latest);
    assertSome(got6, appended);
  })
);
it.effect("terminal refusal, quiescence and reopening follow the last event", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    yield* journal.create;
    yield* journal.append("ended", null);
    const quiescent7 = yield* journal.quiescent;
    assert.isTrue(quiescent7);
    const result8 = yield* Effect.result(journal.append("noted", { round: 1, label: "a" }));
    assertFailure(result8, TerminalViolation.make({ event: "noted", terminal: "ended" }));
    yield* journal.append("reopened", null);
    const quiescent9 = yield* journal.quiescent;
    assert.isFalse(quiescent9);
    yield* journal.append("noted", { round: 2, label: "b" });
    assert.strictEqual((yield* Stream.runCollect(journal.query())).length, 3);
  })
);
it.effect("concurrent partial patches read, merge and write under one lock, retaining both changed fields", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const entered = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    let holdNextWriteInsidePermit = false;
    const gated: FileSystem.FileSystem = {
      ...fs,
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
              writeAll: Effect.fn("JsonlTest.holdFirstPatch")(function* (bytes) {
                if (holdNextWriteInsidePermit) {
                  holdNextWriteInsidePermit = false;
                  yield* Deferred.succeed(entered, undefined);
                  yield* Deferred.await(release);
                }
                yield* handle.writeAll(bytes);
              }),
            })
          )
        ),
    };
    const journal = yield* open(gated);
    yield* journal.create;
    yield* journal.append("noted", { round: 1, label: "a", optional: "retained" });

    holdNextWriteInsidePermit = true;
    const first = yield* journal.appendPatch("noted", { round: 2 }).pipe(Effect.forkChild({ startImmediately: true }));
    yield* Deferred.await(entered);
    assert.isUndefined(first.pollUnsafe(), "the first patch is genuinely mid-write");

    const second = yield* journal
      .appendPatch("noted", { label: "b" })
      .pipe(Effect.forkChild({ startImmediately: true }));
    yield* Effect.yieldNow;
    assert.isUndefined(second.pollUnsafe(), "the second patch waits for the write permit before reading the base");

    yield* Deferred.succeed(release, undefined);
    assert.deepStrictEqual((yield* Fiber.join(first)).data, { round: 2, label: "a", optional: "retained" });
    assert.deepStrictEqual(
      (yield* Fiber.join(second)).data,
      { round: 2, label: "b", optional: "retained" },
      "neither patch reverted the other"
    );
    assertSome((yield* SubscriptionRef.get(journal.latest)).pipe(O.map((row) => row.data)), {
      round: 2,
      label: "b",
      optional: "retained",
    });
  })
);
for (const [name, seed, expected] of [
  ["empty", "", O.none()],
  ["torn object", `${line(1)}{`, O.some({ round: 1, label: "seed" })],
  ["torn scalar", `${line(1)}4`, O.some({ round: 1, label: "seed" })],
  ["oversized tail", line(1) + line(2, Str.repeat(90000)("x")), O.some({ round: 2, label: Str.repeat(90000)("x") })],
] satisfies ReadonlyArray<readonly [string, string, O.Option<{ round: number; label: string }>]>) {
  it.effect(`seeds latest from ${name}`, () =>
    Effect.gen(function* () {
      const fs = yield* memory();
      yield* fs.writeFileString(path, seed);
      const journal = yield* open(fs);
      const actual = (yield* SubscriptionRef.get(journal.latest)).pipe(O.map((row) => row.data));
      O.match(expected, { onNone: () => assertNone(actual), onSome: (value) => assertSome(actual, value) });
    })
  );
}
it.effect("BOM offsets are logical and later BOM characters remain payload content", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, `\ufeff${line(1, "\ufeffinside")}`);
    const journal = yield* open(fs);
    const seed = yield* SubscriptionRef.get(journal.latest);
    assertSome(
      O.map(seed, (row) => row.line.offset),
      0
    );
    const next = yield* journal.append("noted", { round: 2, label: "next" });
    assertSome(
      O.map(seed, (row) => row.line.end),
      next.line.offset
    );
    const rows = yield* Stream.runCollect(journal.query({ events: ["noted"] }));
    assert.deepStrictEqual(
      A.map(rows, (row) => row.data.label),
      ["\ufeffinside", "next"]
    );
  })
);
it.effect("closed journals reject late appends", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const scope = yield* Scope.make();
    const journal = yield* open(fs).pipe(Effect.provideService(Scope.Scope, scope));
    yield* journal.create;
    yield* Scope.close(scope, Exit.void);
    const result10 = yield* Effect.result(journal.append("noted", { round: 1, label: "late" }));
    assertFailure(result10, JournalClosed.make({ event: "noted" }));
  })
);
it.effect("layer instances are independent while one bound layer is memoized", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, "");
    const layer = TestJournal.layer({ path });
    const memo = yield* Layer.makeMemoMap;
    const scope = yield* Scope.Scope;
    const build = (selected: typeof layer) => Layer.buildWithMemoMap(selected, memo, scope);
    const contexts = yield* Effect.all([build(layer), build(layer), build(TestJournal.layer({ path }))], {
      concurrency: 1,
    }).pipe(Effect.provideService(FileSystem.FileSystem, fs));
    const [first, same, other] = A.map(contexts, (context) => Context.get(context, TestJournal));
    assert.strictEqual(first, same);
    assert.notStrictEqual(first, other);
  })
);
it.effect("an outer subscriber receives completed appends before scope end", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const scope = yield* Scope.make();
    const journal = yield* open(fs).pipe(Effect.provideService(Scope.Scope, scope));
    yield* journal.create;
    const reader = yield* journal.changes().pipe(Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    for (const round of A.range(1, 4)) yield* journal.append("noted", { round, label: "a" });
    yield* Scope.close(scope, Exit.void);
    const join11 = yield* Fiber.join(reader);
    assert.deepStrictEqual(
      A.map(join11, (row) => row.data),
      A.map(A.range(1, 4), (round) => ({ round, label: "a" }))
    );
  })
);
it.effect("full hub bounds shutdown with TestClock while preserving disk writes", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const scope = yield* Scope.make();
    const journal = yield* open(fs, { path, capacity: 1, shutdownPublishTimeout: Duration.seconds(2) }).pipe(
      Effect.provideService(Scope.Scope, scope)
    );
    yield* journal.create;
    yield* PubSub.subscribe(journal.hub);
    yield* journal.append("noted", { round: 1, label: "a" });
    const append = yield* journal
      .append("noted", { round: 2, label: "b" })
      .pipe(Effect.forkChild({ startImmediately: true }));
    const closing = yield* Scope.close(scope, Exit.void).pipe(Effect.forkChild({ startImmediately: true }));
    yield* TestClock.adjust(Duration.seconds(2));
    yield* Fiber.join(closing);
    const readFileString12 = yield* fs.readFileString(path);
    assert.include(readFileString12, '"round":2');
    yield* Fiber.interrupt(append);
  })
);

// Ported from upstream Journal.test.ts (MIT).
class Boxed extends S.Class<Boxed, { readonly brand: unique symbol }>($I`Boxed`)({
  round: S.Finite,
  phase: S.String,
  note: S.optionalKey(S.String),
}) {}
const boxEvents = Tuple.make(JsonlEvent.make("boxed", { data: Boxed }));
class BoxJournal extends Journal.Service<BoxJournal>()($I`BoxJournal`, { events: boxEvents }) {}
const openBoxedFromJsonText = Effect.fn("JsonlTest.openBoxed")(function* (data: string) {
  const fs = yield* memory();
  yield* fs.writeFileString(path, `{"at":"2026-01-01T00:00:00.000Z","event":"boxed","data":${data}}\n`);
  const context = yield* Layer.build(
    BoxJournal.layer({ path }).pipe(Layer.provide(Layer.succeed(FileSystem.FileSystem, fs)))
  );
  return Context.get(context, BoxJournal);
});

describe("Journal — appendPatch inherits from a Schema.Class payload", () => {
  it.effect("a partial patch INHERITS untouched fields from a class-instance base", () =>
    Effect.gen(function* () {
      const journal = yield* openBoxedFromJsonText('{"round":1,"phase":"keep-me"}');
      const envelope = yield* journal.appendPatch("boxed", { round: 2 });
      assert.strictEqual(envelope.data.round, 2, "the patched field changed");
      assert.strictEqual(envelope.data.phase, "keep-me", "the untouched field was INHERITED, not dropped");
      assertInstanceOf(envelope.data, Boxed, "the merged payload is still a class instance");
    })
  );

  it.effect("an OPTIONAL untouched field is inherited, where a plain replacement fails the class schema", () =>
    Effect.gen(function* () {
      const journal = yield* openBoxedFromJsonText('{"round":1,"phase":"p","note":"must-survive"}');
      const envelope = yield* journal.appendPatch("boxed", { round: 2 });
      assert.strictEqual(envelope.data.note, "must-survive", "an optional field must survive a partial patch");
    })
  );
});

const nullableBoxEvents = Tuple.make(JsonlEvent.make("boxed", { data: S.NullOr(Boxed) }));
class NullableBoxJournal extends Journal.Service<NullableBoxJournal>()($I`NullableBoxJournal`, {
  events: nullableBoxEvents,
}) {}
const transformedBox = S.Struct({ ...Boxed.fields, round: S.FiniteFromString }).pipe(
  S.decodeTo(S.instanceOf(Boxed), {
    decode: SchemaGetter.transformEffect((fields) =>
      S.decodeEffect(Boxed)({ ...fields, round: 1 / fields.round }).pipe(Effect.mapError((error) => error.issue))
    ),
    encode: SchemaGetter.transform((boxed) => ({ ...boxed, round: 1 / boxed.round })),
  })
);
const transformedBoxEvents = Tuple.make(JsonlEvent.make("boxed", { data: transformedBox }));
class TransformedBoxJournal extends Journal.Service<TransformedBoxJournal>()($I`TransformedBoxJournal`, {
  events: transformedBoxEvents,
}) {}

it.effect("appendPatch preserves nullable class payloads and rejects invalid patches before writing", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(
      path,
      '{"at":"2026-01-01T00:00:00.000Z","event":"boxed","data":{"round":1,"phase":"keep-me","note":"must-survive"}}\n'
    );
    const context = yield* Layer.build(
      NullableBoxJournal.layer({ path }).pipe(Layer.provide(Layer.succeed(FileSystem.FileSystem, fs)))
    );
    const journal = Context.get(context, NullableBoxJournal);
    const envelope = yield* journal.appendPatch("boxed", { round: 2 });
    assertInstanceOf(envelope.data, Boxed);
    assert.strictEqual(envelope.data.round, 2);
    assert.strictEqual(envelope.data.phase, "keep-me");
    assert.strictEqual(envelope.data.note, "must-survive");
    const persisted = yield* fs.readFileString(path);
    assert.strictEqual(Line.split(persisted).length, 2);
    const failure = yield* Effect.flip(journal.appendPatch("boxed", { round: Number.NaN }));
    assert.strictEqual(failure._tag, "InvalidData");
    const readFileString13 = yield* fs.readFileString(path);
    assert.strictEqual(readFileString13, persisted);
  })
);

it.effect("appendPatch preserves transformed class codecs and rejects invalid patches before writing", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(
      path,
      '{"at":"2026-01-01T00:00:00.000Z","event":"boxed","data":{"round":"1","phase":"keep-me","note":"must-survive"}}\n'
    );
    const context = yield* Layer.build(
      TransformedBoxJournal.layer({ path }).pipe(Layer.provide(Layer.succeed(FileSystem.FileSystem, fs)))
    );
    const journal = Context.get(context, TransformedBoxJournal);
    const envelope = yield* journal.appendPatch("boxed", { round: 2 });
    assertInstanceOf(envelope.data, Boxed);
    assert.strictEqual(envelope.data.round, 2);
    assert.strictEqual(envelope.data.phase, "keep-me");
    assert.strictEqual(envelope.data.note, "must-survive");
    const persisted = yield* fs.readFileString(path);
    assert.strictEqual(Line.split(persisted).length, 2);
    assert.include(persisted, '"round":"0.5"');
    const failure = yield* Effect.flip(journal.appendPatch("boxed", { round: Number.NaN }));
    assert.strictEqual(failure._tag, "InvalidData");
    const readFileString14 = yield* fs.readFileString(path);
    assert.strictEqual(readFileString14, persisted);
    const decodedFailure = yield* Effect.flip(journal.appendPatch("boxed", { round: Number.POSITIVE_INFINITY }));
    assert.strictEqual(
      decodedFailure._tag,
      "InvalidData",
      'Infinity encodes to "0" but decodes back to Infinity, which Boxed\'s finite field rejects'
    );
    const readFileString15 = yield* fs.readFileString(path);
    assert.strictEqual(readFileString15, persisted);
  })
);

const boxedWire = S.Struct({ ...Boxed.fields, round: S.FiniteFromString });
const boxedWireUnion = S.Union([boxedWire, S.Struct(Boxed.fields)]);
const boxedFromWire = {
  decode: SchemaGetter.transformEffect((fields: typeof boxedWire.Type) =>
    S.decodeEffect(Boxed)(fields).pipe(Effect.mapError((error) => error.issue))
  ),
  encode: SchemaGetter.transform((boxed: Boxed) => ({ ...boxed })),
};
const composedBoxCases = [
  ["suspended class", S.suspend(() => Boxed), "1", '"round":2'],
  ["suspended union member", S.Union([S.suspend(() => Boxed), S.Null]), "1", '"round":2'],
  ["union wire decodeTo", boxedWireUnion.pipe(S.decodeTo(S.instanceOf(Boxed), boxedFromWire)), '"1"', '"round":"2"'],
  [
    "suspended wire target",
    S.suspend(() => boxedWire).pipe(S.decodeTo(S.instanceOf(Boxed), boxedFromWire)),
    '"1"',
    '"round":"2"',
  ],
] as const;

for (const [name, data, seedRound, encodedRound] of composedBoxCases) {
  it.effect(`appendPatch keeps ${name}'s decoded class and wire codec, rejects invalid patches without writing`, () =>
    Effect.gen(function* () {
      const fs = yield* memory();
      yield* fs.writeFileString(
        path,
        `{"at":"2026-01-01T00:00:00.000Z","event":"boxed","data":{"round":${seedRound},"phase":"keep-me","note":"must-survive"}}\n`
      );
      class ComposedJournal extends Journal.Service<ComposedJournal>()($I`ComposedJournal`, {
        events: Tuple.make(JsonlEvent.make("boxed", { data })),
      }) {}
      const context = yield* Layer.build(
        ComposedJournal.layer({ path }).pipe(Layer.provide(Layer.succeed(FileSystem.FileSystem, fs)))
      );
      const journal = Context.get(context, ComposedJournal);
      const envelope = yield* journal.appendPatch("boxed", { round: 2 });
      assertInstanceOf(envelope.data, Boxed);
      if (envelope.data === null) return assert.fail("the class payload must survive");
      assert.strictEqual(envelope.data.round, 2);
      assert.strictEqual(envelope.data.phase, "keep-me");
      assert.strictEqual(envelope.data.note, "must-survive");
      const persisted = yield* fs.readFileString(path);
      assert.strictEqual(Line.split(persisted).length, 2);
      assert.include(persisted, encodedRound);
      assert.notInclude(persisted, "~effect/Schema/Class/");
      assert.strictEqual((yield* Effect.flip(journal.appendPatch("boxed", { round: Number.NaN })))._tag, "InvalidData");
      const readFileString16 = yield* fs.readFileString(path);
      assert.strictEqual(readFileString16, persisted);
    })
  );
}

class AsNumber extends S.Class<AsNumber, { readonly brand: unique symbol }>($I`AsNumber`)({
  n: S.Finite,
  keep: S.String,
}) {}
class AsString extends S.Class<AsString, { readonly brand: unique symbol }>($I`AsString`)({
  n: S.FiniteFromString,
  keep: S.String,
  extra: S.String,
}) {}
for (const [name, data] of [
  ["number first", S.Union([AsNumber, AsString])],
  ["string first", S.Union([AsString, AsNumber])],
] as const) {
  it.effect(`appendPatch retains ambiguous class provenance with ${name}`, () =>
    Effect.gen(function* () {
      const fs = yield* memory();
      yield* fs.writeFileString(
        path,
        '{"at":"2026-01-01T00:00:00.000Z","event":"ambiguous","data":{"n":"1","keep":"a","extra":"z"}}\n'
      );
      class AmbiguousJournal extends Journal.Service<AmbiguousJournal>()($I`AmbiguousJournal`, {
        events: Tuple.make(JsonlEvent.make("ambiguous", { data })),
      }) {}
      const context = yield* Layer.build(
        AmbiguousJournal.layer({ path }).pipe(Layer.provide(Layer.succeed(FileSystem.FileSystem, fs)))
      );
      const journal = Context.get(context, AmbiguousJournal);
      const envelope = yield* journal.appendPatch("ambiguous", { n: 2 });
      assertInstanceOf(envelope.data, AsString);
      if (!S.is(AsString)(envelope.data)) return assert.fail("the string class must survive");
      assert.strictEqual(envelope.data.n, 2);
      assert.strictEqual(envelope.data.keep, "a");
      assert.strictEqual(envelope.data.extra, "z");
      const persisted = yield* fs.readFileString(path);
      assert.strictEqual(Line.split(persisted).length, 2);
      assert.include(persisted, '"n":"2"');
      assert.include(persisted, '"extra":"z"');
      assert.notInclude(persisted, "~effect/Schema/Class/");
      assert.strictEqual((yield* Effect.flip(journal.appendPatch("ambiguous", { n: Number.NaN })))._tag, "InvalidData");
      const readFileString17 = yield* fs.readFileString(path);
      assert.strictEqual(readFileString17, persisted);
    })
  );
}

const roundOf = (envelope: EnvelopeUnion<typeof events>): number =>
  envelope.event === "noted" ? envelope.data.round : assert.fail("wrong envelope variant: never a silent skip");

// Ported from upstream Journal.test.ts (MIT).
describe("Journal — the terminal Exit never overtakes a completed append", () => {
  it.effect("an outer-scope subscriber sees EVERY completed append before stream end", () =>
    Effect.gen(function* () {
      const fs = yield* memory();
      yield* fs.writeFileString(path, "");
      const journalScope = yield* Scope.make();
      const journal = yield* open(fs, { path, capacity: 1, shutdownPublishTimeout: Duration.seconds(30) }).pipe(
        Effect.provideService(Scope.Scope, journalScope)
      );
      const outerScopeSubscription = yield* PubSub.subscribe(journal.hub);

      yield* journal.append("noted", { round: 1, label: "a" });
      const second = yield* journal
        .append("noted", { round: 2, label: "b" })
        .pipe(Effect.forkChild({ startImmediately: true }));
      yield* Effect.yieldNow;
      const thirdMakesOvertakeReachable = yield* journal
        .append("noted", { round: 3, label: "c" })
        .pipe(Effect.forkChild({ startImmediately: true }));
      yield* Effect.yieldNow;
      const bothPublishesOutstandingOnceThirdWriteLands = SubscriptionRef.changes(journal.latest).pipe(
        Stream.filter((value) => O.exists(value, (row) => row.event === "noted" && row.data.round === 3)),
        Stream.runHead
      );
      yield* bothPublishesOutstandingOnceThirdWriteLands;
      const readFileString18 = yield* fs.readFileString(path);
      assert.strictEqual(Line.split(readFileString18).length, 3, "every write landed");
      assert.isUndefined(second.pollUnsafe(), "the second append is blocked in publish");
      assert.isUndefined(
        thirdMakesOvertakeReachable.pollUnsafe(),
        "the third append is blocked behind the second one's baton"
      );

      const closingWhilePublishesOutstanding = yield* Scope.close(journalScope, Exit.void).pipe(
        Effect.forkChild({ startImmediately: true })
      );
      yield* Effect.yieldNow;

      const takes = yield* Effect.all(
        A.makeBy(4, () => PubSub.take(outerScopeSubscription)),
        { concurrency: 1 }
      );
      yield* Fiber.join(second);
      yield* Fiber.join(thirdMakesOvertakeReachable);
      yield* Fiber.join(closingWhilePublishesOutstanding);

      const [one, two, three, end] = takes;
      assert.isTrue(A.isArray(one), "first take is an envelope chunk");
      assert.isTrue(A.isArray(two), "second take is an envelope chunk");
      assert.isTrue(A.isArray(three), "the THIRD completed append is delivered before the Exit");
      assert.isFalse(A.isArray(end), "the terminal Exit comes last");
      assertTrue(Exit.isExit(end), "the terminal Exit comes last");
      assertExitSuccess(end, undefined);

      const rounds = A.flatMap(takes, (take) => (Exit.isExit(take) ? [] : A.map(take, roundOf)));
      assert.deepStrictEqual(rounds, [1, 2, 3], "every completed append was delivered");
    })
  );
});
