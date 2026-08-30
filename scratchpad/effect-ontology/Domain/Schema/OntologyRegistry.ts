/**
 * Versioned ontology-registry manifest contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { AbsoluteIRI, IRI } from "@beep/rdf";
import { SchemaUtils, SemanticVersion } from "@beep/schema";
import * as S from "effect/Schema";
import { GcsObject, OntologyName } from "../Identity.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/OntologyRegistry");

/**
 * Registry metadata and storage references for one ontology.
 *
 * **Details**
 *
 * * IRI, semantic-version, and GCS object-path validation are delegated to the
 * repository's canonical foundation schemas. Nullable or absent resource
 * paths decode to `Option.none()`, while imports default to an empty array.
 *
 * **Example** (Use OntologyEntry)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OntologyEntry } from "@effect-ontology/Schema/OntologyRegistry"
 *
 * const entry = S.decodeUnknownOption(OntologyEntry)({
 *   id: "claims",
 *   iri: "https://example.com/ontology/claims",
 *   version: "1.0.0",
 *   title: "Claims",
 *   storagePath: "ontologies/claims/ontology.ttl",
 *   imports: [],
 *   targetNamespace: "https://example.com/claims/"
 * })
 * console.log(O.map(entry, (value) => value.id)) // Some("claims")
 * ```
 *
 * @invariant Identity, IRI, version, and storage fields satisfy their
 * respective canonical schemas; optional paths have no nullish decoded state.
 * @category models
 * @since 0.0.0
 */
export class OntologyEntry extends S.Class<OntologyEntry>($I`OntologyEntry`)(
  {
    id: OntologyName.annotateKey({
      description: "Stable lowercase registry identifier for the ontology.",
    }),
    iri: AbsoluteIRI.annotateKey({
      description: "Canonical absolute ontology IRI without a fragment.",
    }),
    version: SemanticVersion.annotateKey({
      description: "Ontology release version in MAJOR.MINOR.PATCH form.",
    }),
    title: S.NonEmptyString.annotateKey({
      description: "Human-readable ontology title.",
    }),
    description: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional non-empty explanation of the ontology's purpose.",
      })
    ),
    storagePath: GcsObject.annotateKey({
      description: "Canonical bucket-relative path to the ontology document.",
    }),
    shapesPath: S.OptionFromOptionalNullOr(GcsObject).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional bucket-relative path to the ontology's SHACL shapes.",
      })
    ),
    imports: S.Array(IRI).pipe(
      SchemaUtils.withEmptyArrayDefaults<IRI>(),
      S.annotateKey({
        description: "Declared owl:imports IRIs; defaults to an empty collection.",
      })
    ),
    externalVocabsPath: S.OptionFromOptionalNullOr(GcsObject).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional path to a merged external-vocabulary artifact.",
      })
    ),
    embeddingsPath: S.OptionFromOptionalNullOr(GcsObject).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional path to precomputed ontology embeddings.",
      })
    ),
    targetNamespace: AbsoluteIRI.annotateKey({
      description: "Absolute namespace IRI used for extracted resources.",
    }),
  },
  $I.annote("OntologyEntry", {
    description: "Validated registry entry for one versioned ontology and its optional companion artifacts.",
  })
) {
  static readonly is = S.is(OntologyEntry);
  static readonly decodeOption = S.decodeUnknownOption(OntologyEntry);
}

/**
 * Storage resources shared by every registry entry.
 *
 * **Example** (Use SharedResources)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SharedResources } from "@effect-ontology/Schema/OntologyRegistry"
 *
 * const resources = S.decodeUnknownOption(SharedResources)({})
 * console.log(O.map(resources, (value) => value.externalVocabs._tag)) // Some("None")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SharedResources extends S.Class<SharedResources>($I`SharedResources`)(
  {
    externalVocabs: S.OptionFromOptionalNullOr(GcsObject).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional canonical path to vocabularies shared by all ontologies.",
      })
    ),
  },
  $I.annote("SharedResources", {
    description: "Option-normalized storage resources shared by every ontology in a registry.",
  })
) {}

/**
 * Complete versioned ontology-registry manifest.
 *
 * **Details**
 *
 * * `generatedAt` decodes from an RFC 3339/ISO timestamp into an Effect UTC
 * instant. Empty registries and omitted shared resources receive schema-owned
 * defaults.
 *
 * **Example** (Use OntologyRegistry)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OntologyRegistry } from "@effect-ontology/Schema/OntologyRegistry"
 *
 * const registry = S.decodeUnknownOption(OntologyRegistry)({
 *   version: "1.0.0",
 *   generatedAt: "2026-07-25T12:00:00.000Z"
 * })
 * console.log(O.map(registry, (value) => value.ontologies.length)) // Some(0)
 * ```
 *
 * @invariant The manifest is semantically versioned, UTC timestamped, and
 * contains only validated ontology entries.
 * @category models
 * @since 0.0.0
 */
export class OntologyRegistry extends S.Class<OntologyRegistry>($I`OntologyRegistry`)(
  {
    version: SemanticVersion.annotateKey({
      description: "Registry manifest format version.",
    }),
    generatedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant at which the registry was generated.",
    }),
    ontologies: S.Array(OntologyEntry).pipe(
      SchemaUtils.withEmptyArrayDefaults<OntologyEntry>(),
      S.annotateKey({
        description: "Validated ontology entries; defaults to an empty collection.",
      })
    ),
    sharedResources: S.OptionFromOptionalKey(SharedResources).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional resources shared by all ontology entries.",
      })
    ),
  },
  $I.annote("OntologyRegistry", {
    description: "Versioned, timestamped registry manifest containing validated ontology entries and shared resources.",
  })
) {
  static readonly is = S.is(OntologyRegistry);
  static readonly decodeOption = S.decodeUnknownOption(OntologyRegistry);
}

const OntologyRegistryJsonDefinition = S.fromJsonString(OntologyRegistry);

/**
 * JSON-string codec for {@link OntologyRegistry}.
 *
 * **Example** (Use OntologyRegistryJson)
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { OntologyRegistryJson } from "@effect-ontology/Schema/OntologyRegistry"
 *
 * const registry = S.decodeUnknownOption(OntologyRegistryJson)(
 *   '{"version":"1.0.0","generatedAt":"2026-07-25T12:00:00.000Z"}'
 * )
 * console.log(O.map(registry, (value) => value.ontologies.length)) // 0
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const OntologyRegistryJson = OntologyRegistryJsonDefinition.pipe(
  $I.annoteSchema("OntologyRegistryJson", {
    toArbitrary: () => S.toArbitrary(OntologyRegistry),
    description: "JSON-string codec for a complete validated ontology registry manifest.",
  }),
  SchemaUtils.withEffectCodecStatics
);

const OntologyEntryJsonDefinition = S.fromJsonString(OntologyEntry);

/**
 * JSON-string codec for one {@link OntologyEntry}.
 *
 * **Example** (Use OntologyEntryJson)
 * ```ts
 * import * as S from "effect/Schema"
 * import { OntologyEntryJson } from "@effect-ontology/Schema/OntologyRegistry"
 *
 * const decode = S.decodeUnknownResult(OntologyEntryJson)
 * console.log(decode("{}")._tag) // "Failure"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const OntologyEntryJson = OntologyEntryJsonDefinition.annotate({
  toArbitrary: () => S.toArbitrary(OntologyEntry),
}).pipe(
  $I.annoteSchema("OntologyEntryJson", {
    description: "JSON-string codec for one validated ontology registry entry.",
  }),
  SchemaUtils.withCodecStatics
);
