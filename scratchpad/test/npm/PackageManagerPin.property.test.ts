import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { InvalidPackageManagerPinError, PackageManagerPinName, PackageManagerPin } from "../../effected/npm/PackageManagerPin.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: decode(encode(x)) preserves x and never fails`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("PackageManagerPin property floor", () => {
  roundTrips("InvalidPackageManagerPinError", InvalidPackageManagerPinError);
  roundTrips("PackageManagerPinName", PackageManagerPinName);
  roundTrips("PackageManagerPin", PackageManagerPin);
  roundTrips("PackageManagerPin.FromString", PackageManagerPin.FromString);
});

it.effect.prop("FromString round-trip, canonical formatting idempotence and pin fidelity",
  [Arbitrary.schema(PackageManagerPin)], ([pin]) => Effect.gen(function* () {
    const text = yield* S.encodeEffect(PackageManagerPin.FromString)(pin);
    const parsed = yield* S.decodeEffect(PackageManagerPin.FromString)(text);
    assertTrue(S.toEquivalence(PackageManagerPin)(parsed, pin));
    assert.strictEqual(parsed.toString(), text);
    const reparsed = yield* PackageManagerPin.parse(parsed.toString());
    assertTrue(S.toEquivalence(PackageManagerPin)(reparsed, parsed));
    assert.strictEqual(reparsed.toString(), parsed.toString());
    assert.strictEqual(reparsed.bare, `${pin.name}@${pin.version.toString()}`);
    assert.deepStrictEqual(reparsed.version.build, []);
    assert.strictEqual(reparsed.integrity, pin.integrity);
  }), runs);
