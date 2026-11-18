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
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcSchema from "effect/rpc/RpcSchema";
import * as S from "effect/Schema";
import type * as RpcGroup from "effect/rpc/RpcGroup";
import type * as SchemaAST from "effect/SchemaAST";

const $I = $ContractKitId.create("Parity");

/**
 * One schema as parity compares it: the representation of its encoded side,
 * the representation of its decoded side, and the identity of every
 * transformation in it, in traversal order.
 *
 * **Details**
 *
 * A representation describes the nodes and checks on either side but not what
 * a transformation does between them, so two schemas are only the same codec
 * when they also share each transformation by reference: built from the same
 * schemas, as a model built from its contract's declarations is.
 *
 * **Example** (Shape a string schema)
 *
 * ```ts
 * import { schemaShapeOf } from "@beep/contract-kit/Parity"
 * import * as S from "effect/Schema"
 *
 * console.log(schemaShapeOf(S.String).codecs.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaShape extends S.Opaque<SchemaShape, { readonly brand: unique symbol }>()(
  S.Struct({
    encoded: S.Unknown,
    decoded: S.Unknown,
    codecs: S.Array(S.Int),
  }).pipe(
    $I.annoteSchema("SchemaShape", {
      description: "A schema's encoded and decoded representations and the identities of its transformations.",
    })
  )
) {}

/**
 * One RPC as its wire sees it: the schema representations of its payload,
 * its reply codec and its streamed element, whether it streams, and the
 * middleware keys it runs. Two shapes are the same wire when they are deeply equal.
 *
 * **Example** (Make an RPC shape)
 *
 * ```ts
 * import { RpcShape, schemaShapeOf } from "@beep/contract-kit/Parity"
 * import * as S from "effect/Schema"
 *
 * const shape = RpcShape.make({
 *   tag: "Ping",
 *   stream: false,
 *   payload: schemaShapeOf(S.Void),
 *   exit: schemaShapeOf(S.Void),
 *   chunk: null,
 *   middleware: [],
 * })
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
    payload: SchemaShape,
    exit: SchemaShape,
    chunk: S.NullOr(SchemaShape),
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

// Each transformation object gets one number for the life of the process, so
// two schemas share a codec exactly when they share its transformation.
const codecIdentities = MutableHashMap.empty<object, number>();

const codecIdentity = (transformation: object): number =>
  O.getOrElse(MutableHashMap.get(codecIdentities, transformation), () => {
    const identity = MutableHashMap.size(codecIdentities);
    MutableHashMap.set(codecIdentities, transformation, identity);
    return identity;
  });

const transformationsOf = (node: { readonly [key: PropertyKey]: unknown }): ReadonlyArray<object> => {
  const encoding = node.encoding;
  // Only an AST node carries an `encoding`: its links, each with a transformation.
  return A.isArray(encoding) ? A.map(encoding as ReadonlyArray<SchemaAST.Link>, (link) => link.transformation) : [];
};

interface Walk {
  readonly codecs: ReadonlyArray<number>;
  readonly visited: ReadonlyArray<unknown>;
}

// Depth-first over the AST object graph, each object once (suspended schemas
// are thunks, which the walk does not call).
const walk = (state: Walk, value: unknown): Walk => {
  if (!P.isObjectOrArray(value) || A.some(state.visited, (seen) => seen === value)) return state;
  const entered: Walk = { ...state, visited: A.append(state.visited, value) };
  if (A.isArray(value)) return A.reduce(value, entered, walk);
  const withCodecs: Walk = {
    ...entered,
    codecs: A.appendAll(entered.codecs, A.map(transformationsOf(value), codecIdentity)),
  };
  return A.reduce(R.values(value), withCodecs, walk);
};

const codecsOf = (schema: S.Top): ReadonlyArray<number> => walk({ visited: [], codecs: [] }, schema.ast).codecs;

/**
 * The parity shape of one schema: its encoded and decoded representations and
 * its transformation identities.
 *
 * **Example** (Two finite-number decoders differ from a plain number decoder)
 *
 * ```ts
 * import { schemaShapeOf } from "@beep/contract-kit/Parity"
 * import * as S from "effect/Schema"
 *
 * console.log(schemaShapeOf(S.Finite).decoded === schemaShapeOf(S.Number).decoded) // false
 * ```
 *
 * @param schema - The schema to shape.
 * @returns Its parity shape.
 * @category getters
 * @since 0.0.0
 */
export const schemaShapeOf = (schema: S.Top): SchemaShape =>
  SchemaShape.make({
    encoded: representationOf(schema),
    decoded: schema.pipe(S.toType, representationOf),
    codecs: codecsOf(schema),
  });

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
    payload: schemaShapeOf(rpc.payloadSchema),
    exit: rpc.pipe(Rpc.exitSchema, schemaShapeOf),
    chunk: RpcSchema.isStreamSchema(success) ? schemaShapeOf(success.success) : null,
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
