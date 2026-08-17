/**
 * Service: Extraction Cache
 *
 * Persists extraction results to filesystem.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import type { PlatformError } from "effect";
import { Context, Effect, FileSystem, Layer, Option, Schema } from "effect";

const $I = $ScratchpadId.create("effect-ontology/Service/ExtractionCache");

// =============================================================================
// Types
// =============================================================================

export const CachedExtractionResult = Schema.Struct({
  entities: Schema.Array(Schema.Unknown),
  relations: Schema.Array(Schema.Unknown),
  metadata: Schema.Struct({
    computedAt: Schema.String,
    model: Schema.String,
    temperature: Schema.Finite,
    computedIn: Schema.Finite,
  }),
});
export type CachedExtractionResult = typeof CachedExtractionResult.Type;

const CachedExtractionResultJson = Schema.fromJsonString(CachedExtractionResult, { space: 2 });
const decodeCachedExtractionResult = Schema.decodeUnknownOption(CachedExtractionResultJson);
const encodeCachedExtractionResult = Schema.encodeEffect(CachedExtractionResultJson);

// =============================================================================

export const DEFAULT_CACHE_DIR = "output/cache";

export interface ExtractionCacheService {
  readonly get: (key: string) => Effect.Effect<CachedExtractionResult | null, PlatformError.PlatformError>;
  readonly set: (
    key: string,
    value: CachedExtractionResult,
    ttlSeconds?: number
  ) => Effect.Effect<void, PlatformError.PlatformError | Schema.SchemaError>;
  readonly deletePattern: (pattern: string) => Effect.Effect<void, PlatformError.PlatformError>;
}

// =============================================================================
// Implementation (FileSystem)
// =============================================================================

export const makeFileSystemExtractionCache = Effect.fn("makeFileSystemExtractionCache")(function* (cacheDir: string) {
  const fs = yield* FileSystem.FileSystem;

  yield* fs.makeDirectory(cacheDir, { recursive: true });

  const getPath = (key: string) => `${cacheDir}/${key}.json`;

  return {
    get: Effect.fn("ExtractionCache.get")(function* (key: string) {
      const path = getPath(key);
      const exists = yield* fs.exists(path);
      if (!exists) return null;

      const content = yield* fs.readFileString(path);
      return decodeCachedExtractionResult(content).pipe(Option.getOrNull);
    }),

    set: Effect.fn("ExtractionCache.set")(function* (key: string, value: CachedExtractionResult, _ttlSeconds?: number) {
      const path = getPath(key);
      const content = yield* encodeCachedExtractionResult(value);
      yield* fs.writeFileString(path, content);
    }),

    deletePattern: Effect.fn("ExtractionCache.deletePattern")(function* (pattern: string) {
      if (pattern === "*") {
        yield* fs.remove(cacheDir, { recursive: true });
        yield* fs.makeDirectory(cacheDir, { recursive: true });
      }
    }),
  } satisfies ExtractionCacheService;
});

export class ExtractionCache extends Context.Service<ExtractionCache, ExtractionCacheService>()($I`ExtractionCache`, {
  make: makeFileSystemExtractionCache(DEFAULT_CACHE_DIR),
}) {
  static readonly Default = Layer.effect(this, this.make);
}

export const ExtractionCacheLive = ExtractionCache.Default;

export const FileSystemExtractionCacheLive = (cacheDir: string) =>
  Layer.effect(ExtractionCache, makeFileSystemExtractionCache(cacheDir));
