import { findWorkspaceRootSync, getWorkspacePackagesSync, WorkspaceDiscovery, Workspaces } from "@beep/repo-workspaces";
import { nodeFileSystem, nodePath, nodeSyncOps } from "@beep/repo-workspaces/node-sync";
import { resolve } from "@beep/utils/Path";
import { afterAll, assert, beforeAll, describe, it, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { makeNodeFixture, nodeHost } from "./utils/nodeFixture.ts";
import type { SyncFileSystem } from "@beep/repo-workspaces";

const packageRoot = resolve(import.meta.dirname, "..", "..");

const repoRoot = resolve(packageRoot, "..", "..", "..", "..");

const siblingPackageCwd = resolve(repoRoot, "packages", "foundation", "modeling", "utils");

describe("the node-sync preset on the real disk of this repository, called from a packages/ subdirectory as consumers do", () => {
  it("starts from a real sibling package directory", () => {
    assert.isTrue(
      nodeFileSystem.exists(nodePath.join(siblingPackageCwd, "package.json")),
      `expected a package at ${siblingPackageCwd}`
    );
  });

  it("findWorkspaceRootSync finds the workspace root from a packages/ subdir", () => {
    const root = findWorkspaceRootSync(siblingPackageCwd, nodeSyncOps);
    assert.isNotNull(root);
    if (root === null) return assert.fail("expected a workspace root");
    assert.strictEqual(root, repoRoot);
    assert.isTrue(nodeFileSystem.exists(nodePath.join(root, "bun.lock")));
  });

  it("getWorkspacePackagesSync enumerates this package and its siblings", () => {
    const root = findWorkspaceRootSync(siblingPackageCwd, nodeSyncOps);
    assert.isNotNull(root);
    if (root === null) return assert.fail("expected a workspace root");
    const names = A.map(getWorkspacePackagesSync(root, nodeSyncOps), (pkg) => pkg.name);
    assert.include(names, "@beep/repo-workspaces");
    assert.include(names, "@beep/utils");
    assert.include(names, "@beep/identity");
  });
});

layer(Workspaces.layer({ cwd: siblingPackageCwd }).pipe(Layer.provideMerge(nodeHost)), { timeout: "30 seconds" })(
  (it) => {
    it.effect("the preset agrees exactly with the Effect discovery surface", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const info = yield* discovery.info;
        const root = findWorkspaceRootSync(siblingPackageCwd, nodeSyncOps);
        assert.strictEqual(root, info.root);
        const sync = A.sort(
          A.map(getWorkspacePackagesSync(info.root, nodeSyncOps), (pkg) => pkg.name),
          Str.Order
        );
        const listPackages1 = yield* discovery.listPackages;
        const async = A.sort(
          A.map(listPackages1, (pkg) => pkg.name),
          Str.Order
        );
        assert.deepStrictEqual(sync, async);
      })
    );
  }
);

describe("SyncFileSystem.readDirectoryWithTypes over a real symlink, pinning node's own withFileTypes Dirent semantics", () => {
  const fixture = makeNodeFixture();
  let root = "";

  beforeAll(() =>
    fixture.runtime.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        root = yield* fixture.tempDirectory("ws-dirent-");
        yield* fs.makeDirectory(path.join(root, "packages/a"), { recursive: true });
        yield* fs.makeDirectory(path.join(root, "real/b"), { recursive: true });
        yield* fs.writeFileString(
          path.join(root, "package.json"),
          `{ "name": "root", "version": "0.0.0", "private": true }`
        );
        yield* fs.writeFileString(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
        yield* fs.writeFileString(path.join(root, "packages/a/package.json"), `{ "name": "@x/a", "version": "1.0.0" }`);
        yield* fs.writeFileString(path.join(root, "real/b/package.json"), `{ "name": "@x/b", "version": "2.0.0" }`);
        const symlinkedPackageB = path.join(root, "packages/b");
        yield* fs.symlink(path.join(root, "real/b"), symlinkedPackageB);
      })
    )
  );

  afterAll(() => fixture.close());

  const { readDirectoryWithTypes: _fast, ...fourOperationFallback } = nodeFileSystem;
  const slow: SyncFileSystem = fourOperationFallback;

  it("agrees with the fallback, symlinked package directories included", () => {
    assert.isDefined(nodeFileSystem.readDirectoryWithTypes);
    const viaSlow = getWorkspacePackagesSync(root, { fileSystem: slow, path: nodePath });
    const viaFast = getWorkspacePackagesSync(root, { fileSystem: nodeFileSystem, path: nodePath });

    assert.deepStrictEqual(
      A.sort(
        A.map(viaSlow, (pkg) => pkg.name),
        Str.Order
      ),
      ["@x/a", "@x/b", "root"],
      "positive control: the fallback must find the symlinked package, or both finding nothing would also agree"
    );
    assert.deepStrictEqual(
      viaFast,
      viaSlow,
      "the fast path is a pure syscall saving; a naive Dirent.isDirectory() drops the package, since a dirent describes the link, not its target"
    );
  });
});
