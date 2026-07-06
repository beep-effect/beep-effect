/**
 * GraphOperations/ResultStore - caching of operation results.
 *
 * Caches {@link OperationResult}s keyed by operation name + node id so
 * expensive operations are not recomputed. The default implementation is an
 * in-memory `Ref<HashMap>`.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * - `Context.GenericTag` becomes the `Context.Service` class form.
 * - keyed cache storage becomes `Ref<HashMap<...>>`; cache operations use `HashMap`.
 * - `Date.now()` becomes `Clock.currentTimeMillis`.
 * - the heterogeneous store value is `unknown`-typed and SOUND: results are stored
 *   as {@link AnyOperationResult} (`OperationResult<unknown, unknown>`) and read back
 *   as such (callers decode at their known types), so there are no type assertions.
 *   The in-memory implementation is total, so {@link StorageError} appears only on the
 *   interface for future fallible backends.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import { A } from "@beep/utils";
import { Clock, Context, Effect, HashMap, Layer, Ref } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { NodeId } from "../EffectGraph.ts";
import type { StorageError } from "./Errors.ts";
import type { OperationResult } from "./Types.ts";

const $I = $NlpProcessingId.create("Graph/GraphOperations/ResultStore");

/**
 * Type-erased operation result stored in the cache.
 *
 * @remarks
 * The result store is heterogeneous: one execution may cache string children and
 * the next may cache entity nodes. Values therefore cross the cache boundary as
 * `unknown`; callers should rely on the operation they are running, or decode
 * with a schema, before treating cached payloads as a concrete node type.
 *
 * @example
 * ```ts
 * import type { AnyOperationResult } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 *
 * const countErrors = (result: AnyOperationResult) => result.errors.length
 * console.log(countErrors)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type AnyOperationResult = OperationResult<unknown, unknown>;

// =============================================================================
// Keys & Stored Values
// =============================================================================

/**
 * Cache key pairing the operation name with the source node id.
 *
 * @remarks
 * Re-running the same operation against the same leaf can reuse a cached result.
 * Changing either the operation name or the node id creates an independent cache
 * entry, which keeps sibling operation pipelines from colliding.
 *
 * @example
 * ```ts
 * import { NodeId } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { ResultKey } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 *
 * const nodeId = NodeId.make("node-example")
 * const key = ResultKey.new("tokenize", nodeId)
 *
 * console.log(ResultKey.toString(key)) // "tokenize:node-example"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class ResultKey extends S.Class<ResultKey>($I`ResultKey`)(
  {
    nodeId: NodeId,
    operationName: S.String,
  },
  $I.annote("ResultKey", {
    description: "Cache key: an operation name paired with a node id.",
  })
) {
  static readonly new: {
    (operationName: string, nodeId: NodeId): ResultKey;
    (nodeId: NodeId): (operationName: string) => ResultKey;
  } = dual(2, (operationName: string, nodeId: NodeId): ResultKey => ({ nodeId, operationName }));

  static override readonly toString = (key: ResultKey): string => `${key.operationName}:${key.nodeId}`;
}

/**
 * Stored cache entry plus hit-count and insertion timestamp metadata.
 *
 * @example
 * ```ts
 * import type { StoredResult } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 *
 * const hits = (entry: StoredResult) => entry.hits
 * console.log(hits)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface StoredResult {
  readonly hits: number;
  readonly key: ResultKey;
  readonly result: AnyOperationResult;
  readonly timestamp: number;
}

/**
 * Snapshot of the in-memory result-store cache.
 *
 * @example
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { CacheStats } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 * import * as O from "effect/Option"
 *
 * const emptyStats = CacheStats.make({
 *   size: NonNegativeInt.make(0),
 *   totalHits: NonNegativeInt.make(0),
 *   oldestEntry: O.none(),
 *   newestEntry: O.none()
 * })
 *
 * console.log(emptyStats.size) // 0
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class CacheStats extends S.Class<CacheStats>($I`CacheStats`)(
  {
    newestEntry: S.Option(S.Finite),
    oldestEntry: S.Option(S.Finite),
    size: NonNegativeInt,
    totalHits: NonNegativeInt,
  },
  $I.annote("CacheStats", {
    description: "Statistics about the cache.",
  })
) {}

// =============================================================================
// Service Shape & Tag
// =============================================================================

/**
 * Structural service contract for caching graph-operation results.
 *
 * @remarks
 * `get` increments a hit counter when an entry is present. `gc` removes entries
 * older than the supplied age in milliseconds, measured from the service clock.
 * The live implementation is in-memory and starts empty for every layer build.
 *
 * @example
 * ```ts
 * import type { ResultStoreShape } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 *
 * const hasCacheEntry = (store: ResultStoreShape, key: Parameters<ResultStoreShape["has"]>[0]) =>
 *   store.has(key)
 *
 * console.log(hasCacheEntry)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface ResultStoreShape {
  readonly clear: Effect.Effect<void, StorageError>;
  readonly delete: (key: ResultKey) => Effect.Effect<void, StorageError>;
  /** Drop entries older than `olderThanMs`, returning the count removed. */
  readonly gc: (olderThanMs: number) => Effect.Effect<number, StorageError>;
  readonly get: (key: ResultKey) => Effect.Effect<O.Option<AnyOperationResult>, StorageError>;
  readonly has: (key: ResultKey) => Effect.Effect<boolean>;
  readonly stats: Effect.Effect<CacheStats>;
  readonly store: {
    (key: ResultKey, result: AnyOperationResult): Effect.Effect<void, StorageError>;
    (result: AnyOperationResult): (key: ResultKey) => Effect.Effect<void, StorageError>;
  };
}

/**
 * Service tag for retrieving the result cache from an Effect environment.
 *
 * @example
 * ```ts
 * import { ResultStore } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 *
 * console.log(ResultStore.key)
 * ```
 *
 * @since 0.0.0
 * @category services
 */
export class ResultStore extends Context.Service<ResultStore, ResultStoreShape>()($I`ResultStore`) {}

// =============================================================================
// In-Memory Implementation
// =============================================================================

const makeResultStore = Effect.gen(function* () {
  const storeRef = yield* Ref.make<HashMap.HashMap<string, StoredResult>>(HashMap.empty());

  return ResultStore.of({
    clear: Ref.set(storeRef, HashMap.empty()),

    delete: Effect.fn("ResultStore.delete")(function* (key: ResultKey) {
      yield* Ref.update(storeRef, (map) => HashMap.remove(map, ResultKey.toString(key)));
    }),

    gc: Effect.fn("ResultStore.gc")(function* (olderThanMs: number) {
      const cutoff = (yield* Clock.currentTimeMillis) - olderThanMs;
      const map = yield* Ref.get(storeRef);
      const kept = HashMap.filter(map, (value) => value.timestamp >= cutoff);
      yield* Ref.set(storeRef, kept);
      return HashMap.size(map) - HashMap.size(kept);
    }),

    get: Effect.fn("ResultStore.get")(function* (key: ResultKey) {
      const keyStr = ResultKey.toString(key);
      const map = yield* Ref.get(storeRef);
      return yield* O.match(HashMap.get(map, keyStr), {
        onNone: () => Effect.succeed(O.none<AnyOperationResult>()),
        onSome: (stored) =>
          Effect.as(
            Ref.update(storeRef, (m) =>
              HashMap.set(m, keyStr, {
                ...stored,
                hits: stored.hits + 1,
              })
            ),
            O.some(stored.result)
          ),
      });
    }),

    has: Effect.fn("ResultStore.has")(function* (key: ResultKey) {
      const map = yield* Ref.get(storeRef);
      return HashMap.has(map, ResultKey.toString(key));
    }),

    stats: Effect.gen(function* () {
      const map = yield* Ref.get(storeRef);
      const entries = A.fromIterable(HashMap.values(map));
      const timestamps = A.map(entries, (e) => e.timestamp);
      return CacheStats.make({
        newestEntry: A.match(timestamps, {
          onEmpty: O.none<number>,
          onNonEmpty: (ts) => O.some(Math.max(...ts)),
        }),
        oldestEntry: A.match(timestamps, {
          onEmpty: O.none<number>,
          onNonEmpty: (ts) => O.some(Math.min(...ts)),
        }),
        size: NonNegativeInt.make(HashMap.size(map)),
        totalHits: NonNegativeInt.make(A.reduce(entries, 0, (sum, e) => sum + e.hits)),
      });
    }),

    store: dual(
      2,
      Effect.fn("ResultStore.store")(function* (key: ResultKey, result: AnyOperationResult) {
        const timestamp = yield* Clock.currentTimeMillis;
        const stored: StoredResult = { hits: 0, key, result, timestamp };
        yield* Ref.update(storeRef, (map) => HashMap.set(map, ResultKey.toString(key), stored));
      })
    ),
  });
});

/**
 * Live in-memory {@link ResultStore} layer.
 *
 * @remarks
 * This layer keeps cache state in a `Ref<HashMap>` scoped to the layer instance.
 * It is suitable for process-local reuse during a pipeline run, but it is not a
 * durable or cross-process cache.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { ResultStoreLive } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 * import { ResultStore } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 *
 * const stats = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const store = yield* ResultStore
 *     return yield* store.stats
 *   }).pipe(Effect.provide(ResultStoreLive))
 * )
 *
 * stats.size
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const ResultStoreLive: Layer.Layer<ResultStore> = Layer.effect(ResultStore, makeResultStore);

/**
 * Test {@link ResultStore} layer backed by the same empty in-memory store.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { ResultStoreTest } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 * import { ResultStore } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 *
 * const empty = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const store = yield* ResultStore
 *     const stats = yield* store.stats
 *     return stats.size === 0
 *   }).pipe(Effect.provide(ResultStoreTest))
 * )
 *
 * empty
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const ResultStoreTest: Layer.Layer<ResultStore> = ResultStoreLive;
