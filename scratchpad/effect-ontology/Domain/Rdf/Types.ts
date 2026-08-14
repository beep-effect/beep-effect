/**
 * Canonical RDF value types used by the effect-ontology experiment.
 *
 * Standard RDF terms remain owned by `@beep/rdf`. The only local model is
 * {@link Triple}, a graph-free adapter that converts explicitly to and from a
 * canonical RDF/JS {@link Quad}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId, SafePnLocal } from "@beep/identity";
import {
  AbsoluteIRI,
  BlankNode,
  DefaultGraph,
  GraphTerm,
  IRI,
  Literal,
  makeBlankNode,
  makeLiteral,
  makeNamedNode,
  makeQuad,
  NamedNode,
  ObjectTerm,
  Quad,
  Subject,
} from "@beep/rdf";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Domain/Rdf/Types");

export {
  AbsoluteIRI,
  BlankNode,
  DefaultGraph,
  GraphTerm,
  IRI,
  Literal,
  makeBlankNode,
  makeLiteral,
  makeNamedNode,
  makeQuad,
  NamedNode,
  ObjectTerm,
  Quad,
  Subject,
};

/**
 * Turtle-safe local component of an RDF name.
 *
 * **Example** (Create a local name)
 *
 * ```ts
 * import { LocalName } from "@effect-ontology/Rdf/Types.ts"
 *
 * console.log(LocalName.fromUnknown("prefLabel"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LocalName = SafePnLocal.pipe(
  S.brand("LocalName"),
  $I.annoteSchema("LocalName", {
    description: "Turtle-safe PN_LOCAL value used as the local component of an IRI.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({ decodeSync: S.decodeSync(schema) }))
);

/**
 * Runtime value decoded by {@link LocalName}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type LocalName = typeof LocalName.Type;

/**
 * Graph-independent RDF statement backed by canonical RDF/JS terms.
 *
 * **Example** (Convert a triple to a default-graph quad)
 *
 * ```ts
 * import { Triple, makeLiteral, makeNamedNode } from "@effect-ontology/Rdf/Types.ts"
 *
 * const triple = Triple.make({
 *   subject: makeNamedNode("https://example.org/ada"),
 *   predicate: makeNamedNode("https://schema.org/name"),
 *   object: makeLiteral("Ada", "http://www.w3.org/2001/XMLSchema#string")
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
   * import { Triple, makeLiteral, makeNamedNode, makeQuad } from "@effect-ontology/Rdf/Types.ts"
   *
   * const quad = makeQuad(
   *   makeNamedNode("https://example.org/ada"),
   *   makeNamedNode("https://schema.org/name"),
   *   makeLiteral("Ada", "http://www.w3.org/2001/XMLSchema#string")
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
   * import { Triple, makeLiteral, makeNamedNode } from "@effect-ontology/Rdf/Types.ts"
   *
   * const triple = Triple.make({
   *   subject: makeNamedNode("https://example.org/ada"),
   *   predicate: makeNamedNode("https://schema.org/name"),
   *   object: makeLiteral("Ada", "http://www.w3.org/2001/XMLSchema#string")
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
