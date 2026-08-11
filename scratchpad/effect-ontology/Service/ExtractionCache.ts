/**
 * Service: Extraction Cache
 *
 * Persists extraction results to filesystem.
 *
 * @since 2.0.0
 * @module Service/ExtractionCache
 */

import { Context, Effect, FileSystem, Layer } from "effect"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/ExtractionCache");

// =============================================================================
// Types
// =============================================================================

export interface CachedExtractionResult {
  readonly entities: ReadonlyArray<unknown>
  readonly relations: ReadonlyArray<unknown>
  readonly metadata: {
    readonly computedAt: string
    readonly model: string
    readonly temperature: number
    readonly computedIn: number
  }
}

// =============================================================================
export const DEFAULT_CACHE_DIR = "output/cache"

export interface ExtractionCacheService {
  readonly get: (key: string) => Effect.Effect<CachedExtractionResult | null, Error>
  readonly set: (
    key: string,
    value: CachedExtractionResult,
    ttlSeconds?: number
  ) => Effect.Effect<void, Error>
  readonly deletePattern: (pattern: string) => Effect.Effect<void, Error>
}

// =============================================================================
// Implementation (FileSystem)
// =============================================================================

export const makeFileSystemExtractionCache = (
  cacheDir: string
): Effect.Effect<ExtractionCacheService, Error, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem

    // Ensure cache directory exists
    yield* fs.makeDirectory(cacheDir, { recursive: true })

    const getPath = (key: string) => `${cacheDir}/${key}.json`

    return {
      get: (key: string) =>
        Effect.gen(function*() {
          const path = getPath(key)
          const exists = yield* fs.exists(path)

          if (!exists) {
            return null
          }

          const content = yield* fs.readFileString(path)
          try {
            return JSON.parse(content) as CachedExtractionResult
          } catch {
            return null
          }
        }),

      set: (key: string, value: CachedExtractionResult) =>
        Effect.gen(function*() {
          const path = getPath(key)
          yield* fs.writeFileString(path, JSON.stringify(value, null, 2))
        }),

      deletePattern: (pattern: string) =>
        Effect.gen(function*() {
          // Naive implementation for now: just clear all if pattern is '*'
          // or properly implement glob logic if needed.
          // For MVP, we likely only need "clear all" or specific keys.
          if (pattern === "*") {
            // remove dir and recreate
            yield* fs.remove(cacheDir, { recursive: true })
            yield* fs.makeDirectory(cacheDir)
          }
          // TODO: Implement proper glob matching for ontology invalidation
        })
    } satisfies ExtractionCacheService
  })

export class ExtractionCache extends Context.Service<ExtractionCacheService>()(
  $I`ExtractionCache`,
  {
    make: makeFileSystemExtractionCache(DEFAULT_CACHE_DIR),
  }
) {
    static readonly Default = Layer.effect(this, this.make);
}

export const ExtractionCacheLive = ExtractionCache.Default

export const FileSystemExtractionCacheLive = (cacheDir: string) =>
  Layer.effect(
    ExtractionCache,
    makeFileSystemExtractionCache(cacheDir)
  )
