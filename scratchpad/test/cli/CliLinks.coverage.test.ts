import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as FileSystem from "effect/FileSystem";
import * as ConfigProvider from "effect/ConfigProvider";
import * as PlatformError from "effect/PlatformError";
import { CliLinks, ambientLinksLayer } from "../../effected/cli/CliLinks.ts";
import { CurrentRuntimeEnv } from "../../effected/env/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";

it.layer(ambientLinksLayer({ editorLinks: "file" }).pipe(Layer.provide(CurrentRuntimeEnv.layerTest()), Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))), { timeout: "30 seconds" })((it) => {
  it.effect("without Path only absolute POSIX and drive paths are linked", () => Effect.gen(function* () {
    const links = yield* CliLinks;
    assertSome(links.target({ file: "/repo/a.ts" }), "file:///repo/a.ts");
    assertSome(links.target({ file: "C:/repo/a.ts" }), "file:///C:/repo/a.ts");
    assertNone(links.target({ file: "relative.ts" }));
  }));
});
it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
  it.effect("failed existence probes fall back to the working directory", () => Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const broken = { ...fs, exists: (path: string) => Effect.fail(new PlatformError.PlatformError(new PlatformError.SystemError({ module: "FileSystem", method: "exists", _tag: "PermissionDenied", pathOrDescriptor: path }))) };
    const layer = CliLinks.layer({ cwd: "/repo" }).pipe(Layer.provide(Layer.mergeAll(Layer.succeed(FileSystem.FileSystem, broken), Path.layer, CurrentRuntimeEnv.layerTest())));
    const links = yield* Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(CliLinks, context)));
    assert.strictEqual(links.mode, "file");
    assertSome(links.target({ file: "a.ts" }), "file:///repo/a.ts");
  }));
});

it.layer(ambientLinksLayer().pipe(Layer.provide(Layer.mergeAll(MemoryFileSystem.layer, CurrentRuntimeEnv.layerTest(), ConfigProvider.layer(ConfigProvider.fromUnknown({}))))), { timeout: "30 seconds" })((it) => {
  it.effect("auto falls back to file links when a filesystem exists without a Path service", () => Effect.gen(function* () {
    const links = yield* CliLinks;
    assert.strictEqual(links.mode, "file");
    assertSome(links.target({ file: "/repo/a.ts" }), "file:///repo/a.ts");
    assertNone(links.target({ file: "a.ts" }));
  }));
});
