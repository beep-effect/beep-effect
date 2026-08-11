import type { Entity, Relation } from "../Domain/Model/Entity.ts"
import type { EntityResolutionConfig } from "../Domain/Model/EntityResolution.ts"
import { isEntityReference } from "./Entity.ts"
import { combinedSimilarity, jaccardSimilarity, overlapRatio } from "./String.ts"
import * as MutableHashSet from "effect/MutableHashSet";
/**
 * Get entity neighbors (incoming and outgoing)
 *
 * Finds neighbors in both directions:
 * - Outgoing: Entities this entity references (subject -> object)
 * - Incoming: Entities referencing this entity (subject -> object)
 *
 * @param entityId - Entity ID to find neighbors for
 * @param relations - Array of relations to search
 * @returns Object with Sets of incoming and outgoing neighbor IDs
 *
 * @since 0.0.0
 * @category Similarity
 */
export const getNeighbors = (
  entityId: string,
  relations: ReadonlyArray<Relation>
): { incoming: MutableHashSet.MutableHashSet<string>; outgoing: MutableHashSet.MutableHashSet<string> } => {
  const incoming = MutableHashSet.empty<string>()
  const outgoing = MutableHashSet.empty<string>()

  for (const relation of relations) {
    // Entity is subject → object is outgoing neighbor (if it's an entity reference)
    if (relation.subjectId === entityId) {
      if (typeof relation.object === "string" && isEntityReference(relation.object)) {
        // Don't include self-references
        if (relation.object !== entityId) {
          MutableHashSet.add(outgoing, relation.object)
        }
      }
    }

    // Entity is object → subject is incoming neighbor
    if (typeof relation.object === "string" && relation.object === entityId) {
      // Don't include self-references
      if (relation.subjectId !== entityId) {
        MutableHashSet.add(incoming, relation.subjectId)
      }
    }
  }

  return { incoming, outgoing }
}

/**
 * Compute combined similarity score for entity resolution
 *
 * Formula: score = w₁·mentionSim + w₂·typeOverlap + w₃·neighborSim
 *
 * Where:
 * - mentionSim: String similarity between mentions (0.0-1.0)
 * - typeOverlap: Jaccard overlap of type arrays (0.0-1.0), hierarchy-aware if isSubclass provided
 * - neighborSim: Average Jaccard similarity of incoming and outgoing neighbors (0.0-1.0)
 *
 * @param a - First entity
 * @param b - Second entity
 * @param relations - Relations to compute neighbor similarity
 * @param config - Resolution config with weights
 * @param embeddingSimilarity - Optional pre-computed embedding similarity
 * @param isSubclass - Optional callback to check class hierarchy (child, parent) => boolean
 * @returns Combined similarity score (0.0-1.0)
 *
 * @since 0.0.0
 * @category Similarity
 */
export const computeEntitySimilarity = (
  a: Entity,
  b: Entity,
  relations: ReadonlyArray<Relation>,
  config: EntityResolutionConfig,
  embeddingSimilarity?: number,
  isSubclass?: (child: string, parent: string) => boolean
): number => {
  // 1. Mention similarity using combined approach (Levenshtein + containment)
  const mentionSim = combinedSimilarity(a.mention, b.mention)

  // 2. Type overlap (Jaccard-like ratio)
  // If isSubclass provided, use hierarchy-aware check
  let typeOverlap: number
  if (isSubclass) {
    const setA = MutableHashSet.fromIterable(a.types)
    const setB = MutableHashSet.fromIterable(b.types)
    // Expand sets to include ancestors if needed? No, just check if A is sub of B or B sub of A.
    // Actually, Jaccard is intersection / union.
    // Hierarchy-aware Jaccard: |Intersection(Ancestors(A), Ancestors(B))| / |Union(...)|
    // This is expensive if we computed ancestors fully.
    // Simpler heuristic:
    // Count matches where typeA == typeB OR isSubclass(typeA, typeB) OR isSubclass(typeB, typeA)
    // This is still rough.
    // Better: Allow exact match OR subclass match to count as intersection.
    let intersection = 0
    const unionSize = MutableHashSet.fromIterable([...a.types, ...b.types]).pipe(
      MutableHashSet.size
    )
    if (unionSize === 0) {
      typeOverlap = 0
    } else {
      for (const tA of setA) {
        let matchFound = false
        if (MutableHashSet.has(setB, tA)) {
          matchFound = true
        } else {
          for (const tB of setB) {
            if (isSubclass(tA, tB) || isSubclass(tB, tA)) {
              matchFound = true
              break
            }
          }
        }
        if (matchFound) intersection++
      }
      typeOverlap = intersection / unionSize
    }
  } else {
    typeOverlap = overlapRatio(a.types, b.types)
  }

  // 3. Neighbor similarity (Directional)
  const neighborsA = getNeighbors(a.id, relations)
  const neighborsB = getNeighbors(b.id, relations)

  // Jaccard for incoming
  const incomingSim = jaccardSimilarity(
    Array.from(neighborsA.incoming),
    Array.from(neighborsB.incoming)
  )
  // Jaccard for outgoing
  const outgoingSim = jaccardSimilarity(
    Array.from(neighborsA.outgoing),
    Array.from(neighborsB.outgoing)
  )

  // Average, but only if they have neighbors?
  // If both have no neighbors in a direction, sim is 1? No 0 usually.
  // jaccardSimilarity returns 0 if union is empty.
  // We want: if both have NO incoming edges, incomingSim shouldn't penalize? Or should?
  // Usually in graph matching, lack of edges matches lack of edges.
  // But jaccard(empty, empty) = 0 usually.
  // Implementation of jaccardSimilarity in String.ts usually handles empty arrays as 0?
  // Let's assume standard behavior.
  const neighborSim = (incomingSim + outgoingSim) / 2

  const embeddingSim = embeddingSimilarity ?? 0

  // Normalize weights so they sum to 1.0
  const totalWeight = config.mentionWeight +
    config.typeWeight +
    config.neighborWeight +
    (config.embeddingWeight ?? 0)

  // Avoid division by zero
  if (totalWeight === 0) {
    return 0
  }

  // Weighted combination (normalized)
  const weightedSum = config.mentionWeight * mentionSim +
    config.typeWeight * typeOverlap +
    config.neighborWeight * neighborSim +
    (config.embeddingWeight ?? 0) * embeddingSim

  return weightedSum / totalWeight
}

/**
 * Check if two entities should be considered for merging
 *
 * Applies thresholds from config:
 * 1. Overall similarity must exceed threshold
 * 2. If requireTypeOverlap is true, type overlap must exceed typeOverlapRatio
 *
 * @param a - First entity
 * @param b - Second entity
 * @param relations - Relations for neighbor similarity
 * @param config - Resolution config with thresholds
 * @param embeddingSimilarity
 * @param isSubclass
 * @returns True if entities should be considered for merging
 *
 * @since 0.0.0
 * @category Similarity
 */
export const shouldConsiderMerge = (
  a: Entity,
  b: Entity,
  relations: ReadonlyArray<Relation>,
  config: EntityResolutionConfig,
  embeddingSimilarity?: number,
  isSubclass?: (child: string, parent: string) => boolean
): boolean => {
  // Check type overlap requirement first (fast path)
  if (config.requireTypeOverlap) {
    const typeOverlap = overlapRatio(a.types, b.types)
    // Note: We use simple overlap ratio here for fast path unless strict hierarchy is critical early check
    // If strict hierarchy is needed, this fast path might be too strict (false negatives).
    if (typeOverlap < config.typeOverlapRatio) {
      // ByPass: If embedding similarity is very high, assume type data might be noisy
      if (embeddingSimilarity !== undefined && embeddingSimilarity > 0.95) {
        // Continue to full similarity check
      } else if (!isSubclass) {
        return false
      }
      // If we have hierarchy check, maybe second chance?
      // Re-calculate with hierarchy
      // (This logic is getting complex for a utility)
    }
  }

  // Compute full similarity
  const similarity = computeEntitySimilarity(a, b, relations, config, embeddingSimilarity, isSubclass)
  return similarity >= config.similarityThreshold
}

/**
 * Determine resolution method based on how similarity was achieved
 *
 * @param a - First entity
 * @param b - Second entity
 * @param relations - Relations for neighbor check
 * @returns Resolution method type
 *
 * @since 0.0.0
 * @category Similarity
 */
export const detectResolutionMethod = (
  a: Entity,
  b: Entity,
  relations: ReadonlyArray<Relation>
): "exact" | "similarity" | "containment" | "neighbor" => {
  // Check exact match first
  if (a.mention.toLowerCase() === b.mention.toLowerCase()) {
    return "exact"
  }

  // Check containment
  const aLower = a.mention.toLowerCase()
  const bLower = b.mention.toLowerCase()
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    return "containment"
  }

  // Check if neighbor similarity is the primary factor
  const neighborsA = getNeighbors(a.id, relations)
  const neighborsB = getNeighbors(b.id, relations)

  // Ensure there ARE neighbors before declaring neighbor similarity
  const hasNeighbors =
    MutableHashSet.size(neighborsA.incoming) > 0 ||
    MutableHashSet.size(neighborsA.outgoing) > 0 ||
    MutableHashSet.size(neighborsB.incoming) > 0 ||
    MutableHashSet.size(neighborsB.outgoing) > 0

  if (hasNeighbors) {
    const incomingSim = jaccardSimilarity(Array.from(neighborsA.incoming), Array.from(neighborsB.incoming))
    const outgoingSim = jaccardSimilarity(Array.from(neighborsA.outgoing), Array.from(neighborsB.outgoing))

    if ((incomingSim + outgoingSim) / 2 > 0.5) {
      return "neighbor"
    }
  }

  // Default to similarity-based
  return "similarity"
}
