/**
 * Local / municipal ordinance citation (#778). Clark County Code/Ordinance
 * (CCCO § 2.12.010(1)) is the first member.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.js";

const $I = $LawPracticeDomainId.create("values/LocalOrdinanceCitation/LocalOrdinanceCitation.model");

/**
 * Local / municipal ordinance citation (#778).
 *
 * Spreads the shared {@link CitationBase} fields and adds the `localOrdinance`
 * discriminant along with the ordinance code abbreviation and cited section.
 * Clark County Code/Ordinance (CCCO § 2.12.010(1)) is the first member.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { LocalOrdinanceCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = LocalOrdinanceCitation.make({
 *   text: "CCCO § 2.12.010(1)",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "CCCO § 2.12.010(1)",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   code: "CCCO",
 *   section: "2.12.010(1)",
 * })
 *
 * console.log(citation.type) // "localOrdinance"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LocalOrdinanceCitation extends S.Class<LocalOrdinanceCitation>($I`LocalOrdinanceCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("localOrdinance"),
    code: S.String.annotateKey({
      description: 'Ordinance code abbreviation (e.g. "CCCO").',
    }),
    section: S.String.annotateKey({
      description: 'Cited section (e.g. "2.12.010(1)").',
    }),
    locality: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Locality the code belongs to (e.g. "Clark County, NV").',
      })
    ),
  },
  $I.annote("LocalOrdinanceCitation", {
    description: "Local / municipal ordinance citation (#778).",
  })
) {}

/**
 * Companion namespace for `LocalOrdinanceCitation`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace LocalOrdinanceCitation {
  /**
   * Wire-encoded representation of a decoded {@link LocalOrdinanceCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { LocalOrdinanceCitation } from "@beep/law-practice-domain"
   *
   * type Wire = LocalOrdinanceCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof LocalOrdinanceCitation.Encoded;
}
