/**
 * The RDF projection of an assembled ontology.
 *
 * **Details**
 *
 * `toDataset` is the fold's only RDF arrow: a pure, ground catamorphism over
 * the assembled value. Serializations such as Turtle are a driver's job over
 * the returned dataset.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/identity/Iri";
import * as Registry from "@beep/identity/Registry";
import * as Rdf from "@beep/rdf/Rdf";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import type {
  AssembledClass,
  AssembledFact,
  AssembledOntology,
  AssembledPredicate,
  SkosClassification,
} from "./Fold.models.ts";

const term = (curie: Registry.RegistryCurie): Rdf.NamedNode => Rdf.makeNamedNode(IRI.make(Registry.iri(curie)));

const RDF_TYPE = term("rdf:type");
const RDFS_CLASS = term("rdfs:Class");
const RDFS_LABEL = term("rdfs:label");
const RDFS_COMMENT = term("rdfs:comment");
const RDFS_DOMAIN = term("rdfs:domain");
const RDFS_RANGE = term("rdfs:range");
const RDFS_LITERAL = term("rdfs:Literal");
const OWL_DATATYPE_PROPERTY = term("owl:DatatypeProperty");
const OWL_OBJECT_PROPERTY = term("owl:ObjectProperty");
const SKOS_CONCEPT = term("skos:Concept");
const SKOS_CONCEPT_SCHEME = term("skos:ConceptScheme");

const skosType = (marker: SkosClassification): Rdf.NamedNode =>
  marker === "concept" ? SKOS_CONCEPT : SKOS_CONCEPT_SCHEME;

const commentQuads = (subject: Rdf.NamedNode, description: O.Option<string>): ReadonlyArray<Rdf.Quad> =>
  O.match(description, {
    onNone: A.empty,
    onSome: (text) => [Rdf.makeQuad(subject, RDFS_COMMENT, Rdf.makeLiteral(text))],
  });

const classQuads = (assembled: AssembledClass): ReadonlyArray<Rdf.Quad> => {
  const subject = Rdf.makeNamedNode(assembled.iri);

  return [
    Rdf.makeQuad(subject, RDF_TYPE, RDFS_CLASS),
    ...O.match(assembled.skos, {
      onNone: A.empty,
      onSome: (marker) => [Rdf.makeQuad(subject, RDF_TYPE, skosType(marker))],
    }),
    Rdf.makeQuad(subject, RDFS_LABEL, Rdf.makeLiteral(assembled.name)),
    ...commentQuads(subject, assembled.description),
  ];
};

const isOwnedPredicate = (ontology: AssembledOntology, predicate: AssembledPredicate): boolean =>
  Str.startsWith(ontology.baseIri)(predicate.termIri);

const predicateQuads = (assembled: AssembledClass, predicate: AssembledPredicate): ReadonlyArray<Rdf.Quad> => {
  const subject = Rdf.makeNamedNode(predicate.termIri);

  return [
    Rdf.makeQuad(subject, RDF_TYPE, predicate.kind === "object" ? OWL_OBJECT_PROPERTY : OWL_DATATYPE_PROPERTY),
    Rdf.makeQuad(subject, RDFS_LABEL, Rdf.makeLiteral(predicate.key)),
    Rdf.makeQuad(subject, RDFS_DOMAIN, Rdf.makeNamedNode(assembled.iri)),
    Rdf.makeQuad(
      subject,
      RDFS_RANGE,
      O.match(predicate.rangeIri, { onNone: () => RDFS_LITERAL, onSome: Rdf.makeNamedNode })
    ),
    ...commentQuads(subject, predicate.description),
  ];
};

const factQuad = (fact: AssembledFact): Rdf.Quad => {
  const predicate = Rdf.makeNamedNode(fact.predicateIri);

  if (P.isString(fact.object)) {
    const [subject, object] = fact.reverse ? [fact.object, fact.subjectIri] : [fact.subjectIri, fact.object];
    return Rdf.makeQuad(Rdf.makeNamedNode(subject), predicate, Rdf.makeNamedNode(object));
  }

  return Rdf.makeQuad(Rdf.makeNamedNode(fact.subjectIri), predicate, fact.object);
};

/**
 * Project an assembled ontology into a ground RDF dataset.
 *
 * **Details**
 *
 * Every class is typed `rdfs:Class` (and its SKOS marker), labelled and
 * commented; every owned predicate is typed, labelled, domained and ranged;
 * every fact is one quad, with a reverse fact's endpoints swapped. The
 * dataset is a quad set, so repeated projection is `Equal`.
 *
 * **Example** (Dataset from folded ontology)
 *
 * ```ts
 * import { $I as $BeepId } from "@beep/identity/packages"
 * import { view } from "@beep/identity/Registry"
 * import { RegistryShard, RegistryTable } from "@beep/identity/Term"
 * import { foldWith } from "@beep/ontology/Fold.assembly"
 * import { toDataset } from "@beep/ontology/Fold.projections"
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const $I = $BeepId.create("patent")
 *
 * class Claim extends S.Class<Claim>($I`Claim`)(
 *   { text: S.String },
 *   $I.class("Claim", { description: "A patent claim." })
 * ) {}
 * const patent = S.decodeUnknownSync(RegistryShard)({
 *   namespace: { prefix: "patent", iri: "https://example.test/patent/" },
 *   terms: ["Claim", "text"],
 *   bindings: [{ code: "@beep/patent/Claim", local: "Claim", since: "1.0.0" }],
 *   deprecations: []
 * })
 * const registry = view(Result.getOrThrow(RegistryTable.fromShards([patent])))
 *
 * const dataset = toDataset(
 *   Effect.runSync(foldWith(registry)("patent", { label: "Patent Core", schemas: [Claim], triples: [] }))
 * )
 * console.log(HashSet.size(dataset.quads) > 0) // true
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const toDataset = (ontology: AssembledOntology): Rdf.Dataset =>
  Rdf.makeDataset([
    ...A.flatMap(ontology.classes, classQuads),
    ...A.flatMap(ontology.classes, (assembled) =>
      pipe(
        assembled.predicates,
        A.filter((predicate) => isOwnedPredicate(ontology, predicate)),
        A.flatMap((predicate) => predicateQuads(assembled, predicate))
      )
    ),
    ...A.map(ontology.facts, factQuad),
  ]);
