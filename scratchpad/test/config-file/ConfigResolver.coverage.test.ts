import { afterEach, assert, describe, it, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { ConfigResolver } from "../../effected/config-file/ConfigResolver.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";

afterEach(() => vi.unstubAllGlobals());
const platform = Layer.mergeAll(MemoryFileSystem.layerWith({ "/config": "{}", "/package.json": "null" }), Path.layer);

it.layer(platform, { timeout: "30 seconds" })((it) => {
  describe("resolver host fallbacks", () => {
    it.effect("uses root when process is absent", () => Effect.gen(function* () {
      vi.stubGlobal("process", undefined);
      assertSome(yield* ConfigResolver.upwardWalk({ filename: "config" }).resolve, "/config");
      assertNone(yield* ConfigResolver.workspaceRoot({ filename: "config" }).resolve);
      assertNone(yield* ConfigResolver.systemEtc({ app: "absent", filename: "config" }).resolve);
    }));
    it.effect("uses root when process has no cwd and skips etc on Windows", () => Effect.gen(function* () {
      vi.stubGlobal("process", { platform: "win32" });
      assertSome(yield* ConfigResolver.upwardWalk({ filename: "config" }).resolve, "/config");
      assertNone(yield* ConfigResolver.systemEtc({ app: "app", filename: "config" }).resolve);
    }));
    it.effect("uses the host cwd when no cwd is supplied", () => Effect.gen(function* () {
      vi.stubGlobal("process", { cwd: () => "/", platform: "linux" });
      assertSome(yield* ConfigResolver.upwardWalk({ filename: "config" }).resolve, "/config");
    }));
  });
});

it.effect("the exported resolver facade is constructible for JavaScript consumers", () => Effect.sync(() => {
  assert.isTrue(Reflect.construct(ConfigResolver, []) instanceof ConfigResolver);
}));
