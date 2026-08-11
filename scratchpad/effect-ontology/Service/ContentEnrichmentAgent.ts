/**
 * Service: Content Enrichment Agent
 *
 * Uses LLM to extract structured metadata from fetched content.
 * Analyzes markdown content to identify:
 * - Headlines, descriptions, and publication dates
 * - Source type classification (news, blog, press release, etc.)
 * - Key named entities and topics
 * - Author and organization attribution
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const enricher = yield* ContentEnrichmentAgent
 *   const jinaContent = yield* JinaReaderClient.fetchUrl("https://example.com/article")
 *   const enriched = yield* enricher.enrich(jinaContent.content)
 *   console.log(enriched.headline, enriched.topics)
 * })
 * ```
 *
 * @since 2.0.0
 * @module Service/ContentEnrichmentAgent
 */

import { LanguageModel } from "effect/unstable/ai"
import { Data, DateTime, Effect, Schema, Context, Layer } from "effect"
import type { JinaContent } from "../Domain/Model/EnrichedContent.ts"
import { EnrichedContent } from "../Domain/Model/EnrichedContent.ts"
import { ConfigService } from "./Config.ts"
import { generateObjectWithRetry } from "./LlmWithRetry.ts"
import { $ScratchpadId } from "@beep/identity";
import * as O from "effect/Option";
import { NonNegativeInt } from "@beep/schema/Int";

const $I = $ScratchpadId.create("effect-ontology/Service/ContentEnrichmentAgent");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error: Failed to enrich content
 *
 * @since 2.0.0
 * @category Errors
 */
export class ContentEnrichmentError extends Data.TaggedError("ContentEnrichmentError")<{
  readonly message: string
  readonly url?: string
  readonly cause?: unknown
}> {}

// =============================================================================
// Enrichment Schema (for LLM output)
// =============================================================================

/**
 * Schema for LLM output - matches EnrichedContent structure
 */
const EnrichmentOutputSchema = Schema.Struct({
  headline: Schema.String.annotate({
    description: "Main headline or title summarizing the content"
  }),
  description: Schema.String.annotate({
    description: "1-2 sentence summary of the content's main points"
  }),
  sourceType: Schema.Literals(["news", "blog", "press_release", "official", "academic", "unknown"]).annotate({
    description: "Classification of the content source type"
  }),
  publishedAt: Schema.NullOr(Schema.String).annotate({
    description: "Publication date in ISO 8601 format (YYYY-MM-DD) if identifiable, null otherwise"
  }),
  author: Schema.NullOr(Schema.String).annotate({
    description: "Author name if identifiable, null otherwise"
  }),
  organization: Schema.NullOr(Schema.String).annotate({
    description: "Publishing organization (news outlet, company, institution) if identifiable"
  }),
  keyEntities: Schema.Array(Schema.String).annotate({
    description: "Named entities (people, organizations, locations) prominently mentioned"
  }),
  topics: Schema.Array(Schema.String).annotate({
    description: "Topic or category tags for the content"
  }),
  language: Schema.String.annotate({
    description: "ISO 639-1 language code (e.g., 'en', 'es', 'de')"
  }),
  wordCount: Schema.Number.annotate({
    description: "Approximate word count of the content"
  })
})

type EnrichmentOutput = Schema.Schema.Type<typeof EnrichmentOutputSchema>

// =============================================================================
// Prompt Construction
// =============================================================================

const ENRICHMENT_SYSTEM_PROMPT =
  `You are a content analysis expert. Your task is to extract structured metadata from markdown content.

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

Be accurate and conservative - use null for uncertain fields rather than guessing.`

const buildEnrichmentPrompt = (content: string, url?: string): string => {
  const urlContext = url ? `\nSource URL: ${url}\n` : ""
  const truncatedContent = content.length > 8000 ? content.slice(0, 8000) + "\n\n[Content truncated...]" : content

  return `${urlContext}
Content to analyze:

${truncatedContent}`
}

// =============================================================================
// Service
// =============================================================================

export class ContentEnrichmentAgent extends Context.Service<ContentEnrichmentAgent>()(
  $I`ContentEnrichmentAgent`,
  {
    make: Effect.gen(function*() {
      const llm = yield* LanguageModel.LanguageModel
      const config = yield* ConfigService

      const { model, provider, timeoutMs } = config.llm
      const retryConfig = {
        initialDelayMs: config.runtime.retryInitialDelayMs,
        maxDelayMs: config.runtime.retryMaxDelayMs,
        maxAttempts: config.runtime.retryMaxAttempts,
        timeoutMs
      }

      /**
       * Enrich content from JinaContent response
       */
      const enrichFromJina = (
        jinaContent: JinaContent
      ): Effect.Effect<EnrichedContent, ContentEnrichmentError> =>
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
              organization: O.orElse(enriched.organization, () => jinaContent.siteName)
            })
          )
        )

      /**
       * Enrich raw markdown content
       */
      const enrich =
        Effect.fn(function*(
        content: string,
        url?: string
      ): Effect.fn.Return<EnrichedContent, ContentEnrichmentError> {
          // Calculate word count from content
          const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length

          const prompt = {
            systemMessage: ENRICHMENT_SYSTEM_PROMPT,
            userMessage: buildEnrichmentPrompt(content, url)
          }

          const response = yield* generateObjectWithRetry({
            llm,
            prompt,
            schema: EnrichmentOutputSchema,
            objectName: "enrichedContent",
            serviceName: "ContentEnrichment",
            model,
            provider,
            retryConfig,
            spanAttributes: {
              "content.url": url ?? "unknown",
              "content.wordCount": wordCount
            }
          }).pipe(
            Effect.mapError((error) =>
              new ContentEnrichmentError({
                message: `Failed to enrich content: ${error}`,
                ...(url === undefined ? {} : { url }),
                cause: error
              })
            )
          )

          // Convert LLM output to EnrichedContent
          const output = response.value as EnrichmentOutput

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
            wordCount: NonNegativeInt.make(output.wordCount || wordCount)
          })
        })

      /**
       * Get the JSON schema for enrichment output (useful for structured extraction)
       */
      const getSchema = (): object => Schema.toJsonSchemaDocument(EnrichmentOutputSchema).schema

      return {
        enrich,
        enrichFromJina,
        getSchema
      }
    }),
  }
) {
    static readonly Default = Layer.effect(this, this.make);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse date string to Date or null
 */
const parseDate = (dateStr: string | undefined | null): O.Option<DateTime.Utc> =>
  O.flatMap(O.fromNullishOr(dateStr), DateTime.make)
