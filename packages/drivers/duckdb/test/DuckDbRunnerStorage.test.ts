import "./shared/DuckDbRunnerStorageSharedTest.ts";
import "./shared/DuckDbRunnerStorageIntegrationTest.ts";
import { DuckDbTestLayer } from "@beep/duckdb";
import * as DuckDbRunnerStorage from "@beep/duckdb/DuckDbRunnerStorage";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as RunnerAddress from "effect/cluster/RunnerAddress";
import * as RunnerStorage from "effect/cluster/RunnerStorage";
import * as ShardingConfig from "effect/cluster/ShardingConfig";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

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
