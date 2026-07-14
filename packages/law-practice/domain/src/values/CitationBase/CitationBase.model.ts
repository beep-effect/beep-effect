/**
 * Citation-base value object: the fields shared by every parsed legal-citation
 * subtype, ported from the eyecite `CitationBase` interface.
 *
 * These fields are spread via `{ ...CitationBase.fields }` into each concrete
 * citation subtype, so `CitationBase` is kept as a plain `S.Class` with no
 * `type` discriminant of its own.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationId } from "../CitationId/index.js";
import { CitationSignal } from "../CitationSignal/index.js";
import { CitationWarning } from "../CitationWarning/index.js";
import { Span } from "../Span/index.js";
import { StringCitationGroup } from "../StringCitationGroup/index.js";

const $I = $LawPracticeDomainId.create("values/CitationBase/CitationBase.model");

/**
 * Base fields shared by all citation types.
 *
 * Every concrete citation subtype spreads `{ ...CitationBase.fields }` and adds
 * its own `type` discriminant and component spans on top, so this class carries
 * only the shared metadata: match text, position span, confidence, timing, and
 * the optional string-citation and footnote grouping fields.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { CitationBase, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const base = CitationBase.make({
 *   text: "410 U.S. 113",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(12),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(12),
 *   }),
 *   confidence: 1,
 *   matchedText: "410 U.S. 113",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(3),
 * })
 *
 * console.log(base.text) // "410 U.S. 113"
 * console.log(O.isNone(base.id)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CitationBase extends S.Class<CitationBase>($I`CitationBase`)(
  {
    id: CitationId.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Stable identity within one extractCitations() result set. Populated by extractCitations() for every citation; optional because granular per-type extractors do not assign one (#858).",
      })
    ),
    text: S.String.annotateKey({
      description: "Original matched text.",
    }),
    span: Span.annotateKey({
      description: "Position span in document (originalStart/End point to original text).",
    }),
    confidence: S.Finite.annotateKey({
      description:
        "Confidence score indicating match certainty (0-1). 1.0 certain; 0.8-0.99 high; 0.5-0.79 medium; <0.5 low.",
    }),
    matchedText: S.String.annotateKey({
      description: "Exact substring matched from the original text.",
    }),
    processTimeMs: S.Finite.annotateKey({
      description: "Time spent processing this citation (milliseconds).",
    }),
    patternsChecked: NonNegativeInt.annotateKey({
      description: "Number of regex patterns checked before match.",
    }),
    warnings: S.Array(CitationWarning).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Warnings for malformed or ambiguous regions.",
      })
    ),
    signal: CitationSignal.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Introductory signal word (e.g., "see", "see also", "but see").',
      })
    ),
    stringCitationGroupId: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Group ID for string citations sharing the same proposition.",
      })
    ),
    stringCitationIndex: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Position within the string citation group (0-indexed).",
      })
    ),
    stringCitationGroupSize: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Total number of citations in this string citation group.",
      })
    ),
    stringCitationGroup: StringCitationGroup.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "String-citation group (#857): all members (incl. self) by stable id, in document order, plus the group's leading signal.",
      })
    ),
    inFootnote: S.Boolean.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Whether this citation appears in a footnote (only populated when detectFootnotes enabled).",
      })
    ),
    footnoteNumber: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Footnote number, if applicable (only populated when detectFootnotes enabled).",
      })
    ),
  },
  $I.annote("CitationBase", {
    description: "Base fields shared by all citation types.",
  })
) {}

/**
 * Companion namespace for `CitationBase`.
 *
 * @example
 * ```ts
 * import type { CitationBase } from "@beep/law-practice-domain"
 *
 * const confidence: CitationBase.Encoded["confidence"] = 1
 * console.log(confidence) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CitationBase {
  /**
   * Wire-encoded representation of a decoded {@link CitationBase}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { CitationBase } from "@beep/law-practice-domain"
   *
   * type Wire = CitationBase.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CitationBase.Encoded;
}
