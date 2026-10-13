import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name + ": encode/decode preserves values and never fails", [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};
import { ListKeyword } from "../../effected/github-references/ClosingList.ts";
import { KeywordFamily, keywordFamily } from "../../effected/github-references/KeywordFamily.ts";
describe("KeywordFamily property floor", () => {
  roundTrips("KeywordFamily", KeywordFamily);
  it.effect.prop("family projection is idempotent and preserves the keyword stem", [Arbitrary.schema(ListKeyword)], ([keyword]) => Effect.sync(() => {
    const family = keywordFamily(keyword);
    assert.strictEqual(keywordFamily(family), family);
    assertTrue(keyword.startsWith(family));
  }), runs);
});
