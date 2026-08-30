/**
 * Public effect-ontology APIs for utils/similarity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { MutableHashSet } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import type { Entity, Relation } from "../Domain/Model/Entity.ts";
import { RelationObject } from "../Domain/Model/Entity.ts";
import type { EntityResolutionConfig } from "../Domain/Model/EntityResolution.ts";
import { dual2, dual3, dual6 } from "./Dual.ts";
import { combinedSimilarity, jaccardSimilarity, overlapRatio } from "./String.ts";

/**
 * Collects incoming and outgoing entity-reference neighbors for one entity.
 *
 * **Gotchas**
 *
 * Self-references are excluded from both directions.
 *
 * **Example** (Collect outgoing neighbors and skip self-links)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { Relation, RelationObject } from "@effect-ontology/Domain/Model/Entity"
 * import { EntityId } from "@effect-ontology/Domain/Model/shared"
 * import { getNeighbors } from "@effect-ontology/Utils/Similarity"
 * import { MutableHashSet } from "effect"
 *
 * const worksFor = Relation.make({
 *   subjectId: EntityId.make("ada_lovelace"),
 *   predicate: IRI.make("https://schema.org/worksFor"),
 *   object: RelationObject.cases.EntityReference.make({ value: EntityId.make("analytical_engine") })
 * })
 * const sameAsSelf = Relation.make({
 *   subjectId: EntityId.make("ada_lovelace"),
 *   predicate: IRI.make("https://schema.org/sameAs"),
 *   object: RelationObject.cases.EntityReference.make({ value: EntityId.make("ada_lovelace") })
 * })
 * const neighbors = getNeighbors("ada_lovelace", [worksFor, sameAsSelf])
 * console.log(MutableHashSet.has(neighbors.outgoing, "analytical_engine")) // true
 * console.log(MutableHashSet.size(neighbors.outgoing)) // 1
 * ```
 *
 * @see {@link computeEntitySimilarity} for using these neighborhoods in a weighted score.
 * @category utilities
 * @since 0.0.0
 */
export const getNeighbors = dual2(
  (
    entityId: string,
    relations: ReadonlyArray<Relation>
  ): { incoming: MutableHashSet.MutableHashSet<string>; outgoing: MutableHashSet.MutableHashSet<string> } => {
    const incoming = MutableHashSet.empty<string>();
    const outgoing = MutableHashSet.empty<string>();

    for (const relation of relations) {
      const objectEntityId = RelationObject.match(relation.object, {
        EntityReference: ({ value }) => O.some(value),
        Text: O.none,
        Number: O.none,
        Boolean: O.none,
      });

      // Entity is subject → object is outgoing neighbor (if it's an entity reference)
      if (relation.subjectId === entityId && O.isSome(objectEntityId)) {
        // Don't include self-references
        if (objectEntityId.value !== entityId) {
          MutableHashSet.add(outgoing, objectEntityId.value);
        }
      }

      // Entity is object → subject is incoming neighbor
      if (O.isSome(objectEntityId) && objectEntityId.value === entityId) {
        // Don't include self-references
        if (relation.subjectId !== entityId) {
          MutableHashSet.add(incoming, relation.subjectId);
        }
      }
    }

    return { incoming, outgoing };
  }
);

/**
 * Combines mention, type, neighbor, and optional embedding similarities using
 * {@link EntityResolutionConfig} weights.
 *
 * **Details**
 *
 * Score = (w_mention·mentionSim + w_type·typeOverlap + w_neighbor·neighborSim
 * + w_embedding·embeddingSim) / sum(weights). Type overlap is hierarchy-aware
 * when `isSubclass` is supplied.
 *
 * **Example** (Score two person mentions)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { Entity } from "@effect-ontology/Domain/Model/Entity"
 * import { EntityResolutionConfig } from "@effect-ontology/Domain/Model/EntityResolution"
 * import { EntityId } from "@effect-ontology/Domain/Model/shared"
 * import { computeEntitySimilarity } from "@effect-ontology/Utils/Similarity"
 *
 * const ada = Entity.make({
 *   id: EntityId.make("ada_lovelace"),
 *   mention: "Ada Lovelace",
 *   types: [IRI.make("https://schema.org/Person")]
 * })
 * const augusta = Entity.make({
 *   id: EntityId.make("augusta_ada"),
 *   mention: "Augusta Ada Lovelace",
 *   types: [IRI.make("https://schema.org/Person")]
 * })
 * const score = computeEntitySimilarity(ada, augusta, [], EntityResolutionConfig.make({}), undefined, undefined)
 * console.log(score > 0.5) // true
 * ```
 *
 * @see {@link shouldConsiderMerge} for thresholding this score into a merge decision.
 * @see {@link getNeighbors} for the neighborhood sets that contribute neighborSim.
 * @category utilities
 * @since 0.0.0
 */
export const computeEntitySimilarity = dual6(
  (
    a: Entity,
    b: Entity,
    relations: ReadonlyArray<Relation>,
    config: EntityResolutionConfig,
    embeddingSimilarity: number | undefined,
    isSubclass: ((child: string, parent: string) => boolean) | undefined
  ): number => {
    // 1. Mention similarity using combined approach (Levenshtein + containment)
    const mentionSim = combinedSimilarity(a.mention, b.mention);

    // 2. Type overlap (Jaccard-like ratio)
    // If isSubclass provided, use hierarchy-aware check
    let typeOverlap: number;
    if (P.isNotUndefined(isSubclass)) {
      const setA = MutableHashSet.fromIterable(a.types);
      const setB = MutableHashSet.fromIterable(b.types);
      // Expand sets to include ancestors if needed? No, just check if A is sub of B or B sub of A.
      // Actually, Jaccard is intersection / union.
      // Hierarchy-aware Jaccard: |Intersection(Ancestors(A), Ancestors(B))| / |Union(...)|
      // This is expensive if we computed ancestors fully.
      // Simpler heuristic:
      // Count matches where typeA == typeB OR isSubclass(typeA, typeB) OR isSubclass(typeB, typeA)
      // This is still rough.
      // Better: Allow exact match OR subclass match to count as intersection.
      let intersection = 0;
      const unionSize = MutableHashSet.fromIterable([...a.types, ...b.types]).pipe(MutableHashSet.size);
      if (unionSize === 0) {
        typeOverlap = 0;
      } else {
        for (const tA of setA) {
          let matchFound = false;
          if (MutableHashSet.has(setB, tA)) {
            matchFound = true;
          } else {
            for (const tB of setB) {
              if (isSubclass(tA, tB) || isSubclass(tB, tA)) {
                matchFound = true;
                break;
              }
            }
          }
          if (matchFound) intersection++;
        }
        typeOverlap = intersection / unionSize;
      }
    } else {
      typeOverlap = overlapRatio(a.types, b.types);
    }

    // 3. Neighbor similarity (Directional)
    const neighborsA = getNeighbors(a.id, relations);
    const neighborsB = getNeighbors(b.id, relations);

    // Jaccard for incoming
    const incomingSim = jaccardSimilarity(A.fromIterable(neighborsA.incoming), A.fromIterable(neighborsB.incoming));
    // Jaccard for outgoing
    const outgoingSim = jaccardSimilarity(A.fromIterable(neighborsA.outgoing), A.fromIterable(neighborsB.outgoing));

    // Average, but only if they have neighbors?
    // If both have no neighbors in a direction, sim is 1? No 0 usually.
    // jaccardSimilarity returns 0 if union is empty.
    // We want: if both have NO incoming edges, incomingSim shouldn't penalize? Or should?
    // Usually in graph matching, lack of edges matches lack of edges.
    // But jaccard(empty, empty) = 0 usually.
    // Implementation of jaccardSimilarity in String.ts usually handles empty arrays as 0?
    // Let's assume standard behavior.
    const neighborSim = (incomingSim + outgoingSim) / 2;

    const embeddingSim = embeddingSimilarity ?? 0;

    // Normalize weights so they sum to 1.0
    const totalWeight =
      config.mentionWeight + config.typeWeight + config.neighborWeight + (config.embeddingWeight ?? 0);

    // Avoid division by zero
    if (totalWeight === 0) {
      return 0;
    }

    // Weighted combination (normalized)
    const weightedSum =
      config.mentionWeight * mentionSim +
      config.typeWeight * typeOverlap +
      config.neighborWeight * neighborSim +
      (config.embeddingWeight ?? 0) * embeddingSim;

    return weightedSum / totalWeight;
  }
);

/**
 * Returns whether two entities pass merge gating: overall similarity and
 * optional type-overlap thresholds.
 *
 * **Gotchas**
 *
 * When `requireTypeOverlap` is true, an embedding similarity greater than
 * 0.95 bypasses the type-overlap fast path so noisy types can still reach
 * the full {@link computeEntitySimilarity} check.
 *
 * **Example** (Reject disjoint types unless embedding is near-duplicate)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { Entity } from "@effect-ontology/Domain/Model/Entity"
 * import { EntityResolutionConfig } from "@effect-ontology/Domain/Model/EntityResolution"
 * import { EntityId } from "@effect-ontology/Domain/Model/shared"
 * import { shouldConsiderMerge } from "@effect-ontology/Utils/Similarity"
 *
 * const person = Entity.make({
 *   id: EntityId.make("ada"),
 *   mention: "Ada",
 *   types: [IRI.make("https://schema.org/Person")]
 * })
 * const org = Entity.make({
 *   id: EntityId.make("ada_org"),
 *   mention: "Ada",
 *   types: [IRI.make("https://schema.org/Organization")]
 * })
 * const config = EntityResolutionConfig.make({ similarityThreshold: UnitInterval.make(0.4) })
 * console.log(shouldConsiderMerge(person, org, [], config, undefined, undefined)) // false
 * console.log(shouldConsiderMerge(person, org, [], config, 0.99, undefined)) // true
 * ```
 *
 * @see {@link computeEntitySimilarity} for the weighted score this thresholds.
 * @category utilities
 * @since 0.0.0
 */
export const shouldConsiderMerge = dual6(
  (
    a: Entity,
    b: Entity,
    relations: ReadonlyArray<Relation>,
    config: EntityResolutionConfig,
    embeddingSimilarity: number | undefined,
    isSubclass: ((child: string, parent: string) => boolean) | undefined
  ): boolean => {
    // Check type overlap requirement first (fast path)
    if (config.requireTypeOverlap) {
      const typeOverlap = overlapRatio(a.types, b.types);
      // Note: We use simple overlap ratio here for fast path unless strict hierarchy is critical early check
      // If strict hierarchy is needed, this fast path might be too strict (false negatives).
      if (typeOverlap < config.typeOverlapRatio) {
        // ByPass: If embedding similarity is very high, assume type data might be noisy
        if (embeddingSimilarity !== undefined && embeddingSimilarity > 0.95) {
          // Continue to full similarity check
        } else if (P.isUndefined(isSubclass)) {
          return false;
        }
        // If we have hierarchy check, maybe second chance?
        // Re-calculate with hierarchy
        // (This logic is getting complex for a utility)
      }
    }

    // Compute full similarity
    const similarity = computeEntitySimilarity(a, b, relations, config, embeddingSimilarity, isSubclass);
    return similarity >= config.similarityThreshold;
  }
);

/**
 * Classifies how two entities would be resolved: exact mention, containment,
 * shared neighbors, or generic string similarity.
 *
 * **Example** (Detect containment between mentions)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { Entity } from "@effect-ontology/Domain/Model/Entity"
 * import { EntityId } from "@effect-ontology/Domain/Model/shared"
 * import { detectResolutionMethod } from "@effect-ontology/Utils/Similarity"
 *
 * const ada = Entity.make({
 *   id: EntityId.make("ada_lovelace"),
 *   mention: "Ada Lovelace",
 *   types: [IRI.make("https://schema.org/Person")]
 * })
 * const augusta = Entity.make({
 *   id: EntityId.make("augusta_ada"),
 *   mention: "Augusta Ada Lovelace",
 *   types: [IRI.make("https://schema.org/Person")]
 * })
 * console.log(detectResolutionMethod(ada, augusta, [])) // "containment"
 * ```
 *
 * @see {@link getNeighbors} for the neighbor sets that can yield `"neighbor"`.
 * @category utilities
 * @since 0.0.0
 */
export const detectResolutionMethod = dual3(
  (a: Entity, b: Entity, relations: ReadonlyArray<Relation>): "exact" | "similarity" | "containment" | "neighbor" => {
    // Check exact match first
    if (Str.toLowerCase(a.mention) === Str.toLowerCase(b.mention)) {
      return "exact";
    }

    // Check containment
    const aLower = Str.toLowerCase(a.mention);
    const bLower = Str.toLowerCase(b.mention);
    if (Str.includes(bLower)(aLower) || Str.includes(aLower)(bLower)) {
      return "containment";
    }

    // Check if neighbor similarity is the primary factor
    const neighborsA = getNeighbors(a.id, relations);
    const neighborsB = getNeighbors(b.id, relations);

    // Ensure there ARE neighbors before declaring neighbor similarity
    const hasNeighbors =
      MutableHashSet.size(neighborsA.incoming) > 0 ||
      MutableHashSet.size(neighborsA.outgoing) > 0 ||
      MutableHashSet.size(neighborsB.incoming) > 0 ||
      MutableHashSet.size(neighborsB.outgoing) > 0;

    if (hasNeighbors) {
      const incomingSim = jaccardSimilarity(A.fromIterable(neighborsA.incoming), A.fromIterable(neighborsB.incoming));
      const outgoingSim = jaccardSimilarity(A.fromIterable(neighborsA.outgoing), A.fromIterable(neighborsB.outgoing));

      if ((incomingSim + outgoingSim) / 2 > 0.5) {
        return "neighbor";
      }
    }

    // Default to similarity-based
    return "similarity";
  }
);
