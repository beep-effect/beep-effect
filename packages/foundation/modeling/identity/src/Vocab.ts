/**
 * Static RDF vocabulary registry for identity CURIE literals.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { make } from "./Id.ts";

const { $IdentityId } = make("identity");
const $I = $IdentityId.create("Vocab");

/**
 * Registry shape consumed by identity CURIE type helpers and codecs.
 *
 * **Example** (Satisfies VocabShape registry)
 *
 * ```ts
 * import type { VocabShape } from "@beep/identity"
 *
 * const vocab = {
 *   ex: {
 *     iri: "https://example.test/ns#",
 *     terms: ["Thing"],
 *   },
 * } satisfies VocabShape
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

/**
 * Runtime schema for one vocabulary registry entry.
 *
 * **Example** (Make and validate entry)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { VocabEntry } from "@beep/identity"
 *
 * const entry = VocabEntry.make({ iri: "https://example.test/ns#", terms: ["Thing"] })
 * console.log(S.is(VocabEntry)(entry)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VocabEntry extends S.Class<VocabEntry>("@beep/identity/Vocab/VocabEntry")(
  {
    iri: S.String,
    terms: S.Array(S.String),
  },
  $I.annote("VocabEntry", {
    description: "One namespace IRI and term list inside an identity vocabulary registry.",
  })
) {}

/**
 * Runtime schema for vocabulary registries consumed by CURIE codecs.
 *
 * **Example** (Validate registry with Schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { VocabRegistry } from "@beep/identity"
 *
 * const isRegistry = S.is(VocabRegistry)
 * console.log(isRegistry({ ex: { iri: "https://example.test/ns#", terms: ["Thing"] } }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VocabRegistry = S.Record(S.String, VocabEntry).annotate({
  identifier: "@beep/identity/Vocab/VocabRegistry",
  title: "Vocabulary Registry",
  description: "Record of namespace prefixes to identity vocabulary entries.",
});

/**
 * Runtime type for {@link VocabRegistry}.
 *
 * **Example** (Typed registry with VocabEntry)
 *
 * ```ts
 * import { VocabEntry, type VocabRegistry } from "@beep/identity"
 *
 * const registry: VocabRegistry = { ex: VocabEntry.make({ iri: "https://example.test/ns#", terms: ["Thing"] }) }
 * console.log(registry.ex?.terms[0])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VocabRegistry = typeof VocabRegistry.Type;

type TermOf<V extends VocabShape, Prefix extends keyof V & string> = V[Prefix]["terms"][number] & string;

/**
 * Core borrowed vocabulary registry used by identity CURIE helpers.
 *
 * **Example** (Build IRI from CoreVocab)
 *
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
 * **Example** (Assign CoreVocab type alias)
 *
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
 * **Example** (Typed CURIE from CoreVocab)
 *
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
 * **Example** (Inverse predicate CURIE type)
 *
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
 * **Example** (Expand CURIE to IRI literal)
 *
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

const mergeVocabImpl = <const Base extends VocabShape, const Extension extends VocabShape>(
  base: Base,
  extension: Extension
) =>
  ({
    ...base,
    ...extension,
  }) satisfies VocabShape;

/**
 * Merge a base registry with literal-preserving extension vocabulary data.
 *
 * **Example** (Merge CoreVocab with extension)
 *
 * ```ts
 * import { CoreVocab, mergeVocab } from "@beep/identity"
 *
 * const vocab = mergeVocab(CoreVocab, {
 *   ex: {
 *     iri: "https://example.test/ns#",
 *     terms: ["Thing"],
 *   },
 * })
 *
 * console.log(vocab.ex.terms[0]) // "Thing"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const mergeVocab: {
  <const Base extends VocabShape, const Extension extends VocabShape>(
    base: Base,
    extension: Extension
  ): ReturnType<typeof mergeVocabImpl<Base, Extension>>;
  <const Extension extends VocabShape>(
    extension: Extension
  ): <const Base extends VocabShape>(base: Base) => ReturnType<typeof mergeVocabImpl<Base, Extension>>;
} = dual(2, mergeVocabImpl);

/**
 * Core vocabulary extended with repository-owned semantic-foundation terms.
 *
 * **Example** (Access beep foundation terms)
 *
 * ```ts
 * import { SemanticFoundationVocab } from "@beep/identity"
 *
 * console.log(SemanticFoundationVocab.beep.iri) // "https://ns.beep.sh/"
 * console.log(SemanticFoundationVocab.beep.terms.includes("ontology/semantic-foundation")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SemanticFoundationVocab = mergeVocab(CoreVocab, {
  beep: {
    iri: "https://ns.beep.sh/",
    terms: [
      "ontology/semantic-foundation",
      "ontology/semantic-foundation/taxonomy/legal-intake",
      "ontology/semantic-foundation/filing-root/local-vault",
      "ontology/semantic-foundation/filing-root/box-mirror",
    ],
  },
});

/**
 * Runtime type for {@link SemanticFoundationVocab}.
 *
 * **Example** (Typed SemanticFoundationVocab value)
 *
 * ```ts
 * import { SemanticFoundationVocab, type SemanticFoundationVocab as SemanticFoundationVocabType } from "@beep/identity"
 *
 * const vocab: SemanticFoundationVocabType = SemanticFoundationVocab
 * console.log(vocab.beep.iri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SemanticFoundationVocab = typeof SemanticFoundationVocab;
