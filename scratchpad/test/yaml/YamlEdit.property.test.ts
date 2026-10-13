import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { YamlEdit, YamlRange } from "../../effected/yaml/YamlEdit.ts";
describe("edit schema round trips", () => {
  roundTrips("edits", YamlEdit);
  roundTrips("ranges", YamlRange);
  it.effect.prop("replacement preserves both surrounding spans and does not mutate edits", [Arbitrary.schema(S.String), Arbitrary.schema(S.String), Arbitrary.schema(S.String), Arbitrary.schema(S.String)], ([before, old, after, next]) => Effect.sync(() => {
    const edit = YamlEdit.make({ offset: before.length, length: old.length, content: next });
    const edits = [edit];
    assert.strictEqual(YamlEdit.applyAll(before + old + after, edits), before + next + after);
    assert.deepStrictEqual(edits, [edit]);
  }), runs);
});
