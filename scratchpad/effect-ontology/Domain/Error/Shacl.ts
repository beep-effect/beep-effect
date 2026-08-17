/**
 * Schema-backed failures for the SHACL validation lifecycle.
 *
 * @remarks
 * Shape identifiers use canonical RDF IRIs, policy severity is a closed
 * literal domain, and result counts are finite non-negative integers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import { ShaclSeverity, ShaclValidationError } from "@beep/semantic-web/services/shacl-validation";
import * as S from "effect/Schema";
import { ErrorMessage, makeOntologyErrorClass, OptionalErrorCause, OptionalErrorIri } from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Shacl");

/**
 * Severity threshold that caused SHACL policy rejection.
 *
 * @example
 * ```ts
 * import { ValidationPolicySeverity } from "@effect-ontology/Error/Shacl.ts"
 *
 * console.log(ValidationPolicySeverity.includes("warning")) // true
 * ```
 *
 * @invariant Every value is either `violation` or `warning`.
 * @category errors
 * @since 0.0.0
 */
export const ValidationPolicySeverity = S.Literals(ShaclSeverity.pickOptions(["violation", "warning"])).pipe(
  $I.annoteSchema("ValidationPolicySeverity", {
    description: "Severity threshold that caused SHACL validation policy rejection.",
    toArbitrary: () => (fc) => fc.constantFrom("violation" as const, "warning" as const),
  })
);

/**
 * Runtime value accepted by {@link ValidationPolicySeverity}.
 *
 * @example
 * ```ts
 * import type { ValidationPolicySeverity } from "@effect-ontology/Error/Shacl.ts"
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
 * @example
 * ```ts
 * import { ShapesLoadError } from "@effect-ontology/Error/Shacl.ts"
 *
 * const error = ShapesLoadError.make({ message: "Shapes graph could not be loaded." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ShapesLoadError = makeOntologyErrorClass.make(
  $I`ShapesLoadError`,
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
);

/** Runtime value decoded by {@link ShapesLoadError}.
 * @example
 * ```ts
 * import { ShapesLoadError, type ShapesLoadError as Failure } from "@effect-ontology/Error/Shacl.ts"
 * const error: Failure = ShapesLoadError.make({ message: "Failed." })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ShapesLoadError = typeof ShapesLoadError.Type;

/**
 * Failure to generate or serialize a SHACL validation report.
 *
 * @example
 * ```ts
 * import { ValidationReportError } from "@effect-ontology/Error/Shacl.ts"
 *
 * const error = ValidationReportError.make({ message: "Report generation failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ValidationReportError = makeOntologyErrorClass.make(
  $I`ValidationReportError`,
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
);

/** Runtime value decoded by {@link ValidationReportError}.
 * @example
 * ```ts
 * import { ValidationReportError, type ValidationReportError as Failure } from "@effect-ontology/Error/Shacl.ts"
 * const error: Failure = ValidationReportError.make({ message: "Failed." })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ValidationReportError = typeof ValidationReportError.Type;

/**
 * SHACL validation result rejected by configured severity policy.
 *
 * @example
 * ```ts
 * import { ValidationPolicyError } from "@effect-ontology/Error/Shacl.ts"
 *
 * const error = ValidationPolicyError.fromUnknown({
 *   message: "Validation policy rejected the graph.",
 *   violationCount: 2,
 *   warningCount: 1,
 *   severity: "violation"
 * })
 * console.log(error.violationCount)
 * ```
 *
 * @invariant Result counts are finite non-negative integers.
 * @category errors
 * @since 0.0.0
 */
export const ValidationPolicyError = makeOntologyErrorClass.make(
  $I`ValidationPolicyError`,
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
);

/** Runtime value decoded by {@link ValidationPolicyError}.
 * @example
 * ```ts
 * import { ValidationPolicyError, type ValidationPolicyError as Failure } from "@effect-ontology/Error/Shacl.ts"
 * const error: Failure = ValidationPolicyError.fromUnknown({
 *   message: "Rejected.",
 *   violationCount: 1,
 *   warningCount: 0,
 *   severity: "violation"
 * })
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type ValidationPolicyError = typeof ValidationPolicyError.Type;

const ShaclErrorDefinition = S.Union([
  ShaclValidationError,
  ShapesLoadError,
  ValidationReportError,
  ValidationPolicyError,
]).pipe(S.toTaggedUnion("_tag"));

/**
 * Exhaustive tagged union of SHACL lifecycle failures.
 *
 * @example
 * ```ts
 * import { ShaclError, ShapesLoadError } from "@effect-ontology/Error/Shacl.ts"
 *
 * const error = ShapesLoadError.make({ message: "Failed." })
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
 * @example
 * ```ts
 * import { ShapesLoadError, type ShaclError } from "@effect-ontology/Error/Shacl.ts"
 * const error: ShaclError = ShapesLoadError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ShaclError = typeof ShaclError.Type;
