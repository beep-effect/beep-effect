import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(value, decoded));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { TomlEdit, TomlRange } from "../../effected/toml/TomlEdit.ts";
describe("edit vocabulary", () => {
  roundTrips("edit encode/decode", TomlEdit);
  roundTrips("range encode/decode", TomlRange);
  it.effect.prop("insertion preserves every untouched byte and edit order", [Arbitrary.schema(S.String), Arbitrary.schema(S.String), Arbitrary.schema(S.String)], ([before, content, after]) => Effect.sync(() => {
    const edits = [TomlEdit.make({ offset: before.length, length: 0, content })];
    assert.strictEqual(TomlEdit.applyAll(before + after, edits), before + content + after);
    assert.deepStrictEqual(edits, [TomlEdit.make({ offset: before.length, length: 0, content })]);
  }), runs);
});
