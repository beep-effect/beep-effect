/**
 * Service: Similarity Scorer
 *
 * Wraps pure similarity functions with shared embedding cache.
 * Provides Effect-native interface for entity similarity computation.
 *
 * @since 2.0.0
 * @module Service/SimilarityScorer
 */

import { $ScratchpadId } from "@beep/identity";
import { Cache, Context, Duration, Effect, Layer } from "effect";
import * as P from "effect/Predicate";
import type { Entity, Relation } from "../Domain/Model/Entity.ts";
import type { EntityResolutionConfig } from "../Domain/Model/EntityResolution.ts";
import { computeEntitySimilarity, detectResolutionMethod, shouldConsiderMerge } from "../Utils/Similarity.ts";
import { NomicNlpService, NomicNlpServiceDefault } from "./NomicNlp.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/SimilarityScorer");

/**
 * Similarity score result with method detection
 *
 * @since 2.0.0
 * @category Types
 */
export interface SimilarityResult {
  readonly score: number;
  readonly method: "exact" | "similarity" | "containment" | "neighbor";
  readonly shouldMerge: boolean;
}

/**
 * SimilarityScorer - Service for computing entity similarity with caching
 *
 * Features:
 * - Shared embedding cache across computations
 * - Effect-native interface
 * - Configurable weights
 *
 * @since 2.0.0
 * @category Services
 */
export class SimilarityScorer extends Context.Service<SimilarityScorer>()($I`SimilarityScorer`, {
  make: Effect.gen(function* () {
    const nomic = yield* NomicNlpService;

    // Create a bounded cache for embeddings
    // Key: Mention text
    // Value: Embedding vector
    const embeddingCache = yield* Cache.make({
      capacity: 10_000,
      timeToLive: Duration.infinity,
      lookup: (mention: string) => nomic.embed(mention, "search_document"),
    });

    /**
     * Get or compute embedding for an entity request
     * Note: We leverage the mention text as the cache key to deduplicate
     * processing for identical mentions across different entities.
     */
    const getOrComputeEmbedding = (mention: string): Effect.Effect<ReadonlyArray<number>, Error> =>
      Cache.get(embeddingCache, mention);

    /**
     * Compute similarity between two entities
     */
    const compute = (
      a: Entity,
      b: Entity,
      relations: ReadonlyArray<Relation>,
      config: EntityResolutionConfig
    ): Effect.Effect<SimilarityResult, Error> =>
      Effect.gen(function* () {
        // Compute embeddings if embedding weight is configured
        let embeddingSimilarity: number | undefined;

        if (P.isTruthy(config.embeddingWeight) && config.embeddingWeight > 0) {
          const embA = yield* getOrComputeEmbedding(a.mention);
          const embB = yield* getOrComputeEmbedding(b.mention);
          embeddingSimilarity = nomic.cosineSimilarity(embA, embB);
        }

        const score = computeEntitySimilarity(a, b, relations, config, embeddingSimilarity);

        const method = detectResolutionMethod(a, b, relations);

        const shouldMergeResult = shouldConsiderMerge(a, b, relations, config, embeddingSimilarity);

        return {
          score,
          method,
          shouldMerge: shouldMergeResult,
        };
      });

    /**
     * Check if two entities should be merged (convenience method)
     */
    const shouldMerge = (
      a: Entity,
      b: Entity,
      relations: ReadonlyArray<Relation>,
      config: EntityResolutionConfig
    ): Effect.Effect<boolean, Error> => compute(a, b, relations, config).pipe(Effect.map((r) => r.shouldMerge));

    /**
     * Clear the embedding cache
     */
    const clearCache: Effect.Effect<void> = Cache.invalidateAll(embeddingCache);

    /**
     * Get current cache size
     */
    const getCacheSize: Effect.Effect<number> = Cache.size(embeddingCache);

    return {
      compute,
      shouldMerge,
      clearCache,
      getCacheSize,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([NomicNlpServiceDefault]));
}
