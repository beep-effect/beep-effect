// Adapted from upstream Journal.test.ts and ReadSurfaces.test.ts (MIT).
import { JournalClosed, JournalNotFound, TerminalViolation } from "@beep/scratchpad/effected/jsonl/index";
import { assert, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";
import { line, memory, open, path, TestJournal } from "./fixtures.ts";

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
it.effect("concurrent partial patches retain both changed and optional fields", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const journal = yield* open(fs);
    yield* journal.create;
    yield* journal.append("noted", { round: 1, label: "a", optional: "retained" });
    yield* Effect.all([journal.appendPatch("noted", { round: 2 }), journal.appendPatch("noted", { label: "b" })], {
      concurrency: 2,
    });
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
