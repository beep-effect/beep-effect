/**
 * Vendored from Effect, tag effect@4.0.6, packages/sql/pglite/test/SqlRunnerStorage.test.ts.
 * MIT License, Copyright (c) Effectful Technologies Inc. Adaptations carry // beep: markers.
 */
// beep: it.layer preserves per-test isolation without library-level Effect.provide.
// beep: Single-session DuckDB replaces the PGlite client.
import { DuckDbTestLayer } from "@beep/duckdb";
import * as SqlRunnerStorage from "@beep/duckdb/DuckDbRunnerStorage";
import { it } from "@beep/test-runner";
// beep: Use the repository Effect test runner.
import { assert, describe } from "@effect/vitest";
// beep: Effect public leaf imports replace upstream barrels.
import * as Runner from "effect/cluster/Runner";
import * as RunnerAddress from "effect/cluster/RunnerAddress";
import * as RunnerStorage from "effect/cluster/RunnerStorage";
import * as ShardId from "effect/cluster/ShardId";
import * as ShardingConfig from "effect/cluster/ShardingConfig";
// beep: Effect public leaf imports replace upstream barrels.
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
// beep: Effect public leaf imports replace upstream barrels.
import * as SqlClient from "effect/sql/SqlClient";

describe("SqlRunnerStorage", () => {
  for (const shardLockDisableAdvisory of [false, true]) {
    it.layer(
      SqlRunnerStorage.layer.pipe(
        Layer.provideMerge(DuckDbTestLayer),
        Layer.provide(ShardingConfig.layer({ shardLockDisableAdvisory }))
      )
    )((it) => {
      it.effect(
        `does not starve the shared DuckDB connection (shardLockDisableAdvisory: ${shardLockDisableAdvisory})`,
        () =>
          Effect.gen(function* () {
            const sql = yield* SqlClient.SqlClient;
            const storage = yield* RunnerStorage.RunnerStorage;
            const address = RunnerAddress.make("localhost", 1234);
            const runner = Runner.make({ address, groups: ["default"], weight: 1 });
            const shards = [ShardId.make("default", 1)];

            assert.deepStrictEqual(yield* storage.getRunners, []);
            yield* storage.register(runner, true);
            assert.deepStrictEqual(yield* storage.getRunners, [[runner, true]]);
            assert.deepStrictEqual(yield* storage.acquire(address, shards), shards);
            assert.deepStrictEqual(yield* storage.refresh(address, shards), shards);
            assert.deepStrictEqual(yield* sql`SELECT 2 AS n`, [{ n: 2 }]);
          }).pipe(Effect.timeout("5 seconds")),
        { timeout: 30_000 }
      );
    });
  }
});
