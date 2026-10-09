// `stopAt` across every root-resolving service, and through the composites.
//
// The layout is the nested checkout: a plain single-package repository checked
// out inside a directory that is itself a pnpm workspace root. With no ceiling,
// every service adopts the OUTER workspace (the controls below pin that the
// tree is complete enough to succeed there). With `stopAt: cwd`, each service
// must refuse it with `WorkspaceRootNotFoundError` — and a composite must make
// ALL of them refuse it, never a split where discovery fails while the
// lockfile, catalog or snapshot reads quietly answer from the enclosing
// workspace.

import { $ScratchpadId } from "@beep/identity";
import { assert, describe, layer, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Context from "effect/Context";
import { LocalExec, ScriptedSpawner } from "../../effected/commands/index.ts";
import { Git, LsTreeEntry } from "../../effected/git/index.ts";
import type { LocalExecShape } from "../../effected/commands/index.ts";
import * as HashMap from "effect/HashMap";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import {
	ConfigDependencyHooks,
	LockfileReader,
	WorkspaceCatalogs,
	WorkspaceDiscovery,
	WorkspaceRoot,
	WorkspaceRootNotFoundError,
	WorkspaceSnapshots,
	Workspaces,
} from "../../effected/workspaces/index.ts";
import type { Tree } from "./fixtures.ts";
import { manifest, platform } from "./fixtures.ts";

const $I = $ScratchpadId.create("test/workspaces/WorkspacesStopAt.test");

const CWD = "/outer/checkout";

const outerWorkspaceYaml = "packages:\n  - 'pkgs/*'\ncatalog:\n  effect: ^4.0.0\n";
const outerLockfile = [
	"lockfileVersion: '9.0'",
	"catalogs:",
	"  default:",
	"    effect:",
	"      specifier: ^4.0.0",
	"      version: 4.0.0",
	"importers:",
	"  .:",
	"    dependencies: {}",
	"  pkgs/other:",
	"    dependencies: {}",
	"",
].join("\n");
const outerRootManifest = JSON.stringify({ name: "outer-root", version: "0.0.0", private: true });

const nestedCheckout: Tree = {
	"/outer/pnpm-workspace.yaml": outerWorkspaceYaml,
	"/outer/pnpm-lock.yaml": outerLockfile,
	"/outer/package.json": outerRootManifest,
	"/outer/pkgs/other/package.json": manifest("other"),
	"/outer/checkout/package.json": manifest("checkout"),
};

/** The outer workspace as git would show it at `HEAD`, root-relative. */
const outerAtHead: Readonly<Record<string, string>> = {
	"pnpm-workspace.yaml": outerWorkspaceYaml,
	"pnpm-lock.yaml": outerLockfile,
	"package.json": outerRootManifest,
	"pkgs/other/package.json": manifest("other"),
};

/** A scripted `Git` over the outer workspace at `HEAD`; every other method dies named. */
const outerGit: Layer.Layer<Git> = Git.layerTest({
	show: (_cwd: string, _ref: string, path: string) => {
		const content = outerAtHead[path.startsWith("./") ? path.slice(2) : path];
		return Effect.succeed(content === undefined ? O.none() : O.some(content));
	},
	lsTree: () =>
		Effect.succeed(
			Object.keys(outerAtHead).map((path) =>
				LsTreeEntry.make({ mode: "100644", type: "blob", oid: "0".repeat(40), path }),
			),
		),
});

/** Assert `effect` fails with the not-found error for the nested checkout, carrying the ceiling. */
const refusesOuter = Effect.fn("refusesOuter")(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
		const error = yield* Effect.flip(effect);
		assert.instanceOf(error, WorkspaceRootNotFoundError);
		assert.strictEqual(error.searchPath, CWD);
		assert.strictEqual(error.stopAt, CWD);
	});

// ── each sibling service honours its OWN stopAt ────────────────────────────
//
// Every sibling is built over an UNBOUNDED discovery (and, for catalogs and
// snapshots, an unbounded lockfile reader), so the only ceiling in play is the
// service's own. A service that ignored its option would resolve `/outer`.

/** The unbounded core composite, over the nested tree. */
const unboundedCore = Workspaces.layer({ cwd: CWD });

describe("stopAt — the unbounded controls resolve the OUTER workspace", () => {
	const snapshots = WorkspaceSnapshots.layer({ cwd: CWD }).pipe(
		Layer.provide(outerGit),
		Layer.provide(ConfigDependencyHooks.layerNoop),
		Layer.provide(unboundedCore),
	);
	layer(Layer.mergeAll(unboundedCore, snapshots).pipe(Layer.provideMerge(platform(nestedCheckout))), { timeout: "30 seconds" })((it) => {
		it.effect("discovery, lockfile, catalogs and snapshots all answer from /outer", () =>
			Effect.gen(function* () {
				const info = yield* (yield* WorkspaceDiscovery).info;
				assert.strictEqual(info.root, "/outer");
				const lockfile = yield* (yield* LockfileReader).read;
				assert.include(
					lockfile.importers.map((importer) => importer.path),
					"pkgs/other",
				);
				const catalogs = yield* (yield* WorkspaceCatalogs).set;
				assert.strictEqual(catalogs.entries.default?.effect, "^4.0.0");
				const snapshot = yield* (yield* WorkspaceSnapshots).at("HEAD");
				assert.isTrue(HashMap.has(snapshot.versions, "other"));
			}),
		);
	});
});

describe("stopAt — LockfileReader honours its own ceiling", () => {
	const lockfiles = LockfileReader.layer({ cwd: CWD, stopAt: CWD }).pipe(Layer.provide(unboundedCore));
	layer(lockfiles.pipe(Layer.provideMerge(platform(nestedCheckout))), { timeout: "30 seconds" })((it) => {
		it.effect("read() refuses the enclosing workspace", () =>
			Effect.gen(function* () {
				yield* refusesOuter((yield* LockfileReader).read);
			}),
		);
	});
});

describe("stopAt — WorkspaceCatalogs honours its own ceiling", () => {
	const catalogs = WorkspaceCatalogs.layer({ cwd: CWD, stopAt: CWD }).pipe(Layer.provide(unboundedCore));
	layer(catalogs.pipe(Layer.provideMerge(platform(nestedCheckout))), { timeout: "30 seconds" })((it) => {
		it.effect("set() refuses the enclosing workspace", () =>
			Effect.gen(function* () {
				yield* refusesOuter((yield* WorkspaceCatalogs).set);
			}),
		);
	});
});

describe("stopAt — WorkspaceSnapshots honours its own ceiling", () => {
	const snapshots = WorkspaceSnapshots.layer({ cwd: CWD, stopAt: CWD }).pipe(
		Layer.provide(outerGit),
		Layer.provide(ConfigDependencyHooks.layerNoop),
		Layer.provide(unboundedCore),
	);
	layer(snapshots.pipe(Layer.provideMerge(platform(nestedCheckout))), { timeout: "30 seconds" })((it) => {
		it.effect("at(ref) refuses the enclosing workspace", () =>
			Effect.gen(function* () {
				yield* refusesOuter((yield* WorkspaceSnapshots).at("HEAD"));
			}),
		);
	});
});

// ── the composites forward ONE stopAt to every service they build ──────────

/** Every root-resolving read the git-free composite provides, each refusing the outer root. */
const coreRefuses = Effect.gen(function* () {
	yield* refusesOuter((yield* WorkspaceDiscovery).listPackages);
	yield* refusesOuter((yield* LockfileReader).read);
	yield* refusesOuter((yield* WorkspaceCatalogs).set);
});

const bounded = { cwd: CWD, stopAt: CWD } as const;

const gitFreeComposites = {
	layer: Workspaces.layer(bounded),
	layerWithConfigDependencies: Workspaces.layerWithConfigDependencies(bounded),
} as const;

for (const [name, composite] of Object.entries(gitFreeComposites)) {
	describe(`stopAt — Workspaces.${name} fails consistently`, () => {
		layer(composite.pipe(Layer.provideMerge(platform(nestedCheckout))), { timeout: "30 seconds" })((it) => {
			it.effect("discovery, lockfile and catalogs all refuse the enclosing workspace", () => coreRefuses);
		});
	});
}

// The subprocess and git composites need a `ChildProcessSpawner`. The scripted
// one records every spawn: a root refusal happens before anything runs, so a
// composite that forwarded the ceiling spawns nothing at all.
const spawnerFor = () => ScriptedSpawner.make(() => ({}));

describe("stopAt — Workspaces.layerWithConfigDependenciesSubprocess fails consistently", () => {
	const spawner = spawnerFor();
	const composite = Workspaces.layerWithConfigDependenciesSubprocess(bounded).pipe(
		Layer.provide(spawner.layer),
		Layer.provideMerge(platform(nestedCheckout)),
	);
	layer(composite, { timeout: "30 seconds" })((it) => {
		it.effect("discovery, lockfile and catalogs all refuse the enclosing workspace, spawning nothing", () =>
			Effect.gen(function* () {
				yield* coreRefuses;
				assert.strictEqual(spawner.spawns.length, 0);
			}),
		);
	});
});

const gitComposites = {
	layerWithGit: Workspaces.layerWithGit(bounded),
	layerWithGitAndConfigDependencies: Workspaces.layerWithGitAndConfigDependencies(bounded),
	layerWithGitAndConfigDependenciesSubprocess: Workspaces.layerWithGitAndConfigDependenciesSubprocess(bounded),
	layerWithGitAndHooks: Workspaces.layerWithGitAndHooks(ConfigDependencyHooks.layerNoop, bounded),
} as const;

for (const [name, composite] of Object.entries(gitComposites)) {
	describe(`stopAt — Workspaces.${name} fails consistently`, () => {
		const spawner = spawnerFor();
		layer(composite.pipe(Layer.provide(spawner.layer), Layer.provideMerge(platform(nestedCheckout))), { timeout: "30 seconds" })((it) => {
			it.effect("discovery, lockfile, catalogs and at(ref) all refuse the enclosing workspace", () =>
				Effect.gen(function* () {
					yield* coreRefuses;
					yield* refusesOuter((yield* WorkspaceSnapshots).at("HEAD"));
					// Refused before git ran: an unforwarded ceiling would have
					// resolved `/outer` and spawned git to read the ref.
					assert.strictEqual(spawner.spawns.length, 0);
				}),
			);
		});
	});
}

// ── the localExecLayer ceiling ─────────────────────────────────────────────

describe("stopAt — Workspaces.localExecLayer reads a refused root as None", () => {
	class UnboundedLocalExec extends Context.Service<UnboundedLocalExec, LocalExecShape>()($I`UnboundedLocalExec`) {}
	const unboundedLocal = Layer.effect(UnboundedLocalExec, LocalExec).pipe(
		Layer.provide(Workspaces.localExecLayer({ cwd: CWD })),
	);
	const localContexts = Layer.mergeAll(Workspaces.localExecLayer(bounded), unboundedLocal).pipe(
		Layer.provide(unboundedCore),
		Layer.provideMerge(platform(nestedCheckout)),
	);
	layer(localContexts, { timeout: "30 seconds" })((it) => {
		it.effect("bounded: no project-local launcher; unbounded: the outer workspace's pnpm", () =>
			Effect.gen(function* () {
				assertNone(yield* (yield* LocalExec).context);
				const unbounded = yield* (yield* UnboundedLocalExec).context;
				assertSome(O.map(unbounded, (context) => context.directory), "/outer");
			}),
		);
	});
});

// ── a RELATIVE ceiling means the same thing everywhere ─────────────────────
//
// A downstream action ships `WorkspaceDiscovery.layer({ stopAt: "." })`: no
// `cwd`, a relative ceiling, both resolved against the process cwd when the
// lookup runs. `process.cwd` is spied to the nested checkout for the duration
// of each layer suite (the memfs harness has no chdir), which governs both the
// ambient `cwd` default and `path.resolve` of the ceiling.

/** Hold the ambient cwd override for the layer suite and restore it on release. */
const checkoutCwd = Layer.effectDiscard(
	Effect.acquireRelease(
		Effect.sync(() => vi.spyOn(process, "cwd").mockReturnValue(CWD)),
		(spy) => Effect.sync(() => spy.mockRestore()),
	),
);

const relative = { stopAt: "." } as const;

describe("stopAt — a relative ceiling resolves against the process cwd", () => {
	const discovery = WorkspaceDiscovery.layer(relative).pipe(
		Layer.provide(WorkspaceRoot.layer),
		Layer.provideMerge(platform(nestedCheckout)),
		Layer.provide(checkoutCwd),
	);
	layer(discovery, { timeout: "30 seconds" })((it) => {
		it.effect("WorkspaceDiscovery.layer({ stopAt: '.' }) refuses the enclosing workspace like the absolute ceiling", () =>
			Effect.gen(function* () {
				yield* refusesOuter((yield* WorkspaceDiscovery).listPackages);
			}),
		);
	});

	const core = Workspaces.layer(relative).pipe(
		Layer.provideMerge(platform(nestedCheckout)),
		Layer.provide(checkoutCwd),
	);
	layer(core, { timeout: "30 seconds" })((it) => {
		it.effect("Workspaces.layer({ stopAt: '.' }) fails every root-resolving read with the absolute ceiling", () => coreRefuses);
	});

	const spawner = spawnerFor();
	const git = Workspaces.layerWithGit(relative).pipe(
		Layer.provide(spawner.layer),
		Layer.provideMerge(platform(nestedCheckout)),
		Layer.provide(checkoutCwd),
	);
	layer(git, { timeout: "30 seconds" })((it) => {
		it.effect("Workspaces.layerWithGit({ stopAt: '.' }) refuses at(ref) too, spawning nothing", () =>
			Effect.gen(function* () {
				yield* coreRefuses;
				yield* refusesOuter((yield* WorkspaceSnapshots).at("HEAD"));
				assert.strictEqual(spawner.spawns.length, 0);
			}),
		);
	});
});
