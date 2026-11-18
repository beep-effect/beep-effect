/**
 * Wire shapes of RPC groups, for the parity test between a context's contract
 * Api and its model Api.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ContractKitId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { flow, pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcSchema from "effect/rpc/RpcSchema";
import * as S from "effect/Schema";
import type * as RpcGroup from "effect/rpc/RpcGroup";

const $I = $ContractKitId.create("Parity");

/**
 * One RPC as its wire sees it: the schema representations of its payload,
 * its reply codec and its streamed element, whether it streams, and the
 * middleware keys it runs. Two shapes are the same wire when they are deeply equal.
 *
 * **Example** (Make an RPC shape)
 *
 * ```ts
 * import { RpcShape } from "@beep/contract-kit/Parity"
 *
 * const shape = RpcShape.make({ tag: "Ping", stream: false, payload: {}, exit: {}, chunk: null, middleware: [] })
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
    exit: S.Unknown,
    chunk: S.Unknown,
    middleware: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("RpcShape", {
      description:
        "The wire shape of one RPC: payload, reply-exit and streamed-element representations, streaming and middleware.",
    })
  )
) {}

// The schema representation keeps every node and check, including filters
// JSON Schema cannot export; only function-valued annotations (code
// generators, arbitraries) are dropped, since two equal schemas built in two
// places never share those closures.
const structureOf = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, structureOf);
  if (P.isObject(value)) {
    return R.map(
      R.filter(value as R.ReadonlyRecord<string, unknown>, (entry) => !P.isFunction(entry)),
      structureOf
    );
  }
  return value;
};

const representationOf: (schema: S.Top) => unknown = flow(S.toRepresentation, structureOf);

/**
 * The wire shape of one RPC.
 *
 * **Details**
 *
 * `payload` and `exit` are schema representations: every node and check of
 * the payload and of `Rpc.exitSchema(rpc)`, the codec a reply is encoded and
 * decoded with, which unions the RPC's errors with every middleware's error.
 * `chunk` is the streamed element's representation for a streaming RPC.
 *
 * **Gotchas**
 *
 * A filter with no representation (an unannotated `Schema.makeFilter`) is
 * compared by its position and its non-function annotations, not by its
 * predicate: give each such filter an identifier annotation, or share the
 * schema between the contract and the model, so two different predicates
 * cannot compare equal.
 *
 * **Example** (Shape one RPC)
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
export const shapeOf = <R extends Rpc.Any>(self: R): RpcShape => {
  const rpc = self as unknown as Rpc.AnyWithProps;
  const success = rpc.successSchema;
  return RpcShape.make({
    tag: rpc._tag,
    stream: RpcSchema.isStreamSchema(success),
    payload: representationOf(rpc.payloadSchema),
    exit: rpc.pipe(Rpc.exitSchema, representationOf),
    chunk: RpcSchema.isStreamSchema(success) ? representationOf(success.success) : null,
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
    A.map(shapeOf),
    A.sort(Order.mapInput(Order.String, (shape: RpcShape) => shape.tag))
  );
