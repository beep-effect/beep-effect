/**
 * Constitutional-citation subtype: a parsed reference to an article, amendment,
 * clause, or the Preamble of the U.S. or a state constitution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.ts";
import { ConstitutionalComponentSpan } from "../ComponentSpan/index.ts";

const $I = $LawPracticeDomainId.create("values/ConstitutionalCitation/ConstitutionalCitation.model");

/**
 * A constitutional citation (type: `constitutional`).
 *
 * **Details**
 *
 * Spreads the shared {@link CitationBase} fields and adds the `constitutional`
 * discriminant tag plus the constitution-specific components: jurisdiction,
 * article/amendment/preamble (mutually exclusive), section, clause, an optional
 * post-reform `currentLocation`, and the {@link ConstitutionalComponentSpan}
 * that locates each part in the source text.
 *
 * **Example** (Make a constitutional citation)
 *
 * ```ts
 * import { ConstitutionalCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = ConstitutionalCitation.make({
 *   text: "U.S. Const. amend. XIV",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "U.S. Const. amend. XIV",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 * })
 *
 * console.log(citation.type) // "constitutional"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConstitutionalCitation extends S.Class<ConstitutionalCitation>($I`ConstitutionalCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("constitutional"),
    jurisdiction: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Jurisdiction code: "US", 2-letter state code, or undefined for bare "Const.".',
      })
    ),
    article: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Article number (parsed from Roman numerals) — mutually exclusive with amendment / preamble.",
      })
    ),
    amendment: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Amendment number (parsed from Roman numerals) — mutually exclusive with article / preamble.",
      })
    ),
    preamble: S.Boolean.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "True when the citation references the Preamble. Mutually exclusive with article / amendment (#321).",
      })
    ),
    section: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Section identifier (string to handle non-numeric like "3-a").',
      })
    ),
    clause: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Clause number (always numeric).",
      })
    ),
    currentLocation: S.Struct({
      article: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
      amendment: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
      section: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
      clause: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    }).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Post-reform ("now …") location for historical-reform citations (#789).',
      })
    ),
    spans: ConstitutionalComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component spans locating the sub-parts of this constitutional citation within the source text.",
      })
    ),
  },
  $I.annote("ConstitutionalCitation", {
    description: "A parsed constitutional citation referencing an article, amendment, clause, or the Preamble.",
  })
) {}

/**
 * Companion namespace for `ConstitutionalCitation`.
 *
 * **Example** (Access Encoded type field)
 *
 * ```ts
 * import type { ConstitutionalCitation } from "@beep/law-practice-domain"
 *
 * const type: ConstitutionalCitation.Encoded["type"] = "constitutional"
 * console.log(type) // "constitutional"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ConstitutionalCitation {
  /**
   * Wire-encoded representation of a decoded {@link ConstitutionalCitation}.
   *
   * **Example** (Define Encoded type alias)
   *
   * ```ts
   * import type { ConstitutionalCitation } from "@beep/law-practice-domain"
   *
   * type Wire = ConstitutionalCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ConstitutionalCitation.Encoded;
}
