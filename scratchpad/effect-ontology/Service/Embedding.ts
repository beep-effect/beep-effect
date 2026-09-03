/**
 * Service: Embedding
 *
 * **Details**
 *
 * Provider-agnostic embedding service with caching and Effect Request API batching.
 * Supports Nomic (local) and Voyage (API) providers via EmbeddingProvider interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Clock, Context, Effect, Layer } from "effect";
import * as O from "effect/Option";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import { EmbeddingError } from "../Domain/Error/Embedding.ts";
import { MetricsService } from "../Telemetry/Metrics.ts";
import { hashVersionedEmbeddingKey } from "../Utils/Hash.ts";
import { EmbeddingCache } from "./EmbeddingCache.ts";
import type { Embedding, EmbeddingTaskType, ProviderMetadata } from "./EmbeddingProvider.ts";
import { cosineSimilarity as cosineSim, EmbeddingProvider } from "./EmbeddingProvider.ts";
import { EmbedTextRequest } from "./EmbeddingRequest.ts";
import { DEFAULT_MAX_BATCH_SIZE, makeEmbeddingResolver } from "./EmbeddingResolver.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Embedding");

// Re-export for backwards compatibility
export type { NomicTaskType } from "./NomicNlp.ts";

/**
 * EmbeddingService interface
 *
 * **Details**
 *
 * Provider-agnostic embedding operations with caching.
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EmbeddingServiceMethods {
  /**
   * Embed a single text
   *
   * @param text - Text to embed
   * @param taskType - Task type for embedding (default: search_document)
   * @returns Embedding vector
   */
  readonly embed: (text: string, taskType?: EmbeddingTaskType) => Effect.Effect<Embedding, AnyEmbeddingError>;

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
  ) => Effect.Effect<ReadonlyArray<Embedding>, AnyEmbeddingError>;

  /**
   * Compute cosine similarity between two vectors
   *
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Similarity score between -1 and 1
   */
  readonly cosineSimilarity: (a: Embedding, b: Embedding) => number;

  /**
   * Get current provider metadata
   *
   * @returns Provider metadata (providerId, modelId, dimension)
   */
  readonly getProviderMetadata: Effect.Effect<ProviderMetadata>;
}

/**
 * EmbeddingService service tag
 *
 * **Example** (Embed text through a test layer)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { EmbeddingService } from "@effect-ontology/Service/Embedding"
 * import { ProviderMetadata, cosineSimilarity } from "@effect-ontology/Service/EmbeddingProvider"
 *
 * const TestEmbeddings = Layer.succeed(EmbeddingService, {
 *   embed: () => Effect.succeed([1, 0]),
 *   embedBatch: (texts) => Effect.succeed(texts.map(() => [1, 0])),
 *   cosineSimilarity,
 *   getProviderMetadata: Effect.succeed(
 *     ProviderMetadata.make({ providerId: "nomic", modelId: "demo", dimension: 2 })
 *   )
 * })
 *
 * const length = Effect.runSync(
 *   Effect.gen(function* () {
 *     const embeddings = yield* EmbeddingService
 *     const vector = yield* embeddings.embed("Ada founded Acme.")
 *     return vector.length
 *   }).pipe(Effect.provide(TestEmbeddings), Effect.orDie)
 * )
 * console.log(length) // 2
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class EmbeddingService extends Context.Service<EmbeddingService, EmbeddingServiceMethods>()(
  $I`EmbeddingService`
) {}

/**
 * EmbeddingService implementation with provider abstraction and Request API
 *
 * **Details**
 *
 * Uses:
 * - EmbeddingProvider for provider-agnostic embeddings
 * - EmbeddingCache with versioned keys (includes model/dimension)
 * - Effect Request API for automatic batching via RequestResolver
 *
 * **Example** (Compose live embed with a test provider)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { EmbeddingService, EmbeddingServiceLive } from "@effect-ontology/Service/Embedding"
 * import { EmbeddingCache } from "@effect-ontology/Service/EmbeddingCache"
 * import {
 *   EmbeddingProvider,
 *   ProviderMetadata,
 *   cosineSimilarity
 * } from "@effect-ontology/Service/EmbeddingProvider"
 * import { MetricsService } from "@effect-ontology/Telemetry/Metrics"
 *
 * const TestProvider = Layer.succeed(EmbeddingProvider, {
 *   metadata: ProviderMetadata.make({ providerId: "nomic", modelId: "demo", dimension: 2 }),
 *   embedBatch: (requests) => Effect.succeed(requests.map(() => [1, 0])),
 *   cosineSimilarity
 * })
 *
 * const program = Effect.gen(function* () {
 *   const embeddings = yield* EmbeddingService
 *   return yield* embeddings.embed("Ada founded Acme.")
 * }).pipe(
 *   Effect.provide(EmbeddingServiceLive),
 *   Effect.provide(TestProvider),
 *   Effect.provide(EmbeddingCache.Default),
 *   Effect.provide(MetricsService.Default)
 * )
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingServiceLive: Layer.Layer<
  EmbeddingService,
  never,
  EmbeddingProvider | EmbeddingCache | MetricsService
> = Layer.effect(
  EmbeddingService,
  Effect.gen(function* () {
    const provider = yield* EmbeddingProvider;
    const cache = yield* EmbeddingCache;
    const metrics = yield* MetricsService;

    const { metadata } = provider;
    const resolver = makeEmbeddingResolver(provider, DEFAULT_MAX_BATCH_SIZE);

    /**
     * Embed with cache-through pattern and Request API batching
     */
    const embedWithCache = (text: string, taskType: EmbeddingTaskType): Effect.Effect<Embedding, AnyEmbeddingError> =>
      Effect.gen(function* () {
        const startTime = yield* Clock.currentTimeMillis;

        // Generate versioned cache key (includes provider/model/dimension)
        const hash = yield* hashVersionedEmbeddingKey(text, taskType, metadata).pipe(
          Effect.mapError((cause) =>
            EmbeddingError.make({
              message: "Failed to compute the embedding cache key",
              provider: metadata.providerId,
              cause: O.some(cause),
            })
          )
        );

        // Check cache first
        const cached = yield* cache.get(hash);
        if (O.isSome(cached)) {
          const latencyMs = (yield* Clock.currentTimeMillis) - startTime;
          yield* metrics.recordCacheHit(latencyMs);
          return cached.value;
        }

        // Cache miss - use Request API for batching
        const request = EmbedTextRequest({ text, taskType, metadata });
        const embedding = yield* Effect.request(request, resolver);

        // Store in cache with versioned key
        yield* cache.set(hash, embedding);

        const latencyMs = (yield* Clock.currentTimeMillis) - startTime;
        yield* metrics.recordCacheMiss(latencyMs);

        return embedding;
      });

    return {
      embed: Effect.fn("EmbeddingService.embed")((text, taskType = "search_document") =>
        embedWithCache(text, taskType)
      ),
      embedBatch: Effect.fn("EmbeddingService.embedBatch")(function* (texts, taskType = "search_document") {
        if (texts.length === 0) {
          return [];
        }
        return yield* Effect.forEach(texts, (text) => embedWithCache(text, taskType), {
          concurrency: "unbounded",
        });
      }),
      cosineSimilarity: cosineSim,
      getProviderMetadata: Effect.succeed(metadata),
    };
  })
);

/**
 * EmbeddingService with all dependencies
 *
 * **Details**
 *
 * Provides complete embedding infrastructure including provider,
 * cache, and metrics.
 *
 * **Example** (Provide default embedding infrastructure)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { EmbeddingService, EmbeddingServiceDefault } from "@effect-ontology/Service/Embedding"
 * import { EmbeddingCache } from "@effect-ontology/Service/EmbeddingCache"
 * import {
 *   EmbeddingProvider,
 *   ProviderMetadata,
 *   cosineSimilarity
 * } from "@effect-ontology/Service/EmbeddingProvider"
 * import { MetricsService } from "@effect-ontology/Telemetry/Metrics"
 *
 * const TestProvider = Layer.succeed(EmbeddingProvider, {
 *   metadata: ProviderMetadata.make({ providerId: "nomic", modelId: "demo", dimension: 2 }),
 *   embedBatch: (requests) => Effect.succeed(requests.map(() => [1, 0])),
 *   cosineSimilarity
 * })
 *
 * const length = Effect.runSync(
 *   Effect.gen(function* () {
 *     const embeddings = yield* EmbeddingService
 *     const vector = yield* embeddings.embed("Ada founded Acme.")
 *     return vector.length
 *   }).pipe(
 *     Effect.provide(EmbeddingServiceDefault),
 *     Effect.provide(TestProvider),
 *     Effect.provide(EmbeddingCache.Default),
 *     Effect.provide(MetricsService.Default),
 *     Effect.orDie
 *   )
 * )
 * console.log(length) // 2
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingServiceDefault: Layer.Layer<
  EmbeddingService,
  never,
  EmbeddingProvider | EmbeddingCache | MetricsService
> = EmbeddingServiceLive;
