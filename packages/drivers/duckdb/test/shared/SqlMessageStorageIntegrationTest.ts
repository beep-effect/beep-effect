/**
 * Vendored from Effect, tag effect@4.0.6, packages/platform/node/test/cluster/SqlMessageStorage.integration.test.ts.
 * MIT License, Copyright (c) Effectful Technologies Inc. Adaptations carry // beep: markers.
 */
// beep: Only the shared and SQLite-branch cases apply to DuckDB (D65). PostgreSQL deadlock and index,
// beep: and MSSQL index-name cases need server drivers. Containers are replaced by DuckDbTestLayer.
import { DuckDbTestLayer } from "@beep/duckdb";
import * as DuckDbMessageStorage from "@beep/duckdb/DuckDbMessageStorage";
// beep: Public leaf imports and the repository test runner replace upstream barrels.
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { assert, describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Entity from "effect/cluster/Entity";
import * as EntityAddress from "effect/cluster/EntityAddress";
import * as EntityId from "effect/cluster/EntityId";
import * as EntityType from "effect/cluster/EntityType";
import * as Envelope from "effect/cluster/Envelope";
import * as Message from "effect/cluster/Message";
import * as MessageStorage from "effect/cluster/MessageStorage";
import * as RunnerHealth from "effect/cluster/RunnerHealth";
import * as RunnerStorage from "effect/cluster/RunnerStorage";
import * as Runners from "effect/cluster/Runners";
import * as ShardId from "effect/cluster/ShardId";
import * as Sharding from "effect/cluster/Sharding";
import * as ShardingConfig from "effect/cluster/ShardingConfig";
import * as Snowflake from "effect/cluster/Snowflake";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import {
  GetUserRpc,
  LongKeyRpc,
  makeAckChunk,
  makeChunkReply,
  makeReply,
  makeRequest,
  PrimaryKeyTest,
  StreamRpc,
} from "./MessageStorageTest.ts";
import type * as Rpc from "effect/rpc/Rpc";

const TestEntity = Entity.make("test", [GetUserRpc]);
const TestEntityLayer = TestEntity.toLayer({
  GetUser: () => Effect.void,
});

// beep: DuckDB storage over an in-memory DuckDB client replaces SqlMessageStorage over a container.
const StorageLayer = DuckDbMessageStorage.layer.pipe(
  Layer.provideMerge(Snowflake.layerGenerator),
  Layer.provide([ShardingConfig.layerDefaults, NodeCrypto.layer])
);

const truncate = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DELETE FROM cluster_replies`;
  yield* sql`DELETE FROM cluster_messages`;
});

// beep: Shared helpers replace repeated upstream inline blocks for the duplication gate.
const shardOne = ShardId.make("default", 1);
const addressFor = (entityId: string, shardId: ShardId.ShardId = shardOne) =>
  EntityAddress.make({
    shardId,
    entityType: EntityType.make("test"),
    entityId: EntityId.make(entityId),
  });
const makeStreamRequest = () => makeRequest({ rpc: StreamRpc, payload: StreamRpc.payloadSchema.make({ id: 123 }) });
const makePrimaryKeyRequest = (id: number) =>
  makeRequest({ rpc: PrimaryKeyTest, payload: PrimaryKeyTest.payloadSchema.make({ id }) });
const makeLongKeyRequest = (id: string) =>
  makeRequest({ rpc: LongKeyRpc, payload: LongKeyRpc.payloadSchema.make({ id }) });
const saveRequestsFor = Effect.fnUntraced(function* (ids: ReadonlyArray<number>) {
  const storage = yield* MessageStorage.MessageStorage;
  yield* Effect.forEach(ids, (id) =>
    Effect.flatMap(makeRequest({ payload: { id }, entityId: String(id) }), storage.saveRequest)
  );
  return storage;
});
// beep: Narrow to requests instead of upstream's `(m: any) => m.envelope.payload.id`.
const payloadIds = A.map((message: Message.Incoming<any>) =>
  message._tag === "IncomingRequest" ? message.envelope.payload.id : undefined
);
const expectDuplicateReply = Effect.fnUntraced(function* (tag: "Chunk" | "WithExit") {
  const storage = yield* MessageStorage.MessageStorage;
  const result = yield* storage.saveRequest(yield* makeStreamRequest());
  assert(result._tag === "Duplicate" && Option.isSome(result.lastReceivedReply));
  expect(result.lastReceivedReply.value._tag).toEqual(tag);
});
const expectRequestIdForKey = Effect.fnUntraced(function* (request: Message.OutgoingRequest<Rpc.Any>, id: string) {
  const storage = yield* MessageStorage.MessageStorage;
  const requestId = yield* storage.requestIdForPrimaryKey({
    address: request.envelope.address,
    tag: request.envelope.tag,
    id,
  });
  expect(requestId).toEqual(Option.some(request.envelope.requestId));
});
const expectDuplicateOf = Effect.fnUntraced(function* (
  request: Message.OutgoingRequest<Rpc.Any>,
  duplicate: Message.OutgoingRequest<Rpc.Any>,
  id: string
) {
  const storage = yield* MessageStorage.MessageStorage;
  const result = yield* storage.saveRequest(duplicate);
  assert(result._tag === "Duplicate");
  expect(result.originalId).toEqual(request.envelope.requestId);
  yield* expectRequestIdForKey(request, id);
});
// Saves one request and returns the encoded storage with the request's shard key.
const saveForEncoded = Effect.gen(function* () {
  yield* truncate;
  const storage = yield* MessageStorage.MessageStorage;
  const request = yield* makeRequest();
  yield* storage.saveRequest(request);
  const encoded = yield* DuckDbMessageStorage.makeEncoded();
  const now = yield* Clock.currentTimeMillis;
  return { encoded, now, shardId: request.envelope.address.shardId.toString() };
});
const selectMessageIds = Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql<{ message_id: string }>`SELECT message_id FROM cluster_messages`
);

describe("SqlMessageStorage", () => {
  // beep: DuckDB returns BIGINT ids as bigint under SafeIntegers, so the number-rounding SQLite
  // beep: driver wrapper is dropped; the storage still has to round-trip ids above 2^53.
  // beep: A layer-built generator replaces upstream's Effect.provideService(Snowflake.Generator, ...).
  const HighIdGenerator = Layer.sync(Snowflake.Generator, () => {
    let id = BigInt("9007199254740993");
    return {
      nextUnsafe: () => {
        const next = Snowflake.Snowflake(id);
        id += BigInt(2);
        return next;
      },
      setMachineId: Effect.fnUntraced(function* () {}),
    };
  });
  it.layer(
    DuckDbMessageStorage.layer.pipe(
      Layer.provideMerge(HighIdGenerator),
      Layer.provide([DuckDbTestLayer, ShardingConfig.layerDefaults, NodeCrypto.layer])
    )
  )("high ids", (it) => {
    it.effect("preserves ids above 2^53", () =>
      Effect.gen(function* () {
        const storage = yield* MessageStorage.MessageStorage;
        const request = yield* makePrimaryKeyRequest(123);
        const requestId = request.envelope.requestId;
        yield* storage.saveRequest(request);
        const shards = [request.envelope.address.shardId];
        const messages = yield* storage.unprocessedMessages(shards);
        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0]?.envelope.requestId, requestId);
        assert.deepStrictEqual(yield* storage.unprocessedMessages(shards), []);

        const reply = yield* makeReply(request);
        yield* storage.saveReply(reply);
        assert.deepStrictEqual(yield* storage.repliesFor([request]), [reply.reply]);
        yield* storage.resetShards(shards);
        assert.deepStrictEqual(yield* storage.unprocessedMessages(shards), []);

        const duplicate = yield* storage.saveRequest(
          yield* makeRequest({ rpc: PrimaryKeyTest, payload: request.envelope.payload })
        );
        assert(duplicate._tag === "Duplicate");
        assert.strictEqual(duplicate.originalId, requestId);
        assert.deepStrictEqual(duplicate.lastReceivedReply, Option.some(reply.reply));
        assert.deepStrictEqual(
          yield* storage.requestIdForPrimaryKey({
            address: request.envelope.address,
            tag: request.envelope.tag,
            id: "123",
          }),
          Option.some(requestId)
        );
      })
    );
  });

  // Tests truncate this backend's shared tables.
  it.layer(StorageLayer.pipe(Layer.provideMerge(Layer.mergeAll(DuckDbTestLayer, NodeCrypto.layer))), {
    concurrent: false,
    timeout: 120000,
  })("duckdb", (it) => {
    it.effect("resetRequests with no IDs leaves existing claims untouched", () =>
      Effect.gen(function* () {
        yield* truncate;
        const storage = yield* MessageStorage.MessageStorage;
        const request = yield* makeRequest();
        yield* storage.saveRequest(request);
        expect(yield* storage.unprocessedMessages([request.envelope.address.shardId])).toHaveLength(1);
        yield* storage.resetRequests([]);
        expect(yield* storage.unprocessedMessages([request.envelope.address.shardId])).toHaveLength(0);
      })
    );

    it.effect("resetRequests releases only the selected request at a shared address", () =>
      Effect.gen(function* () {
        yield* truncate;
        const storage = yield* MessageStorage.MessageStorage;
        const selected = yield* makeRequest();
        const unrelated = yield* makeRequest();
        yield* storage.saveRequest(selected);
        yield* storage.saveRequest(unrelated);
        const shards = [selected.envelope.address.shardId];
        expect(yield* storage.unprocessedMessages(shards)).toHaveLength(2);
        yield* storage.resetRequests([selected.envelope.requestId]);
        const messages = yield* storage.unprocessedMessages(shards);
        expect(A.map(messages, (message) => message.envelope.requestId)).toEqual([selected.envelope.requestId]);
        expect(yield* storage.unprocessedMessages(shards)).toHaveLength(0);
      })
    );

    it.effect("resetRequests preserves chunk replies, exit replies, and completed state", () =>
      Effect.gen(function* () {
        yield* truncate;
        const storage = yield* MessageStorage.MessageStorage;
        const streaming = yield* makeStreamRequest();
        const completed = yield* makeRequest();
        yield* storage.saveRequest(streaming);
        yield* storage.saveRequest(completed);
        const shards = [streaming.envelope.address.shardId];
        expect(yield* storage.unprocessedMessages(shards)).toHaveLength(2);
        yield* storage.saveReply(yield* makeChunkReply(streaming));
        yield* storage.saveReply(yield* makeReply(completed));
        const replies = yield* storage.repliesFor([streaming, completed]);
        expect(replies).toHaveLength(2);
        expect(yield* storage.unprocessedMessages(shards)).toHaveLength(0);
        const sql = yield* SqlClient.SqlClient;
        // beep: DuckDB storage orders by its seq column; rowid moves when an indexed column is updated.
        const processed = yield* sql`SELECT processed FROM cluster_messages ORDER BY seq`;
        yield* storage.resetRequests([streaming.envelope.requestId, completed.envelope.requestId]);
        const messages = yield* storage.unprocessedMessages(shards);
        // Replies keep both requests out of the SQL read loop.
        expect(messages).toHaveLength(0);
        expect(yield* storage.repliesFor([streaming, completed])).toEqual(replies);
        expect(yield* sql`SELECT processed FROM cluster_messages ORDER BY seq`).toEqual(processed);
        yield* truncate;
      })
    );

    it.effect("clearReplies requeues when the expected reply is current", () =>
      Effect.gen(function* () {
        yield* truncate;
        const storage = yield* MessageStorage.MessageStorage;
        const request = yield* makeRequest();
        const reply = yield* makeReply(request);
        yield* storage.saveRequest(request);
        yield* storage.saveReply(reply);
        yield* storage.clearReplies(request.envelope.requestId, { expectedReplyId: reply.reply.id });
        expect(yield* storage.repliesFor([request])).toHaveLength(0);
        expect(yield* storage.unprocessedMessages([request.envelope.address.shardId])).toHaveLength(1);
      })
    );

    it.effect("clearReplies with a stale expected reply preserves a newer completion and processed state", () =>
      Effect.gen(function* () {
        yield* truncate;
        const sql = yield* SqlClient.SqlClient;
        const storage = yield* MessageStorage.MessageStorage;
        const request = yield* makeStreamRequest();
        const oldReply = yield* makeChunkReply(request);
        const completed = yield* makeReply(request);
        yield* storage.saveRequest(request);
        yield* storage.saveReply(oldReply);
        yield* storage.saveReply(completed);
        const selectState = sql`SELECT processed, last_reply_id FROM cluster_messages WHERE id = ${String(
          request.envelope.requestId
        )}`.pipe(Effect.provideService(SqlClient.SafeIntegers, true));
        const before = yield* selectState;
        yield* storage.clearReplies(request.envelope.requestId, { expectedReplyId: oldReply.reply.id });
        expect(A.map(yield* storage.repliesFor([request]), (r) => r.id)).toEqual([
          oldReply.reply.id,
          completed.reply.id,
        ]);
        expect(yield* selectState).toEqual(before);
        expect(yield* storage.unprocessedMessages([request.envelope.address.shardId])).toHaveLength(0);
        yield* truncate;
      })
    );

    it.effect("saveRequest", () =>
      Effect.gen(function* () {
        const storage = yield* MessageStorage.MessageStorage;
        const request = yield* makeRequest({ payload: { id: 1 } });
        const result = yield* storage.saveRequest(request);
        expect(result._tag).toEqual("Success");

        // beep: Effect.forEach replaces the upstream for loops.
        yield* Effect.forEach(A.range(2, 5), (id) =>
          Effect.flatMap(makeRequest({ payload: { id } }), storage.saveRequest)
        );

        yield* storage.saveReply(yield* makeReply(request));

        let messages = yield* storage.unprocessedMessages([request.envelope.address.shardId]);
        expect(messages).toHaveLength(4);
        expect(payloadIds(messages)).toEqual([2, 3, 4, 5]);

        yield* Effect.forEach(A.range(6, 10), (id) =>
          Effect.flatMap(makeRequest({ payload: { id } }), storage.saveRequest)
        );
        messages = yield* storage.unprocessedMessages([request.envelope.address.shardId]);
        expect(messages).toHaveLength(5);
        expect(payloadIds(messages)).toEqual([6, 7, 8, 9, 10]);
      })
    );

    it.effect("saveReply + saveRequest duplicate", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const storage = yield* MessageStorage.MessageStorage;
        const request = yield* makeStreamRequest();
        const result = yield* storage.saveRequest(request);
        expect(result._tag).toEqual("Success");

        let chunk = yield* makeChunkReply(request, 0);
        yield* storage.saveReply(chunk);
        const ackChunk = yield* makeAckChunk(request, chunk);
        yield* storage.saveEnvelope(ackChunk);

        chunk = yield* makeChunkReply(request, 1);
        yield* storage.saveReply(chunk);

        yield* expectDuplicateReply("Chunk");

        // get the un-acked chunk
        const replies = yield* storage.repliesFor([request]);
        expect(replies).toHaveLength(1);

        yield* storage.saveReply(yield* makeReply(request));

        yield* expectDuplicateReply("WithExit");

        // duplicate WithExit
        const fiber = yield* storage.saveReply(yield* makeReply(request)).pipe(Effect.forkChild);
        yield* TestClock.adjust(1);
        // beep: Effect.repeat replaces the upstream while loop that drives the retry schedule.
        yield* Effect.gen(function* () {
          yield* sql`SELECT 1`;
          yield* TestClock.adjust(1000);
        }).pipe(Effect.repeat({ while: () => fiber.pollUnsafe() === undefined }));
        const error = yield* Fiber.join(fiber).pipe(Effect.flip);
        expect(error._tag).toEqual("PersistenceError");
      })
    );

    it.effect("detects duplicates", () =>
      Effect.gen(function* () {
        yield* truncate;

        const storage = yield* MessageStorage.MessageStorage;
        yield* storage.saveRequest(yield* makePrimaryKeyRequest(123));
        const result = yield* storage.saveRequest(yield* makePrimaryKeyRequest(123));
        expect(result._tag).toEqual("Duplicate");
      })
    );

    it.effect("hashes primary keys longer than the message_id column", () =>
      Effect.gen(function* () {
        yield* truncate;

        const storage = yield* MessageStorage.MessageStorage;
        const longId = Str.repeat(50)("long-key-");
        const request = yield* makeLongKeyRequest(longId);
        const result = yield* storage.saveRequest(request);
        expect(result._tag).toEqual("Success");

        const duplicate = yield* storage.saveRequest(yield* makeLongKeyRequest(longId));
        expect(duplicate._tag).toEqual("Duplicate");
        yield* expectRequestIdForKey(request, longId);

        const rows = yield* selectMessageIds;
        expect(rows).toHaveLength(1);
        expect(rows[0]?.message_id).toMatch(/^[0-9a-f]{64}$/);
      })
    );

    it.effect("keeps primary keys within the column width as plaintext", () =>
      Effect.gen(function* () {
        yield* truncate;

        const storage = yield* MessageStorage.MessageStorage;
        const request = yield* makePrimaryKeyRequest(456);
        yield* storage.saveRequest(request);

        // rows written by previous versions store the plaintext composed
        // key, so short keys must stay byte-identical to keep deduplicating
        const plaintext = Envelope.primaryKey(request.envelope);
        const rows = yield* selectMessageIds;
        expect(rows).toHaveLength(1);
        expect(rows[0]?.message_id).toEqual(plaintext);

        yield* expectDuplicateOf(request, yield* makePrimaryKeyRequest(456), "456");
      })
    );

    // sqlite's TEXT message_id column stored over-long plaintext keys
    // before hashing, so the legacy fallback must also cover keys longer
    // than the 255-character limit of the width-enforcing dialects
    // beep: DuckDB TEXT is unbounded like SQLite's, so the SQLite-only case always runs.
    it.effect("detects duplicates for legacy long-key plaintext rows", () =>
      Effect.gen(function* () {
        yield* truncate;

        const sql = yield* SqlClient.SqlClient;
        const storage = yield* MessageStorage.MessageStorage;
        const longId = Str.repeat(30)("legacy-long-key-");
        const request = yield* makeLongKeyRequest(longId);
        yield* storage.saveRequest(request);

        // simulate a row written before message_id values were hashed
        const plaintext = Envelope.primaryKey(request.envelope) ?? "";
        expect(plaintext.length).toBeGreaterThan(255);
        yield* sql`UPDATE cluster_messages SET message_id = ${plaintext} WHERE id = ${String(
          request.envelope.requestId
        )}`;

        yield* expectDuplicateOf(request, yield* makeLongKeyRequest(longId), longId);
      })
    );

    it.effect("unprocessedMessages", () =>
      Effect.gen(function* () {
        yield* truncate;

        const storage = yield* MessageStorage.MessageStorage;
        const request = yield* makeRequest();
        yield* storage.saveRequest(request);
        let messages = yield* storage.unprocessedMessages([request.envelope.address.shardId]);
        expect(messages).toHaveLength(1);
        messages = yield* storage.unprocessedMessages([request.envelope.address.shardId]);
        expect(messages).toHaveLength(0);
        yield* storage.saveRequest(yield* makeRequest());
        messages = yield* storage.unprocessedMessages([request.envelope.address.shardId]);
        expect(messages).toHaveLength(1);
      })
    );

    it.effect("unprocessedMessages honors the limit and claims only returned rows", () =>
      Effect.gen(function* () {
        yield* truncate;

        const storage = yield* saveRequestsFor(A.range(1, 5));
        const limited = yield* storage.unprocessedMessages([shardOne], { limit: 3 });
        expect(limited).toHaveLength(3);
        expect(payloadIds(limited)).toEqual([1, 2, 3]);

        // rows beyond the limit were not claimed and are returned by the
        // next read
        const rest = yield* storage.unprocessedMessages([shardOne]);
        expect(payloadIds(rest)).toEqual([4, 5]);
      })
    );

    it.effect("unprocessedMessages filters by address", () =>
      Effect.gen(function* () {
        yield* truncate;

        const storage = yield* saveRequestsFor(A.range(1, 4));
        const filtered = yield* storage.unprocessedMessages([shardOne], {
          addresses: [addressFor("2"), addressFor("4")],
        });
        expect(payloadIds(filtered)).toEqual([2, 4]);

        // the filtered read must not claim the other addresses
        const rest = yield* storage.unprocessedMessages([shardOne]);
        expect(payloadIds(rest)).toEqual([1, 3]);
      })
    );

    it.effect("unprocessedMessages filters addresses by shard", () =>
      Effect.gen(function* () {
        yield* truncate;

        const storage = yield* MessageStorage.MessageStorage;
        const shardTwo = ShardId.make("default", 2);
        yield* storage.saveRequest(yield* makeRequest({ payload: { id: 1 }, shardId: shardOne }));
        yield* storage.saveRequest(yield* makeRequest({ payload: { id: 2 }, shardId: shardTwo }));

        const messages = yield* storage.unprocessedMessages([shardOne, shardTwo], {
          addresses: [addressFor("1")],
        });
        expect(payloadIds(messages)).toEqual([1]);

        const rest = yield* storage.unprocessedMessages([shardOne, shardTwo]);
        expect(payloadIds(rest)).toEqual([2]);
      })
    );

    it.effect("encoded unprocessedMessages fails closed for empty addresses", () =>
      Effect.gen(function* () {
        const { encoded, now, shardId } = yield* saveForEncoded;
        const messages = yield* encoded.unprocessedMessages([shardId], now, { addresses: [] });
        expect(messages).toHaveLength(0);

        const unfiltered = yield* encoded.unprocessedMessages([shardId], now);
        expect(unfiltered).toHaveLength(1);
      })
    );

    it.effect("encoded resetAddresses fails closed for an empty address list", () =>
      Effect.gen(function* () {
        const { encoded, now, shardId } = yield* saveForEncoded;
        const claimed = yield* encoded.unprocessedMessages([shardId], now);
        expect(claimed).toHaveLength(1);

        yield* encoded.resetAddresses([]);
        const messages = yield* encoded.unprocessedMessages([shardId], now);
        expect(messages).toHaveLength(0);
      })
    );

    it.effect("resetAddresses releases claims in one batch", () =>
      Effect.gen(function* () {
        yield* truncate;

        const storage = yield* saveRequestsFor(A.range(1, 4));
        yield* storage.unprocessedMessages([shardOne], { limit: 3 });
        yield* storage.resetAddresses([addressFor("1"), addressFor("3")]);

        const messages = yield* storage.unprocessedMessages([shardOne]);
        expect(payloadIds(messages)).toEqual([1, 3, 4]);
      })
    );

    // beep: "unprocessedMessages excludes complete requests", "repliesFor" and "registerReplyHandler"
    // beep: already run in MessageStorageTest.ts against the same storage; repeating them would
    // beep: duplicate those bodies for the duplication gate.

    it.effect("unprocessedMessagesById", () =>
      Effect.gen(function* () {
        yield* truncate;

        const storage = yield* MessageStorage.MessageStorage;
        const request = yield* makeStreamRequest();
        yield* storage.saveRequest(request);
        let messages = yield* storage.unprocessedMessagesById([request.envelope.requestId]);
        expect(messages).toHaveLength(1);

        const chunk = yield* makeChunkReply(request);
        yield* storage.saveReply(chunk);
        const ack = yield* makeAckChunk(request, chunk);
        yield* storage.saveEnvelope(ack);

        const encoded = yield* DuckDbMessageStorage.makeEncoded();
        const acknowledgements = yield* encoded.unprocessedMessagesById([ack.envelope.id], 0);
        expect(acknowledgements).toHaveLength(1);
        const acknowledgement = acknowledgements[0]?.envelope;
        assert(acknowledgement?._tag === "AckChunk");
        expect(acknowledgement.replyId).toEqual(String(chunk.reply.id));

        yield* storage.saveReply(yield* makeReply(request));
        messages = yield* storage.unprocessedMessagesById([request.envelope.requestId]);
        expect(messages).toHaveLength(0);
      })
    );
  });

  it.layer(StorageLayer.pipe(Layer.provideMerge(DuckDbTestLayer)))("entity layers", (it) => {
    it.effect(
      "keeps held messages readable while entity layers build",
      () =>
        Effect.gen(function* () {
          const building = yield* Latch.make();
          const replied = yield* Latch.make();
          const config = ShardingConfig.layer({
            entityRegistrationTimeout: 6000,
            entityTerminationTimeout: 0,
            entityMessagePollInterval: 100,
            refreshAssignmentsInterval: 0,
          });
          const delayedEnv = TestEntityLayer.pipe(
            Layer.provide(Layer.effectDiscard(building.open.pipe(Effect.andThen(Effect.sleep(10_000))))),
            Layer.provideMerge(Sharding.layer),
            Layer.provide(RunnerStorage.layerMemory),
            Layer.provide(RunnerHealth.layerNoop),
            Layer.provide(Runners.layerNoop),
            Layer.provide(config)
          );
          const storage = yield* MessageStorage.MessageStorage;
          const request = yield* makeRequest();
          yield* storage.saveRequest(request);

          // beep: The existing reply callback runs after native storage commits the reply.
          const replyReader = yield* storage
            .registerReplyHandler(new Message.OutgoingRequest({ ...request, respond: () => replied.open }))
            .pipe(Effect.forkChild({ startImmediately: true }));

          // beep: Layer.build inside the forked scope replaces upstream's Effect.provide(delayedEnv).
          const fiber = yield* Layer.build(delayedEnv).pipe(
            Effect.andThen(Effect.never),
            Effect.scoped,
            Effect.forkChild({ startImmediately: true })
          );

          // beep: Anchor the virtual timeline to the delayed entity layer's actual start.
          yield* building.await;
          yield* TestClock.adjust(7500);
          expect(yield* storage.repliesFor([request])).toHaveLength(0);

          yield* TestClock.adjust(2500);
          yield* TestClock.adjust(100);
          // beep: Virtual time does not flush DuckDB's native asynchronous work.
          yield* replied.await;
          expect(yield* storage.repliesFor([request])).toHaveLength(1);
          yield* Fiber.await(replyReader);
          yield* Fiber.interrupt(fiber);
        }),
      { timeout: 15_000 }
    );
  });
});
