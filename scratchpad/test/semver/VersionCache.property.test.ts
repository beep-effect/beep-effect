import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { EmptyCacheError, VersionNotFoundError, UnsatisfiedRangeError } from "../../effected/semver/VersionCache.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: encoding then decoding preserves the value and never fails`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(value, decoded));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

describe("VersionCache property floor", () => {
roundTrips("EmptyCacheError", EmptyCacheError);
roundTrips("VersionNotFoundError", VersionNotFoundError);
roundTrips("UnsatisfiedRangeError", UnsatisfiedRangeError);
});
