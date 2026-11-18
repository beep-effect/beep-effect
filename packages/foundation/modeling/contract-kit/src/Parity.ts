/**
 * Wire shapes of RPC groups, for the parity test between a context's contract
 * Api and its model Api.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ContractKitId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as RpcSchema from "effect/rpc/RpcSchema";
import * as S from "effect/Schema";
import type * as Rpc from "effect/rpc/Rpc";
import type * as RpcGroup from "effect/rpc/RpcGroup";

const $I = $ContractKitId.create("Parity");

/**
 * One RPC as its wire sees it: the JSON Schema documents of the encoded
 * payload, success and error, whether it streams, and the middleware keys it
 * runs. Two shapes are the same wire when they are deeply equal.
 *
 * **Example** (Make an RPC shape)
 *
 * ```ts
 * import { RpcShape } from "@beep/contract-kit/Parity"
 *
 * const shape = RpcShape.make({ tag: "Ping", stream: false, payload: {}, success: {}, error: {}, middleware: [] })
 * console.log(shape.tag) // "Ping"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RpcShape extends S.Opaque<RpcShape, { readonly brand: unique symbol }>()(
  S.Struct({
    tag: S.String,
    stream: S.Boolean,
    payload: S.Unknown,
    success: S.Unknown,
    error: S.Unknown,
    middleware: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("RpcShape", {
      description: "The wire shape of one RPC: encoded payload, success and error documents, streaming and middleware.",
    })
  )
) {}

const json = (schema: S.Constraint): unknown => S.toJsonSchemaDocument(schema);

/**
 * The wire shape of one RPC.
 *
 * **Example** (Shape every RPC of a group)
 *
 * ```ts
 * import { shapeOf } from "@beep/contract-kit/Parity"
 * import * as Rpc from "effect/rpc/Rpc"
 * import * as S from "effect/Schema"
 *
 * const Ping = Rpc.make("Ping", { payload: { target: S.String } })
 * console.log(shapeOf(Ping).tag) // "Ping"
 * ```
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
      A.sort(Order.String)
    ),
  });
};

/**
 * Every RPC of a group, in tag order. A contract Api over a catalog is in
 * parity with its model Api when their group shapes are deeply equal.
 *
 * **Example** (Shape a one-RPC group)
 *
 * ```ts
 * import { groupShape } from "@beep/contract-kit/Parity"
 * import * as Rpc from "effect/rpc/Rpc"
 * import * as RpcGroup from "effect/rpc/RpcGroup"
 * import * as S from "effect/Schema"
 *
 * const group = RpcGroup.make(Rpc.make("Ping", { payload: { target: S.String } }))
 * console.log(groupShape(group).length) // 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const groupShape = <R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>): ReadonlyArray<RpcShape> =>
  pipe(
    A.fromIterable(group.requests.values()),
    A.map((rpc) => shapeOf(rpc as unknown as Rpc.AnyWithProps)),
    A.sort(Order.mapInput(Order.String, (shape: RpcShape) => shape.tag))
  );
