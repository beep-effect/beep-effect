import { fcRuns } from "@beep/fc-runs";
import { isMutableHashMap, MutableHashMap, MutableHashMapFromSelf } from "@beep/schema/MutableHashMap";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as MutableHashMap_ from "effect/MutableHashMap";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

describe("MutableHashMapFromSelf", () => {
  it.effect(
    "preserves schema metadata and validates existing mutable hash maps",
    Effect.fnUntraced(function* () {
      const schema = MutableHashMapFromSelf({
        key: S.String,
        value: S.FiniteFromString,
      });
      const decoded = yield* S.decodeEffect(schema)(MutableHashMap_.make(["a", "1"], ["b", "2"]));

      expect(schema.key).toBe(S.String);
      expect(schema.value).toBe(S.FiniteFromString);
      expect(schema.annotate({}).key).toBe(S.String);
      expect(schema.annotate({}).value).toBe(S.FiniteFromString);
      expect(isMutableHashMap(decoded)).toBe(true);
      expect(A.fromIterable(decoded)).toEqual([
        ["a", 1],
        ["b", 2],
      ]);
    })
  );

  it.effect(
    "rejects non-mutable-hash-map inputs",
    Effect.fnUntraced(function* () {
      const schema = MutableHashMapFromSelf({
        key: S.String,
        value: S.FiniteFromString,
      });

      const failure1 = yield* Effect.result(S.decodeUnknownEffect(schema)(null));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain("Expected @beep/schema/MutableHashMap/MutableHashMapFromSelf");
      }
    })
  );

  it.effect(
    "reports entry decode failures at the entries path",
    Effect.fnUntraced(function* () {
      const schema = MutableHashMapFromSelf({
        key: S.String,
        value: S.FiniteFromString,
      });

      const failure2 = yield* Effect.result(S.decodeUnknownEffect(schema)(MutableHashMap_.make(["a", null])));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain(`Expected string
  at ["entries"][0][1]`);
      }
    })
  );

  it("derives formatter and equivalence instances", () => {
    const formatter = S.toFormatter(
      MutableHashMapFromSelf({
        key: S.String,
        value: S.Finite,
      })
    );
    const equivalence = S.toEquivalence(
      MutableHashMapFromSelf({
        key: S.String,
        value: S.Finite,
      })
    );

    expect(formatter(MutableHashMap_.make(["b", 2], ["a", 1]))).toBe(`MutableHashMap(2) { "a" => 1, "b" => 2 }`);
    expect(equivalence(MutableHashMap_.make(["a", 1], ["b", 2]), MutableHashMap_.make(["b", 2], ["a", 1]))).toBe(true);
    expect(equivalence(MutableHashMap_.make(["a", 1]), MutableHashMap_.make(["a", 2]))).toBe(false);
  });
});

describe("MutableHashMap", () => {
  it.effect(
    "decodes entry arrays into mutable hash maps",
    Effect.fnUntraced(function* () {
      const schema = MutableHashMap({
        key: S.String,
        value: S.FiniteFromString,
      });
      const decoded = yield* S.decodeEffect(schema)([
        ["a", "1"],
        ["b", "2"],
      ]);

      expect(schema.key).toBe(S.String);
      expect(schema.value).toBe(S.FiniteFromString);
      expect(schema.annotate({}).key).toBe(S.String);
      expect(schema.annotate({}).value).toBe(S.FiniteFromString);
      expect(isMutableHashMap(decoded)).toBe(true);
      expect(A.fromIterable(decoded)).toEqual([
        ["a", 1],
        ["b", 2],
      ]);
    })
  );

  it.effect(
    "encodes mutable hash maps back to entry arrays",
    Effect.fnUntraced(function* () {
      const schema = MutableHashMap({
        key: S.String,
        value: S.FiniteFromString,
      });

      expect(yield* S.encodeEffect(schema)(MutableHashMap_.make(["a", 1], ["b", 2]))).toEqual([
        ["a", "1"],
        ["b", "2"],
      ]);
    })
  );

  it.effect(
    "expects the encoded entry-array form at the boundary",
    Effect.fnUntraced(function* () {
      const schema = MutableHashMap({
        key: S.String,
        value: S.FiniteFromString,
      });

      const failure3 = yield* Effect.result(S.decodeUnknownEffect(schema)(MutableHashMap_.make(["a", null])));
      expect(Result.isFailure(failure3)).toBe(true);
      if (Result.isFailure(failure3)) {
        expect(failure3.failure.message).toContain(`Expected array`);
      }
    })
  );

  {
    const schema = MutableHashMap({
      key: S.String,
      value: S.FiniteFromString,
    });
    const arbitrary = Arbitrary.schema(schema);
    const decode = S.decodeEffect(schema);
    const encode = S.encodeEffect(schema);
    const equivalence = S.toEquivalence(schema);
    it.effect.prop(
      "round-trips arbitrary mutable hash maps derived from the source schema",
      [arbitrary],
      Effect.fnUntraced(function* ([value]) {
        const encoded = yield* encode(value);
        const decoded = yield* decode(encoded);
        expect(equivalence(decoded, value)).toBe(true);

        return true;
      }),
      { arbitrary: fcRuns(50) }
    );
  }
});
