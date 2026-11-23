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
 * `Turtle` matches a subject written `<subjectPrefix><term>` at line start and
 * typed (`a` or `rdf:type`) as an OWL class or property, an RDFS class or
 * datatype, or an RDF property. `RdfXml` matches an `rdf:Description` about
 * `#<term>` carrying such an `rdf:type`. `SpecDocument` matches
 * `<code><curiePrefix>:<term></code>` inside the HTML section with the given id,
 * for a vocabulary a specification document defines, such as the RDF-compatible
 * XSD datatypes. The checks cover the layouts of the pinned artifacts; they are
 * not general parsers.
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
 * Decoded type of {@link VocabularyDeclaration}.
 *
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
 * Software and Document License (`W3C-20150513`). The nanopublication schema
 * is pinned under `CC-BY-SA-3.0` by operator ruling: the CC BY-SA 3.0 notice of
 * its companion nschema.html covers it, and its bytes are vendored with that
 * license in `@beep/rdf` `data/vocab/nanopub-nschema`; only its term IRIs are projected.
 *
 * **Example** (Count the pinned namespaces)
 *
 * ```ts
 * import { pinnedVocabularyRows } from "@beep/repo-cli/commands/SyncDataToTs/targets/PinnedVocabularies"
 * console.log(pinnedVocabularyRows.length) // 12
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const pinnedVocabularyRows: ReadonlyArray<typeof VocabularyPin.Encoded> = [
  {
    prefix: "as",
    // Web Annotation binds `as:` to the http form (anno.jsonld); the AS2 artifact writes the https form.
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
    terms: ["anyURI", "boolean", "dateTime", "double", "integer", "string"],
  },
];

const declarationTypes =
  "owl:(?:Class|ObjectProperty|DatatypeProperty|AnnotationProperty|FunctionalProperty)|rdfs:(?:Class|Datatype)|rdf:Property";
const rdfXmlDeclarationTypes =
  "http://www\\.w3\\.org/(?:2002/07/owl#(?:Class|ObjectProperty|DatatypeProperty|AnnotationProperty)|1999/02/22-rdf-syntax-ns#Property)";

const sectionText = (text: string, section: string): string =>
  pipe(
    Str.indexOf(`<section id="${section}"`)(text),
    O.map((start) => Str.slice(start)(text)),
    O.flatMap((rest) => A.head(Str.split("</section>")(rest))),
    O.getOrElse(() => "")
  );

// Whether an artifact's text declares a curated term under its declaration strategy.
const declaresTerm = (declaration: VocabularyDeclaration, text: string, term: string): boolean =>
  VocabularyDeclaration.match(declaration, {
    Turtle: ({ subjectPrefix }) =>
      O.isSome(
        Str.match(
          new RegExp(
            `^${Regex.escape(subjectPrefix)}${Regex.escape(term)}\\s+(?:a|rdf:type)\\s+(?:[\\w-]*:[\\w-]+\\s*,\\s*)*(?:${declarationTypes})\\b`,
            "mu"
          )
        )(text)
      ),
    RdfXml: () =>
      O.isSome(
        Str.match(
          new RegExp(
            `<rdf:Description rdf:about="#${Regex.escape(term)}">(?:(?!</rdf:Description>)[\\s\\S])*<rdf:type rdf:resource="${rdfXmlDeclarationTypes}"/>`,
            "u"
          )
        )(text)
      ),
    SpecDocument: ({ section, curiePrefix }) =>
      Str.includes(`<code>${curiePrefix}:${term}</code>`)(sectionText(text, section)),
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
  const undeclared = A.filter(terms, (term) => !declaresTerm(pin.declaration, source.text, term));
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

// The pin owns the namespace and the live terms; the hand-authored rows
// (bindings, deprecations, projection) are carried from the checked-in shard.
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
 * console.log(makePinnedVocabulariesTarget(pinnedVocabularyRows).sourceUrls.length) // 12
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
