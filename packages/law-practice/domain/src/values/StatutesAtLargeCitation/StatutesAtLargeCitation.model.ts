/**
 * Citation to the Statutes at Large (session law compilation).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.js";
import { StatutesAtLargeComponentSpan } from "../ComponentSpan/index.js";

const $I = $LawPracticeDomainId.create("values/StatutesAtLargeCitation/StatutesAtLargeCitation.model");

/**
 * Citation to the Statutes at Large (session law compilation).
 *
 * Spreads the shared {@link CitationBase} fields and adds the `statutesAtLarge`
 * discriminant tag plus the volume/page locators, pincite range metadata, and
 * optional component spans specific to Statutes at Large references.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { StatutesAtLargeCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = StatutesAtLargeCitation.make({
 *   text: "100 Stat. 3743",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "100 Stat. 3743",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   volume: NonNegativeInt.make(100),
 *   page: NonNegativeInt.make(3743),
 * })
 *
 * console.log(citation.type) // "statutesAtLarge"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StatutesAtLargeCitation extends S.Class<StatutesAtLargeCitation>($I`StatutesAtLargeCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("statutesAtLarge"),
    volume: S.Union([NonNegativeInt, S.String]).annotateKey({
      description: "Statutes at Large volume.",
    }),
    page: NonNegativeInt.annotateKey({
      description: "Page number.",
    }),
    pincite: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          'Specific pincite page, from a trailing ", NNN" suffix (100 Stat. 3743, 3755 -> page=3743, pincite=3755) (#639).',
      })
    ),
    pinciteEndPage: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "End page for range pincites (3755-58 -> 3758) (#639).",
      })
    ),
    pinciteIsRange: S.Boolean.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "True when the pincite is a range (3755-58) (#639).",
      })
    ),
    year: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Publication year (if extracted).",
      })
    ),
    spans: StatutesAtLargeComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component spans locating the sub-parts of this citation within the source text.",
      })
    ),
  },
  $I.annote("StatutesAtLargeCitation", {
    description: "Citation to the Statutes at Large (session law compilation).",
  })
) {}

/**
 * Companion namespace for `StatutesAtLargeCitation`.
 *
 * @example
 * ```ts
 * import type { StatutesAtLargeCitation } from "@beep/law-practice-domain"
 *
 * type StatutesAtLargeWire = StatutesAtLargeCitation.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace StatutesAtLargeCitation {
  /**
   * Wire-encoded representation of a decoded {@link StatutesAtLargeCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { StatutesAtLargeCitation } from "@beep/law-practice-domain"
   *
   * type Wire = StatutesAtLargeCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof StatutesAtLargeCitation.Encoded;
}
