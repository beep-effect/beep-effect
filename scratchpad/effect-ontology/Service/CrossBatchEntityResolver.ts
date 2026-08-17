/**
 * Cross-Batch Entity Resolver Service
 *
 * **Details**
 *
 * Resolves entities across extraction batches by matching against a persistent
 * entity registry. Enables building up a knowledge base over time where entities
 * from different batches are linked to canonical IRIs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { DrizzleError } from "@beep/drizzle";
import { $ScratchpadId } from "@beep/identity";
import { PosInt } from "@beep/schema/Int";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Context, Effect, HashMap, HashSet, Layer, MutableHashMap } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import type { Entity } from "../Domain/Model/Entity.ts";
import type { BlockingCandidate } from "../Repository/EntityRegistry.ts";
import { EntityRegistryRepository } from "../Repository/EntityRegistry.ts";
import { EmbeddingService } from "./Embedding.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/CrossBatchEntityResolver");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Combined error type for cross-batch resolution operations
 *
 *
 * **Example** (Use the CrossBatchResolutionError contract)
 *
 * ```ts
 * import type { CrossBatchResolutionError } from "@effect-ontology/Service/CrossBatchEntityResolver"
 *
 * const acceptsCrossBatchResolutionError = (_value: CrossBatchResolutionError): void => undefined
 *
 * console.log(acceptsCrossBatchResolutionError)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CrossBatchResolutionError = AnyEmbeddingError | DrizzleError;

// =============================================================================
// Types
// =============================================================================

/**
 * Result of cross-batch entity resolution
 *
 *
 * **Example** (Use the CrossBatchResolutionResult contract)
 *
 * ```ts
 * import type { CrossBatchResolutionResult } from "@effect-ontology/Service/CrossBatchEntityResolver"
 *
 * const acceptsCrossBatchResolutionResult = (_value: CrossBatchResolutionResult): void => undefined
 *
 * console.log(acceptsCrossBatchResolutionResult)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface CrossBatchResolutionResult {
  /** Map from extracted entity ID to canonical IRI */
  readonly canonicalMap: Record<string, string>;
  /** IRIs of new canonical entities created this batch */
  readonly newCanonicals: ReadonlyArray<string>;
  /** Entities merged into existing canonicals */
  readonly mergedEntities: ReadonlyArray<MergedEntity>;
  /** Resolution statistics */
  readonly stats: ResolutionStats;
}

/**
 * Describes the merged entity data exposed by this module.
 *
 *
 * **Example** (Use the MergedEntity contract)
 *
 * ```ts
 * import type { MergedEntity } from "@effect-ontology/Service/CrossBatchEntityResolver"
 *
 * const acceptsMergedEntity = (_value: MergedEntity): void => undefined
 *
 * console.log(acceptsMergedEntity)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface MergedEntity {
  readonly entityId: string;
  readonly canonicalIri: string;
  readonly confidence: number;
  readonly method: string;
}

/**
 * Describes the resolution stats data exposed by this module.
 *
 *
 * **Example** (Use the ResolutionStats contract)
 *
 * ```ts
 * import type { ResolutionStats } from "@effect-ontology/Service/CrossBatchEntityResolver"
 *
 * const acceptsResolutionStats = (_value: ResolutionStats): void => undefined
 *
 * console.log(acceptsResolutionStats)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ResolutionStats {
  readonly totalEntities: number;
  readonly matchedToExisting: number;
  readonly createdNew: number;
  readonly candidatesEvaluated: number;
}

/**
 * Configuration for cross-batch entity resolution
 *
 * **Example** (Inspect cross batch resolver config)
 *
 * ```ts
 * import { CrossBatchResolverConfig } from "@effect-ontology/Service/CrossBatchEntityResolver"
 *
 * console.log(CrossBatchResolverConfig)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CrossBatchResolverConfig extends S.Class<CrossBatchResolverConfig>("CrossBatchResolverConfig")({
  /** Minimum similarity for candidate retrieval (ANN search) */
  candidateThreshold: UnitInterval.pipe(SchemaUtils.withKeyDefaults(UnitInterval.make(0.6))),

  /** Minimum similarity for final resolution decision */
  resolutionThreshold: UnitInterval.pipe(SchemaUtils.withKeyDefaults(UnitInterval.make(0.8))),

  /** Maximum candidates per entity from ANN search */
  maxCandidatesPerEntity: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),

  /** Maximum candidates from token blocking */
  maxBlockingCandidates: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(100))),

  /** Namespace prefix for generated canonical IRIs */
  canonicalNamespace: S.String.pipe(SchemaUtils.withKeyDefaults("http://example.org/entities/")),
}) {}

const DEFAULT_CONFIG = CrossBatchResolverConfig.make({});

// =============================================================================
// Service
// =============================================================================

/**
 * Provides the cross batch entity resolver service capability.
 *
 * **Example** (Inspect cross batch entity resolver)
 *
 * ```ts
 * import { CrossBatchEntityResolver } from "@effect-ontology/Service/CrossBatchEntityResolver"
 *
 * console.log(CrossBatchEntityResolver)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class CrossBatchEntityResolver extends Context.Service<CrossBatchEntityResolver>()(
  $I`CrossBatchEntityResolver`,
  {
    make: Effect.gen(function* () {
      const registry = yield* EntityRegistryRepository;
      const embeddingService = yield* EmbeddingService;

      /**
       * Phase 1: Load blocking candidates from registry
       *
       * Uses hybrid blocking: token-based + embedding-based
       *
       * @param ontologyId - Ontology scope for candidate retrieval
       */
      const loadCandidates = Effect.fn(function* (
        ontologyId: string,
        entities: ReadonlyArray<Entity>,
        config: CrossBatchResolverConfig = DEFAULT_CONFIG
      ): Effect.fn.Return<HashMap.HashMap<string, Array<BlockingCandidate>>, CrossBatchResolutionError> {
        if (entities.length === 0) {
          return HashMap.empty<string, Array<BlockingCandidate>>();
        }

        yield* Effect.logDebug("Loading candidates for entities", {
          entityCount: entities.length,
        });

        // Generate embeddings for all entities
        const embeddings = yield* embeddingService.embedBatch(
          A.map(entities, (entity) => entity.mention),
          "clustering"
        );

        // Build candidate map
        let candidateMap = HashMap.empty<string, Array<BlockingCandidate>>();

        // For each entity, find candidates via both blocking strategies
        yield* Effect.forEach(
          entities,
          (entity, idx) =>
            Effect.gen(function* () {
              const entityEmbedding = embeddings[idx];
              const tokens = tokenize(entity.mention);

              // Token-based blocking
              const tokenCandidates = yield* registry.findCandidatesByTokens(
                ontologyId,
                tokens,
                config.maxBlockingCandidates
              );

              // Embedding-based ANN search
              const embeddingCandidates = yield* registry.findSimilarEntities(ontologyId, entityEmbedding, {
                types: entity.types,
                k: config.maxCandidatesPerEntity,
                minSimilarity: config.candidateThreshold,
              });

              // Merge and deduplicate candidates (prefer higher similarity)
              const merged = MutableHashMap.empty<string, BlockingCandidate>();
              for (const candidate of A.appendAll(tokenCandidates, embeddingCandidates)) {
                const existing = MutableHashMap.get(merged, candidate.canonicalEntityId);
                if (O.isNone(existing) || candidate.similarity > existing.value.similarity) {
                  MutableHashMap.set(merged, candidate.canonicalEntityId, candidate);
                }
              }

              candidateMap = HashMap.set(
                candidateMap,
                entity.id,
                A.map(A.fromIterable(merged), ([, candidate]) => candidate)
              );
            }),
          { concurrency: 10 }
        );

        return candidateMap;
      });

      /**
       * Phase 2: Match new entities against candidates
       */
      const resolveEntities = (
        entities: ReadonlyArray<Entity>,
        embeddings: ReadonlyArray<ReadonlyArray<number>>,
        candidateMap: HashMap.HashMap<string, Array<BlockingCandidate>>,
        config: CrossBatchResolverConfig = DEFAULT_CONFIG
      ): {
        canonicalMap: Record<string, string>;
        mergedEntities: Array<MergedEntity>;
        unresolvedEntities: Array<{ entity: Entity; embedding: ReadonlyArray<number> }>;
        candidatesEvaluated: number;
      } => {
        const canonicalMap: Record<string, string> = {};
        const mergedEntities: Array<MergedEntity> = [];
        const unresolvedEntities: Array<{ entity: Entity; embedding: ReadonlyArray<number> }> = [];
        let candidatesEvaluated = 0;

        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          const embedding = embeddings[i];
          const candidates = HashMap.get(candidateMap, entity.id).pipe(O.getOrElse(() => []));

          candidatesEvaluated += candidates.length;

          // Find best matching candidate above threshold
          let bestMatch: { candidate: BlockingCandidate; similarity: number } | null = null;

          for (const candidate of candidates) {
            // Use embedding similarity as primary metric
            // Could enhance with string similarity, type overlap, etc.
            if (candidate.similarity >= config.resolutionThreshold) {
              if (P.isNull(bestMatch) || candidate.similarity > bestMatch.similarity) {
                bestMatch = { candidate, similarity: candidate.similarity };
              }
            }
          }

          if (P.isNotNull(bestMatch)) {
            // Matched to existing canonical
            canonicalMap[entity.id] = bestMatch.candidate.iri;
            mergedEntities.push({
              entityId: entity.id,
              canonicalIri: bestMatch.candidate.iri,
              confidence: bestMatch.similarity,
              method: "embedding_similarity",
            });
          } else {
            // No match - will become new canonical
            unresolvedEntities.push({ entity, embedding });
          }
        }

        return { canonicalMap, mergedEntities, unresolvedEntities, candidatesEvaluated };
      };

      /**
       * Phase 3: Update registry with new/merged entities
       *
       * @param ontologyId - Ontology scope for entity creation
       */
      const updateRegistry = Effect.fn(function* (
        ontologyId: string,
        resolutionResult: {
          canonicalMap: Record<string, string>;
          mergedEntities: Array<MergedEntity>;
          unresolvedEntities: Array<{ entity: Entity; embedding: ReadonlyArray<number> }>;
        },
        config: CrossBatchResolverConfig = DEFAULT_CONFIG
      ): Effect.fn.Return<
        {
          canonicalMap: Record<string, string>;
          newCanonicals: Array<string>;
        },
        DrizzleError
      > {
        const { canonicalMap, mergedEntities, unresolvedEntities } = resolutionResult;
        let newCanonicalIris: Array<string> = [];

        // Update existing canonicals with merge info
        for (const merged of mergedEntities) {
          // Get the original entity from mergedEntities - need to pass it through
          // For now, just record the alias from the mention we matched
          // The original entity mention is in the merged.entityId but we need the Entity object

          // Insert alias for this mention
          // Note: We need to look up the canonical entity ID from IRI
          const canonicalOpt = yield* registry.getCanonicalEntityByIri(ontologyId, merged.canonicalIri);
          if (O.isSome(canonicalOpt)) {
            const canonical = canonicalOpt.value;
            // We don't have the original entity mention here - this needs refactoring
            // For now, skip alias insertion for merged entities
            // TODO: Pass Entity through resolution result for alias creation

            // Touch the canonical entity to update last_seen_at
            yield* registry.touchCanonicalEntity(ontologyId, canonical.id);
          }
        }

        // Create new canonicals for unresolved entities
        for (const { embedding, entity } of unresolvedEntities) {
          // Generate IRI for new canonical
          const iri = `${config.canonicalNamespace}${entity.id}`;

          yield* registry.insertCanonicalEntity({
            ontologyId,
            iri,
            canonicalMention: entity.mention,
            types: A.fromIterable(entity.types),
            embedding: A.fromIterable(embedding),
            mergeCount: 1,
            confidenceAvg: "1.0",
          });

          // Insert blocking tokens
          const tokens = tokenize(entity.mention);
          // Need to get the ID of the just-inserted entity
          const insertedOpt = yield* registry.getCanonicalEntityByIri(ontologyId, iri);
          if (O.isSome(insertedOpt)) {
            yield* registry.insertBlockingTokens(ontologyId, insertedOpt.value.id, tokens);
          }

          canonicalMap[entity.id] = iri;
          newCanonicalIris = A.append(newCanonicalIris, iri);
        }

        return {
          canonicalMap,
          newCanonicals: newCanonicalIris,
        };
      });

      /**
       * Full cross-batch resolution pipeline
       *
       * @param ontologyId - Ontology scope for entity resolution
       */
      const resolve = Effect.fn(function* (
        ontologyId: string,
        entities: ReadonlyArray<Entity>,
        batchId: string,
        config: CrossBatchResolverConfig = DEFAULT_CONFIG
      ): Effect.fn.Return<CrossBatchResolutionResult, CrossBatchResolutionError> {
        if (entities.length === 0) {
          return {
            canonicalMap: {},
            newCanonicals: [],
            mergedEntities: [],
            stats: {
              totalEntities: 0,
              matchedToExisting: 0,
              createdNew: 0,
              candidatesEvaluated: 0,
            },
          };
        }

        yield* Effect.logInfo("Cross-batch entity resolution starting", {
          entityCount: entities.length,
          batchId,
          ontologyId,
        });

        // Generate embeddings for all entities
        const embeddings = yield* embeddingService.embedBatch(
          A.map(entities, (entity) => entity.mention),
          "clustering"
        );

        // Phase 1: Load candidates
        const candidateMap = yield* loadCandidates(ontologyId, entities, config);

        // Phase 2: Resolve against candidates
        const resolutionResult = resolveEntities(entities, embeddings, candidateMap, config);

        // Phase 3: Update registry
        const finalResult = yield* updateRegistry(
          ontologyId,
          {
            ...resolutionResult,
            unresolvedEntities: resolutionResult.unresolvedEntities,
          },
          config
        );

        const stats: ResolutionStats = {
          totalEntities: entities.length,
          matchedToExisting: resolutionResult.mergedEntities.length,
          createdNew: finalResult.newCanonicals.length,
          candidatesEvaluated: resolutionResult.candidatesEvaluated,
        };

        yield* Effect.logInfo("Cross-batch entity resolution complete", {
          ...stats,
          batchId,
        });

        return {
          canonicalMap: finalResult.canonicalMap,
          newCanonicals: finalResult.newCanonicals,
          mergedEntities: resolutionResult.mergedEntities,
          stats,
        };
      });

      /**
       * Check if entity registry is empty
       */
      const isEmpty = Effect.fn(function* (ontologyId: string) {
        const count = yield* registry.countCanonicalEntities(ontologyId);
        return count === 0;
      });

      /**
       * Get registry statistics
       *
       * @param ontologyId - Optional ontology scope. If provided, returns stats for that ontology only.
       */
      const getStats = (ontologyId: string) => registry.getStats(ontologyId);

      return {
        loadCandidates,
        resolve,
        isEmpty,
        getStats,
      };
    }).pipe(Effect.withSpan("CrossBatchEntityResolver.make")),
  }
) {
  static readonly Default = Layer.effect(this, this.make);
}

// =============================================================================
// Layers
// =============================================================================

/**
 * Live layer for CrossBatchEntityResolver
 *
 * **Example** (Inspect cross batch entity resolver live)
 *
 * ```ts
 * import { CrossBatchEntityResolverLive } from "@effect-ontology/Service/CrossBatchEntityResolver"
 *
 * console.log(CrossBatchEntityResolverLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CrossBatchEntityResolverLive = CrossBatchEntityResolver.Default;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Tokenize a mention for blocking index
 */
function tokenize(mention: string): Array<string> {
  const stopWords = HashSet.make(
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "been",
    "be",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "this",
    "that",
    "these",
    "those",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "inc",
    "corp",
    "llc",
    "ltd",
    "co",
    "company"
  );

  return A.filter(
    Str.split(/[\s\-_.,;:!?'"()[\]{}]+/)(Str.toLowerCase(mention)),
    (token) => token.length > 2 && !HashSet.has(stopWords, token)
  );
}
