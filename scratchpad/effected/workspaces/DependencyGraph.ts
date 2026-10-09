// The inter-workspace dependency graph — a pure VALUE, not a service. Sorting
// is a pure function of the graph, so it lives here as a method.
//
// Cycle detection is ITERATIVE, so a long dependency chain cannot overflow the
// stack.

import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Str from "effect/String";
import * as Graph from "effect/Graph";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { PackageNotFoundError } from "./WorkspaceDiscovery.ts";
import { WorkspacePackage } from "./WorkspacePackage.ts";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/workspaces/DependencyGraph");

/**
 * Raised when the workspace dependency graph cannot be topologically ordered
 * because it contains a cycle.
 *
 * @remarks
 * `cycle` names the actual cycle members — the sorted union of every strongly
 * connected component with more than one package. Packages merely downstream
 * of a cycle are excluded, so it is exactly the set to break, not necessarily
 * a single ordered loop.
 *
 * @public
 */
export class CyclicDependencyError extends S.TaggedError<CyclicDependencyError>($I`CyclicDependencyError`)("CyclicDependencyError", {
	/** The packages participating in the cycle. */
	cycle: S.Array(S.String).annotateKey({ description: "The packages participating in the cycle." }),
}, $I.annote("CyclicDependencyError", { description: "Raised when the workspace dependency graph cannot be topologically ordered because it contains a cycle." })) {
	/** Renders the cycle members into a one-line message. */
	override get message(): string {
		return `Cyclic workspace dependencies among: ${this.cycle.join(", ")}`;
	}
}

interface Edges {
	/** Vertex order, independent of the hash map's iteration order. */
	readonly order: ReadonlyArray<string>;
	/** name → the workspace packages it depends on. */
	readonly forward: HashMap.HashMap<string, HashSet.HashSet<string>>;
	/** name → the workspace packages that depend on it. */
	readonly reverse: HashMap.HashMap<string, HashSet.HashSet<string>>;
}

// Core's `Graph` is already adopted in this file — `stronglyConnectedComponents`
// for the cycle payload, and `directed`/`addNode`/`addEdge`/`toMermaid` over the
// `materialize` helper below. What stays local is the *substrate* (the
// string-keyed forward/reverse index) plus `levels`, `affectedBy` and
// `sortSubset`.
//
// Why those three do not move onto core:
//
//   1. Core's `topo` **throws** `GraphError` on a cyclic graph (`Graph.ts:8084`)
//      rather than failing typed, and carries only a message — no cycle members.
//      `levels()` fails with `CyclicDependencyError` naming the offending
//      packages, so adopting `topo` would mean catching a defect and recomputing
//      the members anyway. Note this is a reason to pick call sites, not to avoid
//      the module: `stronglyConnectedComponents` throws only for *undirected*
//      graphs (`Graph.ts:5640`) and `materialize` builds `Graph.directed`, so the
//      adopted site above cannot throw on any graph this class can hold.
//   2. Core's `topo` yields a **flat** order. The product here is parallel build
//      *levels* — level n depends only on levels below it — which is the whole
//      reason this type exists and is not derivable from a flat order.
//   3. `affectedBy` (reverse reachability) has no core equivalent, and both it
//      and `sortSubset` need the reverse-edge index maintained below.
//
// Revisit only if core grows a level-partitioning traversal with a non-throwing
// error channel.

/**
 * The directed graph of dependencies **between workspace packages**. External
 * npm dependencies are not nodes.
 *
 * @remarks
 * A pure value over the discovered package list, with the edge indexes built
 * lazily into `#private` fields the schema never encodes. Edges are drawn from
 * `dependencies`, `devDependencies`, `peerDependencies` and
 * `optionalDependencies`; a self-edge is dropped.
 *
 * Total accessors never fail. The lookups fail with `PackageNotFoundError` for
 * an unknown name, and the ordering operations (`levels`, `sort`, `sortSubset`)
 * fail with {@link CyclicDependencyError} when the graph has a cycle.
 *
 * @example
 * ```ts
 * import { DependencyGraph, WorkspaceDiscovery } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const discovery = yield* WorkspaceDiscovery;
 *   const graph = DependencyGraph.make({ packages: yield* discovery.listPackages });
 *   return yield* graph.levels();
 * });
 * ```
 *
 * @public
 */
export class DependencyGraph extends S.Class<DependencyGraph>($I`DependencyGraph`)({
	/** The workspace packages the graph is drawn over. */
	packages: S.Array(WorkspacePackage).annotateKey({ description: "The workspace packages the graph is drawn over." }),
}, $I.annote("DependencyGraph", { description: "The directed graph of dependencies **between workspace packages**. External npm dependencies are not nodes." })) {
	#edges: Edges | undefined;

	#index(): Edges {
		if (this.#edges !== undefined) return this.#edges;
		const names = MutableHashSet.fromIterable(this.packages.map((pkg) => pkg.name));
		let forward = HashMap.empty<string, HashSet.HashSet<string>>();
		let reverse = HashMap.empty<string, HashSet.HashSet<string>>();
		for (const name of names) {
			forward = HashMap.set(forward, name, HashSet.empty<string>());
			reverse = HashMap.set(reverse, name, HashSet.empty<string>());
		}
		for (const pkg of this.packages) {
			for (const dependency of R.keys(pkg.allDependencies)) {
				if (!MutableHashSet.has(names, dependency) || dependency === pkg.name) continue;
				forward = HashMap.set(forward, pkg.name, HashSet.add(O.getOrElse(HashMap.get(forward, pkg.name), HashSet.empty<string>), dependency));
				reverse = HashMap.set(reverse, dependency, HashSet.add(O.getOrElse(HashMap.get(reverse, dependency), HashSet.empty<string>), pkg.name));
			}
		}
		this.#edges = { order: A.fromIterable(names), forward, reverse };
		return this.#edges;
	}

	/** Every workspace package name, sorted. Total. */
	get names(): ReadonlyArray<string> {
		return A.sort(this.#index().order, Str.Order);
	}

	/** The adjacency map: name → the names it depends on. Total. */
	get adjacency(): HashMap.HashMap<string, HashSet.HashSet<string>> {
		return this.#index().forward;
	}

	/**
	 * Whether the graph contains a cycle. Total.
	 *
	 * @remarks
	 * An explicit-stack DFS with an on-stack set — never recursive, so a long
	 * dependency chain cannot overflow.
	 */
	get hasCycle(): boolean {
		const { forward } = this.#index();
		const visited = MutableHashSet.empty<string>();
		const onStack = MutableHashSet.empty<string>();

		for (const start of this.#index().order) {
			if (MutableHashSet.has(visited, start)) continue;
			// Each frame is a node plus the iterator position into its dependencies.
			const stack: Array<{ readonly node: string; readonly deps: Array<string>; cursor: number }> = [
				{ node: start, deps: [...(O.getOrElse(HashMap.get(forward, start), HashSet.empty<string>))], cursor: 0 },
			];
			MutableHashSet.add(visited, start);
			MutableHashSet.add(onStack, start);

			while (stack.length > 0) {
				const frame = stack[stack.length - 1];
				if (frame === undefined) break;
				if (frame.cursor >= frame.deps.length) {
					MutableHashSet.remove(onStack, frame.node);
					stack.pop();
					continue;
				}
				const next = frame.deps[frame.cursor];
				frame.cursor += 1;
				if (next === undefined) continue;
				if (MutableHashSet.has(onStack, next)) return true;
				if (MutableHashSet.has(visited, next)) continue;
				MutableHashSet.add(visited, next);
				MutableHashSet.add(onStack, next);
				stack.push({ node: next, deps: [...(O.getOrElse(HashMap.get(forward, next), HashSet.empty<string>))], cursor: 0 });
			}
		}
		return false;
	}

	/** The workspace packages `name` depends on, sorted. */
	readonly dependenciesOf = Effect.fn("DependencyGraph.dependenciesOf")(
		(name: string): Effect.Effect<ReadonlyArray<string>, PackageNotFoundError> => {
			const deps = HashMap.get(this.#index().forward, name);
			return O.isNone(deps)
				? Effect.fail(PackageNotFoundError.make({ name, available: this.names }))
				: Effect.succeed(A.sort(A.fromIterable(deps.value), Str.Order));
		},
	);

	/** The workspace packages that depend on `name`, sorted. */
	readonly dependentsOf = Effect.fn("DependencyGraph.dependentsOf")(
		(name: string): Effect.Effect<ReadonlyArray<string>, PackageNotFoundError> => {
			const dependents = HashMap.get(this.#index().reverse, name);
			return O.isNone(dependents)
				? Effect.fail(PackageNotFoundError.make({ name, available: this.names }))
				: Effect.succeed(A.sort(A.fromIterable(dependents.value), Str.Order));
		},
	);

	/**
	 * Each of `names` plus every package that transitively depends on any of
	 * them — the blast radius of a change. Sorted and de-duplicated; the given
	 * names are included, whether or not the graph knows them.
	 *
	 * @param names - The changed package names.
	 */
	readonly affectedBy = Effect.fn("DependencyGraph.affectedBy")(
		(names: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<string>, never> => {
			const { reverse } = this.#index();
			const affected = MutableHashSet.empty<string>();
			const queue = [...names];
			for (let head = 0; head < queue.length; head += 1) {
				const current = queue[head];
				if (current === undefined) continue;
				if (MutableHashSet.has(affected, current)) continue;
				MutableHashSet.add(affected, current);
				for (const dependent of O.getOrElse(HashMap.get(reverse, current), HashSet.empty<string>)) {
					if (!MutableHashSet.has(affected, dependent)) queue.push(dependent);
				}
			}
			return Effect.succeed(A.sort(A.fromIterable(affected), Str.Order));
		},
	);

	/**
	 * Packages grouped into parallel build levels: level 0 depends on nothing in
	 * the workspace, level *n* depends only on levels below it.
	 *
	 * @remarks
	 * Kahn's algorithm over the reverse-edge index, linear in the edge count.
	 * Each level is sorted lexicographically, so the output is deterministic.
	 */
	readonly levels = Effect.fn("DependencyGraph.levels")(
		(): Effect.Effect<ReadonlyArray<ReadonlyArray<string>>, CyclicDependencyError> =>
			Effect.suspend(() => {
				const edges = this.#index();
				const result = kahn(edges);
				return result.stalled.length > 0
					? Effect.fail(CyclicDependencyError.make({ cycle: cycleMembers(edges) }))
					: Effect.succeed(result.levels);
			}),
	);

	/** The flattened topological order — `levels()` concatenated. */
	readonly sort = Effect.fn("DependencyGraph.sort")(
		(): Effect.Effect<ReadonlyArray<string>, CyclicDependencyError> =>
			this.levels().pipe(Effect.map((levels) => levels.flat())),
	);

	/**
	 * A topological order over `names` plus their transitive workspace
	 * dependencies — the build order for a subset.
	 *
	 * @remarks
	 * Fails with `PackageNotFoundError` for a name the graph does not contain,
	 * and with {@link CyclicDependencyError} when the subset's closure has a
	 * cycle.
	 *
	 * @param names - The packages to build; each must be a workspace package.
	 */
	readonly sortSubset = Effect.fn("DependencyGraph.sortSubset")(
		(
			names: ReadonlyArray<string>,
		): Effect.Effect<ReadonlyArray<string>, CyclicDependencyError | PackageNotFoundError> =>
			Effect.suspend((): Effect.Effect<ReadonlyArray<string>, CyclicDependencyError | PackageNotFoundError> => {
				const { forward } = this.#index();
				for (const name of names) {
					if (!HashMap.has(forward, name)) {
						return Effect.fail(PackageNotFoundError.make({ name, available: this.names }));
					}
				}

				const needed = MutableHashSet.empty<string>();
				const queue = [...names];
				for (let head = 0; head < queue.length; head += 1) {
					const current = queue[head];
					if (current === undefined) continue;
					if (MutableHashSet.has(needed, current)) continue;
					MutableHashSet.add(needed, current);
					for (const dependency of O.getOrElse(HashMap.get(forward, current), HashSet.empty<string>)) {
						if (!MutableHashSet.has(needed, dependency)) queue.push(dependency);
					}
				}

				let subForward = HashMap.empty<string, HashSet.HashSet<string>>();
				let subReverse = HashMap.empty<string, HashSet.HashSet<string>>();
				const order = A.fromIterable(needed);
				for (const node of order) subReverse = HashMap.set(subReverse, node, HashSet.empty<string>());
				for (const node of order) {
					const deps = forward.pipe(
						HashMap.get(node),
						O.getOrElse(HashSet.empty<string>),
						A.fromIterable,
						A.filter((dep) => MutableHashSet.has(needed, dep)),
						HashSet.fromIterable,
					);
					subForward = HashMap.set(subForward, node, deps);
					for (const dep of deps) {
						subReverse = HashMap.set(subReverse, dep, HashSet.add(
							O.getOrElse(HashMap.get(subReverse, dep), HashSet.empty<string>), node,
						));
					}
				}

				const subEdges: Edges = { order, forward: subForward, reverse: subReverse };
				const result = kahn(subEdges);
				return result.stalled.length > 0
					? Effect.fail(CyclicDependencyError.make({ cycle: cycleMembers(subEdges) }))
					: Effect.succeed(result.levels.flat());
			}),
	);

	/**
	 * The graph rendered as a Mermaid `flowchart TD`. Total.
	 *
	 * @remarks
	 * Renders through core's `Graph.toMermaid` over a transient graph built from
	 * the edge index. Node IDs are numeric indexes assigned in sorted-name order
	 * and package names appear only inside quoted labels, so scoped names
	 * (`@scope/a`) never break Mermaid syntax. Nodes and each node's edges are
	 * emitted in sorted order — the output is deterministic regardless of
	 * manifest key order.
	 */
	toMermaid(): string {
		return Graph.toMermaid(materialize(this.#index()).graph, { edgeLabel: () => "" });
	}
}

/**
 * Materializes the forward map into a transient core `Graph`: nodes in
 * sorted-name order (so `NodeIndex` *i* is `names[i]`) and each node's edges
 * in sorted-target order, making the graph — and everything derived from it —
 * deterministic for a given edge index.
 */
const materialize = (
	edges: Edges,
): { readonly graph: Graph.DirectedGraph<string, string>; readonly names: ReadonlyArray<string> } => {
	const names = A.sort(edges.order, Str.Order);
	const graph = Graph.directed<string, string>((mutable) => {
		const indexOf = MutableHashMap.empty<string, Graph.NodeIndex>();
		for (const name of names) MutableHashMap.set(indexOf, name, Graph.addNode(mutable, name));
		for (const name of names) {
			const source = O.getOrUndefined(MutableHashMap.get(indexOf, name));
			if (source === undefined) continue;
			for (const dependency of A.sort(A.fromIterable(O.getOrElse(HashMap.get(edges.forward, name), HashSet.empty<string>)), Str.Order)) {
				const target = O.getOrUndefined(MutableHashMap.get(indexOf, dependency));
				if (target !== undefined) Graph.addEdge(mutable, source, target, "");
			}
		}
	});
	return { graph, names };
};

/**
 * The packages participating in a dependency cycle — the sorted union of every
 * strongly connected component with more than one member, via core's
 * `Graph.stronglyConnectedComponents`. Self-edges are dropped at index time,
 * so a single-member component is never cyclic here.
 */
const cycleMembers = (edges: Edges): ReadonlyArray<string> => {
	const { graph, names } = materialize(edges);
	const members = MutableHashSet.empty<string>();
	for (const component of Graph.stronglyConnectedComponents(graph)) {
		if (component.length < 2) continue;
		for (const index of component) {
			const name = names[index];
			if (name !== undefined) MutableHashSet.add(members, name);
		}
	}
	return A.sort(A.fromIterable(members), Str.Order);
};

/**
 * Kahn's algorithm. `forward[A] = {B}` reads "A depends on B", so level 0 is
 * the set with an out-degree of zero and each completed level decrements its
 * dependents through the reverse index.
 *
 * A non-empty `stalled` only signals *that* a cycle exists — it holds every
 * unprocessed node, including ones merely downstream of a cycle. The error
 * payload names the actual members via `cycleMembers`.
 */
const kahn = (
	edges: Edges,
): { readonly levels: ReadonlyArray<ReadonlyArray<string>>; readonly stalled: ReadonlyArray<string> } => {
	const remaining = MutableHashMap.empty<string, number>();
	for (const [node, deps] of edges.forward) MutableHashMap.set(remaining, node, HashSet.size(deps));

	const levels: Array<Array<string>> = [];
	let current = [...remaining].filter(([, count]) => count === 0).map(([node]) => node);
	current = A.sort(current, Str.Order);

	while (current.length > 0) {
		levels.push(current);
		const next: Array<string> = [];
		for (const done of current) {
			MutableHashMap.remove(remaining, done);
			for (const dependent of O.getOrElse(HashMap.get(edges.reverse, done), HashSet.empty<string>)) {
				const count = O.getOrUndefined(MutableHashMap.get(remaining, dependent));
				if (count === undefined) continue;
				const decremented = count - 1;
				MutableHashMap.set(remaining, dependent, decremented);
				if (decremented === 0) next.push(dependent);
			}
		}
		current = A.sort(next, Str.Order);
	}

	return { levels, stalled: remaining.pipe(MutableHashMap.keys, A.fromIterable, A.sort(Str.Order)) };
};
