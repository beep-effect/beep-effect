import * as PackageJson from "@beep/package-json";
import { Package } from "@beep/package-json/Package";
import * as PackageJsonFileExports from "@beep/package-json/PackageJsonFile";
import { PackageManifest } from "@beep/package-json/PackageManifest";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { dependencyModulesImporting, runtimeClosureOf } from "./support/rootClosure.ts";

const IO_MODULES = ["effect/FileSystem", "effect/Path"] as const;

describe("@beep/package-json root barrel", () => {
  it.effect("exposes the manifest models by identity", () =>
    Effect.sync(() => {
      assert.strictEqual(PackageJson.Package, Package);
      assert.strictEqual(PackageJson.PackageManifest, PackageManifest);
    })
  );

  it.effect("keeps PackageJsonFile subpath-only", () =>
    Effect.sync(() => {
      const names = R.keys(PackageJson);
      const fileExports = R.keys(PackageJsonFileExports);
      assert.include(fileExports, "PackageJsonFile");
      for (const name of fileExports) {
        assert.notInclude(names, name);
      }
    })
  );

  it.effect("no longer re-exports @beep/jsonc or @beep/npm-spec names", () =>
    Effect.sync(() => {
      const names = R.keys(PackageJson);
      for (const name of [
        "JsoncEdit",
        "DependencySpecifier",
        "InvalidDependencySpecifierError",
        "isValidDependencySpecifier",
      ]) {
        assert.notInclude(names, name, `${name}: consumers import it from @beep/jsonc or @beep/npm-spec`);
      }
    })
  );

  it.effect("never reaches the IO surface through its runtime import closure", () =>
    Effect.sync(() => {
      const closure = runtimeClosureOf("index.ts");
      assert.include(closure.modules, "Package.ts", "the walk really ran: the barrel reaches the model");
      assert.include(closure.modules, "internal/wire.ts");
      assert.notInclude(closure.modules, "PackageJsonFile.ts");
      assert.deepStrictEqual(
        A.filter(closure.packages, (specifier) => A.some(IO_MODULES, (io) => Str.startsWith(io)(specifier))),
        []
      );
    })
  );

  it.effect("depends only on packages whose sources never import the IO surface", () =>
    Effect.sync(() => {
      const { scanned, offending } = dependencyModulesImporting(IO_MODULES);
      for (const name of ["identity", "jsonc", "npm-spec", "semver", "spdx"]) {
        assert.isTrue(A.some(scanned, Str.startsWith(`${name}/src/`)), `${name}: the glob must match its sources`);
      }
      assert.deepStrictEqual(offending, []);
    })
  );

  it.effect("keeps the IO surface reachable from its own subpath", () =>
    Effect.sync(() => {
      assert.include(runtimeClosureOf("PackageJsonFile.ts").packages, "effect/FileSystem");
    })
  );
});
