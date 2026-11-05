import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { nonNegativeIntegerOption, positiveIntegerOption, ScalarRole } from "@beep/yaml/internal/rules/util";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

describe("util schema properties", () => {
  it.effect.prop(
    "nonNegativeIntegerOption: encoding decodes successfully to the original value",
    [Arbitrary.schema(nonNegativeIntegerOption)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(nonNegativeIntegerOption)(value);
        const decoded = yield* S.decodeEffect(nonNegativeIntegerOption)(encoded);
        assert.isTrue(S.toEquivalence(nonNegativeIntegerOption)(decoded, value));
        const value1 = yield* S.encodeEffect(nonNegativeIntegerOption)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
  it.effect.prop(
    "positiveIntegerOption: encoding decodes successfully to the original value",
    [Arbitrary.schema(positiveIntegerOption)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(positiveIntegerOption)(value);
        const decoded = yield* S.decodeEffect(positiveIntegerOption)(encoded);
        assert.isTrue(S.toEquivalence(positiveIntegerOption)(decoded, value));
        const value2 = yield* S.encodeEffect(positiveIntegerOption)(decoded);
        assert.deepStrictEqual(value2, encoded);
      }),
    runs
  );
  it.effect.prop(
    "ScalarRole: encoding decodes successfully to the original value",
    [Arbitrary.schema(ScalarRole)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(ScalarRole)(value);
        const decoded = yield* S.decodeEffect(ScalarRole)(encoded);
        assert.isTrue(S.toEquivalence(ScalarRole)(decoded, value));
        const value3 = yield* S.encodeEffect(ScalarRole)(decoded);
        assert.deepStrictEqual(value3, encoded);
      }),
    runs
  );
});
