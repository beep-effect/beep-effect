import { DuckDbTestLayer } from "@beep/duckdb";
import * as DuckDbPersistedQueue from "@beep/duckdb/DuckDbPersistedQueue";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { assert } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Scope from "effect/Scope";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import { suiteWith as sqlContract } from "./shared/PersistedQueueSqlTest.ts";
import { suiteWith as contract } from "./shared/PersistedQueueTest.ts";

it.layer(Layer.mergeAll(DuckDbTestLayer, NodeCrypto.layer), { timeout: "30 seconds" })((testApi) => {
  contract(
    "duckdb",
    DuckDbPersistedQueue.layerStoreSql({ pollInterval: "10 millis" }).pipe(Layer.provide(NodeCrypto.layer)),
    testApi,
    "90 seconds"
  );
  sqlContract(testApi);
  testApi.effect("reports offer and cleanup failures as PersistedQueueError", () =>
    Effect.gen(function* () {
      const store = yield* DuckDbPersistedQueue.makeStoreSql({ tableName: "effect_queue_failures" });
      const offer = { name: "failures", id: "1", isCustomId: true };
      const unencodable = yield* Effect.flip(store.offer({ ...offer, element: { n: BigInt(1) } }));
      assert.strictEqual(unencodable.message, "Failed to offer element to persisted queue");
      const sql = yield* SqlClient.SqlClient;
      yield* sql`DROP TABLE effect_queue_failures`;
      const cleanup = yield* Effect.flip(
        store.cleanup({ timeToLive: Duration.seconds(1), failedTimeToLive: Duration.seconds(1) })
      );
      assert.strictEqual(cleanup.message, "Failed to clean up persisted queue");
    })
  );
  testApi.effect("dead-letters a stored element that no longer parses and takes the next one", () =>
    Effect.gen(function* () {
      const store = yield* DuckDbPersistedQueue.makeStoreSql({
        tableName: "effect_queue_corrupt",
        pollInterval: "10 millis",
      });
      const sql = yield* SqlClient.SqlClient;
      yield* store.offer({ name: "corrupt", id: "bad", isCustomId: true, element: { n: 1 } });
      yield* store.offer({ name: "corrupt", id: "good", isCustomId: true, element: { n: 2 } });
      yield* sql`UPDATE effect_queue_corrupt SET element = '{not json' WHERE id = 'bad'`;
      // Closing the take scope with a success completes the good element after the bad one is dead-lettered.
      const takeScope = yield* Scope.make();
      const taken = yield* store
        .take({ name: "corrupt", maxAttempts: 3, retryDelay: () => Effect.succeed(Duration.zero) })
        .pipe(Scope.provide(takeScope), TestClock.withLive);
      yield* Scope.close(takeScope, Exit.void);
      assert.strictEqual(taken.id, "good");
      const rows = yield* sql<{ readonly state: string }>`SELECT state FROM effect_queue_corrupt WHERE id = 'bad'`;
      assert.deepStrictEqual(rows, [{ state: "failed" }]);
    })
  );
  testApi.effect("keeps a take interruptible after dead-lettering the only stored element", () =>
    // Live clock throughout: the poller and the dead-letter wait run on real time.
    TestClock.withLive(
      Effect.gen(function* () {
        const store = yield* DuckDbPersistedQueue.makeStoreSql({
          tableName: "effect_queue_corrupt_only",
          pollInterval: "10 millis",
        });
        const sql = yield* SqlClient.SqlClient;
        yield* store.offer({ name: "corrupt-only", id: "bad", isCustomId: true, element: { n: 1 } });
        yield* sql`UPDATE effect_queue_corrupt_only SET element = '{not json' WHERE id = 'bad'`;
        const takeScope = yield* Scope.make();
        const taker = yield* store
          .take({ name: "corrupt-only", maxAttempts: 3, retryDelay: () => Effect.succeed(Duration.zero) })
          .pipe(Scope.provide(takeScope), Effect.forkChild);
        const deadLettered = sql<{
          readonly state: string;
        }>`SELECT state FROM effect_queue_corrupt_only WHERE id = 'bad'`;
        yield* deadLettered.pipe(
          Effect.filterOrFail((rows) => rows[0]?.state === "failed"),
          Effect.retry(Schedule.spaced("10 millis"))
        );
        // The take now waits for a new element; interrupting it must complete rather than hang.
        const interrupted = yield* Fiber.interrupt(taker).pipe(Effect.timeoutOption("2 seconds"));
        assertTrue(interrupted.pipe(Option.isSome));
        yield* Scope.close(takeScope, Exit.void);
      })
    )
  );
});
