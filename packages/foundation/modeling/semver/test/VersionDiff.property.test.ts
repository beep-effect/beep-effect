import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { VersionDiff } from "@beep/semver/VersionDiff";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: encoding then decoding preserves the value and never fails`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(value, decoded));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("VersionDiff property floor", () => {
  roundTrips("VersionDiff", VersionDiff);
  it.effect.prop(
    "diff formatting agrees with the serialized diff and is repeatable",
    [Arbitrary.schema(VersionDiff)],
    ([diff]) =>
      Effect.gen(function* () {
        const text = diff.toString();
        const argument = S.decodeEffect(VersionDiff);
        const value2 = yield* S.encodeEffect(VersionDiff)(diff);
        const decoded = yield* argument(value2);
        assert.strictEqual(decoded.toString(), text);
        assert.strictEqual(text, `${diff.type} (${diff.from.toString()} → ${diff.to.toString()})`);
      }),
    runs
  );
});
