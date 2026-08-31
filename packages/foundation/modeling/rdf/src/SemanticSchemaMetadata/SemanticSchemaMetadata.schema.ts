/**
 * Semantic schema metadata models for public `@beep/rdf` families.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RdfId } from "@beep/identity/packages";
import * as Conformance from "@beep/schema/Conformance";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as Sha256 from "@beep/schema/Sha256";
import * as S from "effect/Schema";
import type { Result } from "effect";
import type * as AST from "effect/SchemaAST";

const $I = $RdfId.create("semantic-schema-metadata");
/**
 * Closed v1 metadata kind domain for semantic-web schemas.
 *
 * **Example** (Validate kind membership)
 *
 * ```ts import.meta.vitest name="Validate kind membership"
 * import * as S from "effect/Schema"
 * import { SemanticSchemaMetadataKind } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * S.is(SemanticSchemaMetadataKind)("identifier") // => true
 * S.is(SemanticSchemaMetadataKind)("unknown") // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SemanticSchemaMetadataKind = LiteralKit([
  "identifier",
  "vocabularyTerm",
  "ontologyConstruct",
  "rdfConstruct",
  "jsonldConstruct",
  "provenanceConstruct",
  "serviceContract",
  "adapterBoundary",
]).pipe(
  $I.annoteSchema("SemanticSchemaMetadataKind", {
    description: "Closed v1 metadata kind domain for semantic-web schemas.",
  })
);

/**
 * Type for {@link SemanticSchemaMetadataKind}.
 *
 * **Example** (Type-check kind values)
 *
 * ```ts
 * import type { SemanticSchemaMetadataKind } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const acceptSemanticSchemaMetadataKind = (value: SemanticSchemaMetadataKind) => value
 * console.log(acceptSemanticSchemaMetadataKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SemanticSchemaMetadataKind = typeof SemanticSchemaMetadataKind.Type;

/**
 * Stability classification for semantic-web schema metadata.
 *
 * **Example** (Validate status membership)
 *
 * ```ts import.meta.vitest name="Validate status membership"
 * import * as S from "effect/Schema"
 * import { SemanticSchemaStatus } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * S.is(SemanticSchemaStatus)("stable") // => true
 * S.is(SemanticSchemaStatus)("draft") // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SemanticSchemaStatus = LiteralKit(["experimental", "stable", "deprecated"]).pipe(
  $I.annoteSchema("SemanticSchemaStatus", {
    description: "Stability classification for semantic-web schema metadata.",
  })
);

/**
 * Type for {@link SemanticSchemaStatus}.
 *
 * **Example** (Type-check status values)
 *
 * ```ts
 * import type { SemanticSchemaStatus } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const acceptSemanticSchemaStatus = (value: SemanticSchemaStatus) => value
 * console.log(acceptSemanticSchemaStatus)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SemanticSchemaStatus = typeof SemanticSchemaStatus.Type;

/**
 * Specification disposition attached to a semantic schema reference.
 *
 * **Example** (Decode disposition value)
 *
 * ```ts import.meta.vitest name="Decode disposition value"
 * import * as S from "effect/Schema"
 * import { SemanticSchemaSpecificationDisposition } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const disposition = S.decodeUnknownSync(SemanticSchemaSpecificationDisposition)("normative")
 * disposition // => "normative"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SemanticSchemaSpecificationDisposition = LiteralKit(["normative", "informative"]).pipe(
  $I.annoteSchema("SemanticSchemaSpecificationDisposition", {
    description: "Specification disposition attached to a semantic schema reference.",
  })
);

/**
 * Type for {@link SemanticSchemaSpecificationDisposition}.
 *
 * **Example** (Type-check disposition values)
 *
 * ```ts
 * import type { SemanticSchemaSpecificationDisposition } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const acceptSemanticSchemaSpecificationDisposition = (value: SemanticSchemaSpecificationDisposition) => value
 * console.log(acceptSemanticSchemaSpecificationDisposition)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SemanticSchemaSpecificationDisposition = typeof SemanticSchemaSpecificationDisposition.Type;

/**
 * Representation label for semantic-web values.
 *
 * **Example** (Validate representation kind)
 *
 * ```ts import.meta.vitest name="Validate representation kind"
 * import * as S from "effect/Schema"
 * import { SemanticRepresentationKind } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * S.is(SemanticRepresentationKind)("JSON-LD") // => true
 * S.is(SemanticRepresentationKind)("CSV") // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SemanticRepresentationKind = LiteralKit([
  "RDF/JS",
  "JSON-LD",
  "Turtle",
  "TriG",
  "RDF/XML",
  "JSON Schema",
]).pipe(
  $I.annoteSchema("SemanticRepresentationKind", {
    description: "Representation label for semantic-web values.",
  })
);

/**
 * Type for {@link SemanticRepresentationKind}.
 *
 * **Example** (Type-check representation kinds)
 *
 * ```ts
 * import type { SemanticRepresentationKind } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const acceptSemanticRepresentationKind = (value: SemanticRepresentationKind) => value
 * console.log(acceptSemanticRepresentationKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SemanticRepresentationKind = typeof SemanticRepresentationKind.Type;

/**
 * Single specification reference attached to public semantic-web schemas.
 *
 * **Example** (Decode specification reference)
 *
 * ```ts import.meta.vitest name="Decode specification reference"
 * import * as S from "effect/Schema"
 * import { SemanticSchemaSpecification } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const specification = S.decodeUnknownSync(SemanticSchemaSpecification)({
 *   name: "RDF 1.1 Concepts",
 *   section: "Graph Data Model",
 *   disposition: "normative"
 * })
 * specification.name // => "RDF 1.1 Concepts"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SemanticSchemaSpecification extends S.Class<SemanticSchemaSpecification>($I`SemanticSchemaSpecification`)(
  {
    name: S.NonEmptyString,
    version: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    section: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    url: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    localRef: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    disposition: SemanticSchemaSpecificationDisposition,
    sourceId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    sourceRole: S.OptionFromOptionalKey(Conformance.SpecificationSourceRole).pipe(SchemaUtils.withNoneDefault),
    revision: S.OptionFromOptionalKey(Conformance.Revision).pipe(SchemaUtils.withNoneDefault),
    contentSha256: S.OptionFromOptionalKey(Sha256.Sha256Hex).pipe(SchemaUtils.withNoneDefault),
    license: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    scope: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SemanticSchemaSpecification", {
    description:
      "Single specification reference with optional lossless provenance attached to public semantic-web schemas.",
  })
) {}

/**
 * Single representation note attached to semantic-web schemas.
 *
 * **Example** (Decode representation note)
 *
 * ```ts import.meta.vitest name="Decode representation note"
 * import * as S from "effect/Schema"
 * import { SemanticRepresentation } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const representation = S.decodeUnknownSync(SemanticRepresentation)({
 *   kind: "JSON-LD",
 *   note: "Compacted document shape."
 * })
 * representation.kind // => "JSON-LD"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SemanticRepresentation extends S.Class<SemanticRepresentation>($I`SemanticRepresentation`)(
  {
    kind: SemanticRepresentationKind,
    note: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SemanticRepresentation", {
    description: "Single representation note attached to semantic-web schemas.",
  })
) {}

/**
 * Typed metadata payload stored in the `semanticSchemaMetadata` annotation key.
 *
 * **Example** (Decode full metadata payload)
 *
 * ```ts import.meta.vitest name="Decode full metadata payload"
 * import * as S from "effect/Schema"
 * import { SemanticSchemaMetadata } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const metadata = S.decodeUnknownSync(SemanticSchemaMetadata)({
 *   kind: "rdfConstruct",
 *   canonicalName: "NamedNode",
 *   overview: "RDF named node metadata.",
 *   status: "stable",
 *   specifications: [{ name: "RDF/JS Data Model", disposition: "normative" }],
 *   equivalenceBasis: "IRI equality."
 * })
 * metadata.canonicalName // => "NamedNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SemanticSchemaMetadata extends S.Class<SemanticSchemaMetadata>($I`SemanticSchemaMetadata`)(
  {
    kind: SemanticSchemaMetadataKind,
    canonicalName: S.NonEmptyString,
    overview: S.NonEmptyString,
    status: SemanticSchemaStatus,
    specifications: S.NonEmptyArray(SemanticSchemaSpecification),
    equivalenceBasis: S.NonEmptyString,
    canonicalIri: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        deprecated: true,
        description:
          "Deprecated address field: composer-derived `iri` annotations own addressing (identity-iri-fold, 2026-08-01). Documentation payload fields remain canonical here.",
      })
    ),
    preferredPrefix: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        deprecated: true,
        description:
          "Deprecated address field: composer-derived `curie` annotations own addressing (identity-iri-fold, 2026-08-01). Documentation payload fields remain canonical here.",
      })
    ),
    aliases: S.NonEmptyString.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    canonicalizationRequired: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    representations: SemanticRepresentation.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    provenanceProfile: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    evidenceAnchoring: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    timeSemantics: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    implementationNotes: S.NonEmptyString.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    nonGoals: S.NonEmptyString.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("SemanticSchemaMetadata", {
    description: "Typed metadata payload stored in the semanticSchemaMetadata annotation key.",
  })
) {
  static readonly decodeUnknownResult: (
    input: unknown,
    options?: AST.ParseOptions
  ) => Result.Result<SemanticSchemaMetadata, S.SchemaError> = S.decodeUnknownResult(this);
}
