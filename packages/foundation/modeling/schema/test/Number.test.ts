import { Age } from "@beep/schema/Age";
import { it } from "@beep/test-runner";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, Exit, pipe } from "effect";
import * as S from "effect/Schema";

const decodeAge = S.decodeEffect(Age);
const decodeUnknownAge = S.decodeUnknownEffect(Age);
const encodeAge = S.encodeEffect(Age);

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
