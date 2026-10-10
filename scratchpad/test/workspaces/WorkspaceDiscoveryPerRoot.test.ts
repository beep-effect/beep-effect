// `WorkspaceDiscovery.listPackagesIn` / `infoIn` — discovery against a root the
// caller names, not the one the layer was bound to.
//
// The fixture is built around the case under dispute, not around the happy
// path: the two workspaces DISAGREE about membership and about versions. A
// re-rooting implementation — take the layer-bound package list, rewrite each
// path onto the caller's directory — produces plausible output for every
// assertion about paths and fails only these, which is exactly why they are
// here. The trap is that re-rooting looks correct in any fixture whose two
// roots hold the same packages.

import { assert, describe, it, layer } from "@effect/vitest";
import { assertExitFailure, assertSome } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { WorkspaceDiscovery, WorkspaceRoot, WorkspaceRootNotFoundError } from "../../effected/workspaces/index.ts";
import type { Tree } from "./fixtures.ts";
import { manifest, platform, rootManifest } from "./fixtures.ts";

// `/primary` is the long-lived host's startup checkout; `/worktree` is a git
// worktree of the same repo on a different branch. `alpha` exists in both at
// DIFFERENT versions, `beta` only in primary, `gamma` only in the worktree.
const TREE: Tree = {
	"/primary/package.json": rootManifest(["packages/*"]),
	"/primary/packages/alpha/package.json": manifest("@x/alpha", { version: "1.0.0" }),
	"/primary/packages/beta/package.json": manifest("@x/beta", { version: "1.0.0" }),

	"/worktree/package.json": rootManifest(["packages/*"]),
	"/worktree/packages/alpha/package.json": manifest("@x/alpha", { version: "2.0.0" }),
	"/worktree/packages/gamma/package.json": manifest("@x/gamma", { version: "2.0.0" }),
};

/** Discovery bound to `/primary`, as a host that resolved its root at startup. */
const discoveryOver = (tree: Tree) => {
	const base = platform(tree);
	const roots = WorkspaceRoot.layer.pipe(Layer.provide(base));
	return Layer.mergeAll(
		roots,
		WorkspaceDiscovery.layer({ cwd: "/primary" }).pipe(Layer.provide(roots), Layer.provide(base)),
	).pipe(Layer.provideMerge(base));
};

const names = (packages: ReadonlyArray<{ readonly name: string }>): ReadonlyArray<string> =>
	[...packages.map((pkg) => pkg.name)].sort();

describe("WorkspaceDiscovery.listPackagesIn — a root the layer was not bound to", () => {
	layer(discoveryOver(TREE), { timeout: "30 seconds" })((it) => {
		it.effect("reads the named root's own membership, not the layer-bound root's", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;

				const primary = yield* discovery.listPackages;
				assert.deepStrictEqual(names(primary), ["@x/alpha", "@x/beta", "root"]);

				const worktree = yield* discovery.listPackagesIn("/worktree");
				// `@x/gamma` exists ONLY in the worktree and `@x/beta` ONLY in primary.
				// Re-rooting the layer's list would report beta here and never gamma.
				assert.deepStrictEqual(names(worktree), ["@x/alpha", "@x/gamma", "root"]);
			}),
		);

		it.effect("reads versions from the named root's manifests", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const worktree = yield* discovery.listPackagesIn("/worktree");
				const alpha = worktree.find((pkg) => pkg.name === "@x/alpha");
				// The limitation the re-rooting workaround could not lift: names and
				// versions came from the layer-bound root's manifests even after paths
				// were rewritten.
				assert.strictEqual(alpha?.version, "2.0.0");
			}),
		);

		it.effect("roots every discovered package at the named root", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const worktree = yield* discovery.listPackagesIn("/worktree");
				const alpha = worktree.find((pkg) => pkg.name === "@x/alpha");
				assert.strictEqual(alpha?.workspaceRoot, "/worktree");
				assert.strictEqual(alpha?.path, "/worktree/packages/alpha");
				assert.strictEqual(alpha?.relativePath, "packages/alpha");
			}),
		);

		it.effect("leaves the layer-bound methods answering about the layer-bound root", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				yield* discovery.listPackagesIn("/worktree");
				// A per-call root that leaked into the shared memo would make the
				// host's own workspace change under it between calls.
				const info = yield* discovery.info;
				assert.strictEqual(info.root, "/primary");
				assert.deepStrictEqual(names(yield* discovery.listPackages), ["@x/alpha", "@x/beta", "root"]);
			}),
		);

		it.effect("accepts a directory INSIDE the workspace, not only its root", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const fromSubdirectory = yield* discovery.listPackagesIn("/worktree/packages/gamma");
				assert.deepStrictEqual(names(fromSubdirectory), ["@x/alpha", "@x/gamma", "root"]);
			}),
		);

		it.effect("returns the same memoized array for two directories in one workspace", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const fromRoot = yield* discovery.listPackagesIn("/worktree");
				const fromSubdirectory = yield* discovery.listPackagesIn("/worktree/packages/alpha");
				// Identity, not equality: keying the memo on the caller's path instead
				// of the resolved root would re-discover per subdirectory and still
				// pass a deep-equality check.
				assert.strictEqual(fromRoot, fromSubdirectory);
			}),
		);

		it.effect("keeps distinct roots in distinct memo cells", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const worktree = yield* discovery.listPackagesIn("/worktree");
				const primary = yield* discovery.listPackagesIn("/primary");
				assert.notStrictEqual(worktree, primary);
				assert.deepStrictEqual(names(primary), ["@x/alpha", "@x/beta", "root"]);
			}),
		);

		it.effect("fails typed when the directory is in no workspace at all", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const error = yield* Effect.flip(discovery.listPackagesIn("/nowhere"));
				assert.instanceOf(error, WorkspaceRootNotFoundError);
			}),
		);
	});
});

describe("WorkspaceDiscovery.infoIn", () => {
	layer(discoveryOver(TREE), { timeout: "30 seconds" })((it) => {
		it.effect("reports the named root and its own patterns", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const info = yield* discovery.infoIn("/worktree/packages/gamma");
				assert.strictEqual(info.root, "/worktree");
				assert.deepStrictEqual([...info.patterns], ["packages/*"]);
			}),
		);

		it.effect("shares one discovery with listPackagesIn for the same root", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const first = yield* discovery.listPackagesIn("/worktree");
				yield* discovery.infoIn("/worktree");
				assert.strictEqual(yield* discovery.listPackagesIn("/worktree"), first);
			}),
		);
	});
});

describe("WorkspaceDiscovery.refresh — with per-root memos live", () => {
	layer(discoveryOver(TREE), { timeout: "30 seconds" })((it) => {
		it.effect("drops the per-root memos too, not only the layer-bound one", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const before = yield* discovery.listPackagesIn("/worktree");
				yield* discovery.refresh;
				const after = yield* discovery.listPackagesIn("/worktree");
				// A refresh that cleared only the layer-bound memo would leave a
				// long-lived host serving stale worktree state with no way to reset it.
				assert.notStrictEqual(before, after);
				assert.deepStrictEqual(names(after), names(before));
			}),
		);
	});
});

describe("WorkspaceDiscovery.refreshIn", () => {
	layer(discoveryOver(TREE), { timeout: "30 seconds" })((it) => {
		it.effect("drops only the named root's memo", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const worktreeBefore = yield* discovery.listPackagesIn("/worktree");
				const primaryBefore = yield* discovery.listPackagesIn("/primary");

				yield* discovery.refreshIn("/worktree");

				// The named root re-discovers...
				assert.notStrictEqual(yield* discovery.listPackagesIn("/worktree"), worktreeBefore);
				// ...and its siblings do not. A `refreshIn` that cleared the whole map
				// would be indistinguishable from `refresh` and pass the line above.
				assert.strictEqual(yield* discovery.listPackagesIn("/primary"), primaryBefore);
			}),
		);

		it.effect("accepts a directory inside the workspace", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const before = yield* discovery.listPackagesIn("/worktree");
				yield* discovery.refreshIn("/worktree/packages/gamma");
				assert.notStrictEqual(yield* discovery.listPackagesIn("/worktree"), before);
			}),
		);

		it.effect("leaves the layer-bound memo alone", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const before = yield* discovery.listPackages;
				yield* discovery.listPackagesIn("/worktree");
				yield* discovery.refreshIn("/worktree");
				assert.strictEqual(yield* discovery.listPackages, before);
			}),
		);

		it.effect("is a no-op for a root with no memo", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				// The precondition is stated rather than inherited: `layer(...)` builds
				// ONE service for the whole block, so without this the test only holds
				// because a sibling happened to end with a refresh — and a reorder or
				// an inserted test would make it pass vacuously.
				yield* discovery.refresh;
				// Never discovered, so there is nothing to drop — an ordinary fact,
				// not an error.
				yield* discovery.refreshIn("/worktree");
				assert.deepStrictEqual(names(yield* discovery.listPackagesIn("/worktree")), ["@x/alpha", "@x/gamma", "root"]);
			}),
		);

		it.effect("fails typed on a directory in no workspace, like the other per-root methods", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const error = yield* Effect.flip(discovery.refreshIn("/nowhere"));
				assert.instanceOf(error, WorkspaceRootNotFoundError);
			}),
		);
	});
});

describe("WorkspaceDiscovery.makeTest — the per-root methods", () => {
	it.effect("dies unstubbed rather than deriving from listPackages", () =>
		Effect.gen(function* () {
			const double = WorkspaceDiscovery.makeTest({
				listPackages: Effect.suspend(() => Effect.succeed([])),
			});
			// Deriving would model every root as identical — the exact confusion
			// `listPackagesIn` exists to remove — so a test that forgets to stub it
			// must fail loudly rather than quietly agree with `listPackages`.
			// A DIE specifically: a bare failure check also passes for a typed error
			// or an interrupt, which would not discriminate the behaviour the test
			// name claims — and a double that failed typed instead of dying is
			// exactly the absorbable-by-catch mistake this default exists to avoid.
			const exit = yield* Effect.exit(double.listPackagesIn("/anywhere"));
			assertExitFailure(exit, O.getOrElse(Exit.getCause(exit), () => Cause.empty));
			assert.isTrue(Cause.hasDies(exit.cause));
			const infoExit = yield* Effect.exit(double.infoIn("/anywhere"));
			assertExitFailure(infoExit, O.getOrElse(Exit.getCause(infoExit), () => Cause.empty));
			assert.isTrue(Cause.hasDies(infoExit.cause));
		}),
	);

	it.effect("uses the override when one is supplied", () =>
		Effect.gen(function* () {
			const double = WorkspaceDiscovery.makeTest({
				listPackagesIn: () => Effect.succeed([]),
			});
			assert.deepStrictEqual(yield* double.listPackagesIn("/anywhere"), []);
			// `refreshIn` DOES have an honest default: a double memoizes nothing, so
			// dropping one root's memo really is a no-op.
			yield* WorkspaceDiscovery.makeTest({}).refreshIn("/anywhere");
		}),
	);
});

describe("WorkspaceDiscovery.resolveFile — unchanged by the per-root memos", () => {
	layer(discoveryOver(TREE), { timeout: "30 seconds" })((it) => {
		it.effect("still answers against the layer-bound root", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				yield* discovery.listPackagesIn("/worktree");
				const owner = yield* discovery.resolveFile("/primary/packages/beta/src/index.ts");
				assertSome(owner, O.getOrThrow(owner));
				assert.strictEqual(O.getOrThrow(owner).name, "@x/beta");
			}),
		);
	});
});
