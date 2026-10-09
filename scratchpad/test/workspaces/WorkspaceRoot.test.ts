// @effect-diagnostics strictEffectProvide:skip-file
// Root discovery: the ascent bounds, the carried discovery root, and the test
// double.
//
// The tree is the shape that produced the downstream regression: a fixture
// workspace nested inside an enclosing repository that is itself a workspace
// root. An unbounded ascent out of an UNMARKED fixture reaches the host, which
// is exactly the silent escape `stopAt` exists to refuse.

import { assert, describe, it, layer } from "@effect/vitest";
import { Cause, Effect, Exit, Layer, Path } from "effect";
import {
	WORKSPACE_MARKERS,
	WorkspaceDiscovery,
	WorkspacePackage,
	WorkspaceRoot,
	WorkspaceRootNotFoundError,
} from "../../effected/workspaces/index.ts";
import type { Tree } from "./fixtures.ts";
import { manifest, platform, rootManifest } from "./fixtures.ts";

const rootsOver = (tree: Tree) => {
	const base = platform(tree);
	return WorkspaceRoot.layer.pipe(Layer.provide(base));
};

// ── bounded ascent (item 4) ─────────────────────────────────────────────────

// The regression shape: `/host` is a real workspace root, `/host/fixtures/wsp`
// is an intended-but-unmarked one.
const nested: Tree = {
	"/host/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
	"/host/package.json": manifest("@host/root"),
	"/host/fixtures/wsp/packages/a/package.json": manifest("@fixture/a"),
};

describe("WorkspaceRoot.find — ascent bounds", () => {
	layer(rootsOver(nested))((it) => {
		it.effect("unbounded, it escapes the fixture and resolves the host root", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				// Not a bug being asserted as correct — this is the documented default,
				// and the control that proves the bounded case below is doing work.
				assert.strictEqual(yield* roots.find("/host/fixtures/wsp/packages/a"), "/host");
			}),
		);

		it.effect("stopAt refuses the escape and fails typed", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				const error = yield* Effect.flip(roots.find("/host/fixtures/wsp/packages/a", { stopAt: "/host/fixtures/wsp" }));
				assert.instanceOf(error, WorkspaceRootNotFoundError);
				assert.strictEqual(error.stopAt, "/host/fixtures/wsp");
				assert.include(error.message, "up to /host/fixtures/wsp");
			}),
		);

		it.effect("stopAt is inclusive — a marked ceiling is itself probed", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				assert.strictEqual(yield* roots.find("/host/packages", { stopAt: "/host" }), "/host");
			}),
		);

		it.effect("a non-normalized stopAt still bounds the ascent", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				// Walker compares the ceiling by string equality, so an unresolved
				// `stopAt` would never match and would silently run unbounded to
				// "/host". This asserts `find` resolves it first.
				const error = yield* Effect.flip(
					roots.find("/host/fixtures/wsp/packages/a", { stopAt: "/host/fixtures/wsp/packages/../" }),
				);
				assert.strictEqual(error.stopAt, "/host/fixtures/wsp");
			}),
		);

		it.effect("an unbounded failure records no ceiling", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				// `stopAt`'s absence is the signal that distinguishes "no root anywhere
				// above me" from "none below my ceiling"; the two render identically
				// without it.
				const error = yield* Effect.flip(roots.find("/host/fixtures/wsp/packages/a", { maxDepth: 2 }));
				assert.instanceOf(error, WorkspaceRootNotFoundError);
				assert.strictEqual(error.stopAt, undefined);
			}),
		);

		it.effect("an invalid maxDepth is a defect, not a typed failure", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				// Developer wiring, so it must not widen the error channel callers
				// branch on. Walker's guard owns this; the assertion is that `find`
				// passes the value through rather than normalizing it away — a `2.5`
				// that silently became "no ancestors" would be indistinguishable from
				// a legitimate not-found.
				const exit = yield* Effect.exit(roots.find("/host/packages", { maxDepth: 2.5 }));
				assert.isTrue(Exit.isFailure(exit));
				assert.isTrue(Exit.isFailure(exit) && Cause.hasDies(exit.cause));
				assert.isFalse(Exit.isFailure(exit) && exit.cause.reasons.some(Cause.isFailReason));
			}),
		);
	});
});

// ── the carried discovery root (item 5) ─────────────────────────────────────

const discovered: Tree = {
	"/repo/package.json": rootManifest(["packages/*", "apps/nested/*"]),
	"/repo/packages/alpha/package.json": manifest("@x/alpha"),
	"/repo/packages/beta/package.json": manifest("@x/beta"),
	"/repo/apps/nested/web/package.json": manifest("@x/web"),
};

const discoveryOver = (tree: Tree) => {
	const base = platform(tree);
	const roots = WorkspaceRoot.layer.pipe(Layer.provide(base));
	return Layer.mergeAll(
		roots,
		WorkspaceDiscovery.layer({ cwd: "/repo" }).pipe(Layer.provide(roots), Layer.provide(base)),
	).pipe(Layer.provideMerge(base));
};

describe("WorkspacePackage.workspaceRoot — carried by discovery", () => {
	layer(discoveryOver(discovered))((it) => {
		it.effect("every discovered package carries the root the ascent found", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				const info = yield* discovery.info();

				// Root package plus three members — a bare loop over an empty array
				// would pass vacuously.
				assert.strictEqual(packages.length, 4);
				for (const pkg of packages) {
					assert.strictEqual(pkg.workspaceRoot, info.root, `${pkg.name} disagreed`);
				}
			}),
		);

		it.effect("the root package carries a root equal to its own path", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				const root = packages.find((pkg) => pkg.isRootWorkspace);
				assert.isDefined(root);
				assert.strictEqual(root?.workspaceRoot, root?.path);
			}),
		);

		it.effect("a nested member carries the workspace root, NOT its parent directory", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const web = yield* discovery.getPackage("@x/web");
				// The whole point of carrying it: `apps/nested/web` is three segments
				// deep, so anything that walked up "one level" would land on
				// `/repo/apps/nested` and read the wrong config.
				assert.strictEqual(web.path, "/repo/apps/nested/web");
				assert.strictEqual(web.workspaceRoot, "/repo");
			}),
		);
	});
});

// ── the test double (item 9) ────────────────────────────────────────────────

// Bound to a const: layerTest is a parameterized layer factory and layers
// memoize by reference.
const TestRoot = WorkspaceRoot.layerTest("/repo");

describe("WorkspaceRoot.layerTest", () => {
	layer(TestRoot)((it) => {
		it.effect("resolves any cwd to the configured root, with no filesystem", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				assert.strictEqual(yield* roots.find("/repo/packages/utils/src"), "/repo");
				assert.strictEqual(yield* roots.find("/somewhere/else"), "/repo");
			}),
		);

		it.effect("honours a stopAt that contains the root", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				assert.strictEqual(yield* roots.find("/repo/packages/a", { stopAt: "/repo" }), "/repo");
			}),
		);

		it.effect("fails typed when the root lies ABOVE the ceiling", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				// The fidelity that a hand-rolled `find: () => Effect.succeed("/repo")`
				// does not have: ignoring the ceiling makes a bounded call pass under
				// test and fail against the live service.
				const error = yield* Effect.flip(roots.find("/repo/packages/a", { stopAt: "/repo/packages" }));
				assert.instanceOf(error, WorkspaceRootNotFoundError);
				assert.strictEqual(error.stopAt, "/repo/packages");
				assert.deepStrictEqual([...error.markers], [...WORKSPACE_MARKERS]);
			}),
		);
	});
});

describe("WorkspaceRoot.makeTest — ceiling containment", () => {
	// makeTest requires `Path` (to normalize the ceiling); build the double with
	// core's `Path.layer`, the same layer `layerTest` provides internally.
	const build = (root: string) => Effect.runSync(WorkspaceRoot.makeTest(root).pipe(Effect.provide(Path.layer)));

	it("treats the ceiling itself as containing the root", () => {
		const double = build("/repo");
		assert.strictEqual(Effect.runSync(double.find("/repo", { stopAt: "/repo" })), "/repo");
	});

	it("does not treat a sibling with a shared prefix as containing the root", () => {
		// "/repo-other" starts with "/repo" as a raw string but is NOT beneath it;
		// a naive `startsWith` check would wrongly succeed here.
		const double = build("/repo-other");
		const exit = Effect.runSyncExit(double.find("/repo-other/packages/a", { stopAt: "/repo" }));
		assert.isTrue(Exit.isFailure(exit));
	});

	it("normalizes a stopAt carrying `..` before comparing, matching the live path", () => {
		// "/repo/packages/../packages" resolves to "/repo/packages", an ancestor of
		// the root, so the bounded call succeeds. A raw string compare would never
		// match that spelling against the root and would wrongly fail — the exact
		// test/live divergence this double exists to prevent.
		const double = build("/repo/packages/a");
		assert.strictEqual(
			Effect.runSync(double.find("/repo/packages/a", { stopAt: "/repo/packages/../packages" })),
			"/repo/packages/a",
		);
	});
});

// The double and the live service must agree, or the double is a liability.
describe("WorkspaceRoot.layerTest — agrees with the live service", () => {
	const marked: Tree = {
		"/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
		"/repo/packages/alpha/package.json": manifest("@x/alpha"),
	};

	layer(rootsOver(marked))((it) => {
		it.effect("both resolve the same root, and both refuse the same ceiling", () =>
			Effect.gen(function* () {
				const live = yield* WorkspaceRoot;
				// The surrounding layer consumes `Path` into the live service, so provide
				// it locally for the double.
				const double = yield* WorkspaceRoot.makeTest("/repo").pipe(Effect.provide(Path.layer));

				assert.strictEqual(yield* live.find("/repo/packages/alpha"), yield* double.find("/repo/packages/alpha"));

				const liveError = yield* Effect.flip(live.find("/repo/packages/alpha", { stopAt: "/repo/packages" }));
				const doubleError = yield* Effect.flip(double.find("/repo/packages/alpha", { stopAt: "/repo/packages" }));
				assert.strictEqual(liveError._tag, doubleError._tag);
				assert.strictEqual(liveError.stopAt, doubleError.stopAt);
			}),
		);
	});
});

// A hand-built value still has to state its root — the field is required, and
// that is the point.
describe("WorkspacePackage.workspaceRoot — hand-built", () => {
	it("is carried verbatim, not re-derived from path arithmetic", () => {
		const pkg = WorkspacePackage.make({
			name: "@x/utils",
			version: "1.0.0",
			path: "/repo/packages/utils",
			packageJsonPath: "/repo/packages/utils/package.json",
			relativePath: "packages/utils",
			workspaceRoot: "/repo",
		});
		assert.strictEqual(pkg.workspaceRoot, "/repo");
	});
});

// ── the not-found message names the `workspaces` field ─────────────────────

describe("WorkspaceRootNotFoundError — message", () => {
	it("words the package.json marker as the field it requires, keeping `markers` raw", () => {
		const error = WorkspaceRootNotFoundError.make({ searchPath: "/solo", markers: WORKSPACE_MARKERS });
		// A single-package repo HAS a package.json; a bare "package.json" in the
		// message claimed the probe missed a file that is plainly there.
		assert.strictEqual(
			error.message,
			'No workspace root above /solo (looked for pnpm-workspace.yaml, package.json with a "workspaces" field)',
		);
		assert.deepStrictEqual([...error.markers], ["pnpm-workspace.yaml", "package.json"]);
	});

	it("renders the ceiling alongside the reworded marker", () => {
		const error = WorkspaceRootNotFoundError.make({
			searchPath: "/outer/checkout",
			markers: WORKSPACE_MARKERS,
			stopAt: "/outer/checkout",
		});
		assert.strictEqual(
			error.message,
			'No workspace root above /outer/checkout up to /outer/checkout (looked for pnpm-workspace.yaml, package.json with a "workspaces" field)',
		);
	});
});
