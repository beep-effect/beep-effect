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
import { describe, expect, expectTypeOf } from "@effect/vitest";
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
import * as RpcSchema from "effect/rpc/RpcSchema";
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
  // beep: Pin valid fixture RPCs and rejected payload/chunk combinations in the package typecheck.
  it.effect("fixture request type contracts", () =>
    Effect.sync(() => {
      expectTypeOf(makeRequest({ rpc: LongKeyRpc, payload: { id: "key" } })).toExtend<
        Effect.Effect<Message.OutgoingRequest<typeof LongKeyRpc>, never, Snowflake.Generator>
      >();
      expectTypeOf(makeRequest({ rpc: PrimaryKeyTest, payload: { id: 123 } })).toExtend<
        Effect.Effect<Message.OutgoingRequest<typeof PrimaryKeyTest>, never, Snowflake.Generator>
      >();
      expectTypeOf(Effect.flatMap(makeRequest({ rpc: StreamRpc, payload: { id: 123 } }), makeChunkReply)).toExtend<
        Effect.Effect<Reply.ReplyWithContext<typeof StreamRpc>, never, Snowflake.Generator>
      >();
      // @ts-expect-error -- LongKeyRpc requires a string id. Owner: @beep/duckdb. Exit: change only with its payload schema.
      const invalidLong = makeRequest({ rpc: LongKeyRpc, payload: { id: 123 } });
      // @ts-expect-error -- LongKeyRpc cannot use the default numeric payload. Owner: @beep/duckdb. Exit: change only with its payload schema.
      const missingLongPayload = makeRequest({ rpc: LongKeyRpc });
      // @ts-expect-error -- GetUser requires a numeric id. Owner: @beep/duckdb. Exit: change only with its payload schema.
      const invalidDefault = makeRequest({ payload: { id: "key" } });
      // @ts-expect-error -- Non-stream requests cannot construct chunks. Owner: @beep/duckdb. Exit: change only with its success schema.
      const invalidChunk = Effect.flatMap(makeRequest(), makeChunkReply);
      // @ts-expect-error -- StreamRpc requires a numeric id. Owner: @beep/duckdb. Exit: change only with its payload schema.
      const invalidStream = makeRequest({ rpc: StreamRpc, payload: { id: "key" } });
      expectTypeOf(invalidLong).toBeObject();
      expectTypeOf(missingLongPayload).toBeObject();
      expectTypeOf(invalidDefault).toBeObject();
      expectTypeOf(invalidChunk).toBeObject();
      expectTypeOf(invalidStream).toBeObject();
    })
  );
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

// beep: Only helpers another vendored suite imports are exported (dead-code gate); upstream
// beep: makeEmptyReply is dropped because only the upstream memory-storage suite uses it.
export const GetUserRpc = Rpc.make("GetUser", {
  payload: { id: Schema.Finite },
});

// beep: Derive payload, context and reply types from the four schema-backed fixture RPCs.
type FixtureRpc = typeof GetUserRpc | typeof PrimaryKeyTest | typeof LongKeyRpc | typeof StreamRpc;

// beep: The fixture constructor accepts all fixture replies and retains the selected RPC schema.
type FixtureOutgoingRequest<R extends FixtureRpc> = Message.OutgoingRequest<R> & Message.OutgoingRequest<FixtureRpc>;

type FixtureRequestLocation = {
  readonly entityId?: string;
  readonly shardId?: ShardId.ShardId;
};
type FixtureRequestOptions<R extends FixtureRpc = FixtureRpc> = R extends typeof GetUserRpc
  ? FixtureRequestLocation & { readonly rpc?: R; readonly payload?: Rpc.Payload<R> }
  : FixtureRequestLocation & { readonly rpc: R; readonly payload: Rpc.Payload<R> };
type FixtureRequest = Pick<Message.OutgoingRequest<FixtureRpc>, "context" | "rpc"> & {
  readonly envelope: Pick<Envelope.Request<FixtureRpc>, "requestId" | "address">;
};

/**
 * Construct a storage request with the selected fixture RPC's payload type.
 *
 * **Example** (Create a streaming fixture request)
 *
 * ```ts
 * const request = makeRequest({ rpc: StreamRpc, payload: { id: 123 } });
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export function makeRequest(
  options?: FixtureRequestOptions<typeof GetUserRpc>
): Effect.Effect<FixtureOutgoingRequest<typeof GetUserRpc>, never, Snowflake.Generator>;
export function makeRequest<Options extends FixtureRequestOptions & { readonly rpc: FixtureRpc }>(
  options: Options
): Effect.Effect<FixtureOutgoingRequest<Options["rpc"]>, never, Snowflake.Generator>;
export function makeRequest(options?: FixtureRequestOptions): Effect.Effect<unknown, never, Snowflake.Generator> {
  return makeRequestEffect(options);
}

const makeRequestEffect = Effect.fnUntraced(function* (options?: FixtureRequestOptions) {
  const snowflake = yield* Snowflake.Generator;
  const rpc = options?.rpc ?? GetUserRpc;
  return new Message.OutgoingRequest<FixtureRpc>({
    envelope: Envelope.makeRequest<FixtureRpc>({
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
    context: Context.empty(),
    rpc,
    lastReceivedReply: Option.none(),
    respond() {
      return Effect.void;
    },
  });
});

export class PrimaryKeyTest extends Rpc.make("PrimaryKeyTest", {
  payload: {
    id: Schema.Finite,
  },
  primaryKey: (value) => value.id.toString(),
}) {}

export class LongKeyRpc extends Rpc.make("LongKeyRpc", {
  payload: {
    id: Schema.String,
  },
  primaryKey: (value) => value.id,
}) {}

export class StreamRpc extends Rpc.make("StreamTest", {
  success: RpcSchema.Stream(Schema.Void, Schema.Never),
  payload: {
    id: Schema.Finite,
  },
  primaryKey: (value) => value.id.toString(),
}) {}

export const makeReply = Effect.fnUntraced(function* (request: FixtureRequest) {
  const snowflake = yield* Snowflake.Generator;
  return new Reply.ReplyWithContext<FixtureRpc>({
    reply: new Reply.WithExit<FixtureRpc>({
      id: snowflake.nextUnsafe(),
      requestId: request.envelope.requestId,
      exit: Exit.void,
    }),
    context: request.context,
    rpc: request.rpc,
  });
});

export const makeAckChunk = Effect.fnUntraced(function* (
  request: FixtureRequest,
  chunk: { readonly reply: Pick<Reply.Reply<FixtureRpc>, "requestId" | "id"> }
) {
  const snowflake = yield* Snowflake.Generator;
  return new Message.OutgoingEnvelope({
    // beep: Schema class `make` replaces `new` (tsgo newSchemaClass).
    envelope: Envelope.AckChunk.make({
      id: snowflake.nextUnsafe(),
      address: request.envelope.address,
      requestId: chunk.reply.requestId,
      replyId: chunk.reply.id,
    }),
    rpc: request.rpc,
  });
});

export const makeChunkReply = Effect.fnUntraced(function* (
  request: FixtureRequest & { readonly rpc: typeof StreamRpc },
  sequence = 0
) {
  const snowflake = yield* Snowflake.Generator;
  return new Reply.ReplyWithContext<typeof StreamRpc>({
    reply: new Reply.Chunk<typeof StreamRpc>({
      id: snowflake.nextUnsafe(),
      requestId: request.envelope.requestId,
      sequence,
      values: [undefined],
    }),
    context: request.context,
    rpc: request.rpc,
  });
});
