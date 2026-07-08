/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Effect, Graph as Graph_, Option, SchemaIssue, SchemaParser, SchemaTransformation } from "effect";
import * as S from "effect/Schema";
import { EdgeEncoded } from "./Graph.encoded.ts";
import { isEdge } from "./Graph.guards.ts";
import { $I, toRawEdgeEncoded } from "./Graph.shared.ts";
import type { EdgeEncodedSchema, EdgeIso } from "./Graph.encoded.ts";

/**
 * Schema for validating existing `Graph.Edge` instances.
 *
 * @example
 * ```ts
 * import { EdgeFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const EdgeSchema = EdgeFromSelf(S.String)
 * console.log(S.isSchema(EdgeSchema))
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export interface EdgeFromSelf<Data extends S.Top>
  extends S.declareConstructor<
    Graph_.Edge<Data["Type"]>,
    Graph_.Edge<Data["Encoded"]>,
    readonly [Data],
    EdgeIso<Data>
  > {
  readonly data: Data;
  readonly Rebuild: this;
}

/**
 * Schema for transforming encoded edge payloads into `Graph.Edge` instances.
 *
 * @example
 * ```ts
 * import { EdgeTransform } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const EdgeSchema = EdgeTransform(S.String)
 * console.log(S.isSchema(EdgeSchema))
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export interface EdgeTransform<Data extends S.Top>
  extends S.decodeTo<EdgeFromSelf<S.toType<Data>>, EdgeEncodedSchema<Data>> {
  readonly data: Data;
  readonly Rebuild: this;
}

/**
 * Schema for graph edges.
 *
 * @example
 * ```ts
 * import { Edge } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const EdgeSchema = Edge(S.String)
 * console.log(S.isSchema(EdgeSchema))
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export interface Edge<Data extends S.Top> extends S.decodeTo<EdgeFromSelf<S.toType<Data>>, EdgeEncodedSchema<Data>> {
  readonly data: Data;
  readonly Rebuild: this;
}

/**
 * Schema for validating existing `Graph.Edge` instances while applying the
 * provided payload schema.
 *
 * @example
 * ```ts
 * import { EdgeFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const EdgeSchema = EdgeFromSelf(S.String)
 * console.log(S.isSchema(EdgeSchema))
 * ```
 *
 * @param data - Schema for edge payloads.
 * @returns Schema that validates runtime `Graph.Edge` values.
 * @since 0.0.0
 * @category validation
 */
export const EdgeFromSelf = <Data extends S.Top>(data: Data): EdgeFromSelf<Data> => {
  const schema = S.declareConstructor<Graph_.Edge<Data["Type"]>, Graph_.Edge<Data["Encoded"]>, EdgeIso<Data>>()(
    [data],
    ([data]) => {
      const encoded = EdgeEncoded(data);

      return (input, ast, options) => {
        if (!isEdge(input)) {
          return Effect.fail(new SchemaIssue.InvalidType(ast, Option.some(input)));
        }

        return Effect.flatMap(
          SchemaParser.decodeUnknownEffect(encoded)(toRawEdgeEncoded(input), options),
          Effect.fnUntraced(function* (edge) {
            return yield* Effect.succeed(
              new Graph_.Edge({
                source: edge.source,
                target: edge.target,
                data: edge.data,
              })
            );
          })
        );
      };
    },
    {
      typeConstructor: {
        _tag: "effect/Graph.Edge",
      },
      generation: {
        runtime: "EdgeFromSelf(?)",
        Type: "Graph.Edge<?>",
        importDeclaration: 'import * as Graph from "effect/Graph"',
      },
      expected: "Graph.Edge",
      description: "Schema for existing Effect graph edges.",
      toEquivalence:
        ([data]) =>
        (self, that) =>
          self.source === that.source && self.target === that.target && data(self.data, that.data),
      toFormatter:
        ([data]) =>
        (edge) =>
          `Edge(${edge.source}, ${edge.target}, ${data(edge.data)})`,
    }
  );

  return S.make<EdgeFromSelf<Data>>(schema.ast, { data }).pipe(
    $I.annoteSchema("EdgeFromSelf", {
      description: "Schema for validating existing Effect graph edge values.",
    })
  );
};

/**
 * Schema that transforms encoded edge objects into `Graph.Edge` instances and
 * encodes them back to the same object shape.
 *
 * @example
 * ```ts
 * import { EdgeTransform } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const EdgeSchema = EdgeTransform(S.String)
 * console.log(S.isSchema(EdgeSchema))
 * ```
 *
 * @param data - Schema for edge payloads.
 * @returns Edge transform schema.
 * @since 0.0.0
 * @category validation
 */
export const EdgeTransform = <Data extends S.Top>(data: Data): EdgeTransform<Data> => {
  const decodedEdge = data.pipe(S.toType, EdgeEncoded);
  const schema = EdgeEncoded(data).pipe(
    S.decodeTo(
      data.pipe(S.toType, EdgeFromSelf),
      SchemaTransformation.transformOrFail({
        decode: (encoded) =>
          Effect.succeed(
            new Graph_.Edge({
              source: encoded.source,
              target: encoded.target,
              data: encoded.data,
            })
          ),
        encode: (edge, options) => SchemaParser.decodeUnknownEffect(decodedEdge)(toRawEdgeEncoded(edge), options),
      })
    )
  );

  return S.make<EdgeTransform<Data>>(schema.ast, {
    from: schema.from,
    to: schema.to,
    data,
  }).pipe(
    $I.annoteSchema("EdgeTransform", {
      description: "Schema for transforming encoded graph edges into Effect Graph.Edge values.",
    })
  );
};

/**
 * Schema for graph edges. This is an alias of {@link EdgeTransform}.
 *
 * Decodes an `{ source, target, data }` object into a `Graph.Edge` instance.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Edge } from "@beep/schema/Graph"
 *
 * const EdgeSchema = Edge(S.String)
 *
 * console.log(S.isSchema(EdgeSchema))
 * ```
 *
 * @param data - Schema for edge payloads.
 * @returns Edge schema.
 * @since 0.0.0
 * @category constructors
 */
export const Edge = <Data extends S.Top>(data: Data): Edge<Data> =>
  ((schema) =>
    S.make<Edge<Data>>(schema.ast, {
      from: schema.from,
      to: schema.to,
      data,
    }).pipe(
      $I.annoteSchema("Edge", {
        description: "Schema for Effect graph edges.",
      })
    ))(EdgeTransform(data));
