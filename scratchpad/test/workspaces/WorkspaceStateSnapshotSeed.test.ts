// @effect-diagnostics strictEffectProvide:skip-file
// The seeded-catalog seam on `WorkspaceStateSnapshot`.
//
// Everything here is pure: a snapshot is a value, so these tests need no
// filesystem, no git and no layer. The cases that matter are the PRECEDENCE
// ones — a seed that could override the ref's own declaration would silently
// rewrite history, and a seed that never applied would leave the hook-injected
// catalog gap exactly where it was.

import { assert, describe, it } from "@effect/vitest";
import { CatalogResolver } from "../../effected/npm/index.ts";
import { Effect, Option, Schema } from "effect";
import { CatalogSet, PackageStateSnapshot, WorkspaceStateSnapshot } from "../../effected/workspaces/index.ts";

const catalogs = (entries: Record<string, Record<string, string>>): CatalogSet => CatalogSet.make({ entries });

const snapshot = (options: {
	readonly catalogs: CatalogSet;
	readonly importerVersions?: Record<string, Record<string, string>>;
}): WorkspaceStateSnapshot =>
	WorkspaceStateSnapshot.make({
		packages: [PackageStateSnapshot.make({ name: "@x/a", version: "1.0.0", relativePath: "packages/a" })],
		catalogs: options.catalogs,
		...(options.importerVersions === undefined ? {} : { importerVersions: options.importerVersions }),
	});

describe("WorkspaceStateSnapshot.withSeededCatalogs — precedence", () => {
	it("answers from the seed where this moment's own catalogs cannot", () => {
		// The hook-injected case: nothing committed at the ref declares `effect`,
		// so without a seed both sides of a diff resolve to nothing.
		const bare = snapshot({ catalogs: CatalogSet.empty() });
		assert.deepStrictEqual(bare.resolve("effect", "catalog:"), Option.none());

		const seeded = bare.withSeededCatalogs(catalogs({ default: { effect: "^4.0.0" } }));
		assert.deepStrictEqual(seeded.resolve("effect", "catalog:"), Option.some("^4.0.0"));
	});

	it("never lets the seed override what this moment itself declared", () => {
		// The load-bearing direction. If the seed won, a diff would report the
		// OTHER side's range as this side's, and a real change would vanish.
		const own = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) });
		const seeded = own.withSeededCatalogs(catalogs({ default: { effect: "^9.9.9" } }));
		assert.deepStrictEqual(seeded.resolve("effect", "catalog:"), Option.some("^4.0.0"));
	});

	it("applies per catalog name, not per set — a named catalog falls through independently", () => {
		const own = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) });
		const seeded = own.withSeededCatalogs(catalogs({ react18: { react: "^18.2.0" } }));
		// Own wins in `default`; the seed still answers in `react18`, which a
		// whole-set "own is non-empty, ignore the seed" shortcut would break.
		assert.deepStrictEqual(seeded.resolve("effect", "catalog:"), Option.some("^4.0.0"));
		assert.deepStrictEqual(seeded.resolve("react", "catalog:react18"), Option.some("^18.2.0"));
	});

	it("leaves `catalogs` untouched, so the field still means what it says", () => {
		const own = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) });
		const seeded = own.withSeededCatalogs(catalogs({ default: { react: "^18.2.0" } }));
		// The whole reason the seed is its own field: a consumer reading
		// `catalogs` gets the ref's declaration, never a blend.
		assert.deepStrictEqual(seeded.catalogs.entries, { default: { effect: "^4.0.0" } });
		assert.deepStrictEqual(seeded.seededCatalogs?.entries, { default: { react: "^18.2.0" } });
	});

	it("does not mutate the receiver", () => {
		const own = snapshot({ catalogs: CatalogSet.empty() });
		own.withSeededCatalogs(catalogs({ default: { effect: "^4.0.0" } }));
		assert.strictEqual(own.seededCatalogs, undefined);
		assert.deepStrictEqual(own.resolve("effect", "catalog:"), Option.none());
	});

	it("replaces an existing seed rather than merging with it", () => {
		const seeded = snapshot({ catalogs: CatalogSet.empty() })
			.withSeededCatalogs(catalogs({ default: { effect: "^4.0.0", react: "^18.2.0" } }))
			.withSeededCatalogs(catalogs({ default: { effect: "^5.0.0" } }));
		assert.deepStrictEqual(seeded.resolve("effect", "catalog:"), Option.some("^5.0.0"));
		// Merging would keep `react` and make precedence depend on call order.
		assert.deepStrictEqual(seeded.resolve("react", "catalog:"), Option.none());
	});
});

describe("WorkspaceStateSnapshot.withSeededCatalogs — against the importerVersions fallback", () => {
	const importerVersions = { "packages/a": { effect: "4.0.0-rc.109" } };

	it("prefers the seed's declared RANGE over the recorded concrete version", () => {
		// This ordering IS the fix for no-change diff rows: two refs that installed
		// the same version report the same string from `importerVersions` even when
		// the declared range moved. The seed answers with the range instead.
		const bare = snapshot({ catalogs: CatalogSet.empty(), importerVersions });
		assert.deepStrictEqual(bare.resolve("effect", "catalog:"), Option.some("4.0.0-rc.109"));

		const seeded = bare.withSeededCatalogs(catalogs({ default: { effect: "^4.0.0" } }));
		assert.deepStrictEqual(seeded.resolve("effect", "catalog:"), Option.some("^4.0.0"));
	});

	it("still falls back to importerVersions for a dependency the seed does not carry", () => {
		const seeded = snapshot({ catalogs: CatalogSet.empty(), importerVersions }).withSeededCatalogs(
			catalogs({ default: { react: "^18.2.0" } }),
		);
		assert.deepStrictEqual(seeded.resolve("effect", "catalog:"), Option.some("4.0.0-rc.109"));
	});

	it("applies the same precedence in resolveIn", () => {
		const seeded = snapshot({ catalogs: CatalogSet.empty(), importerVersions }).withSeededCatalogs(
			catalogs({ default: { effect: "^4.0.0" } }),
		);
		assert.deepStrictEqual(seeded.resolveIn("packages/a", "effect", "catalog:"), Option.some("^4.0.0"));
	});

	it("leaves non-catalog specifiers alone", () => {
		const seeded = snapshot({ catalogs: CatalogSet.empty() }).withSeededCatalogs(
			catalogs({ default: { effect: "^4.0.0" } }),
		);
		// A plain range is already its own answer; a seed must not manufacture an
		// indirection where the manifest declared none.
		assert.deepStrictEqual(seeded.resolve("effect", "^3.0.0"), Option.none());
		assert.deepStrictEqual(seeded.resolve("@x/a", "workspace:^"), Option.some("1.0.0"));
	});
});

describe("WorkspaceStateSnapshot — the seeded catalogResolver", () => {
	it.effect("resolves through the same precedence as `resolve`", () =>
		Effect.gen(function* () {
			const seeded = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) }).withSeededCatalogs(
				catalogs({ default: { effect: "^9.9.9", react: "^18.2.0" } }),
			);
			const resolver = yield* Effect.provide(CatalogResolver, seeded.catalogResolver);
			// A resolver blind to the seed would answer differently from `resolve`
			// on the very snapshot it is bound to.
			assert.deepStrictEqual(yield* resolver.rangeOf("effect", Option.none()), Option.some("^4.0.0"));
			assert.deepStrictEqual(yield* resolver.rangeOf("react", Option.none()), Option.some("^18.2.0"));
			assert.deepStrictEqual(yield* resolver.rangeOf("lodash", Option.none()), Option.none());
		}),
	);
});

describe("WorkspaceStateSnapshot.crossSeed", () => {
	it("gives each side the other's catalogs and keeps its own precedence", () => {
		const before = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) });
		const after = snapshot({ catalogs: catalogs({ default: { react: "^18.2.0" } }) });
		const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);

		assert.deepStrictEqual(seededBefore.resolve("effect", "catalog:"), Option.some("^4.0.0"));
		assert.deepStrictEqual(seededBefore.resolve("react", "catalog:"), Option.some("^18.2.0"));
		assert.deepStrictEqual(seededAfter.resolve("react", "catalog:"), Option.some("^18.2.0"));
		assert.deepStrictEqual(seededAfter.resolve("effect", "catalog:"), Option.some("^4.0.0"));
	});

	it("returns the pair in the order given", () => {
		const before = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) });
		const after = snapshot({ catalogs: catalogs({ default: { effect: "^5.0.0" } }) });
		const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);
		// Swapping the return would make every diff read backwards while every
		// individual lookup still looked right.
		assert.deepStrictEqual(seededBefore.resolve("effect", "catalog:"), Option.some("^4.0.0"));
		assert.deepStrictEqual(seededAfter.resolve("effect", "catalog:"), Option.some("^5.0.0"));
	});

	it("still reports a genuine range change between the refs", () => {
		// The case cross-seeding must NOT blur: both sides declare the catalog, so
		// each side's own value wins and the movement survives.
		const before = snapshot({ catalogs: catalogs({ default: { effect: "^0.7.0" } }) });
		const after = snapshot({ catalogs: catalogs({ default: { effect: "^0.8.0" } }) });
		const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);
		assert.notDeepEqual(seededBefore.resolve("effect", "catalog:"), seededAfter.resolve("effect", "catalog:"));
	});

	it("keeps an existing seed instead of discarding it", () => {
		// The interaction that made the two seeding surfaces cancel each other out.
		// `WorkspaceSnapshots.make` applies a layer-level `seedCatalogs` to every
		// snapshot it returns, so both sides arrive already seeded; a `crossSeed`
		// that REPLACED that seed dropped the hook-injected catalog on both sides
		// at once and silently reopened the gap this feature closes.
		const live = catalogs({ default: { "hooked-dep": "^9.9.9" } });
		const before = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) }).withSeededCatalogs(live);
		const after = snapshot({ catalogs: catalogs({ default: { effect: "^5.0.0" } }) }).withSeededCatalogs(live);

		const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);

		assert.deepStrictEqual(seededBefore.resolve("hooked-dep", "catalog:"), Option.some("^9.9.9"));
		assert.deepStrictEqual(seededAfter.resolve("hooked-dep", "catalog:"), Option.some("^9.9.9"));
	});

	it("lets the other side's catalogs win over the receiver's existing seed", () => {
		// Ordering within the merged seed. The other ref's committed declaration is
		// the cross-seed's whole point, so it outranks a carried-over seed; the
		// carried seed only fills what neither ref declared.
		const before = snapshot({ catalogs: CatalogSet.empty() }).withSeededCatalogs(
			catalogs({ default: { effect: "^1.0.0" } }),
		);
		const after = snapshot({ catalogs: catalogs({ default: { effect: "^5.0.0" } }) });
		const [seededBefore] = WorkspaceStateSnapshot.crossSeed(before, after);
		assert.deepStrictEqual(seededBefore.resolve("effect", "catalog:"), Option.some("^5.0.0"));
	});

	it("suppresses a change neither ref declared — the layerNoop limitation, pinned", () => {
		// Both sides get the catalog only from the other, so they agree by
		// construction. This is what cross-seeding alone can see: two snapshots
		// whose OWN catalogs are empty — the shape `at(ref)` produces under
		// `ConfigDependencyHooks.layerNoop`. Under a replaying layer `at(ref)`
		// replays each ref's pinned config dependency and the two `catalogs`
		// fields differ, which the "genuine range change" case above covers.
		// Pinned so a future change to this behaviour is a deliberate decision.
		const before = snapshot({ catalogs: CatalogSet.empty(), importerVersions: { ".": { effect: "0.7.0" } } });
		const after = snapshot({ catalogs: CatalogSet.empty(), importerVersions: { ".": { effect: "0.7.0" } } });
		const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);
		assert.deepStrictEqual(seededBefore.resolve("effect", "catalog:"), seededAfter.resolve("effect", "catalog:"));
	});
});

describe("WorkspaceStateSnapshot — seededCatalogs and serialization", () => {
	it.effect("round-trips a seeded snapshot", () =>
		Effect.gen(function* () {
			const seeded = snapshot({ catalogs: catalogs({ default: { effect: "^4.0.0" } }) }).withSeededCatalogs(
				catalogs({ react18: { react: "^18.2.0" } }),
			);
			const encoded = yield* Schema.encodeEffect(WorkspaceStateSnapshot)(seeded);
			const decoded = yield* Schema.decodeEffect(WorkspaceStateSnapshot)(encoded);
			assert.deepStrictEqual(decoded.resolve("react", "catalog:react18"), Option.some("^18.2.0"));
			assert.deepStrictEqual(decoded.catalogs.entries, { default: { effect: "^4.0.0" } });
		}),
	);

	it.effect("carries hookReplays through withSeededCatalogs and crossSeed, and round-trips it", () =>
		Effect.gen(function* () {
			const replays = { "@scope/plugin": "1.0.0" };
			const before = WorkspaceStateSnapshot.make({
				packages: [],
				catalogs: catalogs({ default: { effect: "^4.0.0" } }),
				importerVersions: {},
				hookReplays: replays,
			});
			const after = snapshot({ catalogs: catalogs({ default: { effect: "^5.0.0" } }) });
			assert.deepStrictEqual(before.withSeededCatalogs(CatalogSet.empty()).hookReplays, replays);
			const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);
			assert.deepStrictEqual(seededBefore.hookReplays, replays);
			// The other side had none, and seeding must not invent one.
			assert.isUndefined(seededAfter.hookReplays);
			const encoded = yield* Schema.encodeEffect(WorkspaceStateSnapshot)(seededBefore);
			const decoded = yield* Schema.decodeEffect(WorkspaceStateSnapshot)(encoded);
			assert.deepStrictEqual(decoded.hookReplays, replays);
		}),
	);

	it.effect("decodes a snapshot serialized before hookReplays existed", () =>
		Effect.gen(function* () {
			const decoded = yield* Schema.decodeEffect(WorkspaceStateSnapshot)({
				packages: [],
				catalogs: { entries: {} },
				importerVersions: {},
			});
			assert.isUndefined(decoded.hookReplays);
		}),
	);

	it.effect("decodes a snapshot serialized before the field existed", () =>
		Effect.gen(function* () {
			// The field is optional precisely so stored values stay readable, and an
			// absent seed must be inert rather than an empty-set answer.
			const decoded = yield* Schema.decodeEffect(WorkspaceStateSnapshot)({
				packages: [],
				catalogs: { entries: { default: { effect: "^4.0.0" } } },
			});
			assert.strictEqual(decoded.seededCatalogs, undefined);
			assert.deepStrictEqual(decoded.resolve("effect", "catalog:"), Option.some("^4.0.0"));
		}),
	);
});
