// The one-call conveniences on the composite: `Workspaces.resolverLayer`
// (the two @effected/npm contracts over one factory call) and
// `Workspaces.resolveManifest` (whole-manifest projection in one shot).
//
// Everything runs on the virtual filesystem — `platform(tree)` — so the
// factory's FileSystem/Path requirement is discharged without a platform
// package, exactly like every other suite here.

import { CatalogResolver } from "@beep/npm-spec/CatalogResolver";
import { Manifest, UnresolvedDependencyError } from "@beep/npm-spec/Manifest";
import { WorkspaceResolver } from "@beep/npm-spec/WorkspaceResolver";
import { CatalogSet, PublishabilityDetector, PublishTarget, WorkspacePackage, Workspaces } from "@beep/repo-workspaces";
import { assert, describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { platform } from "./support/fixtures.ts";
import type { Tree } from "./support/fixtures.ts";

const TREE: Tree = {
  "/repo/pnpm-workspace.yaml": A.join(
    [
      "packages:",
      "  - 'packages/*'",
      "catalog:",
      "  effect: ^4.0.0",
      "catalogs:",
      "  react18:",
      "    react: ^18.2.0",
      "",
    ],
    "\n"
  ),
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(S.fromJsonString(S.Unknown))({ name: "root", version: "0.0.0", private: true }),
    identity
  ),
  "/repo/packages/a/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(S.fromJsonString(S.Unknown))({ name: "@x/a", version: "1.2.3" }),
    identity
  ),
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
      })
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
      })
    );

    it.effect("a catalog: specifier with no catalog entry fails typed as UnresolvedDependencyError", () =>
      Effect.gen(function* () {
        const manifest = yield* Manifest.decode({ dependencies: { "left-pad": "catalog:" } });
        const error = yield* Effect.flip(Workspaces.resolveManifest(manifest, { cwd: "/repo" }));
        assert.instanceOf(error, UnresolvedDependencyError);
        assert.strictEqual(error.reason, "catalog-entry-missing");
        assert.strictEqual(error.dependency, "left-pad");
      })
    );

    it.effect("a manifest with nothing to resolve passes through unchanged", () =>
      Effect.gen(function* () {
        const manifest = yield* Manifest.decode({ name: "plain", dependencies: { effect: "^4.0.0" } });
        // The documented skip-fast path: nothing to resolve, no assembly needed.
        assert.isFalse(manifest.needsResolution);
        const resolved = yield* Workspaces.resolveManifest(manifest, { cwd: "/repo" });
        assert.deepStrictEqual(resolved.toRecord(), { dependencies: { effect: "^4.0.0" }, name: "plain" });
      })
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
        const rangeOf1 = yield* catalogs.rangeOf("effect", O.none());
        assertSome(rangeOf1, "^4.0.0");
        const rangeOf2 = yield* catalogs.rangeOf("react", O.some("react18"));
        assertSome(rangeOf2, "^18.2.0");
        const versionOf3 = yield* workspaces.versionOf("@x/a");
        assertSome(versionOf3, "1.2.3");
        // An unmatched name is none, not an error — the contract's convention.
        const rangeOf4 = yield* catalogs.rangeOf("nothing", O.none());
        assertNone(rangeOf4);
      })
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
  detect: Effect.fn("PublishabilityDetector.detect")((pkg: WorkspacePackage) =>
    Effect.succeed([
      PublishTarget.make({
        name: pkg.name,
        registry: CUSTOM_REGISTRY,
        directory: ".",
        access: "restricted",
        provenance: false,
      }),
    ])
  ),
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
    })
  );
  return targets[0]?.registry;
});

describe("Workspaces.layer — the publishability seam", () => {
  it.layer(Layer.mergeAll(Workspaces.layer(), customDetector).pipe(Layer.provideMerge(platform(TREE))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("a caller's detector is observed when merged AFTER the composite", () =>
      Effect.gen(function* () {
        const observedRegistry5 = yield* observedRegistry;
        assert.strictEqual(observedRegistry5, CUSTOM_REGISTRY);
      })
    );
  });

  it.layer(Layer.mergeAll(customDetector, Workspaces.layer()).pipe(Layer.provideMerge(platform(TREE))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("and when merged BEFORE it — the order that used to silently lose", () =>
      // This is the regression. With a default baked into the composite, this
      // spelling resolved to npm semantics and published to the wrong registry
      // with no diagnostic. It passes now because the composite supplies no
      // detector at all, so there is nothing to shadow the caller's.
      Effect.gen(function* () {
        const observedRegistry6 = yield* observedRegistry;
        assert.strictEqual(observedRegistry6, CUSTOM_REGISTRY);
      })
    );
  });

  it.layer(
    Layer.mergeAll(Workspaces.layer(), PublishabilityDetector.layerNpm).pipe(Layer.provideMerge(platform(TREE))),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("layerNpm is opt-in and still yields npm semantics", () =>
      Effect.gen(function* () {
        const observedRegistry7 = yield* observedRegistry;
        assert.strictEqual(observedRegistry7, "https://registry.npmjs.org/");
      })
    );
  });

  it.layer(
    Layer.mergeAll(Workspaces.layer(), PublishabilityDetector.layerNone).pipe(Layer.provideMerge(platform(TREE))),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("layerNone publishes nothing", () =>
      Effect.gen(function* () {
        const observedRegistry8 = yield* observedRegistry;
        assert.strictEqual(observedRegistry8, undefined);
      })
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
        })
      );
      assert.strictEqual(targets[0]?.registry, "https://registry.npmjs.org/");
    })
  );
});

import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { WorkspacesGitOptions, WorkspacesOptions } from "@beep/repo-workspaces/Workspaces";
import * as Arbitrary from "effect/Arbitrary";
import { identity } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

describe("composite workspace option schemas", () => {
  const roundTrip = <T, E>(name: string, schema: S.Codec<T, E>, generated: S.Schema<T>): void => {
    it.effect.prop(
      name,
      [Arbitrary.schema(generated)],
      ([value]) =>
        Effect.gen(function* () {
          const encoded = yield* S.encodeEffect(schema)(value);
          const decoded = yield* S.decodeEffect(schema)(encoded);
          assert.isTrue(S.toEquivalence(schema)(decoded, value));
          const value9 = yield* S.encodeEffect(schema)(decoded);
          assert.deepStrictEqual(value9, encoded);
        }),
      { arbitrary: fcRuns(100) }
    );
  };
  // The owning depth declaration accepts all numbers but has no generation link.
  // Add one only to the generator; codecs under test remain the actual composites.
  const depth = WorkspacesOptions.fields.maxDepth.annotate({
    toCodecArbitrary: () =>
      S.link<number>()(S.Finite, SchemaTransformation.transform({ decode: identity, encode: identity })),
  });
  roundTrip(
    "WorkspacesOptions retains all owning-service fields",
    WorkspacesOptions,
    S.Struct({ ...WorkspacesOptions.fields, maxDepth: depth })
  );
  roundTrip(
    "WorkspacesGitOptions retains all snapshot fields",
    WorkspacesGitOptions,
    S.Struct({ ...WorkspacesGitOptions.fields, maxDepth: depth })
  );
  it.effect("omitted options stay omitted and an explicit undefined stopAt is rejected", () =>
    Effect.gen(function* () {
      const value10 = yield* S.decodeEffect(WorkspacesOptions)({});
      assert.deepStrictEqual(value10, {});
      const value11 = yield* S.decodeEffect(WorkspacesGitOptions)({});
      assert.deepStrictEqual(value11, {});
      assertFalse(S.is(WorkspacesGitOptions)({ stopAt: undefined }));
      for (const maxDepth of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        const options = { maxDepth };
        const argument = S.decodeEffect(WorkspacesOptions);
        const value1 = yield* S.encodeEffect(WorkspacesOptions)(options);
        const value12 = yield* argument(value1);
        assert.deepStrictEqual(value12, options);
        const argument1 = S.decodeEffect(WorkspacesGitOptions);
        const value2 = yield* S.encodeEffect(WorkspacesGitOptions)(options);
        const value13 = yield* argument1(value2);
        assert.deepStrictEqual(value13, options);
      }
      const seedCatalogs = CatalogSet.fromBunBlocks({ catalog: { effect: "^4.0.0" } });
      const value = { cwd: "/repo", stopAt: "/repo", maxDepth: 8, seedCatalogs };
      const value14 = yield* S.decodeEffect(WorkspacesGitOptions)(value);
      assert.deepStrictEqual(value14, value);
    })
  );
});
