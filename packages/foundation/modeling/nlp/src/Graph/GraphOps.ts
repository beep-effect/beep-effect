/**
 * GraphOps - generic categorical operations over `effect/Graph` directed graphs.
 *
 * Structure-preserving and structure-querying operations with mathematical
 * foundations: functorial `mapNodes`/`mapEdges`/`bimap`, monoidal folds,
 * indexed search, effectful traversals, and streaming for large graphs. Graphs
 * form a category whose morphisms are structure-preserving maps; functors
 * preserve identity and composition; the index/query pair supports lookup by
 * derived keys.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * - type-changing `mapNodes`/`mapEdges`/`bimap`/`mapNodesEffect` RECONSTRUCT the
 *   graph with an old→new index remap because v4's in-place `Graph.mapNodes`
 *   cannot change the node type.
 * - native keyed/set collections become `HashMap`/`HashSet` (and `MutableHashMap`
 *   for the local index remap); `Array#push`/`forEach`/`!` become `effect/Array` + folds.
 * - `merge` remaps and copies the second graph's edges.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { A, O, thunkTrue } from "@beep/utils";
import { Effect, Graph, HashMap, HashSet, MutableHashMap, Stream } from "effect";
import { dual, identity } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $NlpId.create("Graph/GraphOps");

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Alias for Effect's directed graph type used by generic graph utilities.
 *
 * **Example** (Empty graph node count)
 *
 * ```ts
 * import { empty, nodeCount, type DirectedGraph } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph: DirectedGraph<string, string> = empty()
 * console.log(nodeCount(graph)) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DirectedGraph<A, E> = Graph.DirectedGraph<A, E>;

/**
 * Stable node index allocated by the backing `effect/Graph`.
 *
 * **Example** (Root node index option)
 *
 * ```ts
 * import { getRoots, singleton, type NodeIndex } from "@beep/nlp/Graph/GraphOps"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const firstRoot: O.Option<NodeIndex> = A.head(getRoots(singleton<string, string>("root")))
 * console.log(O.isSome(firstRoot)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NodeIndex = Graph.NodeIndex;

/**
 * Effect graph walker used for ordered graph traversals.
 *
 * **Example** (Type-level walker consumer)
 *
 * ```ts
 * import type { NodeWalker } from "@beep/nlp/Graph/GraphOps"
 *
 * const consume = <A>(walker: NodeWalker<A>) => walker
 * console.log(consume)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NodeWalker<A> = Graph.NodeWalker<A>;

/**
 * An immutable search index mapping search keys to node indices, paired with the
 * key-extraction function that produced it (the `index` side of `query ⊣ index`).
 *
 * **Example** (Build index key function)
 *
 * ```ts
 * import { buildIndex, singleton, type SearchIndex } from "@beep/nlp/Graph/GraphOps"
 *
 * const index: SearchIndex<string, string> = buildIndex(
 *   singleton<string, string>("Root"),
 *   (node) => [node.toLowerCase()]
 * )
 *
 * console.log(index.keyFn("Root")) // ["root"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface SearchIndex<K, A> {
  readonly index: HashMap.HashMap<K, ReadonlyArray<NodeIndex>>;
  readonly keyFn: (node: A) => ReadonlyArray<K>;
}

/**
 * Traversal order for ordered folds, walkers, streams, and batches.
 *
 * **Example** (Check dfs order predicate)
 *
 * ```ts
 * import { TraversalOrder } from "@beep/nlp/Graph/GraphOps"
 *
 * console.log(TraversalOrder.is.dfs("dfs")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TraversalOrder = LiteralKit(["dfs", "bfs", "topo"]).annotate(
  $I.annote("TraversalOrder", {
    description: "Graph traversal order for ordered folds and walkers.",
  })
);

/**
 * Runtime type for graph traversal order values.
 *
 * **Example** (Assign dfs traversal order)
 *
 * ```ts
 * import type { TraversalOrder } from "@beep/nlp/Graph/GraphOps"
 *
 * const order: TraversalOrder = "dfs"
 * console.log(order)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TraversalOrder = typeof TraversalOrder.Type;

const NodeIndexSchema = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("NodeIndexSchema", {
    description: "Stable node index allocated by the backing effect/Graph.",
  })
);

/**
 * Traversal-start options shared by graph-walking helpers: which node indices
 * to begin from and which traversal order to use.
 *
 * **Example** (Create dfs start options)
 *
 * ```ts
 * import { getRoots, singleton, TraversalStart } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = singleton<string, string>("root")
 * const options = new TraversalStart({ start: getRoots(graph), order: "dfs" })
 *
 * console.log(options.order)
 * // "dfs"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TraversalStart extends S.Class<TraversalStart>($I`TraversalStart`)(
  {
    start: S.Array(NodeIndexSchema),
    order: TraversalOrder,
  },
  $I.annote("TraversalStart", {
    description:
      "Traversal-start options shared by graph-walking helpers: which node indices to begin from and which traversal order to use.",
  })
) {}

// =============================================================================
// Internal: structural reconstruction with index remapping
// =============================================================================

const reconstruct = <A, E, B, F>(
  graph: DirectedGraph<A, E>,
  keepNode: (node: A, index: NodeIndex) => boolean,
  nodeF: (node: A, index: NodeIndex) => B,
  keepEdge: (edge: E) => boolean,
  edgeF: (edge: E) => F
): DirectedGraph<B, F> => {
  const indexMap = MutableHashMap.empty<NodeIndex, NodeIndex>();
  return Graph.directed<B, F>((mutable) => {
    for (const [oldIndex, node] of Graph.nodes(graph)) {
      if (keepNode(node, oldIndex)) {
        MutableHashMap.set(indexMap, oldIndex, Graph.addNode(mutable, nodeF(node, oldIndex)));
      }
    }
    for (const edgeIndex of Graph.indices(graph.pipe(Graph.edges))) {
      O.match(Graph.getEdge(graph, edgeIndex), {
        onNone: () => {},
        onSome: (edge) => {
          if (!keepEdge(edge.data)) return;
          const from = MutableHashMap.get(indexMap, edge.source);
          const to = MutableHashMap.get(indexMap, edge.target);
          if (O.isSome(from) && O.isSome(to)) {
            Graph.addEdge(mutable, from.value, to.value, edgeF(edge.data));
          }
        },
      });
    }
  });
};

const createWalker = <A, E>(
  graph: DirectedGraph<A, E>,
  start: ReadonlyArray<NodeIndex>,
  order: TraversalOrder
): NodeWalker<A> => {
  const options = A.length(start) > 0 ? { start: A.fromIterable(start) } : undefined;
  return TraversalOrder.$match(order, {
    bfs: () => Graph.bfs(graph, options),
    dfs: () => Graph.dfs(graph, options),
    topo: () => Graph.topo(graph),
  });
};

// =============================================================================
// Functorial Operations (Structure-Preserving Transformations)
// =============================================================================

/**
 * Map node data while preserving every surviving edge.
 *
 * **Gotchas**
 *
 * The graph is reconstructed because the backing `effect/Graph` node mapper
 * cannot change the node type in place. Node indices are reallocated in the
 * returned graph; use node payloads, not old indices, across this boundary.
 *
 * **Example** (Map nodes to lengths)
 *
 * ```ts
 * import { collectNodes, mapNodes, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = mapNodes(singleton<string, string>("root"), (node) => node.length)
 * console.log(collectNodes(graph)) // [4]
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const mapNodes: {
  <A, B, E>(graph: DirectedGraph<A, E>, f: (node: A) => B): DirectedGraph<B, E>;
  <A, B, E>(f: (node: A) => B): (graph: DirectedGraph<A, E>) => DirectedGraph<B, E>;
} = dual(
  2,
  <A, B, E>(graph: DirectedGraph<A, E>, f: (node: A) => B): DirectedGraph<B, E> =>
    reconstruct<A, E, B, E>(graph, thunkTrue, f, thunkTrue, identity)
);

/**
 * Map edge data while preserving node payloads and connectivity.
 *
 * **Example** (Map edges to uppercase)
 *
 * ```ts
 * import { edgeCount, mapEdges, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = mapEdges(singleton<string, string>("root"), (edge) => edge.toUpperCase())
 * console.log(edgeCount(graph)) // 0
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const mapEdges: {
  <A, E, F>(graph: DirectedGraph<A, E>, f: (edge: E) => F): DirectedGraph<A, F>;
  <A, E, F>(f: (edge: E) => F): (graph: DirectedGraph<A, E>) => DirectedGraph<A, F>;
} = dual(
  2,
  <A, E, F>(graph: DirectedGraph<A, E>, f: (edge: E) => F): DirectedGraph<A, F> =>
    reconstruct<A, E, A, F>(graph, thunkTrue, identity, thunkTrue, (edge) => f(edge))
);

/**
 * Map node and edge data in one reconstruction pass.
 *
 * **Example** (Bimap node and edge lengths)
 *
 * ```ts
 * import { bimap, collectNodes, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = bimap(
 *   singleton<string, string>("root"),
 *   (node) => node.length,
 *   (edge) => edge.length
 * )
 *
 * console.log(collectNodes(graph)) // [4]
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const bimap: {
  <A, B, E, F>(graph: DirectedGraph<A, E>, nodeF: (node: A) => B, edgeF: (edge: E) => F): DirectedGraph<B, F>;
  <A, B, E, F>(nodeF: (node: A) => B, edgeF: (edge: E) => F): (graph: DirectedGraph<A, E>) => DirectedGraph<B, F>;
} = dual(
  3,
  <A, B, E, F>(graph: DirectedGraph<A, E>, nodeF: (node: A) => B, edgeF: (edge: E) => F): DirectedGraph<B, F> =>
    reconstruct<A, E, B, F>(
      graph,
      thunkTrue,
      (node) => nodeF(node),
      thunkTrue,
      (edge) => edgeF(edge)
    )
);

// =============================================================================
// Filtering and Selection
// =============================================================================

/**
 * Keep matching nodes and remove edges touching dropped nodes.
 *
 * **Example** (Filter nodes by prefix)
 *
 * ```ts
 * import { filterNodes, nodeCount, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = filterNodes(singleton<string, string>("root"), (node) => node.startsWith("r"))
 * console.log(nodeCount(graph)) // 1
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const filterNodes: {
  <A, E>(graph: DirectedGraph<A, E>, predicate: (node: A) => boolean): DirectedGraph<A, E>;
  <A, E>(predicate: (node: A) => boolean): (graph: DirectedGraph<A, E>) => DirectedGraph<A, E>;
} = dual(
  2,
  <A, E>(graph: DirectedGraph<A, E>, predicate: (node: A) => boolean): DirectedGraph<A, E> =>
    reconstruct<A, E, A, E>(graph, (node) => predicate(node), identity, thunkTrue, identity)
);

/**
 * Keep matching edges while preserving all nodes.
 *
 * **Example** (Filter edges by label)
 *
 * ```ts
 * import { filterEdges, nodeCount, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = filterEdges(singleton<string, string>("root"), (edge) => edge === "contains")
 * console.log(nodeCount(graph)) // 1
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const filterEdges: {
  <A, E>(graph: DirectedGraph<A, E>, predicate: (edge: E) => boolean): DirectedGraph<A, E>;
  <A, E>(predicate: (edge: E) => boolean): (graph: DirectedGraph<A, E>) => DirectedGraph<A, E>;
} = dual(
  2,
  <A, E>(graph: DirectedGraph<A, E>, predicate: (edge: E) => boolean): DirectedGraph<A, E> =>
    reconstruct<A, E, A, E>(graph, thunkTrue, identity, (edge) => predicate(edge), identity)
);

/**
 * Find node indices whose payload matches a predicate.
 *
 * **Example** (Find matching node indices)
 *
 * ```ts
 * import { findNodes, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const indices = findNodes(singleton<string, string>("root"), (node) => node === "root")
 * console.log(indices.length) // 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const findNodes: {
  <A, E>(graph: DirectedGraph<A, E>, predicate: (node: A) => boolean): ReadonlyArray<NodeIndex>;
  <A, E>(predicate: (node: A) => boolean): (graph: DirectedGraph<A, E>) => ReadonlyArray<NodeIndex>;
} = dual(
  2,
  <A, E>(graph: DirectedGraph<A, E>, predicate: (node: A) => boolean): ReadonlyArray<NodeIndex> =>
    Graph.findNodes(graph, predicate)
);

// =============================================================================
// Folds and Aggregations (Monoid Homomorphisms)
// =============================================================================

/**
 * The accumulated result of a fold over an accumulator type `B`.
 *
 * **Details**
 *
 * `FoldResult<B>` distributes to `B` for every instantiation, so it denotes
 * exactly the accumulator type it is applied to. Spelling a fold's result
 * through it keeps the accumulator a deferred, named reference in both halves
 * of a data-first / data-last pair, which is what relates the two signatures.
 *
 * **Example** (Naming a fold result)
 *
 * ```ts
 * import type { FoldResult } from "@beep/nlp/Graph/GraphOps"
 *
 * const total: FoldResult<number> = 4
 * console.log(total) // 4
 * ```
 *
 * @since 0.0.0
 * @category type-level
 */
export type FoldResult<B> = B extends unknown ? B : never;

/**
 * Fold all node payloads in the backing graph's iteration order.
 *
 * **Example** (Fold node payload lengths)
 *
 * ```ts
 * import { foldNodes, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const total = foldNodes(singleton<string, string>("root"), 0, (sum, node) => sum + node.length)
 * console.log(total) // 4
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const foldNodes: {
  <A, E, B>(graph: DirectedGraph<A, E>, initial: B, f: (acc: B, node: A) => B): FoldResult<B>;
  <A, E, B>(initial: B, f: (acc: B, node: A) => B): (graph: DirectedGraph<A, E>) => FoldResult<B>;
} = dual(
  3,
  <A, E, B>(graph: DirectedGraph<A, E>, initial: B, f: (acc: B, node: A) => B): B =>
    A.reduce(A.fromIterable(graph.pipe(Graph.nodes, Graph.values)), initial, (acc, node) => f(acc, node))
);

/**
 * Fold node payloads in `dfs`, `bfs`, or topological traversal order.
 *
 * **Example** (Fold nodes in dfs order)
 *
 * ```ts
 * import { foldTraversal, getRoots, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = singleton<string, string>("root")
 * const total = foldTraversal(graph, { start: getRoots(graph), order: "dfs", initial: 0 }, (sum, node) => sum + node.length)
 * console.log(total) // 4
 * ```
 *
 * @category folding
 * @since 0.0.0
 */
export const foldTraversal: {
  <A, E, B>(
    graph: DirectedGraph<A, E>,
    options: TraversalStart & { readonly initial: B },
    f: (acc: B, node: A, index: NodeIndex) => B
  ): FoldResult<B>;
  <A, E, B>(
    options: TraversalStart & { readonly initial: B },
    f: (acc: B, node: A, index: NodeIndex) => B
  ): (graph: DirectedGraph<A, E>) => FoldResult<B>;
} = dual(
  3,
  <A, E, B>(
    graph: DirectedGraph<A, E>,
    options: TraversalStart & { readonly initial: B },
    f: (acc: B, node: A, index: NodeIndex) => B
  ): B =>
    A.reduce(
      A.fromIterable(Graph.entries(createWalker(graph, options.start, options.order))),
      options.initial,
      (acc, [index, node]) => f(acc, node, index)
    )
);

/**
 * Collect every node payload in the backing graph's iteration order.
 *
 * **Example** (Collect singleton node payloads)
 *
 * ```ts
 * import { collectNodes, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * console.log(collectNodes(singleton<string, string>("root"))) // ["root"]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const collectNodes = <A, E>(graph: DirectedGraph<A, E>): ReadonlyArray<A> =>
  A.fromIterable(graph.pipe(Graph.nodes, Graph.values));

/**
 * Collect node payloads in `dfs`, `bfs`, or topological traversal order.
 *
 * **Example** (Collect nodes in dfs order)
 *
 * ```ts
 * import { collectTraversal, getRoots, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = singleton<string, string>("root")
 * console.log(collectTraversal(graph, { start: getRoots(graph), order: "dfs" })) // ["root"]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const collectTraversal: {
  <A, E>(graph: DirectedGraph<A, E>, options: TraversalStart): ReadonlyArray<A>;
  <A, E>(options: TraversalStart): (graph: DirectedGraph<A, E>) => ReadonlyArray<A>;
} = dual(
  2,
  <A, E>(graph: DirectedGraph<A, E>, options: TraversalStart): ReadonlyArray<A> =>
    foldTraversal(graph, { start: options.start, order: options.order, initial: A.empty<A>() }, (acc, node) =>
      A.append(acc, node)
    )
);

// =============================================================================
// Traversal Utilities
// =============================================================================

/**
 * Return node indices with no incoming edges.
 *
 * **Example** (Count root node indices)
 *
 * ```ts
 * import { getRoots, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * console.log(getRoots(singleton<string, string>("root")).length) // 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getRoots = <A, E>(graph: DirectedGraph<A, E>): ReadonlyArray<NodeIndex> =>
  A.fromIterable(Graph.indices(Graph.externals(graph, { direction: "incoming" })));

/**
 * Return node indices with no outgoing edges.
 *
 * **Example** (Count leaf node indices)
 *
 * ```ts
 * import { getLeaves, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * console.log(getLeaves(singleton<string, string>("root")).length) // 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getLeaves = <A, E>(graph: DirectedGraph<A, E>): ReadonlyArray<NodeIndex> =>
  A.fromIterable(Graph.indices(Graph.externals(graph, { direction: "outgoing" })));

/**
 * Return direct outgoing neighbor indices for a node.
 *
 * **Example** (Get children of root)
 *
 * ```ts
 * import { getChildren, getRoots, singleton } from "@beep/nlp/Graph/GraphOps"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const graph = singleton<string, string>("root")
 * const children = O.match(A.head(getRoots(graph)), {
 *   onNone: () => [],
 *   onSome: (root) => getChildren(graph, root)
 * })
 *
 * console.log(children.length) // 0
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getChildren: {
  <A, E>(graph: DirectedGraph<A, E>, nodeIndex: NodeIndex): ReadonlyArray<NodeIndex>;
  <A, E>(nodeIndex: NodeIndex): (graph: DirectedGraph<A, E>) => ReadonlyArray<NodeIndex>;
} = dual(
  2,
  <A, E>(graph: DirectedGraph<A, E>, nodeIndex: NodeIndex): ReadonlyArray<NodeIndex> =>
    Graph.neighbors(graph, nodeIndex)
);

/**
 * Return node payload at an index, when the index exists.
 *
 * **Example** (Read root node payload)
 *
 * ```ts
 * import { getNode, getRoots, singleton } from "@beep/nlp/Graph/GraphOps"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const graph = singleton<string, string>("root")
 * const rootText = O.flatMap(A.head(getRoots(graph)), (root) => getNode(graph, root))
 *
 * console.log(O.getOrElse(rootText, () => "missing")) // "root"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getNode: {
  <A, E>(graph: DirectedGraph<A, E>, nodeIndex: NodeIndex): O.Option<A>;
  <A, E>(nodeIndex: NodeIndex): (graph: DirectedGraph<A, E>) => O.Option<A>;
} = dual(2, <A, E>(graph: DirectedGraph<A, E>, nodeIndex: NodeIndex): O.Option<A> => Graph.getNode(graph, nodeIndex));

// =============================================================================
// Search Operations (Adjoint Functors: Query ⊣ Index)
// =============================================================================

/**
 * Build a search index from keys extracted from each node payload.
 *
 * **Gotchas**
 *
 * A single node can contribute multiple keys. The stored node indices belong to
 * the indexed graph, so rebuild the index after reconstructing or merging graphs.
 *
 * **Example** (Build and query index)
 *
 * ```ts
 * import { buildIndex, queryIndex, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const index = buildIndex(singleton<string, string>("Root"), (node) => [node.toLowerCase()])
 * console.log(queryIndex(index, "root").length) // 1
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const buildIndex: {
  <A, E, K>(graph: DirectedGraph<A, E>, keyFn: (node: A) => ReadonlyArray<K>): SearchIndex<K, A>;
  <A, E, K>(keyFn: (node: A) => ReadonlyArray<K>): (graph: DirectedGraph<A, E>) => SearchIndex<K, A>;
} = dual(2, <A, E, K>(graph: DirectedGraph<A, E>, keyFn: (node: A) => ReadonlyArray<K>): SearchIndex<K, A> => {
  const index = A.reduce(
    A.fromIterable(graph.pipe(Graph.nodes, Graph.entries)),
    HashMap.empty<K, ReadonlyArray<NodeIndex>>(),
    (acc, [nodeIndex, node]) =>
      A.reduce(keyFn(node), acc, (map, key) =>
        HashMap.modifyAt(map, key, (existing) =>
          O.match(existing, {
            onNone: () => O.some(A.of(nodeIndex)),
            onSome: (indices) => O.some(A.append(indices, nodeIndex)),
          })
        )
      )
  );
  return { index, keyFn };
});

/**
 * Query a search index for one key.
 *
 * **Example** (Query missing index key)
 *
 * ```ts
 * import { buildIndex, queryIndex, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const index = buildIndex(singleton<string, string>("Root"), (node) => [node.toLowerCase()])
 * console.log(queryIndex(index, "missing").length) // 0
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const queryIndex: {
  <K, A>(searchIndex: SearchIndex<K, A>, key: K): ReadonlyArray<NodeIndex>;
  <K, A>(key: K): (searchIndex: SearchIndex<K, A>) => ReadonlyArray<NodeIndex>;
} = dual(
  2,
  <K, A>(searchIndex: SearchIndex<K, A>, key: K): ReadonlyArray<NodeIndex> =>
    O.getOrElse(HashMap.get(searchIndex.index, key), A.empty<NodeIndex>)
);

/**
 * Query a search index for any matching key, returning deduplicated indices.
 *
 * **Example** (Union query deduplicates)
 *
 * ```ts
 * import { buildIndex, queryIndexUnion, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const index = buildIndex(singleton<string, string>("Root"), (node) => [node, node.toLowerCase()])
 * console.log(queryIndexUnion(index, ["Root", "root"]).length) // 1
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const queryIndexUnion: {
  <K, A>(searchIndex: SearchIndex<K, A>, keys: ReadonlyArray<K>): ReadonlyArray<NodeIndex>;
  <K, A>(keys: ReadonlyArray<K>): (searchIndex: SearchIndex<K, A>) => ReadonlyArray<NodeIndex>;
} = dual(
  2,
  <K, A>(searchIndex: SearchIndex<K, A>, keys: ReadonlyArray<K>): ReadonlyArray<NodeIndex> =>
    A.fromIterable(
      A.reduce(keys, HashSet.empty<NodeIndex>(), (set, key) =>
        A.reduce(queryIndex(searchIndex, key), set, (acc, nodeIndex) => HashSet.add(acc, nodeIndex))
      )
    )
);

/**
 * Query a search index for indices present under every supplied key.
 *
 * **Example** (Intersection of index keys)
 *
 * ```ts
 * import { buildIndex, queryIndexIntersection, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const index = buildIndex(singleton<string, string>("Root"), (node) => [node, node.toLowerCase()])
 * console.log(queryIndexIntersection(index, ["Root", "root"]).length) // 1
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const queryIndexIntersection: {
  <K, A>(searchIndex: SearchIndex<K, A>, keys: ReadonlyArray<K>): ReadonlyArray<NodeIndex>;
  <K, A>(keys: ReadonlyArray<K>): (searchIndex: SearchIndex<K, A>) => ReadonlyArray<NodeIndex>;
} = dual(
  2,
  <K, A>(searchIndex: SearchIndex<K, A>, keys: ReadonlyArray<K>): ReadonlyArray<NodeIndex> =>
    O.match(A.head(keys), {
      onNone: A.empty<NodeIndex>,
      onSome: (firstKey) => {
        const firstResults = A.fromIterable(HashSet.fromIterable(queryIndex(searchIndex, firstKey)));
        const restSets = A.map(A.drop(keys, 1), (key) => HashSet.fromIterable(queryIndex(searchIndex, key)));
        return A.filter(firstResults, (nodeIndex) =>
          A.reduce(restSets, true, (ok, set) => ok && HashSet.has(set, nodeIndex))
        );
      },
    })
);

// =============================================================================
// Effect-Based Operations
// =============================================================================

/**
 * Traverse nodes in order, running one effect per visited node.
 *
 * **Details**
 *
 * Effects are sequenced in walker order. Use this for side-effecting visitors
 * where the return values are intentionally discarded.
 *
 * **Example** (Traverse with void effects)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { getRoots, singleton, traverseNodes } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = singleton<string, string>("root")
 * const program = traverseNodes(graph, { start: getRoots(graph), order: "dfs" }, () => Effect.void)
 *
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category sequencing
 * @since 0.0.0
 */
export const traverseNodes: {
  <A, E, R, Err>(
    graph: DirectedGraph<A, E>,
    options: TraversalStart,
    f: (node: A, index: NodeIndex) => Effect.Effect<void, Err, R>
  ): Effect.Effect<void, Err, R>;
  <A, E, R, Err>(
    options: TraversalStart,
    f: (node: A, index: NodeIndex) => Effect.Effect<void, Err, R>
  ): (graph: DirectedGraph<A, E>) => Effect.Effect<void, Err, R>;
} = dual(
  3,
  <A, E, R, Err>(
    graph: DirectedGraph<A, E>,
    options: TraversalStart,
    f: (node: A, index: NodeIndex) => Effect.Effect<void, Err, R>
  ): Effect.Effect<void, Err, R> =>
    Effect.forEach(
      A.fromIterable(Graph.entries(createWalker(graph, options.start, options.order))),
      ([index, node]) => f(node, index),
      {
        discard: true,
      }
    )
);

/**
 * Traverse nodes in order and collect each effect result.
 *
 * **Example** (Collect effectful node lengths)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { getRoots, singleton, traverseNodesCollect } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = singleton<string, string>("root")
 * const program = traverseNodesCollect(graph, { start: getRoots(graph), order: "dfs" }, (node) =>
 *   Effect.succeed(node.length)
 * )
 *
 * console.log(Effect.runSync(program)) // [4]
 * ```
 *
 * @category sequencing
 * @since 0.0.0
 */
export const traverseNodesCollect: {
  <A, E, B, Err, R>(
    graph: DirectedGraph<A, E>,
    options: TraversalStart,
    f: (node: A, index: NodeIndex) => Effect.Effect<B, Err, R>
  ): Effect.Effect<ReadonlyArray<B>, Err, R>;
  <A, E, B, Err, R>(
    options: TraversalStart,
    f: (node: A, index: NodeIndex) => Effect.Effect<B, Err, R>
  ): (graph: DirectedGraph<A, E>) => Effect.Effect<ReadonlyArray<B>, Err, R>;
} = dual(
  3,
  <A, E, B, Err, R>(
    graph: DirectedGraph<A, E>,
    options: TraversalStart,
    f: (node: A, index: NodeIndex) => Effect.Effect<B, Err, R>
  ): Effect.Effect<ReadonlyArray<B>, Err, R> =>
    Effect.forEach(A.fromIterable(Graph.entries(createWalker(graph, options.start, options.order))), ([index, node]) =>
      f(node, index)
    )
);

/**
 * Map node payloads with an effectful function and reconstruct the graph.
 *
 * **Gotchas**
 *
 * The returned graph has reallocated node indices, while edge connectivity is
 * preserved through an internal old-to-new index remap.
 *
 * **Example** (Effectful map node lengths)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { collectNodes, mapNodesEffect, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const program = Effect.map(
 *   mapNodesEffect(singleton<string, string>("root"), (node) => Effect.succeed(node.length)),
 *   collectNodes
 * )
 *
 * console.log(Effect.runSync(program)) // [4]
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const mapNodesEffect: {
  <A, B, E, Err, R>(
    graph: DirectedGraph<A, E>,
    f: (node: A, index: NodeIndex) => Effect.Effect<B, Err, R>
  ): Effect.Effect<DirectedGraph<B, E>, Err, R>;
  <A, B, E, Err, R>(
    f: (node: A, index: NodeIndex) => Effect.Effect<B, Err, R>
  ): (graph: DirectedGraph<A, E>) => Effect.Effect<DirectedGraph<B, E>, Err, R>;
} = dual(
  2,
  Effect.fn("mapNodesEffect")(function* <A, B, E, Err, R>(
    graph: DirectedGraph<A, E>,
    f: (node: A, index: NodeIndex) => Effect.Effect<B, Err, R>
  ): Effect.fn.Return<DirectedGraph<B, E>, Err, R> {
    const pairs = yield* Effect.forEach(A.fromIterable(graph.pipe(Graph.nodes, Graph.entries)), ([index, node]) =>
      Effect.map(f(node, index), (transformed) => [index, transformed] as const)
    );
    const indexMap = MutableHashMap.empty<NodeIndex, NodeIndex>();
    return Graph.directed<B, E>((mutable) => {
      A.forEach(pairs, ([oldIndex, transformed]) => {
        MutableHashMap.set(indexMap, oldIndex, Graph.addNode(mutable, transformed));
      });
      for (const edgeIndex of Graph.indices(graph.pipe(Graph.edges))) {
        O.match(Graph.getEdge(graph, edgeIndex), {
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
  })
);

// =============================================================================
// Streaming Operations
// =============================================================================

/**
 * Stream node payloads in traversal order.
 *
 * **Example** (Stream nodes in dfs order)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { getRoots, singleton, streamNodes } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = singleton<string, string>("root")
 * const program = Stream.runCollect(streamNodes(graph, { start: getRoots(graph), order: "dfs" }))
 *
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category streams
 * @since 0.0.0
 */
export const streamNodes: {
  <A, E>(graph: DirectedGraph<A, E>, options: TraversalStart): Stream.Stream<A>;
  <A, E>(options: TraversalStart): (graph: DirectedGraph<A, E>) => Stream.Stream<A>;
} = dual(
  2,
  <A, E>(graph: DirectedGraph<A, E>, options: TraversalStart): Stream.Stream<A> =>
    Stream.fromIterable(Graph.values(createWalker(graph, options.start, options.order)))
);

/**
 * Stream node-index and payload pairs in traversal order.
 *
 * **Example** (Stream indexed node pairs)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { getRoots, singleton, streamNodesWithIndex } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = singleton<string, string>("root")
 * const program = Stream.runCollect(streamNodesWithIndex(graph, { start: getRoots(graph), order: "dfs" }))
 *
 * console.log(Effect.runSync(program).length) // 1
 * ```
 *
 * @category streams
 * @since 0.0.0
 */
export const streamNodesWithIndex: {
  <A, E>(graph: DirectedGraph<A, E>, options: TraversalStart): Stream.Stream<readonly [NodeIndex, A]>;
  (options: TraversalStart): <A, E>(graph: DirectedGraph<A, E>) => Stream.Stream<readonly [NodeIndex, A]>;
} = dual(
  2,
  <A, E>(graph: DirectedGraph<A, E>, options: TraversalStart): Stream.Stream<readonly [NodeIndex, A]> =>
    Stream.fromIterable(Graph.entries(createWalker(graph, options.start, options.order)))
);

/**
 * Stream node payloads in fixed-size traversal batches.
 *
 * **Example** (Batch stream node payloads)
 *
 * ```ts
 * import { Effect, Stream } from "effect"
 * import { batchNodes, getRoots, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const graph = singleton<string, string>("root")
 * const program = Stream.runCollect(batchNodes(graph, { start: getRoots(graph), order: "dfs", batchSize: 2 }))
 *
 * console.log(Effect.runSync(program).length) // 1
 * ```
 *
 * @category streams
 * @since 0.0.0
 */
export const batchNodes: {
  <A, E>(
    graph: DirectedGraph<A, E>,
    options: TraversalStart & { readonly batchSize: number }
  ): Stream.Stream<ReadonlyArray<A>>;
  <A, E>(
    options: TraversalStart & { readonly batchSize: number }
  ): (graph: DirectedGraph<A, E>) => Stream.Stream<ReadonlyArray<A>>;
} = dual(
  2,
  <A, E>(
    graph: DirectedGraph<A, E>,
    options: TraversalStart & { readonly batchSize: number }
  ): Stream.Stream<ReadonlyArray<A>> =>
    Stream.grouped(streamNodes(graph, { start: options.start, order: options.order }), options.batchSize)
);

// =============================================================================
// Graph Properties and Validation
// =============================================================================

/**
 * Check whether a graph has no directed cycles.
 *
 * **Example** (Singleton graph is acyclic)
 *
 * ```ts
 * import { isAcyclic, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * console.log(isAcyclic(singleton<string, string>("root"))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isAcyclic = <A, E>(graph: DirectedGraph<A, E>): boolean => Graph.isAcyclic(graph);

/**
 * Compute strongly connected components as node-index groups.
 *
 * **Example** (Single-node component count)
 *
 * ```ts
 * import { singleton, stronglyConnectedComponents } from "@beep/nlp/Graph/GraphOps"
 *
 * const components = stronglyConnectedComponents(singleton<string, string>("root"))
 * console.log(components.length) // 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const stronglyConnectedComponents = <A, E>(
  graph: DirectedGraph<A, E>
): ReadonlyArray<ReadonlyArray<NodeIndex>> => Graph.stronglyConnectedComponents(graph);

/**
 * Count nodes in the graph.
 *
 * **Example** (Count singleton graph nodes)
 *
 * ```ts
 * import { nodeCount, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * console.log(nodeCount(singleton<string, string>("root"))) // 1
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const nodeCount = <A, E>(graph: DirectedGraph<A, E>): number => Graph.nodeCount(graph);

/**
 * Count edges in the graph.
 *
 * **Example** (Count singleton graph edges)
 *
 * ```ts
 * import { edgeCount, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * console.log(edgeCount(singleton<string, string>("root"))) // 0
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const edgeCount = <A, E>(graph: DirectedGraph<A, E>): number => Graph.edgeCount(graph);

/**
 * Check whether a graph has no nodes.
 *
 * **Example** (Empty graph emptiness check)
 *
 * ```ts
 * import { empty, isEmpty } from "@beep/nlp/Graph/GraphOps"
 *
 * console.log(isEmpty(empty<string, string>())) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const isEmpty = <A, E>(graph: DirectedGraph<A, E>): boolean => nodeCount(graph) === 0;

// =============================================================================
// Constructors & Combinators
// =============================================================================

/**
 * Create an empty directed graph.
 *
 * **Example** (Create empty graph)
 *
 * ```ts
 * import { empty, nodeCount } from "@beep/nlp/Graph/GraphOps"
 *
 * console.log(nodeCount(empty<string, string>())) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const empty = <A, E>(): DirectedGraph<A, E> => Graph.directed<A, E>();

/**
 * Create a graph with one root node and no edges.
 *
 * **Example** (Create singleton graph)
 *
 * ```ts
 * import { collectNodes, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * console.log(collectNodes(singleton<string, string>("root"))) // ["root"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const singleton = <A, E>(node: A): DirectedGraph<A, E> =>
  Graph.directed<A, E>((mutable) => {
    Graph.addNode(mutable, node);
  });

/**
 * Merge two graphs, copying the second graph's nodes and edges into the first
 * with a fresh index remap (the second graph's indices are reallocated).
 *
 * **Example** (Merge two singleton graphs)
 *
 * ```ts
 * import { merge, nodeCount, singleton } from "@beep/nlp/Graph/GraphOps"
 *
 * const merged = merge(singleton<string, string>("left"), singleton<string, string>("right"))
 * console.log(nodeCount(merged)) // 2
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const merge: {
  <A, E>(g1: DirectedGraph<A, E>, g2: DirectedGraph<A, E>): DirectedGraph<A, E>;
  <A, E>(g2: DirectedGraph<A, E>): (g1: DirectedGraph<A, E>) => DirectedGraph<A, E>;
} = dual(2, <A, E>(g1: DirectedGraph<A, E>, g2: DirectedGraph<A, E>): DirectedGraph<A, E> => {
  const indexMap = MutableHashMap.empty<NodeIndex, NodeIndex>();
  return Graph.mutate(g1, (mutable) => {
    for (const [oldIndex, node] of Graph.nodes(g2)) {
      MutableHashMap.set(indexMap, oldIndex, Graph.addNode(mutable, node));
    }
    for (const edgeIndex of Graph.indices(g2.pipe(Graph.edges))) {
      O.match(Graph.getEdge(g2, edgeIndex), {
        onNone: R.empty,
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
});
