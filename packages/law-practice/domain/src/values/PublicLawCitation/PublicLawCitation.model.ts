/**
 * Public law citation: a parsed `Pub. L. No.` reference identifying an enacted
 * federal statute by its Congress and law number.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.js";
import { PublicLawComponentSpan } from "../ComponentSpan/index.js";

const $I = $LawPracticeDomainId.create("values/PublicLawCitation/PublicLawCitation.model");

/**
 * A parsed public law citation (type: `publicLaw`).
 *
 * Spreads the shared {@link CitationBase} fields and adds the `publicLaw`
 * discriminant plus the enacting `congress` and `lawNumber`, an optional bill
 * `title`, and the optional component `spans` locating each sub-part within the
 * source text.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { PublicLawCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = PublicLawCitation.make({
 *   text: "Pub. L. No. 116-136",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "Pub. L. No. 116-136",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   congress: NonNegativeInt.make(116),
 *   lawNumber: NonNegativeInt.make(136),
 * })
 *
 * console.log(citation.type) // "publicLaw"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PublicLawCitation extends S.Class<PublicLawCitation>($I`PublicLawCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("publicLaw"),
    congress: NonNegativeInt.annotateKey({
      description: "Congress number (e.g., 116).",
    }),
    lawNumber: NonNegativeInt.annotateKey({
      description: "Law number within that Congress.",
    }),
    title: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional bill title extracted from nearby text.",
      })
    ),
    spans: PublicLawComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component spans locating each recognized sub-part within the source text.",
      })
    ),
  },
  $I.annote("PublicLawCitation", {
    description: "A parsed public law citation.",
  })
) {}

/**
 * Companion namespace for `PublicLawCitation`.
 *
 * @example
 * ```ts
 * import type { PublicLawCitation } from "@beep/law-practice-domain"
 *
 * type PublicLawWire = PublicLawCitation.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PublicLawCitation {
  /**
   * Wire-encoded representation of a decoded {@link PublicLawCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { PublicLawCitation } from "@beep/law-practice-domain"
   *
   * type Wire = PublicLawCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof PublicLawCitation.Encoded;
}
