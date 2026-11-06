import { builtinOptionsEntries, builtinOptionsSchemas, builtinRules } from "@beep/yaml/internal/rules/catalog";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";

it.effect("catalog preserves rule order and validates every built-in's default options", () =>
  Effect.gen(function* () {
    assert.deepStrictEqual(
      A.map(builtinRules, (rule) => rule.id),
      A.map(builtinOptionsEntries, ([id]) => id)
    );
    assert.strictEqual(HashMap.size(builtinOptionsSchemas), builtinRules.length);
    assert.strictEqual(builtinRules[0]?.id, "parse-validity");
    for (const [id, schema] of builtinOptionsEntries) {
      assert.isTrue(HashMap.has(builtinOptionsSchemas, id));
      const value = yield* S.decodeEffect(schema)({});
      assert.deepStrictEqual(value, {});
    }
  })
);
