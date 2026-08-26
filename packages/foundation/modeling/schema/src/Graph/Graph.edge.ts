/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, SchemaIssue, SchemaParser, SchemaTransformation } from "effect";
import * as S from "effect/Schema";
import { EdgeEncoded } from "./Graph.encoded.ts";
import { isEdge } from "./Graph.guards.ts";
import { $I, toRawEdgeEncoded } from "./Graph.shared.ts";
import type { Graph as Graph_ } from "effect";
import type { EdgeEncodedSchema, EdgeIso } from "./Graph.encoded.ts";

/**
 * Schema for validating existing `Graph.Edge` values.
 *
 * **Example** (Build EdgeFromSelf schema)
 *
 * ```ts import.meta.vitest name="Build EdgeFromSelf schema"
 * import { EdgeFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const EdgeSchema = EdgeFromSelf(S.String)
 * console.log(S.isSchema(EdgeSchema))
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * Schema for transforming encoded edge payloads into `Graph.Edge` values.
 *
 * **Example** (Build EdgeTransform schema)
 *
 * ```ts import.meta.vitest name="Build EdgeTransform schema"
 * import { EdgeTransform } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const EdgeSchema = EdgeTransform(S.String)
 * console.log(S.isSchema(EdgeSchema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface EdgeTransform<Data extends S.Top>
  extends S.decodeTo<EdgeFromSelf<S.toType<Data>>, EdgeEncodedSchema<Data>> {
  readonly data: Data;
  readonly Rebuild: this;
}

/**
 * Schema for graph edges.
 *
 * **Example** (Build Edge schema)
 *
 * ```ts import.meta.vitest name="Build Edge schema"
 * import { Edge } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const EdgeSchema = Edge(S.String)
 * console.log(S.isSchema(EdgeSchema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface Edge<Data extends S.Top> extends S.decodeTo<EdgeFromSelf<S.toType<Data>>, EdgeEncodedSchema<Data>> {
  readonly data: Data;
  readonly Rebuild: this;
}

/**
 * Schema for validating existing `Graph.Edge` values while applying the
 * provided payload schema.
 *
 * **Example** (Validate Edge with payload)
 *
 * ```ts import.meta.vitest name="Validate Edge with payload"
 * import { EdgeFromSelf } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const EdgeSchema = EdgeFromSelf(S.String)
 * console.log(S.isSchema(EdgeSchema))
 * ```
 *
 * @param data - Schema for edge payloads.
 * @returns Schema that validates runtime `Graph.Edge` values.
 * @category validation
 * @since 0.0.0
 */
export const EdgeFromSelf = <Data extends S.Top>(data: Data): EdgeFromSelf<Data> => {
  const schema = S.declareConstructor<Graph_.Edge<Data["Type"]>, Graph_.Edge<Data["Encoded"]>, EdgeIso<Data>>()(
    [data],
    ([data]) => {
      const encoded = EdgeEncoded(data);

      return (input, ast, options) => {
        if (!isEdge(input)) {
          return Effect.fail(new SchemaIssue.InvalidType(ast));
        }

        return Effect.flatMap(
          SchemaParser.decodeUnknownEffect(encoded)(toRawEdgeEncoded(input), options),
          Effect.fnUntraced(function* (edge) {
            return yield* Effect.succeed({
              source: edge.source,
              target: edge.target,
              data: edge.data,
            });
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
      description: "Schema for existing Effect graph edge values.",
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
 * **Example** (Transform encoded edge objects)
 *
 * ```ts import.meta.vitest name="Transform encoded edge objects"
 * import { EdgeTransform } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const EdgeSchema = EdgeTransform(S.String)
 * console.log(S.isSchema(EdgeSchema))
 * ```
 *
 * @param data - Schema for edge payloads.
 * @returns Edge transform schema.
 * @category validation
 * @since 0.0.0
 */
export const EdgeTransform = <Data extends S.Top>(data: Data): EdgeTransform<Data> => {
  const decodedEdge = data.pipe(S.toType, EdgeEncoded);
  const schema = EdgeEncoded(data).pipe(
    S.decodeTo(
      data.pipe(S.toType, EdgeFromSelf),
      SchemaTransformation.transformOrFail({
        decode: (encoded): Effect.Effect<Graph_.Edge<Data["Type"]>> =>
          Effect.succeed({
            source: encoded.source,
            target: encoded.target,
            data: encoded.data,
          }),
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
 * **Details**
 *
 * Decodes an `{ source, target, data }` object into a `Graph.Edge` instance.
 *
 * **Example** (Decode edge object shape)
 *
 * ```ts import.meta.vitest name="Decode edge object shape"
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
 * @category constructors
 * @since 0.0.0
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
