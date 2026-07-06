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
import * as S from "effect/Schema";

const $I = $ProvenanceId.create("TextAnchor");

/**
 * The field schemas of a {@link TextAnchor}. Exported so consumers can spread
 * them into a richer value object (e.g. an evidence span that adds a confidence)
 * without re-declaring the offset shape.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { TextAnchorFields } from "@beep/provenance/TextAnchor"
 *
 * const Span = S.Struct({ ...TextAnchorFields })
 * console.log(Object.keys(Span.fields)) // ["startChar", "endChar", "quote"]
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
  quote: S.String.annotateKey({
    description: "Exact quoted substring; source.slice(startChar, endChar) should reproduce it.",
  }),
};

/**
 * A half-open character-offset anchor into a source document.
 *
 * @example
 * ```ts
 * import { TextAnchor } from "@beep/provenance/TextAnchor"
 * import * as S from "effect/Schema"
 *
 * const anchor = S.decodeUnknownSync(TextAnchor)({
 *   startChar: 0,
 *   endChar: 14,
 *   quote: "a claimed fact",
 * })
 * console.log(anchor.quote) // "a claimed fact"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextAnchor extends S.Class<TextAnchor>($I`TextAnchor`)(
  TextAnchorFields,
  $I.annote("TextAnchor", {
    description:
      "A half-open character range [startChar, endChar) into a source document, with the exact quoted substring.",
  })
) {
  /**
   * Whether an anchor is well-ordered: `startChar <= endChar`.
   *
   * @example
   * ```ts
   * import { TextAnchor } from "@beep/provenance/TextAnchor"
   *
   * console.log(TextAnchor.isWellOrdered({ startChar: 0, endChar: 14 })) // true
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly isWellOrdered = (anchor: Pick<typeof TextAnchor.Encoded, "startChar" | "endChar">): boolean =>
    anchor.startChar <= anchor.endChar;
}

/**
 * Whether an anchor is well-ordered: `startChar <= endChar`. A malformed anchor
 * (start after end) is a defect at the producing boundary.
 *
 * Encoded as a predicate rather than a baked schema filter because
 * `TextAnchorFields` is a public spread surface; schema-level enforcement needs
 * a same-sweep update for spread consumers. Producers should assert this when
 * constructing anchors.
 *
 * @example
 * ```ts
 * import { isWellOrdered } from "@beep/provenance/TextAnchor"
 *
 * console.log(isWellOrdered({ startChar: 0, endChar: 14 })) // true
 * console.log(isWellOrdered({ startChar: 9, endChar: 2 })) // false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isWellOrdered = TextAnchor.isWellOrdered;
