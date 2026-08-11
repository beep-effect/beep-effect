/**
 * Quad Delta Computation Utility
 *
 * Computes the delta (new triples) between an original RDF store
 * and an enriched store after reasoning/inference operations.
 *
 * @since 2.0.0
 * @module Utils/QuadDelta
 */

import { Effect } from "effect"
import type * as N3 from "n3"
import type { RdfStore } from "../Service/Rdf.ts"

/**
 * Serializes a quad to a canonical string form for comparison.
 * Uses | as delimiter since it's unlikely in IRIs or literals.
 *
 * @internal
 */
const serializeQuad = (quad: N3.Quad): string => {
  const subject = quad.subject.termType === "NamedNode"
    ? quad.subject.value
    : `_:${quad.subject.value}`

  const predicate = quad.predicate.value

  const object = quad.object.termType === "Literal"
    ? `"${quad.object.value}"^^${(quad.object as N3.Literal).datatype?.value ?? "xsd:string"}`
    : quad.object.termType === "BlankNode"
    ? `_:${quad.object.value}`
    : quad.object.value

  const graph = quad.graph.termType === "DefaultGraph"
    ? ""
    : quad.graph.value

  return `${subject}|${predicate}|${object}|${graph}`
}

/**
 * Delta result containing new quads and statistics
 *
 * @since 2.0.0
 * @category Types
 */
export interface QuadDelta {
  /** Quads present in enriched but not in original */
  readonly newQuads: ReadonlyArray<N3.Quad>
  /** Count of original quads */
  readonly originalCount: number
  /** Count of enriched quads */
  readonly enrichedCount: number
  /** Count of new quads (enrichedCount - originalCount if no duplicates removed) */
  readonly deltaCount: number
}

/**
 * Computes the delta between two RDF stores.
 *
 * Returns quads that exist in the enriched store but not in the original.
 * Uses set difference on serialized quad strings for efficiency.
 *
 * @example
 * ```typescript
 * const delta = yield* computeQuadDelta(originalStore, enrichedStore)
 * console.log(`Inferred ${delta.deltaCount} new triples`)
 * ```
 *
 * @since 2.0.0
 * @category Functions
 */
export const computeQuadDelta = (
  original: RdfStore,
  enriched: RdfStore
): Effect.Effect<QuadDelta> =>
  Effect.sync(() => {
    const originalQuads = original._store.getQuads(null, null, null, null)
    const enrichedQuads = enriched._store.getQuads(null, null, null, null)

    // Build set of serialized original quads for O(1) lookup
    const originalSet = new Set<string>()
    for (const quad of originalQuads) {
      originalSet.add(serializeQuad(quad))
    }

    // Find quads in enriched that aren't in original
    const newQuads: Array<N3.Quad> = []
    for (const quad of enrichedQuads) {
      const serialized = serializeQuad(quad)
      if (!originalSet.has(serialized)) {
        newQuads.push(quad)
      }
    }

    return {
      newQuads,
      originalCount: originalQuads.length,
      enrichedCount: enrichedQuads.length,
      deltaCount: newQuads.length
    }
  })

/**
 * Groups delta quads by the predicate that produced them.
 *
 * Useful for understanding which reasoning rules contributed
 * to the inferred triples.
 *
 * @since 2.0.0
 * @category Functions
 */
export const groupDeltaByPredicate = (
  delta: QuadDelta
): Map<string, ReadonlyArray<N3.Quad>> => {
  const grouped = new Map<string, Array<N3.Quad>>()

  for (const quad of delta.newQuads) {
    const predicate = quad.predicate.value
    const existing = grouped.get(predicate) ?? []
    existing.push(quad)
    grouped.set(predicate, existing)
  }

  return grouped
}

/**
 * Filters delta to only include type inferences (rdf:type triples).
 *
 * @since 2.0.0
 * @category Functions
 */
export const filterTypeInferences = (
  delta: QuadDelta
): ReadonlyArray<N3.Quad> => {
  const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
  return delta.newQuads.filter((quad) => quad.predicate.value === RDF_TYPE)
}

/**
 * Creates a summary of the delta for logging/telemetry.
 *
 * @since 2.0.0
 * @category Functions
 */
export const summarizeDelta = (delta: QuadDelta): {
  readonly originalTriples: number
  readonly enrichedTriples: number
  readonly inferredTriples: number
  readonly inferenceRatio: number
  readonly predicateBreakdown: Record<string, number>
} => {
  const grouped = groupDeltaByPredicate(delta)
  const predicateBreakdown: Record<string, number> = {}

  for (const [predicate, quads] of grouped) {
    // Extract local name from IRI for readable keys
    const localName = predicate.split("#").pop() ?? predicate.split("/").pop() ?? predicate
    predicateBreakdown[localName] = quads.length
  }

  return {
    originalTriples: delta.originalCount,
    enrichedTriples: delta.enrichedCount,
    inferredTriples: delta.deltaCount,
    inferenceRatio: delta.originalCount > 0
      ? delta.deltaCount / delta.originalCount
      : 0,
    predicateBreakdown
  }
}
