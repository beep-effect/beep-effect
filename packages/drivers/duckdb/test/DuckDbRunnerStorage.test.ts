import "./shared/DuckDbRunnerStorageSharedTest.ts";
import "./shared/DuckDbRunnerStorageIntegrationTest.ts";
import { DuckDbTestLayer } from "@beep/duckdb";
import * as DuckDbRunnerStorage from "@beep/duckdb/DuckDbRunnerStorage";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as RunnerAddress from "effect/cluster/RunnerAddress";
import * as RunnerStorage from "effect/cluster/RunnerStorage";
import * as ShardId from "effect/cluster/ShardId";
import * as ShardingConfig from "effect/cluster/ShardingConfig";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";

const splitOptions = { prefix: "split" };
it.layer(
  DuckDbRunnerStorage.layerStorage(splitOptions).pipe(
    Layer.provide(DuckDbRunnerStorage.layerMigrations(splitOptions)),
    Layer.provideMerge(DuckDbTestLayer),
    Layer.provide(ShardingConfig.layer())
  ),
  { timeout: "30 seconds" }
)("DuckDB runner split layers", (it) => {
  it.effect("refreshes no shards as a heartbeat", () =>
    Effect.gen(function* () {
      const storage = yield* RunnerStorage.RunnerStorage;
      assert.deepStrictEqual(yield* storage.refresh(RunnerAddress.make("localhost", 1234), []), []);
    })
  );
});

const deadlineOptions = { prefix: "deadline" };
it.layer(
  DuckDbRunnerStorage.layerStorage(deadlineOptions).pipe(
    Layer.provide(DuckDbRunnerStorage.layerMigrations(deadlineOptions)),
    Layer.provideMerge(DuckDbTestLayer),
    Layer.provide(ShardingConfig.layer({ shardLockRefreshInterval: "50 millis", shardLockExpiration: "300 millis" }))
  ),
  { timeout: "30 seconds" }
)("DuckDB runner operation deadline", (it) => {
  // The single DuckDB writer serializes statements, so a transaction that holds it past the
  // lock-operation interval makes a heartbeat miss its deadline and interrupts the stalled operation.
  it.effect("fails a heartbeat that cannot reach the writer before its deadline", () =>
    TestClock.withLive(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const storage = yield* RunnerStorage.RunnerStorage;
        const holder = yield* sql.withTransaction(Effect.sleep("500 millis")).pipe(Effect.forkChild);
        yield* Effect.sleep("20 millis");
        const exit = yield* Effect.exit(storage.refresh(RunnerAddress.make("localhost", 4321), []));
        assertTrue(exit.pipe(Exit.isFailure));
        yield* Fiber.join(holder);
        assert.deepStrictEqual(yield* storage.refresh(RunnerAddress.make("localhost", 4321), []), []);
      })
    )
  );
});

const zoneOptions = { prefix: "zone" };
it.layer(
  DuckDbRunnerStorage.layerStorage(zoneOptions).pipe(
    Layer.provide(DuckDbRunnerStorage.layerMigrations(zoneOptions)),
    Layer.provideMerge(DuckDbTestLayer),
    Layer.provide(ShardingConfig.layer())
  ),
  { timeout: "30 seconds" }
)("DuckDB runner lease time zones", (it) => {
  // Lease timestamps are instants: a lease written under UTC must still be live after the session
  // moves to UTC+14, so another runner cannot take the shard (a zone-less TIMESTAMP would read 14 hours old).
  it.effect("keeps a lease across a session TimeZone change", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const storage = yield* RunnerStorage.RunnerStorage;
      const owner = RunnerAddress.make("localhost", 5001);
      const rival = RunnerAddress.make("localhost", 5002);
      const shard = ShardId.make("default", 1);
      yield* sql`SET TimeZone = 'UTC'`;
      assert.deepStrictEqual(yield* storage.acquire(owner, [shard]), [shard]);
      yield* sql`SET TimeZone = 'Pacific/Kiritimati'`;
      assert.deepStrictEqual(yield* storage.acquire(rival, [shard]), []);
      assert.deepStrictEqual(yield* storage.refresh(owner, [shard]), [shard]);
      yield* sql`SET TimeZone = 'UTC'`;
    })
  );
});
