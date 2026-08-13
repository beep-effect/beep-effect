/**
 * Cached Article Repository
 *
 * Effect.Cache wrapper around ArticleRepository for frequently accessed queries.
 * Caches single article lookups with TTL.
 *
 * @since 2.0.0
 * @module Repository/CachedArticle
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Layer } from "effect";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effect-ontology/Repository/CachedArticle");

import { Cache, Duration, Effect } from "effect";
import * as A from "effect/Array";
import type { ArticleId } from "./Article.ts";
import { ArticleRepository } from "./Article.ts";
import type { ArticleInsertRow } from "./schema.ts";

// =============================================================================
// Cache Configuration
// =============================================================================

const ARTICLE_CACHE_CAPACITY = 5_000;
const ARTICLE_CACHE_TTL = Duration.hours(1);

const URI_CACHE_CAPACITY = 5_000;
const URI_CACHE_TTL = Duration.hours(1);

// =============================================================================
// Service
// =============================================================================

/**
 * CachedArticleRepository service
 *
 * Wraps ArticleRepository with Effect.Cache for hot-path queries.
 * Maintains same interface as ArticleRepository.
 *
 * @since 2.0.0
 * @category Service
 */
export class CachedArticleRepository extends Context.Service<CachedArticleRepository>()($I`CachedArticleRepository`, {
  make: Effect.gen(function* () {
    const repo = yield* ArticleRepository;

    // Single article lookup by ID cache
    const articleCache = yield* Cache.make({
      capacity: ARTICLE_CACHE_CAPACITY,
      timeToLive: ARTICLE_CACHE_TTL,
      lookup: (id: ArticleId) => repo.getArticle(id),
    });

    const uriCacheKey = (uri: string, ontologyId?: string): string =>
      P.isUndefined(ontologyId) ? uri : `${ontologyId}\u0000${uri}`;

    // Article lookup by URI cache
    const uriCache = yield* Cache.make({
      capacity: URI_CACHE_CAPACITY,
      timeToLive: URI_CACHE_TTL,
      lookup: (key: string) => {
        const separator = key.indexOf("\u0000");
        return separator === -1
          ? repo.getArticleByUri(key)
          : repo.getArticleByUri(key.slice(separator + 1), key.slice(0, separator));
      },
    });

    // Cached single article lookup by ID
    const getArticle = (id: ArticleId) => Cache.get(articleCache, id);

    // Cached article lookup by URI
    const getArticleByUri = (uri: string, ontologyId?: string) => Cache.get(uriCache, uriCacheKey(uri, ontologyId));

    // Invalidate caches on insert
    const insertArticle = (article: ArticleInsertRow) =>
      repo
        .insertArticle(article)
        .pipe(
          Effect.tap((result) =>
            Cache.invalidate(articleCache, result.id).pipe(
              Effect.tap(() => Cache.invalidate(uriCache, uriCacheKey(article.uri, article.ontologyId)))
            )
          )
        );

    // Invalidate caches on update
    const updateArticle = (id: ArticleId, updates: Partial<ArticleInsertRow>) =>
      repo.updateArticle(id, updates).pipe(
        Effect.tap(() =>
          Cache.invalidate(articleCache, id).pipe(
            Effect.tap(() =>
              // If URI was updated, invalidate old and new URI caches
              P.isNotUndefined(updates.uri)
                ? Cache.invalidate(uriCache, uriCacheKey(updates.uri, updates.ontologyId))
                : Effect.void
            )
          )
        )
      );

    // Invalidate caches on getOrCreate (may insert)
    const getOrCreateArticle = (article: ArticleInsertRow) =>
      repo
        .getOrCreateArticle(article)
        .pipe(
          Effect.tap((result) =>
            Cache.invalidate(articleCache, result.id).pipe(
              Effect.tap(() => Cache.invalidate(uriCache, uriCacheKey(article.uri, article.ontologyId)))
            )
          )
        );

    // Invalidate caches on batch insert
    const insertArticlesBatch = (articleList: Array<ArticleInsertRow>) =>
      repo.insertArticlesBatch(articleList).pipe(
        Effect.tap((results) =>
          Effect.all(
            A.appendAll(
              A.map(results, (result) => Cache.invalidate(articleCache, result.id)),
              A.map(articleList, (article) => Cache.invalidate(uriCache, uriCacheKey(article.uri, article.ontologyId)))
            ),
            { concurrency: "unbounded", discard: true }
          )
        )
      );

    return {
      getArticle,
      getArticleByUri,
      insertArticle,
      updateArticle,
      getOrCreateArticle,
      insertArticlesBatch,
      setGraphUri: repo.setGraphUri,
      getArticles: repo.getArticles,
      getArticlesBySource: repo.getArticlesBySource,
      getArticlesInDateRange: repo.getArticlesInDateRange,
      getRecentArticles: repo.getRecentArticles,
      countArticles: repo.countArticles,
      articleExists: repo.articleExists,
      invalidateAll: Effect.fn("CachedArticleRepository.invalidateAll")(() =>
        Cache.invalidateAll(articleCache).pipe(Effect.tap(() => Cache.invalidateAll(uriCache)))
      ),
      cacheStats: Effect.fn("CachedArticleRepository.cacheStats")(() =>
        Effect.all({
          articleCacheSize: Cache.size(articleCache),
          uriCacheSize: Cache.size(uriCache),
        })
      ),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide(ArticleRepository.Default));
}

/**
 * Layer that provides CachedArticleRepository
 *
 * @since 2.0.0
 * @category Layers
 */
export const CachedArticleRepositoryLayer = CachedArticleRepository.Default;
