/**
 * Schema-backed SPARQL execution and data-loading failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { ErrorMessage, makeOntologyErrorClass, OptionalErrorCause, OptionalErrorMessage } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Sparql");

/**
 * Indicates that a SPARQL query failed during execution.
 *
 * @remarks
 * The query is optional because retaining full query text may be unsafe or
 * impractical. Callers should redact it before constructing this error.
 *
 * @example
 * ```ts
 * import { SparqlExecutionError } from "@effect-ontology/Error/Sparql.ts"
 *
 * const error = SparqlExecutionError.make({ message: "Query execution failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SparqlExecutionError = makeOntologyErrorClass(
  $I`SparqlExecutionError`,
  "SparqlExecutionError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable query-execution diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional query-engine defect.",
    }),
    query: OptionalErrorMessage.annotateKey({
      description: "Optional redacted SPARQL query, normalized to Option.",
    }),
  },
  $I.annote("SparqlExecutionError", {
    description: "Failure raised while executing a SPARQL query.",
  })
);

/**
 * Runtime value decoded by {@link SparqlExecutionError}.
 *
 * @example
 * ```ts
 * import { SparqlExecutionError, type SparqlExecutionError as Failure } from "@effect-ontology/Error/Sparql.ts"
 *
 * const error: Failure = SparqlExecutionError.make({ message: "Failed." })
 * console.log(error.message)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SparqlExecutionError = typeof SparqlExecutionError.Type;

/**
 * Indicates that RDF data could not be loaded into a SPARQL engine.
 *
 * @example
 * ```ts
 * import { SparqlLoadError } from "@effect-ontology/Error/Sparql.ts"
 *
 * const error = SparqlLoadError.make({ message: "Dataset load failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SparqlLoadError = makeOntologyErrorClass(
  $I`SparqlLoadError`,
  "SparqlLoadError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable dataset-load diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional SPARQL-engine defect.",
    }),
    format: OptionalErrorMessage.annotateKey({
      description: "Optional RDF source format, normalized to Option.",
    }),
  },
  $I.annote("SparqlLoadError", {
    description: "Failure to load RDF data into a SPARQL query engine.",
  })
);

/**
 * Runtime value decoded by {@link SparqlLoadError}.
 *
 * @example
 * ```ts
 * import { SparqlLoadError, type SparqlLoadError as Failure } from "@effect-ontology/Error/Sparql.ts"
 *
 * const error: Failure = SparqlLoadError.make({ message: "Load failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SparqlLoadError = typeof SparqlLoadError.Type;

const SparqlErrorDefinition = S.Union([SparqlExecutionError, SparqlLoadError]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of SPARQL failures.
 *
 * @example
 * ```ts
 * import { SparqlError, SparqlLoadError } from "@effect-ontology/Error/Sparql.ts"
 *
 * const error = SparqlLoadError.make({ message: "Load failed." })
 * console.log(SparqlError.guards.SparqlLoadError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SparqlError = SparqlErrorDefinition.pipe(
  $I.annoteSchema("SparqlError", {
    description: "Exhaustive tagged union of SPARQL failures.",
    toArbitrary: () => S.toArbitrary(SparqlErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link SparqlError}.
 *
 * @example
 * ```ts
 * import { SparqlLoadError, type SparqlError } from "@effect-ontology/Error/Sparql.ts"
 *
 * const error: SparqlError = SparqlLoadError.make({ message: "Load failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SparqlError = typeof SparqlError.Type;
