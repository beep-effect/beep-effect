/**
 * Article Repository
 *
 * Effect-native repository for article metadata using Drizzle ORM.
 * Tracks source documents from which claims are extracted.
 *
 * @since 2.0.0
 * @module Repository/Article
 */

import { $ScratchpadId } from "@beep/identity"
import { Context, Layer } from "effect"
const $I = $ScratchpadId.create("effect-ontology/Repository/Article")

import { PostgresDrizzle } from "@beep/postgres"
import { and, desc, eq, gte, like, lte, sql } from "drizzle-orm"
import { Effect, Option } from "effect"
import { articles } from "./schema.ts"
import type { ArticleInsertRow } from "./schema.ts"

// =============================================================================
// Types
// =============================================================================

export type ArticleId = string

export interface ArticleFilter {
  readonly ontologyId?: string
  readonly sourceName?: string
  readonly publishedAfter?: Date
  readonly publishedBefore?: Date
  readonly hasGraphUri?: boolean
  readonly uriPattern?: string
  readonly limit?: number
  readonly offset?: number
}

// =============================================================================
// Service
// =============================================================================

export class ArticleRepository extends Context.Service<ArticleRepository>()($I`ArticleRepository`, {
  make: Effect.gen(function*() {
    const drizzle = yield* PostgresDrizzle

    // -------------------------------------------------------------------------
    // CRUD Operations
    // -------------------------------------------------------------------------

    /**
     * Insert a new article
     */
    const insertArticle = (article: ArticleInsertRow) =>
      Effect.gen(function*() {
        const [result] = yield* drizzle.insert(articles).values(article).returning()
        return result
      })

    /**
     * Get article by ID
     */
    const getArticle = (id: ArticleId) =>
      Effect.gen(function*() {
        const [result] = yield* drizzle.select().from(articles).where(eq(articles.id, id)).limit(1)
        return Option.fromNullishOr(result)
      })

    /**
     * Get article by URI
     */
    const getArticleByUri = (uri: string) =>
      Effect.gen(function*() {
        const [result] = yield* drizzle.select().from(articles).where(eq(articles.uri, uri)).limit(1)
        return Option.fromNullishOr(result)
      })

    /**
     * Get or create article by URI (upsert)
     */
    const getOrCreateArticle = (article: ArticleInsertRow) =>
      Effect.gen(function*() {
        const existing = yield* getArticleByUri(article.uri)
        if (Option.isSome(existing)) {
          return existing.value
        }
        return yield* insertArticle(article)
      })

    /**
     * Update article
     */
    const updateArticle = (id: ArticleId, updates: Partial<ArticleInsertRow>) =>
      Effect.gen(function*() {
        const [result] = yield* drizzle
            .update(articles)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(articles.id, id))
            .returning()
        return Option.fromNullishOr(result)
      })

    /**
     * Set graph URI for article
     */
    const setGraphUri = (id: ArticleId, graphUri: string) => updateArticle(id, { graphUri })

    // -------------------------------------------------------------------------
    // Query Operations
    // -------------------------------------------------------------------------

    /**
     * Build WHERE conditions from a filter
     */
    const buildWhereConditions = (filter: ArticleFilter) => {
      const conditions = []

      if (filter.ontologyId) {
        conditions.push(eq(articles.ontologyId, filter.ontologyId))
      }
      if (filter.sourceName) {
        conditions.push(eq(articles.sourceName, filter.sourceName))
      }
      if (filter.publishedAfter) {
        conditions.push(gte(articles.publishedAt, filter.publishedAfter))
      }
      if (filter.publishedBefore) {
        conditions.push(lte(articles.publishedAt, filter.publishedBefore))
      }
      if (filter.uriPattern) {
        conditions.push(like(articles.uri, `%${filter.uriPattern}%`))
      }

      return conditions
    }

    /**
     * Get articles with filters
     */
    const getArticles = (filter: ArticleFilter) =>
      Effect.gen(function*() {
        const conditions = buildWhereConditions(filter)

        let query = drizzle
          .select()
          .from(articles)
          .orderBy(desc(articles.publishedAt))

        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as typeof query
        }
        if (filter.limit) {
          query = query.limit(filter.limit) as typeof query
        }
        if (filter.offset) {
          query = query.offset(filter.offset) as typeof query
        }

        return yield* query
      })

    /**
     * Get articles by source name
     */
    const getArticlesBySource = (sourceName: string, limit?: number) =>
      getArticles({ sourceName, ...(limit === undefined ? {} : { limit }) })

    /**
     * Get articles in date range
     */
    const getArticlesInDateRange = (from: Date, to: Date, limit?: number) =>
      getArticles({ publishedAfter: from, publishedBefore: to, ...(limit === undefined ? {} : { limit }) })

    /**
     * Get recent articles
     */
    const getRecentArticles = (limit: number = 10) => getArticles({ limit })

    /**
     * Count articles with filters using SQL COUNT
     */
    const countArticles = (filter: ArticleFilter = {}) =>
      Effect.gen(function*() {
        const conditions = buildWhereConditions(filter)

        let query = drizzle
          .select({ count: sql<number>`count(*)::int` })
          .from(articles)

        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as typeof query
        }

        const result = yield* query
        return result[0]?.count ?? 0
      })

    // -------------------------------------------------------------------------
    // Bulk Operations
    // -------------------------------------------------------------------------

    /**
     * Insert multiple articles in a batch
     */
    const insertArticlesBatch = (articleList: Array<ArticleInsertRow>) =>
      Effect.gen(function*() {
        if (articleList.length === 0) return []
        return yield* drizzle.insert(articles).values(articleList).returning()
      })

    /**
     * Check if article exists by URI
     */
    const articleExists = (uri: string) =>
      Effect.gen(function*() {
        const result = yield* getArticleByUri(uri)
        return Option.isSome(result)
      })

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
      articleExists
    }
  }),
}) {
  static readonly Default = Layer.effect(this, this.make)
}
