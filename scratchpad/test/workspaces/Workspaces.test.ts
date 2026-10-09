// The one-call conveniences on the composite: `Workspaces.resolverLayer`
// (the two @effected/npm contracts over one factory call) and
// `Workspaces.resolveManifest` (whole-manifest projection in one shot).
//
// Everything runs on the virtual filesystem — `platform(tree)` — so the
// factory's FileSystem/Path requirement is discharged without a platform
// package, exactly like every other suite here.

import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { CatalogResolver, Manifest, UnresolvedDependencyError, WorkspaceResolver } from "../../effected/npm/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { PublishTarget, PublishabilityDetector, WorkspacePackage, Workspaces } from "../../effected/workspaces/index.ts";
import type { Tree } from "./fixtures.ts";
import { platform } from "./fixtures.ts";

const TREE: Tree = {
	"/repo/pnpm-workspace.yaml": [
		"packages:",
		"  - 'packages/*'",
		"catalog:",
		"  effect: ^4.0.0",
		"catalogs:",
		"  react18:",
		"    react: ^18.2.0",
		"",
	].join("\n"),
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0", private: true }),
	"/repo/packages/a/package.json": JSON.stringify({ name: "@x/a", version: "1.2.3" }),
};

describe("Workspaces.resolveManifest", () => {
	it.layer(platform(TREE), { timeout: "30 seconds" })((it) => {
		it.effect("projects catalog: and workspace: specifiers across the whole manifest", () =>
			Effect.gen(function* () {
				const manifest = yield* Manifest.decode({
					name: "consumer",
					dependencies: { effect: "catalog:", react: "catalog:react18", lodash: "^4.17.0" },
					devDependencies: { "@x/a": "workspace:^" },
					scripts: { build: "tsc" },
				});
				assert.isTrue(manifest.needsResolution);

				const resolved = yield* Workspaces.resolveManifest(manifest, { cwd: "/repo" });
				const record = resolved.toRecord();
				assert.deepStrictEqual(record.dependencies, {
					effect: "^4.0.0",
					lodash: "^4.17.0",
					react: "^18.2.0",
				});
				// `workspace:^` is the pnpm publish projection against the member's
				// CONCRETE version, not a passthrough.
				assert.deepStrictEqual(record.devDependencies, { "@x/a": "^1.2.3" });
				// Non-dependency fields ride through untouched.
				assert.strictEqual(record.name, "consumer");
				assert.deepStrictEqual(record.scripts, { build: "tsc" });
				assert.isFalse(resolved.needsResolution);
			}),
		);

		it.effect("an alias-form workspace: specifier projects to pnpm's npm: publish alias", () =>
			Effect.gen(function* () {
				const manifest = yield* Manifest.decode({
					name: "consumer",
					dependencies: { viz: "workspace:@x/a@*", charts: "workspace:@x/a@^" },
				});
				const resolved = yield* Workspaces.resolveManifest(manifest, { cwd: "/repo" });
				// The dep key is the alias; the version is the TARGET member's.
				assert.deepStrictEqual(resolved.toRecord().dependencies, {
					charts: "npm:@x/a@^1.2.3",
					viz: "npm:@x/a@1.2.3",
				});
			}),
		);

		it.effect("a catalog: specifier with no catalog entry fails typed as UnresolvedDependencyError", () =>
			Effect.gen(function* () {
				const manifest = yield* Manifest.decode({ dependencies: { "left-pad": "catalog:" } });
				const error = yield* Effect.flip(Workspaces.resolveManifest(manifest, { cwd: "/repo" }));
				assert.instanceOf(error, UnresolvedDependencyError);
				assert.strictEqual(error.reason, "catalog-entry-missing");
				assert.strictEqual(error.dependency, "left-pad");
			}),
		);

		it.effect("a manifest with nothing to resolve passes through unchanged", () =>
			Effect.gen(function* () {
				const manifest = yield* Manifest.decode({ name: "plain", dependencies: { effect: "^4.0.0" } });
				// The documented skip-fast path: nothing to resolve, no assembly needed.
				assert.isFalse(manifest.needsResolution);
				const resolved = yield* Workspaces.resolveManifest(manifest, { cwd: "/repo" });
				assert.deepStrictEqual(resolved.toRecord(), { dependencies: { effect: "^4.0.0" }, name: "plain" });
			}),
		);
	});
});

describe("Workspaces.resolverLayer", () => {
	// A fresh layer per call is the factory's documented contract; a suite
	// boundary needs exactly one, bound to a const — same rule as any layer.
	// Its own requirement set is FileSystem | Path, discharged by the same
	// virtual platform every other suite uses.
	const Resolvers = Workspaces.resolverLayer({ cwd: "/repo" }).pipe(Layer.provideMerge(platform(TREE)));
	it.layer(Resolvers, { timeout: "30 seconds" })((it) => {
		it.effect("provides both @effected/npm contracts over one factory call", () =>
			Effect.gen(function* () {
				const catalogs = yield* CatalogResolver;
				const workspaces = yield* WorkspaceResolver;
				assertSome(yield* catalogs.rangeOf("effect", O.none()), "^4.0.0");
				assertSome(yield* catalogs.rangeOf("react", O.some("react18")), "^18.2.0");
				assertSome(yield* workspaces.versionOf("@x/a"), "1.2.3");
				// An unmatched name is none, not an error — the contract's convention.
				assertNone(yield* catalogs.rangeOf("nothing", O.none()));
			}),
		);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// The publishability seam.
//
// `Workspaces.layer()` deliberately does NOT provide a `PublishabilityDetector`;
// it requires one. The reason is a silent-revert hazard rather than taste: when
// the composite supplied npm semantics itself, `Layer.mergeAll` being last-wins
// meant the natural spelling of an override —
// `Layer.mergeAll(myDetector, Workspaces.layer())` — resolved to the DEFAULT,
// with no type error. For the service that decides whether a package publishes
// and to which registry, silently reverting to "publishes to the public npm
// registry, access public" is the worst failure available.
//
// These tests pin the fix from the outside: a caller's detector is the one
// observed through the composite, in BOTH merge orders, because there is no
// default left to shadow it.
// ─────────────────────────────────────────────────────────────────────────────
const CUSTOM_REGISTRY = "https://npm.internal.test/";

/** A detector nothing in this package would ever produce by accident. */
const customDetector = Layer.succeed(PublishabilityDetector, {
	detect: Effect.fn("PublishabilityDetector.detect")((pkg: WorkspacePackage) => Effect.succeed([
			PublishTarget.make({
				name: pkg.name,
				registry: CUSTOM_REGISTRY,
				directory: ".",
				access: "restricted",
				provenance: false,
			}),
		])),
});

/** Resolves whichever detector is in context and reports its registry. */
const observedRegistry = Effect.gen(function* () {
	const detector = yield* PublishabilityDetector;
	const targets = yield* detector.detect(
		WorkspacePackage.make({
			name: "@x/a",
			version: "1.2.3",
			path: "/repo/packages/a",
			packageJsonPath: "/repo/packages/a/package.json",
			relativePath: "packages/a",
			workspaceRoot: "/repo",
		}),
	);
	return targets[0]?.registry;
});

describe("Workspaces.layer — the publishability seam", () => {
	it.layer(Layer.mergeAll(Workspaces.layer(), customDetector).pipe(Layer.provideMerge(platform(TREE))), { timeout: "30 seconds" })((it) => {
		it.effect("a caller's detector is observed when merged AFTER the composite", () =>
			Effect.gen(function* () {
				assert.strictEqual(
					yield* observedRegistry,
					CUSTOM_REGISTRY,
				);
			}),
		);
	});

	it.layer(Layer.mergeAll(customDetector, Workspaces.layer()).pipe(Layer.provideMerge(platform(TREE))), { timeout: "30 seconds" })((it) => {
		it.effect("and when merged BEFORE it — the order that used to silently lose", () =>
			// This is the regression. With a default baked into the composite, this
			// spelling resolved to npm semantics and published to the wrong registry
			// with no diagnostic. It passes now because the composite supplies no
			// detector at all, so there is nothing to shadow the caller's.
			Effect.gen(function* () {
				assert.strictEqual(
					yield* observedRegistry,
					CUSTOM_REGISTRY,
				);
			}),
		);
	});

	it.layer(Layer.mergeAll(Workspaces.layer(), PublishabilityDetector.layerNpm).pipe(Layer.provideMerge(platform(TREE))), { timeout: "30 seconds" })((it) => {
		it.effect("layerNpm is opt-in and still yields npm semantics", () =>
			Effect.gen(function* () {
				assert.strictEqual(
					yield* observedRegistry,
					"https://registry.npmjs.org/",
				);
			}),
		);
	});

	it.layer(Layer.mergeAll(Workspaces.layer(), PublishabilityDetector.layerNone).pipe(Layer.provideMerge(platform(TREE))), { timeout: "30 seconds" })((it) => {
		it.effect("layerNone publishes nothing", () =>
			Effect.gen(function* () {
				assert.strictEqual(
					yield* observedRegistry,
					undefined,
				);
			}),
		);
	});
	it.effect("the npm rules are reachable as a VALUE, without entering the tag", () =>
		// The contortion this deletes: silk had to write
		// `Effect.provide(PublishabilityDetector, PublishabilityDetector.layer)`
		// inside its own implementation of that tag to reach these rules.
		Effect.gen(function* () {
			const targets = yield* PublishabilityDetector.npm.detect(
				WorkspacePackage.make({
					name: "@x/a",
					version: "1.2.3",
					path: "/repo/packages/a",
					packageJsonPath: "/repo/packages/a/package.json",
					relativePath: "packages/a",
					workspaceRoot: "/repo",
				}),
			);
			assert.strictEqual(targets[0]?.registry, "https://registry.npmjs.org/");
		}),
	);
});
