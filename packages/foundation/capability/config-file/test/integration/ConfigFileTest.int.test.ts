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

// The in-memory filesystem implements the scoped temp-directory lifecycle the
// test layer relies on, so the suite exercises the real pipeline without
// touching the host disk (EV010).
const Platform = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

describe("ConfigFile.testLayer", () => {
  it.layer(Platform, { timeout: "30 seconds" })((it) => {
    it.effect("seeds files, runs the real pipeline over them, and cleans up on scope close", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        let seededPath = "";

        // This inner lifetime is the subject: release before checking deletion.
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
                // The REAL decode ran, not a stub: a plain object would fail here.
                assert.instanceOf(value, AppShape);
              }).pipe(Effect.provideContext(context));
            }),
          (scope, exit) => Scope.close(scope, exit)
        );
        // The finalizer removed the whole temp directory, not just the file.
        const exists2 = yield* fs.exists(seededPath);
        assert.strictEqual(exists2, false);
        const exists3 = yield* fs.exists(path.dirname(seededPath));
        assert.strictEqual(exists3, false);
      })
    );
  });

  // No `options.validate` is supplied here: the failure comes from the schema
  // itself, decoded through the real pipeline the test layer wires up.
  it.layer(
    ConfigFile.testLayer(AppConfig, {
      schema: AppShape,
      codec: JsonCodec,
      strategy: MergeStrategy.firstMatch<AppShape>(),
      files: { ".apprc": `{"port":"not-a-number"}` },
    }).pipe(Layer.provide(Platform)),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("surfaces a real schema decode failure as ConfigValidationError", () =>
      Effect.gen(function* () {
        const cfg = yield* AppConfig;
        const result = yield* Effect.flip(cfg.load);

        // A stubbed layer could not produce this: it comes from the real schema decode.
        assert.strictEqual(result._tag, "ConfigValidationError");
      })
    );
  });
});
