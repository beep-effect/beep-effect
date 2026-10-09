import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
import { ConfigFileNotFoundError, ConfigFileReadError, ConfigFileWriteError, ConfigDefaultPathMissingError, ConfigValidationError } from "../../effected/config-file/ConfigFile.ts";

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name + ": decoding an encoded value succeeds and recovers the value", [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("ConfigFile schema properties", () => {
  roundTrips("ConfigFileNotFoundError", ConfigFileNotFoundError);
  roundTrips("ConfigFileReadError", ConfigFileReadError);
  roundTrips("ConfigFileWriteError", ConfigFileWriteError);
  roundTrips("ConfigDefaultPathMissingError", ConfigDefaultPathMissingError);
  roundTrips("ConfigValidationError", ConfigValidationError);
});

import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { ConfigFile } from "../../effected/config-file/ConfigFile.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";

class JsonConfig extends ConfigFile.Service<JsonConfig, S.Json>()("property/JsonConfig") {}
const jsonPlatform = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);
it.layer(ConfigFile.layer(JsonConfig, {
  schema: S.Json, codec: JsonCodec, resolvers: [], strategy: MergeStrategy.firstMatch(),
}).pipe(Layer.provideMerge(jsonPlatform)), { timeout: "30 seconds" })((it) => {
  it.effect.prop("ConfigFile encode/write/read preserves schema values and its formatting is idempotent", [Arbitrary.schema(S.Json)], ([value]) =>
    Effect.gen(function* () {
      const config = yield* JsonConfig;
      const fs = yield* FileSystem.FileSystem;
      const encoded = yield* config.encode(value);
      yield* config.write(value, "/property.json");
      assert.strictEqual(yield* fs.readFileString("/property.json"), encoded);
      const parsed = yield* ConfigFile.read("/property.json", { schema: S.Json, codec: JsonCodec });
      assert.isTrue(S.toEquivalence(S.Json)(parsed, value));
      assert.strictEqual(yield* config.encode(parsed), encoded);
      yield* config.write(parsed, "/property.json");
      assert.isTrue(S.toEquivalence(S.Json)(yield* config.loadFrom("/property.json"), parsed));
    }), runs);
});
