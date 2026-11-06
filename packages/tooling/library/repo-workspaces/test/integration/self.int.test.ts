// The package discovering the repository it lives in.
//
// Everything else in the suite runs against a virtual filesystem. This runs
// against the lab's real Bun workspace through `@effect/platform-node`:
// root walk, workspace enumeration, per-package decode, dependency ordering,
// the default catalog, and bun.lock with workspace paths resolved.
//
// It also pins the sync escape hatch, through the shipped `node-sync` preset,
// against the async surface: `vitest-agent` calls the sync pair, and if the two
// ever disagree its project list silently diverges from what the Effect API
// would have found.

import {
  DependencyGraph,
  findWorkspaceRootSync,
  getWorkspacePackagesSync,
  LockfileReader,
  PackageManagerDetector,
  WorkspaceCatalogs,
  WorkspaceDiscovery,
  Workspaces,
} from "@beep/repo-workspaces";
import { nodeSyncOps } from "@beep/repo-workspaces/node-sync";
import { resolve } from "@beep/utils/Path";
import { assert, describe, layer } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { nodeHost } from "./utils/nodeFixture.ts";

/** This package's own directory — the repo root is somewhere above it. */
const cwd = resolve(import.meta.dirname, "..", "..");
const syncOps = nodeSyncOps;

const Live = Workspaces.layer({ cwd }).pipe(Layer.provideMerge(nodeHost));

describe("the lab Bun workspace, discovered by the package that lives in it", () => {
  layer(Live, { timeout: "30 seconds" })((it) => {
    it.effect("finds the workspace root and its bun workspace patterns", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const info = yield* discovery.info;
        assert.isTrue(Str.startsWith(info.root)(cwd), "the root must be an ancestor of this package");
        assert.isAbove(info.patterns.length, 0);
      })
    );

    it.effect("discovers itself, and its siblings", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const listPackages1 = yield* discovery.listPackages;
        const names = A.map(listPackages1, (pkg) => pkg.name);
        assert.include(names, "@beep/repo-workspaces");
        assert.include(names, "@beep/schema");
        assert.include(names, "@beep/utils");
        assert.include(names, "@beep/identity");
      })
    );

    it.effect("attributes this very test file to this package", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const owner = yield* discovery.resolveFile(import.meta.filename);
        assertSome(
          O.map(owner, () => undefined),
          undefined
        );
        assert.strictEqual(O.getOrThrow(owner).name, "@beep/repo-workspaces");
      })
    );

    it.effect("detects bun", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const detector = yield* PackageManagerDetector;
        const info = yield* discovery.info;
        const detected = yield* detector.detect(info.root);
        assert.strictEqual(detected.name, "bun");
      })
    );

    it.effect("builds an acyclic graph and orders workspaces before their dependents", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const graph = DependencyGraph.make({ packages: yield* discovery.listPackages });
        assert.isFalse(graph.hasCycle, "the lab workspace graph must stay acyclic");

        const order = yield* graph.sort();
        // The lab package depends on schema, utils and identity; all three
        // must precede it in a topological order.
        assert.include(order, "@beep/repo-workspaces");
        const self = order.indexOf("@beep/repo-workspaces");
        for (const dependency of ["@beep/schema", "@beep/utils", "@beep/identity"]) {
          assert.include(order, dependency);
          assert.isBelow(order.indexOf(dependency), self, `${dependency} must build before workspaces`);
        }
      })
    );

    it.effect("resolves the repo's own effect catalog entry", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const set = yield* catalogs.set;
        // The lab pins Effect 4 in Bun's default catalog, consumed as catalog:.
        const range = set.rangeOf("effect", O.none());
        assertSome(
          O.map(range, () => undefined),
          undefined
        );
        assert.match(O.getOrThrow(range), /^\^?4\./);
      })
    );

    it.effect("reads the real bun.lock with importer paths resolved to real names", () =>
      Effect.gen(function* () {
        const reader = yield* LockfileReader;
        const lockfile = yield* reader.read;
        assert.strictEqual(lockfile.format, "bun");

        const workspaceNames = A.map(
          A.filter(lockfile.packages, (pkg) => pkg.isWorkspace),
          (pkg) => pkg.name
        );
        // Workspace entries must be exposed by their manifest names,
        // rather than the paths of the lab workspace members.
        assert.include(workspaceNames, "@beep/utils");
        assert.notInclude(workspaceNames, "packages/foundation/modeling/utils");
      })
    );
  });
});

describe("the sync escape hatch agrees with the Effect surface", () => {
  layer(Live, { timeout: "30 seconds" })((it) => {
    it.effect("findWorkspaceRootSync finds the same root", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const info = yield* discovery.info;
        assert.strictEqual(findWorkspaceRootSync(cwd, syncOps), info.root);
      })
    );

    it.effect("getWorkspacePackagesSync finds the same packages", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const info = yield* discovery.info;
        const listPackages2 = yield* discovery.listPackages;
        const async = A.map(listPackages2, (pkg) => pkg.name).sort();
        const sync = A.map(getWorkspacePackagesSync(info.root, syncOps), (pkg) => pkg.name).sort();
        // The whole point of routing both through one GlobSet: if the sync
        // enumerator ever grows a private pattern semantic again, this diverges.
        assert.deepStrictEqual(sync, async);
      })
    );

    it.effect("getWorkspacePackagesSync agrees on the dependency maps too", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const info = yield* discovery.info;
        const async = yield* discovery.getPackage("@beep/repo-workspaces");
        const sync = O.getOrUndefined(
          A.findFirst(getWorkspacePackagesSync(info.root, syncOps), (pkg) => pkg.name === "@beep/repo-workspaces")
        );
        assert.isDefined(sync);
        assert.deepStrictEqual(sync?.dependencies, async.dependencies);
        assert.strictEqual(sync?.relativePath, async.relativePath);
      })
    );
  });
});
