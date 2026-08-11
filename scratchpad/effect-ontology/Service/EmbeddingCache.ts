/**
 * Service: Embedding Cache
 *
 * Content-addressable cache for embedding vectors with TTL and LRU eviction.
 *
 * @since 2.0.0
 * @module Service/EmbeddingCache
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Duration, Effect, HashMap, Layer, Option, Ref, Schema } from "effect";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type { ConfigService } from "./Config.ts";
import { StorageService, type StorageServiceMethods } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/EmbeddingCache");

/**
 * Embedding vector type
 *
 * @since 2.0.0
 * @category Model
 */
export const Embedding = Schema.Array(Schema.Finite);
export type Embedding = typeof Embedding.Type;

/**
 * Cache entry with embedding and access timestamp for LRU eviction
 *
 * @since 2.0.0
 * @category Model
 */
interface CacheEntry {
  readonly embedding: Embedding;
  readonly createdAt: number;
  readonly lastAccessedAt: number;
}

/**
 * Cache configuration
 *
 * @since 2.0.0
 * @category Config
 */
export interface EmbeddingCacheConfig {
  readonly ttlMs: number;
  readonly maxEntries: number;
}

/**
 * Default cache configuration
 *
 * @since 2.0.0
 * @category Config
 */
export const defaultCacheConfig: EmbeddingCacheConfig = {
  ttlMs: Duration.toMillis(Duration.hours(1)),
  maxEntries: 10000,
};

/**
 * EmbeddingCache service interface
 *
 * @since 2.0.0
 * @category Service
 */
export interface EmbeddingCacheService {
  readonly get: (hash: string) => Effect.Effect<Option.Option<Embedding>>;
  readonly set: (hash: string, embedding: Embedding) => Effect.Effect<void>;
  readonly has: (hash: string) => Effect.Effect<boolean>;
  readonly size: Effect.Effect<number>;
  readonly clear: Effect.Effect<void>;
}

/**
 * EmbeddingCache service tag
 *
 * @since 2.0.0
 * @category Service
 */
export class EmbeddingCache extends Context.Service<EmbeddingCache, EmbeddingCacheService>()($I`EmbeddingCache`) {
  /**
   * In-memory implementation with TTL and LRU eviction
   *
   * @since 2.0.0
   * @category Layers
   */
  static readonly InMemory = (config: EmbeddingCacheConfig = defaultCacheConfig): Layer.Layer<EmbeddingCache> =>
    Layer.effect(
      EmbeddingCache,
      Effect.gen(function* () {
        const cache = yield* Ref.make(HashMap.empty<string, CacheEntry>());

        const isExpired = (entry: CacheEntry, now: number): boolean => now - entry.createdAt > config.ttlMs;

        const evictLRU = (map: HashMap.HashMap<string, CacheEntry>): HashMap.HashMap<string, CacheEntry> => {
          if (HashMap.size(map) < config.maxEntries) return map;

          // Find the LRU entry
          let lruKey: string | null = null;
          let lruTime = Infinity;

          for (const [key, entry] of map) {
            if (entry.lastAccessedAt < lruTime) {
              lruTime = entry.lastAccessedAt;
              lruKey = key;
            }
          }

          return P.isNotNull(lruKey) ? HashMap.remove(map, lruKey) : map;
        };

        return {
          get: Effect.fn(function* (hash: string) {
            const now = yield* Clock.currentTimeMillis;
            const map = yield* Ref.get(cache);
            const entry = HashMap.get(map, hash);
            if (Option.isNone(entry)) {
              return Option.none();
            }
            if (isExpired(entry.value, now)) {
              yield* Ref.update(cache, HashMap.remove(hash));
              return Option.none();
            }
            yield* Ref.update(cache, (m) =>
              HashMap.set(m, hash, {
                ...entry.value,
                lastAccessedAt: now,
              })
            );
            return Option.some(entry.value.embedding);
          }),
          set: Effect.fn(function* (hash: string, embedding: Embedding) {
            const now = yield* Clock.currentTimeMillis;
            yield* Ref.update(cache, (map) => {
              const evicted = evictLRU(map);
              return HashMap.set(evicted, hash, {
                embedding,
                createdAt: now,
                lastAccessedAt: now,
              });
            });
          }),
          has: Effect.fn(function* (hash: string) {
            const now = yield* Clock.currentTimeMillis;
            const map = yield* Ref.get(cache);
            const entry = HashMap.get(map, hash);
            if (Option.isNone(entry)) return false;
            if (isExpired(entry.value, now)) {
              yield* Ref.update(cache, HashMap.remove(hash));
              return false;
            }
            return true;
          }),
          size: Ref.get(cache).pipe(Effect.map(HashMap.size)),
          clear: Ref.set(cache, HashMap.empty()),
        };
      })
    );

  /**
   * Default in-memory implementation with standard config
   *
   * @since 2.0.0
   * @category Layers
   */
  static readonly Default: Layer.Layer<EmbeddingCache> = EmbeddingCache.InMemory();
}

/**
 * Test layer that always misses cache
 *
 * @since 2.0.0
 * @category Layers
 */
export const EmbeddingCacheTest: Layer.Layer<EmbeddingCache> = Layer.succeed(EmbeddingCache, {
  get: Effect.fn("EmbeddingCache.get")((_hash: string) => Effect.succeed(Option.none())),
  set: Effect.fn("EmbeddingCache.set")((_hash: string, _embedding: Embedding) => Effect.void),
  has: Effect.fn("EmbeddingCache.has")((_hash: string) => Effect.succeed(false)),
  size: Effect.succeed(0),
  clear: Effect.void,
});

// =============================================================================
// Persistent Embedding Cache Types
// =============================================================================

/**
 * Extended cache interface with persistence and warm-up capabilities
 *
 * @since 2.0.0
 * @category Service
 */
export interface PersistentEmbeddingCacheService extends EmbeddingCacheService {
  /**
   * Warm up the cache by loading embeddings from persistent storage
   * @returns Number of embeddings loaded
   */
  readonly warmUp: Effect.Effect<number>;

  /**
   * Flush all in-memory embeddings to persistent storage
   * @returns Number of embeddings persisted
   */
  readonly flush: Effect.Effect<number>;

  /**
   * Get cache statistics
   */
  readonly stats: Effect.Effect<{
    readonly memorySize: number;
    readonly memoryHits: number;
    readonly memoryMisses: number;
    readonly persistentHits: number;
    readonly persistentMisses: number;
  }>;
}

/**
 * PersistentEmbeddingCache service tag
 *
 * @since 2.0.0
 * @category Service
 */
export class PersistentEmbeddingCache extends Context.Service<
  PersistentEmbeddingCache,
  PersistentEmbeddingCacheService
>()($I`PersistentEmbeddingCache`) {}

/**
 * Embedding blob format for storage
 *
 * @since 2.0.0
 * @category Model
 */
const PersistentEmbeddingEntry = Schema.Struct({
  vector: Embedding,
  createdAt: Schema.Finite,
});

const EmbeddingBlob = Schema.Struct({
  version: Schema.Literal(1),
  embeddings: Schema.Record(Schema.String, PersistentEmbeddingEntry),
});
type EmbeddingBlob = typeof EmbeddingBlob.Type;

const decodeEmbeddingBlob = Schema.decodeUnknownOption(Schema.fromJsonString(EmbeddingBlob));
const encodeEmbeddingBlob = Schema.encodeEffect(Schema.fromJsonString(EmbeddingBlob));

/**
 * Create persistent embedding cache with GCS backing
 *
 * Architecture:
 * - Uses in-memory HashMap for fast lookups
 * - Falls back to GCS on memory miss
 * - Writes to both memory and GCS on set
 * - Batch writes use a single blob per batch to minimize GCS operations
 *
 * @since 2.0.0
 * @category Layers
 */
export const makePersistentEmbeddingCache = Effect.fn(function* (
  storage: StorageServiceMethods,
  cachePath: string,
  config: EmbeddingCacheConfig = defaultCacheConfig
): Effect.fn.Return<PersistentEmbeddingCacheService> {
  // In-memory cache for fast lookups
  const memoryCache = yield* Ref.make(HashMap.empty<string, CacheEntry>());

  // Statistics tracking
  const stats = yield* Ref.make({
    memoryHits: 0,
    memoryMisses: 0,
    persistentHits: 0,
    persistentMisses: 0,
  });

  const isExpired = (entry: CacheEntry, now: number): boolean => now - entry.createdAt > config.ttlMs;

  const evictLRU = (map: HashMap.HashMap<string, CacheEntry>): HashMap.HashMap<string, CacheEntry> => {
    if (HashMap.size(map) < config.maxEntries) return map;

    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of map) {
      if (entry.lastAccessedAt < lruTime) {
        lruTime = entry.lastAccessedAt;
        lruKey = key;
      }
    }

    return P.isNotNull(lruKey) ? HashMap.remove(map, lruKey) : map;
  };

  // Load embedding from GCS
  const loadFromStorage = Effect.fn(function* (hash: string): Effect.fn.Return<Option.Option<Embedding>> {
    const blobPath = `${cachePath}/${Str.takeLeft(2)(hash)}/${hash}.json`;
    const content = yield* storage.get(blobPath).pipe(Effect.catch(() => Effect.void));

    if (content === undefined) {
      return Option.none();
    }

    const blob = decodeEmbeddingBlob(content);
    if (Option.isNone(blob)) return Option.none();

    const entry = blob.value.embeddings[hash];
    if (P.isUndefined(entry)) return Option.none();

    const now = yield* Clock.currentTimeMillis;
    if (now - entry.createdAt > config.ttlMs) {
      // Expired in storage too
      return Option.none();
    }

    return Option.some(entry.vector);
  });

  // Save embedding to GCS
  const saveToStorage = Effect.fn(function* (hash: string, embedding: Embedding): Effect.fn.Return<void> {
    const blobPath = `${cachePath}/${Str.takeLeft(2)(hash)}/${hash}.json`;
    const now = yield* Clock.currentTimeMillis;

    const blob: EmbeddingBlob = {
      version: 1,
      embeddings: {
        [hash]: {
          vector: embedding,
          createdAt: now,
        },
      },
    };

    const blobJson = yield* encodeEmbeddingBlob(blob).pipe(Effect.orDie);
    yield* storage.set(blobPath, blobJson).pipe(
      Effect.catch((error) =>
        Effect.logWarning("Failed to persist embedding to storage", {
          hash,
          error: String(error),
        })
      )
    );
  });

  return {
    get: Effect.fn(function* (hash: string) {
      const now = yield* Clock.currentTimeMillis;
      const map = yield* Ref.get(memoryCache);
      const entry = HashMap.get(map, hash);

      // Check in-memory cache first
      if (Option.isSome(entry)) {
        if (isExpired(entry.value, now)) {
          yield* Ref.update(memoryCache, HashMap.remove(hash));
        } else {
          // Memory hit - update access time
          yield* Ref.update(memoryCache, (m) =>
            HashMap.set(m, hash, {
              ...entry.value,
              lastAccessedAt: now,
            })
          );
          yield* Ref.update(stats, (s) => ({
            ...s,
            memoryHits: s.memoryHits + 1,
          }));
          return Option.some(entry.value.embedding);
        }
      }

      // Memory miss - check persistent storage
      yield* Ref.update(stats, (s) => ({
        ...s,
        memoryMisses: s.memoryMisses + 1,
      }));

      const persisted = yield* loadFromStorage(hash);
      if (Option.isSome(persisted)) {
        // Persistent hit - add to memory cache
        yield* Ref.update(stats, (s) => ({
          ...s,
          persistentHits: s.persistentHits + 1,
        }));
        yield* Ref.update(memoryCache, (m) => {
          const evicted = evictLRU(m);
          return HashMap.set(evicted, hash, {
            embedding: persisted.value,
            createdAt: now,
            lastAccessedAt: now,
          });
        });
        return persisted;
      }

      // Complete miss
      yield* Ref.update(stats, (s) => ({
        ...s,
        persistentMisses: s.persistentMisses + 1,
      }));
      return Option.none();
    }),

    set: Effect.fn(function* (hash: string, embedding: Embedding) {
      const now = yield* Clock.currentTimeMillis;

      // Store in memory
      yield* Ref.update(memoryCache, (map) => {
        const evicted = evictLRU(map);
        return HashMap.set(evicted, hash, {
          embedding,
          createdAt: now,
          lastAccessedAt: now,
        });
      });

      // Persist to storage (fire-and-forget with error logging)
      yield* Effect.forkDetach(saveToStorage(hash, embedding));
    }),

    has: Effect.fn(function* (hash: string) {
      const now = yield* Clock.currentTimeMillis;
      const map = yield* Ref.get(memoryCache);
      const entry = HashMap.get(map, hash);

      if (Option.isSome(entry)) {
        if (isExpired(entry.value, now)) {
          yield* Ref.update(memoryCache, HashMap.remove(hash));
          return false;
        }
        return true;
      }

      // Check persistent storage
      const persisted = yield* loadFromStorage(hash);
      return Option.isSome(persisted);
    }),

    size: Ref.get(memoryCache).pipe(Effect.map(HashMap.size)),

    // Note: Does not clear GCS - that would need storage.clear
    clear: Ref.set(memoryCache, HashMap.empty()),

    warmUp: Effect.gen(function* () {
      // List all embedding blobs in the cache path
      const files = yield* storage.list(cachePath).pipe(Effect.orElseSucceed(() => [] as Array<string>));

      let loaded = 0;
      const now = yield* Clock.currentTimeMillis;

      // Load each blob (limit concurrency to avoid overwhelming storage)
      yield* Effect.forEach(
        A.filter(files, Str.endsWith(".json")),
        (file) =>
          Effect.gen(function* () {
            const content = yield* storage.get(file).pipe(Effect.catch(() => Effect.void));

            if (content === undefined) return;

            const blob = decodeEmbeddingBlob(content);
            if (Option.isNone(blob)) return;

            for (const [hash, entry] of R.toEntries(blob.value.embeddings)) {
              // Skip expired entries
              if (now - entry.createdAt > config.ttlMs) continue;

              yield* Ref.update(memoryCache, (map) => {
                if (HashMap.size(map) >= config.maxEntries) return map;
                return HashMap.set(map, hash, {
                  embedding: entry.vector,
                  createdAt: entry.createdAt,
                  lastAccessedAt: now,
                });
              });
              loaded++;
            }
          }),
        { concurrency: 10 }
      );

      yield* Effect.logInfo("Embedding cache warmed up", {
        loaded,
        files: files.length,
      });
      return loaded;
    }),

    flush: Effect.gen(function* () {
      const map = yield* Ref.get(memoryCache);
      let persisted = 0;

      yield* Effect.forEach(
        HashMap.entries(map),
        ([hash, entry]) =>
          Effect.gen(function* () {
            yield* saveToStorage(hash, entry.embedding);
            persisted++;
          }),
        { concurrency: 20 }
      );

      yield* Effect.logInfo("Embedding cache flushed", { persisted });
      return persisted;
    }),

    stats: Effect.gen(function* () {
      const memorySize = yield* Ref.get(memoryCache).pipe(Effect.map(HashMap.size));
      const s = yield* Ref.get(stats);
      return { memorySize, ...s };
    }),
  };
});

/**
 * Layer that provides PersistentEmbeddingCache when EMBEDDING_CACHE_PATH is configured,
 * otherwise provides standard in-memory EmbeddingCache.
 *
 * Dependencies:
 * - ConfigService (for embedding.cachePath, cacheTtlHours, cacheMaxEntries)
 * - StorageService (for GCS persistence when cachePath is set)
 *
 * @since 2.0.0
 * @category Layers
 */
const PersistentEmbeddingCacheLayer = Layer.effect(
  PersistentEmbeddingCache,
  Effect.gen(function* () {
    // Import dynamically to avoid circular dependency
    const { ConfigService: ConfigSvc } = yield* Effect.promise(() => import("./Config.ts"));
    const config = yield* ConfigSvc;
    const storage = yield* StorageService;

    const cachePath = Option.getOrUndefined(config.embedding.cachePath);

    if (P.isUndefined(cachePath)) {
      // No persistence path configured - return in-memory only
      yield* Effect.logDebug("Embedding cache: in-memory only (no EMBEDDING_CACHE_PATH set)");
      const cache = yield* Ref.make(HashMap.empty<string, CacheEntry>());
      const cacheConfig: EmbeddingCacheConfig = {
        ttlMs: Duration.toMillis(Duration.hours(config.embedding.cacheTtlHours)),
        maxEntries: config.embedding.cacheMaxEntries,
      };

      const isExpired = (entry: CacheEntry, now: number): boolean => now - entry.createdAt > cacheConfig.ttlMs;

      const evictLRU = (map: HashMap.HashMap<string, CacheEntry>): HashMap.HashMap<string, CacheEntry> => {
        if (HashMap.size(map) < cacheConfig.maxEntries) return map;
        let lruKey: string | null = null;
        let lruTime = Infinity;
        for (const [key, entry] of map) {
          if (entry.lastAccessedAt < lruTime) {
            lruTime = entry.lastAccessedAt;
            lruKey = key;
          }
        }
        return P.isNotNull(lruKey) ? HashMap.remove(map, lruKey) : map;
      };

      return {
        get: Effect.fn(function* (hash: string) {
          const now = yield* Clock.currentTimeMillis;
          const map = yield* Ref.get(cache);
          const entry = HashMap.get(map, hash);
          if (Option.isNone(entry)) return Option.none();
          if (isExpired(entry.value, now)) {
            yield* Ref.update(cache, HashMap.remove(hash));
            return Option.none();
          }
          yield* Ref.update(cache, (m) =>
            HashMap.set(m, hash, {
              ...entry.value,
              lastAccessedAt: now,
            })
          );
          return Option.some(entry.value.embedding);
        }),
        set: Effect.fn(function* (hash: string, embedding: Embedding) {
          const now = yield* Clock.currentTimeMillis;
          yield* Ref.update(cache, (map) => {
            const evicted = evictLRU(map);
            return HashMap.set(evicted, hash, {
              embedding,
              createdAt: now,
              lastAccessedAt: now,
            });
          });
        }),
        has: Effect.fn(function* (hash: string) {
          const now = yield* Clock.currentTimeMillis;
          const map = yield* Ref.get(cache);
          const entry = HashMap.get(map, hash);
          if (Option.isNone(entry)) return false;
          if (isExpired(entry.value, now)) {
            yield* Ref.update(cache, HashMap.remove(hash));
            return false;
          }
          return true;
        }),
        size: Ref.get(cache).pipe(Effect.map(HashMap.size)),
        clear: Ref.set(cache, HashMap.empty()),
        warmUp: Effect.succeed(0),
        flush: Effect.succeed(0),
        stats: Effect.gen(function* () {
          const memorySize = yield* Ref.get(cache).pipe(Effect.map(HashMap.size));
          return {
            memorySize,
            memoryHits: 0,
            memoryMisses: 0,
            persistentHits: 0,
            persistentMisses: 0,
          };
        }),
      } as PersistentEmbeddingCacheService;
    }

    // Persistence enabled - create persistent cache
    yield* Effect.logInfo("Embedding cache: GCS-backed persistence enabled", { cachePath });
    const cacheConfig: EmbeddingCacheConfig = {
      ttlMs: Duration.toMillis(Duration.hours(config.embedding.cacheTtlHours)),
      maxEntries: config.embedding.cacheMaxEntries,
    };

    return yield* makePersistentEmbeddingCache(storage, cachePath, cacheConfig);
  })
);

const EmbeddingCacheAliasLayer = Layer.effect(EmbeddingCache, PersistentEmbeddingCache.use(Effect.succeed)).pipe(
  Layer.provide(PersistentEmbeddingCacheLayer)
);

export const EmbeddingCacheWithPersistence: Layer.Layer<
  EmbeddingCache | PersistentEmbeddingCache,
  never,
  ConfigService | StorageService
> = Layer.merge(PersistentEmbeddingCacheLayer, EmbeddingCacheAliasLayer);
