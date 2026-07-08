/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { EdgeIndex, GraphKind, NodeIndex } from "./Graph.primitives.ts";
import { $I } from "./Graph.shared.ts";
import type { GraphKindValue } from "./Graph.shared.ts";

/**
 * Encoded edge representation used by graph codecs.
 *
 * @example
 * ```ts
 * import { NodeIndex, type EdgeEncoded } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const source = S.decodeUnknownSync(NodeIndex)(0)
 * const target = S.decodeUnknownSync(NodeIndex)(1)
 * const edge = { source, target, data: "knows" } satisfies EdgeEncoded<string>
 * console.log(edge.data)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EdgeEncoded<Data> = Readonly<{
  readonly source: NodeIndex;
  readonly target: NodeIndex;
  readonly data: Data;
}>;

/**
 * Encoded graph representation used by graph codecs.
 *
 * @example
 * ```ts
 * import { NodeIndex, type GraphEncoded } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const nodeIndex = S.decodeUnknownSync(NodeIndex)(0)
 *
 * const graph = {
 *   _tag: "Graph",
 *   type: "directed",
 *   nodes: [[nodeIndex, "Ada"]],
 *   edges: []
 * } satisfies GraphEncoded<string, string, "directed">
 *
 * console.log(graph.nodes.length)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type GraphEncoded<Node, Edge, Kind extends GraphKindValue = GraphKindValue> = Readonly<{
  readonly _tag: "Graph";
  readonly type: Kind;
  readonly nodes: ReadonlyArray<readonly [NodeIndex, Node]>;
  readonly edges: ReadonlyArray<{
    readonly index: EdgeIndex;
    readonly source: NodeIndex;
    readonly target: NodeIndex;
    readonly data: Edge;
  }>;
}>;

/** @internal */
/**
 * Iso (identity-transformed) representation of a graph edge for a given payload schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NodeIndex, type EdgeIso } from "@beep/schema/Graph"
 *
 * const source = S.decodeUnknownSync(NodeIndex)(0)
 * const target = S.decodeUnknownSync(NodeIndex)(1)
 * const edge: EdgeIso<typeof S.String> = { source, target, data: "knows" }
 * console.log(edge.data)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeIso<Data extends S.Top> = Readonly<{
  readonly source: NodeIndex;
  readonly target: NodeIndex;
  readonly data: Data["Iso"];
}>;

/** @internal */
/**
 * Iso (identity-transformed) representation of a graph for given node and edge payload schemas.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NodeIndex, type GraphIso } from "@beep/schema/Graph"
 *
 * const nodeIndex = S.decodeUnknownSync(NodeIndex)(0)
 *
 * const graph: GraphIso<typeof S.String, typeof S.String, "directed"> = {
 *   _tag: "Graph",
 *   type: "directed",
 *   nodes: [[nodeIndex, "Ada"]],
 *   edges: []
 * }
 *
 * console.log(graph.nodes.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GraphIso<Node extends S.Top, Edge extends S.Top, Kind extends GraphKindValue = GraphKindValue> = Readonly<{
  readonly _tag: "Graph";
  readonly type: Kind;
  readonly nodes: ReadonlyArray<readonly [NodeIndex, Node["Iso"]]>;
  readonly edges: ReadonlyArray<{
    readonly index: EdgeIndex;
    readonly source: NodeIndex;
    readonly target: NodeIndex;
    readonly data: Edge["Iso"];
  }>;
}>;

/**
 * Schema type for encoded graph edges.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { EdgeEncoded, type EdgeEncodedSchema } from "@beep/schema/Graph"
 *
 * const schema: EdgeEncodedSchema<typeof S.String> = EdgeEncoded(S.String)
 * console.log(S.isSchema(schema))
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export interface EdgeEncodedSchema<Data extends S.Top>
  extends S.Codec<
    EdgeEncoded<Data["Type"]>,
    EdgeEncoded<Data["Encoded"]>,
    Data["DecodingServices"],
    Data["EncodingServices"]
  > {
  readonly data: Data;
  readonly Rebuild: this;
}

/**
 * Schema type for encoded graphs.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { GraphEncoded, type GraphEncodedSchema } from "@beep/schema/Graph"
 *
 * const schema: GraphEncodedSchema<typeof S.String, typeof S.String> = GraphEncoded(S.String, S.String)
 * console.log(S.isSchema(schema))
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export interface GraphEncodedSchema<Node extends S.Top, Edge extends S.Top>
  extends S.Codec<
    GraphEncoded<Node["Type"], Edge["Type"]>,
    GraphEncoded<Node["Encoded"], Edge["Encoded"]>,
    Node["DecodingServices"] | Edge["DecodingServices"],
    Node["EncodingServices"] | Edge["EncodingServices"]
  > {
  readonly edge: Edge;
  readonly node: Node;
  readonly Rebuild: this;
}

/**
 * Schema for encoded graph edges.
 *
 * @example
 * ```ts
 * import { EdgeEncoded } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const Edge = EdgeEncoded(S.String)
 * const edge = S.decodeUnknownSync(Edge)({ source: 0, target: 1, data: "knows" })
 * console.log(edge.data)
 * ```
 *
 * @param data - Schema for edge payloads.
 * @returns Schema for the encoded edge representation.
 * @since 0.0.0
 * @category validation
 */
export const EdgeEncoded = <Data extends S.Top>(data: Data): EdgeEncodedSchema<Data> => {
  const schema = S.Class<EdgeEncoded<Data["Type"]>>($I`EdgeEncoded`)({
    source: NodeIndex,
    target: NodeIndex,
    data,
  }).mapFields((fields) => fields);

  return S.make<EdgeEncodedSchema<Data>>(schema.ast, { data }).pipe(
    $I.annoteSchema("EdgeEncoded", {
      description: "The encoded representation of an Effect graph edge.",
    })
  );
};

/**
 * Schema for encoded graphs.
 *
 * @example
 * ```ts
 * import { GraphEncoded } from "@beep/schema/Graph"
 * import * as S from "effect/Schema"
 *
 * const Graph = GraphEncoded(S.String, S.String)
 * const graph = S.decodeUnknownSync(Graph)({
 *   _tag: "Graph",
 *   type: "directed",
 *   nodes: [[0, "Ada"]],
 *   edges: []
 * })
 *
 * console.log(graph.type)
 * ```
 *
 * @param node - Schema for node payloads.
 * @param edge - Schema for edge payloads.
 * @returns Encoded graph schema.
 * @since 0.0.0
 * @category validation
 */
export const GraphEncoded: {
  <Node extends S.Top, Edge extends S.Top>(node: Node): (edge: Edge) => GraphEncodedSchema<Node, Edge>;
  <Node extends S.Top, Edge extends S.Top>(node: Node, edge: Edge): GraphEncodedSchema<Node, Edge>;
} = dual(2, <Node extends S.Top, Edge extends S.Top>(node: Node, edge: Edge) => {
  const schema = S.TaggedStruct("Graph", {
    type: GraphKind,
    nodes: S.Array(S.Tuple([NodeIndex, node])),
    edges: S.Array(
      S.Class<GraphEncoded<Node["Type"], Edge["Type"]>["edges"][number]>($I`GraphEncodedEdge`)({
        index: EdgeIndex,
        source: NodeIndex,
        target: NodeIndex,
        data: edge,
      }).mapFields((fields) => fields)
    ),
  });

  return S.make<GraphEncodedSchema<Node, Edge>>(schema.ast, { node, edge }).pipe(
    $I.annoteSchema("GraphEncoded", {
      description: "The encoded representation of an Effect graph value.",
    })
  );
});
