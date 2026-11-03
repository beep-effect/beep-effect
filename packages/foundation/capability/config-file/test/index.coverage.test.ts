import * as ConfigFileModule from "@beep/config-file";
import { MergeStrategy } from "@beep/config-file/MergeStrategy";
import { TomlCodec } from "@beep/config-file/TomlCodec";
import { YamlCodec } from "@beep/config-file/YamlCodec";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

describe("config-file barrel owned exports", () => {
  it.effect("exports the original codec and merge-strategy objects with working behavior", () =>
    Effect.gen(function* () {
      assert.strictEqual(ConfigFileModule.TomlCodec, TomlCodec);
      assert.strictEqual(ConfigFileModule.YamlCodec, YamlCodec);
      assert.strictEqual(ConfigFileModule.MergeStrategy, MergeStrategy);
      const parsed = yield* ConfigFileModule.TomlCodec.parse("port = 8080");
      assert.deepStrictEqual(parsed, { port: 8080 });
      const parsed1 = yield* ConfigFileModule.YamlCodec.parse("port: 8080");
      assert.deepStrictEqual(parsed1, { port: 8080 });
      const resolved = yield* ConfigFileModule.MergeStrategy.firstMatch<number>().resolve([
        { path: "/local", resolver: "local", value: 8080 },
        { path: "/base", resolver: "base", value: 3000 },
      ]);
      assert.strictEqual(resolved, 8080);
    })
  );
});
