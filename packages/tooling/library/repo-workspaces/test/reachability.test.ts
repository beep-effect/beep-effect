// The two driver edges, `@beep/commands` and `@beep/git`, are operational
// adapters: this package is a tooling library, and tooling may reach a driver
// only as a narrowly scoped adapter (`standards/architecture/DECISIONS.md`).
// These cases confine them to the modules that run git or a child process, and
// keep them out of the pure values and the discovery surface.
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { directImportersOf, reaches, runtimeImports, specifiersOf } from "./support/sourceGraph.ts";

/** The pure values and the discovery surface, which never load either driver. */
const DRIVER_FREE = [
  "DependencyGraph.ts",
  "DuplicateCheck.ts",
  "PackageManagerName.ts",
  "ReleaseTag.ts",
  "VersioningStrategy.ts",
  "WorkspacePackage.ts",
  "WorkspaceDiscovery.ts",
  "WorkspaceRoot.ts",
  "WorkspacesSync.ts",
  "node-sync.ts",
];

/**
 * Every module that loads a driver, directly or through its imports. Beyond the
 * six direct importers, the catalog assembly and the values typed over its
 * schemas load the hook layers: `PeerCheck` and `WorkspaceStateSnapshot` take
 * `CatalogSet` from `WorkspaceCatalogs`, and `PeerCheck` and
 * `internal/workspaceYaml` take `PeerDependencyRules` from
 * `ConfigDependencyHooks`. They load the drivers and never run them. The
 * `./testing` entry loads `@beep/commands` through `PackedInstall`, which packs
 * and installs with real package managers. A new entry here is a new adapter
 * edge and needs a reason.
 */
const DRIVER_LOADING = [
  "ChangeDetector.ts",
  "ConfigDependencyHooks.ts",
  "PackedInstall.ts",
  "PeerCheck.ts",
  "WorkspaceCatalogs.ts",
  "WorkspaceSnapshots.ts",
  "WorkspaceStateSnapshot.ts",
  "Workspaces.ts",
  "index.ts",
  "internal/configDependencyFetch.ts",
  "internal/configDependencyResolution.ts",
  "internal/workspaceYaml.ts",
  "testing.ts",
];

const loadsADriver = (module: string): boolean => reaches(module, "@beep/git") || reaches(module, "@beep/commands");

describe("driver edges stay operational adapters", () => {
  it("the walker follows static, side-effect and literal dynamic imports, and skips type-only and comment imports", () => {
    const text = A.join("\n")([
      'import * as A from "effect/Array";',
      "import 'side-effect';",
      'export { x } from "./re-export.ts";',
      'import type { T } from "type-only";',
      'export type { U } from "type-only-export";',
      ' * import { Example } from "jsdoc-example";',
      '// const lazy = await import("commented-out");',
      'const driver = () => import("@beep/git");',
      "const computed = (url: string) => import(url);",
    ]);
    assert.deepStrictEqual(specifiersOf(text), ["effect/Array", "side-effect", "./re-export.ts", "@beep/git"]);
  });

  it("the walker reads every source module", () => {
    assert.isAtLeast(R.keys(runtimeImports).length, 30);
    for (const module of DRIVER_FREE) assert.include(R.keys(runtimeImports), module);
  });

  it("@beep/git is imported only by change detection, at-ref snapshots and the composites", () => {
    assert.deepStrictEqual(directImportersOf("@beep/git"), [
      "ChangeDetector.ts",
      "WorkspaceSnapshots.ts",
      "Workspaces.ts",
    ]);
  });

  it("@beep/commands is imported only by the subprocess hook replay, the fetch rung, PackedInstall and the composites", () => {
    assert.deepStrictEqual(directImportersOf("@beep/commands"), [
      "ConfigDependencyHooks.ts",
      "PackedInstall.ts",
      "Workspaces.ts",
      "internal/configDependencyFetch.ts",
    ]);
  });

  it("no pure value or discovery module loads either driver", () => {
    assert.deepStrictEqual(A.filter(DRIVER_FREE, loadsADriver), []);
  });

  it("the modules that load a driver are exactly the declared set", () => {
    assert.deepStrictEqual(A.sort(A.filter(R.keys(runtimeImports), loadsADriver), Str.Order), DRIVER_LOADING);
  });

  it("the closure is followed, not just the direct imports", () => {
    // Positive controls: the walker finds a driver one relative edge away, so
    // the empty result above is not the walker failing to look.
    assert.isTrue(reaches("WorkspaceCatalogs.ts", "@beep/commands"));
    assert.isTrue(reaches("index.ts", "@beep/git"));
  });
});
