import { peerDeclarations } from "@beep/lockfiles/internal/shared";
import { Lockfile } from "@beep/lockfiles/Lockfile";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { fixture } from "./support/fixtures.ts";
import type { LockfileFormat } from "@beep/lockfiles/LockfileFormat";

const parseFixture = (relative: string, format: LockfileFormat) => Lockfile.parse(fixture(relative), { format });

describe("Lockfile.importers", () => {
  describe("pnpm", () => {
    it.effect("v1: importer dependencies carry both specifier and version", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/v1/pnpm-lock.yaml", "pnpm");

        const emptyRoot = lockfile.importer(".");
        assertSome(
          O.map(emptyRoot, (importer) => importer.dependencies.length),
          0
        );
        assert.strictEqual(O.getOrThrow(emptyRoot).dependencies.length, 0);

        const core = O.getOrThrow(lockfile.importer("packages/core"));
        assert.strictEqual(core.path, "packages/core");
        assert.strictEqual(core.dependencies.length, 3, "2 dependencies + 1 devDependency");

        const lodash = O.getOrThrow(core.dependency("lodash"));
        assert.strictEqual(lodash.specifier.raw, "4.17.21");
        assert.strictEqual(lodash.specifier._tag, "range");
        assert.strictEqual(lodash.version, "4.17.21");
        assert.strictEqual(lodash.depType, "dependencies");

        const utils = O.getOrThrow(core.dependency("@test-monorepo/utils"));
        assert.strictEqual(utils.specifier.raw, "workspace:*");
        assert.strictEqual(utils.specifier._tag, "workspace");
        assert.strictEqual(utils.version, "link:../utils");

        const ts = O.getOrThrow(core.dependency("typescript"));
        assert.strictEqual(ts.depType, "devDependencies");
        assert.strictEqual(ts.version, "5.9.3");
      })
    );

    it.effect("v3: a `catalog:` specifier classifies as catalog and round-trips its raw", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/v3/pnpm-lock.yaml", "pnpm");
        const core = O.getOrThrow(lockfile.importer("packages/core"));
        const lodash = O.getOrThrow(core.dependency("lodash"));
        assert.strictEqual(lodash.specifier._tag, "catalog");
        assert.strictEqual(lodash.specifier.raw, "catalog:");
        assert.strictEqual(lodash.version, "4.17.23");
      })
    );

    it.effect("v2: a peer-suffixed version splits into a plain version and peerSuffix", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("pnpm/v2/pnpm-lock.yaml", "pnpm");
        const utils = O.getOrThrow(lockfile.importer("packages/utils"));
        const platform = O.getOrThrow(utils.dependency("@effect/platform"));
        assert.strictEqual(platform.version, "0.96.0");
        assert.strictEqual(platform.peerSuffix, "(effect@3.21.0)");
      })
    );

    it.effect("peer-disambiguation suffixes split off; link:/file: resolutions pass through verbatim", () =>
      Effect.gen(function* () {
        const nestedPeerSuffixDocument = A.join(
          [
            "lockfileVersion: '9.0'",
            "importers:",
            "  .:",
            "    dependencies:",
            "      '@effect/experimental':",
            "        specifier: 4.0.0-beta.101",
            "        version: 4.0.0-beta.101(effect@4.0.0-beta.101)(ioredis@5.11.1(supports-color@8.1.1))",
            "      effect:",
            "        specifier: 4.0.0-beta.101",
            "        version: 4.0.0-beta.101",
            "      '@local/utils':",
            "        specifier: workspace:*",
            "        version: link:packages/utils",
            "      vendored:",
            "        specifier: file:vendor/vendored",
            "        version: file:vendor/vendored",
            "",
          ],
          "\n"
        );
        const lockfile = yield* Lockfile.parse(nestedPeerSuffixDocument, { format: "pnpm" });
        const root = O.getOrThrow(lockfile.importer("."));

        const experimental = O.getOrThrow(root.dependency("@effect/experimental"));
        assert.strictEqual(experimental.version, "4.0.0-beta.101");
        assert.strictEqual(experimental.peerSuffix, "(effect@4.0.0-beta.101)(ioredis@5.11.1(supports-color@8.1.1))");

        const effect = O.getOrThrow(root.dependency("effect"));
        assert.strictEqual(effect.version, "4.0.0-beta.101");
        assert.isFalse(P.hasProperty(effect, "peerSuffix"), "a suffix-free entry records no peerSuffix key");

        const linked = O.getOrThrow(root.dependency("@local/utils"));
        assert.strictEqual(linked.version, "link:packages/utils", "a non-version resolution passes through untouched");
        assert.isFalse(P.hasProperty(linked, "peerSuffix"));

        const vendored = O.getOrThrow(root.dependency("vendored"));
        assert.strictEqual(vendored.version, "file:vendor/vendored");
        assert.isFalse(P.hasProperty(vendored, "peerSuffix"));
      })
    );
  });

  describe("bun", () => {
    it.effect("v1: importer dependencies carry a specifier and no version", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("bun/v1/bun.lock", "bun");

        const root = O.getOrThrow(lockfile.importer("."));
        assert.strictEqual(root.dependencies.length, 0, 'the root workspace ("") becomes the "." importer');

        const core = O.getOrThrow(lockfile.importer("packages/core"));
        assert.strictEqual(core.dependencies.length, 4, "3 dependencies + 1 devDependency");
        assert.isTrue(
          A.every(core.dependencies, (d) => d.version === undefined),
          "bun records a specifier only; the resolved version lives on package entries"
        );

        const react = O.getOrThrow(core.dependency("react"));
        assert.strictEqual(react.specifier._tag, "catalog");
        assert.strictEqual(react.specifier.raw, "catalog:");
      })
    );
  });

  describe("npm", () => {
    it.effect("v2: root and workspace importers carry a specifier and no version", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("npm/v2/package-lock.json", "npm");

        const root = O.getOrThrow(lockfile.importer("."));
        const ts = O.getOrThrow(root.dependency("typescript"));
        assert.strictEqual(ts.depType, "devDependencies");
        assert.strictEqual(ts.specifier.raw, "^5.3.0");
        assert.strictEqual(ts.version, undefined);

        const core = O.getOrThrow(lockfile.importer("packages/core"));
        assert.strictEqual(core.dependencies.length, 5, "3 dependencies + 1 peerDependency + 1 optionalDependency");
        assert.isTrue(
          A.every(core.dependencies, (d) => d.version === undefined),
          "npm records a specifier only; the resolved version lives on package entries"
        );
        assert.strictEqual(O.getOrThrow(core.dependency("react")).depType, "peerDependencies");
        assert.strictEqual(O.getOrThrow(core.dependency("fsevents")).depType, "optionalDependencies");
      })
    );
  });

  describe("yarn", () => {
    it.effect("v1: records no importers", () =>
      Effect.gen(function* () {
        const lockfile = yield* parseFixture("yarn/v1/yarn.lock", "yarn");
        assert.strictEqual(lockfile.importers.length, 0);
        assertNone(lockfile.importer("."));
      })
    );
  });

  it.effect("importer(path) is None for an unknown path", () =>
    Effect.gen(function* () {
      const lockfile = yield* parseFixture("pnpm/v1/pnpm-lock.yaml", "pnpm");
      assertNone(lockfile.importer("packages/does-not-exist"));
    })
  );
});

describe("peerDeclarations dual helper", () => {
  it("three arguments return the normalized record, including explicit undefined metadata", () => {
    assert.deepEqual(peerDeclarations({ react: "^18" }, undefined, undefined), {
      peerDependencies: { react: "^18" },
      peerDependenciesMeta: {},
    });
    assert.deepEqual(peerDeclarations(undefined, { react: { optional: true } }, undefined), {
      peerDependencies: {},
      peerDependenciesMeta: { react: { optional: true } },
    });
    assert.deepEqual(peerDeclarations(undefined, undefined, undefined), {
      peerDependencies: {},
      peerDependenciesMeta: {},
    });
  });

  it("data-last calls normalize optional metadata and bun overrides", () => {
    assert.deepEqual(pipe({ react: "^18" }, peerDeclarations(undefined, undefined)), {
      peerDependencies: { react: "^18" },
      peerDependenciesMeta: {},
    });
    assert.deepEqual(pipe(undefined, peerDeclarations(undefined, undefined)), {
      peerDependencies: {},
      peerDependenciesMeta: {},
    });
    assert.deepEqual(pipe({ react: "^18" }, peerDeclarations({ react: { optional: false } }, ["react"])), {
      peerDependencies: { react: "^18" },
      peerDependenciesMeta: { react: { optional: true } },
    });
  });

  it("an explicit undefined optionalPeers argument preserves metadata and range records", () => {
    assert.deepEqual(peerDeclarations({ react: "^18" }, { react: { optional: true }, vue: {} }, undefined), {
      peerDependencies: { react: "^18" },
      peerDependenciesMeta: { react: { optional: true }, vue: { optional: false } },
    });
  });

  it("bun optional peer names override metadata flags while preserving first-seen key order", () => {
    const result = peerDeclarations({ react: "^18" }, { react: { optional: false }, vue: {} }, [
      "vue",
      "react",
      "svelte",
      "vue",
    ]);
    assert.deepEqual(result.peerDependencies, { react: "^18" });
    assert.deepEqual(R.toEntries(result.peerDependenciesMeta), [
      ["react", { optional: true }],
      ["vue", { optional: true }],
      ["svelte", { optional: true }],
    ]);
  });
});
