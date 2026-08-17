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
 * **Example** (Inspect the correction layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { CorrectorAgent } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * console.log(Layer.isLayer(CorrectorAgent.Default)) // true
 * ```
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
import { NonNegNum } from "@beep/schema/Number";
import { ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation";
import { Clock, Context, Effect, Layer, Match } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LanguageModel } from "effect/unstable/ai";
import { OptionalErrorCause } from "../../Domain/Error/Base.ts";
import type { Agent } from "../../Domain/Model/Agent.ts";
import { AgentId, AgentMetadata, ValidationResult } from "../../Domain/Model/Agent.ts";
import type { OntologyContext } from "../../Domain/Model/Ontology.ts";
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
 * Correction strategy based on violation type
 *
 *
 * **Example** (Use the CorrectionStrategy contract)
 *
 * ```ts
 * import type { CorrectionStrategy } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * const acceptsCorrectionStrategy = (_value: CorrectionStrategy): void => undefined
 *
 * console.log(acceptsCorrectionStrategy)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CorrectionStrategy =
  | "generate-value" // Missing required property
  | "coerce-datatype" // Wrong datatype
  | "remove-excess" // Too many values
  | "reclassify-entity" // Wrong type/class
  | "reformat-value" // Pattern mismatch
  | "skip"; // Cannot be corrected automatically

/**
 * CorrectionStrategySchema for LLM output
 *
 * **Example** (Validate correction strategy schema)
 *
 * ```ts
 * import { CorrectionStrategySchema } from "@effect-ontology/Service/Agent/CorrectorAgent"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CorrectionStrategySchema)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CorrectionStrategySchema = S.Literals([
  "generate-value",
  "coerce-datatype",
  "remove-excess",
  "reclassify-entity",
  "reformat-value",
  "skip",
]);

/**
 * Generated correction action
 *
 * **Example** (Inspect correction)
 *
 * ```ts
 * import { Correction } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * console.log(Correction)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Correction extends S.Class<Correction>("Correction")({
  /**
   * Strategy used for this correction
   */
  strategy: CorrectionStrategySchema,

  /**
   * Focus node (entity) being corrected
   */
  focusNode: S.String,

  /**
   * Property path being corrected (if applicable)
   */
  path: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Original value (if any)
   */
  originalValue: S.Union([S.String, S.Finite, S.Boolean]).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * New value to set
   */
  newValue: S.Union([S.String, S.Finite, S.Boolean]).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * New type IRI (for reclassification)
   */
  newType: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Explanation of the correction
   */
  explanation: S.String,

  /**
   * Confidence in the correction (0-1)
   */
  confidence: Confidence,
}) {
  /**
   * Whether this correction should be applied
   *
   * **Example** (Inspect correction.should apply)
   *
   * ```ts
   * import { Correction } from "@effect-ontology/Service/Agent/CorrectorAgent"
   *
   * console.log(Correction)
   * ```
   *
   * @returns Result produced by this operation.
   */
  get shouldApply(): boolean {
    return this.strategy !== "skip" && this.confidence >= 0.5;
  }
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error: Failed to generate correction
 *
 * **Example** (Inspect correction error)
 *
 * ```ts
 * import { CorrectionError } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * console.log(CorrectionError)
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
    strategy: CorrectionStrategySchema,
    cause: OptionalErrorCause,
  },
  $I.annote("CorrectionError", {
    description: "Failure to generate a correction for a SHACL violation.",
  })
) {}

/**
 * Error: Failed to apply correction to graph
 *
 * **Example** (Inspect correction application error)
 *
 * ```ts
 * import { CorrectionApplicationError } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * console.log(CorrectionApplicationError)
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
 * Result of correcting a single violation
 *
 * **Example** (Inspect correction result)
 *
 * ```ts
 * import { CorrectionResult } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * console.log(CorrectionResult)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CorrectionResult extends S.Class<CorrectionResult>("CorrectionResult")({
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
}) {}

/**
 * Result of correcting all violations in a report
 *
 * **Example** (Inspect batch correction result)
 *
 * ```ts
 * import { BatchCorrectionResult } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * console.log(BatchCorrectionResult)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class BatchCorrectionResult extends S.Class<BatchCorrectionResult>("BatchCorrectionResult")({
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
}) {
  /**
   * Success rate (corrected / total)
   *
   * **Example** (Inspect batch correction result.success rate)
   *
   * ```ts
   * import { BatchCorrectionResult } from "@effect-ontology/Service/Agent/CorrectorAgent"
   *
   * console.log(BatchCorrectionResult)
   * ```
   *
   * @returns Result produced by this operation.
   */
  get successRate(): number {
    return this.totalViolations > 0 ? this.correctedCount / this.totalViolations : 1;
  }

  /**
   * Whether all violations were corrected
   *
   * **Example** (Inspect batch correction result.all corrected)
   *
   * ```ts
   * import { BatchCorrectionResult } from "@effect-ontology/Service/Agent/CorrectorAgent"
   *
   * console.log(BatchCorrectionResult)
   * ```
   *
   * @returns Result produced by this operation.
   */
  get allCorrected(): boolean {
    return this.correctedCount === this.totalViolations;
  }
}

/**
 * Input for CorrectorAgent execution
 *
 *
 * **Example** (Use the CorrectorInput contract)
 *
 * ```ts
 * import type { CorrectorInput } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * const acceptsCorrectorInput = (_value: CorrectorInput): void => undefined
 *
 * console.log(acceptsCorrectorInput)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface CorrectorInput {
  readonly report: ShaclValidationReport;
  readonly store: RdfStore;
  readonly ontologyContext: OntologyContext;
}

// =============================================================================
// LLM Schemas
// =============================================================================

/**
 * Schema for LLM correction response
 *
 * @internal
 */
const CorrectionResponseSchema = S.Struct({
  strategy: CorrectionStrategySchema.annotate({
    title: "Strategy",
    description: "The correction strategy to apply",
  }),
  newValue: S.Union([S.String, S.Finite, S.Boolean])
    .pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
    .annotate({
      title: "New Value",
      description: "The value to set (for generate-value, coerce-datatype, reformat-value)",
    }),
  newType: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    title: "New Type",
    description: "The new type IRI (for reclassify-entity)",
  }),
  explanation: S.String.annotate({
    title: "Explanation",
    description: "Why this correction is appropriate",
  }),
  confidence: Confidence.annotate({
    title: "Confidence",
    description: "Confidence in this correction (0-1)",
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
 * **Example** (Inspect corrector agent)
 *
 * ```ts
 * import { CorrectorAgent } from "@effect-ontology/Service/Agent/CorrectorAgent"
 *
 * console.log(CorrectorAgent)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class CorrectorAgent extends Context.Service<CorrectorAgent>()($I`CorrectorAgent`, {
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
      const strategyGuidance = Match.value(strategy).pipe(
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
    const getEntityContext = (store: RdfStore, focusNode: string): string => {
      const quads = rdfStoreQuads(store, { subject: makeNamedNode(focusNode) });
      if (quads.length === 0) return "";
      const lines = quads.map((q) => {
        const obj = q.object.termType === "Literal" ? `"${q.object.value}"` : `<${q.object.value}>`;
        return `<${q.subject.value}> <${q.predicate.value}> ${obj} .`;
      });
      return lines.join("\n");
    };
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
      const entityContext = getEntityContext(store, violation.focusNode);
      const prompt = buildCorrectionPrompt(violation, strategy, entityContext, ontologyContext);
      const response = yield* generateObjectWithFeedback({
        prompt,
        schema: CorrectionResponseSchema,
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
        hasNewValue: O.isSome(result.newValue),
      });
      return Correction.make({
        strategy: result.strategy,
        focusNode: violation.focusNode,
        path: O.some(violation.path.value),
        originalValue: O.map(violation.value, (value) => value.value),
        newValue: result.newValue,
        newType: result.newType,
        explanation: result.explanation,
        confidence: result.confidence,
      });
    });
    const applyCorrection = (
      correction: Correction,
      store: RdfStore
    ): Effect.Effect<void, CorrectionApplicationError> =>
      Effect.gen(function* () {
        if (!correction.shouldApply) {
          yield* Effect.logDebug("CorrectorAgent: Skipping correction", {
            focusNode: correction.focusNode,
            strategy: correction.strategy,
            confidence: correction.confidence,
          });
          return;
        }
        const focusNode = makeNamedNode(correction.focusNode);
        const applyValueCorrection = Effect.fn("CorrectorAgent.applyValueCorrection")(function* () {
          if (O.isNone(correction.newValue) || O.isNone(correction.path)) {
            return;
          }
          const predicate = makeNamedNode(correction.path.value);
          if (O.isSome(correction.originalValue)) {
            const oldQuads = rdfStoreQuads(store, { subject: focusNode, predicate });
            rdfStoreRemoveQuads(store, oldQuads);
          }
          const newObject = makeLiteral(`${correction.newValue.value}`, XSD_STRING.value);
          rdfStoreAddQuad(store, makeQuad(focusNode, predicate, newObject));
          yield* Effect.logInfo("CorrectorAgent: Applied value correction", {
            focusNode: correction.focusNode,
            path: correction.path,
            newValue: correction.newValue,
          });
        });
        const applyReclassification = Effect.fn("CorrectorAgent.applyReclassification")(function* () {
          if (O.isNone(correction.newType)) return;
          const typePredicate = makeNamedNode(RDF_TYPE.value);
          const oldTypeQuads = rdfStoreQuads(store, { subject: focusNode, predicate: typePredicate });
          rdfStoreRemoveQuads(store, oldTypeQuads);
          const newTypeNode = makeNamedNode(correction.newType.value);
          rdfStoreAddQuad(store, makeQuad(focusNode, typePredicate, newTypeNode));
          yield* Effect.logInfo("CorrectorAgent: Applied reclassification", {
            focusNode: correction.focusNode,
            newType: correction.newType,
          });
        });
        const requireManualReview = Effect.logWarning("CorrectorAgent: remove-excess requires manual review", {
          focusNode: correction.focusNode,
          path: correction.path,
        });
        const logSkip = Effect.logDebug("CorrectorAgent: Skipped correction", {
          focusNode: correction.focusNode,
          reason: correction.explanation,
        });
        yield* Match.value(correction.strategy).pipe(
          Match.when("generate-value", applyValueCorrection),
          Match.when("coerce-datatype", applyValueCorrection),
          Match.when("reformat-value", applyValueCorrection),
          Match.when("reclassify-entity", applyReclassification),
          Match.when("remove-excess", () => requireManualReview),
          Match.when("skip", () => logSkip),
          Match.exhaustive
        );
      }).pipe(
        Effect.mapError((error) =>
          CorrectionApplicationError.make({
            message: `Failed to apply correction: ${String(error)}`,
            correction,
            cause: O.some(error),
          })
        )
      );
    const correct = Effect.fn("CorrectorAgent.correct")(function* (
      violation: ShaclValidationViolation,
      store: RdfStore,
      ontologyContext: OntologyContext
    ): Effect.fn.Return<CorrectionResult, CorrectionError | CorrectionApplicationError> {
      const startTime = yield* Clock.currentTimeMillis;
      const correction = yield* generateCorrection(violation, store, ontologyContext);
      let applied = false;
      if (correction.shouldApply) {
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
    });
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
                  correction: Correction.make({
                    strategy: "skip",
                    focusNode: violation.focusNode,
                    path: O.some(violation.path.value),
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
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([
      ConfigServiceDefault,
      // LanguageModel.LanguageModel provided by parent scope (runtime-selected provider)
    ])
  );
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract local name from IRI
 */
const extractLocalName = (iri: string): string => {
  const hashIndex = iri.lastIndexOf("#");
  if (hashIndex >= 0) return iri.slice(hashIndex + 1);
  const slashIndex = iri.lastIndexOf("/");
  if (slashIndex >= 0) return iri.slice(slashIndex + 1);
  return iri;
};
