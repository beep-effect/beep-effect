import { NonNegativeInt } from "@beep/schema/Number";
import { Effect, Exit } from "effect";
import * as S from "effect/Schema";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Int } from "@beep/schema/Int";

const decodeNonNegativeInt = S.decodeUnknownEffect(NonNegativeInt);
const exit = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.exit(effect));

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
