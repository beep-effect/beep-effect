/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Graph as Graph_ } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import {
  makeGraphConstructionIssue,
  makeInvalidGraphIssue,
  sortRawEdgeEntries,
  sortRawNodeEntries,
} from "./Graph.shared.ts";
import type { SchemaIssue } from "effect";
import type { GraphEncoded } from "./Graph.encoded.ts";
import type { GraphKindValue } from "./Graph.shared.ts";

const populateMutableGraph = Effect.fn("Schema.Graph.populateMutableGraph")(function* <
  Node,
  Edge,
  Kind extends GraphKindValue,
>(
  mutable: Graph_.MutableGraph<Node, Edge, Kind>,
  encoded: GraphEncoded<Node, Edge, Kind>
): Effect.fn.Return<Graph_.MutableGraph<Node, Edge, Kind>, SchemaIssue.Issue> {
  for (const [expectedIndex, node] of sortRawNodeEntries(encoded.nodes)) {
    const receivedIndex = Graph_.addNode(mutable, node);

    if (receivedIndex !== expectedIndex) {
      return yield* Effect.fail(
        makeGraphConstructionIssue({ entity: "node", expected: expectedIndex, received: receivedIndex })
      );
    }
  }

  for (const { index, source, target, data } of sortRawEdgeEntries(encoded.edges)) {
    const receivedIndex = yield* Effect.try({
      try: () => Graph_.addEdge(mutable, source, target, data),
      catch: (cause) => makeInvalidGraphIssue(P.isError(cause) ? cause.message : "Failed to construct graph edge"),
    });

    if (receivedIndex !== index) {
      return yield* Effect.fail(
        makeGraphConstructionIssue({ entity: "edge", expected: index, received: receivedIndex })
      );
    }
  }

  return mutable;
});

/** @internal */
/**
 * Reconstructs an immutable Effect `Graph.Graph` from an encoded graph payload,
 * failing when node/edge indices do not match the expected insertion order.
 *
 * **Example** (Rebuilding an immutable graph)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { GraphEncoded } from "@beep/schema/Graph"
 * import { rebuildImmutableGraph } from "../../src/Graph/Graph.rebuild.ts"
 *
 * const Encoded = GraphEncoded(S.String, S.String)
 * const encoded = S.decodeUnknownSync(Encoded)({
 *   _tag: "Graph",
 *   type: "directed",
 *   nodes: [[0, "Ada"]],
 *   edges: []
 * })
 * const program = rebuildImmutableGraph(encoded, {})
 * const graph = Effect.runSync(program)
 * console.log(graph.type)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const rebuildImmutableGraph: {
  <Node, Edge>(
    encoded: GraphEncoded<Node, Edge>,
    options: { readonly expectedType?: GraphKindValue | undefined }
  ): Effect.Effect<Graph_.Graph<Node, Edge, GraphKindValue>, SchemaIssue.Issue>;
  (options: {
    readonly expectedType?: GraphKindValue | undefined;
  }): <Node, Edge>(
    encoded: GraphEncoded<Node, Edge>
  ) => Effect.Effect<Graph_.Graph<Node, Edge, GraphKindValue>, SchemaIssue.Issue>;
} = dual(
  2,
  <Node, Edge>(
    encoded: GraphEncoded<Node, Edge>,
    options: { readonly expectedType?: GraphKindValue | undefined }
  ): Effect.Effect<Graph_.Graph<Node, Edge, GraphKindValue>, SchemaIssue.Issue> => {
    const { expectedType } = options;
    if (expectedType !== undefined && encoded.type !== expectedType) {
      return Effect.fail(makeInvalidGraphIssue(`Expected ${expectedType} graph, got ${encoded.type}`));
    }

    if (encoded.type === "directed") {
      return Effect.map(
        populateMutableGraph(Graph_.beginMutation(Graph_.directed<Node, Edge>()), encoded),
        Graph_.endMutation
      );
    }

    return Effect.map(
      populateMutableGraph(Graph_.beginMutation(Graph_.undirected<Node, Edge>()), encoded),
      Graph_.endMutation
    );
  }
);

/** @internal */
/**
 * Reconstructs a mutable Effect `Graph.MutableGraph` from an encoded graph payload,
 * failing when node/edge indices do not match the expected insertion order.
 *
 * **Example** (Rebuilding a mutable graph)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { GraphEncoded } from "@beep/schema/Graph"
 * import { rebuildMutableGraph } from "../../src/Graph/Graph.rebuild.ts"
 *
 * const Encoded = GraphEncoded(S.String, S.String)
 * const encoded = S.decodeUnknownSync(Encoded)({
 *   _tag: "Graph",
 *   type: "directed",
 *   nodes: [[0, "Ada"]],
 *   edges: []
 * })
 * const program = rebuildMutableGraph(encoded, {})
 * const graph = Effect.runSync(program)
 * console.log(graph.type)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const rebuildMutableGraph: {
  <Node, Edge>(
    encoded: GraphEncoded<Node, Edge>,
    options: { readonly expectedType?: GraphKindValue | undefined }
  ): Effect.Effect<Graph_.MutableGraph<Node, Edge, GraphKindValue>, SchemaIssue.Issue>;
  (options: {
    readonly expectedType?: GraphKindValue | undefined;
  }): <Node, Edge>(
    encoded: GraphEncoded<Node, Edge>
  ) => Effect.Effect<Graph_.MutableGraph<Node, Edge, GraphKindValue>, SchemaIssue.Issue>;
} = dual(
  2,
  <Node, Edge>(
    encoded: GraphEncoded<Node, Edge>,
    options: { readonly expectedType?: GraphKindValue | undefined }
  ): Effect.Effect<Graph_.MutableGraph<Node, Edge, GraphKindValue>, SchemaIssue.Issue> =>
    Effect.map(rebuildImmutableGraph(encoded, options), Graph_.beginMutation)
);
