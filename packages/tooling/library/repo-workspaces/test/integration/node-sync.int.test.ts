// The node-sync preset driving the sync entry points against the repository
// it lives in — the real filesystem, no virtual tree.
//
// `self.int.test.ts` pins the preset against the Effect surface from this
// package's own directory; this one does the same from a `packages/`
// subdirectory of a real Bun workspace, the shape a consumer calls it from.

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

/** A sibling package's directory — the repo root is somewhere above it. */
const cwd = resolve(import.meta.dirname, "..", "..", "..", "..", "..", "packages", "foundation", "modeling", "utils");

describe("the node-sync preset against the real repository", () => {
  it("findWorkspaceRootSync finds the workspace root from a packages/ subdir", () => {
    const root = findWorkspaceRootSync(cwd, nodeSyncOps);
    assert.isNotNull(root);
    if (root === null) return assert.fail("expected a workspace root");
    assert.isTrue(nodeFileSystem.exists(nodePath.join(root, "bun.lock")));
  });

  it("getWorkspacePackagesSync enumerates this package and its siblings", () => {
    const root = findWorkspaceRootSync(cwd, nodeSyncOps);
    assert.isNotNull(root);
    if (root === null) return assert.fail("expected a workspace root");
    const names = A.map(getWorkspacePackagesSync(root, nodeSyncOps), (pkg) => pkg.name);
    assert.include(names, "@beep/repo-workspaces");
    assert.include(names, "@beep/utils");
    assert.include(names, "@beep/identity");
  });
});

layer(Workspaces.layer({ cwd }).pipe(Layer.provideMerge(nodeHost)), { timeout: "30 seconds" })((it) => {
  it.effect("the preset agrees exactly with the Effect discovery surface", () =>
    Effect.gen(function* () {
      const discovery = yield* WorkspaceDiscovery;
      const info = yield* discovery.info;
      const root = findWorkspaceRootSync(cwd, nodeSyncOps);
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
});

// The optional `readDirectoryWithTypes` fast path on the REAL disk. It must be
// a pure syscall saving: identical results to the four-operation fallback,
// including on a tree whose package directory is a SYMLINK — the case where a
// naive implementation trusting `Dirent.isDirectory()` silently drops the
// package, because a dirent describes the link and not its target. This pins
// node's own `readdirSync(p, { withFileTypes: true })` Dirent semantics, which
// no virtual volume can stand in for.
describe("SyncFileSystem.readDirectoryWithTypes over a real symlink", () => {
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
        // packages/b is a SYMLINK to a directory holding a real package.
        yield* fs.symlink(path.join(root, "real/b"), path.join(root, "packages/b"));
      })
    )
  );

  afterAll(() => fixture.close());

  // The fallback: exactly the documented four-operation wiring, no fast path.
  const { readDirectoryWithTypes: _fast, ...fallback } = nodeFileSystem;
  const slow: SyncFileSystem = fallback;

  it("agrees with the fallback, symlinked package directories included", () => {
    assert.isDefined(nodeFileSystem.readDirectoryWithTypes);
    const viaSlow = getWorkspacePackagesSync(root, { fileSystem: slow, path: nodePath });
    const viaFast = getWorkspacePackagesSync(root, { fileSystem: nodeFileSystem, path: nodePath });

    // The positive control: the symlinked package must actually be found, or
    // "the two agree" would be satisfied by both finding nothing.
    assert.deepStrictEqual(
      A.sort(
        A.map(viaSlow, (pkg) => pkg.name),
        Str.Order
      ),
      ["@x/a", "@x/b", "root"],
      "fallback must resolve the symlinked package"
    );
    assert.deepStrictEqual(viaFast, viaSlow);
  });
});
