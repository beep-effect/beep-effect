/**
 * Judicial-conduct canon citation value object (#310): a Code of Judicial
 * Conduct canon reference such as `Canon 7(B)(1)`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.js";

const $I = $LawPracticeDomainId.create("values/CanonCitation/CanonCitation.model");

/**
 * Judicial-conduct canon citation (#310).
 *
 * Spreads the shared {@link CitationBase} fields and tags itself with the
 * `canon` discriminant, then adds the canon number and its optional subsection
 * chain and explicitly stated rule set (e.g. `Code of Judicial Conduct Canon
 * 7(B)(1)`).
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { CanonCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = CanonCitation.make({
 *   text: "Code of Judicial Conduct Canon 7(B)(1)",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "Code of Judicial Conduct Canon 7(B)(1)",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   canon: "7",
 * })
 *
 * console.log(citation.type) // "canon"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CanonCitation extends S.Class<CanonCitation>($I`CanonCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("canon"),
    canon: S.String.annotateKey({
      description: 'Canon number, e.g. "7", "2".',
    }),
    subsection: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Subsection chain, e.g. "(B)(1)", "(A)".',
      })
    ),
    ruleSet: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Rule set when stated explicitly, e.g. "Code of Judicial Conduct".',
      })
    ),
  },
  $I.annote("CanonCitation", {
    description: "Judicial-conduct canon citation (#310).",
  })
) {}

/**
 * Companion namespace for `CanonCitation`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CanonCitation {
  /**
   * Wire-encoded representation of a decoded {@link CanonCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { CanonCitation } from "@beep/law-practice-domain"
   *
   * type Wire = CanonCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CanonCitation.Encoded;
}
