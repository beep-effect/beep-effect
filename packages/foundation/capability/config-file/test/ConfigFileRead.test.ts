import { ConfigCodecError } from "@beep/config-file/ConfigCodec";
import { ConfigFile, ConfigFileReadError, ConfigValidationError } from "@beep/config-file/ConfigFile";
import { JsonCodec } from "@beep/config-file/JsonCodec";
import { JsoncCodec } from "@beep/config-file/JsoncCodec";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type * as FileSystem from "effect/FileSystem";

const JsonValue = S.fromJsonString(S.Unknown);

class AppShape extends S.Class<AppShape, { readonly brand: unique symbol }>("AppShape")({ port: S.Finite }) {}

class OpaqueApp extends S.Opaque<OpaqueApp, { readonly brand: unique symbol }>()(S.Struct({ port: S.Finite })) {}

const platform = (files: Record<string, string>): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
  Layer.mergeAll(MemoryFileSystem.layerWith(files), Path.layer);

describe("ConfigFile.read", () => {
  it.layer(platform({ "/app/.apprc": `{"port":8080}` }), { timeout: "30 seconds" })((it) => {
    it.effect("reads, decodes and validates one explicit path", () =>
      Effect.gen(function* () {
        const value = yield* ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsonCodec });
        assert.strictEqual(value.port, 8080);
        assert.instanceOf(value, AppShape, "the decoded value is a real class instance, as loadFrom gives");
      })
    );
  });

  it.layer(platform({ "/app/opaque.jsonc": `{ "port": 7, /* trailing comma */ }` }), { timeout: "30 seconds" })(
    (it) => {
      it.effect("decodes through an S.Opaque schema and types the value as the opaque type", () =>
        Effect.gen(function* () {
          const value: OpaqueApp = yield* ConfigFile.read("/app/opaque.jsonc", {
            schema: OpaqueApp,
            codec: JsoncCodec,
          });
          assert.deepStrictEqual(value, OpaqueApp.make({ port: 7 }));
        })
      );
    }
  );

  it.layer(platform({ "/etc/app.json": `{"port":1}` }), { timeout: "30 seconds" })((it) => {
    it.effect("needs no service class, no layer and no tag", () =>
      Effect.gen(function* () {
        const value = yield* ConfigFile.read("/etc/app.json", { schema: AppShape, codec: JsonCodec });
        assert.strictEqual(value.port, 1);
      })
    );
  });

  it.layer(platform({}), { timeout: "30 seconds" })((it) => {
    it.effect("a missing file fails with ConfigFileReadError, carrying the path", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(ConfigFile.read("/nope.json", { schema: AppShape, codec: JsonCodec }));
        assert.instanceOf(error, ConfigFileReadError);
        assert.strictEqual(error.path, "/nope.json");
      })
    );
  });

  it.layer(platform({ "/app/.apprc": "{ not json" }), { timeout: "30 seconds" })((it) => {
    it.effect("unparseable content fails with ConfigCodecError", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsonCodec }));
        assert.instanceOf(error, ConfigCodecError);
      })
    );
  });

  it.layer(platform({ "/app/.apprc": `{"port":"nope"}` }), { timeout: "30 seconds" })((it) => {
    it.effect("a schema mismatch fails with ConfigValidationError carrying the STRUCTURED issue", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsonCodec }));
        assert.instanceOf(error, ConfigValidationError);
        assert.isDefined(error.issue);
        assert.strictEqual(
          O.getOrUndefined(error.schemaIssue),
          error.issue,
          "the issue tree rides structurally, never stringified into a reason"
        );
      })
    );
  });

  it.layer(platform({ "/app/.apprc": `{"port":"nope"}` }), { timeout: "30 seconds" })((it) => {
    it.effect("the path is recorded on a validation failure", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsonCodec }));
        assert.instanceOf(error, ConfigValidationError, "a one-shot read always knows its path, unlike validate");
        assertSome(error.path, "/app/.apprc");
      })
    );
  });

  it.layer(platform({ "/app/.apprc": `{ /* the port */ "port": 3000 }` }), { timeout: "30 seconds" })((it) => {
    it.effect("the codec is an explicit argument — JSONC comments parse under JsoncCodec", () =>
      Effect.gen(function* () {
        const value = yield* ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsoncCodec });
        assert.strictEqual(
          value.port,
          3000,
          "the codec is a parameter, so a JSON-only caller never references other codecs"
        );
      })
    );
  });

  it.layer(platform({ "/app/.apprc": `{"port":8080,"name":"app"}` }), { timeout: "30 seconds" })((it) => {
    it.effect("the SAME path can be read through two different schemas", () =>
      Effect.gen(function* () {
        class NameShape extends S.Class<NameShape, { readonly brand: unique symbol }>("NameShape")({
          name: S.String,
        }) {}
        const asPort = yield* ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsonCodec });
        const asName = yield* ConfigFile.read("/app/.apprc", { schema: NameShape, codec: JsonCodec });
        assert.strictEqual(asPort.port, 8080);
        assert.strictEqual(
          asName.name,
          "app",
          "schema is per call, which ConfigFile.layer needs a second service class for"
        );
      })
    );
  });
  describe("parseOptions", () => {
    const withExtra = { "/app/.apprc": `{"port":8080,"removedCredential":"stale"}` };

    it.layer(platform(withExtra), { timeout: "30 seconds" })((it) => {
      it.effect("drops unknown keys silently by default", () =>
        Effect.gen(function* () {
          const value = yield* ConfigFile.read("/app/.apprc", { schema: AppShape, codec: JsonCodec });
          assert.strictEqual(value.port, 8080);
        })
      );
    });

    it.layer(platform(withExtra), { timeout: "30 seconds" })((it) => {
      it.effect("onExcessProperty error rejects a leftover field and names its path", () =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            ConfigFile.read("/app/.apprc", {
              schema: AppShape,
              codec: JsonCodec,
              parseOptions: { onExcessProperty: "error" },
            })
          );
          assert.instanceOf(error, ConfigValidationError);
          assert.include(
            Result.getOrThrow(S.encodeResult(JsonValue)(error.issue)),
            "removedCredential",
            "a loader that drops part of a file cannot report a typo'd or removed field"
          );
        })
      );
    });

    it.layer(platform({ "/app/.apprc": `{"port":8080}` }), { timeout: "30 seconds" })((it) => {
      it.effect("onExcessProperty error leaves a clean document alone", () =>
        Effect.gen(function* () {
          const value = yield* ConfigFile.read("/app/.apprc", {
            schema: AppShape,
            codec: JsonCodec,
            parseOptions: { onExcessProperty: "error" },
          });
          assert.strictEqual(value.port, 8080);
        })
      );
    });

    it.layer(platform({ "/app/.apprc": `{"port":8080,"anything":"goes"}` }), { timeout: "30 seconds" })((it) => {
      it.effect("a rest switches excess checking off for its struct, not just for the keys it covers", () =>
        Effect.gen(function* () {
          const Passthrough = S.StructWithRest(S.Struct({ port: S.Finite }), [S.Record(S.String, S.Unknown)]);
          const value = yield* ConfigFile.read("/app/.apprc", {
            schema: Passthrough,
            codec: JsonCodec,
            parseOptions: { onExcessProperty: "error" },
          });
          assert.strictEqual(value.port, 8080, "a pass-through schema keeps working under onExcessProperty error");
          assert.strictEqual(
            value.anything,
            "goes",
            "a Record rest skips the excess pass for the whole struct, not only its keys"
          );
        })
      );
    });
  });
});
