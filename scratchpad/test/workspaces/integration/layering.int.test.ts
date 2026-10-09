// @effect-diagnostics nodeBuiltinImport:skip-file
// The kit's own package graph, held to lib/configs/layers.json by the check it ships.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import type { DependencyField } from "../../../effected/npm/index.ts";
import { Effect, Layer } from "effect";
import { DependencyGraph, WorkspaceDiscovery, Workspaces } from "../../../effected/workspaces/index.ts";
import type { LayeringGraph } from "../../../effected/workspaces/testing.ts";
import { LayerEdge, LayerPolicy, WorkspaceLayering } from "../../../effected/workspaces/testing.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const Live = Workspaces.layer({ cwd: REPO }).pipe(
	Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
);

const facts = Effect.gen(function* () {
	const policy = yield* LayerPolicy.load(join(REPO, "lib", "configs", "layers.json"));
	const packages = yield* (yield* WorkspaceDiscovery).listPackages();
	const graph: LayeringGraph = { names: packages.map((pkg) => pkg.name), edges: WorkspaceLayering.edgesOf(packages) };
	return { policy, packages, graph };
});

const plus = (
	graph: LayeringGraph,
	from: string,
	to: string,
	field: DependencyField = "peerDependencies",
): LayeringGraph => ({
	names: graph.names,
	edges: [...graph.edges, LayerEdge.make({ from, to, field })],
});

describe("the kit's layering, checked by WorkspaceLayering", () => {
	layer(Live)((it) => {
		it.effect("the discovered workspace satisfies lib/configs/layers.json, over dozens of real edges", () =>
			Effect.gen(function* () {
				const { policy } = yield* facts;
				const report = yield* WorkspaceLayering.checkWorkspace(policy);
				assert.deepStrictEqual(report.violations, []);
				assert.isAbove(report.edgeCount, 40);
			}),
		);

		it.effect("each of spec §4's forbidden edges is rejected by this policy (positive controls)", () =>
			Effect.gen(function* () {
				const { policy, graph } = yield* facts;
				const reasons = (from: string, to: string) =>
					WorkspaceLayering.check(plus(graph, from, to), policy).offenders.map(
						({ edge, reason }) => `${reason} ${edge.from} -> ${edge.to}`,
					);
				assert.deepStrictEqual(reasons("@effected/cli", "@effected/mcp"), ["sameLayer @effected/cli -> @effected/mcp"]);
				assert.deepStrictEqual(reasons("@effected/mcp", "@effected/cli"), ["sameLayer @effected/mcp -> @effected/cli"]);
				assert.deepStrictEqual(reasons("@effected/mcp", "@effected/workspaces"), [
					"sameLayer @effected/mcp -> @effected/workspaces",
				]);
				assert.deepStrictEqual(reasons("@effected/workspaces", "@effected/mcp"), [
					"sameLayer @effected/workspaces -> @effected/mcp",
				]);
				assert.deepStrictEqual(reasons("@effected/engine", "@effected/semver"), [
					"sameLayer @effected/engine -> @effected/semver",
				]);
				assert.deepStrictEqual(reasons("@effected/engine", "@effected/cli"), [
					"upward @effected/engine -> @effected/cli",
				]);
			}),
		);

		it.effect(
			"test-only devDependency edges exist, sit outside the checked fields, and would be caught if checked",
			() =>
				Effect.gen(function* () {
					const { policy, graph } = yield* facts;
					assert.include(
						graph.edges.map((edge) => edge.label),
						"@effected/engine -> @effected/workspaces (devDependencies)",
					);
					const everyField = LayerPolicy.make({
						layers: policy.layers,
						tooling: policy.tooling,
						unconstrained: policy.unconstrained,
					});
					assert.include(
						WorkspaceLayering.check(graph, everyField).offenders.map(({ edge, reason }) => `${reason} ${edge.label}`),
						"upward @effected/engine -> @effected/workspaces (devDependencies)",
					);
				}),
		);

		it.effect("the whole graph, every field included, is acyclic", () =>
			Effect.gen(function* () {
				const { packages } = yield* facts;
				assert.isAbove(packages.length, 30);
				assert.isFalse(DependencyGraph.make({ packages }).hasCycle);
			}),
		);
	});
});
