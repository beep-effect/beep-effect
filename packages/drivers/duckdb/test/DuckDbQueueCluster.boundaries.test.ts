import { DuckDbTestLayer } from "@beep/duckdb";
import * as MessageStore from "@beep/duckdb/DuckDbMessageStorage";
import * as QueueStore from "@beep/duckdb/DuckDbPersistedQueue";
import * as RunnerStore from "@beep/duckdb/DuckDbRunnerStorage";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { assert } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Runner from "effect/cluster/Runner";
import * as RunnerAddress from "effect/cluster/RunnerAddress";
import * as ShardId from "effect/cluster/ShardId";
import * as ShardingConfig from "effect/cluster/ShardingConfig";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as SqlClient from "effect/sql/SqlClient";
import type * as MessageStorage from "effect/cluster/MessageStorage";

const layer = Layer.mergeAll(DuckDbTestLayer, NodeCrypto.layer, ShardingConfig.layerDefaults);
it.layer(layer, { timeout: "30 seconds" })((it) => {
  it.effect("queue preserves a BIGINT sequence and epoch-millis timestamps", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`SET TimeZone = 'America/New_York'`;
      yield* sql`CREATE SEQUENCE wide_queue_sequence START 4294967296`;
      const store = yield* QueueStore.makeStoreSql({ tableName: "wide_queue", pollInterval: "10 millis" });
      const before = yield* Clock.Clock.defaultValue().currentTimeMillis;
      yield* store.offer({ name: "wide", id: "a", element: "payload", isCustomId: true });
      const rows = yield* sql<{
        sequence: number;
        created: number;
      }>`SELECT sequence, epoch_ms(created_at) AS created FROM wide_queue`;
      assert.strictEqual(rows[0]?.sequence, 4294967296);
      assert.isAtLeast(rows[0]?.created ?? 0, before);
      assert.isAbove(rows[0]?.created ?? 0, 2147483647);
      // Closing the take scope with a success marks the element completed; the assertion below reads that state.
      const takeScope = yield* Scope.make();
      const taken = yield* store
        .take({ name: "wide", maxAttempts: 1, retryDelay: () => Effect.succeed(Duration.zero) })
        .pipe(Scope.provide(takeScope));
      yield* Scope.close(takeScope, Exit.void);
      assert.strictEqual(taken.element, "payload");
      assert.deepStrictEqual(yield* sql`SELECT state FROM wide_queue`, [{ state: "completed" }]);
    })
  );
});

// The queue case changes the session TimeZone, so the lease cases below get their own database.
it.layer(layer, { timeout: "30 seconds" })((it) => {
  const request = (
    requestId: string
  ): MessageStorage.Encoded["saveEnvelope"] extends (options: infer T) => unknown ? T : never => ({
    envelope: {
      _tag: "Request",
      requestId,
      address: { shardId: { group: "default", id: 1 }, entityType: "Wide", entityId: "one" },
      tag: "test",
      payload: { value: "payload" },
      headers: {},
    },
    primaryKey: "wide/request",
    deliverAt: 1793131200123,
  });
  it.effect("message storage preserves snowflakes beyond 2^53, delayed epoch millis, and reply ids", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const storage = yield* MessageStore.makeEncoded({ prefix: "wide" });
      const id = "9007199254740993";
      const options = request(id);
      assert.strictEqual((yield* storage.saveEnvelope(options))._tag, "Success");
      const duplicate = yield* storage.saveEnvelope({
        ...options,
        envelope: { ...options.envelope, requestId: "9007199254740995" },
      });
      assert.strictEqual(duplicate._tag, "Duplicate");
      if (duplicate._tag === "Duplicate") assert.strictEqual(String(duplicate.originalId), id);
      assert.deepStrictEqual(yield* storage.unprocessedMessages(["default:1"], 1793131200122), []);
      const messages = yield* storage.unprocessedMessages(["default:1"], 1793131200123);
      assert.strictEqual(messages[0]?.envelope._tag, "Request");
      if (messages[0]?.envelope._tag === "Request") assert.strictEqual(messages[0].envelope.requestId, id);
      yield* storage.saveReply({
        _tag: "Chunk",
        id: "9007199254740997",
        requestId: id,
        sequence: 4294967296,
        values: ["chunk"],
      });
      assert.deepStrictEqual(yield* storage.repliesFor([id]), [
        { _tag: "Chunk", id: "9007199254740997", requestId: id, sequence: 4294967296, values: ["chunk"] },
      ]);
      assert.deepStrictEqual(yield* sql`SELECT deliver_at FROM wide_messages`, [{ deliver_at: 1793131200123 }]);
    }).pipe(Effect.asVoid)
  );

  it.effect("runner leases exclude another owner, expire, and keep wide machine ids and epoch millis", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`CREATE SEQUENCE wide_runners_sequence START 3000000000`;
      const a = yield* RunnerStore.make({ prefix: "wide" });
      const b = yield* RunnerStore.make({ prefix: "wide" });
      const address = RunnerAddress.make("localhost", 1234);
      const other = RunnerAddress.make("localhost", 5678);
      const runner = Runner.make({ address, groups: ["default"], weight: 1 });
      assert.strictEqual(yield* a.register(runner, true), 3000000000);
      const shard = ShardId.make("default", 1);
      assert.deepStrictEqual(yield* a.acquire(address, [shard]), [shard]);
      assert.deepStrictEqual(yield* b.acquire(other, [shard]), []);
      yield* sql`UPDATE wide_locks SET acquired_at = now() - INTERVAL '1 hour'`;
      assert.deepStrictEqual(yield* b.acquire(other, [shard]), [shard]);
      yield* a.releaseAll(address);
      assert.deepStrictEqual(yield* b.refresh(other, [shard]), [shard]);
      const rows = yield* sql<{ millis: number }>`SELECT epoch_ms(last_heartbeat) AS millis FROM wide_runners`;
      assert.isAbove(rows[0]?.millis ?? 0, 2147483647);
      yield* b.releaseAll(other);
      assert.deepStrictEqual(yield* a.acquire(address, [shard]), [shard]);
    })
  );
});
