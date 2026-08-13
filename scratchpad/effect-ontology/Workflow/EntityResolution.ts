/**
 * Workflow: Entity Resolution
 *
 * Post-extraction entity resolution to merge duplicate/coreference entities.
 * Handles cases like "Eze" and "Eberechi Eze" being the same person.
 *
 * @since 2.0.0
 * @module Workflow/EntityResolution
 */

import { Effect } from "effect";
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import { Entity, KnowledgeGraph, Relation, RelationObject } from "../Domain/Model/Entity.ts";
import type { IRI } from "../Domain/Model/shared.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import { dual2 } from "../Utils/Dual.ts";
import { combinedSimilarity, overlapRatio } from "../Utils/String.ts";

/**
 * Configuration for entity resolution
 */
export interface EntityResolutionConfig {
  /**
   * Minimum string similarity threshold for mention matching (0.0 to 1.0)
   * Higher values require more similar mentions to be considered matches
   *
   * @default 0.7
   */
  readonly mentionSimilarityThreshold: number;

  /**
   * Whether to require type overlap for entity merging
   *
   * @default true
   */
  readonly requireTypeOverlap: boolean;

  /**
   * Minimum ratio of type overlap (0.0 to 1.0)
   * Only used if requireTypeOverlap is true
   *
   * @default 0.5
   */
  readonly typeOverlapRatio: number;
}

export const DEFAULT_CONFIG: EntityResolutionConfig = {
  mentionSimilarityThreshold: 0.7,
  requireTypeOverlap: true,
  typeOverlapRatio: 0.5,
};

/**
 * Check if two entities should be merged based on similarity criteria
 *
 * @internal
 */
const shouldMerge = (entityA: Entity, entityB: Entity, config: EntityResolutionConfig): boolean => {
  // Calculate mention similarity using combined approach
  const similarity = combinedSimilarity(entityA.mention, entityB.mention);

  if (similarity < config.mentionSimilarityThreshold) return false;

  // Check type overlap if required
  if (config.requireTypeOverlap) {
    const overlap = overlapRatio(entityA.types, entityB.types);
    if (overlap < config.typeOverlapRatio) return false;
  }

  return true;
};

/**
 * Find clusters of entities that should be merged using union-find
 *
 * @internal
 */
const findEntityClusters = (
  entities: ReadonlyArray<Entity>,
  config: EntityResolutionConfig
): MutableHashMap.MutableHashMap<string, Array<string>> => {
  const parent = MutableHashMap.empty<string, string>();

  const find = (id: string): string => {
    const current = O.getOrElse(MutableHashMap.get(parent, id), () => {
      MutableHashMap.set(parent, id, id);
      return id;
    });
    if (current === id) return id;
    const root = find(current);
    MutableHashMap.set(parent, id, root);
    return root;
  };

  const union = (idA: string, idB: string): void => {
    const rootA = find(idA);
    const rootB = find(idB);
    if (rootA !== rootB) {
      // Prefer shorter ID as root (usually more canonical)
      MutableHashMap.set(
        parent,
        rootA.length <= rootB.length ? rootB : rootA,
        rootA.length <= rootB.length ? rootA : rootB
      );
    }
  };

  // Compare all pairs of entities
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      if (shouldMerge(entities[i], entities[j], config)) {
        union(entities[i].id, entities[j].id);
      }
    }
  }

  // Build clusters
  const clusters = MutableHashMap.empty<string, Array<string>>();
  for (const entity of entities) {
    const root = find(entity.id);
    const cluster = O.getOrElse(MutableHashMap.get(clusters, root), () => {
      const created: Array<string> = [];
      MutableHashMap.set(clusters, root, created);
      return created;
    });
    cluster.push(entity.id);
  }

  return clusters;
};

/**
 * Merge a cluster of entities into a single canonical entity
 *
 * @internal
 */
const mergeEntityCluster = (
  clusterIds: ReadonlyArray<string>,
  entityMap: MutableHashMap.MutableHashMap<string, Entity>
): O.Option<Entity> => {
  const entities = A.getSomes(A.map(clusterIds, (id) => MutableHashMap.get(entityMap, id)));

  if (entities.length === 0) return O.none();
  if (entities.length === 1) return O.some(entities[0]);

  // Select canonical entity (prefer longest mention - usually most complete)
  const sorted = [...entities].sort((a, b) => b.mention.length - a.mention.length);
  const canonical = sorted[0];

  // Merge types using frequency voting
  const typeFreq = MutableHashMap.empty<IRI, number>();
  for (const entity of entities) {
    for (const type of entity.types) {
      MutableHashMap.set(typeFreq, type, O.getOrElse(MutableHashMap.get(typeFreq, type), () => 0) + 1);
    }
  }

  // Select types appearing in at least half the entities
  const threshold = Math.ceil(entities.length / 2);
  const mergedTypes = A.fromIterable(typeFreq)
    .filter(([_, count]) => count >= threshold)
    .map(([type]) => type);

  const finalTypes: Entity["types"] = mergedTypes.length > 0 ? [canonical.types[0], ...mergedTypes] : canonical.types;

  // Merge attributes (prefer values from longer mentions)
  const mergedAttrs: Record<string, string | number | boolean> = {};
  for (const entity of sorted) {
    for (const [key, value] of Object.entries(entity.attributes)) {
      if (!(key in mergedAttrs)) mergedAttrs[key] = value;
    }
  }

  return O.some(
    Entity.make({
      id: canonical.id,
      mention: canonical.mention,
      types: finalTypes,
      attributes: mergedAttrs,
    })
  );
};

/**
 * Resolve entity coreferences in a knowledge graph
 *
 * Identifies and merges duplicate entities based on mention similarity
 * and type compatibility. Updates relations to point to canonical entities.
 *
 * @param graph - Input knowledge graph
 * @param config - Resolution configuration (optional)
 * @returns Effect yielding resolved knowledge graph
 *
 * @example
 * ```typescript
 * const resolved = yield* resolveEntities(graph, {
 *   mentionSimilarityThreshold: 0.7,
 *   requireTypeOverlap: true
 * })
 * ```
 *
 * @since 2.0.0
 * @category Workflows
 */
export const resolveEntities = dual2(
  (graph: KnowledgeGraph, config: Partial<EntityResolutionConfig>): Effect.Effect<KnowledgeGraph, never, never> =>
    Effect.gen(function* () {
      const cfg: EntityResolutionConfig = { ...DEFAULT_CONFIG, ...config };

      yield* Effect.logInfo("Starting entity resolution", {
        stage: "entity-resolution",
        entityCount: graph.entities.length,
        relationCount: graph.relations.length,
      });

      // Build entity map
      const entityMap = MutableHashMap.empty<string, Entity>();
      for (const entity of graph.entities) MutableHashMap.set(entityMap, entity.id, entity);

      // Find entity clusters
      const clusters = findEntityClusters(graph.entities, cfg);

      yield* Effect.logDebug("Entity clusters found", {
        stage: "entity-resolution",
        clusterCount: MutableHashMap.size(clusters),
        clusters: A.fromIterable(clusters).map(([root, ids]) => ({
          canonical: root,
          members: ids,
        })),
      });

      // Merge clusters
      const mergedEntities: Array<Entity> = [];
      const idMapping = MutableHashMap.empty<string, string>();

      for (const [_canonicalId, clusterIds] of clusters) {
        const mergedOpt = mergeEntityCluster(clusterIds, entityMap);
        if (O.isSome(mergedOpt)) {
          mergedEntities.push(mergedOpt.value);
          for (const oldId of clusterIds) MutableHashMap.set(idMapping, oldId, mergedOpt.value.id);
        }
      }

      // Update relations to use canonical entity IDs
      const updatedRelations: Array<Relation> = [];
      for (const relation of graph.relations) {
        const newSubjectId = EntityId.make(
          O.getOrElse(MutableHashMap.get(idMapping, relation.subjectId), () => relation.subjectId)
        );
        const newObject = RelationObject.guards.EntityReference(relation.object)
          ? (() => {
              const objectId = relation.object.value;
              return RelationObject.cases.EntityReference.make({
                value: EntityId.make(O.getOrElse(MutableHashMap.get(idMapping, objectId), () => objectId)),
              });
            })()
          : relation.object;

        // Skip self-referential relations created by merging
        if (RelationObject.guards.EntityReference(newObject) && newSubjectId === newObject.value) continue;

        updatedRelations.push(
          Relation.make({
            subjectId: newSubjectId,
            predicate: relation.predicate,
            object: newObject,
          })
        );
      }

      // Deduplicate relations
      const relationSet = MutableHashSet.empty<string>();
      const deduped: Array<Relation> = [];
      for (const rel of updatedRelations) {
        const key = `${rel.subjectId}|${rel.predicate}|${rel.object._tag}:${rel.object.value}`;
        if (!MutableHashSet.has(relationSet, key)) {
          MutableHashSet.add(relationSet, key);
          deduped.push(rel);
        }
      }

      yield* Effect.logInfo("Entity resolution complete", {
        stage: "entity-resolution",
        originalEntities: graph.entities.length,
        mergedEntities: mergedEntities.length,
        originalRelations: graph.relations.length,
        updatedRelations: deduped.length,
      });

      return KnowledgeGraph.make({
        entities: mergedEntities,
        relations: deduped,
      });
    })
);
