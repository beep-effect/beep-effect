/**
 * Journal citation: a parsed law-review (periodical) reference identifying an
 * article by its journal, volume, and page.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationBase } from "../CitationBase/index.ts";
import { JournalComponentSpan } from "../ComponentSpan/index.ts";

const $I = $LawPracticeDomainId.create("values/JournalCitation/JournalCitation.model");

/**
 * A parsed journal citation (type: `journal`).
 *
 * **Details**
 *
 * Spreads the shared {@link CitationBase} fields and adds the `journal`
 * discriminant plus the full `journal` name and standard `abbreviation`, the
 * optional `author`, `title`, `volume`, `page`, `pincite`, and `year`, and the
 * optional component `spans` locating each sub-part within the source text.
 *
 * **Example** (Construct journal citation value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { JournalCitation, Span } from "@beep/law-practice-domain"
 *
 * const citation = JournalCitation.make({
 *   text: "93 Harv. L. Rev. 518",
 *   span: Span.make({
 *     cleanStart: S.Natural.make(0),
 *     cleanEnd: S.Natural.make(10),
 *     originalStart: S.Natural.make(0),
 *     originalEnd: S.Natural.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "93 Harv. L. Rev. 518",
 *   processTimeMs: 0,
 *   patternsChecked: S.Natural.make(1),
 *   journal: "Harvard Law Review",
 *   abbreviation: "Harv. L. Rev.",
 * })
 *
 * console.log(citation.type) // "journal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JournalCitation extends S.Class<JournalCitation>($I`JournalCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("journal"),
    journal: S.String.annotateKey({
      description: "Full journal name.",
    }),
    abbreviation: S.String.annotateKey({
      description: 'Standard journal abbreviation (e.g., "Harv. L. Rev.").',
    }),
    author: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Author name (if extracted).",
      })
    ),
    title: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Article title (if extracted).",
      })
    ),
    volume: S.Union([S.Natural, S.String]).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Volume number (string for hyphenated volumes like "1984-1").',
      })
    ),
    page: S.Natural.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Starting page of article.",
      })
    ),
    pincite: S.Natural.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Specific page reference.",
      })
    ),
    year: S.Natural.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Publication year.",
      })
    ),
    spans: JournalComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component spans locating each recognized sub-part within the source text.",
      })
    ),
  },
  $I.annote("JournalCitation", {
    description: "A parsed journal citation.",
  })
) {}

/**
 * Companion namespace for `JournalCitation`.
 *
 * **Example** (Access Encoded type field)
 *
 * ```ts
 * import type { JournalCitation } from "@beep/law-practice-domain"
 *
 * const type: JournalCitation.Encoded["type"] = "journal"
 * console.log(type) // "journal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace JournalCitation {
  /**
   * Wire-encoded representation of a decoded {@link JournalCitation}.
   *
   * **Example** (Alias Encoded wire type)
   *
   * ```ts
   * import type { JournalCitation } from "@beep/law-practice-domain"
   *
   * type Wire = JournalCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof JournalCitation.Encoded;
}
