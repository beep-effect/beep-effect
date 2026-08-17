/**
 * Entity Resolution using Effect Graph
 *
 * **Details**
 *
 * Graph-based entity clustering using Effect's Graph module.
 * Uses connected components algorithm for transitive clustering.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { IRI } from "@beep/rdf";
import { NodeIndex } from "@beep/schema/Graph";
import { NonNegativeInt } from "@beep/schema/Int";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { DateTime, Effect, Graph, HashMap, HashSet, MutableHashMap, MutableHashSet, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import type { Entity, KnowledgeGraph, Relation } from "../Domain/Model/Entity.ts";
import { RelationObject } from "../Domain/Model/Entity.ts";
import type { EntityResolutionConfig, EREdge, ERNode } from "../Domain/Model/EntityResolution.ts";
import { MentionRecord, RelationEdge, ResolutionEdge, ResolvedEntity } from "../Domain/Model/EntityResolution.ts";
import type {
  ClusteringResult,
  EntityCluster,
  EntityResolutionGraph,
  EntityResolutionInfo,
} from "../Domain/Model/EntityResolutionGraph.ts";
import {
  ClusteringResult as ClusteringResultModel,
  EntityCluster as EntityClusterModel,
  EntityResolutionGraph as EntityResolutionGraphModel,
  EntityResolutionStats,
  SimilarityEdge,
} from "../Domain/Model/EntityResolutionGraph.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import { EmbeddingService } from "../Service/Embedding.ts";
import { dual2, dual3 } from "../Utils/Dual.ts";
import { computeEntitySimilarity, detectResolutionMethod, shouldConsiderMerge } from "../Utils/Similarity.ts";
import { simpleTokenize } from "../Utils/String.ts";

// =============================================================================
// Graph-Based Clustering
// =============================================================================

/**
 * Cluster entities using Effect Graph's connectedComponents
 *
 * **Details**
 *
 * Algorithm:
 * 1. Generate embeddings for all entities (batch with concurrency limit)
 * 2. Build undirected similarity graph (entities as nodes)
 * 3. Add edge between entities with similarity ≥ threshold (using embeddings if available)
 * 4. Call Graph.connectedComponents() to find clusters
 * 5. Each component = one resolved entity cluster
 *
 * **Example** (Use clusterEntities)
 *
 * ```ts
 * import { EntityResolutionConfig } from "@effect-ontology/Model/EntityResolution"
 * import { clusterEntities } from "@effect-ontology/Workflow/EntityResolutionGraph"
 * import * as Effect from "effect/Effect"
 *
 * const clusters = clusterEntities([], [], EntityResolutionConfig.default())
 * console.log(Effect.isEffect(clusters)) // true
 * ```
 *
 * @param entities - Entities to cluster
 * @param relations - Relations for neighbor similarity
 * @param config - Resolution configuration
 * @returns Effect yielding array of entity clusters
 * @category workflows
 * @since 0.0.0
 */
export const clusterEntities = dual3(
  (
    entities: ReadonlyArray<Entity>,
    relations: ReadonlyArray<Relation>,
    config: EntityResolutionConfig
  ): Effect.Effect<ClusteringResult, never, EmbeddingService> =>
    Effect.gen(function* () {
      const embeddingService = yield* EmbeddingService;

      // Handle edge cases
      if (entities.length === 0) {
        return ClusteringResultModel.make({ embeddingMap: HashMap.empty() });
      }

      if (entities.length === 1) {
        return ClusteringResultModel.make({
          clusters: [
            EntityClusterModel.make({
              entities: [entities[0]],
              minSimilarity: UnitInterval.make(1),
              methods: ["exact"],
            }),
          ],
          embeddingMap: HashMap.empty(),
        });
      }

      // Generate embeddings for all entities (batch with concurrency limit)
      // Only generate if embeddingWeight > 0 (optimization)
      const embeddingMap = MutableHashMap.empty<string, ReadonlyArray<number>>();

      if (config.embeddingWeight > 0) {
        const entityEmbeddings = yield* Effect.all(
          entities.map((entity) =>
            embeddingService.embed(entity.mention, "clustering").pipe(
              Effect.map((embedding) => ({ entityId: entity.id, embedding })),
              Effect.orElseSucceed(() => null) // Gracefully handle embedding failures
            )
          ),
          { concurrency: 5 }
        );

        // Store valid embeddings in MutableHashMap for O(1) lookup
        for (const item of entityEmbeddings) {
          if (P.isNotNull(item)) {
            MutableHashMap.set(embeddingMap, item.entityId, item.embedding);
          }
        }
      }

      // Step 2: Compute edges asynchronously (non-blocking)
      // We compute all valid edges first, then build the graph cheaply.

      // Blocking Strategy Setup
      const invertedIndex = MutableHashMap.empty<string, Array<number>>();
      const USE_BLOCKING_THRESHOLD = 50;
      const MAX_BLOCK_SIZE = 50;
      const STOP_WORDS = HashSet.make(
        "the",
        "and",
        "of",
        "in",
        "on",
        "at",
        "for",
        "to",
        "a",
        "an",
        "inc",
        "incorporated",
        "corp",
        "corporation",
        "llc",
        "ltd",
        "limited",
        "co",
        "company",
        "group",
        "association",
        "department",
        "university",
        "school",
        "college",
        "institute"
      );

      // Build Inverted Index if dataset is large enough
      if (entities.length >= USE_BLOCKING_THRESHOLD) {
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          const tokens = simpleTokenize(entity.mention.toLowerCase())
            .map((t) => t.replace(/[^\w]/g, ""))
            .filter((t) => t.length > 2 && !HashSet.has(STOP_WORDS, t));

          for (const token of HashSet.fromIterable(tokens)) {
            const indexes = O.getOrElse(MutableHashMap.get(invertedIndex, token), () => {
              const created: Array<number> = [];
              MutableHashMap.set(invertedIndex, token, created);
              return created;
            });
            indexes.push(i);
          }
        }
      }

      // Helper to generate candidate pairs for an entity index
      const getCandidates = (i: number): MutableHashSet.MutableHashSet<number> => {
        const candidates = MutableHashSet.empty<number>();
        if (entities.length < USE_BLOCKING_THRESHOLD) {
          // Small dataset: Compare with ALL subsequent entities
          for (let j = i + 1; j < entities.length; j++) {
            MutableHashSet.add(candidates, j);
          }
        } else {
          // Large dataset: Use blocking
          const entityA = entities[i];
          const tokens = simpleTokenize(entityA.mention.toLowerCase())
            .map((t) => t.replace(/[^\w]/g, ""))
            .filter((t) => t.length > 2 && !HashSet.has(STOP_WORDS, t));

          if (tokens.length > 0) {
            for (const token of tokens) {
              const matches = MutableHashMap.get(invertedIndex, token);
              if (O.isSome(matches) && matches.value.length <= MAX_BLOCK_SIZE) {
                for (const matchIdx of matches.value) {
                  if (matchIdx > i) MutableHashSet.add(candidates, matchIdx);
                }
              }
            }
          }
        }
        return candidates;
      };

      // Compute edges using a Stream to allow yielding/concurrency
      const edgeData: Array<{
        source: EntityId;
        target: EntityId;
        edge: SimilarityEdge;
      }> = [];

      // We process entities in chunks to avoid blocking the event loop
      // Using Effect.forEach with concurrency allows other fibers to run
      yield* Effect.forEach(
        entities.map((_, i) => i),
        (i) =>
          Effect.sync(() => {
            const entityA = entities[i];
            const candidates = getCandidates(i);

            for (const j of candidates) {
              const entityB = entities[j];

              // Compute embedding similarity if available
              const embeddingSim =
                MutableHashMap.has(embeddingMap, entityA.id) && MutableHashMap.has(embeddingMap, entityB.id)
                  ? embeddingService.cosineSimilarity(
                      O.getOrThrow(MutableHashMap.get(embeddingMap, entityA.id)),
                      O.getOrThrow(MutableHashMap.get(embeddingMap, entityB.id))
                    )
                  : undefined;

              // Check merge condition - pure sync computation
              if (shouldConsiderMerge(entityA, entityB, relations, config, embeddingSim, undefined)) {
                const similarity = computeEntitySimilarity(
                  entityA,
                  entityB,
                  relations,
                  config,
                  embeddingSim,
                  undefined
                );
                const method = detectResolutionMethod(entityA, entityB, relations);

                edgeData.push({
                  source: entityA.id,
                  target: entityB.id,
                  edge: SimilarityEdge.make({
                    similarity: UnitInterval.make(similarity),
                    method,
                  }),
                });
              }
            }
          }),
        { concurrency: 50 } // Bounded to prevent OOM with large entity sets
      );

      // Step 3: Build Graph synchronously (cheap now that edges are pre-computed)
      const entityToIndex = MutableHashMap.empty<string, Graph.NodeIndex>();

      const similarityGraph = Graph.undirected<Entity, SimilarityEdge>((mutable) => {
        // Add all entities as nodes
        for (const entity of entities) {
          const idx = Graph.addNode(mutable, entity);
          MutableHashMap.set(entityToIndex, entity.id, idx);
        }

        // Add pre-computed edges
        for (const { edge, source, target } of edgeData) {
          const idxA = MutableHashMap.get(entityToIndex, source);
          const idxB = MutableHashMap.get(entityToIndex, target);
          if (O.isSome(idxA) && O.isSome(idxB)) {
            Graph.addEdge(mutable, idxA.value, idxB.value, edge);
          }
        }
      });

      // Use built-in connected components algorithm
      const components = Graph.connectedComponents(similarityGraph);

      // Map NodeIndex clusters back to EntityCluster
      const clusters = components.map((component) => {
        const clusterEntities = component.map((nodeIdx) => O.getOrThrow(Graph.getNode(similarityGraph, nodeIdx)));

        // Find minimum similarity and methods within this cluster
        const clusterEntityIds = HashSet.fromIterable(clusterEntities.map((e) => e.id));
        const clusterEdges = edgeData.filter(
          (ed) => HashSet.has(clusterEntityIds, ed.source) && HashSet.has(clusterEntityIds, ed.target)
        );

        const minSimilarity = UnitInterval.make(
          clusterEdges.length > 0 ? Math.min(...clusterEdges.map((ed) => ed.edge.similarity)) : 1
        );

        const methods = A.fromIterable(HashSet.fromIterable(clusterEdges.map((ed) => ed.edge.method)));
        const firstClusterEntity = O.getOrThrow(A.head(clusterEntities));

        return EntityClusterModel.make({
          entities: [firstClusterEntity, ...A.drop(clusterEntities, 1)],
          minSimilarity,
          methods: methods.length > 0 ? [methods[0], ...methods.slice(1)] : ["exact"],
        });
      });

      const embeddingEntries: Array<readonly [EntityId, readonly [number, ...Array<number>]]> = [];
      for (const [entityId, embedding] of embeddingMap) {
        const first = embedding[0];
        if (P.isNotUndefined(first)) {
          embeddingEntries.push([EntityId.make(entityId), [first, ...embedding.slice(1)]]);
        }
      }

      return ClusteringResultModel.make({
        clusters,
        embeddingMap: HashMap.fromIterable(embeddingEntries),
      });
    })
);

// =============================================================================
// Entity Resolution Graph
// =============================================================================

/**
 * Merge a cluster of entities into a ResolvedEntity
 *
 * @internal
 */
const mergeClusterToResolved = (cluster: EntityCluster): ResolvedEntity => {
  const entities = cluster.entities;

  // Select canonical entity (prefer longest mention - usually most complete)
  const sorted = A.sort(
    entities,
    Order.mapInput(Order.flip(Order.Number), (entity: Entity) => entity.mention.length)
  );
  const canonical = sorted[0];

  // Merge types using frequency voting
  const typeFreq = MutableHashMap.empty<IRI, number>();
  for (const entity of entities) {
    for (const type of entity.types) {
      MutableHashMap.set(typeFreq, type, O.getOrElse(MutableHashMap.get(typeFreq, type), () => 0) + 1);
    }
  }

  // Select types appearing in at least half the entities (or all if single entity)
  const threshold = Math.max(1, Math.ceil(entities.length / 2));
  const mergedTypes = A.fromIterable(typeFreq)
    .filter(([_, count]) => count >= threshold)
    .map(([type]) => type);

  const finalTypes: ResolvedEntity["types"] =
    mergedTypes.length > 0 ? [canonical.types[0], ...mergedTypes] : canonical.types;

  // Merge attributes (prefer values from longer mentions)
  const mergedAttrs: Record<string, string | number | boolean> = {};
  for (const entity of sorted) {
    for (const [key, value] of R.toEntries(entity.attributes)) {
      if (!(key in mergedAttrs)) {
        mergedAttrs[key] = value;
      }
    }
  }

  return ResolvedEntity.make({
    canonicalId: canonical.id,
    mention: canonical.mention,
    types: finalTypes,
    attributes: mergedAttrs,
  });
};

/**
 * Build Entity Resolution Graph from KnowledgeGraph
 *
 * **Details**
 *
 * Pipeline: KnowledgeGraph → MentionRecords → Clustering → ResolvedEntities → ERG
 *
 * **Example** (Use buildEntityResolutionGraph)
 *
 * ```ts
 * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
 * import { EntityResolutionConfig } from "@effect-ontology/Model/EntityResolution"
 * import { buildEntityResolutionGraph } from "@effect-ontology/Workflow/EntityResolutionGraph"
 * import * as Effect from "effect/Effect"
 *
 * const resolution = buildEntityResolutionGraph(KnowledgeGraph.make({}), EntityResolutionConfig.default())
 * console.log(Effect.isEffect(resolution)) // true
 * ```
 *
 * @param kg - Input knowledge graph
 * @param config - Resolution configuration
 * @returns Effect yielding EntityResolutionGraph
 * @category factories
 * @since 0.0.0
 */
export const buildEntityResolutionGraph = dual2(
  Effect.fn("EntityResolutionGraph.build")(function* (
    kg: KnowledgeGraph,
    config: EntityResolutionConfig
  ): Effect.fn.Return<EntityResolutionGraph, never, EmbeddingService> {
    const embeddingService = yield* EmbeddingService;
    // Phase 1: Create MentionRecord nodes from entities (preserve provenance)
    const mentionRecords = kg.entities.map((e, idx) =>
      MentionRecord.make({
        id: e.id,
        mention: e.mention,
        types: e.types,
        attributes: { ...e.attributes },
        chunkIndex: O.getOrElse(e.chunkIndex, () => NonNegativeInt.make(idx)),
      })
    );

    // Build entity lookup for similarity computation
    const entityById = MutableHashMap.empty<string, Entity>();
    for (const e of kg.entities) {
      MutableHashMap.set(entityById, e.id, e);
    }

    // Phase 2: Cluster similar entities using graph-based algorithm
    const clusteringResult = yield* clusterEntities(kg.entities, kg.relations, config);
    const clusters = clusteringResult.clusters;
    const embeddingMap = clusteringResult.embeddingMap;

    // Phase 3: Create ResolvedEntity for each cluster
    const resolvedEntities = clusters.map((cluster) => mergeClusterToResolved(cluster));

    // Phase 4: Build canonical ID mapping and compute per-entity resolution info
    const canonicalMap: Record<string, EntityId> = {};
    const resolutionInfoMap = MutableHashMap.empty<string, EntityResolutionInfo>();

    clusters.forEach((cluster, clusterIdx) => {
      const resolvedEntity = resolvedEntities[clusterIdx];
      const canonicalId = resolvedEntity.canonicalId;
      const canonicalEntity = MutableHashMap.get(entityById, canonicalId);

      for (const entity of cluster.entities) {
        canonicalMap[entity.id] = canonicalId;

        // Compute actual similarity and method for this entity to canonical
        if (entity.id === canonicalId) {
          // Entity IS the canonical - perfect match
          MutableHashMap.set(resolutionInfoMap, entity.id, {
            entityId: entity.id,
            similarity: UnitInterval.make(1.0),
            method: "exact",
          });
        } else if (O.isSome(canonicalEntity)) {
          // Compute embedding similarity if available
          const embeddingSim =
            HashMap.has(embeddingMap, entity.id) && HashMap.has(embeddingMap, canonicalId)
              ? embeddingService.cosineSimilarity(
                  O.getOrThrow(HashMap.get(embeddingMap, entity.id)),
                  O.getOrThrow(HashMap.get(embeddingMap, canonicalId))
                )
              : undefined;

          // Compute similarity between this entity and canonical (with embedding)
          const similarity = computeEntitySimilarity(
            entity,
            canonicalEntity.value,
            kg.relations,
            config,
            embeddingSim,
            undefined
          );
          const method = detectResolutionMethod(entity, canonicalEntity.value, kg.relations);

          MutableHashMap.set(resolutionInfoMap, entity.id, {
            entityId: entity.id,
            similarity: UnitInterval.make(similarity),
            method,
          });
        }
      }
    });

    // Phase 5: Build Effect Graph (two-tier: MentionRecords → ResolvedEntities)
    const entityIndex: Record<string, NodeIndex> = {};
    const resolvedIndexes = MutableHashMap.empty<string, Graph.NodeIndex>();

    const graph = Graph.directed<ERNode, EREdge>((mutable) => {
      // Add ResolvedEntity nodes first
      for (const re of resolvedEntities) {
        const idx = Graph.addNode(mutable, re);
        MutableHashMap.set(resolvedIndexes, re.canonicalId, idx);
      }

      // Add MentionRecord nodes + ResolutionEdges with REAL similarity scores
      for (const mr of mentionRecords) {
        const mrIdx = Graph.addNode(mutable, mr);
        entityIndex[mr.id] = NodeIndex.make(mrIdx);

        const canonicalId = canonicalMap[mr.id];
        if (P.isTruthy(canonicalId)) {
          const reIdx = MutableHashMap.get(resolvedIndexes, canonicalId);
          const resolutionInfo = MutableHashMap.get(resolutionInfoMap, mr.id);

          if (O.isSome(reIdx) && O.isSome(resolutionInfo)) {
            Graph.addEdge(
              mutable,
              mrIdx,
              reIdx.value,
              ResolutionEdge.make({
                confidence: resolutionInfo.value.similarity,
                method: resolutionInfo.value.method,
              })
            );
          }
        }
      }

      // Add RelationEdges between ResolvedEntities (canonicalized)
      for (const rel of kg.relations) {
        const sourceCanonical = canonicalMap[rel.subjectId];
        const targetCanonical = RelationObject.guards.EntityReference(rel.object)
          ? canonicalMap[rel.object.value]
          : undefined;

        if (P.isTruthy(sourceCanonical) && P.isNotUndefined(targetCanonical)) {
          const sourceIdx = MutableHashMap.get(resolvedIndexes, sourceCanonical);
          const targetIdx = MutableHashMap.get(resolvedIndexes, targetCanonical);

          if (O.isSome(sourceIdx) && O.isSome(targetIdx)) {
            Graph.addEdge(
              mutable,
              sourceIdx.value,
              targetIdx.value,
              RelationEdge.make({
                predicate: rel.predicate,
                grounded: false, // TODO: integrate with Grounder
              })
            );
          }
        }
      }
    });

    const createdAt = yield* DateTime.now;
    return EntityResolutionGraphModel.make({
      graph,
      entityIndex,
      canonicalMap,
      createdAt,
      stats: EntityResolutionStats.make({
        mentionCount: NonNegativeInt.make(mentionRecords.length),
        resolvedCount: NonNegativeInt.make(resolvedEntities.length),
        relationCount: NonNegativeInt.make(kg.relations.length),
        clusterCount: NonNegativeInt.make(clusters.length),
      }),
    });
  })
);
