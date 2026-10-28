import { DuckDbTestLayer } from "@beep/duckdb";
import * as DuckDbPersistence from "@beep/duckdb/DuckDbPersistence";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Persistence from "effect/persistence/Persistence";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import { suite } from "./shared/DuckDbPersistenceSharedTest.ts";

suite("duckdb table-per-store", DuckDbPersistence.layerBackingSqlMultiTable, {
  injectionProbe: `') UNION SELECT id, value FROM effect_persistence_sqli_victim WHERE ('1'='1`,
});
suite("duckdb shared-table", DuckDbPersistence.layerBackingSql, {
  injectionProbe: `') OR store_id='sqli_victim' AND ('1'='1`,
});
for (const [name, backing, table] of [
  ["shared", DuckDbPersistence.layerBackingSql, "effect_persistence"],
  ["multi", DuckDbPersistence.layerBackingSqlMultiTable, "effect_persistence_widths"],
] as const) {
  it.layer(backing.pipe(Layer.provideMerge(Layer.fresh(DuckDbTestLayer))), { timeout: "30 seconds" })(
    `DuckDB persistence ${name} widths`,
    (it) => {
      it.effect("round-trips epoch-millis TTL and values beyond INT32", () =>
        Effect.gen(function* () {
          yield* TestClock.setTime(1793151157372);
          const persistence = yield* Persistence.BackingPersistence;
          const store = yield* persistence.make("widths");
          yield* store.set("snowflake", { id: 4294967296 }, Duration.seconds(10));
          assert.deepStrictEqual(yield* store.get("snowflake"), { id: 4294967296 });
          const sql = yield* SqlClient.SqlClient;
          const [row] = yield* sql<{ expires: number }>`SELECT expires FROM ${sql(table)} WHERE id = 'snowflake'`;
          assert.strictEqual(row?.expires, 1793151167372);
          yield* TestClock.adjust("10 seconds");
          assert.strictEqual(yield* store.get("snowflake"), undefined);
        })
      );
    }
  );
}

import * as A from "effect/Array";
import * as Schedule from "effect/Schedule";

it.layer(Layer.fresh(DuckDbTestLayer), { timeout: "30 seconds" })("DuckDB persistence cleanup", (it) => {
  it.effect("cleans more than two batches and preserves live rows", () =>
    Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms();
      yield* sql`CREATE TABLE effect_persistence (
   store_id TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, expires BIGINT, PRIMARY KEY (store_id,id)
  )`;
      yield* sql`INSERT INTO effect_persistence ${sql.insert(A.makeBy(2100, (i) => ({ store_id: "expired", id: `${i}`, value: "{}", expires: 1 })))}`;
      yield* sql`INSERT INTO effect_persistence (store_id,id,value,expires) VALUES ('live','forever','{}',NULL),('live','future','{}',9000000000000)`;
      yield* Layer.build(DuckDbPersistence.layerBackingSql).pipe(TestClock.withLive);
      const count = sql<{
        count: number;
      }>`SELECT COUNT(*) AS count FROM effect_persistence WHERE store_id = 'expired'`.pipe(
        Effect.map((rows) => A.getUnsafe(rows, 0).count)
      );
      const expired = yield* TestClock.withLive(
        count.pipe(
          Effect.repeat({ while: (count) => count !== 0, schedule: Schedule.spaced("10 millis") }),
          Effect.timeout("10 seconds")
        )
      );
      assert.strictEqual(expired, 0);
      const live = yield* sql<{
        count: number;
      }>`SELECT COUNT(*) AS count FROM effect_persistence WHERE store_id = 'live'`;
      assert.strictEqual(A.getUnsafe(live, 0).count, 2);
    })
  );
});

it.layer(Layer.fresh(DuckDbTestLayer), { timeout: "30 seconds" })("DuckDB persistence failures", (it) => {
  it.effect("skips malformed rows in getMany and reports failures after the table is gone", () =>
    Effect.gen(function* () {
      // Build in the test scope so the expiry sweep runs on this test's TestClock.
      const backing = yield* Layer.build(DuckDbPersistence.layerBackingSql);
      const store = yield* Context.get(backing, Persistence.BackingPersistence).make("failures");
      yield* store.setMany([
        ["good", { ok: true }, undefined],
        ["bad", { ok: false }, undefined],
      ]);
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE effect_persistence SET value = 'not json' WHERE id = 'bad'`;
      assert.deepStrictEqual(yield* store.getMany(["good", "bad"]), [{ ok: true }, undefined]);
      yield* sql`DROP TABLE effect_persistence`;
      const error = yield* Effect.flip(store.clear);
      assert.strictEqual(error.message, "Failed to clear backing store");
      // The next scheduled expiry sweep logs its failed delete instead of failing the layer.
      yield* TestClock.adjust("5 minutes");
      yield* TestClock.withLive(Effect.sleep("100 millis"));
    })
  );
});
