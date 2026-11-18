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
import * as Match from "effect/Match";
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

// Each opaque object (a transformation, an undescribed filter or declaration, a
// unique symbol) gets one number for the life of the process, so two
// signatures hold the same number exactly when they hold the same object.
const identities = MutableHashMap.empty<object | symbol, number>();

const identityOf = (value: object | symbol): number =>
  O.getOrElse(MutableHashMap.get(identities, value), () => {
    const identity = MutableHashMap.size(identities);
    MutableHashMap.set(identities, value, identity);
    return identity;
  });

// Plain data inside a `representation` annotation, with functions dropped (an
// array becomes an index-keyed record, which compares the same way).
const dataOf = (value: unknown): unknown => {
  if (P.isObject(value)) {
    return R.map(
      R.filter(value as R.ReadonlyRecord<string, unknown>, (entry) => !P.isFunction(entry)),
      dataOf
    );
  }
  return value;
};

// A node or check a schema representation can describe carries a
// `representation` annotation; anything else is compared by reference.
const describedBy = (annotations: SchemaAST.AST["annotations"]): O.Option<unknown> =>
  pipe(
    O.fromNullishOr(annotations),
    O.flatMap((value) => O.fromNullishOr(value.representation)),
    O.map(dataOf)
  );

const checkSignature = (check: SchemaAST.Check<unknown>): unknown =>
  check._tag === "FilterGroup"
    ? { _tag: "FilterGroup", checks: A.map(check.checks, checkSignature) }
    : O.match(describedBy(check.annotations), {
        onNone: () => ({ _tag: "Filter", aborted: check.aborted, identity: identityOf(check) }),
        onSome: (representation) => ({ _tag: "Filter", aborted: check.aborted, representation }),
      });

const keySignature = (key: PropertyKey): unknown => (P.isSymbol(key) ? { symbol: identityOf(key) } : key);

/**
 * The parity signature of one schema AST: its structure node by node, with
 * every node a representation cannot describe (a transformation, a filter or
 * declaration without a `representation` annotation, a unique symbol) held as
 * the identity of that object at its position.
 *
 * **Details**
 *
 * `Suspend` is resolved and walked; a node already on the current path is a
 * cycle and is recorded by its depth, so a recursive schema terminates.
 * Annotations other than `representation` are not part of the wire and are
 * not compared.
 *
 * @param ast - The AST to sign.
 * @param path - The nodes from the root to `ast`, for cycle detection.
 * @returns A plain value; two schemas are in parity when their signatures are deeply equal.
 */
const signatureOf = (ast: SchemaAST.AST, path: ReadonlyArray<SchemaAST.AST>): unknown => {
  const depth = A.findFirstIndex(path, (ancestor) => ancestor === ast);
  if (O.isSome(depth)) return { _tag: "Cycle", depth: A.length(path) - depth.value };
  const inside = A.append(path, ast);
  const sign = (child: SchemaAST.AST): unknown => signatureOf(child, inside);
  const common = {
    _tag: ast._tag,
    checks: A.map(ast.checks ?? [], checkSignature),
    encoding: A.map(ast.encoding ?? [], (link) => ({
      transformation: identityOf(link.transformation),
      to: sign(link.to),
    })),
    optional: ast.context?.isOptional ?? false,
    mutable: ast.context?.isMutable ?? false,
  };
  return Match.value(ast).pipe(
    Match.discriminatorsExhaustive("_tag")({
      Declaration: (node) => ({
        ...common,
        typeParameters: A.map(node.typeParameters, sign),
        declaration: O.match(describedBy(node.annotations), {
          onNone: () => ({ identity: identityOf(node) }),
          onSome: (representation) => ({ representation }),
        }),
      }),
      Null: () => common,
      Undefined: () => common,
      Void: () => common,
      Never: () => common,
      Unknown: () => common,
      Any: () => common,
      String: () => common,
      Number: () => common,
      Boolean: () => common,
      BigInt: () => common,
      Symbol: () => common,
      ObjectKeyword: () => common,
      // A bigint keeps its kind, so `1n` and the string `"1n"` sign apart.
      Literal: (node) => ({
        ...common,
        literal: P.isBigInt(node.literal) ? { bigint: String(node.literal) } : node.literal,
      }),
      UniqueSymbol: (node) => ({ ...common, symbol: identityOf(node.symbol) }),
      Enum: (node) => ({ ...common, enums: node.enums }),
      TemplateLiteral: (node) => ({ ...common, parts: A.map(node.parts, sign) }),
      Arrays: (node) => ({
        ...common,
        readonly: !node.isMutable,
        elements: A.map(node.elements, sign),
        rest: A.map(node.rest, sign),
      }),
      Objects: (node) => ({
        ...common,
        propertySignatures: A.map(node.propertySignatures, (property) => ({
          name: keySignature(property.name),
          type: sign(property.type),
        })),
        indexSignatures: A.map(node.indexSignatures, (index) => ({
          parameter: sign(index.parameter),
          type: sign(index.type),
        })),
      }),
      Union: (node) => ({ ...common, mode: node.options?.mode ?? "anyOf", types: A.map(node.types, sign) }),
      Suspend: (node) => ({ ...common, thunk: sign(node.thunk()) }),
    })
  );
};

/**
 * The parity signature of one schema: its AST node by node, with every node a
 * representation cannot describe held by reference at its position.
 *
 * **Details**
 *
 * Two schemas are in parity when their signatures are deeply equal: the same
 * structure on both sides, and the same transformation, undescribed filter and
 * undescribed declaration objects at the same places. A model built from its
 * contract's declarations shares those objects, so its RPCs are in parity with
 * the contract's.
 *
 * **Example** (A codec decoding to S.Number is not one decoding to S.Finite)
 *
 * ```ts
 * import { schemaSignatureOf } from "@beep/contract-kit/Parity"
 * import * as Equal from "effect/Equal"
 * import * as S from "effect/Schema"
 *
 * const same = Equal.equals(schemaSignatureOf(S.Number), schemaSignatureOf(S.Finite))
 * console.log(same) // false
 * ```
 *
 * @param schema - The schema to sign.
 * @returns Its parity signature, a plain value.
 * @category getters
 * @since 0.0.0
 */
export const schemaSignatureOf = (schema: S.Top): unknown => signatureOf(schema.ast, []);

/**
 * One RPC as its wire sees it: the parity signatures of its payload, of its
 * reply codec (`Rpc.exitSchema`, which unions the RPC's errors with every
 * middleware's) and of its streamed element, whether it streams, and the
 * middleware keys it runs. Two shapes are the same wire when they are deeply
 * equal.
 *
 * **Example** (Make an RPC shape)
 *
 * ```ts
 * import { RpcShape, schemaSignatureOf } from "@beep/contract-kit/Parity"
 * import * as S from "effect/Schema"
 *
 * const shape = RpcShape.make({
 *   tag: "Ping",
 *   stream: false,
 *   payload: schemaSignatureOf(S.Void),
 *   exit: schemaSignatureOf(S.Void),
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
    payload: S.Unknown,
    exit: S.Unknown,
    chunk: S.Unknown,
    middleware: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("RpcShape", {
      description:
        "The wire shape of one RPC: payload, reply-exit and streamed-element parity signatures, streaming and middleware.",
    })
  )
) {}

/**
 * The wire shape of one RPC.
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
    payload: schemaSignatureOf(rpc.payloadSchema),
    exit: rpc.pipe(Rpc.exitSchema, schemaSignatureOf),
    chunk: RpcSchema.isStreamSchema(success) ? schemaSignatureOf(success.success) : null,
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
