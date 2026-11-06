/** Vendored backing-store cases from effect@4.0.6 packages/sql/sqlite-node/test/Persistence.test.ts (MIT). */
// beep: omit filesystem client and unrelated queue suites; caller supplies DuckDB backing layers.
// beep: Layer.fresh isolates databases between suite fixtures.
// beep: each concurrent case has its own store id (upstream reused test_store_2).
import { DuckDbTestLayer } from "@beep/duckdb";
import { it } from "@beep/test-runner";
import { assert, expect } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Persistence from "effect/persistence/Persistence";
import * as TestClock from "effect/testing/TestClock";
import { describe } from "vitest";
import type * as SqlClient from "effect/sql/SqlClient";

// beep: dual forms satisfy the repository's missingPipeableSignature rule.
type SuiteOptions = { readonly injectionProbe: string };
type BackingLayer = Layer.Layer<Persistence.BackingPersistence, never, SqlClient.SqlClient>;
export const suite: {
  (layer: BackingLayer, options: SuiteOptions): (name: string) => void;
  (name: string, layer: BackingLayer, options: SuiteOptions): void;
} = dual(3, (name: string, layer: BackingLayer, options: SuiteOptions) =>
  // beep: shared TestClock adjustments must run sequentially under this repo's concurrent Vitest default.
  describe(`Persistence clock isolation (${name})`, { concurrent: false }, () =>
    it.layer(layer.pipe(Layer.provideMerge(Layer.fresh(DuckDbTestLayer))))(`Persistence (${name})`, (it) => {
      it.effect("set + get", () =>
        Effect.gen(function* () {
          const persistence = yield* Persistence.BackingPersistence;
          const store = yield* persistence.make("test_store");
          yield* store.set("key1", { name: "Alice" }, undefined);
          const value = yield* store.get("key1");
          expect(value).toEqual({ name: "Alice" });

          // test upsert
          yield* store.set("key1", { name: "Alice" }, undefined);
        })
      );

      it.effect("setMany + getMany", () =>
        Effect.gen(function* () {
          const persistence = yield* Persistence.BackingPersistence;
          const store = yield* persistence.make("test_store_remove");
          yield* store.setMany([
            ["key1", { name: "Alice" }, undefined],
            ["key2", { name: "Bob" }, undefined],
            ["key3", { name: "Charlie" }, undefined],
          ]);
          const values = yield* store.getMany(["key1", "key2", "key3", "key4"]);
          expect(values).toEqual([{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }, undefined]);
        })
      );

      it.effect("getMany with duplicate keys", () =>
        Effect.gen(function* () {
          const persistence = yield* Persistence.BackingPersistence;
          const store = yield* persistence.make("test_store_duplicate_keys");
          yield* store.set("key", { value: 1 }, undefined);

          const gotMany = yield* store.getMany(["key", "key"]);
          expect(gotMany).toEqual([{ value: 1 }, { value: 1 }]);
        })
      );

      it.effect("remove", () =>
        Effect.gen(function* () {
          const persistence = yield* Persistence.BackingPersistence;
          const store = yield* persistence.make("test_store_batch");
          yield* store.setMany([
            ["key1", { name: "Alice" }, undefined],
            ["key2", { name: "Bob" }, undefined],
            ["key3", { name: "Charlie" }, undefined],
          ]);
          yield* store.remove("key2");
          const valuesAfter = yield* store.getMany(["key1", "key2", "key3"]);
          expect(valuesAfter).toEqual([{ name: "Alice" }, undefined, { name: "Charlie" }]);
        })
      );

      it.effect("expires", () =>
        Effect.gen(function* () {
          const persistence = yield* Persistence.BackingPersistence;
          const store = yield* persistence.make("test_store_3");
          yield* store.setMany([
            ["key1", { name: "Alice" }, undefined],
            ["key2", { name: "Bob" }, undefined],
            ["key3", { name: "Charlie" }, Duration.seconds(10)],
          ]);
          let values = yield* store.getMany(["key1", "key2", "key3"]);
          expect(values).toEqual([{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }]);
          yield* TestClock.adjust(Duration.seconds(5));
          values = yield* store.getMany(["key1", "key2", "key3"]);
          expect(values).toEqual([{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }]);
          yield* TestClock.adjust(Duration.seconds(5));
          values = yield* store.getMany(["key1", "key2", "key3"]);
          expect(values).toEqual([{ name: "Alice" }, { name: "Bob" }, undefined]);
        })
      );

      it.effect("reused get expires", () =>
        Effect.gen(function* () {
          const persistence = yield* Persistence.BackingPersistence;
          const store = yield* persistence.make("test_store_reused_get");
          yield* store.set("key", { name: "Alice" }, Duration.seconds(10));
          const get = store.get("key");

          const got = yield* get;
          assert.deepStrictEqual(got, { name: "Alice" });
          yield* TestClock.adjust(Duration.seconds(10));
          const got1 = yield* get;
          assert.strictEqual(got1, undefined);
        })
      );

      it.effect("reused getMany expires", () =>
        Effect.gen(function* () {
          const persistence = yield* Persistence.BackingPersistence;
          const store = yield* persistence.make("test_store_reused_get_many");
          yield* store.set("key", { name: "Alice" }, Duration.seconds(10));
          const getMany = store.getMany(["key"]);

          const gotMany2 = yield* getMany;
          assert.deepStrictEqual(gotMany2, [{ name: "Alice" }]);
          yield* TestClock.adjust(Duration.seconds(10));
          const gotMany3 = yield* getMany;
          assert.deepStrictEqual(gotMany3, [undefined]);
        })
      );

      it.effect("isolation between stores", () =>
        Effect.gen(function* () {
          const persistence = yield* Persistence.BackingPersistence;
          const storeA = yield* persistence.make("test_store_a");
          const storeB = yield* persistence.make("test_store_b");

          yield* storeA.set("shared-key", { name: "Alice" }, undefined);
          yield* storeB.set("shared-key", { name: "Bob" }, undefined);

          const got4 = yield* storeA.get("shared-key");
          expect(got4).toEqual({ name: "Alice" });
          const got5 = yield* storeB.get("shared-key");
          expect(got5).toEqual({ name: "Bob" });

          yield* storeA.clear;

          const got6 = yield* storeA.get("shared-key");
          expect(got6).toEqual(undefined);
          const got7 = yield* storeB.get("shared-key");
          expect(got7).toEqual({ name: "Bob" });
        })
      );

      it.effect("getMany treats keys containing single quotes as data", () =>
        Effect.gen(function* () {
          const persistence = yield* Persistence.BackingPersistence;
          const store = yield* persistence.make("test_store_quotes");
          yield* store.set("it's-a-key", { name: "Alice" }, undefined);

          // Keys must be bound as parameters, not
          // interpolated into the `IN` list as raw string literals.
          const values = yield* store.getMany(["it's-a-key", "missing'key"]);
          expect(values).toEqual([{ name: "Alice" }, undefined]);
        })
      );

      it.effect("getMany preserves store isolation for crafted keys", () =>
        Effect.gen(function* () {
          const persistence = yield* Persistence.BackingPersistence;
          const victim = yield* persistence.make("sqli_victim");
          yield* victim.set("secret", { secret: "victim-data" }, undefined);

          const attacker = yield* persistence.make("sqli_attacker");
          yield* attacker.set("innocent", { name: "Mallory" }, undefined);

          // The probe is a no-op key when keys are parameterized. If keys are
          // interpolated into raw SQL it escapes the `IN` list and exfiltrates
          // the victim store's `secret` entry into the attacker's results.
          const values = yield* attacker.getMany(["secret", options.injectionProbe]);
          expect(values).toEqual([undefined, undefined]);
          const got8 = yield* attacker.get("secret");
          expect(got8).toEqual(undefined);
        })
      );
    })
  )
);
