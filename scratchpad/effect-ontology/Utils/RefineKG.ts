/**
 * Refine Knowledge Graph using Entity Resolution results
 *
 * Merges entities and rewrites relations based on canonical mappings.
 *
 * @since 2.0.0
 * @module Utils/RefineKG
 */
import * as MutableHashSet from "effect/MutableHashSet";
import { Entity, KnowledgeGraph, Relation } from "../Domain/Model/Entity.ts"
import type { EntityResolutionGraph } from "../Domain/Model/EntityResolutionGraph.ts"
import {EntityId, IRI} from "../Domain/Model/shared.ts";
import * as S from "effect/Schema";

/**
 * Refine a KnowledgeGraph using the canonical mappings from an EntityResolutionGraph.
 *
 * - Merges entities that map to the same canonical ID.
 * - Rewrites relations to use canonical IDs.
 * - Deduplicates relations after rewriting.
 */
export const refineKnowledgeGraph = (
  kg: KnowledgeGraph,
  erg: EntityResolutionGraph
): KnowledgeGraph => {
  const { canonicalMap } = erg
  const entityMap = new Map<string, Entity>()

  // 1. Merge Entities
  for (const entity of kg.entities) {
    const canonicalId = canonicalMap[entity.id] ?? entity.id

    if (!entityMap.has(canonicalId)) {
      // First time seeing this canonical entity
      // If the ID changed, update it.
      const newEntity = canonicalId === entity.id
        ? entity
        : Entity.make({ ...entity, id: EntityId.make(canonicalId) })

      entityMap.set(canonicalId, newEntity)
    } else {
      // Merge into existing canonical entity
      const existing = entityMap.get(canonicalId)!

      const mergedTypes = S.NonEmptyArray(IRI).make([...MutableHashSet.fromIterable([...existing.types, ...entity.types])])
      // Merge attributes (last write wins, or maybe preserve all? For now: simple merge)
      const mergedAttributes = { ...existing.attributes, ...entity.attributes }

      // Preserve tracking info from 'best' entity?
      // Or just keep existing. For provenance, we might want to track all chunk indices?
      // Entity model only has single chunkIndex. We'll keep the existing one.

      entityMap.set(
        canonicalId,
        Entity.make({
          ...existing,
          types: mergedTypes,
          attributes: mergedAttributes
        })
      )
    }
  }

  // 2. Rewrite Relations
  const relationKeys = MutableHashSet.empty<string>()
  const newRelations = []

  for (const rel of kg.relations) {
    const subjectCanonical = canonicalMap[rel.subjectId] ?? rel.subjectId

    let objectCanonical: string | number | boolean
    if (typeof rel.object === "string") {
      objectCanonical = canonicalMap[rel.object] ?? rel.object
    } else {
      objectCanonical = rel.object
    }

    // Skip if subject or object (if entity) is missing from our resolved set?
    // No, they should be there.

    // Create unique key for deduplication
    const key = `${subjectCanonical}|${rel.predicate}|${objectCanonical}`

    if (!MutableHashSet.has(relationKeys, key)) {
      MutableHashSet.add(relationKeys, key)
      newRelations.push(
        Relation.make({
          subjectId: subjectCanonical,
          predicate: rel.predicate,
          object: objectCanonical
        })
      )
    }
  }

  return KnowledgeGraph.make({
    entities: Array.from(entityMap.values()),
    relations: newRelations
  })
}
