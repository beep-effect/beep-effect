import { WinkStringArray as WinkStringArrayFromRoot } from "@beep/wink";
import { WinkStringArray } from "@beep/wink/Wink.models";
import { describe, expect, it } from "@effect/vitest";
import { assertSuccess, assertTrue } from "@effect/vitest/utils";
import { Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const decodeWinkStringArrayResult = S.decodeResult(WinkStringArray);
const decodeUnknownWinkStringArrayResult = S.decodeUnknownResult(WinkStringArray);
const isWinkStringArray = S.is(WinkStringArray);

describe("Wink models", () => {
  it("exports one canonical WinkStringArray schema", () => {
    const invalid: unknown = ["sentence", 1];

    expect(WinkStringArrayFromRoot).toBe(WinkStringArray);
    assertSuccess(decodeWinkStringArrayResult(["sentence", "tokens"]), ["sentence", "tokens"]);
    assertTrue(Result.isFailure(decodeUnknownWinkStringArrayResult(invalid)));
    expect(
      Effect.runSync(Arbitrary.sampleEffect(Arbitrary.schema(WinkStringArray), { count: 32, seed: 0x5eed })).every(
        isWinkStringArray
      )
    ).toBe(true);
  });
});
