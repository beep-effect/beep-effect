/**
 * Embedding Repository
 *
 * **Details**
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
 * @packageDocumentation
 * @since 0.0.0
 */

import { DrizzleError } from "@beep/drizzle";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, PosInt, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Context, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Repository/Embedding");

import { PostgresDrizzle } from "@beep/postgres";
import { and, sql as drizzleSql, eq } from "drizzle-orm";
import { dual } from "effect/Function";
import { SqlClient } from "effect/unstable/sql";
import { formatPgVector, normalizeDrizzleError } from "../Utils/Sql.ts";
import type { EmbeddingRow } from "./schema.ts";
import { Embeddings, embeddings } from "./schema.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Closed set of repository entities that can own an embedding.
 *
 * **Example** (Recognize an embedding owner)
 *
 * ```ts
 * import { EmbeddingEntityType } from "@effect-ontology/Repository/Embedding"
 *
 * console.log(EmbeddingEntityType.is.class("class")) // true
 * console.log(EmbeddingEntityType.is.class("entity")) // false
 * ```
 *
 * @see {@link EmbeddingRepository} for similarity search scoped by this type.
 * @category schemas
 * @since 0.0.0
 */
export const EmbeddingEntityType = LiteralKit(["class", "entity", "claim", "example"]).pipe(
  $I.annoteSchema("EmbeddingEntityType", {
    description: "Closed set of repository entities that can own an embedding.",
  })
);

/**
 * Runtime value accepted by {@link EmbeddingEntityType}.
 *
 * @see {@link EmbeddingEntityType} for the closed literal set and guards.
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingEntityType = typeof EmbeddingEntityType.Type;

/**
 * Repository entity and its cosine-similarity score from vector search.
 *
 * **Example** (Construct a similarity hit)
 *
 * ```ts
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { EmbeddingEntityType, SimilarityResult } from "@effect-ontology/Repository/Embedding"
 *
 * const hit = SimilarityResult.make({
 *   entityId: "ada_lovelace",
 *   entityType: EmbeddingEntityType.Enum.class,
 *   similarity: UnitInterval.make(0.91)
 * })
 * console.log(hit.entityId) // "ada_lovelace"
 * ```
 *
 * @see {@link EmbeddingRepository} for `findSimilar` that returns this payload.
 * @category models
 * @since 0.0.0
 */
export class SimilarityResult extends S.Class<SimilarityResult>($I`SimilarityResult`)(
  {
    entityId: S.NonEmptyString,
    entityType: EmbeddingEntityType,
    similarity: UnitInterval,
  },
  $I.annote("SimilarityResult", {
    description: "Repository entity and its cosine-similarity score.",
  })
) {}

/**
 * Repository entity and its reciprocal-rank-fusion scores from hybrid search.
 *
 * **Example** (Construct a hybrid-search hit)
 *
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 * import { EmbeddingEntityType, HybridSearchResult } from "@effect-ontology/Repository/Embedding"
 *
 * const hit = HybridSearchResult.make({
 *   entityId: "ada_lovelace",
 *   entityType: EmbeddingEntityType.Enum.entity,
 *   rrfScore: UnitInterval.make(0.8),
 *   vectorRank: NonNegativeInt.make(1),
 *   textRank: NonNegativeInt.make(2)
 * })
 * console.log(hit.rrfScore) // 0.8
 * ```
 *
 * @see {@link EmbeddingRepository} for `hybridSearch` that returns this payload.
 * @category models
 * @since 0.0.0
 */
export class HybridSearchResult extends S.Class<HybridSearchResult>($I`HybridSearchResult`)(
  {
    entityId: S.NonEmptyString,
    entityType: EmbeddingEntityType,
    rrfScore: UnitInterval,
    vectorRank: NonNegativeInt,
    textRank: NonNegativeInt,
  },
  $I.annote("HybridSearchResult", {
    description: "Repository entity and its reciprocal-rank-fusion search scores.",
  })
) {}

/**
 * Bounded result count and cosine-similarity threshold for vector search.
 *
 * **Example** (Use search defaults)
 *
 * ```ts
 * import { SimilaritySearchOptions } from "@effect-ontology/Repository/Embedding"
 *
 * const options = SimilaritySearchOptions.make({})
 * console.log(options.limit) // 20
 * ```
 *
 * @see {@link EmbeddingRepository} for `findSimilar` that consumes these options.
 * @category configuration
 * @since 0.0.0
 */
export class SimilaritySearchOptions extends S.Class<SimilaritySearchOptions>($I`SimilaritySearchOptions`)(
  {
    limit: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
    minSimilarity: UnitInterval.pipe(SchemaUtils.withKeyDefaults(UnitInterval.make(0.5))),
  },
  $I.annote("SimilaritySearchOptions", {
    description: "Bounded result count and cosine-similarity threshold for vector search.",
  })
) {}

/**
 * Constructor input accepted by {@link SimilaritySearchOptions}.
 *
 * @see {@link SimilaritySearchOptions} for the runtime schema and constructor defaults.
 * @category type-level
 * @since 0.0.0
 */
export type SimilaritySearchOptionsInput = (typeof SimilaritySearchOptions)["~type.make.in"];

/**
 * Bounded result count and fusion weights for hybrid vector and text search.
 *
 * **Example** (Use hybrid-search defaults)
 *
 * ```ts
 * import { HybridSearchOptions } from "@effect-ontology/Repository/Embedding"
 *
 * const options = HybridSearchOptions.make({})
 * console.log(options.vectorWeight) // 0.6
 * ```
 *
 * @see {@link EmbeddingRepository} for `hybridSearch` that consumes these options.
 * @category configuration
 * @since 0.0.0
 */
export class HybridSearchOptions extends S.Class<HybridSearchOptions>($I`HybridSearchOptions`)(
  {
    limit: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(20))),
    vectorWeight: UnitInterval.pipe(SchemaUtils.withKeyDefaults(UnitInterval.make(0.6))),
    textWeight: UnitInterval.pipe(SchemaUtils.withKeyDefaults(UnitInterval.make(0.4))),
  },
  $I.annote("HybridSearchOptions", {
    description: "Bounded result count and fusion weights for hybrid vector and text search.",
  })
) {}

/**
 * Constructor input accepted by {@link HybridSearchOptions}.
 *
 * @see {@link HybridSearchOptions} for the runtime schema and constructor defaults.
 * @category type-level
 * @since 0.0.0
 */
export type HybridSearchOptionsInput = (typeof HybridSearchOptions)["~type.make.in"];

const PgVector = S.Finite.pipe(
  S.Array,
  S.fromJsonString,
  $I.annoteSchema("PgVector", {
    description: "PostgreSQL pgvector text decoded to a finite numeric vector.",
  })
);

const EmbeddingSqlRow = Embeddings.pipe(
  $I.annoteSchema("EmbeddingSqlRow", {
    description: "Decoded row returned by raw SQL queries against the embeddings table.",
  })
);

const EmbeddingVectorSqlRow = S.Struct({ embedding: PgVector }).pipe(
  $I.annoteSchema("EmbeddingVectorSqlRow", {
    description: "Decoded pgvector projection returned by an embedding lookup.",
  })
);

const SimilaritySqlRow = SimilarityResult.pipe(
  $I.annoteSchema("SimilaritySqlRow", {
    description: "Decoded vector-similarity projection returned by PostgreSQL.",
  })
);

const HybridSearchSqlRow = HybridSearchResult.pipe(
  $I.annoteSchema("HybridSearchSqlRow", {
    description: "Decoded reciprocal-rank-fusion projection returned by PostgreSQL.",
  })
);

const TextSearchSqlRow = S.Struct({
  entityId: S.String,
  rank: S.Finite,
}).pipe(
  $I.annoteSchema("TextSearchSqlRow", {
    description: "Decoded full-text ranking projection returned by PostgreSQL.",
  })
);

const CountSqlRow = S.Struct({ count: S.Int }).pipe(
  $I.annoteSchema("CountSqlRow", {
    description: "Decoded integer count projection returned by PostgreSQL.",
  })
);

const EmbeddingTypeCountSqlRow = S.Struct({
  entityType: EmbeddingEntityType,
  count: S.Int,
}).pipe(
  $I.annoteSchema("EmbeddingTypeCountSqlRow", {
    description: "Decoded embedding count grouped by entity type.",
  })
);

const ModelCountSqlRow = S.Struct({
  model: S.String,
  count: S.Int,
}).pipe(
  $I.annoteSchema("ModelCountSqlRow", {
    description: "Decoded embedding count grouped by model.",
  })
);

const ExistsSqlRow = S.Struct({ exists: S.Boolean }).pipe(
  $I.annoteSchema("ExistsSqlRow", {
    description: "Decoded SQL EXISTS projection.",
  })
);

const OneEmbeddingSqlRow = S.Tuple([EmbeddingSqlRow]).pipe(SchemaUtils.withCodecStatics(["decodeUnknownEffect"]));
const OneCountSqlRow = S.Tuple([CountSqlRow]).pipe(SchemaUtils.withCodecStatics(["decodeUnknownEffect"]));
const OneExistsSqlRow = S.Tuple([ExistsSqlRow]).pipe(SchemaUtils.withCodecStatics(["decodeUnknownEffect"]));

const normalizeDecodedRows = normalizeDrizzleError("decodeRows");
const normalizeExecution = normalizeDrizzleError("execute");
const decodeEmbeddingSqlRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(S.Array(EmbeddingSqlRow))(rows));
const decodeOneEmbeddingSqlRow = (rows: unknown) => normalizeDecodedRows(OneEmbeddingSqlRow.decodeUnknownEffect(rows));
const decodeEmbeddingVectorSqlRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(S.Array(EmbeddingVectorSqlRow))(rows));
const decodeSimilaritySqlRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(S.Array(SimilaritySqlRow))(rows));
const decodeHybridSearchSqlRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(S.Array(HybridSearchSqlRow))(rows));
const decodeTextSearchSqlRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(S.Array(TextSearchSqlRow))(rows));
const decodeOneCountSqlRow = (rows: unknown) => normalizeDecodedRows(OneCountSqlRow.decodeUnknownEffect(rows));
const decodeEmbeddingTypeCountSqlRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(S.Array(EmbeddingTypeCountSqlRow))(rows));
const decodeModelCountSqlRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(S.Array(ModelCountSqlRow))(rows));
const decodeOneExistsSqlRow = (rows: unknown) => normalizeDecodedRows(OneExistsSqlRow.decodeUnknownEffect(rows));

// =============================================================================
// Service
// =============================================================================

type EmbeddingRepositoryError = DrizzleError;

interface EmbeddingRepositoryShape {
  readonly upsert: {
    (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      entityId: string,
      embedding: ReadonlyArray<number>,
      contentText?: string,
      model?: string
    ): Effect.Effect<EmbeddingRow, EmbeddingRepositoryError>;
    (
      entityType: EmbeddingEntityType,
      entityId: string,
      embedding: ReadonlyArray<number>,
      contentText?: string,
      model?: string
    ): (ontologyId: string) => Effect.Effect<EmbeddingRow, EmbeddingRepositoryError>;
  };
  readonly get: {
    (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      entityId: string
    ): Effect.Effect<O.Option<EmbeddingRow>, EmbeddingRepositoryError>;
    (
      entityType: EmbeddingEntityType,
      entityId: string
    ): (ontologyId: string) => Effect.Effect<O.Option<EmbeddingRow>, EmbeddingRepositoryError>;
  };
  readonly getVector: {
    (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      entityId: string
    ): Effect.Effect<O.Option<ReadonlyArray<number>>, EmbeddingRepositoryError>;
    (
      entityType: EmbeddingEntityType,
      entityId: string
    ): (ontologyId: string) => Effect.Effect<O.Option<ReadonlyArray<number>>, EmbeddingRepositoryError>;
  };
  readonly remove: {
    (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      entityId: string
    ): Effect.Effect<void, EmbeddingRepositoryError>;
    (
      entityType: EmbeddingEntityType,
      entityId: string
    ): (ontologyId: string) => Effect.Effect<void, EmbeddingRepositoryError>;
  };
  readonly removeByType: {
    (ontologyId: string, entityType: EmbeddingEntityType): Effect.Effect<void, EmbeddingRepositoryError>;
    (entityType: EmbeddingEntityType): (ontologyId: string) => Effect.Effect<void, EmbeddingRepositoryError>;
  };
  readonly upsertBatch: (
    items: ReadonlyArray<{
      ontologyId: string;
      entityType: EmbeddingEntityType;
      entityId: string;
      embedding: ReadonlyArray<number>;
      contentText?: string;
      model?: string;
    }>
  ) => Effect.Effect<number, EmbeddingRepositoryError>;
  readonly getMultiple: {
    (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      entityIds: ReadonlyArray<string>
    ): Effect.Effect<ReadonlyArray<EmbeddingRow>, EmbeddingRepositoryError>;
    (
      entityType: EmbeddingEntityType,
      entityIds: ReadonlyArray<string>
    ): (ontologyId: string) => Effect.Effect<ReadonlyArray<EmbeddingRow>, EmbeddingRepositoryError>;
  };
  readonly findSimilar: {
    (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      queryEmbedding: ReadonlyArray<number>,
      options?: SimilaritySearchOptionsInput
    ): Effect.Effect<ReadonlyArray<SimilarityResult>, EmbeddingRepositoryError>;
    (
      entityType: EmbeddingEntityType,
      queryEmbedding: ReadonlyArray<number>,
      options?: SimilaritySearchOptionsInput
    ): (ontologyId: string) => Effect.Effect<ReadonlyArray<SimilarityResult>, EmbeddingRepositoryError>;
  };
  readonly hybridSearch: {
    (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      queryEmbedding: ReadonlyArray<number>,
      queryText: string,
      options?: HybridSearchOptionsInput
    ): Effect.Effect<ReadonlyArray<HybridSearchResult>, EmbeddingRepositoryError>;
    (
      entityType: EmbeddingEntityType,
      queryEmbedding: ReadonlyArray<number>,
      queryText: string,
      options?: HybridSearchOptionsInput
    ): (ontologyId: string) => Effect.Effect<ReadonlyArray<HybridSearchResult>, EmbeddingRepositoryError>;
  };
  readonly textSearch: {
    (
      ontologyId: string,
      entityType: EmbeddingEntityType,
      queryText: string,
      limit?: number
    ): Effect.Effect<ReadonlyArray<typeof TextSearchSqlRow.Type>, EmbeddingRepositoryError>;
    (
      entityType: EmbeddingEntityType,
      queryText: string,
      limit?: number
    ): (ontologyId: string) => Effect.Effect<ReadonlyArray<typeof TextSearchSqlRow.Type>, EmbeddingRepositoryError>;
  };
  readonly getStats: (ontologyId?: string) => Effect.Effect<
    {
      totalCount: number;
      byType: Record<EmbeddingEntityType, number>;
      models: Record<string, number>;
    },
    EmbeddingRepositoryError
  >;
  readonly hasEmbeddings: {
    (ontologyId: string, entityType: EmbeddingEntityType): Effect.Effect<boolean, EmbeddingRepositoryError>;
    (entityType: EmbeddingEntityType): (ontologyId: string) => Effect.Effect<boolean, EmbeddingRepositoryError>;
  };
}

/**
 * Persistent vector store with cosine similarity and hybrid RRF search.
 *
 * **Details**
 *
 * Hybrid search fuses pgvector ANN with PostgreSQL full-text ranking.
 *
 * **Gotchas**
 *
 * PostgreSQL must have the pgvector extension enabled.
 *
 * **Example** (Run a similarity search)
 *
 * ```ts
 * import { EmbeddingEntityType, EmbeddingRepository } from "@effect-ontology/Repository/Embedding"
 * import { Effect } from "effect"
 *
 * const similar = Effect.gen(function* () {
 *   const embeddings = yield* EmbeddingRepository
 *   return yield* embeddings.findSimilar(
 *     "people",
 *     EmbeddingEntityType.Enum.entity,
 *     Array.from({ length: 768 }, () => 0)
 *   )
 * })
 * console.log(typeof similar) // "object"
 * ```
 *
 * @see {@link SimilaritySearchOptions} for vector-only search bounds.
 * @see {@link HybridSearchOptions} for vector-plus-text fusion weights.
 * @category repositories
 * @since 0.0.0
 */
export class EmbeddingRepository extends Context.Service<EmbeddingRepository, EmbeddingRepositoryShape>()(
  $I`EmbeddingRepository`,
  {
    make: Effect.gen(function* () {
      const drizzle = yield* PostgresDrizzle;
      const sql = yield* SqlClient.SqlClient;

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
      const upsert: EmbeddingRepositoryShape["upsert"] = dual(
        (args) => P.isString(args[2]),
        (
          ontologyId: string,
          entityType: EmbeddingEntityType,
          entityId: string,
          embedding: ReadonlyArray<number>,
          contentText?: string,
          model?: string
        ) =>
          Effect.gen(function* () {
            const vectorStr = formatPgVector(embedding);
            const modelName = O.getOrElse(O.fromUndefinedOr(model), () => "nomic-embed-text-v1.5");
            const contentTextOption = O.fromUndefinedOr(contentText);
            const result = yield* normalizeExecution(
              drizzle
                .insert(embeddings)
                .values({
                  ontologyId,
                  entityType,
                  entityId,
                  embedding: vectorStr,
                  contentText: O.getOrNull(contentTextOption),
                  model: modelName,
                })
                .onConflictDoUpdate({
                  target: [embeddings.ontologyId, embeddings.entityType, embeddings.entityId],
                  set: {
                    embedding: vectorStr,
                    model: modelName,
                    updatedAt: drizzleSql`NOW()`,
                    ...O.getOrElse(
                      O.map(contentTextOption, (value) => ({ contentText: value })),
                      () => ({})
                    ),
                  },
                })
                .returning()
            );
            const [row] = yield* decodeOneEmbeddingSqlRow(result);
            return row;
          })
      );

      /**
       * Get embedding by entity identifiers
       */
      const get: EmbeddingRepositoryShape["get"] = dual(
        3,
        (ontologyId: string, entityType: EmbeddingEntityType, entityId: string) =>
          Effect.gen(function* () {
            const result = yield* drizzle
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
              .pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)));
            return A.head(yield* decodeEmbeddingSqlRows(result));
          })
      );

      /**
       * Get embedding vector by entity identifiers
       * Returns just the vector for similarity operations
       */
      const getVector: EmbeddingRepositoryShape["getVector"] = dual(
        3,
        (ontologyId: string, entityType: EmbeddingEntityType, entityId: string) =>
          Effect.gen(function* () {
            const result = yield* sql`
          SELECT embedding::text as embedding
          FROM embeddings
          WHERE ontology_id = ${ontologyId}
            AND entity_type = ${entityType}
            AND entity_id = ${entityId} LIMIT 1
        `;
            const rows = yield* decodeEmbeddingVectorSqlRows(result);
            return O.map(O.fromIterable(rows), (row) => row.embedding);
          }).pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)))
      );

      /**
       * Delete embedding
       */
      const remove: EmbeddingRepositoryShape["remove"] = dual(
        3,
        Effect.fn("EmbeddingRepository.remove")(function* (
          ontologyId: string,
          entityType: EmbeddingEntityType,
          entityId: string
        ): Effect.fn.Return<void, DrizzleError> {
          yield* drizzle
            .delete(embeddings)
            .where(
              and(
                eq(embeddings.ontologyId, ontologyId),
                eq(embeddings.entityType, entityType),
                eq(embeddings.entityId, entityId)
              )
            )
            .pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)));
        })
      );

      /**
       * Delete all embeddings for an ontology and entity type
       */
      const removeByType: EmbeddingRepositoryShape["removeByType"] = dual(
        2,
        Effect.fn("EmbeddingRepository.removeByType")(function* (
          ontologyId: string,
          entityType: EmbeddingEntityType
        ): Effect.fn.Return<void, DrizzleError> {
          yield* drizzle
            .delete(embeddings)
            .where(and(eq(embeddings.ontologyId, ontologyId), eq(embeddings.entityType, entityType)))
            .pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)));
        })
      );

      // -------------------------------------------------------------------------
      // Batch Operations
      // -------------------------------------------------------------------------

      /**
       * Upsert multiple embeddings in batch
       *
       * @param items - Array of embedding items to upsert
       */
      const upsertBatch: EmbeddingRepositoryShape["upsertBatch"] = Effect.fn("EmbeddingRepository.upsertBatch")(
        function* (
          items: ReadonlyArray<{
            ontologyId: string;
            entityType: EmbeddingEntityType;
            entityId: string;
            embedding: ReadonlyArray<number>;
            contentText?: string;
            model?: string;
          }>
        ) {
          if (items.length === 0) return 0;

          // Use batched upsert with CTE for efficiency
          const values = items.map((item) => ({
            ontologyId: item.ontologyId,
            entityType: item.entityType,
            entityId: item.entityId,
            embedding: item.embedding,
            contentText: item.contentText ?? null,
            model: item.model ?? "nomic-embed-text-v1.5",
          }));

          // Process in chunks of 100 for memory efficiency
          const chunkSize = 100;
          let inserted = 0;

          for (let i = 0; i < values.length; i += chunkSize) {
            const chunk = values.slice(i, i + chunkSize);
            yield* Effect.forEach(
              chunk,
              (item) =>
                upsert(
                  item.ontologyId,
                  item.entityType,
                  item.entityId,
                  item.embedding,
                  item.contentText ?? undefined,
                  item.model
                ),
              { concurrency: 10 }
            );
            inserted += chunk.length;
          }

          return inserted;
        }
      );

      /**
       * Get multiple embeddings by entity IDs
       */
      const getMultiple: EmbeddingRepositoryShape["getMultiple"] = dual(
        3,
        (ontologyId: string, entityType: EmbeddingEntityType, entityIds: ReadonlyArray<string>) =>
          Effect.gen(function* () {
            if (entityIds.length === 0) return [];
            const result = yield* normalizeExecution(sql`
          SELECT id,
                 ontology_id as "ontologyId",
                 entity_type as "entityType",
                 entity_id as "entityId",
                 embedding::text as embedding,
                 content_text as "contentText",
                 model,
                 created_at as "createdAt",
                 updated_at as "updatedAt"
          FROM embeddings
          WHERE ontology_id = ${ontologyId}
            AND entity_type = ${entityType}
            AND entity_id = ANY (${entityIds}::text[])
        `);
            return yield* decodeEmbeddingSqlRows(result);
          })
      );

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
      const findSimilar: EmbeddingRepositoryShape["findSimilar"] = dual(
        (args) => P.isString(args[1]),
        (
          ontologyId: string,
          entityType: EmbeddingEntityType,
          queryEmbedding: ReadonlyArray<number>,
          options: SimilaritySearchOptionsInput = {}
        ) =>
          Effect.gen(function* () {
            const { limit, minSimilarity } = SimilaritySearchOptions.make(options);
            const vectorStr = formatPgVector(queryEmbedding);

            const results = yield* normalizeExecution(sql`
          SELECT entity_id                                as "entityId",
                 entity_type                              as "entityType",
                 1 - (embedding <=> ${vectorStr}::vector) as similarity
          FROM embeddings
          WHERE ontology_id = ${ontologyId}
            AND entity_type = ${entityType}
            AND 1 - (embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
          ORDER BY embedding <=> ${vectorStr}::vector
            LIMIT ${limit}
        `);
            return yield* decodeSimilaritySqlRows(results);
          })
      );

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
      const hybridSearch: EmbeddingRepositoryShape["hybridSearch"] = dual(
        (args) => P.isString(args[1]),
        (
          ontologyId: string,
          entityType: EmbeddingEntityType,
          queryEmbedding: ReadonlyArray<number>,
          queryText: string,
          options: HybridSearchOptionsInput = {}
        ) =>
          Effect.gen(function* () {
            const { limit, vectorWeight, textWeight } = HybridSearchOptions.make(options);
            const vectorStr = formatPgVector(queryEmbedding);

            // Use the PostgreSQL hybrid_search function defined in migration
            const results = yield* normalizeExecution(sql`
          SELECT entity_id as "entityId",
                 entity_type as "entityType",
                 rrf_score as "rrfScore",
                 vector_rank as "vectorRank",
                 text_rank as "textRank"
          FROM hybrid_search(
            ${vectorStr}::vector,
            ${queryText},
            ${ontologyId},
            ${entityType},
            ${limit},
            ${vectorWeight},
            ${textWeight}
               )
        `);

            return yield* decodeHybridSearchSqlRows(results);
          })
      );

      /**
       * Full-text search only (no vector similarity)
       * Useful when query embedding is not available.
       */
      const textSearch: EmbeddingRepositoryShape["textSearch"] = dual(
        (args) => P.isString(args[2]),
        (ontologyId: string, entityType: EmbeddingEntityType, queryText: string, limit: number = 20) =>
          Effect.gen(function* () {
            const results = yield* normalizeExecution(sql`
          SELECT entity_id                                         as "entityId",
                 ts_rank(content_tsv,
                         plainto_tsquery('english', ${queryText})) as rank
          FROM embeddings
          WHERE ontology_id = ${ontologyId}
            AND entity_type = ${entityType}
            AND content_tsv @@ plainto_tsquery('english'
              , ${queryText})
          ORDER BY rank DESC
            LIMIT ${limit}
        `);
            return yield* decodeTextSearchSqlRows(results);
          })
      );

      // -------------------------------------------------------------------------
      // Statistics
      // -------------------------------------------------------------------------

      /**
       * Get embedding statistics for an ontology
       */
      const getStats: EmbeddingRepositoryShape["getStats"] = Effect.fn("EmbeddingRepository.getStats")(function* (
        ontologyId?: string
      ) {
        // Run all queries in parallel using Effect.all
        const [totalResult, byTypeResult, modelsResult] = yield* normalizeExecution(
          Effect.all(
            [
              // Total count query
              P.isNotUndefined(ontologyId)
                ? sql`SELECT COUNT(*) ::int as count
                    FROM embeddings
                    WHERE ontology_id = ${ontologyId}`
                : sql`SELECT COUNT(*) ::int as count
                    FROM embeddings`,
              // By type query
              P.isNotUndefined(ontologyId)
                ? sql`
                SELECT entity_type as "entityType", COUNT(*) ::int as count
                FROM embeddings
                WHERE ontology_id = ${ontologyId}
                GROUP BY entity_type
              `
                : sql`
                SELECT entity_type as "entityType", COUNT(*) ::int as count
                FROM embeddings
                GROUP BY entity_type
              `,
              // Models query
              P.isNotUndefined(ontologyId)
                ? sql`
                SELECT model, COUNT(*) ::int as count
                FROM embeddings
                WHERE ontology_id = ${ontologyId}
                GROUP BY model
              `
                : sql`
                SELECT model, COUNT(*) ::int as count
                FROM embeddings
                GROUP BY model
              `,
            ],
            { concurrency: "unbounded" }
          )
        );

        const [[total], byTypeRows, modelRows] = yield* Effect.all(
          [
            decodeOneCountSqlRow(totalResult),
            decodeEmbeddingTypeCountSqlRows(byTypeResult),
            decodeModelCountSqlRows(modelsResult),
          ],
          { concurrency: "unbounded" }
        );

        const byType: Record<EmbeddingEntityType, number> = {
          class: 0,
          entity: 0,
          claim: 0,
          example: 0,
        };
        for (const row of byTypeRows) {
          byType[row.entityType] = row.count;
        }

        const models: Record<string, number> = {};
        for (const row of modelRows) {
          models[row.model] = row.count;
        }

        return {
          totalCount: total.count,
          byType,
          models,
        };
      });

      /**
       * Check if embeddings exist for a given entity type
       */
      const hasEmbeddings: EmbeddingRepositoryShape["hasEmbeddings"] = dual(
        2,
        (ontologyId: string, entityType: EmbeddingEntityType) =>
          Effect.gen(function* () {
            const result = yield* normalizeExecution(sql`
          SELECT EXISTS(SELECT 1
                        FROM embeddings
                        WHERE ontology_id = ${ontologyId}
                          AND entity_type = ${entityType}
            LIMIT 1) as exists
        `);
            const [row] = yield* decodeOneExistsSqlRow(result);
            return row.exists;
          })
      );

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
        hasEmbeddings,
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
