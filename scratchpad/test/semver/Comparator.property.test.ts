import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Comparator, InvalidComparatorError } from "../../effected/semver/Comparator.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: encoding then decoding preserves the value and never fails`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(value, decoded));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

describe("Comparator property floor", () => {
roundTrips("Comparator", Comparator);
roundTrips("Comparator.FromString", Comparator.FromString);
roundTrips("InvalidComparatorError", InvalidComparatorError);
it.effect.prop("parse and parseResult preserve canonical comparator formatting", [Arbitrary.schema(Comparator)], ([value]) => Effect.gen(function* () {
  const text = value.toString();
  assert.strictEqual(inspect(value), text);
  const parsed = yield* Comparator.parse(` ${text} `);
  assert.deepStrictEqual(yield* S.encodeEffect(Comparator)(parsed), yield* S.encodeEffect(Comparator)(value));
  assert.strictEqual(parsed.toString(), text);
  const again = yield* Effect.fromResult(Comparator.parseResult(parsed.toString()));
  assert.deepStrictEqual(yield* S.encodeEffect(Comparator)(again), yield* S.encodeEffect(Comparator)(parsed));
}), runs);
});

const inspect = (value: unknown): unknown => {
  const key = Symbol.for("nodejs.util.inspect.custom");
  if (P.hasProperty(value, key) && P.isFunction(value[key])) return value[key].call(value);
  return assert.fail("Expected a custom inspection method");
};
