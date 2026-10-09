// The inter-workspace dependency graph — a pure VALUE, not a service. Sorting
// is a pure function of the graph, so it lives here as a method.
//
// Cycle detection is ITERATIVE, so a long dependency chain cannot overflow the
// stack.

import * as Effect from "effect/Effect";
import * as Graph from "effect/Graph";
import * as S from "effect/Schema";
import { PackageNotFoundError } from "./WorkspaceDiscovery.ts";
import { WorkspacePackage } from "./WorkspacePackage.ts";

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
export class CyclicDependencyError extends S.TaggedError<CyclicDependencyError>()("CyclicDependencyError", {
	/** The packages participating in the cycle. */
	cycle: S.Array(S.String),
}) {
	/** Renders the cycle members into a one-line message. */
	override get message(): string {
		return `Cyclic workspace dependencies among: ${this.cycle.join(", ")}`;
	}
}

interface Edges {
	/** name → the workspace packages it depends on. */
	readonly forward: ReadonlyMap<string, ReadonlySet<string>>;
	/** name → the workspace packages that depend on it. */
	readonly reverse: ReadonlyMap<string, ReadonlySet<string>>;
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
 * import { Effect } from "effect";
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
export class DependencyGraph extends S.Class<DependencyGraph>("DependencyGraph")({
	/** The workspace packages the graph is drawn over. */
	packages: S.Array(WorkspacePackage),
}) {
	#edges: Edges | undefined;

	#index(): Edges {
		if (this.#edges !== undefined) return this.#edges;
		const names = new Set(this.packages.map((pkg) => pkg.name));
		const forward = new Map<string, Set<string>>();
		const reverse = new Map<string, Set<string>>();
		for (const name of names) {
			forward.set(name, new Set());
			reverse.set(name, new Set());
		}
		for (const pkg of this.packages) {
			for (const dependency of Object.keys(pkg.allDependencies)) {
				if (!names.has(dependency) || dependency === pkg.name) continue;
				forward.get(pkg.name)?.add(dependency);
				reverse.get(dependency)?.add(pkg.name);
			}
		}
		this.#edges = { forward, reverse };
		return this.#edges;
	}

	/** Every workspace package name, sorted. Total. */
	get names(): ReadonlyArray<string> {
		return [...this.#index().forward.keys()].sort();
	}

	/** The adjacency map: name → the names it depends on. Total. */
	get adjacency(): ReadonlyMap<string, ReadonlySet<string>> {
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
		const visited = new Set<string>();
		const onStack = new Set<string>();

		for (const start of forward.keys()) {
			if (visited.has(start)) continue;
			// Each frame is a node plus the iterator position into its dependencies.
			const stack: Array<{ readonly node: string; readonly deps: Array<string>; cursor: number }> = [
				{ node: start, deps: [...(forward.get(start) ?? [])], cursor: 0 },
			];
			visited.add(start);
			onStack.add(start);

			while (stack.length > 0) {
				const frame = stack[stack.length - 1];
				if (frame === undefined) break;
				if (frame.cursor >= frame.deps.length) {
					onStack.delete(frame.node);
					stack.pop();
					continue;
				}
				const next = frame.deps[frame.cursor];
				frame.cursor += 1;
				if (next === undefined) continue;
				if (onStack.has(next)) return true;
				if (visited.has(next)) continue;
				visited.add(next);
				onStack.add(next);
				stack.push({ node: next, deps: [...(forward.get(next) ?? [])], cursor: 0 });
			}
		}
		return false;
	}

	/** The workspace packages `name` depends on, sorted. */
	readonly dependenciesOf = Effect.fn("DependencyGraph.dependenciesOf")(
		(name: string): Effect.Effect<ReadonlyArray<string>, PackageNotFoundError> => {
			const deps = this.#index().forward.get(name);
			return deps === undefined
				? Effect.fail(PackageNotFoundError.make({ name, available: this.names }))
				: Effect.succeed([...deps].sort());
		},
	);

	/** The workspace packages that depend on `name`, sorted. */
	readonly dependentsOf = Effect.fn("DependencyGraph.dependentsOf")(
		(name: string): Effect.Effect<ReadonlyArray<string>, PackageNotFoundError> => {
			const dependents = this.#index().reverse.get(name);
			return dependents === undefined
				? Effect.fail(PackageNotFoundError.make({ name, available: this.names }))
				: Effect.succeed([...dependents].sort());
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
			const affected = new Set<string>();
			const queue = [...names];
			for (let head = 0; head < queue.length; head += 1) {
				const current = queue[head];
				if (current === undefined) continue;
				if (affected.has(current)) continue;
				affected.add(current);
				for (const dependent of reverse.get(current) ?? []) {
					if (!affected.has(dependent)) queue.push(dependent);
				}
			}
			return Effect.succeed([...affected].sort());
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
					if (!forward.has(name)) {
						return Effect.fail(PackageNotFoundError.make({ name, available: this.names }));
					}
				}

				const needed = new Set<string>();
				const queue = [...names];
				for (let head = 0; head < queue.length; head += 1) {
					const current = queue[head];
					if (current === undefined) continue;
					if (needed.has(current)) continue;
					needed.add(current);
					for (const dependency of forward.get(current) ?? []) {
						if (!needed.has(dependency)) queue.push(dependency);
					}
				}

				const subForward = new Map<string, ReadonlySet<string>>();
				const subReverse = new Map<string, Set<string>>();
				for (const node of needed) subReverse.set(node, new Set());
				for (const node of needed) {
					const deps = new Set([...(forward.get(node) ?? [])].filter((dep) => needed.has(dep)));
					subForward.set(node, deps);
					for (const dep of deps) subReverse.get(dep)?.add(node);
				}

				const subEdges: Edges = { forward: subForward, reverse: subReverse };
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
	const names = [...edges.forward.keys()].sort();
	const graph = Graph.directed<string, string>((mutable) => {
		const indexOf = new Map<string, Graph.NodeIndex>();
		for (const name of names) indexOf.set(name, Graph.addNode(mutable, name));
		for (const name of names) {
			const source = indexOf.get(name);
			if (source === undefined) continue;
			for (const dependency of [...(edges.forward.get(name) ?? [])].sort()) {
				const target = indexOf.get(dependency);
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
	const members = new Set<string>();
	for (const component of Graph.stronglyConnectedComponents(graph)) {
		if (component.length < 2) continue;
		for (const index of component) {
			const name = names[index];
			if (name !== undefined) members.add(name);
		}
	}
	return [...members].sort();
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
	const remaining = new Map<string, number>();
	for (const [node, deps] of edges.forward) remaining.set(node, deps.size);

	const levels: Array<Array<string>> = [];
	let current = [...remaining.entries()].filter(([, count]) => count === 0).map(([node]) => node);
	current.sort();

	while (current.length > 0) {
		levels.push(current);
		const next: Array<string> = [];
		for (const done of current) {
			remaining.delete(done);
			for (const dependent of edges.reverse.get(done) ?? []) {
				const count = remaining.get(dependent);
				if (count === undefined) continue;
				const decremented = count - 1;
				remaining.set(dependent, decremented);
				if (decremented === 0) next.push(dependent);
			}
		}
		next.sort();
		current = next;
	}

	return { levels, stalled: [...remaining.keys()].sort() };
};
