// beep: Effect array ordering preserves the upstream assertions under repository diagnostics.

// Vendored from effect@4.0.6 packages/platform/node/test/cluster/SqlRunnerStorage.integration.test.ts.
// beep: Retain the shared SQLite registration/shard contract. PostgreSQL/MySQL reserved-connection,
// advisory-lock and blackhole scenarios require server drivers and do not apply to DuckDB (D65).
import { DuckDbTestLayer } from "@beep/duckdb";
import * as SqlRunnerStorage from "@beep/duckdb/DuckDbRunnerStorage";
// beep: Public leaf imports and repository test runner replace upstream barrels.
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Runner from "effect/cluster/Runner";
import * as RunnerAddress from "effect/cluster/RunnerAddress";
import * as RunnerStorage from "effect/cluster/RunnerStorage";
import * as ShardId from "effect/cluster/ShardId";
import * as ShardingConfig from "effect/cluster/ShardingConfig";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";

const runnerAddress1 = RunnerAddress.make("localhost", 1234);
it.layer(SqlRunnerStorage.layer.pipe(Layer.provideMerge(DuckDbTestLayer), Layer.provide(ShardingConfig.layer())), {
  concurrent: false,
  timeout: "60 seconds",
})("DuckDB runner integration", (it) => {
  it.effect(
    "getRunners",
    () =>
      Effect.gen(function* () {
        const storage = yield* RunnerStorage.RunnerStorage;

        const runner = Runner.make({
          address: runnerAddress1,
          groups: ["default"],
          weight: 1,
        });
        const machineId = yield* storage.register(runner, true);
        yield* storage.register(runner, true);
        expect(machineId).toEqual(1);
        expect(yield* storage.getRunners).toEqual([[runner, true]]);

        yield* storage.setRunnerHealth(runnerAddress1, false);
        expect(yield* storage.getRunners).toEqual([[runner, false]]);

        yield* storage.unregister(runnerAddress1);
        expect(yield* storage.getRunners).toEqual([]);
      }),
    { timeout: 30_000 }
  );

  it.effect("acquireShards", () =>
    Effect.gen(function* () {
      const storage = yield* RunnerStorage.RunnerStorage;

      let acquired = yield* storage.acquire(runnerAddress1, [
        ShardId.make("default", 1),
        ShardId.make("default", 2),
        ShardId.make("default", 3),
      ]);
      expect(A.map(acquired, (_) => _.id)).toEqual([1, 2, 3]);
      acquired = yield* storage.acquire(runnerAddress1, [
        ShardId.make("default", 1),
        ShardId.make("default", 2),
        ShardId.make("default", 3),
      ]);
      expect(A.map(acquired, (_) => _.id)).toEqual([1, 2, 3]);
      acquired = yield* storage.acquire(runnerAddress1, [ShardId.make("default", 4)]);
      expect(A.map(acquired, (_) => _.id)).toEqual([4]);

      const refreshed = yield* storage.refresh(runnerAddress1, [
        ShardId.make("default", 1),
        ShardId.make("default", 2),
        ShardId.make("default", 3),
      ]);
      expect(
        A.sort(
          A.map(refreshed, (_) => _.id),
          Order.Number
        )
      ).toEqual([1, 2, 3]);

      // smoke test release
      yield* storage.release(runnerAddress1, ShardId.make("default", 2));
    })
  );
});
