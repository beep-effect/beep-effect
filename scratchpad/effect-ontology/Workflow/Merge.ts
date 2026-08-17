/**
 * Graph Merge Utilities
 *
 * **Details**
 *
 * Pure functions for merging KnowledgeGraph fragments from multiple chunks.
 * Implements monoid operations for streaming reduction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import type { IRI } from "@beep/rdf";
import { NonNegativeInt } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as A from "@beep/utils/Array";
import { thunk0 } from "@beep/utils/thunk";
import { HashMap, HashSet, MutableHashMap, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import type { Relation } from "../Domain/Model/Entity.ts";
import { Entity, KnowledgeGraph, RelationObject } from "../Domain/Model/Entity.ts";
import { EntityId } from "../Domain/Model/shared.ts";
import { dual2 } from "../Utils/Dual.ts";

const $I = $ScratchpadId.create("effect-ontology/Workflow/Merge");

/**
 * Merge conflict information
 *
 * **Details**
 *
 * Records conflicts detected during entity attribute merging.
 *
 *
 * **Example** (Construct a merge conflict)
 *
 * ```ts
 * import { EntityId } from "@effect-ontology/Model/shared"
 * import { MergeConflict } from "@effect-ontology/Workflow/Merge"
 *
 * const conflict = MergeConflict.make({
 *   entityId: EntityId.make("entity_1"),
 *   property: "name",
 *   values: ["Ada", "Augusta"],
 *   chunkIndexes: []
 * })
 * console.log(conflict.property) // "name"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class MergeConflict extends S.Class<MergeConflict>($I`MergeConflict`)(
  {
    entityId: EntityId.annotateKey({ description: "Entity whose attributes conflict." }),
    property: S.NonEmptyString.annotateKey({ description: "Entity property with conflicting values." }),
    values: S.Array(S.Unknown).annotateKey({ description: "Conflicting values observed for the property." }),
    chunkIndexes: S.Array(NonNegativeInt).annotateKey({
      description: "Source chunk indexes that contributed conflicting values.",
    }),
  },
  $I.annote("MergeConflict", {
    description: "Conflicting entity-property values and the source chunks that produced them.",
  })
) {}

/**
 * Order instance for Entity (by id)
 *
 * @internal
 */
const EntityOrder: Order.Order<Entity> = Order.mapInput(Order.String, (entity: Entity) => entity.id);

/**
 * Order instance for Relation (by subjectId, predicate, object)
 *
 * @internal
 */
const RelationOrder: Order.Order<Relation> = Order.combine(
  Order.mapInput(Order.String, (r: Relation) => r.subjectId),
  Order.combine(
    Order.mapInput(Order.String, (r: Relation) => r.predicate),
    Order.mapInput(Order.String, (relation: Relation) =>
      RelationObject.match(relation.object, {
        EntityReference: ({ value }) => `entity:${value}`,
        Text: ({ value }) => `text:${value}`,
        Number: ({ value }) => `number:${value}`,
        Boolean: ({ value }) => `boolean:${value}`,
      })
    )
  )
);

const TypeFrequencyOrder = Order.mapInput(Order.flip(Order.Number), (entry: readonly [IRI, number]) => entry[1]);

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
  existingTypes: A.NonEmptyReadonlyArray<IRI>,
  newTypes: A.NonEmptyReadonlyArray<IRI>
): A.NonEmptyReadonlyArray<IRI> => {
  const ensureNonEmpty = (types: ReadonlyArray<IRI>): A.NonEmptyReadonlyArray<IRI> =>
    O.match(A.head(types), {
      onNone: () => [existingTypes[0]],
      onSome: (first) => [first, ...A.drop(types, 1)],
    });
  // Count type frequencies
  const typeFrequency = MutableHashMap.empty<IRI, number>();

  // Count existing types (weighted as 1 occurrence)
  for (const type of existingTypes) {
    MutableHashMap.set(typeFrequency, type, O.getOrElse(MutableHashMap.get(typeFrequency, type), () => 0) + 1);
  }

  // Count new types (weighted as 1 occurrence)
  for (const type of newTypes) {
    MutableHashMap.set(typeFrequency, type, O.getOrElse(MutableHashMap.get(typeFrequency, type), () => 0) + 1);
  }

  // If only one type, return it
  if (MutableHashMap.size(typeFrequency) === 1) {
    return typeFrequency.pipe(MutableHashMap.keys, A.fromIterable, ensureNonEmpty);
  }

  // Sort by frequency (descending)
  const sortedTypes = A.sort(A.fromIterable(typeFrequency), TypeFrequencyOrder);

  // Select top types:
  // - If highest frequency is >= 2, take all types with that frequency
  // - Otherwise, take top 2-3 types (but at least the most frequent)
  const maxFrequency = sortedTypes[0][1];
  const selectedTypes = A.empty<IRI>();

  if (maxFrequency >= 2) {
    // Majority voting: take all types that appear in majority
    for (const [type, freq] of sortedTypes) {
      if (freq >= maxFrequency) {
        selectedTypes.push(type);
      } else {
        break;
      }
    }
    // Limit to top 3 even if multiple have same frequency
    return ensureNonEmpty(A.slice(selectedTypes, { start: 0, end: 3 }));
  } else {
    // No clear majority: take top 2-3 most frequent
    // Prefer keeping 1-2 types for clarity
    return ensureNonEmpty(
      pipe(
        A.slice(sortedTypes, {
          start: 0,
          end: 2,
        }),
        A.map(Tuple.get(0))
      )
    );
  }
};

/**
 * Merge two knowledge graphs
 *
 * **Details**
 *
 * Merges entities by `id` and relations by `(subjectId, predicate, object)` signature.
 * Enforces functional properties (at most one value per subject-predicate).
 * Detects and records attribute conflicts.
 *
 * This is a pure function suitable for `Stream.runFold` reduction.
 * The merge is associative and has an identity element (empty graph).
 *
 * **Example** (Use mergeGraphs)
 *
 * ```ts
 * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
 * import { mergeGraphs } from "@effect-ontology/Workflow/Merge"
 *
 * const merged = mergeGraphs(KnowledgeGraph.make({}), KnowledgeGraph.make({}))
 * console.log(merged.entities.length) // 0
 * ```
 *
 * @param a - First graph
 * @param b - Second graph
 * @returns Merged graph
 * @category workflows
 * @since 0.0.0
 */
export const mergeGraphs = dual2((a: KnowledgeGraph, b: KnowledgeGraph): KnowledgeGraph => {
  // Identity element: empty graph
  if (a.entities.length === 0 && a.relations.length === 0) {
    return b;
  }
  if (b.entities.length === 0 && b.relations.length === 0) {
    return a;
  }

  // Merge entities by ID using HashMap
  let entityMap = HashMap.empty<string, Entity>();

  // Add entities from a
  for (const entity of a.entities) {
    entityMap = HashMap.set(entityMap, entity.id, entity);
  }

  // Merge b's entities into the map
  for (const entity of b.entities) {
    const existing = HashMap.get(entityMap, entity.id);
    if (O.isSome(existing)) {
      // Merge attributes: union with preference for non-empty values
      const mergedAttributes = { ...existing.value.attributes, ...entity.attributes };
      // Select best types using frequency voting (instead of union)
      const mergedTypes = selectBestTypes(existing.value.types, entity.types);
      // Keep longest mention
      const mergedMention =
        entity.mention.length > existing.value.mention.length ? entity.mention : existing.value.mention;

      // Merge mentions (EvidenceSpan arrays) - combine both sets
      const mergedMentions = [...(existing.value.mentions ?? []), ...(entity.mentions ?? [])];

      // Select higher groundingConfidence (system verification score)
      const mergedGroundingConfidence = Math.max(
        O.getOrElse(existing.value.groundingConfidence, () => 0),
        O.getOrElse(entity.groundingConfidence, () => 0)
      );

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
          groundingConfidence:
            mergedGroundingConfidence > 0 ? O.some(UnitInterval.make(mergedGroundingConfidence)) : O.none(),
        })
      );
    } else {
      entityMap = HashMap.set(entityMap, entity.id, entity);
    }
  }

  // Merge relations by (subjectId, predicate, object) signature using HashSet.union
  const relationsA = HashSet.fromIterable(a.relations);
  const relationsB = HashSet.fromIterable(b.relations);
  const relationSet = HashSet.union(relationsA, relationsB);

  // Convert to Chunk and sort for deterministic output
  const mergedEntities = A.sort(A.fromIterable(HashMap.toValues(entityMap)), EntityOrder);

  const mergedRelations = A.sort(A.fromIterable(relationSet), RelationOrder);

  return KnowledgeGraph.make({
    entities: mergedEntities,
    relations: mergedRelations,
  });
});

/**
 * Merge graphs with conflict detection
 *
 * **Details**
 *
 * Returns both the merged graph and a list of conflicts detected during merging.
 * Useful for UI review tools and quality assurance.
 *
 * **Example** (Merge two empty graphs without conflicts)
 *
 * ```ts
 * import { KnowledgeGraph } from "@effect-ontology/Model/Entity"
 * import { mergeGraphsWithConflicts } from "@effect-ontology/Workflow/Merge"
 *
 * const [, conflicts] = mergeGraphsWithConflicts(KnowledgeGraph.make({}), KnowledgeGraph.make({}))
 * console.log(conflicts.length) // 0
 * ```
 *
 * @param a - First graph
 * @param b - Second graph
 * @returns Tuple of [merged graph, conflicts]
 * @category workflows
 * @since 0.0.0
 */
export const mergeGraphsWithConflicts = dual2(
  (a: KnowledgeGraph, b: KnowledgeGraph): [KnowledgeGraph, ReadonlyArray<MergeConflict>] => {
    const conflicts = A.empty<MergeConflict>();

    // Identity element: empty graph
    if (A.isReadonlyArrayEmpty(a.entities) && A.isReadonlyArrayEmpty(a.relations)) {
      return [b, []];
    }
    if (A.isReadonlyArrayEmpty(b.entities) && A.isReadonlyArrayEmpty(b.relations)) {
      return [a, []];
    }

    // Merge entities by ID with conflict detection using HashMap
    let entityMap = HashMap.empty<string, Entity>();

    // Add entities from a
    for (const entity of a.entities) {
      entityMap = HashMap.set(entityMap, entity.id, entity);
    }

    // Merge b's entities into the map, detecting conflicts
    for (const entity of b.entities) {
      const existing = HashMap.get(entityMap, entity.id);
      if (O.isSome(existing)) {
        // Check for attribute conflicts
        for (const [key, value] of R.toEntries(entity.attributes)) {
          const existingValue = R.get(existing.value.attributes, key);
          if (O.isSome(existingValue) && existingValue.value !== value) {
            conflicts.push(
              MergeConflict.make({
                entityId: entity.id,
                property: key,
                values: [existingValue.value, value],
                chunkIndexes: A.sort(
                  A.fromIterable(HashSet.fromIterable(A.getSomes([existing.value.chunkIndex, entity.chunkIndex]))),
                  Order.Number
                ),
              })
            );
          }
        }

        // Merge attributes: union with preference for non-empty values
        const mergedAttributes = { ...existing.value.attributes, ...entity.attributes };
        // Select best types using frequency voting (instead of union)
        const mergedTypes = selectBestTypes(existing.value.types, entity.types);
        // Keep longest mention
        const mergedMention =
          entity.mention.length > existing.value.mention.length ? entity.mention : existing.value.mention;

        // Merge mentions (EvidenceSpan arrays) - combine both sets
        const mergedMentions = [...(existing.value.mentions ?? []), ...(entity.mentions ?? [])];

        // Select higher groundingConfidence (system verification score)
        const mergedGroundingConfidence = Math.max(
          O.getOrElse(existing.value.groundingConfidence, thunk0),
          O.getOrElse(entity.groundingConfidence, thunk0)
        );

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
            groundingConfidence:
              mergedGroundingConfidence > 0 ? O.some(UnitInterval.make(mergedGroundingConfidence)) : O.none(),
          })
        );
      } else {
        entityMap = HashMap.set(entityMap, entity.id, entity);
      }
    }

    // Merge relations (same as mergeGraphs) using HashSet.union
    const relationsA = HashSet.fromIterable(a.relations);
    const relationsB = HashSet.fromIterable(b.relations);
    const relationSet = HashSet.union(relationsA, relationsB);

    // Convert to Chunk and sort for deterministic output
    const mergedEntities = A.sort(A.fromIterable(HashMap.toValues(entityMap)), EntityOrder);

    const mergedRelations = A.sort(A.fromIterable(relationSet), RelationOrder);

    const mergedGraph = KnowledgeGraph.make({
      entities: mergedEntities,
      relations: mergedRelations,
    });

    return [mergedGraph, conflicts];
  }
);
