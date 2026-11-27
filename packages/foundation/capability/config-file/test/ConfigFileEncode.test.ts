import { ConfigCodecError } from "@beep/config-file/ConfigCodec";
import { ConfigEvents } from "@beep/config-file/ConfigEvent";
import { ConfigFile, ConfigValidationError } from "@beep/config-file/ConfigFile";
import { JsonCodec } from "@beep/config-file/JsonCodec";
import { MergeStrategy } from "@beep/config-file/MergeStrategy";
import { TomlCodec } from "@beep/config-file/TomlCodec";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PubSub from "effect/PubSub";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";
import type { ConfigCodec as ConfigCodecShape } from "@beep/config-file/ConfigCodec";
import type { ConfigEncodeError, ConfigWriteError } from "@beep/config-file/ConfigFile";

const JsonValue = S.fromJsonString(S.Unknown);

const platformWithTargetDirs = (): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
  Layer.mergeAll(
    MemoryFileSystem.layerWith({
      "/out": MemoryFileSystem.directory(),
      "/x": MemoryFileSystem.directory(),
      "/legacy": MemoryFileSystem.directory(),
    }),
    Path.layer
  );

class Doc extends S.Class<Doc, { readonly brand: unique symbol }>("Doc")({ name: S.String, port: S.Finite }) {}
class DocConfig extends ConfigFile.Service<DocConfig, Doc>()("test/EncodeConfig") {}

const layerFor = (codec: ConfigCodecShape) =>
  ConfigFile.layer(DocConfig, {
    schema: Doc,
    codec,
    resolvers: [],
    strategy: MergeStrategy.firstMatch<Doc>(),
  }).pipe(Layer.provideMerge(platformWithTargetDirs()));

const HEADER = "#:schema https://example/schema.json";
const value = Doc.make({ name: "svc", port: 8080 });

const encodeAndWrite = Effect.fn("encodeAndWrite")(function* (target: string, options?: { readonly header?: string }) {
  const cfg = yield* DocConfig;
  const fs = yield* FileSystem.FileSystem;
  const encoded = yield* cfg.encode(value, options);
  yield* cfg.write(value, target, options);
  const written = yield* fs.readFileString(target);
  return { encoded, written };
});

describe("ConfigFile.encode", () => {
  const broken: ConfigCodecShape = {
    name: "broken",
    parse: JsonCodec.parse,
    stringify: () =>
      Effect.fail(
        ConfigCodecError.make({
          codec: "broken",
          operation: "stringify",
          cause: new Error("nope"),
        })
      ),
  };
  const eventful = Layer.mergeAll(
    ConfigEvents.layer,
    ConfigFile.layer(DocConfig, {
      schema: Doc,
      codec: broken,
      resolvers: [],
      strategy: MergeStrategy.firstMatch<Doc>(),
      events: ConfigEvents,
    }).pipe(Layer.provide(platformWithTargetDirs()))
  );

  it.layer(layerFor(TomlCodec), { timeout: "30 seconds" })((it) => {
    it.effect("produces byte-for-byte what write puts on disk (TOML)", () =>
      Effect.gen(function* () {
        const { encoded, written } = yield* encodeAndWrite("/out/config.toml");
        assert.strictEqual(encoded, written, "write never mkdirs, so platformWithTargetDirs pre-creates /out");
        assert.include(encoded, "port = 8080", "a content control, so an empty-string pair cannot pass");
      })
    );
  });

  it.layer(layerFor(JsonCodec), { timeout: "30 seconds" })((it) => {
    it.effect("produces byte-for-byte what write puts on disk (JSON)", () =>
      Effect.gen(function* () {
        const { encoded, written } = yield* encodeAndWrite("/out/config.json");
        assert.strictEqual(encoded, written, "provideMerge lets the test body read the volume the service writes");
        assertSuccess(S.decodeResult(JsonValue)(encoded), {
          name: "svc",
          port: 8080,
        });
      })
    );
  });

  it.layer(layerFor(TomlCodec), { timeout: "30 seconds" })((it) => {
    it.effect("prepends the header verbatim, one newline, then the document — on both paths", () =>
      Effect.gen(function* () {
        const cfg = yield* DocConfig;
        const bare = yield* cfg.encode(value);
        const { encoded, written } = yield* encodeAndWrite("/out/config.toml", {
          header: HEADER,
        });
        assert.strictEqual(encoded, `${HEADER}\n${bare}`);
        assert.strictEqual(written, encoded);
        assert.isTrue(
          Str.startsWith(`${HEADER}\n`)(encoded),
          "exactly one newline separates the header from the document"
        );
        assert.isFalse(Str.startsWith(`${HEADER}\n\n`)(encoded));
      })
    );
  });

  it.layer(layerFor(TomlCodec), { timeout: "30 seconds" })((it) => {
    it.effect("does not double the newline when the header already ends in one", () =>
      Effect.gen(function* () {
        const cfg = yield* DocConfig;
        const bare = yield* cfg.encode(value);
        const withNewline = yield* cfg.encode(value, {
          header: `${HEADER}\n`,
        });
        const without = yield* cfg.encode(value, { header: HEADER });
        assert.strictEqual(withNewline, `${HEADER}\n${bare}`);
        assert.strictEqual(withNewline, without);
      })
    );
  });

  it.layer(layerFor(JsonCodec), { timeout: "30 seconds" })((it) => {
    it.effect("fails with ConfigValidationError whose path is none for an invalid value", () =>
      Effect.gen(function* () {
        const cfg = yield* DocConfig;
        const bogus = deliberatelyInvalid<Doc>({
          name: "svc",
          port: "not-a-number",
        });
        const error = yield* Effect.flip(cfg.encode(bogus));
        assert.instanceOf(
          error,
          ConfigValidationError,
          "deliberatelyInvalid skips the constructor, so the schema encode must reject it"
        );
        assert.isTrue(S.is(ConfigValidationError)(error));
        assertNone(error.path);
      })
    );
  });

  it.layer(layerFor(broken), { timeout: "30 seconds" })((it) => {
    it.effect("a stringify failure carries no path from encode but the target path from write", () =>
      Effect.gen(function* () {
        const program = Effect.gen(function* () {
          const cfg = yield* DocConfig;
          const fromEncode = yield* Effect.flip(cfg.encode(value));
          const fromWrite = yield* Effect.flip(cfg.write(value, "/x/config.json"));
          return { fromEncode, fromWrite };
        });
        const { fromEncode, fromWrite } = yield* program;

        assert.instanceOf(fromEncode, ConfigCodecError);
        assert.isTrue(S.is(ConfigCodecError)(fromEncode));
        assert.strictEqual(fromEncode.path, undefined);
        assert.instanceOf(fromWrite, ConfigCodecError);
        assert.isTrue(S.is(ConfigCodecError)(fromWrite));
        assert.strictEqual(fromWrite.path, "/x/config.json");
      })
    );
  });

  it.layer(eventful, { timeout: "30 seconds" })((it) => {
    it.effect("a stringify failure emits StringifyFailed from write but nothing at all from encode", () =>
      Effect.gen(function* () {
        const program = Effect.gen(function* () {
          const svc = yield* ConfigEvents;
          const sub = yield* PubSub.subscribe(svc.events);
          const cfg = yield* DocConfig;

          yield* Effect.flip(cfg.encode(value));
          const afterEncode = yield* PubSub.takeUpTo(sub, Number.MAX_SAFE_INTEGER);

          yield* Effect.flip(cfg.write(value, "/x/config.json"));
          const afterWrite = yield* PubSub.takeUpTo(sub, Number.MAX_SAFE_INTEGER);
          return { afterEncode, afterWrite };
        });
        const { afterEncode, afterWrite } = yield* program;

        assert.deepStrictEqual(
          A.map(afterEncode, (e) => e.event._tag),
          []
        );
        assert.deepStrictEqual(
          A.map(afterWrite, (e) => e.event._tag),
          ["StringifyFailed"],
          "write still publishes, so an empty afterEncode is not a dead subscription"
        );
      })
    );
  });

  it.layer(layerFor(JsonCodec), { timeout: "30 seconds" })((it) => {
    it.effect("write keeps its two-argument form and encode's error type excludes the write error", () =>
      Effect.gen(function* () {
        const cfg = yield* DocConfig;
        const _write: (value: Doc, path: string) => Effect.Effect<void, ConfigWriteError> = cfg.write;
        const _encode: (value: Doc) => Effect.Effect<string, ConfigEncodeError> = cfg.encode;
        yield* _write(value, "/legacy/config.json");
        const fs = yield* FileSystem.FileSystem;
        const argument1 = S.decodeResult(JsonValue);
        const readFileString1 = yield* fs.readFileString("/legacy/config.json");
        assertSuccess(argument1(readFileString1), {
          name: "svc",
          port: 8080,
        });
        const _encode1 = yield* _encode(value);
        const readFileString2 = yield* fs.readFileString("/legacy/config.json");
        assert.strictEqual(_encode1, readFileString2);
      })
    );
  });
});
