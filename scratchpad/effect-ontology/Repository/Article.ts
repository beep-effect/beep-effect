/**
 * Article Repository
 *
 * **Details**
 *
 * Effect-native repository for article metadata using Drizzle ORM.
 * Tracks source documents from which claims are extracted.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DrizzleError } from "@beep/drizzle";
import { $ScratchpadId } from "@beep/identity";
import { PostgresDrizzle } from "@beep/postgres";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { getSomesStruct } from "@beep/utils/Option";
import { Context, DateTime, Layer } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { normalizeDrizzleError } from "../Utils/Sql.ts";

const $I = $ScratchpadId.create("effect-ontology/Repository/Article");

import { and, count, desc, eq, gte, isNotNull, isNull, like, lte } from "drizzle-orm";
import { Effect } from "effect";
import type { ArticleInsertRow, ArticleRow } from "./schema.ts";
import { Articles, articles } from "./schema.ts";

const ArticleCountDatabaseRow = S.Struct({ count: S.Int }).pipe(
  $I.annoteSchema("ArticleCountDatabaseRow", {
    description: "Article count projection decoded at the Drizzle database boundary.",
  })
);

const normalizeQueryError = normalizeDrizzleError("execute");
const normalizeDecodedRows = normalizeDrizzleError("decodeRows");

const decodeArticleRows = (rows: unknown) =>
  normalizeDecodedRows(S.decodeUnknownEffect(Articles.select.pipe(S.Array, S.mutable))(rows));

const ArticleCountRows = S.Tuple([ArticleCountDatabaseRow]).pipe(SchemaUtils.withCodecStatics(["decodeUnknownEffect"]));

const decodeArticleCountRows = (rows: unknown) =>
  normalizeDecodedRows(ArticleCountRows.decodeUnknownEffect(rows));

// =============================================================================
// Types
// =============================================================================

/**
 * Database identifier of a persisted article row.
 *
 * @see {@link ArticleRepository} for lookups that consume this identifier.
 * @category type-level
 * @since 0.0.0
 */
export type ArticleId = string;

/**
 * Validates ontology-scoped article repository filters.
 *
 * **Example** (Validate an article filter)
 *
 * ```ts
 * import { ArticleFilter } from "@effect-ontology/Repository/Article"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArticleFilter)({ ontologyId: "ontology-a", limit: 10 }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ArticleFilter = S.Struct({
  ontologyId: S.NonEmptyString,
  sourceName: S.optionalKey(S.String),
  publishedAfter: S.optionalKey(S.Date),
  publishedBefore: S.optionalKey(S.Date),
  hasGraphUri: S.optionalKey(S.Boolean),
  uriPattern: S.optionalKey(S.String),
  limit: S.optionalKey(S.Int.check(S.isGreaterThan(0, { message: "Expected a positive article limit" }))),
  offset: S.optionalKey(
    S.Int.check(S.isGreaterThanOrEqualTo(0, { message: "Expected a non-negative article offset" }))
  ),
}).pipe(
  $I.annoteSchema("ArticleFilter", {
    description: "Ontology-scoped article query filters decoded at repository boundaries.",
  })
);

/**
 * Decoded ontology-scoped article filter.
 *
 * **Example** (Use an article filter)
 *
 * ```ts
 * import type { ArticleFilter } from "@effect-ontology/Repository/Article"
 *
 * const filter: ArticleFilter = { ontologyId: "ontology-a", limit: 10 }
 * console.log(filter.ontologyId)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ArticleFilter = typeof ArticleFilter.Type;

// =============================================================================
// Service
// =============================================================================

interface ArticleRepositoryShape {
  readonly insertArticle: (article: ArticleInsertRow) => Effect.Effect<ArticleRow, DrizzleError>;
  readonly getArticle: {
    (id: ArticleId, ontologyId: string): Effect.Effect<O.Option<ArticleRow>, DrizzleError>;
    (ontologyId: string): (id: ArticleId) => Effect.Effect<O.Option<ArticleRow>, DrizzleError>;
  };
  readonly getArticleByUri: {
    (uri: string, ontologyId: string): Effect.Effect<O.Option<ArticleRow>, DrizzleError>;
    (ontologyId: string): (uri: string) => Effect.Effect<O.Option<ArticleRow>, DrizzleError>;
  };
  readonly getOrCreateArticle: (article: ArticleInsertRow) => Effect.Effect<ArticleRow, DrizzleError>;
  readonly updateArticle: {
    (
      id: ArticleId,
      ontologyId: string,
      updates: Omit<Partial<ArticleInsertRow>, "ontologyId">
    ): Effect.Effect<O.Option<ArticleRow>, DrizzleError>;
    (
      ontologyId: string,
      updates: Omit<Partial<ArticleInsertRow>, "ontologyId">
    ): (id: ArticleId) => Effect.Effect<O.Option<ArticleRow>, DrizzleError>;
  };
  readonly setGraphUri: {
    (id: ArticleId, ontologyId: string, graphUri: string): Effect.Effect<O.Option<ArticleRow>, DrizzleError>;
    (ontologyId: string, graphUri: string): (id: ArticleId) => Effect.Effect<O.Option<ArticleRow>, DrizzleError>;
  };
  readonly getArticles: (filter: ArticleFilter) => Effect.Effect<ReadonlyArray<ArticleRow>, DrizzleError>;
  readonly getArticlesBySource: {
    (sourceName: string, ontologyId: string, limit?: number): Effect.Effect<ReadonlyArray<ArticleRow>, DrizzleError>;
    (
      ontologyId: string,
      limit?: number
    ): (sourceName: string) => Effect.Effect<ReadonlyArray<ArticleRow>, DrizzleError>;
  };
  readonly getArticlesInDateRange: {
    (ontologyId: string, from: Date, to: Date, limit?: number): Effect.Effect<ReadonlyArray<ArticleRow>, DrizzleError>;
    (
      from: Date,
      to: Date,
      limit?: number
    ): (ontologyId: string) => Effect.Effect<ReadonlyArray<ArticleRow>, DrizzleError>;
  };
  readonly getRecentArticles: {
    (ontologyId: string, limit?: number): Effect.Effect<ReadonlyArray<ArticleRow>, DrizzleError>;
    (limit?: number): (ontologyId: string) => Effect.Effect<ReadonlyArray<ArticleRow>, DrizzleError>;
  };
  readonly countArticles: (filter: ArticleFilter) => Effect.Effect<number, DrizzleError>;
  readonly insertArticlesBatch: (
    articleList: Array<ArticleInsertRow>
  ) => Effect.Effect<ReadonlyArray<ArticleRow>, DrizzleError>;
  readonly articleExists: {
    (uri: string, ontologyId: string): Effect.Effect<boolean, DrizzleError>;
    (ontologyId: string): (uri: string) => Effect.Effect<boolean, DrizzleError>;
  };
}

/**
 * Persists and queries ontology-scoped source articles.
 *
 * **Example** (Count and existence-check articles)
 *
 * ```ts
 * import { ArticleRepository } from "@effect-ontology/Repository/Article"
 * import { Effect } from "effect"
 *
 * const inspectPeople = Effect.gen(function* () {
 *   const articles = yield* ArticleRepository
 *   const total = yield* articles.countArticles({ ontologyId: "people" })
 *   const exists = yield* articles.articleExists("https://example.com/ada", "people")
 *   return { total, exists }
 * })
 * console.log(inspectPeople.pipe !== undefined) // true
 * ```
 *
 * @see {@link ArticleFilter} for the query input accepted by `countArticles`.
 * @category repositories
 * @since 0.0.0
 */
export class ArticleRepository extends Context.Service<ArticleRepository, ArticleRepositoryShape>()(
  $I`ArticleRepository`,
  {
    make: Effect.gen(function* () {
      const drizzle = yield* PostgresDrizzle;

      // -------------------------------------------------------------------------
      // CRUD Operations
      // -------------------------------------------------------------------------

      /**
       * Insert a new article
       */
      const insertArticle: ArticleRepositoryShape["insertArticle"] = Effect.fn("insertArticle")(function* (
        article: ArticleInsertRow
      ) {
        const [result] = yield* decodeArticleRows(
          yield* normalizeQueryError(drizzle.insert(articles).values(article).returning())
        );
        return result;
      });

      /**
       * Get article by ID
       */
      const getArticle: ArticleRepositoryShape["getArticle"] = dual(
        2,
        Effect.fn("getArticle")(function* (id: ArticleId, ontologyId: string) {
          const [result] = yield* decodeArticleRows(
            yield* normalizeQueryError(
              drizzle
                .select()
                .from(articles)
                .where(and(eq(articles.id, id), eq(articles.ontologyId, ontologyId)))
                .limit(1)
            )
          );
          return O.fromNullishOr(result);
        })
      );

      /**
       * Get article by URI
       */
      const getArticleByUri: ArticleRepositoryShape["getArticleByUri"] = dual(
        2,
        Effect.fn("getArticleByUri")(function* (uri: string, ontologyId: string) {
          const [result] = yield* decodeArticleRows(
            yield* normalizeQueryError(
              drizzle
                .select()
                .from(articles)
                .where(and(eq(articles.uri, uri), eq(articles.ontologyId, ontologyId)))
                .limit(1)
            )
          );
          return O.fromNullishOr(result);
        })
      );

      /**
       * Get or create article by URI (upsert)
       */
      const getOrCreateArticle: ArticleRepositoryShape["getOrCreateArticle"] = Effect.fn("getOrCreateArticle")(
        function* (article: ArticleInsertRow) {
          const existing = yield* getArticleByUri(article.uri, article.ontologyId);
          if (O.isSome(existing)) {
            return existing.value;
          }
          return yield* insertArticle(article);
        }
      );

      /**
       * Update article
       */
      const updateArticle: ArticleRepositoryShape["updateArticle"] = dual(
        3,
        Effect.fn("updateArticle")(function* (
          id: ArticleId,
          ontologyId: string,
          updates: Omit<Partial<ArticleInsertRow>, "ontologyId">
        ) {
          const [result] = yield* decodeArticleRows(
            yield* normalizeQueryError(
              drizzle
                .update(articles)
                .set({ ...updates, updatedAt: DateTime.toDateUtc(yield* DateTime.now) })
                .where(and(eq(articles.id, id), eq(articles.ontologyId, ontologyId)))
                .returning()
            )
          );
          return O.fromNullishOr(result);
        })
      );

      /**
       * Set graph URI for article
       */
      const setGraphUri: ArticleRepositoryShape["setGraphUri"] = dual(
        3,
        (id: ArticleId, ontologyId: string, graphUri: string) => updateArticle(id, ontologyId, { graphUri })
      );

      // -------------------------------------------------------------------------
      // Query Operations
      // -------------------------------------------------------------------------

      /**
       * Build WHERE conditions from a filter
       */
      const buildWhereConditions = (filter: ArticleFilter) => {
        const conditions = [];

        if (P.isNotUndefined(filter.ontologyId)) {
          conditions.push(eq(articles.ontologyId, filter.ontologyId));
        }
        if (P.isNotUndefined(filter.sourceName)) {
          conditions.push(eq(articles.sourceName, filter.sourceName));
        }
        if (P.isNotUndefined(filter.publishedAfter)) {
          conditions.push(gte(articles.publishedAt, filter.publishedAfter));
        }
        if (P.isNotUndefined(filter.publishedBefore)) {
          conditions.push(lte(articles.publishedAt, filter.publishedBefore));
        }
        if (P.isNotUndefined(filter.uriPattern)) {
          conditions.push(like(articles.uri, `%${filter.uriPattern}%`));
        }
        if (P.isNotUndefined(filter.hasGraphUri)) {
          conditions.push(
            Bool.match(filter.hasGraphUri, {
              onFalse: () => isNull(articles.graphUri),
              onTrue: () => isNotNull(articles.graphUri),
            })
          );
        }

        return conditions;
      };

      /**
       * Get articles with filters
       */
      const getArticles: ArticleRepositoryShape["getArticles"] = Effect.fn("getArticles")(function* (
        filter: ArticleFilter
      ) {
        const conditions = buildWhereConditions(filter);
        let query = drizzle.select().from(articles).orderBy(desc(articles.publishedAt)).$dynamic();
        if (A.isReadonlyArrayNonEmpty(conditions)) {
          query = query.where(and(...conditions));
        }
        if (P.isNotUndefined(filter.limit)) {
          query = query.limit(filter.limit);
        }
        if (P.isNotUndefined(filter.offset)) {
          query = query.offset(filter.offset);
        }
        return yield* decodeArticleRows(yield* normalizeQueryError(query));
      });

      /**
       * Get articles by source name
       */
      const getArticlesBySource: ArticleRepositoryShape["getArticlesBySource"] = dual(
        (args) => args.length >= 2 && P.isString(args[1]),
        (sourceName: string, ontologyId: string, limit?: number) =>
          getArticles({ sourceName, ontologyId, ...getSomesStruct({ limit: O.fromUndefinedOr(limit) }) })
      );

      /**
       * Get articles in date range
       */
      const getArticlesInDateRange: ArticleRepositoryShape["getArticlesInDateRange"] = dual(
        (args) => P.isString(args[0]),
        (ontologyId: string, from: Date, to: Date, limit?: number) =>
          getArticles({
            ontologyId,
            publishedAfter: from,
            publishedBefore: to,
            ...getSomesStruct({ limit: O.fromUndefinedOr(limit) }),
          })
      );

      /**
       * Get recent articles
       */
      const getRecentArticles: ArticleRepositoryShape["getRecentArticles"] = dual(
        (args) => P.isString(args[0]),
        (ontologyId: string, limit: number = 10) => getArticles({ ontologyId, limit })
      );

      /**
       * Count articles with filters using SQL COUNT
       */
      const countArticles: ArticleRepositoryShape["countArticles"] = Effect.fn("countArticles")(function* (
        filter: ArticleFilter
      ) {
        const conditions = buildWhereConditions(filter);
        let query = drizzle.select({ count: count() }).from(articles).$dynamic();
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
        const [result] = yield* decodeArticleCountRows(yield* normalizeQueryError(query));
        return result.count;
      });

      // -------------------------------------------------------------------------
      // Bulk Operations
      // -------------------------------------------------------------------------

      /**
       * Insert multiple articles in a batch
       */
      const insertArticlesBatch: ArticleRepositoryShape["insertArticlesBatch"] = Effect.fn("insertArticlesBatch")(
        function* (articleList: Array<ArticleInsertRow>) {
          if (A.isReadonlyArrayEmpty(articleList)) return [];
          return yield* decodeArticleRows(
            yield* normalizeQueryError(drizzle.insert(articles).values(articleList).returning())
          );
        }
      );

      /**
       * Check if article exists by URI
       */
      const articleExists: ArticleRepositoryShape["articleExists"] = dual(
        2,
        Effect.fn("articleExists")(function* (uri: string, ontologyId: string) {
          const result = yield* getArticleByUri(uri, ontologyId);
          return O.isSome(result);
        })
      );

      return {
        // CRUD
        insertArticle: Effect.fn("ArticleRepository.insertArticle")((article: ArticleInsertRow) =>
          normalizeQueryError(insertArticle(article))
        ),
        getArticle: dual(
          2,
          Effect.fn("ArticleRepository.getArticle")((id: ArticleId, ontologyId: string) =>
            normalizeQueryError(getArticle(id, ontologyId))
          )
        ),
        getArticleByUri: dual(
          2,
          Effect.fn("ArticleRepository.getArticleByUri")((uri: string, ontologyId: string) =>
            normalizeQueryError(getArticleByUri(uri, ontologyId))
          )
        ),
        getOrCreateArticle: Effect.fn("ArticleRepository.getOrCreateArticle")((article: ArticleInsertRow) =>
          normalizeQueryError(getOrCreateArticle(article))
        ),
        updateArticle: dual(
          3,
          Effect.fn("ArticleRepository.updateArticle")(
            (id: ArticleId, ontologyId: string, updates: Omit<Partial<ArticleInsertRow>, "ontologyId">) =>
              normalizeQueryError(updateArticle(id, ontologyId, updates))
          )
        ),
        setGraphUri: dual(
          3,
          Effect.fn("ArticleRepository.setGraphUri")((id: ArticleId, ontologyId: string, graphUri: string) =>
            normalizeQueryError(setGraphUri(id, ontologyId, graphUri))
          )
        ),

        // Queries
        getArticles: Effect.fn("ArticleRepository.getArticles")((filter: ArticleFilter) =>
          normalizeQueryError(getArticles(filter))
        ),
        getArticlesBySource: dual(
          (args) => args.length >= 2 && P.isString(args[1]),
          Effect.fn("ArticleRepository.getArticlesBySource")((sourceName: string, ontologyId: string, limit?: number) =>
            normalizeQueryError(getArticlesBySource(sourceName, ontologyId, limit))
          )
        ),
        getArticlesInDateRange: dual(
          (args) => P.isString(args[0]),
          Effect.fn("ArticleRepository.getArticlesInDateRange")(
            (ontologyId: string, from: Date, to: Date, limit?: number) =>
              normalizeQueryError(getArticlesInDateRange(ontologyId, from, to, limit))
          )
        ),
        getRecentArticles: dual(
          (args) => P.isString(args[0]),
          Effect.fn("ArticleRepository.getRecentArticles")((ontologyId: string, limit: number = 10) =>
            normalizeQueryError(getRecentArticles(ontologyId, limit))
          )
        ),
        countArticles: Effect.fn("ArticleRepository.countArticles")((filter: ArticleFilter) =>
          normalizeQueryError(countArticles(filter))
        ),

        // Bulk
        insertArticlesBatch: Effect.fn("ArticleRepository.insertArticlesBatch")(
          (articleList: Array<ArticleInsertRow>) => normalizeQueryError(insertArticlesBatch(articleList))
        ),
        articleExists: dual(
          2,
          Effect.fn("ArticleRepository.articleExists")((uri: string, ontologyId: string) =>
            normalizeQueryError(articleExists(uri, ontologyId))
          )
        ),
      };
    }),
  }
) {
  static readonly Default = Layer.effect(this, this.make);
}
