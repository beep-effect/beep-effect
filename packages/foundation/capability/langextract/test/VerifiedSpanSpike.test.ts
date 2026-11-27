import { GroundedExtraction, MAX_EXTRACTION_CANDIDATES } from "@beep/langextract/Extraction";
import {
  locateGroundedExtractions,
  locateRawText,
  normalizeTextLocator,
  RawTextChunk,
  reconstructSourceText,
} from "@beep/langextract/VerifiedSpan";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { convertPosition, Position } from "@beep/text/OffsetUnit";
import { TextAnchor } from "@beep/text/TextAnchor";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const MARK_LEADING_LETTERS = [
  ["U+0E33", "\u0e33"],
  ["U+0EB3", "\u0eb3"],
  ["U+FF9E", "\uff9e"],
  ["U+FF9F", "\uff9f"],
] as const;
const NFKC_CLUSTER_SCALARS: ReadonlyArray<string> = [
  ...A.map(MARK_LEADING_LETTERS, ([, letter]) => letter),
  ...["Z", "a", "e", "\u0e01", "\u0e81", "\u30ab", "\uff76", "\uff8a"],
  ...["\u0323", "\u0301", "\u0308", "\u3099", "\u0e48"],
  ...["\u1100", "\u1161", "\u11a8", "\uac00", "\uffa1", "\uffc2", "\ufb01", "\u2460", "\u{1d4b3}"],
];
const nfkcClusterText = Arbitrary.schema(
  S.Array(S.Literals(NFKC_CLUSTER_SCALARS)).check(S.isMinLength(8), S.isMaxLength(24))
).pipe(Arbitrary.map(A.join("")));

const expectExactRawSlice = (source: string, startChar: number, endChar: number, quote: string): void => {
  expect(Str.slice(startChar, endChar)(source)).toBe(quote);
};

describe("verified-span hostile-text contract", () => {
  it.effect(
    "uses canonical half-open UTF-16 code-unit offsets for surrogate pairs",
    Effect.fnUntraced(function* () {
      const source = "A😀B";
      const converted = Result.getOrThrow(
        convertPosition("utf16-code-unit", source)(Position.make({ end: 2, start: 1, unit: "unicode-code-point" }))
      );
      const anchor = yield* locateRawText("😀")(source);

      expect(converted).toMatchObject({ end: 3, start: 1, unit: "utf16-code-unit" });
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

  it("joins a letter whose NFKC form starts with a combining mark to the preceding cluster", () => {
    expect(normalizeTextLocator("Z\uff9e\u0323")).toBe("\u1e92\u3099");
    expect(normalizeTextLocator("Z\uff9f\u0323")).toBe("\u1e92\u309a");
    expect(normalizeTextLocator("\uff9eZ")).toBe("\u3099Z");
  });

  it.effect.each(MARK_LEADING_LETTERS)(
    "keeps the mark-leading letter %s in one cluster with the letter before it",
    Effect.fnUntraced(function* ([, letter]) {
      const source = `xZ${letter}y`;
      const exact = yield* locateRawText(source, letter);
      const cluster = yield* locateRawText(source, Str.normalize("NFKC")(`Z${letter}`));
      const insideCluster = yield* locateRawText(source, Str.normalize("NFKC")(letter)).pipe(Effect.flip);

      expect(exact).toEqual({ endChar: 3, quote: letter, startChar: 2 });
      expect(cluster).toEqual({ endChar: 3, quote: `Z${letter}`, startChar: 1 });
      expect(insideCluster.reason).toBe("not-found");
    })
  );

  it.effect(
    "maps a composed locator onto a raw cluster that holds a mark-leading letter",
    Effect.fnUntraced(function* () {
      const source = "xZ\uff9e\u0323y";
      const anchor = yield* locateRawText(source, "\u1e92\u3099");

      expect(anchor).toEqual({ endChar: 4, quote: "Z\uff9e\u0323", startChar: 1 });
      expectExactRawSlice(source, anchor.startChar, anchor.endChar, anchor.quote);
    })
  );

  it.effect(
    "keeps a letter whose NFKC form holds a mark after its first scalar out of the preceding cluster",
    Effect.fnUntraced(function* () {
      const source = "x\u0958y";
      const anchor = yield* locateRawText(source, "\u0915\u093c");

      expect(anchor).toEqual({ endChar: 2, quote: "\u0958", startChar: 1 });
      expectExactRawSlice(source, anchor.startChar, anchor.endChar, anchor.quote);
    })
  );

  it.prop(
    "normalizes cluster by cluster to the NFKC form of the whole text",
    { text: nfkcClusterText },
    ({ text }) => {
      expect(
        normalizeTextLocator(text),
        "the scalars hold no whitespace or quotes, so the locator form is the NFKC form"
      ).toBe(Str.normalize("NFKC")(text));
    },
    { arbitrary: fcRuns(500) }
  );

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
        RawTextChunk.make({ startChar: S.Natural.make(0), text: first }),
        RawTextChunk.make({ startChar: S.Natural.make(Str.length(first)), text: second }),
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
        RawTextChunk.make({ startChar: S.Natural.make(0), text: "page one\f" }),
        RawTextChunk.make({ startChar: S.Natural.make(8), text: "page two" }),
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
            anchor: TextAnchor.make({
              endChar: S.Natural.make(27),
              quote: "“Affirmed.”",
              startChar: S.Natural.make(16),
            }),
            text: '"Affrmed."',
          }),
        ],
        source
      ).pipe(Effect.flip);

      expect(strict).toEqual([{ endChar: 27, quote: "“Affirmed.”", startChar: 16 }]);
      expect(fuzzyFailure.reason).toBe("not-found");
      assertSome(fuzzyFailure.candidateIndex, S.Natural.make(0));
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
      assertNone(failure.candidateIndex);
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
    "fails as a typed error when NFKC expands a maximum-length locator",
    Effect.fnUntraced(function* () {
      const expandedLocator = Str.concat(Str.repeat(4_095)("\u2026"), "x");
      const failure = yield* locateRawText("a plain source without the locator", expandedLocator).pipe(Effect.flip);

      expect(
        failure.reason,
        "U+2026 normalizes to three code units, so this 4 096-unit locator becomes about 12 286"
      ).toBe("not-found");
    })
  );

  it("validates both declared offset units against source boundaries through convertPosition", () => {
    const toUtf16 = (position: Position, source: string) => convertPosition(position, "utf16-code-unit", source);
    const emptySource = toUtf16(Position.make({ end: 1, start: 0, unit: "utf16-code-unit" }), "");
    const utf16Range = toUtf16(Position.make({ end: 3, start: 1, unit: "utf16-code-unit" }), "A😀B");
    const splitSurrogate = toUtf16(Position.make({ end: 2, start: 1, unit: "utf16-code-unit" }), "A😀B");
    const missingCodePoint = toUtf16(Position.make({ end: 4, start: 1, unit: "unicode-code-point" }), "A😀B");

    const reasonOf = (result: typeof emptySource) => O.map(Result.getFailure(result), (refused) => refused.reason);
    assertSome(reasonOf(emptySource), "out-of-range");
    expect(Result.getOrThrow(utf16Range)).toMatchObject({ end: 3, start: 1 });
    assertSome(reasonOf(splitSurrogate), "split-boundary");
    assertSome(reasonOf(missingCodePoint), "out-of-range");
  });

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
        RawTextChunk.make({ startChar: S.Natural.make(0), text: oversizedSource }),
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
});
