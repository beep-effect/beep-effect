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
import { IRI } from "@beep/rdf";
import { LiteralKit, UUID } from "@beep/schema";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Context, Effect, HashMap, HashSet, Layer, MutableHashMap } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import { Entity } from "../Domain/Model/Entity.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import { BlockingCandidate, EntityRegistryRepository, normalizeEntityMention } from "../Repository/EntityRegistry.ts";
import { EmbeddingService } from "./Embedding.ts";
import { Embedding } from "./EmbeddingProvider.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/CrossBatchEntityResolver");

const ResolutionMethod = LiteralKit(["embedding_similarity", "new_canonical"]).pipe(
  $I.annoteSchema("ResolutionMethod", {
    description: "Closed set of methods used to resolve an extracted entity to a canonical identity.",
  })
);

// =============================================================================
// Error Types
// =============================================================================

/**
 * Combined error type for cross-batch resolution operations
 *
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
 * **Example** (Create an empty resolution result)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { CrossBatchResolutionResult, ResolutionStats } from "@effect-ontology/Service/CrossBatchEntityResolver"
 *
 * const result = CrossBatchResolutionResult.make({
 *   canonicalMap: {},
 *   newCanonicals: [],
 *   mergedEntities: [],
 *   stats: ResolutionStats.make({
 *     totalEntities: NonNegativeInt.make(0),
 *     matchedToExisting: NonNegativeInt.make(0),
 *     createdNew: NonNegativeInt.make(0),
 *     candidatesEvaluated: NonNegativeInt.make(0)
 *   })
 * })
 * console.log(result.newCanonicals.length) // 0
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class CrossBatchResolutionResult extends S.Class<CrossBatchResolutionResult>($I`CrossBatchResolutionResult`)(
  {
    canonicalMap: S.Record(EntityId, IRI),
    newCanonicals: S.Array(IRI),
    mergedEntities: S.Array(S.suspend(() => MergedEntity)),
    stats: S.suspend(() => ResolutionStats),
  },
  $I.annote("CrossBatchResolutionResult", {
    description: "Canonical mappings, newly created identities, merges, and counts produced for one extraction batch.",
  })
) {}

/**
 * Describes the merged entity data exposed by this module.
 *
 *
 * **Example** (Create a resolved entity)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { Entity } from "@effect-ontology/Model/Entity"
 * import { EntityId } from "@effect-ontology/Model/shared"
 * import { CanonicalEntityId } from "@effect-ontology/Repository/EntityRegistry"
 * import { MergedEntity } from "@effect-ontology/Service/CrossBatchEntityResolver"
 *
 * const entityId = EntityId.make("ada")
 * const merged = MergedEntity.make({
 *   entity: Entity.make({ id: entityId, mention: "Ada", types: [IRI.make("https://schema.org/Person")] }),
 *   entityId,
 *   canonicalEntityId: CanonicalEntityId.make("00000000-0000-4000-8000-000000000001"),
 *   canonicalIri: IRI.make("https://example.org/entities/ada"),
 *   confidence: UnitInterval.make(0.9),
 *   method: "embedding_similarity"
 * })
 * console.log(merged.canonicalIri) // "https://example.org/entities/ada"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class MergedEntity extends S.Class<MergedEntity>($I`MergedEntity`)(
  {
    entity: Entity,
    entityId: EntityId,
    canonicalEntityId: UUID,
    canonicalIri: IRI,
    confidence: UnitInterval,
    method: ResolutionMethod,
  },
  $I.annote("MergedEntity", {
    description: "Extracted entity identity matched to an existing canonical IRI.",
  })
) {}

/**
 * Describes the resolution stats data exposed by this module.
 *
 *
 * **Example** (Record resolution counts)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { ResolutionStats } from "@effect-ontology/Service/CrossBatchEntityResolver"
 *
 * const stats = ResolutionStats.make({
 *   totalEntities: NonNegativeInt.make(2),
 *   matchedToExisting: NonNegativeInt.make(1),
 *   createdNew: NonNegativeInt.make(1),
 *   candidatesEvaluated: NonNegativeInt.make(4)
 * })
 * console.log(stats.createdNew) // 1
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class ResolutionStats extends S.Class<ResolutionStats>($I`ResolutionStats`)(
  {
    totalEntities: NonNegativeInt,
    matchedToExisting: NonNegativeInt,
    createdNew: NonNegativeInt,
    candidatesEvaluated: NonNegativeInt,
  },
  $I.annote("ResolutionStats", {
    description: "Non-negative counts describing one cross-batch resolution pass.",
  })
) {}

class MatchedEntity extends S.Class<MatchedEntity>($I`MatchedEntity`)(
  {
    entity: Entity,
    embedding: Embedding,
    candidate: BlockingCandidate,
    confidence: UnitInterval,
    method: ResolutionMethod,
  },
  $I.annote("MatchedEntity", {
    description: "Internal lossless match retaining the extracted entity, vector, and selected canonical candidate.",
  })
) {}

/**
 * Configuration for cross-batch entity resolution
 *
 * **Example** (Inspect cross batch resolver config)
 *
 * ```ts
 * import { CrossBatchResolverConfig } from "@effect-ontology/Service/CrossBatchEntityResolver"
 *
 * const config = CrossBatchResolverConfig.default()
 * console.log(config.maxCandidatesPerEntity) // 20
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CrossBatchResolverConfig extends S.Class<CrossBatchResolverConfig>($I`CrossBatchResolverConfig`)(
  {
    candidateThreshold: UnitInterval.pipe(
      SchemaUtils.withKeyDefaults(UnitInterval.make(0.6)),
      S.annotateKey({ description: "Minimum similarity admitted by candidate retrieval." })
    ),
    resolutionThreshold: UnitInterval.pipe(
      SchemaUtils.withKeyDefaults(UnitInterval.make(0.8)),
      S.annotateKey({ description: "Minimum similarity required to reuse a canonical entity." })
    ),
    maxCandidatesPerEntity: PosInt.pipe(
      SchemaUtils.withKeyDefaults(PosInt.make(20)),
      S.annotateKey({ description: "Positive maximum number of ANN candidates per entity." })
    ),
    maxBlockingCandidates: PosInt.pipe(
      SchemaUtils.withKeyDefaults(PosInt.make(100)),
      S.annotateKey({ description: "Positive maximum number of token-blocking candidates." })
    ),
    canonicalNamespace: IRI.pipe(
      SchemaUtils.withKeyDefaults(IRI.make("https://example.org/entities/")),
      S.annotateKey({ description: "Namespace used for newly created canonical entity IRIs." })
    ),
  },
  $I.annote("CrossBatchResolverConfig", {
    description: "Schema-defaulted candidate, resolution, and canonical-identity policy.",
  })
) {
  static readonly default = (): CrossBatchResolverConfig => CrossBatchResolverConfig.make({});
}

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
      const loadCandidates = Effect.fn("CrossBatchEntityResolver.loadCandidates")(function* (
        ontologyId: string,
        entities: ReadonlyArray<Entity>,
        embeddings: ReadonlyArray<Embedding>,
        config: CrossBatchResolverConfig = CrossBatchResolverConfig.default()
      ): Effect.fn.Return<HashMap.HashMap<string, Array<BlockingCandidate>>, CrossBatchResolutionError> {
        if (A.isReadonlyArrayEmpty(entities)) {
          return HashMap.empty<string, Array<BlockingCandidate>>();
        }

        yield* Effect.logDebug("Loading candidates for entities", {
          entityCount: entities.length,
        });

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
        embeddings: ReadonlyArray<Embedding>,
        candidateMap: HashMap.HashMap<string, Array<BlockingCandidate>>,
        config: CrossBatchResolverConfig = CrossBatchResolverConfig.default()
      ): {
        canonicalMap: Record<EntityId, IRI>;
        matchedEntities: Array<MatchedEntity>;
        unresolvedEntities: Array<{ entity: Entity; embedding: Embedding }>;
        candidatesEvaluated: number;
      } => {
        const canonicalMap: Record<EntityId, IRI> = {};
        const matchedEntities: Array<MatchedEntity> = [];
        const unresolvedEntities: Array<{ entity: Entity; embedding: Embedding }> = [];
        let candidatesEvaluated = 0;

        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          const embedding = embeddings[i];
          const candidates = HashMap.get(candidateMap, entity.id).pipe(O.getOrElse(() => []));

          candidatesEvaluated += candidates.length;

          const bestMatch = A.reduce(
            candidates,
            O.none<{ readonly candidate: BlockingCandidate; readonly similarity: UnitInterval }>(),
            (current, candidate) =>
              candidate.similarity < config.resolutionThreshold
                ? current
                : O.match(current, {
                    onNone: () => O.some({ candidate, similarity: candidate.similarity }),
                    onSome: (best) =>
                      candidate.similarity > best.similarity
                        ? O.some({ candidate, similarity: candidate.similarity })
                        : current,
                  })
          );

          O.match(bestMatch, {
            onNone: () => unresolvedEntities.push({ entity, embedding }),
            onSome: ({ candidate, similarity }) => {
              canonicalMap[entity.id] = candidate.iri;
              matchedEntities.push(
                MatchedEntity.make({
                  entity,
                  embedding,
                  candidate,
                  confidence: similarity,
                  method: "embedding_similarity",
                })
              );
            },
          });
        }

        return { canonicalMap, matchedEntities, unresolvedEntities, candidatesEvaluated };
      };

      const toMergedEntity = (match: MatchedEntity): MergedEntity =>
        MergedEntity.make({
          entity: match.entity,
          entityId: match.entity.id,
          canonicalEntityId: match.candidate.canonicalEntityId,
          canonicalIri: match.candidate.iri,
          confidence: match.confidence,
          method: match.method,
        });

      /**
       * Phase 3: Update registry with new/merged entities
       *
       * @param ontologyId - Ontology scope for entity creation
       */
      const updateRegistry = Effect.fn("CrossBatchEntityResolver.updateRegistry")(function* (
        ontologyId: string,
        batchId: string,
        resolutionResult: {
          canonicalMap: Record<EntityId, IRI>;
          matchedEntities: Array<MatchedEntity>;
          unresolvedEntities: Array<{ entity: Entity; embedding: Embedding }>;
        },
        config: CrossBatchResolverConfig = CrossBatchResolverConfig.default()
      ): Effect.fn.Return<
        {
          canonicalMap: Record<EntityId, IRI>;
          newCanonicals: Array<IRI>;
        },
        DrizzleError
      > {
        const { canonicalMap, matchedEntities, unresolvedEntities } = resolutionResult;
        let newCanonicalIris: Array<IRI> = [];

        // Update existing canonicals with merge info
        for (const match of matchedEntities) {
          yield* registry.insertAlias({
            ontologyId,
            canonicalEntityId: match.candidate.canonicalEntityId,
            mention: match.entity.mention,
            mentionNormalized: normalizeEntityMention(match.entity.mention),
            embedding: match.embedding,
            resolutionMethod: match.method,
            resolutionConfidence: String(match.confidence),
            firstBatchId: batchId,
          });
          yield* registry.touchCanonicalEntity(ontologyId, match.candidate.canonicalEntityId);
        }

        // Create new canonicals for unresolved entities
        for (const { embedding, entity } of unresolvedEntities) {
          // Generate IRI for new canonical
          const iri = IRI.make(`${config.canonicalNamespace}${entity.id}`);

          const tokens = tokenize(entity.mention);
          yield* registry.insertCanonicalEntityWithAlias(
            {
              ontologyId,
              iri,
              canonicalMention: entity.mention,
              types: A.fromIterable(entity.types),
              embedding: A.fromIterable(embedding),
              mergeCount: 1,
              confidenceAvg: "1.0",
            },
            {
              ontologyId,
              mention: entity.mention,
              mentionNormalized: normalizeEntityMention(entity.mention),
              embedding: A.fromIterable(embedding),
              resolutionMethod: "new_canonical",
              resolutionConfidence: "1.0",
              firstBatchId: batchId,
            },
            tokens
          );

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
      const resolve = Effect.fn("CrossBatchEntityResolver.resolve")(function* (
        ontologyId: string,
        entities: ReadonlyArray<Entity>,
        batchId: string,
        config: CrossBatchResolverConfig = CrossBatchResolverConfig.default()
      ): Effect.fn.Return<CrossBatchResolutionResult, CrossBatchResolutionError> {
        if (A.isReadonlyArrayEmpty(entities)) {
          return {
            canonicalMap: {},
            newCanonicals: [],
            mergedEntities: [],
            stats: {
              totalEntities: NonNegativeInt.make(0),
              matchedToExisting: NonNegativeInt.make(0),
              createdNew: NonNegativeInt.make(0),
              candidatesEvaluated: NonNegativeInt.make(0),
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
        const candidateMap = yield* loadCandidates(ontologyId, entities, embeddings, config);

        // Phase 2: Resolve against candidates
        const resolutionResult = resolveEntities(entities, embeddings, candidateMap, config);

        // Phase 3: Update registry
        const finalResult = yield* updateRegistry(
          ontologyId,
          batchId,
          {
            ...resolutionResult,
            unresolvedEntities: resolutionResult.unresolvedEntities,
          },
          config
        );

        const stats: ResolutionStats = {
          totalEntities: NonNegativeInt.make(entities.length),
          matchedToExisting: NonNegativeInt.make(resolutionResult.matchedEntities.length),
          createdNew: NonNegativeInt.make(finalResult.newCanonicals.length),
          candidatesEvaluated: NonNegativeInt.make(resolutionResult.candidatesEvaluated),
        };

        yield* Effect.logInfo("Cross-batch entity resolution complete", {
          ...stats,
          batchId,
        });

        return {
          canonicalMap: finalResult.canonicalMap,
          newCanonicals: finalResult.newCanonicals,
          mergedEntities: A.map(resolutionResult.matchedEntities, toMergedEntity),
          stats,
        };
      });

      /**
       * Check if entity registry is empty
       */
      const isEmpty = Effect.fn("CrossBatchEntityResolver.isEmpty")(function* (ontologyId: string) {
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
