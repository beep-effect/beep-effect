/**
 * EffectGraph - a categorical approach to text processing as graph transformations.
 *
 * Models text processing as morphisms in a category where objects are nodes in a
 * directed acyclic graph and morphisms are operations that transform nodes
 * (potentially creating children). Composition preserves the DAG property.
 *
 * Theoretical foundations: catamorphism (bottom-up fold), F-algebra (`F a -> a`),
 * and structure-preserving operation composition. Built on Effect's in-core
 * `effect/Graph` module.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * - `makeNode`/`singleton`/`ana` are EFFECTFUL (read `Clock` for the timestamp and an
 *   `effect/Random`-based id generator) instead of calling `Date.now()` +
 *   `crypto.randomUUID()` inline, both of which are repo-law violations.
 * - `NodeId` is a `Brand.nominal` branded string (no `as`).
 * - native keyed/set collections become `MutableHashMap`/`MutableHashSet`; native
 *   array methods become `effect/Array`; partial `getOrThrow`/`!` become `Option` handling.
 * - `Data.TaggedError` becomes `S.TaggedError` from `@beep/schema`.
 * - the terminal `Formatter` (which depended on the dropped `@effect/printer`) is gone;
 *   `show` renders the plain-text tree.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import { A, thunk0 } from "@beep/utils";
import { Clock, Effect, Graph, HashMap, MutableHashMap, MutableHashSet, Random } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $NlpProcessingId.create("Graph/EffectGraph");

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * Branded identifier for graph nodes.
 *
 * **Example** (Making a branded NodeId)
 *
 * ```ts import.meta.vitest name="Making a branded NodeId"
 * import { NodeId } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const nodeId = NodeId.make("node-example")
 * nodeId.startsWith("node-") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NodeId = S.String.pipe(
  S.brand("NodeId"),
  $I.annoteSchema("NodeId", {
    description: "Unique identifier for graph nodes.",
  })
);

/**
 * Companion type for {@link NodeId}.
 *
 * **Example** (Using companion NodeId type)
 *
 * ```ts
 * import { NodeId } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const nodeId = NodeId.make("node-example")
 * console.log(nodeId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NodeId = typeof NodeId.Type;

/**
 * Generate a fresh node id from the Effect clock and random service.
 *
 * **Example** (Generating a fresh NodeId)
 *
 * ```ts import.meta.vitest name="Generating a fresh NodeId"
 * import { Effect } from "effect"
 * import { generateNodeId } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const program = Effect.map(generateNodeId, (id) => id.startsWith("node-"))
 * Effect.runSync(program) // => true
 * ```
 *
 * @effects Reads the Effect `Clock` and random service to include timestamp and entropy in the generated id.
 * @category constructors
 * @since 0.0.0
 */
export const generateNodeId: Effect.Effect<NodeId> = Effect.gen(function* () {
  const ms = yield* Clock.currentTimeMillis;
  const rand = yield* Random.nextInt;
  return NodeId.make(`node-${ms}-${rand}`);
});

/**
 * Error raised when traversal cannot resolve a node id.
 *
 * **Example** (Creating NodeNotFoundError)
 *
 * ```ts import.meta.vitest name="Creating NodeNotFoundError"
 * import { NodeId, NodeNotFoundError } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const error = NodeNotFoundError.make({ nodeId: NodeId.make("node-missing") })
 * error._tag // => "NodeNotFoundError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class NodeNotFoundError extends S.TaggedError<NodeNotFoundError>($I`NodeNotFoundError`)(
  "NodeNotFoundError",
  {
    nodeId: NodeId,
  },
  $I.annoteError<NodeNotFoundError>("NodeNotFoundError", {
    description: "Raised when a graph node id cannot be resolved during traversal.",
  })
) {}

/**
 * Per-node metadata recorded by graph constructors and operations.
 *
 * **Example** (Building NodeMetadata values)
 *
 * ```ts import.meta.vitest name="Building NodeMetadata values"
 * import { NonNegativeInt } from "@beep/schema"
 * import { NodeMetadata } from "@beep/nlp-processing/Graph/EffectGraph"
 * import * as O from "effect/Option"
 *
 * const metadata = NodeMetadata.make({
 *   depth: NonNegativeInt.make(0),
 *   operation: O.none(),
 *   timestamp: 0
 * })
 *
 * metadata.depth // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NodeMetadata extends S.Class<NodeMetadata>($I`NodeMetadata`)(
  {
    depth: NonNegativeInt,
    operation: S.Option(S.String),
    timestamp: S.Finite,
  },
  $I.annote("NodeMetadata", {
    description: "Metadata associated with each graph node, tracking traversal depth, operation, and timestamp.",
  })
) {}

/**
 * Node payload plus graph lineage metadata.
 *
 * **Details**
 *
 * `parentId` points to the source node that produced this node. `metadata.depth`
 * is recalculated by {@link addNode} when a parent exists, so callers can create
 * nodes before they know their final graph depth.
 *
 * **Example** (Creating a GraphNode)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { makeNode, type GraphNode } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const node: GraphNode<string> = Effect.runSync(makeNode("root"))
 * console.log(node.data) // "root"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface GraphNode<A> {
  readonly data: A;
  readonly id: NodeId;
  readonly metadata: NodeMetadata;
  readonly parentId: O.Option<NodeId>;
}

/**
 * Directed child edge between two graph nodes.
 *
 * **Example** (Making a GraphEdge)
 *
 * ```ts import.meta.vitest name="Making a GraphEdge"
 * import { GraphEdge } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const edge = GraphEdge.make({ relation: "child" })
 * edge.relation // => "child"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraphEdge extends S.Class<GraphEdge>($I`GraphEdge`)(
  {
    relation: S.Literal("child"),
  },
  $I.annote("GraphEdge", {
    description: "Represents a directed edge in the graph, indicating a 'child' relationship.",
  })
) {}

/**
 * NLP operation graph backed by `effect/Graph` plus node-id index maps.
 *
 * **Details**
 *
 * Callers should use {@link addNode}, {@link getNode}, and traversal helpers
 * rather than mutating the backing graph directly; the side maps are what let
 * operation code address nodes by stable {@link NodeId}s.
 *
 * **Example** (Creating empty EffectGraph)
 *
 * ```ts
 * import { empty, size, type EffectGraph } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const graph: EffectGraph<string> = empty()
 * console.log(size(graph)) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface EffectGraph<A> {
  readonly graph: Graph.DirectedGraph<GraphNode<A>, GraphEdge>;
  readonly indexToNodeId: HashMap.HashMap<Graph.NodeIndex, NodeId>;
  readonly nodeIdToIndex: HashMap.HashMap<NodeId, Graph.NodeIndex>;
}

// =============================================================================
// Constructors
// =============================================================================

/**
 * Create a graph node with generated id, timestamp, parent, and operation metadata.
 *
 * **Example** (Creating node with makeNode)
 *
 * ```ts import.meta.vitest name="Creating node with makeNode"
 * import { Effect } from "effect"
 * import { makeNode } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const node = Effect.runSync(makeNode("hello"))
 * node.data // => "hello"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeNode: {
  <A>(data: A, parentId?: O.Option<NodeId>, operation?: O.Option<string>): Effect.Effect<GraphNode<A>>;
  (parentId?: O.Option<NodeId>, operation?: O.Option<string>): <A>(data: A) => Effect.Effect<GraphNode<A>>;
} = dual(
  // Data-first only at full arity or when the first argument is the data
  // itself; the curried form passes two `Option`s, so an arity-2 call whose
  // first argument is an `Option` is `(parentId, operation)`, not `(data, parentId)`.
  (args) => args.length >= 3 || !O.isOption(args[0]),
  Effect.fn("makeNode")(function* <A>(
    data: A,
    parentId: O.Option<NodeId> = O.none(),
    operation: O.Option<string> = O.none()
  ): Effect.fn.Return<GraphNode<A>> {
    const timestamp = yield* Clock.currentTimeMillis;
    const id = yield* generateNodeId;
    return {
      id,
      data,
      parentId,
      metadata: {
        operation,
        timestamp,
        // recalculated when added to a graph under a parent
        depth: NonNegativeInt.make(O.match(parentId, { onNone: thunk0, onSome: () => 1 })),
      },
    };
  })
);

/**
 * Create an empty graph with no nodes, edges, or id-index mappings.
 *
 * **Example** (Creating an empty graph)
 *
 * ```ts
 * import { empty, size } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const graph = empty<string>()
 * console.log(size(graph)) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const empty = <A>(): EffectGraph<A> => ({
  graph: Graph.directed<GraphNode<A>, GraphEdge>(),
  nodeIdToIndex: HashMap.empty(),
  indexToNodeId: HashMap.empty(),
});

/**
 * Create a graph containing one generated root node.
 *
 * **Example** (Creating a singleton graph)
 *
 * ```ts import.meta.vitest name="Creating a singleton graph"
 * import { Effect } from "effect"
 * import { singleton, size } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const graph = Effect.runSync(singleton("root"))
 * size(graph) // => 1
 * ```
 *
 * @effects Generates a root node via `makeNode`, which reads the Effect `Clock` and random service for metadata and id fields.
 * @category constructors
 * @since 0.0.0
 */
export const singleton = Effect.fn("singleton")(function* <A>(data: A): Effect.fn.Return<EffectGraph<A>> {
  const node = yield* makeNode(data);
  let nodeIndex: O.Option<Graph.NodeIndex> = O.none();
  const graph = Graph.directed<GraphNode<A>, GraphEdge>((mutable) => {
    nodeIndex = O.some(Graph.addNode(mutable, node));
  });
  return O.match(nodeIndex, {
    onNone: empty<A>,
    onSome: (idx) => ({
      graph,
      nodeIdToIndex: HashMap.make([node.id, idx]),
      indexToNodeId: HashMap.make([idx, node.id]),
    }),
  });
});

// =============================================================================
// Graph Operations
// =============================================================================

/**
 * Add a node to the graph, recalculating its depth from its parent and linking
 * the parent-\>child edge when a parent is present.
 *
 * **Example** (Adding a child node)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { addNode, getRoots, makeNode, singleton } from "@beep/nlp-processing/Graph/EffectGraph"
 * import * as O from "effect/Option"
 *
 * const program = Effect.gen(function* () {
 *   const graph = yield* singleton("root")
 *   const root = getRoots(graph)[0]
 *   const child = yield* makeNode("child", O.some(root.id))
 *   return addNode(graph, child)
 * })
 *
 * console.log(Effect.runSync(program).nodeIdToIndex)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const addNode: {
  <A>(effectGraph: EffectGraph<A>, node: GraphNode<A>): EffectGraph<A>;
  <A>(node: GraphNode<A>): (effectGraph: EffectGraph<A>) => EffectGraph<A>;
} = dual(2, <A>(effectGraph: EffectGraph<A>, node: GraphNode<A>): EffectGraph<A> => {
  // Recalculate depth from the parent (pure: takes a pre-made node).
  const updatedNode: GraphNode<A> = O.match(node.parentId, {
    onNone: () => node,
    onSome: (parentId) => {
      const parentNode = O.flatMap(HashMap.get(effectGraph.nodeIdToIndex, parentId), (idx) =>
        Graph.getNode(effectGraph.graph, idx)
      );
      const parentDepth = O.getOrElse(
        O.map(parentNode, (p) => p.metadata.depth),
        thunk0
      );
      return { ...node, metadata: { ...node.metadata, depth: NonNegativeInt.make(parentDepth + 1) } };
    },
  });

  let newNodeIndex: O.Option<Graph.NodeIndex> = O.none();
  const newGraph = Graph.mutate(effectGraph.graph, (mutable) => {
    const nodeIndex = Graph.addNode(mutable, updatedNode);
    newNodeIndex = O.some(nodeIndex);
    if (O.isSome(node.parentId)) {
      const parentIndex = HashMap.get(effectGraph.nodeIdToIndex, node.parentId.value);
      if (O.isSome(parentIndex)) {
        Graph.addEdge(mutable, parentIndex.value, nodeIndex, GraphEdge.make({ relation: "child" }));
      }
    }
  });

  return O.match(newNodeIndex, {
    onNone: () => effectGraph,
    onSome: (idx) => ({
      graph: newGraph,
      nodeIdToIndex: HashMap.set(effectGraph.nodeIdToIndex, updatedNode.id, idx),
      indexToNodeId: HashMap.set(effectGraph.indexToNodeId, idx, updatedNode.id),
    }),
  });
});

/**
 * Look up a node by stable node id.
 *
 * **Example** (Looking up node by id)
 *
 * ```ts import.meta.vitest name="Looking up node by id"
 * import { Effect } from "effect"
 * import { getNode, getRoots, singleton } from "@beep/nlp-processing/Graph/EffectGraph"
 * import * as O from "effect/Option"
 *
 * const program = Effect.map(singleton("root"), (graph) => {
 *   const root = getRoots(graph)[0]
 *   return O.isSome(getNode(graph, root.id))
 * })
 *
 * Effect.runSync(program) // => true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getNode: {
  <A>(graph: EffectGraph<A>, nodeId: NodeId): O.Option<GraphNode<A>>;
  <A>(nodeId: NodeId): (graph: EffectGraph<A>) => O.Option<GraphNode<A>>;
} = dual(
  2,
  <A>(graph: EffectGraph<A>, nodeId: NodeId): O.Option<GraphNode<A>> =>
    O.flatMap(HashMap.get(graph.nodeIdToIndex, nodeId), (idx) => Graph.getNode(graph.graph, idx))
);

/**
 * Read the direct child nodes for a parent id.
 *
 * **Example** (Reading direct child nodes)
 *
 * ```ts import.meta.vitest name="Reading direct child nodes"
 * import { Effect } from "effect"
 * import { getChildren, getRoots, singleton } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const program = Effect.map(singleton("root"), (graph) => {
 *   const root = getRoots(graph)[0]
 *   return getChildren(graph, root.id).length
 * })
 *
 * Effect.runSync(program) // => 0
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getChildren: {
  <A>(graph: EffectGraph<A>, nodeId: NodeId): ReadonlyArray<GraphNode<A>>;
  <A>(nodeId: NodeId): (graph: EffectGraph<A>) => ReadonlyArray<GraphNode<A>>;
} = dual(
  2,
  <A>(graph: EffectGraph<A>, nodeId: NodeId): ReadonlyArray<GraphNode<A>> =>
    O.match(HashMap.get(graph.nodeIdToIndex, nodeId), {
      onNone: A.empty<GraphNode<A>>,
      onSome: (idx) =>
        A.getSomes(A.map(Graph.neighbors(graph.graph, idx), (childIdx) => Graph.getNode(graph.graph, childIdx))),
    })
);

/**
 * Get all root nodes, defined as nodes with no incoming parent edge.
 *
 * **Example** (Getting root nodes)
 *
 * ```ts import.meta.vitest name="Getting root nodes"
 * import { Effect } from "effect"
 * import { getRoots, singleton } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const program = Effect.map(singleton("root"), (graph) => getRoots(graph).length)
 * Effect.runSync(program) // => 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getRoots = <A>(graph: EffectGraph<A>): ReadonlyArray<GraphNode<A>> =>
  A.getSomes(
    A.map(A.fromIterable(Graph.indices(Graph.externals(graph.graph, { direction: "incoming" }))), (idx) =>
      Graph.getNode(graph.graph, idx)
    )
  );

// =============================================================================
// Catamorphism / Anamorphism
// =============================================================================

/**
 * Algebra used by {@link cata} to collapse a node after its children.
 *
 * **Example** (Defining count-subtree algebra)
 *
 * ```ts
 * import type { GraphAlgebra } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const countSubtree: GraphAlgebra<string, number> = (_node, children) =>
 *   1 + children.reduce((sum, count) => sum + count, 0)
 *
 * console.log(countSubtree)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GraphAlgebra<A, B> = (node: GraphNode<A>, children: ReadonlyArray<B>) => B;

/**
 * Fold a graph bottom-up, visiting children before their parents.
 *
 * **Details**
 *
 * Results are returned once per root, so a forest produces multiple folded
 * values. Traversal memoizes by node id to avoid recomputing shared subgraphs.
 *
 * **Example** (Folding graph with cata)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { cata, singleton } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const program = Effect.flatMap(
 *   singleton("root"),
 *   cata((node, children: ReadonlyArray<number>) => node.data.length + children.length)
 * )
 *
 * console.log(Effect.runSync(program)) // [4]
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const cata: {
  <A, B>(graph: EffectGraph<A>, algebra: GraphAlgebra<A, B>): Effect.Effect<ReadonlyArray<B>, NodeNotFoundError>;
  <A, B>(algebra: GraphAlgebra<A, B>): (graph: EffectGraph<A>) => Effect.Effect<ReadonlyArray<B>, NodeNotFoundError>;
} = dual(
  2,
  <A, B>(graph: EffectGraph<A>, algebra: GraphAlgebra<A, B>): Effect.Effect<ReadonlyArray<B>, NodeNotFoundError> => {
    const memo = MutableHashMap.empty<NodeId, B>();

    const go = Effect.fnUntraced(function* (nodeId: NodeId): Effect.fn.Return<B, NodeNotFoundError> {
      const cached = MutableHashMap.get(memo, nodeId);
      if (O.isSome(cached)) {
        return cached.value;
      }
      const node = yield* Effect.fromOption(getNode(graph, nodeId), () => NodeNotFoundError.make({ nodeId }));
      // children first (bottom-up); sequential to bound memory on deep graphs
      const processedChildren = yield* Effect.all(
        A.map(getChildren(graph, nodeId), (child) => go(child.id)),
        { concurrency: 1 }
      );
      const result = algebra(node, processedChildren);
      MutableHashMap.set(memo, nodeId, result);
      return result;
    });

    return Effect.all(
      A.map(getRoots(graph), (root) => go(root.id)),
      { concurrency: 1 }
    );
  }
);

/**
 * Coalgebra used by {@link ana} to unfold a seed into node data and child seeds.
 *
 * **Example** (Countdown coalgebra expansion)
 *
 * ```ts
 * import { Effect } from "effect"
 * import type { GraphCoalgebra } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const countdown: GraphCoalgebra<number, number> = (n) =>
 *   Effect.succeed([n, n > 0 ? [n - 1] : []])
 *
 * const [value, children] = Effect.runSync(countdown(2))
 * console.log(`${value}:${children.length}`) // "2:1"
 * ```
 *
 * @effects Implementations return an `Effect` for each seed expansion; callers such as `ana` sequence those effects while unfolding the graph.
 * @category models
 * @since 0.0.0
 */
export type GraphCoalgebra<A, B> = (seed: B) => Effect.Effect<readonly [A, ReadonlyArray<B>]>;

/**
 * Unfold a seed into a graph by recursively producing child seeds.
 *
 * **Example** (Unfolding seed into graph)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ana, size } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const program = Effect.map(
 *   ana(2, (n) => Effect.succeed([n, n > 0 ? [n - 1] : []])),
 *   size
 * )
 *
 * console.log(Effect.runSync(program)) // 3
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const ana: {
  <A, B>(seed: B, coalgebra: GraphCoalgebra<A, B>): Effect.Effect<EffectGraph<A>, NodeNotFoundError>;
  <A, B>(coalgebra: GraphCoalgebra<A, B>): (seed: B) => Effect.Effect<EffectGraph<A>, NodeNotFoundError>;
} = dual(2, function* <A, B>(seed: B, coalgebra: GraphCoalgebra<A, B>): Effect.fn.Return<EffectGraph<A>> {
  let graph = empty<A>();

  const go = Effect.fnUntraced(function* (currentSeed: B, parentId: O.Option<NodeId>): Effect.fn.Return<NodeId> {
    const [data, childSeeds] = yield* coalgebra(currentSeed);
    const node = yield* makeNode(data, parentId);
    graph = addNode(graph, node);
    yield* Effect.all(
      A.map(childSeeds, (childSeed) => go(childSeed, O.some(node.id))),
      { concurrency: 1 }
    );
    return node.id;
  });

  yield* go(seed, O.none());
  return graph;
});

// =============================================================================
// Functor / utilities
// =============================================================================

/**
 * Map every node payload while preserving ids, metadata, and edge structure.
 *
 * **Example** (Mapping node payload values)
 *
 * ```ts import.meta.vitest name="Mapping node payload values"
 * import { Effect } from "effect"
 * import { map, singleton, toArray } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const program = Effect.map(singleton("root"), (graph) =>
 *   toArray(map(graph, (text) => text.length))[0].data
 * )
 *
 * Effect.runSync(program) // => 4
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const map: {
  <A, B>(graph: EffectGraph<A>, f: (a: A) => B): EffectGraph<B>;
  <A, B>(f: (a: A) => B): (graph: EffectGraph<A>) => EffectGraph<B>;
} = dual(2, <A, B>(graph: EffectGraph<A>, f: (a: A) => B): EffectGraph<B> => {
  const nodeMap = MutableHashMap.empty<NodeId, Graph.NodeIndex>();
  const indexMap = MutableHashMap.empty<Graph.NodeIndex, Graph.NodeIndex>();

  const newGraph = Graph.directed<GraphNode<B>, GraphEdge>((mutable) => {
    // map node data, tracking the id/index remapping
    for (const [oldIdx, node] of Graph.nodes(graph.graph)) {
      const mappedNode: GraphNode<B> = { ...node, data: f(node.data) };
      const newIdx = Graph.addNode(mutable, mappedNode);
      MutableHashMap.set(nodeMap, node.id, newIdx);
      MutableHashMap.set(indexMap, oldIdx, newIdx);
    }
    // re-link edges using the new indices
    for (const edgeIdx of Graph.indices(graph.graph.pipe(Graph.edges))) {
      O.match(Graph.getEdge(graph.graph, edgeIdx), {
        onNone: () => {},
        onSome: (edge) => {
          const from = MutableHashMap.get(indexMap, edge.source);
          const to = MutableHashMap.get(indexMap, edge.target);
          if (O.isSome(from) && O.isSome(to)) {
            Graph.addEdge(mutable, from.value, to.value, GraphEdge.make({ relation: "child" }));
          }
        },
      });
    }
  });

  const entries = A.fromIterable(nodeMap);
  return {
    graph: newGraph,
    nodeIdToIndex: HashMap.fromIterable(A.map(entries, ([id, idx]) => [id, idx] as const)),
    indexToNodeId: HashMap.fromIterable(A.map(entries, ([id, idx]) => [idx, id] as const)),
  };
});

/**
 * Collect all graph nodes in the backing graph's node order.
 *
 * **Example** (Collecting nodes as array)
 *
 * ```ts import.meta.vitest name="Collecting nodes as array"
 * import { Effect } from "effect"
 * import { singleton, toArray } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const program = Effect.map(singleton("root"), (graph) => toArray(graph).length)
 * Effect.runSync(program) // => 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const toArray = <A>(graph: EffectGraph<A>): ReadonlyArray<GraphNode<A>> =>
  A.fromIterable(graph.graph.pipe(Graph.nodes, Graph.values));

/**
 * Count graph nodes.
 *
 * **Example** (Counting empty graph nodes)
 *
 * ```ts
 * import { empty, size } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * console.log(size(empty<string>())) // 0
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const size = <A>(graph: EffectGraph<A>): number => Graph.nodeCount(graph.graph);

/**
 * Render roots and descendants as an indented plain-text tree.
 *
 * **Details**
 *
 * Each line includes the operation metadata in brackets. Nodes already visited
 * are skipped, which prevents repeated output for shared descendants.
 *
 * **Example** (Rendering graph as tree)
 *
 * ```ts import.meta.vitest name="Rendering graph as tree"
 * import { Effect } from "effect"
 * import { show, singleton } from "@beep/nlp-processing/Graph/EffectGraph"
 *
 * const program = Effect.map(singleton("root"), show((text) => text))
 * Effect.runSync(program) // => "[root] root"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const show: {
  <A>(graph: EffectGraph<A>, showData: (a: A) => string): string;
  <A>(showData: (a: A) => string): (graph: EffectGraph<A>) => string;
} = dual(2, <A>(graph: EffectGraph<A>, showData: (a: A) => string): string => {
  const lines = A.empty<string>();
  const visited = MutableHashSet.empty<NodeId>();

  const visit = (nodeId: NodeId, indent: number): void => {
    if (MutableHashSet.has(visited, nodeId)) return;
    MutableHashSet.add(visited, nodeId);
    O.match(getNode(graph, nodeId), {
      onNone: R.empty,
      onSome: (node) => {
        const op = O.getOrElse(node.metadata.operation, () => "root");
        lines.push(`${"  ".repeat(indent)}[${op}] ${showData(node.data)}`);
        for (const child of getChildren(graph, nodeId)) {
          visit(child.id, indent + 1);
        }
      },
    });
  };

  for (const root of getRoots(graph)) {
    visit(root.id, 0);
  }
  return A.join(lines, "\n");
});
