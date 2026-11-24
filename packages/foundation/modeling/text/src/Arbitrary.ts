/**
 * Law generators for text, scalar-boundary ranges, captures and anchors-table
 * rows, served to every package whose laws are stated over `@beep/text`.
 *
 * **Details**
 *
 * Text is well-formed UTF-16 by construction: code points come from printable
 * BMP scalars below the surrogate block (one-, two- and three-byte in UTF-8)
 * plus 64 astral emoji, so nothing is discarded. Every boundary is computed
 * from the code points themselves, independently of the scans under test, and
 * every range sits on scalar boundaries (decision
 * `p0-law-generators-well-formed-text`). Split surrogates stay negative
 * fixtures of the tests that need them.
 *
 * Digests are a caller-supplied synchronous SHA-256 (`JsoncDigest`), so the
 * module stays runtime-neutral (decision `p3-text-arbitraries-in-src`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Hex from "effect/encoding/Hex";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Anchored } from "./Occurrence.ts";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity, SourceTextLocator } from "./SourceTextIdentity.ts";
import { TextAnchor } from "./TextAnchor.ts";
import { TextAnchorVerificationReceipt } from "./VerifiedTextAnchor.ts";
import type { JsoncDigest } from "@beep/jsonc/JsoncFingerprint";
import type { OffsetUnit } from "./OffsetUnit.ts";

// decision: law-generators-well-formed-text
const CodePointPick = S.Int.check(S.isBetween({ minimum: 0x20, maximum: 0x2fff + 64 }));

const toCodePoint = (pick: number): number => (pick > 0x2fff ? 0x1f600 + (pick - 0x3000) : pick);

const utf16Width = (codePoint: number): number => (codePoint > 0xffff ? 2 : 1);

const utf8Width = (codePoint: number): number =>
  codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;

const between = (minimum: number, maximum: number) => Arbitrary.schema(S.Int.check(S.isBetween({ minimum, maximum })));

/**
 * The text of well-formed code points, with its scalar boundaries in each
 * unit: offset 0, then the end of each scalar.
 *
 * **Example** (Read the boundaries of an astral text)
 *
 * ```ts import.meta.vitest name="Read the boundaries of an astral text"
 * import { wellFormedTextOf } from "@beep/text/Arbitrary"
 *
 * const generated = wellFormedTextOf([0x41, 0x1f600, 0x42])
 * generated.text // => "A😀B"
 * generated.boundaries["utf16-code-unit"] // => [0, 1, 3, 4]
 * generated.boundaries["unicode-code-point"] // => [0, 1, 2, 3]
 * generated.boundaries["utf8-byte"] // => [0, 1, 5, 6]
 * ```
 *
 * @param codePoints - Unicode scalar values, none of them a surrogate.
 * @returns The text, its code points and its boundaries per offset unit.
 * @category constructors
 * @since 0.0.0
 */
export const wellFormedTextOf = (codePoints: ReadonlyArray<number>) => ({
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

/**
 * Generated well-formed text of a bounded number of scalars, with its scalar
 * boundaries in each unit.
 *
 * **Example** (Generate a short text)
 *
 * ```ts
 * import { wellFormedTextWith } from "@beep/text/Arbitrary"
 *
 * const shortText = wellFormedTextWith({ minLength: 1, maxLength: 12 })
 * console.log(shortText)
 * ```
 *
 * @param options - The least and greatest number of scalars.
 * @returns An arbitrary of generated text with its boundaries.
 * @category constructors
 * @since 0.0.0
 */
export const wellFormedTextWith = (options: { readonly minLength: number; readonly maxLength: number }) =>
  Arbitrary.map(Arbitrary.array(Arbitrary.schema(CodePointPick), options), (picks) =>
    wellFormedTextOf(A.map(picks, toCodePoint))
  );

/**
 * A non-empty range of scalar indexes `[first, last]` into a text of
 * `scalars` scalars, with `first < last`.
 *
 * **Example** (Draw a range in a five-scalar text)
 *
 * ```ts
 * import { scalarRangeIn } from "@beep/text/Arbitrary"
 *
 * const ranges = scalarRangeIn(5)
 * console.log(ranges)
 * ```
 *
 * @param scalars - The number of scalars in the text, at least one.
 * @returns An arbitrary of scalar-index ranges.
 * @category constructors
 * @since 0.0.0
 */
export const scalarRangeIn = (scalars: number) =>
  Arbitrary.flatMap(between(0, scalars - 1), (first) =>
    Arbitrary.map(between(first + 1, scalars), (last) => ({ first, last }))
  );

/**
 * The offsets of a scalar-index range in one unit's boundary list.
 *
 * **Example** (Read a range in UTF-16 code units)
 *
 * ```ts import.meta.vitest name="Read a range in UTF-16 code units"
 * import { rangeIn, wellFormedTextOf } from "@beep/text/Arbitrary"
 *
 * const { boundaries } = wellFormedTextOf([0x41, 0x1f600, 0x42])
 * rangeIn(boundaries["utf16-code-unit"])({ first: 2, last: 3 }) // => { start: 3, end: 4 }
 * ```
 *
 * @param boundaries - The boundary list of one unit.
 * @returns The range's start and end offsets in that unit.
 * @category constructors
 * @since 0.0.0
 */
export const rangeIn =
  (boundaries: A.NonEmptyReadonlyArray<number>) =>
  (range: { readonly first: number; readonly last: number }): { readonly start: number; readonly end: number } => ({
    start: A.getUnsafe(boundaries, range.first),
    end: A.getUnsafe(boundaries, range.last),
  });

const utf8 = new TextEncoder();

/**
 * The `sha256:<hex>` digest of a text's UTF-8 bytes, as a capture's
 * `textDigest` records it.
 *
 * **Example** (Digest a text)
 *
 * ```ts
 * import type { JsoncDigest } from "@beep/jsonc/JsoncFingerprint"
 * import { textDigestOf } from "@beep/text/Arbitrary"
 *
 * const digestOf = (sha256: JsoncDigest) => textDigestOf(sha256)("fact")
 * console.log(typeof digestOf)
 * ```
 *
 * @param digest - A synchronous SHA-256 of bytes in memory.
 * @returns The digest of a text.
 * @category constructors
 * @since 0.0.0
 */
export const textDigestOf =
  (digest: JsoncDigest) =>
  (text: string): SourceTextDigest =>
    SourceTextDigest.make(`sha256:${Hex.encode(digest(utf8.encode(text)))}`);

const nonEmptyFieldText = Arbitrary.map(wellFormedTextWith({ minLength: 1, maxLength: 12 }), ({ text }) => text);

const CaptureFields = Arbitrary.all({
  scopeRef: nonEmptyFieldText,
  sourceRef: nonEmptyFieldText,
  locator: nonEmptyFieldText,
  sourceBytes: nonEmptyFieldText,
  name: nonEmptyFieldText,
  version: nonEmptyFieldText,
  normalizationVersion: nonEmptyFieldText,
});

/**
 * A capture of `text`: generated well-formed fields, a backslash-free locator
 * and the text's own digest, so a receipt on it also passes re-verification.
 *
 * **Example** (Generate captures of a text)
 *
 * ```ts
 * import type { JsoncDigest } from "@beep/jsonc/JsoncFingerprint"
 * import { sourceFor } from "@beep/text/Arbitrary"
 *
 * const capturesOf = (sha256: JsoncDigest) => sourceFor(sha256)("Note: fact.")
 * console.log(typeof capturesOf)
 * ```
 *
 * @param digest - A synchronous SHA-256 of bytes in memory.
 * @returns An arbitrary of captures of a text.
 * @category constructors
 * @since 0.0.0
 */
export const sourceFor = (digest: JsoncDigest) => {
  const digestOf = textDigestOf(digest);
  return (text: string) =>
    Arbitrary.map(CaptureFields, (fields) =>
      SourceTextIdentity.make({
        scopeRef: fields.scopeRef,
        sourceRef: fields.sourceRef,
        locator: SourceTextLocator.make(Str.replaceAll("\\", "/")(fields.locator)),
        sourceDigest: digestOf(fields.sourceBytes),
        textDigest: digestOf(text),
        extractor: SourceTextExtractor.make({ name: fields.name, version: fields.version }),
        normalizationVersion: fields.normalizationVersion,
      })
    );
};

type Utf16Range = { readonly start: number; readonly end: number };

/**
 * The anchors row of a UTF-16 range of `text` in `source`; the quote is the
 * slice.
 *
 * **Example** (Anchor a word)
 *
 * ```ts
 * import { anchoredOn } from "@beep/text/Arbitrary"
 * import type { SourceTextIdentity } from "@beep/text/SourceTextIdentity"
 *
 * const anchorFact = anchoredOn("Note: fact.", { start: 6, end: 10 })
 * const quoteOf = (source: SourceTextIdentity) => anchorFact(source).receipt.anchor.quote
 * console.log(typeof quoteOf)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
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
