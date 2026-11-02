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
  return yield* storage.unprocessedMessages(["default:1"], yield* Clock.currentTimeMillis);
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
      const [untraced, sampled] = A.map(yield* claim, (message) => message.envelope);
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
      assert.deepStrictEqual(
        A.map(yield* claim, (message) => message.envelope._tag),
        ["Interrupt"]
      );
      yield* storage.saveReply({ _tag: "Chunk", id: "22", requestId: "20", sequence: 0, values: [null] });
      yield* save({ _tag: "AckChunk", id: "23", requestId: "20", replyId: "22", address });
      yield* storage.resetShards(["default:1"]);
      const resumed = A.findFirst(
        yield* claim,
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
      assert.deepStrictEqual(
        yield* storage.unprocessedMessagesById([Snowflake.Snowflake("21")], yield* Clock.currentTimeMillis),
        []
      );
      yield* storage.resetRequests([]);
      yield* storage.clearAddress(
        EntityAddress.make({
          shardId: ShardId.make("default", 1),
          entityType: EntityType.make("test"),
          entityId: EntityId.make("1"),
        })
      );
      assert.deepStrictEqual(yield* storage.repliesForUnfiltered(["20"]), []);
      assert.strictEqual(yield* storage.withTransaction(Effect.succeed(1)), 1);
    })
  );

  it.effect("make builds the decoded storage over migrated tables", () =>
    Effect.gen(function* () {
      const storage = yield* DuckDbMessageStorage.make({ prefix: "decoded" });
      assert.deepStrictEqual(yield* storage.unprocessedMessages([ShardId.make("default", 1)]), []);
    })
  );
});
