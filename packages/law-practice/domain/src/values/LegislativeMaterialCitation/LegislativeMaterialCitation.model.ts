/**
 * Legislative-material citation (#308): committee reports (H.R. Rep. No.
 * 94-1487) and the Congressional Record (112 Cong. Rec. 1234), unified via the
 * `kind` discriminator.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.js";

const $I = $LawPracticeDomainId.create("values/LegislativeMaterialCitation/LegislativeMaterialCitation.model");

/**
 * Legislative-material citation (#308).
 *
 * Spreads the shared {@link CitationBase} fields and tags the union member with
 * `type: "legislativeMaterial"`. The `kind` discriminator distinguishes a
 * committee/conference report (H.R. Rep. No. 94-1487) from a Congressional
 * Record cite (112 Cong. Rec. 1234); the remaining components are optional and
 * populated only when the parser recognizes them.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { LegislativeMaterialCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = LegislativeMaterialCitation.make({
 *   text: "H.R. Rep. No. 94-1487",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "H.R. Rep. No. 94-1487",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   kind: "report",
 * })
 *
 * console.log(citation.type) // "legislativeMaterial"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegislativeMaterialCitation extends S.Class<LegislativeMaterialCitation>($I`LegislativeMaterialCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("legislativeMaterial"),
    kind: S.Literals(["report", "congressionalRecord"]).annotateKey({
      description: "Distinguishes a committee/conference report from a Congressional Record cite.",
    }),
    chamber: S.Literals(["House", "Senate"]).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Chamber for reports.",
      })
    ),
    reportNumber: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Report number, e.g. "94-1487" or "595".',
      })
    ),
    congress: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Congress number when stated, e.g. 95.",
      })
    ),
    session: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Session ordinal when stated, e.g. "1st", "2d".',
      })
    ),
    volume: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Volume for Congressional Record cites.",
      })
    ),
    page: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Page (report page or Congressional Record page).",
      })
    ),
    year: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Year, from a trailing (YYYY) parenthetical.",
      })
    ),
  },
  $I.annote("LegislativeMaterialCitation", {
    description:
      "Legislative-material citation (#308): committee reports and the Congressional Record, unified via the kind discriminator.",
  })
) {}

/**
 * Companion namespace for `LegislativeMaterialCitation`.
 *
 * @example
 * ```ts
 * import type { LegislativeMaterialCitation } from "@beep/law-practice-domain"
 *
 * type LegislativeMaterialWire = LegislativeMaterialCitation.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace LegislativeMaterialCitation {
  /**
   * Wire-encoded representation of a decoded {@link LegislativeMaterialCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { LegislativeMaterialCitation } from "@beep/law-practice-domain"
   *
   * type Wire = LegislativeMaterialCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof LegislativeMaterialCitation.Encoded;
}
