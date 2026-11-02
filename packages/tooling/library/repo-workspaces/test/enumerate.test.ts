import { GlobSet } from "@beep/glob";
import { MemoryFileSystem } from "@beep/memfs";
import { enumerate } from "@beep/repo-workspaces/internal/enumerate";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";

const literals = Array.from({ length: 24 }, (_, index) => `packages/pkg-${index}`);

const tree: Record<string, string> = {
  "/repo/package.json": JSON.stringify({ name: "root", version: "1.0.0" }),
  ...R.fromEntries(
    A.map(literals, (literal, index) => [
      `/repo/${literal}/package.json`,
      JSON.stringify({ name: `@x/pkg-${index}`, version: "1.0.0" }),
    ])
  ),
};

describe("enumerate — literal pattern probes", () => {
  let inFlight = 0;
  let maxInFlight = 0;
  // A spy, not a stub: the faults factory hands the handler the unfaulted
  // volume, so every probe is counted and then answered by the real `exists`.
  const Counted = Layer.mergeAll(
    MemoryFileSystem.layerWith(tree, {
      faults: (base) => ({
        exists: Effect.fn("exists")(function* (path: string) {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          yield* Effect.yieldNow;
          const exists = yield* base.exists(path);
          inFlight -= 1;
          return exists;
        }),
      }),
    }),
    Path.layer
  );

  it.layer(Counted, { timeout: "30 seconds" })((it) => {
    it.effect("checks literal package candidates with overlapping exists probes", () =>
      Effect.gen(function* () {
        const globs = yield* GlobSet.compile(literals);
        const directories = yield* enumerate("/repo", globs);

        assert.deepStrictEqual(
          A.map(directories, (directory) => directory.relativePath),
          [...literals].sort()
        );
        assert.isAbove(maxInFlight, 1, "expected literal package checks to overlap");
      })
    );
  });
});

describe("enumerate — skipMissingBaseDirs skips only a base whose stat fails NotFound", () => {
  const baseTree: Record<string, string> = {
    "/repo/package.json": '{ "name": "root", "version": "1.0.0" }',
    "/repo/packages/a/package.json": '{ "name": "@x/a", "version": "1.0.0" }',
    "/repo/apps/web/package.json": '{ "name": "@x/web", "version": "1.0.0" }',
  };
  // `apps` exists; only its `stat` fails, so it is unreadable, not absent.
  const DeniedApps = Layer.mergeAll(
    MemoryFileSystem.layerWith(baseTree, {
      faults: {
        stat: (path: string) =>
          path === "/repo/apps"
            ? Effect.fail(
                PlatformError.systemError({
                  _tag: "PermissionDenied",
                  module: "FileSystem",
                  method: "stat",
                  pathOrDescriptor: path,
                })
              )
            : undefined,
      },
    }),
    Path.layer
  );

  it.layer(DeniedApps, { timeout: "30 seconds" })((it) => {
    it.effect("selects nothing for a missing base", () =>
      Effect.gen(function* () {
        const globs = yield* GlobSet.compile(["packages/*", "missing/*"]);
        const directories = yield* enumerate("/repo", globs, { skipMissingBaseDirs: true });
        assert.deepStrictEqual(
          A.map(directories, (directory) => directory.relativePath),
          ["packages/a"]
        );
      })
    );

    it.effect("reports a base whose stat fails otherwise as unreadableDirectory", () =>
      Effect.gen(function* () {
        const globs = yield* GlobSet.compile(["packages/*", "apps/*"]);
        const failure = yield* Effect.flip(enumerate("/repo", globs, { skipMissingBaseDirs: true }));
        assert.deepStrictEqual(failure, { kind: "unreadableDirectory", pattern: "apps/*", detail: "apps" });
      })
    );
  });
});

describe("enumerate — an unreadable root-level wildcard base names the root", () => {
  // A root-level wildcard (`*`) has an empty base, so its unreadable verdict names the root itself.
  const DeniedRoot = Layer.mergeAll(
    MemoryFileSystem.layerWith(
      {
        "/repo/package.json": '{ "name": "root", "version": "1.0.0" }',
        "/repo/a/package.json": '{ "name": "@x/a", "version": "1.0.0" }',
      },
      {
        faults: {
          stat: (path: string) =>
            path === "/repo"
              ? Effect.fail(
                  PlatformError.systemError({
                    _tag: "PermissionDenied",
                    module: "FileSystem",
                    method: "stat",
                    pathOrDescriptor: path,
                  })
                )
              : undefined,
        },
      }
    ),
    Path.layer
  );

  it.layer(DeniedRoot, { timeout: "30 seconds" })((it) => {
    it.effect("reports the root path as the unreadable directory", () =>
      Effect.gen(function* () {
        const globs = yield* GlobSet.compile(["*"]);
        const failure = yield* Effect.flip(enumerate("/repo", globs, { skipMissingBaseDirs: true }));
        assert.deepStrictEqual(failure, { kind: "unreadableDirectory", pattern: "*", detail: "/repo" });
      })
    );
  });
});
