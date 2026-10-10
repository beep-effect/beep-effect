import { assert, describe, it, layer } from "@effect/vitest";
import type { DependencyField } from "../../effected/npm/index.ts";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import { DependencyGraph, WorkspaceDiscovery, WorkspacePackage } from "../../effected/workspaces/index.ts";
import type { LayeringGraph } from "../../effected/workspaces/testing.ts";
import { LayerEdge, LayerPolicy, WorkspaceLayering } from "../../effected/workspaces/testing.ts";

const edge = (from: string, to: string, field: DependencyField = "dependencies"): LayerEdge =>
	LayerEdge.make({ from, to, field });

const POLICY = LayerPolicy.make({
	layers: [["app"], ["front-a", "front-b"], ["engine"], ["core"]],
	tooling: ["tool"],
	unconstrained: ["@e2e/*", "root"],
	requiredEdges: ["front-a -> engine"],
});

const CLEAN: LayeringGraph = {
	names: ["root", "app", "front-a", "front-b", "engine", "core", "tool", "@e2e/smoke"],
	edges: [
		edge("app", "front-a"),
		edge("app", "front-b"),
		edge("front-a", "engine"),
		edge("front-b", "engine", "peerDependencies"),
		edge("engine", "core"),
		edge("core", "tool", "devDependencies"),
		edge("@e2e/smoke", "app", "devDependencies"),
		edge("root", "tool", "devDependencies"),
	],
};
const plus = (...extra: ReadonlyArray<LayerEdge>): LayeringGraph => ({
	names: CLEAN.names,
	edges: [...CLEAN.edges, ...extra],
});
const offences = (graph: LayeringGraph, policy: LayerPolicy = POLICY): ReadonlyArray<string> =>
	WorkspaceLayering.check(graph, policy).offenders.map(({ edge: e, reason }) => `${reason}: ${e.label}`);

const pkg = (name: string, fields: Partial<Record<DependencyField, Record<string, string>>> = {}): WorkspacePackage =>
	WorkspacePackage.make({
		name,
		version: "1.0.0",
		path: `/repo/${name}`,
		packageJsonPath: `/repo/${name}/package.json`,
		relativePath: name,
		workspaceRoot: "/repo",
		...fields,
	});

describe("WorkspaceLayering.check", () => {
	it("a clean graph reports nothing, over a non-vacuous edge count", () => {
		const report = WorkspaceLayering.check(CLEAN, POLICY);
		assert.deepStrictEqual(report.violations, []);
		assert.strictEqual(report.edgeCount, 8);
	});

	it("rejects a sideways edge between two members of one layer", () => {
		assert.deepStrictEqual(offences(plus(edge("front-b", "front-a"))), [
			"sameLayer: front-b -> front-a (dependencies)",
		]);
	});

	it("rejects an upward edge, whichever field declares it", () => {
		assert.deepStrictEqual(offences(plus(edge("core", "front-a", "peerDependencies"))), [
			"upward: core -> front-a (peerDependencies)",
		]);
	});

	it("reports a three-node cycle by its members", () => {
		const policy = LayerPolicy.make({ layers: [["a"], ["b"], ["c"]], tooling: [], unconstrained: [] });
		const report = WorkspaceLayering.check(
			{ names: ["a", "b", "c"], edges: [edge("a", "b"), edge("b", "c"), edge("c", "a")] },
			policy,
		);
		assert.deepStrictEqual(report.cycle, O.some(["a", "b", "c"]));
		assert.include(report.violations, "dependency cycle among: a, b, c");
		assert.deepStrictEqual(
			offences({ names: ["a", "b", "c"], edges: [edge("a", "b"), edge("b", "c"), edge("c", "a")] }, policy),
			["upward: c -> a (dependencies)"],
		);
	});

	it("reports every package the policy does not classify, including an edgeless one and an unlisted root", () => {
		const graph: LayeringGraph = {
			names: [...CLEAN.names, "stray", "orphan"],
			edges: [...CLEAN.edges, edge("app", "stray"), edge("stray", "front-a")],
		};
		const report = WorkspaceLayering.check(graph, POLICY);
		assert.deepStrictEqual(report.unclassified, ["orphan", "stray"]);
		assert.deepStrictEqual(offences(graph), ["intoUnclassified: app -> stray (dependencies)"]);
		const noRoot = LayerPolicy.make({ layers: POLICY.layers, tooling: POLICY.tooling, unconstrained: ["@e2e/*"] });
		assert.deepStrictEqual(WorkspaceLayering.check(CLEAN, noRoot).unclassified, ["root"]);
	});

	it("skips edges out of an unconstrained package, and rejects edges into one", () => {
		assert.deepStrictEqual(offences(plus(edge("app", "@e2e/smoke"))), [
			"intoUnconstrained: app -> @e2e/smoke (dependencies)",
		]);
	});

	it("lets tooling depend on tooling but never reach an app layer", () => {
		const policy = LayerPolicy.make({
			layers: POLICY.layers,
			tooling: ["tool", "tool2"],
			unconstrained: POLICY.unconstrained,
		});
		const graph: LayeringGraph = {
			names: [...CLEAN.names, "tool2"],
			edges: [...CLEAN.edges, edge("tool", "tool2"), edge("tool", "core")],
		};
		assert.deepStrictEqual(offences(graph, policy), ["toolingReachesLayer: tool -> core (dependencies)"]);
	});

	it("reports a required edge that is absent, or present only in an unchecked field", () => {
		const policy = LayerPolicy.make({
			...POLICY,
			requiredEdges: ["front-a -> engine", "app -> core", "core -> tool"],
			fields: ["dependencies"],
		});
		assert.deepStrictEqual(WorkspaceLayering.check(CLEAN, policy).missingRequiredEdges, [
			"app -> core",
			"core -> tool",
		]);
	});

	it("rejects an empty graph as vacuous and names every declared package it could not find", () => {
		const report = WorkspaceLayering.check({ names: [], edges: [] }, POLICY);
		assert.strictEqual(report.edgeCount, 0);
		assert.include(report.violations, "no workspace edges in the checked fields: the check is vacuous");
		assert.deepStrictEqual(report.missingDeclared, ["app", "core", "engine", "front-a", "front-b", "tool"]);
		assert.deepStrictEqual(report.missingRequiredEdges, ["front-a -> engine"]);
	});

	it("reports a package declared twice, or declared and also matched by an unconstrained glob", () => {
		const policy = LayerPolicy.make({ layers: [["a"], ["a", "b", "c1"]], tooling: ["b"], unconstrained: ["c*"] });
		assert.deepStrictEqual(WorkspaceLayering.check({ names: ["a", "b", "c1"], edges: [] }, policy).duplicates, [
			"a",
			"b",
			"c1",
		]);
	});

	it("sees a cycle closed only by a devDependency exactly when devDependencies are checked", () => {
		const graph: LayeringGraph = { names: ["a", "b"], edges: [edge("a", "b"), edge("b", "a", "devDependencies")] };
		const all = LayerPolicy.make({ layers: [["a"], ["b"]], tooling: [], unconstrained: [] });
		assert.deepStrictEqual(WorkspaceLayering.check(graph, all).cycle, O.some(["a", "b"]));
		const runtime = LayerPolicy.make({ ...all, fields: ["dependencies"] });
		const report = WorkspaceLayering.check(graph, runtime);
		assert.deepStrictEqual(report.cycle, O.none());
		assert.deepStrictEqual(report.violations, []);
		assert.strictEqual(report.edgeCount, 1);
	});
});

describe("WorkspaceLayering.edgesOf", () => {
	it("recomputes one edge per field where DependencyGraph merges them, by name whatever the protocol", () => {
		const packages = [
			pkg("a", {
				dependencies: { b: "workspace:^" },
				devDependencies: { b: "workspace:*" },
				peerDependencies: { effect: "^4.0.0" },
				optionalDependencies: { a: "*" },
			}),
			pkg("b"),
			pkg("c", { dependencies: { b: "^1.0.0" } }),
		];
		assert.deepStrictEqual(
			WorkspaceLayering.edgesOf(packages).map((e) => e.label),
			["a -> b (dependencies)", "a -> b (devDependencies)", "c -> b (dependencies)"],
		);
		assert.strictEqual(O.getOrUndefined(O.map(HashMap.get(DependencyGraph.make({ packages }).adjacency, "a"), HashSet.size)), 1);
	});
});

describe("WorkspaceLayering.checkWorkspace", () => {
	const PACKAGES = [
		pkg("app", { dependencies: { core: "workspace:^" } }),
		pkg("core"),
		pkg("side", { dependencies: { app: "workspace:^" } }),
	];
	layer(WorkspaceDiscovery.layerTest({ listPackages: Effect.suspend(() => Effect.succeed(PACKAGES)) }))((it) => {
		it.effect("checks the discovered packages", () =>
			Effect.gen(function* () {
				const policy = LayerPolicy.make({ layers: [["app", "side"], ["core"]], tooling: [], unconstrained: [] });
				const report = yield* WorkspaceLayering.checkWorkspace(policy);
				assert.strictEqual(report.edgeCount, 2);
				assert.deepStrictEqual(report.violations, ["sameLayer: side -> app (dependencies)"]);
			}),
		);
	});
});

describe("WorkspaceLayering: what a policy entry matches", () => {
	// okfit's shape: a private root named "okfit" at relativePath ".", and members
	// whose relativePath differs from their name. Every policy entry is matched
	// against WorkspacePackage.name, never relativePath.
	const at = (name: string, relativePath: string, dependencies: Record<string, string> = {}): WorkspacePackage =>
		WorkspacePackage.make({
			name,
			version: "1.0.0",
			path: `/repo/${relativePath}`,
			packageJsonPath: `/repo/${relativePath}/package.json`,
			relativePath,
			workspaceRoot: "/repo",
			dependencies,
		});
	const PACKAGES = [
		at("okfit", ".", { "@okfit/cli": "workspace:^" }),
		at("@okfit/cli", "packages/cli", { "@okfit/engine": "workspace:^" }),
		at("@okfit/engine", "packages/engine"),
		at("@okfit/tool", "tools/tool"),
	];
	layer(WorkspaceDiscovery.layerTest({ listPackages: Effect.suspend(() => Effect.succeed(PACKAGES)) }))((it) => {
		it.effect("layers, tooling and unconstrained all classify by name, so the root is matched as okfit", () =>
			Effect.gen(function* () {
				const report = yield* WorkspaceLayering.checkWorkspace(
					LayerPolicy.make({
						layers: [["@okfit/cli"], ["@okfit/engine"]],
						tooling: ["@okfit/tool"],
						unconstrained: ["okfit"],
					}),
				);
				assert.strictEqual(report.edgeCount, 2);
				assert.deepStrictEqual(report.violations, []);
			}),
		);

		it.effect("positive control: the same policy written in relativePaths classifies nothing", () =>
			Effect.gen(function* () {
				const report = yield* WorkspaceLayering.checkWorkspace(
					LayerPolicy.make({
						layers: [["packages/cli"], ["packages/engine"]],
						tooling: ["tools/tool"],
						unconstrained: [".", "packages/*"],
					}),
				);
				assert.deepStrictEqual(report.unclassified, ["@okfit/cli", "@okfit/engine", "@okfit/tool", "okfit"]);
			}),
		);
	});
});
