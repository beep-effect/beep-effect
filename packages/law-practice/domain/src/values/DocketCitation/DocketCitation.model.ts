/**
 * Docket-citation value object: a docket-number-only case citation identified by
 * docket/slip number for very recent decisions with no traditional reporter
 * assignment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.js";
import { Span } from "../Span/index.js";

const $I = $LawPracticeDomainId.create("values/DocketCitation/DocketCitation.model");

/**
 * A docket-number-only case citation (no traditional reporter assignment), used
 * for very recent decisions identified by docket or slip-opinion number.
 *
 * Spreads the shared {@link CitationBase} fields and adds the `docket`
 * discriminant tag plus its own docket number and optional court, date,
 * party-name, and full-span metadata.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { DocketCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = DocketCitation.make({
 *   text: "No. 12-3456 (S.D.N.Y. Mar. 3, 2024)",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "No. 12-3456 (S.D.N.Y. Mar. 3, 2024)",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   docketNumber: "12-3456",
 * })
 *
 * console.log(citation.type) // "docket"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketCitation extends S.Class<DocketCitation>($I`DocketCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("docket"),
    docketNumber: S.String.annotateKey({
      description: 'Docket / slip-opinion number (string to preserve hyphens, e.g. "12-3456").',
    }),
    court: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Court abbreviation extracted from the parenthetical (e.g. "N.Y.", "S.D.N.Y.").',
      })
    ),
    normalizedCourt: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Normalized court string: spaces collapsed, trailing period ensured.",
      })
    ),
    year: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Year of decision.",
      })
    ),
    date: S.Struct({
      iso: S.String,
      parsed: S.Struct({
        year: NonNegativeInt,
        month: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
        day: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
      }).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    }).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Date information when the parenthetical includes month/day.",
      })
    ),
    caseName: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Extracted case name (party names around "v.").',
      })
    ),
    plaintiff: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Plaintiff party name.",
      })
    ),
    defendant: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Defendant party name.",
      })
    ),
    plaintiffNormalized: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Normalized plaintiff name for matching (lowercase, stripped of noise).",
      })
    ),
    defendantNormalized: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Normalized defendant name for matching (lowercase, stripped of noise).",
      })
    ),
    proceduralPrefix: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Procedural prefix for non-adversarial cases (e.g. "In re").',
      })
    ),
    fullSpan: Span.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Full span covering citation from case name through closing parenthetical.",
      })
    ),
  },
  $I.annote("DocketCitation", {
    description: 'A docket-number-only case citation (type: "docket").',
  })
) {}

/**
 * Companion namespace for `DocketCitation`.
 *
 * @example
 * ```ts
 * import type { DocketCitation } from "@beep/law-practice-domain"
 *
 * const type: DocketCitation.Encoded["type"] = "docket"
 * console.log(type) // "docket"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace DocketCitation {
  /**
   * Wire-encoded representation of a decoded {@link DocketCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { DocketCitation } from "@beep/law-practice-domain"
   *
   * type Wire = DocketCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof DocketCitation.Encoded;
}
