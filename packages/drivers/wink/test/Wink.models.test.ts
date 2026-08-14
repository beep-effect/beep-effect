import { WinkStringArray as WinkStringArrayFromRoot } from "@beep/wink";
import { WinkStringArray } from "@beep/wink/Wink.models";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("Wink models", () => {
  it("exports one canonical WinkStringArray schema", () => {
    const invalid: unknown = ["sentence", 1];

    expect(WinkStringArrayFromRoot).toBe(WinkStringArray);
    expect(S.decodeSync(WinkStringArray)(["sentence", "tokens"])).toEqual(["sentence", "tokens"]);
    expect(() => S.decodeUnknownSync(WinkStringArray)(invalid)).toThrow();
  });
});
