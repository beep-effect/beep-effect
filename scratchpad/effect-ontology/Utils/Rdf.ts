/**
 * Pure RDF term and quad construction helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Match from "effect/Match";
import * as Rec from "effect/Record";
import type * as N3 from "n3";
import type { Entity, Relation, RelationObject } from "../Domain/Model/Entity.ts";
import type { IRI as IriValue } from "../Domain/Model/shared.ts";
import { IRI } from "../Domain/Model/shared.ts";

/** Validated N3 term constructors used by the RDF service boundary. */
export interface N3TermBuilders {
  readonly namedNode: (iri: string) => N3.NamedNode;
  readonly literal: (value: string, languageOrDatatype?: string | N3.NamedNode) => N3.Literal;
  readonly quad: (
    subject: N3.Quad_Subject,
    predicate: N3.Quad_Predicate,
    object: N3.Quad_Object,
    graph?: N3.Quad_Graph
  ) => N3.Quad;
}

/** RDF namespace prefixes used while constructing datatype and label quads. */
export type RdfPrefixes = Readonly<Record<string, string>>;

/**
 * Build and validate an IRI from a namespace and local identifier.
 *
 * @param baseNamespace - Namespace prepended to the local identifier.
 * @param localName - Local identifier appended to the namespace.
 * @returns The validated combined IRI.
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const buildIri = (baseNamespace: string, localName: string): IriValue =>
  IRI.fromUnknown(`${baseNamespace}${localName}`);

/**
 * Wrap N3 constructors with schema validation for named nodes.
 *
 * @param dataFactory - N3 data factory supplying the primitive constructors.
 * @param validateIris - Whether named-node inputs must pass the canonical IRI schema.
 * @returns Validating N3 term constructors.
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const createN3Builders = (dataFactory: typeof N3.DataFactory, validateIris = true): N3TermBuilders => ({
  namedNode: (iri) => dataFactory.namedNode(validateIris ? IRI.fromUnknown(iri) : iri),
  literal: dataFactory.literal,
  quad: dataFactory.quad,
});

const valueToLiteral = (
  value: string | number | boolean,
  prefixes: RdfPrefixes,
  builders: N3TermBuilders
): N3.Literal => {
  if (typeof value === "string") return builders.literal(value);
  const lexicalValue = `${value}`;
  const datatype =
    typeof value === "boolean"
      ? `${prefixes.xsd}boolean`
      : Number.isInteger(value)
        ? `${prefixes.xsd}integer`
        : `${prefixes.xsd}decimal`;
  return builders.literal(lexicalValue, builders.namedNode(datatype));
};

const typeQuad = (subject: N3.NamedNode, typeIri: string, prefixes: RdfPrefixes, builders: N3TermBuilders): N3.Quad =>
  builders.quad(subject, builders.namedNode(`${prefixes.rdf}type`), builders.namedNode(typeIri));

/**
 * Convert an extracted entity into RDF type, label, and attribute quads.
 *
 * @param entity - Schema-backed extracted entity.
 * @param baseNamespace - Namespace used for the entity subject.
 * @param prefixes - RDF namespace prefixes.
 * @param builders - Validating N3 term constructors.
 * @returns RDF quads representing the entity.
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const entityToQuads = (
  entity: Entity,
  baseNamespace: string,
  prefixes: RdfPrefixes,
  builders: N3TermBuilders
): ReadonlyArray<N3.Quad> => {
  const subject = builders.namedNode(buildIri(baseNamespace, entity.id));
  const typeQuads = A.map(entity.types, (typeIri) => typeQuad(subject, typeIri, prefixes, builders));
  const labelQuad = builders.quad(
    subject,
    builders.namedNode(`${prefixes.rdfs}label`),
    builders.literal(entity.mention)
  );
  const attributeQuads = A.map(Rec.toEntries(entity.attributes), ([predicate, value]) => {
    const predicateIri = IRI.is(predicate) ? predicate : `${prefixes.schema ?? baseNamespace}${predicate}`;
    return builders.quad(subject, builders.namedNode(predicateIri), valueToLiteral(value, prefixes, builders));
  });
  return A.append(A.appendAll(typeQuads, attributeQuads), labelQuad);
};

const relationObjectToTerm = (
  object: RelationObject,
  baseNamespace: string,
  prefixes: RdfPrefixes,
  builders: N3TermBuilders
): N3.Quad_Object =>
  Match.value(object).pipe(
    Match.tagsExhaustive({
      EntityReference: ({ value }) => builders.namedNode(buildIri(baseNamespace, value)),
      Text: ({ value }) => valueToLiteral(value, prefixes, builders),
      Number: ({ value }) => valueToLiteral(value, prefixes, builders),
      Boolean: ({ value }) => valueToLiteral(value, prefixes, builders),
    })
  );

/**
 * Convert a schema-backed relation into one RDF quad.
 *
 * @param relation - Relation whose object is explicitly tagged as a reference or literal.
 * @param baseNamespace - Namespace used for entity identifiers.
 * @param prefixes - RDF namespace prefixes.
 * @param builders - Validating N3 term constructors.
 * @returns The RDF quad representing the relation.
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const relationToQuad = (
  relation: Relation,
  baseNamespace: string,
  prefixes: RdfPrefixes,
  builders: N3TermBuilders
): N3.Quad =>
  builders.quad(
    builders.namedNode(buildIri(baseNamespace, relation.subjectId)),
    builders.namedNode(relation.predicate),
    relationObjectToTerm(relation.object, baseNamespace, prefixes, builders)
  );
