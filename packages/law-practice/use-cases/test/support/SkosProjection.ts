import * as Rdf from "@beep/rdf/Rdf";
import * as A from "effect/Array";
import type { ConceptScheme } from "@beep/ontology/ConceptScheme";
import type * as O from "effect/Option";

const skos = (local: string) => Rdf.makeNamedNode(`http://www.w3.org/2004/02/skos/core#${local}`);
const dct = (local: string) => Rdf.makeNamedNode(`http://purl.org/dc/terms/${local}`);
const rdfType = Rdf.makeNamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const versionInfo = Rdf.makeNamedNode("http://www.w3.org/2002/07/owl#versionInfo");

const text = (subject: Rdf.NamedNode, predicate: Rdf.NamedNode, value: O.Option<string>) =>
  A.map(A.fromOption(value), (entry) => Rdf.makeQuad(subject, predicate, Rdf.makeLiteral(entry)));

const schemeQuads = (scheme: ConceptScheme): ReadonlyArray<Rdf.Quad> => {
  const schemeNode = Rdf.makeNamedNode(scheme.iri);
  return [
    Rdf.makeQuad(schemeNode, rdfType, skos("ConceptScheme")),
    Rdf.makeQuad(schemeNode, dct("title"), Rdf.makeLiteral(scheme.prefLabel)),
    Rdf.makeQuad(schemeNode, versionInfo, Rdf.makeLiteral(scheme.version)),
    ...A.flatMap(A.fromIterable(scheme.concepts), (concept) => {
      const node = Rdf.makeNamedNode(concept.iri);
      return [
        Rdf.makeQuad(node, rdfType, skos("Concept")),
        Rdf.makeQuad(node, skos("inScheme"), schemeNode),
        Rdf.makeQuad(node, skos("prefLabel"), Rdf.makeLiteral(concept.prefLabel)),
        ...text(node, skos("notation"), concept.notation),
        ...text(node, skos("definition"), concept.definition),
        ...text(node, skos("scopeNote"), concept.scopeNote),
        ...A.map(A.fromOption(concept.source), (source) =>
          Rdf.makeQuad(node, dct("source"), Rdf.makeNamedNode(source))
        ),
        ...A.map(A.fromIterable(concept.broader), (broader) =>
          Rdf.makeQuad(node, skos("broader"), Rdf.makeNamedNode(broader))
        ),
      ];
    }),
  ];
};

export const skosDataset = (schemes: ReadonlyArray<ConceptScheme>): Rdf.Dataset =>
  Rdf.makeDataset(A.flatMap(schemes, schemeQuads));
