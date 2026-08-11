/**
 * Workflow: Entity Resolution
 *
 * Post-extraction entity resolution to merge duplicate/coreference entities.
 * Handles cases like "Eze" and "Eberechi Eze" being the same person.
 *
 * @since 2.0.0
 * @module Workflow/EntityResolution
 */

import { Effect, Option } from "effect"
import { Entity, KnowledgeGraph, Relation } from "../Domain/Model/Entity.ts"
import { combinedSimilarity, overlapRatio } from "../Utils/String.ts"

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
  readonly mentionSimilarityThreshold: number

  /**
   * Whether to require type overlap for entity merging
   *
   * @default true
   */
  readonly requireTypeOverlap: boolean

  /**
   * Minimum ratio of type overlap (0.0 to 1.0)
   * Only used if requireTypeOverlap is true
   *
   * @default 0.5
   */
  readonly typeOverlapRatio: number
}

export const DEFAULT_CONFIG: EntityResolutionConfig = {
  mentionSimilarityThreshold: 0.7,
  requireTypeOverlap: true,
  typeOverlapRatio: 0.5
}

/**
 * Check if two entities should be merged based on similarity criteria
 *
 * @internal
 */
const shouldMerge = (
  entityA: Entity,
  entityB: Entity,
  config: EntityResolutionConfig
): boolean => {
  // Calculate mention similarity using combined approach
  const similarity = combinedSimilarity(entityA.mention, entityB.mention)

  if (similarity < config.mentionSimilarityThreshold) return false

  // Check type overlap if required
  if (config.requireTypeOverlap) {
    const overlap = overlapRatio(entityA.types, entityB.types)
    if (overlap < config.typeOverlapRatio) return false
  }

  return true
}

/**
 * Find clusters of entities that should be merged using union-find
 *
 * @internal
 */
const findEntityClusters = (
  entities: ReadonlyArray<Entity>,
  config: EntityResolutionConfig
): Map<string, Array<string>> => {
  const parent = new Map<string, string>()

  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id)
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!))
    return parent.get(id)!
  }

  const union = (idA: string, idB: string): void => {
    const rootA = find(idA)
    const rootB = find(idB)
    if (rootA !== rootB) {
      // Prefer shorter ID as root (usually more canonical)
      parent.set(rootA.length <= rootB.length ? rootB : rootA, rootA.length <= rootB.length ? rootA : rootB)
    }
  }

  // Compare all pairs of entities
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      if (shouldMerge(entities[i], entities[j], config)) {
        union(entities[i].id, entities[j].id)
      }
    }
  }

  // Build clusters
  const clusters = new Map<string, Array<string>>()
  for (const entity of entities) {
    const root = find(entity.id)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root)!.push(entity.id)
  }

  return clusters
}

/**
 * Merge a cluster of entities into a single canonical entity
 *
 * @internal
 */
const mergeEntityCluster = (
  clusterIds: ReadonlyArray<string>,
  entityMap: Map<string, Entity>
): Option.Option<Entity> => {
  const entities = clusterIds.map((id) => entityMap.get(id)!).filter(Boolean)

  if (entities.length === 0) return Option.none()
  if (entities.length === 1) return Option.some(entities[0])

  // Select canonical entity (prefer longest mention - usually most complete)
  const sorted = [...entities].sort((a, b) => b.mention.length - a.mention.length)
  const canonical = sorted[0]

  // Merge types using frequency voting
  const typeFreq = new Map<string, number>()
  for (const entity of entities) {
    for (const type of entity.types) {
      typeFreq.set(type, (typeFreq.get(type) || 0) + 1)
    }
  }

  // Select types appearing in at least half the entities
  const threshold = Math.ceil(entities.length / 2)
  const mergedTypes = Array.from(typeFreq.entries())
    .filter(([_, count]) => count >= threshold)
    .map(([type]) => type)

  const finalTypes = mergedTypes.length > 0 ? mergedTypes : canonical.types

  // Merge attributes (prefer values from longer mentions)
  const mergedAttrs: Record<string, string | number | boolean> = {}
  for (const entity of sorted) {
    for (const [key, value] of Object.entries(entity.attributes)) {
      if (!(key in mergedAttrs)) mergedAttrs[key] = value
    }
  }

  return Option.some(
    Entity.make({
      id: canonical.id,
      mention: canonical.mention,
      types: finalTypes as Array<string>,
      attributes: mergedAttrs
    })
  )
}

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
export const resolveEntities = (
  graph: KnowledgeGraph,
  config: Partial<EntityResolutionConfig> = {}
): Effect.Effect<KnowledgeGraph, never, never> =>
  Effect.gen(function*() {
    const cfg: EntityResolutionConfig = { ...DEFAULT_CONFIG, ...config }

    yield* Effect.logInfo("Starting entity resolution", {
      stage: "entity-resolution",
      entityCount: graph.entities.length,
      relationCount: graph.relations.length
    })

    // Build entity map
    const entityMap = new Map<string, Entity>()
    for (const entity of graph.entities) entityMap.set(entity.id, entity)

    // Find entity clusters
    const clusters = findEntityClusters(graph.entities, cfg)

    yield* Effect.logDebug("Entity clusters found", {
      stage: "entity-resolution",
      clusterCount: clusters.size,
      clusters: Array.from(clusters.entries()).map(([root, ids]) => ({
        canonical: root,
        members: ids
      }))
    })

    // Merge clusters
    const mergedEntities: Array<Entity> = []
    const idMapping = new Map<string, string>()

    for (const [_canonicalId, clusterIds] of clusters) {
      const mergedOpt = mergeEntityCluster(clusterIds, entityMap)
      if (Option.isSome(mergedOpt)) {
        mergedEntities.push(mergedOpt.value)
        for (const oldId of clusterIds) idMapping.set(oldId, mergedOpt.value.id)
      }
    }

    // Update relations to use canonical entity IDs
    const updatedRelations: Array<Relation> = []
    for (const relation of graph.relations) {
      const newSubjectId = idMapping.get(relation.subjectId) || relation.subjectId
      let newObject = relation.object
      if (typeof relation.object === "string" && idMapping.has(relation.object)) {
        newObject = idMapping.get(relation.object)!
      }

      // Skip self-referential relations created by merging
      if (newSubjectId === newObject) continue

      updatedRelations.push(
        Relation.make({
          subjectId: newSubjectId,
          predicate: relation.predicate,
          object: newObject
        })
      )
    }

    // Deduplicate relations
    const relationSet = new Set<string>()
    const deduped: Array<Relation> = []
    for (const rel of updatedRelations) {
      const key = `${rel.subjectId}|${rel.predicate}|${String(rel.object)}`
      if (!relationSet.has(key)) {
        relationSet.add(key)
        deduped.push(rel)
      }
    }

    yield* Effect.logInfo("Entity resolution complete", {
      stage: "entity-resolution",
      originalEntities: graph.entities.length,
      mergedEntities: mergedEntities.length,
      originalRelations: graph.relations.length,
      updatedRelations: deduped.length
    })

    return KnowledgeGraph.make({
      entities: mergedEntities,
      relations: deduped
    })
  })
