import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import { manifestPatternsOf, pnpmPatternsOf, readPatterns, stringsOf } from "../../../effected/workspaces/internal/patterns.ts";

it.effect("extracts only string patterns from both manifest shapes and rejects malformed shapes", () => Effect.sync(() => {
  assert.deepStrictEqual(stringsOf(["packages/*", 1, null]), ["packages/*"]);
  assert.isUndefined(stringsOf({}));
  for (const value of [null, 1, {}, { packages: null }]) assert.deepStrictEqual(pnpmPatternsOf(value), []);
  assert.deepStrictEqual(pnpmPatternsOf({ packages: ["apps/*", false] }), ["apps/*"]);
  for (const value of [null, 1, {}, { workspaces: null }, { workspaces: {} }, { workspaces: { packages: 1 } }, { workspaces: () => [] }]) {
    assert.deepStrictEqual(manifestPatternsOf(value), []);
  }
  assert.deepStrictEqual(manifestPatternsOf({ workspaces: ["apps/*", 1] }), ["apps/*"]);
  assert.deepStrictEqual(manifestPatternsOf({ workspaces: { packages: ["apps/*", 1] } }), ["apps/*"]);
}));

for (const file of ["pnpm-workspace.yaml", "package.json"]) {
  const location = `/repo/${file}`;
  const cause = PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "readFileString", pathOrDescriptor: location });
  const base = Layer.merge(MemoryFileSystem.layerWith({ [location]: "{}" }, {
    faults: { readFileString: () => Effect.fail(cause) },
  }), Path.layer);
  it.layer(base, { timeout: "30 seconds" })(`${file} read fault`, (it) => {
    it.effect("keeps the failing path, failure kind and original cause", () => Effect.gen(function* () {
      const failure = yield* Effect.flip(readPatterns("/repo"));
      assert.deepStrictEqual(failure, { path: location, kind: "read", cause });
    }));
  });
}

const existsCause = PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "exists", pathOrDescriptor: "/repo" });
it.layer(Layer.merge(MemoryFileSystem.layerWith({}, { faults: { exists: () => Effect.fail(existsCause) } }), Path.layer), { timeout: "30 seconds" })("existence faults", (it) => {
  it.effect("treats failed existence probes as absent configuration", () => Effect.gen(function* () {
    assert.deepStrictEqual(yield* readPatterns("/repo"), []);
  }));
});

for (const [file, content, kind] of [
  ["pnpm-workspace.yaml", "packages: [", "invalidYaml"],
  ["package.json", "{", "invalidJson"],
] as const) {
  it.layer(Layer.merge(MemoryFileSystem.layerWith({ [`/repo/${file}`]: content }), Path.layer), { timeout: "30 seconds" })(`${file} parse fault`, (it) => {
    it.effect("reports invalid syntax with its configuration path", () => Effect.gen(function* () {
      const failure = yield* Effect.flip(readPatterns("/repo"));
      assert.strictEqual(failure.path, `/repo/${file}`);
      assert.strictEqual(failure.kind, kind);
      assert.isDefined(failure.cause);
    }));
  });
}
