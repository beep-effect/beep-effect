/**
 * Citation to the Statutes at Large (session law compilation).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.ts";
import { StatutesAtLargeComponentSpan } from "../ComponentSpan/index.ts";

const $I = $LawPracticeDomainId.create("values/StatutesAtLargeCitation/StatutesAtLargeCitation.model");

/**
 * Citation to the Statutes at Large (session law compilation).
 *
 * **Details**
 *
 * Spreads the shared {@link CitationBase} fields and adds the `statutesAtLarge`
 * discriminant tag plus the volume/page locators, pincite range metadata, and
 * optional component spans specific to Statutes at Large references.
 *
 * **Example** (Make Statutes at Large citation)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { StatutesAtLargeCitation, Span } from "@beep/law-practice-domain"
 *
 * const citation = StatutesAtLargeCitation.make({
 *   text: "100 Stat. 3743",
 *   span: Span.make({
 *     cleanStart: S.Natural.make(0),
 *     cleanEnd: S.Natural.make(10),
 *     originalStart: S.Natural.make(0),
 *     originalEnd: S.Natural.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "100 Stat. 3743",
 *   processTimeMs: 0,
 *   patternsChecked: S.Natural.make(1),
 *   volume: S.Natural.make(100),
 *   page: S.Natural.make(3743),
 * })
 *
 * console.log(citation.type) // "statutesAtLarge"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StatutesAtLargeCitation extends S.Class<StatutesAtLargeCitation>($I`StatutesAtLargeCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("statutesAtLarge"),
    volume: S.Union([S.Natural, S.String]).annotateKey({
      description: "Statutes at Large volume.",
    }),
    page: S.Natural.annotateKey({
      description: "Page number.",
    }),
    pincite: S.Natural.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          'Specific pincite page, from a trailing ", NNN" suffix (100 Stat. 3743, 3755 -> page=3743, pincite=3755) (#639).',
      })
    ),
    pinciteEndPage: S.Natural.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "End page for range pincites (3755-58 -> 3758) (#639).",
      })
    ),
    pinciteIsRange: SchemaUtils.BoolKeyDefaultFalse.pipe(
      S.annotateKey({
        description: "True when the pincite is a range (3755-58) (#639).",
      })
    ),
    year: S.Natural.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Publication year (if extracted).",
      })
    ),
    spans: StatutesAtLargeComponentSpan.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Component spans locating the sub-parts of this citation within the source text.",
      })
    ),
  },
  $I.annote("StatutesAtLargeCitation", {
    description: "Citation to the Statutes at Large (session law compilation).",
  })
) {}

/**
 * Companion namespace for `StatutesAtLargeCitation`.
 *
 * **Example** (Encoded type alias)
 *
 * ```ts
 * import type { StatutesAtLargeCitation } from "@beep/law-practice-domain"
 *
 * type StatutesAtLargeWire = StatutesAtLargeCitation.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace StatutesAtLargeCitation {
  /**
   * Wire-encoded representation of a decoded {@link StatutesAtLargeCitation}.
   *
   * **Example** (Wire Encoded type alias)
   *
   * ```ts
   * import type { StatutesAtLargeCitation } from "@beep/law-practice-domain"
   *
   * type Wire = StatutesAtLargeCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof StatutesAtLargeCitation.Encoded;
}
