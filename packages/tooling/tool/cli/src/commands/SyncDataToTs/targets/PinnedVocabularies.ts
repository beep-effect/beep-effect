/**
 * Byte-pinned acquisition of the external vocabularies the identity registry
 * declares: each curated term list is proved against the pinned artifact, then
 * written as the namespace's identity registry shard and its `@beep/rdf` pin.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { RegistryShard } from "@beep/identity/Term";
import { NamespacePins } from "@beep/rdf/NamespacePin";
import { findRepoRoot } from "@beep/repo-utils";
import { doctestFenceInfo } from "@beep/repo-utils/JSDoc/DoctestSource";
import { SpecificationRevision } from "@beep/schema/Conformance";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Regex from "effect/RegExp";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { renderRegistryJson } from "../../Identity/Registry.ts";
import {
  fetchSource,
  formatJson,
  formatTsLiteral,
  normalizeJson,
  outputFile,
  sourceMetadata,
} from "../internal/Source.ts";
import { SyncDataTargetMetadata, SyncDataTargetProjection, SyncDataToTsError } from "../SyncDataToTs.schemas.ts";
import type { SyncDataTarget } from "../SyncDataToTs.schemas.ts";

const $I = $RepoCliId.create("commands/SyncDataToTs/targets/PinnedVocabularies");
const targetId = "pinned-vocabularies";
const shardDirectory = "packages/foundation/modeling/identity/registry/namespaces";
const shardPath = (prefix: string): string => `${shardDirectory}/${prefix}.json`;
const pinDirectory = "packages/foundation/modeling/rdf/src/Vocab/generated";
const canonicalPath = `${pinDirectory}/namespace-pins.data.json`;
const pinModulePath = `${pinDirectory}/NamespacePins.data.ts`;

/**
 * How the pinned artifact declares a curated term, one case per artifact format.
 *
 * **Details**
 *
 * A term is declared when the artifact types it. `Turtle` matches a subject
 * written `<subjectPrefix><term>` at line start whose statement, up to its
 * closing `.`, carries `a` or `rdf:type`, or `owl:inverseOf`, which entails an
 * object property. `RdfXml` matches a typed node element, or an
 * `rdf:Description` carrying an `rdf:type`, about `#<term>` or the namespace
 * IRI followed by the term. `SpecDocument` matches
 * `<code><curiePrefix>:<term></code>`, optionally wrapping a link, inside the
 * HTML section or `h2` heading with the given id, for a vocabulary a
 * specification document defines, such as the RDF-compatible XSD datatypes.
 * The checks cover the layouts of the pinned artifacts; they are not general
 * parsers.
 *
 * **Example** (Decode a Turtle declaration strategy)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { VocabularyDeclaration } from "@beep/repo-cli/commands/SyncDataToTs/targets/PinnedVocabularies"
 *
 * const declaration = S.decodeUnknownSync(VocabularyDeclaration)({ _tag: "Turtle", subjectPrefix: "oa:" })
 * console.log(declaration._tag) // "Turtle"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VocabularyDeclaration = S.TaggedUnion({
  Turtle: { subjectPrefix: S.String.check(S.isPattern(/^(?:[A-Za-z][A-Za-z0-9-]*)?:$/u)) },
  RdfXml: {},
  SpecDocument: {
    section: S.String.check(S.isPattern(/^[A-Za-z][A-Za-z0-9-]*$/u)),
    curiePrefix: S.String.check(S.isPattern(/^[A-Za-z][A-Za-z0-9-]*$/u)),
  },
}).pipe(
  $I.annoteSchema("VocabularyDeclaration", {
    description: "How a pinned vocabulary artifact declares each curated term, by artifact format.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type VocabularyDeclaration = typeof VocabularyDeclaration.Type;

/**
 * The acquisition pin of one external vocabulary: where to fetch it, the
 * expected bytes, the metadata it must carry and the curated terms it must declare.
 *
 * **Example** (Inspect the pinned prefixes)
 *
 * ```ts
 * import { pinnedVocabularyRows } from "@beep/repo-cli/commands/SyncDataToTs/targets/PinnedVocabularies"
 * console.log(pinnedVocabularyRows.map((row) => row.prefix))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VocabularyPin extends S.Opaque<VocabularyPin, { readonly brand: unique symbol }>()(
  S.Struct({
    prefix: S.NonEmptyString,
    namespace: S.NonEmptyString,
    location: S.NonEmptyString,
    revision: SpecificationRevision,
    license: S.NonEmptyString,
    attribution: S.NonEmptyString,
    version: S.NonEmptyString,
    sha256: S.String.check(S.isPattern(/^[a-f0-9]{64}$/u)),
    markers: S.Array(S.NonEmptyString),
    declaration: VocabularyDeclaration,
    terms: S.NonEmptyArray(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("VocabularyPin", {
      description: "Immutable acquisition pin, required metadata markers and curated term list of one vocabulary.",
    })
  )
) {}

const turtle = (subjectPrefix: string) => ({ _tag: "Turtle", subjectPrefix }) as const;

const sparPin = (options: {
  readonly prefix: string;
  readonly name: string;
  readonly contributors: string;
  readonly commit: string;
  readonly release: string;
  readonly version: string;
  readonly sha256: string;
  readonly licenseIri: string;
  readonly terms: readonly [string, ...Array<string>];
}): typeof VocabularyPin.Encoded => ({
  prefix: options.prefix,
  namespace: `http://purl.org/spar/${options.prefix}/`,
  location: `https://raw.githubusercontent.com/SPAROntologies/${options.prefix}/${options.commit}/docs/${options.release}/${options.prefix}.ttl`,
  revision: {
    kind: "gitCommit",
    repository: `https://github.com/SPAROntologies/${options.prefix}`,
    commit: options.commit,
  },
  license: "CC-BY-4.0",
  attribution: `${options.name} by David Shotton and Silvio Peroni. Contributors: ${options.contributors}. CC BY 4.0. Curated term names projected to TypeScript.`,
  version: options.version,
  sha256: options.sha256,
  markers: [
    `@prefix ${options.prefix}: <http://purl.org/spar/${options.prefix}/> .`,
    `owl:versionIRI ${options.prefix}:${options.release}`,
    `dcterms:license <${options.licenseIri}>`,
  ],
  declaration: turtle(`${options.prefix}:`),
  terms: options.terms,
});

const w3cAttribution = (title: string): string =>
  `${title}. Copyright World Wide Web Consortium; W3C liability, trademark and document use rules apply. Curated term names projected to TypeScript.`;

/**
 * The encoded acquisition pins, one per pinned registry namespace.
 *
 * **Details**
 *
 * The SPAR pins (`cito`, `deo`, `doco`, `fabio`) carry over from the former
 * `spar-terms` target. Upstream byte digests were recorded by running this
 * target, never typed in. The W3C artifacts carry no SPDX-identifiable notice
 * of their own, so they are pinned under `LicenseRef-W3C-Document`, except
 * ActivityStreams, whose repository licenses its documents under the W3C
 * Software and Document License (`W3C-20150513`), and DCAT 3, whose artifact
 * states CC BY 4.0. DCMI Metadata Terms carry DCMI's CC BY 4.0 document
 * notice, Schema.org its CC BY-SA 3.0 schema terms, and SEMAPV the CC0 1.0
 * its artifact states. VoID is pinned at the W3C Interest Group Note's term
 * index, because its RDFS file states no license. The nanopublication schema
 * is pinned under `CC-BY-SA-3.0` by operator ruling: the CC BY-SA 3.0 notice of
 * its companion nschema.html covers it, and its bytes are vendored with that
 * license in `@beep/rdf` `data/vocab/nanopub-nschema`; only its term IRIs are projected.
 *
 * Web Annotation binds as: to the HTTP namespace in anno.jsonld, whereas
 * the AS2 artifact writes its HTTPS form.
 *
 * **Example** (Count the pinned namespaces)
 *
 * ```ts
 * import { pinnedVocabularyRows } from "@beep/repo-cli/commands/SyncDataToTs/targets/PinnedVocabularies"
 * console.log(pinnedVocabularyRows.length) // 21
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const pinnedVocabularyRows: ReadonlyArray<typeof VocabularyPin.Encoded> = [
  {
    prefix: "as",
    namespace: "http://www.w3.org/ns/activitystreams#",
    location:
      "https://raw.githubusercontent.com/w3c/activitystreams/258bce0cd50ec9683b1417adfa1af926d447cda5/vocabulary/activitystreams2.owl",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/w3c/activitystreams",
      commit: "258bce0cd50ec9683b1417adfa1af926d447cda5",
    },
    license: "W3C-20150513",
    attribution:
      "Activity Streams 2.0 Vocabulary, W3C Social Web Working Group. W3C Software and Document License. Curated term names projected to TypeScript.",
    version: "W3C Recommendation 2017-05-23",
    sha256: "d1cfeb6f830f47f4271ebdb53cef1cad5b7b9bede76144a1bf00b07c901ab9d5",
    markers: [
      "@prefix as: <https://www.w3.org/ns/activitystreams#> .",
      "<https://www.w3.org/ns/activitystreams#> a owl:Ontology",
    ],
    declaration: turtle("as:"),
    terms: ["generator"],
  },
  sparPin({
    prefix: "cito",
    name: "Cito",
    contributors: "Paolo Ciccarese, Sebastian Barzaghi and Tim Clark",
    commit: "d34b42e8d4d1c9d45bc530599328897805116994",
    release: "2026-09-03",
    version: "2.9.0",
    sha256: "1b0570e2126525365d325771d1c8cf3ba399f6dfd829cb69fd2851f42802d7b0",
    licenseIri: "https://creativecommons.org/licenses/by/4.0/legalcode",
    terms: ["cites", "citesAsEvidence"],
  }),
  {
    prefix: "dcat",
    namespace: "http://www.w3.org/ns/dcat#",
    location: "https://www.w3.org/ns/dcat3.ttl",
    revision: { kind: "retrievedSnapshot", retrievedOn: "2026-11-23" },
    license: "CC-BY-4.0",
    attribution:
      "Data Catalog Vocabulary (DCAT) - Version 3, World Wide Web Consortium. CC BY 4.0. Curated term names projected to TypeScript.",
    version: "3",
    sha256: "d1624d3bbf364f6fc1d43b9a188bbb9e67639b1a7d46a5cb7ea3f5d47d02b62f",
    markers: [
      "@prefix dcat: <http://www.w3.org/ns/dcat#> .",
      "dcterms:license <https://creativecommons.org/licenses/by/4.0/>",
      'owl:versionInfo "3"',
    ],
    declaration: turtle("dcat:"),
    terms: [
      "Catalog",
      "CatalogRecord",
      "DataService",
      "Dataset",
      "DatasetSeries",
      "Distribution",
      "Relationship",
      "Resource",
      "Role",
      "accessService",
      "accessURL",
      "bbox",
      "byteSize",
      "catalog",
      "centroid",
      "compressFormat",
      "contactPoint",
      "dataset",
      "distribution",
      "downloadURL",
      "endDate",
      "endpointDescription",
      "endpointURL",
      "first",
      "hadRole",
      "inCatalog",
      "inSeries",
      "keyword",
      "landingPage",
      "last",
      "mediaType",
      "next",
      "packageFormat",
      "prev",
      "qualifiedRelation",
      "record",
      "resource",
      "servesDataset",
      "service",
      "spatialResolutionInMeters",
      "startDate",
      "temporalResolution",
      "theme",
      "themeTaxonomy",
      "version",
    ],
  },
  {
    prefix: "dcterms",
    namespace: "http://purl.org/dc/terms/",
    location: "https://www.dublincore.org/specifications/dublin-core/dcmi-terms/dublin_core_terms.ttl",
    revision: { kind: "retrievedSnapshot", retrievedOn: "2026-11-23" },
    license: "CC-BY-4.0",
    attribution:
      "DCMI Metadata Terms. Copyright 2012 Dublin Core Metadata Initiative, http://dublincore.org/about/copyright/. CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. Curated term names projected to TypeScript.",
    version: "2012-06-14",
    sha256: "13df401072dd7015bf9d75162f3e41c8138075304b7b9cc1aa1e9c16db976797",
    markers: [
      "@prefix dcterms: <http://purl.org/dc/terms/> .",
      'dcterms:modified "2012-06-14"^^<http://www.w3.org/2001/XMLSchema#date>',
    ],
    declaration: turtle("dcterms:"),
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
    ],
  },
  sparPin({
    prefix: "deo",
    name: "Deo",
    contributors: "Sebastian Barzaghi",
    commit: "dfaa0904b1b7905cd8293dc2f1b9992c2871d0d4",
    release: "2026-08-14",
    version: "1.2.0",
    sha256: "c66ac7523cef1d57b88fbb8d8e5bb3fe81e8ce2932e24167700f0aafd89126cc",
    licenseIri: "http://creativecommons.org/licenses/by/4.0/",
    terms: ["Introduction", "Methods"],
  }),
  sparPin({
    prefix: "doco",
    name: "Doco",
    contributors: "Sebastian Barzaghi",
    commit: "4c4109a64148c207f80d48a611a79a2d996a44b4",
    release: "2026-06-25",
    version: "1.4.0",
    sha256: "616c0f7611168d4ff8325ce361ab79625f9664aead7bfe6bf8e0c66982f7c4ae",
    licenseIri: "https://creativecommons.org/licenses/by/4.0/legalcode",
    terms: ["Figure", "List", "Paragraph", "Section", "SectionTitle", "Title"],
  }),
  sparPin({
    prefix: "fabio",
    name: "Fabio",
    contributors: "Paolo Ciccarese, Sebastian Barzaghi and Tim Clark",
    commit: "ea5b2cd49a7a8f4dc695d633c76bb05608c085db",
    release: "2026-09-03",
    version: "2.3.1",
    sha256: "86523bded037828b13c3d2083c6eccdb0daa223009d4ed8ddd70ff1a4d1789ea",
    licenseIri: "https://creativecommons.org/licenses/by/4.0/legalcode",
    terms: ["Report"],
  }),
  {
    prefix: "gufo",
    namespace: "http://purl.org/nemo/gufo#",
    location: "https://raw.githubusercontent.com/nemo-ufes/gufo/12b098158a9244179c5e0e2534cd85254a2d3b7e/gufo.ttl",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/nemo-ufes/gufo",
      commit: "12b098158a9244179c5e0e2534cd85254a2d3b7e",
    },
    license: "CC-BY-4.0",
    attribution:
      "gUFO: A Lightweight Implementation of the Unified Foundational Ontology (UFO), by J. P. A. Almeida, G. Guizzardi, T. P. Sales and R. A. Falbo. CC BY 4.0. Curated term names projected to TypeScript.",
    version: "1.0.0",
    sha256: "b234c7a22d738b66dc8fcf735146fdbe828122e2a04bec43c8c9b08f34fd9027",
    markers: [
      "@prefix gufo: <http://purl.org/nemo/gufo#> .",
      "owl:versionIRI <http://purl.org/nemo/gufo#/1.0.0>",
      "dct:license <https://creativecommons.org/licenses/by/4.0/legalcode>",
    ],
    declaration: turtle("gufo:"),
    terms: [
      "Category",
      "Event",
      "Kind",
      "Mixin",
      "Object",
      "Phase",
      "PhaseMixin",
      "Quality",
      "Relator",
      "Role",
      "RoleMixin",
      "SubKind",
      "mediates",
    ],
  },
  {
    prefix: "nif",
    namespace: "http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#",
    location:
      "https://raw.githubusercontent.com/NLP2RDF/ontologies/225301dd65a24578e8b26fa276690f5c0623dcce/nif-core/nif-core.ttl",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/NLP2RDF/ontologies",
      commit: "225301dd65a24578e8b26fa276690f5c0623dcce",
    },
    license: "Apache-2.0 OR CC-BY-3.0",
    attribution:
      "NIF 2.1 Core Ontology, NLP2RDF project. Dual-licensed under Apache 2.0 and CC BY 3.0. Curated term names projected to TypeScript.",
    version: "2.1.0",
    sha256: "4416ff80b6d14634e9c6609a2d27198c7ac804e2b7a0d8fd165d7b0b3fa1212d",
    markers: [
      "@prefix nif: <http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#> .",
      'owl:versionInfo "2.1.0"',
      "dcterms:license <http://creativecommons.org/licenses/by/3.0/>",
      "dcterms:license <http://www.apache.org/licenses/LICENSE-2.0>",
    ],
    declaration: turtle("nif:"),
    terms: ["Context", "Sentence", "Word", "anchorOf", "beginIndex", "endIndex", "isString", "referenceContext"],
  },
  {
    prefix: "np",
    namespace: "http://www.nanopub.org/nschema#",
    location:
      "https://raw.githubusercontent.com/Nanopublication/Guidelines/8388dd90795b264f4b01c64d0f7218babcae4871/nschema.ttl",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/Nanopublication/Guidelines",
      commit: "8388dd90795b264f4b01c64d0f7218babcae4871",
    },
    license: "CC-BY-SA-3.0",
    attribution:
      "Nanopublication schema, Nanopublication Guidelines (github.com/Nanopublication/Guidelines, nschema.ttl at commit 8388dd90795b); editors and authors as named in its nschema.html. Licensed CC BY-SA 3.0 under the nschema.html notice, which the operator ruling of 2026-11-23 treats as covering nschema.ttl. The file is vendored at packages/foundation/modeling/rdf/data/vocab/nanopub-nschema; the vendored file and anything derived from it stay under CC BY-SA 3.0.",
    version: "2013-10-23",
    sha256: "1275f6a00121f54248899b9a4c39b2511fdbb65b2925a4dc6f4a13174059f649",
    markers: ["@prefix np: <http://www.nanopub.org/nschema#>.", 'dc:modified "2013-10-23"^^xsd:date'],
    declaration: turtle("np:"),
    terms: ["Nanopublication", "hasAssertion", "hasProvenance", "hasPublicationInfo"],
  },
  {
    prefix: "oa",
    namespace: "http://www.w3.org/ns/oa#",
    location: "https://www.w3.org/ns/oa.ttl",
    revision: { kind: "retrievedSnapshot", retrievedOn: "2026-11-19" },
    license: "LicenseRef-W3C-Document",
    attribution: w3cAttribution("Web Annotation Vocabulary, W3C Recommendation 2017-02-23"),
    version: "2016-11-12T21:28:11Z",
    sha256: "f661e37d33bf29176390101687711734a7e33a716bdecfb66b90c732373d7af5",
    markers: ["@prefix oa: <http://www.w3.org/ns/oa#> .", 'owl:versionInfo "2016-11-12T21:28:11Z"'],
    declaration: turtle("oa:"),
    terms: [
      "Annotation",
      "FragmentSelector",
      "RangeSelector",
      "SpecificResource",
      "TextPositionSelector",
      "TextQuoteSelector",
      "end",
      "exact",
      "hasBody",
      "hasSelector",
      "hasSource",
      "hasTarget",
      "prefix",
      "refinedBy",
      "start",
      "suffix",
    ],
  },
  {
    prefix: "owl",
    namespace: "http://www.w3.org/2002/07/owl#",
    location: "https://www.w3.org/2002/07/owl.ttl",
    revision: { kind: "retrievedSnapshot", retrievedOn: "2026-11-23" },
    license: "LicenseRef-W3C-Document",
    attribution: w3cAttribution("The OWL 2 Schema vocabulary (OWL 2)"),
    version: "$Date: 2009/11/15 10:54:12 $",
    sha256: "718fa1db7840d3315bfce94398543f91437ef6fe933054fd93f5471d19262fc5",
    markers: [
      "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
      'dc:title "The OWL 2 Schema vocabulary (OWL 2)"',
      'owl:versionInfo "$Date: 2009/11/15 10:54:12 $"',
    ],
    declaration: turtle("owl:"),
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
    ],
  },
  {
    prefix: "prov",
    namespace: "http://www.w3.org/ns/prov#",
    location: "https://www.w3.org/ns/prov-o-20130430",
    revision: { kind: "datedSnapshot", date: "2013-04-30" },
    license: "LicenseRef-W3C-Document",
    attribution: w3cAttribution("PROV-O: The PROV Ontology, W3C Recommendation 2013-04-30"),
    version: "Recommendation version 2013-04-30",
    sha256: "3d03c8e15753178541fb8cd59fbefecaf1861f9c37ef75190c6e938b85fb0c3d",
    markers: ["@prefix : <http://www.w3.org/ns/prov#> .", "owl:versionIRI <http://www.w3.org/ns/prov-o-20130430>"],
    declaration: turtle(":"),
    terms: [
      "Activity",
      "Agent",
      "Association",
      "Attribution",
      "Derivation",
      "Entity",
      "Generation",
      "PrimarySource",
      "SoftwareAgent",
      "Usage",
      "activity",
      "agent",
      "atTime",
      "endedAtTime",
      "entity",
      "generatedAtTime",
      "hadPlan",
      "hadPrimarySource",
      "invalidatedAtTime",
      "qualifiedAssociation",
      "qualifiedAttribution",
      "qualifiedDerivation",
      "qualifiedGeneration",
      "qualifiedPrimarySource",
      "qualifiedUsage",
      "specializationOf",
      "startedAtTime",
      "used",
      "value",
      "wasAssociatedWith",
      "wasAttributedTo",
      "wasDerivedFrom",
      "wasGeneratedBy",
      "wasQuotedFrom",
      "wasRevisionOf",
    ],
  },
  {
    prefix: "rdf",
    namespace: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    location: "https://www.w3.org/1999/02/22-rdf-syntax-ns.ttl",
    revision: { kind: "retrievedSnapshot", retrievedOn: "2026-11-23" },
    license: "LicenseRef-W3C-Document",
    attribution: w3cAttribution("The RDF Concepts Vocabulary (RDF)"),
    version: "2019-12-16",
    sha256: "93d52b1a5824c7dd6504ca79c16205c0b740a0ba68b7a14952780f52561186a2",
    markers: [
      "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
      'dc:title "The RDF Concepts Vocabulary (RDF)"',
      'dc:date "2019-12-16"',
    ],
    declaration: turtle("rdf:"),
    terms: [
      "Alt",
      "Bag",
      "HTML",
      "JSON",
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
    ],
  },
  {
    prefix: "rdfs",
    namespace: "http://www.w3.org/2000/01/rdf-schema#",
    location: "https://www.w3.org/2000/01/rdf-schema.ttl",
    revision: { kind: "retrievedSnapshot", retrievedOn: "2026-11-23" },
    license: "LicenseRef-W3C-Document",
    attribution: w3cAttribution("The RDF Schema vocabulary (RDFS)"),
    version: "unversioned, retrieved 2026-11-23",
    sha256: "ecee3a011b7c13ea2a7e40b0a208bfe6be53d69fdd53ee035e09e9f9e5108ad6",
    markers: ["@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .", 'dc:title "The RDF Schema vocabulary (RDFS)"'],
    declaration: turtle("rdfs:"),
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
    ],
  },
  {
    prefix: "schema",
    namespace: "https://schema.org/",
    location:
      "https://raw.githubusercontent.com/schemaorg/schemaorg/5f2d8cdec99b7329459ef6584e94b6a840f88471/data/releases/30.1/schemaorg-current-https.ttl",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/schemaorg/schemaorg",
      commit: "5f2d8cdec99b7329459ef6584e94b6a840f88471",
    },
    license: "CC-BY-SA-3.0",
    attribution:
      "Schema.org vocabulary, release 30.1. Schema.org schemas are made available under CC BY-SA 3.0, https://schema.org/docs/terms.html. Curated term names projected to TypeScript.",
    version: "30.1",
    sha256: "7f15ca89398c4f235f478a4b3b8d1f975d63c5a860b77c8a8fce01f791b7ae2f",
    markers: ["@prefix schema: <https://schema.org/> ."],
    declaration: turtle("schema:"),
    terms: [
      "CreativeWork",
      "Event",
      "Organization",
      "Person",
      "SportsTeam",
      "Thing",
      "URL",
      "birthDate",
      "knows",
      "memberOf",
      "name",
      "url",
    ],
  },
  {
    prefix: "semapv",
    namespace: "https://w3id.org/semapv/vocab/",
    location:
      "https://raw.githubusercontent.com/mapping-commons/semantic-mapping-vocabulary/0db5676d4ce4854543281a6c983a55fd9a6ef521/semapv.owl",
    revision: {
      kind: "gitCommit",
      repository: "https://github.com/mapping-commons/semantic-mapping-vocabulary",
      commit: "0db5676d4ce4854543281a6c983a55fd9a6ef521",
    },
    license: "CC0-1.0",
    attribution:
      "Semantic Mapping Vocabulary (SEMAPV), mapping-commons, release 2026-06-10. CC0 1.0. Curated term names projected to TypeScript.",
    version: "2026-06-10",
    sha256: "f072f1472767530231f045a67f717066754b1e83301f02ec030381cdb4045c6b",
    markers: [
      '<dcterms:license rdf:resource="https://creativecommons.org/publicdomain/zero/1.0/"/>',
      '<owl:versionIRI rdf:resource="http://w3id.org/semapv/vocab/releases/2026-06-10/semapv.owl"/>',
    ],
    declaration: { _tag: "RdfXml" },
    terms: [
      "LexicalMatching",
      "LogicalReasoning",
      "ManualMappingCuration",
      "SemanticSimilarityThresholdMatching",
      "UnspecifiedMatching",
    ],
  },
  {
    prefix: "sh",
    namespace: "http://www.w3.org/ns/shacl#",
    location: "https://www.w3.org/ns/shacl.ttl",
    revision: { kind: "retrievedSnapshot", retrievedOn: "2026-11-23" },
    license: "LicenseRef-W3C-Document",
    attribution: w3cAttribution("W3C Shapes Constraint Language (SHACL) Vocabulary"),
    version: "unversioned, retrieved 2026-11-23",
    sha256: "0e5d8aea0eab98a072d4a02faaee1ee914ec99eab2ca473429726faed4a13f69",
    markers: [
      "@prefix sh:   <http://www.w3.org/ns/shacl#> .",
      'rdfs:label "W3C Shapes Constraint Language (SHACL) Vocabulary"@en',
    ],
    declaration: turtle("sh:"),
    terms: [
      "ClassConstraintComponent",
      "DatatypeConstraintComponent",
      "HasValueConstraintComponent",
      "Info",
      "MinCountConstraintComponent",
      "NodeShape",
      "Warning",
      "class",
      "datatype",
      "hasValue",
      "in",
      "maxCount",
      "minCount",
      "node",
      "path",
      "property",
      "targetClass",
      "targetNode",
      "xone",
    ],
  },
  {
    prefix: "skos",
    namespace: "http://www.w3.org/2004/02/skos/core#",
    location: "https://www.w3.org/2009/08/skos-reference/skos.rdf",
    revision: { kind: "datedSnapshot", date: "2009-08-18" },
    license: "LicenseRef-W3C-Document",
    attribution: w3cAttribution("SKOS Simple Knowledge Organization System Reference, W3C Recommendation 2009-08-18"),
    version: "W3C Recommendation 2009-08-18",
    sha256: "e79633b8d0564816cee8a99f5c9acf9a0e6fc7257c7209acd684ecad53a89dd6",
    markers: [
      'xmlns:skos="http://www.w3.org/2004/02/skos/core#"',
      '<owl:Ontology rdf:about="http://www.w3.org/2004/02/skos/core">',
    ],
    declaration: { _tag: "RdfXml" },
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
    ],
  },
  {
    prefix: "void",
    namespace: "http://rdfs.org/ns/void#",
    location: "https://www.w3.org/TR/2011/NOTE-void-20110303/",
    revision: { kind: "datedSnapshot", date: "2011-03-03" },
    license: "LicenseRef-W3C-Document",
    attribution: w3cAttribution(
      "Describing Linked Datasets with the VoID Vocabulary, W3C Interest Group Note 2011-03-03, section 8 (Index of VoID classes and properties)"
    ),
    version: "W3C Interest Group Note 2011-03-03",
    sha256: "54e5a4fcd28ea26b77e54402a944774d6de1af528e8ca8ad21b3d8601b8051ce",
    markers: ["<title>Describing Linked Datasets with the VoID Vocabulary</title>", '<h2 id="cheatsheet">'],
    declaration: { _tag: "SpecDocument", section: "cheatsheet", curiePrefix: "void" },
    terms: ["Dataset", "triples"],
  },
  {
    prefix: "xsd",
    namespace: "http://www.w3.org/2001/XMLSchema#",
    location: "https://www.w3.org/TR/2014/REC-rdf11-concepts-20140225/",
    revision: { kind: "datedSnapshot", date: "2014-02-25" },
    license: "LicenseRef-W3C-Document",
    attribution: w3cAttribution(
      "RDF 1.1 Concepts and Abstract Syntax, W3C Recommendation 2014-02-25, section 5.1 (RDF-compatible XSD datatypes)"
    ),
    version: "W3C Recommendation 2014-02-25",
    sha256: "3838c992097f72ee8784b6c96194d9879f86f2e08f53ced5a05aa4031750c5ac",
    markers: ["<title>RDF 1.1 Concepts and Abstract Syntax</title>", '<section id="xsd-datatypes"'],
    declaration: { _tag: "SpecDocument", section: "xsd-datatypes", curiePrefix: "xsd" },
    terms: ["anyURI", "boolean", "dateTime", "decimal", "double", "integer", "string"],
  },
];

const turtleStatementEnd = /\s\.[ \t]*$/mu;
const turtleTyping = /(?:^\S+|;)\s+(?:a|rdf:type|owl:inverseOf)\s+(?:<[^>\s]+>|[\w-]*:[\w-]+)/u;

const turtleSubjectBlock = (text: string, subjectPrefix: string, term: string): O.Option<string> =>
  pipe(
    Str.search(new RegExp(`^${Regex.escape(subjectPrefix)}${Regex.escape(term)}(?=\\s)`, "mu"))(text),
    O.map((start) => Str.slice(start)(text)),
    O.map((rest) =>
      O.match(Str.search(turtleStatementEnd)(rest), {
        onNone: () => rest,
        onSome: (end) => Str.slice(0, end)(rest),
      })
    )
  );

const sectionText = (text: string, section: string): string =>
  pipe(
    Str.indexOf(`id="${section}"`)(text),
    O.map((start) => Str.slice(start)(text)),
    O.map((rest) =>
      pipe(
        [Str.indexOf("</section>")(rest), O.map(Str.search(/<h2[\s>]/u)(Str.slice(1)(rest)), (end) => end + 1)],
        A.getSomes,
        A.match({ onEmpty: () => rest, onNonEmpty: (ends) => Str.slice(0, A.min(ends, Order.Number))(rest) })
      )
    ),
    O.getOrElse(() => "")
  );

const declaresTerm = (pin: VocabularyPin, text: string, term: string): boolean =>
  VocabularyDeclaration.match(pin.declaration, {
    Turtle: ({ subjectPrefix }) =>
      O.exists(turtleSubjectBlock(text, subjectPrefix, term), (block) => turtleTyping.test(block)),
    RdfXml: () => {
      const about = `rdf:about="(?:#|${Regex.escape(pin.namespace)})${Regex.escape(term)}"`;
      return (
        new RegExp(`<(?!rdf:Description\\b)[\\w-]+:[\\w-]+ ${about}`, "u").test(text) ||
        new RegExp(
          `<rdf:Description ${about}>(?:(?!</rdf:Description>)[\\s\\S])*<rdf:type rdf:resource="[^"]+"/>`,
          "u"
        ).test(text)
      );
    },
    SpecDocument: ({ section, curiePrefix }) =>
      new RegExp(`<code>(?:<a [^>]*>)?${Regex.escape(`${curiePrefix}:${term}`)}(?:</a>)?</code>`, "u").test(
        sectionText(text, section)
      ),
  });

const sha256Hex = Effect.fn("SyncDataToTs.PinnedVocabularies.sha256Hex")(function* (text: string) {
  const crypto = yield* Digest.Digest;
  const digest = yield* crypto.digest(Digest.sha256, new TextEncoder().encode(text));
  return Hex.encode(digest);
});

const project = Effect.fn("SyncDataToTs.PinnedVocabularies.project")(function* (pin: VocabularyPin) {
  const source = yield* fetchSource(targetId, pin.prefix, pin.location);
  const fail = (message: string) => Effect.fail(SyncDataToTsError.make({ targetId, message, file: pin.location }));
  if (source.sha256 !== pin.sha256) {
    return yield* fail(
      `${pin.prefix}: artifact SHA-256 ${source.sha256} does not match the immutable pin ${pin.sha256}.`
    );
  }
  const missingMarkers = A.filter(pin.markers, (marker) => !Str.includes(marker)(source.text));
  if (A.isReadonlyArrayNonEmpty(missingMarkers)) {
    return yield* fail(`${pin.prefix}: pinned artifact metadata is missing: ${A.join(missingMarkers, " | ")}`);
  }
  const terms = A.sort(pin.terms, Str.Order);
  const undeclared = A.filter(terms, (term) => !declaresTerm(pin, source.text, term));
  if (A.isReadonlyArrayNonEmpty(undeclared)) {
    return yield* fail(`${pin.prefix}: curated terms have no declaration in the artifact: ${A.join(undeclared, ", ")}`);
  }
  const termsDigest = yield* sha256Hex(A.join(terms, "\n"));
  return {
    pin,
    terms,
    termsDigest,
    sha256: source.sha256,
    source: sourceMetadata(source, { version: pin.version }),
  };
});

type ProjectedVocabulary = Effect.Success<ReturnType<typeof project>>;

const encodedPin = (row: ProjectedVocabulary, revision: typeof SpecificationRevision.Encoded) => ({
  prefix: row.pin.prefix,
  namespace: row.pin.namespace,
  source: { location: row.pin.location, revision },
  license: row.pin.license,
  attribution: row.pin.attribution,
  version: row.pin.version,
  digest: `sha256:${row.sha256}`,
  termsDigest: `sha256:${row.termsDigest}`,
});

const emptyShardRows = { bindings: [], deprecations: [] } as const;

const encodedShard = (row: ProjectedVocabulary, existing: O.Option<typeof RegistryShard.Encoded>) => ({
  ...O.getOrElse(existing, () => emptyShardRows),
  namespace: { prefix: row.pin.prefix, iri: row.pin.namespace },
  terms: row.terms,
});

const decodePins = S.decodeUnknownEffect(S.Array(VocabularyPin));
const roundTripPins = S.decodeUnknownEffect(NamespacePins);
const encodePins = S.encodeEffect(NamespacePins);
const encodeRevision = S.encodeEffect(SpecificationRevision);
const roundTripShard = S.decodeUnknownEffect(RegistryShard);
const encodeShard = S.encodeEffect(RegistryShard);
const decodeExistingShard = S.decodeUnknownEffect(S.fromJsonString(RegistryShard));

const readExistingShard = Effect.fn("SyncDataToTs.PinnedVocabularies.readExistingShard")(function* (prefix: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = shardPath(prefix);
  const repoRoot = yield* findRepoRoot().pipe(
    SyncDataToTsError.mapError("Failed to locate the repo root for the existing registry shard", targetId, file)
  );
  const absolutePath = path.resolve(repoRoot, file);
  const exists = yield* fs
    .exists(absolutePath)
    .pipe(SyncDataToTsError.mapError("Failed to inspect the existing registry shard", targetId, file));
  if (!exists) {
    return O.none<typeof RegistryShard.Encoded>();
  }
  const content = yield* fs
    .readFileString(absolutePath)
    .pipe(SyncDataToTsError.mapError("Failed to read the existing registry shard", targetId, file));
  const shard = yield* Effect.flatMap(decodeExistingShard(content), encodeShard).pipe(
    SyncDataToTsError.mapError(`${prefix}: the existing registry shard is not a valid RegistryShard`, targetId, file)
  );
  return O.some(shard);
});

const renderPinModule = (rows: unknown): string => `/**
 * Generated by \`bun run beep sync-data-to-ts --target ${targetId}\`.
 * Each row pins one external registry namespace: source, revision, license,
 * attribution and the digests of the artifact bytes and the curated terms.
 * Do not edit by hand.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * The encoded namespace pin rows, strictly ascending by prefix.
 *
 * **Example** (Read the pinned prefixes)
 *
 * \`\`\`${doctestFenceInfo("Read the pinned prefixes")}
 * import { NamespacePinRows } from "@beep/rdf/Vocab/generated/NamespacePins.data"
 *
 * NamespacePinRows.length > 0 // => true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const NamespacePinRows = ${formatTsLiteral(rows)} as const;
`;

const validateProjections = Effect.fn("SyncDataToTs.PinnedVocabularies.validate")(function* (
  rows: ReadonlyArray<ProjectedVocabulary>,
  existingShards: ReadonlyArray<O.Option<typeof RegistryShard.Encoded>>
) {
  const revisions = yield* Effect.forEach(rows, (row) => encodeRevision(row.pin.revision), { concurrency: 1 });
  const pins = yield* roundTripPins(A.zipWith(rows, revisions, encodedPin));
  const pinRows = yield* encodePins(pins);
  const shards = yield* Effect.forEach(
    A.zip(rows, existingShards),
    ([row, existing]) =>
      Effect.map(Effect.flatMap(roundTripShard(encodedShard(row, existing)), encodeShard), (shard) =>
        outputFile(shardPath(row.pin.prefix), renderRegistryJson(shard))
      ),
    { concurrency: 1 }
  );
  return { pinRows, shards };
});

/**
 * Build the pinned-vocabularies target over a list of encoded acquisition pins.
 *
 * **When to use**
 *
 * Use with fixture pins to exercise acquisition offline; the checked-in target
 * is {@link pinnedVocabulariesTarget}.
 *
 * **Details**
 *
 * Each pin's artifact must match its byte digest, carry its metadata markers
 * and declare every curated term. The pin rewrites a shard's namespace and
 * terms only: the bindings, deprecations and projection of the checked-in
 * shard are decoded through `RegistryShard` and carried over, so a malformed
 * shard fails the target instead of being overwritten. The shards then feed
 * `bun run beep identity registry --write`, and the rdf term modules follow
 * with `--target vocab-terms`.
 *
 * **Example** (Build a target over the committed pins)
 *
 * ```ts
 * import {
 *   makePinnedVocabulariesTarget,
 *   pinnedVocabularyRows
 * } from "@beep/repo-cli/commands/SyncDataToTs/targets/PinnedVocabularies"
 *
 * console.log(makePinnedVocabulariesTarget(pinnedVocabularyRows).sourceUrls.length) // 21
 * ```
 *
 * @param pinRowsInput - The encoded acquisition pins the target fetches and proves.
 * @returns The sync target that writes their registry shards and namespace pins.
 * @category constructors
 * @since 0.0.0
 */
export const makePinnedVocabulariesTarget = (
  pinRowsInput: ReadonlyArray<typeof VocabularyPin.Encoded>
): SyncDataTarget => ({
  ...SyncDataTargetMetadata.make({
    id: targetId,
    access: "public",
    description: "Byte-pinned external vocabularies: identity registry shards and @beep/rdf namespace pins.",
    sourceUrls: A.map(pinRowsInput, (row) => row.location),
  }),
  acquire: Effect.gen(function* () {
    const pins = yield* decodePins(pinRowsInput).pipe(
      SyncDataToTsError.mapError("Failed to decode the pinned vocabulary rows", targetId)
    );
    const rows = yield* Effect.forEach(pins, project, { concurrency: 2 });
    const existingShards = yield* Effect.forEach(rows, (row) => readExistingShard(row.pin.prefix), {
      concurrency: 1,
    });
    const { pinRows, shards } = yield* validateProjections(rows, existingShards).pipe(
      SyncDataToTsError.mapError("Failed to validate the namespace pins and registry shards", targetId)
    );
    const canonical = yield* normalizeJson(targetId, pinRows);
    return SyncDataTargetProjection.make({
      canonicalPath,
      canonical,
      files: [
        ...shards,
        outputFile(pinModulePath, renderPinModule(pinRows)),
        outputFile(canonicalPath, formatJson(canonical)),
      ],
      sources: A.map(rows, (row) => row.source),
      recordCount: A.reduce(rows, 0, (count, row) => count + A.length(row.terms)),
      summary: `Pinned ${A.length(rows)} external vocabularies with byte and curated-term digests.`,
    });
  }),
});

/**
 * Acquires the pinned external vocabularies and writes their identity registry
 * shards and their `@beep/rdf` namespace pins.
 *
 * **Example** (Inspect the pinned-vocabularies target)
 *
 * ```ts
 * import { pinnedVocabulariesTarget } from "@beep/repo-cli/commands/SyncDataToTs/targets/PinnedVocabularies"
 * console.log(pinnedVocabulariesTarget.id) // "pinned-vocabularies"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const pinnedVocabulariesTarget: SyncDataTarget = makePinnedVocabulariesTarget(pinnedVocabularyRows);
