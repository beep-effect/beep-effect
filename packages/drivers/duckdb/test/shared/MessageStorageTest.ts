/**
 * Vendored from Effect, tag effect@4.0.6, packages/platform/node/test/cluster/MessageStorageTest.ts.
 * MIT License, Copyright (c) Effectful Technologies Inc. Adaptations carry // beep: markers.
 */
// beep: it.layer preserves per-test isolation without library-level Effect.provide.
// beep: Finite schemas and checked array indexing satisfy repository diagnostics.
import { DuckDbTestLayer } from "@beep/duckdb";
import * as DuckDbMessageStorage from "@beep/duckdb/DuckDbMessageStorage";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
// beep: Use the repository Effect test runner.
import { describe, expect } from "@effect/vitest";
// beep: Effect public leaf imports replace upstream barrels.
import * as Context from "effect/Context";
// beep: Effect public leaf imports replace upstream barrels.
import * as EntityAddress from "effect/cluster/EntityAddress";
import * as EntityId from "effect/cluster/EntityId";
import * as EntityType from "effect/cluster/EntityType";
import * as Envelope from "effect/cluster/Envelope";
import * as Message from "effect/cluster/Message";
import * as MessageStorage from "effect/cluster/MessageStorage";
import * as Reply from "effect/cluster/Reply";
import * as ShardId from "effect/cluster/ShardId";
import * as ShardingConfig from "effect/cluster/ShardingConfig";
import * as Snowflake from "effect/cluster/Snowflake";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
// beep: Effect public leaf imports replace upstream barrels.
import * as Headers from "effect/http/Headers";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
// beep: Effect public leaf imports replace upstream barrels.
import * as Rpc from "effect/rpc/Rpc";
import * as Schema from "effect/Schema";
// beep: Effect public leaf imports replace upstream barrels.
import * as TestClock from "effect/testing/TestClock";

// beep: Run the upstream memory contract against DuckDB storage, one isolated database per test.
const MemoryLayer = DuckDbMessageStorage.layer.pipe(
  Layer.provideMerge(DuckDbTestLayer),
  Layer.provideMerge(Snowflake.layerGenerator),
  Layer.provide(ShardingConfig.layerDefaults),
  Layer.provide(NodeCrypto.layer)
);

describe("MessageStorage", () => {
  describe("memory", () => {
    it.layer(MemoryLayer)((it) => {
      it.effect("saves a request", () =>
        Effect.gen(function* () {
          const storage = yield* MessageStorage.MessageStorage;
          const request = yield* makeRequest();
          const result = yield* storage.saveRequest(request);
          expect(result._tag).toEqual("Success");
          const messages = yield* storage.unprocessedMessages([request.envelope.address.shardId]);
          expect(messages).toHaveLength(1);
        })
      );
    });

    it.layer(MemoryLayer)((it) => {
      it.effect("detects duplicates", () =>
        Effect.gen(function* () {
          const storage = yield* MessageStorage.MessageStorage;
          yield* storage.saveRequest(
            yield* makeRequest({
              rpc: PrimaryKeyTest,
              payload: PrimaryKeyTest.payloadSchema.make({ id: 123 }),
            })
          );
          const result = yield* storage.saveRequest(
            yield* makeRequest({
              rpc: PrimaryKeyTest,
              payload: PrimaryKeyTest.payloadSchema.make({ id: 123 }),
            })
          );
          expect(result._tag).toEqual("Duplicate");
        })
      );
    });

    it.layer(MemoryLayer)((it) => {
      it.effect("unprocessedMessages excludes complete requests", () =>
        Effect.gen(function* () {
          const storage = yield* MessageStorage.MessageStorage;
          const request = yield* makeRequest();
          yield* storage.saveRequest(request);
          yield* storage.saveReply(yield* makeReply(request));
          const messages = yield* storage.unprocessedMessages([request.envelope.address.shardId]);
          expect(messages).toHaveLength(0);
        })
      );
    });

    it.layer(MemoryLayer)((it) => {
      it.effect("repliesFor", () =>
        Effect.gen(function* () {
          const storage = yield* MessageStorage.MessageStorage;
          const request = yield* makeRequest();
          yield* storage.saveRequest(request);
          let replies = yield* storage.repliesFor([request]);
          expect(replies).toHaveLength(0);
          yield* storage.saveReply(yield* makeReply(request));
          replies = yield* storage.repliesFor([request]);
          expect(replies).toHaveLength(1);
          expect(replies[0]?.requestId).toEqual(request.envelope.requestId);
        })
      );
    });

    it.layer(MemoryLayer)((it) => {
      it.effect("registerReplyHandler", () =>
        Effect.gen(function* () {
          const storage = yield* MessageStorage.MessageStorage;
          const latch = yield* Latch.make();
          const request = yield* makeRequest();
          yield* storage.saveRequest(request);
          const fiber = yield* storage
            .registerReplyHandler(
              new Message.OutgoingRequest({
                ...request,
                respond: () => latch.open,
              })
            )
            .pipe(Effect.forkChild);
          yield* TestClock.adjust(1);
          yield* storage.saveReply(yield* makeReply(request));
          yield* latch.await;
          yield* Fiber.await(fiber);
        })
      );
    });
  });
});

// beep: Helpers are module-private (no other suite imports them, dead-code gate); upstream
// beep: LongKeyRpc, StreamRpc, makeAckChunk, makeChunkReply and makeEmptyReply are dropped as unused.
const GetUserRpc = Rpc.make("GetUser", {
  payload: { id: Schema.Finite },
});

const makeRequest = Effect.fnUntraced(function* (options?: {
  readonly rpc?: Rpc.AnyWithProps;
  readonly payload?: any;
  readonly entityId?: string;
  readonly shardId?: ShardId.ShardId;
}) {
  const snowflake = yield* Snowflake.Generator;
  const rpc = options?.rpc ?? GetUserRpc;
  return new Message.OutgoingRequest({
    envelope: Envelope.makeRequest<any>({
      requestId: snowflake.nextUnsafe(),
      address: EntityAddress.make({
        shardId: options?.shardId ?? ShardId.make("default", 1),
        entityType: EntityType.make("test"),
        entityId: EntityId.make(options?.entityId ?? "1"),
      }),
      tag: rpc._tag,
      payload: options?.payload ?? { id: 123 },
      traceId: "noop",
      spanId: "noop",
      sampled: false,
      headers: Headers.empty,
    }),
    annotations: rpc.annotations,
    context: Context.empty() as any,
    rpc,
    lastReceivedReply: Option.none(),
    respond() {
      return Effect.void;
    },
  });
});

class PrimaryKeyTest extends Rpc.make("PrimaryKeyTest", {
  payload: {
    id: Schema.Finite,
  },
  primaryKey: (value) => value.id.toString(),
}) {}

const makeReply = Effect.fnUntraced(function* (request: Message.OutgoingRequest<any>) {
  const snowflake = yield* Snowflake.Generator;
  return new Reply.ReplyWithContext({
    reply: new Reply.WithExit({
      id: snowflake.nextUnsafe(),
      requestId: request.envelope.requestId,
      exit: Exit.void as any,
    }),
    context: request.context,
    rpc: request.rpc,
  });
});
