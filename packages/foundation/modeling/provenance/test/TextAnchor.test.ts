import { VERSION } from "@beep/provenance";
import { isWellOrdered, TextAnchor } from "@beep/provenance/TextAnchor";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("@beep/provenance TextAnchor", () => {
  it("exposes the package VERSION constant from the barrel", () => {
    expect(VERSION).toBe("0.0.0");
  });

  it("decodes a well-formed anchor and re-slices the source text to the quote", () => {
    const source = "a claimed fact appears here";
    const anchor = S.decodeUnknownSync(TextAnchor)({ startChar: 0, endChar: 14, quote: "a claimed fact" });

    expect(anchor.quote).toBe("a claimed fact");
    expect(source.slice(anchor.startChar, anchor.endChar)).toBe(anchor.quote);
  });

  it("flags an out-of-order anchor via isWellOrdered", () => {
    expect(isWellOrdered({ startChar: 0, endChar: 14 })).toBe(true);
    expect(isWellOrdered({ startChar: 9, endChar: 2 })).toBe(false);
  });
});
