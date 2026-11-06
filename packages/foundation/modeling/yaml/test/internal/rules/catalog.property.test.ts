import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { builtinOptionsEntries } from "@beep/yaml/internal/rules/catalog";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
for (const [id, schema] of builtinOptionsEntries) {
  it.effect.prop(
    `catalog ${id}: encode/decode preserves options and decoding never fails`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
}
