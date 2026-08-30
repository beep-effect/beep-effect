import { GroundedExtraction, MAX_EXTRACTION_CANDIDATES } from "@beep/langextract/Extraction";
import {
  convertTextOffsetRange,
  locateGroundedExtractions,
  locateRawText,
  normalizeTextLocator,
  RawTextChunk,
  reconstructSourceText,
  TextOffsetRange,
  Utf16TextRange,
} from "@beep/langextract/VerifiedSpan";
import { Contract } from "@beep/nlp/Handoff";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
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
      const converted = yield* convertTextOffsetRange(source)(
        TextOffsetRange.make({
          end: NonNegativeInt.make(2),
          start: NonNegativeInt.make(1),
          unit: "unicode-code-point",
        })
      );
      const anchor = yield* locateRawText("😀")(source);

      expect(converted).toEqual({ endChar: 3, startChar: 1 });
      expect(anchor).toEqual({ endChar: 3, quote: "😀", startChar: 1 });
      expectExactRawSlice(source, anchor.startChar, anchor.endChar, anchor.quote);
    })
  );

  it.effect(
    "rejects exact raw locators that split a surrogate pair",
    Effect.fnUntraced(function* () {
      const failure = yield* locateRawText("😀", "\uD83D").pipe(Effect.flip);

      expect(failure.reason).toBe("not-found");
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

  it("normalizes long combining-mark clusters from retained raw boundaries", () => {
    const combiningMarks = 100_000;
    const normalized = normalizeTextLocator(Str.concat("a", Str.repeat(combiningMarks)("\u0301")));

    expect(Str.startsWith("á")(normalized)).toBe(true);
    expect(Str.length(normalized)).toBe(combiningMarks);
  });

  it.effect(
    "preserves an exact raw locator that ends inside a normalization cluster",
    Effect.fnUntraced(function* () {
      const source = "Cafe\u0301 noir";
      const anchor = yield* locateRawText(source, "Cafe");

      expect(anchor).toEqual({ endChar: 4, quote: "Cafe", startChar: 0 });
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
    "prefers one exact raw locator over a wider normalization-equivalent range",
    Effect.fnUntraced(function* () {
      const source = "a  b";
      const anchor = yield* locateRawText(source, " b");

      expect(anchor).toEqual({ endChar: 4, quote: " b", startChar: 2 });
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
    "fails mixed exact and normalization-equivalent occurrences as ambiguous",
    Effect.fnUntraced(function* () {
      const failure = yield* locateRawText("office ofﬁce", "office").pipe(Effect.flip);

      expect(failure.reason).toBe("ambiguous");
    })
  );

  it.effect(
    "fails overlapping exact occurrences as ambiguous",
    Effect.fnUntraced(function* () {
      const failure = yield* locateRawText("aaa", "aa").pipe(Effect.flip);

      expect(failure.reason).toBe("ambiguous");
    })
  );

  it.effect(
    "retains prefix fallback state until a unique exact match",
    Effect.fnUntraced(function* () {
      const source = "ababaca";
      const anchor = yield* locateRawText(source, "abaca");

      expect(anchor).toEqual({ endChar: 7, quote: "abaca", startChar: 2 });
      expectExactRawSlice(source, anchor.startChar, anchor.endChar, anchor.quote);
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
    "skips rejected compatibility clusters without repeatedly slicing the remaining source",
    Effect.fnUntraced(function* () {
      const ligatures = Str.repeat(100_000)("ﬁ");
      const failure = yield* locateRawText(ligatures, "f").pipe(Effect.flip);
      const source = Str.concat(ligatures, "f");
      const anchor = yield* locateRawText(source, "f");

      expect(failure.reason).toBe("not-found");
      expect(anchor).toEqual({ endChar: 100_001, quote: "f", startChar: 100_000 });
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
      const strict = yield* locateGroundedExtractions(
        [
          GroundedExtraction.cases.unaligned.make({
            label: "quotation",
            text: '"Affirmed."',
          }),
        ],
        source
      );
      const fuzzyFailure = yield* locateGroundedExtractions(
        [
          GroundedExtraction.cases.match_fuzzy.make({
            label: "quotation",
            matchedText: "“Affirmed.”",
            span: Contract.Span.make({ end: NonNegativeInt.make(27), start: NonNegativeInt.make(16) }),
            text: '"Affrmed."',
          }),
        ],
        source
      ).pipe(Effect.flip);

      expect(strict).toEqual([{ endChar: 27, quote: "“Affirmed.”", startChar: 16 }]);
      expect(fuzzyFailure.reason).toBe("not-found");
      expect(fuzzyFailure.candidateIndex).toEqual(O.some(NonNegativeInt.make(0)));
    })
  );

  it.effect(
    "rejects oversized direct extraction batches before scanning source text",
    Effect.fnUntraced(function* () {
      const extraction = GroundedExtraction.cases.unaligned.make({
        label: "quotation",
        text: "missing",
      });
      const failure = yield* locateGroundedExtractions("source")(
        A.replicate(extraction, MAX_EXTRACTION_CANDIDATES + 1)
      ).pipe(Effect.flip);

      expect(failure.reason).toBe("limit-exceeded");
      expect(failure.candidateIndex).toEqual(O.none());
    })
  );

  it.effect(
    "fails closed at empty and oversized locator boundaries",
    Effect.fnUntraced(function* () {
      const emptySource = yield* locateRawText("", "missing").pipe(Effect.flip);
      const emptyLocator = yield* locateRawText("source", " \n\t ").pipe(Effect.flip);
      const oversizedLocator = yield* locateRawText("source", Str.repeat(4_097)("x")).pipe(Effect.flip);

      expect(emptySource.reason).toBe("absent-text");
      expect(emptyLocator.reason).toBe("absent-text");
      expect(oversizedLocator.reason).toBe("limit-exceeded");
    })
  );

  it.effect(
    "validates both declared offset units against source boundaries",
    Effect.fnUntraced(function* () {
      const emptySource = yield* convertTextOffsetRange(
        TextOffsetRange.make({ end: NonNegativeInt.make(1), start: NonNegativeInt.make(0), unit: "utf16-code-unit" }),
        ""
      ).pipe(Effect.flip);
      const utf16Range = yield* convertTextOffsetRange(
        TextOffsetRange.make({ end: NonNegativeInt.make(3), start: NonNegativeInt.make(1), unit: "utf16-code-unit" }),
        "A😀B"
      );
      const splitSurrogate = yield* convertTextOffsetRange(
        TextOffsetRange.make({ end: NonNegativeInt.make(2), start: NonNegativeInt.make(1), unit: "utf16-code-unit" }),
        "A😀B"
      ).pipe(Effect.flip);
      const missingCodePoint = yield* convertTextOffsetRange(
        TextOffsetRange.make({
          end: NonNegativeInt.make(4),
          start: NonNegativeInt.make(1),
          unit: "unicode-code-point",
        }),
        "A😀B"
      ).pipe(Effect.flip);

      expect(emptySource.reason).toBe("absent-text");
      expect(utf16Range).toEqual({ endChar: 3, startChar: 1 });
      expect(splitSurrogate.reason).toBe("invalid-offset");
      expect(missingCodePoint.reason).toBe("invalid-offset");
    })
  );

  it.effect(
    "fails closed at reconstruction and extraction source limits",
    Effect.fnUntraced(function* () {
      const oversizedSource = Str.repeat(1_000_001)("x");
      const extraction = GroundedExtraction.cases.unaligned.make({
        label: "quotation",
        text: "x",
      });
      const emptyReconstruction = yield* reconstructSourceText([]).pipe(Effect.flip);
      const oversizedReconstruction = yield* reconstructSourceText([
        RawTextChunk.make({ startChar: NonNegativeInt.make(0), text: oversizedSource }),
      ]).pipe(Effect.flip);
      const emptyBatch = yield* locateGroundedExtractions("source")([]);
      const absentBatchSource = yield* locateGroundedExtractions([extraction], "").pipe(Effect.flip);
      const oversizedBatchSource = yield* locateGroundedExtractions([extraction], oversizedSource).pipe(Effect.flip);

      expect(emptyReconstruction.reason).toBe("absent-text");
      expect(oversizedReconstruction.reason).toBe("limit-exceeded");
      expect(emptyBatch).toEqual([]);
      expect(absentBatchSource.reason).toBe("absent-text");
      expect(oversizedBatchSource.reason).toBe("limit-exceeded");
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
        S.decodeResult(TextOffsetRange)({
          end: 1,
          start: 2,
          unit: "unicode-code-point",
        })
      )
    ).toBe(true);
    expect(Result.isFailure(S.decodeResult(Utf16TextRange)({ endChar: 0, startChar: 0 }))).toBe(true);
  });

  it("derives only ordered, round-trippable ranges from both schemas", () =>
    fc.assert(
      fc.property(S.toArbitrary(TextOffsetRange)(fc), S.toArbitrary(Utf16TextRange)(fc), (offsetRange, utf16Range) => {
        const encodedOffsetRange = Result.getOrThrow(S.encodeUnknownResult(TextOffsetRange)(offsetRange));
        const encodedUtf16Range = Result.getOrThrow(S.encodeUnknownResult(Utf16TextRange)(utf16Range));
        const decodedOffsetRange = Result.getOrThrow(S.decodeResult(TextOffsetRange)(encodedOffsetRange));
        const decodedUtf16Range = Result.getOrThrow(S.decodeResult(Utf16TextRange)(encodedUtf16Range));

        expect(offsetRange.start).toBeLessThan(offsetRange.end);
        expect(utf16Range.startChar).toBeLessThan(utf16Range.endChar);
        expect(S.toEquivalence(TextOffsetRange)(decodedOffsetRange, offsetRange)).toBe(true);
        expect(S.toEquivalence(Utf16TextRange)(decodedUtf16Range, utf16Range)).toBe(true);
      }),
      fcRuns(50)
    ));
});
