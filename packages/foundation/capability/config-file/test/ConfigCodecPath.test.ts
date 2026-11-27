import { ConfigCodecError } from "@beep/config-file/ConfigCodec";
import { ConfigFile } from "@beep/config-file/ConfigFile";
import { ConfigResolver } from "@beep/config-file/ConfigResolver";
import { JsonCodec } from "@beep/config-file/JsonCodec";
import { MergeStrategy } from "@beep/config-file/MergeStrategy";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type * as FileSystem from "effect/FileSystem";

const platform = (files: Record<string, string>): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
  Layer.mergeAll(MemoryFileSystem.layerWith(files), Path.layer);

const Doc = S.Struct({ from: S.String });

class DocConfig extends ConfigFile.Service<DocConfig, typeof Doc.Type>()("test/CodecPathConfig") {}

const discovery = ConfigFile.layer(DocConfig, {
  schema: Doc,
  codec: JsonCodec,
  strategy: MergeStrategy.firstMatch<typeof Doc.Type>(),
  resolvers: [
    ConfigResolver.upwardWalk({
      filenames: [".app.json", "app.json"],
      cwd: "/repo/pkg",
    }),
  ],
  defaultPath: Effect.succeed("/repo/out.json"),
});

class WriteConfig extends ConfigFile.Service<WriteConfig, typeof Doc.Type>()("test/CodecPathWriteConfig") {}

const UnserializableCodec = {
  name: "json",
  parse: JsonCodec.parse,
  stringify: () =>
    Effect.fail(
      ConfigCodecError.make({
        codec: "json",
        operation: "stringify",
        cause: new Error("nope"),
      })
    ),
};

const writing = ConfigFile.layer(WriteConfig, {
  schema: Doc,
  codec: UnserializableCodec,
  strategy: MergeStrategy.firstMatch<typeof Doc.Type>(),
  resolvers: [],
});

describe("ConfigCodecError.path", () => {
  it.layer(discovery.pipe(Layer.provide(platform({ "/repo/pkg/app.json": "{ not json" }))), { timeout: "30 seconds" })(
    (it) => {
      it.effect("names the discovered file that failed to parse", () =>
        Effect.gen(function* () {
          const config = yield* DocConfig;
          const error = yield* Effect.flip(config.load);
          assert.instanceOf(error, ConfigCodecError);
          assert.isTrue(S.is(ConfigCodecError)(error));
          assert.strictEqual(
            error.path,
            "/repo/pkg/app.json",
            "discovery named no path, so the field says which candidate was malformed"
          );
          assert.strictEqual(
            error.message,
            "json parse failed",
            "the path rides in the field only, so a wrapper naming the file prints it once"
          );
          assert.instanceOf(
            error.cause,
            S.SchemaError,
            "attaching the path keeps the original cause structurally, not stringified"
          );
        })
      );
    }
  );

  it.layer(platform({ "/repo/app.json": "{ not json" }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("names the file for the one-shot ConfigFile.read", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(ConfigFile.read("/repo/app.json", { schema: Doc, codec: JsonCodec }));
        assert.instanceOf(error, ConfigCodecError);
        assert.isTrue(S.is(ConfigCodecError)(error));
        assert.strictEqual(error.path, "/repo/app.json");
        assert.instanceOf(error.cause, S.SchemaError);
      })
    );
  });

  it.layer(writing.pipe(Layer.provide(platform({}))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("names the target a stringify failure was headed for", () =>
      Effect.gen(function* () {
        const config = yield* WriteConfig;
        const error = yield* Effect.flip(config.write({ from: "ok" }, "/repo/written.json"));
        assert.instanceOf(error, ConfigCodecError);
        assert.isTrue(S.is(ConfigCodecError)(error));
        assert.strictEqual(error.path, "/repo/written.json");
        assert.instanceOf(error.cause, Error);
        assert.isTrue(error.cause instanceof Error);
        assert.strictEqual(error.cause.message, "nope");
      })
    );
  });

  it.effect("is absent when a codec is driven directly, outside the pipeline", () =>
    Effect.gen(function* () {
      const error = yield* JsonCodec.parse("{ not json").pipe(Effect.asVoid, Effect.flip);
      assert.instanceOf(error, ConfigCodecError);
      assert.isTrue(S.is(ConfigCodecError)(error));
      assert.strictEqual(error.path, undefined);
      assert.strictEqual(error.message, "json parse failed");
    })
  );
});
