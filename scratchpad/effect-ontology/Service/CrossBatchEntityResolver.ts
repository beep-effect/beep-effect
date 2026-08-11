/**
 * Cross-Batch Entity Resolver Service
 *
 * Resolves entities across extraction batches by matching against a persistent
 * entity registry. Enables building up a knowledge base over time where entities
 * from different batches are linked to canonical IRIs.
 *
 * @since 2.0.0
 * @module Service/CrossBatchEntityResolver
 */

import type { SqlError } from "effect/unstable/sql"
import { Effect, HashMap, Option, Schema, Context, Layer } from "effect"
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts"
import type { Entity } from "../Domain/Model/Entity.ts"
import { type BlockingCandidate, EntityRegistryRepository } from "../Repository/EntityRegistry.ts"
import { EmbeddingService } from "./Embedding.ts"
import { $ScratchpadId } from "@beep/identity";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
const $I = $ScratchpadId.create("effect-ontology/Service/CrossBatchEntityResolver");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Combined error type for cross-batch resolution operations
 */
export type CrossBatchResolutionError = AnyEmbeddingError | SqlError.SqlError

// =============================================================================
// Types
// =============================================================================

/**
 * Result of cross-batch entity resolution
 */
export interface CrossBatchResolutionResult {
  /** Map from extracted entity ID to canonical IRI */
  readonly canonicalMap: Record<string, string>
  /** IRIs of new canonical entities created this batch */
  readonly newCanonicals: ReadonlyArray<string>
  /** Entities merged into existing canonicals */
  readonly mergedEntities: ReadonlyArray<MergedEntity>
  /** Resolution statistics */
  readonly stats: ResolutionStats
}

export interface MergedEntity {
  readonly entityId: string
  readonly canonicalIri: string
  readonly confidence: number
  readonly method: string
}

export interface ResolutionStats {
  readonly totalEntities: number
  readonly matchedToExisting: number
  readonly createdNew: number
  readonly candidatesEvaluated: number
}

/**
 * Configuration for cross-batch entity resolution
 */
export class CrossBatchResolverConfig extends Schema.Class<CrossBatchResolverConfig>("CrossBatchResolverConfig")({
  /** Minimum similarity for candidate retrieval (ANN search) */
  candidateThreshold: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })).pipe(
    SchemaUtils.withKeyDefaults(0.6)
  ),

  /** Minimum similarity for final resolution decision */
  resolutionThreshold: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })).pipe(
    SchemaUtils.withKeyDefaults(0.8)
  ),

  /** Maximum candidates per entity from ANN search */
  maxCandidatesPerEntity: Schema.Int.check(Schema.isGreaterThan(0)).pipe(
    SchemaUtils.withKeyDefaults(20)
  ),

  /** Maximum candidates from token blocking */
  maxBlockingCandidates: Schema.Int.check(Schema.isGreaterThan(0)).pipe(
    SchemaUtils.withKeyDefaults(100)
  ),

  /** Namespace prefix for generated canonical IRIs */
  canonicalNamespace: Schema.String.pipe(
    SchemaUtils.withKeyDefaults("http://example.org/entities/")
  )
}) {}

const DEFAULT_CONFIG = CrossBatchResolverConfig.make({})

// =============================================================================
// Service
// =============================================================================

export class CrossBatchEntityResolver extends Context.Service<CrossBatchEntityResolver>()(
  $I`CrossBatchEntityResolver`,
  {
    make: Effect.gen(function*() {
      const registry = yield* EntityRegistryRepository
      const embeddingService = yield* EmbeddingService

      /**
       * Phase 1: Load blocking candidates from registry
       *
       * Uses hybrid blocking: token-based + embedding-based
       *
       * @param ontologyId - Ontology scope for candidate retrieval
       */
      const loadCandidates =
        Effect.fn(function*(
        ontologyId: string,
        entities: ReadonlyArray<Entity>,
        config: CrossBatchResolverConfig = DEFAULT_CONFIG
      ): Effect.fn.Return<HashMap.HashMap<string, Array<BlockingCandidate>>, CrossBatchResolutionError>  {
          if (entities.length === 0) {
            return HashMap.empty<string, Array<BlockingCandidate>>()
          }

          yield* Effect.logDebug("Loading candidates for entities", {
            entityCount: entities.length
          })

          // Generate embeddings for all entities
          const embeddings = yield* embeddingService.embedBatch(
            entities.map((e) => e.mention),
            "clustering"
          )

          // Build candidate map
          let candidateMap = HashMap.empty<string, Array<BlockingCandidate>>()

          // For each entity, find candidates via both blocking strategies
          yield* Effect.forEach(
            entities,
            (entity, idx) =>
              Effect.gen(function*() {
                const entityEmbedding = embeddings[idx]
                const tokens = tokenize(entity.mention)

                // Token-based blocking
                const tokenCandidates = yield* registry.findCandidatesByTokens(
                  ontologyId,
                  tokens,
                  config.maxBlockingCandidates
                )

                // Embedding-based ANN search
                const embeddingCandidates = yield* registry.findSimilarEntities(
                  ontologyId,
                  entityEmbedding,
                  {
                    types: entity.types.length > 0 ? entity.types : undefined,
                    k: config.maxCandidatesPerEntity,
                    minSimilarity: config.candidateThreshold
                  }
                )

                // Merge and deduplicate candidates (prefer higher similarity)
                const merged = new Map<string, BlockingCandidate>()
                for (const c of [...tokenCandidates, ...embeddingCandidates]) {
                  const existing = merged.get(c.canonicalEntityId)
                  if (!existing || c.similarity > existing.similarity) {
                    merged.set(c.canonicalEntityId, c)
                  }
                }

                candidateMap = HashMap.set(
                  candidateMap,
                  entity.id,
                  Array.from(merged.values())
                )
              }),
            { concurrency: 10 }
          )

          return candidateMap
        })

      /**
       * Phase 2: Match new entities against candidates
       */
      const resolveEntities = (
        entities: ReadonlyArray<Entity>,
        embeddings: ReadonlyArray<ReadonlyArray<number>>,
        candidateMap: HashMap.HashMap<string, Array<BlockingCandidate>>,
        config: CrossBatchResolverConfig = DEFAULT_CONFIG
      ): {
        canonicalMap: Record<string, string>
        mergedEntities: Array<MergedEntity>
        unresolvedEntities: Array<{ entity: Entity; embedding: ReadonlyArray<number> }>
        candidatesEvaluated: number
      } => {
        const canonicalMap: Record<string, string> = {}
        const mergedEntities: Array<MergedEntity> = []
        const unresolvedEntities: Array<{ entity: Entity; embedding: ReadonlyArray<number> }> = []
        let candidatesEvaluated = 0

        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i]
          const embedding = embeddings[i]
          const candidates = HashMap.get(candidateMap, entity.id).pipe(
            Option.getOrElse(() => [] as Array<BlockingCandidate>)
          )

          candidatesEvaluated += candidates.length

          // Find best matching candidate above threshold
          let bestMatch: { candidate: BlockingCandidate; similarity: number } | null = null

          for (const candidate of candidates) {
            // Use embedding similarity as primary metric
            // Could enhance with string similarity, type overlap, etc.
            if (candidate.similarity >= config.resolutionThreshold) {
              if (!bestMatch || candidate.similarity > bestMatch.similarity) {
                bestMatch = { candidate, similarity: candidate.similarity }
              }
            }
          }

          if (bestMatch) {
            // Matched to existing canonical
            canonicalMap[entity.id] = bestMatch.candidate.iri
            mergedEntities.push({
              entityId: entity.id,
              canonicalIri: bestMatch.candidate.iri,
              confidence: bestMatch.similarity,
              method: "embedding_similarity"
            })
          } else {
            // No match - will become new canonical
            unresolvedEntities.push({ entity, embedding })
          }
        }

        return { canonicalMap, mergedEntities, unresolvedEntities, candidatesEvaluated }
      }

      /**
       * Phase 3: Update registry with new/merged entities
       *
       * @param ontologyId - Ontology scope for entity creation
       */
      const updateRegistry =
        Effect.fn(function*(
        ontologyId: string,
        resolutionResult: {
          canonicalMap: Record<string, string>
          mergedEntities: Array<MergedEntity>
          unresolvedEntities: Array<{ entity: Entity; embedding: ReadonlyArray<number> }>
        },
        batchId: string,
        config: CrossBatchResolverConfig = DEFAULT_CONFIG
      ): Effect.fn.Return<{
        canonicalMap: Record<string, string>
        newCanonicals: Array<string>
      }, SqlError.SqlError> {
          const { canonicalMap, mergedEntities, unresolvedEntities } = resolutionResult
          const newCanonicalIris: Array<string> = []

          // Update existing canonicals with merge info
          for (const merged of mergedEntities) {
            // Get the original entity from mergedEntities - need to pass it through
            // For now, just record the alias from the mention we matched
            // The original entity mention is in the merged.entityId but we need the Entity object

            // Insert alias for this mention
            // Note: We need to look up the canonical entity ID from IRI
            const canonicalOpt = yield* registry.getCanonicalEntityByIri(merged.canonicalIri)
            if (Option.isSome(canonicalOpt)) {
              const canonical = canonicalOpt.value
              // We don't have the original entity mention here - this needs refactoring
              // For now, skip alias insertion for merged entities
              // TODO: Pass Entity through resolution result for alias creation

              // Touch the canonical entity to update last_seen_at
              yield* registry.touchCanonicalEntity(canonical.id)
            }
          }

          // Create new canonicals for unresolved entities
          for (const { embedding, entity } of unresolvedEntities) {
            // Generate IRI for new canonical
            const iri = `${config.canonicalNamespace}${entity.id}`

            yield* registry.insertCanonicalEntity({
              ontologyId,
              iri,
              canonicalMention: entity.mention,
              types: entity.types as Array<string>,
              embedding: embedding as Array<number>,
              mergeCount: 1,
              confidenceAvg: "1.0"
            })

            // Insert blocking tokens
            const tokens = tokenize(entity.mention)
            // Need to get the ID of the just-inserted entity
            const insertedOpt = yield* registry.getCanonicalEntityByIri(iri)
            if (Option.isSome(insertedOpt)) {
              yield* registry.insertBlockingTokens(ontologyId, insertedOpt.value.id, tokens)
            }

            canonicalMap[entity.id] = iri
            newCanonicalIris.push(iri)
          }

          return {
            canonicalMap,
            newCanonicals: newCanonicalIris
          }
        })

      /**
       * Full cross-batch resolution pipeline
       *
       * @param ontologyId - Ontology scope for entity resolution
       */
      const resolve =
        Effect.fn(function*(
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
                candidatesEvaluated: 0
              }
            }
          }

          yield* Effect.logInfo("Cross-batch entity resolution starting", {
            entityCount: entities.length,
            batchId,
            ontologyId
          })

          // Generate embeddings for all entities
          const embeddings = yield* embeddingService.embedBatch(
            entities.map((e) => e.mention),
            "clustering"
          )

          // Phase 1: Load candidates
          const candidateMap = yield* loadCandidates(ontologyId, entities, config)

          // Phase 2: Resolve against candidates
          const resolutionResult = resolveEntities(entities, embeddings, candidateMap, config)

          // Phase 3: Update registry
          const finalResult = yield* updateRegistry(
            ontologyId,
            {
              ...resolutionResult,
              unresolvedEntities: resolutionResult.unresolvedEntities
            },
            batchId,
            config
          )

          const stats: ResolutionStats = {
            totalEntities: entities.length,
            matchedToExisting: resolutionResult.mergedEntities.length,
            createdNew: finalResult.newCanonicals.length,
            candidatesEvaluated: resolutionResult.candidatesEvaluated
          }

          yield* Effect.logInfo("Cross-batch entity resolution complete", {
            ...stats,
            batchId
          })

          return {
            canonicalMap: finalResult.canonicalMap,
            newCanonicals: finalResult.newCanonicals,
            mergedEntities: resolutionResult.mergedEntities,
            stats
          }
        })

      /**
       * Check if entity registry is empty
       */
      const isEmpty =
        Effect.fn(function*() {
          const count = yield* registry.countCanonicalEntities()
          return count === 0
        })

      /**
       * Get registry statistics
       *
       * @param ontologyId - Optional ontology scope. If provided, returns stats for that ontology only.
       */
      const getStats = (ontologyId?: string) => registry.getStats(ontologyId)

      return {
        loadCandidates,
        resolve,
        isEmpty,
        getStats
      }
    }),
  }
) {
    static readonly Default = Layer.effect(this, this.make);
}

// =============================================================================
// Layers
// =============================================================================

/**
 * Live layer for CrossBatchEntityResolver
 */
export const CrossBatchEntityResolverLive = CrossBatchEntityResolver.Default

// =============================================================================
// Helpers
// =============================================================================

/**
 * Tokenize a mention for blocking index
 */
function tokenize(mention: string): Array<string> {
  const stopWords = new Set([
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
  ])

  return mention
    .toLowerCase()
    .split(/[\s\-_.,;:!?'"()[]{}]+/)
    .filter((token) => token.length > 2 && !stopWords.has(token))
}
