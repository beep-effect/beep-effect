import { isInternallyConsistent, isUtf16Boundary, isWellOrdered, TextAnchor } from "@beep/provenance/TextAnchor";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const TextAnchorArbitrary = S.toArbitrary(TextAnchor)(fc);
const TextAnchorEquivalence = S.toEquivalence(TextAnchor);

describe("@beep/provenance TextAnchor", () => {
  it("exposes TextAnchor from the public subpath", () => {
    expect(TextAnchor.isWellOrdered({ startChar: 0, endChar: 0 })).toBe(true);
  });

  it.effect(
    "decodes a well-formed anchor and re-slices the source text to the quote",
    Effect.fnUntraced(function* () {
      const source = "a claimed fact appears here";
      const anchor = yield* S.decodeEffect(TextAnchor)({
        startChar: 0,
        endChar: 14,
        quote: "a claimed fact",
      });

      expect(anchor.quote).toBe("a claimed fact");
      expect(Str.slice(anchor.startChar, anchor.endChar)(source)).toBe(anchor.quote);
    })
  );

  it("flags an out-of-order anchor via isWellOrdered", () => {
    expect(isWellOrdered({ startChar: 0, endChar: 14 })).toBe(true);
    expect(isWellOrdered({ startChar: 9, endChar: 2 })).toBe(false);
  });

  it("recognizes zero, end, BMP, and whole-pair UTF-16 boundaries", () => {
    const sourceText = "A😀B";

    expect(isUtf16Boundary(sourceText, 0)).toBe(true);
    expect(isUtf16Boundary(sourceText, 1)).toBe(true);
    expect(isUtf16Boundary(sourceText, 3)).toBe(true);
    expect(isUtf16Boundary(sourceText, 4)).toBe(true);
    expect(isUtf16Boundary(sourceText, 2)).toBe(false);
    expect(isUtf16Boundary(sourceText, -1)).toBe(false);
    expect(isUtf16Boundary(sourceText, 5)).toBe(false);
    expect(isUtf16Boundary(sourceText, 1.5)).toBe(false);
  });

  it("rejects empty quotes and inconsistent widths at construction and decode", () => {
    expect(S.is(TextAnchor)({ startChar: 0, endChar: 0, quote: "" })).toBe(false);
    expect(isInternallyConsistent({ startChar: 0, endChar: 4, quote: "fact" })).toBe(true);
    expect(isInternallyConsistent({ startChar: 0, endChar: 1, quote: "fabricated" })).toBe(false);
    expect(isInternallyConsistent({ startChar: 4, endChar: 0, quote: "fact" })).toBe(false);
    expect(Result.isFailure(S.decodeResult(TextAnchor)({ startChar: 0, endChar: 1, quote: "fabricated" }))).toBe(true);
    expect(Result.isFailure(S.decodeResult(TextAnchor)({ startChar: 4, endChar: 0, quote: "fact" }))).toBe(true);
  });

  it("round-trips schema-derived anchors through the encoded wire shape", () =>
    fc.assert(
      fc.property(TextAnchorArbitrary, (anchor) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(TextAnchor)(anchor));
        const decoded = Result.getOrThrow(S.decodeResult(TextAnchor)(encoded));

        expect(encoded).toEqual({
          startChar: anchor.startChar,
          endChar: anchor.endChar,
          quote: anchor.quote,
        });
        expect(TextAnchor.isInternallyConsistent(anchor)).toBe(true);
        expect(TextAnchorEquivalence(decoded, anchor)).toBe(true);
      }),
      fcRuns(50)
    ));

  it("colocated well-ordered predicate agrees with ordered offset pairs", () =>
    fc.assert(
      fc.property(fc.nat(), fc.nat(), (startChar, length) => {
        const endChar = startChar + length;

        expect(TextAnchor.isWellOrdered({ startChar, endChar })).toBe(true);
        expect(isWellOrdered({ startChar: endChar + 1, endChar: startChar })).toBe(false);
      }),
      fcRuns(50)
    ));
});
