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
import { NodeId, NodeMetadata } from "../EffectGraph.ts";
import { ExecutionId, ExecutionMetrics } from "./Types.ts";
import type { StorageError } from "./Errors.ts";

const $I = $NlpProcessingId.create("Graph/GraphOperations/ResultStore");

const AnyGraphNode = S.Struct({
  data: S.Unknown,
  id: NodeId,
  metadata: S.Struct(NodeMetadata.fields),
  parentId: S.Option(NodeId),
}).pipe(
  $I.annoteSchema("AnyGraphNode", {
    description: "Graph node whose payload is intentionally type-erased at the result-store boundary.",
  })
);

/**
 * Type-erased operation result stored in the cache.
 *
 * **Gotchas**
 *
 * The result store is heterogeneous: one execution may cache string children
 * and the next may cache entity nodes. Values therefore cross the cache
 * boundary as `unknown`; callers should decode with their operation's schema
 * before treating cached payloads as a concrete node type.
 *
 * **Example** (Schema-guard cached results)
 *
 * ```ts
 * import { AnyOperationResult } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 * import * as S from "effect/Schema"
 *
 * const isCachedResult = S.is(AnyOperationResult)
 * console.log(isCachedResult)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AnyOperationResult extends S.Class<AnyOperationResult>($I`AnyOperationResult`)(
  {
    errors: S.Array(S.Unknown),
    executionId: ExecutionId,
    metrics: S.Struct(ExecutionMetrics.fields),
    newNodes: S.Array(AnyGraphNode),
    originalGraph: S.Unknown,
    timestamp: S.Finite,
  },
  $I.annote("AnyOperationResult", {
    description: "Type-erased operation result stored in the heterogeneous graph-operation cache.",
  })
) {}

// =============================================================================
// Keys & Stored Values
// =============================================================================

/**
 * Cache key pairing the operation name with the source node id.
 *
 * **Details**
 *
 * Re-running the same operation against the same leaf can reuse a cached result.
 * Changing either the operation name or the node id creates an independent cache
 * entry, which keeps sibling operation pipelines from colliding.
 *
 * **Example** (Create and stringify key)
 *
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
 * @category models
 * @since 0.0.0
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
  } = dual(
    2,
    (operationName: string, nodeId: NodeId): ResultKey => ({
      nodeId,
      operationName,
    })
  );

  static override readonly toString = (key: ResultKey): string => `${key.operationName}:${key.nodeId}`;
}

/**
 * Stored cache entry plus hit-count and insertion timestamp metadata.
 *
 * **Example** (Read stored hit count)
 *
 * ```ts
 * import type { StoredResult } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 *
 * const hits = (entry: StoredResult) => entry.hits
 * console.log(hits)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StoredResult extends S.Class<StoredResult>($I`StoredResult`)(
  {
    hits: NonNegativeInt,
    key: S.Struct(ResultKey.fields),
    result: AnyOperationResult,
    timestamp: S.Finite,
  },
  $I.annote("StoredResult", {
    description: "Cached graph-operation result with its key, insertion timestamp, and accumulated hit count.",
  })
) {}

/**
 * Snapshot of the in-memory result-store cache.
 *
 * **Example** (Build empty cache stats)
 *
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
 * @category models
 * @since 0.0.0
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
 * **Details**
 *
 * `get` increments a hit counter when an entry is present. `gc` removes entries
 * older than the supplied age in milliseconds, measured from the service clock.
 * The live implementation is in-memory and starts empty for every layer build.
 *
 * **Example** (Check key presence helper)
 *
 * ```ts
 * import type { ResultStoreShape } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 *
 * const hasCacheEntry = (store: ResultStoreShape, key: Parameters<ResultStoreShape["has"]>[0]) =>
 *   store.has(key)
 *
 * console.log(hasCacheEntry)
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Log service tag key)
 *
 * ```ts
 * import { ResultStore } from "@beep/nlp-processing/Graph/GraphOperations/ResultStore"
 *
 * console.log(ResultStore.key)
 * ```
 *
 * @category services
 * @since 0.0.0
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
      yield* Ref.update(storeRef, HashMap.remove(ResultKey.toString(key)));
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
              HashMap.set(
                m,
                keyStr,
                StoredResult.make({
                  ...stored,
                  hits: NonNegativeInt.make(stored.hits + 1),
                })
              )
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
        const stored = StoredResult.make({
          hits: NonNegativeInt.make(0),
          key,
          result: AnyOperationResult.make(result),
          timestamp,
        });
        yield* Ref.update(storeRef, HashMap.set(ResultKey.toString(key), stored));
      })
    ),
  });
});

/**
 * Live in-memory {@link ResultStore} layer.
 *
 * **Gotchas**
 *
 * This layer keeps cache state in a `Ref<HashMap>` scoped to the layer instance.
 * It is suitable for process-local reuse during a pipeline run, but it is not a
 * durable or cross-process cache.
 *
 * **Example** (Provide live store layer)
 *
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
 * @category layers
 * @since 0.0.0
 */
export const ResultStoreLive: Layer.Layer<ResultStore> = Layer.effect(ResultStore, makeResultStore);

/**
 * Test {@link ResultStore} layer backed by the same empty in-memory store.
 *
 * **Example** (Assert empty test store)
 *
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
 * @category layers
 * @since 0.0.0
 */
export const ResultStoreTest: Layer.Layer<ResultStore> = ResultStoreLive;
