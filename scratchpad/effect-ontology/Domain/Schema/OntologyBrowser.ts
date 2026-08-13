/**
 * Read models returned by ontology-browser endpoints.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils, SemanticVersion } from "@beep/schema";
import * as S from "effect/Schema";
import { OntologyName } from "../Identity.ts";
import { AbsoluteIRI, IRI } from "../Rdf/Types.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/OntologyBrowser");

/**
 * Reference to an imported standards vocabulary.
 *
 * @example
 * ```ts
 * import { VocabularyRef } from "@effect-ontology/Schema/OntologyBrowser.ts"
 *
 * const vocabulary = VocabularyRef.fromUnknown({
 *   iri: "http://www.w3.org/ns/prov#",
 *   prefix: "prov",
 *   name: "PROV-O"
 * })
 * console.log(vocabulary.prefix) // "prov"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VocabularyRef extends S.Class<VocabularyRef>($I`VocabularyRef`)(
  {
    iri: AbsoluteIRI.annotateKey({
      description: "Absolute vocabulary namespace IRI.",
    }),
    prefix: S.NonEmptyString.annotateKey({
      description: "Non-empty compact prefix used when rendering vocabulary terms.",
    }),
    name: S.NonEmptyString.annotateKey({
      description: "Human-readable vocabulary name.",
    }),
    publisher: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional publisher or standards organization.",
      })
    ),
    specUrl: S.OptionFromOptionalKey(AbsoluteIRI).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional absolute IRI of the vocabulary specification.",
      })
    ),
  },
  $I.annote("VocabularyRef", {
    description:
      "Validated reference to a standards vocabulary, with Option-normalized publisher and specification IRI.",
  })
) {
  static readonly is = S.is(VocabularyRef);
  static readonly fromUnknown = S.decodeUnknownSync(VocabularyRef);
}

/**
 * Compact ontology metadata used in list views.
 *
 * @example
 * ```ts
 * import { OntologySummary } from "@effect-ontology/Schema/OntologyBrowser.ts"
 *
 * const summary = OntologySummary.fromUnknown({
 *   id: "claims",
 *   iri: "https://example.com/ontology/claims",
 *   title: "Claims",
 *   version: "1.0.0",
 *   classCount: 12,
 *   propertyCount: 30,
 *   importCount: 2
 * })
 * console.log(summary.classCount) // 12
 * ```
 *
 * @invariant All resource counts are non-negative integers.
 * @category models
 * @since 0.0.0
 */
export class OntologySummary extends S.Class<OntologySummary>($I`OntologySummary`)(
  {
    id: OntologyName.annotateKey({
      description: "Stable lowercase ontology registry identifier.",
    }),
    iri: AbsoluteIRI.annotateKey({
      description: "Canonical absolute ontology IRI.",
    }),
    title: S.NonEmptyString.annotateKey({
      description: "Human-readable ontology title.",
    }),
    description: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional non-empty ontology description.",
      })
    ),
    version: SemanticVersion.annotateKey({
      description: "Ontology release version.",
    }),
    classCount: NonNegativeInt.annotateKey({
      description: "Number of domain classes.",
    }),
    propertyCount: NonNegativeInt.annotateKey({
      description: "Number of ontology properties.",
    }),
    importCount: NonNegativeInt.annotateKey({
      description: "Number of imported vocabularies.",
    }),
  },
  $I.annote("OntologySummary", {
    description: "List-view ontology metadata with validated identity, IRI, version, and resource counts.",
  })
) {
  static readonly is = S.is(OntologySummary);
  static readonly fromUnknown = S.decodeUnknownSync(OntologySummary);
}

/**
 * Response containing all visible ontology summaries.
 *
 * @example
 * ```ts
 * import { OntologyListResponse } from "@effect-ontology/Schema/OntologyBrowser.ts"
 *
 * console.log(OntologyListResponse.make({}).ontologies.length) // 0
 * ```
 *
 * @category responses
 * @since 0.0.0
 */
export class OntologyListResponse extends S.Class<OntologyListResponse>($I`OntologyListResponse`)(
  {
    ontologies: S.Array(OntologySummary).pipe(
      SchemaUtils.withEmptyArrayDefaults<OntologySummary>(),
      S.annotateKey({
        description: "Visible ontology summaries; defaults to an empty collection.",
      })
    ),
  },
  $I.annote("OntologyListResponse", {
    description: "Ontology-list response with an always-present readonly summary collection.",
  })
) {}

/**
 * Browser projection of an ontology class definition.
 *
 * @example
 * ```ts
 * import { ClassSummary } from "@effect-ontology/Schema/OntologyBrowser.ts"
 *
 * const summary = ClassSummary.fromUnknown({
 *   iri: "https://example.com/ontology/claims#Claim",
 *   localName: "Claim"
 * })
 * console.log(summary.localName) // "Claim"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClassSummary extends S.Class<ClassSummary>($I`ClassSummary`)(
  {
    iri: IRI.annotateKey({
      description: "IRI identifying the ontology class.",
    }),
    localName: S.NonEmptyString.annotateKey({
      description: "Non-empty local name of the class.",
    }),
    label: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional rdfs:label.",
      })
    ),
    comment: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional rdfs:comment.",
      })
    ),
    superClass: S.OptionFromOptionalKey(IRI).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional direct superclass IRI.",
      })
    ),
  },
  $I.annote("ClassSummary", {
    description: "Ontology class projection with validated identity and Option-normalized annotations.",
  })
) {
  static readonly is = S.is(ClassSummary);
  static readonly fromUnknown = S.decodeUnknownSync(ClassSummary);
}

/**
 * Browser projection of an ontology property definition.
 *
 * @remarks
 * `domain` and `range` are semantic IRIs, not arbitrary strings. The explicit
 * `isObjectProperty` flag preserves whether the range denotes resources rather
 * than datatype values.
 *
 * @example
 * ```ts
 * import { PropertySummary } from "@effect-ontology/Schema/OntologyBrowser.ts"
 *
 * const property = PropertySummary.fromUnknown({
 *   iri: "https://example.com/ontology/claims#assertedBy",
 *   localName: "assertedBy",
 *   isObjectProperty: true
 * })
 * console.log(property.isObjectProperty) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PropertySummary extends S.Class<PropertySummary>($I`PropertySummary`)(
  {
    iri: IRI.annotateKey({
      description: "IRI identifying the ontology property.",
    }),
    localName: S.NonEmptyString.annotateKey({
      description: "Non-empty local name of the property.",
    }),
    label: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional rdfs:label.",
      })
    ),
    comment: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional rdfs:comment.",
      })
    ),
    domain: S.OptionFromOptionalKey(IRI).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional domain class IRI.",
      })
    ),
    range: S.OptionFromOptionalKey(IRI).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional range class or datatype IRI.",
      })
    ),
    isObjectProperty: S.Boolean.annotateKey({
      description: "Whether the property links RDF resources rather than literal values.",
    }),
  },
  $I.annote("PropertySummary", {
    description: "Ontology property projection with validated semantic IRIs and Option-normalized annotations.",
  })
) {
  static readonly is = S.is(PropertySummary);
  static readonly fromUnknown = S.decodeUnknownSync(PropertySummary);
}

/**
 * Pageless response listing every class in an ontology.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { OntologyClassesResponse } from "@effect-ontology/Schema/OntologyBrowser.ts"
 *
 * const response = S.decodeUnknownSync(OntologyClassesResponse)({
 *   ontologyId: "claims",
 *   total: 0
 * })
 * console.log(response.classes.length) // 0
 * ```
 *
 * @invariant `total` is non-negative; callers should keep it equal to the
 * unpaginated class collection size.
 * @category responses
 * @since 0.0.0
 */
export class OntologyClassesResponse extends S.Class<OntologyClassesResponse>($I`OntologyClassesResponse`)(
  {
    ontologyId: OntologyName.annotateKey({
      description: "Registry identifier of the ontology being browsed.",
    }),
    total: NonNegativeInt.annotateKey({
      description: "Reported total number of ontology classes.",
    }),
    classes: S.Array(ClassSummary).pipe(
      SchemaUtils.withEmptyArrayDefaults<ClassSummary>(),
      S.annotateKey({
        description: "Class projections; defaults to an empty collection.",
      })
    ),
  },
  $I.annote("OntologyClassesResponse", {
    description: "Class-list response for one ontology with a non-negative total.",
  })
) {}

/**
 * Pageless response listing every property in an ontology.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { OntologyPropertiesResponse } from "@effect-ontology/Schema/OntologyBrowser.ts"
 *
 * const response = S.decodeUnknownSync(OntologyPropertiesResponse)({
 *   ontologyId: "claims",
 *   total: 0
 * })
 * console.log(response.properties.length) // 0
 * ```
 *
 * @invariant `total` is non-negative; callers should keep it equal to the
 * unpaginated property collection size.
 * @category responses
 * @since 0.0.0
 */
export class OntologyPropertiesResponse extends S.Class<OntologyPropertiesResponse>($I`OntologyPropertiesResponse`)(
  {
    ontologyId: OntologyName.annotateKey({
      description: "Registry identifier of the ontology being browsed.",
    }),
    total: NonNegativeInt.annotateKey({
      description: "Reported total number of ontology properties.",
    }),
    properties: S.Array(PropertySummary).pipe(
      SchemaUtils.withEmptyArrayDefaults<PropertySummary>(),
      S.annotateKey({
        description: "Property projections; defaults to an empty collection.",
      })
    ),
  },
  $I.annote("OntologyPropertiesResponse", {
    description: "Property-list response for one ontology with a non-negative total.",
  })
) {}

/**
 * Detailed browser projection of one ontology.
 *
 * @remarks
 * Collection-valued fields always decode to arrays, while optional prose and
 * provenance fields decode to `Option`. This keeps browser logic focused on
 * ontology relationships instead of null normalization.
 *
 * @example
 * ```ts
 * import { OntologyDetailResponse } from "@effect-ontology/Schema/OntologyBrowser.ts"
 *
 * const detail = OntologyDetailResponse.fromUnknown({
 *   id: "claims",
 *   iri: "https://example.com/ontology/claims",
 *   title: "Claims",
 *   version: "1.0.0",
 *   targetNamespace: "https://example.com/claims/"
 * })
 * console.log(detail.imports.length) // 0
 * ```
 *
 * @category responses
 * @since 0.0.0
 */
export class OntologyDetailResponse extends S.Class<OntologyDetailResponse>($I`OntologyDetailResponse`)(
  {
    id: OntologyName.annotateKey({
      description: "Stable lowercase ontology registry identifier.",
    }),
    iri: AbsoluteIRI.annotateKey({
      description: "Canonical absolute ontology IRI.",
    }),
    title: S.NonEmptyString.annotateKey({
      description: "Human-readable ontology title.",
    }),
    description: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional non-empty ontology description.",
      })
    ),
    version: SemanticVersion.annotateKey({
      description: "Ontology release version.",
    }),
    creator: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional ontology creator or author.",
      })
    ),
    created: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional UTC ontology creation instant.",
      })
    ),
    targetNamespace: AbsoluteIRI.annotateKey({
      description: "Absolute namespace IRI used for extracted resources.",
    }),
    imports: S.Array(VocabularyRef).pipe(
      SchemaUtils.withEmptyArrayDefaults<VocabularyRef>(),
      S.annotateKey({
        description: "Imported standards vocabularies; defaults to an empty collection.",
      })
    ),
    classes: S.Array(ClassSummary).pipe(
      SchemaUtils.withEmptyArrayDefaults<ClassSummary>(),
      S.annotateKey({
        description: "Domain class projections; defaults to an empty collection.",
      })
    ),
    properties: S.Array(PropertySummary).pipe(
      SchemaUtils.withEmptyArrayDefaults<PropertySummary>(),
      S.annotateKey({
        description: "Domain property projections; defaults to an empty collection.",
      })
    ),
    seeAlso: S.Array(IRI).pipe(
      SchemaUtils.withEmptyArrayDefaults<IRI>(),
      S.annotateKey({
        description: "Related semantic resource IRIs; defaults to an empty collection.",
      })
    ),
  },
  $I.annote("OntologyDetailResponse", {
    description: "Detailed ontology browser projection with validated semantic identifiers and normalized collections.",
  })
) {
  static readonly is = S.is(OntologyDetailResponse);
  static readonly fromUnknown = S.decodeUnknownSync(OntologyDetailResponse);
}
