import { GroundedExtraction } from "@beep/langextract/Extraction";
import {
  convertTextOffsetRange,
  locateGroundedExtractions,
  locateRawText,
  RawTextChunk,
  reconstructSourceText,
  TextOffsetRange,
  Utf16TextRange,
} from "@beep/langextract/VerifiedSpan";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const expectExactRawSlice = (source: string, startChar: number, endChar: number, quote: string): void => {
  expect(Str.slice(startChar, endChar)(source)).toBe(quote);
};

describe("verified-span hostile-text contract", () => {
  it.effect(
    "uses canonical half-open UTF-16 code-unit offsets for surrogate pairs",
    Effect.fnUntraced(function* () {
      const source = "A😀B";
      const converted = yield* convertTextOffsetRange(
        source,
        TextOffsetRange.make({
          end: NonNegativeInt.make(2),
          start: NonNegativeInt.make(1),
          unit: "unicode-code-point",
        })
      );
      const anchor = yield* locateRawText(source, "😀");

      expect(converted).toEqual({ endChar: 3, startChar: 1 });
      expect(anchor).toEqual({ endChar: 3, quote: "😀", startChar: 1 });
      expectExactRawSlice(source, anchor.startChar, anchor.endChar, anchor.quote);
    })
  );

  it.effect(
    "maps a composed locator onto decomposed raw combining-mark text",
    Effect.fnUntraced(function* () {
      const source = "Cafe\u0301 noir";
      const anchor = yield* locateRawText(source, "Café");

      expect(anchor).toEqual({ endChar: 5, quote: "Cafe\u0301", startChar: 0 });
      expectExactRawSlice(source, anchor.startChar, anchor.endChar, anchor.quote);
    })
  );

  it.effect(
    "maps a precomposed Hangul locator onto decomposed Jamo source text",
    Effect.fnUntraced(function* () {
      const source = "\u1100\u1161";
      const anchor = yield* locateRawText(source, "\uAC00");

      expect(anchor).toEqual({ endChar: 2, quote: source, startChar: 0 });
      expectExactRawSlice(source, anchor.startChar, anchor.endChar, anchor.quote);
    })
  );

  it.effect(
    "maps compatibility ligatures without emitting normalized text",
    Effect.fnUntraced(function* () {
      const source = "The ofﬁce filed.";
      const anchor = yield* locateRawText(source, "office");

      expect(anchor).toEqual({ endChar: 9, quote: "ofﬁce", startChar: 4 });
      expectExactRawSlice(source, anchor.startChar, anchor.endChar, anchor.quote);
    })
  );

  it.effect(
    "maps typographic quotes but never authorizes case folding",
    Effect.fnUntraced(function* () {
      const source = "The court wrote “Affirmed.”";
      const anchor = yield* locateRawText(source, '"Affirmed."');
      const caseFoldFailure = yield* locateRawText(source, '"affirmed."').pipe(Effect.flip);

      expect(anchor).toEqual({ endChar: 27, quote: "“Affirmed.”", startChar: 16 });
      expect(caseFoldFailure.reason).toBe("not-found");
      expectExactRawSlice(source, anchor.startChar, anchor.endChar, anchor.quote);
    })
  );

  it.effect(
    "collapses locator whitespace while retaining the entire raw run",
    Effect.fnUntraced(function* () {
      const source = "alpha\t \n beta";
      const anchor = yield* locateRawText(source, "alpha beta");

      expect(anchor).toEqual({ endChar: Str.length(source), quote: source, startChar: 0 });
      expectExactRawSlice(source, anchor.startChar, anchor.endChar, anchor.quote);
    })
  );

  it.effect(
    "fails duplicate normalized occurrences as ambiguous",
    Effect.fnUntraced(function* () {
      const failure = yield* locateRawText("same text; same text", "same text").pipe(Effect.flip);

      expect(failure.reason).toBe("ambiguous");
    })
  );

  it.effect(
    "stops repetitive-source enumeration after ambiguity is established",
    Effect.fnUntraced(function* () {
      const failure = yield* locateRawText(Str.repeat(100_000)("a"), "a").pipe(Effect.flip);

      expect(failure.reason).toBe("ambiguous");
    })
  );

  it.effect(
    "reconstructs an explicit page separator once and locates across the boundary",
    Effect.fnUntraced(function* () {
      const first = "See 410 U.S.\f";
      const second = "113 for the rule.";
      const source = yield* reconstructSourceText([
        RawTextChunk.make({ startChar: NonNegativeInt.make(0), text: first }),
        RawTextChunk.make({ startChar: NonNegativeInt.make(Str.length(first)), text: second }),
      ]);
      const anchor = yield* locateRawText(source, "410 U.S. 113");

      expect(source).toBe(`${first}${second}`);
      expect(anchor).toEqual({
        endChar: Str.length(first) + 3,
        quote: "410 U.S.\f113",
        startChar: 4,
      });
      expectExactRawSlice(source, anchor.startChar, anchor.endChar, anchor.quote);
    })
  );

  it.effect(
    "fails malformed reconstruction without inventing a separator",
    Effect.fnUntraced(function* () {
      const failure = yield* reconstructSourceText([
        RawTextChunk.make({ startChar: NonNegativeInt.make(0), text: "page one\f" }),
        RawTextChunk.make({ startChar: NonNegativeInt.make(8), text: "page two" }),
      ]).pipe(Effect.flip);

      expect(failure.reason).toBe("malformed-source");
    })
  );

  it.effect(
    "consumes GroundedExtraction arrays directly and ignores legacy fuzzy authorization metadata",
    Effect.fnUntraced(function* () {
      const source = "The court wrote “Affirmed.”";
      const strict = yield* locateGroundedExtractions(source, [
        GroundedExtraction.make({
          alignmentStatus: "unaligned",
          label: "quotation",
          text: '"Affirmed."',
        }),
      ]);
      const fuzzyFailure = yield* locateGroundedExtractions(source, [
        GroundedExtraction.make({
          alignmentStatus: "match_fuzzy",
          label: "quotation",
          matchedText: "“Affirmed.”",
          text: '"Affrmed."',
        }),
      ]).pipe(Effect.flip);

      expect(strict).toEqual([{ endChar: 27, quote: "“Affirmed.”", startChar: 16 }]);
      expect(fuzzyFailure.reason).toBe("not-found");
      expect(fuzzyFailure.candidateIndex).toBe(0);
    })
  );

  it("rejects empty and reversed ranges at construction and decode boundaries", () => {
    expect(() =>
      TextOffsetRange.make({
        end: NonNegativeInt.make(1),
        start: NonNegativeInt.make(1),
        unit: "utf16-code-unit",
      })
    ).toThrow();
    expect(() =>
      Utf16TextRange.make({
        endChar: NonNegativeInt.make(1),
        startChar: NonNegativeInt.make(2),
      })
    ).toThrow();
    expect(
      Result.isFailure(
        S.decodeUnknownResult(TextOffsetRange)({
          end: 1,
          start: 2,
          unit: "unicode-code-point",
        })
      )
    ).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(Utf16TextRange)({ endChar: 0, startChar: 0 }))).toBe(true);
  });

  it("derives only ordered, round-trippable ranges from both schemas", () =>
    fc.assert(
      fc.property(S.toArbitrary(TextOffsetRange), S.toArbitrary(Utf16TextRange), (offsetRange, utf16Range) => {
        const encodedOffsetRange = Result.getOrThrow(S.encodeUnknownResult(TextOffsetRange)(offsetRange));
        const encodedUtf16Range = Result.getOrThrow(S.encodeUnknownResult(Utf16TextRange)(utf16Range));
        const decodedOffsetRange = Result.getOrThrow(S.decodeUnknownResult(TextOffsetRange)(encodedOffsetRange));
        const decodedUtf16Range = Result.getOrThrow(S.decodeUnknownResult(Utf16TextRange)(encodedUtf16Range));

        expect(offsetRange.start).toBeLessThan(offsetRange.end);
        expect(utf16Range.startChar).toBeLessThan(utf16Range.endChar);
        expect(S.toEquivalence(TextOffsetRange)(decodedOffsetRange, offsetRange)).toBe(true);
        expect(S.toEquivalence(Utf16TextRange)(decodedUtf16Range, utf16Range)).toBe(true);
      }),
      fcRuns(50)
    ));
});
