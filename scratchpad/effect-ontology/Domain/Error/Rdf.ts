/**
 * Schema-backed failures for RDF parsing and serialization.
 *
 * **Details**
 *
 * * Format context and underlying defects decode to `Option`, so RDF recovery
 * code can remain total and explicit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { ErrorMessage, OptionalErrorCause, OptionalErrorMessage } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Rdf");

/**
 * General RDF-processing failure.
 *
 * **Example** (Use RdfError)
 * ```ts
 * import { RdfError } from "@effect-ontology/Error/Rdf"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(RdfError)({
 *   _tag: "RdfError", message: "RDF operation failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RdfError extends S.TaggedError<RdfError>($I`RdfError`)(
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
) {}

/**
 * Indicates that RDF data could not be serialized to a target format.
 *
 * **Example** (Use SerializationFailed)
 * ```ts
 * import { SerializationFailed } from "@effect-ontology/Error/Rdf"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(SerializationFailed)({
 *   _tag: "SerializationFailed", message: "Turtle serialization failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SerializationFailed extends S.TaggedError<SerializationFailed>($I`SerializationFailed`)(
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
) {}

/**
 * Indicates that RDF input could not be parsed.
 *
 * **Example** (Use ParsingFailed)
 * ```ts
 * import { ParsingFailed } from "@effect-ontology/Error/Rdf"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ParsingFailed)({
 *   _tag: "ParsingFailed", message: "N-Triples input is malformed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ParsingFailed extends S.TaggedError<ParsingFailed>($I`ParsingFailed`)(
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
) {}

const AnyRdfErrorDefinition = S.Union([RdfError, SerializationFailed, ParsingFailed]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of RDF-processing failures.
 *
 * **Example** (Use AnyRdfError)
 * ```ts
 * import { AnyRdfError, ParsingFailed } from "@effect-ontology/Error/Rdf"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ParsingFailed)({
 *   _tag: "ParsingFailed", message: "Malformed." })
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
 * **Example** (Use AnyRdfError)
 * ```ts
 * import { RdfError, type AnyRdfError } from "@effect-ontology/Error/Rdf"
 *
 * const error: AnyRdfError = RdfError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyRdfError = typeof AnyRdfError.Type;
