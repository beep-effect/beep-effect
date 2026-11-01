// Adapted from upstream Watcher.test.ts (MIT). Storage and real mutation events
// come from MemoryFileSystem; the decorator only exposes watcher registration.
import { assert, it } from "@effect/vitest";
import { assertFailure, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { externalAppend, line, memory, open, path } from "./fixtures.ts";
import type * as FileSystem from "effect/FileSystem";

const watched = Effect.fn("JsonlTest.watched")(function* (seed: O.Option<string>) {
  const fs = yield* memory();
  if (O.isSome(seed)) yield* fs.writeFileString(path, seed.value);
  const registrations = yield* Queue.unbounded<string>();
  const decorated: FileSystem.FileSystem = {
    ...fs,
    watch: (target, options) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const events = yield* fs.watch(target, options).pipe(Stream.toQueue({ capacity: "unbounded" }));
          yield* Queue.offer(registrations, target);
          return Stream.fromQueue(events);
        })
      ),
  };
  const journal = yield* open(decorated);
  assert.strictEqual(yield* Queue.take(registrations), O.isSome(seed) ? path : "/journal");
  return { fs, journal, registrations };
});
it.effect("foreign and local appends arrive once in file order with contiguous offsets", () =>
  Effect.gen(function* () {
    const { fs, journal } = yield* watched(O.some(""));
    const reader = yield* journal
      .changes({ events: ["noted"] })
      .pipe(Stream.take(3), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    yield* journal.append("noted", { round: 1, label: "ours" });
    yield* externalAppend(fs, line(2, "theirs"));
    yield* journal.append("noted", { round: 3, label: "ours" });
    const rows = yield* Fiber.join(reader);
    assert.deepStrictEqual(
      A.map(rows, (row) => row.data.round),
      [1, 2, 3]
    );
    assert.strictEqual(rows[1]?.line.offset, rows[0]?.line.end);
    assert.strictEqual(rows[2]?.line.offset, rows[1]?.line.end);
  })
);
it.effect("oversized Unicode external writes survive chunk boundaries", () =>
  Effect.gen(function* () {
    const { fs, journal } = yield* watched(O.some(""));
    const reader = yield* journal
      .changes({ events: ["noted"] })
      .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    const label = Str.repeat(25000)("😀");
    yield* externalAppend(fs, line(7, label));
    assert.deepStrictEqual(
      A.map(yield* Fiber.join(reader), (row) => row.data),
      [{ round: 7, label }]
    );
    assertSome((yield* SubscriptionRef.get(journal.latest)).pipe(O.map((row) => row.line.offset)), 0);
  })
);
it.effect("a torn external tail is consumed only after completion", () =>
  Effect.gen(function* () {
    const { fs, journal } = yield* watched(O.some(line(1)));
    const reader = yield* journal
      .changes({ events: ["noted"] })
      .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    const whole = line(2);
    yield* externalAppend(fs, Str.slice(0, 20)(whole));
    // Complete history remains readable while the original writer finishes.
    assert.strictEqual((yield* journal.query().pipe(Stream.runCollect)).length, 1);
    yield* externalAppend(fs, Str.slice(20)(whole));
    assert.deepStrictEqual(
      A.map(yield* Fiber.join(reader), (row) => row.data.round),
      [2]
    );
  })
);
for (const reason of ["truncated", "replaced"]) {
  it.effect(`reports ${reason} as a typed resync`, () =>
    Effect.gen(function* () {
      const { fs, journal } = yield* watched(O.some(line(1) + line(2)));
      const reader = yield* journal
        .changes()
        .pipe(Stream.runCollect, Effect.result, Effect.forkChild({ startImmediately: true }));
      if (reason === "truncated") yield* fs.writeFileString(path, "{");
      else {
        yield* fs.writeFileString("/journal/new.jsonl", line(8) + line(9) + line(10));
        yield* fs.rename("/journal/new.jsonl", path);
        yield* externalAppend(fs, line(11));
      }
      const result = yield* Fiber.join(reader);
      assertFailure(
        Result.mapError(result, (error) => (error._tag === "JournalResync" ? error.reason : error._tag)),
        reason
      );
    })
  );
}
it.effect("creation activates a missing journal and hands off to the file watch", () =>
  Effect.gen(function* () {
    const { fs, journal, registrations } = yield* watched(O.none());
    const reader = yield* journal
      .changes({ events: ["noted"] })
      .pipe(Stream.take(1), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    yield* journal.create;
    assert.strictEqual(yield* Queue.take(registrations), path);
    yield* externalAppend(fs, line(42));
    assert.deepStrictEqual(
      A.map(yield* Fiber.join(reader), (row) => row.data.round),
      [42]
    );
  })
);
it.effect("a write while the file watch arms is caught without a second write", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, line(1));
    let injected = false;
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: (target, options) =>
        Stream.unwrap(
          Effect.gen(function* () {
            if (!injected && target === path) {
              injected = true;
              yield* externalAppend(fs, line(2));
            }
            return fs.watch(target, options);
          })
        ),
    };
    const journal = yield* open(decorated);
    const observed = yield* SubscriptionRef.changes(journal.latest).pipe(
      Stream.filter((value) => O.exists(value, (row) => row.event === "noted" && row.data.round === 2)),
      Stream.runHead
    );
    assertSome(O.flatten(observed).pipe(O.map((row) => row.data)), { round: 2, label: "seed" });
  })
);

for (const present of [false, true]) {
  it.effect(`catch-up follows delayed watch installation, present=${present}`, () =>
    Effect.gen(function* () {
      const fs = yield* memory();
      if (present) yield* fs.writeFileString(path, line(1));
      const acquiring = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const decorated: FileSystem.FileSystem = {
        ...fs,
        watch: (target, options) =>
          Stream.unwrap(
            Effect.gen(function* () {
              yield* Deferred.succeed(acquiring, undefined);
              yield* Deferred.await(release);
              return fs.watch(target, options);
            })
          ),
      };
      const journal = yield* open(decorated);
      yield* Deferred.await(acquiring);
      const reader = yield* SubscriptionRef.changes(journal.latest).pipe(
        Stream.filter((value) => O.exists(value, (row) => row.event === "noted" && row.data.round === 2)),
        Stream.runHead,
        Effect.forkChild({ startImmediately: true })
      );
      // This append finishes while acquisition is blocked, so the installed
      // watch cannot emit its event. Only catch-up after readiness can see it.
      yield* externalAppend(fs, line(2));
      assert.isFalse(yield* Deferred.isDone(release));
      yield* Deferred.succeed(release, undefined);
      assertSome(O.flatten(yield* Fiber.join(reader)).pipe(O.map((row) => row.data)), { round: 2, label: "seed" });
    })
  );
}

for (const present of [false, true]) {
  for (const fails of [false, true]) {
    it.effect(`watch termination before readiness rearms finitely, present=${present}, fails=${fails}`, () =>
      Effect.gen(function* () {
        const fs = yield* memory();
        if (present) yield* fs.writeFileString(path, "");
        const stopped = yield* Deferred.make<void>();
        let registrations = 0;
        const decorated: FileSystem.FileSystem = {
          ...fs,
          watch: () =>
            Stream.unwrap(
              Effect.gen(function* () {
                registrations++;
                if (registrations === 9) yield* Deferred.succeed(stopped, undefined);
                return fails ? fs.watch("/unavailable") : Stream.empty;
              })
            ),
        };
        const journal = yield* open(decorated);
        yield* Deferred.await(stopped);
        if (!present) yield* journal.create;
        assert.strictEqual((yield* journal.append("noted", { round: 1, label: "local" })).data.round, 1);
        assert.strictEqual(registrations, 9);
      })
    );
  }
}

it.effect("closing the journal cancels watch acquisition before readiness", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    yield* fs.writeFileString(path, "");
    const acquiring = yield* Deferred.make<void>();
    const cancelled = yield* Deferred.make<void>();
    const scope = yield* Scope.make();
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: () =>
        Stream.unwrap(
          Effect.gen(function* () {
            yield* Deferred.succeed(acquiring, undefined);
            return yield* Effect.never;
          }).pipe(Effect.ensuring(Deferred.succeed(cancelled, undefined)))
        ),
    };
    yield* open(decorated).pipe(Effect.provideService(Scope.Scope, scope));
    yield* Deferred.await(acquiring);
    yield* Scope.close(scope, Exit.void);
    assert.isTrue(yield* Deferred.isDone(cancelled));
  })
);

it.effect("activation handoff drains an ingest staged behind a backpressured catch-up", () =>
  Effect.gen(function* () {
    const fs = yield* memory();
    const acquiring = yield* Deferred.make<void>();
    const install = yield* Deferred.make<void>();
    const fileArmed = yield* Deferred.make<void>();
    const directoryEvents = yield* Queue.unbounded<FileSystem.WatchEvent>();
    const decorated: FileSystem.FileSystem = {
      ...fs,
      watch: (target, options) =>
        target === path
          ? Stream.never.pipe(
              Stream.onStart(
                Effect.sync(() => options?.onReady?.()).pipe(Effect.andThen(Deferred.succeed(fileArmed, undefined)))
              )
            )
          : Stream.fromQueue(directoryEvents).pipe(
              Stream.onStart(
                Deferred.succeed(acquiring, undefined).pipe(
                  Effect.andThen(Deferred.await(install)),
                  Effect.andThen(Effect.sync(() => options?.onReady?.()))
                )
              )
            ),
    };
    const journal = yield* open(decorated, { path, capacity: 1 });
    const subscription = yield* PubSub.subscribe(journal.hub);
    yield* Deferred.await(acquiring);
    yield* externalAppend(fs, `${line(1)}${line(2)}`);
    yield* Deferred.succeed(install, undefined);
    yield* SubscriptionRef.changes(journal.latest).pipe(
      Stream.filter((value) => O.exists(value, (row) => row.event === "noted" && row.data.round === 2)),
      Stream.runHead
    );
    // Catch-up A has advanced through two rows but capacity one blocks its
    // second publication. A directory poke now stages B behind A's baton.
    yield* externalAppend(fs, line(3));
    yield* Queue.offer(directoryEvents, { _tag: "Create", path });
    yield* SubscriptionRef.changes(journal.latest).pipe(
      Stream.filter((value) => O.exists(value, (row) => row.event === "noted" && row.data.round === 3)),
      Stream.runHead
    );
    const first = yield* PubSub.take(subscription);
    const second = yield* PubSub.take(subscription);
    yield* Deferred.await(fileArmed);
    assert.strictEqual(yield* PubSub.size(journal.hub), 1, "handoff must retain B's staged publication");
    const third = yield* PubSub.take(subscription);
    assert.deepStrictEqual(
      A.flatMap([first, second, third], (take) =>
        Exit.isExit(take) ? [] : A.map(take, (row) => (row.event === "noted" ? row.data.round : -1))
      ),
      [1, 2, 3]
    );
    assert.strictEqual(yield* PubSub.size(journal.hub), 0);
  })
);
