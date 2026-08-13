/**
 * Refine Knowledge Graph using Entity Resolution results
 *
 * Merges entities and rewrites relations based on canonical mappings.
 *
 * @since 2.0.0
 * @module Utils/RefineKG
 */
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Entity, KnowledgeGraph, Relation, RelationObject } from "../Domain/Model/Entity.ts";
import type { EntityResolutionGraph } from "../Domain/Model/EntityResolutionGraph.ts";
import { EntityId, IRI } from "../Domain/Model/shared.ts";
import { dual2 } from "./Dual.ts";

/**
 * Refine a KnowledgeGraph using the canonical mappings from an EntityResolutionGraph.
 *
 * - Merges entities that map to the same canonical ID.
 * - Rewrites relations to use canonical IDs.
 * - Deduplicates relations after rewriting.
 */
export const refineKnowledgeGraph = dual2((kg: KnowledgeGraph, erg: EntityResolutionGraph): KnowledgeGraph => {
  const { canonicalMap } = erg;
  const entityMap = MutableHashMap.empty<string, Entity>();

  // 1. Merge Entities
  for (const entity of kg.entities) {
    const canonicalId = canonicalMap[entity.id] ?? entity.id;

    if (!MutableHashMap.has(entityMap, canonicalId)) {
      // First time seeing this canonical entity
      // If the ID changed, update it.
      const newEntity = canonicalId === entity.id ? entity : Entity.make({ ...entity, id: EntityId.make(canonicalId) });

      MutableHashMap.set(entityMap, canonicalId, newEntity);
    } else {
      // Merge into existing canonical entity
      const existing = O.getOrThrow(MutableHashMap.get(entityMap, canonicalId));

      const uniqueTypes = A.fromIterable(MutableHashSet.fromIterable([...existing.types, ...entity.types]));
      const mergedTypes = S.NonEmptyArray(IRI).make([existing.types[0], ...A.drop(uniqueTypes, 1)]);
      // Merge attributes (last write wins, or maybe preserve all? For now: simple merge)
      const mergedAttributes = { ...existing.attributes, ...entity.attributes };

      // Preserve tracking info from 'best' entity?
      // Or just keep existing. For provenance, we might want to track all chunk indices?
      // Entity model only has single chunkIndex. We'll keep the existing one.

      MutableHashMap.set(
        entityMap,
        canonicalId,
        Entity.make({
          ...existing,
          types: mergedTypes,
          attributes: mergedAttributes,
        })
      );
    }
  }

  // 2. Rewrite Relations
  const relationKeys = MutableHashSet.empty<string>();
  const newRelations: Array<Relation> = [];

  for (const rel of kg.relations) {
    const subjectCanonical = canonicalMap[rel.subjectId] ?? rel.subjectId;

    const objectCanonical = RelationObject.guards.EntityReference(rel.object)
      ? RelationObject.cases.EntityReference.make({
          value: EntityId.make(canonicalMap[rel.object.value] ?? rel.object.value),
        })
      : rel.object;

    // Skip if subject or object (if entity) is missing from our resolved set?
    // No, they should be there.

    // Create unique key for deduplication
    const key = `${subjectCanonical}|${rel.predicate}|${objectCanonical._tag}:${objectCanonical.value}`;

    if (!MutableHashSet.has(relationKeys, key)) {
      MutableHashSet.add(relationKeys, key);
      newRelations.push(
        Relation.make({
          subjectId: EntityId.make(subjectCanonical),
          predicate: rel.predicate,
          object: objectCanonical,
        })
      );
    }
  }

  return KnowledgeGraph.make({
    entities: entityMap.pipe(MutableHashMap.values, A.fromIterable),
    relations: newRelations,
  });
});
