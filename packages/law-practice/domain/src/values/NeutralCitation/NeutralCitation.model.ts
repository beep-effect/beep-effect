/**
 * Neutral-citation value object: a vendor-neutral (medium-neutral) court
 * citation identified by year, court, and document number.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.ts";
import { NeutralComponentSpan } from "../ComponentSpan/index.ts";
import { PinciteInfo } from "../PinciteInfo/index.ts";
import { StructuredDate } from "../StructuredDate/index.ts";

const $I = $LawPracticeDomainId.create("values/NeutralCitation/NeutralCitation.model");

/**
 * A vendor-neutral (medium-neutral) court citation identified by year, court,
 * and document number.
 *
 * **Details**
 *
 * Spreads the shared {@link CitationBase} fields and adds the `neutral`
 * discriminant tag plus its own year, document number, and optional court,
 * database, pincite, date, and component-span metadata.
 *
 * **Example** (Make neutral citation)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NeutralCitation, Span } from "@beep/law-practice-domain"
 *
 * const citation = NeutralCitation.make({
 *   text: "2023 IL 128749",
 *   span: Span.make({
 *     cleanStart: S.Natural.make(0),
 *     cleanEnd: S.Natural.make(10),
 *     originalStart: S.Natural.make(0),
 *     originalEnd: S.Natural.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "2023 IL 128749",
 *   processTimeMs: 0,
 *   patternsChecked: S.Natural.make(1),
 *   year: S.Natural.make(2023),
 *   documentNumber: "128749",
 * })
 *
 * console.log(citation.type) // "neutral"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NeutralCitation extends S.Class<NeutralCitation>($I`NeutralCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("neutral"),
    year: S.Natural.annotateKey({
      description: "Year of decision.",
    }),
    documentNumber: S.String.annotateKey({
      description: "Document number.",
    }),
    court: S.String.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Court identifier from a real jurisdictional neutral cite or recovered from a trailing (court date) parenthetical. Database identifiers (WL, LEXIS) live in database, NOT here (#294).",
      })
    ),
    database: S.String.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description:
          "Database identifier for vendor-database cites with no inherent court value: WL, LEXIS, BL. Set instead of court (#294).",
      })
    ),
    unpublished: SchemaUtils.BoolKeyDefaultFalse.pipe(
      S.annotateKey({
        description: "True when the citation has an Illinois Rule 23 -U suffix; stripped from documentNumber (#230).",
      })
    ),
    pincite: S.Natural.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: 'Pincite page (numeric portion, without "*" for star-pagination).',
      })
    ),
    pinciteInfo: PinciteInfo.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Structured pincite information (page, range, footnote, star-pagination).",
      })
    ),
    date: StructuredDate.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Decision date recovered from a trailing (court date) parenthetical (#294).",
      })
    ),
    caseName: S.String.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Case name captured from backward search (#441).",
      })
    ),
    spans: NeutralComponentSpan.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Component spans locating the sub-parts of this neutral citation within the source text.",
      })
    ),
  },
  $I.annote("NeutralCitation", {
    description: 'A vendor-neutral court citation (type: "neutral").',
  })
) {}

/**
 * Companion namespace for `NeutralCitation`.
 *
 * **Example** (Alias Encoded companion type)
 *
 * ```ts
 * import type { NeutralCitation } from "@beep/law-practice-domain"
 *
 * type NeutralCitationWire = NeutralCitation.Encoded
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace NeutralCitation {
  /**
   * Wire-encoded representation of a decoded {@link NeutralCitation}.
   *
   * **Example** (Declare Encoded wire type)
   *
   * ```ts
   * import type { NeutralCitation } from "@beep/law-practice-domain"
   *
   * type Wire = NeutralCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof NeutralCitation.Encoded;
}
