import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { IeeeNumber } from "@beep/schema/IeeeNumber";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

it.effect("IEEE JSON and string-tree codecs preserve finite and non-finite values", () =>
  Effect.gen(function* () {
    for (const value of [0, -12.5, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
      for (const codec of [S.toCodecJson(IeeeNumber), S.toCodecStringTree(IeeeNumber)]) {
        const encoded = yield* S.encodeEffect(codec)(value);
        const decoded = yield* S.decodeEffect(codec)(encoded);
        assert.strictEqual(Object.is(decoded, value), true);
      }
    }
    assert.strictEqual(yield* Effect.isFailure(S.decodeUnknownEffect(IeeeNumber)("1")), true);
  })
);

describe("IeeeNumber codec property", () => {
  it.effect.prop(
    "IeeeNumber round-trips through its codec",
    [Arbitrary.schema(IeeeNumber)],
    ([value]) =>
      Effect.gen(function* () {
        assert.deepStrictEqual(yield* S.decodeEffect(IeeeNumber)(yield* S.encodeEffect(IeeeNumber)(value)), value);
      }),
    { arbitrary: fcRuns(100) }
  );
});
