/**
 * TextAnchor - the canonical, domain-agnostic "where in the source text" value.
 *
 * A `TextAnchor` pins a piece of derived knowledge to a half-open character range
 * of a source document, plus the exact quoted substring. It is pure provenance
 * substrate: no confidence, no claim semantics, no judgement — those belong to
 * the consuming slice (e.g. epistemic `EvidenceSpan` wraps a `TextAnchor` and
 * adds a `Confidence`). Char offsets are model-stable and re-sliceable: given the
 * source text, `text.slice(startChar, endChar)` should reproduce `quote`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ProvenanceId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { identity, Number as N } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ProvenanceId.create("TextAnchor");
const isNonNegativeInt = S.is(NonNegativeInt);
const isHighSurrogate = N.between({ minimum: 0xd800, maximum: 0xdbff });
const isLowSurrogate = N.between({ minimum: 0xdc00, maximum: 0xdfff });

/**
 * The field schemas of a {@link TextAnchor}. Exported so consumers can spread
 * them into a richer value object (e.g. an evidence span that adds a confidence)
 * without re-declaring the offset shape.
 *
 * **Example** (Spreading fields into schema)
 *
 * ```ts import.meta.vitest name="Spreading fields into schema"
 * import * as S from "effect/Schema"
 * import {
 *   TextAnchorFields,
 *   TextAnchorWidthCheck,
 * } from "@beep/provenance/TextAnchor"
 *
 * const Span = S.Struct({ ...TextAnchorFields }).check(TextAnchorWidthCheck)
 * Object.keys(Span.fields) // => ["startChar", "endChar", "quote"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TextAnchorFields = {
  startChar: NonNegativeInt.annotateKey({
    description: "Inclusive start character offset into the source text.",
  }),
  endChar: NonNegativeInt.annotateKey({
    description: "Exclusive end character offset into the source text.",
  }),
  quote: S.NonEmptyString.annotateKey({
    description: "Exact quoted substring; source.slice(startChar, endChar) should reproduce it.",
  }),
};

class TextAnchorStruct extends S.Class<TextAnchorStruct>($I`TextAnchorStruct`)(
  TextAnchorFields,
  $I.annote("TextAnchorStruct", {
    description: "Internal structural base for a half-open UTF-16 text range and its exact quote.",
  })
) {}
const hasConsistentTextAnchorWidth = (anchor: {
  readonly endChar: number;
  readonly quote: string;
  readonly startChar: number;
}): boolean => anchor.startChar < anchor.endChar && anchor.endChar - anchor.startChar === Str.length(anchor.quote);

/**
 * Reusable cross-field check for schemas that flatten {@link TextAnchorFields}.
 *
 * **Example** (Checking flattened anchor schema)
 *
 * ```ts import.meta.vitest name="Checking flattened anchor schema"
 * import * as S from "effect/Schema"
 * import { TextAnchorFields, TextAnchorWidthCheck } from "@beep/provenance/TextAnchor"
 *
 * const FlatAnchor = S.Struct(TextAnchorFields).check(TextAnchorWidthCheck)
 * S.is(FlatAnchor)({ startChar: 0, endChar: 4, quote: "fact" }) // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const TextAnchorWidthCheck = S.makeFilter(hasConsistentTextAnchorWidth, {
  identifier: $I`TextAnchorWidthCheck`,
  title: "Text Anchor Width",
  description: "Checks that a non-empty half-open anchor range has the same UTF-16 width as its quote.",
  message: "Expected endChar - startChar to equal the non-empty quote's UTF-16 code-unit length.",
});

/**
 * Tests whether an offset falls between complete UTF-16 code points.
 *
 * **Details**
 *
 * Zero and the source-text length are valid boundaries. An offset between the
 * high and low surrogates of one supplementary code point is not.
 *
 * **Example** (Surrogate pair boundary checks)
 *
 * ```ts import.meta.vitest name="Surrogate pair boundary checks"
 * import { isUtf16Boundary } from "@beep/provenance/TextAnchor"
 *
 * const sourceText = "A😀B"
 * isUtf16Boundary(sourceText, 1) // => true
 * isUtf16Boundary(sourceText, 2) // => false
 * isUtf16Boundary(sourceText, 3) // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isUtf16Boundary: {
  (sourceText: string, boundary: number): boolean;
  (boundary: number): (sourceText: string) => boolean;
} = dual(2, (sourceText: string, boundary: number): boolean => {
  const splitsSurrogatePair =
    O.exists(Str.charCodeAt(sourceText, boundary - 1), isHighSurrogate) &&
    O.exists(Str.charCodeAt(sourceText, boundary), isLowSurrogate);
  return isNonNegativeInt(boundary) && N.isLessThanOrEqualTo(boundary, Str.length(sourceText)) && !splitsSurrogatePair;
});

const TextAnchorSchema = TextAnchorStruct.mapFields(identity)
  .check(TextAnchorWidthCheck)
  .annotate({
    toArbitrary: () => (fc) =>
      fc.tuple(fc.nat(10_000), fc.string({ minLength: 1, maxLength: 256 })).map(([startChar, quote]) =>
        TextAnchorStruct.make({
          startChar: NonNegativeInt.make(startChar),
          endChar: NonNegativeInt.make(startChar + Str.length(quote)),
          quote,
        })
      ),
  });

/**
 * A half-open character-offset anchor into a source document.
 *
 * **Example** (Decoding a TextAnchor)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { TextAnchor } from "@beep/provenance/TextAnchor"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(TextAnchor)({
 *   startChar: 0,
 *   endChar: 14,
 *   quote: "a claimed fact",
 * })
 * Effect.runPromise(program).then((anchor) => console.log(anchor.quote))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextAnchor extends S.Class<TextAnchor>($I`TextAnchor`)(
  TextAnchorSchema,
  $I.annote("TextAnchor", {
    description:
      "A non-empty half-open character range [startChar, endChar) whose UTF-16 width equals its exact quote.",
  })
) {
  /**
   * Whether an anchor is well-ordered: `startChar <= endChar`.
   *
   * **Example** (Checking well-ordered range)
   *
   * ```ts import.meta.vitest name="Checking well-ordered range"
   * import { TextAnchor } from "@beep/provenance/TextAnchor"
   *
   * TextAnchor.isWellOrdered({ startChar: 0, endChar: 14 }) // => true
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly isWellOrdered = (anchor: Pick<typeof TextAnchor.Encoded, "startChar" | "endChar">): boolean =>
    anchor.startChar <= anchor.endChar;

  /**
   * Whether an anchor is internally consistent without needing the source text:
   * a non-empty half-open range whose width equals the quote length.
   *
   * **Example** (Checking internal consistency)
   *
   * ```ts import.meta.vitest name="Checking internal consistency"
   * import { TextAnchor } from "@beep/provenance/TextAnchor"
   *
   * TextAnchor.isInternallyConsistent({ startChar: 0, endChar: 4, quote: "fact" }) // => true
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly isInternallyConsistent = (
    anchor: Pick<typeof TextAnchor.Encoded, "startChar" | "endChar" | "quote">
  ): boolean => hasConsistentTextAnchorWidth(anchor);

  static readonly decodeEffect = S.decodeEffect(TextAnchor);
}

/**
 * Whether an anchor is well-ordered: `startChar <= endChar`. A malformed anchor
 * (start after end) is a defect at the producing boundary.
 *
 * **Example** (Valid and inverted ranges)
 *
 * ```ts import.meta.vitest name="Valid and inverted ranges"
 * import { isWellOrdered } from "@beep/provenance/TextAnchor"
 *
 * isWellOrdered({ startChar: 0, endChar: 14 }) // => true
 * isWellOrdered({ startChar: 9, endChar: 2 }) // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isWellOrdered = TextAnchor.isWellOrdered;

/**
 * Whether an anchor is internally consistent without needing the source text.
 *
 * **Example** (Matching width and quote)
 *
 * ```ts import.meta.vitest name="Matching width and quote"
 * import { isInternallyConsistent } from "@beep/provenance/TextAnchor"
 *
 * isInternallyConsistent({ startChar: 0, endChar: 4, quote: "fact" }) // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isInternallyConsistent = TextAnchor.isInternallyConsistent;
