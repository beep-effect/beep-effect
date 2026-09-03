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
import { PosInt, SchemaUtils } from "@beep/schema";
import { EpochMillis } from "@beep/schema/Timestamp";
import { Clock, Context, Duration, Effect, HashMap, Inspectable, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { EmbeddingError } from "../Domain/Error/Embedding.ts";
import { ConfigService } from "./Config.ts";
import type { StorageServiceMethods } from "./Storage.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/EmbeddingCache");

/**
 * Finite numeric vector stored in the embedding cache.
 *
 * **Example** (Validate a cached vector)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Embedding } from "@effect-ontology/Service/EmbeddingCache"
 *
 * console.log(S.is(Embedding)([0.12, -0.4, 0.88])) // true
 * console.log(S.is(Embedding)({})) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Embedding = S.Array(S.Finite).pipe(
  $I.annoteSchema("Embedding", {
    description: "Finite embedding vector cached by EmbeddingCache.",
  })
);
/**
 * Describes the embedding data exposed by this module.
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

const isCacheEntryExpired = (ttl: Duration.Duration, entry: CacheEntry, now: number): boolean =>
  now - entry.createdAt > Duration.toMillis(ttl);

const evictLeastRecentlyUsed = (
  maxEntries: number,
  map: HashMap.HashMap<string, CacheEntry>
): HashMap.HashMap<string, CacheEntry> => {
  if (HashMap.size(map) < maxEntries) return map;
  let lruKey = O.none<string>();
  let lruTime = Infinity;
  for (const [key, entry] of map) {
    if (entry.lastAccessedAt < lruTime) {
      lruTime = entry.lastAccessedAt;
      lruKey = O.some(key);
    }
  }
  return O.match(lruKey, { onNone: () => map, onSome: (key) => HashMap.remove(map, key) });
};

/**
 * Entry lifetime and capacity bound for an embedding cache.
 *
 * **Example** (Configure cache lifetime and capacity)
 *
 * ```ts
 * import { PosInt } from "@beep/schema"
 * import { Duration } from "effect"
 * import { EmbeddingCacheConfig } from "@effect-ontology/Service/EmbeddingCache"
 *
 * const config = EmbeddingCacheConfig.make({
 *   ttl: Duration.minutes(30),
 *   maxEntries: PosInt.make(100)
 * })
 * console.log(config.maxEntries) // 100
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EmbeddingCacheConfig extends S.Class<EmbeddingCacheConfig>($I`EmbeddingCacheConfig`)(
  {
    ttl: S.Duration.pipe(SchemaUtils.withKeyDefaults(Duration.hours(1))),
    maxEntries: PosInt.pipe(SchemaUtils.withKeyDefaults(PosInt.make(10_000))),
  },
  $I.annote("EmbeddingCacheConfig", {
    description: "Entry lifetime and capacity bound for an embedding cache.",
  })
) {}

/**
 * Constructor input accepted by {@link EmbeddingCacheConfig}.
 *
 * **Example** (Configure an embedding cache)
 *
 * ```ts
 * import { PosInt } from "@beep/schema/Int"
 * import type { EmbeddingCacheConfigInput } from "@effect-ontology/Service/EmbeddingCache"
 *
 * const config: EmbeddingCacheConfigInput = { maxEntries: PosInt.make(100) }
 * console.log(config)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EmbeddingCacheConfigInput = (typeof EmbeddingCacheConfig)["~type.make.in"];

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
export const defaultCacheConfig = EmbeddingCacheConfig.make({});

/**
 * EmbeddingCache service interface
 *
 * @category type-level
 * @since 0.0.0
 */
export interface EmbeddingCacheService {
  readonly get: (hash: string) => Effect.Effect<O.Option<Embedding>, EmbeddingError>;
  readonly set: (hash: string, embedding: Embedding) => Effect.Effect<void, EmbeddingError>;
  readonly has: (hash: string) => Effect.Effect<boolean, EmbeddingError>;
  readonly size: Effect.Effect<number>;
  readonly clear: Effect.Effect<void>;
}

/**
 * In-memory embedding cache with TTL and LRU eviction.
 *
 * **Example** (Set and get a vector)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { EmbeddingCache } from "@effect-ontology/Service/EmbeddingCache"
 *
 * const cached = Effect.runSync(
 *   Effect.gen(function* () {
 *     const cache = yield* EmbeddingCache
 *     yield* cache.set("ada", [0.1, 0.2])
 *     return yield* cache.get("ada")
 *   }).pipe(Effect.provide(EmbeddingCache.Default), Effect.orDie)
 * )
 * console.log(O.isSome(cached)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class EmbeddingCache extends Context.Service<EmbeddingCache, EmbeddingCacheService>()($I`EmbeddingCache`) {
  /**
   * In-memory implementation with TTL and LRU eviction
   *
   * @since 0.0.0
   * @category layers
   */
  static readonly InMemory = (input: EmbeddingCacheConfigInput = {}): Layer.Layer<EmbeddingCache> =>
    Layer.effect(
      EmbeddingCache,
      Effect.gen(function* () {
        const config = EmbeddingCacheConfig.make(input);
        const cache = yield* Ref.make(HashMap.empty<string, CacheEntry>());

        const isExpired = (entry: CacheEntry, now: number): boolean => isCacheEntryExpired(config.ttl, entry, now);
        const evictLRU = (map: HashMap.HashMap<string, CacheEntry>) => evictLeastRecentlyUsed(config.maxEntries, map);

        return {
          get: Effect.fn("EmbeddingCache.inMemory.get")(function* (hash: string) {
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
          set: Effect.fn("EmbeddingCache.inMemory.set")(function* (hash: string, embedding: Embedding) {
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
          has: Effect.fn("EmbeddingCache.inMemory.has")(function* (hash: string) {
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
 * Test layer that always reports a cache miss.
 *
 * **Example** (Observe a guaranteed miss)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { EmbeddingCache, EmbeddingCacheTest } from "@effect-ontology/Service/EmbeddingCache"
 *
 * const found = Effect.runSync(
 *   Effect.gen(function* () {
 *     const cache = yield* EmbeddingCache
 *     yield* cache.set("ada", [0.1, 0.2])
 *     return yield* cache.get("ada")
 *   }).pipe(Effect.provide(EmbeddingCacheTest), Effect.orDie)
 * )
 * console.log(O.isNone(found)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const EmbeddingCacheTest: Layer.Layer<EmbeddingCache> = Layer.succeed(EmbeddingCache, {
  get: Effect.fn("EmbeddingCache.get")((_hash: string) => Effect.succeedNone),
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
 * @category type-level
 * @since 0.0.0
 */
export interface PersistentEmbeddingCacheService extends EmbeddingCacheService {
  /**
   * Warm up the cache by loading embeddings from persistent storage
   * @returns Number of embeddings loaded
   */
  readonly warmUp: Effect.Effect<number, EmbeddingError>;

  /**
   * Flush all in-memory embeddings to persistent storage
   * @returns Number of embeddings persisted
   */
  readonly flush: Effect.Effect<number, EmbeddingError>;

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
 * Context tag for an embedding cache with memory plus persistent storage.
 *
 * **Gotchas**
 *
 * `clear` drops only the in-memory HashMap. Persistent blobs (GCS or the
 * backing {@link StorageService}) are left in place, so a later `get` can still
 * reload the vector from storage.
 *
 * **Example** (Clear memory while a persisted copy survives)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import * as O from "effect/Option"
 * import { makePersistentEmbeddingCache, PersistentEmbeddingCache } from "@effect-ontology/Service/EmbeddingCache"
 * import { StorageService, StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const PersistentLive = Layer.effect(
 *   PersistentEmbeddingCache,
 *   Effect.gen(function* () {
 *     const storage = yield* StorageService
 *     return yield* makePersistentEmbeddingCache(storage, "embeddings/cache")
 *   })
 * ).pipe(Layer.provide(StorageServiceTest))
 *
 * const found = Effect.runSync(
 *   Effect.gen(function* () {
 *     const cache = yield* PersistentEmbeddingCache
 *     yield* cache.set("ada", [0.1, 0.2])
 *     yield* cache.clear
 *     return yield* cache.get("ada")
 *   }).pipe(Effect.provide(PersistentLive), Effect.orDie)
 * )
 * console.log(O.isSome(found)) // true
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
 * Build a memory-plus-storage embedding cache over a {@link StorageService}.
 *
 * **Details**
 *
 * Lookups hit an in-memory HashMap first and fall back to storage on miss.
 * Writes update both layers. Storage keys are `{cachePath}/{hash[0:2]}/{hash}.json`.
 *
 * **Gotchas**
 *
 * `clear` empties only the in-memory map. Callers that need to wipe persisted
 * blobs must use {@link StorageService} directly.
 *
 * **Example** (Set, then reload after a memory miss)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { makePersistentEmbeddingCache } from "@effect-ontology/Service/EmbeddingCache"
 * import { StorageService, StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const found = Effect.runSync(
 *   Effect.gen(function* () {
 *     const storage = yield* StorageService
 *     const cache = yield* makePersistentEmbeddingCache(storage, "embeddings/cache")
 *     yield* cache.set("ada", [0.1, 0.2])
 *     return yield* cache.get("ada")
 *   }).pipe(Effect.provide(StorageServiceTest), Effect.orDie)
 * )
 * console.log(O.isSome(found)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makePersistentEmbeddingCache = Effect.fn("EmbeddingCache.makePersistent")(function* (
  storage: StorageServiceMethods,
  cachePath: string,
  input: EmbeddingCacheConfigInput = {}
): Effect.fn.Return<PersistentEmbeddingCacheService> {
  const config = EmbeddingCacheConfig.make(input);
  // In-memory cache for fast lookups
  const memoryCache = yield* Ref.make(HashMap.empty<string, CacheEntry>());

  // Statistics tracking
  const stats = yield* Ref.make({
    memoryHits: 0,
    memoryMisses: 0,
    persistentHits: 0,
    persistentMisses: 0,
  });

  const isExpired = (entry: CacheEntry, now: number): boolean => isCacheEntryExpired(config.ttl, entry, now);
  const storageError = (cause: unknown): EmbeddingError =>
    EmbeddingError.make({
      message: "Persistent embedding cache storage operation failed.",
      provider: "persistent-cache",
      cause: O.some(cause),
    });

  const evictLRU = (map: HashMap.HashMap<string, CacheEntry>) => evictLeastRecentlyUsed(config.maxEntries, map);

  // Load embedding from GCS
  const loadFromStorage = Effect.fn("EmbeddingCache.loadFromStorage")(function* (
    hash: string
  ): Effect.fn.Return<O.Option<Embedding>, EmbeddingError> {
    const blobPath = `${cachePath}/${Str.takeLeft(2)(hash)}/${hash}.json`;
    const content = yield* storage.getOption(blobPath).pipe(Effect.mapError(storageError));
    if (O.isNone(content)) return O.none();

    const blob = decodeEmbeddingBlob(content.value);
    if (O.isNone(blob)) return O.none();

    const entry = blob.value.embeddings[hash];
    if (P.isUndefined(entry)) return O.none();

    const now = yield* Clock.currentTimeMillis;
    if (now - entry.createdAt > Duration.toMillis(config.ttl)) {
      // Expired in storage too
      return O.none();
    }

    return O.some(entry.vector);
  });

  // Save embedding to GCS
  const saveToStorage = Effect.fn("EmbeddingCache.saveToStorage")(function* (
    hash: string,
    embedding: Embedding
  ): Effect.fn.Return<void> {
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
          error: Inspectable.toStringUnknown(error),
        })
      )
    );
  });

  const lookupMemory = Effect.fn("EmbeddingCache.lookupMemory")(function* (hash: string) {
    const now = yield* Clock.currentTimeMillis;
    const entry = HashMap.get(yield* Ref.get(memoryCache), hash);
    if (O.isSome(entry) && isExpired(entry.value, now)) {
      yield* Ref.update(memoryCache, HashMap.remove(hash));
      return { entry: O.none<CacheEntry>(), now };
    }
    return { entry, now };
  });

  return {
    get: Effect.fn("EmbeddingCache.persistent.get")(function* (hash: string) {
      const { entry, now } = yield* lookupMemory(hash);

      // Check in-memory cache first
      if (O.isSome(entry)) {
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

    set: Effect.fn("EmbeddingCache.persistent.set")(function* (hash: string, embedding: Embedding) {
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

      yield* saveToStorage(hash, embedding);
    }),

    has: Effect.fn("EmbeddingCache.persistent.has")(function* (hash: string) {
      const { entry } = yield* lookupMemory(hash);
      if (O.isSome(entry)) return true;

      // Check persistent storage
      const persisted = yield* loadFromStorage(hash);
      return O.isSome(persisted);
    }),

    size: Ref.get(memoryCache).pipe(Effect.map(HashMap.size)),

    // Note: Does not clear GCS - that would need storage.clear
    clear: Ref.set(memoryCache, HashMap.empty()),

    warmUp: Effect.gen(function* () {
      // List all embedding blobs in the cache path
      const files = yield* storage.list(cachePath).pipe(Effect.mapError(storageError));

      let loaded = 0;
      const now = yield* Clock.currentTimeMillis;

      // Load each blob (limit concurrency to avoid overwhelming storage)
      yield* Effect.forEach(
        A.filter(files, Str.endsWith(".json")),
        (file) =>
          Effect.gen(function* () {
            const content = yield* storage.getOption(file).pipe(Effect.mapError(storageError));
            if (O.isNone(content)) return;

            const blob = decodeEmbeddingBlob(content.value);
            if (O.isNone(blob)) return;

            for (const [hash, entry] of R.toEntries(blob.value.embeddings)) {
              // Skip expired entries
              if (now - entry.createdAt > Duration.toMillis(config.ttl)) continue;

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
 * - ConfigService (for embedding.cachePath, cacheTtl, cacheMaxEntries)
 * - StorageService (for GCS persistence when cachePath is set)
 *
 * @since 0.0.0
 * @category layers
 */
const PersistentEmbeddingCacheLayer = Layer.effect(
  PersistentEmbeddingCache,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const storage = yield* StorageService;

    if (O.isNone(config.embedding.cachePath)) {
      // No persistence path configured - return in-memory only
      yield* Effect.logDebug("Embedding cache: in-memory only (no EMBEDDING_CACHE_PATH set)");
      const cache = yield* Ref.make(HashMap.empty<string, CacheEntry>());
      const cacheConfig = EmbeddingCacheConfig.make({
        ttl: config.embedding.cacheTtl,
        maxEntries: config.embedding.cacheMaxEntries,
      });

      const isExpired = (entry: CacheEntry, now: number): boolean => isCacheEntryExpired(cacheConfig.ttl, entry, now);
      const evictLRU = (map: HashMap.HashMap<string, CacheEntry>) =>
        evictLeastRecentlyUsed(cacheConfig.maxEntries, map);

      return {
        get: Effect.fn("EmbeddingCache.fallback.get")(function* (hash: string) {
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
        set: Effect.fn("EmbeddingCache.fallback.set")(function* (hash: string, embedding: Embedding) {
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
        has: Effect.fn("EmbeddingCache.fallback.has")(function* (hash: string) {
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
    const cachePath = config.embedding.cachePath.value;
    yield* Effect.logInfo("Embedding cache: GCS-backed persistence enabled", { cachePath });
    const cacheConfig = EmbeddingCacheConfig.make({
      ttl: config.embedding.cacheTtl,
      maxEntries: config.embedding.cacheMaxEntries,
    });

    return yield* makePersistentEmbeddingCache(storage, cachePath, cacheConfig);
  })
);

const EmbeddingCacheAliasLayer = Layer.effect(EmbeddingCache, PersistentEmbeddingCache.use(Effect.succeed)).pipe(
  Layer.provide(PersistentEmbeddingCacheLayer)
);

/**
 * Layer providing both {@link EmbeddingCache} and {@link PersistentEmbeddingCache}.
 *
 * **Details**
 *
 * Requires {@link ConfigService} and {@link StorageService}. Persistence is
 * enabled only when `config.embedding.cachePath` is set.
 *
 * **Example** (Provide persistence over in-memory storage)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import * as O from "effect/Option"
 * import { ConfigService, DEFAULT_CONFIG } from "@effect-ontology/Service/Config"
 * import { EmbeddingCache, EmbeddingCacheWithPersistence } from "@effect-ontology/Service/EmbeddingCache"
 * import { StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const layer = EmbeddingCacheWithPersistence.pipe(
 *   Layer.provide(Layer.succeed(ConfigService, DEFAULT_CONFIG)),
 *   Layer.provide(StorageServiceTest)
 * )
 *
 * const size = Effect.runSync(
 *   Effect.gen(function* () {
 *     const cache = yield* EmbeddingCache
 *     yield* cache.set("ada", [0.1, 0.2])
 *     return yield* cache.size
 *   }).pipe(Effect.provide(layer), Effect.orDie)
 * )
 * console.log(size) // 1
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
