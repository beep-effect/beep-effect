/**
 * Statute citation value object: a parsed reference to a codified statute
 * (U.S.C., state codes), ported from the eyecite `StatuteCitation` interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.ts";
import { StatuteComponentSpan } from "../ComponentSpan/index.ts";

const $I = $LawPracticeDomainId.create("values/StatuteCitation/StatuteCitation.model");

/**
 * A parsed statute citation (type: `statute`).
 *
 * Spreads the shared {@link CitationBase} fields and adds the `statute`
 * discriminant plus statute-specific components: title, code, section, chapter,
 * subsection, structured section/subsection ranges, jurisdiction, edition
 * metadata, and the {@link StatuteComponentSpan} locating each sub-part in the
 * source text. Sparse components use `Option` because statute forms vary widely
 * (bare-section, chapter-only, annotated-edition parentheticals, and so on);
 * `hasEtSeq` defaults to `false`.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { StatuteCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = StatuteCitation.make({
 *   text: "28 U.S.C. § 1331",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "28 U.S.C. § 1331",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 * })
 *
 * console.log(citation.type) // "statute"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StatuteCitation extends S.Class<StatuteCitation>($I`StatuteCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("statute"),
    title: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Title number of the code (e.g. Title 28 in 28 U.S.C.).",
      })
    ),
    code: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Code identifier (U.S.C., NMSA 1978, Penal, Va. Code, etc.). Optional because bare-section citations with no jurisdictional signal drop both code and jurisdiction (#565).",
      })
    ),
    section: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Section identifier. Optional because some forms cite the chapter alone (#569).",
      })
    ),
    sectionRange: S.Struct({ start: S.String, end: S.String }).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Structured §§ N-M range. Federal 28 U.S.C. §§ 591-99 style only; hyphenated state sections are NOT ranges. start mirrors section (#564).",
      })
    ),
    chapter: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Chapter identifier for chapter+section layouts, notably Massachusetts (G.L. c. 93A) (#569).",
      })
    ),
    subsection: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Subsection/pincite chain, e.g. "(a)(1)(A)"',
      })
    ),
    subsectionRange: S.Struct({ start: S.String, end: S.String }).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Structured subsection range like (a)-(b). start mirrors subsection (#591).",
      })
    ),
    jurisdiction: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: '2-letter state code or "US" when unambiguously identified',
      })
    ),
    pincite: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Alias for subsection (string chain, unlike case pincite which is a number).",
      })
    ),
    hasEtSeq: SchemaUtils.BoolKeyDefaultFalse.pipe(
      S.annotateKey({
        description: 'True when "et seq." follows the citation',
      })
    ),
    year: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Year of the code edition cited, from trailing parenthetical (#285).",
      })
    ),
    publisher: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Publisher of an annotated code edition (West, Lexis) (#285).",
      })
    ),
    recompiledYear: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Recompilation year for codes re-issued without renumbering (#343).",
      })
    ),
    editionLabel: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Edition-volume label (Repl., Supp., Cum. Supp.) (#349).",
      })
    ),
    spans: StatuteComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Component spans locating each recognized sub-part of the statute citation within the source text.",
      })
    ),
  },
  $I.annote("StatuteCitation", {
    description: 'A parsed statute citation (type: "statute").',
  })
) {}

/**
 * Companion namespace for `StatuteCitation`.
 *
 * @example
 * ```ts
 * import type { StatuteCitation } from "@beep/law-practice-domain"
 *
 * type StatuteCitationWire = StatuteCitation.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace StatuteCitation {
  /**
   * Wire-encoded representation of a decoded {@link StatuteCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { StatuteCitation } from "@beep/law-practice-domain"
   *
   * type Wire = StatuteCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof StatuteCitation.Encoded;
}
