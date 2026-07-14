/**
 * Neutral-citation value object: a vendor-neutral (medium-neutral) court
 * citation identified by year, court, and document number.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.js";
import { NeutralComponentSpan } from "../ComponentSpan/index.js";
import { PinciteInfo } from "../PinciteInfo/index.js";
import { StructuredDate } from "../StructuredDate/index.js";

const $I = $LawPracticeDomainId.create("values/NeutralCitation/NeutralCitation.model");

/**
 * A vendor-neutral (medium-neutral) court citation identified by year, court,
 * and document number.
 *
 * Spreads the shared {@link CitationBase} fields and adds the `neutral`
 * discriminant tag plus its own year, document number, and optional court,
 * database, pincite, date, and component-span metadata.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { NeutralCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = NeutralCitation.make({
 *   text: "2023 IL 128749",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "2023 IL 128749",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   year: NonNegativeInt.make(2023),
 *   documentNumber: "128749",
 * })
 *
 * console.log(citation.type) // "neutral"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NeutralCitation extends S.Class<NeutralCitation>($I`NeutralCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("neutral"),
    year: NonNegativeInt.annotateKey({
      description: "Year of decision.",
    }),
    documentNumber: S.String.annotateKey({
      description: "Document number.",
    }),
    court: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Court identifier from a real jurisdictional neutral cite or recovered from a trailing (court date) parenthetical. Database identifiers (WL, LEXIS) live in database, NOT here (#294).",
      })
    ),
    database: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Database identifier for vendor-database cites with no inherent court value: WL, LEXIS, BL. Set instead of court (#294).",
      })
    ),
    unpublished: S.Boolean.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "True when the citation has an Illinois Rule 23 -U suffix; stripped from documentNumber (#230).",
      })
    ),
    pincite: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Pincite page (numeric portion, without "*" for star-pagination).',
      })
    ),
    pinciteInfo: PinciteInfo.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Structured pincite information (page, range, footnote, star-pagination).",
      })
    ),
    date: StructuredDate.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Decision date recovered from a trailing (court date) parenthetical (#294).",
      })
    ),
    caseName: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Case name captured from backward search (#441).",
      })
    ),
    spans: NeutralComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component spans locating the sub-parts of this neutral citation within the source text.",
      })
    ),
  },
  $I.annote("NeutralCitation", {
    description: 'A vendor-neutral court citation (type: "neutral").',
  })
) {}

/**
 * Companion namespace for `NeutralCitation`.
 *
 * @example
 * ```ts
 * import type { NeutralCitation } from "@beep/law-practice-domain"
 *
 * type NeutralCitationWire = NeutralCitation.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace NeutralCitation {
  /**
   * Wire-encoded representation of a decoded {@link NeutralCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { NeutralCitation } from "@beep/law-practice-domain"
   *
   * type Wire = NeutralCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof NeutralCitation.Encoded;
}
