import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { GlobPattern } from "@beep/glob";
import { PublishConfig, WorkspaceManifestError, WorkspacePackage } from "@beep/repo-workspaces";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { identity, pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const UnknownJson = S.fromJsonString(S.Unknown);

const base = {
  version: "1.0.0",
  path: "/repo/packages/utils",
  packageJsonPath: "/repo/packages/utils/package.json",
  relativePath: "packages/utils",
  workspaceRoot: "/repo",
};

const utils = WorkspacePackage.make({
  name: "@my-org/utils",
  ...base,
  dependencies: { effect: "^4.0.0" },
  devDependencies: { vitest: "^3.0.0", "@types/node": "^24.0.0" },
  peerDependencies: { typescript: "^6.0.0" },
  optionalDependencies: { fsevents: "^2.0.0" },
});

describe("WorkspacePackage", () => {
  it("defaults private to false and every dependency map to empty", () => {
    const bare = WorkspacePackage.make({ name: "bare", ...base });
    assert.isFalse(bare.private);
    assert.deepStrictEqual(bare.dependencies, {});
    assert.deepStrictEqual(bare.devDependencies, {});
    assert.deepStrictEqual(bare.peerDependencies, {});
    assert.deepStrictEqual(bare.optionalDependencies, {});
  });

  it("isRootWorkspace is true only at relativePath '.'", () => {
    assert.isFalse(utils.isRootWorkspace);
    assert.isTrue(WorkspacePackage.make({ name: "root", ...base, relativePath: "." }).isRootWorkspace);
  });

  it("isPublic is the negation of private", () => {
    assert.isTrue(utils.isPublic);
    assert.isFalse(WorkspacePackage.make({ name: "p", ...base, private: true }).isPublic);
  });

  it("scope extracts the npm scope, or none", () => {
    assertSome(utils.scope, "@my-org");
    assertNone(WorkspacePackage.make({ name: "plain", ...base }).scope);
  });

  it("unscopedName strips the scope and leaves an unscoped name alone", () => {
    assert.strictEqual(utils.unscopedName, "utils");
    assert.strictEqual(WorkspacePackage.make({ name: "plain", ...base }).unscopedName, "plain");
  });

  it("allDependencies merges all four kinds", () => {
    assert.deepStrictEqual(R.keys(utils.allDependencies).sort(), [
      "@types/node",
      "effect",
      "fsevents",
      "typescript",
      "vitest",
    ]);
  });

  it("allDependencies gives dependencies precedence over the other kinds", () => {
    const shadowed = WorkspacePackage.make({
      name: "s",
      ...base,
      dependencies: { x: "1.0.0" },
      devDependencies: { x: "2.0.0" },
      peerDependencies: { x: "3.0.0" },
      optionalDependencies: { x: "4.0.0" },
    });
    assert.strictEqual(shadowed.allDependencies.x, "1.0.0");
  });

  it("the per-kind predicates each answer only for their own kind", () => {
    assert.isTrue(utils.hasDependency("effect"));
    assert.isFalse(utils.hasDependency("vitest"));
    assert.isTrue(utils.hasDevDependency("vitest"));
    assert.isTrue(utils.hasPeerDependency("typescript"));
    assert.isTrue(utils.hasOptionalDependency("fsevents"));
    assert.isFalse(utils.hasOptionalDependency("typescript"));
  });

  it("hasAnyDependencyOn covers every kind, including the LAST one checked", () => {
    assert.isTrue(utils.hasAnyDependencyOn("effect"));
    assert.isTrue(
      utils.hasAnyDependencyOn("fsevents"),
      "fsevents is optional, the last kind checked; a short-circuit that forgets it still passes on effect"
    );
    assert.isFalse(utils.hasAnyDependencyOn("react"));
  });

  it("dependencyVersion searches all four kinds", () => {
    assertSome(utils.dependencyVersion("effect"), "^4.0.0");
    assertSome(utils.dependencyVersion("fsevents"), "^2.0.0");
    assertNone(utils.dependencyVersion("react"));
  });

  it("matchesDependency accepts a compiled GlobPattern", () => {
    const pattern = GlobPattern.make({ source: "@types/*" });
    assert.isTrue(utils.matchesDependency(pattern));
  });

  it("matchesDependency accepts a source string", () => {
    assert.isTrue(utils.matchesDependency("@types/*"));
    assert.isFalse(utils.matchesDependency("@angular/*"));
  });

  it("matchesDependency honours the full minimatch dialect, not a regex approximation", () => {
    assert.isTrue(utils.matchesDependency("{effect,react}"), "v3's hand-rolled glob had no brace expansion");
    assert.isTrue(utils.matchesDependency("+(vite|vitest)"), "v3's hand-rolled glob had no extglobs");
    assert.isTrue(utils.matchesDependency("v?test"));
  });

  it("matchesDependency searches every dependency KIND, not just dependencies", () => {
    assert.isTrue(utils.matchesDependency("fseven*"));
  });

  it("dependencyDiff reports additions, removals and version changes", () => {
    const before = WorkspacePackage.make({
      name: "x",
      ...base,
      dependencies: { keep: "1.0.0", bumped: "1.0.0", gone: "1.0.0" },
    });
    const after = WorkspacePackage.make({
      name: "x",
      ...base,
      dependencies: { keep: "1.0.0", bumped: "2.0.0", fresh: "1.0.0" },
    });
    const diff = after.dependencyDiff(before);
    assert.deepStrictEqual(diff.added, { fresh: "1.0.0" });
    assert.deepStrictEqual(diff.removed, { gone: "1.0.0" });
    assert.deepStrictEqual(diff.changed, { bumped: { from: "1.0.0", to: "2.0.0" } });
  });

  it("dependencyDiff of a package against itself is empty", () => {
    const diff = utils.dependencyDiff(utils);
    assert.deepStrictEqual(diff.added, {});
    assert.deepStrictEqual(diff.removed, {});
    assert.deepStrictEqual(diff.changed, {});
  });

  it("dependencyDiff compares across kinds, so a move at one version is invisible", () => {
    const asDep = WorkspacePackage.make({ name: "x", ...base, dependencies: { moved: "1.0.0" } });
    const asPeer = WorkspacePackage.make({ name: "x", ...base, peerDependencies: { moved: "1.0.0" } });
    const diff = asPeer.dependencyDiff(asDep);
    assert.deepStrictEqual(diff.added, {});
    assert.deepStrictEqual(diff.removed, {});
    assert.deepStrictEqual(diff.changed, {});
  });

  it("toWorkspaceManifest projects onto the lockfiles integrity input", () => {
    const wm = utils.toWorkspaceManifest();
    assert.strictEqual(wm.name, "@my-org/utils");
    assert.deepStrictEqual(wm.dependencies, { effect: "^4.0.0" });
    assert.deepStrictEqual(wm.peerDependencies, { typescript: "^6.0.0" });
  });

  it("publishConfig carries the typed subset", () => {
    const scoped = WorkspacePackage.make({
      name: "@my-org/private",
      ...base,
      private: true,
      publishConfig: PublishConfig.make({ access: "restricted", registry: "https://npm.internal/" }),
    });
    assert.strictEqual(scoped.publishConfig?.access, "restricted");
    assert.strictEqual(scoped.publishConfig?.registry, "https://npm.internal/");
    assert.isUndefined(scoped.publishConfig?.directory);
  });

  it("publishConfig.linkDirectory round-trips through decode and encode", () => {
    const decoded = Result.getOrThrow(
      S.decodeResult(PublishConfig)({ directory: "dist/dev/pkg", linkDirectory: true })
    );
    assert.isTrue(
      decoded.linkDirectory,
      "pnpm dist-linking: directory is what publishes, linkDirectory points workspace links there in development"
    );
    assert.strictEqual(decoded.directory, "dist/dev/pkg");

    const encoded = Result.getOrThrow(S.encodeUnknownResult(PublishConfig)(decoded));
    assert.deepStrictEqual(encoded, { directory: "dist/dev/pkg", linkDirectory: true });
  });

  it("publishConfig.linkDirectory is an optionalKey — absent stays absent, never explicit undefined", () => {
    const absent = Result.getOrThrow(S.decodeResult(PublishConfig)({ access: "public" }));
    assert.isFalse("linkDirectory" in absent);
    assert.isFalse("linkDirectory" in Result.getOrThrow(S.encodeUnknownResult(PublishConfig)(absent)));

    const explicit = PublishConfig.make({ linkDirectory: false });
    assert.isFalse(explicit.linkDirectory);
  });
});

describe("WorkspacePackage.dependencyVersion — inherited names are not dependencies, never Option.some(<Function>)", () => {
  const pkg = WorkspacePackage.make({
    name: "@x/a",
    version: "1.0.0",
    path: "/repo/packages/a",
    packageJsonPath: "/repo/packages/a/package.json",
    relativePath: "packages/a",
    workspaceRoot: "/repo",
    private: false,
    dependencies: { effect: "^4.0.0" },
    devDependencies: {},
    peerDependencies: {},
    optionalDependencies: {},
  });

  for (const inherited of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"]) {
    it(`dependencyVersion(${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(inherited), identity)}) is none`, () => {
      assertNone(pkg.dependencyVersion(inherited));
    });

    it(`hasAnyDependencyOn(${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(inherited), identity)}) is false`, () => {
      assert.isFalse(
        pkg.hasAnyDependencyOn(inherited),
        "a bare dependencies[name] lookup answers for names inherited from Object.prototype"
      );
    });
  }

  it("a real declared dependency still resolves", () => {
    assertSome(pkg.dependencyVersion("effect"), "^4.0.0");
  });
});

describe("WorkspacePackage.manifestRecord", () => {
  it("defaults to an empty record at construction sites that predate the field", () => {
    const bare = WorkspacePackage.make({ name: "bare", ...base });
    assert.deepStrictEqual(bare.manifestRecord, {});
  });

  it("round-trips a non-trivial record through JSON serialization", () => {
    const pkg = WorkspacePackage.make({
      name: "@my-org/utils",
      ...base,
      dependencies: { effect: "^4.0.0" },
      manifestRecord: {
        name: "@my-org/utils",
        version: "1.0.0",
        scripts: { build: "tsc", test: "vitest run" },
        exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
        sideEffects: false,
      },
    });
    const wire: unknown = pipe(
      pkg,
      S.encodeUnknownResult(WorkspacePackage),
      Result.getOrThrow,
      S.encodeUnknownResult(UnknownJson),
      Result.getOrThrowWith(identity),
      S.decodeResult(UnknownJson),
      Result.getOrThrowWith(identity)
    );
    const decoded = Result.getOrThrow(S.decodeUnknownResult(WorkspacePackage)(wire));
    assert.deepStrictEqual(
      decoded.manifestRecord,
      pkg.manifestRecord,
      "a consumer persisting discovery output keeps nested unknowns outside the discovery slice"
    );
    assert.deepStrictEqual(decoded.dependencies, { effect: "^4.0.0" });
  });

  it("a previously-serialized value WITHOUT the field decodes to an empty record", () => {
    const legacy = {
      name: "old",
      version: "1.0.0",
      path: "/repo/packages/old",
      packageJsonPath: "/repo/packages/old/package.json",
      relativePath: "packages/old",
      workspaceRoot: "/repo",
    };
    const decoded = Result.getOrThrow(S.decodeResult(WorkspacePackage)(legacy));
    assert.deepStrictEqual(
      decoded.manifestRecord,
      {},
      "snapshots from before the field stay valid: the decoding default, not an error or undefined"
    );
  });

  // decision: workspace-root-has-no-decoding-default
  it("a value serialized BEFORE workspaceRoot existed fails decode, loudly", () => {
    const preField = {
      name: "old",
      version: "1.0.0",
      path: "/repo/packages/old",
      packageJsonPath: "/repo/packages/old/package.json",
      relativePath: "packages/old",
    };
    assert.throws(() => Result.getOrThrow(S.decodeUnknownResult(WorkspacePackage)(preField)));
  });
});

describe("WorkspacePackage — own-key records", () => {
  const withProto = (version: string) =>
    WorkspacePackage.make({
      name: "x",
      ...base,
      dependencies: R.fromEntries([["__proto__", version]]),
    });
  const bare = WorkspacePackage.make({ name: "x", ...base });

  it("reports a __proto__ addition as an own diff entry", () => {
    const diff = withProto("1.0.0").dependencyDiff(bare);
    assert.deepStrictEqual(diff.added, R.fromEntries([["__proto__", "1.0.0"]]));
    assertSome(R.get(diff.added, "__proto__"), "1.0.0");
    assert.deepStrictEqual(diff.removed, {});
    assert.deepStrictEqual(diff.changed, {});
  });

  it("reports a __proto__ removal as an own diff entry", () => {
    const diff = bare.dependencyDiff(withProto("1.0.0"));
    assert.deepStrictEqual(diff.removed, R.fromEntries([["__proto__", "1.0.0"]]));
    assertSome(R.get(diff.removed, "__proto__"), "1.0.0");
    assert.deepStrictEqual(diff.added, {});
    assert.deepStrictEqual(diff.changed, {});
  });

  it("reports a __proto__ change as an own diff entry", () => {
    const diff = withProto("2.0.0").dependencyDiff(withProto("1.0.0"));
    assert.deepStrictEqual(diff.changed, R.fromEntries([["__proto__", { from: "1.0.0", to: "2.0.0" }]]));
    assertSome(R.get(diff.changed, "__proto__"), { from: "1.0.0", to: "2.0.0" });
    assert.deepStrictEqual(diff.added, {});
    assert.deepStrictEqual(diff.removed, {});
  });

  it("reads declared hostile keys while defaults have no own entries", () => {
    for (const name of ["__proto__", "constructor", "toString"]) {
      assertNone(bare.dependencyVersion(name));
      assertNone(R.get(bare.manifestRecord, name));
      const pkg = WorkspacePackage.make({ name: "x", ...base, dependencies: R.fromEntries([[name, "1.0.0"]]) });
      assertSome(pkg.dependencyVersion(name), "1.0.0");
    }
  });
});

describe("WorkspaceManifestError encoding", () => {
  it.effect("preserves the originating cause stack", () =>
    Effect.gen(function* () {
      const cause = new Error("original manifest failure");
      const encoded = yield* S.encodeEffect(WorkspaceManifestError)(
        WorkspaceManifestError.make({
          packageJsonPath: "/repo/package.json",
          kind: "read",
          cause,
        })
      );
      if (!P.isObject(encoded.cause)) return assert.fail("expected an encoded Error cause");
      assert.strictEqual(encoded.cause.stack, cause.stack);
    })
  );
});

it.effect.prop(
  "a publish config generated from its schema survives an encode/decode round trip",
  [Arbitrary.schema(PublishConfig)],
  ([value]) =>
    Effect.gen(function* () {
      const argument = S.decodeEffect(PublishConfig);
      const value1 = yield* S.encodeEffect(PublishConfig)(value);
      const decoded = yield* argument(value1);
      assert.isTrue(S.toEquivalence(PublishConfig)(decoded, value));
    }),
  { arbitrary: fcRuns(50) }
);
