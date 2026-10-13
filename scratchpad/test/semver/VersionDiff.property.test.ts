import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { VersionDiff } from "../../effected/semver/VersionDiff.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: encoding then decoding preserves the value and never fails`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(value, decoded));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

describe("VersionDiff property floor", () => {
roundTrips("VersionDiff", VersionDiff);
it.effect.prop("diff formatting agrees with the serialized diff and is repeatable", [Arbitrary.schema(VersionDiff)], ([diff]) => Effect.gen(function* () {
  const text = diff.toString();
  const decoded = yield* S.decodeEffect(VersionDiff)(yield* S.encodeEffect(VersionDiff)(diff));
  assert.strictEqual(decoded.toString(), text);
  assert.strictEqual(text, `${diff.type} (${diff.from.toString()} → ${diff.to.toString()})`);
}), runs);
});
