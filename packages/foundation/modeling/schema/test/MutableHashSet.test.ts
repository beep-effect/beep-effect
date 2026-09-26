import { fcRuns } from "@beep/fc-runs";
import { isMutableHashSet, MutableHashSet, MutableHashSetFromSelf } from "@beep/schema/MutableHashSet";
import { withKeyDefaults } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as MutableHashSet_ from "effect/MutableHashSet";
import * as Option from "effect/Option";
import * as S from "effect/Schema";

describe("MutableHashSetFromSelf", () => {
  it.effect(
    "preserves schema metadata and validates existing mutable hash sets",
    Effect.fnUntraced(function* () {
      const schema = MutableHashSetFromSelf(S.FiniteFromString);
      const decoded = yield* S.decodeEffect(schema)(MutableHashSet_.make("1", "2", "1"));

      expect(schema.value).toBe(S.FiniteFromString);
      expect(schema.annotate({}).value).toBe(S.FiniteFromString);
      expect(isMutableHashSet(decoded)).toBe(true);
      expect(A.fromIterable(decoded)).toEqual([1, 2]);
    })
  );

  it.effect(
    "rejects non-mutable-hash-set inputs",
    Effect.fnUntraced(function* () {
      const schema = MutableHashSetFromSelf(S.FiniteFromString);

      const failure1 = yield* Effect.exit(S.decodeUnknownEffect(schema)(null));
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Expected @beep/schema/MutableHashSet/MutableHashSetFromSelf"
        );
      }
    })
  );

  it.effect(
    "reports member decode failures at the values path",
    Effect.fnUntraced(function* () {
      const schema = MutableHashSetFromSelf(S.FiniteFromString);

      const failure2 = yield* Effect.exit(S.decodeUnknownEffect(schema)(MutableHashSet_.make("1", null)));
      pipe(failure2, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure2)) {
        expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(`Expected string
  at ["values"][1]`);
      }
    })
  );

  it("derives formatter and equivalence instances", () => {
    const formatter = S.toFormatter(MutableHashSetFromSelf(S.String));
    const equivalence = S.toEquivalence(MutableHashSetFromSelf(S.String));

    expect(formatter(MutableHashSet_.make("b", "a"))).toBe(`MutableHashSet(2) { "a", "b" }`);
    expect(equivalence(MutableHashSet_.make("a", "b"), MutableHashSet_.make("b", "a"))).toBe(true);
    expect(equivalence(MutableHashSet_.make("a"), MutableHashSet_.make("b"))).toBe(false);
  });

  {
    const schema = MutableHashSetFromSelf(S.String);
    const arbitrary = Arbitrary.schema(schema);
    const equivalence = S.toEquivalence(schema);
    const decode = S.decodeEffect(schema);
    const encode = S.encodeEffect(schema);
    it.effect.prop(
      "round-trips arbitrary sets derived from the source schema under the derived equivalence",
      [arbitrary],
      Effect.fnUntraced(function* ([set]) {
        const encoded = yield* encode(set);
        const decoded = yield* decode(encoded);
        expect(equivalence(decoded, set)).toBe(true);

        return true;
      }),
      { arbitrary: fcRuns(50) }
    );
  }
});

describe("MutableHashSet", () => {
  it.effect(
    "decodes arrays into mutable hash sets and removes duplicates",
    Effect.fnUntraced(function* () {
      const schema = MutableHashSet(S.FiniteFromString);
      const decoded = yield* S.decodeEffect(schema)(["1", "2", "1"]);

      expect(schema.value).toBe(S.FiniteFromString);
      expect(schema.annotate({}).value).toBe(S.FiniteFromString);
      expect(isMutableHashSet(decoded)).toBe(true);
      expect(A.fromIterable(decoded)).toEqual([1, 2]);
    })
  );

  it.effect(
    "encodes mutable hash sets back to arrays",
    Effect.fnUntraced(function* () {
      const schema = MutableHashSet(S.FiniteFromString);

      expect(yield* S.encodeEffect(schema)(MutableHashSet_.make(1, 2, 3))).toEqual(["1", "2", "3"]);
    })
  );

  it.effect(
    "expects the encoded array form at the boundary",
    Effect.fnUntraced(function* () {
      const schema = MutableHashSet(S.FiniteFromString);

      const failure3 = yield* Effect.exit(S.decodeUnknownEffect(schema)(MutableHashSet_.make("1", null)));
      pipe(failure3, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure3)) {
        expect(pipe(failure3.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(`Expected array`);
      }
    })
  );

  it.effect(
    "supports decoded mutable hash set defaults for missing struct keys",
    Effect.fnUntraced(function* () {
      const schema = S.Struct({
        values: MutableHashSet(S.String).pipe(withKeyDefaults(MutableHashSet_.empty<string>())),
      });

      const constructed = schema.make({});
      const decoded = yield* S.decodeEffect(schema)({});

      expect(isMutableHashSet(constructed.values)).toBe(true);
      expect(isMutableHashSet(decoded.values)).toBe(true);
      expect(A.fromIterable(constructed.values)).toEqual([]);
      expect(A.fromIterable(decoded.values)).toEqual([]);
    })
  );
});
