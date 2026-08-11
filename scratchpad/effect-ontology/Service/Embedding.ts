/**
 * Service: Embedding
 *
 * Provider-agnostic embedding service with caching and Effect Request API batching.
 * Supports Nomic (local) and Voyage (API) providers via EmbeddingProvider interface.
 *
 * @since 2.0.0
 * @module Service/Embedding
 */

import { Clock, Context, Effect, Layer, Option } from "effect"
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts"
import { MetricsService } from "../Telemetry/Metrics.ts"
import { hashVersionedEmbeddingKey } from "../Utils/Hash.ts"
import { EmbeddingCache } from "./EmbeddingCache.ts"
import {
  cosineSimilarity as cosineSim,
  type Embedding,
  EmbeddingProvider,
  type EmbeddingTaskType,
  type ProviderMetadata
} from "./EmbeddingProvider.ts"
import { EmbedTextRequest } from "./EmbeddingRequest.ts"
import { makeEmbeddingResolver } from "./EmbeddingResolver.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/Embedding");

// Re-export for backwards compatibility
export { type NomicTaskType } from "./NomicNlp.ts"

/**
 * EmbeddingService interface
 *
 * Provider-agnostic embedding operations with caching.
 *
 * @since 2.0.0
 * @category Service
 */
export interface EmbeddingService {
  /**
   * Embed a single text
   *
   * @param text - Text to embed
   * @param taskType - Task type for embedding (default: search_document)
   * @returns Embedding vector
   */
  readonly embed: (
    text: string,
    taskType?: EmbeddingTaskType
  ) => Effect.Effect<Embedding, AnyEmbeddingError>

  /**
   * Embed multiple texts efficiently with caching
   *
   * Uses Effect Request API for automatic batching.
   * Checks cache for each text, batches uncached texts for embedding,
   * stores new embeddings in cache, and returns all embeddings in input order.
   *
   * @param texts - Texts to embed
   * @param taskType - Task type for embedding (default: search_document)
   * @returns Embedding vectors in input order
   */
  readonly embedBatch: (
    texts: ReadonlyArray<string>,
    taskType?: EmbeddingTaskType
  ) => Effect.Effect<ReadonlyArray<Embedding>, AnyEmbeddingError>

  /**
   * Compute cosine similarity between two vectors
   *
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Similarity score between -1 and 1
   */
  readonly cosineSimilarity: (a: Embedding, b: Embedding) => number

  /**
   * Get current provider metadata
   *
   * @returns Provider metadata (providerId, modelId, dimension)
   */
  readonly getProviderMetadata: () => Effect.Effect<ProviderMetadata>
}

/**
 * EmbeddingService service tag
 *
 * @since 2.0.0
 * @category Service
 */
export const EmbeddingService = Context.Service<EmbeddingService>($I`EmbeddingService`)

/**
 * EmbeddingService implementation with provider abstraction and Request API
 *
 * Uses:
 * - EmbeddingProvider for provider-agnostic embeddings
 * - EmbeddingCache with versioned keys (includes model/dimension)
 * - Effect Request API for automatic batching via RequestResolver
 *
 * @since 2.0.0
 * @category Layers
 */
export const EmbeddingServiceLive: Layer.Layer<
  EmbeddingService,
  never,
  EmbeddingProvider | EmbeddingCache | MetricsService
> = Layer.effect(
  EmbeddingService,
  Effect.gen(function*() {
    const provider = yield* EmbeddingProvider
    const cache = yield* EmbeddingCache
    const metrics = yield* MetricsService

    const { metadata } = provider
    const resolver = makeEmbeddingResolver(provider)

    /**
     * Embed with cache-through pattern and Request API batching
     */
    const embedWithCache = (
      text: string,
      taskType: EmbeddingTaskType
    ): Effect.Effect<Embedding, AnyEmbeddingError> =>
      Effect.gen(function*() {
        const startTime = yield* Clock.currentTimeMillis

        // Generate versioned cache key (includes provider/model/dimension)
        const hash = yield* hashVersionedEmbeddingKey(text, taskType, metadata)

        // Check cache first
        const cached = yield* cache.get(hash)
        if (Option.isSome(cached)) {
          const latencyMs = (yield* Clock.currentTimeMillis) - startTime
          yield* metrics.recordCacheHit(latencyMs)
          return cached.value
        }

        // Cache miss - use Request API for batching
        const request = EmbedTextRequest({ text, taskType, metadata })
        const embedding = yield* Effect.request(request, resolver)

        // Store in cache with versioned key
        yield* cache.set(hash, embedding)

        const latencyMs = (yield* Clock.currentTimeMillis) - startTime
        yield* metrics.recordCacheMiss(latencyMs)

        return embedding
      })

    return {
      embed: (text, taskType = "search_document") => embedWithCache(text, taskType),

      embedBatch: (texts, taskType = "search_document") => {
        if (texts.length === 0) {
          return Effect.succeed([] as ReadonlyArray<Embedding>)
        }

        // Use Effect.forEach with batching enabled
        // The Request API will automatically batch these together
        return Effect.forEach(texts, (text) => embedWithCache(text, taskType), {
          concurrency: "unbounded",
          batching: true
        })
      },

      cosineSimilarity: cosineSim,

      getProviderMetadata: () => Effect.succeed(metadata)
    }
  })
)

/**
 * EmbeddingService with all dependencies
 *
 * Provides complete embedding infrastructure including provider,
 * cache, and metrics.
 *
 * @since 2.0.0
 * @category Layers
 */
export const EmbeddingServiceDefault: Layer.Layer<
  EmbeddingService,
  never,
  EmbeddingProvider | EmbeddingCache | MetricsService
> = EmbeddingServiceLive

// =============================================================================
// Legacy Compatibility
// =============================================================================

/**
 * Legacy layer for backwards compatibility
 *
 * Uses NomicNlpService directly (bypasses provider abstraction).
 * Prefer EmbeddingServiceLive with EmbeddingProvider for new code.
 *
 * @deprecated Use EmbeddingServiceLive with EmbeddingProvider instead
 * @since 2.0.0
 * @category Layers
 */
export { NomicNlpService, NomicNlpServiceLive } from "./NomicNlp.ts"
