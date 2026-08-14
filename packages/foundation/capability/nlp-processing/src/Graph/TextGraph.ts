/**
 * TextGraph - text processing over Effect's in-core `effect/Graph`.
 *
 * Builds and manipulates directed graphs of {@link TextNode} data linked by
 * {@link TextEdge} relationships, integrating with the package's
 * {@link Tokenization} service for sentence/token extraction.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * - node-creating constructors (`singleton`/`fromDocument`/`tokenizeNodes`) are
 *   EFFECTFUL, reading `Clock` for the node timestamp (was `Date.now()`).
 * - `fromDocument`/`tokenizeNodes` consume the existing `Core/Tokenization` service
 *   (mapping `Sentence.text` / `Token.text`).
 * - `addChildren` fails with a tagged {@link GraphCycleError} instead of `throw`.
 * - native `Array.from`/`forEach` become `effect/Array`; the `@effect/printer`
 *   formatter is dropped (`show` renders plain text).
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { TextEdge, TextNode } from "@beep/nlp/Graph/Schema";
import { A, O as OptionUtils, P } from "@beep/utils";
import { Clock, Effect, Graph, MutableHashMap, MutableHashSet } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tok from "../Core/Tokenization.ts";
import * as Obs from "../internal/observability.ts";

const $I = $NlpProcessingId.create("Graph/TextGraph");

/**
 * A text-processing graph: `TextNode` data with `TextEdge` relationships.
 *
 * **Example** (Empty graph node count)
 *
 * ```ts
 * import { empty, nodeCount, type TextGraph } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * const graph: TextGraph = empty()
 * console.log(nodeCount(graph)) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TextGraph = Graph.DirectedGraph<TextNode, TextEdge>;

/**
 * Mutable text graph used inside construction callbacks.
 *
 * **Example** (Accept MutableTextGraph parameter)
 *
 * ```ts
 * import type { MutableTextGraph } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * const acceptsMutable = (graph: MutableTextGraph) => graph
 * console.log(acceptsMutable)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MutableTextGraph = Graph.MutableDirectedGraph<TextNode, TextEdge>;

/**
 * Raised when adding children would introduce a cycle (graphs must stay acyclic).
 *
 * **Example** (Make GraphCycleError instance)
 *
 * ```ts
 * import { GraphCycleError } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * const error = GraphCycleError.make({ parentIndex: 0 })
 * console.log(error._tag) // "GraphCycleError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GraphCycleError extends S.TaggedError<GraphCycleError>($I`GraphCycleError`)(
  "GraphCycleError",
  {
    parentIndex: S.Finite,
  },
  $I.annote("GraphCycleError", {
    description: "Raised when a text-graph mutation would create a cycle.",
  })
) {}

const makeTextNode = (fields: {
  readonly text: string;
  readonly type: TextNode["type"];
  readonly operation?: string;
}): Effect.Effect<TextNode> =>
  Effect.map(Clock.currentTimeMillis, (timestamp) =>
    TextNode.make({
      text: fields.text,
      type: fields.type,
      timestamp,
      ...OptionUtils.getSomesStruct({ operation: O.fromUndefinedOr(fields.operation) }),
    })
  );

// =============================================================================
// Constructors
// =============================================================================

/**
 * Create an empty structural text graph.
 *
 * **Example** (Empty graph zero nodes)
 *
 * ```ts
 * import { empty, nodeCount } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * console.log(nodeCount(empty())) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const empty = (): TextGraph => Graph.directed<TextNode, TextEdge>();

/**
 * Create a text graph with one generated root node.
 *
 * **Example** (Create singleton document graph)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { nodeCount, singleton } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * const graph = Effect.runSync(singleton("Hello.", "document"))
 * console.log(nodeCount(graph)) // 1
 * ```
 *
 * @effects Builds the root text node through `makeTextNode`, which reads the Effect `Clock` for the node timestamp.
 * @category constructors
 * @since 0.0.0
 */
export const singleton: {
  (text: string, type: TextNode["type"]): Effect.Effect<TextGraph>;
  (type: TextNode["type"]): (text: string) => Effect.Effect<TextGraph>;
} = dual(
  2,
  (text: string, type: TextNode["type"]): Effect.Effect<TextGraph> =>
    Effect.map(makeTextNode({ text, type }), (node) =>
      Graph.directed<TextNode, TextEdge>((mutable) => {
        Graph.addNode(mutable, node);
      })
    )
);

/**
 * Build a document graph by splitting the root text into sentence children.
 *
 * **Details**
 *
 * The returned effect requires the package tokenization service. Sentence
 * children are connected to the document root with `contains` edges.
 *
 * **Example** (Document with sentence children)
 *
 * ```ts
 * import { Chunk, Effect } from "effect"
 * import * as O from "effect/Option"
 * import { Document as NLPDocument, DocumentId } from "@beep/nlp/Core/Document"
 * import { Sentence, SentenceIndex } from "@beep/nlp/Core/Sentence"
 * import { TokenIndex } from "@beep/nlp/Core/Token"
 * import { Tokenization } from "@beep/nlp-processing/Core/Tokenization"
 * import { fromDocument, nodeCount } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * const sentence = (text: string, index: number) =>
 *   Sentence.make({
 *     text,
 *     index: SentenceIndex.make(index),
 *     tokens: Chunk.empty(),
 *     start: TokenIndex.make(0),
 *     end: TokenIndex.make(0),
 *     sentiment: O.none(),
 *     importance: O.none(),
 *     negationFlag: O.none(),
 *     markedUpText: O.none()
 *   })
 *
 * const graph = Effect.runSync(
 *   Effect.provideService(fromDocument("One. Two."), Tokenization, {
 *     sentences: () => Effect.succeed([sentence("One.", 0), sentence("Two.", 1)]),
 *     tokenize: () => Effect.succeed([]),
 *     document: (text) =>
 *       Effect.succeed(
 *         NLPDocument.make({
 *           id: DocumentId.make("doc-example"),
 *           text,
 *           tokens: Chunk.empty(),
 *           sentences: Chunk.empty(),
 *           sentiment: O.none()
 *         })
 *       ),
 *     tokenCount: () => Effect.succeed(0)
 *   })
 * )
 *
 * console.log(nodeCount(graph)) // 3
 * ```
 *
 * @effects Reads the `Tokenization` service to split the document into sentences and reads the Effect `Clock` while creating graph nodes.
 * @category constructors
 * @since 0.0.0
 */
export const fromDocument = Effect.fn("fromDocument")(function* (
  text: string
): Effect.fn.Return<TextGraph, Tok.TokenizationError, Tok.Tokenization> {
  const attributes = {
    document_length: `${text.length}`,
    operation: "fromDocument",
  };
  return yield* Effect.gen(function* () {
    const sentenceModels = yield* Tok.sentences(text);
    const docNode = yield* makeTextNode({
      text,
      type: "document",
      operation: "root",
    });
    const sentenceNodes = yield* Effect.forEach(sentenceModels, (sentence) =>
      makeTextNode({
        text: sentence.text,
        type: "sentence",
        operation: "sentencize",
      })
    );
    const graph = Graph.directed<TextNode, TextEdge>((mutable) => {
      const docIndex = Graph.addNode(mutable, docNode);
      A.forEach(sentenceNodes, (sentenceNode) => {
        const sentenceIndex = Graph.addNode(mutable, sentenceNode);
        Graph.addEdge(mutable, docIndex, sentenceIndex, TextEdge.make({ relation: "contains" }));
      });
    });
    yield* Obs.annotateNlpSpan({
      ...attributes,
      node_count: `${Graph.nodeCount(graph)}`,
      sentence_count: `${A.length(sentenceModels)}`,
    });
    return graph;
  }).pipe(Obs.observeNlpWorkflow("nlp.text_graph.from_document", attributes));
});

// =============================================================================
// Graph Operations
// =============================================================================

/**
 * Add child nodes under a parent, validating the result stays acyclic.
 *
 * **Example** (Add child under root)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { addChildren, getRoots, nodeCount, singleton } from "@beep/nlp-processing/Graph/TextGraph"
 * import { TextNode } from "@beep/nlp/Graph/Schema"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const program = Effect.flatMap(singleton("Hello.", "document"), (graph) =>
 *   O.match(A.head(getRoots(graph)), {
 *     onNone: () => Effect.succeed(graph),
 *     onSome: (root) =>
 *       addChildren(graph, {
 *         parentIndex: root,
 *         children: [TextNode.make({ text: "Hello.", type: "sentence", timestamp: 0 })],
 *         relation: "contains"
 *       })
 *   })
 * )
 *
 * console.log(nodeCount(Effect.runSync(program))) // 2
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const addChildren: {
  (
    graph: TextGraph,
    options: {
      readonly parentIndex: Graph.NodeIndex;
      readonly children: ReadonlyArray<TextNode>;
      readonly relation: TextEdge["relation"];
    }
  ): Effect.Effect<TextGraph, GraphCycleError>;
  (options: {
    readonly parentIndex: Graph.NodeIndex;
    readonly children: ReadonlyArray<TextNode>;
    readonly relation: TextEdge["relation"];
  }): (graph: TextGraph) => Effect.Effect<TextGraph, GraphCycleError>;
} = dual(
  2,
  (
    graph: TextGraph,
    {
      children,
      parentIndex,
      relation,
    }: {
      readonly parentIndex: Graph.NodeIndex;
      readonly children: ReadonlyArray<TextNode>;
      readonly relation: TextEdge["relation"];
    }
  ): Effect.Effect<TextGraph, GraphCycleError> => {
    const candidate = Graph.mutate(graph, (mutable) => {
      A.forEach(children, (child) => {
        const childIndex = Graph.addNode(mutable, child);
        Graph.addEdge(mutable, parentIndex, childIndex, TextEdge.make({ relation }));
      });
    });
    return Graph.isAcyclic(candidate) ? Effect.succeed(candidate) : Effect.fail(GraphCycleError.make({ parentIndex }));
  }
);

/**
 * Tokenize every sentence node, adding token children (idempotent: skips
 * sentences that already have token children).
 *
 * **Details**
 *
 * The effect requires the tokenization service. Existing token children prevent
 * duplicate tokenization for a sentence node, so callers can safely retry this
 * pass.
 *
 * **Example** (Tokenize sentence into tokens)
 *
 * ```ts
 * import { Chunk, Effect } from "effect"
 * import * as O from "effect/Option"
 * import { Document as NLPDocument, DocumentId } from "@beep/nlp/Core/Document"
 * import { CharPosition, Token, TokenIndex } from "@beep/nlp/Core/Token"
 * import { Tokenization } from "@beep/nlp-processing/Core/Tokenization"
 * import { nodeCount, singleton, tokenizeNodes } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * const token = (text: string, index: number, start: number, end: number) =>
 *   Token.make({
 *     text,
 *     index: TokenIndex.make(index),
 *     start: CharPosition.make(start),
 *     end: CharPosition.make(end),
 *     pos: O.none(),
 *     lemma: O.none(),
 *     stem: O.none(),
 *     normal: O.none(),
 *     shape: O.none(),
 *     prefix: O.none(),
 *     suffix: O.none(),
 *     case: O.none(),
 *     uniqueId: O.none(),
 *     abbrevFlag: O.none(),
 *     contractionFlag: O.none(),
 *     stopWordFlag: O.none(),
 *     negationFlag: O.none(),
 *     precedingSpaces: O.none(),
 *     tags: []
 *   })
 *
 * const graph = Effect.runSync(
 *   Effect.provideService(Effect.flatMap(singleton("Hello world.", "sentence"), tokenizeNodes), Tokenization, {
 *     tokenize: () => Effect.succeed([token("Hello", 0, 0, 5), token("world", 1, 6, 11)]),
 *     sentences: () => Effect.succeed([]),
 *     document: (text) =>
 *       Effect.succeed(
 *         NLPDocument.make({
 *           id: DocumentId.make("doc-example"),
 *           text,
 *           tokens: Chunk.empty(),
 *           sentences: Chunk.empty(),
 *           sentiment: O.none()
 *         })
 *       ),
 *     tokenCount: () => Effect.succeed(2)
 *   })
 * )
 *
 * console.log(nodeCount(graph)) // 3
 * ```
 *
 * @effects Reads the `Tokenization` service for sentence tokens and reads the Effect `Clock` while adding token nodes.
 * @category combinators
 * @since 0.0.0
 */
export const tokenizeNodes = Effect.fn("tokenizeNodes")(function* (
  graph: TextGraph
): Effect.fn.Return<TextGraph, Tok.TokenizationError, Tok.Tokenization> {
  const attributes = {
    input_node_count: `${Graph.nodeCount(graph)}`,
    operation: "tokenizeNodes",
  };
  return yield* Effect.gen(function* () {
    let result = graph;
    let skippedSentenceCount = 0;
    let tokenCount = 0;

    const sentenceEntries = A.getSomes(
      A.map(A.fromIterable(graph.pipe(Graph.nodes, Graph.indices)), (idx) =>
        O.flatMap(Graph.getNode(graph, idx), (node) =>
          node.type === "sentence"
            ? O.some({
                idx,
                node,
              })
            : O.none()
        )
      )
    );

    for (const { idx, node } of sentenceEntries) {
      const alreadyTokenized = A.some(getChildren(result, idx), (childIdx) =>
        O.match(Graph.getNode(result, childIdx), {
          onNone: () => false,
          onSome: (childNode) => childNode.type === "token",
        })
      );
      if (alreadyTokenized) {
        skippedSentenceCount = skippedSentenceCount + 1;
        continue;
      }

      const tokens = yield* Tok.tokenize(node.text);
      tokenCount = tokenCount + A.length(tokens);
      const tokenNodes = yield* Effect.forEach(tokens, (token) =>
        makeTextNode({ text: token.text, type: "token", operation: "tokenize" })
      );
      result = Graph.mutate(result, (mutable) => {
        A.forEach(tokenNodes, (tokenNode) => {
          const tokenIndex = Graph.addNode(mutable, tokenNode);
          Graph.addEdge(mutable, idx, tokenIndex, TextEdge.make({ relation: "contains" }));
        });
      });
    }

    yield* Obs.annotateNlpSpan({
      ...attributes,
      output_node_count: `${Graph.nodeCount(result)}`,
      sentence_count: `${A.length(sentenceEntries)}`,
      skipped_sentence_count: `${skippedSentenceCount}`,
      token_count: `${tokenCount}`,
    });
    return result;
  }).pipe(Obs.observeNlpWorkflow("nlp.text_graph.tokenize_nodes", attributes));
});

const rebuild = (
  graph: TextGraph,
  keep: (node: TextNode) => boolean,
  transform: (node: TextNode) => TextNode
): TextGraph => {
  const indexMap = MutableHashMap.empty<Graph.NodeIndex, Graph.NodeIndex>();
  return Graph.directed<TextNode, TextEdge>((mutable) => {
    for (const [oldIdx, node] of Graph.nodes(graph)) {
      if (keep(node)) {
        MutableHashMap.set(indexMap, oldIdx, Graph.addNode(mutable, transform(node)));
      }
    }
    for (const edgeIdx of Graph.indices(graph.pipe(Graph.edges))) {
      O.match(Graph.getEdge(graph, edgeIdx), {
        onNone: () => {},
        onSome: (edge) => {
          const from = MutableHashMap.get(indexMap, edge.source);
          const to = MutableHashMap.get(indexMap, edge.target);
          if (O.isSome(from) && O.isSome(to)) {
            Graph.addEdge(mutable, from.value, to.value, edge.data);
          }
        },
      });
    }
  });
};

/**
 * Map every text node while preserving edges between retained nodes.
 *
 * **Example** (Map nodes to uppercase)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { mapNodes, singleton, toArray } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * const graph = Effect.runSync(singleton("Hello.", "document"))
 * const mapped = mapNodes(graph, (node) => ({ ...node, text: node.text.toUpperCase() }))
 *
 * console.log(toArray(mapped)[0]?.text) // "HELLO."
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const mapNodes: {
  (graph: TextGraph, f: (node: TextNode) => TextNode): TextGraph;
  (f: (node: TextNode) => TextNode): (graph: TextGraph) => TextGraph;
} = dual(2, (graph: TextGraph, f: (node: TextNode) => TextNode): TextGraph => rebuild(graph, () => true, f));

/**
 * Keep matching text nodes and edges whose endpoints both remain.
 *
 * **Example** (Filter nodes by type)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { filterNodes, nodeCount, singleton } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * const graph = Effect.runSync(singleton("Hello.", "document"))
 * console.log(nodeCount(filterNodes(graph, (node) => node.type === "document"))) // 1
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const filterNodes: {
  (graph: TextGraph, predicate: (node: TextNode) => boolean): TextGraph;
  (predicate: (node: TextNode) => boolean): (graph: TextGraph) => TextGraph;
} = dual(
  2,
  (graph: TextGraph, predicate: (node: TextNode) => boolean): TextGraph => rebuild(graph, predicate, (node) => node)
);

// =============================================================================
// Traversal
// =============================================================================

/**
 * Walkers take an optional `start` list, so arity alone cannot decide the call
 * style. A `TextGraph` is never an array, which makes the subject decidable.
 */
const isTraversalDataFirst = (args: IArguments): boolean =>
  args.length >= 2 || (args.length === 1 && P.isNotUndefined(args[0]) && !A.isArray(args[0]));

/**
 * Create a depth-first walker over text nodes.
 *
 * **Example** (Depth-first walk values)
 *
 * ```ts
 * import { Effect, Graph } from "effect"
 * import { dfs, singleton } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * const graph = Effect.runSync(singleton("Hello.", "document"))
 * console.log(Array.from(Graph.values(dfs(graph))).length) // 1
 * ```
 *
 * @category sequencing
 * @since 0.0.0
 */
export const dfs: {
  (graph: TextGraph, start?: ReadonlyArray<Graph.NodeIndex>): Graph.NodeWalker<TextNode>;
  (start?: ReadonlyArray<Graph.NodeIndex>): (graph: TextGraph) => Graph.NodeWalker<TextNode>;
} = dual(
  isTraversalDataFirst,
  (graph: TextGraph, start?: ReadonlyArray<Graph.NodeIndex>): Graph.NodeWalker<TextNode> =>
    Graph.dfs(graph, start !== undefined ? { start: A.fromIterable(start) } : undefined)
);

/**
 * Create a breadth-first walker over text nodes.
 *
 * **Example** (Breadth-first walk values)
 *
 * ```ts
 * import { Effect, Graph } from "effect"
 * import { bfs, singleton } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * const graph = Effect.runSync(singleton("Hello.", "document"))
 * console.log(Array.from(Graph.values(bfs(graph))).length) // 1
 * ```
 *
 * @category sequencing
 * @since 0.0.0
 */
export const bfs: {
  (graph: TextGraph, start?: ReadonlyArray<Graph.NodeIndex>): Graph.NodeWalker<TextNode>;
  (start?: ReadonlyArray<Graph.NodeIndex>): (graph: TextGraph) => Graph.NodeWalker<TextNode>;
} = dual(
  isTraversalDataFirst,
  (graph: TextGraph, start?: ReadonlyArray<Graph.NodeIndex>): Graph.NodeWalker<TextNode> =>
    Graph.bfs(graph, start !== undefined ? { start: A.fromIterable(start) } : undefined)
);

/**
 * Create a topological walker where parents precede children.
 *
 * **Example** (Topological walk values)
 *
 * ```ts
 * import { Effect, Graph } from "effect"
 * import { singleton, topo } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * const graph = Effect.runSync(singleton("Hello.", "document"))
 * console.log(Array.from(Graph.values(topo(graph))).length) // 1
 * ```
 *
 * @category sequencing
 * @since 0.0.0
 */
export const topo = (graph: TextGraph): Graph.NodeWalker<TextNode> => Graph.topo(graph);

/**
 * Collect all text nodes in backing graph order.
 *
 * **Example** (Collect nodes into array)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { singleton, toArray } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * console.log(toArray(Effect.runSync(singleton("Hello.", "document"))).length) // 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const toArray = (graph: TextGraph): ReadonlyArray<TextNode> =>
  A.fromIterable(graph.pipe(Graph.nodes, Graph.values));

// =============================================================================
// Queries
// =============================================================================

/**
 * Count nodes in a text graph.
 *
 * **Example** (Count nodes in empty)
 *
 * ```ts
 * import { empty, nodeCount } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * console.log(nodeCount(empty())) // 0
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const nodeCount = (graph: TextGraph): number => Graph.nodeCount(graph);

/**
 * Count edges in a text graph.
 *
 * **Example** (Count edges in empty)
 *
 * ```ts
 * import { empty, edgeCount } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * console.log(edgeCount(empty())) // 0
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const edgeCount = (graph: TextGraph): number => Graph.edgeCount(graph);

/**
 * Find node indices whose `type` matches a structural text-node kind.
 *
 * **Example** (Find nodes by document type)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { findNodesByType, singleton } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * const graph = Effect.runSync(singleton("Hello.", "document"))
 * console.log(findNodesByType(graph, "document").length) // 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const findNodesByType: {
  (graph: TextGraph, type: TextNode["type"]): ReadonlyArray<Graph.NodeIndex>;
  (type: TextNode["type"]): (graph: TextGraph) => ReadonlyArray<Graph.NodeIndex>;
} = dual(
  2,
  (graph: TextGraph, type: TextNode["type"]): ReadonlyArray<Graph.NodeIndex> =>
    Graph.findNodes(graph, (node) => node.type === type)
);

/**
 * Return text-graph roots, defined as nodes with no incoming edges.
 *
 * **Example** (Get roots of singleton)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { getRoots, singleton } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * console.log(getRoots(Effect.runSync(singleton("Hello.", "document"))).length) // 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getRoots = (graph: TextGraph): ReadonlyArray<Graph.NodeIndex> =>
  A.fromIterable(Graph.indices(Graph.externals(graph, { direction: "incoming" })));

/**
 * Return text-graph leaves, defined as nodes with no outgoing edges.
 *
 * **Example** (Get leaves of singleton)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { getLeaves, singleton } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * console.log(getLeaves(Effect.runSync(singleton("Hello.", "document"))).length) // 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getLeaves = (graph: TextGraph): ReadonlyArray<Graph.NodeIndex> =>
  A.fromIterable(Graph.indices(Graph.externals(graph, { direction: "outgoing" })));

/**
 * Return direct child indices for a text node.
 *
 * **Example** (Children of document root)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { getChildren, getRoots, singleton } from "@beep/nlp-processing/Graph/TextGraph"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const graph = Effect.runSync(singleton("Hello.", "document"))
 * const childCount = O.match(A.head(getRoots(graph)), {
 *   onNone: () => 0,
 *   onSome: (root) => getChildren(graph, root).length
 * })
 *
 * console.log(childCount) // 0
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getChildren: {
  (graph: TextGraph, nodeIndex: Graph.NodeIndex): ReadonlyArray<Graph.NodeIndex>;
  (nodeIndex: Graph.NodeIndex): (graph: TextGraph) => ReadonlyArray<Graph.NodeIndex>;
} = dual(
  2,
  (graph: TextGraph, nodeIndex: Graph.NodeIndex): ReadonlyArray<Graph.NodeIndex> => Graph.neighbors(graph, nodeIndex)
);

// =============================================================================
// Visualization & algorithms
// =============================================================================

/**
 * Export the text graph to GraphViz DOT format.
 *
 * **Example** (Export empty to GraphViz)
 *
 * ```ts
 * import { empty, toGraphViz } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * console.log(toGraphViz(empty()).includes("TextProcessingGraph")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const toGraphViz = (graph: TextGraph): string =>
  Graph.toGraphViz(graph, {
    nodeLabel: (node) => `${node.type}: ${node.text.slice(0, 30)}...`,
    edgeLabel: (edge) => edge.relation,
    graphName: "TextProcessingGraph",
  });

/**
 * Export the text graph to a Mermaid diagram.
 *
 * **Example** (Export empty to Mermaid)
 *
 * ```ts
 * import { empty, toMermaid } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * console.log(toMermaid(empty()).includes("graph")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const toMermaid = (graph: TextGraph): string =>
  Graph.toMermaid(graph, {
    nodeLabel: (node) => `${node.type}: ${node.text.slice(0, 20)}`,
    edgeLabel: (edge) => edge.relation,
    direction: "TB",
    nodeShape: (node) =>
      TextNode.match(node, {
        document: (): Graph.MermaidNodeShape => "rounded",
        paragraph: (): Graph.MermaidNodeShape => "rectangle",
        sentence: (): Graph.MermaidNodeShape => "rectangle",
        token: (): Graph.MermaidNodeShape => "circle",
      }),
  });

/**
 * Render the graph as an indented tree from roots downward.
 *
 * **Gotchas**
 *
 * `TextGraph` is a raw `effect/Graph.DirectedGraph` alias, so callers can supply
 * graphs containing cycles that bypass {@link addChildren}'s acyclicity check.
 * Each node index is rendered at most once (tracked via a visited set), which
 * prevents unbounded recursion / stack overflow on root-reachable cycles and
 * avoids repeated output for shared descendants.
 *
 * **Example** (Show singleton tree string)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { show, singleton } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * console.log(show(Effect.runSync(singleton("Hello.", "document")))) // "[node] document: Hello."
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const show = (graph: TextGraph): string => {
  const lines = A.empty<string>();
  const visited = MutableHashSet.empty<Graph.NodeIndex>();
  const visit = (nodeIndex: Graph.NodeIndex, indent: number): void => {
    if (MutableHashSet.has(visited, nodeIndex)) return;
    MutableHashSet.add(visited, nodeIndex);
    O.match(Graph.getNode(graph, nodeIndex), {
      onNone: () => {},
      onSome: (node) => {
        const op = node.operation ?? "node";
        lines.push(`${"  ".repeat(indent)}[${op}] ${node.type}: ${node.text.slice(0, 40)}`);
        A.forEach(getChildren(graph, nodeIndex), (childIdx) => visit(childIdx, indent + 1));
      },
    });
  };
  A.forEach(getRoots(graph), (rootIdx) => visit(rootIdx, 0));
  return A.join(lines, "\n");
};

/**
 * Check whether the text graph is acyclic.
 *
 * **Example** (Check empty graph acyclic)
 *
 * ```ts
 * import { empty, isAcyclic } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * console.log(isAcyclic(empty())) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isAcyclic = (graph: TextGraph): boolean => Graph.isAcyclic(graph);

/**
 * Compute strongly connected components as node-index groups.
 *
 * **Example** (SCCs of empty graph)
 *
 * ```ts
 * import { empty, stronglyConnectedComponents } from "@beep/nlp-processing/Graph/TextGraph"
 *
 * console.log(stronglyConnectedComponents(empty()).length) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const stronglyConnectedComponents = (graph: TextGraph): ReadonlyArray<ReadonlyArray<Graph.NodeIndex>> =>
  Graph.stronglyConnectedComponents(graph);
