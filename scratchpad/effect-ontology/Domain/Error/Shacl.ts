/**
 * Schema-backed failures for the SHACL validation lifecycle.
 *
 * **Details**
 *
 * * Shape identifiers use canonical RDF IRIs, policy severity is a closed
 * literal domain, and result counts are finite non-negative integers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import { ShaclSeverity, ShaclValidationError } from "@beep/semantic-web/services/shacl-validation";
import * as S from "effect/Schema";
import { ErrorMessage, OptionalErrorCause, OptionalErrorIri } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Shacl");

/**
 * Severity threshold that caused SHACL policy rejection.
 *
 * **Example** (Use ValidationPolicySeverity)
 * ```ts
 * import { ValidationPolicySeverity } from "@effect-ontology/Error/Shacl"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ValidationPolicySeverity)("warning")) // true
 * ```
 *
 * @invariant Every value is either `violation` or `warning`.
 * @category errors
 * @since 0.0.0
 */
export const ValidationPolicySeverity = S.Literals(ShaclSeverity.pickOptions(["violation", "warning"])).pipe(
  $I.annoteSchema("ValidationPolicySeverity", {
    description: "Severity threshold that caused SHACL validation policy rejection.",
    toArbitrary: () => (fc) => fc.constantFrom("violation", "warning"),
  })
);

/**
 * Runtime value accepted by {@link ValidationPolicySeverity}.
 *
 * **Example** (Use ValidationPolicySeverity)
 * ```ts
 * import type { ValidationPolicySeverity } from "@effect-ontology/Error/Shacl"
 *
 * const severity: ValidationPolicySeverity = "violation"
 * console.log(severity)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ValidationPolicySeverity = typeof ValidationPolicySeverity.Type;

/**
 * Failure to load a SHACL shapes graph.
 *
 * **Example** (Use ShapesLoadError)
 * ```ts
 * import { ShapesLoadError } from "@effect-ontology/Error/Shacl"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ShapesLoadError)({
 *   _tag: "ShapesLoadError", message: "Shapes graph could not be loaded." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ShapesLoadError extends S.TaggedError<ShapesLoadError>($I`ShapesLoadError`)(
  "ShapesLoadError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable shapes-load diagnostic.",
    }),
    shapesUri: OptionalErrorIri.annotateKey({
      description: "Optional canonical shapes-graph IRI, normalized to Option.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional shapes-loader defect.",
    }),
  },
  $I.annote("ShapesLoadError", {
    description: "Failure to load a SHACL shapes graph.",
  })
) {

  static readonly is = S.is(ShapesLoadError)
}

/**
 * Failure to generate or serialize a SHACL validation report.
 *
 * **Example** (Use ValidationReportError)
 * ```ts
 * import { ValidationReportError } from "@effect-ontology/Error/Shacl"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ValidationReportError)({
 *   _tag: "ValidationReportError", message: "Report generation failed." })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ValidationReportError extends S.TaggedError<ValidationReportError>($I`ValidationReportError`)(
  "ValidationReportError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable report-generation diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional report generator defect.",
    }),
  },
  $I.annote("ValidationReportError", {
    description: "Failure to generate or serialize a SHACL validation report.",
  })
) {}

/**
 * SHACL validation result rejected by configured severity policy.
 *
 * **Example** (Use ValidationPolicyError)
 * ```ts
 * import { ValidationPolicyError } from "@effect-ontology/Error/Shacl"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ValidationPolicyError)({
 *   _tag: "ValidationPolicyError",
 *   message: "Validation policy rejected the graph.",
 *   violationCount: 2,
 *   warningCount: 1,
 *   severity: "violation"
 * })
 * console.log(O.isSome(error)) // true
 * ```
 *
 * @invariant Result counts are finite non-negative integers.
 * @category errors
 * @since 0.0.0
 */
export class ValidationPolicyError extends S.TaggedError<ValidationPolicyError>($I`ValidationPolicyError`)(
  "ValidationPolicyError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable policy rejection diagnostic.",
    }),
    violationCount: NonNegativeInt.annotateKey({
      description: "Number of SHACL violation results.",
    }),
    warningCount: NonNegativeInt.annotateKey({
      description: "Number of SHACL warning results.",
    }),
    severity: ValidationPolicySeverity.annotateKey({
      description: "Severity threshold responsible for policy rejection.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional policy evaluation defect.",
    }),
  },
  $I.annote("ValidationPolicyError", {
    description: "SHACL validation result rejected by configured severity policy.",
  })
) {}

const ShaclErrorDefinition = S.Union([
  ShaclValidationError,
  ShapesLoadError,
  ValidationReportError,
  ValidationPolicyError,
]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of SHACL lifecycle failures.
 *
 * **Example** (Use ShaclError)
 * ```ts
 * import { ShaclError, ShapesLoadError } from "@effect-ontology/Error/Shacl"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const error = S.decodeUnknownOption(ShapesLoadError)({
 *   _tag: "ShapesLoadError", message: "Failed." })
 * console.log(ShaclError.guards.ShapesLoadError(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ShaclError = ShaclErrorDefinition.pipe(
  $I.annoteSchema("ShaclError", {
    description: "Exhaustive tagged union of SHACL validation lifecycle failures.",
    toArbitrary: () => S.toArbitrary(ShaclErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link ShaclError}.
 *
 * **Example** (Use ShaclError)
 * ```ts
 * import { ShapesLoadError, type ShaclError } from "@effect-ontology/Error/Shacl"
 * const error: ShaclError = ShapesLoadError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ShaclError = typeof ShaclError.Type;
