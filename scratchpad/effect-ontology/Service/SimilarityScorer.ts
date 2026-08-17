/**
 * Service: Similarity Scorer
 *
 * **Details**
 *
 * Wraps pure similarity functions with shared embedding cache.
 * Provides Effect-native interface for entity similarity computation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Cache, Context, Duration, Effect, Layer } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { Entity, Relation } from "../Domain/Model/Entity.ts";
import type { EntityResolutionConfig } from "../Domain/Model/EntityResolution.ts";
import { computeEntitySimilarity, detectResolutionMethod, shouldConsiderMerge } from "../Utils/Similarity.ts";
import { NomicNlpService, NomicNlpServiceDefault } from "./NomicNlp.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/SimilarityScorer");

/**
 * Similarity score result with method detection
 *
 *
 * **Example** (Use the SimilarityResult contract)
 *
 * ```ts
 * import type { SimilarityResult } from "@effect-ontology/Service/SimilarityScorer"
 *
 * const acceptsSimilarityResult = (_value: SimilarityResult): void => undefined
 *
 * console.log(acceptsSimilarityResult)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class SimilarityResult extends S.Class<SimilarityResult>($I`SimilarityResult`)(
  {
    score: UnitInterval,
    method: S.Literals(["exact", "similarity", "containment", "neighbor"]),
    shouldMerge: S.Boolean,
  },
  $I.annote("SimilarityResult", { description: "Validated entity similarity score and resolution decision." })
) {}

/**
 * SimilarityScorer - Service for computing entity similarity with caching
 *
 * **Details**
 *
 * Features:
 * - Shared embedding cache across computations
 * - Effect-native interface
 * - Configurable weights
 *
 * **Example** (Inspect similarity scorer)
 *
 * ```ts
 * import { SimilarityScorer } from "@effect-ontology/Service/SimilarityScorer"
 *
 * console.log(SimilarityScorer)
 * ```
 *
 * @category layers
 * @since 0.0.0
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
    const getOrComputeEmbedding = (mention: string) =>
      Cache.get(embeddingCache, mention);

    /**
     * Compute similarity between two entities
     */
    const compute = Effect.fn("SimilarityScorer.compute")(function* (
      a: Entity,
      b: Entity,
      relations: ReadonlyArray<Relation>,
      config: EntityResolutionConfig
    ) {
      // Compute embeddings if embedding weight is configured
      let embeddingSimilarity: number | undefined;

      if (P.isTruthy(config.embeddingWeight) && config.embeddingWeight > 0) {
        const embA = yield* getOrComputeEmbedding(a.mention);
        const embB = yield* getOrComputeEmbedding(b.mention);
        embeddingSimilarity = nomic.cosineSimilarity(embA, embB);
      }

      const score = computeEntitySimilarity(a, b, relations, config, embeddingSimilarity, undefined);

      const method = detectResolutionMethod(a, b, relations);

      const shouldMergeResult = shouldConsiderMerge(a, b, relations, config, embeddingSimilarity, undefined);

      return SimilarityResult.make({
        score: UnitInterval.make(score),
        method,
        shouldMerge: shouldMergeResult,
      });
    });

    /**
     * Check if two entities should be merged (convenience method)
     */
    const shouldMerge = (
      a: Entity,
      b: Entity,
      relations: ReadonlyArray<Relation>,
      config: EntityResolutionConfig
    ) => compute(a, b, relations, config).pipe(Effect.map((r) => r.shouldMerge));

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
