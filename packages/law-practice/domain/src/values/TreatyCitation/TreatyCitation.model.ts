/**
 * Treaty citation (#309): treaty-series citations such as T.I.A.S. No. 1502 or
 * 1155 U.N.T.S. 331.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.js";

const $I = $LawPracticeDomainId.create("values/TreatyCitation/TreatyCitation.model");

/**
 * Treaty-series citation (#309).
 *
 * Spreads the shared {@link CitationBase} fields and tags itself with the
 * `treaty` discriminant. Covers both series-number forms (T.I.A.S. No. 1502)
 * and volume-series-page forms (1155 U.N.T.S. 331); every own field is optional
 * and modeled as `Option` with a `None` constructor default.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { TreatyCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = TreatyCitation.make({
 *   text: "1155 U.N.T.S. 331",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "1155 U.N.T.S. 331",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 * })
 *
 * console.log(citation.type) // "treaty"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TreatyCitation extends S.Class<TreatyCitation>($I`TreatyCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("treaty"),
    series: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Treaty series identifier (e.g. "T.I.A.S.", "U.N.T.S.", "U.S.T.").',
      })
    ),
    seriesNumber: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Series number for "No."-style series (T.I.A.S. No. 1502 -> "1502").',
      })
    ),
    volume: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Volume for volume-series-page forms (1155 U.N.T.S. 331 -> 1155).",
      })
    ),
    page: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Page for volume-series-page forms.",
      })
    ),
    treatyName: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Named treaty title (reserved; not yet populated).",
      })
    ),
    article: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Cited article (reserved).",
      })
    ),
    paragraph: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Cited paragraph (reserved).",
      })
    ),
    year: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Publication year (reserved).",
      })
    ),
  },
  $I.annote("TreatyCitation", {
    description: "Treaty-series citation (#309): T.I.A.S. No. 1502, 1155 U.N.T.S. 331.",
  })
) {}

/**
 * Companion namespace for `TreatyCitation`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TreatyCitation {
  /**
   * Wire-encoded representation of a decoded {@link TreatyCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { TreatyCitation } from "@beep/law-practice-domain"
   *
   * type Wire = TreatyCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof TreatyCitation.Encoded;
}
