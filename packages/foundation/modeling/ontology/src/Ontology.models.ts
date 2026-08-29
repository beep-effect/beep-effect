/**
 * FOLIO OpenAPI component schemas modeled with Effect Schema.
 *
 * @see https://folio.openlegalstandard.org/openapi.json
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { FastCheck } from "effect/testing";

const $I = $OntologyId.create("Ontology.models");

const decodeUrlStringOption = S.decodeUnknownOption(S.URLFromString);
const makeHttpUrlArbitrary = (fc: typeof FastCheck) =>
  fc
    .tuple(fc.boolean(), fc.uuid())
    .map(([secure, id]: readonly [boolean, string]) => `${secure ? "https" : "http"}://example.test/resource/${id}`);

const HttpUrlFormatCheck = S.makeFilter<string>(
  (value) => O.exists(decodeUrlStringOption(value), (url) => url.protocol === "http:" || url.protocol === "https:"),
  {
    identifier: $I`HttpUrlFormatCheck`,
    title: "HTTP URL Format",
    description: "HTTP URL values must be valid absolute URL strings using the http or https scheme.",
    message: "HTTP URL must be a valid absolute URL using the http or https scheme.",
    arbitrary: {
      candidate: {
        weight: 32,
        make: makeHttpUrlArbitrary,
      },
    },
  }
);

const FolioIriToken = S.NonEmptyString.pipe(
  $I.annoteSchema("FolioIriToken", {
    description: "Non-empty FOLIO ontology IRI token.",
  })
);

/**
 * Source type of the loaded FOLIO ontology.
 *
 * **Example** (Checking github source type)
 *
 * ```ts
 * import { SourceType } from "@beep/ontology/Ontology.models"
 *
 * console.log(SourceType.is.github("github"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceType = LiteralKit(["http", "github"]).pipe(
  $I.annoteSchema("SourceType", {
    description: "Source type of the FOLIO ontology graph.",
  })
);

/**
 * Runtime type for {@link SourceType}.
 *
 * **Example** (Assigning github source type)
 *
 * ```ts
 * import type { SourceType } from "@beep/ontology/Ontology.models"
 *
 * const sourceType: SourceType = "github"
 * console.log(sourceType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SourceType = typeof SourceType.Type;

const HttpUrlDefinition = S.String.check(
  HttpUrlFormatCheck,
  S.isMinLength(1, {
    identifier: $I`HttpUrlMinLengthCheck`,
    title: "HTTP URL Min Length",
    description: "HTTP URL values must contain at least one character.",
  }),
  S.isMaxLength(2083, {
    identifier: $I`HttpUrlMaxLengthCheck`,
    title: "HTTP URL Max Length",
    description: "HTTP URL values must not exceed 2083 characters.",
  })
);

/**
 * HTTP or HTTPS URL string metadata shape from the OpenAPI document.
 *
 * **Example** (Inspecting HttpUrl schema AST)
 *
 * ```ts
 * import { HttpUrl } from "@beep/ontology/Ontology.models"
 *
 * console.log(HttpUrl.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HttpUrl = HttpUrlDefinition.pipe(
  SchemaUtils.withCodecStatics,
  $I.annoteSchema("HttpUrl", {
    description: "HTTP URL of the ontology source when the source type is http.",
    format: "uri",
    toArbitrary: () => makeHttpUrlArbitrary,
  })
);

/**
 * Runtime type for {@link HttpUrl}.
 *
 * **Example** (Assigning ontology HTTP URL)
 *
 * ```ts
 * import type { HttpUrl } from "@beep/ontology/Ontology.models"
 *
 * const url: HttpUrl = "https://example.com/ontology.owl"
 * console.log(url)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HttpUrl = typeof HttpUrl.Type;

/**
 * Information about the loaded FOLIO ontology graph.
 *
 * **Example** (Inspecting GraphInfo schema AST)
 *
 * ```ts
 * import { GraphInfo } from "@beep/ontology/Ontology.models"
 *
 * console.log(GraphInfo.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GraphInfo extends S.Class<GraphInfo>($I`GraphInfo`)(
  {
    num_classes: S.Int.check(
      S.isGreaterThan(0, {
        identifier: $I`GraphInfoNumClassesPositiveCheck`,
        title: "FOLIO Graph Class Count Positive",
        description: "The FOLIO graph class count must be greater than zero.",
      })
    ).annotateKey({
      title: "Num Classes",
      description: "Total number of ontology classes in the graph",
      examples: [1025],
    }),
    num_properties: S.Int.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`GraphInfoNumPropertiesNonNegativeCheck`,
        title: "FOLIO Graph Property Count Non-Negative",
        description: "The FOLIO graph object-property count must be zero or greater.",
      })
    ).annotateKey({
      title: "Num Properties",
      description: "Total number of OWL object properties in the graph",
      examples: [175],
    }),
    title: S.String.annotateKey({
      title: "Title",
      description: "Title of the FOLIO ontology",
      examples: ["FOLIO Ontology"],
    }),
    description: S.String.annotateKey({
      title: "Description",
      description: "Description of the FOLIO ontology",
      examples: ["Federated Open Legal Information Ontology"],
    }),
    source_type: SourceType.annotateKey({
      title: "Source Type",
      description: "Source type of the ontology (http or github)",
      examples: ["github"],
    }),
    http_url: HttpUrl.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        title: "Http Url",
        description: "HTTP URL of the ontology source (when source_type is 'http')",
      })
    ),
    github_repo_owner: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        title: "Github Repo Owner",
        description: "GitHub repository owner (when source_type is 'github')",
        examples: [O.some("alea-institute")],
      })
    ),
    github_repo_name: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        title: "Github Repo Name",
        description: "GitHub repository name (when source_type is 'github')",
        examples: [O.some("folio")],
      })
    ),
    github_repo_branch: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        title: "Github Repo Branch",
        description: "GitHub repository branch (when source_type is 'github')",
        examples: [O.some("2.0.0")],
      })
    ),
  },
  $I.annote("GraphInfo", {
    description:
      'Information about the loaded FOLIO ontology graph.\n\nThis model contains metadata about the FOLIO ontology graph that is currently\nloaded in the API, including its size, source, and descriptive information.\n\nAttributes:\n    num_classes: Total number of ontology classes in the graph\n    title: Title of the FOLIO ontology\n    description: Description of the FOLIO ontology\n    source_type: Source type of the ontology (http or github)\n    http_url: HTTP URL of the ontology source (when source_type is \'http\')\n    github_repo_owner: GitHub repository owner (when source_type is \'github\')\n    github_repo_name: GitHub repository name (when source_type is \'github\')\n    github_repo_branch: GitHub repository branch (when source_type is \'github\')\n\nExample:\n    ```json\n    {\n      "num_classes": 1025,\n      "title": "FOLIO Ontology",\n      "description": "Federated Open Legal Information Ontology",\n      "source_type": "github",\n      "http_url": null,\n      "github_repo_owner": "alea-institute",\n      "github_repo_name": "folio",\n      "github_repo_branch": "2.0.0"\n    }\n    ```',
  })
) {}

/**
 * Health status of the FOLIO API.
 *
 * **Example** (Checking healthy status value)
 *
 * ```ts
 * import { HealthStatus } from "@beep/ontology/Ontology.models"
 *
 * console.log(HealthStatus.is.healthy("healthy"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HealthStatus = LiteralKit(["healthy", "unhealthy"]).pipe(
  $I.annoteSchema("HealthStatus", {
    description: "Health status of the API.",
  })
);

/**
 * Runtime type for {@link HealthStatus}.
 *
 * **Example** (Assigning healthy status value)
 *
 * ```ts
 * import type { HealthStatus } from "@beep/ontology/Ontology.models"
 *
 * const status: HealthStatus = "healthy"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HealthStatus = typeof HealthStatus.Type;

/**
 * Response model for the health check endpoint.
 *
 * **Example** (Inspecting HealthResponse schema AST)
 *
 * ```ts
 * import { HealthResponse } from "@beep/ontology/Ontology.models"
 *
 * console.log(HealthResponse.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HealthResponse extends S.Class<HealthResponse>($I`HealthResponse`)(
  {
    status: HealthStatus.annotateKey({
      title: "Status",
      description: "Health status of the API",
      examples: ["healthy"],
    }),
    folio_graph: GraphInfo.annotateKey({
      description: "Information about the loaded FOLIO ontology graph",
    }),
  },
  $I.annote("HealthResponse", {
    description:
      'Response model for the health check endpoint.\n\nThis model contains information about the API\'s health status and\nmetadata about the loaded FOLIO ontology graph.\n\nAttributes:\n    status: Health status of the API ("healthy" when operational)\n    folio_graph: Information about the loaded FOLIO ontology graph\n\nExample:\n    ```json\n    {\n      "status": "healthy",\n      "folio_graph": {\n        "num_classes": 1025,\n        "title": "FOLIO Ontology",\n        "description": "Federated Open Legal Information Ontology",\n        "source_type": "github",\n        "http_url": null,\n        "github_repo_owner": "alea-institute",\n        "github_repo_name": "folio",\n        "github_repo_branch": "2.0.0"\n      }\n    }\n    ```',
  })
) {}

/**
 * OWL class model for the FOLIO ontology.
 *
 * **Example** (Inspecting OWLClass schema AST)
 *
 * ```ts
 * import { OWLClass } from "@beep/ontology/Ontology.models"
 *
 * console.log(OWLClass.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class OWLClass extends S.Class<OWLClass>($I`OWLClass`)(
  {
    iri: FolioIriToken.annotateKey({
      title: "Iri",
    }),
    label: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "rdfs:label",
        title: "Label",
      })
    ),
    sub_class_of: FolioIriToken.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "rdfs:subClassOf",
        title: "Sub Class Of",
      })
    ),
    parent_class_of: FolioIriToken.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "^rdfs:subClassOf",
        title: "Parent Class Of",
      })
    ),
    is_defined_by: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "rdfs:isDefinedBy",
        title: "Is Defined By",
      })
    ),
    see_also: FolioIriToken.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "rdfs:seeAlso",
        title: "See Also",
      })
    ),
    comment: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "rdfs:comment",
        title: "Comment",
      })
    ),
    deprecated: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(false),
      $I.key({
        term: "owl:deprecated",
        title: "Deprecated",
        default: false,
      })
    ),
    preferred_label: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:prefLabel",
        title: "Preferred Label",
      })
    ),
    alternative_labels: S.String.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:altLabel",
        title: "Alternative Labels",
      })
    ),
    translations: S.Record(S.String, S.String).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        title: "Translations",
        description: "translations from other languages",
      })
    ),
    hidden_label: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:hiddenLabel",
        title: "Hidden Label",
      })
    ),
    definition: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:definition",
        title: "Definition",
      })
    ),
    examples: S.String.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:example",
        title: "Examples",
      })
    ),
    notes: S.String.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:note",
        title: "Notes",
      })
    ),
    history_note: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:historyNote",
        title: "History Note",
      })
    ),
    editorial_note: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:editorialNote",
        title: "Editorial Note",
      })
    ),
    in_scheme: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:inScheme",
        title: "In Scheme",
      })
    ),
    identifier: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "dcterms:identifier",
        title: "Identifier",
      })
    ),
    description: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "dcterms:description",
        title: "Description",
      })
    ),
    source: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "dcterms:source",
        title: "Source",
      })
    ),
    country: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        title: "Country",
        documentation: "https://www.loc.gov/standards/mads/mads-outline-2-1.html#country",
      })
    ),
  },
  $I.annote("OWLClass", {
    description:
      "OWLClass model for the FOLIO package, which represents an OWL class in the FOLIO\nontology/taxonomy style.\n\nTODO: think about future-proofing for next-gen roadmap.",
  })
) {}

/**
 * OWL object property model for the FOLIO ontology.
 *
 * **Example** (Inspecting OWLObjectProperty schema AST)
 *
 * ```ts
 * import { OWLObjectProperty } from "@beep/ontology/Ontology.models"
 *
 * console.log(OWLObjectProperty.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class OWLObjectProperty extends S.Class<OWLObjectProperty>($I`OWLObjectProperty`)(
  {
    iri: FolioIriToken.annotateKey({
      title: "Iri",
    }),
    label: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "rdfs:label",
        title: "Label",
      })
    ),
    sub_property_of: FolioIriToken.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "rdfs:subPropertyOf",
        title: "Sub Property Of",
      })
    ),
    domain: FolioIriToken.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "rdfs:domain",
        title: "Domain",
      })
    ),
    range: FolioIriToken.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "rdfs:range",
        title: "Range",
      })
    ),
    inverse_of: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "owl:inverseOf",
        title: "Inverse Of",
      })
    ),
    preferred_label: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:prefLabel",
        title: "Preferred Label",
      })
    ),
    alternative_labels: S.String.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:altLabel",
        title: "Alternative Labels",
      })
    ),
    definition: S.String.pipe(
      S.OptionFromOptionalNullOr,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:definition",
        title: "Definition",
      })
    ),
    examples: S.String.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.key({
        term: "skos:example",
        title: "Examples",
      })
    ),
  },
  $I.annote("OWLObjectProperty", {
    description:
      "OWLObjectProperty model for the FOLIO package, which represents an OWL object property\nthat connects two instances/classes in the ontology.",
  })
) {}

/**
 * A collection of OWL class objects from the FOLIO ontology.
 *
 * **Example** (Inspecting OWLClassList schema AST)
 *
 * ```ts
 * import { OWLClassList } from "@beep/ontology/Ontology.models"
 *
 * console.log(OWLClassList.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class OWLClassList extends S.Class<OWLClassList>($I`OWLClassList`)(
  {
    classes: S.Array(OWLClass).annotateKey({
      title: "Classes",
      description: "List of OWLClass objects from the FOLIO ontology",
      examples: [
        [
          OWLClass.make({
            definition: O.some("A party that grants a right to use something in return for payment."),
            iri: "R8pNPutX0TN6DlEqkyZuxSw",
            label: O.some("Lessor"),
          }),
        ],
      ],
    }),
    properties: OWLObjectProperty.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        title: "Properties",
        description: "List of OWLObjectProperty objects matching the search",
      })
    ),
  },
  $I.annote("OWLClassList", {
    description:
      'A collection of OWLClass objects from the FOLIO ontology.\n\nThis model represents a list of ontology classes returned by various\nendpoints, particularly the taxonomy endpoints that return multiple\nclasses of a specific type.\n\nAttributes:\n    classes: A list of OWLClass objects representing FOLIO ontology classes\n\nExample:\n    ```json\n    {\n      "classes": [\n        {\n          "iri": "R8pNPutX0TN6DlEqkyZuxSw",\n          "label": "Lessor",\n          "definition": "A party that grants a right to use something in return for payment.",\n          "subClassOf": ["oS5FqyVBbOYQbhqb0G28oZR"],\n          ...\n        },\n        ...\n      ]\n    }\n    ```',
  })
) {}

/**
 * A collection of OWL object properties from the FOLIO ontology.
 *
 * **Example** (Inspecting OWLObjectPropertyList schema AST)
 *
 * ```ts
 * import { OWLObjectPropertyList } from "@beep/ontology/Ontology.models"
 *
 * console.log(OWLObjectPropertyList.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class OWLObjectPropertyList extends S.Class<OWLObjectPropertyList>($I`OWLObjectPropertyList`)(
  {
    properties: S.Array(OWLObjectProperty).annotateKey({
      title: "Properties",
      description: "List of OWLObjectProperty objects from the FOLIO ontology",
      examples: [
        [
          OWLObjectProperty.make({
            definition: O.some("A relationship indicating that something was drafted."),
            iri: "R6qohvM786wjw0MNQJg9Dq",
            label: O.some("drafted"),
          }),
        ],
      ],
    }),
  },
  $I.annote("OWLObjectPropertyList", {
    description:
      "A collection of OWLObjectProperty objects from the FOLIO ontology.\n\nAttributes:\n    properties: A list of OWLObjectProperty objects representing FOLIO ontology object properties",
  })
) {}

/**
 * Relevance score attached to an OWL search result.
 *
 * **Example** (Inspecting OWLSearchScore schema AST)
 *
 * ```ts
 * import { OWLSearchScore } from "@beep/ontology/Ontology.models"
 *
 * console.log(OWLSearchScore.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OWLSearchScore = S.Finite.pipe(
  $I.annoteSchema("OWLSearchScore", {
    description: "Finite relevance score returned with an OWL class search result.",
  })
);

/**
 * Runtime type for {@link OWLSearchScore}.
 *
 * **Example** (Assigning search relevance score)
 *
 * ```ts
 * import type { OWLSearchScore } from "@beep/ontology/Ontology.models"
 *
 * const score: OWLSearchScore = 0.95
 * console.log(score)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OWLSearchScore = typeof OWLSearchScore.Type;

/**
 * Tuple containing an OWL class and its relevance score.
 *
 * **Example** (Inspecting OWLSearchResult schema AST)
 *
 * ```ts
 * import { OWLSearchResult } from "@beep/ontology/Ontology.models"
 *
 * console.log(OWLSearchResult.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OWLSearchResult = S.Tuple([OWLClass, OWLSearchScore]).pipe(
  $I.annoteSchema("OWLSearchResult", {
    description: "Tuple containing an OWLClass object and its relevance score.",
  })
);

/**
 * Runtime type for {@link OWLSearchResult}.
 *
 * **Example** (Referencing OWLSearchResult type)
 *
 * ```ts import.meta.vitest name="Referencing OWLSearchResult type"
 * import type { OWLSearchResult } from "@beep/ontology/Ontology.models"
 *
 * type Result = OWLSearchResult
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OWLSearchResult = typeof OWLSearchResult.Type;

/**
 * Search results containing FOLIO ontology classes with relevance scores.
 *
 * **Example** (Inspecting OWLSearchResults schema AST)
 *
 * ```ts
 * import { OWLSearchResults } from "@beep/ontology/Ontology.models"
 *
 * console.log(OWLSearchResults.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class OWLSearchResults extends S.Class<OWLSearchResults>($I`OWLSearchResults`)(
  {
    results: S.Array(OWLSearchResult).annotateKey({
      title: "Results",
      description: "List of tuples containing OWLClass objects and their relevance scores",
      examples: [
        [
          [
            OWLClass.make({
              definition: O.some("A party that grants a right to use something in return for payment."),
              iri: "R8pNPutX0TN6DlEqkyZuxSw",
              label: O.some("Lessor"),
            }),
            0.95,
          ],
        ],
      ],
    }),
  },
  $I.annote("OWLSearchResults", {
    description:
      'Search results containing FOLIO ontology classes with relevance scores.\n\nThis model represents the results of search operations that return ontology\nclasses along with relevance scores indicating how well each class matches\nthe search query.\n\nAttributes:\n    results: A list of tuples where each tuple contains an OWLClass and its\n            relevance score (higher scores indicate better matches)\n\nExample:\n    ```json\n    {\n      "results": [\n        [\n          {\n            "iri": "R8pNPutX0TN6DlEqkyZuxSw",\n            "label": "Lessor",\n            "definition": "A party that grants a right to use something in return for payment.",\n            ...\n          },\n          0.95\n        ],\n        ...\n      ]\n    }\n    ```',
  })
) {}

/**
 * Location segment in a validation error.
 *
 * **Example** (Inspecting location segment schema AST)
 *
 * ```ts
 * import { ValidationErrorLocationSegment } from "@beep/ontology/Ontology.models"
 *
 * console.log(ValidationErrorLocationSegment.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ValidationErrorLocationSegment = S.Union([S.String, S.Int]).pipe(
  $I.annoteSchema("ValidationErrorLocationSegment", {
    description: "String or integer segment in a validation error location path.",
  })
);

/**
 * Runtime type for {@link ValidationErrorLocationSegment}.
 *
 * **Example** (Assigning body location segment)
 *
 * ```ts
 * import type { ValidationErrorLocationSegment } from "@beep/ontology/Ontology.models"
 *
 * const segment: ValidationErrorLocationSegment = "body"
 * console.log(segment)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ValidationErrorLocationSegment = typeof ValidationErrorLocationSegment.Type;

/**
 * Validation error detail emitted by the API.
 *
 * **Example** (Inspecting ValidationError schema AST)
 *
 * ```ts
 * import { ValidationError } from "@beep/ontology/Ontology.models"
 *
 * console.log(ValidationError.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ValidationError extends S.Class<ValidationError>($I`ValidationError`)(
  {
    loc: S.Array(ValidationErrorLocationSegment).annotateKey({
      title: "Location",
    }),
    msg: S.String.annotateKey({
      title: "Message",
    }),
    type: S.String.annotateKey({
      title: "Error Type",
    }),
    input: S.Unknown.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        title: "Input",
      })
    ),
    ctx: S.Record(S.String, S.Unknown).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        title: "Context",
      })
    ),
  },
  $I.annote("ValidationError", {
    description: "Validation error detail emitted by the API.",
  })
) {}

/**
 * HTTP validation error response emitted by the API.
 *
 * **Example** (Inspecting HTTPValidationError schema AST)
 *
 * ```ts
 * import { HTTPValidationError } from "@beep/ontology/Ontology.models"
 *
 * console.log(HTTPValidationError.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HTTPValidationError extends S.Class<HTTPValidationError>($I`HTTPValidationError`)(
  {
    detail: ValidationError.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        title: "Detail",
      })
    ),
  },
  $I.annote("HTTPValidationError", {
    description: "HTTP validation error response emitted by the API.",
  })
) {}
