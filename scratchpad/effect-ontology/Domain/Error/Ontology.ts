/**
 * Schema-backed failures for ontology lookup, loading, and embeddings.
 *
 * **Details**
 *
 * * Class and property identifiers use canonical RDF IRI schemas; filesystem
 * context uses `FilePath`; version markers and diagnostics are non-empty.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { IRI, URI } from "@beep/rdf";
import { FilePath } from "@beep/schema";
import * as S from "effect/Schema";
import { ErrorMessage, OptionalErrorCause } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Ontology");

const commonFields = {
  message: ErrorMessage.annotateKey({
    description: "Human-readable ontology diagnostic.",
  }),
  cause: OptionalErrorCause.annotateKey({
    description: "Optional underlying ontology defect.",
  }),
};

/**
 * General ontology-operation failure.
 *
 * **Example** (Use OntologyError)
 * ```ts
 * import { OntologyError } from "@effect-ontology/Error/Ontology"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(OntologyError)({
 *   _tag: "OntologyError", message: "Ontology operation failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OntologyError extends S.TaggedError<OntologyError>($I`OntologyError`)(
  "OntologyError",
  commonFields,
  $I.annote("OntologyError", {
    description: "General ontology-operation failure.",
  })
) {}

/**
 * Lookup failure for a class IRI absent from an ontology.
 *
 * **Example** (Use ClassNotFound)
 * ```ts
 * import { ClassNotFound } from "@effect-ontology/Error/Ontology"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ClassNotFound)({
 *   _tag: "ClassNotFound",
 *   message: "Class was not found.",
 *   classIri: "https://example.com/ontology#Missing"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ClassNotFound extends S.TaggedError<ClassNotFound>($I`ClassNotFound`)(
  "ClassNotFound",
  {
    ...commonFields,
    classIri: IRI.annotateKey({
      description: "Canonical class IRI that could not be resolved.",
    }),
  },
  $I.annote("ClassNotFound", {
    description: "Lookup failure for a class IRI absent from an ontology.",
  })
) {}

/**
 * Lookup failure for a property IRI absent from an ontology.
 *
 * **Example** (Use PropertyNotFound)
 * ```ts
 * import { PropertyNotFound } from "@effect-ontology/Error/Ontology"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(PropertyNotFound)({
 *   _tag: "PropertyNotFound",
 *   message: "Property was not found.",
 *   propertyIri: "https://example.com/ontology#missing"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PropertyNotFound extends S.TaggedError<PropertyNotFound>($I`PropertyNotFound`)(
  "PropertyNotFound",
  {
    ...commonFields,
    propertyIri: IRI.annotateKey({
      description: "Canonical property IRI that could not be resolved.",
    }),
  },
  $I.annote("PropertyNotFound", {
    description: "Lookup failure for a property IRI absent from an ontology.",
  })
) {}

/**
 * Failure to locate an ontology file at a canonical path.
 *
 * **Example** (Use OntologyFileNotFound)
 * ```ts
 * import { OntologyFileNotFound } from "@effect-ontology/Error/Ontology"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(OntologyFileNotFound)({
 *   _tag: "OntologyFileNotFound",
 *   message: "Ontology file was not found.",
 *   path: "/data/ontology.ttl"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OntologyFileNotFound extends S.TaggedError<OntologyFileNotFound>($I`OntologyFileNotFound`)(
  "OntologyFileNotFound",
  {
    ...commonFields,
    path: FilePath.annotateKey({
      description: "Canonical ontology file path that could not be resolved.",
    }),
  },
  $I.annote("OntologyFileNotFound", {
    description: "Failure to locate an ontology file at a canonical path.",
  })
) {}

/**
 * Failure to parse an ontology file at a canonical path.
 *
 * **Example** (Use OntologyParsingFailed)
 * ```ts
 * import { OntologyParsingFailed } from "@effect-ontology/Error/Ontology"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(OntologyParsingFailed)({
 *   _tag: "OntologyParsingFailed",
 *   message: "Ontology syntax is invalid.",
 *   path: "/data/ontology.ttl"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OntologyParsingFailed extends S.TaggedError<OntologyParsingFailed>($I`OntologyParsingFailed`)(
  "OntologyParsingFailed",
  {
    ...commonFields,
    path: FilePath.annotateKey({
      description: "Canonical path of the ontology file that failed to parse.",
    }),
  },
  $I.annote("OntologyParsingFailed", {
    description: "Failure to parse an ontology file at a canonical path.",
  })
) {}

/**
 * Failure to locate precomputed embeddings for an ontology.
 *
 * **Example** (Use EmbeddingsNotFound)
 * ```ts
 * import { EmbeddingsNotFound } from "@effect-ontology/Error/Ontology"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(EmbeddingsNotFound)({
 *   _tag: "EmbeddingsNotFound",
 *   message: "Embeddings blob was not found.",
 *   ontologyUri: "https://example.com/ontology",
 *   embeddingsPath: "/data/ontology.embeddings"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EmbeddingsNotFound extends S.TaggedError<EmbeddingsNotFound>($I`EmbeddingsNotFound`)(
  "EmbeddingsNotFound",
  {
    ...commonFields,
    ontologyUri: URI.annotateKey({
      description: "Canonical URI of the ontology missing embeddings.",
    }),
    embeddingsPath: FilePath.annotateKey({
      description: "Canonical path where embeddings were expected.",
    }),
  },
  $I.annote("EmbeddingsNotFound", {
    description: "Failure to locate precomputed embeddings for an ontology.",
  })
) {}

/**
 * Precomputed embeddings whose version does not match ontology content.
 *
 * **Example** (Use EmbeddingsVersionMismatch)
 * ```ts
 * import { EmbeddingsVersionMismatch } from "@effect-ontology/Error/Ontology"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(EmbeddingsVersionMismatch)({
 *   _tag: "EmbeddingsVersionMismatch",
 *   message: "Embeddings are stale.",
 *   ontologyUri: "https://example.com/ontology",
 *   expectedVersion: "sha256:new",
 *   actualVersion: "sha256:old"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EmbeddingsVersionMismatch extends S.TaggedError<EmbeddingsVersionMismatch>($I`EmbeddingsVersionMismatch`)(
  "EmbeddingsVersionMismatch",
  {
    ...commonFields,
    ontologyUri: URI.annotateKey({
      description: "Canonical URI of the ontology.",
    }),
    expectedVersion: S.NonEmptyString.annotateKey({
      description: "Version derived from current ontology content.",
    }),
    actualVersion: S.NonEmptyString.annotateKey({
      description: "Version stored with the embeddings blob.",
    }),
  },
  $I.annote("EmbeddingsVersionMismatch", {
    description: "Precomputed embeddings whose version does not match ontology content.",
  })
) {}

const AnyOntologyErrorDefinition = S.Union([
  OntologyError,
  ClassNotFound,
  PropertyNotFound,
  OntologyFileNotFound,
  OntologyParsingFailed,
  EmbeddingsNotFound,
  EmbeddingsVersionMismatch,
]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of ontology-operation failures.
 *
 * **Example** (Use AnyOntologyError)
 * ```ts
 * import { AnyOntologyError, OntologyError } from "@effect-ontology/Error/Ontology"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(OntologyError)({
 *   _tag: "OntologyError", message: "Failed." })
 * console.log(AnyOntologyError.guards.OntologyError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AnyOntologyError = AnyOntologyErrorDefinition.pipe(
  $I.annoteSchema("AnyOntologyError", {
    description: "Exhaustive tagged union of ontology lookup, loading, and embeddings failures.",
    toArbitrary: () => S.toArbitrary(AnyOntologyErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link AnyOntologyError}.
 *
 * **Example** (Use AnyOntologyError)
 * ```ts
 * import { OntologyError, type AnyOntologyError } from "@effect-ontology/Error/Ontology"
 * const error: AnyOntologyError = OntologyError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyOntologyError = typeof AnyOntologyError.Type;
