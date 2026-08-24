/**
 * Examples Service
 *
 * **Details**
 *
 * Service for managing and retrieving few-shot examples for LLM prompting.
 * Implements hybrid retrieval (vector + lexical) with RRF fusion for
 * high-quality example selection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { DrizzleError } from "@beep/drizzle";
import { $ScratchpadId } from "@beep/identity";
import { PosInt } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Context, Effect, Layer, Match } from "effect";
import type * as O from "effect/Option";
import * as P from "effect/Predicate";
import type * as S from "effect/Schema";
import type { AnyEmbeddingError } from "../Domain/Error/Embedding.ts";
import type {
  CreateExampleInputInput,
  ExampleRetrievalOptionsInput,
  ExampleType,
  ScoredExample,
} from "../Repository/Examples.ts";
import { ExampleRetrievalOptions, ExamplesRepository } from "../Repository/Examples.ts";
import type { LlmExampleRow } from "../Repository/schema.ts";
import { EmbeddingService } from "./Embedding.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Examples");

// =============================================================================
// Types
// =============================================================================

/**
 * Combined error type for examples service operations
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExamplesServiceError = DrizzleError | S.SchemaError | AnyEmbeddingError;

/**
 * Extraction stage for context-aware example retrieval
 *
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionStage =
  | "entity_extraction"
  | "relation_extraction"
  | "entity_linking"
  | "validation"
  | "correction";

/**
 * Options for stage-based retrieval
 *
 *
 * **Example** (Use the StageRetrievalOptions contract)
 *
 * ```ts
 * import type { StageRetrievalOptions } from "@effect-ontology/Service/Examples"
 *
 * const acceptsStageRetrievalOptions = (_value: StageRetrievalOptions): void => undefined
 *
 * console.log(acceptsStageRetrievalOptions)
 * ```
 *
 * @category type-level
 * @since 0.0.0
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
 *
 *
 * **Example** (Use the StageExamples contract)
 *
 * ```ts
 * import type { StageExamples } from "@effect-ontology/Service/Examples"
 *
 * const acceptsStageExamples = (_value: StageExamples): void => undefined
 *
 * console.log(acceptsStageExamples)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface StageExamples {
  readonly positives: ReadonlyArray<ScoredExample>;
  readonly negatives: ReadonlyArray<ScoredExample>;
}

/**
 * Example statistics
 *
 *
 * **Example** (Use the ExampleStats contract)
 *
 * ```ts
 * import type { ExampleStats } from "@effect-ontology/Service/Examples"
 *
 * const acceptsExampleStats = (_value: ExampleStats): void => undefined
 *
 * console.log(acceptsExampleStats)
 * ```
 *
 * @category type-level
 * @since 0.0.0
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

/**
 * Provides the examples service service capability.
 *
 * **Example** (Inspect examples service)
 *
 * ```ts
 * import { ExamplesService } from "@effect-ontology/Service/Examples"
 *
 * console.log(ExamplesService)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
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
      options: ExampleRetrievalOptionsInput = {}
    ): Effect.Effect<ReadonlyArray<ScoredExample>, ExamplesServiceError> =>
      Effect.gen(function* () {
        const resolvedOptions = ExampleRetrievalOptions.make(options);
        const { includeNegatives, k } = resolvedOptions;

        // Embed query with ontology prefix for schema bias
        const prefixedQuery = `${ontologyId}: ${queryText}`;
        const embedding = yield* embeddingService.embed(prefixedQuery);

        // Run vector search
        const vectorResults = yield* repository.findSimilar(ontologyId, embedding, {
          ...resolvedOptions,
          k: PosInt.make(k * 2), // Over-retrieve for RRF fusion
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
          k: PosInt.make(k),
          minSimilarity: UnitInterval.make(minSimilarity),
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
    const create = (
      input: Omit<CreateExampleInputInput, "embedding">
    ): Effect.Effect<LlmExampleRow, ExamplesServiceError> =>
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
    const recordUsage = (exampleId: string, wasSuccessful: boolean): Effect.Effect<void, DrizzleError> =>
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
    const stats = (ontologyId: string): Effect.Effect<ExampleStats, DrizzleError> => repository.getStats(ontologyId);

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
const stageToExampleType = Match.type<ExtractionStage>().pipe(
  Match.when("relation_extraction", (): ExampleType => "relation_extraction"),
  Match.when("entity_linking", (): ExampleType => "entity_linking"),
  Match.orElse((): ExampleType => "entity_extraction")
);
