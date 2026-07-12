/**
 * Restatement citation (#578): secondary authority published by the American
 * Law Institute (e.g., Restatement (Second) of Torts § 402A).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.js";
import { RestatementComponentSpan } from "../ComponentSpan/index.js";

const $I = $LawPracticeDomainId.create("values/RestatementCitation/RestatementCitation.model");

/**
 * Restatement citation (#578): secondary authority published by the American
 * Law Institute (e.g., Restatement (Second) of Torts § 402A).
 *
 * Spreads the shared {@link CitationBase} fields and adds the `restatement`
 * discriminant tag plus the edition, subject, and section that identify the
 * cited black-letter rule.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { RestatementCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = RestatementCitation.make({
 *   text: "Restatement (Second) of Torts § 402A",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "Restatement (Second) of Torts § 402A",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   edition: "Second",
 *   subject: "Torts",
 *   section: "402A",
 * })
 *
 * console.log(citation.type) // "restatement"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RestatementCitation extends S.Class<RestatementCitation>($I`RestatementCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("restatement"),
    edition: S.Literals(["First", "Second", "Third", "Fourth"]).annotateKey({
      description: "Restatement edition (First, Second, Third, Fourth).",
    }),
    subject: S.String.annotateKey({
      description: 'Subject matter (e.g., "Torts", "Contracts").',
    }),
    section: S.String.annotateKey({
      description: 'Section number (string to preserve letter suffixes like "402A").',
    }),
    subsection: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Subsection chain (e.g., "(1)(b)") — undefined when not cited.',
      })
    ),
    spans: RestatementComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component spans locating this citation's sub-parts within the source text.",
      })
    ),
  },
  $I.annote("RestatementCitation", {
    description: "Restatement citation: secondary authority published by the American Law Institute (#578).",
  })
) {}

/**
 * Companion namespace for `RestatementCitation`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace RestatementCitation {
  /**
   * Wire-encoded representation of a decoded {@link RestatementCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { RestatementCitation } from "@beep/law-practice-domain"
   *
   * type Wire = RestatementCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof RestatementCitation.Encoded;
}
