// The sanctioned test doubles for the three services issue #171 named:
// `WorkspaceCatalogs`, `WorkspaceSnapshots` and `LockfileReader`. The design
// discipline under test is the one `WorkspaceDiscovery.makeTest` set: model
// only what the real service guarantees, derive a secondary answer only from a
// supplied primary, and DIE loudly on anything unstubbed — an empty catalog
// set or lockfile that looks like a legitimate answer is the silent-empty
// failure class this package documents everywhere else.

import { assert, describe, it, layer } from "@effect/vitest";
import { Lockfile, ResolvedPackage } from "../../effected/lockfiles/index.ts";
import { ReleaseAgeGate } from "../../effected/npm/index.ts";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import {
	CatalogSet,
	LockfileReader,
	WorkspaceCatalogs,
	WorkspaceSnapshots,
	WorkspaceStateSnapshot,
} from "../../effected/workspaces/index.ts";

/** Assert an exit is a DIE (never a typed failure) whose defect message carries `fragment`. */
const assertDies = (exit: Exit.Exit<unknown, unknown>, fragment: string): void => {
	assert.isTrue(Exit.isFailure(exit));
	if (Exit.isFailure(exit)) {
		assert.isFalse(exit.cause.reasons.some(Cause.isFailReason));
		assert.isTrue(Cause.hasDies(exit.cause));
		const defect = exit.cause.reasons.filter(Cause.isDieReason).map((reason) => reason.defect)[0];
		assert.instanceOf(defect, Error);
		if (!(defect instanceof Error)) return assert.fail("expected an Error defect");
		assert.include(defect.message, fragment);
	}
};

// ── WorkspaceCatalogs ───────────────────────────────────────────────────────

// Bound to a const — layers memoize by reference.
const UnstubbedCatalogs = WorkspaceCatalogs.layerTest();

describe("WorkspaceCatalogs.makeTest — everything dies until stubbed", () => {
	layer(UnstubbedCatalogs)((it) => {
		it.effect("every method dies with a defect naming the unstubbed method", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				assertDies(yield* Effect.exit(catalogs.set), "WorkspaceCatalogs.makeTest: set() was called but not stubbed");
				assertDies(
					yield* Effect.exit(catalogs.resolveSpecifier("effect", "catalog:")),
					"WorkspaceCatalogs.makeTest: resolveSpecifier() was called but not stubbed",
				);
				assertDies(
					yield* Effect.exit(catalogs.releaseAgeGate),
					"WorkspaceCatalogs.makeTest: releaseAgeGate() was called but not stubbed",
				);
				assertDies(
					yield* Effect.exit(catalogs.importerVersions),
					"WorkspaceCatalogs.makeTest: importerVersions() was called but not stubbed",
				);
				// The one honest default besides the derivation: the double holds no
				// memo, so "drop the memoized assembly" is genuinely a no-op —
				// mirroring WorkspaceDiscovery.makeTest's refresh.
				assert.deepStrictEqual(yield* catalogs.refresh, undefined);
			}),
		);
	});
});

describe("WorkspaceCatalogs.makeTest — resolveSpecifier derives from a supplied set", () => {
	const stubbedSet = CatalogSet.fromCatalogs({
		default: { effect: "4.0.0-beta.101" },
		build: { typescript: "^5.9.0" },
	});

	it.effect("answers from the supplied CatalogSet exactly as the live service would", () =>
		Effect.gen(function* () {
			// The shape value directly — no layer needed to use a double inline.
			const double = WorkspaceCatalogs.makeTest({ set: Effect.suspend(() => Effect.succeed(stubbedSet)) });
			assert.strictEqual((yield* double.set).entries.default?.effect, "4.0.0-beta.101");
			assert.deepStrictEqual(yield* double.resolveSpecifier("effect", "catalog:"), O.some("4.0.0-beta.101"));
			assert.deepStrictEqual(yield* double.resolveSpecifier("typescript", "catalog:build"), O.some("^5.9.0"));
			// Misses stay misses, never a fabricated answer.
			assert.isTrue(O.isNone(yield* double.resolveSpecifier("left-pad", "catalog:")));
			assert.isTrue(O.isNone(yield* double.resolveSpecifier("effect", "catalog:missing")));
		}),
	);

	it.effect("gate and importer methods stay dead — a CatalogSet cannot honestly answer them", () =>
		Effect.gen(function* () {
			const double = WorkspaceCatalogs.makeTest({ set: Effect.suspend(() => Effect.succeed(stubbedSet)) });
			assertDies(yield* Effect.exit(double.releaseAgeGate), "releaseAgeGate() was called but not stubbed");
			assertDies(yield* Effect.exit(double.importerVersions), "importerVersions() was called but not stubbed");
		}),
	);

	it.effect("an explicit override wins over the derivation", () =>
		Effect.gen(function* () {
			const double = WorkspaceCatalogs.makeTest({
				set: Effect.suspend(() => Effect.succeed(stubbedSet)),
				resolveSpecifier: () => Effect.succeedSome("pinned"),
				releaseAgeGate: Effect.suspend(() => Effect.succeed(ReleaseAgeGate.combine())),
			});
			assert.deepStrictEqual(yield* double.resolveSpecifier("effect", "catalog:"), O.some("pinned"));
			assert.strictEqual((yield* double.releaseAgeGate).ageMinutes, 0);
		}),
	);
});

// ── WorkspaceSnapshots ──────────────────────────────────────────────────────

const EMPTY_SNAPSHOT = WorkspaceStateSnapshot.make({
	packages: [],
	catalogs: CatalogSet.empty(),
	importerVersions: {},
});

// Bound to a const — layers memoize by reference.
const UnstubbedSnapshots = WorkspaceSnapshots.layerTest();

describe("WorkspaceSnapshots.makeTest — no honest defaults, no derivations", () => {
	layer(UnstubbedSnapshots)((it) => {
		it.effect("both methods die with a defect naming the unstubbed method", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				assertDies(
					yield* Effect.exit(snapshots.at("origin/main")),
					"WorkspaceSnapshots.makeTest: at() was called but not stubbed",
				);
				assertDies(
					yield* Effect.exit(snapshots.worktree),
					"WorkspaceSnapshots.makeTest: worktree() was called but not stubbed",
				);
			}),
		);
	});

	it.effect("a stubbed method runs, and stubbing one side never revives the other", () =>
		Effect.gen(function* () {
			const double = WorkspaceSnapshots.makeTest({ worktree: Effect.suspend(() => Effect.succeed(EMPTY_SNAPSHOT)) });
			assert.deepStrictEqual((yield* double.worktree).packages, []);
			// `at` and `worktree` read different sources; neither derives the other.
			assertDies(yield* Effect.exit(double.at("HEAD")), "at() was called but not stubbed");
		}),
	);
});

// Bound to a const — layers memoize by reference.
const StubbedSnapshots = WorkspaceSnapshots.layerTest({
	at: () => Effect.succeed(EMPTY_SNAPSHOT),
	worktree: Effect.suspend(() => Effect.succeed(EMPTY_SNAPSHOT)),
});

describe("WorkspaceSnapshots.layerTest — provides the service", () => {
	layer(StubbedSnapshots)((it) => {
		it.effect("the layer satisfies consumers of both methods", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				assert.deepStrictEqual((yield* snapshots.at("HEAD")).packages, []);
				assert.deepStrictEqual((yield* snapshots.worktree).packages, []);
			}),
		);
	});
});

// ── LockfileReader ──────────────────────────────────────────────────────────

// Bound to a const — layers memoize by reference.
const UnstubbedLockfiles = LockfileReader.layerTest();

describe("LockfileReader.makeTest — read dies until stubbed, refresh is honest", () => {
	layer(UnstubbedLockfiles)((it) => {
		it.effect("the fallible methods die with a defect naming the unstubbed method", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				assertDies(yield* Effect.exit(reader.read), "LockfileReader.makeTest: read() was called but not stubbed");
				assertDies(
					yield* Effect.exit(reader.resolvedVersion("effect")),
					"LockfileReader.makeTest: resolvedVersion() was called but not stubbed",
				);
				assertDies(
					yield* Effect.exit(reader.integrity),
					"LockfileReader.makeTest: integrity() was called but not stubbed",
				);
			}),
		);

		it.effect("refresh is a no-op — the double memoizes nothing, so there is nothing to drop", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				yield* reader.refresh;
			}),
		);
	});
});

describe("LockfileReader.makeTest — resolvedVersion derives from a supplied read", () => {
	// Two resolutions of the same name, deliberately: the live contract returns
	// the FIRST entry in lockfile order and never ranks.
	const stubbedLockfile = Lockfile.make({
		format: "pnpm",
		lockfileVersion: "9.0",
		packages: [
			ResolvedPackage.make({ name: "left-pad", version: "1.0.0", instanceId: "left-pad@1.0.0", isWorkspace: false }),
			ResolvedPackage.make({ name: "left-pad", version: "2.0.0", instanceId: "left-pad@2.0.0", isWorkspace: false }),
			ResolvedPackage.make({
				name: "effect",
				version: "4.0.0-beta.101",
				instanceId: "effect@4.0.0-beta.101",
				isWorkspace: false,
			}),
		],
		workspaceDependencies: [],
	});

	it.effect("answers first-in-lockfile-order, exactly as the live service does", () =>
		Effect.gen(function* () {
			const double = LockfileReader.makeTest({ read: Effect.suspend(() => Effect.succeed(stubbedLockfile)) });
			assert.strictEqual((yield* double.read).packages.length, 3);
			const first = yield* double.resolvedVersion("left-pad");
			assert.isTrue(O.isSome(first));
			if (O.isSome(first)) assert.strictEqual(first.value.version, "1.0.0");
			// A miss is a miss, never a fabricated resolution.
			assert.isTrue(O.isNone(yield* double.resolvedVersion("right-pad")));
			// `integrity` needs the workspace manifests discovery enumerates — a
			// lockfile alone cannot honestly answer it, so it stays dead.
			assertDies(yield* Effect.exit(double.integrity), "integrity() was called but not stubbed");
		}),
	);

	it.effect("an explicit override wins over the derivation", () =>
		Effect.gen(function* () {
			const double = LockfileReader.makeTest({
				read: Effect.suspend(() => Effect.succeed(stubbedLockfile)),
				resolvedVersion: () =>
					Effect.succeedSome(ResolvedPackage.make({
								name: "left-pad",
								version: "9.9.9",
								instanceId: "left-pad@9.9.9",
								isWorkspace: false,
							})),
			});
			const resolved = yield* double.resolvedVersion("left-pad");
			assert.isTrue(O.isSome(resolved));
			if (O.isSome(resolved)) assert.strictEqual(resolved.value.version, "9.9.9");
		}),
	);
});

// Bound to a const — layers memoize by reference.
const StubbedLockfiles = LockfileReader.layerTest({
	read: Effect.suspend(() =>
		Effect.succeed(Lockfile.make({ format: "pnpm", lockfileVersion: "9.0", packages: [], workspaceDependencies: [] }))),
});

describe("LockfileReader.layerTest — provides the service", () => {
	layer(StubbedLockfiles)((it) => {
		it.effect("the layer satisfies consumers, with the derivation intact through it", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				assert.strictEqual((yield* reader.read).packages.length, 0);
				assert.isTrue(O.isNone(yield* reader.resolvedVersion("effect")));
			}),
		);
	});
});
