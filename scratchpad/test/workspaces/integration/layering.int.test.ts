// @effect-diagnostics nodeBuiltinImport:skip-file -- nodeBuiltinImport because it scans the lab's own source tree synchronously at test collection. Owner: @beep/scratchpad. Exit: effected-promotion graduates the module and ports this test to @effect/vitest layer() and Effect platform services.
// The lab's real source module graph, held to the upstream layer ordering.
// The whole-workspace acyclicity control uses the containing Bun workspace.
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { MemoryFileSystem } from "@beep/memfs";
import type { DependencyField } from "@beep/npm-spec/DependencySection";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import { DependencyGraph, WorkspaceDiscovery, Workspaces } from "@beep/repo-workspaces";
import { LayerPolicy } from "@beep/repo-workspaces/LayerPolicy";
import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
import type { LayeringGraph } from "@beep/repo-workspaces/WorkspaceLayering";
import { LayerEdge, WorkspaceLayering } from "@beep/repo-workspaces/WorkspaceLayering";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const BunLive = Workspaces.layer({ cwd: REPO }).pipe(
	Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
);

const LAB = join(REPO, "scratchpad", "effected");
const TESTS = join(REPO, "scratchpad", "test");
const POLICY = fileURLToPath(new URL("./lab-layers.json", import.meta.url));

// Kit modules waves 1a, 1b, 2a and 2b of the effected promotion moved out of the lab
// into `@beep/*` packages keep their lab layer: an import of the package
// (`@beep/<pkg>` or `@beep/<pkg>/<File>`) is an edge to the lab module it was,
// and the package's own `src` and `test` are scanned as that module's source and
// tests were. `templates` was promoted under the name `@beep/managed-section`.
// Wave 2a split two modules: the pure halves of `npm` and `tsconfig-json` are
// `@beep/npm-spec` and `@beep/tsconfig`, and their IO halves stay lab
// directories, so each package and its lab half fold into the one lab module.
// Wave 2b promoted `walker` whole as `@beep/walker` and `env` whole as `@beep/runtime-env`;
// wave 2d promoted `markdown` whole as `@beep/markdown`. Wave 3-1 split `github-actions`:
// its reporting suite is `@beep/github-reporting` and the drivers stay a lab
// directory, so the package folds into the `github-actions` lab module. Wave 3-2 promoted
// the `tsconfig-json` IO half as `@beep/repo-tsconfig`, which folds into `tsconfig-json`
// beside `@beep/tsconfig`. Wave 3-3 promoted `config-file` whole as `@beep/config-file`,
// and wave 4-X promoted `xdg` whole as `@beep/xdg`.
// Wave 4-W-a promoted the `workspaces` core and config-deps half as `@beep/repo-workspaces`,
// and wave 4-W-b moved its `./testing` cluster into the same package, so no lab
// `workspaces` source directory remains. A promoted module's remaining lab directory
// still counts as that module even without its barrel (the `sbom` signer below).
// Wave 4-S split `sbom` the same way: its pure models are `@beep/sbom` and the Sigstore
// signer stays a lab directory, so the package folds into the `sbom` lab module.
// Wave 5 promoted the rest of `github-actions` as `@beep/github-actions`; with
// `@beep/github-reporting` it folds into the `github-actions` lab module, which no
// longer has a lab directory.
// Every other kit module is still a lab directory reached relatively.
const PROMOTED: Readonly<Record<string, string>> = {
	"@beep/cli-kit": "cli",
	"@beep/commands": "commands",
	"@beep/config-file": "config-file",
	"@beep/git": "git",
	"@beep/github": "github",
	"@beep/github-commands": "github-commands",
	"@beep/github-references": "github-references",
	"@beep/github-actions": "github-actions",
	"@beep/github-reporting": "github-actions",
	"@beep/glob": "glob",
	"@beep/jsonc": "jsonc",
	"@beep/jsonl": "jsonl",
	"@beep/lockfiles": "lockfiles",
	"@beep/managed-section": "templates",
	"@beep/markdown": "markdown",
	"@beep/memfs": "memfs",
	"@beep/npm-spec": "npm",
	"@beep/package-json": "package-json",
	"@beep/repo-tsconfig": "tsconfig-json",
	"@beep/repo-workspaces": "workspaces",
	"@beep/runtime-env": "env",
	"@beep/sbom": "sbom",
	"@beep/schema-org": "schema-org",
	"@beep/semver": "semver",
	"@beep/spdx": "spdx",
	"@beep/toml": "toml",
	"@beep/tsconfig": "tsconfig-json",
	"@beep/walker": "walker",
	"@beep/xdg": "xdg",
	"@beep/yaml": "yaml",
};
// Each package's directory, resolved the way the lab's own imports resolve it.
const labRequire = createRequire(join(REPO, "scratchpad", "package.json"));
const promotedRoot = (pkg: string): string => dirname(realpathSync(labRequire.resolve(`${pkg}/package.json`)));

// Read actual module imports, including the tests' devDependency edges. The
// port uses relative sibling imports instead of workspace manifest specifiers;
// promoted kit modules are reached through their bare package specifiers.
const moduleGraph = (): LayeringGraph.Input => {
	const labModules = readdirSync(LAB, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && (readdirSync(join(LAB, entry.name)).includes("index.ts") || R.values(PROMOTED).includes(entry.name)))
		.map((entry) => entry.name);
	const modules = A.dedupe([...labModules, ...R.values(PROMOTED)]);
	const edges: Array<LayerEdge> = [];
	const scan = (directory: string, from: string, field: DependencyField): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const file = join(directory, entry.name);
			if (entry.isDirectory()) {
				if (!entry.name.startsWith(".") && entry.name !== "dist" && entry.name !== "node_modules") scan(file, from, field);
			} else if (entry.name.endsWith(".ts")) {
				for (const specifier of SourceBoundary.importSpecifiers(readFileSync(file, "utf8"))) {
					const to = specifier.startsWith(".")
						? labModules.find((name) => resolve(dirname(file), specifier).startsWith(`${join(LAB, name)}/`))
						: O.getOrUndefined(R.get(PROMOTED, specifier.split("/").slice(0, 2).join("/")));
					if (to === undefined || to === from) continue;
					const edge = LayerEdge.make({ from: `@lab/${from}`, to: `@lab/${to}`, field });
					if (!edges.some((existing) => existing.label === edge.label)) edges.push(edge);
				}
			}
		}
	};
	for (const name of labModules) {
		scan(join(LAB, name), name, "dependencies");
		scan(join(TESTS, name), name, "devDependencies");
	}
	for (const [pkg, name] of Object.entries(PROMOTED)) {
		const root = promotedRoot(pkg);
		scan(join(root, "src"), name, "dependencies");
		scan(join(root, "test"), name, "devDependencies");
	}
	return { names: modules.map((name) => `@lab/${name}`), edges };
};

// Discover the actual source graph through virtual manifests; retain disk reads
// above because the source imports themselves are the regression oracle.
const LAB_WORKSPACE = "/lab-module-graph";
const sourceGraph = moduleGraph();
const tree: Readonly<Record<string, string>> = {
	[POLICY]: readFileSync(POLICY, "utf8"),
	[join(LAB_WORKSPACE, "package.json")]: JSON.stringify({
		name: "lab-module-graph", private: true, workspaces: ["modules/*"],
	}),
	...R.fromEntries(sourceGraph.names.map((name) => {
		const dependencies = (field: DependencyField) => R.fromEntries(sourceGraph.edges
			.filter((edge) => edge.from === name && edge.field === field)
			.map((edge) => [edge.to, "workspace:*"]));
		return [join(LAB_WORKSPACE, "modules", name.slice("@lab/".length), "package.json"), JSON.stringify({
			name, version: "0.0.0", type: "module",
			dependencies: dependencies("dependencies"), devDependencies: dependencies("devDependencies"),
		})];
	})),
};
const Live = Workspaces.layer({ cwd: LAB_WORKSPACE }).pipe(Layer.provideMerge(Layer.mergeAll(MemoryFileSystem.layerWith(tree), Path.layer)));

const facts = Effect.gen(function* () {
	const policy = yield* LayerPolicy.load(POLICY);
	const packages = yield* (yield* WorkspaceDiscovery).listPackages;
	const graph: LayeringGraph.Input = { names: packages.map((pkg) => pkg.name), edges: WorkspaceLayering.edgesOf(packages) };
	return { policy, packages, graph };
});

const plus = (
	graph: LayeringGraph.Input,
	from: string,
	to: string,
	field: DependencyField = "peerDependencies",
): LayeringGraph.Input => ({
	names: graph.names,
	edges: [...graph.edges, LayerEdge.make({ from, to, field })],
});

describe("the kit's layering, checked by WorkspaceLayering", () => {
	layer(Live, { timeout: "30 seconds" })((it) => {
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
	layer(BunLive, { timeout: "30 seconds" })((it) => {
		it.effect("the whole graph, every field included, is acyclic", () =>
			Effect.gen(function* () {
				const packages = yield* (yield* WorkspaceDiscovery).listPackages;
				assert.isAbove(packages.length, 30);
				assert.isFalse(DependencyGraph.make({ packages }).hasCycle);
			}),
		);
	});
});
