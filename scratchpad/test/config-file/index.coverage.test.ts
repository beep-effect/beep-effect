import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as ConfigFileModule from "../../effected/config-file/index.ts";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";
import { TomlCodec } from "../../effected/config-file/TomlCodec.ts";
import { YamlCodec } from "../../effected/config-file/YamlCodec.ts";

describe("config-file barrel owned exports", () => {
  it.effect("exports the original codec and merge-strategy objects with working behavior", () =>
    Effect.gen(function* () {
      assert.strictEqual(ConfigFileModule.TomlCodec, TomlCodec);
      assert.strictEqual(ConfigFileModule.YamlCodec, YamlCodec);
      assert.strictEqual(ConfigFileModule.MergeStrategy, MergeStrategy);
      assert.deepStrictEqual(yield* ConfigFileModule.TomlCodec.parse("port = 8080"), { port: 8080 });
      assert.deepStrictEqual(yield* ConfigFileModule.YamlCodec.parse("port: 8080"), { port: 8080 });
      assert.strictEqual(yield* ConfigFileModule.MergeStrategy.firstMatch<number>().resolve([
        { path: "/local", resolver: "local", value: 8080 },
        { path: "/base", resolver: "base", value: 3000 },
      ]), 8080);
    }));
});
