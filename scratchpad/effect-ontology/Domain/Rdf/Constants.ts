/**
 * RDF vocabulary constants used by the effect-ontology experiment.
 *
 * @remarks
 * Standard terms reuse repository-owned namespace and term exports whenever
 * they exist. Every term is a canonical RDF/JS {@link NamedNode}; no unchecked
 * IRI casts or competing string brands are introduced here.
 *
 * Effect-ontology-specific vocabularies retain their upstream namespaces for
 * wire compatibility while the scratchpad evaluates long-term namespace
 * ownership.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { SafePnPrefix } from "@beep/identity";
import { $ScratchpadId } from "@beep/identity";
import { DCTERMS_NAMESPACE } from "@beep/rdf/Vocab/Dcterms";
import { OWL_NAMESPACE } from "@beep/rdf/Vocab/Owl";
import { PROV_NAMESPACE } from "@beep/rdf/Vocab/Prov";
import { RDF_NAMESPACE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { SKOS_NAMESPACE } from "@beep/rdf/Vocab/Skos";
import { XSD_NAMESPACE } from "@beep/rdf/Vocab/Xsd";
import { SchemaUtils } from "@beep/schema";
import { R } from "@beep/utils";
import * as S from "effect/Schema";
import { IRI, type IRI as IriValue } from "./Types.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Rdf/Constants");

const vocabularyTerm = (namespace: string, localName: string): IriValue => IRI.make(`${namespace}${localName}`);

/**
 * RDF 1.1 vocabulary terms used by extraction and graph serialization.
 *
 * @example
 * ```ts
 * import { RDF } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(RDF.type.termType) // "NamedNode"
 * console.log(RDF.type.value) // "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
 * ```
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/ | RDF 1.1 Concepts}
 * @category constants
 * @since 0.0.0
 */
export const RDF = {
  type: vocabularyTerm(RDF_NAMESPACE, "type"),
  Property: vocabularyTerm(RDF_NAMESPACE, "Property"),
  Statement: vocabularyTerm(RDF_NAMESPACE, "Statement"),
  subject: vocabularyTerm(RDF_NAMESPACE, "subject"),
  predicate: vocabularyTerm(RDF_NAMESPACE, "predicate"),
  object: vocabularyTerm(RDF_NAMESPACE, "object"),
  first: vocabularyTerm(RDF_NAMESPACE, "first"),
  rest: vocabularyTerm(RDF_NAMESPACE, "rest"),
  nil: vocabularyTerm(RDF_NAMESPACE, "nil"),
  List: vocabularyTerm(RDF_NAMESPACE, "List"),
};

/**
 * RDF Schema vocabulary terms used by ontology declarations.
 *
 * @example
 * ```ts
 * import { RDFS } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(RDFS.subClassOf.value) // "http://www.w3.org/2000/01/rdf-schema#subClassOf"
 * ```
 *
 * @see {@link https://www.w3.org/TR/rdf-schema/ | RDF Schema 1.1}
 * @category constants
 * @since 0.0.0
 */
export const RDFS = {
  Class: vocabularyTerm(RDFS_NAMESPACE, "Class"),
  Resource: vocabularyTerm(RDFS_NAMESPACE, "Resource"),
  Literal: vocabularyTerm(RDFS_NAMESPACE, "Literal"),
  Datatype: vocabularyTerm(RDFS_NAMESPACE, "Datatype"),
  label: vocabularyTerm(RDFS_NAMESPACE, "label"),
  comment: vocabularyTerm(RDFS_NAMESPACE, "comment"),
  domain: vocabularyTerm(RDFS_NAMESPACE, "domain"),
  range: vocabularyTerm(RDFS_NAMESPACE, "range"),
  subClassOf: vocabularyTerm(RDFS_NAMESPACE, "subClassOf"),
  subPropertyOf: vocabularyTerm(RDFS_NAMESPACE, "subPropertyOf"),
  seeAlso: vocabularyTerm(RDFS_NAMESPACE, "seeAlso"),
  isDefinedBy: vocabularyTerm(RDFS_NAMESPACE, "isDefinedBy"),
};

/**
 * OWL 2 vocabulary terms used by ontology models and validation.
 *
 * @example
 * ```ts
 * import { OWL } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(OWL.ObjectProperty.value) // "http://www.w3.org/2002/07/owl#ObjectProperty"
 * ```
 *
 * @see {@link https://www.w3.org/TR/owl2-syntax/ | OWL 2 Structural Specification}
 * @category constants
 * @since 0.0.0
 */
export const OWL = {
  Class: vocabularyTerm(OWL_NAMESPACE, "Class"),
  Thing: vocabularyTerm(OWL_NAMESPACE, "Thing"),
  Nothing: vocabularyTerm(OWL_NAMESPACE, "Nothing"),
  ObjectProperty: vocabularyTerm(OWL_NAMESPACE, "ObjectProperty"),
  DatatypeProperty: vocabularyTerm(OWL_NAMESPACE, "DatatypeProperty"),
  FunctionalProperty: vocabularyTerm(OWL_NAMESPACE, "FunctionalProperty"),
  InverseFunctionalProperty: vocabularyTerm(OWL_NAMESPACE, "InverseFunctionalProperty"),
  TransitiveProperty: vocabularyTerm(OWL_NAMESPACE, "TransitiveProperty"),
  SymmetricProperty: vocabularyTerm(OWL_NAMESPACE, "SymmetricProperty"),
  AsymmetricProperty: vocabularyTerm(OWL_NAMESPACE, "AsymmetricProperty"),
  ReflexiveProperty: vocabularyTerm(OWL_NAMESPACE, "ReflexiveProperty"),
  IrreflexiveProperty: vocabularyTerm(OWL_NAMESPACE, "IrreflexiveProperty"),
  inverseOf: vocabularyTerm(OWL_NAMESPACE, "inverseOf"),
  equivalentClass: vocabularyTerm(OWL_NAMESPACE, "equivalentClass"),
  equivalentProperty: vocabularyTerm(OWL_NAMESPACE, "equivalentProperty"),
  disjointWith: vocabularyTerm(OWL_NAMESPACE, "disjointWith"),
  sameAs: vocabularyTerm(OWL_NAMESPACE, "sameAs"),
  differentFrom: vocabularyTerm(OWL_NAMESPACE, "differentFrom"),
  unionOf: vocabularyTerm(OWL_NAMESPACE, "unionOf"),
  intersectionOf: vocabularyTerm(OWL_NAMESPACE, "intersectionOf"),
  complementOf: vocabularyTerm(OWL_NAMESPACE, "complementOf"),
  oneOf: vocabularyTerm(OWL_NAMESPACE, "oneOf"),
  Restriction: vocabularyTerm(OWL_NAMESPACE, "Restriction"),
  onProperty: vocabularyTerm(OWL_NAMESPACE, "onProperty"),
  allValuesFrom: vocabularyTerm(OWL_NAMESPACE, "allValuesFrom"),
  someValuesFrom: vocabularyTerm(OWL_NAMESPACE, "someValuesFrom"),
  hasValue: vocabularyTerm(OWL_NAMESPACE, "hasValue"),
  minCardinality: vocabularyTerm(OWL_NAMESPACE, "minCardinality"),
  maxCardinality: vocabularyTerm(OWL_NAMESPACE, "maxCardinality"),
  cardinality: vocabularyTerm(OWL_NAMESPACE, "cardinality"),
};

/**
 * PROV-O terms used for extraction and curation provenance.
 *
 * @example
 * ```ts
 * import { PROV } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(PROV.wasGeneratedBy.value) // "http://www.w3.org/ns/prov#wasGeneratedBy"
 * ```
 *
 * @see {@link https://www.w3.org/TR/prov-o/ | PROV-O}
 * @category constants
 * @since 0.0.0
 */
export const PROV = {
  Entity: vocabularyTerm(PROV_NAMESPACE, "Entity"),
  Activity: vocabularyTerm(PROV_NAMESPACE, "Activity"),
  Agent: vocabularyTerm(PROV_NAMESPACE, "Agent"),
  wasGeneratedBy: vocabularyTerm(PROV_NAMESPACE, "wasGeneratedBy"),
  wasDerivedFrom: vocabularyTerm(PROV_NAMESPACE, "wasDerivedFrom"),
  wasAttributedTo: vocabularyTerm(PROV_NAMESPACE, "wasAttributedTo"),
  startedAtTime: vocabularyTerm(PROV_NAMESPACE, "startedAtTime"),
  endedAtTime: vocabularyTerm(PROV_NAMESPACE, "endedAtTime"),
  generatedAtTime: vocabularyTerm(PROV_NAMESPACE, "generatedAtTime"),
  used: vocabularyTerm(PROV_NAMESPACE, "used"),
  wasAssociatedWith: vocabularyTerm(PROV_NAMESPACE, "wasAssociatedWith"),
};

/**
 * Dublin Core Terms used in ontology and artifact metadata.
 *
 * @example
 * ```ts
 * import { DCTERMS } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(DCTERMS.title.value) // "http://purl.org/dc/terms/title"
 * ```
 *
 * @see {@link https://www.dublincore.org/specifications/dublin-core/dcmi-terms/ | DCMI Terms}
 * @category constants
 * @since 0.0.0
 */
export const DCTERMS = {
  title: vocabularyTerm(DCTERMS_NAMESPACE, "title"),
  description: vocabularyTerm(DCTERMS_NAMESPACE, "description"),
  creator: vocabularyTerm(DCTERMS_NAMESPACE, "creator"),
  created: vocabularyTerm(DCTERMS_NAMESPACE, "created"),
  modified: vocabularyTerm(DCTERMS_NAMESPACE, "modified"),
  source: vocabularyTerm(DCTERMS_NAMESPACE, "source"),
  identifier: vocabularyTerm(DCTERMS_NAMESPACE, "identifier"),
  format: vocabularyTerm(DCTERMS_NAMESPACE, "format"),
  type: vocabularyTerm(DCTERMS_NAMESPACE, "type"),
  subject: vocabularyTerm(DCTERMS_NAMESPACE, "subject"),
  publisher: vocabularyTerm(DCTERMS_NAMESPACE, "publisher"),
  contributor: vocabularyTerm(DCTERMS_NAMESPACE, "contributor"),
  rights: vocabularyTerm(DCTERMS_NAMESPACE, "rights"),
  license: vocabularyTerm(DCTERMS_NAMESPACE, "license"),
};

/**
 * XML Schema datatype terms used by RDF literals.
 *
 * @example
 * ```ts
 * import { XSD } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(XSD.dateTime.value) // "http://www.w3.org/2001/XMLSchema#dateTime"
 * ```
 *
 * @see {@link https://www.w3.org/TR/xmlschema11-2/ | XML Schema Datatypes}
 * @category constants
 * @since 0.0.0
 */
export const XSD = {
  string: vocabularyTerm(XSD_NAMESPACE, "string"),
  integer: vocabularyTerm(XSD_NAMESPACE, "integer"),
  decimal: vocabularyTerm(XSD_NAMESPACE, "decimal"),
  float: vocabularyTerm(XSD_NAMESPACE, "float"),
  double: vocabularyTerm(XSD_NAMESPACE, "double"),
  boolean: vocabularyTerm(XSD_NAMESPACE, "boolean"),
  date: vocabularyTerm(XSD_NAMESPACE, "date"),
  time: vocabularyTerm(XSD_NAMESPACE, "time"),
  dateTime: vocabularyTerm(XSD_NAMESPACE, "dateTime"),
  anyURI: vocabularyTerm(XSD_NAMESPACE, "anyURI"),
};

/**
 * SKOS terms used for labels, hierarchy, and mapping relations.
 *
 * @example
 * ```ts
 * import { SKOS } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS.prefLabel.value) // "http://www.w3.org/2004/02/skos/core#prefLabel"
 * ```
 *
 * @see {@link https://www.w3.org/TR/skos-reference/ | SKOS Reference}
 * @category constants
 * @since 0.0.0
 */
export const SKOS = {
  Concept: vocabularyTerm(SKOS_NAMESPACE, "Concept"),
  ConceptScheme: vocabularyTerm(SKOS_NAMESPACE, "ConceptScheme"),
  Collection: vocabularyTerm(SKOS_NAMESPACE, "Collection"),
  OrderedCollection: vocabularyTerm(SKOS_NAMESPACE, "OrderedCollection"),
  prefLabel: vocabularyTerm(SKOS_NAMESPACE, "prefLabel"),
  altLabel: vocabularyTerm(SKOS_NAMESPACE, "altLabel"),
  hiddenLabel: vocabularyTerm(SKOS_NAMESPACE, "hiddenLabel"),
  definition: vocabularyTerm(SKOS_NAMESPACE, "definition"),
  scopeNote: vocabularyTerm(SKOS_NAMESPACE, "scopeNote"),
  example: vocabularyTerm(SKOS_NAMESPACE, "example"),
  note: vocabularyTerm(SKOS_NAMESPACE, "note"),
  broader: vocabularyTerm(SKOS_NAMESPACE, "broader"),
  narrower: vocabularyTerm(SKOS_NAMESPACE, "narrower"),
  related: vocabularyTerm(SKOS_NAMESPACE, "related"),
  exactMatch: vocabularyTerm(SKOS_NAMESPACE, "exactMatch"),
  closeMatch: vocabularyTerm(SKOS_NAMESPACE, "closeMatch"),
  broadMatch: vocabularyTerm(SKOS_NAMESPACE, "broadMatch"),
  narrowMatch: vocabularyTerm(SKOS_NAMESPACE, "narrowMatch"),
  relatedMatch: vocabularyTerm(SKOS_NAMESPACE, "relatedMatch"),
  inScheme: vocabularyTerm(SKOS_NAMESPACE, "inScheme"),
  hasTopConcept: vocabularyTerm(SKOS_NAMESPACE, "hasTopConcept"),
  topConceptOf: vocabularyTerm(SKOS_NAMESPACE, "topConceptOf"),
};

const extractionNamespace = IRI.fromUnknown("http://example.org/kg/");
const claimsNamespace = IRI.fromUnknown("http://effect-ontology.dev/claims#");
const correctionsNamespace = IRI.fromUnknown("http://effect-ontology.dev/corrections#");
const coreNamespace = IRI.fromUnknown("http://effect-ontology.dev/core#");
const schemaOrgNamespace = IRI.fromUnknown("http://schema.org/");

/**
 * Legacy extraction-metadata vocabulary.
 *
 * @remarks
 * The `example.org` namespace is retained only for source compatibility. It
 * should be replaced by an owned deployment namespace before external
 * publication.
 *
 * @example
 * ```ts
 * import { EXTR } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(EXTR.confidence.value) // "http://example.org/kg/confidence"
 * ```
 *
 * @experimental
 * @category constants
 * @since 0.0.0
 */
export const EXTR = {
  namespace: extractionNamespace,
  confidence: vocabularyTerm(extractionNamespace, "confidence"),
  usedModel: vocabularyTerm(extractionNamespace, "usedModel"),
  ontologyVersion: vocabularyTerm(extractionNamespace, "ontologyVersion"),
  sourceChunk: vocabularyTerm(extractionNamespace, "sourceChunk"),
  extractionMethod: vocabularyTerm(extractionNamespace, "extractionMethod"),
};

/**
 * Effect-ontology claims vocabulary.
 *
 * @remarks
 * Terms model ranked, evidenced, and lifecycle-aware reified claims. Namespace
 * ownership remains intentionally unchanged during scratchpad compatibility
 * work.
 *
 * @example
 * ```ts
 * import { CLAIMS } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(CLAIMS.Claim.value) // "http://effect-ontology.dev/claims#Claim"
 * ```
 *
 * @experimental
 * @category constants
 * @since 0.0.0
 */
export const CLAIMS = {
  namespace: claimsNamespace,
  Claim: vocabularyTerm(claimsNamespace, "Claim"),
  ClaimRank: vocabularyTerm(claimsNamespace, "ClaimRank"),
  Evidence: vocabularyTerm(claimsNamespace, "Evidence"),
  ArticleClaimSet: vocabularyTerm(claimsNamespace, "ArticleClaimSet"),
  ClaimSetStatus: vocabularyTerm(claimsNamespace, "ClaimSetStatus"),
  Preferred: vocabularyTerm(claimsNamespace, "Preferred"),
  Normal: vocabularyTerm(claimsNamespace, "Normal"),
  Deprecated: vocabularyTerm(claimsNamespace, "Deprecated"),
  Pending: vocabularyTerm(claimsNamespace, "Pending"),
  Accepted: vocabularyTerm(claimsNamespace, "Accepted"),
  Retracted: vocabularyTerm(claimsNamespace, "Retracted"),
  claimSubject: vocabularyTerm(claimsNamespace, "claimSubject"),
  claimPredicate: vocabularyTerm(claimsNamespace, "claimPredicate"),
  claimObject: vocabularyTerm(claimsNamespace, "claimObject"),
  claimLiteral: vocabularyTerm(claimsNamespace, "claimLiteral"),
  rank: vocabularyTerm(claimsNamespace, "rank"),
  confidence: vocabularyTerm(claimsNamespace, "confidence"),
  validFrom: vocabularyTerm(claimsNamespace, "validFrom"),
  validUntil: vocabularyTerm(claimsNamespace, "validUntil"),
  eventTime: vocabularyTerm(claimsNamespace, "eventTime"),
  statedIn: vocabularyTerm(claimsNamespace, "statedIn"),
  extractedAt: vocabularyTerm(claimsNamespace, "extractedAt"),
  extractedBy: vocabularyTerm(claimsNamespace, "extractedBy"),
  deprecatedAt: vocabularyTerm(claimsNamespace, "deprecatedAt"),
  deprecationReason: vocabularyTerm(claimsNamespace, "deprecationReason"),
  supersedes: vocabularyTerm(claimsNamespace, "supersedes"),
  supersededBy: vocabularyTerm(claimsNamespace, "supersededBy"),
  hasEvidence: vocabularyTerm(claimsNamespace, "hasEvidence"),
  evidenceText: vocabularyTerm(claimsNamespace, "evidenceText"),
  startOffset: vocabularyTerm(claimsNamespace, "startOffset"),
  endOffset: vocabularyTerm(claimsNamespace, "endOffset"),
  claimStatus: vocabularyTerm(claimsNamespace, "claimStatus"),
  containsClaim: vocabularyTerm(claimsNamespace, "containsClaim"),
  sourceArticle: vocabularyTerm(claimsNamespace, "sourceArticle"),
};

/**
 * Effect-ontology correction and conflict vocabulary.
 *
 * @example
 * ```ts
 * import { CORRECTIONS } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(CORRECTIONS.Retraction.value)
 * // "http://effect-ontology.dev/corrections#Retraction"
 * ```
 *
 * @experimental
 * @category constants
 * @since 0.0.0
 */
export const CORRECTIONS = {
  namespace: correctionsNamespace,
  Correction: vocabularyTerm(correctionsNamespace, "Correction"),
  CorrectionType: vocabularyTerm(correctionsNamespace, "CorrectionType"),
  CorrectionChain: vocabularyTerm(correctionsNamespace, "CorrectionChain"),
  Conflict: vocabularyTerm(correctionsNamespace, "Conflict"),
  ConflictType: vocabularyTerm(correctionsNamespace, "ConflictType"),
  ResolutionStrategy: vocabularyTerm(correctionsNamespace, "ResolutionStrategy"),
  Retraction: vocabularyTerm(correctionsNamespace, "Retraction"),
  Clarification: vocabularyTerm(correctionsNamespace, "Clarification"),
  Update: vocabularyTerm(correctionsNamespace, "Update"),
  Amendment: vocabularyTerm(correctionsNamespace, "Amendment"),
  PositionConflict: vocabularyTerm(correctionsNamespace, "PositionConflict"),
  TemporalConflict: vocabularyTerm(correctionsNamespace, "TemporalConflict"),
  ContradictoryConflict: vocabularyTerm(correctionsNamespace, "ContradictoryConflict"),
  TemporalPrecedence: vocabularyTerm(correctionsNamespace, "TemporalPrecedence"),
  SourceAuthority: vocabularyTerm(correctionsNamespace, "SourceAuthority"),
  ManualReview: vocabularyTerm(correctionsNamespace, "ManualReview"),
  correctionType: vocabularyTerm(correctionsNamespace, "correctionType"),
  correctionDate: vocabularyTerm(correctionsNamespace, "correctionDate"),
  correctionReason: vocabularyTerm(correctionsNamespace, "correctionReason"),
  sourceDocument: vocabularyTerm(correctionsNamespace, "sourceDocument"),
  invalidates: vocabularyTerm(correctionsNamespace, "invalidates"),
  invalidatedBy: vocabularyTerm(correctionsNamespace, "invalidatedBy"),
  refines: vocabularyTerm(correctionsNamespace, "refines"),
  introduces: vocabularyTerm(correctionsNamespace, "introduces"),
  conflictType: vocabularyTerm(correctionsNamespace, "conflictType"),
  involvesClaim: vocabularyTerm(correctionsNamespace, "involvesClaim"),
  detectedAt: vocabularyTerm(correctionsNamespace, "detectedAt"),
  resolvedBy: vocabularyTerm(correctionsNamespace, "resolvedBy"),
  resolutionStrategy: vocabularyTerm(correctionsNamespace, "resolutionStrategy"),
  CurationActivity: vocabularyTerm(correctionsNamespace, "CurationActivity"),
  curatedBy: vocabularyTerm(correctionsNamespace, "curatedBy"),
  curationConfidence: vocabularyTerm(correctionsNamespace, "curationConfidence"),
  usedAsExample: vocabularyTerm(correctionsNamespace, "usedAsExample"),
  curationNote: vocabularyTerm(correctionsNamespace, "curationNote"),
};

/**
 * Effect-ontology core extraction vocabulary.
 *
 * @example
 * ```ts
 * import { CORE } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(CORE.TrackedEntity.value)
 * // "http://effect-ontology.dev/core#TrackedEntity"
 * ```
 *
 * @experimental
 * @category constants
 * @since 0.0.0
 */
export const CORE = {
  namespace: coreNamespace,
  TrackedEntity: vocabularyTerm(coreNamespace, "TrackedEntity"),
  TrackedEvent: vocabularyTerm(coreNamespace, "TrackedEvent"),
  Mention: vocabularyTerm(coreNamespace, "Mention"),
  hasEvidentialMention: vocabularyTerm(coreNamespace, "hasEvidentialMention"),
  mentions: vocabularyTerm(coreNamespace, "mentions"),
  hasParticipant: vocabularyTerm(coreNamespace, "hasParticipant"),
  isParticipantIn: vocabularyTerm(coreNamespace, "isParticipantIn"),
  sameEntityAs: vocabularyTerm(coreNamespace, "sameEntityAs"),
  mergedFrom: vocabularyTerm(coreNamespace, "mergedFrom"),
  hasLocation: vocabularyTerm(coreNamespace, "hasLocation"),
  name: vocabularyTerm(coreNamespace, "name"),
  description: vocabularyTerm(coreNamespace, "description"),
  occurrenceTime: vocabularyTerm(coreNamespace, "occurrenceTime"),
  groundingConfidence: vocabularyTerm(coreNamespace, "groundingConfidence"),
  resolutionConfidence: vocabularyTerm(coreNamespace, "resolutionConfidence"),
};

/**
 * Schema.org terms used for common entity metadata.
 *
 * @example
 * ```ts
 * import { SCHEMA } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SCHEMA.Person.value) // "http://schema.org/Person"
 * ```
 *
 * @see {@link https://schema.org/ | Schema.org}
 * @category constants
 * @since 0.0.0
 */
export const SCHEMA = {
  namespace: schemaOrgNamespace,
  name: vocabularyTerm(schemaOrgNamespace, "name"),
  alternateName: vocabularyTerm(schemaOrgNamespace, "alternateName"),
  description: vocabularyTerm(schemaOrgNamespace, "description"),
  identifier: vocabularyTerm(schemaOrgNamespace, "identifier"),
  url: vocabularyTerm(schemaOrgNamespace, "url"),
  sameAs: vocabularyTerm(schemaOrgNamespace, "sameAs"),
  dateCreated: vocabularyTerm(schemaOrgNamespace, "dateCreated"),
  dateModified: vocabularyTerm(schemaOrgNamespace, "dateModified"),
  datePublished: vocabularyTerm(schemaOrgNamespace, "datePublished"),
  Thing: vocabularyTerm(schemaOrgNamespace, "Thing"),
  Person: vocabularyTerm(schemaOrgNamespace, "Person"),
  Organization: vocabularyTerm(schemaOrgNamespace, "Organization"),
  Place: vocabularyTerm(schemaOrgNamespace, "Place"),
  Event: vocabularyTerm(schemaOrgNamespace, "Event"),
};

const KnownVocabularyFields = {
  prefix: SafePnPrefix.annotateKey({
    description: "Preferred Turtle prefix for the vocabulary.",
  }),
  name: S.NonEmptyString.annotateKey({
    description: "Human-readable vocabulary name.",
  }),
  publisher: S.NonEmptyString.annotateKey({
    description: "Organization responsible for the vocabulary.",
  }),
  specUrl: IRI.annotateKey({
    description: "Normative or canonical specification IRI.",
  }),
};

class KnownVocabularyModel extends S.Class<KnownVocabularyModel>($I`KnownVocabulary`)(
  KnownVocabularyFields,
  $I.annote("KnownVocabulary", {
    description: "Human-readable metadata for a well-known external RDF vocabulary.",
  })
) {}

const KnownVocabularyFromSelf = S.declare((input: unknown): input is KnownVocabularyModel =>
  S.is(KnownVocabularyModel)(input)
).annotate({
  toArbitrary: () => (fc) =>
    fc
      .tuple(
        fc.constantFrom("rdf", "rdfs", "owl", "prov", "schema"),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        S.toArbitrary(IRI)(fc)
      )
      .map(([prefix, name, publisher, specUrl]) =>
        KnownVocabularyModel.make({
          prefix: S.decodeSync(SafePnPrefix)(prefix),
          name,
          publisher,
          specUrl,
        })
      ),
});

/**
 * Metadata for one well-known external RDF vocabulary.
 *
 * @remarks
 * The schema validates both the compact Turtle prefix and the absolute
 * specification IRI, so registry consumers receive publication-ready metadata
 * instead of repairing free-form strings.
 *
 * @example
 * ```ts
 * import { IRI } from "@beep/rdf/Iri"
 * import { KnownVocabulary } from "@effect-ontology/Rdf/Constants.ts"
 *
 * const vocabulary = KnownVocabulary.fromUnknown({
 *   prefix: "prov",
 *   name: "PROV-O",
 *   publisher: "W3C",
 *   specUrl: "https://www.w3.org/TR/prov-o/"
 * })
 * console.log(vocabulary.prefix) // "prov"
 * ```
 *
 * @invariant Prefix is Turtle-safe, text fields are non-empty, and the
 * specification location is a valid IRI.
 * @category models
 * @since 0.0.0
 */
export const KnownVocabulary = KnownVocabularyModel.pipe(
  S.decodeTo(KnownVocabularyFromSelf),
  $I.annoteSchema("KnownVocabulary", {
    description: "Human-readable metadata for a well-known external RDF vocabulary.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link KnownVocabulary}. {@inheritDoc KnownVocabulary}
 *
 * @example
 * ```ts
 * import { IRI } from "@beep/rdf/Iri"
 * import { KnownVocabulary, type KnownVocabulary as KnownVocabularyValue } from "@effect-ontology/Rdf/Constants.ts"
 *
 * const value: KnownVocabularyValue = KnownVocabulary.fromUnknown({
 *   prefix: "prov",
 *   name: "PROV-O",
 *   publisher: "W3C",
 *   specUrl: "https://www.w3.org/TR/prov-o/"
 * })
 * console.log(value.publisher) // "W3C"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type KnownVocabulary = typeof KnownVocabulary.Type;

/**
 * Registry of external vocabulary metadata keyed by namespace IRI.
 *
 * @example
 * ```ts
 * import { KnownVocabularyRegistry } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(KnownVocabularyRegistry.is({})) // true
 * ```
 *
 * @invariant Every key is an IRI and every value is valid
 * {@link KnownVocabulary} metadata.
 * @category models
 * @since 0.0.0
 */
const KnownVocabularyRegistryDefinition = S.Record(S.String, KnownVocabulary).check(
  S.makeFilter((registry) => R.every(registry, (_vocabulary, namespace) => IRI.is(namespace)), {
    identifier: $I`KnownVocabularyRegistryKeyCheck`,
    title: "Known Vocabulary Registry Namespace Keys",
    description: "A vocabulary registry whose property keys are canonical namespace IRIs.",
    message: "Every known-vocabulary registry key must be a valid canonical namespace IRI.",
  })
);

const KnownVocabularyRegistryFromSelf = S.declare(
  (input: unknown): input is typeof KnownVocabularyRegistryDefinition.Type =>
    S.is(KnownVocabularyRegistryDefinition)(input)
).annotate({
  toArbitrary: () => (fc) => fc.dictionary(S.toArbitrary(IRI)(fc), S.toArbitrary(KnownVocabulary)(fc)),
});

/**
 * Registry of external vocabulary metadata keyed by namespace IRI.
 *
 * @remarks
 * JavaScript record keys decode as strings, then one messaged registry-level
 * check validates every key with the canonical local IRI codec.
 *
 * @example
 * ```ts
 * import { KnownVocabularyRegistry } from "@effect-ontology/Rdf/Constants.ts"
 *
 * const registry = KnownVocabularyRegistry.fromUnknown({})
 * console.log(KnownVocabularyRegistry.is(registry)) // true
 * ```
 *
 * @invariant Every key is an IRI and every value is valid
 * {@link KnownVocabulary} metadata.
 * @category models
 * @since 0.0.0
 */
export const KnownVocabularyRegistry = KnownVocabularyRegistryDefinition.pipe(
  S.decodeTo(KnownVocabularyRegistryFromSelf),
  $I.annoteSchema("KnownVocabularyRegistry", {
    description: "External RDF vocabulary metadata keyed by canonical namespace IRI.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link KnownVocabularyRegistry}.
 *
 * @example
 * ```ts
 * import { type KnownVocabularyRegistry } from "@effect-ontology/Rdf/Constants.ts"
 *
 * const registry: KnownVocabularyRegistry = {}
 * console.log(registry)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type KnownVocabularyRegistry = typeof KnownVocabularyRegistry.Type;

/**
 * Metadata for well-known vocabularies recognized by ontology imports.
 *
 * @example
 * ```ts
 * import { KNOWN_VOCABULARIES } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(KNOWN_VOCABULARIES["http://www.w3.org/ns/prov#"]?.prefix)
 * // "prov"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWN_VOCABULARIES = KnownVocabularyRegistry.fromUnknown({
  [IRI.fromUnknown("http://xmlns.com/foaf/0.1/")]: KnownVocabulary.fromUnknown({
    prefix: "foaf",
    name: "FOAF",
    publisher: "FOAF Project",
    specUrl: "http://xmlns.com/foaf/spec/",
  }),
  [IRI.fromUnknown("http://www.w3.org/ns/org#")]: KnownVocabulary.fromUnknown({
    prefix: "org",
    name: "W3C Organization Ontology",
    publisher: "W3C",
    specUrl: "https://www.w3.org/TR/vocab-org/",
  }),
  [IRI.fromUnknown("http://www.w3.org/2006/time#")]: KnownVocabulary.fromUnknown({
    prefix: "time",
    name: "OWL-Time",
    publisher: "W3C",
    specUrl: "https://www.w3.org/TR/owl-time/",
  }),
  [IRI.fromUnknown("http://www.w3.org/ns/prov#")]: KnownVocabulary.fromUnknown({
    prefix: "prov",
    name: "PROV-O",
    publisher: "W3C",
    specUrl: "https://www.w3.org/TR/prov-o/",
  }),
  [IRI.fromUnknown("http://www.w3.org/ns/oa#")]: KnownVocabulary.fromUnknown({
    prefix: "oa",
    name: "Web Annotation",
    publisher: "W3C",
    specUrl: "https://www.w3.org/TR/annotation-model/",
  }),
  [IRI.fromUnknown("http://www.w3.org/2004/02/skos/core#")]: KnownVocabulary.fromUnknown({
    prefix: "skos",
    name: "SKOS",
    publisher: "W3C",
    specUrl: "https://www.w3.org/TR/skos-reference/",
  }),
});

/**
 * Compatibility alias for `rdf:type`.
 *
 * @example
 * ```ts
 * import { RDF_TYPE } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(RDF_TYPE.value) // "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
 * ```
 *
 * @deprecated Use {@link RDF.type}.
 * @category interop
 * @since 0.0.0
 */
export const RDF_TYPE = RDF.type;

/**
 * Compatibility alias for `owl:Class`.
 *
 * @example
 * ```ts
 * import { OWL_CLASS } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(OWL_CLASS.value) // "http://www.w3.org/2002/07/owl#Class"
 * ```
 *
 * @deprecated Use {@link OWL.Class}.
 * @category interop
 * @since 0.0.0
 */
export const OWL_CLASS = OWL.Class;

/**
 * Compatibility alias for `owl:ObjectProperty`.
 *
 * @example
 * ```ts
 * import { OWL_OBJECT_PROPERTY } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(OWL_OBJECT_PROPERTY.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link OWL.ObjectProperty}.
 * @category interop
 * @since 0.0.0
 */
export const OWL_OBJECT_PROPERTY = OWL.ObjectProperty;

/**
 * Compatibility alias for `owl:DatatypeProperty`.
 *
 * @example
 * ```ts
 * import { OWL_DATATYPE_PROPERTY } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(OWL_DATATYPE_PROPERTY.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link OWL.DatatypeProperty}.
 * @category interop
 * @since 0.0.0
 */
export const OWL_DATATYPE_PROPERTY = OWL.DatatypeProperty;

/**
 * Compatibility alias for `owl:FunctionalProperty`.
 *
 * @example
 * ```ts
 * import { OWL_FUNCTIONAL_PROPERTY } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(OWL_FUNCTIONAL_PROPERTY.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link OWL.FunctionalProperty}.
 * @category interop
 * @since 0.0.0
 */
export const OWL_FUNCTIONAL_PROPERTY = OWL.FunctionalProperty;

/**
 * Compatibility alias for `owl:inverseOf`.
 *
 * @example
 * ```ts
 * import { OWL_INVERSEOF } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(OWL_INVERSEOF.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link OWL.inverseOf}.
 * @category interop
 * @since 0.0.0
 */
export const OWL_INVERSEOF = OWL.inverseOf;

/**
 * Compatibility alias for `owl:equivalentClass`.
 *
 * @example
 * ```ts
 * import { OWL_EQUIVALENT_CLASS } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(OWL_EQUIVALENT_CLASS.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link OWL.equivalentClass}.
 * @category interop
 * @since 0.0.0
 */
export const OWL_EQUIVALENT_CLASS = OWL.equivalentClass;

/**
 * Compatibility alias for `rdfs:label`.
 *
 * @example
 * ```ts
 * import { RDFS_LABEL } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(RDFS_LABEL.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link RDFS.label}.
 * @category interop
 * @since 0.0.0
 */
export const RDFS_LABEL = RDFS.label;

/**
 * Compatibility alias for `rdfs:comment`.
 *
 * @example
 * ```ts
 * import { RDFS_COMMENT } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(RDFS_COMMENT.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link RDFS.comment}.
 * @category interop
 * @since 0.0.0
 */
export const RDFS_COMMENT = RDFS.comment;

/**
 * Compatibility alias for `rdfs:domain`.
 *
 * @example
 * ```ts
 * import { RDFS_DOMAIN } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(RDFS_DOMAIN.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link RDFS.domain}.
 * @category interop
 * @since 0.0.0
 */
export const RDFS_DOMAIN = RDFS.domain;

/**
 * Compatibility alias for `rdfs:range`.
 *
 * @example
 * ```ts
 * import { RDFS_RANGE } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(RDFS_RANGE.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link RDFS.range}.
 * @category interop
 * @since 0.0.0
 */
export const RDFS_RANGE = RDFS.range;

/**
 * Compatibility alias for `rdfs:subClassOf`.
 *
 * @example
 * ```ts
 * import { RDFS_SUBCLASSOF } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(RDFS_SUBCLASSOF.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link RDFS.subClassOf}.
 * @category interop
 * @since 0.0.0
 */
export const RDFS_SUBCLASSOF = RDFS.subClassOf;

/**
 * Compatibility alias for `rdfs:subPropertyOf`.
 *
 * @example
 * ```ts
 * import { RDFS_SUBPROPERTYOF } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(RDFS_SUBPROPERTYOF.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link RDFS.subPropertyOf}.
 * @category interop
 * @since 0.0.0
 */
export const RDFS_SUBPROPERTYOF = RDFS.subPropertyOf;

/**
 * Compatibility alias for `skos:prefLabel`.
 *
 * @example
 * ```ts
 * import { SKOS_PREFLABEL } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS_PREFLABEL.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link SKOS.prefLabel}.
 * @category interop
 * @since 0.0.0
 */
export const SKOS_PREFLABEL = SKOS.prefLabel;

/**
 * Compatibility alias for `skos:altLabel`.
 *
 * @example
 * ```ts
 * import { SKOS_ALTLABEL } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS_ALTLABEL.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link SKOS.altLabel}.
 * @category interop
 * @since 0.0.0
 */
export const SKOS_ALTLABEL = SKOS.altLabel;

/**
 * Compatibility alias for `skos:hiddenLabel`.
 *
 * @example
 * ```ts
 * import { SKOS_HIDDENLABEL } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS_HIDDENLABEL.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link SKOS.hiddenLabel}.
 * @category interop
 * @since 0.0.0
 */
export const SKOS_HIDDENLABEL = SKOS.hiddenLabel;

/**
 * Compatibility alias for `skos:definition`.
 *
 * @example
 * ```ts
 * import { SKOS_DEFINITION } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS_DEFINITION.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link SKOS.definition}.
 * @category interop
 * @since 0.0.0
 */
export const SKOS_DEFINITION = SKOS.definition;

/**
 * Compatibility alias for `skos:scopeNote`.
 *
 * @example
 * ```ts
 * import { SKOS_SCOPENOTE } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS_SCOPENOTE.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link SKOS.scopeNote}.
 * @category interop
 * @since 0.0.0
 */
export const SKOS_SCOPENOTE = SKOS.scopeNote;

/**
 * Compatibility alias for `skos:example`.
 *
 * @example
 * ```ts
 * import { SKOS_EXAMPLE } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS_EXAMPLE.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link SKOS.example}.
 * @category interop
 * @since 0.0.0
 */
export const SKOS_EXAMPLE = SKOS.example;

/**
 * Compatibility alias for `skos:note`.
 *
 * @example
 * ```ts
 * import { SKOS_NOTE } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS_NOTE.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link SKOS.note}.
 * @category interop
 * @since 0.0.0
 */
export const SKOS_NOTE = SKOS.note;

/**
 * Compatibility alias for `skos:broader`.
 *
 * @example
 * ```ts
 * import { SKOS_BROADER } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS_BROADER.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link SKOS.broader}.
 * @category interop
 * @since 0.0.0
 */
export const SKOS_BROADER = SKOS.broader;

/**
 * Compatibility alias for `skos:narrower`.
 *
 * @example
 * ```ts
 * import { SKOS_NARROWER } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS_NARROWER.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link SKOS.narrower}.
 * @category interop
 * @since 0.0.0
 */
export const SKOS_NARROWER = SKOS.narrower;

/**
 * Compatibility alias for `skos:related`.
 *
 * @example
 * ```ts
 * import { SKOS_RELATED } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS_RELATED.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link SKOS.related}.
 * @category interop
 * @since 0.0.0
 */
export const SKOS_RELATED = SKOS.related;

/**
 * Compatibility alias for `skos:exactMatch`.
 *
 * @example
 * ```ts
 * import { SKOS_EXACTMATCH } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS_EXACTMATCH.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link SKOS.exactMatch}.
 * @category interop
 * @since 0.0.0
 */
export const SKOS_EXACTMATCH = SKOS.exactMatch;

/**
 * Compatibility alias for `skos:closeMatch`.
 *
 * @example
 * ```ts
 * import { SKOS_CLOSEMATCH } from "@effect-ontology/Rdf/Constants.ts"
 *
 * console.log(SKOS_CLOSEMATCH.termType) // "NamedNode"
 * ```
 *
 * @deprecated Use {@link SKOS.closeMatch}.
 * @category interop
 * @since 0.0.0
 */
export const SKOS_CLOSEMATCH = SKOS.closeMatch;
