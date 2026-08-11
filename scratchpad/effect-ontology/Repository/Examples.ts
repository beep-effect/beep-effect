/**
 * Examples Repository
 *
 * Effect-native repository for LLM few-shot examples using Drizzle ORM.
 * Provides hybrid retrieval (vector similarity + lexical search) for
 * ontology-scoped examples.
 *
 * @since 2.0.0
 * @module Repository/Examples
 */

import { $ScratchpadId } from "@beep/identity"
import { DrizzleError } from "@beep/drizzle"
import { Context, Layer } from "effect"
const $I = $ScratchpadId.create("effect-ontology/Repository/Examples")

import type { SqlError } from "effect/unstable/sql"
import { SqlClient } from "effect/unstable/sql"
import { PostgresDrizzle } from "@beep/postgres"
import { and, desc, eq } from "drizzle-orm"
import { Effect, Option } from "effect"
import { llmExamples } from "./schema.ts"
import type { LlmExampleRow } from "./schema.ts"

// =============================================================================
// Types
// =============================================================================

export type ExampleId = string

/**
 * Example types for few-shot learning
 */
export type ExampleType =
  | "entity_extraction"
  | "relation_extraction"
  | "entity_linking"
  | "negative"

/**
 * Example source (how the example was created)
 */
export type ExampleSource =
  | "manual"
  | "validated"
  | "auto_generated"

/**
 * A scored example from retrieval
 */
export interface ScoredExample {
  readonly id: string
  readonly ontologyId: string
  readonly exampleType: ExampleType
  readonly inputText: string
  readonly expectedOutput: Record<string, unknown>
  readonly promptMessages?: ReadonlyArray<{ role: string; content: string }>
  readonly explanation?: string
  readonly isNegative: boolean
  readonly similarity: number
  readonly usageCount: number
}

/**
 * Options for example retrieval
 */
export interface ExampleRetrievalOptions {
  /** Maximum number of examples to return */
  readonly k?: number
  /** Minimum similarity threshold (default: 0.6) */
  readonly minSimilarity?: number
  /** Filter by target class */
  readonly targetClass?: string
  /** Filter by target predicate */
  readonly targetPredicate?: string
  /** Whether to include negative examples */
  readonly includeNegatives?: boolean
}

/**
 * Input for creating a new example
 */
export interface CreateExampleInput {
  readonly ontologyId: string
  readonly exampleType: ExampleType
  readonly source?: ExampleSource
  readonly inputText: string
  readonly targetClass?: string
  readonly targetPredicate?: string
  readonly evidenceText?: string
  readonly evidenceStartOffset?: number
  readonly evidenceEndOffset?: number
  readonly expectedOutput: Record<string, unknown>
  readonly promptMessages?: ReadonlyArray<{ role: string; content: string }>
  readonly explanation?: string
  readonly embedding: ReadonlyArray<number>
  readonly isNegative?: boolean
  readonly negativePattern?: string
  readonly createdBy?: string
}

// =============================================================================
// Service
// =============================================================================

export class ExamplesRepository extends Context.Service<ExamplesRepository>()($I`ExamplesRepository`, {
  make: Effect.gen(function*() {
    const drizzle = yield* PostgresDrizzle
    const sql = yield* SqlClient.SqlClient

    // -------------------------------------------------------------------------
    // Insert Operations
    // -------------------------------------------------------------------------

    /**
     * Create a new example
     */
    const create = (input: CreateExampleInput): Effect.Effect<LlmExampleRow, SqlError.SqlError> =>
      Effect.gen(function*() {
        const vectorStr = formatVector(input.embedding)

        const result = yield* sql`
          INSERT INTO llm_examples (
            ontology_id, example_type, source,
            input_text, target_class, target_predicate,
            evidence_text, evidence_start_offset, evidence_end_offset,
            expected_output, prompt_messages, explanation,
            embedding, is_negative, negative_pattern, created_by
          )
          VALUES (
            ${input.ontologyId},
            ${input.exampleType},
            ${input.source ?? "manual"},
            ${input.inputText},
            ${input.targetClass ?? null},
            ${input.targetPredicate ?? null},
            ${input.evidenceText ?? null},
            ${input.evidenceStartOffset ?? null},
            ${input.evidenceEndOffset ?? null},
            ${JSON.stringify(input.expectedOutput)}::jsonb,
            ${input.promptMessages ? JSON.stringify(input.promptMessages) : null}::jsonb,
            ${input.explanation ?? null},
            ${vectorStr}::vector,
            ${input.isNegative ?? false},
            ${input.negativePattern ?? null},
            ${input.createdBy ?? null}
          )
          RETURNING *
        `
        return result[0] as LlmExampleRow
      })

    // -------------------------------------------------------------------------
    // Read Operations
    // -------------------------------------------------------------------------

    /**
     * Get example by ID
     */
    const getById = (id: ExampleId): Effect.Effect<Option.Option<LlmExampleRow>, DrizzleError> =>
      Effect.gen(function*() {
        const [result] = yield* drizzle
          .select()
          .from(llmExamples)
          .where(eq(llmExamples.id, id))
          .limit(1)
          .pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)))
        return Option.fromNullishOr(result)
      })

    /**
     * Find similar examples using vector search
     */
    const findSimilar = (
      ontologyId: string,
      embedding: ReadonlyArray<number>,
      options: ExampleRetrievalOptions = {}
    ): Effect.Effect<Array<ScoredExample>, SqlError.SqlError> =>
      Effect.gen(function*() {
        const { includeNegatives = false, k = 5, minSimilarity = 0.6, targetClass, targetPredicate } = options
        const vectorStr = formatVector(embedding)

        // Build dynamic query based on filters
        let query = `
          SELECT
            id, ontology_id as "ontologyId", example_type as "exampleType",
            input_text as "inputText", expected_output as "expectedOutput",
            prompt_messages as "promptMessages", explanation,
            is_negative as "isNegative", usage_count as "usageCount",
            1 - (embedding <=> $1::vector) as similarity
          FROM llm_examples
          WHERE ontology_id = $2
            AND is_active = true
            AND 1 - (embedding <=> $1::vector) >= $3
        `
        const params: Array<unknown> = [vectorStr, ontologyId, minSimilarity]
        let paramIdx = 4

        if (!includeNegatives) {
          query += ` AND is_negative = false`
        }

        if (targetClass) {
          query += ` AND target_class = $${paramIdx}`
          params.push(targetClass)
          paramIdx++
        }

        if (targetPredicate) {
          query += ` AND target_predicate = $${paramIdx}`
          params.push(targetPredicate)
          paramIdx++
        }

        query += ` ORDER BY embedding <=> $1::vector LIMIT $${paramIdx}`
        params.push(k)

        const results = yield* sql.unsafe(query, params)
        return results as unknown as Array<ScoredExample>
      })

    /**
     * Find negative examples using lexical search (for pattern matching)
     */
    const findNegatives = (
      ontologyId: string,
      queryText: string,
      k: number = 5
    ): Effect.Effect<Array<ScoredExample>, SqlError.SqlError> =>
      Effect.gen(function*() {
        // Use trigram similarity for fuzzy matching
        const results = yield* sql`
          SELECT
            id, ontology_id as "ontologyId", example_type as "exampleType",
            input_text as "inputText", expected_output as "expectedOutput",
            prompt_messages as "promptMessages", explanation,
            is_negative as "isNegative", usage_count as "usageCount",
            similarity(input_text, ${queryText}) as similarity
          FROM llm_examples
          WHERE ontology_id = ${ontologyId}
            AND is_active = true
            AND is_negative = true
            AND similarity(input_text, ${queryText}) > 0.1
          ORDER BY similarity(input_text, ${queryText}) DESC
          LIMIT ${k}
        `
        return results as unknown as Array<ScoredExample>
      })

    /**
     * Get examples by type for an ontology
     */
    const getByType = (
      ontologyId: string,
      exampleType: ExampleType,
      limit: number = 100
    ): Effect.Effect<Array<LlmExampleRow>, DrizzleError> =>
      drizzle
        .select()
        .from(llmExamples)
        .where(and(
          eq(llmExamples.ontologyId, ontologyId),
          eq(llmExamples.exampleType, exampleType),
          eq(llmExamples.isActive, true)
        ))
        .orderBy(desc(llmExamples.usageCount))
        .limit(limit)
        .pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)))

    // -------------------------------------------------------------------------
    // Update Operations
    // -------------------------------------------------------------------------

    /**
     * Record example usage and update success rate
     */
    const recordUsage = (
      id: ExampleId,
      wasSuccessful: boolean
    ): Effect.Effect<void, SqlError.SqlError> =>
      Effect.gen(function*() {
        // Update usage count and recalculate success rate
        yield* sql`
          UPDATE llm_examples
          SET
            usage_count = usage_count + 1,
            success_rate = CASE
              WHEN usage_count = 0 THEN ${wasSuccessful ? 1.0 : 0.0}::numeric(4,3)
              ELSE (success_rate * usage_count + ${wasSuccessful ? 1.0 : 0.0}) / (usage_count + 1)
            END
          WHERE id = ${id}
        `
      })

    /**
     * Deactivate an example (soft delete)
     */
    const deactivate = (id: ExampleId): Effect.Effect<void, DrizzleError> =>
      drizzle
        .update(llmExamples)
        .set({ isActive: false })
        .where(eq(llmExamples.id, id))
        .pipe(
          Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)),
          Effect.asVoid
        )

    // -------------------------------------------------------------------------
    // Stats
    // -------------------------------------------------------------------------

    /**
     * Get example statistics for an ontology
     */
    const getStats = (ontologyId: string): Effect.Effect<{
      total: number
      byType: Record<string, number>
      negativeCount: number
      avgSuccessRate: number | null
    }, SqlError.SqlError> =>
      Effect.gen(function*() {
        const result = yield* sql`
          SELECT
            COUNT(*)::int as total,
            COUNT(CASE WHEN is_negative THEN 1 END)::int as negative_count,
            AVG(success_rate) as avg_success_rate,
            jsonb_object_agg(
              example_type,
              type_count
            ) as by_type
          FROM (
            SELECT
              example_type,
              COUNT(*)::int as type_count,
              is_negative,
              success_rate
            FROM llm_examples
            WHERE ontology_id = ${ontologyId} AND is_active = true
            GROUP BY example_type, is_negative, success_rate
          ) sub
        `
        const row = result[0] as {
          total: number
          negative_count: number
          avg_success_rate: number | null
          by_type: Record<string, number> | null
        }

        return {
          total: row.total ?? 0,
          byType: row.by_type ?? {},
          negativeCount: row.negative_count ?? 0,
          avgSuccessRate: row.avg_success_rate
        }
      })

    return {
      create,
      getById,
      findSimilar,
      findNegatives,
      getByType,
      recordUsage,
      deactivate,
      getStats
    }
  }),
}) {
  static readonly Default = Layer.effect(this, this.make)
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format a vector array as PostgreSQL vector literal
 */
function formatVector(vector: ReadonlyArray<number>): string {
  return `[${vector.join(",")}]`
}
