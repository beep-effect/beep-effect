/**
 * SHACL Schema Types
 *
 * Browser-safe schemas for normalized SHACL validation results, reports, and
 * workflow policy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import {
  ShaclSeverity,
  ShaclValidationResult,
  ShaclValidationViolation,
} from "@beep/semantic-web/services/shacl-validation";
import { flow } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Duration from "effect/Duration";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { FastCheck } from "effect/testing";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/Shacl");

/**
 * Canonical SHACL severity schema from `@beep/semantic-web`.
 *
 * @remarks
 * Severity classifies a result but does not change whether SHACL validation
 * produced that result. Workflow failure behavior belongs to
 * {@link ValidationPolicy}.
 *
 * @example
 * ```ts
 * import { ShaclViolationSeverity } from "@effect-ontology/Schema/Shacl.ts"
 *
 * console.log(ShaclViolationSeverity.is("warning")) // true
 * ```
 *
 * @see {@link https://www.w3.org/TR/shacl/#severity | SHACL severity}
 * @category schemas
 * @since 0.0.0
 */
export const ShaclViolationSeverity = ShaclSeverity;

/**
 * Runtime value accepted by {@link ShaclViolationSeverity}.
 *
 * @example
 * ```ts
 * import type { ShaclViolationSeverity } from "@effect-ontology/Schema/Shacl.ts"
 *
 * const severity: ShaclViolationSeverity = "info"
 * console.log(severity) // "info"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ShaclViolationSeverity = ShaclSeverity;

/**
 * Normalized SHACL validation result discriminated by standard severity.
 *
 * @remarks
 * `focusNode`, `severity`, and `sourceConstraintComponent` preserve the
 * mandatory SHACL result fields. The application normalizes the optional
 * SHACL message collection to one required, non-empty diagnostic.
 *
 * @example
 * ```ts
 * import * as Rdf from "@beep/rdf/Rdf"
 * import { ShaclViolation } from "@effect-ontology/Schema/Shacl.ts"
 *
 * const result = ShaclViolation.make({
 *   focusNode: "https://example.com/alice",
 *   path: Rdf.makeNamedNode("https://schema.org/name"),
 *   message: "Expected at least one value.",
 *   severity: "violation"
 * })
 *
 * console.log(result.severity) // "violation"
 * ```
 *
 * @invariant The discriminator is one of the standard SHACL severities, and
 * every result identifies a non-empty focus node, message, and source
 * constraint component.
 * @see {@link https://www.w3.org/TR/shacl/#validation-result | SHACL validation result}
 * @category models
 * @since 0.0.0
 */
export const ShaclViolation = ShaclValidationViolation;

/**
 * Runtime value decoded by {@link ShaclViolation}.
 *
 * @example
 * ```ts
 * import * as Rdf from "@beep/rdf/Rdf"
 * import { ShaclViolation, type ShaclViolation as ShaclViolationValue } from "@effect-ontology/Schema/Shacl.ts"
 *
 * const result: ShaclViolationValue = ShaclViolation.make({
 *   focusNode: "https://example.com/alice",
 *   path: Rdf.makeNamedNode("https://schema.org/name"),
 *   message: "The preferred label is missing.",
 *   severity: "info"
 * })
 *
 * console.log(result.severity) // "info"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ShaclViolation = ShaclValidationViolation;

const isValidValidationDuration = P.every([Duration.isFinite, Duration.isGreaterThanOrEqualTo(Duration.zero)]);
const decodeValidationDuration = S.decodeUnknownResult(S.DurationFromMillis);
const makeValidationDurationArbitrary = (fc: typeof FastCheck) =>
  fc.maxSafeNat().map(flow(decodeValidationDuration, Result.getOrThrow));

const ValidationDurationMs = S.DurationFromMillis.check(
  S.makeFilter(isValidValidationDuration, {
    identifier: $I`FiniteValidationDurationCheck`,
    title: "Finite Validation Duration",
    description: "A measured validation duration that is finite and non-negative.",
    message: "Validation duration must be finite and non-negative.",
    arbitrary: {
      candidate: {
        make: makeValidationDurationArbitrary,
      },
    },
  })
)
  .annotate({
    toArbitrary: () => makeValidationDurationArbitrary,
  })
  .pipe(
    $I.annoteSchema("ValidationDurationMs", {
      description: "Finite, non-negative validation duration encoded as milliseconds.",
    })
  );

class ShaclValidationReportFields extends S.Class<ShaclValidationReportFields>($I`ShaclValidationReportFields`)(
  {
    validation: ShaclValidationResult.annotateKey({
      description: "Canonical SHACL validation result produced by the semantic-web capability.",
    }),
    validatedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant at which validation completed.",
    }),
    dataGraphTripleCount: NonNegativeInt.annotateKey({
      description: "Number of triples in the validated data graph.",
    }),
    shapesGraphTripleCount: NonNegativeInt.annotateKey({
      description: "Number of triples in the shapes graph used for validation.",
    }),
    durationMs: ValidationDurationMs.annotateKey({
      description: "Finite elapsed validation duration encoded as milliseconds.",
    }),
  },
  $I.annote("ShaclValidationReportFields", {
    description: "Experiment execution metadata wrapped around the canonical SHACL validation result.",
  })
) {}

const makeShaclValidationReportArbitrary = (fc: typeof FastCheck) =>
  fc
    .record({
      validation: S.toArbitrary(ShaclValidationResult)(fc),
      validatedAt: S.toArbitrary(S.DateTimeUtcFromString)(fc),
      dataGraphTripleCount: S.toArbitrary(NonNegativeInt)(fc),
      shapesGraphTripleCount: S.toArbitrary(NonNegativeInt)(fc),
      durationMs: S.toArbitrary(ValidationDurationMs)(fc),
    })
    .map(({ validation, validatedAt, dataGraphTripleCount, shapesGraphTripleCount, durationMs }) =>
      ShaclValidationReportFields.make({
        validation,
        validatedAt,
        dataGraphTripleCount,
        shapesGraphTripleCount,
        durationMs,
      })
    );

/**
 * Complete normalized report for one SHACL validation run.
 *
 * @remarks
 * The canonical validation result is embedded under `validation`; the other
 * fields are experiment-specific execution metadata.
 *
 * The decoded `durationMs` value is an Effect `Duration`; its encoded form is
 * the finite, non-negative millisecond measurement named by the field.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ShaclValidationReport } from "@effect-ontology/Schema/Shacl.ts"
 *
 * const report = S.decodeUnknownResult(ShaclValidationReport)({
 *   validation: { conforms: true, violations: [], truncated: false },
 *   validatedAt: "2026-07-25T12:00:00.000Z",
 *   dataGraphTripleCount: 42,
 *   shapesGraphTripleCount: 8,
 *   durationMs: 12.5
 * })
 *
 * console.log(report._tag) // "Success"
 * ```
 *
 * @invariant Validation semantics are owned by `ShaclValidationResult`; counts
 * are non-negative integers, and the elapsed duration is finite.
 * @see {@link https://www.w3.org/TR/shacl/#validation-report | SHACL validation report}
 * @category validation
 * @since 0.0.0
 */
export const ShaclValidationReport = ShaclValidationReportFields.annotate({
  toArbitrary: () => makeShaclValidationReportArbitrary,
}).pipe(
  $I.annoteSchema("ShaclValidationReport", {
    description:
      "Complete normalized SHACL validation report with spec-consistent conformance, graph sizes, completion time, and finite duration.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value decoded by {@link ShaclValidationReport}.
 *
 * @example
 * ```ts
 * import type { ShaclValidationReport } from "@effect-ontology/Schema/Shacl.ts"
 *
 * const summary: Pick<ShaclValidationReport, "validation"> = {
 *   validation: { conforms: true, violations: [], truncated: false }
 * }
 * console.log(summary.validation.conforms) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ShaclValidationReport = typeof ShaclValidationReport.Type;

class ValidationPolicyFields extends S.Class<ValidationPolicyFields>($I`ValidationPolicyFields`)(
  {
    failOnViolation: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(true),
      S.annotateKey({
        description: "Whether Violation-level results fail the workflow when logOnly is false.",
      })
    ),
    failOnWarning: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(false),
      S.annotateKey({
        description: "Whether Warning-level results fail the workflow when logOnly is false.",
      })
    ),
    logOnly: S.Boolean.pipe(
      SchemaUtils.withKeyDefaults(false),
      S.annotateKey({
        description: "Whether all validation results are logged without failing the workflow.",
      })
    ),
  },
  $I.annote("ValidationPolicyFields", {
    description: "Internal field model for SHACL workflow failure policy.",
  })
) {}

/**
 * Workflow policy that maps SHACL result severities to failure behavior.
 *
 * @remarks
 * `logOnly` takes precedence over both failure flags. When it is false,
 * `failOnWarning` extends failure behavior to Warning-level results while
 * `failOnViolation` controls Violation-level results. Info-level results never
 * fail a workflow under this policy. The schema-owned `shouldFail` static
 * evaluates this policy without changing standards-level report conformance.
 *
 * @example
 * ```ts
 * import { ValidationPolicy } from "@effect-ontology/Schema/Shacl.ts"
 *
 * const strict = ValidationPolicy.fromUnknown({ failOnWarning: true })
 *
 * console.log(strict.failOnViolation) // true
 * console.log(strict.failOnWarning) // true
 * console.log(strict.logOnly) // false
 * console.log(ValidationPolicy.shouldFail(strict, [])) // false
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const ValidationPolicy = ValidationPolicyFields.annotate({
  toArbitrary: () => (fc) =>
    fc
      .record({
        failOnViolation: fc.boolean(),
        failOnWarning: fc.boolean(),
        logOnly: fc.boolean(),
      })
      .map((input) => ValidationPolicyFields.make(input)),
}).pipe(
  $I.annoteSchema("ValidationPolicy", {
    description: "Workflow policy for failing on SHACL Violation or Warning results, with an overriding log-only mode.",
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics((schema) => ({
    shouldFail: dual(2, (policy: typeof schema.Type, results: ReadonlyArray<ShaclViolation>): boolean =>
      Bool.and(
        Bool.not(policy.logOnly),
        Bool.or(
          Bool.and(
            policy.failOnViolation,
            A.some(results, (result) => result.severity === "violation")
          ),
          Bool.and(
            policy.failOnWarning,
            A.some(results, (result) => result.severity === "warning")
          )
        )
      )
    ),
  }))
);

/**
 * Runtime value decoded by {@link ValidationPolicy}.
 *
 * @example
 * ```ts
 * import { ValidationPolicy, type ValidationPolicy as ValidationPolicyValue } from "@effect-ontology/Schema/Shacl.ts"
 *
 * const policy: ValidationPolicyValue = ValidationPolicy.fromUnknown({ logOnly: true })
 * console.log(policy.logOnly) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ValidationPolicy = typeof ValidationPolicy.Type;
