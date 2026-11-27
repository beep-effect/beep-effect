/**
 * Vendored from Effect, tag effect@4.1.4, packages/effect/test/persistence/PersistedQueueSqlTest.ts.
 * MIT License, Copyright (c) Effectful Technologies Inc. Adaptations carry // beep: markers.
 */
// beep: The DuckDB queue uses Effect Crypto for claim UUIDs.

// beep: DuckDB store replaces upstream SQL constructor; remaining contract is unchanged.
import * as DuckDbPersistedQueue from "@beep/duckdb/DuckDbPersistedQueue";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
// beep: Effect public leaf imports replace upstream barrels.
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
// beep: Effect public leaf imports replace upstream barrels.
import * as PersistedQueue from "effect/persistence/PersistedQueue";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
// beep: Effect public leaf imports replace upstream barrels.
import * as SqlClient from "effect/sql/SqlClient";
// beep: Effect public leaf imports replace upstream barrels.
import * as TestClock from "effect/testing/TestClock";
import type { Vitest } from "@effect/vitest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as Duration from "effect/Duration";

const makeQueue = Effect.fnUntraced(function* (
  tableName: string,
  pollInterval: Duration.Input = "10 millis",
  // beep: `unknown` output replaces upstream's `any`; the queue only feeds attempt numbers in.
  retrySchedule?: Schedule.Schedule<unknown, number>
) {
  const store = yield* DuckDbPersistedQueue.makeStoreSql({ tableName, pollInterval });
  const factory = yield* PersistedQueue.makeFactory.pipe(
    Effect.provideService(PersistedQueue.PersistedQueueStore, store)
  );
  return yield* factory.make({ name: tableName, schema: Schema.String, retrySchedule });
});

const awaitMidSecond = Effect.gen(function* () {
  while (true) {
    const millis = (yield* Clock.currentTimeMillis) % 1000;
    if (millis >= 500 && millis < 600) return;
    yield* Effect.sleep(10);
  }
});

const databaseClockLagMillis = 100;

export const suiteWith = (testApi: Vitest.MethodsNonLive<SqlClient.SqlClient | SecureRandom.SecureRandom>) => {
  testApi.layer(Layer.empty, { concurrent: false, timeout: "90 seconds" })("PersistedQueue SQL delays", (it) => {
    it.effect(
      "never delivers a delayed offer early at a second boundary",
      () =>
        Effect.gen(function* () {
          const queue = yield* makeQueue("effect_queue_delay_boundary");
          yield* awaitMidSecond;

          const offeredAt = yield* Clock.currentTimeMillis;
          yield* queue.offer("delayed", { delay: "1 second" });
          yield* queue.take(Effect.succeed);

          assert.isAtLeast(
            (yield* Clock.currentTimeMillis) - offeredAt,
            1000 - databaseClockLagMillis,
            "offered mid-second, so a whole-second database clock would drop about half a second"
          );
        }).pipe(TestClock.withLive),
      { timeout: 30000 }
    );

    it.effect(
      "never retries a failed job early at a second boundary",
      () =>
        Effect.gen(function* () {
          const queue = yield* makeQueue("effect_queue_retry_boundary", "10 millis", Schedule.spaced("1 second"));
          yield* queue.offer("job");

          const failedAt = yield* queue
            .take(() => awaitMidSecond.pipe(Effect.andThen(Clock.currentTimeMillis), Effect.flatMap(Effect.fail)))
            .pipe(Effect.catchIf(P.isNumber, Effect.succeed));
          const retriedAt = yield* queue.take(() => Clock.currentTimeMillis);

          assert.isAtLeast(
            retriedAt - failedAt,
            1000 - databaseClockLagMillis,
            "both handlers are timed mid-second, leaving out the acknowledgement writes"
          );
        }).pipe(TestClock.withLive),
      { timeout: 30000 }
    );

    it.effect(
      "measures the delay from an offer made inside a transaction",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const queue = yield* makeQueue("effect_queue_delay_transaction");

          const offeredAt = yield* Effect.gen(function* () {
            yield* Effect.sleep("2 seconds");
            const offeredAt = yield* Clock.currentTimeMillis;
            yield* queue.offer("delayed", { delay: "3 seconds" });
            return offeredAt;
          }).pipe(sql.withTransaction);
          yield* queue.take(Effect.succeed);

          assert.isAtLeast(
            (yield* Clock.currentTimeMillis) - offeredAt,
            3000 - databaseClockLagMillis,
            "the delay counts from the offer, not the transaction start; serial, so it holds up no other test's offer"
          );
        }).pipe(TestClock.withLive),
      { timeout: 30000 }
    );

    it.effect(
      "wakes a waiting taker once an offer made inside a transaction commits",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const queue = yield* makeQueue("effect_queue_commit_wake", "1 hour");
          const taken = yield* queue.take(Effect.succeed).pipe(Effect.forkScoped);

          yield* queue.offer("committed").pipe(Effect.andThen(Effect.sleep("500 millis")), sql.withTransaction);

          const value = yield* Fiber.join(taken).pipe(Effect.timeoutOption("5 seconds"));
          assert.deepStrictEqual(
            value,
            Option.some("committed"),
            "the 1 hour poll never fires and a pre-commit wake-up finds nothing, so the post-commit wake-up delivers"
          );
        }).pipe(TestClock.withLive),
      { timeout: 30000 }
    );
  });

  testApi.layer(Layer.empty, { concurrent: false, timeout: "90 seconds" })("PersistedQueue SQL offers", (it) => {
    it.effect(
      "untilExecuted offers of the same new id from concurrent transactions succeed",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const queue = yield* makeQueue("effect_queue_until_executed_transactions");

          // beep: Effect.forEach replaces the upstream for loop.
          yield* Effect.forEach(
            A.range(0, 9),
            (round) =>
              Effect.all(
                A.map([1, 2], (n) =>
                  queue
                    .offer(`offer-${n}`, { id: `job-${round}`, deduplicate: "untilExecuted" })
                    .pipe(sql.withTransaction)
                ),
                { concurrency: "unbounded", discard: true }
              ),
            { concurrency: 1 }
          );
        }).pipe(TestClock.withLive),
      { timeout: 30000 }
    );

    it.effect(
      "an untilExecuted re-offer is atomic with concurrent default offers",
      () =>
        Effect.gen(function* () {
          const queue = yield* makeQueue("effect_queue_until_executed_mixed");
          const id = "mixed-id";
          yield* queue.offer("first", { id });
          yield* queue.take(Effect.succeed);

          const reoffer = yield* queue.offer("reoffer", { id, deduplicate: "untilExecuted" }).pipe(Effect.forkChild);
          while (reoffer.pollUnsafe() === undefined) {
            yield* queue.offer("retry", { id });
          }
          yield* Fiber.join(reoffer);

          const taken = yield* queue.take(Effect.succeed);
          assert.strictEqual(
            taken,
            "reoffer",
            "default offers see either the completed element or the re-offer, so none of them is stored"
          );
        }).pipe(TestClock.withLive),
      { timeout: 30000 }
    );
  });

  testApi.layer(Layer.empty, { concurrent: false, timeout: "90 seconds" })("PersistedQueue SQL claims", (it) => {
    const makeOwnershipQueue = Effect.fnUntraced(function* (tableName: string) {
      const store = yield* DuckDbPersistedQueue.makeStoreSql({
        tableName,
        pollInterval: "100 millis",
        lockRefreshInterval: "100 millis",
        lockExpiration: "1 second",
      });
      const factory = yield* PersistedQueue.makeFactory.pipe(
        Effect.provideService(PersistedQueue.PersistedQueueStore, store)
      );
      return yield* factory.make({ name: tableName, schema: Schema.String, retrySchedule: Schedule.spaced(0) });
    });

    for (const [settlement, sameStore] of [
      ["failure", true],
      ["failure", false],
      ["success", true],
    ] as const) {
      it.effect(
        `a stale ${settlement} preserves a newer claim from ${sameStore ? "the same" : "another"} store`,
        () =>
          Effect.gen(function* () {
            const tableName = `effect_queue_stale_${settlement}_${sameStore ? "same" : "other"}`;
            const stale = yield* makeOwnershipQueue(tableName);
            const queue = sameStore ? stale : yield* makeOwnershipQueue(tableName);
            yield* stale.offer("job", { id: "job-1" });

            const aTaken = Latch.makeUnsafe();
            const aRelease = Latch.makeUnsafe();
            const aFiber = yield* stale
              .take(() =>
                aTaken.open.pipe(
                  Effect.andThen(aRelease.await),
                  Effect.andThen(settlement === "failure" ? Effect.fail("boom") : Effect.void)
                )
              )
              .pipe(Effect.forkScoped);
            yield* aTaken.await.pipe(Effect.timeout("5 seconds"), TestClock.withLive);

            yield* Effect.sleep("2500 millis").pipe(TestClock.withLive);

            const bTaken = Latch.makeUnsafe();
            const replacement = yield* queue
              .take((value, { attempts }) =>
                Effect.gen(function* () {
                  assert.strictEqual(value, "job");
                  assert.strictEqual(
                    attempts,
                    2,
                    "refreshes stayed paused on TestClock while the live database clock expired the first claim"
                  );
                  yield* bTaken.open;
                  return yield* Effect.never;
                })
              )
              .pipe(Effect.forkScoped);
            yield* bTaken.await.pipe(Effect.timeout("5 seconds"), TestClock.withLive);

            yield* Effect.sleep("100 millis").pipe(
              TestClock.withLive,
              Effect.andThen(TestClock.adjust("100 millis")),
              Effect.forever,
              Effect.forkScoped
            );
            yield* aRelease.open;
            yield* Fiber.await(aFiber);

            const duplicate = yield* queue
              .take((value, metadata) => Effect.succeed({ value, ...metadata }))
              .pipe(Effect.forkScoped);
            yield* Effect.sleep("1500 millis").pipe(TestClock.withLive);
            assert.isUndefined(
              duplicate.pollUnsafe(),
              "past lockExpiration, the stale settlement neither released the replacement nor unregistered its refresh"
            );

            yield* Fiber.interrupt(replacement);
            const redelivered = yield* Fiber.join(duplicate).pipe(Effect.timeout("5 seconds"), TestClock.withLive);
            assert.deepStrictEqual(redelivered, { value: "job", id: "job-1", attempts: 2 });
          }),
        { timeout: 30000 }
      );
    }
  });
};
