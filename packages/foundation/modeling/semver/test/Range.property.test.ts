import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Comparator } from "@beep/semver/Comparator";
import { InvalidRangeError, Range, UnsatisfiableConstraintError } from "@beep/semver/Range";
import { SemVer } from "@beep/semver/SemVer";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
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

describe("Range property floor", () => {
  roundTrips("Range", Range);
  roundTrips("InvalidRangeError", InvalidRangeError);
  roundTrips("UnsatisfiableConstraintError", UnsatisfiableConstraintError);
  // FromString is partial on unrestricted empty AND branches and normalizes sets.
  // Generate its canonical representable domain, retaining a separate membership
  // property below for arbitrary representable, non-normalized ranges.
  it.effect.prop(
    "canonical Range.FromString round-trips structurally and decoding never fails",
    [
      Arbitrary.schema(Range.FromString).pipe(
        Arbitrary.map((range) =>
          Range.make({
            sets:
              range.sets.length === 0
                ? [[Comparator.make({ operator: "<", version: SemVer.of(0, 0, 0, [0]) })]]
                : A.map(range.sets, (set) =>
                    set.length === 0 ? [Comparator.make({ operator: ">=", version: SemVer.of(0, 0, 0) })] : set
                  ),
          })
        ),
        Arbitrary.map((range) => Result.getOrThrow(Range.parseResult(range.toString())))
      ),
      Arbitrary.schema(SemVer),
    ],
    ([range, version]) =>
      Effect.gen(function* () {
        const text = yield* S.encodeEffect(Range.FromString)(range);
        const parsed = yield* S.decodeEffect(Range.FromString)(text);
        assert.isTrue(S.toEquivalence(Range)(parsed, range));
        assert.strictEqual(parsed.test(version), range.test(version));
        const canonical = parsed.toString();
        assert.strictEqual(inspect(parsed), canonical);
        const again = yield* Range.parse(canonical);
        assert.strictEqual(again.toString(), canonical);
        const value2 = yield* S.encodeEffect(Range)(again);
        const value4 = yield* S.encodeEffect(Range)(parsed);
        assert.deepStrictEqual(value2, value4);
        const result = yield* Effect.fromResult(Range.parseResult(canonical));
        const value3 = yield* S.encodeEffect(Range)(result);
        const value5 = yield* S.encodeEffect(Range)(parsed);
        assert.deepStrictEqual(value3, value5);
      }),
    runs
  );
  it.effect.prop(
    "README normalization preserves membership for representable ranges",
    [
      Arbitrary.schema(Range).pipe(Arbitrary.filter((range) => A.every(range.sets, (set) => set.length > 0))),
      Arbitrary.schema(SemVer),
    ],
    ([range, version]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(Range.FromString)(range);
        const normalized = yield* Range.parse(encoded);
        assert.strictEqual(normalized.test(version), range.test(version));
      }),
    runs
  );
});

const inspect = (value: unknown): unknown => {
  const key = Symbol.for("nodejs.util.inspect.custom");
  if (P.hasProperty(value, key) && P.isFunction(value[key])) return value[key].call(value);
  return assert.fail("Expected a custom inspection method");
};
