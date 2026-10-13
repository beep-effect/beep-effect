import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "../../effected/workspaces/WorkspacesSync.ts";
import type { SyncFileSystem, WorkspaceDiscoverySkip } from "../../effected/workspaces/WorkspacesSync.ts";

const WorkspaceText = S.fromJsonString(S.Struct({ name: S.String, workspaces: S.Array(S.String) }));

const seed = {
  "/repo/package.json": '{"name":"root","workspaces":["packages/**"]}',
  "/repo/packages/a/package.json": '{"name":"a"}',
  "/repo/packages/a/child/package.json": '{"name":"child"}',
};

describe("WorkspacesSync bounded and degraded enumeration", () => {
  it.layer(Path.layer, { timeout: "30 seconds" })((it) => {
    it.effect("a pathological consumer dirname terminates at the ascent budget", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const fs = MemoryFileSystem.makeSync({}).sync;
        let probes = 0;
        const root = findWorkspaceRootSync("/repo", {
          fileSystem: {
            ...fs,
            exists: () => {
              probes++;
              return false;
            },
          },
          path: { ...path, dirname: (dir) => `${dir}/parent` },
        });
        assert.isNull(root);
        assert.strictEqual(probes, 256);
      }),
    );
    it.effect("unreadable optional typed entries skip that subtree", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const fs = MemoryFileSystem.makeSync(seed).sync;
        const fileSystem: SyncFileSystem = {
          ...fs,
          readDirectoryWithTypes: () => {
            throw new Error("denied");
          },
        };
        assert.deepStrictEqual(
          getWorkspacePackagesSync("/repo", { fileSystem, path }).map((pkg) => pkg.name),
          ["root"],
        );
      }),
    );
    it.effect("throwing stat and fallback readdir degrade to the root", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const fs = MemoryFileSystem.makeSync(seed).sync;
        assert.deepStrictEqual(
          getWorkspacePackagesSync("/repo", {
            fileSystem: {
              ...fs,
              isDirectory: () => {
                throw new Error("stat denied");
              },
            },
            path,
          }).map((pkg) => pkg.name),
          ["root"],
        );
        assert.deepStrictEqual(
          getWorkspacePackagesSync("/repo", {
            fileSystem: {
              ...fs,
              readDirectory: () => {
                throw new Error("readdir denied");
              },
            },
            path,
          }).map((pkg) => pkg.name),
          ["root"],
        );
      }),
    );
    it.effect("a root literal is returned only once and absent roots report their skip", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const fs = MemoryFileSystem.makeSync({
          "/repo/package.json": '{"name":"root","workspaces":[".","packages/a"]}',
          "/repo/packages/a/package.json": '{"name":"a"}',
        }).sync;
        assert.deepStrictEqual(
          getWorkspacePackagesSync("/repo", { fileSystem: fs, path }).map((pkg) => pkg.name),
          ["root", "a"],
        );
        const skips: Array<WorkspaceDiscoverySkip> = [];
        assert.deepStrictEqual(
          getWorkspacePackagesSync("/absent", {
            fileSystem: fs,
            path,
            onSkip: (skip) => {
              skips.push(skip);
            },
          }),
          [],
        );
        assert.deepStrictEqual(
          skips.map((skip) => skip.kind),
          ["read"],
        );
      }),
    );
    it.effect("unreadable YAML falls back to manifest workspaces", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const fs = MemoryFileSystem.makeSync({ ...seed, "/repo/pnpm-workspace.yaml": "packages: []" }).sync;
        const fileSystem: SyncFileSystem = {
          ...fs,
          readFile: (file) => {
            if (file.endsWith(".yaml")) throw new Error("denied");
            return fs.readFile(file);
          },
        };
        assert.deepStrictEqual(
          getWorkspacePackagesSync("/repo", { fileSystem, path }).map((pkg) => pkg.name),
          ["root", "a", "child"],
        );
      }),
    );
  });
});

it.layer(Path.layer, { timeout: "30 seconds" })((it) => {
  it.effect("scalar manifests and broken YAML degrade without throwing", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const scalar = MemoryFileSystem.makeSync({ "/repo/package.json": "null" }).sync;
      assert.isNull(findWorkspaceRootSync("/repo", { fileSystem: scalar, path }));
      const fs = MemoryFileSystem.makeSync({ ...seed, "/repo/pnpm-workspace.yaml": "[" }).sync;
      assert.deepStrictEqual(
        getWorkspacePackagesSync("/repo", { fileSystem: fs, path }).map((pkg) => pkg.name),
        ["root", "a", "child"],
      );
    }),
  );
  it.effect("bad patterns and exclusions never admit excluded literals", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      for (const patterns of [["a".repeat(65537)], ["packages/a", "!packages/a"], ["packages/*", "!packages/a"]]) {
        const text = yield* S.encodeEffect(WorkspaceText)({
          name: "root",
          workspaces: patterns,
        });
        const fs = MemoryFileSystem.makeSync({ ...seed, "/repo/package.json": text }).sync;
        const names = getWorkspacePackagesSync("/repo", { fileSystem: fs, path }).map((pkg) => pkg.name);
        assert.deepStrictEqual(names, patterns.length === 1 ? [] : ["root"]);
      }
    }),
  );
  it.effect("pruned directory names are ignored before descent", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const fs = MemoryFileSystem.makeSync({ ...seed, "/repo/packages/node_modules/x/package.json": '{"name":"ignored"}' }).sync;
      assert.deepStrictEqual(
        getWorkspacePackagesSync("/repo", { fileSystem: fs, path }).map((pkg) => pkg.name),
        ["root", "a", "child"],
      );
    }),
  );
  it.effect("a duplicate directory stream truncates at the visit budget", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const fs = MemoryFileSystem.makeSync({
        "/repo/package.json": '{"name":"root","workspaces":["packages/**"]}',
        "/repo/packages/a/package.json": '{"name":"a"}',
      }).sync;
      let reads = 0;
      const fileSystem: SyncFileSystem = {
        ...fs,
        isDirectory: (dir) => dir === "/repo/packages" || dir === "/repo/packages/a",
        exists: (file) => file === "/repo/packages/a/package.json" || fs.exists(file),
        readDirectory: (dir) => {
          reads++;
          return dir === "/repo/packages" ? A.makeBy(100001, () => "a") : ["package.json"];
        },
      };
      assert.deepStrictEqual(
        getWorkspacePackagesSync("/repo", { fileSystem, path }).map((pkg) => pkg.name),
        ["root", "a"],
      );
      assert.strictEqual(reads, 100000);
    }),
  );
});

it.layer(Path.layer, { timeout: "30 seconds" })((it) => {
  it.effect("an absent literal member does not become a package", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const fs = MemoryFileSystem.makeSync({ "/repo/package.json": '{"name":"root","workspaces":["packages/missing"]}' }).sync;
      assert.deepStrictEqual(
        getWorkspacePackagesSync("/repo", { fileSystem: fs, path }).map((pkg) => pkg.name),
        ["root"],
      );
    }),
  );
});
