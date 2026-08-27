/**
 * Service: Content Enrichment Agent
 *
 * **Details**
 *
 * Uses LLM to extract structured metadata from fetched content.
 * Analyzes markdown content to identify:
 * - Headlines, descriptions, and publication dates
 * - Source type classification (news, blog, press release, etc.)
 * - Key named entities and topics
 * - Author and organization attribution
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { NonNegativeInt } from "@beep/schema/Int";
import { Context, DateTime, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LanguageModel } from "effect/unstable/ai";
import { ErrorMessage, OptionalErrorCause } from "../Domain/Error/Base.ts";
import type { JinaContent } from "../Domain/Model/EnrichedContent.ts";
import { EnrichedContent } from "../Domain/Model/EnrichedContent.ts";
import { ConfigService } from "./Config.ts";
import { generateObjectWithRetry } from "./LlmWithRetry.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ContentEnrichmentAgent");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Failure to enrich fetched content with structured metadata.
 *
 * **Example** (Construct an enrichment error)
 *
 * ```ts
 * import { ContentEnrichmentError } from "@effect-ontology/Service/ContentEnrichmentAgent"
 * import * as O from "effect/Option"
 *
 * const error = ContentEnrichmentError.make({
 *   message: "Language model returned empty metadata",
 *   url: O.some("https://example.org/articles/ada")
 * })
 * console.log(error._tag) // "ContentEnrichmentError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ContentEnrichmentError extends S.TaggedError<ContentEnrichmentError>($I`ContentEnrichmentError`)(
  "ContentEnrichmentError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable content enrichment failure diagnostic.",
    }),
    url: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional source URL associated with the failed enrichment.",
      })
    ),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying language-model defect.",
    }),
  },
  $I.annote("ContentEnrichmentError", {
    description: "Failure to enrich fetched content with structured metadata.",
  })
) {
  static readonly is = S.is(this);
}

// =============================================================================
// Enrichment Schema (for LLM output)
// =============================================================================

/**
 * Schema for LLM output - matches EnrichedContent structure
 */
const EnrichmentOutputSchema = S.Struct({
  headline: S.String.annotate({
    description: "Main headline or title summarizing the content",
  }),
  description: S.String.annotate({
    description: "1-2 sentence summary of the content's main points",
  }),
  sourceType: S.Literals(["news", "blog", "press_release", "official", "academic", "unknown"]).annotate({
    description: "Classification of the content source type",
  }),
  publishedAt: S.NullOr(S.String).annotate({
    description: "Publication date in ISO 8601 format (YYYY-MM-DD) if identifiable, null otherwise",
  }),
  author: S.NullOr(S.String).annotate({
    description: "Author name if identifiable, null otherwise",
  }),
  organization: S.NullOr(S.String).annotate({
    description: "Publishing organization (news outlet, company, institution) if identifiable",
  }),
  keyEntities: S.Array(S.String).annotate({
    description: "Named entities (people, organizations, locations) prominently mentioned",
  }),
  topics: S.Array(S.String).annotate({
    description: "Topic or category tags for the content",
  }),
  language: S.String.annotate({
    description: "ISO 639-1 language code (e.g., 'en', 'es', 'de')",
  }),
  wordCount: NonNegativeInt.annotate({
    description: "Approximate word count of the content",
  }),
});

// =============================================================================
// Prompt Construction
// =============================================================================

const ENRICHMENT_SYSTEM_PROMPT = `You are a content analysis expert. Your task is to extract structured metadata from markdown content.

Analyze the content and extract:
1. **Headline**: The main title or a generated summary headline if none exists
2. **Description**: A concise 1-2 sentence summary of the main points
3. **Source Type**: Classify as one of: news, blog, press_release, official, academic, unknown
4. **Published Date**: Extract if mentioned, use ISO 8601 format (YYYY-MM-DD), or null if not found
5. **Author**: Extract author name if attributed, or null
6. **Organization**: Identify the publishing organization (news outlet, company, agency), or null
7. **Key Entities**: List prominent named entities (people, organizations, places)
8. **Topics**: Generate 3-5 topic/category tags
9. **Language**: Detect the primary language (ISO 639-1 code)
10. **Word Count**: Estimate the word count

Be accurate and conservative - use null for uncertain fields rather than guessing.`;

const buildEnrichmentPrompt = (content: string, url?: string): string => {
  const urlContext = P.isNotUndefined(url) ? `\nSource URL: ${url}\n` : "";
  const truncatedContent = content.length > 8000 ? `${content.slice(0, 8000)}\n\n[Content truncated...]` : content;

  return `${urlContext}
Content to analyze:

${truncatedContent}`;
};

// =============================================================================
// Service
// =============================================================================

/**
 * LLM agent that turns fetched article text into structured metadata.
 *
 * **Example** (Enrich fetched article text)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ContentEnrichmentAgent } from "@effect-ontology/Service/ContentEnrichmentAgent"
 *
 * const program = Effect.gen(function* () {
 *   const agent = yield* ContentEnrichmentAgent
 *   return yield* agent.enrich("Ada founded Acme in 1843.")
 * }).pipe(Effect.provide(ContentEnrichmentAgent.Default))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class ContentEnrichmentAgent extends Context.Service<ContentEnrichmentAgent>()($I`ContentEnrichmentAgent`, {
  make: Effect.gen(function* () {
    const llm = yield* LanguageModel.LanguageModel;
    const config = yield* ConfigService;

    const { model, provider, retryPolicy } = config.llm;

    /**
     * Enrich content from JinaContent response
     */
    const enrichFromJina = (jinaContent: JinaContent): Effect.Effect<EnrichedContent, ContentEnrichmentError> =>
      enrich(jinaContent.content, jinaContent.url).pipe(
        Effect.map((enriched) =>
          // Use Jina's extracted metadata as fallback
          EnrichedContent.make({
            ...enriched,
            // Prefer Jina's title if we didn't extract a good headline
            headline: enriched.headline,
            // Use Jina's description as fallback
            description: enriched.description,
            // Use Jina's published date if we didn't find one
            publishedAt: O.orElse(enriched.publishedAt, () => O.flatMap(jinaContent.publishedDate, parseDate)),
            // Use Jina's site name as organization fallback
            organization: O.orElse(enriched.organization, () => jinaContent.siteName),
          })
        )
      );

    /**
     * Enrich raw markdown content
     */
    const enrich = Effect.fn("ContentEnrichmentAgent.enrich")(function* (
      content: string,
      url?: string
    ): Effect.fn.Return<EnrichedContent, ContentEnrichmentError> {
      // Calculate word count from content
      const wordCount = A.length(A.filter(Str.split(/\s+/)(content), (word) => Str.length(word) > 0));

      const prompt = {
        systemMessage: ENRICHMENT_SYSTEM_PROMPT,
        userMessage: buildEnrichmentPrompt(content, url),
      };

      const response = yield* generateObjectWithRetry({
        prompt,
        schema: EnrichmentOutputSchema,
        objectName: "enrichedContent",
        serviceName: "ContentEnrichment",
        model,
        provider,
        retryPolicy,
        spanAttributes: {
          "content.url": url ?? "unknown",
          "content.wordCount": wordCount,
        },
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, llm),
        Effect.mapError((error) =>
          ContentEnrichmentError.make({
            message: `Failed to enrich content: ${error}`,
            url: O.fromUndefinedOr(url),
            cause: O.some(error),
          })
        )
      );

      // Convert LLM output to EnrichedContent
      const output = response.value;

      return EnrichedContent.make({
        headline: output.headline,
        description: output.description,
        sourceType: output.sourceType,
        publishedAt: parseDate(output.publishedAt),
        author: O.fromNullishOr(output.author),
        organization: O.fromNullishOr(output.organization),
        keyEntities: output.keyEntities,
        topics: output.topics,
        language: output.language || "en",
        wordCount: NonNegativeInt.make(output.wordCount || wordCount),
      });
    });

    /**
     * Get the JSON schema for enrichment output (useful for structured extraction)
     */
    const getSchema = (): object => S.toJsonSchemaDocument(EnrichmentOutputSchema).schema;

    return {
      enrich,
      enrichFromJina,
      getSchema,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse date string to Date or null
 */
const parseDate = (dateStr: string | undefined | null): O.Option<DateTime.Utc> =>
  O.flatMap(O.fromNullishOr(dateStr), DateTime.make);
