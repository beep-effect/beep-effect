/**
 * Content-enrichment values used by the effect-ontology experiment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils, URLStr } from "@beep/schema";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/EnrichedContent");

const LanguageCode = S.String.check(
  S.isPattern(/^[a-z]{2}$/, {
    identifier: $I`LanguageCodePatternCheck`,
    title: "ISO 639-1 Language Code",
    description: "A lowercase two-letter ISO 639-1 language code.",
    message: "Language code must contain exactly two lowercase ASCII letters.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(/^[a-z]{2}$/),
  })
  .pipe(
    $I.annoteSchema("LanguageCode", {
      description: "Lowercase two-letter language code used for enriched content.",
    })
  );

/**
 * Classification assigned to an ingested content source.
 *
 * **Example** (Use SourceType)
 * ```ts
 * import { SourceType } from "@effect-ontology/Model/EnrichedContent"
 *
 * console.log(SourceType.is.academic("academic")) // true
 * console.log(SourceType.is.news("blog")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceType = LiteralKit(["news", "blog", "press_release", "official", "academic", "unknown"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("news", "blog", "press_release", "official", "academic", "unknown"),
  })
  .annotate(
    $I.annote("SourceType", {
      description: "Closed classification of source kinds recognized by content enrichment.",
    })
  );

/**
 * Runtime value accepted by {@link SourceType}.
 *
 * **Example** (Use SourceType)
 * ```ts
 * import type { SourceType } from "@effect-ontology/Model/EnrichedContent"
 *
 * const source: SourceType = "official"
 * console.log(source) // "official"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SourceType = typeof SourceType.Type;

/**
 * AI-derived metadata for one ingested content source.
 *
 * **Details**
 *
 * * All source absence is normalized to `Option`, while collections and language
 * receive schema-level defaults. Consumers therefore never need nullish
 * fallback branches for enrichment metadata.
 *
 * **Example** (Use EnrichedContent)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EnrichedContent } from "@effect-ontology/Model/EnrichedContent"
 *
 * const content = S.decodeUnknownOption(EnrichedContent)({
 *   headline: "Council approves transit plan",
 *   description: "The measure funds a light-rail expansion.",
 *   sourceType: "news",
 *   wordCount: 847
 * })
 *
 * console.log(O.map(content, (value) => value.language)) // "en"
 * console.log(O.map(content, (value) => value.hasAuthor)) // false
 * ```
 *
 * @invariant `wordCount` is a non-negative integer and `language` is a
 * lowercase ISO 639-1 code.
 * @category models
 * @since 0.0.0
 */
export class EnrichedContent extends S.Class<EnrichedContent>($I`EnrichedContent`)(
  {
    headline: S.NonEmptyString.annotateKey({
      description: "Main title extracted from or generated for the source.",
    }),
    description: S.NonEmptyString.annotateKey({
      description: "Short summary of the source's principal content.",
    }),
    sourceType: SourceType.annotateKey({
      description: "Classification assigned to the source.",
    }),
    publishedAt: S.OptionFromNullishOr(S.DateTimeUtcFromString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Original publication instant when the source provides one.",
      })
    ),
    author: S.OptionFromNullishOr(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Attributed author when one can be identified.",
      })
    ),
    organization: S.OptionFromNullishOr(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Publishing organization when one can be identified.",
      })
    ),
    keyEntities: S.Array(S.NonEmptyString).pipe(
      SchemaUtils.withEmptyArrayDefaults<string>(),
      S.annotateKey({
        description: "Prominent named entities detected in the source.",
      })
    ),
    topics: S.Array(S.NonEmptyString).pipe(
      SchemaUtils.withEmptyArrayDefaults<string>(),
      S.annotateKey({
        description: "Topic labels assigned to the source.",
      })
    ),
    language: LanguageCode.pipe(
      SchemaUtils.withKeyDefaults("en"),
      S.annotateKey({
        description: "Detected ISO 639-1 language code, defaulting to English.",
      })
    ),
    wordCount: NonNegativeInt.annotateKey({
      description: "Approximate number of words in the source.",
    }),
  },
  $I.annote("EnrichedContent", {
    description: "Normalized AI-derived metadata for search, filtering, provenance, and display.",
  })
) {
  /** Schema-derived guard for enriched-content values. */
  static readonly is = S.is(EnrichedContent);

  /** Non-throwing decoder for untrusted enrichment payloads. */
  static readonly decodeOption = S.decodeUnknownOption(EnrichedContent);

  /**
   * Whether this value carries non-empty author attribution.
   *
   * **Example** (Use JinaContentFields)
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { EnrichedContent } from "@effect-ontology/Model/EnrichedContent"
   *
   * const content = S.decodeUnknownOption(EnrichedContent)({
   *   headline: "Example",
   *   description: "Example description",
   *   sourceType: "news",
   *   wordCount: 2
   * })
   * console.log(O.map(content, (value) => value.hasAuthor)) // false
   * ```
   *
   * @returns `true` when normalized author attribution is present and non-empty.
   */
  get hasAuthor(): boolean {
    return O.exists(this.author, Str.isNonEmpty);
  }

  /**
   * Whether this value carries an original publication instant.
   *
   * **Example** (Use JinaContentFields)
   * ```ts
   * import { NonNegativeInt } from "@beep/schema"
   * import { EnrichedContent } from "@effect-ontology/Model/EnrichedContent"
   *
   * const content = EnrichedContent.make({
   *   headline: "Example",
   *   description: "Example description",
   *   sourceType: "news",
   *   wordCount: NonNegativeInt.make(2)
   * })
   * console.log(content.hasPublicationDate) // false
   * ```
   *
   * @returns `true` when the source supplied a decoded UTC publication instant.
   */
  get hasPublicationDate(): boolean {
    return O.isSome(this.publishedAt);
  }
}

/**
 * Cleaned page content returned by a Jina-compatible reader.
 *
 * **Details**
 *
 * * Optional transport fields are decoded directly into `Option`. `wordCount`
 * derives from the cleaned Markdown content and ignores runs of whitespace.
 *
 * **Example** (Use JinaContent)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { JinaContent } from "@effect-ontology/Model/EnrichedContent"
 *
 * const page = S.decodeUnknownOption(JinaContent)({
 *   url: "https://example.com/article",
 *   title: "Example",
 *   content: "one  two\nthree"
 * })
 *
 * console.log(O.map(page, (value) => value.wordCount)) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JinaContent extends S.Class<JinaContent>($I`JinaContent`)(
  {
    url: URLStr.annotateKey({
      description: "Original URL fetched by the reader.",
    }),
    title: S.NonEmptyString.annotateKey({
      description: "Page title reported or extracted by the reader.",
    }),
    content: S.String.annotateKey({
      description: "Cleaned Markdown content returned by the reader.",
    }),
    length: S.OptionFromOptionalKey(NonNegativeInt).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Reader-reported character count when available.",
      })
    ),
    description: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Page metadata description when available.",
      })
    ),
    publishedDate: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Publication date text reported by the remote page.",
      })
    ),
    siteName: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "OpenGraph or metadata site name when available.",
      })
    ),
    image: S.OptionFromOptionalKey(URLStr).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Featured-image URL when provided by the page.",
      })
    ),
  },
  $I.annote("JinaContent", {
    description: "Normalized cleaned Markdown response returned by a remote content reader.",
  })
) {
  /** Schema-derived guard for reader responses. */
  static readonly is = S.is(JinaContent);

  /** Non-throwing decoder for untrusted reader responses. */
  static readonly decodeOption = S.decodeUnknownOption(JinaContent);

  /**
   * Approximate count of non-empty whitespace-delimited words.
   *
   * **Example** (Use EnrichedContent)
   * ```ts
   * import * as O from "effect/Option"
   * import * as S from "effect/Schema"
   * import { JinaContent } from "@effect-ontology/Model/EnrichedContent"
   *
   * const page = S.decodeUnknownOption(JinaContent)({
   *   url: "https://example.com",
   *   title: "Example",
   *   content: "one  two\nthree"
   * })
   * console.log(O.map(page, (value) => value.wordCount)) // 3
   * ```
   *
   * @returns The number of non-empty whitespace-delimited segments.
   */
  get wordCount(): number {
    return A.length(A.filter(Str.split(/\s+/)(this.content), Str.isNonEmpty));
  }

  /**
   * Reported character count, falling back to the cleaned content length.
   *
   * **Example** (Use EnrichedContent)
   * ```ts
   * import { URLStr } from "@beep/schema/URL"
   * import { JinaContent } from "@effect-ontology/Model/EnrichedContent"
   *
   * const page = JinaContent.make({
   *   url: URLStr.make("https://example.com"),
   *   title: "Example",
   *   content: "hello"
   * })
   * console.log(page.contentLength) // 5
   * ```
   *
   * @returns The reported length when present; otherwise the content's string length.
   */
  get contentLength(): number {
    return O.getOrElse(this.length, () => Str.length(this.content));
  }
}
