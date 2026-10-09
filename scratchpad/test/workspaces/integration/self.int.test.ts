// @effect-diagnostics nodeBuiltinImport:skip-file
// The package discovering the repository it lives in.
//
// Everything else in the suite runs against a virtual filesystem. This runs
// against the real one, through `@effect/platform-node`, and is the only place
// that proves the whole stack composes: root walk, pnpm-workspace.yaml parse,
// enumeration, per-package decode, the graph, the real pnpm catalogs, and the
// real pnpm-lock.yaml with importer-path names resolved.
//
// It also pins the sync escape hatch against the async surface: `vitest-agent`
// calls the sync pair, and if the two ever disagree its project list silently
// diverges from what the Effect API would have found.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import nodePath, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import type { WorkspacesSyncOptions } from "../../../effected/workspaces/index.ts";
import {
	DependencyGraph,
	LockfileReader,
	PackageManagerDetector,
	WorkspaceCatalogs,
	WorkspaceDiscovery,
	Workspaces,
	findWorkspaceRootSync,
	getWorkspacePackagesSync,
} from "../../../effected/workspaces/index.ts";

/** This package's own directory — the repo root is somewhere above it. */
const here = dirname(fileURLToPath(import.meta.url));
const cwd = resolve(here, "..", "..");

// The documented one-liner wiring for the consumer-supplied sync operations.
const syncOps: WorkspacesSyncOptions = {
	fileSystem: {
		exists: existsSync,
		readFile: (p) => readFileSync(p, "utf8"),
		readDirectory: (p) => readdirSync(p),
		isDirectory: (p) => statSync(p).isDirectory(),
	},
	path: nodePath,
};

const Platform = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const Live = Workspaces.layer({ cwd }).pipe(Layer.provideMerge(Platform));

describe("the effected repository, discovered by the package that lives in it", () => {
	layer(Live)((it) => {
		it.effect("finds the workspace root and its pnpm packages patterns", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const info = yield* discovery.info();
				assert.isTrue(cwd.startsWith(info.root), "the root must be an ancestor of this package");
				assert.isAbove(info.patterns.length, 0);
			}),
		);

		it.effect("discovers itself, and its siblings", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const names = (yield* discovery.listPackages()).map((pkg) => pkg.name);
				assert.include(names, "@effected/workspaces");
				assert.include(names, "@effected/lockfiles");
				assert.include(names, "@effected/glob");
				assert.include(names, "@effected/walker");
			}),
		);

		it.effect("attributes this very test file to this package", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const owner = yield* discovery.resolveFile(fileURLToPath(import.meta.url));
				assert.isTrue(Option.isSome(owner));
				assert.strictEqual(Option.getOrThrow(owner).name, "@effected/workspaces");
			}),
		);

		it.effect("detects pnpm", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const detector = yield* PackageManagerDetector;
				const info = yield* discovery.info();
				const detected = yield* detector.detect(info.root);
				assert.strictEqual(detected.name, "pnpm");
			}),
		);

		it.effect("builds an acyclic graph and orders workspaces before their dependents", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const graph = DependencyGraph.make({ packages: yield* discovery.listPackages() });
				assert.isFalse(graph.hasCycle, "the @effected graph must stay acyclic");

				const order = yield* graph.sort();
				// workspaces depends on lockfiles, glob and walker, so all three must
				// precede it in a topological order.
				const self = order.indexOf("@effected/workspaces");
				for (const dependency of ["@effected/lockfiles", "@effected/glob", "@effected/walker"]) {
					assert.isBelow(order.indexOf(dependency), self, `${dependency} must build before workspaces`);
				}
			}),
		);

		it.effect("resolves the repo's own effect catalog entry", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const set = yield* catalogs.set();
				// This repo pins `effect` in a named `effect` catalog, and every
				// package depends on `catalog:effect`.
				const range = set.rangeOf("effect", Option.some("effect"));
				assert.isTrue(Option.isSome(range), "the effect catalog must resolve");
				assert.match(Option.getOrThrow(range), /^\^?4\./);
			}),
		);

		it.effect("reads the real pnpm-lock.yaml with importer paths resolved to real names", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				const lockfile = yield* reader.read();
				assert.strictEqual(lockfile.format, "pnpm");

				const workspaceNames = lockfile.packages.filter((pkg) => pkg.isWorkspace).map((pkg) => pkg.name);
				// The pure parser emits IMPORTER PATHS here (`packages/glob`); the
				// second stage — which is this package's IO — rewrites them.
				assert.include(workspaceNames, "@effected/glob");
				assert.notInclude(workspaceNames, "packages/glob");
			}),
		);
	});
});

describe("the sync escape hatch agrees with the Effect surface", () => {
	layer(Live)((it) => {
		it.effect("findWorkspaceRootSync finds the same root", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const info = yield* discovery.info();
				assert.strictEqual(findWorkspaceRootSync(cwd, syncOps), info.root);
			}),
		);

		it.effect("getWorkspacePackagesSync finds the same packages", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const info = yield* discovery.info();
				const async = (yield* discovery.listPackages()).map((pkg) => pkg.name).sort();
				const sync = getWorkspacePackagesSync(info.root, syncOps)
					.map((pkg) => pkg.name)
					.sort();
				// The whole point of routing both through one GlobSet: if the sync
				// enumerator ever grows a private pattern semantic again, this diverges.
				assert.deepStrictEqual(sync, async);
			}),
		);

		it.effect("getWorkspacePackagesSync agrees on the dependency maps too", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const info = yield* discovery.info();
				const async = yield* discovery.getPackage("@effected/workspaces");
				const sync = getWorkspacePackagesSync(info.root, syncOps).find((pkg) => pkg.name === "@effected/workspaces");
				assert.isDefined(sync);
				assert.deepStrictEqual(sync?.dependencies, async.dependencies);
				assert.strictEqual(sync?.relativePath, async.relativePath);
			}),
		);
	});
});
