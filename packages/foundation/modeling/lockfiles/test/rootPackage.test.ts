import { Lockfile } from "@beep/lockfiles/Lockfile";
import { PnpmExtension } from "@beep/lockfiles/PnpmExtension";
import { ResolvedPackage } from "@beep/lockfiles/ResolvedPackage";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { fixture } from "./support/fixtures.ts";
import type { LockfileFormat } from "@beep/lockfiles/LockfileFormat";

const parseFixture = (relative: string, format: LockfileFormat) => Lockfile.parse(fixture(relative), { format });

const versionOf = (pkg: O.Option<ResolvedPackage>): O.Option<string> => O.map(pkg, (resolved) => resolved.version);

const ALIASED_BUN = `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "alias-root", "dependencies": { "string-width-cjs": "npm:string-width@^4.2.0" } } },
  "packages": {
    "string-width": ["string-width@5.1.2", "", {}],
    "string-width-cjs": ["string-width@4.2.3", "", {}],
    "string-width-cjs/@scope/inner": ["@scope/real@1.0.0", "", {}],
  }
}`;

const ALIASED_NPM = `{
  "name": "alias-root",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "alias-root",
      "version": "1.0.0",
      "dependencies": { "string-width": "^5.1.2", "string-width-cjs": "npm:string-width@^4.2.0" }
    },
    "node_modules/string-width": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-5.1.2.tgz",
      "integrity": "sha512-HnLOCR3vjcY8beoNLtcjZ5/nxn2afmME6lhrDrebokqMap+XbeW8n9TXpPDOqdGK5qcI3oT0GKTW6wC7EMiVqA==",
      "license": "MIT"
    },
    "node_modules/string-width-cjs": {
      "name": "string-width",
      "version": "4.2.3",
      "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
      "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
      "license": "MIT"
    }
  }
}`;

const SLASH_TERMINATED_KEY_BUN = `{
  "lockfileVersion": 1,
  "workspaces": { "": { "name": "malformed-root", "dependencies": { "string-width": "^5.1.2" } } },
  "packages": {
    "string-width": ["string-width@5.1.2", "", {}],
    "string-width/": ["string-width@4.2.3", "", {}],
  }
}`;

const PEERED_PNPM = `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      react:
        specifier: 18.3.1
        version: 18.3.1
      react-dom:
        specifier: 18.3.1
        version: 18.3.1(react@18.3.1)

packages:

  react@18.3.1:
    resolution: {tarball: https://example.test/react-18.3.1.tgz}

  react-dom@18.3.1:
    resolution: {tarball: https://example.test/react-dom-18.3.1.tgz}
    peerDependencies:
      react: ^18.3.1

snapshots:

  react@18.3.1: {}

  react-dom@18.3.1(react@18.3.1):
    dependencies:
      react: 18.3.1
`;

const LINKED_PNPM = `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      '@local/lib':
        specifier: workspace:*
        version: link:packages/lib
      react:
        specifier: 18.3.1
        version: 18.3.1

  packages/lib: {}

packages:

  react@18.3.1:
    resolution: {tarball: https://example.test/react-18.3.1.tgz}

snapshots:

  react@18.3.1: {}
`;

describe("Lockfile#rootPackage, read by the repo-cli RootCatalog and CatalogUsage commands", () => {
  it.effect("pnpm: root links resolve without optional publish-directory metadata", () =>
    Effect.gen(function* () {
      const parsed = yield* Lockfile.parse(LINKED_PNPM, { format: "pnpm" });
      const fields = {
        format: parsed.format,
        lockfileVersion: parsed.lockfileVersion,
        packages: parsed.packages,
        workspaceDependencies: parsed.workspaceDependencies,
        importers: parsed.importers,
      };
      for (const model of [Lockfile.make(fields), Lockfile.make({ ...fields, extension: PnpmExtension.make({}) })]) {
        assertSome(
          O.map(model.rootPackage("@local/lib"), (pkg) => pkg.instanceId),
          "packages/lib"
        );
      }
      const rootOnly = yield* Lockfile.parse(
        `lockfileVersion: '9.0'
importers:
  .:
    publishDirectory: dist
    dependencies:
      root:
        specifier: workspace:*
        version: link:dist
`,
        { format: "pnpm" }
      );
      assertNone(rootOnly.rootPackage("root"));
    })
  );

  it.effect("bun: the instance keyed by the bare install name, not a nested one", () =>
    Effect.gen(function* () {
      const lockfile = yield* parseFixture("bun/nested/bun.lock", "bun");
      assertSome(versionOf(lockfile.rootPackage("react")), "17.0.2");
      assertTrue(O.exists(lockfile.rootPackage("@nested/lib"), (pkg) => pkg.isWorkspace));
      assertNone(lockfile.rootPackage("absent"));
    })
  );

  it.effect("bun: an aliased install answers to its alias and keeps its real name", () =>
    Effect.gen(function* () {
      const lockfile = yield* Lockfile.parse(ALIASED_BUN, { format: "bun" });
      const aliased = O.getOrThrow(lockfile.rootPackage("string-width-cjs"));
      strictEqual(aliased.name, "string-width");
      strictEqual(aliased.version, "4.2.3");
      strictEqual(aliased.installName, "string-width-cjs");
      assertSome(versionOf(lockfile.rootPackage("string-width")), "5.1.2");
    })
  );

  it.effect("npm: the instance at node_modules/<name>", () =>
    Effect.gen(function* () {
      const lockfile = yield* parseFixture("npm/nested/package-lock.json", "npm");
      assertSome(
        O.map(lockfile.rootPackage("react"), (pkg) => pkg.instanceId),
        "node_modules/react"
      );
      assertNone(lockfile.rootPackage("absent"));
    })
  );

  it.effect("pnpm: the root importer's version composes the snapshot id, peer suffix included", () =>
    Effect.gen(function* () {
      const lockfile = yield* Lockfile.parse(PEERED_PNPM, { format: "pnpm" });
      assertSome(
        O.map(lockfile.rootPackage("react-dom"), (pkg) => pkg.instanceId),
        "react-dom@18.3.1(react@18.3.1)"
      );
      assertSome(versionOf(lockfile.rootPackage("react")), "18.3.1");
      assertNone(lockfile.rootPackage("absent"));
    })
  );

  it.effect("pnpm: an aliased root dependency resolves through its recorded <real>@<version>", () =>
    Effect.gen(function* () {
      const lockfile = yield* parseFixture("pnpm/alias/pnpm-lock.yaml", "pnpm");
      assertSome(versionOf(lockfile.rootPackage("glob")), "10.4.5");
      const aliased = O.getOrThrow(lockfile.rootPackage("semver-classic"));
      strictEqual(aliased.name, "semver");
      strictEqual(aliased.version, "7.6.3");
    })
  );

  it.effect("pnpm: root links use the same workspace and publish-directory resolution as importer edges", () =>
    Effect.gen(function* () {
      for (const [specifier, target, declaration, expected] of [
        ["workspace:*", "packages/lib/dist/dev/pkg", "", "packages/lib"],
        ["workspace:*", "packages/lib/nested/dist", "  packages/lib/nested: {}\n", "packages/lib/nested"],
        ["link:packages/lib/dist", "packages/lib/dist", "", undefined],
        ["link:build/lib", "build/lib", "    publishDirectory: ../../build/lib\n", "packages/lib"],
        ["workspace:*", "missing/dist", "", undefined],
      ] as const) {
        const content = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      '@local/lib':
        specifier: ${specifier}
        version: link:${target}
  packages/lib:
    dependencies: {}
${declaration}  packages/app:
    dependencies:
      '@local/lib':
        specifier: ${specifier}
        version: link:../../${target}
`;
        const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
        strictEqual(O.getOrUndefined(O.map(lockfile.rootPackage("@local/lib"), (pkg) => pkg.instanceId)), expected);
        const app = O.getOrThrow(lockfile.packageByInstanceId("packages/app"));
        strictEqual(O.getOrUndefined(R.get(app.resolved, "@local/lib")), expected);
      }
    })
  );

  it.effect("pnpm: a workspace root dependency recorded as link:<path> resolves the workspace", () =>
    Effect.gen(function* () {
      const lockfile = yield* Lockfile.parse(LINKED_PNPM, { format: "pnpm" });
      const linked = O.getOrThrow(lockfile.rootPackage("@local/lib"));
      strictEqual(linked.instanceId, "packages/lib");
      assertTrue(linked.isWorkspace);
      for (const target of ["./packages/lib", "packages/other/../lib"]) {
        const normalized = yield* Lockfile.parse(Str.replace("link:packages/lib", `link:${target}`)(LINKED_PNPM), {
          format: "pnpm",
        });
        assertSome(
          O.map(normalized.rootPackage("@local/lib"), (pkg) => pkg.instanceId),
          "packages/lib"
        );
      }
      for (const target of ["packages/absent", "../packages/lib", "."]) {
        const missing = yield* Lockfile.parse(Str.replace("link:packages/lib", `link:${target}`)(LINKED_PNPM), {
          format: "pnpm",
        });
        assertNone(missing.rootPackage("@local/lib"));
      }
      assertSome(versionOf(lockfile.rootPackage("react")), "18.3.1");
    })
  );

  it.effect("yarn: no importers, so no root resolution", () =>
    Effect.gen(function* () {
      const lockfile = yield* parseFixture("yarn/v1/yarn.lock", "yarn");
      assertTrue(A.isReadonlyArrayNonEmpty(lockfile.packages));
      assertNone(lockfile.rootPackage(O.getOrThrow(A.head(lockfile.packages)).name));
    })
  );
});

describe("ResolvedPackage#installName, the alias-aware name the bun and npm parsers record", () => {
  it.effect("bun records an alias only where the install name differs from the real name", () =>
    Effect.gen(function* () {
      const lockfile = yield* Lockfile.parse(ALIASED_BUN, { format: "bun" });
      const byInstance = (id: string) => O.getOrThrow(lockfile.packageByInstanceId(id));
      strictEqual(byInstance("string-width").alias, undefined);
      strictEqual(byInstance("string-width").installName, "string-width");
      strictEqual(byInstance("string-width-cjs").alias, "string-width-cjs");
      strictEqual(
        byInstance("string-width-cjs/@scope/inner").installName,
        "@scope/inner",
        "a nested scoped install keeps both scope segments of its install name"
      );
      strictEqual(byInstance("string-width-cjs/@scope/inner").name, "@scope/real");
    })
  );

  it.effect("bun skips a row whose key ends in a slash instead of failing the parse", () =>
    Effect.gen(function* () {
      const lockfile = yield* Lockfile.parse(SLASH_TERMINATED_KEY_BUN, { format: "bun" });
      deepStrictEqual(
        A.map(lockfile.packages, (pkg) => pkg.instanceId),
        ["string-width"]
      );
      assertNone(lockfile.packageByInstanceId("string-width/"));
      strictEqual(O.getOrThrow(lockfile.rootPackage("string-width")).installName, "string-width");
    })
  );

  it.effect("npm records an alias where the entry's recorded name differs from its install position", () =>
    Effect.gen(function* () {
      const lockfile = yield* Lockfile.parse(ALIASED_NPM, { format: "npm" });
      const plain = O.getOrThrow(lockfile.rootPackage("string-width"));
      strictEqual(plain.alias, undefined, "a plain npm 10 entry records no name, so it carries no alias");
      strictEqual(plain.installName, "string-width");
      const aliased = O.getOrThrow(lockfile.rootPackage("string-width-cjs"));
      strictEqual(aliased.name, "string-width", "npm 10 records the real name on the install-position entry");
      strictEqual(aliased.version, "4.2.3");
      strictEqual(aliased.alias, "string-width-cjs");
      strictEqual(aliased.installName, "string-width-cjs");
      deepStrictEqual(
        A.map(lockfile.packagesNamed("string-width"), (pkg) => pkg.version),
        ["5.1.2", "4.2.3"]
      );
    })
  );

  it.effect("pnpm keys an aliased instance by its real name, so it carries no alias", () =>
    Effect.gen(function* () {
      const lockfile = yield* parseFixture("pnpm/alias/pnpm-lock.yaml", "pnpm");
      const aliased = O.getOrThrow(lockfile.rootPackage("semver-classic"));
      strictEqual(aliased.instanceId, "semver@7.6.3");
      strictEqual(aliased.alias, undefined);
      strictEqual(aliased.installName, "semver");
      const cliui = O.getOrThrow(lockfile.packageByInstanceId("@isaacs/cliui@8.0.2"));
      assertSome(R.get(cliui.resolved, "string-width-cjs"), "string-width@4.2.3");
      const wrapAnsi = O.getOrThrow(lockfile.packageByInstanceId("wrap-ansi@7.0.0"));
      assertSome(R.get(wrapAnsi.resolved, "string-width"), "string-width@4.2.3");
      strictEqual(
        O.getOrThrow(lockfile.packageByInstanceId("string-width@4.2.3")).installName,
        "string-width",
        "cliui and wrap-ansi reach one instance under two install names, so the alias lives on the edge"
      );
    })
  );

  it("falls back to the name, and survives a rename", () => {
    const plain = ResolvedPackage.make({ name: "effect", version: "4.0.2", instanceId: "effect", isWorkspace: false });
    strictEqual(plain.installName, "effect");
    const aliased = ResolvedPackage.make({
      name: "string-width",
      alias: "string-width-cjs",
      version: "4.2.3",
      instanceId: "string-width-cjs",
      isWorkspace: false,
    });
    strictEqual(aliased.withName("renamed").installName, "string-width-cjs");
    assertFalse(aliased.installName === aliased.name);
  });
});
