/**
 * Embedding Repository
 *
 * Effect-native repository for persistent embedding storage with hybrid search.
 * Uses pgvector for ANN search and PostgreSQL tsvector for BM25-like full-text.
 *
 * Features:
 * - Upsert semantics for embeddings (idempotent)
 * - Vector similarity search via IVFFlat index
 * - Hybrid search combining vector + text via RRF fusion
 * - Ontology-scoped storage
 *
 * @since 2.0.0
 * @module Repository/Embedding
 */

import { $ScratchpadId } from "@beep/identity"
import { DrizzleError } from "@beep/drizzle"
import { Context, Layer } from "effect"
const $I = $ScratchpadId.create("effect-ontology/Repository/Embedding")

import type { SqlError } from "effect/unstable/sql"
import { SqlClient } from "effect/unstable/sql"
import { PostgresDrizzle } from "@beep/postgres"
import { and, eq } from "drizzle-orm"
import { Effect, Option } from "effect"
import { embeddings } from "./schema.ts"
import type { EmbeddingRow } from "./schema.ts"

// =============================================================================
// Types
// =============================================================================

/**
 * Entity types that can have embeddings
 *
 * @since 2.0.0
 * @category Types
 */
export type EmbeddingEntityType = "class" | "entity" | "claim" | "example"

/**
 * Result from vector similarity search
 *
 * @since 2.0.0
 * @category Types
 */
export interface SimilarityResult {
  readonly entityId: string
  readonly entityType: EmbeddingEntityType
  readonly similarity: number
}

/**
 * Result from hybrid search (vector + text RRF fusion)
 *
 * @since 2.0.0
 * @category Types
 */
export interface HybridSearchResult {
  readonly entityId: string
  readonly entityType: EmbeddingEntityType
  readonly rrfScore: number
  readonly vectorRank: number
  readonly textRank: number
}

/**
 * Options for similarity search
 *
 * @since 2.0.0
 * @category Types
 */
export interface SimilaritySearchOptions {
  /** Number of results to return (default: 20) */
  readonly limit?: number
  /** Minimum cosine similarity threshold (default: 0.5) */
  readonly minSimilarity?: number
}

/**
 * Options for hybrid search
 *
 * @since 2.0.0
 * @category Types
 */
export interface HybridSearchOptions {
  /** Number of results to return (default: 20) */
  readonly limit?: number
  /** Weight for vector similarity (default: 0.6) */
  readonly vectorWeight?: number
  /** Weight for text search (default: 0.4) */
  readonly textWeight?: number
}

// =============================================================================
// Service
// =============================================================================

/**
 * Embedding Repository Service
 *
 * Provides persistent vector storage with hybrid search capabilities.
 *
 * @since 2.0.0
 * @category Service
 */
export class EmbeddingRepository extends Context.Service<EmbeddingRepository>()($I`EmbeddingRepository`, {
  make: Effect.gen(function*() {
    const drizzle = yield* PostgresDrizzle
    const sql = yield* SqlClient.SqlClient

    // -------------------------------------------------------------------------
    // Core CRUD Operations
    // -------------------------------------------------------------------------

    /**
     * Upsert an embedding (insert or update on conflict)
     *
     * @param ontologyId - Ontology scope
     * @param entityType - Type of entity (class, entity, claim, example)
     * @param entityId - Unique identifier within the type
     * @param embedding - Vector embedding (768 dimensions)
     * @param contentText - Optional text content for hybrid search
     * @param model - Embedding model used (default: nomic-embed-text-v1.5)
     */
    const upsert = (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      entityId: string,
      embedding: ReadonlyArray<number>,
      contentText?: string,
      model?: string
    ): Effect.Effect<EmbeddingRow, DrizzleError> =>
      Effect.gen(function*() {
        const vectorStr = formatVector(embedding)
        const result = yield* sql`
          INSERT INTO embeddings (
            ontology_id, entity_type, entity_id, embedding, content_text, model
          )
          VALUES (
            ${ontologyId},
            ${entityType},
            ${entityId},
            ${vectorStr}::vector,
            ${contentText ?? null},
            ${model ?? "nomic-embed-text-v1.5"}
          )
          ON CONFLICT (ontology_id, entity_type, entity_id) DO UPDATE SET
            embedding = ${vectorStr}::vector,
            content_text = COALESCE(${contentText ?? null}, embeddings.content_text),
            model = ${model ?? "nomic-embed-text-v1.5"},
            updated_at = NOW()
          RETURNING
            id,
            ontology_id as "ontologyId",
            entity_type as "entityType",
            entity_id as "entityId",
            content_text as "contentText",
            model,
            created_at as "createdAt",
            updated_at as "updatedAt"
        `
        return result[0] as EmbeddingRow
      }).pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)))

    /**
     * Get embedding by entity identifiers
     */
    const get = (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      entityId: string
    ): Effect.Effect<Option.Option<EmbeddingRow>, DrizzleError> =>
      Effect.gen(function*() {
        const [result] = yield* drizzle
            .select()
            .from(embeddings)
            .where(
              and(
                eq(embeddings.ontologyId, ontologyId),
                eq(embeddings.entityType, entityType),
                eq(embeddings.entityId, entityId)
              )
            )
            .limit(1)
        return Option.fromNullishOr(result)
      }).pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)))

    /**
     * Get embedding vector by entity identifiers
     * Returns just the vector for similarity operations
     */
    const getVector = (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      entityId: string
    ): Effect.Effect<Option.Option<ReadonlyArray<number>>, DrizzleError> =>
      Effect.gen(function*() {
        const result = yield* sql`
          SELECT embedding::text
          FROM embeddings
          WHERE ontology_id = ${ontologyId}
            AND entity_type = ${entityType}
            AND entity_id = ${entityId}
          LIMIT 1
        `
        if (result.length === 0) return Option.none()
        const vectorStr = (result[0] as { embedding: string }).embedding
        return Option.some(parseVector(vectorStr))
      }).pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)))

    /**
     * Delete embedding
     */
    const remove = (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      entityId: string
    ): Effect.Effect<void, DrizzleError> =>
      Effect.gen(function*() {
        yield* drizzle
            .delete(embeddings)
            .where(
              and(
                eq(embeddings.ontologyId, ontologyId),
                eq(embeddings.entityType, entityType),
                eq(embeddings.entityId, entityId)
              )
            )
      }).pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)))

    /**
     * Delete all embeddings for an ontology and entity type
     */
    const removeByType = (
      ontologyId: string,
      entityType: EmbeddingEntityType
    ): Effect.Effect<void, DrizzleError> =>
      Effect.gen(function*() {
        yield* drizzle
            .delete(embeddings)
            .where(
              and(
                eq(embeddings.ontologyId, ontologyId),
                eq(embeddings.entityType, entityType)
              )
            )
      }).pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)))

    // -------------------------------------------------------------------------
    // Batch Operations
    // -------------------------------------------------------------------------

    /**
     * Upsert multiple embeddings in batch
     *
     * @param items - Array of embedding items to upsert
     */
    const upsertBatch = (
      items: ReadonlyArray<{
        ontologyId: string
        entityType: EmbeddingEntityType
        entityId: string
        embedding: ReadonlyArray<number>
        contentText?: string
        model?: string
      }>
    ): Effect.Effect<number, DrizzleError> =>
      Effect.gen(function*() {
        if (items.length === 0) return 0

        // Use batched upsert with CTE for efficiency
        const values = items.map((item) => ({
          ontologyId: item.ontologyId,
          entityType: item.entityType,
          entityId: item.entityId,
          embedding: formatVector(item.embedding),
          contentText: item.contentText ?? null,
          model: item.model ?? "nomic-embed-text-v1.5"
        }))

        // Process in chunks of 100 for memory efficiency
        const chunkSize = 100
        let inserted = 0

        for (let i = 0; i < values.length; i += chunkSize) {
          const chunk = values.slice(i, i + chunkSize)
          yield* Effect.forEach(
            chunk,
            (item) =>
              upsert(
                item.ontologyId,
                item.entityType as EmbeddingEntityType,
                item.entityId,
                parseVector(item.embedding),
                item.contentText ?? undefined,
                item.model
              ),
            { concurrency: 10 }
          )
          inserted += chunk.length
        }

        return inserted
      })

    /**
     * Get multiple embeddings by entity IDs
     */
    const getMultiple = (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      entityIds: ReadonlyArray<string>
    ): Effect.Effect<ReadonlyArray<EmbeddingRow>, SqlError.SqlError> =>
      Effect.gen(function*() {
        if (entityIds.length === 0) return []
        const result = yield* sql`
          SELECT id, ontology_id, entity_type, entity_id, content_text, model, created_at, updated_at
          FROM embeddings
          WHERE ontology_id = ${ontologyId}
            AND entity_type = ${entityType}
            AND entity_id = ANY(${entityIds as Array<string>}::text[])
        `
        return result as unknown as ReadonlyArray<EmbeddingRow>
      })

    // -------------------------------------------------------------------------
    // Search Operations
    // -------------------------------------------------------------------------

    /**
     * Find similar embeddings using vector similarity (cosine distance)
     *
     * @param ontologyId - Ontology scope
     * @param entityType - Type of entities to search
     * @param queryEmbedding - Query vector (768 dimensions)
     * @param options - Search options (limit, minSimilarity)
     */
    const findSimilar = (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      queryEmbedding: ReadonlyArray<number>,
      options: SimilaritySearchOptions = {}
    ): Effect.Effect<ReadonlyArray<SimilarityResult>, SqlError.SqlError> =>
      Effect.gen(function*() {
        const { limit = 20, minSimilarity = 0.5 } = options
        const vectorStr = formatVector(queryEmbedding)

        const results = yield* sql`
          SELECT
            entity_id as "entityId",
            entity_type as "entityType",
            1 - (embedding <=> ${vectorStr}::vector) as similarity
          FROM embeddings
          WHERE ontology_id = ${ontologyId}
            AND entity_type = ${entityType}
            AND 1 - (embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT ${limit}
        `
        return results as unknown as ReadonlyArray<SimilarityResult>
      })

    /**
     * Hybrid search combining vector similarity and full-text search
     * Uses Reciprocal Rank Fusion (RRF) to combine results.
     *
     * @param ontologyId - Ontology scope
     * @param entityType - Type of entities to search
     * @param queryEmbedding - Query vector (768 dimensions)
     * @param queryText - Text query for full-text search
     * @param options - Search options (limit, weights)
     */
    const hybridSearch = (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      queryEmbedding: ReadonlyArray<number>,
      queryText: string,
      options: HybridSearchOptions = {}
    ): Effect.Effect<ReadonlyArray<HybridSearchResult>, SqlError.SqlError> =>
      Effect.gen(function*() {
        const { limit = 20, vectorWeight = 0.6, textWeight = 0.4 } = options
        const vectorStr = formatVector(queryEmbedding)

        // Use the PostgreSQL hybrid_search function defined in migration
        const results = yield* sql`
          SELECT * FROM hybrid_search(
            ${vectorStr}::vector,
            ${queryText},
            ${ontologyId},
            ${entityType},
            ${limit},
            ${vectorWeight},
            ${textWeight}
          )
        `

        return (results as unknown as Array<{
          entity_id: string
          entity_type: string
          rrf_score: number
          vector_rank: number
          text_rank: number
        }>).map((r) => ({
          entityId: r.entity_id,
          entityType: r.entity_type as EmbeddingEntityType,
          rrfScore: r.rrf_score,
          vectorRank: r.vector_rank,
          textRank: r.text_rank
        }))
      })

    /**
     * Full-text search only (no vector similarity)
     * Useful when query embedding is not available.
     */
    const textSearch = (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      queryText: string,
      limit: number = 20
    ): Effect.Effect<ReadonlyArray<{ entityId: string; rank: number }>, SqlError.SqlError> =>
      Effect.gen(function*() {
        const results = yield* sql`
          SELECT
            entity_id as "entityId",
            ts_rank(content_tsv, plainto_tsquery('english', ${queryText})) as rank
          FROM embeddings
          WHERE ontology_id = ${ontologyId}
            AND entity_type = ${entityType}
            AND content_tsv @@ plainto_tsquery('english', ${queryText})
          ORDER BY rank DESC
          LIMIT ${limit}
        `
        return results as unknown as ReadonlyArray<{ entityId: string; rank: number }>
      })

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    /**
     * Get embedding statistics for an ontology
     */
    const getStats = (ontologyId?: string): Effect.Effect<{
      totalCount: number
      byType: Record<EmbeddingEntityType, number>
      models: Record<string, number>
    }, SqlError.SqlError> =>
      Effect.gen(function*() {
        // Run all queries in parallel using Effect.all
        const [totalResult, byTypeResult, modelsResult] = yield* Effect.all([
          // Total count query
          ontologyId
            ? sql`SELECT COUNT(*)::int as count FROM embeddings WHERE ontology_id = ${ontologyId}`
            : sql`SELECT COUNT(*)::int as count FROM embeddings`,
          // By type query
          ontologyId
            ? sql`
                SELECT entity_type, COUNT(*)::int as count
                FROM embeddings WHERE ontology_id = ${ontologyId}
                GROUP BY entity_type
              `
            : sql`
                SELECT entity_type, COUNT(*)::int as count
                FROM embeddings
                GROUP BY entity_type
              `,
          // Models query
          ontologyId
            ? sql`
                SELECT model, COUNT(*)::int as count
                FROM embeddings WHERE ontology_id = ${ontologyId}
                GROUP BY model
              `
            : sql`
                SELECT model, COUNT(*)::int as count
                FROM embeddings
                GROUP BY model
              `
        ], { concurrency: "unbounded" })

        const byType: Record<EmbeddingEntityType, number> = {
          class: 0,
          entity: 0,
          claim: 0,
          example: 0
        }
        for (const row of byTypeResult as Array<{ entity_type: string; count: number }>) {
          byType[row.entity_type as EmbeddingEntityType] = row.count
        }

        const models: Record<string, number> = {}
        for (const row of modelsResult as Array<{ model: string; count: number }>) {
          models[row.model] = row.count
        }

        return {
          totalCount: (totalResult[0] as { count: number }).count,
          byType,
          models
        }
      })

    /**
     * Check if embeddings exist for a given entity type
     */
    const hasEmbeddings = (
      ontologyId: string,
      entityType: EmbeddingEntityType
    ): Effect.Effect<boolean, SqlError.SqlError> =>
      Effect.gen(function*() {
        const result = yield* sql`
          SELECT EXISTS(
            SELECT 1 FROM embeddings
            WHERE ontology_id = ${ontologyId}
              AND entity_type = ${entityType}
            LIMIT 1
          ) as exists
        `
        return (result[0] as { exists: boolean }).exists
      })

    return {
      // CRUD
      upsert,
      get,
      getVector,
      remove,
      removeByType,

      // Batch
      upsertBatch,
      getMultiple,

      // Search
      findSimilar,
      hybridSearch,
      textSearch,

      // Stats
      getStats,
      hasEmbeddings
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

/**
 * Parse PostgreSQL vector string to number array
 */
function parseVector(vectorStr: string): ReadonlyArray<number> {
  const cleaned = vectorStr.replace(/^\[|\]$/g, "")
  return cleaned.split(",").map(Number)
}
