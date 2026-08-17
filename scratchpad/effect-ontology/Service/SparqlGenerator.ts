/**
 * Service: SPARQL Generator
 *
 * **Details**
 *
 * Translates natural language questions to SPARQL queries using LLM
 * with ontology schema context.
 *
 * Based on FIRESPARQL pattern:
 * 1. Retrieve relevant schema context (classes, properties)
 * 2. Generate SPARQL via LLM with schema in prompt
 * 3. Validate SPARQL syntax
 * 4. Apply query correction if needed
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { $ScratchpadId, CoreVocab } from "@beep/identity";
import { XSD_NAMESPACE } from "@beep/rdf/Vocab/Xsd";
import { PosInt, SchemaUtils } from "@beep/schema";
import { Context, Duration, Effect, Layer, Schedule } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LanguageModel } from "effect/unstable/ai";
import { ErrorMessage, OptionalErrorCause, OptionalNonNegativeInt } from "../Domain/Error/Base.ts";
import type { OntologyContext } from "../Domain/Model/Ontology.ts";
import { ConfigService } from "./Config.ts";
import { generateObjectWithFeedback } from "./GenerateWithFeedback.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/SparqlGenerator");

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error: Failed to generate SPARQL query
 *
 * **Example** (Inspect sparql generation error)
 *
 * ```ts
 * import { SparqlGenerationError } from "@effect-ontology/Service/SparqlGenerator"
 *
 * console.log(SparqlGenerationError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SparqlGenerationError extends S.TaggedError<SparqlGenerationError>($I`SparqlGenerationError`)(
  "SparqlGenerationError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable SPARQL generation failure diagnostic.",
    }),
    question: S.NonEmptyString.annotateKey({
      description: "Natural-language question that could not be translated.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying language-model defect.",
    }),
  },
  $I.annote("SparqlGenerationError", {
    description: "Failure to generate a SPARQL query from a natural-language question.",
  })
) {
  static readonly is = S.is(this);
}

/**
 * Error: SPARQL syntax is invalid
 *
 * **Example** (Inspect sparql syntax error)
 *
 * ```ts
 * import { SparqlSyntaxError } from "@effect-ontology/Service/SparqlGenerator"
 *
 * console.log(SparqlSyntaxError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SparqlSyntaxError extends S.TaggedError<SparqlSyntaxError>($I`SparqlSyntaxError`)(
  "SparqlSyntaxError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable SPARQL syntax diagnostic.",
    }),
    sparql: S.String.annotateKey({
      description: "SPARQL source that failed validation.",
    }),
    position: OptionalNonNegativeInt.annotateKey({
      description: "Optional zero-based source position associated with the syntax failure.",
    }),
  },
  $I.annote("SparqlSyntaxError", {
    description: "Static syntax validation failure for generated SPARQL source.",
  })
) {
  static readonly is = S.is(this);
}

/**
 * Error: SPARQL correction failed
 *
 * **Example** (Inspect sparql correction error)
 *
 * ```ts
 * import { SparqlCorrectionError } from "@effect-ontology/Service/SparqlGenerator"
 *
 * console.log(SparqlCorrectionError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SparqlCorrectionError extends S.TaggedError<SparqlCorrectionError>($I`SparqlCorrectionError`)(
  "SparqlCorrectionError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable SPARQL correction failure diagnostic.",
    }),
    sparql: S.String.annotateKey({
      description: "SPARQL source that could not be corrected.",
    }),
    originalError: ErrorMessage.annotateKey({
      description: "Original syntax diagnostic supplied to the correction pass.",
    }),
  },
  $I.annote("SparqlCorrectionError", {
    description: "Failure to repair invalid SPARQL using the language model.",
  })
) {
  static readonly is = S.is(this);
}

// =============================================================================
// Schema for LLM structured output
// =============================================================================

/**
 * Schema for SPARQL generation response
 *
 * @internal
 */
const SparqlResponseSchema = S.Struct({
  sparql: S.String.annotate({
    title: "SPARQL Query",
    description: "Valid SPARQL SELECT query",
  }),
  explanation: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotate({
    title: "Explanation",
    description: "Brief explanation of the query logic",
  }),
  confidence: Confidence.annotate({
    title: "Confidence",
    description: "Confidence score between 0 and 1",
  }),
});

type SparqlResponse = typeof SparqlResponseSchema.Type;

// =============================================================================
// Service Definition
// =============================================================================

/**
 * SparqlGenerator - Natural language to SPARQL translation service
 *
 * **Details**
 *
 * Provides methods to translate natural language questions to SPARQL queries
 * using LLM with ontology schema context for grounding.
 *
 * **Example** (Inspect the SPARQL-generator layer)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { SparqlGenerator } from "@effect-ontology/Service/SparqlGenerator"
 *
 * console.log(Layer.isLayer(SparqlGenerator.Default)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SparqlGenerator extends Context.Service<SparqlGenerator>()($I`SparqlGenerator`, {
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

    return {
      /**
       * Generate SPARQL query from natural language question
       *
       * Uses the ontology schema to ground the LLM's understanding
       * of available classes and properties.
       *
       * @param question - Natural language question
       * @param ontology - Ontology context with classes and properties
       * @param prefixes - Optional namespace prefixes (defaults to ontology-derived)
       * @returns Generated SPARQL query with confidence score
       */
      generate: (
        question: string,
        ontology: OntologyContext,
        prefixes?: Record<string, string>
      ): Effect.Effect<SparqlResponse, SparqlGenerationError> =>
        Effect.gen(function* () {
          yield* Effect.logInfo("SparqlGenerator.generate starting", {
            questionLength: question.length,
            classCount: ontology.classes.length,
            propertyCount: ontology.properties.length,
          });

          // Format schema context for LLM
          const schemaContext = formatSchemaContext(ontology);

          // Build prefix declarations
          const prefixDeclarations = formatPrefixes(
            prefixes ?? {
              "": config.rdf.baseNamespace,
              rdf: CoreVocab.rdf.iri,
              rdfs: CoreVocab.rdfs.iri,
              xsd: XSD_NAMESPACE,
            }
          );

          // Build the prompt
          const prompt = buildGenerationPrompt(question, schemaContext, prefixDeclarations);

          yield* Effect.logDebug("SPARQL generation prompt", {
            promptLength: prompt.length,
            promptPreview: prompt.slice(0, 500),
          });

          // Call LLM for structured output
          const response = yield* generateObjectWithFeedback(llm, {
            prompt,
            schema: SparqlResponseSchema,
            objectName: "SparqlResponse",
            maxAttempts: PosInt.make(config.runtime.retryMaxAttempts),
            serviceName: "SparqlGenerator",
            timeout: Duration.millis(config.llm.timeoutMs),
            retrySchedule,
          }).pipe(
            Effect.mapError((error) =>
              SparqlGenerationError.make({
                message: `Failed to generate SPARQL: ${error._tag}`,
                question,
                cause: O.some(error),
              })
            )
          );

          const result = response.value;

          // Validate SPARQL syntax (basic validation)
          const syntaxError = validateSparqlSyntax(result.sparql);
          if (P.isNotUndefined(syntaxError)) {
            yield* Effect.logWarning("Generated SPARQL has syntax issues, attempting correction", {
              error: syntaxError.message,
            });

            // Attempt correction
            const corrected = yield* correctQuery(
              llm,
              result.sparql,
              syntaxError.message,
              schemaContext,
              config.runtime.retryMaxAttempts,
              config.llm.timeoutMs,
              retrySchedule
            ).pipe(
              Effect.mapError((error) =>
                SparqlGenerationError.make({
                  message: `SPARQL correction failed: ${error.message}`,
                  question,
                  cause: O.some(error),
                })
              )
            );

            yield* Effect.logInfo("SPARQL correction successful");

            return {
              ...result,
              sparql: corrected,
            };
          }

          yield* Effect.logInfo("SparqlGenerator.generate complete", {
            sparqlLength: result.sparql.length,
            confidence: result.confidence,
          });

          return result;
        }),

      /**
       * Correct a SPARQL query that has errors
       *
       * Uses LLM to analyze the error and generate a corrected query.
       *
       * @param sparql - The invalid SPARQL query
       * @param error - Error message or description
       * @param ontology - Ontology context for grounding
       * @returns Corrected SPARQL query
       */
      correct: (
        sparql: string,
        error: string,
        ontology: OntologyContext
      ): Effect.Effect<string, SparqlCorrectionError> =>
        Effect.gen(function* () {
          yield* Effect.logInfo("SparqlGenerator.correct starting", {
            sparqlLength: sparql.length,
            error,
          });

          const schemaContext = formatSchemaContext(ontology);

          const corrected = yield* correctQuery(
            llm,
            sparql,
            error,
            schemaContext,
            config.runtime.retryMaxAttempts,
            config.llm.timeoutMs,
            retrySchedule
          );

          yield* Effect.logInfo("SparqlGenerator.correct complete", {
            originalLength: sparql.length,
            correctedLength: corrected.length,
          });

          return corrected;
        }),

      /**
       * Validate SPARQL syntax
       *
       * Performs basic syntax validation without executing the query.
       * Returns undefined if valid, or an error description if invalid.
       *
       * @param sparql - SPARQL query to validate
       * @returns undefined if valid, SparqlSyntaxError if invalid
       */
      validate: (sparql: string): SparqlSyntaxError | undefined => validateSparqlSyntax(sparql),

      /**
       * Format ontology schema for LLM context
       *
       * Creates a human-readable schema description suitable for
       * inclusion in LLM prompts.
       *
       * @param ontology - Ontology context
       * @returns Formatted schema string
       */
      formatSchema: (ontology: OntologyContext): string => formatSchemaContext(ontology),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Format ontology schema as context for LLM prompt
 *
 * Creates a concise representation of classes and properties
 * suitable for the LLM to understand the knowledge graph structure.
 */
const formatSchemaContext = (ontology: OntologyContext): string => {
  const parts: Array<string> = [];

  // Format classes
  if (ontology.classes.length > 0) {
    parts.push("## Classes");
    for (const cls of ontology.classes) {
      const localName = extractLocalName(cls.id);
      const properties = cls.properties.map(extractLocalName).join(", ");
      parts.push(
        `- ${localName}: ${cls.comment || cls.label}${P.isTruthy(properties) ? ` [properties: ${properties}]` : ""}`
      );
    }
  }

  // Format properties grouped by type
  const objectProps = ontology.properties.filter((p) => p.rangeType === "object");
  const datatypeProps = ontology.properties.filter((p) => p.rangeType === "datatype");

  if (objectProps.length > 0) {
    parts.push("\n## Object Properties (link entities)");
    for (const prop of objectProps) {
      const localName = extractLocalName(prop.id);
      const domain = prop.domain.map(extractLocalName).join(", ") || "any";
      const range = prop.range.map(extractLocalName).join(", ") || "any";
      parts.push(`- ${localName}: ${domain} → ${range}${O.isSome(prop.comment) ? ` (${prop.comment})` : ""}`);
    }
  }

  if (datatypeProps.length > 0) {
    parts.push("\n## Datatype Properties (literal values)");
    for (const prop of datatypeProps) {
      const localName = extractLocalName(prop.id);
      const domain = prop.domain.map(extractLocalName).join(", ") || "any";
      const range = prop.range.map(extractLocalName).join(", ") || "string";
      parts.push(`- ${localName}: ${domain} → ${range}${O.isSome(prop.comment) ? ` (${prop.comment})` : ""}`);
    }
  }

  return parts.join("\n");
};

/**
 * Format namespace prefixes as SPARQL PREFIX declarations
 */
const formatPrefixes = (prefixes: Record<string, string>): string =>
  R.toEntries(prefixes)
    .map(([prefix, uri]) => `PREFIX ${prefix}: <${uri}>`)
    .join("\n");

/**
 * Build the SPARQL generation prompt
 */
const buildGenerationPrompt = (
  question: string,
  schemaContext: string,
  prefixDeclarations: string
): string => `You are a SPARQL query generator. Generate a valid SPARQL SELECT query to answer the given question based on the ontology schema.

## Ontology Schema
${schemaContext}

## Available Prefixes
${prefixDeclarations}

## Question
"${question}"

## Instructions
1. Generate a SPARQL SELECT query that answers the question
2. Use the classes and properties from the schema
3. Use appropriate prefixes (or full IRIs if prefix not available)
4. Include OPTIONAL for properties that might not exist
5. Use FILTER for text matching when searching by name/label
6. Return DISTINCT results when appropriate

## Response Format
Return a JSON object with:
- sparql: The complete SPARQL query string
- explanation: Brief explanation of the query logic (optional)
- confidence: Confidence score between 0 and 1

Generate the query now.`;

/**
 * Validate SPARQL syntax (basic validation)
 *
 * Performs lightweight validation without a full SPARQL parser.
 * Checks for common structural issues.
 */
const validateSparqlSyntax = (sparql: string): SparqlSyntaxError | undefined => {
  const trimmed = Str.trim(sparql);

  // Check for empty query
  if (P.not(P.isTruthy)(trimmed)) {
    return SparqlSyntaxError.make({
      message: "Empty query",
      sparql,
    });
  }

  // Check for SELECT keyword
  const upperQuery = trimmed.toUpperCase();
  if (!upperQuery.includes("SELECT") && !upperQuery.includes("ASK") && !upperQuery.includes("CONSTRUCT")) {
    return SparqlSyntaxError.make({
      message: "Query must contain SELECT, ASK, or CONSTRUCT",
      sparql,
    });
  }

  // Check for WHERE clause (required for SELECT)
  if (upperQuery.includes("SELECT") && !upperQuery.includes("WHERE")) {
    return SparqlSyntaxError.make({
      message: "SELECT query must contain WHERE clause",
      sparql,
    });
  }

  // Check for balanced braces
  const openBraces = (trimmed.match(/{/g) || []).length;
  const closeBraces = (trimmed.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    return SparqlSyntaxError.make({
      message: `Unbalanced braces: ${openBraces} open, ${closeBraces} close`,
      sparql,
    });
  }

  // Check for balanced parentheses
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    return SparqlSyntaxError.make({
      message: `Unbalanced parentheses: ${openParens} open, ${closeParens} close`,
      sparql,
    });
  }

  // Check for unclosed strings
  const singleQuotes = (trimmed.match(/'/g) || []).length;
  const doubleQuotes = (trimmed.match(/"/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    return SparqlSyntaxError.make({
      message: "Unclosed single-quoted string",
      sparql,
    });
  }
  if (doubleQuotes % 2 !== 0) {
    return SparqlSyntaxError.make({
      message: "Unclosed double-quoted string",
      sparql,
    });
  }

  return undefined;
};

/**
 * Correct a SPARQL query using LLM
 */
const correctQuery = (
  llm: LanguageModel.Service,
  sparql: string,
  error: string,
  schemaContext: string,
  maxAttempts: number,
  timeoutMs: number,
  retrySchedule: Schedule.Schedule<unknown, unknown, never>
): Effect.Effect<string, SparqlCorrectionError> =>
  Effect.gen(function* () {
    const prompt = buildCorrectionPrompt(sparql, error, schemaContext);

    const response = yield* generateObjectWithFeedback(llm, {
      prompt,
      schema: SparqlResponseSchema,
      objectName: "SparqlResponse",
      maxAttempts: PosInt.make(maxAttempts),
      serviceName: "SparqlGenerator.correct",
      timeout: Duration.millis(timeoutMs),
      retrySchedule,
    }).pipe(
      Effect.mapError(() =>
        SparqlCorrectionError.make({
          message: "Failed to correct SPARQL query",
          sparql,
          originalError: error,
        })
      )
    );

    const corrected = response.value.sparql;

    // Validate the corrected query
    const syntaxError = validateSparqlSyntax(corrected);
    if (P.isNotUndefined(syntaxError)) {
      return yield* SparqlCorrectionError.make({
        message: `Corrected query still has syntax errors: ${syntaxError.message}`,
        sparql: corrected,
        originalError: error,
      });
    }

    return corrected;
  });

/**
 * Build the SPARQL correction prompt
 */
const buildCorrectionPrompt = (
  sparql: string,
  error: string,
  schemaContext: string
): string => `You are a SPARQL query corrector. Fix the given SPARQL query based on the error message.

## Ontology Schema
${schemaContext}

## Original Query
\`\`\`sparql
${sparql}
\`\`\`

## Error
${error}

## Instructions
1. Analyze the error and identify the issue
2. Generate a corrected SPARQL query
3. Ensure the query is syntactically valid
4. Preserve the original intent of the query

## Response Format
Return a JSON object with:
- sparql: The corrected SPARQL query string
- explanation: What was wrong and how you fixed it
- confidence: Confidence score between 0 and 1

Generate the corrected query now.`;

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
