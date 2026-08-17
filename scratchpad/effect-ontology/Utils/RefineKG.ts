/**
 * Refine Knowledge Graph using Entity Resolution results
 *
 * **Details**
 *
 * Merges entities and rewrites relations based on canonical mappings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/rdf";
import { MutableHashMap, MutableHashSet } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Entity, KnowledgeGraph, Relation, RelationObject } from "../Domain/Model/Entity.ts";
import type { EntityResolutionGraph } from "../Domain/Model/EntityResolutionGraph.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import { dual2 } from "./Dual.ts";

/**
 * Refine a KnowledgeGraph using the canonical mappings from an EntityResolutionGraph.
 *
 * **Details**
 *
 * - Merges entities that map to the same canonical ID.
 * - Rewrites relations to use canonical IDs.
 * - Deduplicates relations after rewriting.
 *
 * **Example** (Refine an empty graph)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { DateTime, Graph } from "effect"
 * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
 * import { EntityResolutionGraph, EntityResolutionStats } from "@effect-ontology/Model/EntityResolutionGraph"
 * import { refineKnowledgeGraph } from "@effect-ontology/Utils/RefineKG"
 *
 * const stats = EntityResolutionStats.make({
 *   mentionCount: NonNegativeInt.make(0),
 *   resolvedCount: NonNegativeInt.make(0),
 *   relationCount: NonNegativeInt.make(0),
 *   clusterCount: NonNegativeInt.make(0)
 * })
 * const resolution = EntityResolutionGraph.make({
 *   graph: Graph.directed(),
 *   entityIndex: {},
 *   canonicalMap: {},
 *   createdAt: DateTime.nowUnsafe(),
 *   stats
 * })
 * const refined = refineKnowledgeGraph(KnowledgeGraph.make({}), resolution)
 * console.log(refined.entities.length) // 0
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const refineKnowledgeGraph = dual2((kg: KnowledgeGraph, erg: EntityResolutionGraph): KnowledgeGraph => {
  const { canonicalMap } = erg;
  const entityMap = MutableHashMap.empty<string, Entity>();

  // 1. Merge Entities
  for (const entity of kg.entities) {
    const canonicalId = canonicalMap[entity.id] ?? entity.id;
    const existing = MutableHashMap.get(entityMap, canonicalId);

    if (O.isNone(existing)) {
      // First time seeing this canonical entity
      // If the ID changed, update it.
      const newEntity = canonicalId === entity.id ? entity : Entity.make({ ...entity, id: EntityId.make(canonicalId) });

      MutableHashMap.set(entityMap, canonicalId, newEntity);
    } else {
      // Merge into existing canonical entity
      const uniqueTypes = A.fromIterable(MutableHashSet.fromIterable([...existing.value.types, ...entity.types]));
      const mergedTypes = S.NonEmptyArray(IRI).make([existing.value.types[0], ...A.drop(uniqueTypes, 1)]);
      // Merge attributes (last write wins, or maybe preserve all? For now: simple merge)
      const mergedAttributes = { ...existing.value.attributes, ...entity.attributes };

      // Preserve tracking info from 'best' entity?
      // Or just keep existing. For provenance, we might want to track all chunk indices?
      // Entity model only has single chunkIndex. We'll keep the existing one.

      MutableHashMap.set(
        entityMap,
        canonicalId,
        Entity.make({
          ...existing.value,
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
