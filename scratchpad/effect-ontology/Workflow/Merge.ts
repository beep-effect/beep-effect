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
import { DateTime, HashMap, HashSet, Inspectable, MutableHashMap, Order } from "effect";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
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

class RelationSignature extends S.Class<RelationSignature>($I`RelationSignature`)({
  subjectId: EntityId,
  predicate: S.String,
  object: RelationObject,
}) {}

const relationSignature = (relation: Relation): RelationSignature =>
  RelationSignature.make({
    subjectId: relation.subjectId,
    predicate: relation.predicate,
    object: relation.object,
  });

const EvidenceOrder = Order.combine(
  Order.mapInput(Order.Number, (evidence: Entity["mentions"][number]) => evidence.startChar),
  Order.combine(
    Order.mapInput(Order.Number, (evidence: Entity["mentions"][number]) => evidence.endChar),
    Order.mapInput(Order.String, (evidence: Entity["mentions"][number]) => evidence.quote)
  )
);

const MentionOrder = Order.combine(
  Order.mapInput(Order.Number, (mention: string) => Str.length(mention)),
  Order.String
);

type EntityAttribute = Entity["attributes"][string];

const canonicalAttribute = (left: EntityAttribute, right: EntityAttribute): EntityAttribute =>
  Order.min(Order.String)(Inspectable.toStringUnknown(left, 0), Inspectable.toStringUnknown(right, 0)) ===
  Inspectable.toStringUnknown(left, 0)
    ? left
    : right;

const canonicalOption = <Value>(
  order: Order.Order<Value>,
  left: O.Option<Value>,
  right: O.Option<Value>
): O.Option<Value> => O.firstSomeOf([O.zipWith(left, right, Order.min(order)), left, right]);

const canonicalAttributes = (left: Entity["attributes"], right: Entity["attributes"]): Entity["attributes"] => {
  let attributes = left;
  for (const [key, rightValue] of R.toEntries(right)) {
    attributes = R.set(
      attributes,
      key,
      O.match(R.get(attributes, key), {
        onNone: () => rightValue,
        onSome: (leftValue) => canonicalAttribute(leftValue, rightValue),
      })
    );
  }
  return attributes;
};

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
  A.dedupeWith(
    A.sort(
      values,
      Order.mapInput(Order.String, (value: TValue) => `${value.id}:${Inspectable.toStringUnknown(value, 0)}`)
    ),
    (left, right) => Eq.equals(left.id, right.id)
  );

const mergeEntity = (left: Entity, right: Entity): Entity => {
  const grounding = preferGrounding(left.grounding, right.grounding);
  return Entity.make({
    id: left.id,
    mention: Order.max(MentionOrder)(left.mention, right.mention),
    types: selectBestTypes(left.types, right.types),
    attributes: canonicalAttributes(left.attributes, right.attributes),
    chunkIndex: canonicalOption(Order.Number, left.chunkIndex, right.chunkIndex),
    chunkId: canonicalOption(Order.String, left.chunkId, right.chunkId),
    documentId: canonicalOption(Order.String, left.documentId, right.documentId),
    sourceUri: canonicalOption(Order.String, left.sourceUri, right.sourceUri),
    extractedAt: canonicalOption(DateTime.Order, left.extractedAt, right.extractedAt),
    eventTime: canonicalOption(DateTime.Order, left.eventTime, right.eventTime),
    mentions: A.dedupeWith(A.sort(A.appendAll(left.mentions, right.mentions), EvidenceOrder), Eq.equals),
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
    evidence: canonicalOption(EvidenceOrder, left.evidence, right.evidence),
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
  const relations = MutableHashMap.empty<RelationSignature, Relation>();
  for (const relation of A.appendAll(left, right)) {
    const signature = relationSignature(relation);
    MutableHashMap.set(
      relations,
      signature,
      O.match(MutableHashMap.get(relations, signature), {
        onNone: () => relation,
        onSome: (existing) => mergeRelation(existing, relation),
      })
    );
  }
  return A.sort(A.fromIterable(MutableHashMap.values(relations)), RelationOrder);
};

const mergeGraphData = (left: KnowledgeGraph, right: KnowledgeGraph): KnowledgeGraph =>
  KnowledgeGraph.make({
    entities: mergeEntityCollections(left.entities, right.entities),
    relations: mergeRelationCollections(left.relations, right.relations),
    sourceText: canonicalOption(Order.String, left.sourceText, right.sourceText),
    provenance: ProvBundle.make({
      records: A.dedupeWith(
        A.sort(
          A.appendAll(left.provenance.records, right.provenance.records),
          Order.mapInput(Order.String, (record) => Inspectable.toStringUnknown(record, 0))
        ),
        Eq.equals
      ),
    }),
    entityObservations: dedupeById(A.appendAll(left.entityObservations, right.entityObservations)),
    relationObservations: dedupeById(A.appendAll(left.relationObservations, right.relationObservations)),
  });

/**
 * Select a canonical bounded union of entity types.
 *
 * Sorting and retaining the lowest three values makes the operation associative,
 * commutative, and deterministic under unordered parallel reduction.
 *
 * @param existingTypes - Types from existing entity
 * @param newTypes - Types from new entity occurrence
 * @returns Canonically ordered entity types, limited to three values.
 *
 * @internal
 */
const selectBestTypes = (
  existingTypes: A.NonEmptyReadonlyArray<IRI>,
  newTypes: A.NonEmptyReadonlyArray<IRI>
): A.NonEmptyReadonlyArray<IRI> => {
  const selected = A.take(A.dedupe(A.sort(A.appendAll(existingTypes, newTypes), Order.String)), 3);
  return A.match(selected, {
    onEmpty: () => [existingTypes[0]],
    onNonEmpty: (types) => types,
  });
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
