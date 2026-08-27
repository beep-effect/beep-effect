/**
 * Service: Violation Explainer
 *
 * **Details**
 *
 * LLM-powered explanations for SHACL violations following the xpSHACL pattern.
 * Generates human-readable explanations and actionable fix suggestions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId } from "@beep/identity";
import { Dataset } from "@beep/rdf";
import { NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { NonNegNum } from "@beep/schema/Number";
import { ShaclSeverity, ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation";
import { Clock, Context, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LanguageModel } from "effect/unstable/ai";
import { ErrorMessage, OptionalErrorCause } from "../Domain/Error/Base.ts";
import { ConfigService, ConfigServiceDefault } from "./Config.ts";
import { generateObjectWithFeedback } from "./GenerateWithFeedback.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ViolationExplainer");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error: Failed to generate explanation
 *
 * **Example** (Inspect explanation error)
 *
 * ```ts
 * import { ExplanationError } from "@effect-ontology/Service/ViolationExplainer"
 *
 * import { makeNamedNode } from "@beep/rdf/Rdf"
 * import { ShaclValidationViolation } from "@beep/semantic-web/services/shacl-validation"
 *
 * const error = ExplanationError.make({
 *   message: "The model returned an empty explanation",
 *   violation: ShaclValidationViolation.make({
 *     focusNode: "https://example.org/Ada",
 *     path: makeNamedNode("https://example.org/founded"),
 *     message: "Expected at least 1 value.",
 *     severity: "violation"
 *   })
 * })
 * console.log(error._tag) // "ExplanationError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExplanationError extends S.TaggedError<ExplanationError>($I`ExplanationError`)(
  "ExplanationError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable SHACL explanation failure diagnostic.",
    }),
    violation: ShaclValidationViolation.annotateKey({
      description: "SHACL violation that could not be explained.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying language-model defect.",
    }),
  },
  $I.annote("ExplanationError", {
    description: "Failure to generate a human-readable explanation for a SHACL violation.",
  })
) {
  static readonly is = S.is(this);
}

// =============================================================================
// Domain Models
// =============================================================================

/**
 * Context for generating explanations
 *
 * **Example** (Inspect explanation context)
 *
 * ```ts
 * import { ExplanationContext } from "@effect-ontology/Service/ViolationExplainer"
 *
 * const context = ExplanationContext.empty()
 * console.log(context.maxTokens)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ExplanationContext extends S.Class<ExplanationContext>($I`ExplanationContext`)({
  /** The canonical RDF dataset containing the data graph */
  dataStore: S.OptionFromOptionalKey(Dataset).pipe(
    SchemaUtils.withNoneDefault,
    S.annotateKey({
      description: "Optional canonical RDF dataset containing the data graph used for explanation context.",
    })
  ),
  /** Turtle representation of relevant triples around the focus node */
  neighborhoodTurtle: S.String.pipe(SchemaUtils.withKeyDefaults("")),
  /** Domain description for additional context */
  domainDescription: S.String.pipe(SchemaUtils.withKeyDefaults("")),
  /** Maximum tokens for the explanation */
  maxTokens: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(500))),
  },
  $I.annote("ExplanationContext", {
    description: "Neighborhood triples, domain description, and token bound for a SHACL explanation.",
  })
) {
  /**
   * Create empty context
   *
   * **Example** (Inspect explanation context.empty)
   *
   * ```ts
   * import { ExplanationContext } from "@effect-ontology/Service/ViolationExplainer"
   *
   * const context = ExplanationContext.empty()
 * console.log(context.maxTokens)
   * ```
   *
   * @returns Result produced by this operation.
   */
  static empty(): ExplanationContext {
    return ExplanationContext.make({});
  }

  /**
   * Create context with neighborhood triples
   *
   * **Example** (Inspect explanation context.with neighborhood)
   *
   * ```ts
   * import { ExplanationContext } from "@effect-ontology/Service/ViolationExplainer"
   *
   * const context = ExplanationContext.empty()
 * console.log(context.maxTokens)
   * ```
   *
   * @param turtle - Input consumed by this operation.
   * @returns Result produced by this operation.
   */
  static withNeighborhood(turtle: string): ExplanationContext {
    return ExplanationContext.make({ neighborhoodTurtle: turtle });
  }
}

/**
 * LLM-generated explanation for a SHACL violation
 *
 * **Example** (Inspect llm violation explanation)
 *
 * ```ts
 * import { LlmViolationExplanation } from "@effect-ontology/Service/ViolationExplainer"
 *
 * const explanation = LlmViolationExplanation.make({
 *   focusNode: "https://example.org/Ada",
 *   explanation: "The founder relation is missing.",
 *   suggestion: "Add a founded triple.",
 *   severity: "violation",
 *   affectedEntities: ["https://example.org/Ada"]
 * })
 * console.log(explanation.isCritical) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class LlmViolationExplanation extends S.Class<LlmViolationExplanation>($I`LlmViolationExplanation`)({
  /** Original violation */
  focusNode: S.String,
  /** Path that was violated (if any) */
  path: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  /** Human-readable explanation of what went wrong */
  explanation: S.String,
  /** Suggested fix action */
  suggestion: S.String,
  /** Severity level */
  severity: ShaclSeverity,
  /** Affected entity IRIs */
  affectedEntities: S.Array(S.String),
  /** Confidence in the explanation (0-1) */
  confidence: Confidence.pipe(SchemaUtils.withKeyDefaults(Confidence.make(0.8))),
  },
  $I.annote("LlmViolationExplanation", {
    description: "Human-readable SHACL explanation, suggested fix, severity, and confidence.",
  })
) {
  /**
   * True if this is a critical violation
   *
   * **Example** (Inspect llm violation explanation.is critical)
   *
   * ```ts
   * import { LlmViolationExplanation } from "@effect-ontology/Service/ViolationExplainer"
   *
   * const explanation = LlmViolationExplanation.make({
 *   focusNode: "https://example.org/Ada",
 *   explanation: "The founder relation is missing.",
 *   suggestion: "Add a founded triple.",
 *   severity: "violation",
 *   affectedEntities: ["https://example.org/Ada"]
 * })
 * console.log(explanation.isCritical) // true
   * ```
   *
   * @returns Result produced by this operation.
   */
  get isCritical(): boolean {
    return this.severity === "violation";
  }
}

/**
 * Batch explanation result
 *
 * **Example** (Inspect batch explanation result)
 *
 * ```ts
 * import { BatchExplanationResult } from "@effect-ontology/Service/ViolationExplainer"
 *
 * import { NonNegativeInt } from "@beep/schema"
 * import { NonNegNum } from "@beep/schema/Number"
 *
 * const batch = BatchExplanationResult.make({
 *   explanations: [],
 *   totalViolations: NonNegativeInt.make(1),
 *   explainedCount: NonNegativeInt.make(0),
 *   durationMs: NonNegNum.make(20)
 * })
 * console.log(batch.explainedCount) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class BatchExplanationResult extends S.Class<BatchExplanationResult>($I`BatchExplanationResult`)(
  {
    explanations: S.Array(LlmViolationExplanation),
    totalViolations: NonNegativeInt,
    explainedCount: NonNegativeInt,
    durationMs: NonNegNum,
  },
  $I.annote("BatchExplanationResult", {
    description: "Per-violation explanations plus explained and elapsed counters.",
  })
) {
  /**
   * True if all violations were explained
   *
   * **Example** (Inspect batch explanation result.is complete)
   *
   * ```ts
   * import { NonNegativeInt } from "@beep/schema"
   * import { NonNegNum } from "@beep/schema/Number"
   * import { BatchExplanationResult } from "@effect-ontology/Service/ViolationExplainer"
   *
   * const batch = BatchExplanationResult.make({
   *   explanations: [],
   *   totalViolations: NonNegativeInt.make(1),
   *   explainedCount: NonNegativeInt.make(0),
   *   durationMs: NonNegNum.make(20)
   * })
   * console.log(batch.explainedCount) // 0
   * ```
   *
   * @returns Result produced by this operation.
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
const ExplanationResponseSchema = S.Struct({
  explanation: S.String.annotate({
    title: "Explanation",
    description: "Clear, human-readable explanation of what went wrong",
  }),
  suggestion: S.String.annotate({
    title: "Suggestion",
    description: "Specific, actionable fix suggestion",
  }),
  affectedEntities: S.Array(S.String).annotate({
    title: "Affected Entities",
    description: "IRIs of entities affected by this violation",
  }),
  confidence: Confidence.annotate({
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
 * **Details**
 *
 * Generates human-readable explanations for SHACL violations using LLM
 * with context from the data graph. Follows the xpSHACL pattern for
 * explainable SHACL validation.
 *
 * **Example** (Inspect the violation-explainer layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { Effect } from "effect"
 * import { ViolationExplainer } from "@effect-ontology/Service/ViolationExplainer"
 *
 * const program = Effect.gen(function* () {
 *   const explainer = yield* ViolationExplainer
 *   return explainer
 * }).pipe(Effect.provide(ViolationExplainer.Default))
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ViolationExplainer extends Context.Service<ViolationExplainer>()($I`ViolationExplainer`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const llm = yield* LanguageModel.LanguageModel;

    /**
     * Generate explanation for a single violation
     */
    const explain = Effect.fn("ViolationExplainer.explain")(function* (
      violation: ShaclValidationViolation,
      context: ExplanationContext
    ): Effect.fn.Return<LlmViolationExplanation, ExplanationError> {
      yield* Effect.logInfo("ViolationExplainer.explain starting", {
        focusNode: violation.focusNode,
        path: O.some(violation.path.value),
        severity: violation.severity,
      });

      const prompt = buildExplanationPrompt(violation, context);

      const response = yield* generateObjectWithFeedback({
        prompt,
        schema: ExplanationResponseSchema,
        objectName: "ExplanationResponse",
        serviceName: "ViolationExplainer",
        retryPolicy: config.llm.retryPolicy,
      }).pipe(
        Effect.provideService(LanguageModel.LanguageModel, llm),
        Effect.mapError((error) =>
          ExplanationError.make({
            message: `Failed to generate explanation: ${error._tag}`,
            violation,
            cause: O.some(error),
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
        path: O.some(violation.path.value),
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
      violations: ReadonlyArray<ShaclValidationViolation>,
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
        totalViolations: NonNegativeInt.make(violations.length),
        explainedCount: NonNegativeInt.make(explanations.length),
        durationMs,
      });
    });

    /**
     * Generate a quick rule-based explanation (no LLM)
     */
    const explainQuick = (violation: ShaclValidationViolation): LlmViolationExplanation => {
      const { explanation, suggestion } = generateRuleBasedExplanation(violation);

      return LlmViolationExplanation.make({
        focusNode: violation.focusNode,
        path: O.some(violation.path.value),
        explanation,
        suggestion,
        severity: violation.severity,
        affectedEntities: [violation.focusNode],
        confidence: Confidence.make(0.6), // Lower confidence for rule-based
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
        violation: ShaclValidationViolation,
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
const buildExplanationPrompt = (violation: ShaclValidationViolation, context: ExplanationContext): string => {
  let parts: Array<string> = [
    "You are an expert at explaining SHACL validation errors in plain language.",
    "",
    "## Violation Details",
    `- **Focus Node**: ${violation.focusNode}`,
    `- **Property Path**: ${violation.path.value}`,
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
const generateRuleBasedExplanation = (
  violation: ShaclValidationViolation
): { explanation: string; suggestion: string } => {
  const message = Str.toLowerCase(violation.message);
  const path = violation.path.value;

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
