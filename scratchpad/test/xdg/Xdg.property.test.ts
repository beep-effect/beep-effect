import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Xdg, XdgPlatform, XdgPaths, XdgEnvError } from "../../effected/xdg/Xdg.ts";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decode(encode(x)) equals x and decoding never fails`,
    [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }),
    runs,
  );
};

describe("Xdg schema laws", () => {
  roundTrips("XdgPlatform", XdgPlatform);
  roundTrips("XdgPaths", XdgPaths);
  roundTrips("XdgEnvError", XdgEnvError);

  it.effect.prop(
    "search-path normalization is idempotent and preserves every nonempty entry in order",
    [Arbitrary.schema(S.String)],
    ([raw]) => Effect.scopedWith((scope) => Effect.gen(function* () {
      const parse = Effect.fn("parse")(function* (text: string) {
        const layer = Xdg.layer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({
          HOME: "/home/test", XDG_CONFIG_DIRS: text, XDG_DATA_DIRS: text,
        }))));
        const context = yield* Layer.buildWithScope(layer, scope);
        return yield* Xdg.pipe(Effect.provideContext(context));
      });
      const parsed = yield* parse(raw);
      const entries = A.filter(Str.split(raw, ":"), Str.isNonEmpty);
      assert.deepStrictEqual(parsed.configDirs, entries.length === 0 ? ["/etc/xdg"] : entries);
      assert.deepStrictEqual(parsed.dataDirs, entries.length === 0 ? ["/usr/local/share", "/usr/share"] : entries);
      const configText = A.join(parsed.configDirs, ":");
      const reparsedConfig = yield* parse(configText);
      assert.deepStrictEqual(reparsedConfig.configDirs, parsed.configDirs);
      assert.strictEqual(A.join(reparsedConfig.configDirs, ":"), configText);
      const dataText = A.join(parsed.dataDirs, ":");
      const reparsedData = yield* parse(dataText);
      assert.deepStrictEqual(reparsedData.dataDirs, parsed.dataDirs);
      assert.strictEqual(A.join(reparsedData.dataDirs, ":"), dataText);
    })),
    runs,
  );
});
