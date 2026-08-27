/**
 * Service: Extraction Cache
 *
 * **Details**
 *
 * Persists extraction results to filesystem.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import type { PlatformError } from "effect";
import { Context, Effect, FileSystem, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Entity, Relation } from "../Domain/Model/Entity.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/ExtractionCache");

// =============================================================================
// Types
// =============================================================================

/**
 * Validates and represents cached extraction result values at runtime.
 *
 * **Example** (Validate cached extraction result)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { CachedExtractionResult } from "@effect-ontology/Service/ExtractionCache"
 *
 * const decoded = S.decodeUnknownOption(CachedExtractionResult)({
 *   entities: [],
 *   relations: [],
 *   metadata: { computedAt: "2026-01-01T00:00:00.000Z", model: "claude-haiku-4-5", temperature: 0, computedIn: 12 }
 * })
 * console.log(O.isSome(decoded)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CachedExtractionResult = S.Struct({
  entities: S.Array(Entity).annotateKey({
    description: "Canonical ontology entities persisted by the extraction cache.",
  }),
  relations: S.Array(Relation).annotateKey({
    description: "Canonical ontology relations persisted by the extraction cache.",
  }),
  metadata: S.Struct({
    computedAt: S.String,
    model: S.String,
    temperature: S.Finite,
    computedIn: S.Finite,
  }),
}).pipe(
  $I.annoteSchema("CachedExtractionResult", {
    description: "Cached extraction entities, relations, and model metadata.",
  })
);
/**
 * Describes the cached extraction result data exposed by this module.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CachedExtractionResult = typeof CachedExtractionResult.Type;

const CachedExtractionResultJson = S.fromJsonString(CachedExtractionResult, { space: 2 });
const decodeCachedExtractionResult = S.decodeUnknownOption(CachedExtractionResultJson);
const encodeCachedExtractionResult = S.encodeEffect(CachedExtractionResultJson);

// =============================================================================

/**
 * Default filesystem directory used by the extraction cache.
 *
 * **Example** (Inspect default cache dir)
 *
 * ```ts
 * import { DEFAULT_CACHE_DIR } from "@effect-ontology/Service/ExtractionCache"
 *
 * console.log(DEFAULT_CACHE_DIR) // "output/cache"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_CACHE_DIR = "output/cache";

/**
 * Describes the extraction cache service data exposed by this module.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface ExtractionCacheService {
  readonly get: (key: string) => Effect.Effect<O.Option<CachedExtractionResult>, PlatformError.PlatformError>;
  readonly set: (
    key: string,
    value: CachedExtractionResult
  ) => Effect.Effect<void, PlatformError.PlatformError | S.SchemaError>;
  readonly deletePattern: (pattern: string) => Effect.Effect<void, PlatformError.PlatformError>;
}

// =============================================================================
// Implementation (FileSystem)
// =============================================================================

/**
 * Constructs the make file system extraction cache value from its declared inputs.
 *
 * **Example** (Inspect make file system extraction cache)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { makeFileSystemExtractionCache } from "@effect-ontology/Service/ExtractionCache"
 *
 * const program = makeFileSystemExtractionCache("/tmp/extraction-cache")
 * console.log(program)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeFileSystemExtractionCache = Effect.fn("makeFileSystemExtractionCache")(function* (cacheDir: string) {
  const fs = yield* FileSystem.FileSystem;

  yield* fs.makeDirectory(cacheDir, { recursive: true });

  const getPath = (key: string) => `${cacheDir}/${key}.json`;

  return {
    get: Effect.fn("ExtractionCache.get")(function* (key: string) {
      const path = getPath(key);
      const exists = yield* fs.exists(path);
      if (!exists) return O.none();

      const content = yield* fs.readFileString(path);
      return decodeCachedExtractionResult(content);
    }),

    set: Effect.fn("ExtractionCache.set")(function* (key: string, value: CachedExtractionResult) {
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

/**
 * Provides the extraction cache service capability.
 *
 * **Example** (Inspect extraction cache)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ExtractionCache } from "@effect-ontology/Service/ExtractionCache"
 *
 * const program = Effect.gen(function* () {
 *   const cache = yield* ExtractionCache
 *   return yield* cache.get("ada")
 * }).pipe(Effect.provide(ExtractionCache.Default))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class ExtractionCache extends Context.Service<ExtractionCache, ExtractionCacheService>()($I`ExtractionCache`, {
  make: makeFileSystemExtractionCache(DEFAULT_CACHE_DIR),
}) {
  static readonly Default = Layer.effect(this, this.make);
}

/**
 * Provides the Effect layer for extraction cache live dependencies.
 *
 * **Example** (Inspect extraction cache live)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ExtractionCache, ExtractionCacheLive } from "@effect-ontology/Service/ExtractionCache"
 *
 * const program = Effect.gen(function* () {
 *   const cache = yield* ExtractionCache
 *   return yield* cache.get("ada")
 * }).pipe(Effect.provide(ExtractionCacheLive))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ExtractionCacheLive = ExtractionCache.Default;

/**
 * Provides the Effect layer for file system extraction cache live dependencies.
 *
 * **Example** (Inspect file system extraction cache live)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ExtractionCache, FileSystemExtractionCacheLive } from "@effect-ontology/Service/ExtractionCache"
 *
 * const program = Effect.gen(function* () {
 *   const cache = yield* ExtractionCache
 *   return yield* cache.get("ada")
 * }).pipe(Effect.provide(FileSystemExtractionCacheLive(".cache/extractions")))
 *
 * console.log(program)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const FileSystemExtractionCacheLive = (cacheDir: string) =>
  Layer.effect(ExtractionCache, makeFileSystemExtractionCache(cacheDir));
