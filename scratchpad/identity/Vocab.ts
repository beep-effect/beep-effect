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

export const CoreVocab = {
  rdf: {
    iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    terms: ["type", "value", "first", "rest", "Property"] as const,
  },
  rdfs: {
    iri: "http://www.w3.org/2000/01/rdf-schema#",
    terms: ["label", "comment", "subClassOf", "subPropertyOf", "domain", "range", "seeAlso", "isDefinedBy", "Class"] as const,
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
    terms: ["Class", "ObjectProperty", "DatatypeProperty", "sameAs", "equivalentClass", "inverseOf", "deprecated", "Thing"] as const,
  },
  dcterms: {
    iri: "http://purl.org/dc/terms/",
    terms: ["identifier", "description", "source", "title", "creator"] as const,
  },
} as const satisfies VocabShape;

export type CoreVocab = typeof CoreVocab;

export type Curie<V extends VocabShape> = {
  readonly [Prefix in keyof V & string]: `${Prefix}:${TermOf<V, Prefix>}`;
}[keyof V & string];

export type Predicate<V extends VocabShape> = Curie<V> | `^${Curie<V>}`;

export type Expand<C extends string, V extends VocabShape> = C extends `${infer Prefix}:${infer Term}`
  ? Prefix extends keyof V & string
    ? Term extends TermOf<V, Prefix>
      ? `${V[Prefix]["iri"]}${Term}`
      : never
    : never
  : never;

export const mergeVocab = <const Base extends VocabShape, const Extension extends VocabShape>(
  base: Base,
  extension: Extension
) =>
  ({
    ...base,
    ...extension,
  }) satisfies VocabShape;
