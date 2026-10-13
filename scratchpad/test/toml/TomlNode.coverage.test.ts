import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { TomlFloat } from "../../effected/toml/TomlNode.ts";

it.effect("float JSON and string-tree codecs preserve finite and non-finite IEEE values", () => Effect.gen(function* () {
  for (const value of [0, 2.5, Infinity, -Infinity, NaN]) {
    const node = TomlFloat.make({ value, offset: 0, length: 3 });
    for (const codec of [S.toCodecJson(TomlFloat), S.toCodecStringTree(TomlFloat)]) {
      const encoded = yield* S.encodeEffect(codec)(node);
      const decoded = yield* S.decodeEffect(codec)(encoded);
      assert.strictEqual(Object.is(decoded.value, value), true);
    }
  }
}));
