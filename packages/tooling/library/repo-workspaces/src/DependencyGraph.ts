/**
 * The inter-workspace dependency graph — a pure VALUE, not a service. Sorting
 * is a pure function of the graph, so it lives here as a method.
 *
 * **Details**
 *
 * Cycle detection is ITERATIVE, so a long dependency chain cannot overflow the
 * stack.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoWorkspacesId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PackageNotFoundError } from "./WorkspaceDiscovery.ts";
import { WorkspacePackage } from "./WorkspacePackage.ts";

const $I = $RepoWorkspacesId.create("DependencyGraph");

/**
 * **Details**
 *
 * `cycle` names the actual cycle members — the sorted union of every strongly
 * connected component with more than one package. Packages merely downstream
 * of a cycle are excluded, so it is exactly the set to break, not necessarily
 * a single ordered loop.
 *
 * **Example** (Inspect the cycle members)
 *
 * ```ts
 * import { CyclicDependencyError } from "@beep/repo-workspaces/DependencyGraph";
 *
 * const error = CyclicDependencyError.make({ cycle: ["a", "b"] });
 * console.log(error.cycle.join(", ")) // a, b
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class CyclicDependencyError extends S.TaggedError<CyclicDependencyError, { readonly brand: unique symbol }>(
  $I`CyclicDependencyError`
)(
  "CyclicDependencyError",
  {
    /** The packages participating in the cycle. */
    cycle: S.Array(S.String).pipe(
      $I.annoteKey("CyclicDependencyError.cycle", { description: "The packages participating in the cycle." })
    ),
  },
  $I.annoteError<CyclicDependencyError>("CyclicDependencyError", {
    description:
      "Raised when the workspace dependency graph cannot be topologically ordered because it contains a cycle.",
  })
) {
  /**
   * Renders the cycle members into a one-line message.
   *
   * **Example** (Render a cycle diagnostic)
   *
   * ```ts
   * import { CyclicDependencyError } from "@beep/repo-workspaces/DependencyGraph";
   *
   * const error = CyclicDependencyError.make({ cycle: ["a", "b"] });
   * console.log(error.message) // Cyclic workspace dependencies among: a, b
   * ```
   *
   * @returns The one-line sentence a log or a thrown error shows.
   * @category formatting
   * @since 0.0.0
   */
  override get message(): string {
    return `Cyclic workspace dependencies among: ${A.join(this.cycle, ", ")}`;
  }
}

const Edges = S.Struct({
  order: S.Array(S.String).pipe(
    $I.annoteKey("Edges.order", { description: "Vertex order, independent of the hash map's iteration order." })
  ),
  forward: S.HashMap(S.String, S.HashSet(S.String)).pipe(
    $I.annoteKey("Edges.forward", { description: "Each workspace package's direct workspace dependencies." })
  ),
  reverse: S.HashMap(S.String, S.HashSet(S.String)).pipe(
    $I.annoteKey("Edges.reverse", { description: "Each workspace package's direct workspace dependents." })
  ),
}).pipe(
  $I.annoteSchema("Edges", {
    description: "The graph's ordered vertices and immutable forward and reverse dependency indexes.",
  })
);

type Edges = typeof Edges.Type;

/**
 * **Details**
 *
 * A pure value over the discovered package list, with the edge indexes built
 * lazily into `#private` fields the schema never encodes. Edges are drawn from
 * `dependencies`, `devDependencies`, `peerDependencies` and
 * `optionalDependencies`; a self-edge is dropped.
 *
 * Total accessors never fail. The lookups fail with `PackageNotFoundError` for
 * an unknown name, and the ordering operations (`levels`, `sort`, `sortSubset`)
 * fail with {@link CyclicDependencyError} when the graph has a cycle.
 *
 * **Example** (Group workspace packages into build levels)
 *
 * ```ts
 * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
 * import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const discovery = yield* WorkspaceDiscovery;
 *   const graph = DependencyGraph.make({ packages: yield* discovery.listPackages });
 *   return yield* graph.levels();
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DependencyGraph extends S.Class<DependencyGraph, { readonly brand: unique symbol }>($I`DependencyGraph`)(
  {
    /** The workspace packages the graph is drawn over. */
    packages: S.Array(WorkspacePackage).pipe(
      $I.annoteKey("DependencyGraph.packages", { description: "The workspace packages the graph is drawn over." })
    ),
  },
  $I.annote("DependencyGraph", {
    description:
      "The directed graph of dependencies **between workspace packages**. External npm dependencies are not nodes.",
  })
) {
  /**
   * Caches the lazily built forward and reverse edge indexes outside the encoded schema fields.
   *
   * **Details**
   *
   * Public accessors trigger index construction; schema encoding includes only the package list.
   *
   * **Example** (Reuse the cached adjacency map)
   *
   * ```ts
   * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
   *
   * const graph = DependencyGraph.make({ packages: [] });
   * console.log(graph.adjacency === graph.adjacency) // true
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  #edges: Edges | undefined;

  /**
   * Builds the edge indexes on first access and reuses them for subsequent graph operations.
   *
   * **Details**
   *
   * Public accessors trigger index construction; schema encoding includes only the package list.
   *
   * **Example** (Initialize indexes through a public accessor)
   *
   * ```ts
   * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
   *
   * const graph = DependencyGraph.make({ packages: [] });
   * console.log(graph.adjacency === graph.adjacency) // true
   * ```
   *
   * @returns The edge indexes.
   * @category utilities
   * @since 0.0.0
   */
  #index(): Edges {
    if (this.#edges !== undefined) return this.#edges;
    const names = MutableHashSet.fromIterable(A.map(this.packages, (pkg) => pkg.name));
    const declared = MutableHashMap.empty<string, ReadonlyArray<string>>();
    for (const pkg of this.packages) {
      const internal = A.filter(
        R.keys(pkg.allDependencies),
        (dependency) => MutableHashSet.has(names, dependency) && dependency !== pkg.name
      );
      MutableHashMap.set(declared, pkg.name, [...dependenciesIn(declared, pkg.name), ...internal]);
    }
    this.#edges = edgesOver(A.fromIterable(names), (name) => dependenciesIn(declared, name));
    return this.#edges;
  }

  /**
   * Every workspace package name, sorted. Total.
   *
   * **Example** (List workspace names lexicographically)
   *
   * ```ts
   * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
   * import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
   *
   * const core = WorkspacePackage.make({
   *   name: "core", path: "/repo/core", packageJsonPath: "/repo/core/package.json",
   *   relativePath: "core", workspaceRoot: "/repo",
   * });
   * const app = WorkspacePackage.make({
   *   name: "app", path: "/repo/app", packageJsonPath: "/repo/app/package.json",
   *   relativePath: "app", workspaceRoot: "/repo", dependencies: { core: "workspace:*" },
   * });
   * const graph = DependencyGraph.make({ packages: [app, core] });
   * console.log(graph.names.join(", ")) // app, core
   * ```
   *
   * @returns The package names, sorted.
   * @category getters
   * @since 0.0.0
   */
  get names(): ReadonlyArray<string> {
    return A.sort(this.#index().order, Str.Order);
  }

  /**
   * The adjacency map: name → the names it depends on. Total.
   *
   * **Example** (Read the direct edge index)
   *
   * ```ts
   * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
   * import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
   * import * as HashMap from "effect/HashMap";
   *
   * const core = WorkspacePackage.make({
   *   name: "core", path: "/repo/core", packageJsonPath: "/repo/core/package.json",
   *   relativePath: "core", workspaceRoot: "/repo",
   * });
   * const app = WorkspacePackage.make({
   *   name: "app", path: "/repo/app", packageJsonPath: "/repo/app/package.json",
   *   relativePath: "app", workspaceRoot: "/repo", dependencies: { core: "workspace:*" },
   * });
   * const graph = DependencyGraph.make({ packages: [app, core] });
   * console.log(HashMap.size(graph.adjacency)) // 2
   * ```
   *
   * @returns The forward adjacency map.
   * @category getters
   * @since 0.0.0
   */
  get adjacency(): HashMap.HashMap<string, HashSet.HashSet<string>> {
    return this.#index().forward;
  }

  /**
   * Whether the graph contains a cycle. Total.
   *
   * **Details**
   *
   * An explicit-stack DFS with an on-stack set — never recursive, so a long
   * dependency chain cannot overflow.
   *
   * **Example** (Check an acyclic workspace graph)
   *
   * ```ts
   * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
   * import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
   *
   * const core = WorkspacePackage.make({
   *   name: "core", path: "/repo/core", packageJsonPath: "/repo/core/package.json",
   *   relativePath: "core", workspaceRoot: "/repo",
   * });
   * const app = WorkspacePackage.make({
   *   name: "app", path: "/repo/app", packageJsonPath: "/repo/app/package.json",
   *   relativePath: "app", workspaceRoot: "/repo", dependencies: { core: "workspace:*" },
   * });
   * const graph = DependencyGraph.make({ packages: [app, core] });
   * console.log(graph.hasCycle) // false
   * ```
   *
   * @returns `true` when some package depends on itself through others.
   * @category predicates
   * @since 0.0.0
   */
  get hasCycle(): boolean {
    const { forward, order } = this.#index();
    const visited = MutableHashSet.empty<string>();
    const onStack = MutableHashSet.empty<string>();
    return A.some(
      order,
      (start) => !MutableHashSet.has(visited, start) && reachesCycle(forward, start, { visited, onStack })
    );
  }

  /**
   * The workspace packages `name` depends on, sorted.
   *
   * **Example** (Look up direct workspace dependencies)
   *
   * ```ts
   * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
   * import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
   * import * as Effect from "effect/Effect";
   *
   * const core = WorkspacePackage.make({
   *   name: "core", path: "/repo/core", packageJsonPath: "/repo/core/package.json",
   *   relativePath: "core", workspaceRoot: "/repo",
   * });
   * const app = WorkspacePackage.make({
   *   name: "app", path: "/repo/app", packageJsonPath: "/repo/app/package.json",
   *   relativePath: "app", workspaceRoot: "/repo", dependencies: { core: "workspace:*" },
   * });
   * const graph = DependencyGraph.make({ packages: [app, core] });
   * console.log(Effect.runSync(graph.dependenciesOf("app")).join(", ")) // core
   * ```
   *
   * @category queries
   * @since 0.0.0
   */
  readonly dependenciesOf = Effect.fn("DependencyGraph.dependenciesOf")(
    (name: string): Effect.Effect<ReadonlyArray<string>, PackageNotFoundError> => {
      const deps = HashMap.get(this.#index().forward, name);
      return O.isNone(deps)
        ? Effect.fail(PackageNotFoundError.make({ packageName: name, available: this.names }))
        : Effect.succeed(A.sort(A.fromIterable(deps.value), Str.Order));
    }
  );

  /**
   * The workspace packages that depend on `name`, sorted.
   *
   * **Example** (Look up direct workspace dependents)
   *
   * ```ts
   * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
   * import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
   * import * as Effect from "effect/Effect";
   *
   * const core = WorkspacePackage.make({
   *   name: "core", path: "/repo/core", packageJsonPath: "/repo/core/package.json",
   *   relativePath: "core", workspaceRoot: "/repo",
   * });
   * const app = WorkspacePackage.make({
   *   name: "app", path: "/repo/app", packageJsonPath: "/repo/app/package.json",
   *   relativePath: "app", workspaceRoot: "/repo", dependencies: { core: "workspace:*" },
   * });
   * const graph = DependencyGraph.make({ packages: [app, core] });
   * console.log(Effect.runSync(graph.dependentsOf("core")).join(", ")) // app
   * ```
   *
   * @category queries
   * @since 0.0.0
   */
  readonly dependentsOf = Effect.fn("DependencyGraph.dependentsOf")(
    (name: string): Effect.Effect<ReadonlyArray<string>, PackageNotFoundError> => {
      const dependents = HashMap.get(this.#index().reverse, name);
      return O.isNone(dependents)
        ? Effect.fail(PackageNotFoundError.make({ packageName: name, available: this.names }))
        : Effect.succeed(A.sort(A.fromIterable(dependents.value), Str.Order));
    }
  );

  /**
   * Each of `names` plus every package that transitively depends on any of
   * them — the blast radius of a change. Sorted and de-duplicated; the given
   * names are included, whether or not the graph knows them.
   *
   * **Example** (Include dependents and unknown changed names)
   *
   * ```ts
   * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
   * import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
   * import * as Effect from "effect/Effect";
   *
   * const core = WorkspacePackage.make({
   *   name: "core", path: "/repo/core", packageJsonPath: "/repo/core/package.json",
   *   relativePath: "core", workspaceRoot: "/repo",
   * });
   * const app = WorkspacePackage.make({
   *   name: "app", path: "/repo/app", packageJsonPath: "/repo/app/package.json",
   *   relativePath: "app", workspaceRoot: "/repo", dependencies: { core: "workspace:*" },
   * });
   * const graph = DependencyGraph.make({ packages: [app, core] });
   * console.log(Effect.runSync(graph.affectedBy(["core", "external"])).join(", ")) // app, core, external
   * ```
   *
   * @param names - The changed package names.
   * @category queries
   * @since 0.0.0
   */
  readonly affectedBy = Effect.fn("DependencyGraph.affectedBy")(
    (names: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<string>, never> => {
      const { reverse } = this.#index();
      const affected = MutableHashSet.empty<string>();
      const queue = [...names];
      for (const current of queue) {
        if (MutableHashSet.has(affected, current)) continue;
        MutableHashSet.add(affected, current);
        for (const dependent of O.getOrElse(HashMap.get(reverse, current), HashSet.empty<string>)) {
          if (!MutableHashSet.has(affected, dependent)) queue.push(dependent);
        }
      }
      return Effect.succeed(A.sort(A.fromIterable(affected), Str.Order));
    }
  );

  /**
   * Packages grouped into parallel build levels: level 0 depends on nothing in
   * the workspace, level *n* depends only on levels below it.
   *
   * **Details**
   *
   * Kahn's algorithm over the reverse-edge index, linear in the edge count.
   * Each level is sorted lexicographically, so the output is deterministic.
   *
   * **Example** (Partition dependency-first build levels)
   *
   * ```ts
   * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
   * import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
   * import * as Effect from "effect/Effect";
   *
   * const core = WorkspacePackage.make({
   *   name: "core", path: "/repo/core", packageJsonPath: "/repo/core/package.json",
   *   relativePath: "core", workspaceRoot: "/repo",
   * });
   * const app = WorkspacePackage.make({
   *   name: "app", path: "/repo/app", packageJsonPath: "/repo/app/package.json",
   *   relativePath: "app", workspaceRoot: "/repo", dependencies: { core: "workspace:*" },
   * });
   * const graph = DependencyGraph.make({ packages: [app, core] });
   * console.log(Effect.runSync(graph.levels()).map((level) => level.join(", ")).join(" -> ")) // core -> app
   * ```
   *
   * @category sequencing
   * @since 0.0.0
   */
  readonly levels = Effect.fn("DependencyGraph.levels")(
    (): Effect.Effect<ReadonlyArray<ReadonlyArray<string>>, CyclicDependencyError> =>
      Effect.suspend(() => {
        const edges = this.#index();
        const result = kahn(edges);
        return result.stalled.length > 0
          ? Effect.fail(CyclicDependencyError.make({ cycle: cycleMembers(edges) }))
          : Effect.succeed(result.levels);
      })
  );

  /**
   * The flattened topological order — `levels()` concatenated.
   *
   * **Example** (Flatten the dependency-first build order)
   *
   * ```ts
   * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
   * import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
   * import * as Effect from "effect/Effect";
   *
   * const core = WorkspacePackage.make({
   *   name: "core", path: "/repo/core", packageJsonPath: "/repo/core/package.json",
   *   relativePath: "core", workspaceRoot: "/repo",
   * });
   * const app = WorkspacePackage.make({
   *   name: "app", path: "/repo/app", packageJsonPath: "/repo/app/package.json",
   *   relativePath: "app", workspaceRoot: "/repo", dependencies: { core: "workspace:*" },
   * });
   * const graph = DependencyGraph.make({ packages: [app, core] });
   * console.log(Effect.runSync(graph.sort()).join(", ")) // core, app
   * ```
   *
   * @category sequencing
   * @since 0.0.0
   */
  readonly sort = Effect.fn("DependencyGraph.sort")(
    (): Effect.Effect<ReadonlyArray<string>, CyclicDependencyError> =>
      this.levels().pipe(Effect.map((levels) => levels.flat()))
  );

  /**
   * A topological order over `names` plus their transitive workspace
   * dependencies — the build order for a subset.
   *
   * **Details**
   *
   * Fails with `PackageNotFoundError` for a name the graph does not contain,
   * and with {@link CyclicDependencyError} when the subset's closure has a
   * cycle.
   *
   * **Example** (Include transitive dependencies in a subset build)
   *
   * ```ts
   * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
   * import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
   * import * as Effect from "effect/Effect";
   *
   * const core = WorkspacePackage.make({
   *   name: "core", path: "/repo/core", packageJsonPath: "/repo/core/package.json",
   *   relativePath: "core", workspaceRoot: "/repo",
   * });
   * const app = WorkspacePackage.make({
   *   name: "app", path: "/repo/app", packageJsonPath: "/repo/app/package.json",
   *   relativePath: "app", workspaceRoot: "/repo", dependencies: { core: "workspace:*" },
   * });
   * const graph = DependencyGraph.make({ packages: [app, core] });
   * console.log(Effect.runSync(graph.sortSubset(["app"])).join(", ")) // core, app
   * ```
   *
   * @param names - The packages to build; each must be a workspace package.
   * @category sequencing
   * @since 0.0.0
   */
  readonly sortSubset = Effect.fn("DependencyGraph.sortSubset")(
    (
      names: ReadonlyArray<string>
    ): Effect.Effect<ReadonlyArray<string>, CyclicDependencyError | PackageNotFoundError> =>
      Effect.suspend((): Effect.Effect<ReadonlyArray<string>, CyclicDependencyError | PackageNotFoundError> => {
        const { forward } = this.#index();
        const missing = A.findFirst(names, (name) => !HashMap.has(forward, name));
        if (O.isSome(missing)) {
          return Effect.fail(PackageNotFoundError.make({ packageName: missing.value, available: this.names }));
        }
        const needed = closureOf(forward, names);
        const subEdges = edgesOver(A.fromIterable(needed), (node) =>
          A.filter(dependenciesOf(forward, node), (dependency) => MutableHashSet.has(needed, dependency))
        );
        const result = kahn(subEdges);
        return result.stalled.length > 0
          ? Effect.fail(CyclicDependencyError.make({ cycle: cycleMembers(subEdges) }))
          : Effect.succeed(result.levels.flat());
      })
  );

  /**
   * The graph rendered as a Mermaid `flowchart TD`. Total.
   *
   * **Details**
   *
   * Renders through core's `Graph.toMermaid` over a transient graph built from
   * the edge index. Node IDs are numeric indexes assigned in sorted-name order
   * and package names appear only inside quoted labels, so scoped names
   * (`@scope/a`) never break Mermaid syntax. Nodes and each node's edges are
   * emitted in sorted order — the output is deterministic regardless of
   * manifest key order.
   *
   * **Example** (Render the Mermaid flowchart header)
   *
   * ```ts
   * import { DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
   * import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
   *
   * const core = WorkspacePackage.make({
   *   name: "core", path: "/repo/core", packageJsonPath: "/repo/core/package.json",
   *   relativePath: "core", workspaceRoot: "/repo",
   * });
   * const app = WorkspacePackage.make({
   *   name: "app", path: "/repo/app", packageJsonPath: "/repo/app/package.json",
   *   relativePath: "app", workspaceRoot: "/repo", dependencies: { core: "workspace:*" },
   * });
   * const graph = DependencyGraph.make({ packages: [app, core] });
   * console.log(graph.toMermaid().split("\n")[0]) // flowchart TD
   * ```
   *
   * @returns The Mermaid source.
   * @category formatting
   * @since 0.0.0
   */
  toMermaid(): string {
    return Graph.toMermaid(materialize(this.#index()).graph, { edgeLabel: () => "" });
  }
}

const materialize = (
  edges: Edges
): { readonly graph: Graph.DirectedGraph<string, string>; readonly names: ReadonlyArray<string> } => {
  const names = A.sort(edges.order, Str.Order);
  const graph = Graph.directed<string, string>((mutable) => {
    const indexOf = MutableHashMap.empty<string, Graph.NodeIndex>();
    for (const name of names) MutableHashMap.set(indexOf, name, Graph.addNode(mutable, name));
    for (const name of names) {
      const source = O.getOrThrow(MutableHashMap.get(indexOf, name));
      for (const dependency of A.sort(
        A.fromIterable(O.getOrElse(HashMap.get(edges.forward, name), HashSet.empty<string>)),
        Str.Order
      )) {
        const target = O.getOrThrow(MutableHashMap.get(indexOf, dependency));
        Graph.addEdge(mutable, source, target, "");
      }
    }
  });
  return { graph, names };
};

const cycleMembers = (edges: Edges): ReadonlyArray<string> => {
  const { graph, names } = materialize(edges);
  const members = MutableHashSet.empty<string>();
  for (const component of Graph.stronglyConnectedComponents(graph)) {
    if (component.length < 2) continue;
    for (const index of component) {
      const name = O.getOrThrow(A.get(names, index));
      MutableHashSet.add(members, name);
    }
  }
  return A.sort(A.fromIterable(members), Str.Order);
};

const dependenciesIn = (
  declared: MutableHashMap.MutableHashMap<string, ReadonlyArray<string>>,
  name: string
): ReadonlyArray<string> => O.getOrElse(MutableHashMap.get(declared, name), (): ReadonlyArray<string> => []);

const dependenciesOf = (forward: Edges["forward"], node: string): Array<string> => [
  ...O.getOrElse(HashMap.get(forward, node), HashSet.empty<string>),
];

const edgesOver = (order: ReadonlyArray<string>, dependenciesOfNode: (node: string) => Iterable<string>): Edges => {
  let forward = HashMap.empty<string, HashSet.HashSet<string>>();
  let reverse = HashMap.fromIterable(A.map(order, (node) => [node, HashSet.empty<string>()] as const));
  for (const node of order) {
    const deps = HashSet.fromIterable(dependenciesOfNode(node));
    forward = HashMap.set(forward, node, deps);
    for (const dep of deps) reverse = HashMap.modify(reverse, dep, HashSet.add(node));
  }
  return { order, forward, reverse };
};

const closureOf = (forward: Edges["forward"], roots: ReadonlyArray<string>): MutableHashSet.MutableHashSet<string> => {
  const needed = MutableHashSet.empty<string>();
  const queue = [...roots];
  for (const current of queue) {
    if (MutableHashSet.has(needed, current)) continue;
    MutableHashSet.add(needed, current);
    queue.push(...A.filter(dependenciesOf(forward, current), (dependency) => !MutableHashSet.has(needed, dependency)));
  }
  return needed;
};

const reachesCycle = (
  forward: Edges["forward"],
  start: string,
  marks: {
    readonly visited: MutableHashSet.MutableHashSet<string>;
    readonly onStack: MutableHashSet.MutableHashSet<string>;
  }
): boolean => {
  const { visited, onStack } = marks;
  const stack: Array<{ readonly node: string; readonly deps: Array<string>; cursor: number }> = [
    { node: start, deps: dependenciesOf(forward, start), cursor: 0 },
  ];
  MutableHashSet.add(visited, start);
  MutableHashSet.add(onStack, start);
  while (stack.length > 0) {
    const frame = O.getOrThrow(A.last(stack));
    if (frame.cursor >= frame.deps.length) {
      MutableHashSet.remove(onStack, frame.node);
      stack.pop();
      continue;
    }
    const next = O.getOrThrow(A.get(frame.deps, frame.cursor));
    frame.cursor += 1;
    if (MutableHashSet.has(onStack, next)) return true;
    if (MutableHashSet.has(visited, next)) continue;
    MutableHashSet.add(visited, next);
    MutableHashSet.add(onStack, next);
    stack.push({ node: next, deps: dependenciesOf(forward, next), cursor: 0 });
  }
  return false;
};

const completeLevel = (
  edges: Edges,
  remaining: MutableHashMap.MutableHashMap<string, number>,
  level: ReadonlyArray<string>
): Array<string> => {
  const next: Array<string> = [];
  for (const done of level) {
    MutableHashMap.remove(remaining, done);
    for (const dependent of O.getOrElse(HashMap.get(edges.reverse, done), HashSet.empty<string>)) {
      const decremented = O.getOrThrow(MutableHashMap.get(remaining, dependent)) - 1;
      MutableHashMap.set(remaining, dependent, decremented);
      if (decremented === 0) next.push(dependent);
    }
  }
  return A.sort(next, Str.Order);
};

const kahn = (
  edges: Edges
): { readonly levels: ReadonlyArray<ReadonlyArray<string>>; readonly stalled: ReadonlyArray<string> } => {
  const remaining = MutableHashMap.empty<string, number>();
  for (const [node, deps] of edges.forward) MutableHashMap.set(remaining, node, HashSet.size(deps));

  const levels: Array<Array<string>> = [];
  let current = pipe(
    [...remaining],
    A.filter(([, count]) => count === 0),
    A.map(([node]) => node)
  );
  current = A.sort(current, Str.Order);

  while (current.length > 0) {
    levels.push(current);
    current = completeLevel(edges, remaining, current);
  }

  return { levels, stalled: remaining.pipe(MutableHashMap.keys, A.fromIterable, A.sort(Str.Order)) };
};
