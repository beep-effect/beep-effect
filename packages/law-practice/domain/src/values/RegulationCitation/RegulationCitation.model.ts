/**
 * Regulation citation (CFR + state regulatory codes) parsed from legal text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.js";
import { StatuteComponentSpan } from "../ComponentSpan/index.js";

const $I = $LawPracticeDomainId.create("values/RegulationCitation/RegulationCitation.model");

/**
 * Regulation citation (CFR + state regulatory codes).
 *
 * Distinct from `StatuteCitation` because regulations are issued by executive
 * agencies, not enacted by a legislature (#637). The shape mirrors
 * `StatuteCitation`: it spreads the shared {@link CitationBase} fields, adds the
 * literal `regulation` discriminant, and carries the parsed title, code,
 * section, and edition components plus optional {@link StatuteComponentSpan}s.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { RegulationCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = RegulationCitation.make({
 *   text: "42 C.F.R. § 405.1",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "42 C.F.R. § 405.1",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 * })
 *
 * console.log(citation.type) // "regulation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegulationCitation extends S.Class<RegulationCitation>($I`RegulationCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("regulation"),
    title: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Title number (e.g. 42 for 42 C.F.R.).",
      })
    ),
    code: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Code identifier (C.F.R., etc.).",
      })
    ),
    section: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Section identifier.",
      })
    ),
    sectionRange: S.Struct({ start: S.String, end: S.String }).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Structured §§ N-M section range.",
      })
    ),
    chapter: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Chapter for chapter+section regulatory codes (rare).",
      })
    ),
    subsection: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Subsection/pincite chain, e.g. "(c)(2)"',
      })
    ),
    subsectionRange: S.Struct({ start: S.String, end: S.String }).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Structured subsection range ((a)-(b)).",
      })
    ),
    jurisdiction: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: '2-letter state code or "US".',
      })
    ),
    pincite: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Alias for subsection.",
      })
    ),
    hasEtSeq: S.Boolean.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'True when "et seq." follows.',
      })
    ),
    year: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Year of the regulatory edition cited.",
      })
    ),
    publisher: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Publisher of an annotated edition.",
      })
    ),
    recompiledYear: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Recompilation year.",
      })
    ),
    editionLabel: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Edition-volume label (Repl., Supp., Cum. Supp.).",
      })
    ),
    spans: StatuteComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component spans locating the regulation's sub-parts within the source text.",
      })
    ),
  },
  $I.annote("RegulationCitation", {
    description: "Regulation citation (CFR + state regulatory codes) issued by executive agencies (#637).",
  })
) {}

/**
 * Companion namespace for `RegulationCitation`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace RegulationCitation {
  /**
   * Wire-encoded representation of a decoded {@link RegulationCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { RegulationCitation } from "@beep/law-practice-domain"
   *
   * type Wire = RegulationCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof RegulationCitation.Encoded;
}
