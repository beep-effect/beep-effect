import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { emptyLinesOptions } from "../../../../effected/yaml/internal/rules/empty-lines.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop(
  "emptyLinesOptions: decode(encode(x)) equals x and decoding never fails",
  [Arbitrary.schema(emptyLinesOptions)],
  ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(emptyLinesOptions)(value);
    const decoded = yield* S.decodeEffect(emptyLinesOptions)(encoded);
    assert.isTrue(S.toEquivalence(emptyLinesOptions)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(emptyLinesOptions)(decoded), encoded);
  }),
  runs,
);
