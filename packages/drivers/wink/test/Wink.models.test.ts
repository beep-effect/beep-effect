import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { WinkStringArray as WinkStringArrayFromRoot } from "@beep/wink";
import { WinkStringArray } from "@beep/wink/Wink.models";
import { describe, expect } from "@effect/vitest";
import { assertSuccess, assertTrue } from "@effect/vitest/utils";
import { pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const decodeWinkStringArrayResult = S.decodeResult(WinkStringArray);
const decodeUnknownWinkStringArrayResult = S.decodeUnknownResult(WinkStringArray);
const isWinkStringArray = S.is(WinkStringArray);

describe("Wink models", () => {
  it.effect("exports one canonical WinkStringArray schema", () =>
    Effect.gen(function* () {
      const invalid: unknown = ["sentence", 1];

      expect(WinkStringArrayFromRoot).toBe(WinkStringArray);
      assertSuccess(decodeWinkStringArrayResult(["sentence", "tokens"]), ["sentence", "tokens"]);
      pipe(decodeUnknownWinkStringArrayResult(invalid), Result.isFailure, assertTrue);
      const samples = yield* Arbitrary.sampleEffect(Arbitrary.schema(WinkStringArray), { count: 32, seed: 0x5eed });
      expect(A.every(samples, isWinkStringArray)).toBe(true);
    })
  );

  it.prop(
    "generates only valid WinkStringArray values",
    { value: Arbitrary.schema(WinkStringArray) },
    ({ value }) => {
      expect(isWinkStringArray(value)).toBe(true);
    },
    { arbitrary: fcRuns(32) }
  );
});
