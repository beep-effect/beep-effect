import { LexicalDecodeError } from "@beep/lexical-schema/Lexical.model";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("@beep/lexical-schema tagged-error declared equivalence", () => {
  it("compares decode errors by message while ignoring their opaque cause", () => {
    const same = S.toEquivalence(LexicalDecodeError);
    const first = LexicalDecodeError.make({ cause: { side: "left" }, message: "Decode failed" });
    const second = LexicalDecodeError.make({ cause: { side: "right" }, message: "Decode failed" });
    const different = LexicalDecodeError.make({ cause: { side: "left" }, message: "Wire decode failed" });

    expect(same(first, second)).toBe(true);
    expect(same(first, different)).toBe(false);
  });
});
