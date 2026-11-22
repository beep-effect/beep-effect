// The `@beep/text` law generators that only its own tests use. Text, scalar ranges, captures and anchors rows
// come from `@beep/text/Arbitrary` (decision p3-text-arbitraries-in-src); this file adds the narrow alphabet, the
// normalization pieces, the generated locator steps and the platform SHA-256 the tests pass to those generators.
// Every boundary is computed from the code points themselves and every range sits on scalar boundaries (decision
// p0-law-generators-well-formed-text). Split surrogates stay negative fixtures.
import {
  anchoredOn,
  rangeIn,
  scalarRangeIn,
  sourceFor,
  wellFormedTextOf,
  wellFormedTextWith,
} from "@beep/text/Arbitrary";
import { AlignedSegment } from "@beep/text/LocatorMap";
import { Position } from "@beep/text/OffsetUnit";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { JsoncDigest } from "@beep/jsonc/JsoncFingerprint";

const between = (minimum: number, maximum: number) => Arbitrary.schema(S.Int.check(S.isBetween({ minimum, maximum })));

const at = (values: A.NonEmptyReadonlyArray<number>, index: number): number =>
  O.getOrElse(A.get(values, index), () => A.headNonEmpty(values));

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
  Arbitrary.map(narrowCodePoints(options), wellFormedTextOf);

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
    return {
      passage: wellFormedTextOf(passage),
      text: wellFormedTextOf(A.appendAll(passage, A.drop(passage, border.length))),
    };
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

// A synchronous SHA-256 from the platform: the digest callback the preimage Result twins and the
// `@beep/text/Arbitrary` generators take, and an oracle for the text digests that is independent of the `Digest`
// service the minting functions use.
const { createHash } = process.getBuiltinModule("node:crypto");

/** The raw SHA-256 of bytes in memory. */
export const sha256: JsoncDigest = (bytes) => new Uint8Array(createHash("sha256").update(bytes).digest());

/** Generated text, a scalar range in it, a capture of the text, and the anchors row of the range. */
export const anchoredCase = Arbitrary.flatMap(wellFormedText, (generated) =>
  Arbitrary.map(
    Arbitrary.all([scalarRangeIn(generated.codePoints.length), sourceFor(sha256)(generated.text)]),
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
