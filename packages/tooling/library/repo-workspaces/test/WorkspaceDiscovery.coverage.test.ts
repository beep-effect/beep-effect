import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Str from "effect/String";

describe("discovery double behavior", () => {
  it.effect("owns trailing-slash paths, picks longest prefix and sorts unique owners", () =>
    Effect.gen(function* () {
      const root = WorkspacePackage.make({
        name: "z",
        path: "/repo/",
        packageJsonPath: "/repo/package.json",
        relativePath: ".",
        workspaceRoot: "/repo",
      });
      const child = WorkspacePackage.make({
        name: "a",
        path: "/repo/child",
        packageJsonPath: "/repo/child/package.json",
        relativePath: "child",
        workspaceRoot: "/repo",
      });
      const double = WorkspaceDiscovery.makeTest({ listPackages: Effect.succeed([child, root]) });
      const resolvedFile = yield* double.resolveFile("/repo/child/x");
      assertSome(resolvedFile, child);
      const resolvedFile1 = yield* double.resolveFile("/repo/x");
      assertSome(resolvedFile1, root);
      const resolvedFile2 = yield* double.resolveFile("/outside/x");
      assertNone(resolvedFile2);
      const resolvedFiles = yield* double.resolveFiles(["/repo/x", "/repo/child/x", "/outside/x", "/repo/child/y"]);
      assert.deepStrictEqual(resolvedFiles, [child, root]);
      const importerMap3 = yield* double.importerMap;
      assertSome(HashMap.get(importerMap3, "child"), child);
      const refresh4 = yield* double.refresh;
      assert.strictEqual(refresh4, undefined);
      const refreshIn5 = yield* double.refreshIn("/repo");
      assert.strictEqual(refreshIn5, undefined);
    })
  );
});

import { MemoryFileSystem } from "@beep/memfs";
import { PackageNotFoundError, WorkspacePatternError } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { WorkspaceRoot } from "@beep/repo-workspaces/WorkspaceRoot";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Scheduler from "effect/Scheduler";

it.effect("error messages preserve requested name and pattern diagnostics", () =>
  Effect.gen(function* () {
    assert.strictEqual(
      PackageNotFoundError.make({ packageName: "missing", available: ["present"] }).message,
      'No workspace package named "missing"'
    );
    assert.strictEqual(
      WorkspacePatternError.make({ root: "/", pattern: "bad", kind: "uncompilable", detail: "limit" }).message,
      'Workspace pattern "bad" could not be enumerated (uncompilable: limit)'
    );
  })
);

const rootSupport = Layer.mergeAll(WorkspaceRoot.layerTest("/repo"), Path.layer);
const readFailure = MemoryFileSystem.layerWith(
  {
    "/repo/package.json": '{"name":"root","workspaces":["packages/*"]}',
    "/repo/packages/a/package.json": '{"name":"a"}',
  },
  {
    faults: {
      readFileString: (path) =>
        path === "/repo/packages/a/package.json"
          ? Effect.fail(
              PlatformError.systemError({
                _tag: "PermissionDenied",
                module: "FileSystem",
                method: "readFileString",
                pathOrDescriptor: path,
              })
            )
          : undefined,
    },
  }
);
it.layer(WorkspaceDiscovery.layer({ cwd: "/repo" }).pipe(Layer.provide(rootSupport), Layer.provide(readFailure)), {
  timeout: "10 seconds",
})((it) => {
  it.effect("root manifest read failure preserves its file and kind", () =>
    Effect.gen(function* () {
      const discovery = yield* WorkspaceDiscovery;
      const error = yield* Effect.flip(discovery.listPackages);
      assert.strictEqual(error._tag, "WorkspaceDiscoveryError");
      if (error._tag === "WorkspaceDiscoveryError") {
        assert.strictEqual(error.kind, "read");
        assert.strictEqual(error.path, "/repo/packages/a/package.json");
      }
    })
  );
});

it.layer(
  WorkspaceDiscovery.layer({ cwd: "/repo" }).pipe(
    Layer.provide(rootSupport),
    Layer.provide(
      MemoryFileSystem.layerWith({
        "/repo/package.json": `{"name":"root","workspaces":["${Str.repeat(17)("{a,b}")}"]}`,
      })
    )
  ),
  { timeout: "10 seconds" }
)((it) => {
  it.effect("an expansion bomb becomes an uncompilable workspace pattern error", () =>
    Effect.gen(function* () {
      const discovery = yield* WorkspaceDiscovery;
      const error = yield* Effect.flip(discovery.listPackages);
      assert.strictEqual(error._tag, "WorkspacePatternError");
      if (error._tag === "WorkspacePatternError") {
        assert.strictEqual(error.kind, "uncompilable");
        assert.strictEqual(error.pattern, Str.repeat(17)("{a,b}"));
      }
    })
  );
});

const rootFiles = MemoryFileSystem.layerWith({
  "/package.json":
    '{"name":"z","workspaces":["packages/*"],"optionalDependencies":{"optional":"1.0.0"},"publishConfig":{"access":"public"}}',
  "/packages/a/package.json": '{"name":"a"}',
});
it.layer(
  WorkspaceDiscovery.layer({ cwd: "/" }).pipe(
    Layer.provide(Layer.mergeAll(WorkspaceRoot.layerTest("/"), Path.layer)),
    Layer.provide(rootFiles)
  ),
  { timeout: "10 seconds" }
)((it) => {
  it.effect("filesystem-root ownership and sorted deduplicated resolution", () =>
    Effect.gen(function* () {
      const discovery = yield* WorkspaceDiscovery;
      const root = yield* discovery.getPackage("z");
      const child = yield* discovery.getPackage("a");
      assert.strictEqual(root.publishConfig?.access, "public");
      assert.deepStrictEqual(root.optionalDependencies, { optional: "1.0.0" });
      const resolvedFile6 = yield* discovery.resolveFile("/package.json");
      assertSome(resolvedFile6, root);
      const resolvedFiles7 = yield* discovery.resolveFiles([
        "/package.json",
        "/packages/a/x",
        "/packages/a/y",
        "unowned",
      ]);
      assert.deepStrictEqual(resolvedFiles7, [child, root]);
    })
  );
  it.effect("concurrent per-root discovery deduplicates cache construction and invalidates failures", () =>
    Effect.gen(function* () {
      const discovery = yield* WorkspaceDiscovery;
      for (let budget = 10; budget < 100; budget++) {
        yield* discovery.refresh;
        const lists = yield* Effect.forEach([1, 2, 3, 4], () => discovery.listPackagesIn("/"), {
          concurrency: "unbounded",
        }).pipe(Effect.provideService(Scheduler.MaxOpsBeforeYield, budget));
        for (const list of lists) assert.strictEqual(list, lists[0]);
      }
      yield* discovery.refreshIn("/");
      const listPackagesIn8 = yield* discovery.listPackagesIn("/");
      assert.deepStrictEqual(
        A.map(listPackagesIn8, (pkg) => pkg.name),
        ["z", "a"]
      );
    })
  );
});

it.layer(
  WorkspaceDiscovery.layer({ cwd: "/repo" }).pipe(
    Layer.provide(rootSupport),
    Layer.provideMerge(MemoryFileSystem.layerWith({ "/repo/package.json": '{"name":"root","workspaces":[]}' }))
  ),
  { timeout: "10 seconds" }
)((it) => {
  it.effect("failed per-root discovery is retried after the manifest is repaired", () =>
    Effect.gen(function* () {
      const discovery = yield* WorkspaceDiscovery;
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString("/repo/package.json", '{"name":""}');
      const error = yield* Effect.flip(discovery.listPackagesIn("/repo"));
      assert.strictEqual(error._tag, "WorkspaceDiscoveryError");
      yield* fs.writeFileString("/repo/package.json", '{"name":"fixed","workspaces":[]}');
      const listPackagesIn9 = yield* discovery.listPackagesIn("/repo");
      assert.deepStrictEqual(
        A.map(listPackagesIn9, (pkg) => pkg.name),
        ["fixed"]
      );
    })
  );
});

it.layer(
  WorkspaceDiscovery.layer({ cwd: "/repo" }).pipe(
    Layer.provide(rootSupport),
    Layer.provide(
      MemoryFileSystem.layerWith({
        "/repo/package.json": '{"name":"root","workspaces":["packages/*"]}',
        "/repo/packages/a/package.json": '{"name":"é"}',
        "/repo/packages/b/package.json": '{"name":"é"}',
      })
    )
  ),
  { timeout: "10 seconds" }
)((it) => {
  it.effect("distinct canonically equivalent names are both retained when their sort comparison is equal", () =>
    Effect.gen(function* () {
      const discovery = yield* WorkspaceDiscovery;
      const owners = yield* discovery.resolveFiles(["/repo/packages/b/x", "/repo/packages/a/x"]);
      assert.deepStrictEqual(
        A.map(owners, (pkg) => pkg.name),
        ["é", "é"]
      );
    })
  );
});
