import { WinkStringArray as WinkStringArrayFromRoot } from "@beep/wink";
import { WinkStringArray } from "@beep/wink/Wink.models";
import { describe, expect, it } from "@effect/vitest";
import { Result, SchemaAST } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeWinkStringArrayResult = S.decodeResult(WinkStringArray);
const decodeUnknownWinkStringArrayResult = S.decodeUnknownResult(WinkStringArray);
const isWinkStringArray = S.is(WinkStringArray);

describe("Wink models", () => {
  it("exports one canonical WinkStringArray schema", () => {
    const invalid: unknown = ["sentence", 1];

    expect(WinkStringArrayFromRoot).toBe(WinkStringArray);
    expect(SchemaAST.resolve(WinkStringArray.ast)?.toArbitrary).toBeDefined();
    expect(Result.isSuccess(decodeWinkStringArrayResult(["sentence", "tokens"]))).toBe(true);
    expect(Result.isFailure(decodeUnknownWinkStringArrayResult(invalid))).toBe(true);
    expect(fc.sample(S.toArbitrary(WinkStringArray)(fc), { numRuns: 32, seed: 0x5eed }).every(isWinkStringArray)).toBe(
      true
    );
  });
});
