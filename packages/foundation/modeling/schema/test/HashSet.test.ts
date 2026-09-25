import { fcRuns } from "@beep/fc-runs";
import { HashSet } from "@beep/schema/HashSet";
import { withKeyDefaults } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as HashSet_ from "effect/HashSet";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

describe("HashSet", () => {
  it.effect(
    "decodes arrays into hash sets and removes duplicates",
    Effect.fnUntraced(function* () {
      const schema = HashSet(S.FiniteFromString);
      const decoded = yield* S.decodeEffect(schema)(["1", "2", "1"]);

      expect(schema.value).toBe(S.FiniteFromString);
      expect(schema.annotate({}).value).toBe(S.FiniteFromString);
      expect(HashSet_.isHashSet(decoded)).toBe(true);
      expect(A.sort(A.fromIterable(decoded), Order.Number)).toEqual([1, 2]);
    })
  );

  it.effect(
    "encodes hash sets back to arrays",
    Effect.fnUntraced(function* () {
      const schema = HashSet(S.FiniteFromString);
      const encoded = yield* S.encodeEffect(schema)(HashSet_.make(1, 2, 3));

      expect(Array.isArray(encoded)).toBe(true);
      expect(A.sort(encoded, Order.String)).toEqual(["1", "2", "3"]);
    })
  );

  it.effect(
    "expects the encoded array form at the boundary",
    Effect.fnUntraced(function* () {
      const schema = HashSet(S.FiniteFromString);

      // This is the whole reason the module exists: `effect/Schema`'s own
      // `HashSet` accepts a live set here and encodes back to one, which no jsonb
      // column can hold and no driver row can return.
      const failure1 = yield* Effect.result(S.decodeUnknownEffect(schema)(HashSet_.make("1", "2")));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain("Expected array");
      }
    })
  );

  it.effect(
    "reports member decode failures at the failing index",
    Effect.fnUntraced(function* () {
      const schema = HashSet(S.FiniteFromString);

      const failure2 = yield* Effect.result(S.decodeUnknownEffect(schema)(["1", null]));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain(`Expected string
  at [1]`);
      }
    })
  );

  it.effect(
    "supports decoded hash set defaults for missing struct keys",
    Effect.fnUntraced(function* () {
      const schema = S.Struct({
        values: HashSet(S.String).pipe(withKeyDefaults(HashSet_.empty<string>())),
      });

      const constructed = schema.make({});
      const decoded = yield* S.decodeEffect(schema)({});

      expect(HashSet_.isHashSet(constructed.values)).toBe(true);
      expect(HashSet_.isHashSet(decoded.values)).toBe(true);
      expect(HashSet_.size(decoded.values)).toBe(0);
    })
  );

  {
    const schema = HashSet(S.String);
    const arbitrary = Arbitrary.schema(schema);
    const equivalence = S.toEquivalence(schema);
    const decode = S.decodeEffect(schema);
    const encode = S.encodeEffect(schema);
    it.effect.prop(
      "round-trips arbitrary sets through the array form under the derived equivalence",
      [arbitrary],
      Effect.fnUntraced(function* ([set]) {
        const encoded = yield* encode(set);
        expect(Array.isArray(encoded)).toBe(true);
        expect(equivalence(yield* decode(encoded), set)).toBe(true);

        return true;
      }),
      { arbitrary: fcRuns(50) }
    );
  }

  it.effect(
    "survives the JSON trip a jsonb column puts a set through",
    Effect.fnUntraced(function* () {
      const schema = S.Struct({ territorial: HashSet(S.String) });
      const value = schema.make({ territorial: HashSet_.make("US-CA", "US-NV") });

      // Encoded, serialized, parsed, decoded — the exact path a persisted set
      // takes, and the one that fails in both directions under `S.HashSet`.
      const json = S.fromJsonString(schema);
      const stored = yield* S.encodeEffect(json)(value);
      const returned = yield* S.decodeEffect(json)(stored);

      expect(HashSet_.isHashSet(returned.territorial)).toBe(true);
      expect(HashSet_.has(returned.territorial, "US-CA")).toBe(true);
      expect(HashSet_.has(returned.territorial, "US-NV")).toBe(true);
    })
  );
});
