import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { GuardExceeded, GuardMeasurement, GuardReason, InvalidCap } from "@beep/glob/internal/limits";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decode(encode(x)) equals x without failure`,
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
};
describe("guard schema property floor", () => {
  it.effect("round-trips the overflow sentinel and compares measurements", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(GuardMeasurement)(Number.POSITIVE_INFINITY);
      assert.strictEqual(encoded, Number.POSITIVE_INFINITY);
      const decoded = yield* S.decodeEffect(GuardMeasurement)(encoded);
      assert.strictEqual(decoded, Number.POSITIVE_INFINITY);
      const equivalent = S.toEquivalence(GuardMeasurement);
      assert.isTrue(equivalent(decoded, Number.POSITIVE_INFINITY));
      assert.isFalse(equivalent(decoded, 100_000));
    })
  );
  roundTrips("InvalidCap", InvalidCap);
  roundTrips("GuardReason", GuardReason);
  roundTrips("GuardMeasurement", GuardMeasurement);
  roundTrips("GuardExceeded", GuardExceeded);
});
