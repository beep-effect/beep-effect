import { DuckDbTestLayer } from "@beep/duckdb";
import * as DuckDbPersistedQueue from "@beep/duckdb/DuckDbPersistedQueue";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as Layer from "effect/Layer";
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
});
