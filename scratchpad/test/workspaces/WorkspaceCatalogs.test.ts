import { assert, describe, it, layer } from "@effect/vitest";
import { CatalogAssemblyError, CatalogResolver, WorkspaceResolver } from "../../effected/npm/index.ts";
import { Effect, FileSystem, Layer, Option } from "effect";
import {
	CatalogSet,
	LockfileReadError,
	LockfileReader,
	PackageManagerDetector,
	WorkspaceCatalogs,
	WorkspaceDiscovery,
	WorkspaceRoot,
	Workspaces,
} from "../../effected/workspaces/index.ts";
import type { Tree } from "./fixtures.ts";
import { manifest, platform } from "./fixtures.ts";

/** The full workspaces stack over a virtual tree, rooted at `/repo`. */
const workspacesOver = (tree: Tree) => {
	const base = platform(tree);
	return Workspaces.layer({ cwd: "/repo" }).pipe(Layer.provideMerge(base));
};

// ── CatalogSet as a pure value ─────────────────────────────────────────────

describe("CatalogSet", () => {
	it("empty has no catalogs", () => {
		assert.isTrue(CatalogSet.empty().isEmpty);
	});

	it("normalizes pnpm's unnamed top-level catalog under 'default'", () =>
		Effect.runSync(
			Effect.gen(function* () {
				const set = yield* CatalogSet.fromWorkspaceYaml("catalog:\n  effect: ^4.0.0\n");
				assert.deepStrictEqual(Object.keys(set.entries), ["default"]);
				assert.deepStrictEqual(set.rangeOf("effect", Option.none()), Option.some("^4.0.0"));
			}),
		));

	it("reads named catalogs", () =>
		Effect.runSync(
			Effect.gen(function* () {
				const set = yield* CatalogSet.fromWorkspaceYaml(
					"catalogs:\n  build:\n    typescript: ^6.0.0\n  test:\n    vitest: ^3.0.0\n",
				);
				assert.deepStrictEqual(Object.keys(set.entries).sort(), ["build", "test"]);
				// The SECOND named catalog — a bug that keeps only the first passes on `build`.
				assert.deepStrictEqual(set.rangeOf("vitest", Option.some("test")), Option.some("^3.0.0"));
				assert.deepStrictEqual(set.rangeOf("typescript", Option.some("build")), Option.some("^6.0.0"));
			}),
		));

	it("rangeOf is none for an unknown dependency and for an unknown catalog", () =>
		Effect.runSync(
			Effect.gen(function* () {
				const set = yield* CatalogSet.fromWorkspaceYaml("catalog:\n  effect: ^4.0.0\n");
				assert.deepStrictEqual(set.rangeOf("react", Option.none()), Option.none());
				assert.deepStrictEqual(set.rangeOf("effect", Option.some("nope")), Option.none());
			}),
		));

	it("resolveSpecifier resolves a catalog: protocol reference", () =>
		Effect.runSync(
			Effect.gen(function* () {
				const set = yield* CatalogSet.fromWorkspaceYaml(
					"catalog:\n  effect: ^4.0.0\ncatalogs:\n  build:\n    effect: ^3.0.0\n",
				);
				assert.deepStrictEqual(set.resolveSpecifier("effect", "catalog:"), Option.some("^4.0.0"));
				assert.deepStrictEqual(set.resolveSpecifier("effect", "catalog:build"), Option.some("^3.0.0"));
			}),
		));

	it("resolveSpecifier is none for a plain, non-catalog specifier", () =>
		Effect.runSync(
			Effect.gen(function* () {
				const set = yield* CatalogSet.fromWorkspaceYaml("catalog:\n  effect: ^4.0.0\n");
				assert.deepStrictEqual(set.resolveSpecifier("effect", "^4.0.0"), Option.none());
			}),
		));

	it.effect("malformed YAML fails typed, never as a defect", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(CatalogSet.fromWorkspaceYaml("catalog:\n\t- ["));
			assert.strictEqual(result._tag, "Failure");
			const error = yield* Effect.flip(CatalogSet.fromWorkspaceYaml("catalog:\n\t- ["));
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.source, "manifest");
		}),
	);

	it("fromLockfileCatalogs unwraps the { specifier, version } lockfile shape", () => {
		const set = CatalogSet.fromLockfileCatalogs({
			default: { effect: { specifier: "^4.0.0", version: "4.0.0-beta.97" } },
		});
		// The SPECIFIER is the declared range, which is what a catalog resolves to;
		// taking `version` would silently pin every consumer to an exact build.
		assert.deepStrictEqual(set.rangeOf("effect", Option.none()), Option.some("^4.0.0"));
	});

	it("merge lets a later set win per dependency", () => {
		const older = CatalogSet.fromLockfileCatalogs({ default: { effect: "^3.0.0", react: "^18.0.0" } });
		const newer = CatalogSet.fromLockfileCatalogs({ default: { effect: "^4.0.0" } });
		const merged = CatalogSet.merge(older, newer);
		assert.deepStrictEqual(merged.rangeOf("effect", Option.none()), Option.some("^4.0.0"));
		// The un-overridden key must SURVIVE the merge — a naive replace drops it.
		assert.deepStrictEqual(merged.rangeOf("react", Option.none()), Option.some("^18.0.0"));
	});

	it("a __proto__ catalog key lands as an own property, not on the prototype", () => {
		// It must come from JSON.parse, not an object literal — in a literal
		// `__proto__:` sets the prototype and creates no own key, so the test would
		// assert nothing. This is the shape a hostile lockfile actually produces.
		const hostile = JSON.parse('{"__proto__": {"evil": "1.0.0"}}') as unknown;
		const set = CatalogSet.fromLockfileCatalogs(hostile);
		assert.isTrue(Object.hasOwn(set.entries, "__proto__"));
		assert.isUndefined(({} as Record<string, unknown>).evil);
		assert.isUndefined((Object.prototype as unknown as Record<string, unknown>).evil);
	});

	it("a __proto__ DEPENDENCY key inside a catalog does not pollute either", () => {
		const hostile = JSON.parse('{"default": {"__proto__": "1.0.0"}}') as unknown;
		const set = CatalogSet.fromLockfileCatalogs(hostile);
		assert.isUndefined((Object.prototype as unknown as Record<string, unknown>)["1.0.0"]);
		const entries = set.entries.default;
		if (entries === undefined) return assert.fail("expected the default catalog");
		assert.isTrue(Object.hasOwn(entries, "__proto__"));
	});
});

// ── WorkspaceCatalogs: assembly precedence ─────────────────────────────────

const withLockfileAndInline: Tree = {
	"/repo/pnpm-workspace.yaml": [
		"packages:",
		"  - 'packages/*'",
		"catalog:",
		"  effect: ^4.0.0",
		"catalogs:",
		"  build:",
		"    typescript: ^6.0.0",
		"",
	].join("\n"),
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
	"/repo/packages/a/package.json": manifest("@x/a", { dependencies: { effect: "catalog:" } }),
	// The lockfile records a STALE effect range and a react range the inline
	// catalog says nothing about. Inline must win on effect; react must survive.
	"/repo/pnpm-lock.yaml": [
		"lockfileVersion: '9.0'",
		"catalogs:",
		"  default:",
		"    effect:",
		"      specifier: ^3.0.0",
		"      version: 3.21.4",
		"    react:",
		"      specifier: ^18.0.0",
		"      version: 18.3.1",
		"importers:",
		"  .:",
		"    dependencies: {}",
		"  packages/a:",
		"    dependencies: {}",
		"",
	].join("\n"),
};

describe("WorkspaceCatalogs — assembly precedence", () => {
	layer(workspacesOver(withLockfileAndInline))((it) => {
		it.effect("the inline pnpm-workspace.yaml catalog beats the lockfile's record", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const set = yield* catalogs.set();
				assert.deepStrictEqual(set.rangeOf("effect", Option.none()), Option.some("^4.0.0"));
			}),
		);

		it.effect("a lockfile-only entry survives the merge", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const set = yield* catalogs.set();
				assert.deepStrictEqual(set.rangeOf("react", Option.none()), Option.some("^18.0.0"));
			}),
		);

		it.effect("named inline catalogs assemble alongside the default one", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const set = yield* catalogs.set();
				assert.deepStrictEqual(set.rangeOf("typescript", Option.some("build")), Option.some("^6.0.0"));
			}),
		);

		it.effect("resolveSpecifier resolves a member's catalog: dependency", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				assert.deepStrictEqual(yield* catalogs.resolveSpecifier("effect", "catalog:"), Option.some("^4.0.0"));
			}),
		);
	});
});

// ── the @effected/npm resolver contracts, implemented for real ─────────────

const resolversOver = (tree: Tree) => {
	const core = workspacesOver(tree);
	return Workspaces.resolvers.pipe(Layer.provide(core));
};

describe("the @effected/npm resolver contracts", () => {
	layer(resolversOver(withLockfileAndInline))((it) => {
		it.effect("CatalogResolver.rangeOf resolves against the real assembled catalogs", () =>
			Effect.gen(function* () {
				const resolver = yield* CatalogResolver;
				// The no-op layer @effected/npm ships would return none here.
				assert.deepStrictEqual(yield* resolver.rangeOf("effect", Option.none()), Option.some("^4.0.0"));
				assert.deepStrictEqual(yield* resolver.rangeOf("typescript", Option.some("build")), Option.some("^6.0.0"));
			}),
		);

		it.effect("CatalogResolver.rangeOf is none — not an error — for an unmatched name", () =>
			Effect.gen(function* () {
				const resolver = yield* CatalogResolver;
				assert.deepStrictEqual(yield* resolver.rangeOf("nothing-here", Option.none()), Option.none());
			}),
		);

		it.effect("WorkspaceResolver.versionOf resolves against the discovered packages", () =>
			Effect.gen(function* () {
				const resolver = yield* WorkspaceResolver;
				assert.deepStrictEqual(yield* resolver.versionOf("@x/a"), Option.some("1.0.0"));
			}),
		);

		it.effect("WorkspaceResolver.versionOf is none for a non-member", () =>
			Effect.gen(function* () {
				const resolver = yield* WorkspaceResolver;
				assert.deepStrictEqual(yield* resolver.versionOf("react"), Option.none());
			}),
		);
	});

	// A malformed inline catalog source must reach the CONTRACT's caller as the
	// typed CatalogAssemblyError the contract names — not folded into a
	// DependencyResolutionError's defect `cause`, which forced consumers to
	// _tag-sniff `unknown` to tell assembly from resolution failures.
	const withMalformedInline: Tree = {
		"/repo/pnpm-workspace.yaml": ["packages:", "  - 'packages/*'", "catalog:", "\t- [", ""].join("\n"),
		"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
	};

	layer(resolversOver(withMalformedInline))((it) => {
		it.effect("CatalogResolver.rangeOf surfaces a failed assembly typed as CatalogAssemblyError", () =>
			Effect.gen(function* () {
				const resolver = yield* CatalogResolver;
				const error = yield* Effect.flip(resolver.rangeOf("effect", Option.none()));
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error._tag, "CatalogAssemblyError");
				assert.strictEqual(error.source, "manifest");
			}),
		);
	});
});

// ── a non-pnpm workspace simply has no catalogs ────────────────────────────

const npmWorkspace: Tree = {
	"/repo/package.json": JSON.stringify({
		name: "root",
		version: "0.0.0",
		workspaces: ["packages/*"],
	}),
	"/repo/packages/a/package.json": manifest("@x/a"),
	"/repo/package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: {} }),
};

describe("WorkspaceCatalogs — a workspace with no pnpm-workspace.yaml", () => {
	layer(workspacesOver(npmWorkspace))((it) => {
		it.effect("assembles to the empty set rather than failing", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const set = yield* catalogs.set();
				assert.isTrue(set.isEmpty);
			}),
		);

		it.effect("detects npm from the workspaces field", () =>
			Effect.gen(function* () {
				const roots = yield* WorkspaceRoot;
				const detector = yield* PackageManagerDetector;
				const detected = yield* detector.detect(yield* roots.find("/repo"));
				assert.strictEqual(detected.name, "npm");
			}),
		);

		it.effect("reads the npm lockfile through @effected/lockfiles", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				const lockfile = yield* reader.read();
				assert.strictEqual(lockfile.format, "npm");
			}),
		);

		it.effect("discovery still works without any catalogs", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const packages = yield* discovery.listPackages();
				assert.deepStrictEqual(
					packages.map((pkg) => pkg.name),
					["root", "@x/a"],
				);
			}),
		);
	});
});

// ── a probe FAILURE is not silent absence (Fix 4) ──────────────────────────

const probeFailTree: Tree = {
	"/repo/pnpm-workspace.yaml": "catalog:\n  effect: ^4.0.0\n",
	// The workspaces field makes package.json a root marker, so root discovery
	// succeeds even when the pnpm-workspace.yaml presence probe fails — isolating
	// the failure to catalog assembly's probe, which is what this exercises.
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0", workspaces: ["packages/*"] }),
};

describe("WorkspaceCatalogs — a presence-probe failure is not silent absence", () => {
	layer(
		Workspaces.layer({ cwd: "/repo" }).pipe(
			// The pnpm-workspace.yaml presence probe fails with PermissionDenied (a
			// non-NotFound PlatformError, exactly what core's `exists` re-raises). Root
			// discovery finds /repo via its package.json marker, so assembly runs and
			// its probe must FAIL typed rather than silently selecting the package.json
			// reader — the "every dependency looks newly added" bug.
			Layer.provideMerge(platform(probeFailTree, { unreadableExists: new Set(["/repo/pnpm-workspace.yaml"]) })),
		),
	)((it) => {
		it.effect("a PermissionDenied on the presence probe fails typed as CatalogAssemblyError", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const error = yield* Effect.flip(catalogs.set());
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.source, "manifest");
			}),
		);
	});
});

// ── the SAME probe-failure guard on the bun/package.json branch (Fix 4) ─────

// The bun branch's manifest probe and root discovery's marker are the same
// `package.json`, so a `package.json` `exists` poison would also break discovery
// (a WorkspaceRootNotFoundError, not the failure under test). To isolate the
// assembly-side manifest probe, this stubs `WorkspaceRoot` to a fixed root and
// `LockfileReader` to a failing read (⇒ empty lockfile catalogs), then poisons
// only the `package.json` presence probe. With the old
// `orElseSucceed(() => false)` the probe would collapse to "absent" and return
// lockfile-only (empty) catalogs; with `probeExists` it fails typed.
const bunProbeFailTree: Tree = {
	// The file EXISTS but its `exists` probe is denied — the locked-down case.
	"/repo/package.json": JSON.stringify({
		name: "root",
		version: "0.0.0",
		workspaces: { catalog: { effect: "^4.0.0" } },
	}),
};

describe("WorkspaceCatalogs — a bun/package.json presence-probe failure is not silent absence", () => {
	const bunProbeFailLayer = WorkspaceCatalogs.layer({ cwd: "/repo" }).pipe(
		Layer.provide(Layer.succeed(WorkspaceRoot, { find: Effect.fn("WorkspaceRoot.find")(() => Effect.succeed("/repo")) })),
		Layer.provide(
			Layer.mock(LockfileReader, {
				read: () =>
					Effect.fail(
						LockfileReadError.make({
							lockfilePath: "/repo/pnpm-lock.yaml",
							format: "pnpm",
							cause: new Error("no lockfile"),
						}),
					),
			}),
		),
		Layer.provideMerge(platform(bunProbeFailTree, { unreadableExists: new Set(["/repo/package.json"]) })),
	);
	layer(bunProbeFailLayer)((it) => {
		it.effect("a PermissionDenied on the package.json presence probe fails typed as CatalogAssemblyError", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const error = yield* Effect.flip(catalogs.set());
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.source, "manifest");
				assert.strictEqual(error.path, "/repo/package.json");
			}),
		);
	});
});

// ── the pnpm inline path hard-fails on malformed / duplicate-default (Fix 5) ─

const duplicateDefaultTree: Tree = {
	"/repo/pnpm-workspace.yaml": [
		"packages:",
		"  - 'packages/*'",
		"catalog:",
		"  effect: ^4.0.0",
		"catalogs:",
		"  default:",
		"    react: ^18.0.0",
		"",
	].join("\n"),
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
};

const malformedCatalogTree: Tree = {
	"/repo/pnpm-workspace.yaml": ["packages:", "  - 'packages/*'", "catalog:", "  effect:", "    nested: bad", ""].join(
		"\n",
	),
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
};

describe("WorkspaceCatalogs — the pnpm inline path hard-fails, like the bun path", () => {
	layer(workspacesOver(duplicateDefaultTree))((it) => {
		it.effect("the default catalog declared twice (top-level catalog + catalogs.default) fails typed", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const error = yield* Effect.flip(catalogs.set());
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.source, "catalog");
				assert.strictEqual(error.path, "default");
			}),
		);
	});

	layer(workspacesOver(malformedCatalogTree))((it) => {
		it.effect("a malformed catalog block (a non-string entry) fails typed rather than reading as empty", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const error = yield* Effect.flip(catalogs.set());
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.source, "catalog");
				assert.strictEqual(error.path, "catalog");
			}),
		);
	});
});

// ── the effective release-age gate, inline source (no-op hooks) ─────────────

const inlineGateTree: Tree = {
	"/repo/pnpm-workspace.yaml": [
		"packages:",
		"  - 'packages/*'",
		"minimumReleaseAge: 1440",
		"minimumReleaseAgeExclude:",
		'  - "@x/*"',
		"  - typescript",
		"catalog:",
		"  effect: ^4.0.0",
		"",
	].join("\n"),
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
	"/repo/packages/a/package.json": manifest("@x/a"),
};

const malformedGateTree: Tree = {
	"/repo/pnpm-workspace.yaml": ["packages:", "  - 'packages/*'", 'minimumReleaseAge: "soon"', ""].join("\n"),
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
};

describe("WorkspaceCatalogs.releaseAgeGate — the inline pnpm-workspace.yaml source", () => {
	layer(workspacesOver(inlineGateTree))((it) => {
		it.effect("surfaces the inline minimumReleaseAge and minimumReleaseAgeExclude", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const gate = yield* catalogs.releaseAgeGate();
				assert.strictEqual(gate.ageMinutes, 1440);
				assert.deepStrictEqual([...gate.exclude], ["@x/*", "typescript"]);
			}),
		);
	});

	layer(workspacesOver(withLockfileAndInline))((it) => {
		it.effect("is the inert zero gate when no release-age keys are declared", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const gate = yield* catalogs.releaseAgeGate();
				assert.strictEqual(gate.ageMinutes, 0);
				assert.deepStrictEqual([...gate.exclude], []);
			}),
		);
	});

	layer(workspacesOver(npmWorkspace))((it) => {
		it.effect("is the inert zero gate for a workspace with no pnpm-workspace.yaml", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const gate = yield* catalogs.releaseAgeGate();
				assert.strictEqual(gate.ageMinutes, 0);
				assert.deepStrictEqual([...gate.exclude], []);
			}),
		);
	});

	layer(workspacesOver(malformedGateTree))((it) => {
		it.effect("a malformed inline minimumReleaseAge fails typed as CatalogAssemblyError", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const error = yield* Effect.flip(catalogs.releaseAgeGate());
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.source, "manifest");
				assert.strictEqual(error.path, "pnpm-workspace.yaml");
			}),
		);
	});
});

// ── refresh: the explicit memoization boundary ──────────────────────────────

// The consumer story: a tool that MUTATES the workspace mid-run (installs,
// bumps a config dependency) must read post-mutation state — release-age
// gating wants the before-state, a post-install peer check the after-state,
// and one infinite memo cannot serve both without an explicit boundary.
const workspaceYamlWithRules = (allowedKey: string): string =>
	[
		"packages:",
		"  - 'packages/*'",
		"catalog:",
		"  effect: ^4.0.0",
		"peerDependencyRules:",
		"  allowedVersions:",
		`    "${allowedKey}": ^4.0.0`,
		"",
	].join("\n");

const refreshTree: Tree = {
	"/repo/pnpm-workspace.yaml": workspaceYamlWithRules("@x/before>effect"),
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
};

describe("WorkspaceCatalogs.refresh — the explicit memoization boundary", () => {
	// The whole before/pin/refresh/after sequence lives in ONE test: a `layer`
	// block shares its service instance across tests, so splitting the sequence
	// would order-couple the assertions.
	layer(workspacesOver(refreshTree))((it) => {
		it.effect("a mutation is invisible to the memo until refresh() discards it", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const fs = yield* FileSystem.FileSystem;

				const before = yield* catalogs.peerDependencyRules();
				assert.deepStrictEqual(before.allowedVersions, { "@x/before>effect": "^4.0.0" });

				// The mid-run mutation: what a config-dependency bump rewrites.
				yield* fs.writeFileString("/repo/pnpm-workspace.yaml", workspaceYamlWithRules("@x/after>effect"));

				// Pins the memo: the pre-mutation assembly is STILL served — this is
				// the assertion that fails if the memo is ever quietly dropped.
				const pinned = yield* catalogs.peerDependencyRules();
				assert.deepStrictEqual(pinned.allowedVersions, { "@x/before>effect": "^4.0.0" });

				yield* catalogs.refresh();

				// The next read re-assembles: same single read + hook replay, now
				// over the post-mutation workspace.
				const after = yield* catalogs.peerDependencyRules();
				assert.deepStrictEqual(after.allowedVersions, { "@x/after>effect": "^4.0.0" });
			}),
		);
	});

	// A fresh layer block: the service must not have assembled yet.
	layer(workspacesOver(refreshTree))((it) => {
		it.effect("refresh() before any read is harmless", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				yield* catalogs.refresh();
				const rules = yield* catalogs.peerDependencyRules();
				assert.deepStrictEqual(rules.allowedVersions, { "@x/before>effect": "^4.0.0" });
			}),
		);
	});
});
