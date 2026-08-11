/**
 * Schema-backed failures for RDF parsing and serialization.
 *
 * @remarks
 * Format context and underlying defects decode to `Option`, so RDF recovery
 * code can remain total and explicit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { ErrorMessage, makeOntologyErrorClass, OptionalErrorCause, OptionalErrorMessage } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Rdf");

/**
 * General RDF-processing failure.
 *
 * @example
 * ```ts
 * import { RdfError } from "@effect-ontology/Error/Rdf.ts"
 *
 * const error = RdfError.make({ message: "RDF operation failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const RdfError = makeOntologyErrorClass(
  $I`RdfError`,
  "RdfError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable RDF-processing diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying RDF library defect.",
    }),
  },
  $I.annote("RdfError", { description: "General RDF-processing failure." })
);

/**
 * Runtime value decoded by {@link RdfError}.
 *
 * @example
 * ```ts
 * import { RdfError, type RdfError as RdfFailure } from "@effect-ontology/Error/Rdf.ts"
 *
 * const error: RdfFailure = RdfError.make({ message: "Failed." })
 * console.log(error.message)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RdfError = typeof RdfError.Type;

/**
 * Indicates that RDF data could not be serialized to a target format.
 *
 * @example
 * ```ts
 * import { SerializationFailed } from "@effect-ontology/Error/Rdf.ts"
 *
 * const error = SerializationFailed.make({ message: "Turtle serialization failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SerializationFailed = makeOntologyErrorClass(
  $I`SerializationFailed`,
  "SerializationFailed",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable serialization diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional serializer defect.",
    }),
    format: OptionalErrorMessage.annotateKey({
      description: "Optional target RDF format, normalized to Option.",
    }),
  },
  $I.annote("SerializationFailed", {
    description: "Failure to serialize RDF data to a requested format.",
  })
);

/**
 * Runtime value decoded by {@link SerializationFailed}.
 *
 * @example
 * ```ts
 * import { SerializationFailed, type SerializationFailed as Failure } from "@effect-ontology/Error/Rdf.ts"
 *
 * const error: Failure = SerializationFailed.make({ message: "Could not serialize." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SerializationFailed = typeof SerializationFailed.Type;

/**
 * Indicates that RDF input could not be parsed.
 *
 * @example
 * ```ts
 * import { ParsingFailed } from "@effect-ontology/Error/Rdf.ts"
 *
 * const error = ParsingFailed.make({ message: "N-Triples input is malformed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ParsingFailed = makeOntologyErrorClass(
  $I`ParsingFailed`,
  "ParsingFailed",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable parse diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional parser defect.",
    }),
    format: OptionalErrorMessage.annotateKey({
      description: "Optional source RDF format, normalized to Option.",
    }),
  },
  $I.annote("ParsingFailed", {
    description: "Failure to parse RDF input in the supplied source format.",
  })
);

/**
 * Runtime value decoded by {@link ParsingFailed}.
 *
 * @example
 * ```ts
 * import { ParsingFailed, type ParsingFailed as Failure } from "@effect-ontology/Error/Rdf.ts"
 *
 * const error: Failure = ParsingFailed.make({ message: "Could not parse." })
 * console.log(error.message)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ParsingFailed = typeof ParsingFailed.Type;

const AnyRdfErrorDefinition = S.Union([RdfError, SerializationFailed, ParsingFailed]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of RDF-processing failures.
 *
 * @example
 * ```ts
 * import { AnyRdfError, ParsingFailed } from "@effect-ontology/Error/Rdf.ts"
 *
 * const error = ParsingFailed.make({ message: "Malformed." })
 * console.log(AnyRdfError.guards.ParsingFailed(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AnyRdfError = AnyRdfErrorDefinition.pipe(
  $I.annoteSchema("AnyRdfError", {
    description: "Exhaustive tagged union of RDF-processing failures.",
    toArbitrary: () => S.toArbitrary(AnyRdfErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link AnyRdfError}.
 *
 * @example
 * ```ts
 * import { RdfError, type AnyRdfError } from "@effect-ontology/Error/Rdf.ts"
 *
 * const error: AnyRdfError = RdfError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyRdfError = typeof AnyRdfError.Type;
