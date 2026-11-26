import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
import { CatalogResolver } from "@beep/npm-spec/CatalogResolver";
import { WorkspaceResolver } from "@beep/npm-spec/WorkspaceResolver";
import {
  CatalogSet,
  LockfileReadError,
  LockfileReader,
  PackageManagerDetector,
  WorkspaceCatalogs,
  WorkspaceDiscovery,
  WorkspaceRoot,
  Workspaces,
} from "@beep/repo-workspaces";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { dual, identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { manifest, platform, platformWith } from "./support/fixtures.ts";
import type { Tree } from "./support/fixtures.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const workspacesOver = (tree: Tree) => {
  const base = platform(tree);
  return Workspaces.layer({ cwd: "/repo" }).pipe(Layer.provideMerge(base));
};

describe("CatalogSet", () => {
  it("empty has no catalogs", () => {
    assert.isTrue(CatalogSet.empty().isEmpty);
  });

  it.effect("normalizes pnpm's unnamed top-level catalog under 'default'", () =>
    Effect.gen(function* () {
      const set = yield* CatalogSet.fromWorkspaceYaml("catalog:\n  effect: ^4.0.0\n");
      assert.deepStrictEqual(R.keys(set.entries), ["default"]);
      assertSome(set.rangeOf("effect", O.none()), "^4.0.0");
    })
  );

  it.effect("reads every named catalog, not only the first", () =>
    Effect.gen(function* () {
      const set = yield* CatalogSet.fromWorkspaceYaml(
        "catalogs:\n  build:\n    typescript: ^6.0.0\n  test:\n    vitest: ^3.0.0\n"
      );
      assert.deepStrictEqual(R.keys(set.entries).sort(), ["build", "test"]);
      assertSome(set.rangeOf("vitest", O.some("test")), "^3.0.0");
      assertSome(set.rangeOf("typescript", O.some("build")), "^6.0.0");
    })
  );

  it.effect("rangeOf is none for an unknown dependency and for an unknown catalog", () =>
    Effect.gen(function* () {
      const set = yield* CatalogSet.fromWorkspaceYaml("catalog:\n  effect: ^4.0.0\n");
      assertNone(set.rangeOf("react", O.none()));
      assertNone(set.rangeOf("effect", O.some("nope")));
    })
  );

  it.effect("resolveSpecifier resolves a catalog: protocol reference", () =>
    Effect.gen(function* () {
      const set = yield* CatalogSet.fromWorkspaceYaml(
        "catalog:\n  effect: ^4.0.0\ncatalogs:\n  build:\n    effect: ^3.0.0\n"
      );
      assertSome(set.resolveSpecifier("effect", "catalog:"), "^4.0.0");
      assertSome(set.resolveSpecifier("effect", "catalog:build"), "^3.0.0");
    })
  );

  it.effect("resolveSpecifier is none for a plain, non-catalog specifier", () =>
    Effect.gen(function* () {
      const set = yield* CatalogSet.fromWorkspaceYaml("catalog:\n  effect: ^4.0.0\n");
      assertNone(set.resolveSpecifier("effect", "^4.0.0"));
    })
  );

  it.effect("malformed YAML fails typed, never as a defect", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(CatalogSet.fromWorkspaceYaml("catalog:\n\t- ["));
      const error = yield* Effect.flip(CatalogSet.fromWorkspaceYaml("catalog:\n\t- ["));
      assertSuccess(Exit.findError(exit), error);
      assert.instanceOf(error, CatalogAssemblyError);
      assert.strictEqual(error.source, "manifest");
    })
  );

  it("fromLockfileCatalogs unwraps { specifier, version } to the declared range, never pinning consumers to the version", () => {
    const set = CatalogSet.fromLockfileCatalogs({
      default: { effect: { specifier: "^4.0.0", version: "4.0.0-beta.97" } },
    });
    const declaredSpecifierRange = set.rangeOf("effect", O.none());
    assertSome(declaredSpecifierRange, "^4.0.0");
  });

  it("merge lets a later set win per dependency and keeps every un-overridden key", () => {
    const older = CatalogSet.fromLockfileCatalogs({ default: { effect: "^3.0.0", react: "^18.0.0" } });
    const newer = CatalogSet.fromLockfileCatalogs({ default: { effect: "^4.0.0" } });
    const merged = CatalogSet.merge(older, newer);
    assertSome(merged.rangeOf("effect", O.none()), "^4.0.0");
    const unOverriddenRange = merged.rangeOf("react", O.none());
    assertSome(unOverriddenRange, "^18.0.0");
  });

  it("a __proto__ catalog key lands as an own property, not on the prototype", () => {
    const hostile: unknown = Result.getOrThrowWith(
      S.decodeResult(UnknownJson)('{"__proto__": {"evil": "1.0.0"}}'),
      identity
    );
    const set = CatalogSet.fromLockfileCatalogs(hostile);
    assert.isTrue(
      R.has(set.entries, "__proto__"),
      "decoded from JSON as a hostile lockfile is: a literal __proto__: would set the prototype, not an own key"
    );
    const empty: Record<string, unknown> = {};
    assert.isUndefined(empty.evil);
    const prototype: unknown = Object.prototype;
    if (!P.isObject(prototype)) return assert.fail("expected Object.prototype to be an object");
    assert.isUndefined(prototype.evil);
  });

  it("a __proto__ DEPENDENCY key inside a catalog does not pollute either", () => {
    const hostile: unknown = Result.getOrThrowWith(
      S.decodeResult(UnknownJson)('{"default": {"__proto__": "1.0.0"}}'),
      identity
    );
    const set = CatalogSet.fromLockfileCatalogs(hostile);
    const prototype: unknown = Object.prototype;
    if (!P.isObject(prototype)) return assert.fail("expected Object.prototype to be an object");
    assert.isUndefined(prototype["1.0.0"]);
    const entries = set.entries.default;
    if (entries === undefined) return assert.fail("expected the default catalog");
    assert.isTrue(R.has(entries, "__proto__"));
  });
});

const staleLockfileBesideInline: Tree = {
  "/repo/pnpm-workspace.yaml": A.join(
    [
      "packages:",
      "  - 'packages/*'",
      "catalog:",
      "  effect: ^4.0.0",
      "catalogs:",
      "  build:",
      "    typescript: ^6.0.0",
      "",
    ],
    "\n"
  ),
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
    identity
  ),
  "/repo/packages/a/package.json": manifest("@x/a", { dependencies: { effect: "catalog:" } }),
  "/repo/pnpm-lock.yaml": A.join(
    [
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
    ],
    "\n"
  ),
};

describe("WorkspaceCatalogs — assembly precedence", () => {
  it.layer(workspacesOver(staleLockfileBesideInline), { timeout: "30 seconds" })((it) => {
    it.effect("the inline pnpm-workspace.yaml catalog beats the lockfile's record", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const set = yield* catalogs.set;
        assertSome(set.rangeOf("effect", O.none()), "^4.0.0");
      })
    );

    it.effect("a lockfile-only entry survives the merge", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const set = yield* catalogs.set;
        assertSome(set.rangeOf("react", O.none()), "^18.0.0");
      })
    );

    it.effect("named inline catalogs assemble alongside the default one", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const set = yield* catalogs.set;
        assertSome(set.rangeOf("typescript", O.some("build")), "^6.0.0");
      })
    );

    it.effect("resolveSpecifier resolves a member's catalog: dependency", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const resolvedSpecifier = yield* catalogs.resolveSpecifier("effect", "catalog:");
        assertSome(resolvedSpecifier, "^4.0.0");
      })
    );
  });
});

const resolversOver = (tree: Tree) => {
  const core = workspacesOver(tree);
  return Workspaces.resolvers.pipe(Layer.provide(core));
};

describe("the @effected/npm resolver contracts", () => {
  it.layer(resolversOver(staleLockfileBesideInline), { timeout: "30 seconds" })((it) => {
    it.effect("CatalogResolver.rangeOf resolves against the real assembled catalogs", () =>
      Effect.gen(function* () {
        const resolver = yield* CatalogResolver;
        const assembledEffectRange = yield* resolver.rangeOf("effect", O.none());
        assertSome(assembledEffectRange, "^4.0.0");
        const rangeOf2 = yield* resolver.rangeOf("typescript", O.some("build"));
        assertSome(rangeOf2, "^6.0.0");
      })
    );

    it.effect("CatalogResolver.rangeOf is none — not an error — for an unmatched name", () =>
      Effect.gen(function* () {
        const resolver = yield* CatalogResolver;
        const rangeOf3 = yield* resolver.rangeOf("nothing-here", O.none());
        assertNone(rangeOf3);
      })
    );

    it.effect("WorkspaceResolver.versionOf resolves against the discovered packages", () =>
      Effect.gen(function* () {
        const resolver = yield* WorkspaceResolver;
        const versionOf4 = yield* resolver.versionOf("@x/a");
        assertSome(versionOf4, "1.0.0");
      })
    );

    it.effect("WorkspaceResolver.versionOf is none for a non-member", () =>
      Effect.gen(function* () {
        const resolver = yield* WorkspaceResolver;
        const versionOf5 = yield* resolver.versionOf("react");
        assertNone(versionOf5);
      })
    );
  });

  const withMalformedInline: Tree = {
    "/repo/pnpm-workspace.yaml": A.join(["packages:", "  - 'packages/*'", "catalog:", "\t- [", ""], "\n"),
    "/repo/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
      identity
    ),
  };

  it.layer(resolversOver(withMalformedInline), { timeout: "30 seconds" })((it) => {
    it.effect("CatalogResolver.rangeOf surfaces a failed assembly typed as CatalogAssemblyError", () =>
      Effect.gen(function* () {
        const resolver = yield* CatalogResolver;
        const error = yield* Effect.flip(resolver.rangeOf("effect", O.none()));
        assert.instanceOf(
          error,
          CatalogAssemblyError,
          "not folded into a DependencyResolutionError defect cause that callers would have to _tag-sniff"
        );
        assert.strictEqual(error._tag, "CatalogAssemblyError");
        assert.strictEqual(error.source, "manifest");
      })
    );
  });
});

const npmWorkspace: Tree = {
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({
      name: "root",
      version: "0.0.0",
      workspaces: ["packages/*"],
    }),
    identity
  ),
  "/repo/packages/a/package.json": manifest("@x/a"),
  "/repo/package-lock.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ lockfileVersion: 3, packages: {} }),
    identity
  ),
};

describe("WorkspaceCatalogs — a workspace with no pnpm-workspace.yaml", () => {
  it.layer(workspacesOver(npmWorkspace), { timeout: "30 seconds" })((it) => {
    it.effect("assembles to the empty set rather than failing", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const set = yield* catalogs.set;
        assert.isTrue(set.isEmpty);
      })
    );

    it.effect("detects npm from the workspaces field", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const detector = yield* PackageManagerDetector;
        const found = yield* roots.find("/repo");
        const detected = yield* detector.detect(found);
        assert.strictEqual(detected.name, "npm");
      })
    );

    it.effect("reads the npm lockfile through @effected/lockfiles", () =>
      Effect.gen(function* () {
        const reader = yield* LockfileReader;
        const lockfile = yield* reader.read;
        assert.strictEqual(lockfile.format, "npm");
      })
    );

    it.effect("discovery still works without any catalogs", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.deepStrictEqual(
          A.map(packages, (pkg) => pkg.name),
          ["root", "@x/a"]
        );
      })
    );
  });
});

const probeFailTree: Tree = {
  "/repo/pnpm-workspace.yaml": "catalog:\n  effect: ^4.0.0\n",
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0", workspaces: ["packages/*"] }),
    identity
  ),
};

describe("WorkspaceCatalogs — a presence-probe failure is not silent absence", () => {
  it.layer(
    Workspaces.layer({ cwd: "/repo" }).pipe(
      Layer.provideMerge(platformWith({ unreadableExists: ["/repo/pnpm-workspace.yaml"] })(probeFailTree))
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a PermissionDenied on the presence probe fails typed as CatalogAssemblyError", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const error = yield* Effect.flip(catalogs.set);
        assert.instanceOf(
          error,
          CatalogAssemblyError,
          "the workspaces field keeps root discovery alive, isolating the failure to the catalog probe"
        );
        assert.strictEqual(
          error.source,
          "manifest",
          "a non-NotFound probe failure must not silently select the package.json reader (every dependency looks new)"
        );
      })
    );
  });
});

const existingButProbeDeniedTree: Tree = {
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({
      name: "root",
      version: "0.0.0",
      workspaces: { catalog: { effect: "^4.0.0" } },
    }),
    identity
  ),
};

describe("WorkspaceCatalogs — a bun/package.json presence-probe failure is not silent absence", () => {
  const bunProbeFailLayer = WorkspaceCatalogs.layer({ cwd: "/repo" }).pipe(
    Layer.provide(
      Layer.succeed(WorkspaceRoot, {
        find: dual(
          (args) => P.isString(args[0]),
          Effect.fn("WorkspaceRoot.find")(() => Effect.succeed("/repo"))
        ),
      })
    ),
    Layer.provide(
      Layer.mock(LockfileReader, {
        read: Effect.failSync(() =>
          LockfileReadError.make({
            lockfilePath: "/repo/pnpm-lock.yaml",
            format: "pnpm",
            cause: new Error("no lockfile"),
          })
        ),
      })
    ),
    Layer.provideMerge(platformWith({ unreadableExists: ["/repo/package.json"] })(existingButProbeDeniedTree))
  );
  it.layer(bunProbeFailLayer, { timeout: "30 seconds" })((it) => {
    it.effect("a PermissionDenied on the package.json presence probe fails typed as CatalogAssemblyError", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const error = yield* Effect.flip(catalogs.set);
        assert.instanceOf(
          error,
          CatalogAssemblyError,
          "WorkspaceRoot is stubbed because a poisoned package.json would also break root discovery"
        );
        assert.strictEqual(
          error.source,
          "manifest",
          "with the lockfile read failing, a probe collapsed to absent would return empty catalogs instead"
        );
        assert.strictEqual(error.path, "/repo/package.json");
      })
    );
  });
});

const duplicateDefaultTree: Tree = {
  "/repo/pnpm-workspace.yaml": A.join(
    [
      "packages:",
      "  - 'packages/*'",
      "catalog:",
      "  effect: ^4.0.0",
      "catalogs:",
      "  default:",
      "    react: ^18.0.0",
      "",
    ],
    "\n"
  ),
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
    identity
  ),
};

const malformedCatalogTree: Tree = {
  "/repo/pnpm-workspace.yaml": A.join(
    ["packages:", "  - 'packages/*'", "catalog:", "  effect:", "    nested: bad", ""],
    "\n"
  ),
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
    identity
  ),
};

describe("WorkspaceCatalogs — the pnpm inline path hard-fails, like the bun path", () => {
  it.layer(workspacesOver(duplicateDefaultTree), { timeout: "30 seconds" })((it) => {
    it.effect("the default catalog declared twice (top-level catalog + catalogs.default) fails typed", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const error = yield* Effect.flip(catalogs.set);
        assert.instanceOf(error, CatalogAssemblyError);
        assert.strictEqual(error.source, "catalog");
        assert.strictEqual(error.path, "default");
      })
    );
  });

  it.layer(workspacesOver(malformedCatalogTree), { timeout: "30 seconds" })((it) => {
    it.effect("a malformed catalog block (a non-string entry) fails typed rather than reading as empty", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const error = yield* Effect.flip(catalogs.set);
        assert.instanceOf(error, CatalogAssemblyError);
        assert.strictEqual(error.source, "catalog");
        assert.strictEqual(error.path, "catalog");
      })
    );
  });
});

const inlineGateTree: Tree = {
  "/repo/pnpm-workspace.yaml": A.join(
    [
      "packages:",
      "  - 'packages/*'",
      "minimumReleaseAge: 1440",
      "minimumReleaseAgeExclude:",
      '  - "@x/*"',
      "  - typescript",
      "catalog:",
      "  effect: ^4.0.0",
      "",
    ],
    "\n"
  ),
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
    identity
  ),
  "/repo/packages/a/package.json": manifest("@x/a"),
};

const malformedGateTree: Tree = {
  "/repo/pnpm-workspace.yaml": A.join(["packages:", "  - 'packages/*'", 'minimumReleaseAge: "soon"', ""], "\n"),
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
    identity
  ),
};

describe("WorkspaceCatalogs.releaseAgeGate — the inline pnpm-workspace.yaml source", () => {
  it.layer(workspacesOver(inlineGateTree), { timeout: "30 seconds" })((it) => {
    it.effect("surfaces the inline minimumReleaseAge and minimumReleaseAgeExclude", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const gate = yield* catalogs.releaseAgeGate;
        assert.strictEqual(gate.ageMinutes, 1440);
        assert.deepStrictEqual([...gate.exclude], ["@x/*", "typescript"]);
      })
    );
  });

  it.layer(workspacesOver(staleLockfileBesideInline), { timeout: "30 seconds" })((it) => {
    it.effect("is the inert zero gate when no release-age keys are declared", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const gate = yield* catalogs.releaseAgeGate;
        assert.strictEqual(gate.ageMinutes, 0);
        assert.deepStrictEqual([...gate.exclude], []);
      })
    );
  });

  it.layer(workspacesOver(npmWorkspace), { timeout: "30 seconds" })((it) => {
    it.effect("is the inert zero gate for a workspace with no pnpm-workspace.yaml", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const gate = yield* catalogs.releaseAgeGate;
        assert.strictEqual(gate.ageMinutes, 0);
        assert.deepStrictEqual([...gate.exclude], []);
      })
    );
  });

  it.layer(workspacesOver(malformedGateTree), { timeout: "30 seconds" })((it) => {
    it.effect("a malformed inline minimumReleaseAge fails typed as CatalogAssemblyError", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const error = yield* Effect.flip(catalogs.releaseAgeGate);
        assert.instanceOf(error, CatalogAssemblyError);
        assert.strictEqual(error.source, "manifest");
        assert.strictEqual(error.path, "pnpm-workspace.yaml");
      })
    );
  });
});

const workspaceYamlWithRules = (allowedKey: string): string =>
  A.join(
    [
      "packages:",
      "  - 'packages/*'",
      "catalog:",
      "  effect: ^4.0.0",
      "peerDependencyRules:",
      "  allowedVersions:",
      `    "${allowedKey}": ^4.0.0`,
      "",
    ],
    "\n"
  );

const refreshTree: Tree = {
  "/repo/pnpm-workspace.yaml": workspaceYamlWithRules("@x/before>effect"),
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
    identity
  ),
};

describe("WorkspaceCatalogs.refresh — the explicit memoization boundary", () => {
  it.layer(workspacesOver(refreshTree), { timeout: "30 seconds" })((it) => {
    it.effect("a mutation is invisible to the memo until refresh() discards it", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const fs = yield* FileSystem.FileSystem;

        const before = yield* catalogs.peerDependencyRules;
        assert.deepStrictEqual(
          before.allowedVersions,
          { "@x/before>effect": "^4.0.0" },
          "the sequence is one test: a layer block shares its service, so split tests would order-couple"
        );

        const configDependencyBumpYaml = workspaceYamlWithRules("@x/after>effect");
        yield* fs.writeFileString("/repo/pnpm-workspace.yaml", configDependencyBumpYaml);

        const pinned = yield* catalogs.peerDependencyRules;
        assert.deepStrictEqual(
          pinned.allowedVersions,
          { "@x/before>effect": "^4.0.0" },
          "the pre-mutation assembly is still served; this fails if the memo is quietly dropped"
        );

        yield* catalogs.refresh;

        const after = yield* catalogs.peerDependencyRules;
        assert.deepStrictEqual(
          after.allowedVersions,
          { "@x/after>effect": "^4.0.0" },
          "the next read re-assembles post-mutation: a mid-run mutating tool needs the after-state one memo cannot give"
        );
      })
    );
  });

  it.layer(workspacesOver(refreshTree), { timeout: "30 seconds" })((it) => {
    it.effect("refresh() before any read is harmless", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        yield* catalogs.refresh;
        const rules = yield* catalogs.peerDependencyRules;
        assert.deepStrictEqual(
          rules.allowedVersions,
          { "@x/before>effect": "^4.0.0" },
          "a fresh layer block has not assembled yet"
        );
      })
    );
  });
});

describe("CatalogSet — own-key resolution", () => {
  for (const name of ["constructor", "toString", "__proto__"]) {
    it(`does not resolve inherited dependency ${name}`, () => {
      const set = CatalogSet.fromCatalogs({ default: { effect: "^4.0.0" } });
      assertNone(set.rangeOf(name, O.none()));
      assertNone(set.resolveSpecifier(name, "catalog:"));
    });
    it(`does not resolve inherited catalog ${name}`, () => {
      const set = CatalogSet.empty();
      assertNone(set.rangeOf("name", O.some(name)));
      assertNone(set.resolveSpecifier("name", `catalog:${name}`));
    });
  }

  it("resolves an explicitly declared constructor dependency", () => {
    const set = CatalogSet.fromCatalogs({ default: { constructor: "^1.2.3" } });
    assertSome(set.rangeOf("constructor", O.none()), "^1.2.3");
    assertSome(set.resolveSpecifier("constructor", "catalog:"), "^1.2.3");
  });

  it("normalizes sparse arrays and their extra enumerable catalog entries", () => {
    const dependencies: Array<string> & { extra?: string } = [];
    dependencies[2] = "^2.0.0";
    dependencies.extra = "^3.0.0";
    const catalogs: Array<unknown> & { extra?: unknown } = [];
    catalogs[1] = dependencies;
    catalogs.extra = { effect: "^4.0.0" };
    const set = CatalogSet.fromCatalogs(catalogs);
    assert.deepStrictEqual(R.keys(set.entries), ["1", "extra"]);
    assertSome(set.rangeOf("2", O.some("1")), "^2.0.0");
    assertSome(set.rangeOf("extra", O.some("1")), "^3.0.0");
    assertSome(set.rangeOf("effect", O.some("extra")), "^4.0.0");
  });
});
