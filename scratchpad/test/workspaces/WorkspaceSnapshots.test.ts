import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Git, GitCommandError, LsTreeEntry } from "../../effected/git/index.ts";
import { CatalogAssemblyError, CatalogResolver, WorkspaceResolver } from "../../effected/npm/index.ts";
import * as HashMap from "effect/HashMap";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import type { HookInjection, HookReplay, PeerDependencyRules } from "../../effected/workspaces/index.ts";
import {
	CatalogSet,
	ConfigDependencyHooks,
	PackageStateSnapshot,
	WorkspaceSnapshots,
	WorkspaceStateSnapshot,
	Workspaces,
} from "../../effected/workspaces/index.ts";
import type { Tree } from "./fixtures.ts";
import { manifest, platform, rootManifest } from "./fixtures.ts";

// ── A scripted `Git` over a per-ref, root-relative content map ──────────────
//
// No repository on disk: `show` and `lsTree` read from the map; `Git.layerTest`
// makes every other method die with a named defect, so a test proves nothing
// else is touched.

type RefTrees = Readonly<Record<string, Readonly<Record<string, string>>>>;

const scriptGit = (
	trees: RefTrees,
	overrides: {
		readonly lsTree?: Git["Service"]["lsTree"];
	} = {},
): Layer.Layer<Git> =>
	Git.layerTest({
		show: (_cwd: string, ref: string, path: string) => {
			// The reader passes `<ref>:./<path>` to make git resolve relative to cwd;
			// with the fixture map keyed root-relative and cwd == root, that is exactly
			// the bare-path lookup — so strip a leading `./`, as real git does.
			const relative = path.startsWith("./") ? path.slice(2) : path;
			const content = trees[ref]?.[relative];
			return Effect.succeed(content === undefined ? O.none() : O.some(content));
		},
		lsTree:
			overrides.lsTree ??
			((_cwd: string, ref: string) =>
				Effect.succeed(
					Object.keys(trees[ref] ?? {}).map((path) =>
						LsTreeEntry.make({ mode: "100644", type: "blob", oid: "0".repeat(40), path }),
					),
				)),
	});

/**
 * Wire `WorkspaceSnapshots` over a scripted `Git` and a virtual filesystem. The
 * filesystem carries the root marker (`WorkspaceRoot` walks the live tree); the
 * ref content comes from `git`. The hooks layer defaults to `layerNoop`, the
 * same policy the default composite wires.
 */
const snapshotsLayer = (
	git: Layer.Layer<Git>,
	tree: Tree,
	cwd = "/repo",
	seedCatalogs?: CatalogSet,
	hooks: Layer.Layer<ConfigDependencyHooks> = ConfigDependencyHooks.layerNoop,
) => {
	const base = platform(tree);
	const core = Workspaces.layer({ cwd });
	const snapshots = WorkspaceSnapshots.layer({ cwd, ...(seedCatalogs === undefined ? {} : { seedCatalogs }) }).pipe(
		Layer.provide(git),
		Layer.provide(hooks),
		Layer.provide(core),
	);
	return Layer.mergeAll(core, snapshots).pipe(Layer.provideMerge(base));
};

/** Project the virtual (absolute-path) tree into a root-relative "HEAD" ref map. */
const refFromTree = (tree: Tree, root = "/repo"): RefTrees => {
	const prefix = `${root}/`;
	const rel: Record<string, string> = {};
	for (const [abs, content] of Object.entries(tree)) {
		if (abs.startsWith(prefix)) rel[abs.slice(prefix.length)] = content;
	}
	return { HEAD: rel };
};

// ── The c594ff1 regression: a bun/npm workspace must NOT collapse to root ────
//
// No `pnpm-workspace.yaml` at the ref, so the globs MUST fall back to the root
// `package.json` `workspaces` field. Without that fallback the snapshot would
// carry the root package alone, and a consumer diffing two refs would see every
// declared dependency as newly added.

const npmRefTrees: RefTrees = {
	HEAD: {
		"package.json": rootManifest(["packages/*"]),
		"packages/alpha/package.json": manifest("@x/alpha"),
		"packages/beta/package.json": manifest("@x/beta", { dependencies: { "@x/alpha": "workspace:*" } }),
	},
};

// The live filesystem only needs the root marker so `WorkspaceRoot.find`
// resolves `/repo`; the member manifests are read from git, not disk.
const npmMarkerOnly: Tree = { "/repo/package.json": rootManifest(["packages/*"]) };

describe("WorkspaceSnapshots.at — the c594ff1 fallback", () => {
	it.layer(snapshotsLayer(scriptGit(npmRefTrees), npmMarkerOnly), { timeout: "30 seconds" })((it) => {
		it.effect("a bun/npm workspace at a ref discovers its members, not the root alone", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const snapshot = yield* snapshots.at("HEAD");
				const names = [...HashMap.keys(snapshot.versions)].sort();
				// Root PLUS both members. A collapse-to-root bug returns just ["root"].
				assert.deepStrictEqual(names, ["@x/alpha", "@x/beta", "root"]);
				// No pnpm-workspace.yaml at the ref: config dependencies do not exist on
				// this path, so the replay record is empty — set on every fresh read.
				assert.deepStrictEqual(snapshot.hookReplays, {});
			}),
		);

		it.effect("member dependency records survive into the snapshot", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const snapshot = yield* snapshots.at("HEAD");
				const beta = snapshot.package("@x/beta");
				assertSome(beta, O.getOrThrow(beta));
				assert.strictEqual(beta.value.dependencies["@x/alpha"], "workspace:*");
			}),
		);
	});
});

// ── A directory that does NOT match the globs is excluded ───────────────────

const scopedRefTrees: RefTrees = {
	HEAD: {
		"package.json": rootManifest(["packages/*"]),
		"packages/alpha/package.json": manifest("@x/alpha"),
		"tools/gen/package.json": manifest("@x/gen"), // outside packages/* — must be dropped
	},
};

describe("WorkspaceSnapshots.at — glob filtering over ls-tree", () => {
	it.layer(snapshotsLayer(scriptGit(scopedRefTrees), npmMarkerOnly), { timeout: "30 seconds" })((it) => {
		it.effect("only package.json directories the glob set accepts become members", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const snapshot = yield* snapshots.at("HEAD");
				const names = [...HashMap.keys(snapshot.versions)].sort();
				// `tools/gen` is a package.json but outside `packages/*`; the root is
				// always included.
				assert.deepStrictEqual(names, ["@x/alpha", "root"]);
			}),
		);
	});
});

// ── at("HEAD") vs worktree() parity on a clean tree ─────────────────────────
//
// A pnpm workspace with an inline catalog and no lockfile: worktree assembles
// catalogs over the live filesystem, at("HEAD") over the same content via git.
// A clean tree means they must agree.

const parityTree: Tree = {
	"/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  effect: ^4.0.0\n",
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0", private: true }),
	"/repo/packages/alpha/package.json": manifest("@x/alpha", { dependencies: { effect: "catalog:" } }),
	"/repo/packages/beta/package.json": manifest("@x/beta", {
		version: "2.0.0",
		dependencies: { "@x/alpha": "workspace:*" },
	}),
};

/** The observable state of a snapshot, normalized for comparison. */
const projected = (snapshot: WorkspaceStateSnapshot) => ({
	versions: [...HashMap.entries(snapshot.versions)].sort(),
	catalogs: snapshot.catalogs.entries,
	effectResolved: snapshot.resolve("effect", "catalog:"),
	alphaResolved: snapshot.resolve("@x/alpha", "workspace:*"),
});

describe("WorkspaceSnapshots — at('HEAD') and worktree() parity on a clean tree", () => {
	it.layer(snapshotsLayer(scriptGit(refFromTree(parityTree)), parityTree), { timeout: "30 seconds" })((it) => {
		it.effect("the two snapshots agree on packages, catalogs and resolution", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const atHead = yield* snapshots.at("HEAD");
				const worktree = yield* snapshots.worktree;
				assert.deepStrictEqual(projected(atHead), projected(worktree));
				// And that resolution is non-trivial: the catalog and workspace
				// indirections actually resolved.
				assertSome(atHead.resolve("effect", "catalog:"), "^4.0.0");
				assertSome(atHead.resolve("@x/alpha", "workspace:*"), "1.0.0");
				assertSome(atHead.resolve("@x/beta", "workspace:^"), "2.0.0");
			}),
		);
	});
});

// ── bun inline catalogs at a ref with NO bun.lock: at('HEAD') vs worktree() ──
//
// A bun-style workspace declares its catalogs in the root `package.json`
// `workspaces.catalog` block and has NO committed `bun.lock` at the ref.
// `worktree()` reads the inline block unconditionally (via `fromManifestWorkspaces`);
// gating the at-ref inline read on `bun.lock` presence reintroduced c594ff1 one
// layer up — the two snapshots disagreed, and a consumer diffing them saw every
// catalog dependency as newly added. Against the pre-fix (gated) code the inline
// read returns empty, so this parity assertion fails.

const bunNoLockTree: Tree = {
	"/repo/package.json": JSON.stringify({
		name: "root",
		version: "0.0.0",
		private: true,
		packageManager: "bun@1.2.0",
		workspaces: { packages: ["packages/*"], catalog: { effect: "^4.0.0" } },
	}),
	"/repo/packages/alpha/package.json": manifest("@x/alpha", { dependencies: { effect: "catalog:" } }),
};

describe("WorkspaceSnapshots — bun inline catalogs at a ref with NO bun.lock (parity)", () => {
	it.layer(snapshotsLayer(scriptGit(refFromTree(bunNoLockTree)), bunNoLockTree), { timeout: "30 seconds" })((it) => {
		it.effect("at('HEAD') reads inline bun catalogs without a lockfile, matching worktree()", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const atHead = yield* snapshots.at("HEAD");
				const worktree = yield* snapshots.worktree;
				// The two catalog sets must agree — the gated code returned an EMPTY set
				// from at('HEAD') while worktree() carried `effect: ^4.0.0`.
				assert.deepStrictEqual(atHead.catalogs.entries, worktree.catalogs.entries);
				assertSome(atHead.resolve("effect", "catalog:"), "^4.0.0");
				assertSome(worktree.resolve("effect", "catalog:"), "^4.0.0");
			}),
		);
	});
});

// ── TTL-cache discipline: a failed at(ref) init is RETRIED, not memoized ─────

describe("WorkspaceSnapshots.at — a failed init is retried", () => {
	let lsTreeCalls = 0;
	const flakyLsTree: Git["Service"]["lsTree"] = (_cwd: string, ref: string) => {
		lsTreeCalls += 1;
		if (lsTreeCalls === 1) {
			return Effect.fail(
				GitCommandError.make({ kind: "failed", args: ["ls-tree", "-r", "-z", ref], cwd: "/repo", stderr: "boom" }),
			);
		}
		return Effect.succeed(
			Object.keys(npmRefTrees[ref] ?? {}).map((path) =>
				LsTreeEntry.make({ mode: "100644", type: "blob", oid: "0".repeat(40), path }),
			),
		);
	};

	it.layer(snapshotsLayer(scriptGit(npmRefTrees, { lsTree: flakyLsTree }), npmMarkerOnly), { timeout: "30 seconds" })((it) => {
		it.effect("the first call fails; the second recomputes and succeeds", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const first = yield* Effect.result(snapshots.at("HEAD"));
				assert.strictEqual(first._tag, "Failure");
				// A bare `Effect.cached` would replay the failure here. The success-only
				// memo invalidated its cell, so the second call re-runs the init.
				const second = yield* snapshots.at("HEAD");
				assert.deepStrictEqual([...HashMap.keys(second.versions)].sort(), ["@x/alpha", "@x/beta", "root"]);
			}),
		);
	});
});

// ── Snapshot-scoped resolution and resolver layers (pure, no git) ───────────

const resolveSnapshot = WorkspaceStateSnapshot.make({
	packages: [
		PackageStateSnapshot.make({ name: "@x/alpha", version: "1.2.3", relativePath: "packages/alpha" }),
		PackageStateSnapshot.make({ name: "@x/beta", version: "4.5.6", relativePath: "packages/beta" }),
	],
	catalogs: CatalogSet.make({ entries: { default: { effect: "^4.0.0" }, build: { vitest: "^3.0.0" } } }),
});

describe("WorkspaceStateSnapshot.resolve", () => {
	it.effect("resolves workspace: against the snapshot's captured versions", () =>
		Effect.sync(() => {
			assertSome(resolveSnapshot.resolve("@x/alpha", "workspace:*"), "1.2.3");
			assertSome(resolveSnapshot.resolve("@x/beta", "workspace:^"), "4.5.6");
		}),
	);

	it.effect("resolves catalog: against the snapshot's captured catalog set", () =>
		Effect.sync(() => {
			assertSome(resolveSnapshot.resolve("effect", "catalog:"), "^4.0.0");
			assertSome(resolveSnapshot.resolve("vitest", "catalog:build"), "^3.0.0");
		}),
	);

	it.effect("an unmatched specifier is Option.none(), never an error", () =>
		Effect.sync(() => {
			assertNone(resolveSnapshot.resolve("nope", "workspace:*")); // not a member
			assertNone(resolveSnapshot.resolve("effect", "catalog:missing")); // unknown catalog
			assertNone(resolveSnapshot.resolve("effect", "^4.0.0")); // plain range: nothing to resolve
			assertNone(resolveSnapshot.resolve("effect", "not a specifier")); // unparseable
		}),
	);
});

// A snapshot holding a version-less member — the key simply absent, the shape
// `snapshotOf` and the worktree snapshot both write (#613).
const bareVersionSnapshot = WorkspaceStateSnapshot.make({
	packages: [
		PackageStateSnapshot.make({ name: "@x/bare", relativePath: "packages/bare" }),
		PackageStateSnapshot.make({ name: "@x/alpha", version: "1.2.3", relativePath: "packages/alpha" }),
	],
	catalogs: CatalogSet.make({ entries: {} }),
});

describe('WorkspaceStateSnapshot — a version-less member is absent, never `""`', () => {
	it('the model cannot hold `""`: make rejects it', () => {
		assert.throws(() => PackageStateSnapshot.make({ name: "@x/bare", version: "", relativePath: "packages/bare" }));
	});

	it('a snapshot serialized with the old `""` sentinel decodes to the absent key', () => {
		const legacy = Result.getOrThrow(S.decodeResult(PackageStateSnapshot)({
			name: "@x/bare",
			version: "",
			relativePath: "packages/bare",
		}));
		assert.isFalse(Object.hasOwn(legacy, "version"));
		assert.isTrue(Equal.equals(legacy, bareVersionSnapshot.packages[0]));
		// Control: a real version survives the same decode.
		const versioned = Result.getOrThrow(S.decodeResult(PackageStateSnapshot)({
			name: "@x/alpha",
			version: "1.2.3",
			relativePath: "packages/alpha",
		}));
		assert.strictEqual(versioned.version, "1.2.3");
	});

	it("encoding omits the key rather than writing a placeholder", () => {
		const pkg = bareVersionSnapshot.packages[0];
		if (pkg === undefined) return assert.fail("expected a snapshot package");
		const encoded = Result.getOrThrow(S.encodeResult(PackageStateSnapshot)(pkg));
		assert.isFalse(Object.hasOwn(encoded, "version"));
	});

	it("versions lists only members that declared a version; package() still answers membership", () => {
		assert.deepStrictEqual([...HashMap.entries(bareVersionSnapshot.versions)], [["@x/alpha", "1.2.3"]]);
		const bare = bareVersionSnapshot.package("@x/bare");
		assertSome(bare, O.getOrThrow(bare));
	});

	it.effect('a version-less member resolves to none, never some("")', () =>
		Effect.sync(() => {
			// Answering `some("")` would rewrite `workspace:^` as a bare `"^"`.
			assertNone(bareVersionSnapshot.resolve("@x/bare", "workspace:^"));
			// The positive control: a member that HAS a version still resolves, so
			// this cannot pass by resolving nothing at all.
			assertSome(bareVersionSnapshot.resolve("@x/alpha", "workspace:^"), "1.2.3");
		}),
	);

	it.effect("the snapshot's WorkspaceResolver fails typed for a version-less member, like discovery's", () =>
		Effect.gen(function* () {
			const workspace = yield* WorkspaceResolver;
			// A known member with nothing to resolve: the contract reserves `none`
			// for a NON-member, so this is the typed-failure outcome.
			const error = yield* Effect.flip(workspace.versionOf("@x/bare"));
			assert.strictEqual(error._tag, "DependencyResolutionError");
			assert.strictEqual(error.specifier, "workspace:@x/bare");
			// The branch a `_tag` check cannot pin: this is the version-less case,
			// raised from structured data with no foreign failure to wrap.
			assert.strictEqual(error.reason, "no-version");
			assert.isUndefined(error.cause);
			// Positive and negative controls on the same layer.
			assertSome(yield* workspace.versionOf("@x/alpha"), "1.2.3");
			assertNone(yield* workspace.versionOf("nope"));
		}).pipe(Effect.provide(bareVersionSnapshot.workspaceResolver)),
	);
});

// ── a version-less member at a ref AND in the worktree (#613) ──────────────
//
// Both capture paths must omit the key for the same manifest, so a diff of a
// clean tree reads no change — and neither side may present `""` as a version.

const versionlessTree: Tree = {
	"/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
	"/repo/package.json": JSON.stringify({ name: "root", private: true }),
	"/repo/packages/bare/package.json": JSON.stringify({ name: "@x/bare", private: true }),
	"/repo/packages/alpha/package.json": manifest("@x/alpha", { dependencies: { "@x/bare": "workspace:^" } }),
};

describe("WorkspaceSnapshots — version-less manifests at a ref and in the worktree", () => {
	it.layer(snapshotsLayer(scriptGit(refFromTree(versionlessTree)), versionlessTree), { timeout: "30 seconds" })((it) => {
		it.effect("both sides omit version, agree structurally, and resolve workspace: to none", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const atHead = yield* snapshots.at("HEAD");
				const worktree = yield* snapshots.worktree;
				for (const snapshot of [atHead, worktree]) {
					const bare = O.getOrThrow(snapshot.package("@x/bare"));
					const root = O.getOrThrow(snapshot.package("root"));
					assert.isFalse(Object.hasOwn(bare, "version"));
					assert.isFalse(Object.hasOwn(root, "version"));
					assert.deepStrictEqual(snapshot.versionNames, ["@x/alpha"]);
					assertNone(snapshot.resolve("@x/bare", "workspace:^"));
				}
				// The two sides are the same value, member for member, so a diff of a
				// clean tree reports nothing — the reason the key must match.
				const byName = (snapshot: WorkspaceStateSnapshot) =>
					[...snapshot.packages].sort((a, b) => a.name.localeCompare(b.name));
				const [left, right] = [byName(atHead), byName(worktree)];
				assert.strictEqual(left.length, right.length);
				for (const [index, pkg] of left.entries()) assert.isTrue(Equal.equals(pkg, right[index]), pkg.name);
				// Control: the versioned member is captured on both sides.
				assertSome(atHead.resolve("@x/alpha", "workspace:*"), "1.0.0");
				assertSome(worktree.resolve("@x/alpha", "workspace:*"), "1.0.0");
			}),
		);
	});
});

describe("WorkspaceStateSnapshot — snapshot-scoped resolver layers", () => {
	it.effect("CatalogResolver and WorkspaceResolver resolve against the snapshot", () =>
		Effect.gen(function* () {
			const catalog = yield* CatalogResolver;
			const workspace = yield* WorkspaceResolver;
			assertSome(yield* catalog.rangeOf("effect", O.none()), "^4.0.0");
			assertSome(yield* catalog.rangeOf("vitest", O.some("build")), "^3.0.0");
			assertSome(yield* workspace.versionOf("@x/beta"), "4.5.6");
		}).pipe(Effect.provide(resolveSnapshot.resolvers)),
	);

	it.effect("an unmatched name resolves to Option.none() on both layers", () =>
		Effect.gen(function* () {
			const catalog = yield* CatalogResolver;
			const workspace = yield* WorkspaceResolver;
			assertNone(yield* catalog.rangeOf("nope", O.none()));
			assertNone(yield* workspace.versionOf("nope"));
		}).pipe(Effect.provide(resolveSnapshot.resolvers)),
	);
});

// ── at(ref) and worktree() must answer a hook-injected catalog IDENTICALLY ───
//
// The symmetry requirement is the whole reason the lockfile-importer fallback
// was chosen over replaying the ref's pnpmfile. `at(ref)` reads through
// `git show` with no checkout and can never execute a past ref's config
// dependency, so any fix that resolves the injected catalog on ONLY the
// worktree side manufactures a bogus row — `from: "catalog:effect:peers"`,
// `to: "4.0.0-beta.101"` — on every single run. Both sides read a committed
// lockfile, so both must land on the same concrete version.

const HOOK_LOCK = `lockfileVersion: '9.0'

importers:

  .:
    devDependencies:
      effect:
        specifier: catalog:effect
        version: 4.0.0-beta.101

packages: {}
`;

// The peer is declared through a catalog NO committed source defines: the
// workspace declares no catalogs, and the lockfile records no `catalogs:` block.
const hookManifest = JSON.stringify({
	name: "root",
	version: "1.0.0",
	peerDependencies: { effect: "catalog:effect:peers" },
	devDependencies: { effect: "catalog:effect" },
});

const hookTree: Tree = {
	"/repo/package.json": hookManifest,
	"/repo/pnpm-workspace.yaml": "packages: []\n",
	"/repo/pnpm-lock.yaml": HOOK_LOCK,
};

const hookRefTrees: RefTrees = {
	HEAD: {
		"package.json": hookManifest,
		"pnpm-workspace.yaml": "packages: []\n",
		"pnpm-lock.yaml": HOOK_LOCK,
	},
};

describe("WorkspaceSnapshots — hook-injected catalog symmetry", () => {
	it.layer(snapshotsLayer(scriptGit(hookRefTrees), hookTree), { timeout: "30 seconds" })((it) => {
		it.effect("at(ref) and worktree() resolve the injected catalog to the same version", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const atRef = yield* snapshots.at("HEAD");
				const live = yield* snapshots.worktree;

				const fromRef = atRef.resolve("effect", "catalog:effect:peers");
				const fromLive = live.resolve("effect", "catalog:effect:peers");

				assertSome(fromRef, "4.0.0-beta.101");
				// Asymmetry here is the bogus-row bug: the two sides MUST agree.
				assert.deepStrictEqual(fromLive, fromRef);
			}),
		);

		it.effect("the importer index reaches both snapshots", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const atRef = yield* snapshots.at("HEAD");
				const live = yield* snapshots.worktree;
				assert.strictEqual(atRef.importerVersions?.["."]?.effect, "4.0.0-beta.101");
				assert.strictEqual(live.importerVersions?.["."]?.effect, "4.0.0-beta.101");
			}),
		);
	});
});

// ── The `seedCatalogs` option: the ref side of the hook-catalog gap ─────────
//
// A catalog injected by a config-dependency pnpmfile hook is declared in no
// committed source, so under `layerNoop` (the default) `at(ref)` cannot see
// it. The layer-level seed lets a consumer who already holds the live set
// share it with the ref side without executing anything.

const HOOKED_MARKER: Tree = {
	"/repo/pnpm-workspace.yaml": ["packages:", "  - packages/*", "catalog:", "  effect: ^4.0.0", ""].join("\n"),
	"/repo/package.json": rootManifest(["packages/*"]),
	"/repo/packages/alpha/package.json": manifest("@x/alpha", {
		dependencies: { effect: "catalog:", "hooked-dep": "catalog:" },
	}),
};

// Derived, never a second spelling. The suite asserts that `at("HEAD")` and
// `worktree()` AGREE about `hooked-dep`; two hand-written copies of the same
// tree could drift and make that agreement pass for the wrong reason.
const HOOKED_REF: RefTrees = refFromTree(HOOKED_MARKER);

// What a config-dependency hook injects — the shape `hook-pnpmfile.cjs` adds.
const HOOK_INJECTED = CatalogSet.make({ entries: { default: { "hooked-dep": "^9.9.9" } } });

describe("WorkspaceSnapshots — under layerNoop, the hook-injected catalog is invisible at a ref", () => {
	it.layer(snapshotsLayer(scriptGit(HOOKED_REF), HOOKED_MARKER), { timeout: "30 seconds" })((it) => {
		it.effect("resolves the committed catalog and abstains on the hook-injected one", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const atRef = yield* snapshots.at("HEAD");
				// The control: committed catalogs work, so a `none` below is about the
				// hook, not about assembly having silently failed.
				assertSome(atRef.resolve("effect", "catalog:"), "^4.0.0");
				assertNone(atRef.resolve("hooked-dep", "catalog:"));
			}),
		);
	});
});

describe("WorkspaceSnapshots — seedCatalogs", () => {
	it.layer(snapshotsLayer(scriptGit(HOOKED_REF), HOOKED_MARKER, "/repo", HOOK_INJECTED), { timeout: "30 seconds" })((it) => {
		it.effect("reaches at(ref)", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const atRef = yield* snapshots.at("HEAD");
				assertSome(atRef.resolve("hooked-dep", "catalog:"), "^9.9.9");
			}),
		);

		it.effect("reaches worktree() too, so the two sides of a diff agree", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const atRef = yield* snapshots.at("HEAD");
				const live = yield* snapshots.worktree;
				// Asymmetry here is the bogus-row bug in the other direction: a seeded
				// `at` diffed against an unseeded `worktree` reports the hook-injected
				// catalog as newly removed on every run.
				assert.deepStrictEqual(live.resolve("hooked-dep", "catalog:"), atRef.resolve("hooked-dep", "catalog:"));
			}),
		);

		it.effect("never overrides what the ref itself committed", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const atRef = yield* snapshots.at("HEAD");
				assertSome(atRef.resolve("effect", "catalog:"), "^4.0.0");
				// And the field still reports the ref's own declaration alone.
				assertNone(atRef.catalogs.rangeOf("hooked-dep", O.none()));
			}),
		);
	});
});

// ── at(ref) replays the REF's declared config dependencies ─────────────────
//
// The defect this pins: `at(ref)` used to skip the hook replay entirely, so a
// catalog that exists only through a hook resolved identically at both refs
// of a diff even when the config dependency was bumped between them. Now the
// ref's own `configDependencies` (from that ref's `pnpm-workspace.yaml`) are
// handed to the hooks layer in scope, and the injected catalogs merge in at
// the live assembler's precedence. A recording hooks layer proves WHICH
// declarations reached the seam and lets the test answer per declared version.

interface InjectCall {
	readonly root: string;
	readonly configDependencies: Readonly<Record<string, string>>;
	readonly seed: Readonly<Record<string, Readonly<Record<string, string>>>>;
	readonly rules: HookInjection["peerDependencyRules"] | undefined;
}

/** A hooks layer that records every `inject` and answers from a per-version table. */
const recordingHooks = (answers: Readonly<Record<string, Readonly<Record<string, string>>>>) => {
	const calls: Array<InjectCall> = [];
	const layer = Layer.succeed(ConfigDependencyHooks, {
		inject: Effect.fn("ConfigDependencyHooks.inject")((root: string, configDependencies: Readonly<Record<string, string>>, seed: Readonly<Record<string, Readonly<Record<string, string>>>>, rules: PeerDependencyRules | undefined) => Effect.sync(() => {
				calls.push({ root, configDependencies, seed, rules });
				let injected: Record<string, string> = {};
				const replays: Record<string, HookReplay> = {};
				for (const [name, spec] of Object.entries(configDependencies)) {
					const declared = spec.split("+")[0] ?? spec;
					injected = { ...injected, ...(answers[`${name}@${declared}`] ?? {}) };
					replays[name] = { version: declared, source: "supplied" };
				}
				return {
					catalogs: { ...seed, default: { ...(seed.default ?? {}), ...injected } },
					releaseAge: {},
					peerDependencyRules: rules ?? { allowedVersions: {}, ignoreMissing: [], allowAny: [] },
					replays,
				};
			})),
	});
	return { calls, layer };
};

const replayWorkspaceYaml = (spec: string): string =>
	[
		"packages:",
		"  - packages/*",
		"catalog:",
		"  effect: ^4.0.0",
		"configDependencies:",
		`  '@scope/plugin': '${spec}'`,
		"",
	].join("\n");

const REPLAY_MEMBER = manifest("@x/alpha", { dependencies: { effect: "catalog:", "hooked-dep": "catalog:" } });

// Two refs declaring two different versions of the same config dependency —
// one with the `+integrity` suffix pnpm writes, one bare (pnpm 12 in a fresh
// workspace). The live tree needs only the root marker.
const replayRefTrees: RefTrees = {
	before: {
		"package.json": rootManifest(["packages/*"]),
		"pnpm-workspace.yaml": replayWorkspaceYaml("1.0.0+sha512-abc"),
		"packages/alpha/package.json": REPLAY_MEMBER,
	},
	after: {
		"package.json": rootManifest(["packages/*"]),
		"pnpm-workspace.yaml": replayWorkspaceYaml("2.0.0"),
		"packages/alpha/package.json": REPLAY_MEMBER,
	},
};
const replayMarker: Tree = {
	"/repo/package.json": rootManifest(["packages/*"]),
	"/repo/pnpm-workspace.yaml": replayWorkspaceYaml("2.0.0"),
};

describe("WorkspaceSnapshots.at — replays the ref's configDependencies at the ref's declared versions", () => {
	const hooks = recordingHooks({
		"@scope/plugin@1.0.0": { "hooked-dep": "^1.0.0" },
		"@scope/plugin@2.0.0": { "hooked-dep": "^2.0.0" },
	});
	it.layer(snapshotsLayer(scriptGit(replayRefTrees), replayMarker, "/repo", undefined, hooks.layer), { timeout: "30 seconds" })((it) => {
		it.effect("hands the hooks layer THAT ref's configDependencies and inline seed", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				yield* snapshots.at("before");
				const call = hooks.calls.find((entry) => entry.configDependencies["@scope/plugin"] === "1.0.0+sha512-abc");
				assert.isDefined(call);
				assert.strictEqual(call?.root, "/repo");
				// The seed is the ref's inline catalogs, the rules the ref's (none).
				assert.deepStrictEqual(call?.seed, { default: { effect: "^4.0.0" } });
				assert.deepStrictEqual(call?.rules, { allowedVersions: {}, ignoreMissing: [], allowAny: [] });
			}),
		);

		it.effect("merges the injected catalogs into the ref's own catalogs", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const before = yield* snapshots.at("before");
				// The ref's OWN catalogs carry the injected range — not the seed field.
				assertSome(before.catalogs.rangeOf("hooked-dep", O.none()), "^1.0.0");
				assertSome(before.resolve("hooked-dep", "catalog:"), "^1.0.0");
				// The control: the inline catalog survived the merge.
				assertSome(before.resolve("effect", "catalog:"), "^4.0.0");
			}),
		);

		it.effect("two refs declaring different versions yield different catalogs — the bump IS detected", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const before = yield* snapshots.at("before");
				const after = yield* snapshots.at("after");
				assertSome(before.resolve("hooked-dep", "catalog:"), "^1.0.0");
				assertSome(after.resolve("hooked-dep", "catalog:"), "^2.0.0");
				// Each snapshot records WHICH version it replayed from — the evidence
				// that the row came from a config-dependency bump. Versions only: the
				// live record's `source` is machine-local and stays off the value.
				assert.deepStrictEqual(before.hookReplays, { "@scope/plugin": "1.0.0" });
				assert.deepStrictEqual(after.hookReplays, { "@scope/plugin": "2.0.0" });
				// And cross-seeding does not blur it: own catalogs outrank the seed.
				const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);
				assert.notDeepEqual(
					seededBefore.resolve("hooked-dep", "catalog:"),
					seededAfter.resolve("hooked-dep", "catalog:"),
				);
			}),
		);
	});
});

describe("WorkspaceSnapshots.at — under layerNoop the ref read executes nothing and sees no injection", () => {
	it.layer(snapshotsLayer(scriptGit(replayRefTrees), replayMarker), { timeout: "30 seconds" })((it) => {
		it.effect("both refs abstain on the hook-only catalog, exactly as before", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const before = yield* snapshots.at("before");
				const after = yield* snapshots.at("after");
				assertNone(before.resolve("hooked-dep", "catalog:"));
				assertNone(after.resolve("hooked-dep", "catalog:"));
				assertSome(before.resolve("effect", "catalog:"), "^4.0.0");
				// A pnpm-workspace.yaml was read, so the record is PRESENT — and empty,
				// because the no-op layer resolved nothing. "Replayed nothing" is
				// distinguishable from "no config dependencies exist here".
				assert.deepStrictEqual(before.hookReplays, {});
			}),
		);
	});
});

describe("WorkspaceSnapshots.at — a hook replay failure at the ref surfaces typed", () => {
	const failing = Layer.succeed(ConfigDependencyHooks, {
		inject: Effect.fn("ConfigDependencyHooks.inject")((_root: string, configDependencies: Readonly<Record<string, string>>) => Effect.fail(
				CatalogAssemblyError.make({
					source: "hooks",
					path: Object.keys(configDependencies)[0] ?? "",
					cause: new Error("not installed"),
				}),
			)),
	});
	it.layer(snapshotsLayer(scriptGit(replayRefTrees), replayMarker, "/repo", undefined, failing), { timeout: "30 seconds" })((it) => {
		it.effect("fails at(ref) with the hooks-source CatalogAssemblyError, never a silent skip", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const error = yield* Effect.flip(snapshots.at("before"));
				assert.instanceOf(error, CatalogAssemblyError);
				if (S.is(CatalogAssemblyError)(error)) {
					assert.strictEqual(error.source, "hooks");
					assert.strictEqual(error.path, "@scope/plugin");
				}
			}),
		);
	});
});


describe("WorkspaceStateSnapshot.versions — Effect collection and explicit order", () => {
	it("keeps first insertion order and last version, excluding unversioned members", () => {
		const state = WorkspaceStateSnapshot.make({
			catalogs: CatalogSet.empty(),
			packages: [
				PackageStateSnapshot.make({ name: "z", version: "1.0.0", relativePath: "z" }),
				PackageStateSnapshot.make({ name: "bare", relativePath: "." }),
				PackageStateSnapshot.make({ name: "a", version: "2.0.0", relativePath: "a" }),
				PackageStateSnapshot.make({ name: "z", version: "3.0.0", relativePath: "z" }),
			],
		});
		assert.deepStrictEqual(state.versionNames, ["z", "a"]);
		assert.strictEqual(HashMap.size(state.versions), 2);
		assertSome(HashMap.get(state.versions, "z"), "3.0.0");
		assertSome(HashMap.get(state.versions, "a"), "2.0.0");
		assertNone(HashMap.get(state.versions, "bare"));
		assert.strictEqual(state.versions, state.versions);
		assert.strictEqual(state.versionNames, state.versionNames);
	});
});


const tolerantJsonRefs: RefTrees = {
	HEAD: {
		"package.json": rootManifest(["packages/*"]),
		"packages/valid/package.json": '{"name":"valid","version":"1.0.0","dependencies":{"constructor":"^1.0.0","__proto__":"^2.0.0"}}',
		"packages/invalid-json/package.json": "{",
		"packages/array/package.json": '[{"name":"array"}]',
		"packages/null/package.json": "null",
		"packages/string/package.json": '"string"',
		"packages/number/package.json": "42",
		"packages/boolean/package.json": "true",
		"packages/no-name/package.json": '{}',
		"packages/bad-fields/package.json": '{"name":"bad-fields","version":42,"dependencies":{"effect":42},"devDependencies":[]}',
	},
};

describe("WorkspaceSnapshots.at — tolerant JSON schema decoding", () => {
	it.layer(snapshotsLayer(scriptGit(tolerantJsonRefs), npmMarkerOnly), { timeout: "30 seconds" })((it) => {
		it.effect("keeps valid own keys and degrades corrupt, non-object and malformed fields", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const state = yield* snapshots.at("HEAD");
				assert.deepStrictEqual(state.packages.map((pkg) => pkg.name), ["root", "bad-fields", "valid"]);
				const valid = O.getOrThrow(state.package("valid"));
				assert.deepStrictEqual(valid.dependencies, { ["constructor"]: "^1.0.0", ["__proto__"]: "^2.0.0" });
				const badFields = O.getOrThrow(state.package("bad-fields"));
				assert.isUndefined(badFields.version);
				assert.deepStrictEqual(badFields.dependencies, {});
				assert.deepStrictEqual(badFields.devDependencies, {});
			}),
		);
	});
});
