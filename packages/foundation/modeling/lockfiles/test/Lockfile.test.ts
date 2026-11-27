import { Lockfile } from "@beep/lockfiles/Lockfile";
import { filenameFor } from "@beep/lockfiles/LockfileFormat";
import { PnpmCatalogPin, PnpmExtension } from "@beep/lockfiles/PnpmExtension";
import { ResolvedPackage } from "@beep/lockfiles/ResolvedPackage";
import { isUnsupportedLockfileVersion } from "@beep/lockfiles/UnsupportedLockfileVersion";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertExitSuccess, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { corpus, fixture } from "./support/fixtures.ts";
import type { LockfileFormat } from "@beep/lockfiles/LockfileFormat";

const JsonString = S.fromJsonString(S.Unknown);

const NEGATIVE_FIXTURE_PREFIX = "unsupported-";

const CONFIG_ONLY_FIXTURE_PREFIX = "env-configonly-";

const parseFixture = (relative: string, format: LockfileFormat, configOnly = false) =>
  Lockfile.parse(fixture(relative), { format, configOnly });

const first = <T>(items: ReadonlyArray<T>): T => O.getOrThrow(A.head(items));

const defined = <T>(value: T | undefined): T => O.getOrThrow(O.fromUndefinedOr(value));

const pnpmExtensionOf = (lockfile: Lockfile): PnpmExtension =>
  O.getOrThrow(O.filter(O.fromUndefinedOr(lockfile.extension), S.is(PnpmExtension)));

const hasParenthesis = (text: string): boolean => Str.includes("(")(text) || Str.includes(")")(text);

const rebuiltInstanceIndex = (lockfile: Lockfile) => {
  const index = HashMap.fromIterable(A.map(lockfile.packages, (p) => [p.instanceId, p] as const));
  return { get: (id: string): ResolvedPackage | undefined => O.getOrUndefined(HashMap.get(index, id)) };
};

const positiveFixtureSets = (format: LockfileFormat): ReadonlyArray<string> =>
  A.dedupe(
    A.flatMap(R.keys(corpus), (path) => {
      const [root, fixtureSet] = Str.split(path, "/");
      return root === format && fixtureSet !== undefined && !Str.startsWith(NEGATIVE_FIXTURE_PREFIX)(fixtureSet)
        ? [fixtureSet]
        : [];
    })
  );

const gatedVersion = Effect.fn("gatedVersion")(function* (
  relative: string,
  format: LockfileFormat,
  configOnly: boolean
) {
  assert.isTrue(
    R.has(corpus, relative),
    `${relative} is missing: filenameFor names only the primary filename (a set holding npm-shrinkwrap.json fails here), read with the inert .fixture suffix`
  );
  const parsed = yield* parseFixture(relative, format, configOnly).pipe(
    Effect.mapError((cause) => new Error(`${relative} no longer parses: it may have aged below the gate`, { cause })),
    Effect.exit
  );
  assertExitSuccess(parsed, Exit.isSuccess(parsed) ? parsed.value : undefined);
  return parsed.value.lockfileVersion;
});

describe("Lockfile.parse", () => {
  describe("pnpm", () => {
    it.effect("v1: normalizes importers, packages, edges and the pnpm extension", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/v1/pnpm-lock.yaml", "pnpm");

        assert.strictEqual(lockfile.format, "pnpm");
        assert.strictEqual(lockfile.lockfileVersion, "9.0");
        assert.strictEqual(lockfile.packages.length, 5);

        const workspaces = lockfile.workspacePackages;
        assert.deepStrictEqual(
          A.map(workspaces, (p) => p.name),
          ["packages/core", "packages/utils"]
        );
        assert.isTrue(
          A.every(workspaces, (p) => p.version === "0.0.0"),
          "pnpm workspace rows stay importer-path-keyed at 0.0.0 until withImporterNames renames them"
        );
        assert.isTrue(A.every(workspaces, (p) => p.relativePath === p.name));

        assert.strictEqual(lockfile.packagesNamed("chalk").length, 1);
        const chalk = first(lockfile.packagesNamed("chalk"));
        assert.strictEqual(chalk.version, "5.6.2");
        assert.isFalse(chalk.isWorkspace);
        assert.isTrue(O.exists(O.fromUndefinedOr(chalk.integrity), Str.startsWith("sha512-")));

        const byId = lockfile.packageByInstanceId(chalk.instanceId);
        assertSome(
          O.map(byId, (pkg) => pkg.name),
          "chalk"
        );
        assert.strictEqual(
          O.getOrThrow(byId).name,
          "chalk",
          "the instance-id index answers what a scan would, so edge walkers need not rebuild it"
        );

        const unknownIdMiss = lockfile.packageByInstanceId("nope@0.0.0");
        const protoMemberMiss = lockfile.packageByInstanceId("__proto__");
        const constructorMemberMiss = lockfile.packageByInstanceId("constructor");
        assertNone(unknownIdMiss);
        assertNone(protoMemberMiss);
        assertNone(constructorMemberMiss);

        assert.strictEqual(lockfile.workspaceDependencies.length, 1);
        const edge = first(lockfile.workspaceDependencies);
        assert.strictEqual(edge.from, "packages/core");
        assert.strictEqual(edge.to, "@test-monorepo/utils");
        assert.strictEqual(edge.depType, "dependencies");
        assert.strictEqual(edge.constraint, "workspace:*");

        const extension = pnpmExtensionOf(lockfile);
        assert.deepStrictEqual(
          R.get(defined(extension.catalogs), "default"),
          O.some({
            chalk: PnpmCatalogPin.make({ specifier: "^5.3.0", version: "5.6.2" }),
          })
        );
        assert.deepStrictEqual(extension.overrides, { lodash: "4.17.21" });
        const settings = defined(extension.settings);
        assert.strictEqual(settings.autoInstallPeers, true);
        assert.strictEqual(settings.excludeLinksFromLockfile, false);
      })
    );

    it.effect("v2: carries named catalogs with specifier/version entries", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/v2/pnpm-lock.yaml", "pnpm");

        assert.strictEqual(lockfile.format, "pnpm");
        assert.deepStrictEqual(
          A.map(lockfile.workspacePackages, (p) => p.name),
          ["packages/core", "packages/new-pkg", "packages/utils"]
        );

        const edges = lockfile.workspaceDependencies;
        assert.deepStrictEqual(
          A.map(edges, (e) => [e.from, e.to]),
          [
            ["packages/core", "@test-monorepo/utils"],
            ["packages/new-pkg", "@test-monorepo/utils"],
          ]
        );

        const silk = O.getOrThrow(R.get(defined(pnpmExtensionOf(lockfile).catalogs), "silk"));
        for (const entry of R.values(silk)) {
          assert.isObject(entry);
          assert.property(entry, "specifier");
          assert.property(entry, "version");
        }

        assert.strictEqual(
          first(lockfile.packagesNamed("fdir")).version,
          "6.5.0",
          "the peer suffix in fdir@6.5.0(picomatch@4.0.4) must not corrupt the name@version split"
        );
        assert.strictEqual(first(lockfile.packagesNamed("@effect/platform")).version, "0.96.0");
        assert.strictEqual(first(lockfile.packagesNamed("@vitest/mocker")).version, "3.2.4");
        assert.isFalse(A.some(lockfile.packages, (p) => hasParenthesis(p.name) || hasParenthesis(p.version)));
      })
    );

    it.effect("v3: parses the minimal modern lockfile", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/v3/pnpm-lock.yaml", "pnpm");

        assert.strictEqual(lockfile.packages.length, 4);
        assert.strictEqual(lockfile.workspacePackages.length, 2);
        assert.strictEqual(lockfile.workspaceDependencies.length, 1);
        assert.strictEqual(lockfile.packagesNamed("lodash")[0]?.version, "4.17.23");
        assert.strictEqual(lockfile.extension?._tag, "pnpm");
      })
    );
  });

  describe("npm", () => {
    it.effect("v1: resolves workspace links to real names and versions", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("npm/v1/package-lock.json", "npm");

        assert.strictEqual(lockfile.format, "npm");
        assert.strictEqual(lockfile.lockfileVersion, "3");
        assert.strictEqual(lockfile.packages.length, 5);

        const workspaces = lockfile.workspacePackages;
        assert.deepStrictEqual(
          A.map(workspaces, (p) => [p.name, p.version, p.relativePath]),
          [
            ["@test-monorepo/core", "1.0.0", "packages/core"],
            ["@test-monorepo/utils", "1.0.0", "packages/utils"],
          ]
        );

        assert.strictEqual(lockfile.packagesNamed("typescript")[0]?.version, "5.9.3");
        assert.isTrue(
          O.exists(O.fromUndefinedOr(lockfile.packagesNamed("chalk")[0]?.integrity), Str.startsWith("sha512-"))
        );

        assert.strictEqual(lockfile.workspaceDependencies.length, 1);
        const edge = lockfile.workspaceDependencies[0];
        assert.strictEqual(edge?.from, "@test-monorepo/core");
        assert.strictEqual(edge?.to, "@test-monorepo/utils");
        assert.strictEqual(edge?.constraint, "*");

        assert.isUndefined(lockfile.extension, "npm records no format-specific extension");
      })
    );

    it.effect("v2: handles the three-workspace lockfile", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("npm/v2/package-lock.json", "npm");

        assert.deepStrictEqual(
          A.map(lockfile.workspacePackages, (p) => p.name),
          ["@test-monorepo/core", "@test-monorepo/new-pkg", "@test-monorepo/utils"]
        );
        assert.strictEqual(lockfile.packages.length, 107, "104 registry packages + 3 workspaces");
        assert.deepStrictEqual(
          A.map(lockfile.workspaceDependencies, (e) => [e.from, e.to]),
          [
            ["@test-monorepo/core", "@test-monorepo/utils"],
            ["@test-monorepo/new-pkg", "@test-monorepo/utils"],
          ]
        );
      })
    );
  });

  describe("yarn (Berry)", () => {
    it.effect("v1: identifies soft-link workspaces including the root", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("yarn/v1/yarn.lock", "yarn");

        assert.strictEqual(lockfile.format, "yarn");
        assert.strictEqual(lockfile.lockfileVersion, "8");
        assert.strictEqual(lockfile.packages.length, 7);

        const workspaces = lockfile.workspacePackages;
        assert.deepStrictEqual(A.map(workspaces, (p) => p.name).sort(), [
          "@test-monorepo/core",
          "@test-monorepo/utils",
          "test-yarn-monorepo",
        ]);
        assert.isTrue(A.every(workspaces, (p) => p.version === "0.0.0-use.local"));

        const utils = lockfile.packagesNamed("@test-monorepo/utils")[0];
        assert.strictEqual(
          utils?.relativePath,
          "packages/utils",
          'the compound key "@test-monorepo/utils@workspace:*, ...@workspace:packages/utils" yields the non-* path'
        );

        const chalk = lockfile.packagesNamed("chalk")[0];
        assert.strictEqual(chalk?.version, "5.6.2");
        assert.isTrue(
          O.exists(O.fromUndefinedOr(chalk?.integrity), Str.startsWith("10c0/")),
          "Berry 10c0/<hex> cache checksums validate as an IntegrityHash (the yarn textual form) and are preserved"
        );

        assert.strictEqual(lockfile.workspaceDependencies.length, 1);
        const edge = lockfile.workspaceDependencies[0];
        assert.strictEqual(edge?.from, "@test-monorepo/core");
        assert.strictEqual(edge?.to, "@test-monorepo/utils");
        assert.strictEqual(edge?.constraint, "workspace:*");

        assert.isUndefined(lockfile.extension);
      })
    );

    it.effect("v2: extracts edges across three workspaces and strips npm: prefixes", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("yarn/v2/yarn.lock", "yarn");

        const workspaceNames = A.map(lockfile.workspacePackages, (p) => p.name).sort();
        assert.deepStrictEqual(workspaceNames, [
          "@test-monorepo/core",
          "@test-monorepo/new-pkg",
          "@test-monorepo/utils",
          "test-yarn-monorepo",
        ]);

        assert.deepStrictEqual(A.map(lockfile.workspaceDependencies, (e) => [e.from, e.to]).sort(), [
          ["@test-monorepo/core", "@test-monorepo/utils"],
          ["@test-monorepo/new-pkg", "@test-monorepo/utils"],
        ]);

        assert.isAtLeast(
          lockfile.packagesNamed("typescript").length,
          2,
          "typescript resolves through both @npm: and @patch: descriptors"
        );
      })
    );
  });

  describe("bun", () => {
    it.effect("preserves nested version-scoped npm-style overrides in Bun v3", () =>
      Effect.gen(function* () {
        const overrides = {
          lodash: "4.17.21",
          "onnxruntime-node@1.30.0": { "adm-zip": "npm:fflate@0.8.3" },
          micromatch: { ".": "^4.0.5", picomatch: { ".": "^2.3.2", nested: "^1.0.0" } },
        };
        const text = yield* S.encodeEffect(JsonString)({ lockfileVersion: 3, overrides });
        const lockfile = yield* Lockfile.parse(text, { format: "bun" });
        assert.strictEqual(lockfile.extension?._tag, "bun");
        if (lockfile.extension?._tag === "bun") assert.deepStrictEqual(lockfile.extension.overrides, overrides);
      })
    );

    it.effect("rejects a nested override whose leaf is not a dependency specifier", () =>
      Effect.gen(function* () {
        const text = yield* S.encodeEffect(JsonString)({ lockfileVersion: 3, overrides: { parent: { child: 42 } } });
        const error = yield* Effect.flip(Lockfile.parse(text, { format: "bun" }));
        assert.strictEqual(error._tag, "LockfileParseError");
      })
    );

    it.effect("v1: reads workspaces, package tuples and the bun extension", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("bun/v1/bun.lock", "bun");

        assert.strictEqual(lockfile.format, "bun");
        assert.strictEqual(lockfile.lockfileVersion, "1");
        assert.strictEqual(
          lockfile.packages.length,
          7,
          "2 workspaces + 5 registry tuples; workspace tuples dedupe against the workspaces map"
        );

        const workspaces = lockfile.workspacePackages;
        assert.deepStrictEqual(
          A.map(workspaces, (p) => [p.name, p.version, p.relativePath]),
          [
            ["@test-monorepo/core", "1.0.0", "packages/core"],
            ["@test-monorepo/utils", "1.0.0", "packages/utils"],
          ]
        );

        const chalk = lockfile.packagesNamed("chalk")[0];
        assert.strictEqual(chalk?.version, "5.6.2");
        assert.isTrue(
          O.exists(O.fromUndefinedOr(chalk?.integrity), Str.startsWith("sha512-")),
          "integrity is read at tuple index 3, the pinned bun tuple shape"
        );

        assert.strictEqual(lockfile.workspaceDependencies.length, 1);
        assert.strictEqual(lockfile.workspaceDependencies[0]?.from, "@test-monorepo/core");
        assert.strictEqual(lockfile.workspaceDependencies[0]?.to, "@test-monorepo/utils");

        assert.strictEqual(lockfile.extension?._tag, "bun");
        if (lockfile.extension?._tag === "bun") {
          assert.deepStrictEqual(lockfile.extension.catalog, { react: "^19.0.0", "react-dom": "^19.0.0" });
          assert.isUndefined(lockfile.extension.catalogs);
          assert.isUndefined(lockfile.extension.trustedDependencies);
        }
      })
    );

    it.effect("v2: carries both the default catalog and named catalogs", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("bun/v2/bun.lock", "bun");

        assert.deepStrictEqual(
          A.map(lockfile.workspacePackages, (p) => p.name),
          ["@test-monorepo/core", "@test-monorepo/new-pkg", "@test-monorepo/utils"]
        );
        assert.deepStrictEqual(
          A.map(lockfile.workspaceDependencies, (e) => [e.from, e.to]),
          [
            ["@test-monorepo/core", "@test-monorepo/utils"],
            ["@test-monorepo/new-pkg", "@test-monorepo/utils"],
          ]
        );

        assert.strictEqual(lockfile.extension?._tag, "bun");
        if (lockfile.extension?._tag === "bun") {
          assert.deepStrictEqual(lockfile.extension.catalog, {
            react: "^19.1.0",
            "react-dom": "^19.1.0",
            zod: "^3.23.0",
          });
          assert.deepStrictEqual(lockfile.extension.catalogs, { testing: { vitest: "^3.0.0" } });
        }
      })
    );

    it.effect("v3: parses the minimal lockfile", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("bun/v3/bun.lock", "bun");

        assert.strictEqual(lockfile.packages.length, 4);
        assert.strictEqual(lockfile.workspacePackages.length, 2);
        assert.strictEqual(lockfile.workspaceDependencies.length, 1);
        assert.strictEqual(lockfile.packagesNamed("react")[0]?.version, "19.2.4");
      })
    );
  });
});

describe("Lockfile instance surface", () => {
  it.effect("packagesNamed returns every resolved version and [] for unknown names", () =>
    Effect.gen(function* () {
      const lockfile = yield* parseFixture("yarn/v2/yarn.lock", "yarn");
      assert.isAtLeast(lockfile.packagesNamed("typescript").length, 2);
      assert.deepStrictEqual(lockfile.packagesNamed("not-in-the-lockfile"), []);
      assert.strictEqual(
        lockfile.packagesNamed("typescript"),
        lockfile.packagesNamed("typescript"),
        "repeated lookups hit the same lazily built index"
      );
    })
  );

  it.effect("workspacePackages filters on isWorkspace", () =>
    Effect.gen(function* () {
      const lockfile = yield* parseFixture("npm/v1/package-lock.json", "npm");
      assert.strictEqual(lockfile.workspacePackages.length, 2);
      assert.isTrue(A.every(lockfile.workspacePackages, (p) => p.isWorkspace));
    })
  );
});

describe("Lockfile#withImporterNames (seam repair 1)", () => {
  const names = HashMap.fromIterable([
    ["packages/core", "@test-monorepo/core"],
    ["packages/utils", "@test-monorepo/utils"],
  ]);

  it.effect("renames pnpm workspace packages and rewrites both edge ends", () =>
    Effect.gen(function* () {
      const parsed = yield* parseFixture("pnpm/v1/pnpm-lock.yaml", "pnpm");
      const lockfile = parsed.withImporterNames(names);

      assert.deepStrictEqual(
        A.map(lockfile.workspacePackages, (p) => [p.name, p.relativePath]),
        [
          ["@test-monorepo/core", "packages/core"],
          ["@test-monorepo/utils", "packages/utils"],
        ]
      );
      assert.isTrue(
        A.every(lockfile.workspacePackages, (p) => p.version === "0.0.0"),
        'versions stay "0.0.0": the map carries names only'
      );

      const edge = lockfile.workspaceDependencies[0];
      assert.strictEqual(edge?.from, "@test-monorepo/core");
      assert.strictEqual(edge?.to, "@test-monorepo/utils");

      assert.strictEqual(lockfile.packagesNamed("chalk")[0]?.version, "5.6.2", "registry packages are untouched");
      assert.strictEqual(lockfile.extension?._tag, "pnpm", "the extension is untouched");

      assert.strictEqual(
        lockfile.packagesNamed("@test-monorepo/core").length,
        1,
        "the name index reflects the rewritten names"
      );
      assert.deepStrictEqual(lockfile.packagesNamed("packages/core"), []);

      assert.strictEqual(
        parsed.workspacePackages[0]?.name,
        "packages/core",
        "the original instance is untouched: the rename is pure, not in-place"
      );

      assert.isTrue(parsed.importers.length > 0);
      assert.deepStrictEqual(
        lockfile.importers,
        parsed.importers,
        "importers are the path-keyed join key, so withImporterNames leaves them untouched"
      );
    })
  );

  it.effect("keeps path names for entries not in the map", () =>
    Effect.gen(function* () {
      const parsed = yield* parseFixture("pnpm/v2/pnpm-lock.yaml", "pnpm");
      const lockfile = parsed.withImporterNames(names);

      assert.deepStrictEqual(
        A.map(lockfile.workspacePackages, (p) => p.name),
        ["@test-monorepo/core", "packages/new-pkg", "@test-monorepo/utils"]
      );
      assert.deepStrictEqual(
        A.map(lockfile.workspaceDependencies, (e) => [e.from, e.to]),
        [
          ["@test-monorepo/core", "@test-monorepo/utils"],
          ["packages/new-pkg", "@test-monorepo/utils"],
        ],
        "the unmapped importer's edge keeps its path-named end"
      );
    })
  );

  it.effect("leaves non-pnpm lockfiles unaffected", () =>
    Effect.gen(function* () {
      const parsed = yield* parseFixture("npm/v1/package-lock.json", "npm");
      const lockfile = parsed.withImporterNames(HashMap.fromIterable([["not-a-path", "renamed"]]));

      assert.deepStrictEqual(
        A.map(lockfile.workspacePackages, (p) => p.name),
        A.map(parsed.workspacePackages, (p) => p.name)
      );
      assert.deepStrictEqual(
        A.map(lockfile.workspaceDependencies, (e) => [e.from, e.to]),
        A.map(parsed.workspaceDependencies, (e) => [e.from, e.to])
      );
    })
  );

  it.effect("is a no-op for an empty map", () =>
    Effect.gen(function* () {
      const parsed = yield* parseFixture("pnpm/v3/pnpm-lock.yaml", "pnpm");
      const lockfile = parsed.withImporterNames(HashMap.empty());
      assert.deepStrictEqual(
        A.map(lockfile.workspacePackages, (p) => p.name),
        A.map(parsed.workspacePackages, (p) => p.name)
      );
    })
  );
});

describe("peer declarations", () => {
  const named = (lockfile: Lockfile, name: string) => {
    const found = lockfile.packagesNamed(name);
    assert.strictEqual(found.length, 1, `expected exactly one ${name}`);
    return found[0];
  };

  describe("pnpm", () => {
    it.effect("carries packages: peerDependencies and peerDependenciesMeta", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/peers/pnpm-lock.yaml", "pnpm");

        const reactDom = named(lockfile, "react-dom");
        assert.deepStrictEqual(reactDom?.peerDependencies, { react: "^18.3.1" });
        assert.deepStrictEqual(reactDom?.peerDependenciesMeta, {});

        const reactRedux = named(lockfile, "react-redux");
        assert.deepStrictEqual(reactRedux?.peerDependencies, {
          "@types/react": "^18.2.25 || ^19",
          react: "^18.0 || ^19",
          redux: "^5.0.0",
        });
        assert.deepStrictEqual(reactRedux?.peerDependenciesMeta, {
          "@types/react": { optional: true },
          redux: { optional: true },
        });
      })
    );

    it.effect("gives a package declaring no peers empty records, never undefined", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/peers/pnpm-lock.yaml", "pnpm");
        const chalk = named(lockfile, "chalk");
        assert.deepStrictEqual(chalk?.peerDependencies, {});
        assert.deepStrictEqual(chalk?.peerDependenciesMeta, {});
        assert.isTrue(
          A.every(lockfile.workspacePackages, (p) => R.keys(p.peerDependencies).length === 0),
          "pnpm records a workspace project's resolved dependencies, never its peer declarations, so rows keep the defaults"
        );
      })
    );
  });

  describe("npm", () => {
    it.effect("carries node_modules entry peers, with optional flags", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("npm/peers/package-lock.json", "npm");

        const reactDom = named(lockfile, "react-dom");
        assert.deepStrictEqual(reactDom?.peerDependencies, { react: "^18.3.1" });
        assert.deepStrictEqual(reactDom?.peerDependenciesMeta, {});

        const reactRedux = named(lockfile, "react-redux");
        assert.strictEqual(reactRedux?.peerDependencies.react, "^18.0 || ^19");
        assert.deepStrictEqual(reactRedux?.peerDependenciesMeta, {
          "@types/react": { optional: true },
          redux: { optional: true },
        });
      })
    );

    it.effect("carries a workspace package's peers off its resolved path entry", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("npm/peers/package-lock.json", "npm");
        const lib = named(lockfile, "@peers/lib");
        assert.isTrue(lib?.isWorkspace);
        assert.deepStrictEqual(lib?.peerDependencies, {
          "left-pad": "^1.3.0",
          react: "^18.0.0",
          typescript: "^5.0.0",
        });
        assert.deepStrictEqual(lib?.peerDependenciesMeta, {
          "left-pad": { optional: true },
          typescript: { optional: true },
        });
        assert.isUndefined(lib?.peerDependenciesMeta.react, "a required peer carries no meta entry at all");
      })
    );
  });

  describe("bun", () => {
    it.effect("normalizes the package tuple's optionalPeers array into meta", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("bun/peers/bun.lock", "bun");

        const reactDom = named(lockfile, "react-dom");
        assert.deepStrictEqual(reactDom?.peerDependencies, { react: "^18.3.1" });
        assert.deepStrictEqual(reactDom?.peerDependenciesMeta, {});

        const reactRedux = named(lockfile, "react-redux");
        assert.strictEqual(reactRedux?.peerDependencies.redux, "^5.0.0");
        assert.deepStrictEqual(
          reactRedux?.peerDependenciesMeta,
          {
            "@types/react": { optional: true },
            redux: { optional: true },
          },
          'bun\'s optionalPeers: ["@types/react", "redux"] normalizes to the meta shape every other format uses'
        );
      })
    );

    it.effect("normalizes a workspace entry's optionalPeers array into meta", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("bun/peers/bun.lock", "bun");
        const lib = named(lockfile, "@peers/lib");
        assert.isTrue(lib?.isWorkspace);
        assert.deepStrictEqual(lib?.peerDependencies, {
          "left-pad": "^1.3.0",
          react: "^18.0.0",
          typescript: "^5.0.0",
        });
        assert.deepStrictEqual(lib?.peerDependenciesMeta, {
          "left-pad": { optional: true },
          typescript: { optional: true },
        });
      })
    );
  });

  describe("yarn", () => {
    it.effect("carries entry peers and peerDependenciesMeta", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("yarn/peers/yarn.lock", "yarn");

        const reactDom = named(lockfile, "react-dom");
        assert.deepStrictEqual(reactDom?.peerDependencies, { react: "^18.3.1" });
        assert.deepStrictEqual(reactDom?.peerDependenciesMeta, {});

        const lib = named(lockfile, "@peers/lib");
        assert.isTrue(lib?.isWorkspace);
        assert.deepStrictEqual(lib?.peerDependencies, {
          "left-pad": "^1.3.0",
          react: "^18.0.0",
          typescript: "^5.0.0",
        });
        assert.deepStrictEqual(lib?.peerDependenciesMeta, {
          "left-pad": { optional: true },
          typescript: { optional: true },
        });
      })
    );
  });

  it("defaults every map field to {} at construction", () => {
    const pkg = ResolvedPackage.make({ name: "solo", version: "1.0.0", instanceId: "solo@1.0.0", isWorkspace: false });
    assert.deepStrictEqual(pkg.peerDependencies, {});
    assert.deepStrictEqual(pkg.peerDependenciesMeta, {});
    assert.deepStrictEqual(pkg.resolved, {});
  });
});

describe("instance identity and resolved edges", () => {
  const instance = (lockfile: Lockfile, name: string, version: string) => {
    const found = A.filter(lockfile.packagesNamed(name), (p) => p.version === version);
    assert.strictEqual(found.length, 1, `expected exactly one ${name}@${version}`);
    const pkg = found[0];
    assertDefined(pkg);
    return pkg;
  };

  describe("pnpm", () => {
    it.effect("v9: two peer-resolved variants of one package are two instances", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/variants/pnpm-lock.yaml", "pnpm");

        const variants = lockfile.packagesNamed("react-dom");
        assert.deepStrictEqual(
          A.map(variants, (p) => p.instanceId).sort(),
          ["react-dom@18.3.1(react@17.0.2)", "react-dom@18.3.1(react@18.3.1)"],
          "packages: carries one react-dom entry and snapshots: two; rows follow snapshots, where an instance lives"
        );
        assert.isTrue(A.every(variants, (p) => p.version === "18.3.1"));
        assert.isTrue(
          A.every(variants, (p) => p.peerDependencies.react === "^18.3.1"),
          "the peer declaration joins from the per-version packages: entry, so both instances carry it"
        );

        const old = O.getOrThrow(A.findFirst(variants, (p) => Str.includes("(react@17.0.2)")(p.instanceId)));
        assertDefined(old);
        const fresh = O.getOrThrow(A.findFirst(variants, (p) => Str.includes("(react@18.3.1)")(p.instanceId)));
        assertDefined(fresh);
        assert.strictEqual(old.resolved.react, "react@17.0.2", "each variant resolved a different react");
        assert.strictEqual(fresh.resolved.react, "react@18.3.1", "each variant resolved a different react");
        assert.strictEqual(instance(lockfile, "react", "17.0.2").instanceId, "react@17.0.2");
      })
    );

    it.effect("v9: an importer resolves registry and link: edges to instance ids", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/peers/pnpm-lock.yaml", "pnpm");
        const app = lockfile.packagesNamed("packages/app")[0];
        assertDefined(app);

        assert.strictEqual(app.instanceId, "packages/app");
        assert.strictEqual(app.resolved["react-dom"], "react-dom@18.3.1(react@17.0.2)");
        assert.strictEqual(
          app.resolved["@peers/lib"],
          "packages/lib",
          "link:../lib normalizes against the importer's path and is emitted only because packages/lib is an instance id"
        );
      })
    );

    it.effect("resolves a link: peer edge, whose identity pnpm spells two different ways", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/linkedpeer/pnpm-lock.yaml", "pnpm");
        const byId = rebuiltInstanceIndex(lockfile);

        const redux = byId.get("react-redux@9.2.0(react@packages+fakereact)");
        assertDefined(redux);
        assert.strictEqual(redux.peerDependencies.react, "^18.0 || ^19");
        assert.strictEqual(
          redux.resolved.react,
          "packages/fakereact",
          "the body's root-relative link:packages/fakereact names the importer by path; the mangled key suffix composes to no key, and a dropped edge reads upstream as an unsatisfied peer"
        );
        assert.isTrue(byId.get("packages/fakereact")?.isWorkspace);

        const nested = byId.get("use-sync-external-store@1.6.0(react@packages+fakereact)");
        assertDefined(nested);
        assert.strictEqual(
          nested.resolved.react,
          "packages/fakereact",
          "the same edge resolves transitively on the nested consumer"
        );
      })
    );

    it.effect("names a recorded-but-unnameable edge, and only that one", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/unnameablelink/pnpm-lock.yaml", "pnpm");
        const redux = lockfile.packagesNamed("react-redux")[0];
        assertDefined(redux);

        assert.strictEqual(
          redux.resolved["@types/use-sync-external-store"],
          "@types/use-sync-external-store@0.0.6",
          "a resolved edge in the same snapshot is unaffected"
        );

        assert.deepStrictEqual(
          redux.unresolvedEdges,
          ["react"],
          "the recorded link:vendor/react-stub edge (the class of this repo's dist/dev/pkg dogfood overrides) is named, or its absence from resolved reads as an unsatisfied peer"
        );
        assert.isUndefined(redux.resolved.react);

        assert.deepStrictEqual(redux.peerDependencies.redux, "^5.0.0");
        assert.isFalse(
          redux.unresolvedEdges.includes("redux"),
          "a declared peer with no recorded edge is absence; a field firing for every unmet peer is a signal nobody reads"
        );
        assert.isFalse(redux.unresolvedEdges.includes("@types/react"));
      })
    );

    it.effect("leaves unresolvedEdges empty when every recorded edge resolves", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/linkedpeer/pnpm-lock.yaml", "pnpm");
        assert.isTrue(
          A.every(lockfile.packages, (p) => p.unresolvedEdges.length === 0),
          "the linked-peer fixture's link target is an importer, so nothing there is unnameable"
        );
      })
    );

    it.effect("resolves a workspace: link into a package's publish directory to that importer", () =>
      Effect.gen(function* () {
        const content = A.join(
          [
            "lockfileVersion: '9.0'",
            "importers:",
            "  .: {}",
            "  packages/app:",
            "    devDependencies:",
            "      '@scope/lib':",
            "        specifier: workspace:*",
            "        version: link:../lib/dist/dev/pkg",
            "  packages/lib: {}",
          ],
          "\n"
        );
        const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
        const app = lockfile.packagesNamed("packages/app")[0];

        assert.strictEqual(
          app?.resolved["@scope/lib"],
          "packages/lib",
          "publishConfig.linkDirectory records the link against the build-output publish directory; unnamed, the workspace is permanently unverifiable downstream on a lockfile pnpm reports clean"
        );
        assert.deepStrictEqual(app?.unresolvedEdges, []);
      })
    );

    it.effect("declines a publish-directory link whose specifier is not workspace:", () =>
      Effect.gen(function* () {
        const content = A.join(
          [
            "lockfileVersion: '9.0'",
            "importers:",
            "  .: {}",
            "  packages/app:",
            "    devDependencies:",
            "      '@scope/stub':",
            "        specifier: link:../lib/vendor/stub",
            "        version: link:../lib/vendor/stub",
            "  packages/lib: {}",
          ],
          "\n"
        );
        const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
        const app = lockfile.packagesNamed("packages/app")[0];

        assert.isUndefined(app?.resolved["@scope/stub"]);
        assert.deepStrictEqual(
          app?.unresolvedEdges,
          ["@scope/stub"],
          "a hand-written link: may hold a vendored stub with its own identity, so the enclosing importer must not answer for it with the wrong package's peers"
        );
      })
    );

    it.effect("a publish-directory link resolves to the NEAREST enclosing importer", () =>
      Effect.gen(function* () {
        const content = A.join(
          [
            "lockfileVersion: '9.0'",
            "importers:",
            "  .: {}",
            "  packages/app:",
            "    dependencies:",
            "      '@scope/inner':",
            "        specifier: workspace:*",
            "        version: link:../lib/nested/inner/dist/pkg",
            "      '@scope/nowhere':",
            "        specifier: workspace:*",
            "        version: link:../../elsewhere/dist/pkg",
            "  packages/lib: {}",
            "  packages/lib/nested/inner: {}",
          ],
          "\n"
        );
        const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
        const app = lockfile.packagesNamed("packages/app")[0];

        assert.strictEqual(
          app?.resolved["@scope/inner"],
          "packages/lib/nested/inner",
          "the owner is the longest ancestor importer; the root, an ancestor of every path, is excluded"
        );
        assert.isUndefined(app?.resolved["@scope/nowhere"]);
        assert.deepStrictEqual(
          app?.unresolvedEdges,
          ["@scope/nowhere"],
          "a target under no importer stays unnameable, even under workspace:"
        );
      })
    );

    it.effect("emits no edge for a link: target that is not an importer", () =>
      Effect.gen(function* () {
        const content = A.join(
          [
            "lockfileVersion: '9.0'",
            "importers:",
            "  .: {}",
            "packages:",
            "  host@1.0.0: {}",
            "snapshots:",
            "  host@1.0.0:",
            "    dependencies:",
            "      ghost: link:build/output/dir",
            "      phantom: 9.9.9",
          ],
          "\n"
        );
        const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
        const host = lockfile.packagesNamed("host")[0];

        assert.deepStrictEqual(
          host?.resolved,
          {},
          "compose-then-verify emits only matches: neither a link: to a plain directory nor a name@version with no snapshot resolves"
        );
        assert.deepStrictEqual(
          host?.unresolvedEdges,
          ["ghost", "phantom"],
          "both are recorded edges, so both are named rather than dropped"
        );
      })
    );

    it.effect("resolves the alias edges pnpm itself records (real fixture)", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/alias/pnpm-lock.yaml", "pnpm");
        const cliui = lockfile.packagesNamed("@isaacs/cliui")[0];
        assertDefined(cliui);

        assert.strictEqual(cliui.resolved["string-width-cjs"], "string-width@4.2.3");
        assert.strictEqual(cliui.resolved["strip-ansi-cjs"], "strip-ansi@6.0.1");
        assert.isTrue(
          A.every(lockfile.packages, (p) => p.unresolvedEdges.length === 0),
          "pnpm reports this lockfile clean, so every aliased snapshot and importer edge must resolve"
        );
      })
    );

    it.effect("resolves the publish-directory link pnpm itself records (real fixture)", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/publishdir/pnpm-lock.yaml", "pnpm");
        const byId = rebuiltInstanceIndex(lockfile);

        const reactDom = byId.get("react-dom@18.2.0(react@packages+react+dist+pkg)");
        assertDefined(reactDom);
        assert.strictEqual(
          reactDom.resolved.react,
          "packages/react",
          "the importer's publishDirectory: dist/pkg names the specifier-less body edge link:packages/react/dist/pkg"
        );
        const app = lockfile.packagesNamed("packages/app")[0];
        assert.strictEqual(
          app?.resolved.react,
          "packages/react",
          "on the importer path the publishDirectory map answers before the workspace:-gated ancestor walk"
        );
        assert.isTrue(A.every(lockfile.packages, (p) => p.unresolvedEdges.length === 0));
      })
    );

    it.effect("resolves an npm: alias in an importer section by the recorded version", () =>
      Effect.gen(function* () {
        const content = A.join(
          [
            "lockfileVersion: '9.0'",
            "importers:",
            "  .: {}",
            "  packages/app:",
            "    devDependencies:",
            "      typescript-classic:",
            "        specifier: npm:typescript@^6.0.3",
            "        version: typescript@6.0.3",
            "packages:",
            "  typescript@6.0.3: {}",
            "snapshots:",
            "  typescript@6.0.3: {}",
          ],
          "\n"
        );
        const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
        const app = lockfile.packagesNamed("packages/app")[0];

        assert.strictEqual(
          app?.resolved["typescript-classic"],
          "typescript@6.0.3",
          "the recorded alias version is the referenced instance's key; composing typescript-classic@typescript@6.0.3 matches nothing"
        );
        assert.deepStrictEqual(
          app?.unresolvedEdges,
          [],
          "an unresolved alias edge would be a false fail-closed marker on a lockfile pnpm reports clean"
        );
      })
    );

    it.effect("resolves an npm: alias in a snapshot body, with and without a peer suffix", () =>
      Effect.gen(function* () {
        const content = A.join(
          [
            "lockfileVersion: '9.0'",
            "importers:",
            "  .: {}",
            "packages:",
            "  host@1.0.0: {}",
            "  typescript@6.0.3: {}",
            "  react-dom@18.3.1: {}",
            "  react@18.3.1: {}",
            "snapshots:",
            "  host@1.0.0:",
            "    dependencies:",
            "      typescript-classic: typescript@6.0.3",
            "      renderer: react-dom@18.3.1(react@18.3.1)",
            "      phantom: 9.9.9",
            "  typescript@6.0.3: {}",
            "  react-dom@18.3.1(react@18.3.1): {}",
            "  react@18.3.1: {}",
          ],
          "\n"
        );
        const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
        const host = lockfile.packagesNamed("host")[0];

        assert.strictEqual(
          host?.resolved["typescript-classic"],
          "typescript@6.0.3",
          "snapshot bodies record aliases as name: realname@realversion with no specifier beside them"
        );
        assert.strictEqual(host?.resolved.renderer, "react-dom@18.3.1(react@18.3.1)");
        assert.deepStrictEqual(
          host?.unresolvedEdges,
          ["phantom"],
          "a plain version like 9.9.9 is never an instance key (ids carry a name), so it stays unresolved"
        );
      })
    );

    it.effect("resolves an aliased importer edge that carries a peer suffix", () =>
      Effect.gen(function* () {
        const content = A.join(
          [
            "lockfileVersion: '9.0'",
            "importers:",
            "  .: {}",
            "  packages/app:",
            "    dependencies:",
            "      renderer:",
            "        specifier: npm:react-dom@^18.0.0",
            "        version: react-dom@18.3.1(react@18.3.1)",
            "packages:",
            "  react-dom@18.3.1: {}",
            "  react@18.3.1: {}",
            "snapshots:",
            "  react-dom@18.3.1(react@18.3.1): {}",
            "  react@18.3.1: {}",
          ],
          "\n"
        );
        const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
        const app = lockfile.packagesNamed("packages/app")[0];

        assert.strictEqual(
          app?.resolved.renderer,
          "react-dom@18.3.1(react@18.3.1)",
          "the recorded version names the peer-resolved instance, suffix and all, and that full string is the key"
        );
        assert.deepStrictEqual(app?.unresolvedEdges, []);
      })
    );

    it.effect("resolves a snapshot link: into a declared publishDirectory to its importer", () =>
      Effect.gen(function* () {
        const content = A.join(
          [
            "lockfileVersion: '9.0'",
            "importers:",
            "  .: {}",
            "  packages/lib:",
            "    publishDirectory: dist/dev/pkg",
            "packages:",
            "  host@1.0.0: {}",
            "snapshots:",
            "  host@1.0.0:",
            "    dependencies:",
            "      '@scope/lib': link:packages/lib/dist/dev/pkg",
            "      '@scope/stray': link:packages/lib/dist/prod/pkg",
          ],
          "\n"
        );
        const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
        const host = lockfile.packagesNamed("host")[0];

        assert.strictEqual(
          host?.resolved["@scope/lib"],
          "packages/lib",
          "snapshot edges carry no specifier; the declared publishDirectory is exact evidence, not a guess from ancestry"
        );
        assert.deepStrictEqual(
          host?.unresolvedEdges,
          ["@scope/stray"],
          "a link into a directory no importer declares as its publish directory stays unnameable"
        );
      })
    );

    it.effect("reports a link: into the unmodeled ROOT importer's publishDirectory as unresolved", () =>
      Effect.gen(function* () {
        const content = A.join(
          [
            "lockfileVersion: '9.0'",
            "importers:",
            "  .:",
            "    publishDirectory: dist/dev/pkg",
            "packages:",
            "  host@1.0.0: {}",
            "snapshots:",
            "  host@1.0.0:",
            "    dependencies:",
            "      '@scope/root': link:dist/dev/pkg",
          ],
          "\n"
        );
        const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
        const host = lockfile.packagesNamed("host")[0];

        assertDefined(host);
        assert.deepStrictEqual(host.resolved, {});
        assert.deepStrictEqual(
          host.unresolvedEdges,
          ["@scope/root"],
          'pnpm emits no root package instance, so the edge stays unresolved rather than dangling at "."'
        );
        assertNone(lockfile.packageByInstanceId("."));
      })
    );

    it.effect("consults publishDirectory evidence on importer edges before the ancestor walk", () =>
      Effect.gen(function* () {
        const content = A.join(
          [
            "lockfileVersion: '9.0'",
            "importers:",
            "  .: {}",
            "  packages/app:",
            "    devDependencies:",
            "      '@scope/lib':",
            "        specifier: link:../lib/dist/dev/pkg",
            "        version: link:../lib/dist/dev/pkg",
            "      '@scope/stub':",
            "        specifier: link:../lib/vendor/stub",
            "        version: link:../lib/vendor/stub",
            "  packages/lib:",
            "    publishDirectory: dist/dev/pkg",
          ],
          "\n"
        );
        const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
        const app = lockfile.packagesNamed("packages/app")[0];

        assert.strictEqual(
          app?.resolved["@scope/lib"],
          "packages/lib",
          "a declared publishDirectory resolves even under a plain link: specifier the workspace:-gated walk declines"
        );
        assert.deepStrictEqual(
          app?.unresolvedEdges,
          ["@scope/stub"],
          "the sibling target no importer declares stays unnameable"
        );
      })
    );

    it.effect("a v9 lockfile with an empty snapshots map is valid input", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/emptysnapshots/pnpm-lock.yaml", "pnpm");

        const chalk = instance(lockfile, "chalk", "5.3.0");
        assert.strictEqual(
          chalk.instanceId,
          "chalk@5.3.0",
          "the gate is on format version, not snapshots: emptiness; with no snapshots, rows come from packages: unresolved"
        );
        assert.isTrue(O.exists(O.fromUndefinedOr(chalk.integrity), Str.startsWith("sha512-")));

        const app = lockfile.packagesNamed("packages/app")[0];
        assertDefined(app);
        assert.strictEqual(app.resolved.chalk, "chalk@5.3.0");
      })
    );

    it.effect("answers which version of a peer resolved for a package instance", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/peers/pnpm-lock.yaml", "pnpm");
        const byId = rebuiltInstanceIndex(lockfile);

        const app = lockfile.packagesNamed("packages/app")[0];
        assertDefined(app);
        const reactDom = byId.get(app.resolved["react-dom"] ?? "");
        assertDefined(reactDom);
        const wanted = reactDom.peerDependencies.react;
        const found = byId.get(reactDom.resolved.react ?? "")?.version ?? null;

        assert.strictEqual(wanted, "^18.3.1", "the peer check @effected/workspaces runs, with no format knowledge");
        assert.strictEqual(found, "17.0.2", "the peer is unmet, and provably so");
        assert.isUndefined(reactDom.peerDependenciesMeta.react, "the peer is required");
      })
    );
  });

  describe("npm", () => {
    it.effect("parses an entry nested under a workspace directory", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("npm/nested/package-lock.json", "npm");

        assert.deepStrictEqual(
          A.map(lockfile.packagesNamed("react"), (p) => p.version).sort(),
          ["17.0.2", "18.3.1"],
          "packages/lib/node_modules/react does not start with node_modules/ and must not be dropped"
        );
        assert.strictEqual(instance(lockfile, "react", "18.3.1").instanceId, "packages/lib/node_modules/react");

        const lib = lockfile.packagesNamed("@nested/lib")[0];
        assertDefined(lib);
        assert.deepStrictEqual(lib.peerDependencies, { react: "^18.0.0" });
        assert.strictEqual(
          lib.resolved.react,
          "packages/lib/node_modules/react",
          "the workspace resolves the react installed for it, which also satisfies its declared peer"
        );
      })
    );

    it.effect("names a nested entry by its bare package name", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("npm/nested/package-lock.json", "npm");
        assert.isTrue(A.every(lockfile.packages, (p) => !Str.includes("node_modules")(p.name)));

        const nested = instance(lockfile, "ms", "2.0.0");
        assert.strictEqual(nested.name, "ms", 'single-prefix stripping would name this entry "debug/node_modules/ms"');
        assert.strictEqual(nested.instanceId, "node_modules/debug/node_modules/ms");
        assert.strictEqual(instance(lockfile, "ms", "2.1.3").instanceId, "node_modules/ms");
      })
    );

    it.effect("resolves deepest-first, so a shadowed copy wins over the hoisted one", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("npm/nested/package-lock.json", "npm");
        const byId = rebuiltInstanceIndex(lockfile);

        const debug = byId.get("node_modules/debug");
        assertDefined(debug);
        assert.strictEqual(debug.resolved.ms, "node_modules/debug/node_modules/ms");
        assert.strictEqual(
          byId.get(debug.resolved.ms ?? "")?.version,
          "2.0.0",
          "debug's own ms@2.0.0 shadows the hoisted 2.1.3; an outermost-first walk would report 2.1.3"
        );
        assert.strictEqual(byId.get("node_modules/ms")?.version, "2.1.3");

        const lib = byId.get("node_modules/@nested/lib");
        assertDefined(lib);
        assert.strictEqual(
          byId.get(lib.resolved.react ?? "")?.version,
          "18.3.1",
          "an independent shadow: the workspace's own react@18.3.1 under its directory beats the hoisted 17.0.2"
        );
        assert.strictEqual(byId.get("node_modules/react")?.version, "17.0.2");
      })
    );

    it.effect("resolves through an intermediate ancestor, not just self-then-root", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("npm/ancestor-walk/package-lock.json", "npm");
        const byId = rebuiltInstanceIndex(lockfile);

        const b = byId.get("node_modules/a/node_modules/b");
        assertDefined(b);
        assert.strictEqual(
          b.resolved.c,
          "node_modules/a/node_modules/c",
          "b has no c of its own and must find a's c at the intermediate level; generated fixtures pass an own-else-root walk"
        );
        assert.strictEqual(byId.get(b.resolved.c ?? "")?.version, "2.0.0");
        assert.strictEqual(
          byId.get("node_modules/c")?.version,
          "1.0.0",
          "both candidates exist at different versions, so the walk assertion discriminates"
        );
      })
    );

    it.effect("resolves a workspace link's edges from the workspace directory", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("npm/peers/package-lock.json", "npm");
        const lib = lockfile.packagesNamed("@peers/lib")[0];
        assertDefined(lib);
        assert.strictEqual(lib.instanceId, "node_modules/@peers/lib");
        assert.strictEqual(lib.resolved.chalk, "node_modules/chalk");
        assert.isUndefined(lib.resolved["left-pad"], "a peer nothing installed is omitted, not invented");
      })
    );

    it.effect("npm and bun: a declaration nothing installed is ABSENCE, not an unresolved edge", () =>
      Effect.gen(function* () {
        for (const [relative, format] of [
          ["npm/peers/package-lock.json", "npm"],
          ["npm/v2/package-lock.json", "npm"],
          ["bun/peers/bun.lock", "bun"],
          ["bun/v2/bun.lock", "bun"],
        ] satisfies ReadonlyArray<[string, LockfileFormat]>) {
          const lockfile = yield* parseFixture(relative, format);
          for (const row of lockfile.packages) {
            assert.deepStrictEqual(
              row.unresolvedEdges,
              [],
              `${relative}: ${row.instanceId}: npm/bun sections are declarations, so a name the walk misses is not installed; flagging it would make the fail-closed marker always on`
            );
          }
          const redux = lockfile.packagesNamed("react-redux")[0];
          if (redux !== undefined) {
            assert.strictEqual(redux.peerDependencies.redux, "^5.0.0", relative);
            assert.isUndefined(
              redux.resolved.redux,
              `${relative}: react-redux declares redux, which no lockfile here installs, so the check is non-vacuous`
            );
          }
        }

        const unnameable = yield* parseFixture("pnpm/unnameablelink/pnpm-lock.yaml", "pnpm");
        assert.isAbove(
          A.filter(unnameable.packages, (p) => p.unresolvedEdges.length > 0).length,
          0,
          "the control fixture must populate unresolvedEdges, or the assertions above prove nothing"
        );
      })
    );
  });

  describe("bun", () => {
    it.effect("keys nested instances by parent path and keeps them distinguishable", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("bun/nested/bun.lock", "bun");

        const reacts = lockfile.packagesNamed("react");
        assert.strictEqual(HashSet.size(HashSet.fromIterable(A.map(reacts, (p) => p.instanceId))), reacts.length);
        assert.strictEqual(
          instance(lockfile, "react", "18.3.1").instanceId,
          "@nested/lib/react",
          'the parent chain is read off the key space: splitting the two-segment scoped key on "/" would take "@nested"'
        );
        assert.strictEqual(instance(lockfile, "react", "17.0.2").instanceId, "react");
        assert.strictEqual(
          instance(lockfile, "react", "18.3.1").name,
          "react",
          "name and version come off tuple[0]; identity comes off the key"
        );

        const lib = lockfile.packagesNamed("@nested/lib")[0];
        assertDefined(lib);
        assert.strictEqual(
          lib.instanceId,
          "@nested/lib",
          "a workspace's instance id is its bare-name packages key, which nested keys prefix themselves with"
        );
        assert.strictEqual(lib.resolved.react, "@nested/lib/react");
        assert.deepStrictEqual(lib.peerDependencies, { react: "^18.0.0" });
      })
    );

    it.effect("resolves deepest-first over the key space", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("bun/nested/bun.lock", "bun");
        const byId = rebuiltInstanceIndex(lockfile);

        const debug = byId.get("debug");
        assertDefined(debug);
        assert.strictEqual(
          debug.resolved.ms,
          "debug/ms",
          'debug\'s own ms@2.0.0 at "debug/ms" shadows the hoisted ms@2.1.3; an outermost-first walk reports the hoisted one'
        );
        assert.strictEqual(byId.get("debug/ms")?.version, "2.0.0");
        assert.strictEqual(byId.get("ms")?.version, "2.1.3");
      })
    );
  });

  describe("yarn", () => {
    it.effect("identifies instances by locator and resolves descriptors through the key index", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("yarn/peers/yarn.lock", "yarn");
        const reactDom = instance(lockfile, "react-dom", "18.3.1");
        assert.strictEqual(reactDom.instanceId, "react-dom@npm:18.3.1");
        assert.strictEqual(reactDom.resolved.scheduler, "scheduler@npm:0.23.2");

        const app = lockfile.packagesNamed("@peers/app")[0];
        assertDefined(app);
        assert.strictEqual(app.instanceId, "@peers/app@workspace:packages/app");
        assert.strictEqual(
          app.resolved["@peers/lib"],
          "@peers/lib@workspace:packages/lib",
          "a workspace dependency resolves to the workspace locator, not the npm one"
        );

        assert.deepStrictEqual(reactDom.peerDependencies, { react: "^18.3.1" });
        assert.isUndefined(
          reactDom.resolved.react,
          "yarn resolves peers virtually and records no satisfying instance; an absent edge is true, a guessed one is not"
        );
      })
    );

    it.effect("resolves a workspace's DEV edges — yarn records them as dependencies", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("yarn/devdeps/yarn.lock", "yarn");
        const root = lockfile.packagesNamed("@devdeps/root")[0];
        assertDefined(root);
        assert.strictEqual(root.resolved.chalk, "chalk@npm:5.3.0");
        assert.strictEqual(
          root.resolved.typescript,
          "typescript@npm:5.3.3",
          "Berry writes dev-only typescript and prod-only chalk under one dependencies: map; both edges must resolve"
        );
        const lib = lockfile.packagesNamed("@devdeps/lib")[0];
        assertDefined(lib);
        assert.strictEqual(lib.resolved.chalk, "chalk@npm:5.3.0");
        assert.strictEqual(lib.resolved.typescript, "typescript@npm:5.3.3");
        assert.deepStrictEqual(root.unresolvedEdges, []);
      })
    );
  });
});

describe("peer suffixes on protocol versions", () => {
  const load = () => parseFixture("pnpm/filepeer/pnpm-lock.yaml", "pnpm");

  it.effect("splits a file: directory's suffix off its snapshot key, nested chain and all", () =>
    Effect.gen(function* () {
      const lockfile = yield* load();
      const libs = lockfile.packagesNamed("lib");
      assert.strictEqual(
        libs.length,
        1,
        "the packages: entry is covered by its snapshot, not re-emitted as an orphan under a second identity"
      );
      const lib = libs[0];
      assertDefined(lib);
      assert.strictEqual(lib.instanceId, "lib@file:vendor/lib(react-dom@18.3.1(react@18.3.1))(react@18.3.1)");
      assert.strictEqual(lib.version, "file:vendor/lib");
      assert.deepStrictEqual(
        lib.peerDependencies,
        { react: "^18.0.0", "react-dom": "^18.0.0" },
        "peer declarations join from the packages: entry keyed by the plain part"
      );
    })
  );

  it.effect("names no instance with a fragment of a peer suffix", () =>
    Effect.gen(function* () {
      for (const pkg of (yield* load()).packages) {
        assert.notInclude(
          pkg.name,
          "(",
          `${pkg.instanceId}: pnpm suffixes file: like a registry version; a mis-split names lib@file:vendor/lib(react`
        );
        assert.isFalse(
          Str.endsWith(")")(pkg.version),
          `${pkg.instanceId}: a mis-split leaves a garbled version like 18.3.1) that a peer check reads as unparseable`
        );
      }
    })
  );

  it.effect("splits a file: tarball's suffix the same way", () =>
    Effect.gen(function* () {
      const tarlibs = (yield* load()).packagesNamed("tarlib");
      assert.strictEqual(tarlibs.length, 1);
      assert.strictEqual(tarlibs[0]?.instanceId, "tarlib@file:vendor/tarlib-1.0.0.tgz(react@18.3.1)");
      assert.strictEqual(tarlibs[0]?.version, "file:vendor/tarlib-1.0.0.tgz");
      assert.deepStrictEqual(tarlibs[0]?.peerDependencies, { react: "^18.0.0" });
    })
  );

  it.effect("reads a parenthesised path the way pnpm's own packages: key does", () =>
    Effect.gen(function* () {
      const parens = (yield* load()).packagesNamed("parenlib");
      assert.strictEqual(parens.length, 1);
      assert.strictEqual(parens[0]?.instanceId, "parenlib@file:vendor/paren(lib)(react@18.3.1)");
      assert.strictEqual(
        parens[0]?.version,
        "file:vendor/paren",
        "pnpm keys packages: as parenlib@file:vendor/paren, taking the whole trailing run of groups; else the entry orphans"
      );
      assert.deepStrictEqual(parens[0]?.peerDependencies, { react: "^18.0.0" });
    })
  );

  it.effect("splits the importer versions likewise, and leaves an unsuffixed link: whole", () =>
    Effect.gen(function* () {
      const host = O.getOrThrow((yield* load()).importer("packages/host"));
      const dep = (name: string) => O.getOrThrow(host.dependency(name));
      assert.strictEqual(dep("lib").version, "file:vendor/lib");
      assert.strictEqual(dep("lib").peerSuffix, "(react-dom@18.3.1(react@18.3.1))(react@18.3.1)");
      assert.strictEqual(dep("tarlib").version, "file:vendor/tarlib-1.0.0.tgz");
      assert.strictEqual(dep("tarlib").peerSuffix, "(react@18.3.1)");
      assert.strictEqual(dep("linklib").version, "link:../../vendor/linklib");
      assert.isFalse(
        P.hasProperty(dep("linklib"), "peerSuffix"),
        "pnpm does not suffix a link: even when its target declares peers"
      );
      assert.strictEqual(dep("react-dom").version, "18.3.1", "a registry version is unchanged");
      assert.strictEqual(dep("react-dom").peerSuffix, "(react@18.3.1)");
    })
  );

  it.effect("still resolves the host's edges to the suffixed instances", () =>
    Effect.gen(function* () {
      const host = (yield* load()).packagesNamed("packages/host")[0];
      assertDefined(host);
      assert.strictEqual(host.resolved.lib, "lib@file:vendor/lib(react-dom@18.3.1(react@18.3.1))(react@18.3.1)");
      assert.strictEqual(host.resolved.tarlib, "tarlib@file:vendor/tarlib-1.0.0.tgz(react@18.3.1)");
    })
  );

  const handAuthoredEdges = () =>
    Lockfile.parse(
      A.join(
        [
          "lockfileVersion: '9.0'",
          "importers:",
          "  .:",
          "    dependencies:",
          "      mid:",
          "        specifier: file:vendor/a(b)/mid",
          "        version: file:vendor/a(b)/mid(react@18.3.1)",
          "      scoped:",
          "        specifier: file:../@scope/lib",
          "        version: file:../@scope/lib(react@18.3.1)",
          "      stub:",
          "        specifier: link:vendor/stub(x)",
          "        version: link:vendor/stub(x)",
          "snapshots:",
          "  mid@file:vendor/a(b)/mid(react@18.3.1): {}",
          "  scoped@file:../@scope/lib(react@18.3.1): {}",
          "  '@scope/reg@1.0.0(react@18.3.1)': {}",
        ],
        "\n"
      ),
      { format: "pnpm" }
    );

  it.effect("never splits inside the path: only a TRAILING run of groups is a suffix", () =>
    Effect.gen(function* () {
      const lockfile = yield* handAuthoredEdges();
      assert.strictEqual(
        lockfile.packagesNamed("mid")[0]?.version,
        "file:vendor/a(b)/mid",
        "a parenthesis followed by more path is not part of the trailing run"
      );
      const root = O.getOrThrow(lockfile.importer("."));
      assert.strictEqual(O.getOrThrow(root.dependency("mid")).version, "file:vendor/a(b)/mid");
      assert.strictEqual(O.getOrThrow(root.dependency("mid")).peerSuffix, "(react@18.3.1)");
    })
  );

  it.effect("splits name from version at the first @, so an @ in the spec stays in the version", () =>
    Effect.gen(function* () {
      const lockfile = yield* handAuthoredEdges();
      assert.strictEqual(lockfile.packagesNamed("scoped")[0]?.version, "file:../@scope/lib");
      assert.strictEqual(lockfile.packagesNamed("@scope/reg")[0]?.version, "1.0.0");
    })
  );

  it.effect("leaves a link: whole, since pnpm never suffixes one", () =>
    Effect.gen(function* () {
      const root = O.getOrThrow((yield* handAuthoredEdges()).importer("."));
      const stub = O.getOrThrow(root.dependency("stub"));
      assert.strictEqual(stub.version, "link:vendor/stub(x)");
      assert.isFalse(P.hasProperty(stub, "peerSuffix"));
    })
  );
});

describe("supported lockfile versions", () => {
  const failure = (relative: string, format: LockfileFormat) =>
    Effect.flip(Lockfile.parse(fixture(relative), { format }));

  it.effect("narrows the cause through the exported predicate, not by hand", () =>
    Effect.gen(function* () {
      const error = yield* failure("npm/unsupported-v2/package-lock.json", "npm");
      assert.strictEqual(error._tag, "LockfileParseError");
      if (error._tag !== "LockfileParseError") return;

      assert.isTrue(
        isUnsupportedLockfileVersion(error.cause),
        "the documented predicate must typecheck and narrow, or a consumer following the docs writes an unchecked cast"
      );
      if (!isUnsupportedLockfileVersion(error.cause)) return;
      assert.strictEqual(error.cause.format, "npm");
      assert.strictEqual(error.cause.lockfileVersion, 2);
      assert.strictEqual(error.cause.minimumSupported, 3);
      assert.include(error.cause.message, "lockfileVersion");
    })
  );

  it.effect("the predicate rejects a malformed-input cause, which is the whole point", () =>
    Effect.gen(function* () {
      const syntax = yield* Effect.flip(Lockfile.parse("{ not json", { format: "npm" }));
      assert.strictEqual(syntax._tag, "LockfileParseError");
      if (syntax._tag !== "LockfileParseError") return;
      assert.strictEqual(syntax.stage, "syntax");
      assert.isFalse(
        isUnsupportedLockfileVersion(syntax.cause),
        'the Schema.Defect cause carries whatever the engines throw; telling "too old" from "malformed" needs a NO here'
      );

      const value1 = yield* S.encodeEffect(JsonString)({ lockfileVersion: 3 });
      const shape = yield* Effect.flip(Lockfile.parse(value1, { format: "npm" }));
      assert.strictEqual(shape._tag, "LockfileParseError");
      if (shape._tag !== "LockfileParseError") return;
      assert.strictEqual(shape.stage, "validation");
      assert.isFalse(
        isUnsupportedLockfileVersion(shape.cause),
        "a shape failure shares the validation stage with the version gate, so only the tag tells them apart"
      );
    })
  );

  it("is total and defensive: it is called on genuinely unknown values", () => {
    for (const value of [
      null,
      undefined,
      "UnsupportedLockfileVersion",
      42,
      [],
      new Error("boom"),
      Object.assign(new Error("tagged"), { _tag: "SomethingElse" }),
      { _tag: "SomeOtherError", format: "npm", minimumSupported: 3 },
    ]) {
      assert.isFalse(
        isUnsupportedLockfileVersion(value),
        `${String(value)}: the predicate narrows an open channel, so it is handed values like this and must not throw`
      );
    }
  });

  it("rejects a NEAR-MISS, not just obviously-wrong values", () => {
    assert.isFalse(
      isUnsupportedLockfileVersion({ _tag: "UnsupportedLockfileVersion" }),
      "the dangerous impostor carries the right tag and nothing else; accepting anything tagged makes the predicate a cast"
    );
    assert.isFalse(isUnsupportedLockfileVersion({ _tag: "UnsupportedLockfileVersion", format: "npm" }));
    assert.isFalse(
      isUnsupportedLockfileVersion({ _tag: "UnsupportedLockfileVersion", format: "npm", minimumSupported: "3" })
    );
    assert.isFalse(
      isUnsupportedLockfileVersion({ _tag: "UnsupportedLockfileVersion", minimumSupported: 3 }),
      "each field is checked independently: missing only format fails on that clause alone"
    );
    assert.isFalse(
      isUnsupportedLockfileVersion({ _tag: "UnsupportedLockfileVersion", format: 42, minimumSupported: 3 }),
      "each field is checked independently: a wrong-typed format fails on that clause alone"
    );
    assert.isFalse(
      isUnsupportedLockfileVersion(
        Object.create({ _tag: "UnsupportedLockfileVersion", format: "npm", minimumSupported: 3 })
      ),
      "a tag inherited from the prototype is not this record; the discriminant is read as an own property"
    );
    assert.isFalse(
      isUnsupportedLockfileVersion({ _tag: "UnsupportedLockfileVersion", format: "npm", minimumSupported: 3 }),
      "a matching tag, format and minimum do not justify narrowing unchecked lockfileVersion and message fields"
    );
    assert.isTrue(
      isUnsupportedLockfileVersion({
        _tag: "UnsupportedLockfileVersion",
        format: "npm",
        lockfileVersion: 2,
        minimumSupported: 3,
        message: "…",
      })
    );
  });

  it("rejects missing fields, wrong field types and formats outside the gated domain", () => {
    const valid = {
      _tag: "UnsupportedLockfileVersion",
      format: "npm",
      lockfileVersion: 2,
      minimumSupported: 3,
      message: "too old",
    };
    for (const incomplete of [
      { format: "npm", lockfileVersion: 2, minimumSupported: 3, message: "too old" },
      { _tag: "UnsupportedLockfileVersion", lockfileVersion: 2, minimumSupported: 3, message: "too old" },
      { _tag: "UnsupportedLockfileVersion", format: "npm", minimumSupported: 3, message: "too old" },
      { _tag: "UnsupportedLockfileVersion", format: "npm", lockfileVersion: 2, message: "too old" },
      { _tag: "UnsupportedLockfileVersion", format: "npm", lockfileVersion: 2, minimumSupported: 3 },
    ])
      assert.isFalse(isUnsupportedLockfileVersion(incomplete));
    for (const malformed of [
      { ...valid, format: "yarn" },
      { ...valid, format: "bun" },
      { ...valid, format: "unknown" },
      { ...valid, format: 3 },
      { ...valid, lockfileVersion: null },
      { ...valid, lockfileVersion: {} },
      { ...valid, lockfileVersion: undefined },
      { ...valid, minimumSupported: "3" },
      { ...valid, message: 3 },
      { ...valid, message: undefined },
    ])
      assert.isFalse(isUnsupportedLockfileVersion(malformed));
    assert.isFalse(isUnsupportedLockfileVersion(Object.create(valid)));
  });

  it("accepts complete structural and class causes for both gated formats", () => {
    const npm = {
      _tag: "UnsupportedLockfileVersion",
      format: "npm",
      lockfileVersion: 2,
      minimumSupported: 3,
      message: "too old",
    };
    const pnpm = { ...npm, format: "pnpm", lockfileVersion: "6.0", minimumSupported: 9 };
    assert.isTrue(isUnsupportedLockfileVersion(npm));
    assert.isTrue(isUnsupportedLockfileVersion(pnpm));
    assert.isTrue(isUnsupportedLockfileVersion(Object.assign(new Error("too old"), npm)));
    assert.isTrue(isUnsupportedLockfileVersion(Object.assign(new Error("too old"), pnpm)));
  });

  it.effect("pnpm: a pre-v9 lockfile fails typed at validation", () =>
    Effect.gen(function* () {
      const error = yield* failure("pnpm/unsupported-v6/pnpm-lock.yaml", "pnpm");
      assert.strictEqual(error._tag, "LockfileParseError");
      if (error._tag !== "LockfileParseError") return;
      assert.strictEqual(error.format, "pnpm");
      assert.strictEqual(error.stage, "validation", "validation, not framing: the document was located");
      const cause = error.cause;
      assertTrue(
        isUnsupportedLockfileVersion(cause),
        'the typed cause tells "too old" from "malformed" without parsing prose'
      );
      assert.strictEqual(cause._tag, "UnsupportedLockfileVersion");
      assert.strictEqual(cause.lockfileVersion, "6.0");
      assert.strictEqual(
        cause.minimumSupported,
        9,
        "the gate is on the lockfile format version, the only version a lockfile records; older input fails typed rather than parsing into a model that cannot answer resolution questions"
      );
    })
  );

  it.effect("npm: a lockfileVersion 2 lockfile fails typed at validation", () =>
    Effect.gen(function* () {
      const error = yield* failure("npm/unsupported-v2/package-lock.json", "npm");
      assert.strictEqual(error._tag, "LockfileParseError");
      if (error._tag !== "LockfileParseError") return;
      assert.strictEqual(error.format, "npm");
      assert.strictEqual(error.stage, "validation");
      const cause = error.cause;
      assertTrue(isUnsupportedLockfileVersion(cause));
      assert.strictEqual(cause._tag, "UnsupportedLockfileVersion");
      assert.strictEqual(cause.lockfileVersion, 2);
      assert.strictEqual(cause.minimumSupported, 3);
    })
  );

  it.effect("npm: a lockfileVersion 1 lockfile fails as TOO OLD, not as malformed", () =>
    Effect.gen(function* () {
      const error = yield* failure("npm/unsupported-v1/package-lock.json", "npm");
      assert.strictEqual(error._tag, "LockfileParseError");
      if (error._tag !== "LockfileParseError") return;
      assert.strictEqual(error.format, "npm");
      assert.strictEqual(error.stage, "validation");
      assert.isTrue(
        isUnsupportedLockfileVersion(error.cause),
        "v1 has no packages object, so a gate after the shape decode would report it malformed like a corrupt file"
      );
      if (!isUnsupportedLockfileVersion(error.cause)) return;
      assert.strictEqual(error.cause.lockfileVersion, 1);
      assert.strictEqual(error.cause.minimumSupported, 3);
    })
  );

  it.effect("pnpm: a pre-v9 SINGLE-PROJECT lockfile fails as too old, not as malformed", () =>
    Effect.gen(function* () {
      const error = yield* failure("pnpm/unsupported-v6-single/pnpm-lock.yaml", "pnpm");
      assert.strictEqual(error._tag, "LockfileParseError");
      if (error._tag !== "LockfileParseError") return;
      assert.strictEqual(error.format, "pnpm");
      assert.strictEqual(error.stage, "validation");
      assert.isTrue(
        isUnsupportedLockfileVersion(error.cause),
        "with no importers map the gate must read the version before the shape decode; workspace-shaped unsupported-v6 decodes fine"
      );
      if (!isUnsupportedLockfileVersion(error.cause)) return;
      assert.strictEqual(error.cause.lockfileVersion, "6.0");
      assert.strictEqual(error.cause.minimumSupported, 9);
    })
  );

  it.effect("a supported lockfile with a broken shape still fails as MALFORMED", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Lockfile.parse("lockfileVersion: '9.0'\nimporters: 7\n", { format: "pnpm" }));
      assert.strictEqual(error._tag, "LockfileParseError");
      if (error._tag !== "LockfileParseError") return;
      assert.strictEqual(error.stage, "validation");
      assert.isFalse(
        isUnsupportedLockfileVersion(error.cause),
        "reading the version first must not turn a v9 shape failure into a version failure"
      );
    })
  );

  it.effect("the gate is on version, not on emptiness or content", () =>
    Effect.gen(function* () {
      const empty = yield* Lockfile.parse(fixture("pnpm/emptysnapshots/pnpm-lock.yaml"), { format: "pnpm" });
      assert.isAbove(
        empty.packages.length,
        0,
        "a v9 document with an empty snapshots: map is valid; an emptiness guard would reject it"
      );
      const full = yield* Lockfile.parse(fixture("pnpm/v3/pnpm-lock.yaml"), { format: "pnpm" });
      assert.isAbove(full.packages.length, 0, "the populated v9 twin an emptiness guard would pass");
    })
  );

  it.effect("every non-negative fixture sits at or above its format's gate", () =>
    Effect.gen(function* () {
      const gated = { pnpm: 9, npm: 3 } as const;
      const checked: Array<string> = [];
      const checkedConfigOnly: Array<string> = [];

      for (const [format, minimum] of R.toEntries(gated)) {
        for (const fixtureSet of positiveFixtureSets(format)) {
          const relative = `${format}/${fixtureSet}/${filenameFor(format)}`;
          const configOnly = format === "pnpm" && Str.startsWith(CONFIG_ONLY_FIXTURE_PREFIX)(fixtureSet);
          const version = yield* gatedVersion(relative, format, configOnly);
          assert.isAtLeast(
            Number.parseFloat(version),
            minimum,
            `${relative} sits below the gate: only an unsupported-* set may, and that prefix is the sole exclusion`
          );
          checked.push(relative);
          if (configOnly) checkedConfigOnly.push(relative);
        }
      }

      assert.isAtLeast(
        checked.length,
        12,
        `enumerated too few fixtures; the guard enumerates the corpus so new fixtures are covered, and a mistyped directory must not make it vacuous: ${A.join(checked, ", ")}`
      );
      assert.isAtLeast(
        checkedConfigOnly.length,
        2,
        `marked too few config-only fixtures; only env-configonly-* sets (captured with no root package.json) parse with configOnly: ${A.join(checked, ", ")}`
      );
    })
  );
});
