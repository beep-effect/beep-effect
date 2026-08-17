/**
 * Entity Registry Repository
 *
 * **Details**
 *
 * Effect-native repository for the entity registry using Drizzle ORM.
 * Provides typed access to canonical entities, aliases, and blocking tokens
 * with support for pgvector similarity search.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Effect, HashSet, Layer } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SqlError from "effect/unstable/sql/SqlError";

const $I = $ScratchpadId.create("effect-ontology/Repository/EntityRegistry");

import { PostgresDrizzle } from "@beep/postgres";
import { and, eq, inArray } from "drizzle-orm";
import { SqlClient } from "effect/unstable/sql";
import type {
  CanonicalEntityInsertRow,
  CanonicalEntityRow,
  EntityAliasInsertRow,
  EntityAliasRow,
  EntityBlockingTokenInsertRow,
} from "./schema.ts";
import { canonicalEntities, entityAliases, entityBlockingTokens } from "./schema.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Describes the canonical entity id data exposed by this module.
 *
 * **Example** (Create CanonicalEntityId)
 *
 * ```ts
 * import type { CanonicalEntityId } from "@effect-ontology/Repository/EntityRegistry"
 *
 * const canonicalEntityId: CanonicalEntityId = "canonical-entity-id-1"
 *
 * console.log(canonicalEntityId)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CanonicalEntityId = string;
/**
 * Describes the entity alias id data exposed by this module.
 *
 * **Example** (Create EntityAliasId)
 *
 * ```ts
 * import type { EntityAliasId } from "@effect-ontology/Repository/EntityRegistry"
 *
 * const entityAliasId: EntityAliasId = "entity-alias-id-1"
 *
 * console.log(entityAliasId)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EntityAliasId = string;

/**
 * A candidate entity returned from blocking/similarity search
 *
 * **Example** (Reference BlockingCandidate fields)
 *
 * ```ts
 * import type { BlockingCandidate } from "@effect-ontology/Repository/EntityRegistry"
 *
 * const blockingCandidateFields: ReadonlyArray<keyof BlockingCandidate> = ["canonicalEntityId", "iri", "mention"]
 *
 * console.log(blockingCandidateFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface BlockingCandidate {
  readonly canonicalEntityId: string;
  readonly iri: string;
  readonly mention: string;
  readonly types: ReadonlyArray<string>;
  readonly similarity: number;
}

/**
 * Describes the canonical entity filter data exposed by this module.
 *
 * **Example** (Reference CanonicalEntityFilter fields)
 *
 * ```ts
 * import type { CanonicalEntityFilter } from "@effect-ontology/Repository/EntityRegistry"
 *
 * const canonicalEntityFilterFields: ReadonlyArray<keyof CanonicalEntityFilter> = ["ontologyId", "types", "limit"]
 *
 * console.log(canonicalEntityFilterFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface CanonicalEntityFilter {
  readonly ontologyId?: string;
  readonly types?: ReadonlyArray<string>;
  readonly limit?: number;
  readonly offset?: number;
}

const PgVector = S.Finite.pipe(
  S.Array,
  S.fromJsonString,
  $I.annoteSchema("PgVector", {
    description: "PostgreSQL pgvector text decoded to a finite numeric vector.",
  })
);

const CanonicalEntitySqlRow = S.Struct({
  id: S.String,
  ontologyId: S.String,
  iri: S.String,
  canonicalMention: S.String,
  types: S.String.pipe(S.Array, S.mutable),
  embedding: PgVector,
  mergeCount: S.NullOr(S.Int),
  confidenceAvg: S.NullOr(S.String),
  firstSeenAt: S.NullOr(S.Date),
  lastSeenAt: S.NullOr(S.Date),
  createdAt: S.NullOr(S.Date),
  updatedAt: S.NullOr(S.Date),
}).pipe(
  $I.annoteSchema("CanonicalEntitySqlRow", {
    description: "Decoded canonical-entity row returned by raw PostgreSQL queries.",
  })
);

const EntityAliasSqlRow = S.Struct({
  id: S.String,
  ontologyId: S.String,
  canonicalEntityId: S.String,
  mention: S.String,
  mentionNormalized: S.String,
  embedding: S.NullOr(PgVector),
  resolutionMethod: S.String,
  resolutionConfidence: S.String,
  firstBatchId: S.NullOr(S.String),
  sourceArticleId: S.NullOr(S.String),
  createdAt: S.NullOr(S.Date),
}).pipe(
  $I.annoteSchema("EntityAliasSqlRow", {
    description: "Decoded entity-alias row returned by raw PostgreSQL queries.",
  })
);

const BlockingCandidateSqlRow = S.Struct({
  canonicalEntityId: S.String,
  iri: S.String,
  mention: S.String,
  types: S.Array(S.String),
  similarity: S.Finite,
}).pipe(
  $I.annoteSchema("BlockingCandidateSqlRow", {
    description: "Decoded blocking or vector-search candidate returned by PostgreSQL.",
  })
);

const CountSqlRow = S.Struct({ count: S.Int }).pipe(
  $I.annoteSchema("CountSqlRow", {
    description: "Decoded integer count projection returned by PostgreSQL.",
  })
);

const RegistryStatsSqlRow = S.Struct({
  entityCount: S.Int,
  aliasCount: S.Int,
  tokenCount: S.Int,
  totalMerges: S.Int,
}).pipe(
  $I.annoteSchema("RegistryStatsSqlRow", {
    description: "Decoded aggregate statistics for the entity registry.",
  })
);

const decodeOneCanonicalEntitySqlRow = S.decodeUnknownEffect(S.Tuple([CanonicalEntitySqlRow]));
const decodeOneEntityAliasSqlRow = S.decodeUnknownEffect(S.Tuple([EntityAliasSqlRow]));
const decodeBlockingCandidateSqlRows = S.decodeUnknownEffect(S.mutable(S.Array(BlockingCandidateSqlRow)));
const decodeOneCountSqlRow = S.decodeUnknownEffect(S.Tuple([CountSqlRow]));
const decodeOneRegistryStatsSqlRow = S.decodeUnknownEffect(S.Tuple([RegistryStatsSqlRow]));

// =============================================================================
// Service
// =============================================================================

/**
 * Provides repository access for entity registry repository.
 *
 * **Example** (Inspect entity registry repository)
 *
 * ```ts
 * import { EntityRegistryRepository } from "@effect-ontology/Repository/EntityRegistry"
 *
 * console.log(EntityRegistryRepository)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class EntityRegistryRepository extends Context.Service<EntityRegistryRepository>()(
  $I`EntityRegistryRepository`,
  {
    make: Effect.gen(function* () {
      const drizzle = yield* PostgresDrizzle;
      const sql = yield* SqlClient.SqlClient;

      // -------------------------------------------------------------------------
      // Canonical Entity Operations
      // -------------------------------------------------------------------------

      /**
       * Insert a new canonical entity
       */
      const insertCanonicalEntity = Effect.fn("insertCanonicalEntity")(function* (
        entity: CanonicalEntityInsertRow
      ): Effect.fn.Return<CanonicalEntityRow, SqlError.SqlError> {
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
          RETURNING id,
                    ontology_id as "ontologyId",
                    iri,
                    canonical_mention as "canonicalMention",
                    types,
                    embedding::text as embedding,
                    merge_count as "mergeCount",
                    confidence_avg as "confidenceAvg",
                    first_seen_at as "firstSeenAt",
                    last_seen_at as "lastSeenAt",
                    created_at as "createdAt",
                    updated_at as "updatedAt"
        `;
        const [row] = yield* decodeOneCanonicalEntitySqlRow(result).pipe(
          Effect.mapError((cause) => toSqlError("EntityRegistryRepository.insertCanonicalEntity", cause))
        );
        return row;
      });

      /**
       * Get canonical entity by ID
       */
      const getCanonicalEntity = Effect.fn("getCanonicalEntity")(function* (id: CanonicalEntityId) {
        const [result] = yield* drizzle.select().from(canonicalEntities).where(eq(canonicalEntities.id, id)).limit(1);
        return O.fromNullishOr(result);
      });

      /**
       * Get canonical entity by IRI
       */
      const getCanonicalEntityByIri = Effect.fn("getCanonicalEntityByIri")(function* (
        iri: string,
        ontologyId?: string
      ) {
        const conditions = [eq(canonicalEntities.iri, iri)];
        if (P.isNotUndefined(ontologyId)) {
          conditions.push(eq(canonicalEntities.ontologyId, ontologyId));
        }
        const [result] = yield* drizzle
          .select()
          .from(canonicalEntities)
          .where(and(...conditions))
          .limit(1);
        return O.fromNullishOr(result);
      });

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
          types?: ReadonlyArray<string>;
          k?: number;
          minSimilarity?: number;
        } = {}
      ): Effect.Effect<Array<BlockingCandidate>, SqlError.SqlError> =>
        Effect.gen(function* () {
          const { k = 10, minSimilarity = 0.7, types } = options;
          const vectorStr = formatVector(embedding);

          // Build query with ontology scoping and optional type filter
          const results =
            P.isNotUndefined(types) && types.length > 0
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
            `;

          return yield* decodeBlockingCandidateSqlRows(results);
        }).pipe(Effect.mapError((cause) => toSqlError("EntityRegistryRepository.findSimilarEntities", cause)));

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
        Effect.gen(function* () {
          if (tokens.length === 0) return [];

          const results = yield* sql`
          SELECT DISTINCT
            ce.id as "canonicalEntityId",
            ce.iri,
            ce.canonical_mention as mention,
            ce.types,
            0.0::double precision as similarity
          FROM entity_blocking_tokens bt
          JOIN canonical_entities ce ON bt.canonical_entity_id = ce.id
          WHERE bt.ontology_id = ${ontologyId}
            AND bt.token = ANY(${tokens}::text[])
          LIMIT ${k}
        `;

          return yield* decodeBlockingCandidateSqlRows(results);
        }).pipe(Effect.mapError((cause) => toSqlError("EntityRegistryRepository.findCandidatesByTokens", cause)));

      /**
       * Update canonical entity after merge
       */
      const mergeIntoCanonical = Effect.fn("mergeIntoCanonical")(function* (
        id: CanonicalEntityId,
        updates: {
          mergeCount?: number;
          confidenceAvg?: number;
        }
      ) {
        yield* sql`
          UPDATE canonical_entities
          SET
            merge_count = COALESCE(${updates.mergeCount ?? null}, merge_count),
            confidence_avg = COALESCE(${updates.confidenceAvg ?? null}, confidence_avg),
            last_seen_at = NOW(),
            updated_at = NOW()
          WHERE id = ${id}
        `;
      });

      /**
       * Update last seen timestamp
       */
      const touchCanonicalEntity = (id: CanonicalEntityId) =>
        sql`
        UPDATE canonical_entities
        SET last_seen_at = NOW(), updated_at = NOW()
        WHERE id = ${id}
      `;

      /**
       * Count total canonical entities
       */
      const countCanonicalEntities = Effect.fn("countCanonicalEntities")(function* () {
        const result = yield* sql`SELECT COUNT(*)::int as count FROM canonical_entities`;
        const [row] = yield* decodeOneCountSqlRow(result).pipe(
          Effect.mapError((cause) => toSqlError("EntityRegistryRepository.countCanonicalEntities", cause))
        );
        return row.count;
      });

      // -------------------------------------------------------------------------
      // Alias Operations
      // -------------------------------------------------------------------------

      /**
       * Insert an entity alias (upsert on ontology_id + mention_normalized)
       */
      const insertAlias = Effect.fn("insertAlias")(function* (
        alias: EntityAliasInsertRow
      ): Effect.fn.Return<EntityAliasRow, SqlError.SqlError> {
        const embeddingValue = P.isNotNullish(alias.embedding) ? formatVector(alias.embedding) : null;
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
          RETURNING id,
                    ontology_id as "ontologyId",
                    canonical_entity_id as "canonicalEntityId",
                    mention,
                    mention_normalized as "mentionNormalized",
                    embedding::text as embedding,
                    resolution_method as "resolutionMethod",
                    resolution_confidence as "resolutionConfidence",
                    first_batch_id as "firstBatchId",
                    source_article_id as "sourceArticleId",
                    created_at as "createdAt"
        `;
        const [row] = yield* decodeOneEntityAliasSqlRow(result).pipe(
          Effect.mapError((cause) => toSqlError("EntityRegistryRepository.insertAlias", cause))
        );
        return row;
      });

      /**
       * Find alias by exact mention (normalized) within an ontology
       *
       * @param ontologyId - Ontology scope for the search
       * @param mention - The mention to look up
       */
      const findAliasByMention = Effect.fn("findAliasByMention")(function* (ontologyId: string, mention: string) {
        const normalized = mention.toLowerCase().trim();
        const [result] = yield* drizzle
          .select()
          .from(entityAliases)
          .where(and(eq(entityAliases.ontologyId, ontologyId), eq(entityAliases.mentionNormalized, normalized)))
          .limit(1);
        return O.fromNullishOr(result);
      });

      /**
       * Get all aliases for a canonical entity
       */
      const getAliasesForCanonical = (canonicalId: CanonicalEntityId) =>
        drizzle.select().from(entityAliases).where(eq(entityAliases.canonicalEntityId, canonicalId));

      /**
       * Count aliases for a canonical entity
       */
      const countAliases = Effect.fn("countAliases")(function* (canonicalId: CanonicalEntityId) {
        const result = yield* sql`
          SELECT COUNT(*)::int as count FROM entity_aliases
          WHERE canonical_entity_id = ${canonicalId}
        `;
        const [row] = yield* decodeOneCountSqlRow(result).pipe(
          Effect.mapError((cause) => toSqlError("EntityRegistryRepository.countAliases", cause))
        );
        return row.count;
      });

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
      const insertBlockingTokens = Effect.fn("insertBlockingTokens")(function* (
        ontologyId: string,
        canonicalId: CanonicalEntityId,
        tokens: ReadonlyArray<string>
      ) {
        if (tokens.length === 0) return;
        const values: Array<EntityBlockingTokenInsertRow> = tokens.map((token) => ({
          ontologyId,
          canonicalEntityId: canonicalId,
          token: token.toLowerCase(),
          tokenType: "mention",
        }));
        yield* drizzle.insert(entityBlockingTokens).values(values).onConflictDoNothing();
      });

      /**
       * Delete all blocking tokens for a canonical entity
       */
      const deleteBlockingTokens = (canonicalId: CanonicalEntityId) =>
        drizzle.delete(entityBlockingTokens).where(eq(entityBlockingTokens.canonicalEntityId, canonicalId));

      /**
       * Rebuild blocking tokens for a canonical entity from its mention
       *
       * @param ontologyId - Ontology scope for the tokens
       * @param canonicalId - The canonical entity ID
       * @param mention - The mention to tokenize
       */
      const rebuildBlockingTokens = Effect.fn("rebuildBlockingTokens")(function* (
        ontologyId: string,
        canonicalId: CanonicalEntityId,
        mention: string
      ) {
        yield* deleteBlockingTokens(canonicalId);
        const tokens = tokenize(mention);
        yield* insertBlockingTokens(ontologyId, canonicalId, tokens);
      });

      // -------------------------------------------------------------------------
      // Bulk Operations
      // -------------------------------------------------------------------------

      /**
       * Insert multiple canonical entities in a batch
       */
      const insertCanonicalEntitiesBatch = Effect.fn("insertCanonicalEntitiesBatch")(function* (
        entities: Array<CanonicalEntityInsertRow>
      ) {
        if (entities.length === 0) return [];
        return yield* Effect.all(entities.map(insertCanonicalEntity), { concurrency: 10 });
      });

      /**
       * Get multiple canonical entities by IDs
       */
      const getCanonicalEntitiesByIds = Effect.fn("getCanonicalEntitiesByIds")(function* (
        ids: Array<CanonicalEntityId>
      ) {
        if (ids.length === 0) return [];
        return yield* drizzle.select().from(canonicalEntities).where(inArray(canonicalEntities.id, ids));
      });

      /**
       * Get statistics about the entity registry
       *
       * @param ontologyId - Optional ontology scope. If provided, returns stats for that ontology only.
       */
      const getStats = Effect.fn("getStats")(function* (ontologyId?: string) {
        const result = P.isNotUndefined(ontologyId)
          ? yield* sql`
              SELECT
                (SELECT COUNT(*)::int FROM canonical_entities WHERE ontology_id = ${ontologyId}) as "entityCount",
                (SELECT COUNT(*)::int FROM entity_aliases WHERE ontology_id = ${ontologyId}) as "aliasCount",
                (SELECT COUNT(*)::int FROM entity_blocking_tokens WHERE ontology_id = ${ontologyId}) as "tokenCount",
                (SELECT COALESCE(SUM(merge_count), 0)::int FROM canonical_entities WHERE ontology_id = ${ontologyId}) as "totalMerges"
            `
          : yield* sql`
              SELECT
                (SELECT COUNT(*)::int FROM canonical_entities) as "entityCount",
                (SELECT COUNT(*)::int FROM entity_aliases) as "aliasCount",
                (SELECT COUNT(*)::int FROM entity_blocking_tokens) as "tokenCount",
                (SELECT COALESCE(SUM(merge_count), 0)::int FROM canonical_entities) as "totalMerges"
            `;
        const [row] = yield* decodeOneRegistryStatsSqlRow(result).pipe(
          Effect.mapError((cause) => toSqlError("EntityRegistryRepository.getStats", cause))
        );
        return row;
      });

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
        getStats,
      };
    }),
  }
) {
  static readonly Default = Layer.effect(this, this.make);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format a vector array as PostgreSQL vector literal
 */
function formatVector(vector: ReadonlyArray<number>): string {
  return `[${vector.join(",")}]`;
}

function toSqlError(operation: string, cause: unknown): SqlError.SqlError {
  return SqlError.isSqlError(cause)
    ? cause
    : SqlError.SqlError.make({
        reason: SqlError.UnknownError.make({ cause, operation }),
      });
}

/**
 * Tokenize a mention for blocking index
 * - Lowercase
 * - Split on whitespace and punctuation
 * - Filter stop words and short tokens
 */
function tokenize(mention: string): Array<string> {
  const stopWords = HashSet.make(
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
  );

  return mention
    .toLowerCase()
    .split(/[\s\-_.,;:!?'"()[]{}]+/)
    .filter((token) => token.length > 2 && !HashSet.has(stopWords, token));
}
