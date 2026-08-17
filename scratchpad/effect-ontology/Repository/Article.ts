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
import { getSomesStruct } from "@beep/utils/Option";
import { Context, DateTime, Layer } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effect-ontology/Repository/Article");

import { PostgresDrizzle } from "@beep/postgres";
import { and, count, desc, eq, gte, isNotNull, isNull, like, lte } from "drizzle-orm";
import { Effect } from "effect";
import type { ArticleInsertRow } from "./schema.ts";
import { Articles, articles } from "./schema.ts";

const ArticleCountDatabaseRow = S.Struct({ count: S.Int }).pipe(
  $I.annoteSchema("ArticleCountDatabaseRow", {
    description: "Article count projection decoded at the Drizzle database boundary.",
  })
);

const normalizeQueryError = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, DrizzleError, R> =>
  effect.pipe(Effect.mapError((cause) => DrizzleError.fromUnknown("execute", cause)));

const decodeArticleRows = (rows: unknown) =>
  S.decodeUnknownEffect(Articles.select.pipe(S.Array, S.mutable))(rows).pipe(
    Effect.mapError((cause) => DrizzleError.fromUnknown("decodeRows", cause))
  );

const decodeArticleCountRows = (rows: unknown) =>
  S.decodeUnknownEffect(S.Tuple([ArticleCountDatabaseRow]))(rows).pipe(
    Effect.mapError((cause) => DrizzleError.fromUnknown("decodeRows", cause))
  );

// =============================================================================
// Types
// =============================================================================

/**
 * Describes the article id data exposed by this module.
 *
 * **Example** (Create ArticleId)
 *
 * ```ts
 * import type { ArticleId } from "@effect-ontology/Repository/Article"
 *
 * const articleId: ArticleId = "article-id-1"
 *
 * console.log(articleId)
 * ```
 *
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

/**
 * Provides repository access for article repository.
 *
 * **Example** (Inspect article repository)
 *
 * ```ts
 * import { ArticleRepository } from "@effect-ontology/Repository/Article"
 *
 * console.log(ArticleRepository)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class ArticleRepository extends Context.Service<ArticleRepository>()($I`ArticleRepository`, {
  make: Effect.gen(function* () {
    const drizzle = yield* PostgresDrizzle;

    // -------------------------------------------------------------------------
    // CRUD Operations
    // -------------------------------------------------------------------------

    /**
     * Insert a new article
     */
    const insertArticle = Effect.fn("insertArticle")(function* (article: ArticleInsertRow) {
      const [result] = yield* decodeArticleRows(yield* drizzle.insert(articles).values(article).returning());
      return result;
    });

    /**
     * Get article by ID
     */
    const getArticle = Effect.fn("getArticle")(function* (id: ArticleId, ontologyId: string) {
      const [result] = yield* decodeArticleRows(
        yield* drizzle
          .select()
          .from(articles)
          .where(and(eq(articles.id, id), eq(articles.ontologyId, ontologyId)))
          .limit(1)
      );
      return O.fromNullishOr(result);
    });

    /**
     * Get article by URI
     */
    const getArticleByUri = Effect.fn("getArticleByUri")(function* (uri: string, ontologyId: string) {
      const [result] = yield* decodeArticleRows(
        yield* drizzle
          .select()
          .from(articles)
          .where(and(eq(articles.uri, uri), eq(articles.ontologyId, ontologyId)))
          .limit(1)
      );
      return O.fromNullishOr(result);
    });

    /**
     * Get or create article by URI (upsert)
     */
    const getOrCreateArticle = Effect.fn("getOrCreateArticle")(function* (article: ArticleInsertRow) {
      const existing = yield* getArticleByUri(article.uri, article.ontologyId);
      if (O.isSome(existing)) {
        return existing.value;
      }
      return yield* insertArticle(article);
    });

    /**
     * Update article
     */
    const updateArticle = Effect.fn("updateArticle")(function* (
      id: ArticleId,
      ontologyId: string,
      updates: Omit<Partial<ArticleInsertRow>, "ontologyId">
    ) {
      const [result] = yield* decodeArticleRows(
        yield* drizzle
          .update(articles)
          .set({ ...updates, updatedAt: DateTime.toDateUtc(yield* DateTime.now) })
          .where(and(eq(articles.id, id), eq(articles.ontologyId, ontologyId)))
          .returning()
      );
      return O.fromNullishOr(result);
    });

    /**
     * Set graph URI for article
     */
    const setGraphUri = (id: ArticleId, ontologyId: string, graphUri: string) =>
      updateArticle(id, ontologyId, { graphUri });

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
    const getArticles = Effect.fn("getArticles")(function* (filter: ArticleFilter) {
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
      return yield* decodeArticleRows(yield* query);
    });

    /**
     * Get articles by source name
     */
    const getArticlesBySource = (sourceName: string, ontologyId: string, limit?: number) =>
      getArticles({ sourceName, ontologyId, ...getSomesStruct({ limit: O.fromUndefinedOr(limit) }) });

    /**
     * Get articles in date range
     */
    const getArticlesInDateRange = (from: Date, to: Date, ontologyId: string, limit?: number) =>
      getArticles({
        ontologyId,
        publishedAfter: from,
        publishedBefore: to,
        ...getSomesStruct({ limit: O.fromUndefinedOr(limit) }),
      });

    /**
     * Get recent articles
     */
    const getRecentArticles = (ontologyId: string, limit: number = 10) => getArticles({ ontologyId, limit });

    /**
     * Count articles with filters using SQL COUNT
     */
    const countArticles = Effect.fn("countArticles")(function* (filter: ArticleFilter) {
      const conditions = buildWhereConditions(filter);
      let query = drizzle.select({ count: count() }).from(articles).$dynamic();
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      const [result] = yield* decodeArticleCountRows(yield* query);
      return result.count;
    });

    // -------------------------------------------------------------------------
    // Bulk Operations
    // -------------------------------------------------------------------------

    /**
     * Insert multiple articles in a batch
     */
    const insertArticlesBatch = Effect.fn("insertArticlesBatch")(function* (articleList: Array<ArticleInsertRow>) {
      if (A.isReadonlyArrayEmpty(articleList)) return [];
      return yield* decodeArticleRows(yield* drizzle.insert(articles).values(articleList).returning());
    });

    /**
     * Check if article exists by URI
     */
    const articleExists = Effect.fn("articleExists")(function* (uri: string, ontologyId: string) {
      const result = yield* getArticleByUri(uri, ontologyId);
      return O.isSome(result);
    });

    return {
      // CRUD
      insertArticle: Effect.fn("ArticleRepository.insertArticle")((article: ArticleInsertRow) =>
        normalizeQueryError(insertArticle(article))
      ),
      getArticle: Effect.fn("ArticleRepository.getArticle")((id: ArticleId, ontologyId: string) =>
        normalizeQueryError(getArticle(id, ontologyId))
      ),
      getArticleByUri: Effect.fn("ArticleRepository.getArticleByUri")((uri: string, ontologyId: string) =>
        normalizeQueryError(getArticleByUri(uri, ontologyId))
      ),
      getOrCreateArticle: Effect.fn("ArticleRepository.getOrCreateArticle")((article: ArticleInsertRow) =>
        normalizeQueryError(getOrCreateArticle(article))
      ),
      updateArticle: Effect.fn("ArticleRepository.updateArticle")(
        (id: ArticleId, ontologyId: string, updates: Omit<Partial<ArticleInsertRow>, "ontologyId">) =>
          normalizeQueryError(updateArticle(id, ontologyId, updates))
      ),
      setGraphUri: Effect.fn("ArticleRepository.setGraphUri")((id: ArticleId, ontologyId: string, graphUri: string) =>
        normalizeQueryError(setGraphUri(id, ontologyId, graphUri))
      ),

      // Queries
      getArticles: Effect.fn("ArticleRepository.getArticles")((filter: ArticleFilter) =>
        normalizeQueryError(getArticles(filter))
      ),
      getArticlesBySource: Effect.fn("ArticleRepository.getArticlesBySource")(
        (sourceName: string, ontologyId: string, limit?: number) =>
          normalizeQueryError(getArticlesBySource(sourceName, ontologyId, limit))
      ),
      getArticlesInDateRange: Effect.fn("ArticleRepository.getArticlesInDateRange")(
        (from: Date, to: Date, ontologyId: string, limit?: number) =>
          normalizeQueryError(getArticlesInDateRange(from, to, ontologyId, limit))
      ),
      getRecentArticles: Effect.fn("ArticleRepository.getRecentArticles")((ontologyId: string, limit: number = 10) =>
        normalizeQueryError(getRecentArticles(ontologyId, limit))
      ),
      countArticles: Effect.fn("ArticleRepository.countArticles")((filter: ArticleFilter) =>
        normalizeQueryError(countArticles(filter))
      ),

      // Bulk
      insertArticlesBatch: Effect.fn("ArticleRepository.insertArticlesBatch")((articleList: Array<ArticleInsertRow>) =>
        normalizeQueryError(insertArticlesBatch(articleList))
      ),
      articleExists: Effect.fn("ArticleRepository.articleExists")((uri: string, ontologyId: string) =>
        normalizeQueryError(articleExists(uri, ontologyId))
      ),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
