import { GlobSet } from "@beep/glob";
import { MemoryFileSystem } from "@beep/memfs";
import { enumerate } from "@beep/repo-workspaces/internal/enumerate";
import { BudgetStop, Traversal } from "@beep/repo-workspaces/internal/traverse";
import { assert, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Str from "effect/String";

const error = (tag: "NotFound" | "PermissionDenied", path: string) =>
  PlatformError.systemError({ _tag: tag, module: "FileSystem", method: "readDirectory", pathOrDescriptor: path });
const layer = Layer.merge(
  MemoryFileSystem.layerWith(
    { "/repo/a/package.json": "{}", "/repo/b/package.json": "{}", "/repo/plain": "file" },
    {
      faults: (base) => ({
        exists: (path) =>
          Str.includes("faulty")(path) ? Effect.fail(error("PermissionDenied", path)) : base.exists(path),
        readDirectory: (path) =>
          path === "/repo/a"
            ? Effect.fail(error("NotFound", path))
            : path === "/repo/b"
              ? Effect.fail(error("PermissionDenied", path))
              : base.readDirectory(path),
      }),
    }
  ),
  Path.layer
);
it.layer(layer, { timeout: "30 seconds" })((it) => {
  it.effect("excluded, missing, and failed literal probes do not fabricate packages", () =>
    Effect.gen(function* () {
      const globs = yield* GlobSet.compile(["a", "missing", "faulty", "!a"]);
      const value = yield* enumerate(globs)("/repo");
      assert.deepStrictEqual(value, []);
    })
  );
  it.effect("a missing root reports its absolute path", () =>
    Effect.gen(function* () {
      const globs = yield* GlobSet.compile(["*"]);
      const failure = yield* Effect.flip(enumerate("/missing", globs));
      assert.strictEqual(failure.kind, "missingBaseDir");
      assert.strictEqual(failure.detail, "/missing");
    })
  );
  it.effect("vanished directories are benign while unreadable descendants fail closed", () =>
    Effect.gen(function* () {
      const compile6 = yield* GlobSet.compile(["a/**"]);
      const enumerate1 = yield* enumerate("/repo", compile6);
      assert.deepStrictEqual(enumerate1, []);
      const compile2 = yield* GlobSet.compile(["b/**"]);
      const failure = yield* Effect.flip(enumerate("/repo", compile2));
      assert.strictEqual(failure.kind, "unreadableDirectory");
      assert.strictEqual(failure.detail, "b");
    })
  );
  it.effect("the root itself is named when its listing fails", () =>
    Effect.gen(function* () {
      const compile3 = yield* GlobSet.compile(["**"]);
      const failure = yield* Effect.flip(enumerate("/repo/b", compile3));
      assert.strictEqual(failure.detail, "/repo/b");
    })
  );
  it.effect("a shared traversal budget stop is preserved with its wildcard pattern", () =>
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          vi
            .spyOn(Traversal.prototype, "charge")
            .mockReturnValueOnce(BudgetStop.make({ kind: "budgetExceeded", detail: "visited directory limit" }))
        ),
        (spy) => Effect.sync(() => spy.mockRestore())
      );
      const compile4 = yield* GlobSet.compile(["*"]);
      const failure = yield* Effect.flip(enumerate("/repo", compile4));
      assert.deepStrictEqual(failure, { kind: "budgetExceeded", detail: "visited directory limit", pattern: "*" });
    })
  );
});

// Every `package.json` probe is recorded and then answered by the real volume.
const probed: Array<string> = [];
const listing = Layer.merge(
  MemoryFileSystem.layerWith(
    {
      "/repo/packages/alpha/package.json": "{}",
      "/repo/packages/beta/package.json": "{}",
      "/repo/packages/dist/package.json": "{}",
      "/repo/packages/gamma/README.md": "",
      "/repo/packages/node_modules/package.json": "{}",
    },
    {
      faults: (base) => ({
        exists: (path) =>
          Effect.andThen(
            Effect.sync(() => probed.push(path)),
            base.exists(path)
          ),
      }),
    }
  ),
  Path.layer
);
it.layer(listing, { timeout: "30 seconds" })((it) => {
  it.effect("defaults skip nothing but the unconditional prune", () =>
    Effect.gen(function* () {
      const compile5 = yield* GlobSet.compile(["packages/*"]);
      const directories = yield* enumerate("/repo", compile5);
      assert.deepStrictEqual(
        A.map(directories, (directory) => directory.relativePath),
        ["packages/alpha", "packages/beta", "packages/dist"]
      );
    })
  );
  it.effect("a skipped name, a pruned entry and an excluded match are never probed for a package", () =>
    Effect.gen(function* () {
      probed.length = 0;
      const globs = yield* GlobSet.compile(["packages/*", "!packages/beta"]);
      const directories = yield* enumerate("/repo", globs, { skipDirectoryNames: ["dist"] });
      assert.deepStrictEqual(
        A.map(directories, (directory) => directory.relativePath),
        ["packages/alpha"]
      );
      assert.deepStrictEqual(A.sort(probed, Str.Order), [
        "/repo/packages/alpha/package.json",
        "/repo/packages/gamma/package.json",
      ]);
    })
  );
});
