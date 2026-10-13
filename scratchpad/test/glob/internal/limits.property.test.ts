import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { GuardExceeded, GuardMeasurement, GuardReason, InvalidCap } from "../../../effected/glob/internal/limits.ts";
const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x without failure`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
describe("guard schema property floor", () => {
  it.effect("round-trips the overflow sentinel and compares measurements", () => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(GuardMeasurement)(Infinity);
    assert.strictEqual(encoded, Infinity);
    const decoded = yield* S.decodeEffect(GuardMeasurement)(encoded);
    assert.strictEqual(decoded, Infinity);
    const equivalent = S.toEquivalence(GuardMeasurement);
    assert.isTrue(equivalent(decoded, Infinity));
    assert.isFalse(equivalent(decoded, 100_000));
  }));
  roundTrips("InvalidCap", InvalidCap);
  roundTrips("GuardReason", GuardReason);
  roundTrips("GuardMeasurement", GuardMeasurement);
  roundTrips("GuardExceeded", GuardExceeded);
});
