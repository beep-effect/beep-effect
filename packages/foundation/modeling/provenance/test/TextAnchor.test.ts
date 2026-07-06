import { isWellOrdered, TextAnchor } from "@beep/provenance/TextAnchor";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const TextAnchorArbitrary = S.toArbitrary(TextAnchor);
const TextAnchorEquivalence = S.toEquivalence(TextAnchor);

describe("@beep/provenance TextAnchor", () => {
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

  it("round-trips schema-derived anchors through the encoded wire shape", () =>
    fc.assert(
      fc.property(TextAnchorArbitrary, (anchor) => {
        const encoded = S.encodeSync(TextAnchor)(anchor);
        const decoded = S.decodeUnknownSync(TextAnchor)(encoded);

        expect(encoded).toEqual({
          startChar: anchor.startChar,
          endChar: anchor.endChar,
          quote: anchor.quote,
        });
        expect(TextAnchorEquivalence(decoded, anchor)).toBe(true);
      }),
      { numRuns: 50 }
    ));

  it("colocated well-ordered predicate agrees with ordered offset pairs", () =>
    fc.assert(
      fc.property(fc.nat(), fc.nat(), (startChar, length) => {
        const endChar = startChar + length;

        expect(TextAnchor.isWellOrdered({ startChar, endChar })).toBe(true);
        expect(isWellOrdered({ startChar: endChar + 1, endChar: startChar })).toBe(false);
      }),
      { numRuns: 50 }
    ));
});
