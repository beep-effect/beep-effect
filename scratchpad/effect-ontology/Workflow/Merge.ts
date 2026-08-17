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

import type { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import type { IRI } from "@beep/rdf";
import { ProvBundle } from "@beep/rdf/Prov";
import { NonNegativeInt } from "@beep/schema";
import * as A from "@beep/utils/Array";
import { HashMap, HashSet, MutableHashMap, Order, pipe, Tuple } from "effect";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { Relation } from "../Domain/Model/Entity.ts";
import {
  Entity,
  GroundingDecision,
  KnowledgeGraph,
  Relation as RelationModel,
  RelationObject,
} from "../Domain/Model/Entity.ts";
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

const groundingRank = (decision: GroundingDecision): number =>
  GroundingDecision.match(decision, {
    NotEvaluated: () => 1,
    Supported: () => 2,
    Rejected: () => 0,
  });

const noConfidence: () => O.Option<Confidence> = O.none;

const confidenceOf = (decision: GroundingDecision): O.Option<Confidence> =>
  GroundingDecision.match(decision, {
    NotEvaluated: noConfidence,
    Supported: ({ confidence }): O.Option<Confidence> => O.some(confidence),
    Rejected: ({ confidence }): O.Option<Confidence> => O.some(confidence),
  });

const preferGrounding = (left: GroundingDecision, right: GroundingDecision): GroundingDecision => {
  const leftRank = groundingRank(left);
  const rightRank = groundingRank(right);
  if (leftRank !== rightRank) {
    return leftRank > rightRank ? left : right;
  }
  return O.match(
    O.all({
      left: confidenceOf(left),
      right: confidenceOf(right),
    }),
    {
      onNone: () => left,
      onSome: ({ left: leftConfidence, right: rightConfidence }) => (leftConfidence >= rightConfidence ? left : right),
    }
  );
};

const dedupeById = <TValue extends { readonly id: string }>(values: ReadonlyArray<TValue>): ReadonlyArray<TValue> =>
  A.dedupeWith(values, (left, right) => left.id === right.id);

const mergeEntity = (left: Entity, right: Entity): Entity => {
  const grounding = preferGrounding(left.grounding, right.grounding);
  return Entity.make({
    id: left.id,
    mention: right.mention.length > left.mention.length ? right.mention : left.mention,
    types: selectBestTypes(left.types, right.types),
    attributes: { ...left.attributes, ...right.attributes },
    chunkIndex: O.orElse(left.chunkIndex, () => right.chunkIndex),
    chunkId: O.orElse(left.chunkId, () => right.chunkId),
    documentId: O.orElse(left.documentId, () => right.documentId),
    sourceUri: O.orElse(left.sourceUri, () => right.sourceUri),
    extractedAt: O.orElse(left.extractedAt, () => right.extractedAt),
    eventTime: O.orElse(left.eventTime, () => right.eventTime),
    mentions: A.appendAll(left.mentions, right.mentions),
    groundingConfidence: confidenceOf(grounding),
    grounding,
    observations: dedupeById(A.appendAll(left.observations, right.observations)),
  });
};

const mergeRelation = (left: Relation, right: Relation): Relation => {
  const grounding = preferGrounding(left.grounding, right.grounding);
  return RelationModel.make({
    subjectId: left.subjectId,
    predicate: left.predicate,
    object: left.object,
    evidence: O.orElse(left.evidence, () => right.evidence),
    grounding,
    observations: dedupeById(A.appendAll(left.observations, right.observations)),
  });
};

const mergeEntityCollections = (left: ReadonlyArray<Entity>, right: ReadonlyArray<Entity>): ReadonlyArray<Entity> => {
  let entities = HashMap.empty<string, Entity>();
  for (const entity of A.appendAll(left, right)) {
    entities = HashMap.set(
      entities,
      entity.id,
      O.match(HashMap.get(entities, entity.id), {
        onNone: () => entity,
        onSome: (existing) => mergeEntity(existing, entity),
      })
    );
  }
  return A.sort(A.fromIterable(HashMap.toValues(entities)), EntityOrder);
};

const mergeRelationCollections = (
  left: ReadonlyArray<Relation>,
  right: ReadonlyArray<Relation>
): ReadonlyArray<Relation> => {
  let relations = HashMap.empty<Relation, Relation>();
  for (const relation of A.appendAll(left, right)) {
    relations = HashMap.set(
      relations,
      relation,
      O.match(HashMap.get(relations, relation), {
        onNone: () => relation,
        onSome: (existing) => mergeRelation(existing, relation),
      })
    );
  }
  return A.sort(A.fromIterable(HashMap.toValues(relations)), RelationOrder);
};

const mergeGraphData = (left: KnowledgeGraph, right: KnowledgeGraph): KnowledgeGraph =>
  KnowledgeGraph.make({
    entities: mergeEntityCollections(left.entities, right.entities),
    relations: mergeRelationCollections(left.relations, right.relations),
    sourceText: O.orElse(left.sourceText, () => right.sourceText),
    provenance: ProvBundle.make({
      records: A.dedupeWith(A.appendAll(left.provenance.records, right.provenance.records), Eq.equals),
    }),
    entityObservations: dedupeById(A.appendAll(left.entityObservations, right.entityObservations)),
    relationObservations: dedupeById(A.appendAll(left.relationObservations, right.relationObservations)),
  });

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
export const mergeGraphs = dual2(mergeGraphData);

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

    const existingById = HashMap.fromIterable(A.map(a.entities, (entity) => [entity.id, entity]));
    for (const entity of b.entities) {
      const existing = HashMap.get(existingById, entity.id);
      if (O.isSome(existing)) {
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
      }
    }
    return [mergeGraphData(a, b), conflicts];
  }
);
