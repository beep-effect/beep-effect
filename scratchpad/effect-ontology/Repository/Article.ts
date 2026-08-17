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

import { $ScratchpadId } from "@beep/identity";
import { Context, DateTime, Layer } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effect-ontology/Repository/Article");

import { PostgresDrizzle } from "@beep/postgres";
import { and, desc, eq, gte, like, lte, sql } from "drizzle-orm";
import { Effect } from "effect";
import type { ArticleInsertRow } from "./schema.ts";
import { articles } from "./schema.ts";

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
 * Describes the article filter data exposed by this module.
 *
 * **Example** (Reference ArticleFilter fields)
 *
 * ```ts
 * import type { ArticleFilter } from "@effect-ontology/Repository/Article"
 *
 * const articleFilterFields: ReadonlyArray<keyof ArticleFilter> = ["ontologyId", "sourceName", "publishedAfter"]
 *
 * console.log(articleFilterFields)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ArticleFilter {
  readonly ontologyId?: string;
  readonly sourceName?: string;
  readonly publishedAfter?: Date;
  readonly publishedBefore?: Date;
  readonly hasGraphUri?: boolean;
  readonly uriPattern?: string;
  readonly limit?: number;
  readonly offset?: number;
}

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
      const [result] = yield* drizzle.insert(articles).values(article).returning();
      return result;
    });

    /**
     * Get article by ID
     */
    const getArticle = Effect.fn("getArticle")(function* (id: ArticleId) {
      const [result] = yield* drizzle.select().from(articles).where(eq(articles.id, id)).limit(1);
      return O.fromNullishOr(result);
    });

    /**
     * Get article by URI
     */
    const getArticleByUri = Effect.fn("getArticleByUri")(function* (uri: string, ontologyId?: string) {
      const conditions = [eq(articles.uri, uri)];
      if (P.isNotUndefined(ontologyId)) {
        conditions.push(eq(articles.ontologyId, ontologyId));
      }
      const [result] = yield* drizzle
        .select()
        .from(articles)
        .where(and(...conditions))
        .limit(1);
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
    const updateArticle = Effect.fn("updateArticle")(function* (id: ArticleId, updates: Partial<ArticleInsertRow>) {
      const [result] = yield* drizzle
        .update(articles)
        .set({ ...updates, updatedAt: DateTime.toDateUtc(yield* DateTime.now) })
        .where(eq(articles.id, id))
        .returning();
      return O.fromNullishOr(result);
    });

    /**
     * Set graph URI for article
     */
    const setGraphUri = (id: ArticleId, graphUri: string) => updateArticle(id, { graphUri });

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

      return conditions;
    };

    /**
     * Get articles with filters
     */
    const getArticles = Effect.fn("getArticles")(function* (filter: ArticleFilter) {
      const conditions = buildWhereConditions(filter);
      let query = drizzle.select().from(articles).orderBy(desc(articles.publishedAt)).$dynamic();
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      if (P.isNotUndefined(filter.limit)) {
        query = query.limit(filter.limit);
      }
      if (P.isNotUndefined(filter.offset)) {
        query = query.offset(filter.offset);
      }
      return yield* query;
    });

    /**
     * Get articles by source name
     */
    const getArticlesBySource = (sourceName: string, limit?: number) =>
      getArticles({ sourceName, ...(limit === undefined ? {} : { limit }) });

    /**
     * Get articles in date range
     */
    const getArticlesInDateRange = (from: Date, to: Date, limit?: number) =>
      getArticles({ publishedAfter: from, publishedBefore: to, ...(limit === undefined ? {} : { limit }) });

    /**
     * Get recent articles
     */
    const getRecentArticles = (limit: number = 10) => getArticles({ limit });

    /**
     * Count articles with filters using SQL COUNT
     */
    const countArticles = Effect.fn("countArticles")(function* (filter: ArticleFilter = {}) {
      const conditions = buildWhereConditions(filter);
      let query = drizzle.select({ count: sql<number>`count(*)::int` }).from(articles).$dynamic();
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      const result = yield* query;
      return result[0]?.count ?? 0;
    });

    // -------------------------------------------------------------------------
    // Bulk Operations
    // -------------------------------------------------------------------------

    /**
     * Insert multiple articles in a batch
     */
    const insertArticlesBatch = Effect.fn("insertArticlesBatch")(function* (articleList: Array<ArticleInsertRow>) {
      if (articleList.length === 0) return [];
      return yield* drizzle.insert(articles).values(articleList).returning();
    });

    /**
     * Check if article exists by URI
     */
    const articleExists = Effect.fn("articleExists")(function* (uri: string) {
      const result = yield* getArticleByUri(uri);
      return O.isSome(result);
    });

    return {
      // CRUD
      insertArticle,
      getArticle,
      getArticleByUri,
      getOrCreateArticle,
      updateArticle,
      setGraphUri,

      // Queries
      getArticles,
      getArticlesBySource,
      getArticlesInDateRange,
      getRecentArticles,
      countArticles,

      // Bulk
      insertArticlesBatch,
      articleExists,
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
