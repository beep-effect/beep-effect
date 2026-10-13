import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Glyphs } from "../../../effected/cli/Glyphs.ts";
import { KeyTable } from "../../../effected/cli/ui/KeyTable.ts";
import { KeyName, UiKey } from "../../../effected/cli/ui/UiKey.ts";

const runs = { arbitrary: fcRuns(100) };
const BindingInput = S.Struct({
  keys: S.Array(S.Union([KeyName, S.Struct({ char: S.String })])),
  action: S.String,
  help: S.String,
  hidden: S.optionalKey(S.Boolean),
});
const BindingInputs = S.Array(BindingInput);

it.effect.prop("binding normalization is idempotent and serialization preserves dispatch and help", [BindingInput.pipe(S.Array, Arbitrary.schema)], ([bindings]) =>
  Effect.gen(function* () {
    const table = KeyTable.make(bindings);
    const again = KeyTable.make(table.bindings);
    assert.deepStrictEqual(again.bindings, table.bindings);
    const encoded = yield* S.encodeEffect(BindingInputs)(table.bindings);
    const decoded = yield* S.decodeEffect(BindingInputs)(encoded);
    const restored = KeyTable.make(decoded);
    for (const glyphs of [Glyphs.ascii, Glyphs.unicode]) {
      assert.deepStrictEqual(restored.help(glyphs), table.help(glyphs));
    }
    for (const binding of table.bindings) {
      for (const key of binding.keys) {
        const pressed = P.isString(key) ? UiKey.named(key) : UiKey.char(key.char);
        assert.deepStrictEqual(restored.match(pressed), table.match(pressed));
      }
    }
  }), runs);

it.effect.prop("named help labels retain the bound action and agree with the glyph set", [Arbitrary.schema(KeyName)], ([name]) =>
  Effect.sync(() => {
    const table = KeyTable.make([{ keys: [name], action: name, help: "perform" }]);
    assertSome(table.match(UiKey.named(name)), name);
    assert.lengthOf(table.help(Glyphs.ascii), 1);
    assert.deepStrictEqual(KeyTable.make(table.bindings).help(Glyphs.unicode), table.help(Glyphs.unicode));
  }), runs);
