import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { CatalogResolver } from "../../effected/npm/index.ts";
import { CatalogSet, WorkspaceCatalogs } from "../../effected/workspaces/WorkspaceCatalogs.ts";
import { LockfileReadError, LockfileReader } from "../../effected/workspaces/LockfileReader.ts";
import { WorkspaceRoot, WorkspaceRootNotFoundError } from "../../effected/workspaces/WorkspaceRoot.ts";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
const JsonValue = S.fromJsonString(S.Unknown);

const missingLock = LockfileReadError.make({ lockfilePath: "/repo/pnpm-lock.yaml", format: "pnpm", cause: undefined });
const support = Layer.mergeAll(WorkspaceRoot.layerTest("/repo"), LockfileReader.layerTest({ read: Effect.fail(missingLock) }), Path.layer);

describe("catalog validation edge cases", () => {
  it.effect("rejects invalid JSON and non-object manifests", () => Effect.gen(function* () {
    for (const text of ["{", "null", "1", "[]"]) {
      const error = yield* Effect.flip(CatalogSet.fromManifestWorkspaces(text));
      assert.strictEqual(error.source, "manifest");
      assert.strictEqual(error.path, "package.json");
    }
  }));
  it.effect("rejects malformed named catalogs and packages with precise paths", () => Effect.gen(function* () {
    for (const [manifest, path] of [
      [{ catalogs: 1 }, "catalogs"],
      [{ catalogs: { broken: 1 } }, "catalogs.broken"],
      [{ workspaces: { packages: ["packages/*", 1] } }, "package.json"],
    ] as const) {
      const text = yield* S.encodeEffect(JsonValue)(manifest);
      const error = yield* Effect.flip(CatalogSet.fromManifestWorkspaces(text));
      assert.strictEqual(error.path, path);
    }
  }));
  it.effect("tolerates non-object YAML and refuses duplicate defaults before normalization", () => Effect.gen(function* () {
    for (const text of ["null", "42", "catalog: {}\ncatalogs:\n  default: {}", "catalog: null\ncatalogs: null", "catalog: null\ncatalogs:\n  default: null", "catalog: null\ncatalogs:\n  default: ~", "catalog: null\ncatalogs: {}"] ) {
      assert.deepStrictEqual((yield* CatalogSet.fromWorkspaceYaml(text)).entries, {});
    }
    assert.deepStrictEqual((yield* CatalogSet.fromWorkspaceYaml("catalog: {}\ncatalogs:\n  default: null")).entries, {});
    assert.deepStrictEqual((yield* CatalogSet.fromWorkspaceYaml("catalog: {}\ncatalogs: {}")).entries, { default: {} });
    assert.deepStrictEqual((yield* CatalogSet.fromWorkspaceYaml("catalog: {}\ncatalogs: 1")).entries, { default: {} });
    assert.deepStrictEqual(CatalogSet.fromBunBlocks({ catalog: { effect: "4" }, catalogs: { default: null } }).entries, { default: { effect: "4" } });
  }));
  it.effect("all unstubbed methods die and refresh is a no-op", () => Effect.gen(function* () {
    const double = WorkspaceCatalogs.makeTest();
    for (const [method, operation] of [["set", Effect.asVoid(double.set)], ["resolveSpecifier", Effect.asVoid(double.resolveSpecifier("effect", "catalog:"))], ["releaseAgeGate", Effect.asVoid(double.releaseAgeGate)], ["peerDependencyRules", Effect.asVoid(double.peerDependencyRules)], ["importerVersions", Effect.asVoid(double.importerVersions)], ["hookReplays", Effect.asVoid(double.hookReplays)]] as const) {
      const exit = yield* Effect.exit(operation);
      const message = Exit.findDefect(exit).pipe(Result.map((defect) => P.hasProperty(defect, "message") ? defect.message : undefined));
      assertSuccess(message, `WorkspaceCatalogs.makeTest: ${method}() was called but not stubbed — pass a \`${method}\` override.`);
      assertNone(exit.pipe(Exit.findErrorOption));
    }
    assert.strictEqual(yield* double.refresh, undefined);
  }));
});

for (const yaml of ["null", "minimumReleaseAge: null\nminimumReleaseAgeExclude: null", "configDependencies:\n  policy: 1.0.0"]) {
  const files = MemoryFileSystem.layerWith({ "/repo/pnpm-workspace.yaml": yaml });
  it.layer(WorkspaceCatalogs.layer({ cwd: "/repo" }).pipe(Layer.provide(support), Layer.provide(files)), { timeout: "10 seconds" })((it) => {
    it.effect(`assembles empty catalogs from ${yaml}`, () => Effect.gen(function* () {
      const catalogs = yield* WorkspaceCatalogs;
      assert.deepStrictEqual((yield* catalogs.set).entries, {});
      assert.deepStrictEqual(yield* catalogs.hookReplays, {});
    }));
  });
}

for (const files of [MemoryFileSystem.layerWith({}), MemoryFileSystem.layerWith({}, { faults: { exists: (path) => Effect.fail(PlatformError.systemError({ _tag: "NotFound", module: "FileSystem", method: "exists", pathOrDescriptor: path })) } })]) {
  it.layer(WorkspaceCatalogs.layer({ cwd: "/repo" }).pipe(Layer.provide(support), Layer.provide(files)), { timeout: "10 seconds" })((it) => {
    it.effect("absent markers contribute no catalogs or hook state", () => Effect.gen(function* () {
      const catalogs = yield* WorkspaceCatalogs;
      assert.deepStrictEqual((yield* catalogs.set).entries, {});
      assert.deepStrictEqual(yield* catalogs.importerVersions, {});
      assert.deepStrictEqual(yield* catalogs.hookReplays, {});
    }));
  });
}

const deniedManifest = MemoryFileSystem.layerWith({ "/repo/package.json": "{}" }, { faults: { readFileString: (path) => Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "readFileString", pathOrDescriptor: path })) } });
it.layer(WorkspaceCatalogs.layer({ cwd: "/repo" }).pipe(Layer.provide(support), Layer.provide(deniedManifest)), { timeout: "10 seconds" })((it) => {
  it.effect("an unreadable existing manifest fails assembly", () => Effect.gen(function* () {
    const catalogs = yield* WorkspaceCatalogs;
    const error = yield* Effect.flip(catalogs.set);
    assert.strictEqual(error._tag, "CatalogAssemblyError");
    if (error._tag === "CatalogAssemblyError") assert.strictEqual(error.path, "/repo/package.json");
  }));
});

it.layer(WorkspaceCatalogs.catalogResolver.pipe(Layer.provide(WorkspaceCatalogs.layerTest({ set: Effect.fail(WorkspaceRootNotFoundError.make({ searchPath: "/missing", markers: [] })) }))), { timeout: "10 seconds" })((it) => {
  it.effect("resolver preserves named and default specifiers on root failure", () => Effect.gen(function* () {
    const resolver = yield* CatalogResolver;
    for (const [catalog, specifier] of [[O.none<string>(), "catalog:"], [O.some("build"), "catalog:build"]] as const) {
      const error = yield* Effect.flip(resolver.rangeOf("effect", catalog));
      if (error._tag === "DependencyResolutionError") assert.strictEqual(error.specifier, specifier);
      assert.strictEqual(error._tag, "DependencyResolutionError");
    }
  }));
});

it.layer(WorkspaceCatalogs.layerWithConfigDependencies({ cwd: "/repo" }).pipe(Layer.provide(support), Layer.provide(MemoryFileSystem.layerWith({ "/repo/pnpm-workspace.yaml": "catalog:\n  effect: ^4.0.0" }))), { timeout: "10 seconds" })((it) => {
  it.effect("live hooks without config dependencies preserve inline ranges", () => Effect.gen(function* () {
    const catalogs = yield* WorkspaceCatalogs;
    assertSome(yield* catalogs.resolveSpecifier("effect", "catalog:"), "^4.0.0");
    assertNone(yield* catalogs.resolveSpecifier("missing", "catalog:"));
  }));
});

it.layer(WorkspaceCatalogs.layerWithConfigDependenciesSubprocess({ cwd: "/repo" }).pipe(Layer.provide(support), Layer.provide(MemoryFileSystem.layerWith({ "/repo/package.json": "{}" })), Layer.provide(Layer.mock(ChildProcessSpawner.ChildProcessSpawner, {}))), { timeout: "10 seconds" })((it) => {
  it.effect("subprocess hook assembly with no dependencies never spawns", () => Effect.gen(function* () {
    const catalogs = yield* WorkspaceCatalogs;
    assert.deepStrictEqual((yield* catalogs.set).entries, {});
  }));
});

const deniedYaml = MemoryFileSystem.layerWith({ "/repo/pnpm-workspace.yaml": "catalog: {}" }, { faults: { readFileString: (path) => Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "readFileString", pathOrDescriptor: path })) } });
it.layer(WorkspaceCatalogs.layer({ cwd: "/repo" }).pipe(Layer.provide(support), Layer.provide(deniedYaml)), { timeout: "10 seconds" })((it) => {
  it.effect("an unreadable workspace YAML fails with its absolute manifest path", () => Effect.gen(function* () {
    const catalogs = yield* WorkspaceCatalogs;
    const error = yield* Effect.flip(catalogs.set);
    assert.strictEqual(error._tag, "CatalogAssemblyError");
    if (error._tag === "CatalogAssemblyError") {
      assert.strictEqual(error.path, "/repo/pnpm-workspace.yaml");
      assert.strictEqual(error.source, "manifest");
    }
  }));
});
