/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { SchemaParser, SchemaTransformation } from "effect";
import * as S from "effect/Schema";
import { GraphEncoded } from "./Graph.encoded.ts";
import {
  DirectedGraphFromSelf,
  MutableDirectedGraphFromSelf,
  MutableUndirectedGraphFromSelf,
  UndirectedGraphFromSelf,
} from "./Graph.from-self.ts";
import { rebuildImmutableGraph, rebuildMutableGraph } from "./Graph.rebuild.ts";
import { $I, toRawGraphEncoded } from "./Graph.shared.ts";
import type { GraphEncodedSchema } from "./Graph.encoded.ts";
import type { GraphKindValue } from "./Graph.shared.ts";

/**
 * Schema for decoding encoded graph payloads into immutable directed graphs.
 *
 * **Example** (Directed graph schema check)
 *
 * ```ts import.meta.vitest name="Directed graph schema check"
 * import * as S from "effect/Schema"
 * import { DirectedGraph } from "@beep/schema/Graph"
 *
 * const GraphSchema = DirectedGraph({ node: S.String, edge: S.Finite })
 * console.log(S.isSchema(GraphSchema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface DirectedGraph<Node extends S.Top, Edge extends S.Top>
  extends S.decodeTo<DirectedGraphFromSelf<S.toType<Node>, S.toType<Edge>>, GraphEncodedSchema<Node, Edge>> {
  readonly edge: Edge;
  readonly node: Node;
  readonly Rebuild: this;
}

/**
 * Schema for decoding encoded graph payloads into immutable undirected graphs.
 *
 * **Example** (Undirected graph schema check)
 *
 * ```ts import.meta.vitest name="Undirected graph schema check"
 * import * as S from "effect/Schema"
 * import { UndirectedGraph } from "@beep/schema/Graph"
 *
 * const GraphSchema = UndirectedGraph({ node: S.String, edge: S.Finite })
 * console.log(S.isSchema(GraphSchema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface UndirectedGraph<Node extends S.Top, Edge extends S.Top>
  extends S.decodeTo<UndirectedGraphFromSelf<S.toType<Node>, S.toType<Edge>>, GraphEncodedSchema<Node, Edge>> {
  readonly edge: Edge;
  readonly node: Node;
  readonly Rebuild: this;
}

/**
 * Schema for decoding encoded graph payloads into mutable directed graphs.
 *
 * **Example** (Mutable directed schema check)
 *
 * ```ts import.meta.vitest name="Mutable directed schema check"
 * import * as S from "effect/Schema"
 * import { MutableDirectedGraph } from "@beep/schema/Graph"
 *
 * const GraphSchema = MutableDirectedGraph({ node: S.String, edge: S.Finite })
 * console.log(S.isSchema(GraphSchema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface MutableDirectedGraph<Node extends S.Top, Edge extends S.Top>
  extends S.decodeTo<MutableDirectedGraphFromSelf<S.toType<Node>, S.toType<Edge>>, GraphEncodedSchema<Node, Edge>> {
  readonly edge: Edge;
  readonly node: Node;
  readonly Rebuild: this;
}

/**
 * Schema for decoding encoded graph payloads into mutable undirected graphs.
 *
 * **Example** (Mutable undirected schema check)
 *
 * ```ts import.meta.vitest name="Mutable undirected schema check"
 * import * as S from "effect/Schema"
 * import { MutableUndirectedGraph } from "@beep/schema/Graph"
 *
 * const GraphSchema = MutableUndirectedGraph({ node: S.String, edge: S.Finite })
 * console.log(S.isSchema(GraphSchema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface MutableUndirectedGraph<Node extends S.Top, Edge extends S.Top>
  extends S.decodeTo<MutableUndirectedGraphFromSelf<S.toType<Node>, S.toType<Edge>>, GraphEncodedSchema<Node, Edge>> {
  readonly edge: Edge;
  readonly node: Node;
  readonly Rebuild: this;
}

const makeGraphTransform = <Node extends S.Top, Edge extends S.Top>(
  options: {
    readonly node: Node;
    readonly edge: Edge;
  },
  mutable: boolean,
  expectedType: GraphKindValue
) => {
  const decodedGraph = GraphEncoded(S.toType(options.node), S.toType(options.edge));

  if (mutable) {
    const target =
      expectedType === "directed"
        ? MutableDirectedGraphFromSelf({
            node: S.toType(options.node),
            edge: S.toType(options.edge),
          })
        : MutableUndirectedGraphFromSelf({
            node: S.toType(options.node),
            edge: S.toType(options.edge),
          });

    return GraphEncoded(options.node, options.edge).pipe(
      S.decodeTo(
        target,
        SchemaTransformation.transformOrFail({
          decode: (encoded) => rebuildMutableGraph(encoded, { expectedType }),
          encode: (graph, parseOptions) =>
            SchemaParser.decodeUnknownEffect(decodedGraph)(toRawGraphEncoded(graph), parseOptions),
        })
      )
    );
  }

  const target =
    expectedType === "directed"
      ? DirectedGraphFromSelf({
          node: S.toType(options.node),
          edge: S.toType(options.edge),
        })
      : UndirectedGraphFromSelf({
          node: S.toType(options.node),
          edge: S.toType(options.edge),
        });

  return GraphEncoded(options.node, options.edge).pipe(
    S.decodeTo(
      target,
      SchemaTransformation.transformOrFail({
        decode: (encoded) => rebuildImmutableGraph(encoded, { expectedType }),
        encode: (graph, parseOptions) =>
          SchemaParser.decodeUnknownEffect(decodedGraph)(toRawGraphEncoded(graph), parseOptions),
      })
    )
  );
};

/**
 * Schema for immutable directed graphs.
 *
 * **Details**
 *
 * Decodes an encoded `{ _tag: "Graph", type: "directed", nodes, edges }`
 * payload into an immutable `Graph.DirectedGraph` value.
 *
 * **Example** (Directed graph schema check)
 *
 * ```ts import.meta.vitest name="Directed graph schema check"
 * import * as S from "effect/Schema"
 * import { DirectedGraph } from "@beep/schema/Graph"
 *
 * const GraphSchema = DirectedGraph({ node: S.String, edge: S.Finite })
 *
 * console.log(S.isSchema(GraphSchema))
 * ```
 *
 * @param options - Schemas for node and edge payloads.
 * @returns Directed graph transform schema.
 * @category constructors
 * @since 0.0.0
 */
export const DirectedGraph = <Node extends S.Top, Edge extends S.Top>(options: {
  readonly node: Node;
  readonly edge: Edge;
}): DirectedGraph<Node, Edge> =>
  ((schema) =>
    S.make<DirectedGraph<Node, Edge>>(schema.ast, {
      from: schema.from,
      to: schema.to,
      node: options.node,
      edge: options.edge,
    }).pipe(
      $I.annoteSchema("DirectedGraph", {
        description: "Schema for decoding encoded directed graph payloads into immutable Effect graph values.",
      })
    ))(makeGraphTransform(options, false, "directed"));

/**
 * Schema for immutable undirected graphs.
 *
 * **Example** (Undirected graph schema check)
 *
 * ```ts import.meta.vitest name="Undirected graph schema check"
 * import * as S from "effect/Schema"
 * import { UndirectedGraph } from "@beep/schema/Graph"
 *
 * const GraphSchema = UndirectedGraph({ node: S.String, edge: S.Finite })
 *
 * console.log(S.isSchema(GraphSchema))
 * ```
 *
 * @param options - Schemas for node and edge payloads.
 * @returns Undirected graph transform schema.
 * @category validation
 * @since 0.0.0
 */
export const UndirectedGraph = <Node extends S.Top, Edge extends S.Top>(options: {
  readonly node: Node;
  readonly edge: Edge;
}): UndirectedGraph<Node, Edge> =>
  ((schema) =>
    S.make<UndirectedGraph<Node, Edge>>(schema.ast, {
      from: schema.from,
      to: schema.to,
      node: options.node,
      edge: options.edge,
    }).pipe(
      $I.annoteSchema("UndirectedGraph", {
        description: "Schema for decoding encoded undirected graph payloads into immutable Effect graph values.",
      })
    ))(makeGraphTransform(options, false, "undirected"));

/**
 * Schema for mutable directed graphs.
 *
 * **Example** (Mutable directed schema check)
 *
 * ```ts import.meta.vitest name="Mutable directed schema check"
 * import * as S from "effect/Schema"
 * import { MutableDirectedGraph } from "@beep/schema/Graph"
 *
 * const GraphSchema = MutableDirectedGraph({ node: S.String, edge: S.Finite })
 *
 * console.log(S.isSchema(GraphSchema))
 * ```
 *
 * @param options - Schemas for node and edge payloads.
 * @returns Mutable directed graph transform schema.
 * @category validation
 * @since 0.0.0
 */
export const MutableDirectedGraph = <Node extends S.Top, Edge extends S.Top>(options: {
  readonly node: Node;
  readonly edge: Edge;
}): MutableDirectedGraph<Node, Edge> =>
  ((schema) =>
    S.make<MutableDirectedGraph<Node, Edge>>(schema.ast, {
      from: schema.from,
      to: schema.to,
      node: options.node,
      edge: options.edge,
    }).pipe(
      $I.annoteSchema("MutableDirectedGraph", {
        description: "Schema for decoding encoded directed graph payloads into mutable Effect graph values.",
      })
    ))(makeGraphTransform(options, true, "directed"));

/**
 * Schema for mutable undirected graphs.
 *
 * **Example** (Mutable undirected schema check)
 *
 * ```ts import.meta.vitest name="Mutable undirected schema check"
 * import * as S from "effect/Schema"
 * import { MutableUndirectedGraph } from "@beep/schema/Graph"
 *
 * const GraphSchema = MutableUndirectedGraph({ node: S.String, edge: S.Finite })
 *
 * console.log(S.isSchema(GraphSchema))
 * ```
 *
 * @param options - Schemas for node and edge payloads.
 * @returns Mutable undirected graph transform schema.
 * @category validation
 * @since 0.0.0
 */
export const MutableUndirectedGraph = <Node extends S.Top, Edge extends S.Top>(options: {
  readonly node: Node;
  readonly edge: Edge;
}): MutableUndirectedGraph<Node, Edge> =>
  ((schema) =>
    S.make<MutableUndirectedGraph<Node, Edge>>(schema.ast, {
      from: schema.from,
      to: schema.to,
      node: options.node,
      edge: options.edge,
    }).pipe(
      $I.annoteSchema("MutableUndirectedGraph", {
        description: "Schema for decoding encoded undirected graph payloads into mutable Effect graph values.",
      })
    ))(makeGraphTransform(options, true, "undirected"));
