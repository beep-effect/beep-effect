import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CyclicDependencyError, DependencyGraph, PackageNotFoundError, WorkspacePackage } from "../../effected/workspaces/index.ts";

/** A workspace member with the given dependency edges. */
const pkg = (
	name: string,
	deps: Record<string, string> = {},
	kind: "dependencies" | "devDependencies" = "dependencies",
) =>
	WorkspacePackage.make({
		name,
		version: "1.0.0",
		path: `/repo/packages/${name}`,
		packageJsonPath: `/repo/packages/${name}/package.json`,
		relativePath: `packages/${name}`,
		workspaceRoot: "/repo",
		[kind]: deps,
	});

// a → b → c, and d standing alone. `a` depends on `b`, so `b` builds first.
const chain = DependencyGraph.make({
	packages: [pkg("a", { b: "1.0.0" }), pkg("b", { c: "1.0.0" }), pkg("c"), pkg("d")],
});

describe("DependencyGraph", () => {
	it("only draws edges BETWEEN workspace packages, never to external deps", () => {
		const graph = DependencyGraph.make({
			packages: [pkg("a", { b: "1.0.0", react: "^19.0.0" }), pkg("b")],
		});
		assert.deepStrictEqual([...(graph.adjacency.get("a") ?? [])], ["b"]);
	});

	it("draws edges from devDependencies too", () => {
		const graph = DependencyGraph.make({
			packages: [pkg("a", { b: "1.0.0" }, "devDependencies"), pkg("b")],
		});
		assert.deepStrictEqual([...(graph.adjacency.get("a") ?? [])], ["b"]);
	});

	it("drops a self-edge", () => {
		const graph = DependencyGraph.make({ packages: [pkg("a", { a: "1.0.0" })] });
		assert.deepStrictEqual([...(graph.adjacency.get("a") ?? [])], []);
		assert.isFalse(graph.hasCycle);
	});

	it("names lists every package sorted", () => {
		assert.deepStrictEqual(chain.names, ["a", "b", "c", "d"]);
	});

	it("hasCycle is false for an acyclic graph", () => {
		assert.isFalse(chain.hasCycle);
	});

	it("hasCycle is true for a two-node cycle", () => {
		const graph = DependencyGraph.make({ packages: [pkg("a", { b: "1.0.0" }), pkg("b", { a: "1.0.0" })] });
		assert.isTrue(graph.hasCycle);
	});

	it("hasCycle is true for a three-node cycle reached through a DAG prefix", () => {
		// `root` is acyclic and visited first, so a detector that only inspects the
		// first component — or that forgets to clear its on-stack set — misses this.
		const graph = DependencyGraph.make({
			packages: [
				pkg("root", { a: "1.0.0" }),
				pkg("a", { b: "1.0.0" }),
				pkg("b", { c: "1.0.0" }),
				pkg("c", { a: "1.0.0" }),
			],
		});
		assert.isTrue(graph.hasCycle);
	});

	it("hasCycle is false for a diamond — a re-visited node is not a cycle", () => {
		// The classic false positive: `d` is reachable from both `b` and `c`. A
		// detector that treats "already visited" as "on the stack" reports a cycle.
		const graph = DependencyGraph.make({
			packages: [pkg("a", { b: "1.0.0", c: "1.0.0" }), pkg("b", { d: "1.0.0" }), pkg("c", { d: "1.0.0" }), pkg("d")],
		});
		assert.isFalse(graph.hasCycle);
	});

	// The explicit timeout: the claim is stack-safety, not latency. The walk
	// is ~375ms uninstrumented, but v8 coverage on a shared CI runner
	// amplifies wall time well past the 5s default (observed 18x elsewhere in
	// this repo). A RangeError still fails instantly; only the legitimate
	// walk needs the headroom.
	it("cycle detection does not overflow on a long chain", () => {
		// 20,000 links. A recursive DFS — which is what v3 shipped — throws
		// RangeError here, and a RangeError is an unhandled defect.
		const packages = Array.from({ length: 20_000 }, (_, i) =>
			i === 19_999 ? pkg(`p${i}`) : pkg(`p${i}`, { [`p${i + 1}`]: "1.0.0" }),
		);
		assert.isFalse(DependencyGraph.make({ packages }).hasCycle);
	}, 30_000);

	it.effect("levels groups packages into parallel build tiers, leaves first", () =>
		Effect.gen(function* () {
			const levels = yield* chain.levels();
			assert.deepStrictEqual(levels, [["c", "d"], ["b"], ["a"]]);
		}),
	);

	it.effect("sort flattens the levels into one deterministic order", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* chain.sort(), ["c", "d", "b", "a"]);
		}),
	);

	it.effect("sort fails typed on a cycle, naming the cycle members", () =>
		Effect.gen(function* () {
			const graph = DependencyGraph.make({
				packages: [pkg("a", { b: "1.0.0" }), pkg("b", { a: "1.0.0" }), pkg("free")],
			});
			const error = yield* Effect.flip(graph.sort());
			assert.instanceOf(error, CyclicDependencyError);
			assert.deepStrictEqual(error.cycle, ["a", "b"]);
		}),
	);

	it.effect("the cycle payload excludes packages merely DOWNSTREAM of the cycle", () =>
		Effect.gen(function* () {
			// a↔b cycle, c depends on a. Kahn's stalled set is ["a", "b", "c"] — c
			// never clears because its dependency chain is blocked — but c is not a
			// cycle member. The old payload was the stalled set; this discriminates.
			const graph = DependencyGraph.make({
				packages: [pkg("a", { b: "1.0.0" }), pkg("b", { a: "1.0.0" }), pkg("c", { a: "1.0.0" })],
			});
			const error = yield* Effect.flip(graph.levels());
			assert.instanceOf(error, CyclicDependencyError);
			assert.deepStrictEqual(error.cycle, ["a", "b"]);
		}),
	);

	it.effect("two independent cycles yield the sorted union of both", () =>
		Effect.gen(function* () {
			const graph = DependencyGraph.make({
				packages: [
					pkg("a", { b: "1.0.0" }),
					pkg("b", { a: "1.0.0" }),
					pkg("c", { d: "1.0.0" }),
					pkg("d", { c: "1.0.0" }),
				],
			});
			const error = yield* Effect.flip(graph.sort());
			assert.instanceOf(error, CyclicDependencyError);
			assert.deepStrictEqual(error.cycle, ["a", "b", "c", "d"]);
		}),
	);

	it.effect("dependenciesOf returns the direct workspace dependencies", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* chain.dependenciesOf("a"), ["b"]);
			assert.deepStrictEqual(yield* chain.dependenciesOf("c"), []);
		}),
	);

	it.effect("dependentsOf returns the direct reverse edges", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* chain.dependentsOf("b"), ["a"]);
			assert.deepStrictEqual(yield* chain.dependentsOf("a"), []);
		}),
	);

	it.effect("dependenciesOf fails typed on an unknown package", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(chain.dependenciesOf("nope"));
			assert.instanceOf(error, PackageNotFoundError);
			assert.deepStrictEqual(error.available, ["a", "b", "c", "d"]);
		}),
	);

	it.effect("affectedBy walks the reverse edges TRANSITIVELY", () =>
		Effect.gen(function* () {
			// `c` is at the far end of the chain: a→b→c. Changing it affects b AND a.
			// A one-hop implementation returns ["b", "c"] and passes a lazier test.
			assert.deepStrictEqual(yield* chain.affectedBy(["c"]), ["a", "b", "c"]);
		}),
	);

	it.effect("affectedBy includes the seeds themselves and dedupes", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* chain.affectedBy(["b", "c"]), ["a", "b", "c"]);
		}),
	);

	it.effect("affectedBy on an isolated package returns just it", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* chain.affectedBy(["d"]), ["d"]);
		}),
	);

	it.effect("sortSubset pulls in transitive dependencies, not just the named packages", () =>
		Effect.gen(function* () {
			// Asking for `a` alone must still build `c` then `b` first.
			assert.deepStrictEqual(yield* chain.sortSubset(["a"]), ["c", "b", "a"]);
		}),
	);

	it.effect("sortSubset excludes packages outside the closure", () =>
		Effect.gen(function* () {
			const order = yield* chain.sortSubset(["b"]);
			assert.deepStrictEqual(order, ["c", "b"]);
			assert.notInclude(order, "d");
		}),
	);

	it.effect("sortSubset fails typed on an unknown name", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(chain.sortSubset(["nope"]));
			assert.instanceOf(error, PackageNotFoundError);
		}),
	);

	it.effect("sortSubset's cycle payload also excludes downstream packages", () =>
		Effect.gen(function* () {
			// The subset closure of c is {a, b, c} — the cycle is only a↔b.
			const graph = DependencyGraph.make({
				packages: [pkg("a", { b: "1.0.0" }), pkg("b", { a: "1.0.0" }), pkg("c", { a: "1.0.0" })],
			});
			const error = yield* Effect.flip(graph.sortSubset(["c"]));
			assert.instanceOf(error, CyclicDependencyError);
			assert.deepStrictEqual(error.cycle, ["a", "b"]);
		}),
	);

	it("toMermaid renders scoped package names inside quoted labels, deterministically", () => {
		// Dependencies are declared out of sorted order on purpose: the edge list
		// must come out sorted regardless of manifest key order, and `@`/`/` must
		// survive as label text (node IDs are the numeric indexes).
		const graph = DependencyGraph.make({
			packages: [pkg("@scope/a", { "@scope/c": "1.0.0", "@scope/b": "1.0.0" }), pkg("@scope/b"), pkg("@scope/c")],
		});
		assert.strictEqual(
			graph.toMermaid(),
			["flowchart TD", '  0["@scope/a"]', '  1["@scope/b"]', '  2["@scope/c"]', "  0 --> 1", "  0 --> 2"].join("\n"),
		);
	});

	it("make accepts a ReadonlyArray of packages without a spread copy", () => {
		// The type-level half IS the test: `packages` is declared readonly and
		// handed to `make` unspread. `Schema.Array`'s constructor input is
		// `ReadonlyArray<...>` on the pinned beta — if a regression narrows it
		// back to a mutable `Array`, this stops compiling.
		const packages: ReadonlyArray<WorkspacePackage> = [pkg("a", { b: "1.0.0" }), pkg("b")] as const;
		const graph = DependencyGraph.make({ packages });
		assert.deepStrictEqual(graph.names, ["a", "b"]);
		assert.deepStrictEqual([...(graph.adjacency.get("a") ?? [])], ["b"]);
	});
});
