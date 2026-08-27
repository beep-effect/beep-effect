/**
 * Service: CorrectorAgent
 *
 * **Details**
 *
 * Multi-agent component that corrects SHACL violations via LLM-powered
 * value generation and graph modification. Part of the validation-correction
 * refinement loop.
 *
 * ## Correction Strategies
 * 1. **Missing property** (sh:minCount): Generate plausible value via LLM
 * 2. **Invalid datatype**: Coerce value to correct type
 * 3. **Cardinality excess** (sh:maxCount): Remove excess values
 * 4. **Domain/range mismatch**: Re-classify entity or update relation
 * 5. **Pattern violation**: Reformat value to match pattern
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { NonNegNum } from "@beep/schema/Number";
import { ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation";
import type { Config } from "effect";
import { Clock, Context, Effect, Layer, Match } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LanguageModel } from "effect/unstable/ai";
import { OptionalErrorCause } from "../../Domain/Error/Base.ts";
import type { Agent } from "../../Domain/Model/Agent.ts";
import { AgentId, AgentMetadata, ValidationResult } from "../../Domain/Model/Agent.ts";
import type { OntologyContext } from "../../Domain/Model/Ontology.ts";
import { extractLocalNameFromIri as extractLocalName } from "../../Utils/Iri.ts";
import { ConfigService, ConfigServiceDefault } from "../Config.ts";
import { generateObjectWithFeedback } from "../GenerateWithFeedback.ts";
import type { RdfStore } from "../Rdf.ts";
import { rdfStoreAddQuad, rdfStoreQuads, rdfStoreRemoveQuads } from "../Rdf.ts";
import type { ShaclValidationReport } from "../Shacl.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Agent/CorrectorAgent");

// =============================================================================
// Domain Models
// =============================================================================

/**
 * Correction strategies accepted from LLM output.
 *
 * **Example** (Validate a correction strategy)
 *
 * ```ts
 * import { CorrectionStrategy } from "@effect-ontology/Service/Agent/CorrectorAgent"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorrectionStrategy)("generate-value")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CorrectionStrategy = LiteralKit([
  "generate-value", // Missing required property
  "coerce-datatype", // Wrong datatype
  "remove-excess", // Too many values
  "reclassify-entity", // Wrong type/class
  "reformat-value", // Pattern mismatch
  "skip", // Cannot be corrected automatically
]).annotate(
  $I.annote("CorrectionStrategy", {
    description: "Closed set of SHACL correction strategies emitted by the corrector agent.",
  })
);

/**
 * Correction strategy based on violation type
 *
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionStrategy = typeof CorrectionStrategy.Type;

class CorrectionBase extends S.Class<CorrectionBase>($I`CorrectionBase`)(
  {
    /**
     * Focus node (entity) being corrected
     */
    focusNode: S.String.annotateKey({
      description: "Focus node (entity) being corrected",
    }),

    /**
     * Explanation of the correction
     */
    explanation: S.String.annotateKey({
      description: "Explanation of the correction",
    }),

    /**
     * Confidence in the correction (0-1)
     */
    confidence: Confidence.annotateKey({
      description: "Confidence in the correction (0-1)",
    }),
  },
  $I.annote("CorrectionBase", {
    description: "Correction strategy based on violation type",
  })
) {}

const CorrectionValue = S.Union([S.String, S.Finite, S.Boolean]);

const ValueCorrectionFields = {
  path: S.String.annotateKey({
    description: "Property path being corrected",
  }),
  originalValue: CorrectionValue.pipe(
    S.OptionFromOptionalKey,
    SchemaUtils.withNoneDefault,
    S.annotateKey({
      description: "Original value, when the violation reported one",
    })
  ),
  newValue: CorrectionValue.annotateKey({
    description: "Replacement value to write",
  }),
};

class GenerateValueStrategy extends CorrectionBase.extend<GenerateValueStrategy>($I`GenerateValueStrategy`)(
  {
    strategy: S.tag(CorrectionStrategy.Enum["generate-value"]),
    ...ValueCorrectionFields,
  },
  $I.annote("GenerateValueStrategy", {
    description: "Generate a new value for a property",
  })
) {}

class CoerceDatatypeStrategy extends CorrectionBase.extend<CoerceDatatypeStrategy>($I`CoerceDatatypeStrategy`)(
  {
    strategy: S.tag(CorrectionStrategy.Enum["coerce-datatype"]),
    ...ValueCorrectionFields,
  },
  $I.annote("CoerceDatatypeStrategy", {
    description: "Coerce a value to a different datatype",
  })
) {}

class RemoveExcessStrategy extends CorrectionBase.extend<RemoveExcessStrategy>($I`RemoveExcessStrategy`)(
  {
    strategy: S.tag(CorrectionStrategy.Enum["remove-excess"]),
    path: S.String.annotateKey({
      description: "Property path whose excess values require manual review",
    }),
  },
  $I.annote("RemoveExcessStrategy", {
    description: "Remove excess values from a property",
  })
) {}

class ReclassifyEntityStrategy extends CorrectionBase.extend<ReclassifyEntityStrategy>($I`ReclassifyEntityStrategy`)(
  {
    strategy: S.tag(CorrectionStrategy.Enum["reclassify-entity"]),
    newType: S.String.annotateKey({
      description: "Replacement RDF type IRI",
    }),
  },
  $I.annote("ReclassifyEntityStrategy", {
    description: "Reclassify an entity",
  })
) {}

class ReformatValueStrategy extends CorrectionBase.extend<ReformatValueStrategy>($I`ReformatValueStrategy`)(
  {
    strategy: S.tag(CorrectionStrategy.Enum["reformat-value"]),
    ...ValueCorrectionFields,
  },
  $I.annote("ReformatValueStrategy", {
    description: "Reformat a value",
  })
) {}

type ValueCorrection = GenerateValueStrategy | CoerceDatatypeStrategy | ReformatValueStrategy;

class SkipStrategy extends CorrectionBase.extend<SkipStrategy>($I`SkipStrategy`)(
  {
    strategy: S.tag(CorrectionStrategy.Enum.skip),
  },
  $I.annote("SkipStrategy", {
    description: "Skip a correction",
  })
) {}

/**
 * Generated correction action.
 *
 * **Example** (Construct a skipped correction)
 *
 * ```ts
 * import { Correction } from "@effect-ontology/Service/Agent/CorrectorAgent"
 * import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan"
 *
 * const correction = Correction.cases.skip.make({
 *   focusNode: "https://example.com/entity/1",
 *   explanation: "Manual review is required.",
 *   confidence: Confidence.make(1),
 * })
 *
 * console.log(correction.strategy) // "skip"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Correction = S.Union([
  GenerateValueStrategy,
  CoerceDatatypeStrategy,
  RemoveExcessStrategy,
  ReclassifyEntityStrategy,
  ReformatValueStrategy,
  SkipStrategy,
]).pipe(
  S.toTaggedUnion("strategy"),
  $I.annoteSchema("Correction", {
    description: "A schema-backed correction whose required fields are determined by its strategy.",
  })
);

/**
 * Decoded correction value produced by {@link Correction}.
 *
 * @see {@link Correction} for the runtime tagged-union schema and constructors.
 * @category models
 * @since 0.0.0
 */
export type Correction = typeof Correction.Type;

const meetsConfidenceThreshold = (correction: CorrectionBase): boolean => correction.confidence >= 0.5;

/**
 * Determines whether a generated correction clears the automatic-application threshold.
 *
 * **Example** (Reject a skipped correction)
 *
 * ```ts
 * import { Correction, correctionShouldApply } from "@effect-ontology/Service/Agent/CorrectorAgent"
 * import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan"
 *
 * const correction = Correction.cases.skip.make({
 *   focusNode: "https://example.com/entity/1",
 *   explanation: "Manual review is required.",
 *   confidence: Confidence.make(1),
 * })
 *
 * console.log(correctionShouldApply(correction)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const correctionShouldApply: (correction: Correction) => boolean = Correction.match({
  "generate-value": meetsConfidenceThreshold,
  "coerce-datatype": meetsConfidenceThreshold,
  "remove-excess": meetsConfidenceThreshold,
  "reclassify-entity": meetsConfidenceThreshold,
  "reformat-value": meetsConfidenceThreshold,
  skip: () => false,
});

// =============================================================================
// Error Types
// =============================================================================

/**
 * Failure to generate a correction for a SHACL violation.
 *
 * **Example** (Construct a correction error)
 *
 * ```ts
 * import { makeNamedNode } from "@beep/rdf/Rdf"
 * import { ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation"
 * import { CorrectionError } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * const error = CorrectionError.make({
 *   message: "Could not generate a founder value",
 *   violation: ShaclValidationViolation.make({
 *     focusNode: "https://example.org/Ada",
 *     path: makeNamedNode("https://example.org/founded"),
 *     message: "Expected at least 1 value.",
 *     severity: "violation"
 *   }),
 *   strategy: "generate-value"
 * })
 * console.log(error._tag) // "CorrectionError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CorrectionError extends S.TaggedError<CorrectionError>($I`CorrectionError`)(
  "CorrectionError",
  {
    message: S.NonEmptyString,
    violation: ShaclValidationViolation,
    strategy: CorrectionStrategy,
    cause: OptionalErrorCause,
  },
  $I.annote("CorrectionError", {
    description: "Failure to generate a correction for a SHACL violation.",
  })
) {}

/**
 * Failure to apply a generated correction to an RDF graph.
 *
 * **Example** (Construct an application error)
 *
 * ```ts
 * import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan"
 * import { Correction, CorrectionApplicationError } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * const error = CorrectionApplicationError.make({
 *   message: "Could not write the generated triple",
 *   correction: Correction.cases.skip.make({
 *     focusNode: "https://example.org/Ada",
 *     explanation: "Manual review is required.",
 *     confidence: Confidence.make(1)
 *   })
 * })
 * console.log(error._tag) // "CorrectionApplicationError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CorrectionApplicationError extends S.TaggedError<CorrectionApplicationError>(
  $I`CorrectionApplicationError`
)(
  "CorrectionApplicationError",
  {
    message: S.NonEmptyString,
    correction: Correction,
    cause: OptionalErrorCause,
  },
  $I.annote("CorrectionApplicationError", {
    description: "Failure to apply a generated correction to an RDF graph.",
  })
) {}

/**
 * Result of correcting a single SHACL violation.
 *
 * **Example** (Record a skipped correction)
 *
 * ```ts
 * import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan"
 * import { makeNamedNode } from "@beep/rdf/Rdf"
 * import { NonNegNum } from "@beep/schema/Number"
 * import { ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation"
 * import { Correction, CorrectionResult } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * const result = CorrectionResult.make({
 *   violation: ShaclValidationViolation.make({
 *     focusNode: "https://example.org/Ada",
 *     path: makeNamedNode("https://example.org/founded"),
 *     message: "Expected at least 1 value.",
 *     severity: "violation"
 *   }),
 *   correction: Correction.cases.skip.make({
 *     focusNode: "https://example.org/Ada",
 *     explanation: "Manual review is required.",
 *     confidence: Confidence.make(1)
 *   }),
 *   applied: false,
 *   durationMs: NonNegNum.make(12)
 * })
 * console.log(result.applied) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CorrectionResult extends S.Class<CorrectionResult>($I`CorrectionResult`)({
  /**
   * The original violation
   */
  violation: ShaclValidationViolation,

  /**
   * The correction that was generated
   */
  correction: Correction,

  /**
   * Whether the correction was applied
   */
  applied: S.Boolean,

  /**
   * Time taken in milliseconds
   */
  durationMs: NonNegNum,
  },
  $I.annote("CorrectionResult", {
    description: "Single-violation correction, whether it was applied, and elapsed milliseconds.",
  })
) {}

/**
 * Aggregate outcome of correcting every violation in a SHACL report.
 *
 * **Example** (Record a fully skipped batch)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { NonNegNum } from "@beep/schema/Number"
 * import { BatchCorrectionResult } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * const batch = BatchCorrectionResult.make({
 *   results: [],
 *   totalViolations: NonNegativeInt.make(1),
 *   correctedCount: NonNegativeInt.make(0),
 *   skippedCount: NonNegativeInt.make(1),
 *   durationMs: NonNegNum.make(12)
 * })
 * console.log(batch.allCorrected) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class BatchCorrectionResult extends S.Class<BatchCorrectionResult>($I`BatchCorrectionResult`)({
  /**
   * Individual correction results
   */
  results: S.Array(CorrectionResult),

  /**
   * Total violations processed
   */
  totalViolations: NonNegativeInt,

  /**
   * Number of corrections applied
   */
  correctedCount: NonNegativeInt,

  /**
   * Number of violations skipped
   */
  skippedCount: NonNegativeInt,

  /**
   * Total duration in milliseconds
   */
  durationMs: NonNegNum,
  },
  $I.annote("BatchCorrectionResult", {
    description: "Per-violation results plus corrected, skipped, and elapsed counters.",
  })
) {
  /**
   * Success rate (corrected / total)
   *
   * **Example** (Read the success rate)
   *
   * ```ts
   * import { NonNegativeInt } from "@beep/schema"
   * import { NonNegNum } from "@beep/schema/Number"
   * import { BatchCorrectionResult } from "@effect-ontology/Service/Agent/CorrectorAgent"
   *
   * const batch = BatchCorrectionResult.make({
   *   results: [],
   *   totalViolations: NonNegativeInt.make(2),
   *   correctedCount: NonNegativeInt.make(1),
   *   skippedCount: NonNegativeInt.make(1),
   *   durationMs: NonNegNum.make(40)
   * })
   * console.log(batch.successRate) // 0.5
   * ```
   */
  get successRate(): number {
    return this.totalViolations > 0 ? this.correctedCount / this.totalViolations : 1;
  }

  /**
   * Whether all violations were corrected
   *
   * **Example** (Check whether every violation was corrected)
   *
   * ```ts
   * import { NonNegativeInt } from "@beep/schema"
   * import { NonNegNum } from "@beep/schema/Number"
   * import { BatchCorrectionResult } from "@effect-ontology/Service/Agent/CorrectorAgent"
   *
   * const batch = BatchCorrectionResult.make({
   *   results: [],
   *   totalViolations: NonNegativeInt.make(1),
   *   correctedCount: NonNegativeInt.make(0),
   *   skippedCount: NonNegativeInt.make(1),
   *   durationMs: NonNegNum.make(12)
   * })
   * console.log(batch.allCorrected) // false
   * ```
   */
  get allCorrected(): boolean {
    return this.correctedCount === this.totalViolations;
  }

  static readonly decodeUnknownOption = S.decodeUnknownOption(BatchCorrectionResult);
}

/**
 * Validation report, RDF store, and ontology context supplied to the corrector.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface CorrectorInput {
  readonly report: ShaclValidationReport;
  readonly store: RdfStore;
  readonly ontologyContext: OntologyContext;
}

interface CorrectOperation {
  (
    violation: ShaclValidationViolation,
    store: RdfStore,
    ontologyContext: OntologyContext
  ): Effect.Effect<CorrectionResult, CorrectionError | CorrectionApplicationError>;
  (
    store: RdfStore,
    ontologyContext: OntologyContext
  ): (
    violation: ShaclValidationViolation
  ) => Effect.Effect<CorrectionResult, CorrectionError | CorrectionApplicationError>;
}

interface CorrectorAgentShape {
  readonly classifyViolation: (violation: ShaclValidationViolation) => CorrectionStrategy;
  readonly generateCorrection: (
    violation: ShaclValidationViolation,
    store: RdfStore,
    ontologyContext: OntologyContext
  ) => Effect.Effect<Correction, CorrectionError>;
  readonly applyCorrection: (
    correction: Correction,
    store: RdfStore
  ) => Effect.Effect<void, CorrectionApplicationError>;
  readonly correct: CorrectOperation;
  readonly correctAll: (
    report: ShaclValidationReport,
    store: RdfStore,
    ontologyContext: OntologyContext,
    options?: { readonly concurrency?: number }
  ) => Effect.Effect<BatchCorrectionResult, CorrectionError | CorrectionApplicationError>;
  readonly metadata: AgentMetadata;
  readonly asAgent: () => Agent<CorrectorInput, BatchCorrectionResult, CorrectionError | CorrectionApplicationError>;
}

// =============================================================================
// LLM Schemas
// =============================================================================

/**
 * Schema for LLM correction response
 *
 * @internal
 */
const CorrectionResponseFields = {
  explanation: S.String.annotate({
    title: "Explanation",
    description: "Why this correction is appropriate",
  }),
  confidence: Confidence.annotate({
    title: "Confidence",
    description: "Confidence in this correction (0-1)",
  }),
};

const CorrectionResponse = S.Union([
  S.Struct({
    strategy: S.tag(CorrectionStrategy.Enum["generate-value"]),
    newValue: CorrectionValue.annotate({
      title: "New Value",
      description: "The generated value to set",
    }),
    ...CorrectionResponseFields,
  }),
  S.Struct({
    strategy: S.tag(CorrectionStrategy.Enum["coerce-datatype"]),
    newValue: CorrectionValue.annotate({
      title: "New Value",
      description: "The value coerced to the required datatype",
    }),
    ...CorrectionResponseFields,
  }),
  S.Struct({
    strategy: S.tag(CorrectionStrategy.Enum["remove-excess"]),
    ...CorrectionResponseFields,
  }),
  S.Struct({
    strategy: S.tag(CorrectionStrategy.Enum["reclassify-entity"]),
    newType: S.String.annotate({
      title: "New Type",
      description: "The replacement RDF type IRI",
    }),
    ...CorrectionResponseFields,
  }),
  S.Struct({
    strategy: S.tag(CorrectionStrategy.Enum["reformat-value"]),
    newValue: CorrectionValue.annotate({
      title: "New Value",
      description: "The value reformatted to satisfy the required pattern",
    }),
    ...CorrectionResponseFields,
  }),
  S.Struct({
    strategy: S.tag(CorrectionStrategy.Enum.skip),
    ...CorrectionResponseFields,
  }),
]).pipe(S.toTaggedUnion("strategy"));

type CorrectionResponse = typeof CorrectionResponse.Type;

const correctionFromResponse: (response: CorrectionResponse) => (violation: ShaclValidationViolation) => Correction =
  CorrectionResponse.match({
    "generate-value": (response) => (violation: ShaclValidationViolation) =>
      Correction.cases["generate-value"].make({
        focusNode: violation.focusNode,
        path: violation.path.value,
        originalValue: O.map(violation.value, (value) => value.value),
        newValue: response.newValue,
        explanation: response.explanation,
        confidence: response.confidence,
      }),
    "coerce-datatype": (response) => (violation: ShaclValidationViolation) =>
      Correction.cases["coerce-datatype"].make({
        focusNode: violation.focusNode,
        path: violation.path.value,
        originalValue: O.map(violation.value, (value) => value.value),
        newValue: response.newValue,
        explanation: response.explanation,
        confidence: response.confidence,
      }),
    "remove-excess": (response) => (violation: ShaclValidationViolation) =>
      Correction.cases["remove-excess"].make({
        focusNode: violation.focusNode,
        path: violation.path.value,
        explanation: response.explanation,
        confidence: response.confidence,
      }),
    "reclassify-entity": (response) => (violation: ShaclValidationViolation) =>
      Correction.cases["reclassify-entity"].make({
        focusNode: violation.focusNode,
        newType: response.newType,
        explanation: response.explanation,
        confidence: response.confidence,
      }),
    "reformat-value": (response) => (violation: ShaclValidationViolation) =>
      Correction.cases["reformat-value"].make({
        focusNode: violation.focusNode,
        path: violation.path.value,
        originalValue: O.map(violation.value, (value) => value.value),
        newValue: response.newValue,
        explanation: response.explanation,
        confidence: response.confidence,
      }),
    skip: (response) => (violation: ShaclValidationViolation) =>
      Correction.cases.skip.make({
        focusNode: violation.focusNode,
        explanation: response.explanation,
        confidence: response.confidence,
      }),
  });

// =============================================================================
// Service Definition
// =============================================================================

/**
 * CorrectorAgent - LLM-powered SHACL violation correction
 *
 * **Details**
 *
 * Uses structured LLM output to generate corrections for SHACL violations.
 * Corrections can add missing values, fix datatypes, remove excess values,
 * or reclassify entities.
 *
 * **Example** (Classify a minCount violation)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { makeNamedNode } from "@beep/rdf/Rdf"
 * import { ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation"
 * import { CorrectorAgent } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * const violation = ShaclValidationViolation.make({
 *   focusNode: "https://example.org/Ada",
 *   path: makeNamedNode("https://example.org/founded"),
 *   message: "Less than minCount 1",
 *   severity: "violation"
 * })
 *
 * const program = Effect.gen(function* () {
 *   const corrector = yield* CorrectorAgent
 *   return corrector.classifyViolation(violation)
 * }).pipe(Effect.provide(CorrectorAgent.Default))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class CorrectorAgent extends Context.Service<CorrectorAgent, CorrectorAgentShape>()($I`CorrectorAgent`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const llm = yield* LanguageModel.LanguageModel;
    const classifyViolation = (violation: ShaclValidationViolation): CorrectionStrategy => {
      const message = Str.toLowerCase(violation.message);
      if (
        Str.includes("mincount")(message) ||
        Str.includes("min count")(message) ||
        Str.includes("less than minimum")(message)
      ) {
        return "generate-value";
      }
      if (
        Str.includes("maxcount")(message) ||
        Str.includes("max count")(message) ||
        Str.includes("more than maximum")(message)
      ) {
        return "remove-excess";
      }
      if (Str.includes("datatype")(message) || Str.includes("data type")(message)) {
        return "coerce-datatype";
      }
      if (Str.includes("pattern")(message) || Str.includes("does not match")(message)) {
        return "reformat-value";
      }
      if (Str.includes("class")(message) || (Str.includes("type")(message) && !Str.includes("datatype")(message))) {
        return "reclassify-entity";
      }
      return "skip";
    };
    const strategyGuidanceFor = Match.type<CorrectionStrategy>().pipe(
      Match.when("generate-value", () => [
        "Generate a plausible value for the missing required property.",
        "The value should be consistent with:",
        "- The entity's existing properties",
        "- The property's expected datatype",
        "- Common patterns in the ontology",
        "",
      ]),
      Match.when("coerce-datatype", () => [
        "Convert the current value to the correct datatype.",
        "If conversion is not possible, generate a valid default value.",
        "",
      ]),
      Match.when("remove-excess", () => [
        "This violation requires removing excess values.",
        "Set strategy to 'skip' as this requires domain knowledge to decide which values to keep.",
        "",
      ]),
      Match.when("reclassify-entity", () => [
        "Determine the correct type/class for this entity based on its properties.",
        "Return the new type IRI in the 'newType' field.",
        "",
      ]),
      Match.when("reformat-value", () => ["Reformat the value to match the required pattern.", ""]),
      Match.when("skip", () => [
        "This violation cannot be automatically corrected.",
        "Set strategy to 'skip' with an explanation.",
        "",
      ]),
      Match.exhaustive
    );
    const buildCorrectionPrompt = (
      violation: ShaclValidationViolation,
      strategy: CorrectionStrategy,
      entityContext: string,
      ontologyContext: OntologyContext
    ): string => {
      const parts: Array<string> = [
        "You are an expert at correcting SHACL validation errors in RDF knowledge graphs.",
        "",
        "## Violation Details",
        `- **Focus Node**: ${violation.focusNode}`,
        `- **Property Path**: ${violation.path.value}`,
        O.isSome(violation.value) ? `- **Current Value**: ${violation.value.value.value}` : "",
        `- **Message**: ${violation.message}`,
        `- **Severity**: ${violation.severity}`,
        "",
        `## Correction Strategy: ${strategy}`,
        "",
      ];
      const strategyGuidance = strategyGuidanceFor(strategy);
      parts.push(...strategyGuidance);
      if (P.isTruthy(entityContext)) {
        parts.push("## Entity Context (Current Properties)", "```turtle", entityContext, "```", "");
      }
      const relevantClasses = ontologyContext.classes
        .slice(0, 5)
        .map((c) => `- ${c.label || extractLocalName(c.id)}: ${c.comment || "No description"}`);
      const relevantProps = ontologyContext.properties
        .slice(0, 10)
        .map(
          (p) => `- ${p.label || extractLocalName(p.id)}: ${p.rangeType} (${p.range.map(extractLocalName).join(", ")})`
        );
      parts.push("## Ontology Context", "### Classes");
      for (const cls of relevantClasses) {
        parts.push(cls);
      }
      parts.push("", "### Properties");
      for (const prop of relevantProps) {
        parts.push(prop);
      }
      parts.push(
        "",
        "## Response Format",
        "Return a JSON object with:",
        "- strategy: The correction strategy to apply",
        "- newValue: The corrected value (if applicable)",
        "- newType: The new type IRI (if reclassifying)",
        "- explanation: Why this correction is appropriate",
        "- confidence: Your confidence in this correction (0-1)"
      );
      return parts.filter((p) => p !== "").join("\n");
    };
    const getEntityContext = Effect.fn("CorrectorAgent.getEntityContext")(function* (
      store: RdfStore,
      focusNode: string
    ) {
      const quads = yield* rdfStoreQuads(store, { subject: makeNamedNode(focusNode) });
      if (A.isReadonlyArrayEmpty(quads)) return "";
      const lines = A.map(quads, (q) => {
        const obj = q.object.termType === "Literal" ? `"${q.object.value}"` : `<${q.object.value}>`;
        return `<${q.subject.value}> <${q.predicate.value}> ${obj} .`;
      });
      return A.join(lines, "\n");
    });
    const generateCorrection = Effect.fn("CorrectorAgent.generateCorrection")(function* (
      violation: ShaclValidationViolation,
      store: RdfStore,
      ontologyContext: OntologyContext
    ): Effect.fn.Return<Correction, CorrectionError> {
      const strategy = classifyViolation(violation);
      yield* Effect.logInfo("CorrectorAgent.generateCorrection", {
        focusNode: violation.focusNode,
        path: O.some(violation.path.value),
        strategy,
      });
      const entityContext = yield* getEntityContext(store, violation.focusNode).pipe(
        Effect.mapError((error) =>
          CorrectionError.make({
            message: `Failed to read correction context: ${error.message}`,
            violation,
            strategy,
            cause: O.some(error),
          })
        )
      );
      const prompt = buildCorrectionPrompt(violation, strategy, entityContext, ontologyContext);
      const response = yield* generateObjectWithFeedback({
        prompt,
        schema: CorrectionResponse,
        objectName: "CorrectionResponse",
        serviceName: "CorrectorAgent",
        retryPolicy: config.llm.retryPolicy,
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, llm),
        Effect.mapError((error) =>
          CorrectionError.make({
            message: `Failed to generate correction: ${error._tag}`,
            violation,
            strategy,
            cause: O.some(error),
          })
        )
      );
      const result = response.value;
      yield* Effect.logInfo("CorrectorAgent.generateCorrection complete", {
        strategy: result.strategy,
        confidence: result.confidence,
      });
      return correctionFromResponse(result)(violation);
    });
    const applyValueCorrection = Effect.fn("CorrectorAgent.applyValueCorrection")(function* (
      correction: ValueCorrection,
      store: RdfStore
    ) {
      const focusNode = makeNamedNode(correction.focusNode);
      const predicate = makeNamedNode(correction.path);
      if (O.isSome(correction.originalValue)) {
        const oldQuads = yield* rdfStoreQuads(store, {
          subject: focusNode,
          predicate,
        }).pipe(
          Effect.mapError((error) =>
            CorrectionApplicationError.make({
              message: `Failed to read values for correction: ${error.message}`,
              correction,
              cause: O.some(error),
            })
          )
        );
        rdfStoreRemoveQuads(store, oldQuads);
      }
      const newObject = makeLiteral(`${correction.newValue}`, XSD_STRING.value);
      rdfStoreAddQuad(store, makeQuad(focusNode, predicate, newObject));
      yield* Effect.logInfo("CorrectorAgent: Applied value correction", {
        focusNode: correction.focusNode,
        path: correction.path,
        newValue: correction.newValue,
      });
    });
    const applyReclassification = Effect.fn("CorrectorAgent.applyReclassification")(function* (
      correction: ReclassifyEntityStrategy,
      store: RdfStore
    ) {
      const focusNode = makeNamedNode(correction.focusNode);
      const typePredicate = makeNamedNode(RDF_TYPE.value);
      const oldTypeQuads = yield* rdfStoreQuads(store, {
        subject: focusNode,
        predicate: typePredicate,
      }).pipe(
        Effect.mapError((error) =>
          CorrectionApplicationError.make({
            message: `Failed to read types for reclassification: ${error.message}`,
            correction,
            cause: O.some(error),
          })
        )
      );
      rdfStoreRemoveQuads(store, oldTypeQuads);
      const newTypeNode = makeNamedNode(correction.newType);
      rdfStoreAddQuad(store, makeQuad(focusNode, typePredicate, newTypeNode));
      yield* Effect.logInfo("CorrectorAgent: Applied reclassification", {
        focusNode: correction.focusNode,
        newType: correction.newType,
      });
    });
    const applyCorrectionByStrategy: (
      correction: Correction
    ) => (store: RdfStore) => Effect.Effect<void, CorrectionApplicationError> = Correction.match({
      "generate-value": (correction) => (store: RdfStore) => applyValueCorrection(correction, store),
      "coerce-datatype": (correction) => (store: RdfStore) => applyValueCorrection(correction, store),
      "remove-excess": (correction) => () =>
        Effect.logWarning("CorrectorAgent: remove-excess requires manual review", {
          focusNode: correction.focusNode,
          path: correction.path,
        }),
      "reclassify-entity": (correction) => (store: RdfStore) => applyReclassification(correction, store),
      "reformat-value": (correction) => (store: RdfStore) => applyValueCorrection(correction, store),
      skip: (correction) => () =>
        Effect.logDebug("CorrectorAgent: Skipped correction", {
          focusNode: correction.focusNode,
          reason: correction.explanation,
        }),
    });
    const applyCorrection = Effect.fn("CorrectorAgent.applyCorrection")(function* (
      correction: Correction,
      store: RdfStore
    ): Effect.fn.Return<void, CorrectionApplicationError> {
      if (!correctionShouldApply(correction)) {
        yield* Effect.logDebug("CorrectorAgent: Skipping correction", {
          focusNode: correction.focusNode,
          strategy: correction.strategy,
          confidence: correction.confidence,
        });
        return;
      }
      yield* applyCorrectionByStrategy(correction)(store);
    });
    const correct: {
      (
        violation: ShaclValidationViolation,
        store: RdfStore,
        ontologyContext: OntologyContext
      ): Effect.Effect<CorrectionResult, CorrectionError | CorrectionApplicationError>;
      (
        store: RdfStore,
        ontologyContext: OntologyContext
      ): (
        violation: ShaclValidationViolation
      ) => Effect.Effect<CorrectionResult, CorrectionError | CorrectionApplicationError>;
    } = dual(
      3,
      Effect.fn("CorrectorAgent.correct")(function* (
        violation: ShaclValidationViolation,
        store: RdfStore,
        ontologyContext: OntologyContext
      ): Effect.fn.Return<CorrectionResult, CorrectionError | CorrectionApplicationError> {
        const startTime = yield* Clock.currentTimeMillis;
        const correction = yield* generateCorrection(violation, store, ontologyContext);
        let applied = false;
        if (correctionShouldApply(correction)) {
          yield* applyCorrection(correction, store);
          applied = true;
        }
        const durationMs = (yield* Clock.currentTimeMillis) - startTime;
        return CorrectionResult.make({
          violation,
          correction,
          applied,
          durationMs,
        });
      })
    );
    const correctAll = Effect.fn("CorrectorAgent.correctAll")(function* (
      report: ShaclValidationReport,
      store: RdfStore,
      ontologyContext: OntologyContext,
      options?: {
        concurrency?: number;
      }
    ): Effect.fn.Return<BatchCorrectionResult, CorrectionError | CorrectionApplicationError> {
      const startTime = yield* Clock.currentTimeMillis;
      const concurrency = options?.concurrency ?? config.runtime.llmConcurrencyLimit;
      yield* Effect.logInfo("CorrectorAgent.correctAll starting", {
        violationCount: report.validation.violations.length,
        concurrency,
      });
      const violations = A.filter(report.validation.violations, (violation) => violation.severity === "violation");
      const results = yield* Effect.all(
        A.map(violations, (violation) =>
          correct(violation, store, ontologyContext).pipe(
            Effect.catch((error) =>
              Effect.succeed(
                CorrectionResult.make({
                  violation,
                  correction: Correction.cases.skip.make({
                    focusNode: violation.focusNode,
                    explanation: `Error: ${error.message}`,
                    confidence: Confidence.make(0),
                  }),
                  applied: false,
                  durationMs: 0,
                })
              )
            )
          )
        ),
        { concurrency }
      );
      const durationMs = (yield* Clock.currentTimeMillis) - startTime;
      const correctedCount = A.filter(results, (result) => result.applied).length;
      const skippedCount = results.length - correctedCount;
      yield* Effect.logInfo("CorrectorAgent.correctAll complete", {
        totalViolations: NonNegativeInt.make(results.length),
        correctedCount: NonNegativeInt.make(correctedCount),
        skippedCount: NonNegativeInt.make(skippedCount),
        durationMs,
      });
      return BatchCorrectionResult.make({
        results: [...results],
        totalViolations: NonNegativeInt.make(results.length),
        correctedCount: NonNegativeInt.make(correctedCount),
        skippedCount: NonNegativeInt.make(skippedCount),
        durationMs,
      });
    });
    return {
      classifyViolation,
      generateCorrection,
      applyCorrection,
      correct,
      correctAll,
      get metadata(): AgentMetadata {
        return AgentMetadata.make({
          id: AgentId.make("corrector"),
          name: "SHACL Corrector",
          description: "Corrects SHACL violations via LLM-powered value generation",
          type: "corrector",
          version: O.some("1.0.0"),
        });
      },
      asAgent(): Agent<CorrectorInput, BatchCorrectionResult, CorrectionError | CorrectionApplicationError> {
        return {
          metadata: AgentMetadata.make({
            id: AgentId.make("corrector"),
            name: "SHACL Corrector",
            description: "Corrects SHACL violations via LLM-powered value generation",
            type: "corrector",
            version: O.some("1.0.0"),
          }),
          execute: (input) => correctAll(input.report, input.store, input.ontologyContext),
          validate: O.some((input) =>
            Effect.succeed(
              input.report.validation.violations.length > 0
                ? ValidationResult.pass()
                : ValidationResult.warn(["No violations to correct"])
            )
          ),
        };
      },
    };
  }),
}) {
  static readonly Default: Layer.Layer<CorrectorAgent, Config.ConfigError, LanguageModel.LanguageModel> = Layer.effect(
    this,
    this.make
  ).pipe(
    Layer.provide([
      ConfigServiceDefault,
      // LanguageModel.LanguageModel provided by parent scope (runtime-selected provider)
    ])
  );
}

// =============================================================================
// Helpers
// =============================================================================
