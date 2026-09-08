import { Age } from "@beep/schema/Age";
import { NonNegativeInt } from "@beep/schema/Number";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as S from "effect/Schema";
import type { Int } from "@beep/schema/Int";

const decodeNonNegativeInt = S.decodeUnknownEffect(NonNegativeInt);
const exit = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.exit(effect));

describe("Age", () => {
  it("derives valid ages that decode without changing their value", () => {
    assertSchemaArbitraryDecodesToSelf(Age);
  });

  it.effect(
    "accepts whole years at both inclusive boundaries and round-trips them",
    Effect.fnUntraced(function* () {
      for (const value of [1, 42, 150]) {
        const age = yield* S.decodeEffect(Age)(value);
        expect(age).toBe(value);
        expect(yield* S.encodeEffect(Age)(age)).toBe(value);
      }
    })
  );

  it.effect(
    "rejects out-of-range, fractional, and non-numeric ages",
    Effect.fnUntraced(function* () {
      for (const value of [-1, 0, 151, 1.5, "42"]) {
        expect(Exit.isFailure(yield* Effect.exit(S.decodeUnknownEffect(Age)(value)))).toBe(true);
      }
    })
  );
});

describe("Number schemas", () => {
  it("preserves the base Int brand on non-negative integers", () => {
    expectTypeOf<NonNegativeInt extends Int ? true : false>().toEqualTypeOf<true>();
  });

  it("exports the non-negative integer schema from the Number subpath", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* decodeNonNegativeInt(0)).toBe(0);
        expect(yield* decodeNonNegativeInt(42)).toBe(42);

        expect(Exit.isFailure(yield* Effect.promise(() => Promise.resolve(exit(decodeNonNegativeInt(-1)))))).toBe(true);
        expect(Exit.isFailure(yield* Effect.promise(() => Promise.resolve(exit(decodeNonNegativeInt(1.5)))))).toBe(
          true
        );
      })
    ));
});
