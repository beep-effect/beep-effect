/**
 * Schema-backed failures for ontology lookup, loading, and embeddings.
 *
 * @remarks
 * Class and property identifiers use canonical RDF IRI schemas; filesystem
 * context uses `FilePath`; version markers and diagnostics are non-empty.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { IRI, URI } from "@beep/rdf";
import { FilePath } from "@beep/schema";
import * as S from "effect/Schema";
import { ErrorMessage, makeOntologyErrorClass, OptionalErrorCause } from "./Base.ts";

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
 * @example
 * ```ts
 * import { OntologyError } from "@effect-ontology/Error/Ontology.ts"
 *
 * const error = OntologyError.make({ message: "Ontology operation failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OntologyError = makeOntologyErrorClass.make(
  $I`OntologyError`,
  "OntologyError",
  commonFields,
  $I.annote("OntologyError", {
    description: "General ontology-operation failure.",
  })
);

/** Runtime value decoded by {@link OntologyError}.
 * @example
 * ```ts
 * import { OntologyError, type OntologyError as Failure } from "@effect-ontology/Error/Ontology.ts"
 * const error: Failure = OntologyError.make({ message: "Failed." })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type OntologyError = typeof OntologyError.Type;

/**
 * Lookup failure for a class IRI absent from an ontology.
 *
 * @example
 * ```ts
 * import { ClassNotFound } from "@effect-ontology/Error/Ontology.ts"
 *
 * const error = ClassNotFound.fromUnknown({
 *   message: "Class was not found.",
 *   classIri: "https://example.com/ontology#Missing"
 * })
 * console.log(error.classIri)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ClassNotFound = makeOntologyErrorClass.make(
  $I`ClassNotFound`,
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
);

/** Runtime value decoded by {@link ClassNotFound}.
 * @example
 * ```ts
 * import { ClassNotFound, type ClassNotFound as Missing } from "@effect-ontology/Error/Ontology.ts"
 * const error: Missing = ClassNotFound.fromUnknown({ message: "Missing.", classIri: "https://example.com/C" })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ClassNotFound = typeof ClassNotFound.Type;

/**
 * Lookup failure for a property IRI absent from an ontology.
 *
 * @example
 * ```ts
 * import { PropertyNotFound } from "@effect-ontology/Error/Ontology.ts"
 *
 * const error = PropertyNotFound.fromUnknown({
 *   message: "Property was not found.",
 *   propertyIri: "https://example.com/ontology#missing"
 * })
 * console.log(error.propertyIri)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PropertyNotFound = makeOntologyErrorClass.make(
  $I`PropertyNotFound`,
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
);

/** Runtime value decoded by {@link PropertyNotFound}.
 * @example
 * ```ts
 * import { PropertyNotFound, type PropertyNotFound as Missing } from "@effect-ontology/Error/Ontology.ts"
 * const error: Missing = PropertyNotFound.fromUnknown({ message: "Missing.", propertyIri: "https://example.com/p" })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type PropertyNotFound = typeof PropertyNotFound.Type;

/**
 * Failure to locate an ontology file at a canonical path.
 *
 * @example
 * ```ts
 * import { OntologyFileNotFound } from "@effect-ontology/Error/Ontology.ts"
 *
 * const error = OntologyFileNotFound.fromUnknown({
 *   message: "Ontology file was not found.",
 *   path: "/data/ontology.ttl"
 * })
 * console.log(error.path)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OntologyFileNotFound = makeOntologyErrorClass.make(
  $I`OntologyFileNotFound`,
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
);

/** Runtime value decoded by {@link OntologyFileNotFound}.
 * @example
 * ```ts
 * import { OntologyFileNotFound, type OntologyFileNotFound as Missing } from "@effect-ontology/Error/Ontology.ts"
 * const error: Missing = OntologyFileNotFound.fromUnknown({ message: "Missing.", path: "/tmp/o.ttl" })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type OntologyFileNotFound = typeof OntologyFileNotFound.Type;

/**
 * Failure to parse an ontology file at a canonical path.
 *
 * @example
 * ```ts
 * import { OntologyParsingFailed } from "@effect-ontology/Error/Ontology.ts"
 *
 * const error = OntologyParsingFailed.fromUnknown({
 *   message: "Ontology syntax is invalid.",
 *   path: "/data/ontology.ttl"
 * })
 * console.log(error.path)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OntologyParsingFailed = makeOntologyErrorClass.make(
  $I`OntologyParsingFailed`,
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
);

/** Runtime value decoded by {@link OntologyParsingFailed}.
 * @example
 * ```ts
 * import { OntologyParsingFailed, type OntologyParsingFailed as Failure } from "@effect-ontology/Error/Ontology.ts"
 * const error: Failure = OntologyParsingFailed.fromUnknown({ message: "Malformed.", path: "/tmp/o.ttl" })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type OntologyParsingFailed = typeof OntologyParsingFailed.Type;

/**
 * Failure to locate precomputed embeddings for an ontology.
 *
 * @example
 * ```ts
 * import { EmbeddingsNotFound } from "@effect-ontology/Error/Ontology.ts"
 *
 * const error = EmbeddingsNotFound.fromUnknown({
 *   message: "Embeddings blob was not found.",
 *   ontologyUri: "https://example.com/ontology",
 *   embeddingsPath: "/data/ontology.embeddings"
 * })
 * console.log(error.embeddingsPath)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const EmbeddingsNotFound = makeOntologyErrorClass.make(
  $I`EmbeddingsNotFound`,
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
);

/** Runtime value decoded by {@link EmbeddingsNotFound}.
 * @example
 * ```ts
 * import { EmbeddingsNotFound, type EmbeddingsNotFound as Missing } from "@effect-ontology/Error/Ontology.ts"
 * const error: Missing = EmbeddingsNotFound.fromUnknown({
 *   message: "Missing.",
 *   ontologyUri: "https://example.com/o",
 *   embeddingsPath: "/tmp/o.bin"
 * })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingsNotFound = typeof EmbeddingsNotFound.Type;

/**
 * Precomputed embeddings whose version does not match ontology content.
 *
 * @example
 * ```ts
 * import { EmbeddingsVersionMismatch } from "@effect-ontology/Error/Ontology.ts"
 *
 * const error = EmbeddingsVersionMismatch.fromUnknown({
 *   message: "Embeddings are stale.",
 *   ontologyUri: "https://example.com/ontology",
 *   expectedVersion: "sha256:new",
 *   actualVersion: "sha256:old"
 * })
 * console.log(error.expectedVersion)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const EmbeddingsVersionMismatch = makeOntologyErrorClass.make(
  $I`EmbeddingsVersionMismatch`,
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
);

/** Runtime value decoded by {@link EmbeddingsVersionMismatch}.
 * @example
 * ```ts
 * import { EmbeddingsVersionMismatch, type EmbeddingsVersionMismatch as Failure } from "@effect-ontology/Error/Ontology.ts"
 * const error: Failure = EmbeddingsVersionMismatch.fromUnknown({
 *   message: "Stale.",
 *   ontologyUri: "https://example.com/o",
 *   expectedVersion: "new",
 *   actualVersion: "old"
 * })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingsVersionMismatch = typeof EmbeddingsVersionMismatch.Type;

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
 * @example
 * ```ts
 * import { AnyOntologyError, OntologyError } from "@effect-ontology/Error/Ontology.ts"
 *
 * const error = OntologyError.make({ message: "Failed." })
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
 * @example
 * ```ts
 * import { OntologyError, type AnyOntologyError } from "@effect-ontology/Error/Ontology.ts"
 * const error: AnyOntologyError = OntologyError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyOntologyError = typeof AnyOntologyError.Type;
