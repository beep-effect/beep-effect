import { assert, describe, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Scope from "effect/Scope";
import * as S from "effect/Schema";
import { ConfigEvents } from "../../effected/config-file/ConfigEvent.ts";
import { ConfigFile, ConfigValidationError } from "../../effected/config-file/ConfigFile.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";

const Document = S.Struct({ port: S.Finite });
class Service extends ConfigFile.Service<Service, typeof Document.Type>()("coverage/ConfigFile") {}
const platform = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

it.layer(platform, { timeout: "30 seconds" })((it) => {
  describe("seeded config lifecycle", () => {
    it.effect("seeds nested files, validates them and removes the directory at release", () => Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      let seeded = "";
      let validations = 0;
      yield* Effect.acquireUseRelease(Scope.make(), (scope) => Effect.gen(function* () {
        const context = yield* Layer.buildWithScope(ConfigFile.testLayer(Service, {
          schema: Document, codec: JsonCodec, strategy: MergeStrategy.firstMatch(),
          files: { "nested/config.json": '{"port":4242}' },
          validate: (value) => Effect.sync(() => { validations += 1; return value; }),
        }), scope);
        const config = Context.get(context, Service);
        const sources = yield* config.discover;
        for (const source of sources) seeded = source.path;
        assert.strictEqual(path.basename(seeded), "config.json");
        assert.isTrue(yield* fs.exists(seeded));
        assert.deepStrictEqual(yield* config.load, { port: 4242 });
        assert.strictEqual(validations, 2);
      }), (scope, exit) => Scope.close(scope, exit));
      assert.isFalse(yield* fs.exists(seeded));
      assert.isFalse(yield* fs.exists(path.dirname(path.dirname(seeded))));
    }));

  });
});

it.layer(ConfigFile.testLayer(Service, {
  schema: Document, codec: JsonCodec, strategy: MergeStrategy.firstMatch(), files: {},
}).pipe(Layer.provide(platform)), { timeout: "30 seconds" })((it) => {
  it.effect("an empty seed reports not found and rejects save without a default path", () => Effect.gen(function* () {
    const config = yield* Service;
    assert.strictEqual((yield* Effect.flip(config.load))._tag, "ConfigFileNotFoundError");
    assert.strictEqual((yield* Effect.flip(config.save({ port: 1 })))._tag, "ConfigDefaultPathMissingError");
  }));
});

it.layer(ConfigFile.testLayer(Service, {
  schema: Document, codec: JsonCodec, strategy: MergeStrategy.firstMatch(), files: { "config.json": '{"port":1}' },
  validate: () => Effect.fail(ConfigValidationError.make({ path: O.some("custom"), issue: "rejected" })),
}).pipe(Layer.provide(platform)), { timeout: "30 seconds" })((it) => {
  it.effect("seeded validation can reject decoded content", () => Effect.gen(function* () {
    const config = yield* Service;
    const error = yield* Effect.flip(config.load);
    assert.strictEqual(error._tag, "ConfigValidationError");
    assert.strictEqual(error.message, 'Config validation failed at "custom"');
  }));
});

it.layer(ConfigFile.layer(Service, {
  schema: Document, codec: JsonCodec, strategy: MergeStrategy.firstMatch(), resolvers: [], events: ConfigEvents,
}).pipe(Layer.provideMerge(platform)), { timeout: "30 seconds" })((it) => {
  it.effect("an optional event key without a supplied service does not prevent writes", () => Effect.gen(function* () {
    const config = yield* Service;
    const fs = yield* FileSystem.FileSystem;
    yield* fs.makeDirectory("/app");
    yield* config.write({ port: 3 }, "/app/config.json");
    assert.deepStrictEqual(yield* ConfigFile.read("/app/config.json", { schema: Document, codec: JsonCodec }), { port: 3 });
  }));
});

import { ConfigDefaultPathMissingError, ConfigFileNotFoundError, ConfigFileReadError, ConfigFileWriteError } from "../../effected/config-file/ConfigFile.ts";

it.effect("error messages retain paths, plural candidate counts and in-memory validation context", () => Effect.sync(() => {
  assert.strictEqual(ConfigFileReadError.make({ path: "/read", cause: "denied" }).message, 'Failed to read config file at "/read"');
  assert.strictEqual(ConfigFileWriteError.make({ path: "/write", cause: "denied" }).message, 'Failed to write config file at "/write"');
  assert.strictEqual(ConfigDefaultPathMissingError.make({}).message, "No `defaultPath` configured: `save` and `update` require ConfigFileOptions.defaultPath");
  assert.strictEqual(ConfigValidationError.make({ path: O.none(), issue: "invalid" }).message, "Config validation failed");
  assert.strictEqual(ConfigFileNotFoundError.make({ searched: ["one", "two"], candidates: ["/a", "/b"] }).message, "No config file found (searched: one, two — 2 candidate paths checked)");
}));

it.effect("the exported static facade remains constructible for JavaScript consumers", () => Effect.sync(() => {
  assert.isTrue(Reflect.construct(ConfigFile, []) instanceof ConfigFile);
}));

import { ConfigCodecError } from "../../effected/config-file/ConfigCodec.ts";
import * as PlatformError from "effect/PlatformError";

it.layer(ConfigFile.layer(Service, {
  schema: Document, codec: JsonCodec, strategy: MergeStrategy.firstMatch(),
  resolvers: [{ name: "match-only", resolve: Effect.succeedSome("/matched.json"), resolveMatch: Effect.succeedSome({ path: "/matched.json", dir: "/" }) }],
}).pipe(Layer.provide(Layer.mergeAll(MemoryFileSystem.layerWith({ "/matched.json": '{"port":7}' }), Path.layer))), { timeout: "30 seconds" })((it) => {
  it.effect("discovery uses match-only resolver metadata and loadOrDefault uses the found value", () => Effect.gen(function* () {
    const config = yield* Service;
    assert.deepStrictEqual(yield* config.loadOrDefault({ port: 99 }), { port: 7 });
    const sources = yield* config.discover;
    assert.deepStrictEqual(sources, [{ path: "/matched.json", resolver: "match-only", match: { path: "/matched.json", dir: "/" }, value: { port: 7 } }]);
  }));
});

const previouslyPathed = ConfigCodecError.make({ codec: "custom", operation: "parse", cause: "bad", path: "/original" });
it.layer(MemoryFileSystem.layerWith({ "/input": "bad" }), { timeout: "30 seconds" })((it) => {
  it.effect("a codec's existing path survives one-shot reading", () => Effect.gen(function* () {
    const error = yield* Effect.flip(ConfigFile.read("/input", {
      schema: Document, codec: { name: "custom", parse: () => Effect.fail(previouslyPathed), stringify: JsonCodec.stringify },
    }));
    assert.strictEqual(error, previouslyPathed);
    assert.strictEqual(error.message, "custom parse failed");
  }));
});

it.layer(ConfigFile.layer(Service, {
  schema: S.Struct({ port: S.Finite.check(S.isGreaterThan(0)) }), codec: JsonCodec,
  strategy: MergeStrategy.firstMatch(), resolvers: [],
}).pipe(Layer.provide(platform)), { timeout: "30 seconds" })((it) => {
  it.effect("write reports schema encode rejection as validation rather than codec failure", () => Effect.gen(function* () {
    const config = yield* Service;
    const error = yield* Effect.flip(config.write({ port: 0 }, "/unwritten"));
    assert.strictEqual(error._tag, "ConfigValidationError");
    assert.strictEqual(error.message, 'Config validation failed at "/unwritten"');
  }));
});

const deniedDirectory = PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "makeDirectory", pathOrDescriptor: "/blocked" });
it.layer(ConfigFile.layer(Service, {
  schema: Document, codec: JsonCodec, strategy: MergeStrategy.firstMatch(), resolvers: [], defaultPath: Effect.succeed("/blocked/config.json"),
}).pipe(Layer.provide(Layer.mergeAll(MemoryFileSystem.layerWith({}, { faults: { makeDirectory: () => Effect.fail(deniedDirectory) } }), Path.layer))), { timeout: "30 seconds" })((it) => {
  it.effect("save preserves the directory creation failure and destination", () => Effect.gen(function* () {
    const config = yield* Service;
    const error = yield* Effect.flip(config.save({ port: 1 }));
    assert.isTrue(S.is(ConfigFileWriteError)(error));
    if (S.is(ConfigFileWriteError)(error)) {
      assert.strictEqual(error.cause, deniedDirectory);
      assert.strictEqual(error.path, "/blocked/config.json");
    }
  }));
});

it.effect("not-found messages omit candidate counts when custom resolvers report no probe paths", () => Effect.sync(() => {
  assert.strictEqual(ConfigFileNotFoundError.make({ searched: ["custom"], candidates: [] }).message, "No config file found (searched: custom)");
}));
