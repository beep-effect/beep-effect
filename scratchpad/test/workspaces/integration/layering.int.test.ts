// @effect-diagnostics nodeBuiltinImport:skip-file
// The lab's real source module graph, held to the upstream layer ordering.
// The whole-workspace acyclicity control uses the containing Bun workspace.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { afterAll, assert, describe, layer } from "@effect/vitest";
import type { DependencyField } from "../../../effected/npm/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import { DependencyGraph, WorkspaceDiscovery, Workspaces } from "../../../effected/workspaces/index.ts";
import type { LayeringGraph } from "../../../effected/workspaces/testing.ts";
import { LayerEdge, LayerPolicy, SourceBoundary, WorkspaceLayering } from "../../../effected/workspaces/testing.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const BunLive = Workspaces.layer({ cwd: REPO }).pipe(
	Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
);

const LAB = join(REPO, "scratchpad", "effected");
const TESTS = join(REPO, "scratchpad", "test");
const POLICY = fileURLToPath(new URL("./lab-layers.json", import.meta.url));

// Read actual module imports, including the tests' devDependency edges. The
// port uses relative sibling imports instead of workspace manifest specifiers.
const moduleGraph = (): LayeringGraph => {
	const modules = readdirSync(LAB, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && readdirSync(join(LAB, entry.name)).includes("index.ts"))
		.map((entry) => entry.name);
	const edges: Array<LayerEdge> = [];
	const scan = (directory: string, from: string, field: DependencyField): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const file = join(directory, entry.name);
			if (entry.isDirectory()) {
				if (!entry.name.startsWith(".") && entry.name !== "dist" && entry.name !== "node_modules") scan(file, from, field);
			} else if (entry.name.endsWith(".ts")) {
				for (const specifier of SourceBoundary.importSpecifiers(readFileSync(file, "utf8"))) {
					if (!specifier.startsWith(".")) continue;
					const target = resolve(dirname(file), specifier);
					const to = modules.find((name) => target.startsWith(`${join(LAB, name)}/`));
					if (to === undefined || to === from) continue;
					const edge = LayerEdge.make({ from: `@lab/${from}`, to: `@lab/${to}`, field });
					if (!edges.some((existing) => existing.label === edge.label)) edges.push(edge);
				}
			}
		}
	};
	for (const name of modules) {
		scan(join(LAB, name), name, "dependencies");
		scan(join(TESTS, name), name, "devDependencies");
	}
	return { names: modules.map((name) => `@lab/${name}`), edges };
};

// Materialize the real source graph as Bun workspace manifests so these remain
// discovery + policy integration tests. Nothing is installed or fetched.
const LAB_WORKSPACE = mkdtempSync(join(tmpdir(), "workspaces-lab-graph-"));
const sourceGraph = moduleGraph();
writeFileSync(join(LAB_WORKSPACE, "package.json"), JSON.stringify({
	name: "lab-module-graph", private: true, workspaces: ["modules/*"],
}));
for (const name of sourceGraph.names) {
	const directory = join(LAB_WORKSPACE, "modules", name.slice("@lab/".length));
	mkdirSync(directory, { recursive: true });
	const dependencies = (field: DependencyField) => R.fromEntries(sourceGraph.edges
		.filter((edge) => edge.from === name && edge.field === field)
		.map((edge) => [edge.to, "workspace:*"]));
	writeFileSync(join(directory, "package.json"), JSON.stringify({
		name, version: "0.0.0", type: "module",
		dependencies: dependencies("dependencies"), devDependencies: dependencies("devDependencies"),
	}));
}
afterAll(() => rmSync(LAB_WORKSPACE, { recursive: true, force: true }));
const Live = Workspaces.layer({ cwd: LAB_WORKSPACE }).pipe(
	Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
);

const facts = Effect.gen(function* () {
	const policy = yield* LayerPolicy.load(POLICY);
	const packages = yield* (yield* WorkspaceDiscovery).listPackages;
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
		it.effect("the lab module graph satisfies lab-layers.json, over dozens of real edges", () =>
			Effect.gen(function* () {
				const { policy } = yield* facts;
				const report = yield* WorkspaceLayering.checkWorkspace(policy);
				assert.deepStrictEqual(report.violations, []);
				assert.isAbove(report.edgeCount, 40);
			}),
		);

		it.effect("each equivalent forbidden lab edge is rejected by this policy (positive controls)", () =>
			Effect.gen(function* () {
				const { policy, graph } = yield* facts;
				const reasons = (from: string, to: string) =>
					WorkspaceLayering.check(plus(graph, from, to), policy).offenders.map(
						({ edge, reason }) => `${reason} ${edge.from} -> ${edge.to}`,
					);
				assert.deepStrictEqual(reasons("@lab/cli", "@lab/sbom"), ["sameLayer @lab/cli -> @lab/sbom"]);
				assert.deepStrictEqual(reasons("@lab/sbom", "@lab/cli"), ["sameLayer @lab/sbom -> @lab/cli"]);
				assert.deepStrictEqual(reasons("@lab/sbom", "@lab/workspaces"), [
					"sameLayer @lab/sbom -> @lab/workspaces",
				]);
				assert.deepStrictEqual(reasons("@lab/workspaces", "@lab/sbom"), [
					"sameLayer @lab/workspaces -> @lab/sbom",
				]);
				assert.deepStrictEqual(reasons("@lab/engine", "@lab/semver"), [
					"sameLayer @lab/engine -> @lab/semver",
				]);
				assert.deepStrictEqual(reasons("@lab/engine", "@lab/cli"), [
					"upward @lab/engine -> @lab/cli",
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
						"@lab/engine -> @lab/workspaces (devDependencies)",
					);
					const everyField = LayerPolicy.make({
						layers: policy.layers,
						tooling: policy.tooling,
						unconstrained: policy.unconstrained,
					});
					assert.include(
						WorkspaceLayering.check(graph, everyField).offenders.map(({ edge, reason }) => `${reason} ${edge.label}`),
						"upward @lab/engine -> @lab/workspaces (devDependencies)",
					);
				}),
		);

	});
	layer(BunLive)((it) => {
		it.effect("the whole graph, every field included, is acyclic", () =>
			Effect.gen(function* () {
				const packages = yield* (yield* WorkspaceDiscovery).listPackages;
				assert.isAbove(packages.length, 30);
				assert.isFalse(DependencyGraph.make({ packages }).hasCycle);
			}),
		);
	});
});
