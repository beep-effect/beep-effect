/**
 * Federal Register citation: a reference to a Federal Register volume and page,
 * ported from the eyecite `FederalRegisterCitation` interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.ts";
import { FederalRegisterComponentSpan } from "../ComponentSpan/index.ts";

const $I = $LawPracticeDomainId.create("values/FederalRegisterCitation/FederalRegisterCitation.model");

/**
 * A parsed Federal Register citation (type: `federalRegister`).
 *
 * Spreads the shared {@link CitationBase} fields and adds the `federalRegister`
 * discriminant, the Federal Register volume and page, an optional publication
 * year, and the optional {@link FederalRegisterComponentSpan} locating each
 * recognized sub-part within the source text.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { FederalRegisterCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = FederalRegisterCitation.make({
 *   text: "88 Fed. Reg. 12345",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(18),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(18),
 *   }),
 *   confidence: 1,
 *   matchedText: "88 Fed. Reg. 12345",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   volume: NonNegativeInt.make(88),
 *   page: NonNegativeInt.make(12345),
 * })
 *
 * console.log(citation.type) // "federalRegister"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FederalRegisterCitation extends S.Class<FederalRegisterCitation>($I`FederalRegisterCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("federalRegister"),
    volume: S.Union([NonNegativeInt, S.String]).annotateKey({
      description: "Federal Register volume.",
    }),
    page: NonNegativeInt.annotateKey({
      description: "Page number.",
    }),
    year: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Publication year (if extracted).",
      })
    ),
    spans: FederalRegisterComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component spans locating the sub-parts of the citation within the source text.",
      })
    ),
  },
  $I.annote("FederalRegisterCitation", {
    description: "A parsed Federal Register citation (type: federalRegister).",
  })
) {}

/**
 * Companion namespace for `FederalRegisterCitation`.
 *
 * @example
 * ```ts
 * import type { FederalRegisterCitation } from "@beep/law-practice-domain"
 *
 * const type: FederalRegisterCitation.Encoded["type"] = "federalRegister"
 * console.log(type) // "federalRegister"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace FederalRegisterCitation {
  /**
   * Wire-encoded representation of a decoded {@link FederalRegisterCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { FederalRegisterCitation } from "@beep/law-practice-domain"
   *
   * type Wire = FederalRegisterCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof FederalRegisterCitation.Encoded;
}
