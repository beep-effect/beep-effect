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
        assert.deepStrictEqual(
          record.devDependencies,
          { "@x/a": "^1.2.3" },
          "workspace:^ is pnpm's publish projection against the member's concrete version, not a passthrough"
        );
        assert.strictEqual(record.name, "consumer", "non-dependency fields ride through untouched");
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
        assert.deepStrictEqual(
          resolved.toRecord().dependencies,
          {
            charts: "npm:@x/a@^1.2.3",
            viz: "npm:@x/a@1.2.3",
          },
          "the dependency key is the alias; the version is the target member's"
        );
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
        assert.isFalse(manifest.needsResolution, "the documented skip-fast path: nothing to resolve, no assembly");
        const resolved = yield* Workspaces.resolveManifest(manifest, { cwd: "/repo" });
        assert.deepStrictEqual(resolved.toRecord(), { dependencies: { effect: "^4.0.0" }, name: "plain" });
      })
    );
  });
});

describe("Workspaces.resolverLayer", () => {
  const Resolvers = Workspaces.resolverLayer({ cwd: "/repo" }).pipe(Layer.provideMerge(platform(TREE)));
  it.layer(Resolvers, { timeout: "30 seconds" })((it) => {
    it.effect(
      "provides both @effected/npm contracts over one factory call; an unmatched name is none, not an error",
      () =>
        Effect.gen(function* () {
          const catalogs = yield* CatalogResolver;
          const workspaces = yield* WorkspaceResolver;
          const rangeOf1 = yield* catalogs.rangeOf("effect", O.none());
          assertSome(rangeOf1, "^4.0.0");
          const rangeOf2 = yield* catalogs.rangeOf("react", O.some("react18"));
          assertSome(rangeOf2, "^18.2.0");
          const versionOf3 = yield* workspaces.versionOf("@x/a");
          assertSome(versionOf3, "1.2.3");
          const unmatchedNameRange = yield* catalogs.rangeOf("nothing", O.none());
          assertNone(unmatchedNameRange);
        })
    );
  });
});

// decision: composite-supplies-no-publishability-detector
const CUSTOM_REGISTRY = "https://npm.internal.test/";

const unmistakableCustomDetector = Layer.succeed(PublishabilityDetector, {
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

const registryOfDetectorInContext = Effect.gen(function* () {
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
  it.layer(Layer.mergeAll(Workspaces.layer(), unmistakableCustomDetector).pipe(Layer.provideMerge(platform(TREE))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("a caller's detector is observed when merged AFTER the composite", () =>
      Effect.gen(function* () {
        const observedRegistry5 = yield* registryOfDetectorInContext;
        assert.strictEqual(observedRegistry5, CUSTOM_REGISTRY);
      })
    );
  });

  it.layer(Layer.mergeAll(unmistakableCustomDetector, Workspaces.layer()).pipe(Layer.provideMerge(platform(TREE))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("and when merged BEFORE it — the order that used to silently lose", () =>
      Effect.gen(function* () {
        const observedRegistry6 = yield* registryOfDetectorInContext;
        assert.strictEqual(
          observedRegistry6,
          CUSTOM_REGISTRY,
          "the regression: a default baked into the composite won this spelling and published to the wrong registry"
        );
      })
    );
  });

  it.layer(
    Layer.mergeAll(Workspaces.layer(), PublishabilityDetector.layerNpm).pipe(Layer.provideMerge(platform(TREE))),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("layerNpm is opt-in and still yields npm semantics", () =>
      Effect.gen(function* () {
        const observedRegistry7 = yield* registryOfDetectorInContext;
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
        const observedRegistry8 = yield* registryOfDetectorInContext;
        assert.strictEqual(observedRegistry8, undefined);
      })
    );
  });
  it.effect("the npm rules are reachable as a VALUE, without entering the tag", () =>
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
      assert.strictEqual(
        targets[0]?.registry,
        "https://registry.npmjs.org/",
        "silk had to provide PublishabilityDetector inside its own implementation of the tag to reach these rules"
      );
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
  const depthWithGeneratorLink = WorkspacesOptions.fields.maxDepth.annotate({
    toCodecArbitrary: () =>
      S.link<number>()(S.Finite, SchemaTransformation.transform({ decode: identity, encode: identity })),
  });
  roundTrip(
    "WorkspacesOptions retains all owning-service fields",
    WorkspacesOptions,
    S.Struct({ ...WorkspacesOptions.fields, maxDepth: depthWithGeneratorLink })
  );
  roundTrip(
    "WorkspacesGitOptions retains all snapshot fields",
    WorkspacesGitOptions,
    S.Struct({ ...WorkspacesGitOptions.fields, maxDepth: depthWithGeneratorLink })
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
