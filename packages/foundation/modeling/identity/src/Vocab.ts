/**
 * Static RDF vocabulary registry for identity CURIE literals.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Registry shape consumed by identity CURIE type helpers and codecs.
 *
 * @example
 * ```ts
 * import type { VocabShape } from "@beep/identity"
 *
 * const vocab = {
 *   ex: {
 *     iri: "https://example.test/ns#",
 *     terms: ["Thing"],
 *   },
 * } as const satisfies VocabShape
 *
 * console.log(vocab.ex.iri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VocabShape = Readonly<
  Record<
    string,
    {
      readonly iri: string;
      readonly terms: readonly string[];
    }
  >
>;

type TermOf<V extends VocabShape, Prefix extends keyof V & string> = V[Prefix]["terms"][number] & string;

/**
 * Core borrowed vocabulary registry used by identity CURIE helpers.
 *
 * @example
 * ```ts
 * import { CoreVocab } from "@beep/identity"
 *
 * const iri = `${CoreVocab.skos.iri}prefLabel`
 * console.log(iri) // "http://www.w3.org/2004/02/skos/core#prefLabel"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CoreVocab = {
  rdf: {
    iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    terms: [
      "Alt",
      "Bag",
      "HTML",
      "List",
      "Property",
      "Seq",
      "Statement",
      "XMLLiteral",
      "first",
      "langString",
      "nil",
      "object",
      "predicate",
      "rest",
      "subject",
      "type",
      "value",
    ] as const,
  },
  rdfs: {
    iri: "http://www.w3.org/2000/01/rdf-schema#",
    terms: [
      "Class",
      "Container",
      "ContainerMembershipProperty",
      "Datatype",
      "Literal",
      "Resource",
      "comment",
      "domain",
      "isDefinedBy",
      "label",
      "member",
      "range",
      "seeAlso",
      "subClassOf",
      "subPropertyOf",
    ] as const,
  },
  skos: {
    iri: "http://www.w3.org/2004/02/skos/core#",
    terms: [
      "Collection",
      "Concept",
      "ConceptScheme",
      "OrderedCollection",
      "altLabel",
      "broadMatch",
      "broader",
      "broaderTransitive",
      "changeNote",
      "closeMatch",
      "definition",
      "editorialNote",
      "exactMatch",
      "example",
      "hasTopConcept",
      "hiddenLabel",
      "historyNote",
      "inScheme",
      "mappingRelation",
      "member",
      "memberList",
      "narrowMatch",
      "narrower",
      "narrowerTransitive",
      "notation",
      "note",
      "prefLabel",
      "related",
      "relatedMatch",
      "scopeNote",
      "semanticRelation",
      "topConceptOf",
    ] as const,
  },
  owl: {
    iri: "http://www.w3.org/2002/07/owl#",
    terms: [
      "AnnotationProperty",
      "AsymmetricProperty",
      "Class",
      "DatatypeProperty",
      "FunctionalProperty",
      "InverseFunctionalProperty",
      "IrreflexiveProperty",
      "NamedIndividual",
      "Nothing",
      "ObjectProperty",
      "Ontology",
      "ReflexiveProperty",
      "SymmetricProperty",
      "Thing",
      "TransitiveProperty",
      "backwardCompatibleWith",
      "deprecated",
      "equivalentClass",
      "equivalentProperty",
      "imports",
      "incompatibleWith",
      "inverseOf",
      "priorVersion",
      "sameAs",
      "versionInfo",
    ] as const,
  },
  dcterms: {
    iri: "http://purl.org/dc/terms/",
    terms: [
      "Agent",
      "AgentClass",
      "BibliographicResource",
      "Box",
      "DCMIType",
      "DDC",
      "FileFormat",
      "Frequency",
      "IMT",
      "ISO3166",
      "ISO639-2",
      "ISO639-3",
      "Jurisdiction",
      "LCC",
      "LCSH",
      "LicenseDocument",
      "LinguisticSystem",
      "Location",
      "LocationPeriodOrJurisdiction",
      "MESH",
      "MediaType",
      "MediaTypeOrExtent",
      "MethodOfAccrual",
      "MethodOfInstruction",
      "NLM",
      "Period",
      "PeriodOfTime",
      "PhysicalMedium",
      "PhysicalResource",
      "Point",
      "Policy",
      "ProvenanceStatement",
      "RFC1766",
      "RFC3066",
      "RFC4646",
      "RFC5646",
      "RightsStatement",
      "SizeOrDuration",
      "Standard",
      "TGN",
      "UDC",
      "URI",
      "W3CDTF",
      "abstract",
      "accessRights",
      "accrualMethod",
      "accrualPeriodicity",
      "accrualPolicy",
      "alternative",
      "audience",
      "available",
      "bibliographicCitation",
      "conformsTo",
      "contributor",
      "coverage",
      "created",
      "creator",
      "date",
      "dateAccepted",
      "dateCopyrighted",
      "dateSubmitted",
      "description",
      "educationLevel",
      "extent",
      "format",
      "hasFormat",
      "hasPart",
      "hasVersion",
      "identifier",
      "instructionalMethod",
      "isFormatOf",
      "isPartOf",
      "isReferencedBy",
      "isReplacedBy",
      "isRequiredBy",
      "isVersionOf",
      "issued",
      "language",
      "license",
      "mediator",
      "medium",
      "modified",
      "provenance",
      "publisher",
      "references",
      "relation",
      "replaces",
      "requires",
      "rights",
      "rightsHolder",
      "source",
      "spatial",
      "subject",
      "tableOfContents",
      "temporal",
      "title",
      "type",
      "valid",
    ] as const,
  },
} as const satisfies VocabShape;

/**
 * Runtime type for {@link CoreVocab}.
 *
 * @example
 * ```ts
 * import { CoreVocab, type CoreVocab as CoreVocabType } from "@beep/identity"
 *
 * const vocab: CoreVocabType = CoreVocab
 * console.log(vocab.rdf.terms.includes("type"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CoreVocab = typeof CoreVocab;

/**
 * Literal CURIE union derived from a vocabulary registry.
 *
 * @example
 * ```ts
 * import { CoreVocab, type Curie } from "@beep/identity"
 *
 * const curie: Curie<typeof CoreVocab> = "skos:prefLabel"
 * console.log(curie)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Curie<V extends VocabShape> = {
  readonly [Prefix in keyof V & string]: `${Prefix}:${TermOf<V, Prefix>}`;
}[keyof V & string];

/**
 * Forward or inverse predicate CURIE derived from a vocabulary registry.
 *
 * @example
 * ```ts
 * import { CoreVocab, type Predicate } from "@beep/identity"
 *
 * const predicate: Predicate<typeof CoreVocab> = "^rdfs:subClassOf"
 * console.log(predicate)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Predicate<V extends VocabShape> = Curie<V> | `^${Curie<V>}`;

/**
 * Type-level expansion from a known CURIE to its exact IRI literal.
 *
 * @example
 * ```ts
 * import { CoreVocab, type Expand } from "@beep/identity"
 *
 * const iri: Expand<"skos:prefLabel", typeof CoreVocab> = "http://www.w3.org/2004/02/skos/core#prefLabel"
 * console.log(iri)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Expand<C extends string, V extends VocabShape> = C extends `${infer Prefix}:${infer Term}`
  ? Prefix extends keyof V & string
    ? Term extends TermOf<V, Prefix>
      ? `${V[Prefix]["iri"]}${Term}`
      : never
    : never
  : never;

/**
 * Merge a base registry with literal-preserving extension vocabulary data.
 *
 * @example
 * ```ts
 * import { CoreVocab, mergeVocab } from "@beep/identity"
 *
 * const vocab = mergeVocab(CoreVocab, {
 *   ex: {
 *     iri: "https://example.test/ns#",
 *     terms: ["Thing"],
 *   },
 * } as const)
 *
 * console.log(vocab.ex.terms[0]) // "Thing"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const mergeVocab = <const Base extends VocabShape, const Extension extends VocabShape>(
  base: Base,
  extension: Extension
) =>
  ({
    ...base,
    ...extension,
  }) satisfies VocabShape;
