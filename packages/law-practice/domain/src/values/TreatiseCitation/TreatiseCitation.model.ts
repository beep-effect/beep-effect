/**
 * Legal treatise citation: a parsed reference to a multi-volume secondary
 * authority (Wright & Miller, Nimmer) by volume, title/author, and section
 * (#579).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.ts";
import { TreatiseComponentSpan } from "../ComponentSpan/index.ts";

const $I = $LawPracticeDomainId.create("values/TreatiseCitation/TreatiseCitation.model");

/**
 * A parsed legal treatise citation (type: `treatise`). #579
 *
 * **Details**
 *
 * Spreads the shared {@link CitationBase} fields and adds the `treatise`
 * discriminant plus the `volume`, `title`, and `section` locating a passage in a
 * multi-volume secondary authority (Wright & Miller, Nimmer). The optional
 * `edition` and `year` capture the trailing parenthetical, and the optional
 * component `spans` locate each recognized sub-part within the source text.
 *
 * **Example** (Make Wright & Miller citation)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Span, TreatiseCitation } from "@beep/law-practice-domain"
 *
 * const citation = TreatiseCitation.make({
 *   text: "5 Wright & Miller § 1234",
 *   span: Span.make({
 *     cleanStart: S.Natural.make(0),
 *     cleanEnd: S.Natural.make(10),
 *     originalStart: S.Natural.make(0),
 *     originalEnd: S.Natural.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "5 Wright & Miller § 1234",
 *   processTimeMs: 0,
 *   patternsChecked: S.Natural.make(1),
 *   volume: S.Natural.make(5),
 *   title: "Wright & Miller",
 *   section: "1234",
 * })
 *
 * console.log(citation.type) // "treatise"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TreatiseCitation extends S.Class<TreatiseCitation>($I`TreatiseCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("treatise"),
    volume: S.Union([S.Natural, S.String]).annotateKey({
      description: "Volume number (string for hyphenated volumes).",
    }),
    title: S.String.annotateKey({
      description: "Title/author body as it appears in the citation.",
    }),
    section: S.String.annotateKey({
      description: "Section number / locator (string to preserve dots and bracketed suffixes).",
    }),
    edition: S.String.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: 'Edition + year, when present in trailing parenthetical (e.g., "5th ed. 2008").',
      })
    ),
    year: S.Natural.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Publication year (if extracted from parenthetical).",
      })
    ),
    spans: TreatiseComponentSpan.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Component spans locating each recognized sub-part within the source text.",
      })
    ),
  },
  $I.annote("TreatiseCitation", {
    description: "A parsed legal treatise citation.",
  })
) {}

/**
 * Companion namespace for `TreatiseCitation`.
 *
 * **Example** (Alias Encoded wire type)
 *
 * ```ts
 * import type { TreatiseCitation } from "@beep/law-practice-domain"
 *
 * type TreatiseCitationWire = TreatiseCitation.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TreatiseCitation {
  /**
   * Wire-encoded representation of a decoded {@link TreatiseCitation}.
   *
   * **Example** (Declare Encoded wire type)
   *
   * ```ts
   * import type { TreatiseCitation } from "@beep/law-practice-domain"
   *
   * type Wire = TreatiseCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof TreatiseCitation.Encoded;
}
