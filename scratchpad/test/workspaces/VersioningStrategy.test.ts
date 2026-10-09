// @effect-diagnostics strictEffectProvide:skip-file
// Classification is pure and total, so most of this file is plain `it()`.
// Only `detect` — the one effectful entry point — needs a runner, and it is
// tested against `WorkspaceDiscovery.layerTest` plus a stub
// `PublishabilityDetector`, so nothing here touches a filesystem.

import { assert, describe, it, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import {
	PublishTarget,
	PublishabilityDetector,
	VersioningStrategy,
	WorkspaceDiscovery,
	WorkspacePackage,
} from "../../effected/workspaces/index.ts";

const pkg = (name: string) =>
	WorkspacePackage.make({
		name,
		version: "1.0.0",
		path: `/repo/packages/${name}`,
		packageJsonPath: `/repo/packages/${name}/package.json`,
		relativePath: `packages/${name}`,
		workspaceRoot: "/repo",
	});

/** A detector that publishes exactly the named packages and nothing else. */
const publishes = (...names: ReadonlyArray<string>) =>
	Layer.succeed(PublishabilityDetector, {
		detect: Effect.fn("PublishabilityDetector.detect")((candidate: WorkspacePackage) => Effect.succeed(
				names.includes(candidate.name)
					? [
							PublishTarget.make({
								name: candidate.name,
								registry: "https://registry.npmjs.org/",
								directory: ".",
								access: "public",
							}),
						]
					: [],
			)),
	});

describe("VersioningStrategy.classify", () => {
	it("no publishable packages is `single`", () => {
		const strategy = VersioningStrategy.classify({ packages: [] });
		assert.strictEqual(strategy.type, "single");
		assert.deepStrictEqual(strategy.publishablePackages, []);
	});

	it("one publishable package is `single`", () => {
		assert.strictEqual(VersioningStrategy.classify({ packages: ["solo"] }).type, "single");
	});

	it("several packages with no fixed groups is `independent`", () => {
		const strategy = VersioningStrategy.classify({ packages: ["a", "b"] });
		assert.strictEqual(strategy.type, "independent");
	});

	it("several packages ALL inside one fixed group is `fixed-group`", () => {
		const strategy = VersioningStrategy.classify({
			packages: ["a", "b"],
			fixedGroups: [["a", "b"]],
		});
		assert.strictEqual(strategy.type, "fixed-group");
		assert.deepStrictEqual(strategy.fixedGroups, [["a", "b"]]);
	});

	it("a group that covers only SOME publishable packages is `independent`", () => {
		// The discriminating case: a naive "is there any fixed group?" test would
		// call this fixed-group and cut one shared tag for packages that version
		// separately.
		const strategy = VersioningStrategy.classify({
			packages: ["a", "b", "c"],
			fixedGroups: [["a", "b"]],
		});
		assert.strictEqual(strategy.type, "independent");
	});

	it("groups are matched INDIVIDUALLY — two groups covering the set between them is `independent`", () => {
		// The union of the groups covers everything, but no SINGLE group does, so
		// the packages do not move in lockstep.
		const strategy = VersioningStrategy.classify({
			packages: ["a", "b"],
			fixedGroups: [["a"], ["b"]],
		});
		assert.strictEqual(strategy.type, "independent");
	});

	it("a group naming packages that are not publishable still counts", () => {
		// `fixedGroups` is caller-supplied and describes the whole repo, not just
		// the publishable slice. A group that is a strict SUPERSET of the
		// publishable set still means lockstep.
		const strategy = VersioningStrategy.classify({
			packages: ["a", "b"],
			fixedGroups: [["a", "b", "private-thing", "does-not-exist"]],
		});
		assert.strictEqual(strategy.type, "fixed-group");
	});

	it("publishable packages are sorted and de-duplicated", () => {
		const strategy = VersioningStrategy.classify({ packages: ["b", "a", "b"] });
		assert.deepStrictEqual(strategy.publishablePackages, ["a", "b"]);
	});

	it("a duplicated single package is still `single`", () => {
		// Without de-duplication `["a", "a"]` has length 2 and misclassifies as
		// independent, cutting per-package tags for a one-package repo.
		assert.strictEqual(VersioningStrategy.classify({ packages: ["a", "a"] }).type, "single");
	});
});

describe("VersioningStrategy — derived getters", () => {
	it("only `independent` needs per-package tags", () => {
		assert.isFalse(VersioningStrategy.classify({ packages: ["a"] }).perPackageTags);
		assert.isFalse(VersioningStrategy.classify({ packages: ["a", "b"], fixedGroups: [["a", "b"]] }).perPackageTags);
		assert.isTrue(VersioningStrategy.classify({ packages: ["a", "b"] }).perPackageTags);
	});

	it("tagStyle follows perPackageTags", () => {
		assert.strictEqual(VersioningStrategy.classify({ packages: ["a"] }).tagStyle, "single");
		assert.strictEqual(VersioningStrategy.classify({ packages: ["a", "b"] }).tagStyle, "scoped");
	});
});

describe("VersioningStrategy.tagsFor", () => {
	const releases = [
		{ name: "@acme/cli", version: "1.2.3" },
		{ name: "helper", version: "1.2.3" },
	];

	it("independent versioning cuts one tag per package", () => {
		const tags = VersioningStrategy.classify({ packages: ["@acme/cli", "helper"] }).tagsFor(releases);
		assert.deepStrictEqual(
			tags.map((tag) => tag.value),
			// The default versionPrefix is "" uniformly (strict SemVer,
			// 2026-07-25) — no scoped/unscoped asymmetry.
			["@acme/cli@1.2.3", "helper@1.2.3"],
		);
	});

	it("a fixed group cuts exactly ONE shared tag", () => {
		const strategy = VersioningStrategy.classify({
			packages: ["@acme/cli", "helper"],
			fixedGroups: [["@acme/cli", "helper"]],
		});
		const tags = strategy.tagsFor(releases);
		assert.lengthOf(tags, 1);
		assert.strictEqual(tags[0]?.value, "1.2.3");
		assert.strictEqual(tags[0]?.style, "single");
	});

	it("a single-package repo cuts one bare-version tag", () => {
		const tags = VersioningStrategy.classify({ packages: ["solo"] }).tagsFor([{ name: "solo", version: "4.0.0" }]);
		assert.deepStrictEqual(
			tags.map((tag) => tag.value),
			["4.0.0"],
		);
	});

	it("no releases means no tags, under either style", () => {
		assert.deepStrictEqual(VersioningStrategy.classify({ packages: ["a", "b"] }).tagsFor([]), []);
		assert.deepStrictEqual(VersioningStrategy.classify({ packages: ["a"] }).tagsFor([]), []);
	});

	it("passes formatting options through to every tag", () => {
		const tags = VersioningStrategy.classify({ packages: ["a", "b"] }).tagsFor(releases, { versionPrefix: "" });
		assert.deepStrictEqual(
			tags.map((tag) => tag.value),
			["@acme/cli@1.2.3", "helper@1.2.3"],
		);
	});
});

describe("VersioningStrategy.detect — independent", () => {
	layer(
		Layer.mergeAll(
			WorkspaceDiscovery.layerTest({
				listPackages: Effect.suspend(() => Effect.succeed([pkg("a"), pkg("b"), pkg("internal")])),
			}),
			publishes("a", "b"),
		),
	)((it) => {
		it.effect("classifies over the PUBLISHABLE packages only", () =>
			Effect.gen(function* () {
				const strategy = yield* VersioningStrategy.detect();
				assert.strictEqual(strategy.type, "independent");
				// `internal` publishes nowhere, so it must not appear — a workspace
				// with two publishable packages and fifty private ones is still a
				// two-package release.
				assert.deepStrictEqual(strategy.publishablePackages, ["a", "b"]);
			}),
		);
	});
});

describe("VersioningStrategy.detect — fixed groups supplied by the caller", () => {
	layer(
		Layer.mergeAll(
			WorkspaceDiscovery.layerTest({ listPackages: Effect.suspend(() => Effect.succeed([pkg("a"), pkg("b")])) }),
			publishes("a", "b"),
		),
	)((it) => {
		it.effect("honours the fixedGroups argument", () =>
			Effect.gen(function* () {
				const strategy = yield* VersioningStrategy.detect({ fixedGroups: [["a", "b"]] });
				assert.strictEqual(strategy.type, "fixed-group");
				assert.isFalse(strategy.perPackageTags);
			}),
		);

		it.effect("defaults to no fixed groups when the option is omitted", () =>
			Effect.gen(function* () {
				const strategy = yield* VersioningStrategy.detect();
				assert.strictEqual(strategy.type, "independent");
				assert.deepStrictEqual(strategy.fixedGroups, []);
			}),
		);
	});
});

describe("VersioningStrategy.detect — nothing publishes", () => {
	layer(
		Layer.mergeAll(
			WorkspaceDiscovery.layerTest({ listPackages: Effect.suspend(() => Effect.succeed([pkg("a"), pkg("b")])) }),
			publishes(),
		),
	)((it) => {
		it.effect("a workspace that publishes nothing is `single` with an empty set", () =>
			Effect.gen(function* () {
				const strategy = yield* VersioningStrategy.detect();
				assert.strictEqual(strategy.type, "single");
				assert.deepStrictEqual(strategy.publishablePackages, []);
				assert.deepStrictEqual(strategy.tagsFor([]), []);
			}),
		);
	});
});

describe("VersioningStrategy.detect — concurrency", () => {
	it.effect("overlaps independent publishability checks and keeps output stable", () =>
		Effect.gen(function* () {
			const inFlight = yield* Ref.make(0);
			const maxInFlight = yield* Ref.make(0);

			const publishingDetector = Layer.succeed(PublishabilityDetector, {
				detect: Effect.fn("PublishabilityDetector.detect")(function* (candidate: WorkspacePackage) {
						yield* Ref.update(inFlight, (n) => n + 1);
						const running = yield* Ref.get(inFlight);
						yield* Ref.update(maxInFlight, (n) => Math.max(n, running));
						yield* Effect.yieldNow;
						yield* Ref.update(inFlight, (n) => n - 1);
						return [
							PublishTarget.make({
								name: candidate.name,
								registry: "https://registry.npmjs.org/",
								directory: ".",
								access: "public",
							}),
						];
					}),
			});

			const strategy = yield* VersioningStrategy.detect().pipe(
				Effect.provide(
					Layer.mergeAll(
						WorkspaceDiscovery.layerTest({
							listPackages: Effect.suspend(() => Effect.succeed([pkg("d"), pkg("b"), pkg("a"), pkg("c")])),
						}),
						publishingDetector,
					),
				),
			);

			assert.deepStrictEqual(strategy.publishablePackages, ["a", "b", "c", "d"]);
			const max = yield* Ref.get(maxInFlight);
			assert.isTrue(max > 1, `expected concurrent publishability checks, got max in flight = ${max}`);
		}),
	);
});
