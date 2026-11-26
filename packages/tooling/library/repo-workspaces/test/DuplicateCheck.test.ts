import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Lockfile } from "@beep/lockfiles";
import { DuplicateCheck, DuplicatedPackage } from "@beep/repo-workspaces/DuplicateCheck";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { fixture } from "./support/fixtureText.ts";
import type { Dependent } from "@beep/repo-workspaces/DuplicateCheck";

const parse = (dir: string) => Lockfile.parse(fixture(`duplicates/${dir}/pnpm-lock.yaml`), { format: "pnpm" });

const render = (dependent: Dependent): string =>
  dependent._tag === "importer" ? `importer:${dependent.path}` : `package:${dependent.name}@${dependent.version}`;

const flatten = (row: DuplicatedPackage): Record<string, Record<string, ReadonlyArray<string>>> =>
  R.fromEntries(
    A.map(row.versions, (version) => [
      version.version,
      R.fromEntries(A.map(version.instances, (instance) => [instance.instanceId, A.map(instance.dependents, render)])),
    ])
  );

const byName = (report: DuplicateCheck, name: string): DuplicatedPackage | undefined =>
  O.getOrUndefined(A.findFirst(report.duplicates, (row) => row.name === name));

describe("DuplicateCheck.run, a pure value over hand-authored lockfiles with no oracle (#603), each differing from its neighbour in one way", () => {
  for (const [label, secondVersion] of [
    ["embedded-NUL collision", "y\0z"],
    ["non-collision control", "yz"],
  ] as const) {
    it.effect(`keeps distinct package dependents in first-occurrence order: ${label}`, () =>
      Effect.gen(function* () {
        const first = { _tag: "package", name: "x\0y", version: "z" } as const;
        const second = { _tag: "package", name: "x", version: secondVersion } as const;
        const lockfile = yield* S.decodeEffect(Lockfile)({
          format: "pnpm",
          lockfileVersion: "9",
          workspaceDependencies: [],
          packages: [
            {
              name: "app",
              version: "1",
              instanceId: "app",
              isWorkspace: true,
              relativePath: ".",
              resolved: { first: "holder-first", second: "holder-second", again: "holder-again", foo: "foo@2" },
            },
            {
              name: first.name,
              version: first.version,
              instanceId: "holder-first",
              isWorkspace: false,
              resolved: { foo: "foo@1", alias: "foo@1" },
            },
            {
              name: second.name,
              version: second.version,
              instanceId: "holder-second",
              isWorkspace: false,
              resolved: { foo: "foo@1", alias: "foo@1" },
            },
            {
              name: first.name,
              version: first.version,
              instanceId: "holder-again",
              isWorkspace: false,
              resolved: { foo: "foo@1" },
            },
            { name: "foo", version: "1", instanceId: "foo@1", isWorkspace: false },
            { name: "foo", version: "2", instanceId: "foo@2", isWorkspace: false },
          ],
          importers: [{ path: ".", dependencies: [] }],
        });
        const foo = byName(DuplicateCheck.run(lockfile), "foo");
        if (foo === undefined) return assert.fail("expected foo in collision report");
        assert.deepStrictEqual(
          A.flatMap(foo.versions, (version) =>
            A.map(version.instances, (instance) => [instance.instanceId, instance.dependents])
          ),
          [
            ["foo@1", [first, second]],
            ["foo@2", [{ _tag: "importer", path: "." }]],
          ]
        );
        assert.deepStrictEqual(DuplicateCheck.run(lockfile).unresolvedImporters, []);
      })
    );
  }

  it.effect("keeps target ids separate from importer paths containing embedded NULs", () =>
    Effect.gen(function* () {
      for (const secondId of ["foo\0importer\0tail", "other-target"]) {
        const firstPath = "tail\0importer\0path";
        const secondPath = "path";
        const lockfile = yield* S.decodeEffect(Lockfile)({
          format: "pnpm",
          lockfileVersion: "9",
          workspaceDependencies: [],
          packages: [
            {
              name: "app-first",
              version: "1",
              instanceId: "app-first",
              isWorkspace: true,
              relativePath: firstPath,
              resolved: { foo: "foo", alias: "foo" },
            },
            {
              name: "app-second",
              version: "1",
              instanceId: "app-second",
              isWorkspace: true,
              relativePath: secondPath,
              resolved: { foo: secondId, alias: secondId },
            },
            { name: "foo", version: "1", instanceId: "foo", isWorkspace: false },
            { name: "foo", version: "2", instanceId: secondId, isWorkspace: false },
          ],
          importers: [
            { path: firstPath, dependencies: [] },
            { path: secondPath, dependencies: [] },
          ],
        });
        const foo = byName(DuplicateCheck.run(lockfile), "foo");
        if (foo === undefined) return assert.fail("expected foo in target-id collision report");
        assert.deepStrictEqual(
          A.flatMap(foo.versions, (version) =>
            A.map(version.instances, (instance) => [instance.instanceId, instance.dependents])
          ),
          [
            ["foo", [{ _tag: "importer", path: firstPath }]],
            [secondId, [{ _tag: "importer", path: secondPath }]],
          ]
        );
        assert.deepStrictEqual(DuplicateCheck.run(lockfile).unresolvedImporters, []);
      }
    })
  );

  it.effect("preserves provenance, deduplication and importer order on sparse roots", () =>
    Effect.gen(function* () {
      const packages = A.makeBy(160, (i) => ({
        name: `isolated-${i}`,
        version: "1.0.0",
        instanceId: `isolated-${i}@1.0.0`,
        isWorkspace: false,
      }));
      const importers = A.makeBy(160, (i) => ({
        path: `packages/isolated-${i}`,
        dependencies: [{ name: `isolated-${i}`, specifier: "1.0.0", version: "1.0.0", depType: "dependencies" }],
      }));
      const sparse = yield* S.decodeUnknownEffect(Lockfile)({
        format: "pnpm",
        lockfileVersion: "9",
        workspaceDependencies: [],
        packages,
        importers,
      });
      const clean = DuplicateCheck.run(sparse);
      assert.deepStrictEqual(clean.duplicates, []);
      assert.deepStrictEqual(clean.unresolvedImporters, []);
      assert.isTrue(clean.isClean);

      const first = { name: "shared", specifier: "1.0.0", version: "1.0.0", depType: "dependencies" };
      const second = { name: "shared", specifier: "2.0.0", version: "2.0.0", depType: "dependencies" };
      const variant = { ...first, peerSuffix: "(peer@1.0.0)" };
      const lockfile = yield* S.decodeUnknownEffect(Lockfile)({
        format: "pnpm",
        lockfileVersion: "9",
        workspaceDependencies: [],
        packages: [
          ...packages,
          { name: "shared", version: "2.0.0", instanceId: "shared@2.0.0", isWorkspace: false },
          { name: "shared", version: "1.0.0", instanceId: "shared@1.0.0", isWorkspace: false },
          { name: "shared", version: "1.0.0", instanceId: "shared@1.0.0(peer@1.0.0)", isWorkspace: false },
          {
            name: "holder",
            version: "1.0.0",
            instanceId: "holder@1.0.0",
            isWorkspace: false,
            resolved: { shared: "shared@1.0.0", alias: "shared@1.0.0" },
          },
        ],
        importers: [
          { path: "packages/z", dependencies: [first, first, variant] },
          ...importers,
          {
            path: "packages/a",
            dependencies: [
              second,
              first,
              { name: "holder", specifier: "1.0.0", version: "1.0.0", depType: "dependencies" },
            ],
          },
          { path: "packages/m", dependencies: [variant, second, first] },
          { path: "packages/unresolved", dependencies: [{ ...first, version: "3.0.0" }] },
        ],
      });
      const report = DuplicateCheck.run(lockfile);
      assert.deepStrictEqual(
        A.map(report.duplicates, (row) => row.name),
        ["shared"]
      );
      assert.deepStrictEqual(report.unresolvedImporters, ["packages/unresolved"]);
      assert.isFalse(report.isClean);
      const shared = byName(report, "shared");
      if (shared === undefined) return assert.fail("expected shared in sparse duplicate report");
      assert.deepStrictEqual(
        A.map(shared.versions, (version) => version.version),
        ["2.0.0", "1.0.0"]
      );
      assert.deepStrictEqual(flatten(shared), {
        "2.0.0": { "shared@2.0.0": ["importer:packages/a", "importer:packages/m"] },
        "1.0.0": {
          "shared@1.0.0": ["importer:packages/z", "importer:packages/a", "importer:packages/m", "package:holder@1.0.0"],
          "shared@1.0.0(peer@1.0.0)": ["importer:packages/z", "importer:packages/m"],
        },
      });
    })
  );

  it.effect("reproduces issue #298: two copies of @effected/commands, each naming the package that pulls it", () =>
    Effect.gen(function* () {
      const parsed1 = yield* parse("kit-skew");
      const report = DuplicateCheck.run(parsed1);

      assert.isFalse(report.isClean);
      assert.deepStrictEqual(report.unresolvedImporters, []);
      assert.deepStrictEqual(
        A.map(report.duplicates, (row) => row.name),
        ["@effected/commands"]
      );

      const commands = byName(report, "@effected/commands");
      assert.isDefined(commands);
      if (commands === undefined) return assert.fail("expected commands in duplicate report");
      assert.deepStrictEqual(
        flatten(commands),
        {
          "0.2.1": { "@effected/commands@0.2.1": ["package:@effected/npm@0.8.2"] },
          "0.3.1": { "@effected/commands@0.3.1": ["package:@effected/workspaces@0.10.1"] },
        },
        "which versions, and who holds each: the never-bumped @effected/npm is why nobody suspected it"
      );
    })
  );

  it.effect("is clean once the same graph deduplicates to one version", () =>
    Effect.gen(function* () {
      const kitSkewAfterTheOnePnpmUpdateTheFixNeeded = yield* parse("kit-deduped");
      const report = DuplicateCheck.run(kitSkewAfterTheOnePnpmUpdateTheFixNeeded);

      assert.deepStrictEqual(report.duplicates, []);
      assert.isTrue(report.isClean);
      assert.deepStrictEqual(report.unresolvedImporters, []);
    })
  );

  it.effect("does not call two peer-suffix instances of ONE version a duplicate", () =>
    Effect.gen(function* () {
      const fooOnceWithAndOnceWithoutItsOptionalPeer = yield* parse("peer-variants");
      const report = DuplicateCheck.run(fooOnceWithAndOnceWithoutItsOptionalPeer);

      assert.deepStrictEqual(
        report.duplicates,
        [],
        "one version loads identical code, so it cannot skew types; counting instances would report it"
      );
      assert.isTrue(report.isClean);
    })
  );

  it.effect("lists both instances under their version once a second version makes the name a duplicate", () =>
    Effect.gen(function* () {
      const parsed4 = yield* parse("peer-variants-skew");
      const report = DuplicateCheck.run(parsed4);

      assert.isFalse(report.isClean);
      assert.deepStrictEqual(
        A.map(report.duplicates, (row) => row.name),
        ["foo"]
      );
      const foo = byName(report, "foo");
      assert.isDefined(foo);
      assert.strictEqual(foo?.versions.length, 2);
      if (foo === undefined) return assert.fail("expected foo in duplicate report");
      assert.deepStrictEqual(
        flatten(foo),
        {
          "1.0.0": {
            "foo@1.0.0": ["importer:packages/other"],
            "foo@1.0.0(bar@1.0.0)": ["importer:."],
          },
          "2.0.0": { "foo@2.0.0": ["importer:packages/third"] },
        },
        "a third importer's foo@2.0.0 makes a skew; the 1.0.0 row keeps both instances, the peer variant attributed to its own importer"
      );
    })
  );

  it.effect("`names` narrows what is REPORTED, never what is walked", () =>
    Effect.gen(function* () {
      const parsed5 = yield* parse("filtered");
      const unfiltered = DuplicateCheck.run(parsed5);
      assert.deepStrictEqual(
        A.map(unfiltered.duplicates, (row) => row.name),
        ["@effected/commands", "semver"]
      );

      const parsed6 = yield* parse("filtered");
      const kit = DuplicateCheck.run(parsed6, { names: DuplicateCheck.kit });
      assert.deepStrictEqual(
        A.map(kit.duplicates, (row) => row.name),
        ["@effected/commands"]
      );
      assert.isFalse(kit.isClean);
      const commands = byName(kit, "@effected/commands");
      if (commands === undefined) return assert.fail("expected commands in duplicate report");
      assert.deepStrictEqual(
        flatten(commands),
        {
          "0.2.1": { "@effected/commands@0.2.1": ["package:@savvy-web/silk-effects@6.0.4"] },
          "0.3.1": { "@effected/commands@0.3.1": ["package:@effected/workspaces@0.10.1"] },
        },
        "the filtered-out non-kit @savvy-web/silk-effects still stands as the culprit pulling the stale copy (#603)"
      );

      const parsed7 = yield* parse("filtered");
      const nothing = DuplicateCheck.run(parsed7, { names: (name) => name === "left-pad" });
      assert.deepStrictEqual(nothing.duplicates, []);
      assert.isTrue(nothing.isClean, "isClean answers for the names asked about, not for the whole graph");
    })
  );

  it("`kit` names effect and every @effected/* package, and nothing else", () => {
    assert.isTrue(DuplicateCheck.kit("effect"));
    assert.isTrue(DuplicateCheck.kit("@effected/commands"));
    assert.isTrue(DuplicateCheck.kit("@effected/git"));
    assert.isFalse(DuplicateCheck.kit("@effect/vitest"), "the kit is effect exactly, not every name with the prefix");
    assert.isFalse(DuplicateCheck.kit("effect-utils"), "effect-* lookalikes are not names a consumer asked about");
    assert.isFalse(DuplicateCheck.kit("@effected"));
    assert.isFalse(DuplicateCheck.kit("@savvy-web/silk-effects"));
    assert.isFalse(DuplicateCheck.kit("semver"));
  });

  it.effect("attributes a copy taken by a non-root importer to that importer's path", () =>
    Effect.gen(function* () {
      const parsed8 = yield* parse("other-importer");
      const report = DuplicateCheck.run(parsed8);

      assert.isFalse(report.isClean);
      const commands = byName(report, "@effected/commands");
      if (commands === undefined) return assert.fail("expected commands in duplicate report");
      assert.deepStrictEqual(
        flatten(commands),
        {
          "0.2.1": { "@effected/commands@0.2.1": ["package:@effected/npm@0.8.2"] },
          "0.3.1": { "@effected/commands@0.3.1": ["importer:packages/app"] },
        },
        "a pnpm workspace row's edges are the importer's own, so the dependent is the importer by path, never a 0.0.0 placeholder package row"
      );
    })
  );

  it.effect("names the importers it could not resolve, exactly as PeerCheck does", () =>
    Effect.gen(function* () {
      const parsed9 = yield* Lockfile.parse(fixture("peers/npm-root/package-lock.json"), { format: "npm" });
      const npm = DuplicateCheck.run(parsed9);
      assert.include(
        npm.unresolvedImporters,
        ".",
        "npm records no resolved root-importer version and no root row, so the root is reported, not passed silently"
      );

      const parsed10 = yield* Lockfile.parse(fixture("peers/mixed/pnpm-lock.yaml"), { format: "pnpm" });
      const pnpm = DuplicateCheck.run(parsed10);
      assert.deepStrictEqual(pnpm.unresolvedImporters, [], "pnpm records the version and is unaffected");

      const parsed11 = yield* Lockfile.parse(fixture("peers/npm/package-lock.json"), { format: "npm" });
      const rootless = DuplicateCheck.run(parsed11);
      assert.deepStrictEqual(
        rootless.unresolvedImporters,
        [],
        "a root with no dependencies has nothing to fail to resolve"
      );
    })
  );

  it.effect(
    "finds the skew PeerCheck's own real-pnpm root-importer fixture carries: react at two versions, not react-dom twice by peer suffix",
    () =>
      Effect.gen(function* () {
        const parsed12 = yield* Lockfile.parse(fixture("peers/rootimporter/pnpm-lock.yaml"), { format: "pnpm" });
        const report = DuplicateCheck.run(parsed12);

        assert.deepStrictEqual(
          A.map(report.duplicates, (row) => row.name),
          ["react"]
        );
        const react = byName(report, "react");
        if (react === undefined) return assert.fail("expected react in duplicate report");
        assert.deepStrictEqual(flatten(react), {
          "17.0.2": { "react@17.0.2": ["importer:.", "package:react-dom@18.3.1"] },
          "18.3.1": { "react@18.3.1": ["importer:packages/other", "package:react-dom@18.3.1"] },
        });
      })
  );
});

it.effect.prop(
  "a duplicated package generated from its schema survives an encode/decode round trip",
  [Arbitrary.schema(DuplicatedPackage)],
  ([value]) =>
    Effect.gen(function* () {
      const argument = S.decodeEffect(DuplicatedPackage);
      const value1 = yield* S.encodeEffect(DuplicatedPackage)(value);
      const decoded = yield* argument(value1);
      assert.isTrue(S.toEquivalence(DuplicatedPackage)(decoded, value));
    }),
  { arbitrary: fcRuns(50) }
);
