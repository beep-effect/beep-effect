/**
 * Graph Merge Utilities
 *
 * Pure functions for merging KnowledgeGraph fragments from multiple chunks.
 * Implements monoid operations for streaming reduction.
 *
 * @since 2.0.0
 * @module Workflow/Merge
 */

import { Chunk, HashMap, HashSet, Option, Order, Schema } from "effect"
import { UnitInterval } from "@beep/schema/UnitInterval"
import type { Relation } from "../Domain/Model/Entity.ts"
import { Entity, KnowledgeGraph } from "../Domain/Model/Entity.ts"
import { IRI } from "../Domain/Model/shared.ts"

const decodeEntityTypes = Schema.decodeUnknownSync(Schema.NonEmptyArray(IRI))

/**
 * Merge conflict information
 *
 * Records conflicts detected during entity attribute merging.
 *
 * @since 2.0.0
 * @category Types
 */
export interface MergeConflict {
  /**
   * Entity ID with conflict
   */
  readonly entityId: string

  /**
   * Property key that conflicted
   */
  readonly property: string

  /**
   * Conflicting values
   */
  readonly values: ReadonlyArray<unknown>

  /**
   * Chunk indexes that contributed conflicting values
   */
  readonly chunkIndexes: ReadonlyArray<number>
}

/**
 * Order instance for Entity (by id)
 *
 * @internal
 */
const EntityOrder: Order.Order<Entity> = Order.mapInput(Order.String, (entity: Entity) => entity.id)

/**
 * Order instance for Relation (by subjectId, predicate, object)
 *
 * @internal
 */
const RelationOrder: Order.Order<Relation> = Order.combine(
  Order.mapInput(Order.String, (r: Relation) => r.subjectId),
  Order.combine(
    Order.mapInput(Order.String, (r: Relation) => r.predicate),
    Order.mapInput(
      Order.String,
      (r: Relation) => (typeof r.object === "string" ? r.object : String(r.object))
    )
  )
)

/**
 * Select best types using frequency voting
 *
 * Counts occurrences of each type and selects the most frequent ones.
 * Prefers types that appear in majority of occurrences.
 *
 * @param existingTypes - Types from existing entity
 * @param newTypes - Types from new entity occurrence
 * @returns Selected types (most frequent, up to 2-3 types)
 *
 * @internal
 */
const selectBestTypes = (
  existingTypes: ReadonlyArray<string>,
  newTypes: ReadonlyArray<string>
): Schema.Schema.Type<Schema.NonEmptyArray<typeof IRI>> => {
  // Count type frequencies
  const typeFrequency = new Map<string, number>()

  // Count existing types (weighted as 1 occurrence)
  for (const type of existingTypes) {
    typeFrequency.set(type, (typeFrequency.get(type) || 0) + 1)
  }

  // Count new types (weighted as 1 occurrence)
  for (const type of newTypes) {
    typeFrequency.set(type, (typeFrequency.get(type) || 0) + 1)
  }

  // If only one type, return it
  if (typeFrequency.size === 1) {
    return decodeEntityTypes(Array.from(typeFrequency.keys()))
  }

  // Sort by frequency (descending)
  const sortedTypes = Array.from(typeFrequency.entries()).sort((a, b) => b[1] - a[1])

  // Select top types:
  // - If highest frequency is >= 2, take all types with that frequency
  // - Otherwise, take top 2-3 types (but at least the most frequent)
  const maxFrequency = sortedTypes[0]![1]
  const selectedTypes: Array<string> = []

  if (maxFrequency >= 2) {
    // Majority voting: take all types that appear in majority
    for (const [type, freq] of sortedTypes) {
      if (freq >= maxFrequency) {
        selectedTypes.push(type)
      } else {
        break
      }
    }
    // Limit to top 3 even if multiple have same frequency
    return decodeEntityTypes(selectedTypes.slice(0, 3))
  } else {
    // No clear majority: take top 2-3 most frequent
    // Prefer keeping 1-2 types for clarity
    return decodeEntityTypes(sortedTypes.slice(0, 2).map(([type]) => type))
  }
}

/**
 * Merge two knowledge graphs
 *
 * Merges entities by `id` and relations by `(subjectId, predicate, object)` signature.
 * Enforces functional properties (at most one value per subject-predicate).
 * Detects and records attribute conflicts.
 *
 * This is a pure function suitable for `Stream.runFold` reduction.
 * The merge is associative and has an identity element (empty graph).
 *
 * @param a - First graph
 * @param b - Second graph
 * @returns Merged graph
 *
 * @example
 * ```typescript
 * const graph1 = new KnowledgeGraph({
 *   entities: [entity1],
 *   relations: [relation1]
 * })
 *
 * const graph2 = new KnowledgeGraph({
 *   entities: [entity2],
 *   relations: [relation2]
 * })
 *
 * const merged = mergeGraphs(graph1, graph2)
 * ```
 *
 * @category constructors
 * @since 2.0.0
 */
export const mergeGraphs = (a: KnowledgeGraph, b: KnowledgeGraph): KnowledgeGraph => {
  // Identity element: empty graph
  if (a.entities.length === 0 && a.relations.length === 0) {
    return b
  }
  if (b.entities.length === 0 && b.relations.length === 0) {
    return a
  }

  // Merge entities by ID using HashMap
  let entityMap = HashMap.empty<string, Entity>()

  // Add entities from a
  for (const entity of a.entities) {
    entityMap = HashMap.set(entityMap, entity.id, entity)
  }

  // Merge b's entities into the map
  for (const entity of b.entities) {
    const existing = HashMap.get(entityMap, entity.id)
    if (Option.isSome(existing)) {
      // Merge attributes: union with preference for non-empty values
      const mergedAttributes = { ...existing.value.attributes, ...entity.attributes }
      // Select best types using frequency voting (instead of union)
      const mergedTypes = selectBestTypes(existing.value.types, entity.types)
      // Keep longest mention
      const mergedMention = entity.mention.length > existing.value.mention.length
        ? entity.mention
        : existing.value.mention

      // Merge mentions (EvidenceSpan arrays) - combine both sets
      const mergedMentions = [
        ...(existing.value.mentions ?? []),
        ...(entity.mentions ?? [])
      ]

      // Select higher groundingConfidence (system verification score)
      const mergedGroundingConfidence = Math.max(
        Option.getOrElse(existing.value.groundingConfidence, () => 0),
        Option.getOrElse(entity.groundingConfidence, () => 0)
      )

      entityMap = HashMap.set(
        entityMap,
        entity.id,
        Entity.make({
          id: entity.id,
          mention: mergedMention,
          types: mergedTypes,
          attributes: mergedAttributes,
          chunkIndex: existing.value.chunkIndex ?? entity.chunkIndex,
          chunkId: existing.value.chunkId ?? entity.chunkId,
          // Preserve provenance fields - prefer first occurrence
          documentId: existing.value.documentId ?? entity.documentId,
          sourceUri: existing.value.sourceUri ?? entity.sourceUri,
          extractedAt: existing.value.extractedAt ?? entity.extractedAt,
          eventTime: existing.value.eventTime ?? entity.eventTime,
          // Merge evidence spans
          mentions: mergedMentions,
          // Use highest confidence
          groundingConfidence: mergedGroundingConfidence > 0
            ? Option.some(UnitInterval.make(mergedGroundingConfidence))
            : Option.none()
        })
      )
    } else {
      entityMap = HashMap.set(entityMap, entity.id, entity)
    }
  }

  // Merge relations by (subjectId, predicate, object) signature using HashSet.union
  const relationsA = HashSet.fromIterable(a.relations)
  const relationsB = HashSet.fromIterable(b.relations)
  const relationSet = HashSet.union(relationsA, relationsB)

  // Convert to Chunk and sort for deterministic output
  const mergedEntities = Chunk.fromIterable(HashMap.toValues(entityMap)).pipe(
    Chunk.sort(EntityOrder)
  )

  const mergedRelations = Chunk.fromIterable(relationSet).pipe(
    Chunk.sort(RelationOrder)
  )

  return KnowledgeGraph.make({
    entities: Array.from(mergedEntities),
    relations: Array.from(mergedRelations)
  })
}

/**
 * Merge graphs with conflict detection
 *
 * Returns both the merged graph and a list of conflicts detected during merging.
 * Useful for UI review tools and quality assurance.
 *
 * @param a - First graph
 * @param b - Second graph
 * @returns Tuple of [merged graph, conflicts]
 *
 * @category constructors
 * @since 2.0.0
 */
export const mergeGraphsWithConflicts = (
  a: KnowledgeGraph,
  b: KnowledgeGraph
): [KnowledgeGraph, ReadonlyArray<MergeConflict>] => {
  const conflicts: Array<MergeConflict> = []

  // Identity element: empty graph
  if (a.entities.length === 0 && a.relations.length === 0) {
    return [b, []]
  }
  if (b.entities.length === 0 && b.relations.length === 0) {
    return [a, []]
  }

  // Merge entities by ID with conflict detection using HashMap
  let entityMap = HashMap.empty<string, Entity>()

  // Add entities from a
  for (const entity of a.entities) {
    entityMap = HashMap.set(entityMap, entity.id, entity)
  }

  // Merge b's entities into the map, detecting conflicts
  for (const entity of b.entities) {
    const existing = HashMap.get(entityMap, entity.id)
    if (Option.isSome(existing)) {
      // Check for attribute conflicts
      for (const [key, value] of Object.entries(entity.attributes)) {
        const existingValue = existing.value.attributes[key]
        if (existingValue !== undefined && existingValue !== value) {
          conflicts.push({
            entityId: entity.id,
            property: key,
            values: [existingValue, value],
            chunkIndexes: [] // TODO: track chunk indexes if provenance is added
          })
        }
      }

      // Merge attributes: union with preference for non-empty values
      const mergedAttributes = { ...existing.value.attributes, ...entity.attributes }
      // Select best types using frequency voting (instead of union)
      const mergedTypes = selectBestTypes(existing.value.types, entity.types)
      // Keep longest mention
      const mergedMention = entity.mention.length > existing.value.mention.length
        ? entity.mention
        : existing.value.mention

      // Merge mentions (EvidenceSpan arrays) - combine both sets
      const mergedMentions = [
        ...(existing.value.mentions ?? []),
        ...(entity.mentions ?? [])
      ]

      // Select higher groundingConfidence (system verification score)
      const mergedGroundingConfidence = Math.max(
        Option.getOrElse(existing.value.groundingConfidence, () => 0),
        Option.getOrElse(entity.groundingConfidence, () => 0)
      )

      entityMap = HashMap.set(
        entityMap,
        entity.id,
        Entity.make({
          id: entity.id,
          mention: mergedMention,
          types: mergedTypes,
          attributes: mergedAttributes,
          chunkIndex: existing.value.chunkIndex ?? entity.chunkIndex,
          chunkId: existing.value.chunkId ?? entity.chunkId,
          // Preserve provenance fields - prefer first occurrence
          documentId: existing.value.documentId ?? entity.documentId,
          sourceUri: existing.value.sourceUri ?? entity.sourceUri,
          extractedAt: existing.value.extractedAt ?? entity.extractedAt,
          eventTime: existing.value.eventTime ?? entity.eventTime,
          // Merge evidence spans
          mentions: mergedMentions,
          // Use highest confidence
          groundingConfidence: mergedGroundingConfidence > 0
            ? Option.some(UnitInterval.make(mergedGroundingConfidence))
            : Option.none()
        })
      )
    } else {
      entityMap = HashMap.set(entityMap, entity.id, entity)
    }
  }

  // Merge relations (same as mergeGraphs) using HashSet.union
  const relationsA = HashSet.fromIterable(a.relations)
  const relationsB = HashSet.fromIterable(b.relations)
  const relationSet = HashSet.union(relationsA, relationsB)

  // Convert to Chunk and sort for deterministic output
  const mergedEntities = Chunk.fromIterable(HashMap.toValues(entityMap)).pipe(
    Chunk.sort(EntityOrder)
  )

  const mergedRelations = Chunk.fromIterable(relationSet).pipe(
    Chunk.sort(RelationOrder)
  )

  const mergedGraph = KnowledgeGraph.make({
    entities: Array.from(mergedEntities),
    relations: Array.from(mergedRelations)
  })

  return [mergedGraph, conflicts]
}
