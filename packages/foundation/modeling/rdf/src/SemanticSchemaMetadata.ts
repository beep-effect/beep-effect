/**
 * Semantic schema metadata helpers for public `@beep/rdf` families.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { $RdfId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { A, O } from "@beep/utils";
import { pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type * as AST from "effect/SchemaAST";

const $I = $RdfId.create("semantic-schema-metadata");
/* istanbul ignore next -- public callers receive schema issues through Result decoding */
const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

/**
 * Closed v1 metadata kind domain for semantic-web schemas.
 *
 * **Example** (Validate kind membership)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SemanticSchemaMetadataKind } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * console.log(S.is(SemanticSchemaMetadataKind)("identifier")) // true
 * console.log(S.is(SemanticSchemaMetadataKind)("unknown")) // false
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
 * ```ts
 * import * as S from "effect/Schema"
 * import { SemanticSchemaStatus } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * console.log(S.is(SemanticSchemaStatus)("stable")) // true
 * console.log(S.is(SemanticSchemaStatus)("draft")) // false
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
 * ```ts
 * import * as S from "effect/Schema"
 * import { SemanticSchemaSpecificationDisposition } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const disposition = S.decodeUnknownSync(SemanticSchemaSpecificationDisposition)("normative")
 * console.log(disposition) // "normative"
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
 * ```ts
 * import * as S from "effect/Schema"
 * import { SemanticRepresentationKind } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * console.log(S.is(SemanticRepresentationKind)("JSON-LD")) // true
 * console.log(S.is(SemanticRepresentationKind)("CSV")) // false
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
 * ```ts
 * import * as S from "effect/Schema"
 * import { SemanticSchemaSpecification } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const specification = S.decodeUnknownSync(SemanticSchemaSpecification)({
 *   name: "RDF 1.1 Concepts",
 *   section: "Graph Data Model",
 *   disposition: "normative"
 * })
 * console.log(specification.name) // "RDF 1.1 Concepts"
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
  },
  $I.annote("SemanticSchemaSpecification", {
    description: "Single specification reference attached to public semantic-web schemas.",
  })
) {}

/**
 * Single representation note attached to semantic-web schemas.
 *
 * **Example** (Decode representation note)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SemanticRepresentation } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const representation = S.decodeUnknownSync(SemanticRepresentation)({
 *   kind: "JSON-LD",
 *   note: "Compacted document shape."
 * })
 * console.log(representation.kind) // "JSON-LD"
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
 * ```ts
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
 * console.log(metadata.canonicalName) // "NamedNode"
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

/**
 * Payload stored in the `semanticSchemaMetadata` annotation key.
 *
 * **Example** (Type-check annotation payload)
 *
 * ```ts
 * import type { SemanticSchemaMetadataAnnotationPayload } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const acceptSemanticSchemaMetadataAnnotationPayload = (value: SemanticSchemaMetadataAnnotationPayload) => value
 * console.log(acceptSemanticSchemaMetadataAnnotationPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SemanticSchemaMetadataAnnotationPayload = SemanticSchemaMetadata;

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly semanticSchemaMetadata?: SemanticSchemaMetadataAnnotationPayload | undefined;
    }
  }
}

/**
 * Validate a metadata payload before attaching it to a public schema.
 *
 * **Example** (Build validated metadata)
 *
 * ```ts
 * import { makeSemanticSchemaMetadata } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const metadata = makeSemanticSchemaMetadata({
 *   kind: "identifier",
 *   canonicalName: "ExampleIdentifier",
 *   overview: "Example semantic schema metadata.",
 *   status: "stable",
 *   specifications: [{ name: "Example Profile", disposition: "informative" }],
 *   equivalenceBasis: "String equality.",
 * })
 * console.log(metadata.kind) // "identifier"
 * ```
 *
 * @param metadata - Encoded metadata payload.
 * @returns Validated metadata payload.
 * @category utilities
 * @since 0.0.0
 */
export const makeSemanticSchemaMetadata = (
  metadata: typeof SemanticSchemaMetadata.Encoded
): SemanticSchemaMetadataAnnotationPayload =>
  pipe(SemanticSchemaMetadata.decodeUnknownResult(metadata), Result.getOrThrowWith(schemaIssueToError));

type Rebuilt<Schema extends S.Top> = Schema["Rebuild"];

/**
 * Attach validated semantic metadata to any Effect schema.
 *
 * **Example** (Attach metadata to schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { annotateSemanticSchema } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const MySchema = annotateSemanticSchema(S.String, {
 *   kind: "identifier",
 *   canonicalName: "ExampleIdentifier",
 *   overview: "Example semantic schema metadata.",
 *   status: "stable",
 *   specifications: [{ name: "Example Profile", disposition: "informative" }],
 *   equivalenceBasis: "String equality.",
 * })
 * console.log(MySchema)
 * ```
 *
 * @param schema - Target schema.
 * @param metadata - Encoded metadata payload.
 * @returns Annotated schema.
 * @category utilities
 * @since 0.0.0
 */
export const annotateSemanticSchema: {
  <Schema extends S.Top>(metadata: typeof SemanticSchemaMetadata.Encoded): (schema: Schema) => Rebuilt<Schema>;
  <Schema extends S.Top>(schema: Schema, metadata: typeof SemanticSchemaMetadata.Encoded): Rebuilt<Schema>;
} = dual(
  2,
  <Schema extends S.Top>(schema: Schema, metadata: typeof SemanticSchemaMetadata.Encoded): Rebuilt<Schema> =>
    schema.annotate({ semanticSchemaMetadata: makeSemanticSchemaMetadata(metadata) })
);

const hasAnnotationsRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> & {
  annotations?:
    | {
        semanticSchemaMetadata?: SemanticSchemaMetadataAnnotationPayload | undefined;
      }
    | undefined;
} => P.isObject(value);

const findSemanticSchemaMetadata = (
  value: unknown,
  visited: WeakSet<object>
): SemanticSchemaMetadataAnnotationPayload | undefined => {
  if (A.isArray(value)) {
    /* istanbul ignore next -- Effect Schema AST arrays are acyclic through public schema constructors */
    if (visited.has(value)) {
      return;
    }

    visited.add(value);

    for (const nested of value) {
      const metadata = findSemanticSchemaMetadata(nested, visited);
      if (metadata !== undefined) {
        return metadata;
      }
    }

    return;
  }

  if (!P.isObject(value)) {
    return;
  }

  /* istanbul ignore next -- Effect Schema AST objects are acyclic through public schema constructors */
  if (visited.has(value)) {
    return;
  }

  visited.add(value);

  if (hasAnnotationsRecord(value) && value.annotations?.semanticSchemaMetadata !== undefined) {
    return value.annotations.semanticSchemaMetadata;
  }

  for (const nested of R.values(value)) {
    const metadata = findSemanticSchemaMetadata(nested, visited);
    if (metadata !== undefined) {
      return metadata;
    }
  }

  return;
};

/**
 * Read semantic metadata from any Effect schema, if present.
 *
 * **Example** (Read missing metadata option)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { getSemanticSchemaMetadata } from "@beep/rdf/SemanticSchemaMetadata"
 * import * as O from "effect/Option"
 *
 * const metadata = getSemanticSchemaMetadata(S.String)
 * console.log(O.isNone(metadata)) // true (no metadata attached)
 * ```
 *
 * @param schema - Target schema.
 * @returns Metadata payload as an Option.
 * @category utilities
 * @since 0.0.0
 */
export const getSemanticSchemaMetadata = (schema: S.Top): O.Option<SemanticSchemaMetadataAnnotationPayload> =>
  pipe(
    O.fromNullishOr(S.resolveAnnotations(schema)?.semanticSchemaMetadata),
    O.orElse(() => O.fromNullishOr(findSemanticSchemaMetadata(schema.ast, new WeakSet())))
  );
