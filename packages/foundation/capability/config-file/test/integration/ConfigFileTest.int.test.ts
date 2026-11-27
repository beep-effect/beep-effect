import { ConfigFile } from "@beep/config-file/ConfigFile";
import { JsonCodec } from "@beep/config-file/JsonCodec";
import { MergeStrategy } from "@beep/config-file/MergeStrategy";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";

class AppShape extends S.Class<AppShape, { readonly brand: unique symbol }>("AppShape")({ port: S.Finite }) {}
class AppConfig extends ConfigFile.Service<AppConfig, AppShape>()("test/SeededConfig") {}

const InMemoryPlatform = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

describe("ConfigFile.testLayer over the in-memory filesystem's scoped temp directories", () => {
  it.layer(InMemoryPlatform, { timeout: "30 seconds" })((it) => {
    it.effect("seeds files, runs the real pipeline over them, and cleans up on scope close", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        let seededPath = "";

        yield* Effect.acquireUseRelease(
          Scope.make(),
          (scope) =>
            Effect.gen(function* () {
              const context = yield* Layer.buildWithScope(
                ConfigFile.testLayer(AppConfig, {
                  schema: AppShape,
                  codec: JsonCodec,
                  strategy: MergeStrategy.firstMatch<AppShape>(),
                  files: { ".apprc": `{"port":4242}` },
                }),
                scope
              );
              yield* Effect.gen(function* () {
                const cfg = yield* AppConfig;
                const sources = yield* cfg.discover;
                assert.strictEqual(sources.length, 1);
                seededPath = sources[0]?.path ?? "";
                assert.notStrictEqual(seededPath, "");
                assert.strictEqual(path.basename(seededPath), ".apprc");
                const exists1 = yield* fs.exists(seededPath);
                assert.strictEqual(exists1, true);
                const value = yield* cfg.load;
                assert.strictEqual(value.port, 4242);
                assert.instanceOf(value, AppShape, "the real decode ran, not a stub: a plain object would fail here");
              }).pipe(Effect.provideContext(context));
            }),
          (scope, exit) => Scope.close(scope, exit)
        );
        const exists2 = yield* fs.exists(seededPath);
        assert.strictEqual(exists2, false, "the inner scope was released before this deletion check");
        const exists3 = yield* fs.exists(path.dirname(seededPath));
        assert.strictEqual(exists3, false, "the finalizer removed the whole temp directory, not just the file");
      })
    );
  });

  it.layer(
    ConfigFile.testLayer(AppConfig, {
      schema: AppShape,
      codec: JsonCodec,
      strategy: MergeStrategy.firstMatch<AppShape>(),
      files: { ".apprc": `{"port":"not-a-number"}` },
    }).pipe(Layer.provide(InMemoryPlatform)),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("surfaces a real schema decode failure as ConfigValidationError", () =>
      Effect.gen(function* () {
        const cfg = yield* AppConfig;
        const result = yield* Effect.flip(cfg.load);

        assert.strictEqual(
          result._tag,
          "ConfigValidationError",
          "no options.validate is set, so this comes from the real schema decode, which a stub cannot produce"
        );
      })
    );
  });
});
