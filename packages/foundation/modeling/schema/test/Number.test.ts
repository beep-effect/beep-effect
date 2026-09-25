import { Age } from "@beep/schema/Age";
import { NonNegativeInt } from "@beep/schema/Number";
import { it } from "@beep/test-runner";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect, expectTypeOf } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, Exit, pipe } from "effect";
import * as S from "effect/Schema";
import type { Int } from "@beep/schema/Int";

const decodeAge = S.decodeEffect(Age);
const decodeUnknownAge = S.decodeUnknownEffect(Age);
const encodeAge = S.encodeEffect(Age);

const decodeNonNegativeInt = S.decodeUnknownEffect(NonNegativeInt);

describe("Age", () => {
  it("derives valid ages that decode without changing their value", () => {
    assertSchemaArbitraryDecodesToSelf(Age);
  });

  it.effect(
    "accepts whole years at both inclusive boundaries and round-trips them",
    Effect.fnUntraced(function* () {
      for (const value of [1, 42, 150]) {
        const age = yield* decodeAge(value);
        expect(age).toBe(value);
        expect(yield* encodeAge(age)).toBe(value);
      }
    })
  );

  it.effect(
    "rejects out-of-range, fractional, and non-numeric ages",
    Effect.fnUntraced(function* () {
      for (const value of [-1, 0, 151, 1.5, "42"]) {
        pipe(yield* Effect.exit(decodeUnknownAge(value)), Exit.isFailure, (failed) =>
          assertTrue(failed, `Invalid Age input: ${JSON.stringify(value)}`)
        );
      }
    })
  );
});

describe("Number schemas", () => {
  it("preserves the base Int brand on non-negative integers", () => {
    expectTypeOf<NonNegativeInt extends Int ? true : false>().toEqualTypeOf<true>();
  });

  it.effect(
    "exports the non-negative integer schema from the Number subpath",
    Effect.fnUntraced(function* () {
      expect(yield* decodeNonNegativeInt(0)).toBe(0);
      expect(yield* decodeNonNegativeInt(42)).toBe(42);

      pipe(yield* Effect.exit(decodeNonNegativeInt(-1)), Exit.isFailure, assertTrue);
      pipe(yield* Effect.exit(decodeNonNegativeInt(1.5)), Exit.isFailure, assertTrue);
    })
  );
});
