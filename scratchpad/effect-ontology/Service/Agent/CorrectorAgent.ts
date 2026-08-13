/**
 * Service: CorrectorAgent
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
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const corrector = yield* CorrectorAgent
 *
 *   const result = yield* corrector.correct(violation, store, ontologyContext)
 *   console.log(`Applied ${result.correction.strategy} correction`)
 *
 *   // Or correct all violations in a report
 *   const batchResult = yield* corrector.correctAll(report, store, ontologyContext)
 *   console.log(`Fixed ${batchResult.correctedCount} of ${batchResult.totalViolations}`)
 * })
 * ```
 *
 * @since 2.0.0
 * @module Service/Agent/CorrectorAgent
 */

import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Context, Data, Duration, Effect, Layer, Schedule, Schema } from "effect";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { LanguageModel } from "effect/unstable/ai";
import * as N3 from "n3";
import type { Agent } from "../../Domain/Model/Agent.ts";
import { AgentId, AgentMetadata, ValidationResult } from "../../Domain/Model/Agent.ts";
import type { OntologyContext } from "../../Domain/Model/Ontology.ts";
import { ConfigService, ConfigServiceDefault } from "../Config.ts";
import { generateObjectWithFeedback } from "../GenerateWithFeedback.ts";
import type { RdfStore } from "../Rdf.ts";
import type { ShaclValidationReport, ShaclViolation } from "../Shacl.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Agent/CorrectorAgent");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error: Failed to generate correction
 *
 * @since 2.0.0
 * @category Errors
 */
export class CorrectionError extends Data.TaggedError("CorrectionError")<{
  readonly message: string;
  readonly violation: ShaclViolation;
  readonly strategy: CorrectionStrategy;
  readonly cause?: unknown;
}> {}

/**
 * Error: Failed to apply correction to graph
 *
 * @since 2.0.0
 * @category Errors
 */
export class CorrectionApplicationError extends Data.TaggedError("CorrectionApplicationError")<{
  readonly message: string;
  readonly correction: Correction;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Domain Models
// =============================================================================

/**
 * Correction strategy based on violation type
 *
 * @since 2.0.0
 * @category Types
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
 * @since 2.0.0
 * @category Schemas
 */
export const CorrectionStrategySchema = Schema.Literals([
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
 * @since 2.0.0
 * @category Models
 */
export class Correction extends Schema.Class<Correction>("Correction")({
  /**
   * Strategy used for this correction
   */
  strategy: CorrectionStrategySchema,

  /**
   * Focus node (entity) being corrected
   */
  focusNode: Schema.String,

  /**
   * Property path being corrected (if applicable)
   */
  path: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Original value (if any)
   */
  originalValue: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).pipe(
    Schema.OptionFromOptionalKey,
    SchemaUtils.withNoneDefault
  ),

  /**
   * New value to set
   */
  newValue: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).pipe(
    Schema.OptionFromOptionalKey,
    SchemaUtils.withNoneDefault
  ),

  /**
   * New type IRI (for reclassification)
   */
  newType: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),

  /**
   * Explanation of the correction
   */
  explanation: Schema.String,

  /**
   * Confidence in the correction (0-1)
   */
  confidence: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
}) {
  /**
   * Whether this correction should be applied
   */
  get shouldApply(): boolean {
    return this.strategy !== "skip" && this.confidence >= 0.5;
  }
}

/**
 * Result of correcting a single violation
 *
 * @since 2.0.0
 * @category Models
 */
export class CorrectionResult extends Schema.Class<CorrectionResult>("CorrectionResult")({
  /**
   * The original violation
   */
  violation: Schema.Any, // ShaclViolation

  /**
   * The correction that was generated
   */
  correction: Correction,

  /**
   * Whether the correction was applied
   */
  applied: Schema.Boolean,

  /**
   * Time taken in milliseconds
   */
  durationMs: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
}) {}

/**
 * Result of correcting all violations in a report
 *
 * @since 2.0.0
 * @category Models
 */
export class BatchCorrectionResult extends Schema.Class<BatchCorrectionResult>("BatchCorrectionResult")({
  /**
   * Individual correction results
   */
  results: Schema.Array(CorrectionResult),

  /**
   * Total violations processed
   */
  totalViolations: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),

  /**
   * Number of corrections applied
   */
  correctedCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),

  /**
   * Number of violations skipped
   */
  skippedCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),

  /**
   * Total duration in milliseconds
   */
  durationMs: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
}) {
  /**
   * Success rate (corrected / total)
   */
  get successRate(): number {
    return this.totalViolations > 0 ? this.correctedCount / this.totalViolations : 1;
  }

  /**
   * Whether all violations were corrected
   */
  get allCorrected(): boolean {
    return this.correctedCount === this.totalViolations;
  }
}

/**
 * Input for CorrectorAgent execution
 *
 * @since 2.0.0
 * @category Models
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
const CorrectionResponseSchema = Schema.Struct({
  strategy: CorrectionStrategySchema.annotate({
    title: "Strategy",
    description: "The correction strategy to apply",
  }),
  newValue: Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])
    .pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault)
    .annotate({
      title: "New Value",
      description: "The value to set (for generate-value, coerce-datatype, reformat-value)",
    }),
  newType: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    title: "New Type",
    description: "The new type IRI (for reclassify-entity)",
  }),
  explanation: Schema.String.annotate({
    title: "Explanation",
    description: "Why this correction is appropriate",
  }),
  confidence: Schema.Finite.check(
    Schema.isBetween({
      minimum: 0,
      maximum: 1,
    })
  ).annotate({
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
 * Uses structured LLM output to generate corrections for SHACL violations.
 * Corrections can add missing values, fix datatypes, remove excess values,
 * or reclassify entities.
 *
 * @since 2.0.0
 * @category Services
 */
export class CorrectorAgent extends Context.Service<CorrectorAgent>()($I`CorrectorAgent`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const llm = yield* LanguageModel.LanguageModel;
    const retrySchedule = Schedule.exponential(Duration.millis(config.runtime.retryInitialDelayMs)).pipe(
      Schedule.modifyDelay(({ duration }) =>
        Effect.succeed(Duration.min(duration, Duration.millis(config.runtime.retryMaxDelayMs)))
      ),
      Schedule.jittered
    );
    const classifyViolation = (violation: ShaclViolation): CorrectionStrategy => {
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
      violation: ShaclViolation,
      strategy: CorrectionStrategy,
      entityContext: string,
      ontologyContext: OntologyContext
    ): string => {
      const parts: Array<string> = [
        "You are an expert at correcting SHACL validation errors in RDF knowledge graphs.",
        "",
        "## Violation Details",
        `- **Focus Node**: ${violation.focusNode}`,
        O.isSome(violation.path) ? `- **Property Path**: ${violation.path}` : "",
        O.isSome(violation.value) ? `- **Current Value**: ${violation.value}` : "",
        `- **Message**: ${violation.message}`,
        `- **Severity**: ${violation.severity}`,
        "",
        `## Correction Strategy: ${strategy}`,
        "",
      ];
      switch (strategy) {
        case "generate-value":
          parts.push(
            "Generate a plausible value for the missing required property.",
            "The value should be consistent with:",
            "- The entity's existing properties",
            "- The property's expected datatype",
            "- Common patterns in the ontology",
            ""
          );
          break;
        case "coerce-datatype":
          parts.push(
            "Convert the current value to the correct datatype.",
            "If conversion is not possible, generate a valid default value.",
            ""
          );
          break;
        case "remove-excess":
          parts.push(
            "This violation requires removing excess values.",
            "Set strategy to 'skip' as this requires domain knowledge to decide which values to keep.",
            ""
          );
          break;
        case "reclassify-entity":
          parts.push(
            "Determine the correct type/class for this entity based on its properties.",
            "Return the new type IRI in the 'newType' field.",
            ""
          );
          break;
        case "reformat-value":
          parts.push("Reformat the value to match the required pattern.", "");
          break;
        default:
          parts.push(
            "This violation cannot be automatically corrected.",
            "Set strategy to 'skip' with an explanation.",
            ""
          );
      }
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
      const quads = store._store.getQuads(N3.DataFactory.namedNode(focusNode), null, null, null);
      if (quads.length === 0) return "";
      const lines = quads.map((q) => {
        const obj = q.object.termType === "Literal" ? `"${q.object.value}"` : `<${q.object.value}>`;
        return `<${q.subject.value}> <${q.predicate.value}> ${obj} .`;
      });
      return lines.join("\n");
    };
    const generateCorrection = Effect.fn("CorrectorAgent.generateCorrection")(function* (
      violation: ShaclViolation,
      store: RdfStore,
      ontologyContext: OntologyContext
    ): Effect.fn.Return<Correction, CorrectionError> {
      const strategy = classifyViolation(violation);
      yield* Effect.logInfo("CorrectorAgent.generateCorrection", {
        focusNode: violation.focusNode,
        path: violation.path,
        strategy,
      });
      const entityContext = getEntityContext(store, violation.focusNode);
      const prompt = buildCorrectionPrompt(violation, strategy, entityContext, ontologyContext);
      const response = yield* generateObjectWithFeedback(llm, {
        prompt,
        schema: CorrectionResponseSchema,
        objectName: "CorrectionResponse",
        maxAttempts: config.runtime.retryMaxAttempts,
        serviceName: "CorrectorAgent",
        timeoutMs: config.llm.timeoutMs,
        retrySchedule,
      }).pipe(
        Effect.mapError(
          (error) =>
            new CorrectionError({
              message: `Failed to generate correction: ${error._tag}`,
              violation,
              strategy,
              cause: error,
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
        path: violation.path,
        originalValue: violation.value,
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
        const focusNode = N3.DataFactory.namedNode(correction.focusNode);
        switch (correction.strategy) {
          case "generate-value":
          case "coerce-datatype":
          case "reformat-value": {
            if (O.isNone(correction.newValue) || O.isNone(correction.path)) {
              return;
            }
            const predicate = N3.DataFactory.namedNode(correction.path.value);
            if (O.isSome(correction.originalValue)) {
              const oldQuads = store._store.getQuads(focusNode, predicate, null, null);
              store._store.removeQuads(oldQuads);
            }
            const newObject =
              typeof correction.newValue.value === "string"
                ? N3.DataFactory.literal(correction.newValue.value)
                : N3.DataFactory.literal(String(correction.newValue.value));
            store._store.addQuad(focusNode, predicate, newObject);
            yield* Effect.logInfo("CorrectorAgent: Applied value correction", {
              focusNode: correction.focusNode,
              path: correction.path,
              newValue: correction.newValue,
            });
            break;
          }
          case "reclassify-entity": {
            if (O.isNone(correction.newType)) return;
            const typePredicate = N3.DataFactory.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
            const oldTypeQuads = store._store.getQuads(focusNode, typePredicate, null, null);
            store._store.removeQuads(oldTypeQuads);
            const newTypeNode = N3.DataFactory.namedNode(correction.newType.value);
            store._store.addQuad(focusNode, typePredicate, newTypeNode);
            yield* Effect.logInfo("CorrectorAgent: Applied reclassification", {
              focusNode: correction.focusNode,
              newType: correction.newType,
            });
            break;
          }
          case "remove-excess": {
            yield* Effect.logWarning("CorrectorAgent: remove-excess requires manual review", {
              focusNode: correction.focusNode,
              path: correction.path,
            });
            break;
          }
          default:
            yield* Effect.logDebug("CorrectorAgent: Skipped correction", {
              focusNode: correction.focusNode,
              reason: correction.explanation,
            });
        }
      }).pipe(
        Effect.mapError(
          (error) =>
            new CorrectionApplicationError({
              message: `Failed to apply correction: ${String(error)}`,
              correction,
              cause: error,
            })
        )
      );
    const correct = Effect.fn("CorrectorAgent.correct")(function* (
      violation: ShaclViolation,
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
        violationCount: report.violations.length,
        concurrency,
      });
      const violations = A.filter(report.violations, (violation) => violation.severity === "Violation");
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
                    path: violation.path,
                    explanation: `Error: ${error.message}`,
                    confidence: 0,
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
        totalViolations: results.length,
        correctedCount,
        skippedCount,
        durationMs,
      });
      return BatchCorrectionResult.make({
        results: [...results],
        totalViolations: results.length,
        correctedCount,
        skippedCount,
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
              input.report.violations.length > 0
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
