import { Age } from "@beep/schema/Age";
import { it } from "@beep/test-runner";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity, pipe } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const UnknownJson = S.fromJsonString(S.Unknown);

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
        const encodedAge = yield* encodeAge(age);
        expect(encodedAge).toBe(value);
      }
    })
  );

  it.effect(
    "rejects out-of-range, fractional, and non-numeric ages",
    Effect.fnUntraced(function* () {
      for (const value of [-1, 0, 151, 1.5, "42"]) {
        const exit1 = yield* Effect.exit(decodeUnknownAge(value));
        pipe(exit1, Exit.isFailure, (failed) =>
          assertTrue(
            failed,
            `Invalid Age input: ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(value), identity)}`
          )
        );
      }
    })
  );
});
