/**
 * SHACL Schema Types
 *
 * Browser-safe schemas for normalized SHACL validation results, reports, and
 * workflow policy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { flow } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Duration from "effect/Duration";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import type { FastCheck } from "effect/testing";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/Shacl");

const ShaclResultTerm = S.NonEmptyString.annotate({
  toArbitrary: () => (fc) => fc.string({ minLength: 1, maxLength: 256 }),
}).pipe(
  $I.annoteSchema("ShaclResultTerm", {
    description: "Non-empty text representation of an RDF term or SHACL property path in a normalized result.",
  })
);

const ShaclResultMessage = S.NonEmptyString.annotate({
  toArbitrary: () => (fc) => fc.string({ minLength: 1, maxLength: 1_024 }),
}).pipe(
  $I.annoteSchema("ShaclResultMessage", {
    description: "Non-empty human-readable diagnostic emitted for a normalized SHACL validation result.",
  })
);

/**
 * Standard SHACL severity local names used to categorize validation results.
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
 * console.log(ShaclViolationSeverity.is.Warning("Warning")) // true
 * console.log(ShaclViolationSeverity.is.Warning("Violation")) // false
 * ```
 *
 * @see {@link https://www.w3.org/TR/shacl/#severity | SHACL severity}
 * @category schemas
 * @since 0.0.0
 */
export const ShaclViolationSeverity = LiteralKit(["Violation", "Warning", "Info"])
  .annotate({
    toArbitrary: () => (fc) => fc.constantFrom("Violation", "Warning", "Info"),
  })
  .annotate(
    $I.annote("ShaclViolationSeverity", {
      description: "Standard SHACL severity local names used to categorize normalized validation results.",
    })
  );

/**
 * Runtime value accepted by {@link ShaclViolationSeverity}.
 *
 * @example
 * ```ts
 * import type { ShaclViolationSeverity } from "@effect-ontology/Schema/Shacl.ts"
 *
 * const severity: ShaclViolationSeverity = "Info"
 * console.log(severity) // "Info"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ShaclViolationSeverity = typeof ShaclViolationSeverity.Type;

const makeShaclViolationMember = <const TSeverity extends ShaclViolationSeverity>(
  severityLiteral: S.Literal<TSeverity>
) =>
  S.Struct({
    severity: S.tag(severityLiteral.literal).annotateKey({
      description: "Standard SHACL severity assigned by the source shape.",
    }),
    focusNode: ShaclResultTerm.annotateKey({
      description: "Text representation of the RDF focus node that produced the validation result.",
    }),
    path: S.OptionFromOptionalKey(ShaclResultTerm).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional text representation of the SHACL result path.",
      })
    ),
    value: S.OptionFromOptionalKey(ShaclResultTerm).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional text representation of the RDF value node that failed validation.",
      })
    ),
    message: ShaclResultMessage.annotateKey({
      description: "Normalized human-readable explanation of the validation result.",
    }),
    sourceShape: S.OptionFromOptionalKey(ShaclResultTerm).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional text representation of the SHACL shape that produced the result.",
      })
    ),
    sourceConstraintComponent: ShaclResultTerm.annotateKey({
      description: "Text representation of the mandatory SHACL constraint component that produced the result.",
    }),
  });

const ShaclViolationDefinition = ShaclViolationSeverity.mapMembers(
  Tuple.evolve([makeShaclViolationMember, makeShaclViolationMember, makeShaclViolationMember])
).pipe(S.toTaggedUnion("severity"));

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
 * import { ShaclViolation } from "@effect-ontology/Schema/Shacl.ts"
 *
 * const result = ShaclViolation.cases.Violation.make({
 *   focusNode: "https://example.com/alice",
 *   message: "Expected at least one value.",
 *   sourceConstraintComponent: "http://www.w3.org/ns/shacl#MinCountConstraintComponent"
 * })
 *
 * console.log(result.severity) // "Violation"
 * ```
 *
 * @invariant The discriminator is one of the standard SHACL severities, and
 * every result identifies a non-empty focus node, message, and source
 * constraint component.
 * @see {@link https://www.w3.org/TR/shacl/#validation-result | SHACL validation result}
 * @category models
 * @since 0.0.0
 */
export const ShaclViolation = ShaclViolationDefinition.pipe(
  $I.annoteSchema("ShaclViolation", {
    description:
      "Normalized SHACL validation result with mandatory focus node, severity, diagnostic, and source constraint component.",
    toArbitrary: () => () => S.toArbitrary(ShaclViolationDefinition),
  })
);

/**
 * Runtime value decoded by {@link ShaclViolation}.
 *
 * @example
 * ```ts
 * import {
 *   ShaclViolation,
 *   type ShaclViolation as ShaclViolationValue
 * } from "@effect-ontology/Schema/Shacl.ts"
 *
 * const result: ShaclViolationValue = ShaclViolation.cases.Info.make({
 *   focusNode: "https://example.com/alice",
 *   message: "The preferred label is missing.",
 *   sourceConstraintComponent: "http://www.w3.org/ns/shacl#MinCountConstraintComponent"
 * })
 *
 * console.log(result.severity) // "Info"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ShaclViolation = typeof ShaclViolation.Type;

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
    conforms: S.Boolean.annotateKey({
      description: "Whether validation produced no validation results.",
    }),
    violations: S.Array(ShaclViolation).pipe(
      SchemaUtils.withEmptyArrayDefaults<ShaclViolation>(),
      S.annotateKey({
        description: "All normalized validation results, including Warning- and Info-level results.",
      })
    ),
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
    description: "Internal field model for a normalized SHACL validation report.",
  })
) {}

const makeShaclValidationReportArbitrary = (fc: typeof FastCheck) =>
  fc
    .record({
      violations: fc.array(S.toArbitrary(ShaclViolation), { maxLength: 32 }),
      validatedAt: S.toArbitrary(S.DateTimeUtcFromString),
      dataGraphTripleCount: S.toArbitrary(NonNegativeInt),
      shapesGraphTripleCount: S.toArbitrary(NonNegativeInt),
      durationMs: S.toArbitrary(ValidationDurationMs),
    })
    .map(({ violations, validatedAt, dataGraphTripleCount, shapesGraphTripleCount, durationMs }) =>
      ShaclValidationReportFields.make({
        conforms: A.isReadonlyArrayEmpty(violations),
        violations,
        validatedAt,
        dataGraphTripleCount,
        shapesGraphTripleCount,
        durationMs,
      })
    );

const ShaclReportConformanceCheck = S.makeFilter(
  (report: ShaclValidationReportFields) =>
    Bool.Equivalence(report.conforms, A.isReadonlyArrayEmpty(report.violations))
      ? undefined
      : {
          path: ["conforms"],
          issue: "conforms must be true exactly when the validation result collection is empty.",
        },
  {
    identifier: $I`ShaclReportConformanceCheck`,
    title: "SHACL Report Conformance",
    description: "A SHACL report whose conforms flag is true if and only if it contains no validation results.",
    message: "SHACL report conformance must agree with the validation result collection.",
    arbitrary: {
      candidate: {
        make: makeShaclValidationReportArbitrary,
      },
    },
  }
);

const ShaclValidationReportDefinition = ShaclValidationReportFields.check(ShaclReportConformanceCheck);

/**
 * Complete normalized report for one SHACL validation run.
 *
 * @remarks
 * The `violations` collection retains the source service's historical name but
 * contains all result severities. Per SHACL, `conforms` is true only when that
 * collection is empty.
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
 *   conforms: true,
 *   validatedAt: "2026-07-25T12:00:00.000Z",
 *   dataGraphTripleCount: 42,
 *   shapesGraphTripleCount: 8,
 *   durationMs: 12.5
 * })
 *
 * console.log(report._tag) // "Success"
 * ```
 *
 * @invariant `conforms` is true if and only if `violations` is empty, counts
 * are non-negative integers, and the elapsed duration is finite.
 * @see {@link https://www.w3.org/TR/shacl/#validation-report | SHACL validation report}
 * @category validation
 * @since 0.0.0
 */
export const ShaclValidationReport = ShaclValidationReportDefinition.annotate({
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
 * const summary: Pick<ShaclValidationReport, "conforms"> = { conforms: true }
 * console.log(summary.conforms) // true
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
          Bool.and(policy.failOnViolation, A.some(results, ShaclViolation.guards.Violation)),
          Bool.and(policy.failOnWarning, A.some(results, ShaclViolation.guards.Warning))
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
