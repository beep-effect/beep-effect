/**
 * Examples Service
 *
 * Service for managing and retrieving few-shot examples for LLM prompting.
 * Implements hybrid retrieval (vector + lexical) with RRF fusion for
 * high-quality example selection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import type { DrizzleError } from "@beep/drizzle";
import { Context, Effect, Layer } from "effect";
import type * as O from "effect/Option";
import * as P from "effect/Predicate";
import type * as S from "effect/Schema";
import type { SqlError } from "effect/unstable/sql";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import type {
  CreateExampleInput,
  ExampleRetrievalOptions,
  ExampleType,
  ScoredExample,
} from "../Repository/Examples.ts";
import { ExamplesRepository } from "../Repository/Examples.ts";
import type { LlmExampleRow } from "../Repository/schema.ts";
import { EmbeddingService } from "./Embedding.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Examples");

// =============================================================================
// Types
// =============================================================================

/**
 * Combined error type for examples service operations
 */
export type ExamplesServiceError = SqlError.SqlError | DrizzleError | S.SchemaError | AnyEmbeddingError;

/**
 * Extraction stage for context-aware example retrieval
 */
export type ExtractionStage =
  | "entity_extraction"
  | "relation_extraction"
  | "entity_linking"
  | "validation"
  | "correction";

/**
 * Options for stage-based retrieval
 */
export interface StageRetrievalOptions {
  /** Maximum number of positive examples */
  readonly k?: number;
  /** Maximum number of negative examples */
  readonly negativeK?: number;
  /** Minimum similarity threshold */
  readonly minSimilarity?: number;
  /** Target class for filtering */
  readonly targetClass?: string;
  /** Target predicate for filtering */
  readonly targetPredicate?: string;
}

/**
 * Retrieved examples for a stage
 */
export interface StageExamples {
  readonly positives: ReadonlyArray<ScoredExample>;
  readonly negatives: ReadonlyArray<ScoredExample>;
}

/**
 * Example statistics
 */
export interface ExampleStats {
  readonly total: number;
  readonly byType: Record<string, number>;
  readonly negativeCount: number;
  readonly avgSuccessRate: number | null;
}

// =============================================================================
// Service
// =============================================================================

export class ExamplesService extends Context.Service<ExamplesService>()($I`ExamplesService`, {
  make: Effect.gen(function* () {
    const repository = yield* ExamplesRepository;
    const embeddingService = yield* EmbeddingService;

    /**
     * Retrieve examples using hybrid search (vector + lexical with RRF fusion)
     *
     * @param ontologyId - Ontology scope
     * @param exampleType - Type of examples to retrieve
     * @param queryText - Query text for similarity matching
     * @param options - Retrieval options
     */
    const retrieve = (
      ontologyId: string,
      exampleType: ExampleType,
      queryText: string,
      options: ExampleRetrievalOptions = {}
    ): Effect.Effect<ReadonlyArray<ScoredExample>, ExamplesServiceError> =>
      Effect.gen(function* () {
        const { includeNegatives = false, k = 5 } = options;

        // Embed query with ontology prefix for schema bias
        const prefixedQuery = `${ontologyId}: ${queryText}`;
        const embedding = yield* embeddingService.embed(prefixedQuery);

        // Run vector search
        const vectorResults = yield* repository.findSimilar(ontologyId, embedding, {
          ...options,
          k: k * 2, // Over-retrieve for RRF fusion
          includeNegatives: false,
        });

        // Get negative examples via lexical search if requested
        const negatives = includeNegatives ? yield* repository.findNegatives(ontologyId, queryText, k) : [];

        // Filter by example type
        const filtered = vectorResults.filter((e) => e.exampleType === exampleType);

        // Apply RRF to combine and rank (for future lexical component)
        // For now, just take top-k from vector search
        const positives = filtered.slice(0, k);

        // Merge positives and negatives, with positives first
        return [...positives, ...negatives];
      });

    /**
     * Retrieve examples for a specific extraction stage
     *
     * Maps stages to example types and handles stage-specific retrieval logic.
     *
     * @param ontologyId - Ontology scope
     * @param stage - Extraction pipeline stage
     * @param contextText - Context text for similarity matching
     * @param options - Retrieval options
     */
    const retrieveForStage = (
      ontologyId: string,
      stage: ExtractionStage,
      contextText: string,
      options: StageRetrievalOptions = {}
    ): Effect.Effect<StageExamples, ExamplesServiceError> =>
      Effect.gen(function* () {
        const { k = 3, minSimilarity = 0.6, negativeK = 2, targetClass, targetPredicate } = options;

        // Map stage to example type
        const exampleType = stageToExampleType(stage);

        // Embed context with ontology prefix
        const prefixedContext = `${ontologyId}: ${contextText}`;
        const embedding = yield* embeddingService.embed(prefixedContext);

        // Get positive examples
        const positives = yield* repository.findSimilar(ontologyId, embedding, {
          k,
          minSimilarity,
          ...(P.isUndefined(targetClass) ? {} : { targetClass }),
          ...(P.isUndefined(targetPredicate) ? {} : { targetPredicate }),
          includeNegatives: false,
        });

        // Filter to matching example type
        const filteredPositives = positives.filter((e) => e.exampleType === exampleType);

        // Get negative examples for entity extraction stage
        const negatives =
          stage === "entity_extraction" ? yield* repository.findNegatives(ontologyId, contextText, negativeK) : [];

        return {
          positives: filteredPositives.slice(0, k),
          negatives,
        };
      });

    /**
     * Retrieve only negative examples (for reducing over-generation)
     *
     * @param ontologyId - Ontology scope
     * @param contextText - Context text for lexical matching
     * @param k - Number of negative examples to return
     */
    const retrieveNegatives = (
      ontologyId: string,
      contextText: string,
      k: number = 5
    ): Effect.Effect<ReadonlyArray<ScoredExample>, ExamplesServiceError> =>
      repository.findNegatives(ontologyId, contextText, k);

    /**
     * Create a new example with automatic embedding generation
     *
     * @param input - Example creation input (without embedding)
     */
    const create = (input: Omit<CreateExampleInput, "embedding">): Effect.Effect<LlmExampleRow, ExamplesServiceError> =>
      Effect.gen(function* () {
        // Embed input text with ontology prefix
        const prefixedText = `${input.ontologyId}: ${input.inputText}`;
        const embedding = yield* embeddingService.embed(prefixedText);

        return yield* repository.create({
          ...input,
          embedding,
        });
      });

    /**
     * Record that an example was used and whether it was successful
     *
     * @param exampleId - ID of the example
     * @param wasSuccessful - Whether the extraction using this example succeeded
     */
    const recordUsage = (exampleId: string, wasSuccessful: boolean): Effect.Effect<void, SqlError.SqlError> =>
      repository.recordUsage(exampleId, wasSuccessful);

    /**
     * Get example by ID
     */
    const getById = (id: string): Effect.Effect<O.Option<LlmExampleRow>, DrizzleError> => repository.getById(id);

    /**
     * Get statistics for an ontology's examples
     *
     * @param ontologyId - Ontology scope
     */
    const stats = (ontologyId: string): Effect.Effect<ExampleStats, SqlError.SqlError> =>
      repository.getStats(ontologyId);

    /**
     * Deactivate an example (soft delete)
     */
    const deactivate = (id: string): Effect.Effect<void, DrizzleError> => repository.deactivate(id);

    return {
      retrieve,
      retrieveForStage,
      retrieveNegatives,
      create,
      recordUsage,
      getById,
      stats,
      deactivate,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Map extraction stage to example type
 */
function stageToExampleType(stage: ExtractionStage): ExampleType {
  switch (stage) {
    case "entity_extraction":
    case "validation":
    case "correction":
      return "entity_extraction";
    case "relation_extraction":
      return "relation_extraction";
    case "entity_linking":
      return "entity_linking";
  }
}
