/**
 * Quad Delta Computation Utility
 *
 * **Details**
 *
 * Computes the delta (new triples) between an original RDF store
 * and an enriched store after reasoning/inference operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { Quad } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { Effect, HashMap, MutableHashSet } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { RdfStore } from "../Service/Rdf.ts";
import { rdfStoreAllQuads } from "../Service/Rdf.ts";
import { dual2 } from "./Dual.ts";

/**
 * Serializes a quad to a canonical string form for comparison.
 * Uses | as delimiter since it's unlikely in IRIs or literals.
 *
 * @internal
 */
const serializeQuad = (quad: Quad): string => {
  const subject = quad.subject.termType === "NamedNode" ? quad.subject.value : `_:${quad.subject.value}`;

  const predicate = quad.predicate.value;

  const object =
    quad.object.termType === "Literal"
      ? `"${quad.object.value}"^^${quad.object.datatype.value}`
      : quad.object.termType === "BlankNode"
        ? `_:${quad.object.value}`
        : quad.object.value;

  const graph = quad.graph.termType === "DefaultGraph" ? "" : quad.graph.value;

  return `${subject}|${predicate}|${object}|${graph}`;
};

/**
 * Delta result containing new quads and statistics
 *
 * **Example** (Reference QuadDelta fields)
 *
 * ```ts
 * import type { QuadDelta } from "@effect-ontology/Utils/QuadDelta"
 *
 * const quadDeltaFields: ReadonlyArray<keyof QuadDelta> = ["newQuads", "originalCount", "enrichedCount"]
 *
 * console.log(quadDeltaFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface QuadDelta {
  /** Quads present in enriched but not in original */
  readonly newQuads: ReadonlyArray<Quad>;
  /** Count of original quads */
  readonly originalCount: number;
  /** Count of enriched quads */
  readonly enrichedCount: number;
  /** Count of new quads (enrichedCount - originalCount if no duplicates removed) */
  readonly deltaCount: number;
}

/**
 * Computes the delta between two RDF stores.
 *
 * **Details**
 *
 * Returns quads that exist in the enriched store but not in the original.
 * Uses set difference on serialized quad strings for efficiency.
 *
 * **Example** (Use computeQuadDelta)
 *
 * ```ts
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import { Effect } from "effect"
 * import { rdfStoreFromDataset } from "@effect-ontology/Service/Rdf"
 * import { computeQuadDelta } from "@effect-ontology/Utils/QuadDelta"
 *
 * const store = rdfStoreFromDataset(makeDataset([]))
 * const delta = computeQuadDelta(store, store)
 * console.log(Effect.isEffect(delta)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const computeQuadDelta = dual2(
  (original: RdfStore, enriched: RdfStore): Effect.Effect<QuadDelta> =>
    Effect.sync(() => {
      const originalQuads = rdfStoreAllQuads(original);
      const enrichedQuads = rdfStoreAllQuads(enriched);

      // Build set of serialized original quads for O(1) lookup
      const originalSet = MutableHashSet.empty<string>();
      for (const quad of originalQuads) {
        MutableHashSet.add(originalSet, serializeQuad(quad));
      }

      // Find quads in enriched that aren't in original
      const newQuads: Array<Quad> = [];
      for (const quad of enrichedQuads) {
        const serialized = serializeQuad(quad);
        if (!MutableHashSet.has(originalSet, serialized)) {
          newQuads.push(quad);
        }
      }

      return {
        newQuads,
        originalCount: originalQuads.length,
        enrichedCount: enrichedQuads.length,
        deltaCount: newQuads.length,
      };
    })
);

/**
 * Groups delta quads by the predicate that produced them.
 *
 * **Details**
 *
 * Useful for understanding which reasoning rules contributed
 * to the inferred triples.
 *
 * **Example** (Inspect group delta by predicate)
 *
 * ```ts
 * import { groupDeltaByPredicate } from "@effect-ontology/Utils/QuadDelta"
 *
 * console.log(groupDeltaByPredicate)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const groupDeltaByPredicate = (delta: QuadDelta): HashMap.HashMap<string, ReadonlyArray<Quad>> => {
  let grouped = HashMap.empty<string, ReadonlyArray<Quad>>();

  for (const quad of delta.newQuads) {
    const predicate = quad.predicate.value;
    const existing = O.getOrElse(HashMap.get(grouped, predicate), () => []);
    grouped = HashMap.set(grouped, predicate, [...existing, quad]);
  }

  return grouped;
};

/**
 * Filters delta to only include type inferences (rdf:type triples).
 *
 * **Example** (Inspect filter type inferences)
 *
 * ```ts
 * import { filterTypeInferences } from "@effect-ontology/Utils/QuadDelta"
 *
 * console.log(filterTypeInferences)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const filterTypeInferences = (delta: QuadDelta): ReadonlyArray<Quad> =>
  A.filter(delta.newQuads, (quad) => quad.predicate.value === RDF_TYPE.value);

/**
 * Creates a summary of the delta for logging/telemetry.
 *
 * **Example** (Inspect summarize delta)
 *
 * ```ts
 * import { summarizeDelta } from "@effect-ontology/Utils/QuadDelta"
 *
 * console.log(summarizeDelta)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const summarizeDelta = (
  delta: QuadDelta
): {
  readonly originalTriples: number;
  readonly enrichedTriples: number;
  readonly inferredTriples: number;
  readonly inferenceRatio: number;
  readonly predicateBreakdown: Record<string, number>;
} => {
  const grouped = groupDeltaByPredicate(delta);
  const predicateBreakdown: Record<string, number> = {};

  for (const [predicate, quads] of grouped) {
    // Extract local name from IRI for readable keys
    const localName = O.getOrElse(
      O.orElse(A.last(Str.split("#")(predicate)), () => A.last(Str.split("/")(predicate))),
      () => predicate
    );
    predicateBreakdown[localName] = quads.length;
  }

  return {
    originalTriples: delta.originalCount,
    enrichedTriples: delta.enrichedCount,
    inferredTriples: delta.deltaCount,
    inferenceRatio: delta.originalCount > 0 ? delta.deltaCount / delta.originalCount : 0,
    predicateBreakdown,
  };
};
