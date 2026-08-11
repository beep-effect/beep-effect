/**
 * Entity Registry Repository
 *
 * Effect-native repository for the entity registry using Drizzle ORM.
 * Provides typed access to canonical entities, aliases, and blocking tokens
 * with support for pgvector similarity search.
 *
 * @since 2.0.0
 * @module Repository/EntityRegistry
 */

import { $ScratchpadId } from "@beep/identity"
import { Context, Layer } from "effect"
const $I = $ScratchpadId.create("effect-ontology/Repository/EntityRegistry")

import type { SqlError } from "effect/unstable/sql"
import { SqlClient } from "effect/unstable/sql"
import { PostgresDrizzle } from "@beep/postgres"
import { and, eq, inArray } from "drizzle-orm"
import { Effect, Option } from "effect"
import { canonicalEntities, entityAliases, entityBlockingTokens } from "./schema.ts"
import type {
  CanonicalEntityInsertRow,
  CanonicalEntityRow,
  EntityAliasInsertRow,
  EntityAliasRow,
  EntityBlockingTokenInsertRow
} from "./schema.ts"

// =============================================================================
// Types
// =============================================================================

export type CanonicalEntityId = string
export type EntityAliasId = string

/**
 * A candidate entity returned from blocking/similarity search
 */
export interface BlockingCandidate {
  readonly canonicalEntityId: string
  readonly iri: string
  readonly mention: string
  readonly types: ReadonlyArray<string>
  readonly similarity: number
}

export interface CanonicalEntityFilter {
  readonly ontologyId?: string
  readonly types?: ReadonlyArray<string>
  readonly limit?: number
  readonly offset?: number
}

// =============================================================================
// Service
// =============================================================================

export class EntityRegistryRepository extends Context.Service<EntityRegistryRepository>()($I`EntityRegistryRepository`, {
  make: Effect.gen(function*() {
    const drizzle = yield* PostgresDrizzle
    const sql = yield* SqlClient.SqlClient

    // -------------------------------------------------------------------------
    // Canonical Entity Operations
    // -------------------------------------------------------------------------

    /**
     * Insert a new canonical entity
     */
    const insertCanonicalEntity = (entity: CanonicalEntityInsertRow) =>
      Effect.gen(function*() {
        // Use raw SQL for vector column
        const result = yield* sql`
          INSERT INTO canonical_entities (ontology_id, iri, canonical_mention, types, embedding, merge_count, confidence_avg)
          VALUES (
            ${entity.ontologyId ?? "default"},
            ${entity.iri},
            ${entity.canonicalMention},
            ${entity.types}::text[],
            ${formatVector(entity.embedding)}::vector,
            ${entity.mergeCount ?? 1},
            ${entity.confidenceAvg ?? null}
          )
          RETURNING id, ontology_id, iri, canonical_mention, types, merge_count, confidence_avg,
                    first_seen_at, last_seen_at, created_at, updated_at
        `
        return result[0] as CanonicalEntityRow
      })

    /**
     * Get canonical entity by ID
     */
    const getCanonicalEntity = (id: CanonicalEntityId) =>
      Effect.gen(function*() {
        const [result] = yield* drizzle.select().from(canonicalEntities).where(eq(canonicalEntities.id, id)).limit(1)
        return Option.fromNullishOr(result)
      })

    /**
     * Get canonical entity by IRI
     */
    const getCanonicalEntityByIri = (iri: string) =>
      Effect.gen(function*() {
        const [result] = yield* drizzle.select().from(canonicalEntities).where(eq(canonicalEntities.iri, iri)).limit(1)
        return Option.fromNullishOr(result)
      })

    /**
     * Find similar canonical entities using pgvector ANN search
     *
     * @param ontologyId - Ontology scope for the search
     * @param embedding - Query embedding vector (768 dimensions)
     * @param options.types - Optional type filter (entities must have at least one matching type)
     * @param options.k - Number of candidates to return (default: 10)
     * @param options.minSimilarity - Minimum cosine similarity threshold (default: 0.7)
     */
    const findSimilarEntities = (
      ontologyId: string,
      embedding: ReadonlyArray<number>,
      options: {
        types?: ReadonlyArray<string>
        k?: number
        minSimilarity?: number
      } = {}
    ): Effect.Effect<Array<BlockingCandidate>, SqlError.SqlError> =>
      Effect.gen(function*() {
        const { k = 10, minSimilarity = 0.7, types } = options
        const vectorStr = formatVector(embedding)

        // Build query with ontology scoping and optional type filter
        const results = types && types.length > 0
          ? yield* sql`
              SELECT
                id as "canonicalEntityId",
                iri,
                canonical_mention as mention,
                types,
                1 - (embedding <=> ${vectorStr}::vector) as similarity
              FROM canonical_entities
              WHERE ontology_id = ${ontologyId}
                AND 1 - (embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
                AND types && ${types}::text[]
              ORDER BY embedding <=> ${vectorStr}::vector
              LIMIT ${k}
            `
          : yield* sql`
              SELECT
                id as "canonicalEntityId",
                iri,
                canonical_mention as mention,
                types,
                1 - (embedding <=> ${vectorStr}::vector) as similarity
              FROM canonical_entities
              WHERE ontology_id = ${ontologyId}
                AND 1 - (embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
              ORDER BY embedding <=> ${vectorStr}::vector
              LIMIT ${k}
            `

        return results as unknown as Array<BlockingCandidate>
      })

    /**
     * Find candidates via token blocking
     *
     * @param ontologyId - Ontology scope for the search
     * @param tokens - Blocking tokens to search for
     * @param k - Maximum number of candidates to return (default: 50)
     */
    const findCandidatesByTokens = (
      ontologyId: string,
      tokens: ReadonlyArray<string>,
      k: number = 50
    ): Effect.Effect<Array<BlockingCandidate>, SqlError.SqlError> =>
      Effect.gen(function*() {
        if (tokens.length === 0) return []

        const results = yield* sql`
          SELECT DISTINCT
            ce.id as "canonicalEntityId",
            ce.iri,
            ce.canonical_mention as mention,
            ce.types,
            0.0 as similarity
          FROM entity_blocking_tokens bt
          JOIN canonical_entities ce ON bt.canonical_entity_id = ce.id
          WHERE bt.ontology_id = ${ontologyId}
            AND bt.token = ANY(${tokens as Array<string>}::text[])
          LIMIT ${k}
        `

        return results as unknown as Array<BlockingCandidate>
      })

    /**
     * Update canonical entity after merge
     */
    const mergeIntoCanonical = (
      id: CanonicalEntityId,
      updates: {
        mergeCount?: number
        confidenceAvg?: number
      }
    ) =>
      Effect.gen(function*() {
        yield* sql`
          UPDATE canonical_entities
          SET
            merge_count = COALESCE(${updates.mergeCount ?? null}, merge_count),
            confidence_avg = COALESCE(${updates.confidenceAvg ?? null}, confidence_avg),
            last_seen_at = NOW(),
            updated_at = NOW()
          WHERE id = ${id}
        `
      })

    /**
     * Update last seen timestamp
     */
    const touchCanonicalEntity = (id: CanonicalEntityId) =>
      sql`
        UPDATE canonical_entities
        SET last_seen_at = NOW(), updated_at = NOW()
        WHERE id = ${id}
      `

    /**
     * Count total canonical entities
     */
    const countCanonicalEntities = () =>
      Effect.gen(function*() {
        const result = yield* sql`SELECT COUNT(*)::int as count FROM canonical_entities`
        return (result[0] as { count: number }).count
      })

    // -------------------------------------------------------------------------
    // Alias Operations
    // -------------------------------------------------------------------------

    /**
     * Insert an entity alias (upsert on ontology_id + mention_normalized)
     */
    const insertAlias = (alias: EntityAliasInsertRow) =>
      Effect.gen(function*() {
        const embeddingValue = alias.embedding ? formatVector(alias.embedding) : null

        const result = yield* sql`
          INSERT INTO entity_aliases (
            ontology_id, canonical_entity_id, mention, mention_normalized, embedding,
            resolution_method, resolution_confidence, first_batch_id, source_article_id
          )
          VALUES (
            ${alias.ontologyId ?? "default"},
            ${alias.canonicalEntityId},
            ${alias.mention},
            ${alias.mentionNormalized},
            ${embeddingValue}::vector,
            ${alias.resolutionMethod},
            ${alias.resolutionConfidence},
            ${alias.firstBatchId ?? null},
            ${alias.sourceArticleId ?? null}
          )
          ON CONFLICT (ontology_id, mention_normalized) DO UPDATE SET
            canonical_entity_id = EXCLUDED.canonical_entity_id,
            resolution_confidence = GREATEST(entity_aliases.resolution_confidence, EXCLUDED.resolution_confidence)
          RETURNING id, ontology_id, canonical_entity_id, mention, mention_normalized,
                    resolution_method, resolution_confidence, first_batch_id,
                    source_article_id, created_at
        `
        return result[0] as EntityAliasRow
      })

    /**
     * Find alias by exact mention (normalized) within an ontology
     *
     * @param ontologyId - Ontology scope for the search
     * @param mention - The mention to look up
     */
    const findAliasByMention = (ontologyId: string, mention: string) =>
      Effect.gen(function*() {
        const normalized = mention.toLowerCase().trim()
        const [result] = yield* drizzle
            .select()
            .from(entityAliases)
            .where(and(
              eq(entityAliases.ontologyId, ontologyId),
              eq(entityAliases.mentionNormalized, normalized)
            ))
            .limit(1)
        return Option.fromNullishOr(result)
      })

    /**
     * Get all aliases for a canonical entity
     */
    const getAliasesForCanonical = (canonicalId: CanonicalEntityId) =>
      drizzle
          .select()
          .from(entityAliases)
          .where(eq(entityAliases.canonicalEntityId, canonicalId))

    /**
     * Count aliases for a canonical entity
     */
    const countAliases = (canonicalId: CanonicalEntityId) =>
      Effect.gen(function*() {
        const result = yield* sql`
          SELECT COUNT(*)::int as count FROM entity_aliases
          WHERE canonical_entity_id = ${canonicalId}
        `
        return (result[0] as { count: number }).count
      })

    // -------------------------------------------------------------------------
    // Blocking Token Operations
    // -------------------------------------------------------------------------

    /**
     * Insert blocking tokens for a canonical entity
     *
     * @param ontologyId - Ontology scope for the tokens
     * @param canonicalId - The canonical entity ID
     * @param tokens - Tokens to insert
     */
    const insertBlockingTokens = (
      ontologyId: string,
      canonicalId: CanonicalEntityId,
      tokens: ReadonlyArray<string>
    ) =>
      Effect.gen(function*() {
        if (tokens.length === 0) return

        const values: Array<EntityBlockingTokenInsertRow> = tokens.map((token) => ({
          ontologyId,
          canonicalEntityId: canonicalId,
          token: token.toLowerCase(),
          tokenType: "mention" as const
        }))

        yield* drizzle.insert(entityBlockingTokens).values(values).onConflictDoNothing()
      })

    /**
     * Delete all blocking tokens for a canonical entity
     */
    const deleteBlockingTokens = (canonicalId: CanonicalEntityId) =>
      drizzle
          .delete(entityBlockingTokens)
          .where(eq(entityBlockingTokens.canonicalEntityId, canonicalId))

    /**
     * Rebuild blocking tokens for a canonical entity from its mention
     *
     * @param ontologyId - Ontology scope for the tokens
     * @param canonicalId - The canonical entity ID
     * @param mention - The mention to tokenize
     */
    const rebuildBlockingTokens = (ontologyId: string, canonicalId: CanonicalEntityId, mention: string) =>
      Effect.gen(function*() {
        yield* deleteBlockingTokens(canonicalId)
        const tokens = tokenize(mention)
        yield* insertBlockingTokens(ontologyId, canonicalId, tokens)
      })

    // -------------------------------------------------------------------------
    // Bulk Operations
    // -------------------------------------------------------------------------

    /**
     * Insert multiple canonical entities in a batch
     */
    const insertCanonicalEntitiesBatch = (entities: Array<CanonicalEntityInsertRow>) =>
      Effect.gen(function*() {
        if (entities.length === 0) return []
        // Process sequentially to handle vector columns properly
        return yield* Effect.all(
          entities.map(insertCanonicalEntity),
          { concurrency: 10 }
        )
      })

    /**
     * Get multiple canonical entities by IDs
     */
    const getCanonicalEntitiesByIds = (ids: Array<CanonicalEntityId>) =>
      Effect.gen(function*() {
        if (ids.length === 0) return []
        return yield* drizzle.select().from(canonicalEntities).where(inArray(canonicalEntities.id, ids))
      })

    /**
     * Get statistics about the entity registry
     *
     * @param ontologyId - Optional ontology scope. If provided, returns stats for that ontology only.
     */
    const getStats = (ontologyId?: string) =>
      Effect.gen(function*() {
        const result = ontologyId
          ? yield* sql`
              SELECT
                (SELECT COUNT(*)::int FROM canonical_entities WHERE ontology_id = ${ontologyId}) as entity_count,
                (SELECT COUNT(*)::int FROM entity_aliases WHERE ontology_id = ${ontologyId}) as alias_count,
                (SELECT COUNT(*)::int FROM entity_blocking_tokens WHERE ontology_id = ${ontologyId}) as token_count,
                (SELECT COALESCE(SUM(merge_count), 0)::int FROM canonical_entities WHERE ontology_id = ${ontologyId}) as total_merges
            `
          : yield* sql`
              SELECT
                (SELECT COUNT(*)::int FROM canonical_entities) as entity_count,
                (SELECT COUNT(*)::int FROM entity_aliases) as alias_count,
                (SELECT COUNT(*)::int FROM entity_blocking_tokens) as token_count,
                (SELECT COALESCE(SUM(merge_count), 0)::int FROM canonical_entities) as total_merges
            `
        return result[0] as {
          entity_count: number
          alias_count: number
          token_count: number
          total_merges: number
        }
      })

    return {
      // Canonical entities
      insertCanonicalEntity,
      getCanonicalEntity,
      getCanonicalEntityByIri,
      findSimilarEntities,
      findCandidatesByTokens,
      mergeIntoCanonical,
      touchCanonicalEntity,
      countCanonicalEntities,
      insertCanonicalEntitiesBatch,
      getCanonicalEntitiesByIds,

      // Aliases
      insertAlias,
      findAliasByMention,
      getAliasesForCanonical,
      countAliases,

      // Blocking tokens
      insertBlockingTokens,
      deleteBlockingTokens,
      rebuildBlockingTokens,

      // Stats
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

/**
 * Tokenize a mention for blocking index
 * - Lowercase
 * - Split on whitespace and punctuation
 * - Filter stop words and short tokens
 */
function tokenize(mention: string): Array<string> {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "been",
    "be",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "this",
    "that",
    "these",
    "those",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "inc",
    "corp",
    "llc",
    "ltd",
    "co",
    "company"
  ])

  return mention
    .toLowerCase()
    .split(/[\s\-_.,;:!?'"()[]{}]+/)
    .filter((token) => token.length > 2 && !stopWords.has(token))
}
