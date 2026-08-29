/**
 * Canonical RDF value types used by the effect-ontology experiment.
 *
 * **Details**
 *
 * Standard RDF terms remain owned by `@beep/rdf`. The only local model is
 * {@link Triple}, a graph-free adapter that converts explicitly to and from a
 * canonical RDF/JS {@link Quad}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import type { GraphTerm, Quad } from "@beep/rdf";
import { makeQuad, NamedNode, ObjectTerm, Subject } from "@beep/rdf";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Domain/Rdf/Types");

/**
 * Graph-independent RDF statement backed by canonical RDF/JS terms.
 *
 * **Example** (Convert a triple to a default-graph quad)
 *
 * ```ts
 * import { makeLiteral, makeNamedNode } from "@beep/rdf"
 * import { Triple } from "@effect-ontology/Rdf/Types"
 *
 * const triple = Triple.make({
 *   subject: makeNamedNode("https://example.org/ada"),
 *   predicate: makeNamedNode("https://schema.org/name"),
 *   object: makeLiteral("Ada", "https://www.w3.org/2001/XMLSchema#string")
 * })
 * console.log(triple.toQuad().graph.termType) // "DefaultGraph"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Triple extends S.Class<Triple>($I`Triple`)(
  {
    subject: Subject,
    predicate: NamedNode,
    object: ObjectTerm,
  },
  $I.annote("Triple", {
    description: "Graph-independent RDF statement containing canonical RDF/JS subject, predicate, and object terms.",
  })
) {
  /**
   * Discard graph scope from a canonical quad.
   *
   * **Example** (Project a quad)
   *
   * ```ts
   * import { makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf"
   * import { Triple } from "@effect-ontology/Rdf/Types"
   *
   * const quad = makeQuad(
   *   makeNamedNode("https://example.org/ada"),
   *   makeNamedNode("https://schema.org/name"),
   *   makeLiteral("Ada", "https://www.w3.org/2001/XMLSchema#string")
   * )
   * console.log(Triple.fromQuad(quad).predicate.value)
   * ```
   *
   * @param quad - Canonical RDF/JS quad to project.
   * @returns A graph-independent triple with the same statement terms.
   * @since 0.0.0
   */
  static readonly fromQuad = (quad: Quad): Triple =>
    Triple.make({
      subject: quad.subject,
      predicate: quad.predicate,
      object: quad.object,
    });

  /**
   * Convert this statement to a canonical RDF/JS quad.
   *
   * **Example** (Attach a named graph)
   *
   * ```ts
   * import { makeLiteral, makeNamedNode } from "@beep/rdf"
   * import { Triple } from "@effect-ontology/Rdf/Types"
   *
   * const triple = Triple.make({
   *   subject: makeNamedNode("https://example.org/ada"),
   *   predicate: makeNamedNode("https://schema.org/name"),
   *   object: makeLiteral("Ada", "https://www.w3.org/2001/XMLSchema#string")
   * })
   * console.log(triple.toQuad(makeNamedNode("https://example.org/people")).graph.termType)
   * ```
   *
   * @param graph - Optional canonical graph term; omission selects the default graph.
   * @returns A canonical RDF/JS quad.
   * @since 0.0.0
   */
  toQuad(graph?: GraphTerm): Quad {
    return graph === undefined
      ? makeQuad(this.subject, this.predicate, this.object)
      : makeQuad(this.subject, this.predicate, { object: this.object, graph });
  }
}
