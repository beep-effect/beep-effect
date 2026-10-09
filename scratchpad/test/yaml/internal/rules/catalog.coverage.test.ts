import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import { builtinRules, builtinOptionsEntries, builtinOptionsSchemas } from "../../../../effected/yaml/internal/rules/catalog.ts";

it.effect("catalog preserves rule order and validates every built-in's default options", () => Effect.gen(function* () {
  assert.deepStrictEqual(A.map(builtinRules, (rule) => rule.id), A.map(builtinOptionsEntries, ([id]) => id));
  assert.strictEqual(HashMap.size(builtinOptionsSchemas), builtinRules.length);
  assert.strictEqual(builtinRules[0]?.id, "parse-validity");
  for (const [id, schema] of builtinOptionsEntries) {
    assert.isTrue(HashMap.has(builtinOptionsSchemas, id));
    assert.deepStrictEqual(yield* S.decodeEffect(schema)({}), {});
  }
}));
