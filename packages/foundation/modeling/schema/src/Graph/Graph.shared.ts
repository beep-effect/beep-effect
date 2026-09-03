/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { flow, Graph as Graph_, Number as Num, Order, pipe, SchemaIssue } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import { LiteralKit } from "../LiteralKit/index.ts";

/**
 * Internal identity composer.
 *
 * **Example** (Reading the module identity)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { $I } from "../../src/Graph/Graph.shared.ts"
 *
 * const Labeled = S.String.pipe($I.annoteSchema("GraphLabel", { description: "A graph label." }))
 * console.log(S.isSchema(Labeled))
 * ```
 *
 * @internal
 * @category symbols
 * @since 0.0.0
 */
export const $I = $SchemaId.create("Graph");

/** @internal */
/**
 * Literal schema for the graph kind discriminator (`"directed"` or `"undirected"`).
 *
 * **Example** (Decoding a graph kind)
 *
 * ```ts
 * import { GraphKindValue } from "../../src/Graph/Graph.shared.ts"
 *
 * console.log(GraphKindValue.Options.includes("directed"))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export const GraphKindValue = LiteralKit(["directed", "undirected"]).pipe(
  $I.annoteSchema("GraphKindValue", {
    description: "Public schema module export.",
  })
);

/**
 * Companion type for {@link GraphKindValue}.
 *
 * **Example** (Typing a graph kind)
 *
 * ```ts
 * import { GraphKindValue } from "../../src/Graph/Graph.shared.ts"
 *
 * const kind: GraphKindValue = "directed"
 * console.log(GraphKindValue.Options.includes(kind))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GraphKindValue = typeof GraphKindValue.Type;

/** @internal */
/**
 * Raw (unvalidated) encoded edge shape prior to node/edge-index schema validation.
 *
 * **Example** (Shaping a raw encoded edge)
 *
 * ```ts
 * import type { RawEdgeEncoded } from "../../src/Graph/Graph.shared.ts"
 *
 * const edge: RawEdgeEncoded<string> = { source: 0, target: 1, data: "knows" }
 * console.log(edge.data)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RawEdgeEncoded<Data> = Readonly<{
  readonly source: number;
  readonly target: number;
  readonly data: Data;
}>;

/** @internal */
/**
 * Raw (unvalidated) encoded graph shape prior to node/edge-index schema validation.
 *
 * **Example** (Shaping a raw encoded graph)
 *
 * ```ts
 * import type { RawGraphEncoded } from "../../src/Graph/Graph.shared.ts"
 *
 * const graph: RawGraphEncoded<string, string, "directed"> = {
 *   _tag: "Graph",
 *   type: "directed",
 *   nodes: [[0, "Ada"]],
 *   edges: []
 * }
 *
 * console.log(graph.nodes.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RawGraphEncoded<Node, Edge, Kind extends GraphKindValue = GraphKindValue> = Readonly<{
  readonly _tag: "Graph";
  readonly type: Kind;
  readonly nodes: ReadonlyArray<readonly [number, Node]>;
  readonly edges: ReadonlyArray<{
    readonly index: number;
    readonly source: number;
    readonly target: number;
    readonly data: Edge;
  }>;
}>;

const nodeEntryOrder = Order.mapInput(Num.Order, ([index]: readonly [number, unknown]) => index);

const edgeEntryOrder = Order.mapInput(Num.Order, (edge: { readonly index: number }) => edge.index);

/** @internal */
/**
 * Builds a `SchemaIssue.InvalidValue` for a rejected graph value.
 *
 * **Example** (Building an invalid-graph issue)
 *
 * ```ts
 * import { makeInvalidGraphIssue } from "../../src/Graph/Graph.shared.ts"
 *
 * const issue = makeInvalidGraphIssue("Expected at least one node.")
 * console.log(issue._tag, String(issue))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeInvalidGraphIssue = (message: string): SchemaIssue.InvalidValue =>
  new SchemaIssue.InvalidValue({ message });

/** @internal */
/**
 * Builds a `SchemaIssue.InvalidValue` describing a node/edge index mismatch
 * encountered while reconstructing a graph.
 *
 * **Example** (Reporting an index mismatch)
 *
 * ```ts
 * import { makeGraphConstructionIssue } from "../../src/Graph/Graph.shared.ts"
 *
 * const issue = makeGraphConstructionIssue({ entity: "node", expected: 0, received: 1 })
 * console.log(issue._tag)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeGraphConstructionIssue = (mismatch: {
  readonly entity: "node" | "edge";
  readonly expected: number;
  readonly received: number;
}): SchemaIssue.InvalidValue =>
  makeInvalidGraphIssue(`Expected ${mismatch.entity} index ${mismatch.expected}, got ${mismatch.received}`);

/** @internal */
/**
 * Sorts raw `[index, node]` entries by ascending node index.
 *
 * **Example** (Sorting raw node entries)
 *
 * ```ts
 * import { sortRawNodeEntries } from "../../src/Graph/Graph.shared.ts"
 *
 * const sorted = sortRawNodeEntries([[2, "b"], [1, "a"]])
 * console.log(sorted.map(([index]) => index))
 * ```
 *
 * @category symbols
 * @since 0.0.0
 */
export const sortRawNodeEntries = <Node>(
  nodes: RawGraphEncoded<Node, never>["nodes"]
): RawGraphEncoded<Node, never>["nodes"] =>
  flow(
    A.map(([index, node]): readonly [number, Node] => [index, node]),
    A.sort(nodeEntryOrder)
  )(nodes);

/** @internal */
/**
 * Sorts raw encoded edge entries by ascending edge index.
 *
 * **Example** (Sorting raw edge entries)
 *
 * ```ts
 * import { sortRawEdgeEntries } from "../../src/Graph/Graph.shared.ts"
 *
 * const sorted = sortRawEdgeEntries([
 *   { index: 1, source: 0, target: 1, data: "b" },
 *   { index: 0, source: 1, target: 0, data: "a" }
 * ])
 * console.log(sorted.map((edge) => edge.index))
 * ```
 *
 * @category symbols
 * @since 0.0.0
 */
export const sortRawEdgeEntries = <Edge>(
  edges: RawGraphEncoded<never, Edge>["edges"]
): RawGraphEncoded<never, Edge>["edges"] => A.sort(edgeEntryOrder)(edges);

/** @internal */
/**
 * Converts an Effect `Graph.Edge` value into its raw encoded shape.
 *
 * **Example** (Encoding one edge)
 *
 * ```ts
 * import { Graph } from "effect"
 * import { toRawEdgeEncoded } from "../../src/Graph/Graph.shared.ts"
 *
 * const edge: Graph.Edge<string> = { source: 0, target: 1, data: "knows" }
 * const raw = toRawEdgeEncoded(edge)
 * console.log(raw.data)
 * ```
 *
 * @category symbols
 * @since 0.0.0
 */
export const toRawEdgeEncoded = <Data>(edge: Graph_.Edge<Data>): RawEdgeEncoded<Data> => ({
  source: edge.source,
  target: edge.target,
  data: edge.data,
});

/** @internal */
/**
 * Converts an Effect `Graph.Graph` or `Graph.MutableGraph` into its raw encoded shape.
 *
 * **Example** (Encoding a whole graph)
 *
 * ```ts
 * import { Graph } from "effect"
 * import { toRawGraphEncoded } from "../../src/Graph/Graph.shared.ts"
 *
 * const graph = Graph.directed<string, string>((mutable) => {
 *   Graph.addNode(mutable, "Ada")
 * })
 * const raw = toRawGraphEncoded(graph)
 * console.log(raw.nodes.length)
 * ```
 *
 * @category symbols
 * @since 0.0.0
 */
export const toRawGraphEncoded = <Node, Edge, Kind extends GraphKindValue>(
  graph: Graph_.Graph<Node, Edge, Kind> | Graph_.MutableGraph<Node, Edge, Kind>
): RawGraphEncoded<Node, Edge, Kind> => ({
  _tag: "Graph",
  type: graph.type,
  nodes: pipe(
    graph,
    Graph_.nodes,
    Graph_.entries,
    A.fromIterable,
    A.map(([index, node]): readonly [number, Node] => [index, node]),
    A.sort(nodeEntryOrder)
  ),
  edges: pipe(
    graph,
    Graph_.edges,
    Graph_.entries,
    A.fromIterable,
    A.map(([index, edge]) => ({
      index,
      source: edge.source,
      target: edge.target,
      data: edge.data,
    })),
    A.sort(edgeEntryOrder)
  ),
});

/** @internal */
/**
 * Renders a graph as a human-readable `Graph.<kind>({ nodes: [...], edges: [...] })` string.
 *
 * **Example** (Formatting a graph)
 *
 * ```ts
 * import { Graph } from "effect"
 * import { formatGraph } from "../../src/Graph/Graph.shared.ts"
 *
 * const graph = Graph.directed<string, number>((mutable) => {
 *   Graph.addNode(mutable, "Ada")
 * })
 * console.log(formatGraph(graph, { formatNode: (node) => node, formatEdge: (edge) => String(edge) }))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatGraph: {
  <Node, Edge, Kind extends GraphKindValue>(
    graph: Graph_.Graph<Node, Edge, Kind> | Graph_.MutableGraph<Node, Edge, Kind>,
    options: {
      readonly formatNode: (node: Node) => string;
      readonly formatEdge: (edge: Edge) => string;
    }
  ): string;
  <Node, Edge, Kind extends GraphKindValue>(options: {
    readonly formatNode: (node: Node) => string;
    readonly formatEdge: (edge: Edge) => string;
  }): (graph: Graph_.Graph<Node, Edge, Kind> | Graph_.MutableGraph<Node, Edge, Kind>) => string;
} = dual(
  2,
  <Node, Edge, Kind extends GraphKindValue>(
    graph: Graph_.Graph<Node, Edge, Kind> | Graph_.MutableGraph<Node, Edge, Kind>,
    options: {
      readonly formatNode: (node: Node) => string;
      readonly formatEdge: (edge: Edge) => string;
    }
  ): string => {
    const encoded = toRawGraphEncoded(graph);
    const nodes = pipe(
      encoded.nodes,
      A.map(([index, node]) => `[${index}, ${options.formatNode(node)}]`),
      A.join(", ")
    );
    const edges = pipe(
      encoded.edges,
      A.map(({ index, source, target, data }) => `[${index}, Edge(${source}, ${target}, ${options.formatEdge(data)})]`),
      A.join(", ")
    );

    return `Graph.${encoded.type}({ nodes: [${nodes}], edges: [${edges}] })`;
  }
);

/**
 * Either graph representation accepted by {@link makeGraphEquivalence}.
 */
type GraphValue<Node, Edge> =
  | Graph_.Graph<Node, Edge, GraphKindValue>
  | Graph_.MutableGraph<Node, Edge, GraphKindValue>;

/**
 * Structural equivalence between two graphs.
 *
 * Named (rather than spelled inline) so the pipeable-signature analysis can
 * relate the data-first and data-last returns of {@link makeGraphEquivalence}.
 */
type GraphEquivalence<Node, Edge> = (self: GraphValue<Node, Edge>, that: GraphValue<Node, Edge>) => boolean;

/** @internal */
/**
 * Builds a structural equivalence for two graphs given per-node and per-edge equivalences.
 *
 * **Example** (Comparing two graphs)
 *
 * ```ts
 * import { Graph } from "effect"
 * import { makeGraphEquivalence } from "../../src/Graph/Graph.shared.ts"
 *
 * const equivalent = makeGraphEquivalence<string, number>(
 *   (self, that) => self === that,
 *   (self, that) => self === that
 * )
 * const a = Graph.directed<string, number>((mutable) => {
 *   Graph.addNode(mutable, "Ada")
 * })
 * console.log(equivalent(a, a))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeGraphEquivalence: {
  <Edge>(
    edgeEquivalence: (self: Edge, that: Edge) => boolean
  ): <Node>(nodeEquivalence: (self: Node, that: Node) => boolean) => GraphEquivalence<Node, Edge>;
  <Node, Edge>(
    nodeEquivalence: (self: Node, that: Node) => boolean,
    edgeEquivalence: (self: Edge, that: Edge) => boolean
  ): GraphEquivalence<Node, Edge>;
} = dual(
  2,
  <Node, Edge>(
    nodeEquivalence: (self: Node, that: Node) => boolean,
    edgeEquivalence: (self: Edge, that: Edge) => boolean
  ): GraphEquivalence<Node, Edge> =>
    (self: GraphValue<Node, Edge>, that: GraphValue<Node, Edge>): boolean => {
      const selfEncoded = toRawGraphEncoded(self);
      const thatEncoded = toRawGraphEncoded(that);

      if (
        selfEncoded.type !== thatEncoded.type ||
        selfEncoded.nodes.length !== thatEncoded.nodes.length ||
        selfEncoded.edges.length !== thatEncoded.edges.length
      ) {
        return false;
      }

      for (const [index, selfNode] of selfEncoded.nodes.entries()) {
        const thatNode = thatEncoded.nodes[index];

        if (thatNode === undefined) {
          return false;
        }

        if (selfNode[0] !== thatNode[0] || !nodeEquivalence(selfNode[1], thatNode[1])) {
          return false;
        }
      }

      for (const [index, selfEdge] of selfEncoded.edges.entries()) {
        const thatEdge = thatEncoded.edges[index];

        if (thatEdge === undefined) {
          return false;
        }

        if (
          selfEdge.index !== thatEdge.index ||
          selfEdge.source !== thatEdge.source ||
          selfEdge.target !== thatEdge.target ||
          !edgeEquivalence(selfEdge.data, thatEdge.data)
        ) {
          return false;
        }
      }

      return true;
    }
);

/** @internal */
/**
 * Type guard for immutable (non-mutable) Effect `Graph.Graph` values.
 *
 * **Example** (Guarding an immutable graph)
 *
 * ```ts
 * import { Graph } from "effect"
 * import { isImmutableGraphValue } from "../../src/Graph/Graph.shared.ts"
 *
 * const graph = Graph.directed<string, number>()
 * console.log(isImmutableGraphValue(graph))
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isImmutableGraphValue = <Node, Edge>(value: unknown): value is Graph_.Graph<Node, Edge, GraphKindValue> =>
  P.isObject(value) && P.hasProperty("mutable")(value) && value.mutable === false && Graph_.isGraph(value);

/** @internal */
/**
 * Type guard for mutable Effect `Graph.MutableGraph` values.
 *
 * **Example** (Guarding a mutable graph)
 *
 * ```ts
 * import { Graph } from "effect"
 * import { isMutableGraphValue } from "../../src/Graph/Graph.shared.ts"
 *
 * const mutable = Graph.beginMutation(Graph.directed<string, number>())
 * console.log(isMutableGraphValue(mutable))
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isMutableGraphValue = <Node, Edge>(
  value: unknown
): value is Graph_.MutableGraph<Node, Edge, GraphKindValue> =>
  P.isObject(value) && P.hasProperty("mutable")(value) && value.mutable === true && Graph_.isGraph(value);

/** @internal */
/**
 * Trims leading and trailing whitespace from a graph description string.
 *
 * **Example** (Trimming a description)
 *
 * ```ts
 * import { trimGraphDescription } from "../../src/Graph/Graph.shared.ts"
 *
 * console.log(trimGraphDescription("  a graph  "))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const trimGraphDescription = (value: string): string => Str.trim(value);
