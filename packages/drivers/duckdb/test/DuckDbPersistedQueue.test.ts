import { DuckDbTestLayer } from "@beep/duckdb";
import * as DuckDbPersistedQueue from "@beep/duckdb/DuckDbPersistedQueue";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { assert } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
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
});
