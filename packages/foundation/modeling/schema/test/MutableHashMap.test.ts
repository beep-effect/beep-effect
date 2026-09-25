import { fcRuns } from "@beep/fc-runs";
import { isMutableHashMap, MutableHashMap, MutableHashMapFromSelf } from "@beep/schema/MutableHashMap";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as MutableHashMap_ from "effect/MutableHashMap";
import * as Option from "effect/Option";
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

      const failure1 = yield* Effect.exit(S.decodeUnknownEffect(schema)(null));
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Expected @beep/schema/MutableHashMap/MutableHashMapFromSelf"
        );
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

      const failure2 = yield* Effect.exit(S.decodeUnknownEffect(schema)(MutableHashMap_.make(["a", null])));
      pipe(failure2, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure2)) {
        expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(`Expected string
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

      const failure3 = yield* Effect.exit(S.decodeUnknownEffect(schema)(MutableHashMap_.make(["a", null])));
      pipe(failure3, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure3)) {
        expect(pipe(failure3.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(`Expected array`);
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
