// `containWithinRoot`: discovery that stays inside the workspace root's real
// path.
//
// Upstream discovery follows links, as the package managers do: a member
// directory that is a link to somewhere outside the checkout is read like any
// other. A caller that scans a checkout it does not fully trust (the repo
// CLI's Quality generators, 4-A1) opts into containment, and then such a link
// must be skipped BEFORE its manifest is read and before a `**` descent walks
// into it — a malformed manifest outside the root can no longer fail
// discovery, and a link to a large tree can no longer spend the visit budget.

import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { WorkspaceDiscovery, WorkspaceRoot } from "@beep/repo-workspaces";
import { describe, layer } from "@effect/vitest";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import type { WorkspaceDiscoveryOptions } from "@beep/repo-workspaces";

type Seed = Parameters<typeof MemoryFileSystem.layerWith>[0];

const manifest = (name: string): string => JSON.stringify({ name, version: "1.0.0" });
const root = (patterns: ReadonlyArray<string>): string =>
  JSON.stringify({ name: "root", version: "0.0.0", private: true, workspaces: patterns });

/** A tree with links that leave `/repo` and links that stay inside it. */
const linked: Seed = {
  "/repo/package.json": root(["packages/*", "escape", "groups/**", "outer/*", "inner", "dangling/*"]),
  "/repo/packages/a/package.json": manifest("a"),
  // Leaves the root: its manifest is not even JSON.
  "/repo/packages/out": MemoryFileSystem.symlink("/outside/broken"),
  "/outside/broken/package.json": "{",
  // A literal member that leaves the root.
  "/repo/escape": MemoryFileSystem.symlink("/outside/good"),
  "/outside/good/package.json": manifest("outside-good"),
  // A `**` descent whose first level leaves the root into a deep tree.
  "/repo/groups/local/package.json": manifest("local"),
  "/repo/groups/away": MemoryFileSystem.symlink("/outside/tree"),
  "/outside/tree/one/package.json": manifest("tree-one"),
  "/outside/tree/one/two/package.json": manifest("tree-two"),
  // A wildcard base that itself leaves the root.
  "/repo/outer": MemoryFileSystem.symlink("/outside/tree"),
  // A literal link that stays inside the root.
  "/repo/inner": MemoryFileSystem.symlink("/repo/packages/a"),
  // A dangling link under a wildcard base.
  "/repo/dangling/gone": MemoryFileSystem.symlink("/repo/nowhere"),
};

const discoveryOver = (seed: Seed, options: WorkspaceDiscoveryOptions.Encoded, faults = {}) => {
  const base = Layer.mergeAll(MemoryFileSystem.layerWith(seed, { faults }), Path.layer);
  return Layer.effect(WorkspaceDiscovery, WorkspaceDiscovery.make({ cwd: "/repo", ...options })).pipe(
    Layer.provide(WorkspaceRoot.layer.pipe(Layer.provide(base))),
    Layer.provide(base)
  );
};

const listed = Effect.gen(function* () {
  const discovery = yield* WorkspaceDiscovery;
  const packages = yield* discovery.listPackages;
  return A.map(packages, (pkg) => `${pkg.name}=${pkg.relativePath}`);
});

const unresolvableRoot = {
  realPath: (path: string) =>
    path === "/repo"
      ? Effect.fail(
          PlatformError.systemError({
            _tag: "PermissionDenied",
            module: "FileSystem",
            method: "realPath",
            pathOrDescriptor: path,
          })
        )
      : undefined,
};

const escapingOnly: Seed = {
  "/repo/package.json": root(["packages/*"]),
  "/repo/packages/a/package.json": manifest("a"),
  "/repo/packages/out": MemoryFileSystem.symlink("/outside/broken"),
  "/outside/broken/package.json": "{",
};

const brokenOutside = "Workspace discovery failed at /repo/packages/out/package.json (invalidJson)";

describe("WorkspaceDiscovery containWithinRoot", () => {
  layer(discoveryOver(linked, {}), { timeout: "30 seconds" })("absent", (it) => {
    it.effect("follows links out of the root, so a broken manifest outside it fails discovery", () =>
      Effect.gen(function* () {
        strictEqual((yield* Effect.flip(listed)).message, brokenOutside);
      })
    );
  });

  layer(discoveryOver(linked, { containWithinRoot: false }), { timeout: "30 seconds" })("false", (it) => {
    it.effect("follows links out of the root, as when the option is absent", () =>
      Effect.gen(function* () {
        strictEqual((yield* Effect.flip(listed)).message, brokenOutside);
      })
    );
  });

  layer(discoveryOver(linked, { containWithinRoot: true }), { timeout: "30 seconds" })("true", (it) => {
    it.effect("skips every directory whose real path leaves the root, before reading or descending into it", () =>
      Effect.gen(function* () {
        deepStrictEqual(yield* listed, ["root=.", "local=groups/local", "a=inner", "a=packages/a"]);
      })
    );
  });

  layer(discoveryOver(escapingOnly, { containWithinRoot: true }, unresolvableRoot), { timeout: "30 seconds" })(
    "true, with a root realPath cannot resolve",
    (it) => {
      it.effect("compares against the root as given", () =>
        Effect.gen(function* () {
          deepStrictEqual(yield* listed, ["root=.", "a=packages/a"]);
        })
      );
    }
  );
});
