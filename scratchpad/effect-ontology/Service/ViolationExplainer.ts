/**
 * Service: Violation Explainer
 *
 * LLM-powered explanations for SHACL violations following the xpSHACL pattern.
 * Generates human-readable explanations and actionable fix suggestions.
 *
 * @since 2.0.0
 * @module Service/ViolationExplainer
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
import { ConfigService, ConfigServiceDefault } from "./Config.ts";
import { generateObjectWithFeedback } from "./GenerateWithFeedback.ts";
import type { ShaclViolation } from "./Shacl.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ViolationExplainer");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error: Failed to generate explanation
 *
 * @since 2.0.0
 * @category Errors
 */
export class ExplanationError extends Data.TaggedError("ExplanationError")<{
  readonly message: string;
  readonly violation: ShaclViolation;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Domain Models
// =============================================================================

/**
 * Context for generating explanations
 *
 * @since 2.0.0
 * @category Models
 */
export class ExplanationContext extends Schema.Class<ExplanationContext>("ExplanationContext")({
  /** The RDF store containing the data graph */
  dataStore: Schema.Any.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  /** Turtle representation of relevant triples around the focus node */
  neighborhoodTurtle: Schema.String.pipe(SchemaUtils.withKeyDefaults("")),
  /** Domain description for additional context */
  domainDescription: Schema.String.pipe(SchemaUtils.withKeyDefaults("")),
  /** Maximum tokens for the explanation */
  maxTokens: Schema.Finite.pipe(SchemaUtils.withKeyDefaults(500)),
}) {
  /**
   * Create empty context
   */
  static empty(): ExplanationContext {
    return ExplanationContext.make({});
  }

  /**
   * Create context with neighborhood triples
   */
  static withNeighborhood(turtle: string): ExplanationContext {
    return ExplanationContext.make({ neighborhoodTurtle: turtle });
  }
}

/**
 * LLM-generated explanation for a SHACL violation
 *
 * @since 2.0.0
 * @category Models
 */
export class LlmViolationExplanation extends Schema.Class<LlmViolationExplanation>("LlmViolationExplanation")({
  /** Original violation */
  focusNode: Schema.String,
  /** Path that was violated (if any) */
  path: Schema.String.pipe(Schema.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  /** Human-readable explanation of what went wrong */
  explanation: Schema.String,
  /** Suggested fix action */
  suggestion: Schema.String,
  /** Severity level */
  severity: Schema.Literals(["Violation", "Warning", "Info"]),
  /** Affected entity IRIs */
  affectedEntities: Schema.Array(Schema.String),
  /** Confidence in the explanation (0-1) */
  confidence: Schema.Finite.pipe(SchemaUtils.withKeyDefaults(0.8)),
}) {
  /**
   * True if this is a critical violation
   */
  get isCritical(): boolean {
    return this.severity === "Violation";
  }
}

/**
 * Batch explanation result
 *
 * @since 2.0.0
 * @category Models
 */
export class BatchExplanationResult extends Schema.Class<BatchExplanationResult>("BatchExplanationResult")({
  explanations: Schema.Array(LlmViolationExplanation),
  totalViolations: Schema.Finite,
  explainedCount: Schema.Finite,
  durationMs: Schema.Finite,
}) {
  /**
   * True if all violations were explained
   */
  get isComplete(): boolean {
    return this.explainedCount === this.totalViolations;
  }
}

// =============================================================================
// Schema for LLM structured output
// =============================================================================

/**
 * Schema for single explanation response
 *
 * @internal
 */
const ExplanationResponseSchema = Schema.Struct({
  explanation: Schema.String.annotate({
    title: "Explanation",
    description: "Clear, human-readable explanation of what went wrong",
  }),
  suggestion: Schema.String.annotate({
    title: "Suggestion",
    description: "Specific, actionable fix suggestion",
  }),
  affectedEntities: Schema.Array(Schema.String).annotate({
    title: "Affected Entities",
    description: "IRIs of entities affected by this violation",
  }),
  confidence: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })).annotate({
    title: "Confidence",
    description: "Confidence in the explanation accuracy (0-1)",
  }),
});

// =============================================================================
// Service Definition
// =============================================================================

/**
 * ViolationExplainer - LLM-powered SHACL violation explanations
 *
 * Generates human-readable explanations for SHACL violations using LLM
 * with context from the data graph. Follows the xpSHACL pattern for
 * explainable SHACL validation.
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const explainer = yield* ViolationExplainer
 *
 *   const explanation = yield* explainer.explain(
 *     violation,
 *     ExplanationContext.withNeighborhood(neighborTurtle)
 *   )
 *
 *   console.log(explanation.explanation)
 *   console.log("Fix:", explanation.suggestion)
 * })
 * ```
 *
 * @since 2.0.0
 * @category Services
 */
export class ViolationExplainer extends Context.Service<ViolationExplainer>()($I`ViolationExplainer`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const llm = yield* LanguageModel.LanguageModel;

    // Retry schedule for LLM calls
    const retrySchedule = Schedule.exponential(Duration.millis(config.runtime.retryInitialDelayMs)).pipe(
      Schedule.modifyDelay(({ duration }) =>
        Effect.succeed(Duration.min(duration, Duration.millis(config.runtime.retryMaxDelayMs)))
      ),
      Schedule.jittered
    );

    /**
     * Generate explanation for a single violation
     */
    const explain = Effect.fn("ViolationExplainer.explain")(function* (
      violation: ShaclViolation,
      context: ExplanationContext
    ): Effect.fn.Return<LlmViolationExplanation, ExplanationError> {
      yield* Effect.logInfo("ViolationExplainer.explain starting", {
        focusNode: violation.focusNode,
        path: violation.path,
        severity: violation.severity,
      });

      const prompt = buildExplanationPrompt(violation, context);

      const response = yield* generateObjectWithFeedback(llm, {
        prompt,
        schema: ExplanationResponseSchema,
        objectName: "ExplanationResponse",
        maxAttempts: config.runtime.retryMaxAttempts,
        serviceName: "ViolationExplainer",
        timeoutMs: config.llm.timeoutMs,
        retrySchedule,
      }).pipe(
        Effect.mapError(
          (error) =>
            new ExplanationError({
              message: `Failed to generate explanation: ${error._tag}`,
              violation,
              cause: error,
            })
        )
      );

      const result = response.value;

      yield* Effect.logInfo("ViolationExplainer.explain complete", {
        explanationLength: result.explanation.length,
        suggestionLength: result.suggestion.length,
        confidence: result.confidence,
      });

      return LlmViolationExplanation.make({
        focusNode: violation.focusNode,
        path: violation.path,
        explanation: result.explanation,
        suggestion: result.suggestion,
        severity: violation.severity,
        affectedEntities: result.affectedEntities,
        confidence: result.confidence,
      });
    });

    /**
     * Explain multiple violations in batch
     */
    const explainBatch = Effect.fn("ViolationExplainer.explainBatch")(function* (
      violations: ReadonlyArray<ShaclViolation>,
      context: ExplanationContext,
      options?: { concurrency?: number }
    ): Effect.fn.Return<BatchExplanationResult, ExplanationError> {
      const startTime = yield* Clock.currentTimeMillis;
      const concurrency = options?.concurrency ?? config.runtime.concurrency;

      yield* Effect.logInfo("ViolationExplainer.explainBatch starting", {
        violationCount: violations.length,
        concurrency,
      });

      // Process violations with concurrency limit
      const explanations = yield* Effect.all(
        A.map(violations, (violation) => explain(violation, context)),
        { concurrency }
      );

      const durationMs = (yield* Clock.currentTimeMillis) - startTime;

      yield* Effect.logInfo("ViolationExplainer.explainBatch complete", {
        explainedCount: explanations.length,
        durationMs,
      });

      return BatchExplanationResult.make({
        explanations: [...explanations],
        totalViolations: violations.length,
        explainedCount: explanations.length,
        durationMs,
      });
    });

    /**
     * Generate a quick rule-based explanation (no LLM)
     */
    const explainQuick = (violation: ShaclViolation): LlmViolationExplanation => {
      const { explanation, suggestion } = generateRuleBasedExplanation(violation);

      return LlmViolationExplanation.make({
        focusNode: violation.focusNode,
        path: violation.path,
        explanation,
        suggestion,
        severity: violation.severity,
        affectedEntities: [violation.focusNode],
        confidence: 0.6, // Lower confidence for rule-based
      });
    };

    return {
      /**
       * Generate LLM-powered explanation for a single violation
       *
       * Uses the LLM to generate a contextual, human-readable explanation
       * with an actionable fix suggestion.
       *
       * @param violation - The SHACL violation to explain
       * @param context - Additional context (neighborhood, domain info)
       * @returns Detailed explanation with fix suggestion
       */
      explain,

      /**
       * Explain multiple violations in batch
       *
       * Processes violations with configurable concurrency for efficiency.
       *
       * @param violations - Array of SHACL violations
       * @param context - Shared explanation context
       * @param options - Optional concurrency settings
       * @returns Batch result with all explanations
       */
      explainBatch,

      /**
       * Generate quick rule-based explanation (no LLM)
       *
       * Useful for fallback or when LLM is unavailable.
       * Returns lower-confidence explanations based on violation patterns.
       *
       * @param violation - The SHACL violation to explain
       * @returns Rule-based explanation
       */
      explainQuick,

      /**
       * Explain with fallback to rule-based
       *
       * Attempts LLM explanation first, falls back to rule-based on failure.
       *
       * @param violation - The SHACL violation to explain
       * @param context - Explanation context
       * @returns Explanation (LLM or rule-based)
       */
      explainWithFallback: (
        violation: ShaclViolation,
        context: ExplanationContext
      ): Effect.Effect<LlmViolationExplanation, never> =>
        explain(violation, context).pipe(
          Effect.catch((error) =>
            Effect.logWarning("LLM explanation failed, using rule-based fallback", {
              error: error.message,
            }).pipe(Effect.as(explainQuick(violation)))
          )
        ),
    };
  }).pipe(Effect.withSpan("ViolationExplainer.make")),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(
    Layer.provide([
      ConfigServiceDefault,
      // LanguageModel.LanguageModel provided by parent scope (runtime-selected provider)
    ])
  );
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Build explanation prompt for LLM
 */
const buildExplanationPrompt = (violation: ShaclViolation, context: ExplanationContext): string => {
  let parts: Array<string> = [
    "You are an expert at explaining SHACL validation errors in plain language.",
    "",
    "## Violation Details",
    `- **Focus Node**: ${violation.focusNode}`,
    O.match(violation.path, { onNone: () => "", onSome: (path) => `- **Property Path**: ${path}` }),
    `- **Message**: ${violation.message}`,
    `- **Severity**: ${violation.severity}`,
    "",
  ];

  if (P.isTruthy(context.neighborhoodTurtle)) {
    parts = A.appendAll(parts, [
      "## Related Triples (Focus Node Neighborhood)",
      "```turtle",
      context.neighborhoodTurtle,
      "```",
      "",
    ]);
  }

  if (P.isTruthy(context.domainDescription)) {
    parts = A.appendAll(parts, ["## Domain Context", context.domainDescription, ""]);
  }

  parts = A.appendAll(parts, [
    "## Task",
    "1. Explain what went wrong in clear, non-technical language",
    "2. Suggest a specific fix that would resolve the violation",
    "3. List any entities affected by this violation",
    "",
    "## Response Format",
    "Return a JSON object with:",
    "- explanation: Clear explanation of the problem",
    "- suggestion: Specific fix action",
    "- affectedEntities: Array of affected entity IRIs",
    "- confidence: Your confidence in this explanation (0-1)",
  ]);

  return A.join(A.filter(parts, Str.isNonEmpty), "\n");
};

/**
 * Generate rule-based explanation (no LLM)
 */
const generateRuleBasedExplanation = (violation: ShaclViolation): { explanation: string; suggestion: string } => {
  const message = Str.toLowerCase(violation.message);
  const path = O.getOrElse(violation.path, () => "unknown");

  // Cardinality constraints
  if (Str.includes("mincount")(message) || Str.includes("min count")(message)) {
    return {
      explanation: `The entity "${extractLocalName(
        violation.focusNode
      )}" is missing a required value for the property "${extractLocalName(path)}".`,
      suggestion: `Add a value for the "${extractLocalName(path)}" property.`,
    };
  }

  if (Str.includes("maxcount")(message) || Str.includes("max count")(message)) {
    return {
      explanation: `The entity "${extractLocalName(violation.focusNode)}" has too many values for the property "${extractLocalName(
        path
      )}".`,
      suggestion: `Remove excess values from the "${extractLocalName(path)}" property.`,
    };
  }

  // Datatype constraints (check before type to avoid false matches)
  if (Str.includes("datatype")(message)) {
    return {
      explanation: `The value for "${extractLocalName(path)}" on "${extractLocalName(
        violation.focusNode
      )}" has the wrong data type.`,
      suggestion: "Check the data type of the value and correct it to match the expected type.",
    };
  }

  // Type constraints (class, rdf:type)
  if (Str.includes("class")(message) || (Str.includes("type")(message) && !Str.includes("datatype")(message))) {
    return {
      explanation: `The entity "${extractLocalName(violation.focusNode)}" has an incorrect type.`,
      suggestion: "Ensure the entity has the correct rdf:type declaration.",
    };
  }

  // Pattern constraints
  if (Str.includes("pattern")(message)) {
    return {
      explanation: `The value for "${extractLocalName(path)}" on "${extractLocalName(
        violation.focusNode
      )}" doesn't match the required format.`,
      suggestion: "Update the value to match the required pattern/format.",
    };
  }

  // Default fallback
  return {
    explanation: `Validation failed for "${extractLocalName(violation.focusNode)}": ${violation.message}`,
    suggestion: "Review the validation constraints and update the data accordingly.",
  };
};

/**
 * Extract local name from IRI
 */
const extractLocalName = (iri: string): string => {
  const hashIndex = Str.lastIndexOf("#")(iri);
  if (O.isSome(hashIndex)) return Str.slice(hashIndex.value + 1)(iri);
  return O.match(Str.lastIndexOf("/")(iri), {
    onNone: () => iri,
    onSome: (slashIndex) => Str.slice(slashIndex + 1)(iri),
  });
};
