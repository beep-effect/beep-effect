import "./shared/MessageStorageTest.ts";
import "./shared/SqlMessageStorageIntegrationTest.ts";
import { DuckDbTestLayer } from "@beep/duckdb";
import * as DuckDbMessageStorage from "@beep/duckdb/DuckDbMessageStorage";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as EntityAddress from "effect/cluster/EntityAddress";
import * as EntityId from "effect/cluster/EntityId";
import * as EntityType from "effect/cluster/EntityType";
import * as ShardId from "effect/cluster/ShardId";
import * as Snowflake from "effect/cluster/Snowflake";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import type * as Envelope from "effect/cluster/Envelope";

const address = { shardId: { group: "default", id: 1 }, entityType: "test", entityId: "1" };
type Trace = { readonly traceId?: string; readonly spanId?: string; readonly sampled?: boolean };
const request = (requestId: string, trace: Trace = {}): Envelope.Encoded => ({
  _tag: "Request",
  requestId,
  address,
  tag: "GetUser",
  payload: { id: 1 },
  headers: {},
  ...trace,
});
const save = (envelope: Envelope.Encoded) =>
  Effect.flatMap(DuckDbMessageStorage.makeEncoded(), (storage) =>
    storage.saveEnvelope({ envelope, primaryKey: null, deliverAt: null })
  );
const claim = Effect.gen(function* () {
  const storage = yield* DuckDbMessageStorage.makeEncoded();

  const currentTimeMillis1 = yield* Clock.currentTimeMillis;
  return yield* storage.unprocessedMessages(["default:1"], currentTimeMillis1);
});

// Both cases claim shard default:1 in the shared cluster_ tables, so run them one at a time (D49).
it.layer(Layer.mergeAll(DuckDbTestLayer, NodeCrypto.layer, Snowflake.layerGenerator), {
  concurrent: false,
  timeout: "30 seconds",
})("DuckDB message storage boundaries", (it) => {
  it.effect("reads requests without trace context and sampled requests", () =>
    Effect.gen(function* () {
      yield* save(request("10"));
      yield* save(request("11", { traceId: "trace", spanId: "span", sampled: true }));
      const claim1 = yield* claim;
      const [untraced, sampled] = A.map(claim1, (message) => message.envelope);
      assert(untraced?._tag === "Request" && sampled?._tag === "Request");
      assert.strictEqual(untraced.traceId, undefined);
      assert.deepStrictEqual([sampled.traceId, sampled.spanId, sampled.sampled], ["trace", "span", true]);
    })
  );

  it.effect("round-trips interrupts, acked chunks and address cleanup", () =>
    Effect.gen(function* () {
      const storage = yield* DuckDbMessageStorage.makeEncoded();
      yield* save(request("20"));
      assert.strictEqual((yield* claim).length, 1);
      yield* save({ _tag: "Interrupt", id: "21", requestId: "20", address });
      const claim2 = yield* claim;
      assert.deepStrictEqual(
        A.map(claim2, (message) => message.envelope._tag),
        ["Interrupt"]
      );
      yield* storage.saveReply({ _tag: "Chunk", id: "22", requestId: "20", sequence: 0, values: [null] });
      yield* save({ _tag: "AckChunk", id: "23", requestId: "20", replyId: "22", address });
      yield* storage.resetShards(["default:1"]);
      const claim3 = yield* claim;
      const resumed = A.findFirst(
        claim3,
        (message) => message.envelope._tag === "Request" && message.envelope.requestId === "20"
      );
      assert.deepStrictEqual(
        O.map(
          O.flatMap(resumed, (message) => message.lastSentReply),
          (reply) => reply.id
        ),
        O.some("22")
      );
      assert.strictEqual((yield* storage.repliesForUnfiltered(["20"])).length, 1);

      yield* storage.clearReplies(Snowflake.Snowflake("20"));
      const argument1 = A.of(Snowflake.Snowflake("21"));
      const currentTimeMillis2 = yield* Clock.currentTimeMillis;
      const unprocessedMessagesById4 = yield* storage.unprocessedMessagesById(argument1, currentTimeMillis2);
      assert.deepStrictEqual(unprocessedMessagesById4, []);
      yield* storage.resetRequests([]);
      yield* storage.clearAddress(
        EntityAddress.make({
          shardId: ShardId.make("default", 1),
          entityType: EntityType.make("test"),
          entityId: EntityId.make("1"),
        })
      );
      const repliesForUnfiltered5 = yield* storage.repliesForUnfiltered(["20"]);
      assert.deepStrictEqual(repliesForUnfiltered5, []);
      const withTransaction6 = yield* storage.withTransaction(Effect.succeed(1));
      assert.strictEqual(withTransaction6, 1);
    })
  );

  // After deleteProcessed removes a request its row is gone; a late reply must not leave an orphan behind (D70).
  it.effect("drops a reply whose request row is gone", () =>
    Effect.gen(function* () {
      const storage = yield* DuckDbMessageStorage.makeEncoded({ prefix: "late" });
      yield* storage.saveReply({ _tag: "Chunk", id: "41", requestId: "40", sequence: 0, values: [null] });
      const orphans = yield* storage.repliesForUnfiltered(["40"]);
      assert.deepStrictEqual(orphans, []);
    })
  );

  // Migration 0005 must reach files migrated before deleteProcessed existed, without editing 0001.
  it.effect("adds the retention index to a schema migrated before it existed", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const migrate = DuckDbMessageStorage.makeEncoded({ prefix: "retention" });
      yield* migrate;
      // Recreate a schema migrated by the earlier port: only migrations 1-3 ran.
      yield* sql`DROP INDEX retention_messages_retention_idx`;
      yield* sql`DELETE FROM retention_migrations WHERE migration_id > 3`;
      const storage = yield* migrate;
      const indexes = yield* sql<{ readonly index_name: string }>`
        SELECT index_name FROM duckdb_indexes() WHERE table_name = 'retention_messages' ORDER BY index_name
      `;
      assert.deepStrictEqual(
        A.map(indexes, (row) => row.index_name),
        ["retention_messages_request_id_idx", "retention_messages_retention_idx", "retention_messages_shard_idx"]
      );
      const migrations = yield* sql<{ readonly migration_id: number }>`
        SELECT migration_id FROM retention_migrations ORDER BY migration_id
      `;
      assert.deepStrictEqual(
        A.map(migrations, (row) => Number(row.migration_id)),
        [1, 2, 3, 4, 5]
      );
      const deleted = yield* storage.deleteProcessed({
        entityType: "test",
        completedBefore: Number.POSITIVE_INFINITY,
        limit: 10,
      });
      assert.strictEqual(deleted, 0);
    })
  );

  it.effect("make builds the decoded storage over migrated tables", () =>
    Effect.gen(function* () {
      const storage = yield* DuckDbMessageStorage.make({ prefix: "decoded" });
      const unprocessedMessages7 = yield* storage.unprocessedMessages([ShardId.make("default", 1)]);
      assert.deepStrictEqual(unprocessedMessages7, []);
    })
  );
});
