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

import { $ScratchpadId } from "@beep/identity";
import { Quad } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { NonNegativeInt } from "@beep/schema";
import { Effect, HashMap, MutableHashSet } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { RdfError } from "../Domain/Error/Rdf.ts";
import type { RdfStore } from "../Service/Rdf.ts";
import { rdfStoreAllQuads } from "../Service/Rdf.ts";
import { dual2 } from "./Dual.ts";

const $I = $ScratchpadId.create("effect-ontology/Utils/QuadDelta");

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
 * **Example** (Construct an empty delta)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { QuadDelta } from "@effect-ontology/Utils/QuadDelta"
 *
 * const delta = QuadDelta.make({
 *   newQuads: [],
 *   originalCount: NonNegativeInt.make(0),
 *   enrichedCount: NonNegativeInt.make(0),
 *   deltaCount: NonNegativeInt.make(0)
 * })
 * console.log(delta.deltaCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuadDelta extends S.Class<QuadDelta>($I`QuadDelta`)(
  {
    newQuads: S.Array(Quad).annotateKey({ description: "Quads present in the enriched graph only." }),
    originalCount: NonNegativeInt.annotateKey({ description: "Number of quads in the original graph." }),
    enrichedCount: NonNegativeInt.annotateKey({ description: "Number of quads in the enriched graph." }),
    deltaCount: NonNegativeInt.annotateKey({ description: "Number of newly inferred quads." }),
  },
  $I.annote("QuadDelta", {
    description: "New RDF quads and non-negative graph-size statistics for one enrichment delta.",
  })
) {}

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
 * const delta = Effect.runSync(computeQuadDelta(store, store))
 * console.log(delta.deltaCount) // 0
 * console.log(delta.newQuads.length) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const computeQuadDelta: {
  (original: RdfStore, enriched: RdfStore): Effect.Effect<QuadDelta, RdfError>;
  (enriched: RdfStore): (original: RdfStore) => Effect.Effect<QuadDelta, RdfError>;
} = dual2(
  (original: RdfStore, enriched: RdfStore): Effect.Effect<QuadDelta, RdfError> =>
    Effect.gen(function* () {
      const originalQuads = yield* rdfStoreAllQuads(original);
      const enrichedQuads = yield* rdfStoreAllQuads(enriched);

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

      return QuadDelta.make({
        newQuads,
        originalCount: NonNegativeInt.make(originalQuads.length),
        enrichedCount: NonNegativeInt.make(enrichedQuads.length),
        deltaCount: NonNegativeInt.make(newQuads.length),
      });
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
 * **Example** (Group an empty delta)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import * as HashMap from "effect/HashMap"
 * import { groupDeltaByPredicate, QuadDelta } from "@effect-ontology/Utils/QuadDelta"
 *
 * const zero = NonNegativeInt.make(0)
 * console.log(HashMap.size(groupDeltaByPredicate(QuadDelta.make({ newQuads: [], originalCount: zero, enrichedCount: zero, deltaCount: zero })))) // 0
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
 * **Example** (Filter an empty delta)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { filterTypeInferences, QuadDelta } from "@effect-ontology/Utils/QuadDelta"
 *
 * const zero = NonNegativeInt.make(0)
 * console.log(filterTypeInferences(QuadDelta.make({ newQuads: [], originalCount: zero, enrichedCount: zero, deltaCount: zero })).length) // 0
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
 * **Example** (Summarize an empty delta)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { summarizeDelta, QuadDelta } from "@effect-ontology/Utils/QuadDelta"
 *
 * const zero = NonNegativeInt.make(0)
 * console.log(summarizeDelta(QuadDelta.make({ newQuads: [], originalCount: zero, enrichedCount: zero, deltaCount: zero })).inferenceRatio) // 0
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
