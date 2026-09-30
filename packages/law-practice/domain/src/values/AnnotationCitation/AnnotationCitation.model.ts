/**
 * Annotation citation (#581): American Law Reports (A.L.R.) annotations — they
 * look like case citations (100 A.L.R.2d 1234) but are secondary authority.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.ts";
import { AnnotationComponentSpan } from "../ComponentSpan/index.ts";

const $I = $LawPracticeDomainId.create("values/AnnotationCitation/AnnotationCitation.model");

/**
 * Annotation citation (#581): American Law Reports (A.L.R.) annotations.
 *
 * **Details**
 *
 * Spreads the shared {@link CitationBase} fields and tags itself with the
 * `annotation` discriminant. A.L.R. annotations look like case citations
 * (100 A.L.R.2d 1234) but are secondary authority, so the series, volume, and
 * page that identify the annotation are carried as required own fields.
 *
 * **Example** (Constructing an AnnotationCitation)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AnnotationCitation, Span } from "@beep/law-practice-domain"
 *
 * const citation = AnnotationCitation.make({
 *   text: "100 A.L.R.2d 1234",
 *   span: Span.make({
 *     cleanStart: S.Natural.make(0),
 *     cleanEnd: S.Natural.make(10),
 *     originalStart: S.Natural.make(0),
 *     originalEnd: S.Natural.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "100 A.L.R.2d 1234",
 *   processTimeMs: 0,
 *   patternsChecked: S.Natural.make(1),
 *   series: "A.L.R.2d",
 *   volume: S.Natural.make(100),
 *   page: S.Natural.make(1234),
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
    volume: S.Natural.annotateKey({
      description: "Volume number.",
    }),
    page: S.Natural.annotateKey({
      description: "Page number where the annotation begins.",
    }),
    year: S.Natural.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Publication year (if extracted from parenthetical).",
      })
    ),
    spans: AnnotationComponentSpan.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
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
 * **Example** (Accessing Encoded type field)
 *
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
   * **Example** (Aliasing the Encoded type)
   *
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
