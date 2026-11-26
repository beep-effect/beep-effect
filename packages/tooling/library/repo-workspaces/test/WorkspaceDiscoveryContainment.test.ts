import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { WorkspaceDiscovery, WorkspaceRoot } from "@beep/repo-workspaces";
import { describe, layer } from "@effect/vitest";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { WorkspaceDiscoveryOptions } from "@beep/repo-workspaces";

const UnknownJson = S.fromJsonString(S.Unknown);

type Seed = Parameters<typeof MemoryFileSystem.layerWith>[0];

const manifest = (name: string): string =>
  Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)({ name, version: "1.0.0" }), identity);
const root = (patterns: ReadonlyArray<string>): string =>
  Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({
      name: "root",
      version: "0.0.0",
      private: true,
      workspaces: patterns,
    }),
    identity
  );

const nonJsonManifestOutside: Seed = {
  "/repo/packages/out": MemoryFileSystem.symlink("/outside/broken"),
  "/outside/broken/package.json": "{",
};
const literalMemberOutside: Seed = {
  "/repo/escape": MemoryFileSystem.symlink("/outside/good"),
  "/outside/good/package.json": manifest("outside-good"),
};
const globstarDescentIntoDeepOutside: Seed = {
  "/repo/groups/local/package.json": manifest("local"),
  "/repo/groups/away": MemoryFileSystem.symlink("/outside/tree"),
  "/outside/tree/one/package.json": manifest("tree-one"),
  "/outside/tree/one/two/package.json": manifest("tree-two"),
};
const wildcardBaseOutside: Seed = { "/repo/outer": MemoryFileSystem.symlink("/outside/tree") };
const literalLinkInside: Seed = { "/repo/inner": MemoryFileSystem.symlink("/repo/packages/a") };
const danglingLinkUnderWildcard: Seed = { "/repo/dangling/gone": MemoryFileSystem.symlink("/repo/nowhere") };

const escapingAndInternalLinks: Seed = {
  "/repo/package.json": root(["packages/*", "escape", "groups/**", "outer/*", "inner", "dangling/*", "absent"]),
  "/repo/packages/a/package.json": manifest("a"),
  ...nonJsonManifestOutside,
  ...literalMemberOutside,
  ...globstarDescentIntoDeepOutside,
  ...wildcardBaseOutside,
  ...literalLinkInside,
  ...danglingLinkUnderWildcard,
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
  layer(discoveryOver(escapingAndInternalLinks, {}), { timeout: "30 seconds" })("absent", (it) => {
    it.effect("follows links out of the root, so a broken manifest outside it fails discovery", () =>
      Effect.gen(function* () {
        strictEqual((yield* Effect.flip(listed)).message, brokenOutside);
      })
    );
  });

  layer(discoveryOver(escapingAndInternalLinks, { containWithinRoot: false }), { timeout: "30 seconds" })(
    "false",
    (it) => {
      it.effect("follows links out of the root, as when the option is absent", () =>
        Effect.gen(function* () {
          strictEqual((yield* Effect.flip(listed)).message, brokenOutside);
        })
      );
    }
  );

  layer(discoveryOver(escapingAndInternalLinks, { containWithinRoot: true }), { timeout: "30 seconds" })(
    "true",
    (it) => {
      it.effect("skips every directory whose real path leaves the root, before reading or descending into it", () =>
        Effect.gen(function* () {
          const listed1 = yield* listed;
          deepStrictEqual(
            listed1,
            ["root=.", "local=groups/local", "a=inner", "a=packages/a"],
            "an untrusted checkout's escaping links: no manifest outside fails discovery or spends the visit budget"
          );
        })
      );
    }
  );

  layer(discoveryOver(escapingOnly, { containWithinRoot: true }, unresolvableRoot), { timeout: "30 seconds" })(
    "true, with a root realPath cannot resolve",
    (it) => {
      it.effect("compares against the root as given", () =>
        Effect.gen(function* () {
          const listed2 = yield* listed;
          deepStrictEqual(listed2, ["root=.", "a=packages/a"]);
        })
      );
    }
  );
});
