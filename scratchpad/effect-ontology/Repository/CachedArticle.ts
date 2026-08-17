/**
 * Cached Article Repository
 *
 * **Details**
 *
 * Effect.Cache wrapper around ArticleRepository for frequently accessed queries.
 * Caches single article lookups with TTL.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Layer } from "effect";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effect-ontology/Repository/CachedArticle");

import { Cache, Data, Duration, Effect } from "effect";
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

class ScopedCacheKey extends Data.Class<{
  readonly ontologyId: string;
  readonly value: string;
}> {}

// =============================================================================
// Service
// =============================================================================

/**
 * CachedArticleRepository service
 *
 * **Details**
 *
 * Wraps ArticleRepository with Effect.Cache for hot-path queries.
 * Maintains same interface as ArticleRepository.
 *
 * **Example** (Inspect cached article repository)
 *
 * ```ts
 * import { CachedArticleRepository } from "@effect-ontology/Repository/CachedArticle"
 *
 * console.log(CachedArticleRepository)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class CachedArticleRepository extends Context.Service<CachedArticleRepository>()($I`CachedArticleRepository`, {
  make: Effect.gen(function* () {
    const repo = yield* ArticleRepository;

    // Single article lookup by ID cache
    const articleCache = yield* Cache.make({
      capacity: ARTICLE_CACHE_CAPACITY,
      timeToLive: ARTICLE_CACHE_TTL,
      lookup: (key: ScopedCacheKey) => repo.getArticle(key.value, key.ontologyId),
    });

    const scopedCacheKey = (value: string, ontologyId: string): ScopedCacheKey =>
      new ScopedCacheKey({ ontologyId, value });

    // Article lookup by URI cache
    const uriCache = yield* Cache.make({
      capacity: URI_CACHE_CAPACITY,
      timeToLive: URI_CACHE_TTL,
      lookup: (key: ScopedCacheKey) => repo.getArticleByUri(key.value, key.ontologyId),
    });

    // Cached single article lookup by ID
    const getArticle = (id: ArticleId, ontologyId: string) => Cache.get(articleCache, scopedCacheKey(id, ontologyId));

    // Cached article lookup by URI
    const getArticleByUri = (uri: string, ontologyId: string) => Cache.get(uriCache, scopedCacheKey(uri, ontologyId));

    // Invalidate caches on insert
    const insertArticle = (article: ArticleInsertRow) =>
      repo
        .insertArticle(article)
        .pipe(
          Effect.tap((result) =>
            Cache.invalidate(articleCache, scopedCacheKey(result.id, article.ontologyId)).pipe(
              Effect.tap(() => Cache.invalidate(uriCache, scopedCacheKey(article.uri, article.ontologyId)))
            )
          )
        );

    // Invalidate caches on update
    const updateArticle = (id: ArticleId, ontologyId: string, updates: Omit<Partial<ArticleInsertRow>, "ontologyId">) =>
      repo.updateArticle(id, ontologyId, updates).pipe(
        Effect.tap(() =>
          Cache.invalidate(articleCache, scopedCacheKey(id, ontologyId)).pipe(
            Effect.tap(() =>
              // If URI was updated, invalidate old and new URI caches
              P.isNotUndefined(updates.uri)
                ? Cache.invalidate(uriCache, scopedCacheKey(updates.uri, ontologyId))
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
            Cache.invalidate(articleCache, scopedCacheKey(result.id, article.ontologyId)).pipe(
              Effect.tap(() => Cache.invalidate(uriCache, scopedCacheKey(article.uri, article.ontologyId)))
            )
          )
        );

    // Invalidate caches on batch insert
    const insertArticlesBatch = (articleList: Array<ArticleInsertRow>) =>
      repo.insertArticlesBatch(articleList).pipe(
        Effect.tap((results) =>
          Effect.all(
            A.appendAll(
              A.map(results, (result) => Cache.invalidate(articleCache, scopedCacheKey(result.id, result.ontologyId))),
              A.map(articleList, (article) =>
                Cache.invalidate(uriCache, scopedCacheKey(article.uri, article.ontologyId))
              )
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
 * **Example** (Inspect cached article repository layer)
 *
 * ```ts
 * import { CachedArticleRepositoryLayer } from "@effect-ontology/Repository/CachedArticle"
 *
 * console.log(CachedArticleRepositoryLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CachedArticleRepositoryLayer = CachedArticleRepository.Default;
