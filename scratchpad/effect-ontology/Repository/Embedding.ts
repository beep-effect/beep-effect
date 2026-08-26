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
 * Entity types that can have embeddings
 *
 * **Example** (Inspect embedding entity type)
 *
 * ```ts
 * import { EmbeddingEntityType } from "@effect-ontology/Repository/Embedding"
 *
 * console.log(EmbeddingEntityType)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const EmbeddingEntityType = LiteralKit(["class", "entity", "claim", "example"]).pipe(
  $I.annoteSchema("EmbeddingEntityType", {
    description: "Closed set of repository entities that can own an embedding.",
  })
);

/**
 * Describes the embedding entity type data exposed by this module.
 *
 * **Example** (Decode EmbeddingEntityType)
 *
 * ```ts
 * import { EmbeddingEntityType } from "@effect-ontology/Repository/Embedding"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeEmbeddingEntityType = (_value: EmbeddingEntityType): string => "valid embedding entity type"
 *
 * console.log(O.map(S.decodeUnknownOption(EmbeddingEntityType)({}), summarizeEmbeddingEntityType))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingEntityType = typeof EmbeddingEntityType.Type;

/**
 * Result from vector similarity search
 *
 * **Example** (Reference SimilarityResult fields)
 *
 * ```ts
 * import type { SimilarityResult } from "@effect-ontology/Repository/Embedding"
 *
 * const similarityResultFields: ReadonlyArray<keyof SimilarityResult> = ["entityId", "entityType", "similarity"]
 *
 * console.log(similarityResultFields)
 * ```
 *
 * @category type-level
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
 * Result from hybrid search (vector + text RRF fusion)
 *
 * **Example** (Reference HybridSearchResult fields)
 *
 * ```ts
 * import type { HybridSearchResult } from "@effect-ontology/Repository/Embedding"
 *
 * const hybridSearchResultFields: ReadonlyArray<keyof HybridSearchResult> = ["entityId", "entityType", "rrfScore"]
 *
 * console.log(hybridSearchResultFields)
 * ```
 *
 * @category type-level
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
 * Options for similarity search
 *
 * **Example** (Reference SimilaritySearchOptions fields)
 *
 * ```ts
 * import type { SimilaritySearchOptions } from "@effect-ontology/Repository/Embedding"
 *
 * const similaritySearchOptionsFields: ReadonlyArray<keyof SimilaritySearchOptions> = ["limit", "minSimilarity"]
 *
 * console.log(similaritySearchOptionsFields)
 * ```
 *
 * @category type-level
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
 * **Example** (Configure similarity search)
 *
 * ```ts
 * import { PosInt } from "@beep/schema/Int"
 * import type { SimilaritySearchOptionsInput } from "@effect-ontology/Repository/Embedding"
 *
 * const options: SimilaritySearchOptionsInput = { limit: PosInt.make(10) }
 * console.log(options)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SimilaritySearchOptionsInput = (typeof SimilaritySearchOptions)["~type.make.in"];

/**
 * Options for hybrid search
 *
 * **Example** (Reference HybridSearchOptions fields)
 *
 * ```ts
 * import type { HybridSearchOptions } from "@effect-ontology/Repository/Embedding"
 *
 * const hybridSearchOptionsFields: ReadonlyArray<keyof HybridSearchOptions> = ["limit", "vectorWeight", "textWeight"]
 *
 * console.log(hybridSearchOptionsFields)
 * ```
 *
 * @category type-level
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
 * **Example** (Configure hybrid search)
 *
 * ```ts
 * import { PosInt } from "@beep/schema/Int"
 * import type { HybridSearchOptionsInput } from "@effect-ontology/Repository/Embedding"
 *
 * const options: HybridSearchOptionsInput = { limit: PosInt.make(10) }
 * console.log(options)
 * ```
 *
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

const OneEmbeddingSqlRow = S.Tuple([EmbeddingSqlRow]).pipe(SchemaUtils.withEffectCodecStatics);
const OneCountSqlRow = S.Tuple([CountSqlRow]).pipe(SchemaUtils.withEffectCodecStatics);
const OneExistsSqlRow = S.Tuple([ExistsSqlRow]).pipe(SchemaUtils.withEffectCodecStatics);

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
 * Embedding Repository Service
 *
 * **Details**
 *
 * Provides persistent vector storage with hybrid search capabilities.
 *
 * **Example** (Inspect embedding repository)
 *
 * ```ts
 * import { EmbeddingRepository } from "@effect-ontology/Repository/Embedding"
 *
 * console.log(EmbeddingRepository)
 * ```
 *
 * @category layers
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
