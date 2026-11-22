/**
 * Text normalizations that record where each part of the normalized text came
 * from.
 *
 * **Details**
 *
 * `normalizeText` returns the normalized text and the gap-free list of aligned
 * segments between the two: a `Kept` segment is text left unchanged and a
 * `Rewritten` segment is a part the normalization rewrote as a whole. Every
 * position is `utf16-code-unit`. The segments are what a recorded normalization
 * hands to re-anchoring, so a range cut inside a rewritten part widens to its
 * edges instead of landing in the middle of a rewrite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $TextId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AlignedSegment } from "./LocatorMap.ts";
import { Position } from "./OffsetUnit.ts";

const $I = $TextId.create("TextNormalization");

/**
 * The normalizations a text can go through: Unicode NFKC, and the removal of
 * a hyphen and line break inside a word.
 *
 * **Example** (Check a normalization)
 *
 * ```ts import.meta.vitest name="Check a normalization"
 * import { TextNormalization } from "@beep/text/TextNormalization"
 *
 * TextNormalization.is.dehyphenate("dehyphenate") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TextNormalization = LiteralKit(["nfkc", "dehyphenate"]).pipe(
  $I.annoteSchema("TextNormalization", {
    description: "A text normalization that records its aligned segments: nfkc or dehyphenate.",
  })
);

/**
 * Type for {@link TextNormalization}.
 *
 * **Example** (Annotate a normalization)
 *
 * ```ts
 * import type { TextNormalization } from "@beep/text/TextNormalization"
 *
 * const normalization: TextNormalization = "nfkc"
 * console.log(normalization)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TextNormalization = typeof TextNormalization.Type;

/**
 * A normalized text and its aligned segments from the input: ordered,
 * disjoint, and covering both texts without a gap.
 *
 * **Example** (Read the segments of a ligature)
 *
 * ```ts import.meta.vitest name="Read the segments of a ligature"
 * import { normalizeText } from "@beep/text/TextNormalization"
 *
 * const normalized = normalizeText("ﬁne", "nfkc")
 * normalized.text // => "fine"
 * normalized.segments.map((segment) => segment._tag) // => ["Rewritten", "Kept"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NormalizedText extends S.Opaque<NormalizedText, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.String.annotateKey({ description: "The normalized text." }),
    segments: S.Array(AlignedSegment).annotateKey({
      description: "The aligned segments from the input to the normalized text, in order and without a gap.",
    }),
  }).pipe(
    $I.annoteSchema("NormalizedText", {
      description: "A normalized text with the aligned segments that lead to it from its input.",
    })
  )
) {}

const normalizeNfkc = Str.normalize("NFKC");

// A scalar whose own NFKC form starts with a combining mark joins the open cluster (decision
// p2-nfkc-clusters-join-on-the-normalized-mark): U+0E33, U+0EB3, U+FF9E and U+FF9F are letters of that kind.
const startsWithMark = /^\p{M}/u;

// A hyphen or U+2010 and one line break, between a letter and a lowercase letter. The lookarounds read the two
// letters without consuming them, so two matches can share one.
const hyphenBreak = /(?<=\p{L})[-‐](?:\r\n|\n|\r)(?=\p{Ll})/gu;

// One part of the input rewritten as a whole: the half-open UTF-16 range and the text it became.
type Rewrite = { readonly start: number; readonly end: number; readonly replacement: string };

const utf16 = (start: number, end: number): Position => Position.make({ unit: "utf16-code-unit", start, end });

// Performance boundary (single-pass scans): normalization visits every scalar of its input, so the scans iterate
// the string natively and keep their running offsets and the rewrites in local mutable state; the same boundary is
// drawn in `internal/scalars.ts`. Nothing mutable escapes a call: the result is an immutable schema value.

// The open cluster's NFKC form once `scalar` joins it, or `O.none()` when `scalar` opens a new cluster. A join on a
// mark leaves the form unknown (`undefined`), to be computed when it is read.
const joinedForm = (
  cluster: string,
  form: string | undefined,
  scalar: string,
  scalarForm: string
): O.Option<string | undefined> => {
  if (cluster === "") {
    return O.none();
  }
  if (startsWithMark.test(scalarForm)) {
    return O.some(undefined);
  }
  const joined = normalizeNfkc(cluster + scalar);
  return joined === (form ?? normalizeNfkc(cluster)) + scalarForm ? O.none() : O.some(joined);
};

// The NFKC clusters of a text: a scalar joins the open cluster when its NFKC form starts with a combining mark or
// when normalizing the two together differs from normalizing each. Normalization never moves text across a cluster
// edge, so the NFKC forms of the clusters concatenate to the NFKC form of the text. A cluster whose form differs
// from it is a rewrite; the open cluster's form is computed only when a pair test or the close reads it.
const nfkcRewrites = (text: string): ReadonlyArray<Rewrite> => {
  const rewrites: Array<Rewrite> = [];
  let start = 0;
  let end = 0;
  let cluster = "";
  let form: string | undefined = "";
  const close = (): void => {
    const replacement = form ?? normalizeNfkc(cluster);
    if (replacement !== cluster) {
      rewrites.push({ start, end, replacement });
    }
  };
  for (const scalar of text) {
    const scalarForm = normalizeNfkc(scalar);
    const joined = joinedForm(cluster, form, scalar, scalarForm);
    if (O.isSome(joined)) {
      cluster += scalar;
      form = joined.value;
    } else {
      close();
      cluster = scalar;
      start = end;
      form = scalarForm;
    }
    end += scalar.length;
  }
  close();
  return rewrites;
};

const isAstral = (codePoint: number): boolean => codePoint > 0xffff;

// UTF-16 width of the scalar that ends at `offset`, and of the one that starts there; both exist where they are read.
const widthBefore = (text: string, offset: number): number =>
  O.exists(Str.codePointAt(text, offset - 2), isAstral) ? 2 : 1;
const widthAt = (text: string, offset: number): number => (O.exists(Str.codePointAt(text, offset), isAstral) ? 2 : 1);

// Each rewrite is the whole context the rule reads: the letter before, the hyphen and break, and the lowercase letter
// after. A match whose letter before is the previous match's letter after extends that rewrite, so `a-\nb-\nc` is one.
const dehyphenateRewrites = (text: string): ReadonlyArray<Rewrite> => {
  const rewrites: Array<Rewrite> = [];
  // A copy of the pattern per call: its `lastIndex` is the scan's own state.
  const pattern = new RegExp(hyphenBreak);
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    const runStart = match.index;
    const runEnd = runStart + match[0].length;
    const start = runStart - widthBefore(text, runStart);
    const end = runEnd + widthAt(text, runEnd);
    const after = Str.slice(runEnd, end)(text);
    const previous = rewrites.at(-1);
    if (previous !== undefined && start < previous.end) {
      rewrites[rewrites.length - 1] = { start: previous.start, end, replacement: previous.replacement + after };
    } else {
      rewrites.push({ start, end, replacement: Str.slice(start, runStart)(text) + after });
    }
  }
  return rewrites;
};

// The normalized text and its segments: the ranges between rewrites are kept, each rewrite is one segment.
const fromRewrites = (text: string, rewrites: ReadonlyArray<Rewrite>): NormalizedText => {
  const parts: Array<string> = [];
  const segments: Array<AlignedSegment> = [];
  let at = 0;
  let out = 0;
  const keepUntil = (end: number): void => {
    if (end > at) {
      segments.push(AlignedSegment.cases.Kept.make({ from: utf16(at, end), to: utf16(out, out + end - at) }));
      parts.push(Str.slice(at, end)(text));
      out += end - at;
    }
  };
  for (const { start, end, replacement } of rewrites) {
    keepUntil(start);
    const to = out + replacement.length;
    segments.push(AlignedSegment.cases.Rewritten.make({ from: utf16(start, end), to: utf16(out, to) }));
    parts.push(replacement);
    out = to;
    at = end;
  }
  keepUntil(text.length);
  return NormalizedText.make({ text: A.join(parts, ""), segments });
};

/**
 * Normalize a text and record its aligned segments.
 *
 * **Details**
 *
 * - `nfkc`: Unicode NFKC over clusters. A scalar joins the open cluster when
 *   its own NFKC form starts with a combining mark or when normalizing the two
 *   together differs from normalizing each; a cluster NFKC leaves unchanged is
 *   kept, any other is one rewritten segment. The text is
 *   `text.normalize("NFKC")`.
 * - `dehyphenate`: removes `-` or U+2010 and one line break (`\r\n`, `\n` or
 *   `\r`) when a letter precedes and a lowercase letter follows. The letter
 *   before, the removed run and the letter after are one rewritten segment
 *   (`m-\np` to `mp`), and matches that share a letter merge into one
 *   (`a-\nb-\nc` to `abc`).
 *
 * **Example** (Join a word broken across lines)
 *
 * ```ts import.meta.vitest name="Join a word broken across lines"
 * import { normalizeText } from "@beep/text/TextNormalization"
 *
 * const normalized = normalizeText("exam-\nple", "dehyphenate")
 * normalized.text // => "example"
 * normalized.segments.map((segment) => [segment._tag, segment.from.start, segment.from.end])
 * // => [["Kept", 0, 3], ["Rewritten", 3, 7], ["Kept", 7, 9]]
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeText: {
  (normalization: TextNormalization): (text: string) => NormalizedText;
  (text: string, normalization: TextNormalization): NormalizedText;
} = dual(
  2,
  (text: string, normalization: TextNormalization): NormalizedText =>
    fromRewrites(
      text,
      TextNormalization.match(normalization, {
        nfkc: () => nfkcRewrites(text),
        dehyphenate: () => dehyphenateRewrites(text),
      })
    )
);
