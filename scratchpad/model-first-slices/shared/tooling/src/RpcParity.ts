import * as A from "@beep/utils/Array";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import type * as Rpc from "effect/rpc/Rpc";
import type * as RpcGroup from "effect/rpc/RpcGroup";
import * as RpcSchema from "effect/rpc/RpcSchema";
import * as S from "effect/Schema";

/**
 * One RPC as its wire sees it: the JSON Schema documents of the encoded
 * payload, success and error, whether it streams, and the middleware keys it
 * runs. Two shapes are the same wire when they are deeply equal.
 *
 * @category models
 * @since 0.0.0
 */
export const RpcShape = S.Struct({
  tag: S.String,
  stream: S.Boolean,
  payload: S.Unknown,
  success: S.Unknown,
  error: S.Unknown,
  middleware: S.Array(S.String),
});
/**
 * @category models
 * @since 0.0.0
 */
export type RpcShape = typeof RpcShape.Type;

const json = (schema: S.Constraint): unknown => S.toJsonSchemaDocument(schema);

/**
 * The wire shape of one RPC.
 *
 * @category getters
 * @since 0.0.0
 */
export const shapeOf = (rpc: Rpc.AnyWithProps): RpcShape => {
  const success = rpc.successSchema;
  const streamed = RpcSchema.isStreamSchema(success);
  return RpcShape.make({
    tag: rpc._tag,
    stream: streamed,
    payload: json(rpc.payloadSchema),
    success: json(streamed ? success.success : success),
    error: json(streamed ? S.Union([success.error, rpc.errorSchema]) : rpc.errorSchema),
    middleware: pipe(
      A.fromIterable(rpc.middlewares),
      A.map((middleware) => middleware.key),
      A.sort(Order.String),
    ),
  });
};

/**
 * Every RPC of a group, by tag order.
 *
 * @category getters
 * @since 0.0.0
 */
export const groupShape = (group: RpcGroup.RpcGroup<Rpc.Any>): ReadonlyArray<RpcShape> =>
  pipe(
    A.fromIterable(group.requests.values()),
    A.map((rpc) => shapeOf(rpc as Rpc.AnyWithProps)),
    A.sort(Order.mapInput(Order.String, (shape: RpcShape) => shape.tag)),
  );
