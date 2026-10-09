// Adapted from upstream Journal.test.ts and ReadSurfaces.test.ts (MIT).
import type { EnvelopeUnion } from "../../effected/jsonl/index.ts";
import {
  Journal,
  JournalClosed,
  JournalNotFound,
  JsonlEvent,
  Line,
  TerminalViolation,
} from "../../effected/jsonl/index.ts";
import { assert, describe, it } from "@effect/vitest";
import {
  assertExitSuccess,
  assertFailure,
  assertInstanceOf,
  assertNone,
  assertSome,
  assertTrue,
} from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";
import * as Tuple from "effect/Tuple";
import { $I, type events, line, memory, open, path, TestJournal } from "./fixtures.ts";

it.effect("constructs over a missing file, with explicit create/remove and typed append refusal", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    assertNone(yield* SubscriptionRef.get(journal.latest));
    assertFailure(
      yield* Effect.result(journal.append("noted", { round: 1, label: "a" })),
      JournalNotFound.make({ path })
    );
    assert.isFalse(yield* fs.exists(path));
    yield* journal.create;
    yield* journal.append("noted", { round: 1, label: "a" });
    assert.isTrue(yield* fs.exists(path));
    yield* journal.remove;
    yield* journal.remove;
    assert.isFalse(yield* fs.exists(path));
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
    assert.strictEqual(yield* fs.readFileString(path), appended.line.text + "\n");
    assertSome(yield* SubscriptionRef.get(journal.latest), appended);
  })
);
it.effect("terminal refusal, quiescence and reopening follow the last event", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    yield* journal.create;
    yield* journal.append("ended", null);
    assert.isTrue(yield* journal.quiescent);
    assertFailure(
      yield* Effect.result(journal.append("noted", { round: 1, label: "a" })),
      TerminalViolation.make({ event: "noted", terminal: "ended" })
    );
    yield* journal.append("reopened", null);
    assert.isFalse(yield* journal.quiescent);
    yield* journal.append("noted", { round: 2, label: "b" });
    assert.strictEqual((yield* Stream.runCollect(journal.query())).length, 3);
  })
);
// Upstream "two concurrent patches to different fields BOTH survive", gated as
// upstream gates it: the read-merge-write must all happen under one lock. Read
// outside it, and both patches see the same base and the second silently
// reverts the first, which is invisible because each append succeeds.
it.effect("concurrent partial patches retain both changed and optional fields", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const entered = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    let gate = false;
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
    const journal = yield* open(gated);
    yield* journal.create;
    yield* journal.append("noted", { round: 1, label: "a", optional: "retained" });

    // Hold the first patch inside the write permit.
    gate = true;
    const first = yield* journal.appendPatch("noted", { round: 2 }).pipe(Effect.forkChild({ startImmediately: true }));
    yield* Deferred.await(entered);
    assert.isUndefined(first.pollUnsafe(), "the first patch is genuinely mid-write");

    // The second patch must not have read the base yet.
    const second = yield* journal
      .appendPatch("noted", { label: "b" })
      .pipe(Effect.forkChild({ startImmediately: true }));
    yield* Effect.yieldNow;
    assert.isUndefined(second.pollUnsafe(), "the second patch waits for the first one's write permit");

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
  ["torn object", line(1) + "{", O.some({ round: 1, label: "seed" })],
  ["torn scalar", line(1) + "4", O.some({ round: 1, label: "seed" })],
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
    yield* fs.writeFileString(path, "\ufeff" + line(1, "\ufeffinside"));
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
    assertFailure(
      yield* Effect.result(journal.append("noted", { round: 1, label: "late" })),
      JournalClosed.make({ event: "noted" })
    );
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
    assert.deepStrictEqual(
      A.map(yield* Fiber.join(reader), (row) => row.data),
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
    assert.include(yield* fs.readFileString(path), '"round":2');
    yield* Fiber.interrupt(append);
  })
);

// Restored from upstream Journal.test.ts (MIT): "Journal — appendPatch inherits
// from a Schema.Class payload". The payload is seeded as JSON text, so the base
// of the patch is a DECODED class instance, not a plain record.
class Boxed extends S.Class<Boxed>($I`Boxed`)({
  round: S.Finite,
  phase: S.String,
  note: S.optionalKey(S.String),
}) {}
const boxEvents = Tuple.make(JsonlEvent.make("boxed", { data: Boxed }));
class BoxJournal extends Journal.Service<BoxJournal>()($I`BoxJournal`, { events: boxEvents }) {}
const openBoxed = Effect.fn("JsonlTest.openBoxed")(function* (data: string) {
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
      const journal = yield* openBoxed('{"round":1,"phase":"keep-me"}');
      const envelope = yield* journal.appendPatch("boxed", { round: 2 });
      assert.strictEqual(envelope.data.round, 2, "the patched field changed");
      assert.strictEqual(envelope.data.phase, "keep-me", "the untouched field was INHERITED, not dropped");
      assertInstanceOf(envelope.data, Boxed, "the merged payload is still a class instance");
    })
  );

  it.effect("an OPTIONAL untouched field is inherited rather than dropped", () =>
    Effect.gen(function* () {
      // Worth stating precisely, because the failure mode is NOT what it first
      // looks like: with a `Schema.Class` payload the replacement path produces
      // a plain object, which the class schema REJECTS, so a guard that misses
      // the class instance fails loudly (`InvalidData`) rather than silently. A
      // decoded class payload is not a plain record, and the class schema does
      // not accept a plain replacement. The defect would therefore be that
      // `appendPatch` is unusable with the kit's dominant payload idiom, not
      // that it loses data quietly.
      const journal = yield* openBoxed('{"round":1,"phase":"p","note":"must-survive"}');
      const envelope = yield* journal.appendPatch("boxed", { round: 2 });
      assert.strictEqual(envelope.data.note, "must-survive", "an optional field must survive a partial patch");
    })
  );
});

/** Assert the envelope carries `noted`, then read its round: never a silent skip. */
const roundOf = (envelope: EnvelopeUnion<typeof events>): number =>
  envelope.event === "noted" ? envelope.data.round : assert.fail("wrong envelope variant");

// Restored from upstream Journal.test.ts (MIT).
describe("Journal — the terminal Exit never overtakes a completed append", () => {
  it.effect("an outer-scope subscriber sees EVERY completed append before stream end", () =>
    Effect.gen(function* () {
      // The subscription lives in a scope that OUTLIVES the journal's (here the
      // test's own), which is the only way to observe what the terminal Exit
      // did. Once publishing left the write critical section, draining writes
      // stopped implying draining publishes, so the Exit, which is not on the
      // baton chain, could be published while an already-completed append's
      // envelope was still in flight.
      const fs = yield* memory();
      yield* fs.writeFileString(path, "");
      const journalScope = yield* Scope.make();
      const journal = yield* open(fs, { path, capacity: 1, shutdownPublishTimeout: Duration.seconds(30) }).pipe(
        Effect.provideService(Scope.Scope, journalScope)
      );
      const subscription = yield* PubSub.subscribe(journal.hub);

      // Capacity 1. A is accepted and fills the hub; B's publish then blocks on
      // capacity; C's blocks on B's BATON. That third append is what makes the
      // overtake reachable: with the Exit published directly it queues as a
      // waiting publisher AFTER B but BEFORE C, because C only reaches the hub
      // once B's baton is passed, so the stream ends between two completed
      // appends. With two appends the two blocked publishers happen to drain
      // FIFO in the right order and the bug hides.
      yield* journal.append("noted", { round: 1, label: "a" });
      const second = yield* journal
        .append("noted", { round: 2, label: "b" })
        .pipe(Effect.forkChild({ startImmediately: true }));
      yield* Effect.yieldNow;
      const third = yield* journal
        .append("noted", { round: 3, label: "c" })
        .pipe(Effect.forkChild({ startImmediately: true }));
      yield* Effect.yieldNow;
      // `latest` reaches round 3 only once the third write has landed, and no
      // publish can complete while the subscriber takes nothing, so both
      // publishes are provably outstanding from here on.
      yield* SubscriptionRef.changes(journal.latest).pipe(
        Stream.filter((value) => O.exists(value, (row) => row.event === "noted" && row.data.round === 3)),
        Stream.runHead
      );
      assert.strictEqual(Line.split(yield* fs.readFileString(path)).length, 3, "every write landed");
      assert.isUndefined(second.pollUnsafe(), "the second append is blocked in publish");
      assert.isUndefined(third.pollUnsafe(), "the third append is blocked behind the second one's baton");

      // Close the journal while both publishes are still outstanding.
      const closing = yield* Scope.close(journalScope, Exit.void).pipe(Effect.forkChild({ startImmediately: true }));
      yield* Effect.yieldNow;

      // Draining makes room, letting the queued publishers through in turn.
      const takes = yield* Effect.all(A.makeBy(4, () => PubSub.take(subscription)));
      yield* Fiber.join(second);
      yield* Fiber.join(third);
      yield* Fiber.join(closing);

      // All three completed appends, in order, and only THEN the stream end.
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
