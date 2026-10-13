import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { SemVer, InvalidVersionError, SemVerBumpComponent, SemVerBumpOverflowError } from "../../effected/semver/SemVer.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: encoding then decoding preserves the value and never fails`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(value, decoded));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

describe("SemVer property floor", () => {
roundTrips("SemVer", SemVer);
roundTrips("SemVer.FromString", SemVer.FromString);
roundTrips("InvalidVersionError", InvalidVersionError);
roundTrips("SemVerBumpComponent", SemVerBumpComponent);
roundTrips("SemVerBumpOverflowError", SemVerBumpOverflowError);
it.effect.prop("parse and parseResult preserve every identifier and formatting is idempotent", [Arbitrary.schema(SemVer)], ([value]) => Effect.gen(function* () {
  const text = value.toString();
  assert.strictEqual(inspect(value), text);
  const parsed = yield* SemVer.parse(` ${text} `);
  assert.deepStrictEqual(yield* S.encodeEffect(SemVer)(parsed), yield* S.encodeEffect(SemVer)(value));
  assert.strictEqual(parsed.toString(), text);
  const again = yield* Effect.fromResult(SemVer.parseResult(parsed.toString()));
  assert.deepStrictEqual(yield* S.encodeEffect(SemVer)(again), yield* S.encodeEffect(SemVer)(parsed));
}), runs);
});

// Constructive pattern hints make the opaque isValid/isPinnable refinements generatable.
const exactSamples = SemVer.ExactVersionString.check(S.isPattern(/^[1-9][0-9]{0,3}\.[0-9]\.[0-9](-alpha\.[0-9])?(\+build\.[0-9])?$/));
const pinnableSamples = SemVer.PinnableVersionString.check(S.isPattern(/^[1-9][0-9]{0,3}\.[0-9]\.[0-9](-alpha\.[0-9])?$/));
for (const [name, schema, samples] of [
  ["ExactVersionString", SemVer.ExactVersionString, exactSamples],
  ["PinnableVersionString", SemVer.PinnableVersionString, pinnableSamples],
] as const) {
  it.effect.prop(`${name}: encoded strings decode unchanged and formatting preserves them`, [Arbitrary.schema(samples)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.strictEqual(decoded, value);
    assert.strictEqual((yield* SemVer.parse(decoded)).toString(), value);
  }), runs);
}

const inspect = (value: unknown): unknown => {
  const key = Symbol.for("nodejs.util.inspect.custom");
  if (P.hasProperty(value, key) && P.isFunction(value[key])) return value[key].call(value);
  return assert.fail("Expected a custom inspection method");
};
