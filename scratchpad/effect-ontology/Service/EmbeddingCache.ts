/**
 * Service: Embedding Cache
 *
 * **Details**
 *
 * Content-addressable cache for embedding vectors with TTL and LRU eviction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { EpochMillis } from "@beep/schema/Timestamp";
import { Clock, Context, Duration, Effect, HashMap, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ConfigService } from "./Config.ts";
import type { StorageServiceMethods } from "./Storage.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/EmbeddingCache");

/**
 * Embedding vector type
 *
 * **Example** (Validate embedding)
 *
 * ```ts
 * import { Embedding } from "@effect-ontology/Service/EmbeddingCache"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Embedding)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Embedding = S.Array(S.Finite);
/**
 * Describes the embedding data exposed by this module.
 *
 *
 * **Example** (Use the Embedding contract)
 *
 * ```ts
 * import type { Embedding } from "@effect-ontology/Service/EmbeddingCache"
 *
 * const acceptsEmbedding = (_value: Embedding): void => undefined
 *
 * console.log(acceptsEmbedding)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Embedding = typeof Embedding.Type;

/**
 * Cache entry with embedding and access timestamp for LRU eviction
 *
 * @since 0.0.0
 * @category models
 */
interface CacheEntry {
  readonly embedding: Embedding;
  readonly createdAt: EpochMillis;
  readonly lastAccessedAt: number;
}

/**
 * Cache configuration
 *
 *
 * **Example** (Use the EmbeddingCacheConfig contract)
 *
 * ```ts
 * import type { EmbeddingCacheConfig } from "@effect-ontology/Service/EmbeddingCache"
 *
 * const acceptsEmbeddingCacheConfig = (_value: EmbeddingCacheConfig): void => undefined
 *
 * console.log(acceptsEmbeddingCacheConfig)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EmbeddingCacheConfig {
  readonly ttlMs: number;
  readonly maxEntries: number;
}

/**
 * Default cache configuration
 *
 * **Example** (Inspect default cache config)
 *
 * ```ts
 * import { defaultCacheConfig } from "@effect-ontology/Service/EmbeddingCache"
 *
 * console.log(defaultCacheConfig)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const defaultCacheConfig: EmbeddingCacheConfig = {
  ttlMs: Duration.toMillis(Duration.hours(1)),
  maxEntries: 10000,
};

/**
 * EmbeddingCache service interface
 *
 *
 * **Example** (Use the EmbeddingCacheService contract)
 *
 * ```ts
 * import type { EmbeddingCacheService } from "@effect-ontology/Service/EmbeddingCache"
 *
 * const acceptsEmbeddingCacheService = (_value: EmbeddingCacheService): void => undefined
 *
 * console.log(acceptsEmbeddingCacheService)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EmbeddingCacheService {
  readonly get: (hash: string) => Effect.Effect<O.Option<Embedding>>;
  readonly set: (hash: string, embedding: Embedding) => Effect.Effect<void>;
  readonly has: (hash: string) => Effect.Effect<boolean>;
  readonly size: Effect.Effect<number>;
  readonly clear: Effect.Effect<void>;
}

/**
 * EmbeddingCache service tag
 *
 * **Example** (Inspect embedding cache)
 *
 * ```ts
 * import { EmbeddingCache } from "@effect-ontology/Service/EmbeddingCache"
 *
 * console.log(EmbeddingCache)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class EmbeddingCache extends Context.Service<EmbeddingCache, EmbeddingCacheService>()($I`EmbeddingCache`) {
  /**
   * In-memory implementation with TTL and LRU eviction
   *
   * @since 0.0.0
   * @category layers
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
            if (O.isNone(entry)) {
              return O.none();
            }
            if (isExpired(entry.value, now)) {
              yield* Ref.update(cache, HashMap.remove(hash));
              return O.none();
            }
            yield* Ref.update(cache, (m) =>
              HashMap.set(m, hash, {
                ...entry.value,
                lastAccessedAt: now,
              })
            );
            return O.some(entry.value.embedding);
          }),
          set: Effect.fn(function* (hash: string, embedding: Embedding) {
            const now = yield* Clock.currentTimeMillis;
            yield* Ref.update(cache, (map) => {
              const evicted = evictLRU(map);
              return HashMap.set(evicted, hash, {
                embedding,
                createdAt: EpochMillis.make(now),
                lastAccessedAt: now,
              });
            });
          }),
          has: Effect.fn(function* (hash: string) {
            const now = yield* Clock.currentTimeMillis;
            const map = yield* Ref.get(cache);
            const entry = HashMap.get(map, hash);
            if (O.isNone(entry)) return false;
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
   * @since 0.0.0
   * @category layers
   */
  static readonly Default: Layer.Layer<EmbeddingCache> = EmbeddingCache.InMemory();
}

/**
 * Test layer that always misses cache
 *
 * **Example** (Inspect embedding cache test)
 *
 * ```ts
 * import { EmbeddingCacheTest } from "@effect-ontology/Service/EmbeddingCache"
 *
 * console.log(EmbeddingCacheTest)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingCacheTest: Layer.Layer<EmbeddingCache> = Layer.succeed(EmbeddingCache, {
  get: Effect.fn("EmbeddingCache.get")((_hash: string) => Effect.succeed(O.none())),
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
 *
 * **Example** (Use the PersistentEmbeddingCacheService contract)
 *
 * ```ts
 * import type { PersistentEmbeddingCacheService } from "@effect-ontology/Service/EmbeddingCache"
 *
 * const acceptsPersistentEmbeddingCacheService = (_value: PersistentEmbeddingCacheService): void => undefined
 *
 * console.log(acceptsPersistentEmbeddingCacheService)
 * ```
 *
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Inspect persistent embedding cache)
 *
 * ```ts
 * import { PersistentEmbeddingCache } from "@effect-ontology/Service/EmbeddingCache"
 *
 * console.log(PersistentEmbeddingCache)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PersistentEmbeddingCache extends Context.Service<
  PersistentEmbeddingCache,
  PersistentEmbeddingCacheService
>()($I`PersistentEmbeddingCache`) {}

/**
 * Embedding blob format for storage
 *
 * @since 0.0.0
 * @category models
 */
const PersistentEmbeddingEntry = S.Struct({
  vector: Embedding,
  createdAt: EpochMillis,
});

const EmbeddingBlob = S.Struct({
  version: S.Literal(1),
  embeddings: S.Record(S.String, PersistentEmbeddingEntry),
});
type EmbeddingBlob = typeof EmbeddingBlob.Type;

const decodeEmbeddingBlob = S.decodeUnknownOption(S.fromJsonString(EmbeddingBlob));
const encodeEmbeddingBlob = S.encodeEffect(S.fromJsonString(EmbeddingBlob));

/**
 * Create persistent embedding cache with GCS backing
 *
 * **Details**
 *
 * Architecture:
 * - Uses in-memory HashMap for fast lookups
 * - Falls back to GCS on memory miss
 * - Writes to both memory and GCS on set
 * - Batch writes use a single blob per batch to minimize GCS operations
 *
 * **Example** (Inspect make persistent embedding cache)
 *
 * ```ts
 * import { makePersistentEmbeddingCache } from "@effect-ontology/Service/EmbeddingCache"
 *
 * console.log(makePersistentEmbeddingCache)
 * ```
 *
 * @category constructors
 * @since 0.0.0
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
  const loadFromStorage = Effect.fn(function* (hash: string): Effect.fn.Return<O.Option<Embedding>> {
    const blobPath = `${cachePath}/${Str.takeLeft(2)(hash)}/${hash}.json`;
    const content = yield* storage.get(blobPath).pipe(Effect.catch(() => Effect.void));

    if (content === undefined) {
      return O.none();
    }

    const blob = decodeEmbeddingBlob(content);
    if (O.isNone(blob)) return O.none();

    const entry = blob.value.embeddings[hash];
    if (P.isUndefined(entry)) return O.none();

    const now = yield* Clock.currentTimeMillis;
    if (now - entry.createdAt > config.ttlMs) {
      // Expired in storage too
      return O.none();
    }

    return O.some(entry.vector);
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
          createdAt: EpochMillis.make(now),
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
      if (O.isSome(entry)) {
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
          return O.some(entry.value.embedding);
        }
      }

      // Memory miss - check persistent storage
      yield* Ref.update(stats, (s) => ({
        ...s,
        memoryMisses: s.memoryMisses + 1,
      }));

      const persisted = yield* loadFromStorage(hash);
      if (O.isSome(persisted)) {
        // Persistent hit - add to memory cache
        yield* Ref.update(stats, (s) => ({
          ...s,
          persistentHits: s.persistentHits + 1,
        }));
        yield* Ref.update(memoryCache, (m) => {
          const evicted = evictLRU(m);
          return HashMap.set(evicted, hash, {
            embedding: persisted.value,
            createdAt: EpochMillis.make(now),
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
      return O.none();
    }),

    set: Effect.fn(function* (hash: string, embedding: Embedding) {
      const now = yield* Clock.currentTimeMillis;

      // Store in memory
      yield* Ref.update(memoryCache, (map) => {
        const evicted = evictLRU(map);
        return HashMap.set(evicted, hash, {
          embedding,
          createdAt: EpochMillis.make(now),
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

      if (O.isSome(entry)) {
        if (isExpired(entry.value, now)) {
          yield* Ref.update(memoryCache, HashMap.remove(hash));
          return false;
        }
        return true;
      }

      // Check persistent storage
      const persisted = yield* loadFromStorage(hash);
      return O.isSome(persisted);
    }),

    size: Ref.get(memoryCache).pipe(Effect.map(HashMap.size)),

    // Note: Does not clear GCS - that would need storage.clear
    clear: Ref.set(memoryCache, HashMap.empty()),

    warmUp: Effect.gen(function* () {
      // List all embedding blobs in the cache path
      const files = yield* storage.list(cachePath).pipe(Effect.orElseSucceed(() => []));

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
            if (O.isNone(blob)) return;

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
 * @since 0.0.0
 * @category layers
 */
const PersistentEmbeddingCacheLayer = Layer.effect(
  PersistentEmbeddingCache,
  Effect.gen(function* () {
    // Import dynamically to avoid circular dependency
    const { ConfigService: ConfigSvc } = yield* Effect.promise(() => import("./Config.ts"));
    const config = yield* ConfigSvc;
    const storage = yield* StorageService;

    const cachePath = O.getOrUndefined(config.embedding.cachePath);

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
          if (O.isNone(entry)) return O.none();
          if (isExpired(entry.value, now)) {
            yield* Ref.update(cache, HashMap.remove(hash));
            return O.none();
          }
          yield* Ref.update(cache, (m) =>
            HashMap.set(m, hash, {
              ...entry.value,
              lastAccessedAt: now,
            })
          );
          return O.some(entry.value.embedding);
        }),
        set: Effect.fn(function* (hash: string, embedding: Embedding) {
          const now = yield* Clock.currentTimeMillis;
          yield* Ref.update(cache, (map) => {
            const evicted = evictLRU(map);
            return HashMap.set(evicted, hash, {
              embedding,
              createdAt: EpochMillis.make(now),
              lastAccessedAt: now,
            });
          });
        }),
        has: Effect.fn(function* (hash: string) {
          const now = yield* Clock.currentTimeMillis;
          const map = yield* Ref.get(cache);
          const entry = HashMap.get(map, hash);
          if (O.isNone(entry)) return false;
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
      };
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

/**
 * Provides the embedding cache with persistence service capability.
 *
 * **Example** (Inspect embedding cache with persistence)
 *
 * ```ts
 * import { EmbeddingCacheWithPersistence } from "@effect-ontology/Service/EmbeddingCache"
 *
 * console.log(EmbeddingCacheWithPersistence)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingCacheWithPersistence: Layer.Layer<
  EmbeddingCache | PersistentEmbeddingCache,
  never,
  ConfigService | StorageService
> = Layer.merge(PersistentEmbeddingCacheLayer, EmbeddingCacheAliasLayer);
