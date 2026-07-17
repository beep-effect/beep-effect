/**
 * Annotation citation (#581): American Law Reports (A.L.R.) annotations — they
 * look like case citations (100 A.L.R.2d 1234) but are secondary authority.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.ts";
import { AnnotationComponentSpan } from "../ComponentSpan/index.ts";

const $I = $LawPracticeDomainId.create("values/AnnotationCitation/AnnotationCitation.model");

/**
 * Annotation citation (#581): American Law Reports (A.L.R.) annotations.
 *
 * Spreads the shared {@link CitationBase} fields and tags itself with the
 * `annotation` discriminant. A.L.R. annotations look like case citations
 * (100 A.L.R.2d 1234) but are secondary authority, so the series, volume, and
 * page that identify the annotation are carried as required own fields.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { AnnotationCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = AnnotationCitation.make({
 *   text: "100 A.L.R.2d 1234",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "100 A.L.R.2d 1234",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   series: "A.L.R.2d",
 *   volume: NonNegativeInt.make(100),
 *   page: NonNegativeInt.make(1234),
 * })
 *
 * console.log(citation.type) // "annotation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AnnotationCitation extends S.Class<AnnotationCitation>($I`AnnotationCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("annotation"),
    series: S.String.annotateKey({
      description: "A.L.R. series identifier (A.L.R., A.L.R.2d, A.L.R. Fed., etc.).",
    }),
    volume: NonNegativeInt.annotateKey({
      description: "Volume number.",
    }),
    page: NonNegativeInt.annotateKey({
      description: "Page number where the annotation begins.",
    }),
    year: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Publication year (if extracted from parenthetical).",
      })
    ),
    spans: AnnotationComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component spans locating this citation's sub-parts within the source text.",
      })
    ),
  },
  $I.annote("AnnotationCitation", {
    description:
      "Annotation citation (#581): American Law Reports (A.L.R.) annotations — secondary authority that looks like a case citation.",
  })
) {}

/**
 * Companion namespace for `AnnotationCitation`.
 *
 * @example
 * ```ts
 * import type { AnnotationCitation } from "@beep/law-practice-domain"
 *
 * const type: AnnotationCitation.Encoded["type"] = "annotation"
 * console.log(type) // "annotation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace AnnotationCitation {
  /**
   * Wire-encoded representation of a decoded {@link AnnotationCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { AnnotationCitation } from "@beep/law-practice-domain"
   *
   * type Wire = AnnotationCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof AnnotationCitation.Encoded;
}
