// Shared law generators for `@beep/text` (moved from the design module's `generators.ts`).
//
// Text is well-formed UTF-16 by construction: code points come from printable BMP scalars below the surrogate
// block (one-, two- and three-byte in UTF-8) plus 64 astral emoji, so nothing is discarded. Every boundary is
// computed from the code points themselves, independently of the scan under test, and every range sits on scalar
// boundaries (decision p0-law-generators-well-formed-text). Split surrogates stay negative fixtures.
import { AlignedSegment } from "@beep/text/LocatorMap";
import { Anchored } from "@beep/text/Occurrence";
import { Position } from "@beep/text/OffsetUnit";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  SourceTextLocator,
} from "@beep/text/SourceTextIdentity";
import { TextAnchor } from "@beep/text/TextAnchor";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Hex from "effect/encoding/Hex";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { JsoncDigest } from "@beep/jsonc/JsoncFingerprint";
import type { OffsetUnit } from "@beep/text/OffsetUnit";

// Picks above 0x2fff map onto 64 astral emoji from U+1F600.
const CodePointPick = S.Int.check(S.isBetween({ minimum: 0x20, maximum: 0x2fff + 64 }));

const toCodePoint = (pick: number): number => (pick > 0x2fff ? 0x1f600 + (pick - 0x3000) : pick);

const utf16Width = (codePoint: number): number => (codePoint > 0xffff ? 2 : 1);

const utf8Width = (codePoint: number): number =>
  codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;

const between = (minimum: number, maximum: number) => Arbitrary.schema(S.Int.check(S.isBetween({ minimum, maximum })));

const at = (values: A.NonEmptyReadonlyArray<number>, index: number): number =>
  O.getOrElse(A.get(values, index), () => A.headNonEmpty(values));

const textOf = (codePoints: ReadonlyArray<number>) => ({
  text: A.join(
    A.map(codePoints, (codePoint) => String.fromCodePoint(codePoint)),
    ""
  ),
  codePoints,
  boundaries: {
    "utf16-code-unit": A.scan(codePoints, 0, (offset, codePoint) => offset + utf16Width(codePoint)),
    "unicode-code-point": A.scan(codePoints, 0, (offset) => offset + 1),
    "utf8-byte": A.scan(codePoints, 0, (offset, codePoint) => offset + utf8Width(codePoint)),
  } satisfies { readonly [Unit in OffsetUnit]: A.NonEmptyReadonlyArray<number> },
});

/** Generated well-formed text with its scalar boundaries in each unit (offset 0, then the end of each scalar). */
export const wellFormedTextWith = (options: { readonly minLength: number; readonly maxLength: number }) =>
  Arbitrary.map(Arbitrary.array(Arbitrary.schema(CodePointPick), options), (picks) =>
    textOf(A.map(picks, toCodePoint))
  );

// One BMP letter and one astral scalar. Over two scalars a passage overlaps itself often, which the wide alphabet
// almost never produces, so the KMP fallback step and surrogate pairs inside a repeated passage both get exercised.
const narrowAlphabet: A.NonEmptyReadonlyArray<number> = [0x61, 0x1f600];

const narrowCodePoints = (options: { readonly minLength: number; readonly maxLength: number }) =>
  Arbitrary.map(
    Arbitrary.array(between(0, 1), options),
    A.map((pick) => at(narrowAlphabet, pick))
  );

/** Generated well-formed text over the narrow alphabet `a`, `😀`, with its scalar boundaries in each unit. */
export const narrowTextWith = (options: { readonly minLength: number; readonly maxLength: number }) =>
  Arbitrary.map(narrowCodePoints(options), textOf);

/**
 * A passage `border + middle + border` over the narrow alphabet and the text `passage + passage[border.length..]`,
 * where the second copy starts inside the first: at least two overlapping occurrences by construction.
 */
export const overlappingRepeat = Arbitrary.map(
  Arbitrary.all({
    border: narrowCodePoints({ minLength: 1, maxLength: 8 }),
    middle: narrowCodePoints({ minLength: 0, maxLength: 8 }),
  }),
  ({ border, middle }) => {
    const passage = A.appendAll(A.appendAll(border, middle), border);
    return { passage: textOf(passage), text: textOf(A.appendAll(passage, A.drop(passage, border.length))) };
  }
);

/** One of several arbitraries, each picked with the same weight. */
export const oneOf = <Value>(arbitraries: A.NonEmptyReadonlyArray<Arbitrary.Arbitrary<Value>>) =>
  Arbitrary.flatMap(between(0, arbitraries.length - 1), (index) =>
    O.getOrElse(A.get(arbitraries, index), () => A.headNonEmpty(arbitraries))
  );

// The pieces the normalizations of section 1.7 rewrite: hyphen breaks of every kind, letters on both sides of them,
// compatibility forms, combining marks, Hangul compatibility jamo, and the four letters whose NFKC form starts
// with a mark.
const normalizationPieces: A.NonEmptyReadonlyArray<string> = [
  "-\n",
  "-\r\n",
  "-\r",
  "‐\n",
  "a",
  "e",
  "Z",
  "𝒳",
  "𝒶",
  "ﬁ",
  "①",
  "́",
  "̣",
  "ㄱ",
  "ㅏ",
  "ำ",
  "ຳ",
  "ﾞ",
  "ﾟ",
  " ",
];

const normalizationPiece = Arbitrary.map(between(0, normalizationPieces.length - 1), (index) =>
  O.getOrElse(A.get(normalizationPieces, index), () => A.headNonEmpty(normalizationPieces))
);

/** Well-formed text salted with hyphen breaks and the scalars NFKC rewrites, generated piece by piece. */
export const normalizationText = Arbitrary.map(
  Arbitrary.array(
    oneOf([
      normalizationPiece,
      normalizationPiece,
      Arbitrary.map(wellFormedTextWith({ minLength: 1, maxLength: 3 }), ({ text }) => text),
    ]),
    { minLength: 0, maxLength: 24 }
  ),
  (pieces) => A.join(pieces, "")
);

/** Generated well-formed, non-empty text of at most 80 scalars. */
export const wellFormedText = wellFormedTextWith({ minLength: 1, maxLength: 80 });

/** A non-empty range of scalar indexes `[first, last]` into a text of `scalars` scalars, with `first < last`. */
export const scalarRangeIn = (scalars: number) =>
  Arbitrary.flatMap(between(0, scalars - 1), (first) =>
    Arbitrary.map(between(first + 1, scalars), (last) => ({ first, last }))
  );

/** The offsets of a scalar-index range in one unit's boundary list. */
export const rangeIn =
  (boundaries: A.NonEmptyReadonlyArray<number>) =>
  (range: { readonly first: number; readonly last: number }): { readonly start: number; readonly end: number } => ({
    start: at(boundaries, range.first),
    end: at(boundaries, range.last),
  });

// A synchronous SHA-256 from the platform: the digest callback the preimage Result twins take, and an oracle for
// the text digests that is independent of the `Digest` service the minting functions use.
const { createHash } = process.getBuiltinModule("node:crypto");

/** The raw SHA-256 of bytes in memory. */
export const sha256: JsoncDigest = (bytes) => new Uint8Array(createHash("sha256").update(bytes).digest());

const utf8 = new TextEncoder();

/** The `sha256:<hex>` digest of a text's UTF-8 bytes, as a capture's `textDigest` records it. */
export const textDigestOf = (text: string): SourceTextDigest =>
  SourceTextDigest.make(`sha256:${Hex.encode(sha256(utf8.encode(text)))}`);

// A short well-formed field value, non-empty by construction.
const fieldText = Arbitrary.map(wellFormedTextWith({ minLength: 1, maxLength: 12 }), ({ text }) => text);

/** A capture of `text`: generated well-formed fields, a backslash-free locator and the text's own digest. */
export const sourceFor = (text: string) =>
  Arbitrary.map(
    Arbitrary.all({
      scopeRef: fieldText,
      sourceRef: fieldText,
      locator: fieldText,
      sourceBytes: fieldText,
      name: fieldText,
      version: fieldText,
      normalizationVersion: fieldText,
    }),
    (fields) =>
      SourceTextIdentity.make({
        scopeRef: fields.scopeRef,
        sourceRef: fields.sourceRef,
        locator: SourceTextLocator.make(Str.replaceAll("\\", "/")(fields.locator)),
        sourceDigest: textDigestOf(fields.sourceBytes),
        textDigest: textDigestOf(text),
        extractor: SourceTextExtractor.make({ name: fields.name, version: fields.version }),
        normalizationVersion: fields.normalizationVersion,
      })
  );

type Utf16Range = { readonly start: number; readonly end: number };

/** The anchors row of a UTF-16 range of `text` in `source`; the quote is the slice. */
export const anchoredOn: {
  (text: string, range: Utf16Range): (source: SourceTextIdentity) => Anchored;
  (source: SourceTextIdentity, text: string, range: Utf16Range): Anchored;
} = dual(
  3,
  (source: SourceTextIdentity, text: string, range: Utf16Range): Anchored =>
    Anchored.make({
      receipt: TextAnchorVerificationReceipt.make({
        anchor: TextAnchor.make({
          startChar: range.start,
          endChar: range.end,
          quote: Str.slice(range.start, range.end)(text),
        }),
        source,
      }),
    })
);

/** Generated text, a scalar range in it, a capture of the text, and the anchors row of the range. */
export const anchoredCase = Arbitrary.flatMap(wellFormedText, (generated) =>
  Arbitrary.map(
    Arbitrary.all([scalarRangeIn(generated.codePoints.length), sourceFor(generated.text)]),
    ([range, source]) => ({
      ...generated,
      range,
      source,
      anchored: anchoredOn(source, generated.text, rangeIn(generated.boundaries["utf16-code-unit"])(range)),
    })
  )
);

// One run of scalars in a generated locator step: where the run ends, what the step does with it, and the text it
// becomes or the target inserts before it.
const StepPick = Arbitrary.all({
  ends: between(0, 2),
  kind: between(0, 9),
  insert: between(0, 4),
  replacement: Arbitrary.map(wellFormedTextWith({ minLength: 1, maxLength: 3 }), ({ text }) => text),
  inserted: Arbitrary.map(wellFormedTextWith({ minLength: 1, maxLength: 3 }), ({ text }) => text),
});

const utf16At = (start: number, end: number) => Position.make({ unit: "utf16-code-unit", start, end });

/**
 * A generated step from `text` to a later text. The scalars are cut into runs; each run is kept (half the runs),
 * rewritten to generated text (three in ten) or dropped, which leaves a gap in `text`; one run in five has generated
 * text inserted before it in the target, a gap in the target. Every pick is used, so nothing is discarded.
 */
export const locatorStep = (text: string) => {
  const scalars = A.fromIterable(text);
  return Arbitrary.map(Arbitrary.array(StepPick, { minLength: scalars.length, maxLength: scalars.length }), (picks) => {
    const segments: Array<AlignedSegment> = [];
    let target = "";
    let from = 0;
    let runStart = 0;
    let run = "";
    A.forEach(scalars, (scalar, index) => {
      run += scalar;
      const pick = A.getUnsafe(picks, index);
      const opener = A.getUnsafe(picks, runStart);
      if (pick.ends !== 0 && index < scalars.length - 1) {
        return;
      }
      if (opener.insert === 0) {
        target += opener.inserted;
      }
      const to = Str.length(target);
      if (opener.kind < 5) {
        segments.push(
          AlignedSegment.cases.Kept.make({
            from: utf16At(from, from + run.length),
            to: utf16At(to, to + run.length),
          })
        );
        target += run;
      } else if (opener.kind < 8) {
        segments.push(
          AlignedSegment.cases.Rewritten.make({
            from: utf16At(from, from + run.length),
            to: utf16At(to, to + opener.replacement.length),
          })
        );
        target += opener.replacement;
      }
      from += run.length;
      runStart = index + 1;
      run = "";
    });
    return { segments, target };
  });
};
