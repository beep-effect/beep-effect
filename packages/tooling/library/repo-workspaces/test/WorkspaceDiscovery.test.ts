import { WorkspaceResolver } from "@beep/npm-spec/WorkspaceResolver";
import {
  PackageNotFoundError,
  WorkspaceDiscovery,
  WorkspaceDiscoveryError,
  WorkspaceInfo,
  WorkspacePackage,
  WorkspacePatternError,
  WorkspaceRoot,
  WorkspaceRootNotFoundError,
} from "@beep/repo-workspaces";
import { WorkspaceDiscoveryOptions } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { assert, describe, it, layer } from "@effect/vitest";
import { assertExitFailure, assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { manifest, platform, platformWith, rootManifest } from "./support/fixtures.ts";
import type { Tree } from "./support/fixtures.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const discoveryOver = (
  tree: Tree,
  options?: {
    readonly maxDepth?: number;
    readonly skipDirectoryNames?: ReadonlyArray<string>;
    readonly skipMissingBaseDirs?: boolean;
    readonly unreadable?: ReadonlyArray<string>;
    readonly unreadableFiles?: ReadonlyArray<string>;
    readonly unreadableStat?: ReadonlyArray<string>;
  }
) => {
  const { unreadable, unreadableFiles, unreadableStat, ...discoveryOptions } = options ?? {};
  const base = platformWith({
    ...(unreadable === undefined ? {} : { unreadable }),
    ...(unreadableFiles === undefined ? {} : { unreadableFiles }),
    ...(unreadableStat === undefined ? {} : { unreadableStat }),
  })(tree);
  const roots = WorkspaceRoot.layer.pipe(Layer.provide(base));
  return Layer.mergeAll(
    roots,
    WorkspaceDiscovery.layer({ cwd: "/repo", ...discoveryOptions }).pipe(Layer.provide(roots), Layer.provide(base))
  ).pipe(Layer.provideMerge(base));
};

const oneLevel: Tree = {
  "/repo/package.json": rootManifest(["packages/*", "apps/*"]),
  "/repo/packages/alpha/package.json": manifest("@x/alpha"),
  "/repo/packages/beta/package.json": manifest("@x/beta", { dependencies: { "@x/alpha": "1.0.0" } }),
  "/repo/packages/no-manifest/README.md": "not a package",
  "/repo/apps/web/package.json": manifest("@x/web", { dependencies: { "@x/beta": "1.0.0" } }),
};

describe("WorkspaceDiscovery — one-level patterns", () => {
  layer(discoveryOver(oneLevel), { timeout: "30 seconds" })((it) => {
    it.effect("discovers the root package first, then members sorted by relative path", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.deepStrictEqual(
          A.map(packages, (pkg) => pkg.name),
          ["root", "@x/web", "@x/alpha", "@x/beta"]
        );
        const root = packages[0];
        if (root === undefined) return assert.fail("expected the root package");
        assert.isTrue(root.isRootWorkspace);
        assert.strictEqual(root.relativePath, ".");
      })
    );

    it.effect("carries the as-read manifest record on every member", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        const beta = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@x/beta"));
        assert.deepStrictEqual(
          beta?.manifestRecord,
          {
            name: "@x/beta",
            version: "1.0.0",
            dependencies: { "@x/alpha": "1.0.0" },
          },
          "the whole parsed record, not the typed slice, rides along from the one read"
        );
      })
    );

    it.effect("a directory without a package.json is not a workspace package", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.isFalse(A.some(packages, (pkg) => pkg.relativePath === "packages/no-manifest"));
      })
    );

    it.effect("importerMap keys on the root-relative path", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const importers = yield* discovery.importerMap;
        assert.strictEqual(O.getOrUndefined(HashMap.get(importers, "packages/alpha"))?.name, "@x/alpha");
        assert.strictEqual(O.getOrUndefined(HashMap.get(importers, "."))?.name, "root");
      })
    );

    it.effect("getPackage fails with the available names when the name is unknown", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.getPackage("@x/nope"));
        assert.instanceOf(error, PackageNotFoundError);
        assert.include(error.available, "@x/alpha");
      })
    );

    it.effect("resolveFile attributes a file to its owning package by longest prefix", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const owner = yield* discovery.resolveFile("/repo/packages/alpha/src/index.ts");
        const gotPackage = yield* discovery.getPackage("@x/alpha");
        assertSome(owner, gotPackage);
        assert.strictEqual(
          owner.value.name,
          "@x/alpha",
          "the root's path prefixes every member's, so a first-match index would answer root"
        );
      })
    );

    it.effect("a file outside every package resolves to none", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const resolvedFile = yield* discovery.resolveFile("/elsewhere/x.ts");
        assertNone(resolvedFile);
      })
    );

    it.effect("resolveFiles returns each owner once, sorted", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const owners = yield* discovery.resolveFiles([
          "/repo/packages/beta/a.ts",
          "/repo/packages/beta/b.ts",
          "/repo/apps/web/c.ts",
        ]);
        assert.deepStrictEqual(
          A.map(owners, (pkg) => pkg.name),
          ["@x/beta", "@x/web"]
        );
      })
    );
  });
});

const nested: Tree = {
  "/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/**'\n",
  "/repo/packages/alpha/package.json": manifest("@x/alpha"),
  "/repo/packages/group/nested/package.json": manifest("@x/nested"),
  "/repo/packages/group/deeper/still/package.json": manifest("@x/deep"),
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
    identity
  ),
};

describe("WorkspaceDiscovery — packages/** crosses segments (workspaces #62)", () => {
  layer(discoveryOver(nested), { timeout: "30 seconds" })((it) => {
    it.effect("finds a package TWO levels below the prefix, not just one", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        const names = A.map(packages, (pkg) => pkg.name);
        assert.include(names, "@x/alpha");
        assert.include(names, "@x/nested", "v3 rewrote packages/** to packages/* and found alpha alone");
        assert.include(names, "@x/deep", "v3 rewrote packages/** to packages/* and found alpha alone");
      })
    );

    it.effect("reads the packages list from pnpm-workspace.yaml via @effected/yaml", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const info = yield* discovery.info;
        assert.deepStrictEqual(info.patterns, ["packages/**"]);
        assert.strictEqual(info.root, "/repo");
      })
    );
  });
});

const withNodeModules: Tree = {
  "/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/**'\n  - '!packages/private-*'\n",
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
    identity
  ),
  "/repo/packages/alpha/package.json": manifest("@x/alpha"),
  "/repo/packages/private-thing/package.json": manifest("@x/private"),
  "/repo/packages/private-thing/nested/package.json": manifest("@x/nested"),
  "/repo/packages/alpha/node_modules/evil/package.json": manifest("evil"),
  "/repo/packages/alpha/.git/hooks/package.json": manifest("git-junk"),
};

describe("WorkspaceDiscovery — pruning and exclusion", () => {
  layer(discoveryOver(withNodeModules), { timeout: "30 seconds" })((it) => {
    it.effect("never descends into node_modules", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.isFalse(A.some(packages, (pkg) => pkg.name === "evil"));
      })
    );

    it.effect("never descends into .git", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.isFalse(A.some(packages, (pkg) => pkg.name === "git-junk"));
      })
    );

    it.effect("a leading-bang pattern excludes a package the includes matched", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.isTrue(A.some(packages, (pkg) => pkg.name === "@x/alpha"));
        assert.isFalse(A.some(packages, (pkg) => pkg.name === "@x/private"));
      })
    );

    it.effect("an excluded directory is still DESCENDED — a package under it stays discovered", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.isFalse(A.some(packages, (pkg) => pkg.name === "@x/private"));
        assert.isTrue(
          A.some(packages, (pkg) => pkg.name === "@x/nested"),
          "a * stops at a segment, so exclusion gates acceptance only; a descent gate would drop this silently"
        );
      })
    );
  });
});

describe("WorkspaceDiscovery — the descent is bounded", () => {
  layer(discoveryOver(nested, { maxDepth: 1 }), { timeout: "30 seconds" })((it) => {
    it.effect("fails typed when a segment-crossing pattern descends past maxDepth", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.listPackages);
        assert.instanceOf(error, WorkspacePatternError);
        assert.strictEqual(error.kind, "depthExceeded");
        assert.strictEqual(error.pattern, "packages/**");
      })
    );
  });
});

describe("WorkspaceDiscovery — a fractional maxDepth is a DEFECT, not a typed error", () => {
  layer(discoveryOver(nested, { maxDepth: 2.5 }), { timeout: "30 seconds" })((it) => {
    it.effect("dies rather than silently enumerating a truncated tree", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const exit = yield* Effect.exit(discovery.listPackages);
        const actualCause = Exit.match(exit, { onFailure: identity, onSuccess: () => Cause.empty });
        assertExitFailure(exit, actualCause);
        assert.isFalse(
          A.some(exit.cause.reasons, Cause.isFailReason),
          "a bare depth < maxDepth guard admits 2.5 and NaN; no typed Fail is the discriminating check"
        );
        assert.isTrue(Cause.hasDies(exit.cause));
      })
    );
  });
});

describe("WorkspaceDiscovery — NaN maxDepth is a DEFECT", () => {
  layer(discoveryOver(nested, { maxDepth: Number.NaN }), { timeout: "30 seconds" })((it) => {
    it.effect("dies rather than returning an empty package list", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const exit = yield* Effect.exit(discovery.listPackages);
        assertExitFailure(exit, Exit.match(exit, { onFailure: identity, onSuccess: () => Cause.empty }));
        assert.isFalse(A.some(exit.cause.reasons, Cause.isFailReason));
        assert.isTrue(Cause.hasDies(exit.cause));
      })
    );
  });
});

const missingBase: Tree = {
  "/repo/package.json": rootManifest(["packages/*", "apps/*"]),
  "/repo/packages/alpha/package.json": manifest("@x/alpha"),
};

describe("WorkspaceDiscovery — a pattern naming a missing directory fails typed", () => {
  layer(discoveryOver(missingBase), { timeout: "30 seconds" })((it) => {
    it.effect("names the offending pattern, so a typo is obvious", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.listPackages);
        assert.instanceOf(error, WorkspacePatternError);
        assert.strictEqual(error.kind, "missingBaseDir");
        assert.strictEqual(error.pattern, "apps/*");
      })
    );
  });
});

describe("WorkspaceDiscovery — skipMissingBaseDirs lets a missing base select nothing", () => {
  it("admits the option as an absent key or a boolean and rejects an explicit undefined (EF-40)", () => {
    const is = S.is(WorkspaceDiscoveryOptions);
    assert.isTrue(is({}));
    assert.isTrue(is({ skipMissingBaseDirs: true }));
    assert.isFalse(is({ skipMissingBaseDirs: undefined }));
  });

  layer(discoveryOver(missingBase, { skipMissingBaseDirs: false }), { timeout: "30 seconds" })((it) => {
    it.effect("false fails typed, as when the option is absent", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.listPackages);
        assert.instanceOf(error, WorkspacePatternError);
        assert.strictEqual(error.kind, "missingBaseDir");
      })
    );
  });

  layer(discoveryOver(missingBase, { skipMissingBaseDirs: true }), { timeout: "30 seconds" })((it) => {
    it.effect("true enumerates the other patterns and selects nothing for the missing base", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.deepStrictEqual(
          A.map(packages, (pkg) => `${pkg.name}=${pkg.relativePath}`),
          ["root=.", "@x/alpha=packages/alpha"]
        );
      })
    );
  });
});

const existingButStatDeniedBase: Tree = {
  ...missingBase,
  "/repo/apps/web/package.json": manifest("@x/web"),
};

describe("WorkspaceDiscovery — skipMissingBaseDirs skips only a confirmed absence", () => {
  for (const skipMissingBaseDirs of [true, false]) {
    layer(discoveryOver(existingButStatDeniedBase, { skipMissingBaseDirs, unreadableStat: ["/repo/apps"] }), {
      timeout: "30 seconds",
    })((it) => {
      it.effect(
        `a base whose stat fails otherwise is unreadableDirectory (skipMissingBaseDirs: ${skipMissingBaseDirs})`,
        () =>
          Effect.gen(function* () {
            const discovery = yield* WorkspaceDiscovery;
            const error = yield* Effect.flip(discovery.listPackages);
            assert.instanceOf(error, WorkspacePatternError);
            assert.strictEqual(error.kind, "unreadableDirectory");
            assert.strictEqual(error.pattern, "apps/*");
            assert.strictEqual(error.detail, "apps");
          })
      );
    });
  }
});

const generatedDirsWithInvalidManifests: Tree = {
  "/repo/package.json": rootManifest(["packages/*", "packages/*/coverage", "dist/*", "packages/alpha/build"]),
  "/repo/packages/alpha/package.json": manifest("@x/alpha"),
  "/repo/packages/alpha/coverage/package.json": "{}",
  "/repo/packages/alpha/build/package.json": "{}",
  "/repo/dist/out/package.json": "{ not json",
};

describe("WorkspaceDiscovery — skipDirectoryNames skips a directory before reading its manifest", () => {
  it("admits the option as an absent key or a string list and rejects an explicit undefined (EF-40)", () => {
    const is = S.is(WorkspaceDiscoveryOptions);
    assert.isTrue(is({ skipDirectoryNames: ["dist"] }));
    assert.isFalse(is({ skipDirectoryNames: undefined }));
  });

  layer(discoveryOver(generatedDirsWithInvalidManifests), { timeout: "30 seconds" })((it) => {
    it.effect("without the option, a malformed generated manifest fails discovery", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const flip1 = yield* Effect.flip(discovery.listPackages);
        assert.instanceOf(flip1, WorkspaceDiscoveryError);
      })
    );
  });

  layer(discoveryOver(generatedDirsWithInvalidManifests, { skipDirectoryNames: ["dist", "build", "coverage"] }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("with it, the literal, the wildcard base and the listed directory are skipped unread", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.deepStrictEqual(
          A.map(packages, (pkg) => `${pkg.name}=${pkg.relativePath}`),
          ["root=.", "@x/alpha=packages/alpha"]
        );
      })
    );
  });
});

const trailingSlashPatterns: Tree = {
  "/repo/package.json": rootManifest(["packages/*/", "packages/alpha/", "tools/core/", "apps//"]),
  "/repo/packages/alpha/package.json": manifest("@x/alpha"),
  "/repo/packages/beta/package.json": manifest("@x/beta"),
  "/repo/tools/core/package.json": manifest("@x/core"),
  "/repo/apps/package.json": manifest("@x/apps"),
};

describe("WorkspaceDiscovery — a trailing slash on a pattern is dropped before matching", () => {
  layer(discoveryOver(trailingSlashPatterns), { timeout: "30 seconds" })((it) => {
    it.effect("a slashed wildcard and slashed literals select their members at unslashed paths", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.deepStrictEqual(
          A.map(packages, (pkg) => `${pkg.name}=${pkg.relativePath}`),
          ["root=.", "@x/apps=apps", "@x/alpha=packages/alpha", "@x/beta=packages/beta", "@x/core=tools/core"]
        );
        const info = yield* discovery.info;
        assert.deepStrictEqual(info.patterns, ["packages/*/", "packages/alpha/", "tools/core/", "apps//"]);
      })
    );
  });
});

const globstarBases: Tree = {
  "/repo/package.json": rootManifest(["tools/core/**", "packages/*", "!./packages/beta", "!packages/legacy/**"]),
  "/repo/tools/core/package.json": manifest("@x/core"),
  "/repo/tools/core/nested/package.json": manifest("@x/nested"),
  "/repo/packages/alpha/package.json": manifest("@x/alpha"),
  "/repo/packages/beta/package.json": manifest("@x/beta"),
  "/repo/packages/legacy/package.json": manifest("@x/legacy"),
};

describe("WorkspaceDiscovery — a /** pattern covers its base and a ./ exclusion applies", () => {
  layer(discoveryOver(globstarBases), { timeout: "30 seconds" })((it) => {
    it.effect("selects tools/core itself, and excludes packages/beta and packages/legacy", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.deepStrictEqual(
          A.map(packages, (pkg) => `${pkg.name}=${pkg.relativePath}`),
          ["root=.", "@x/alpha=packages/alpha", "@x/core=tools/core", "@x/nested=tools/core/nested"]
        );
      })
    );
  });
});

const malformed: Tree = {
  "/repo/package.json": rootManifest(["packages/*"]),
  "/repo/packages/bad/package.json": "{ not json",
};

describe("WorkspaceDiscovery — malformed input fails typed, never as a defect", () => {
  layer(discoveryOver(malformed), { timeout: "30 seconds" })((it) => {
    it.effect("an unparseable member package.json is a typed WorkspaceDiscoveryError", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const result = yield* Effect.result(discovery.listPackages);
        const error = yield* Effect.flip(discovery.listPackages);
        assertFailure(result, error);
        assert.instanceOf(error, WorkspaceDiscoveryError);
        assert.strictEqual(error.kind, "invalidJson");
        assert.strictEqual(error.path, "/repo/packages/bad/package.json");
      })
    );
  });
});

const nameless: Tree = {
  "/repo/package.json": rootManifest(["packages/*"]),
  "/repo/packages/bad/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ version: "1.0.0" }),
    identity
  ),
};

describe("WorkspaceDiscovery — a member without a name", () => {
  layer(discoveryOver(nameless), { timeout: "30 seconds" })((it) => {
    it.effect("fails with the missingName discriminant", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.listPackages);
        assert.instanceOf(error, WorkspaceDiscoveryError);
        assert.strictEqual(error.kind, "missingName");
      })
    );
  });
});

const ordinaryPrivateRootManifest = Result.getOrThrowWith(
  S.encodeUnknownResult(UnknownJson)({ name: "root", private: true, workspaces: ["packages/*"] }),
  identity
);

const versionless: Tree = {
  "/repo/package.json": ordinaryPrivateRootManifest,
  "/repo/packages/bare/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "@x/bare", private: true }),
    identity
  ),
  "/repo/packages/versioned/package.json": manifest("@x/versioned"),
};

describe("WorkspaceDiscovery — a manifest without a version is discovered (#472, #591, #605)", () => {
  layer(discoveryOver(versionless), { timeout: "30 seconds" })((it) => {
    it.effect("a version-less ROOT manifest is discovered, root first, with `version` absent", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.deepStrictEqual(
          A.map(packages, (pkg) => pkg.name),
          ["root", "@x/bare", "@x/versioned"]
        );
        const root = packages[0];
        if (root === undefined) return assert.fail("expected the root package");
        assert.isTrue(root.isRootWorkspace);
        assert.isFalse("version" in root, 'absent, not a 0.0.0 or "" placeholder, and no present undefined key');
        assert.strictEqual(root.version, undefined);
      })
    );

    it.effect("a version-less MEMBER is discovered with `version` absent, alongside its versioned sibling", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const bare = yield* discovery.getPackage("@x/bare");
        assert.isFalse("version" in bare);
        const versioned = yield* discovery.getPackage("@x/versioned");
        assert.strictEqual(versioned.version, "1.0.0");
      })
    );

    it.layer(WorkspaceDiscovery.workspaceResolver, { timeout: "30 seconds" })((it) => {
      it.effect("versionOf fails typed for a member that declares no version — none would mean non-member", () =>
        Effect.gen(function* () {
          const resolver = yield* WorkspaceResolver;
          const positiveControlVersion = yield* resolver.versionOf("@x/versioned");
          assertSome(positiveControlVersion, "1.0.0");
          const nonMemberVersion = yield* resolver.versionOf("react");
          assertNone(nonMemberVersion);
          const error = yield* Effect.flip(resolver.versionOf("@x/bare"));
          assert.strictEqual(
            error._tag,
            "DependencyResolutionError",
            "a member with nothing to resolve to takes the contract's typed channel, not none"
          );
          assert.strictEqual(error.specifier, "workspace:@x/bare");
          assert.strictEqual(
            error.reason,
            "no-version",
            "the branch a _tag check cannot pin: raised from structured data with no foreign failure to wrap"
          );
          assert.isUndefined(error.cause);
        })
      );
    });
  });
});

const emptyVersion: Tree = {
  "/repo/package.json": rootManifest(["packages/*"]),
  "/repo/packages/empty/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "@x/empty", version: "" }),
    identity
  ),
  "/repo/packages/versioned/package.json": manifest("@x/versioned"),
};

describe("WorkspaceDiscovery — a version that is PRESENT but EMPTY", () => {
  layer(discoveryOver(emptyVersion), { timeout: "30 seconds" })((it) => {
    it.effect("fails with the invalidShape discriminant, naming the file", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.listPackages);
        assert.instanceOf(error, WorkspaceDiscoveryError);
        assert.strictEqual(
          error.kind,
          "invalidShape",
          'a present "" would resolve workspace:^ to ^ and versionOf to some(""); only absence is tolerated'
        );
        assert.strictEqual(error.path, "/repo/packages/empty/package.json");
        if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
        assert.strictEqual(
          error.cause.message,
          "version must be a non-empty string",
          "the same sentence the sync facade attaches to its skip"
        );
      })
    );

    it.layer(WorkspaceDiscovery.workspaceResolver, { timeout: "30 seconds" })((it) => {
      it.effect('versionOf never answers some("") for it', () =>
        Effect.gen(function* () {
          const resolver = yield* WorkspaceResolver;
          const error = yield* Effect.flip(resolver.versionOf("@x/empty"));
          assert.strictEqual(
            error._tag,
            "DependencyResolutionError",
            "the listing fails, so resolution fails too, never an empty string dressed as a version"
          );
          assert.strictEqual(error.specifier, "workspace:@x/empty");
          assert.strictEqual(
            error.reason,
            "mechanism",
            'a "" version is a malformed manifest, not a version-less member: the cause is the discovery failure'
          );
          assert.isDefined(error.cause);
        })
      );
    });
  });
});

const badVersion: Tree = {
  "/repo/package.json": rootManifest(["packages/*"]),
  "/repo/packages/bad/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "@x/bad", version: 42 }),
    identity
  ),
};

describe("WorkspaceDiscovery — a version that is PRESENT but not a string", () => {
  layer(discoveryOver(badVersion), { timeout: "30 seconds" })((it) => {
    it.effect("fails with the invalidShape discriminant, naming the file", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.listPackages);
        assert.instanceOf(error, WorkspaceDiscoveryError);
        assert.strictEqual(
          error.kind,
          "invalidShape",
          "the one version failure left once version became optional: a present non-string"
        );
        assert.strictEqual(error.path, "/repo/packages/bad/package.json");
      })
    );
  });
});

const oddVersion: Tree = {
  "/repo/package.json": rootManifest(["packages/*"]),
  "/repo/packages/odd/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "@x/odd", version: "not-semver" }),
    identity
  ),
};

describe("WorkspaceDiscovery — the projection is deliberately tolerant", () => {
  layer(discoveryOver(oddVersion), { timeout: "30 seconds" })((it) => {
    it.effect("a non-semver version discovers fine; only the strict manifest bridge is strict", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const pkg = yield* discovery.getPackage("@x/odd");
        assert.strictEqual(pkg.version, "not-semver");
      })
    );
  });
});

describe("WorkspaceRoot — no marker anywhere", () => {
  const bare: Tree = { "/repo/src/index.ts": "" };
  const base = platform(bare);
  layer(WorkspaceRoot.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("fails typed, naming the markers it looked for", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const error = yield* Effect.flip(roots.find("/repo/src"));
        assert.instanceOf(error, WorkspaceRootNotFoundError);
        assert.include(error.markers, "pnpm-workspace.yaml");
      })
    );
  });
});

const ciCheckoutInsideOuterWorkspace: Tree = {
  "/outer/pnpm-workspace.yaml": "packages:\n  - 'pkgs/*'\n",
  "/outer/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "outer-root", version: "0.0.0", private: true }),
    identity
  ),
  "/outer/pkgs/other/package.json": manifest("other"),
  "/outer/checkout/package.json": manifest("checkout"),
};

const discoveryWith = (tree: Tree, options: { readonly cwd: string; readonly stopAt?: string }) => {
  const base = platform(tree);
  const roots = WorkspaceRoot.layer.pipe(Layer.provide(base));
  return WorkspaceDiscovery.layer(options).pipe(Layer.provide(roots), Layer.provide(base));
};

describe("WorkspaceDiscovery — no stopAt adopts an enclosing workspace", () => {
  layer(discoveryWith(ciCheckoutInsideOuterWorkspace, { cwd: "/outer/checkout" }), { timeout: "30 seconds" })((it) => {
    it.effect("resolves the OUTER root and its members (the unbounded default, pinned)", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const info = yield* discovery.info;
        assert.strictEqual(info.root, "/outer");
        const packages = yield* discovery.listPackages;
        assert.deepStrictEqual(
          A.map(packages, (pkg) => `${pkg.name}@${pkg.relativePath}`),
          ["outer-root@.", "other@pkgs/other"]
        );
      })
    );
  });
});

describe("WorkspaceDiscovery — stopAt: cwd refuses the enclosing workspace", () => {
  layer(discoveryWith(ciCheckoutInsideOuterWorkspace, { cwd: "/outer/checkout", stopAt: "/outer/checkout" }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("fails WorkspaceRootNotFoundError carrying the ceiling", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.listPackages);
        assert.instanceOf(error, WorkspaceRootNotFoundError);
        assert.strictEqual(error.searchPath, "/outer/checkout");
        assert.strictEqual(error.stopAt, "/outer/checkout");
      })
    );

    it.effect("does not bound the per-call …In methods", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const info = yield* discovery.infoIn("/outer/checkout");
        assert.strictEqual(
          info.root,
          "/outer",
          "deliberate: a layer-level ceiling cannot sensibly bound an arbitrary caller-named directory"
        );
      })
    );
  });

  const checkoutIsRoot: Tree = {
    ...ciCheckoutInsideOuterWorkspace,
    "/outer/checkout/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
    "/outer/checkout/packages/inner/package.json": manifest("inner"),
  };
  layer(discoveryWith(checkoutIsRoot, { cwd: "/outer/checkout", stopAt: "/outer/checkout" }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("still resolves a checkout that is itself a workspace root (the ceiling is inclusive)", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const info = yield* discovery.info;
        assert.strictEqual(info.root, "/outer/checkout");
        const packages = yield* discovery.listPackages;
        assert.deepStrictEqual(
          A.map(packages, (pkg) => `${pkg.name}@${pkg.relativePath}`),
          ["checkout@.", "inner@packages/inner"]
        );
      })
    );
  });
});

describe("WorkspaceRoot — the NEAREST root wins", () => {
  const nestedRoots: Tree = {
    "/outer/package.json": rootManifest(["packages/*"]),
    "/outer/inner/pnpm-workspace.yaml": "packages:\n  - 'pkgs/*'\n",
    "/outer/inner/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "inner", version: "0.0.0" }),
      identity
    ),
    "/outer/inner/pkgs/a/package.json": manifest("@i/a"),
  };
  const base = platform(nestedRoots);
  layer(WorkspaceRoot.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("stops at the first marker on the way up, not the outermost", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const found4 = yield* roots.find("/outer/inner/pkgs/a");
        assert.strictEqual(found4, "/outer/inner");
      })
    );

    it.effect("ascends past directories with no marker", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const found5 = yield* roots.find("/outer/inner/pkgs");
        assert.strictEqual(found5, "/outer/inner");
      })
    );
  });
});

const nonObjectManifest: Tree = {
  "/repo/package.json": rootManifest(["packages/*"]),
  "/repo/packages/good/package.json": manifest("@x/good"),
  "/repo/packages/nullish/package.json": "null",
};

describe("WorkspaceDiscovery — a member package.json that is `null`", () => {
  layer(discoveryOver(nonObjectManifest), { timeout: "30 seconds" })((it) => {
    it.effect("fails TYPED, never as a defect", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const exit = yield* Effect.exit(discovery.listPackages);
        assertExitFailure(exit, Exit.match(exit, { onFailure: identity, onSuccess: () => Cause.empty }));
        assert.isFalse(
          A.some(exit.cause.reasons, Cause.isDieReason),
          "null parses, and reading .name off it would escape as a TypeError defect that still fails"
        );
        assert.isTrue(A.some(exit.cause.reasons, Cause.isFailReason));

        const error = yield* Effect.flip(discovery.listPackages);
        assert.instanceOf(error, WorkspaceDiscoveryError);
        assert.strictEqual(
          error.kind,
          "invalidShape",
          "null is valid JSON with a wrong shape; asserting invalidJson let an unconstructed invalidShape ship"
        );
      })
    );
  });
});

const schemaRejectedPublishConfig: Tree = {
  "/repo/package.json": rootManifest(["packages/*"]),
  "/repo/packages/bad/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({
      name: "@x/bad",
      version: "1.0.0",
      publishConfig: { access: 42 },
    }),
    identity
  ),
};

describe("WorkspaceDiscovery — a manifest whose shape the schema rejects", () => {
  layer(discoveryOver(schemaRejectedPublishConfig), { timeout: "30 seconds" })((it) => {
    it.effect("is invalidShape, distinct from a JSON syntax error", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.listPackages);
        assert.instanceOf(error, WorkspaceDiscoveryError);
        assert.strictEqual(
          error.kind,
          "invalidShape",
          "the tolerant decode's SchemaError path: the file parses, so invalidJson would misreport it"
        );
        assert.strictEqual(error.path, "/repo/packages/bad/package.json");
      })
    );
  });
});

const permissionTree: Tree = {
  "/repo/package.json": rootManifest(["packages/*"]),
  "/repo/packages/visible/package.json": manifest("@x/visible"),
  "/repo/packages/secret/package.json": manifest("@x/secret"),
};

describe("WorkspaceDiscovery — a directory that cannot be read", () => {
  layer(discoveryOver(permissionTree, { unreadable: ["/repo/packages"] }), { timeout: "30 seconds" })((it) => {
    it.effect("surfaces a typed unreadableDirectory rather than reporting an empty workspace", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.listPackages);
        assert.instanceOf(error, WorkspacePatternError);
        assert.strictEqual(
          error.kind,
          "unreadableDirectory",
          "read as no entries, a permission error would pass for a legitimately empty workspace"
        );
      })
    );
  });
});

const unreadablePnpmWorkspace: Tree = {
  "/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
    identity
  ),
  "/repo/packages/a/package.json": manifest("@x/a"),
};

describe("WorkspaceDiscovery — an unreadable pnpm-workspace.yaml", () => {
  layer(discoveryOver(unreadablePnpmWorkspace, { unreadableFiles: ["/repo/pnpm-workspace.yaml"] }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("fails typed rather than reading as a workspace with no patterns", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.listPackages);
        assert.instanceOf(error, WorkspaceDiscoveryError);
        assert.strictEqual(
          error.kind,
          "read",
          'substituting "" would make an unreadable config and an empty one the same zero-member workspace'
        );
        assert.strictEqual(error.path, "/repo/pnpm-workspace.yaml");
      })
    );
  });
});

const utilsPackage = WorkspacePackage.make({
  name: "@x/utils",
  version: "1.0.0",
  path: "/repo/packages/utils",
  packageJsonPath: "/repo/packages/utils/package.json",
  relativePath: "packages/utils",
  workspaceRoot: "/repo",
});

const nestedPackage = WorkspacePackage.make({
  name: "@x/utils-extra",
  version: "1.0.0",
  path: "/repo/packages/utils/extra",
  packageJsonPath: "/repo/packages/utils/extra/package.json",
  relativePath: "packages/utils/extra",
  workspaceRoot: "/repo",
});

const StubbedDiscovery = WorkspaceDiscovery.layerTest({
  listPackages: Effect.suspend(() => Effect.succeed([utilsPackage, nestedPackage])),
});

describe("WorkspaceDiscovery.layerTest — one stubbed method, the lookups derived from the effective listPackages", () => {
  layer(StubbedDiscovery, { timeout: "30 seconds" })((it) => {
    it.effect("listPackages returns the stub", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        assert.deepStrictEqual(
          A.map(packages, (pkg) => pkg.name),
          ["@x/utils", "@x/utils-extra"]
        );
      })
    );

    it.effect("getPackage derives from the stubbed list — hit and typed miss", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const found = yield* discovery.getPackage("@x/utils");
        assert.strictEqual(found.relativePath, "packages/utils");

        const miss = yield* Effect.flip(discovery.getPackage("@x/nope"));
        assert.instanceOf(miss, PackageNotFoundError);
        assert.deepStrictEqual(miss.available, ["@x/utils", "@x/utils-extra"]);
      })
    );

    it.effect("importerMap derives from the stubbed list", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const map = yield* discovery.importerMap;
        assert.strictEqual(O.getOrUndefined(HashMap.get(map, "packages/utils"))?.name, "@x/utils");
        assert.strictEqual(HashMap.size(map), 2);
      })
    );

    it.effect("resolveFile derives by LONGEST prefix, not first match", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const owner = yield* discovery.resolveFile("/repo/packages/utils/extra/src/index.ts");
        assertSome(owner, nestedPackage);
        assert.strictEqual(owner.value.name, "@x/utils-extra");

        const outside = yield* discovery.resolveFile("/elsewhere/file.ts");
        assertNone(outside);
      })
    );

    it.effect("resolveFiles derives distinct owners sorted by name", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const owners = yield* discovery.resolveFiles([
          "/repo/packages/utils/extra/src/index.ts",
          "/repo/packages/utils/src/a.ts",
          "/repo/packages/utils/src/b.ts",
        ]);
        assert.deepStrictEqual(
          A.map(owners, (pkg) => pkg.name),
          ["@x/utils", "@x/utils-extra"]
        );
      })
    );
  });
});

const EmptyDiscovery = WorkspaceDiscovery.layerTest();

describe("WorkspaceDiscovery.makeTest — the empty-workspace defaults", () => {
  layer(EmptyDiscovery, { timeout: "30 seconds" })((it) => {
    it.effect("list-shaped methods succeed empty and refresh is a no-op", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const listPackages6 = yield* discovery.listPackages;
        assert.deepStrictEqual(listPackages6, []);
        const importerMap7 = yield* discovery.importerMap;
        assert.strictEqual(HashMap.size(importerMap7), 0);
        const resolvedFiles = yield* discovery.resolveFiles(["/repo/a.ts"]);
        assert.deepStrictEqual(resolvedFiles, []);
        const resolvedFile8 = yield* discovery.resolveFile("/repo/a.ts");
        assertNone(resolvedFile8);
        yield* discovery.refresh;
      })
    );

    it.effect("getPackage fails with the service's own typed error, never a fabricated one", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const miss = yield* Effect.flip(discovery.getPackage("@x/anything"));
        assert.instanceOf(miss, PackageNotFoundError);
        assert.deepStrictEqual(miss.available, []);
      })
    );

    it.effect("info() DIES unless stubbed — an unstubbed call is a wiring mistake", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const exit = yield* Effect.exit(discovery.info);
        assertExitFailure(exit, Exit.match(exit, { onFailure: identity, onSuccess: () => Cause.empty }));
        assert.isTrue(
          Cause.hasDies(exit.cause),
          "no honest default WorkspaceInfo: a fabricated root leaks into path logic, a typed failure gets swallowed"
        );
      })
    );
  });
});

describe("WorkspaceDiscovery.makeTest — overrides win over derivation", () => {
  it.effect("a stubbed info() succeeds inline, with no layer, and the shape needs nothing else", () =>
    Effect.gen(function* () {
      const double = WorkspaceDiscovery.makeTest({
        info: Effect.suspend(() => Effect.succeed(WorkspaceInfo.make({ root: "/repo", patterns: ["packages/*"] }))),
      });
      const info = yield* double.info;
      assert.strictEqual(info.root, "/repo");
      const listPackages9 = yield* double.listPackages;
      assert.deepStrictEqual(listPackages9, []);
    })
  );
});

const duplicateNames: Tree = {
  "/repo/package.json": rootManifest(["packages/*"]),
  "/repo/packages/alpha/package.json": manifest("@x/dup", { version: "1.0.0" }),
  "/repo/packages/beta/package.json": manifest("@x/dup", { version: "2.0.0" }),
};

describe("WorkspaceDiscovery — duplicate package names", () => {
  layer(discoveryOver(duplicateNames), { timeout: "30 seconds" })((it) => {
    it.effect("getPackage returns the first package declaring the name", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const found = yield* discovery.getPackage("@x/dup");
        assert.strictEqual(
          found.relativePath,
          "packages/alpha",
          "duplicate names are not rejected, so indexes keep the first match; a plain Map keeps the last"
        );
        assert.strictEqual(found.version, "1.0.0");
      })
    );

    it.layer(WorkspaceDiscovery.workspaceResolver, { timeout: "30 seconds" })((it) => {
      it.effect("versionOf resolves the first package's version", () =>
        Effect.gen(function* () {
          const resolver = yield* WorkspaceResolver;
          const versionOf10 = yield* resolver.versionOf("@x/dup");
          assertSome(versionOf10, "1.0.0");
        })
      );
    });
  });
});

describe("WorkspaceDiscoveryError encoding", () => {
  it.effect("preserves the originating cause stack", () =>
    Effect.gen(function* () {
      const cause = new Error("original discovery failure");
      const encoded = yield* S.encodeEffect(WorkspaceDiscoveryError)(
        WorkspaceDiscoveryError.make({
          root: "/repo",
          path: "/repo/package.json",
          kind: "read",
          cause,
        })
      );
      if (!P.isObject(encoded.cause)) return assert.fail("expected an encoded Error cause");
      assert.strictEqual(encoded.cause.stack, cause.stack);
    })
  );
});
