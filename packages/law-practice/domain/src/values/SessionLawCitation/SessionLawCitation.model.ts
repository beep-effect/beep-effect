/**
 * Session-law citation (#350, #779): state session laws cited by year + chapter
 * (California Statutes, Nevada session laws).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.ts";

const $I = $LawPracticeDomainId.create("values/SessionLawCitation/SessionLawCitation.model");

/**
 * Session-law citation (#350, #779): a state session law cited by year and
 * chapter (e.g. California Statutes, Nevada session laws).
 *
 * Spreads the shared {@link CitationBase} fields and adds the `sessionLaw`
 * discriminant plus the jurisdiction, compilation code, session year, and
 * chapter that identify the enacted law, along with the optional section and
 * page pinpoints.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { SessionLawCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = SessionLawCitation.make({
 *   text: "Stats. 1974, ch. 1516",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "Stats. 1974, ch. 1516",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   jurisdiction: "CA",
 *   code: "Stats.",
 *   year: NonNegativeInt.make(1974),
 *   chapter: "1516",
 * })
 *
 * console.log(citation.type) // "sessionLaw"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLawCitation extends S.Class<SessionLawCitation>($I`SessionLawCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("sessionLaw"),
    jurisdiction: S.String.annotateKey({
      description: 'Two-letter jurisdiction code (e.g. "CA", "NV").',
    }),
    code: S.String.annotateKey({
      description: 'Session-law compilation label (e.g. "Stats." for CA, "Nev. Stat." for NV).',
    }),
    year: NonNegativeInt.annotateKey({
      description: "Session year.",
    }),
    chapter: S.String.annotateKey({
      description: "Chapter / bill number within that session.",
    }),
    section: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Single cited section, or the first of a list/range.",
      })
    ),
    sections: S.Array(S.String).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Multiple cited sections (§§ 6, 7, 8 -> ["6","7","8"]).',
      })
    ),
    sectionRange: S.Struct({ start: S.String, end: S.String }).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Section range (§§ 25-26 -> {start:"25",end:"26"}).',
      })
    ),
    page: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Single cited page, or the first of a range.",
      })
    ),
    pageRange: S.Struct({ start: S.String, end: S.String }).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Page range (pp. 3038-3039, at 2590-95).",
      })
    ),
  },
  $I.annote("SessionLawCitation", {
    description: "Session-law citation cited by year and chapter (#350, #779).",
  })
) {}

/**
 * Companion namespace for `SessionLawCitation`.
 *
 * @example
 * ```ts
 * import type { SessionLawCitation } from "@beep/law-practice-domain"
 *
 * type SessionLawWire = SessionLawCitation.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace SessionLawCitation {
  /**
   * Wire-encoded representation of a decoded {@link SessionLawCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { SessionLawCitation } from "@beep/law-practice-domain"
   *
   * type Wire = SessionLawCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof SessionLawCitation.Encoded;
}
