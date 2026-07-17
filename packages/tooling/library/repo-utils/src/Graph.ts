/**
 * Graph algorithms for dependency analysis in monorepo workspaces.
 *
 * Wraps the built-in Effect v4 `Graph` module, converting between
 * `HashMap<string, HashSet<string>>` adjacency lists (the natural shape for
 * package dependency data) and the indexed `Graph.DirectedGraph` structure
 * that the Effect algorithms operate on.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A } from "@beep/utils";
import { Effect, Graph as G, HashMap, HashSet, MutableHashMap, MutableHashSet, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { CyclicDependencyError } from "./errors/index.ts";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert a `HashMap<string, HashSet<string>>` adjacency list into an
 * `G.DirectedGraph<string, void>` and a bidirectional lookup
 * between package names and node indices.
 *
 * @internal
 * @param adjacencyList - Package dependency adjacency list.
 * @returns Graph plus lookup maps for package names and node indices.
 */
const fromAdjacencyList = (
  adjacencyList: HashMap.HashMap<string, HashSet.HashSet<string>>
): {
  graph: G.DirectedGraph<string, void>;
  nameToIndex: MutableHashMap.MutableHashMap<string, G.NodeIndex>;
  indexToName: MutableHashMap.MutableHashMap<G.NodeIndex, string>;
} => {
  const nameToIndex = MutableHashMap.empty<string, G.NodeIndex>();
  const indexToName = MutableHashMap.empty<G.NodeIndex, string>();

  const graph = G.directed<string, void>((mutable) => {
    // First pass: add all nodes (keys AND their deps, in case a dep
    // appears only as a value and not as a key).
    const allNames = MutableHashSet.empty<string>();
    for (const [name, deps] of adjacencyList) {
      MutableHashSet.add(allNames, name);
      for (const dep of deps) {
        MutableHashSet.add(allNames, dep);
      }
    }

    for (const name of allNames) {
      const idx = G.addNode(mutable, name);
      MutableHashMap.set(nameToIndex, name, idx);
      MutableHashMap.set(indexToName, idx, name);
    }

    // Second pass: add edges (package -> dependency)
    for (const [name, deps] of adjacencyList) {
      const sourceIdxOpt = MutableHashMap.get(nameToIndex, name);
      for (const dep of deps) {
        const targetIdxOpt = MutableHashMap.get(nameToIndex, dep);

        if (O.isSome(sourceIdxOpt) && O.isSome(targetIdxOpt)) {
          G.addEdge(mutable, sourceIdxOpt.value, targetIdxOpt.value, undefined);
        }
      }
    }
  });

  return { graph, nameToIndex, indexToName };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a topological ordering (dependency-first build order) of packages
 * described by the given adjacency list using Kahn's algorithm.
 *
 * Dependencies appear **before** their dependents in the returned array so
 * that every package is built after all of its dependencies.
 *
 * Fails with {@link CyclicDependencyError} when the graph contains cycles.
 *
 * @example
 * ```typescript
 * import { Effect, HashMap, HashSet } from "effect"
 * import { topologicalSort } from "@beep/repo-utils/Graph"
 *
 * const adj = HashMap.make(["app", HashSet.make("lib")], ["lib", HashSet.empty<string>()])
 * const program = topologicalSort(adj)
 * Effect.runPromise(program).then(console.log)
 * ```
 * @category services
 * @since 0.0.0
 */
export const topologicalSort: (
  adjacencyList: HashMap.HashMap<string, HashSet.HashSet<string>>
) => Effect.Effect<ReadonlyArray<string>, CyclicDependencyError> = Effect.fn(function* (adjacencyList) {
  // Empty graph – nothing to sort
  if (HashMap.size(adjacencyList) === 0) {
    return A.empty<string>();
  }

  const { graph } = fromAdjacencyList(adjacencyList);

  // Check for cycles first (isAcyclic is cheap and cached)
  if (!G.isAcyclic(graph)) {
    const cycles = yield* detectCycles(adjacencyList);
    return yield* CyclicDependencyError.make({
      message: `Cyclic dependencies detected: ${pipe(cycles, A.map(A.join(" -> ")), A.join("; "))}`,
      cycles,
    });
  }

  // Use the built-in topological sort.
  // The topo sort outputs zero-in-degree nodes first. In our graph where
  // edges go from package -> dependency, roots/dependents have zero
  // in-degree. Reversing gives us dependency-first (build) order.
  const walker = G.topo(graph);
  return pipe(A.fromIterable(G.values(walker)), A.reverse);
});

/**
 * Detect all cycles in a directed dependency graph.
 *
 * Uses strongly connected components (Kosaraju's algorithm via the built-in
 * `Graph.stronglyConnectedComponents`) and then reconstructs explicit cycle
 * paths of the form `[pkg1, pkg2, ..., pkg1]`.
 *
 * Returns an empty array when the graph is acyclic.
 *
 * @param adjacencyList - Package dependency adjacency list.
 * @returns Effect producing all detected cycle paths.
 * @example
 * ```typescript
 * import { Effect, HashMap, HashSet } from "effect"
 * import { detectCycles } from "@beep/repo-utils/Graph"
 *
 * const adj = HashMap.make(["app", HashSet.make("lib")], ["lib", HashSet.empty<string>()])
 * const program = detectCycles(adj)
 * Effect.runPromise(program).then(console.log)
 * ```
 * @category services
 * @since 0.0.0
 */
export const detectCycles: (
  adjacencyList: HashMap.HashMap<string, HashSet.HashSet<string>>
) => Effect.Effect<ReadonlyArray<ReadonlyArray<string>>> = Effect.fnUntraced(function* (adjacencyList) {
  yield* Effect.void;

  if (HashMap.size(adjacencyList) === 0) {
    return A.empty<ReadonlyArray<string>>();
  }

  const { graph, indexToName } = fromAdjacencyList(adjacencyList);

  // Quick check – if acyclic, short-circuit
  if (G.isAcyclic(graph)) {
    return A.empty<ReadonlyArray<string>>();
  }

  const sccs = G.stronglyConnectedComponents(graph);

  // Filter to SCCs with more than one node, or a single node with a
  // self-edge.
  let cyclePaths: ReadonlyArray<ReadonlyArray<string>> = A.empty();

  for (const scc of sccs) {
    const firstOpt = A.get(scc, 0);
    if (O.isNone(firstOpt)) continue;
    const first = firstOpt.value;

    if (A.length(scc) > 1) {
      // Reconstruct a cycle path through this SCC.
      const memberSet = MutableHashSet.fromIterable(scc);
      const names = pipe(
        scc,
        A.map((idx) => MutableHashMap.get(indexToName, idx)),
        A.getSomes
      );

      // Build a path by DFS within the SCC starting from the first member
      const path = buildCyclePath(graph, first, memberSet, indexToName);
      if (A.length(path) > 0) {
        cyclePaths = A.append(cyclePaths, path);
      } else {
        // Fallback: just list the members with the first repeated
        const firstNameOpt = A.get(names, 0);
        if (O.isSome(firstNameOpt)) {
          cyclePaths = A.append(cyclePaths, A.append(names, firstNameOpt.value));
        }
      }
    } else {
      // Check for self-loop
      const nameOpt = MutableHashMap.get(indexToName, first);
      if (O.isNone(nameOpt)) continue;

      const selfEdge = G.findEdge(graph, (_data, source, target) => source === first && target === first);
      if (P.isNotUndefined(selfEdge)) {
        cyclePaths = A.append(cyclePaths, [nameOpt.value, nameOpt.value]);
      }
    }
  }

  return cyclePaths;
});

/**
 * Build an explicit cycle path through an SCC by DFS, returning a path of
 * the form `[start, ..., start]`.
 *
 * @internal
 * @param graph - Directed dependency graph.
 * @param startIdx - Starting node index for cycle reconstruction.
 * @param memberSet - Node-index membership set for the SCC.
 * @param indexToName - Lookup map from node index to package name.
 * @returns Cycle path as package names when found, otherwise an empty array.
 */
const buildCyclePath = (
  graph: G.DirectedGraph<string, void>,
  startIdx: G.NodeIndex,
  memberSet: MutableHashSet.MutableHashSet<G.NodeIndex>,
  indexToName: MutableHashMap.MutableHashMap<G.NodeIndex, string>
): ReadonlyArray<string> => {
  type StackItem = { readonly node: G.NodeIndex; readonly path: ReadonlyArray<G.NodeIndex> };

  // DFS within the SCC to find a cycle back to startIdx
  let stack: Array<StackItem> = A.of({ node: startIdx, path: A.of(startIdx) });
  const visited = MutableHashSet.empty<G.NodeIndex>();

  while (A.isArrayNonEmpty(stack)) {
    const [current, remaining] = A.unprepend(stack);
    stack = remaining;

    // Get outgoing neighbors that are within the SCC
    const neighbors = G.successors(graph, current.node);
    for (const neighbor of neighbors) {
      if (!MutableHashSet.has(memberSet, neighbor)) continue;

      if (neighbor === startIdx && A.length(current.path) > 1) {
        // Found a cycle back to start – resolve names
        const pathNames = pipe(
          current.path,
          A.map((idx) => MutableHashMap.get(indexToName, idx)),
          A.getSomes
        );
        return pipe(
          MutableHashMap.get(indexToName, startIdx),
          O.match({
            onNone: () => pathNames,
            onSome: (startName) => A.append(pathNames, startName),
          })
        );
      }

      if (!MutableHashSet.has(visited, neighbor)) {
        MutableHashSet.add(visited, neighbor);
        stack = A.prepend(stack, {
          node: neighbor,
          path: A.append(current.path, neighbor),
        });
      }
    }
  }

  return A.empty<string>();
};

/**
 * Compute the transitive closure of dependencies for a single package.
 *
 * Returns a `HashSet` of all packages that the given package depends on,
 * directly or transitively.  The starting package itself is **not** included
 * unless it participates in a cycle.
 *
 * Uses BFS traversal via the built-in `Graph.bfs`.
 *
 * @param adjacencyList - Package dependency adjacency list.
 * @param pkg - Package name whose dependency closure should be computed.
 * @returns Effect producing all transitively reachable dependencies.
 * @example
 * ```typescript
 * import { Effect, HashMap, HashSet } from "effect"
 * import { computeTransitiveClosure } from "@beep/repo-utils/Graph"
 *
 * const adj = HashMap.make(["app", HashSet.make("lib")], ["lib", HashSet.empty<string>()])
 * const program = computeTransitiveClosure(adj, "app")
 * Effect.runPromise(program).then(console.log)
 * ```
 * @category services
 * @since 0.0.0
 */
export const computeTransitiveClosure: {
  (
    pkg: string
  ): (adjacencyList: HashMap.HashMap<string, HashSet.HashSet<string>>) => Effect.Effect<HashSet.HashSet<string>>;
  (
    adjacencyList: HashMap.HashMap<string, HashSet.HashSet<string>>,
    pkg: string
  ): Effect.Effect<HashSet.HashSet<string>>;
} = dual(
  2,
  Effect.fnUntraced(function* (adjacencyList: HashMap.HashMap<string, HashSet.HashSet<string>>, pkg: string) {
    yield* Effect.void;

    if (HashMap.size(adjacencyList) === 0) {
      return HashSet.empty<string>();
    }

    const { graph, nameToIndex, indexToName } = fromAdjacencyList(adjacencyList);

    return pipe(
      MutableHashMap.get(nameToIndex, pkg),
      O.match({
        onNone: HashSet.empty<string>,
        onSome: (startIdx) => {
          // BFS from the starting package, collecting all reachable nodes
          const walker = G.bfs(graph, { start: [startIdx] });
          let result = HashSet.empty<string>();

          for (const [idx, _value] of walker) {
            // Skip the starting node itself
            if (idx === startIdx) continue;
            const nameOpt = MutableHashMap.get(indexToName, idx);
            if (O.isSome(nameOpt)) {
              result = HashSet.add(result, nameOpt.value);
            }
          }

          return result;
        },
      })
    );
  })
);
