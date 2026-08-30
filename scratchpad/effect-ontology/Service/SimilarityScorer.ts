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
import { LiteralKit } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Cache, Context, Duration, Effect, Layer } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { Entity, Relation } from "../Domain/Model/Entity.ts";
import type { EntityResolutionConfig } from "../Domain/Model/EntityResolution.ts";
import { computeEntitySimilarity, detectResolutionMethod, shouldConsiderMerge } from "../Utils/Similarity.ts";
import { NomicNlpService, NomicNlpServiceDefault } from "./NomicNlp.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/SimilarityScorer");
const SimilarityMethod = LiteralKit(["exact", "similarity", "containment", "neighbor"]).pipe(
  $I.annoteSchema("SimilarityMethod", {
    description: "Resolution strategies that can produce an entity similarity decision.",
  })
);

/**
 * Similarity score plus the method that produced the merge decision.
 *
 * **Example** (Record a similarity decision)
 *
 * ```ts
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { SimilarityResult } from "@effect-ontology/Service/SimilarityScorer"
 *
 * const result = SimilarityResult.make({
 *   score: UnitInterval.make(0.92),
 *   method: "similarity",
 *   shouldMerge: true
 * })
 * console.log(result.shouldMerge) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SimilarityResult extends S.Class<SimilarityResult>($I`SimilarityResult`)(
  {
    score: UnitInterval,
    method: SimilarityMethod,
    shouldMerge: S.Boolean,
  },
  $I.annote("SimilarityResult", { description: "Validated entity similarity score and resolution decision." })
) {}

/**
 * Cached entity-similarity scorer backed by {@link NomicNlpService}.
 *
 * **Details**
 *
 * Embeddings are cached by mention text so repeated comparisons skip re-encoding.
 *
 * **Example** (Read cache size from Default)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { SimilarityScorer } from "@effect-ontology/Service/SimilarityScorer"
 *
 * const program = Effect.gen(function* () {
 *   const scorer = yield* SimilarityScorer
 *   return yield* scorer.getCacheSize
 * }).pipe(Effect.provide(SimilarityScorer.Default))
 *
 * console.log(program)
 * ```
 *
 * @category services
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
    const getOrComputeEmbedding = (mention: string) => Cache.get(embeddingCache, mention);

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
    const shouldMerge = (a: Entity, b: Entity, relations: ReadonlyArray<Relation>, config: EntityResolutionConfig) =>
      compute(a, b, relations, config).pipe(Effect.map((r) => r.shouldMerge));

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
