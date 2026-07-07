/**
 * GraphOperations/Executor - the graph-operation execution engine.
 *
 * Applies a {@link GraphOperation} to every leaf node of an
 * {@link EffectGraph}, collecting the new nodes, per-node errors, and
 * aggregated {@link Types.ExecutionMetrics}, with optional result caching via the
 * {@link ResultStore.ResultStore}. Sequential and parallel strategies are
 * implemented; batch/streaming fall back to sequential.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * - `Context.GenericTag` becomes the `Context.Service` class form; service methods
 *   use `Effect.fn` so they appear in traces.
 * - `Date.now()` becomes `Clock.currentTimeMillis`; keyed collection / array mutation
 *   becomes `HashMap`/`effect/Array`/`Effect.forEach`.
 * - `Effect.either` (returning `Either`) becomes `Effect.result` (returning
 *   `Result`); the `result._tag === "Left"`/`as E` casts become `Result.match`.
 * - the `opts.strategy._tag` switch becomes `Match.valueTags`; the `as any` strategy
 *   access and the `mapError` tag-sniffing block are gone (errors are typed).
 * - results are type-erased ({@link ResultStore.AnyOperationResult}): fresh
 *   `GraphNode<B>`/`E` values widen covariantly into `OperationResult<unknown, unknown>`
 *   and cached values are already erased, so caching round-trips with no assertions.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { NonNegativeInt } from "@beep/schema";
import { A, dual, P } from "@beep/utils";
import { Clock, Context, Duration, Effect, Layer, Match, Number as N, Result } from "effect";
import * as O from "effect/Option";
import * as Obs from "../../internal/observability.ts";
import { getChildren, toArray } from "../EffectGraph.ts";
import { ExecutionError, TimeoutError } from "./Errors.ts";
import * as ResultStore from "./ResultStore.ts";
import * as Types from "./Types.ts";
import type { EffectGraph, GraphNode } from "../EffectGraph.ts";
import type { GraphOperation } from "./Operation.ts";

const $I = $NlpProcessingId.create("Graph/GraphOperations/Executor");

// =============================================================================
// Service Shape & Tag
// =============================================================================

interface Application {
  readonly errors: ReadonlyArray<unknown>;
  readonly fromCache: boolean;
  readonly newNodes: ReadonlyArray<GraphNode<unknown>>;
}

interface ExecutionFold {
  readonly errors: ReadonlyArray<unknown>;
  readonly metrics: Types.ExecutionMetrics;
  readonly newNodes: ReadonlyArray<GraphNode<unknown>>;
}

/**
 * Structural service contract for applying operations to graph leaves.
 *
 * @remarks
 * `execute` samples the current leaf set, applies the operation to those leaves,
 * and returns a type-erased result because cached values may come from different
 * concrete operations. Operation failures are collected in the result's `errors`
 * array; storage failures surface through the `ExecutionError` channel.
 *
 * @example
 * ```ts
 * import type { GraphExecutorShape } from "@beep/nlp-processing/Graph/GraphOperations/Executor"
 *
 * const readExecute = (executor: GraphExecutorShape) => executor.execute
 *
 * console.log(readExecute)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface GraphExecutorShape {
  readonly estimateCost: {
    <A, B, R, E>(graph: EffectGraph<A>, operation: GraphOperation<A, B, R, E>): Effect.Effect<Types.OperationCost>;
    <A, B, R, E>(operation: GraphOperation<A, B, R, E>): (graph: EffectGraph<A>) => Effect.Effect<Types.OperationCost>;
  };
  readonly execute: {
    <A, B, R, E>(
      graph: EffectGraph<A>,
      operation: GraphOperation<A, B, R, E>,
      options?: (typeof Types.ExecutionOptions)["~type.make.in"]
    ): Effect.Effect<Types.OperationResult<unknown, unknown>, ExecutionError, R | ResultStore.ResultStore>;
    <A, B, R, E>(
      operation: GraphOperation<A, B, R, E>,
      options?: (typeof Types.ExecutionOptions)["~type.make.in"]
    ): (
      graph: EffectGraph<A>
    ) => Effect.Effect<Types.OperationResult<unknown, unknown>, ExecutionError, R | ResultStore.ResultStore>;
  };
  readonly validate: {
    <A, B, R, E>(graph: EffectGraph<A>, operation: GraphOperation<A, B, R, E>): Effect.Effect<Types.ValidationResult>;
    <A, B, R, E>(
      operation: GraphOperation<A, B, R, E>
    ): (graph: EffectGraph<A>) => Effect.Effect<Types.ValidationResult>;
  };
}

/**
 * Service tag for the graph-operation execution engine.
 *
 * @remarks
 * Provide this service together with a {@link ResultStore.ResultStore} when
 * calling `execute`, because execution reads the store at run time to reuse or
 * write cached leaf results.
 *
 * @example
 * ```ts
 * import { GraphExecutor } from "@beep/nlp-processing/Graph/GraphOperations/Executor"
 *
 * console.log(GraphExecutor.key)
 * ```
 *
 * @since 0.0.0
 * @category services
 */
export class GraphExecutor extends Context.Service<GraphExecutor, GraphExecutorShape>()($I`GraphExecutor`) {}

// =============================================================================
// Helpers
// =============================================================================

const getLeafNodes = <A>(graph: EffectGraph<A>): ReadonlyArray<GraphNode<A>> =>
  A.filter(toArray(graph), (node) => A.length(getChildren(graph, node.id)) === 0);

/**
 * Validate and clamp a caller-supplied parallel concurrency value.
 *
 * Non-finite or non-positive requests (NaN, Infinity, zero, negatives) fail
 * closed to a single worker; otherwise the value is floored to an integer and
 * clamped into `[1, MAX_PARALLEL_CONCURRENCY]` so an untrusted or buggy caller
 * cannot request unbounded parallelism.
 */
const clampConcurrency = (requested: number): number =>
  Number.isFinite(requested) && requested >= 1
    ? N.clamp(Math.floor(requested), { maximum: Types.MAX_PARALLEL_CONCURRENCY, minimum: 1 })
    : 1;

const concurrencyOf = (strategy: Types.ExecutionStrategy): number =>
  Match.value(strategy).pipe(
    Match.tag("Parallel", (s) => clampConcurrency(s.concurrency)),
    Match.orElse(() => 1)
  );

const isEffectGraph = (value: unknown): value is EffectGraph<unknown> =>
  P.hasProperties(value, ["graph", "indexToNodeId", "nodeIdToIndex"]);

/**
 * Bound a single `operation.apply` call by an optional timeout.
 *
 * When a timeout is configured, expiry interrupts the operation and fails with a
 * {@link TimeoutError} so the executor records it as that leaf's result error
 * instead of letting a slow or non-terminating operation run unbounded.
 */
const applyWithTimeout = <A, B, R, E>(
  operation: GraphOperation<A, B, R, E>,
  leafNode: GraphNode<A>,
  timeout: O.Option<Duration.Duration>
): Effect.Effect<ReadonlyArray<GraphNode<B>>, E | TimeoutError, R> =>
  O.match(timeout, {
    onNone: () => operation.apply(leafNode),
    onSome: (duration) =>
      Effect.timeoutOrElse(operation.apply(leafNode), {
        duration,
        orElse: () =>
          Effect.fail(
            TimeoutError.make({
              nodeId: leafNode.id,
              operationName: operation.name,
              timeoutMs: Duration.toMillis(duration),
            })
          ),
      }),
  });

/** Apply the operation to one node, caching on success, yielding nodes + errors. */
const applyOne: {
  <A, B, R, E>(
    store: ResultStore.ResultStoreShape,
    operation: GraphOperation<A, B, R, E>,
    cache: boolean,
    timeout: O.Option<Duration.Duration>,
    leafNode: GraphNode<A>
  ): Effect.Effect<Application, ExecutionError, R>;
  <A, B, R, E>(
    operation: GraphOperation<A, B, R, E>,
    cache: boolean,
    timeout: O.Option<Duration.Duration>,
    leafNode: GraphNode<A>
  ): (store: ResultStore.ResultStoreShape) => Effect.Effect<Application, ExecutionError, R>;
} = dual(
  5,
  Effect.fn("applyOne")(function* <A, B, R, E>(
    store: ResultStore.ResultStoreShape,
    operation: GraphOperation<A, B, R, E>,
    cache: boolean,
    timeout: O.Option<Duration.Duration>,
    leafNode: GraphNode<A>
  ): Effect.fn.Return<Application, ExecutionError, R> {
    const attributes = {
      cache_enabled: `${cache}`,
      node_id: `${leafNode.id}`,
      operation: operation.name,
    };
    yield* Obs.annotateNlpSpan(attributes);

    const key = ResultStore.ResultKey.new(operation.name, leafNode.id);
    const cached = cache
      ? yield* Effect.mapError(store.get(key), (e) =>
          ExecutionError.make({
            cause: O.some(e),
            message: "Storage retrieve failed",
          })
        )
      : O.none<ResultStore.AnyOperationResult>();

    if (O.isSome(cached)) {
      yield* Obs.annotateNlpSpan({
        ...attributes,
        cache_hit: "true",
        error_count: `${A.length(cached.value.errors)}`,
        nodes_created: `${A.length(cached.value.newNodes)}`,
      });
      return {
        errors: cached.value.errors,
        fromCache: true,
        newNodes: cached.value.newNodes,
      };
    }

    const result = yield* Effect.result(applyWithTimeout(operation, leafNode, timeout));
    return yield* Result.match(result, {
      onFailure: (failure): Effect.Effect<Application, ExecutionError> =>
        Obs.annotateNlpSpan({
          ...attributes,
          cache_hit: "false",
          error_count: "1",
          nodes_created: "0",
          operation_failed: "true",
        }).pipe(
          Effect.as({
            errors: A.of(failure),
            fromCache: false,
            newNodes: A.empty<GraphNode<unknown>>(),
          })
        ),
      onSuccess: (newNodes): Effect.Effect<Application, ExecutionError> =>
        Obs.annotateNlpSpan({
          ...attributes,
          cache_hit: "false",
          error_count: "0",
          nodes_created: `${A.length(newNodes)}`,
        }).pipe(
          Effect.andThen(cache ? cacheResult(store, key, newNodes) : Effect.void),
          Effect.as({
            errors: A.empty<unknown>(),
            fromCache: false,
            newNodes,
          })
        ),
    });
  })
);

const cacheResult: {
  <B>(
    store: ResultStore.ResultStoreShape,
    key: ResultStore.ResultKey,
    newNodes: ReadonlyArray<GraphNode<B>>
  ): Effect.Effect<void, ExecutionError>;
  <B>(
    key: ResultStore.ResultKey,
    newNodes: ReadonlyArray<GraphNode<B>>
  ): (store: ResultStore.ResultStoreShape) => Effect.Effect<void, ExecutionError>;
} = dual(
  3,
  Effect.fn("cacheResult")(function* <B>(
    store: ResultStore.ResultStoreShape,
    key: ResultStore.ResultKey,
    newNodes: ReadonlyArray<GraphNode<B>>
  ): Effect.fn.Return<void, ExecutionError> {
    const opResult = yield* Types.makeOperationResult(
      yield* Types.generateExecutionId,
      O.none(),
      newNodes,
      A.empty<unknown>(),
      Types.ExecutionMetrics.empty()
    );
    yield* Effect.mapError(store.store(key, opResult), (e) =>
      ExecutionError.make({ cause: O.some(e), message: "Storage store failed" })
    );
  })
);

const foldApplications: {
  (applications: ReadonlyArray<Application>, nodesProcessed: number, durationMs: number): ExecutionFold;
  (nodesProcessed: number, durationMs: number): (applications: ReadonlyArray<Application>) => ExecutionFold;
} = dual(
  3,
  (applications: ReadonlyArray<Application>, nodesProcessed: number, durationMs: number): ExecutionFold => ({
    errors: A.flatMap(applications, (r) => r.errors),
    metrics: Types.ExecutionMetrics.make({
      cacheHits: NonNegativeInt.make(A.length(A.filter(applications, (r) => r.fromCache))),
      cacheMisses: NonNegativeInt.make(A.length(A.filter(applications, (r) => !r.fromCache))),
      duration: Duration.millis(durationMs),
      nodesCreated: NonNegativeInt.make(A.reduce(applications, 0, (sum, r) => sum + A.length(r.newNodes))),
      nodesProcessed: NonNegativeInt.make(nodesProcessed),
      tokensConsumed: NonNegativeInt.make(0),
    }),
    newNodes: A.flatMap(applications, (r) => r.newNodes),
  })
);

const runStrategy: {
  <A, B, R, E>(
    store: ResultStore.ResultStoreShape,
    leafNodes: ReadonlyArray<GraphNode<A>>,
    operation: GraphOperation<A, B, R, E>,
    cache: boolean,
    concurrency: number,
    timeout: O.Option<Duration.Duration>
  ): Effect.Effect<ExecutionFold, ExecutionError, R>;
  <A, B, R, E>(
    leafNodes: ReadonlyArray<GraphNode<A>>,
    operation: GraphOperation<A, B, R, E>,
    cache: boolean,
    concurrency: number,
    timeout: O.Option<Duration.Duration>
  ): (store: ResultStore.ResultStoreShape) => Effect.Effect<ExecutionFold, ExecutionError, R>;
} = dual(
  6,
  Effect.fn("runStrategy")(function* <A, B, R, E>(
    store: ResultStore.ResultStoreShape,
    leafNodes: ReadonlyArray<GraphNode<A>>,
    operation: GraphOperation<A, B, R, E>,
    cache: boolean,
    concurrency: number,
    timeout: O.Option<Duration.Duration>
  ): Effect.fn.Return<ExecutionFold, ExecutionError, R> {
    const attributes = {
      cache_enabled: `${cache}`,
      concurrency: `${concurrency}`,
      leaf_count: `${A.length(leafNodes)}`,
      operation: operation.name,
      timeout_ms: O.match(timeout, { onNone: () => "none", onSome: (d) => `${Duration.toMillis(d)}` }),
    };
    return yield* Effect.gen(function* () {
      const startTime = yield* Clock.currentTimeMillis;
      const applications = yield* Effect.forEach(
        leafNodes,
        (leafNode) => applyOne(store, operation, cache, timeout, leafNode),
        {
          concurrency,
        }
      );
      const endTime = yield* Clock.currentTimeMillis;
      const fold = foldApplications(applications, A.length(leafNodes), endTime - startTime);
      yield* Obs.annotateNlpSpan({
        ...attributes,
        cache_hits: `${fold.metrics.cacheHits}`,
        cache_misses: `${fold.metrics.cacheMisses}`,
        error_count: `${A.length(fold.errors)}`,
        nodes_created: `${fold.metrics.nodesCreated}`,
      });
      return fold;
    }).pipe(Obs.trackNlpDuration("nlp.graph_executor.run_strategy", attributes));
  })
);

// =============================================================================
// Implementation
// =============================================================================

const estimateCost: GraphExecutorShape["estimateCost"] = dual(
  2,
  Effect.fn("GraphExecutor.estimateCost")(function* <A, B, R, E>(
    graph: EffectGraph<A>,
    operation: GraphOperation<A, B, R, E>
  ) {
    const leafNodes = getLeafNodes(graph);
    return yield* O.match(A.head(leafNodes), {
      onNone: () => Effect.succeed(Types.OperationCost.zero()),
      onSome: (sample) =>
        Effect.map(operation.estimateCost(sample), (cost) => Types.OperationCost.scale(cost, A.length(leafNodes))),
    });
  })
);

const execute: GraphExecutorShape["execute"] = dual(
  (args) => args.length >= 3 || isEffectGraph(args[0]),
  Effect.fn("GraphExecutor.execute")(function* <A, B, R, E>(
    graph: EffectGraph<A>,
    operation: GraphOperation<A, B, R, E>,
    options: (typeof Types.ExecutionOptions)["~type.make.in"] = {}
  ) {
    const opts = Types.ExecutionOptions.make(options);
    const executionId = yield* Types.generateExecutionId;
    const leafNodes = getLeafNodes(graph);
    const attributes = {
      cache_enabled: `${opts.cache}`,
      concurrency: `${concurrencyOf(opts.strategy)}`,
      execution_id: `${executionId}`,
      leaf_count: `${A.length(leafNodes)}`,
      operation: operation.name,
      strategy: opts.strategy._tag,
      timeout_ms: O.match(opts.timeout, { onNone: () => "none", onSome: (d) => `${Duration.toMillis(d)}` }),
    };

    return yield* Effect.gen(function* () {
      const store = yield* ResultStore.ResultStore;
      const fold: ExecutionFold =
        A.length(leafNodes) === 0
          ? {
              errors: A.empty<unknown>(),
              metrics: Types.ExecutionMetrics.empty(),
              newNodes: A.empty<GraphNode<unknown>>(),
            }
          : yield* runStrategy(store, leafNodes, operation, opts.cache, concurrencyOf(opts.strategy), opts.timeout);

      yield* Obs.annotateNlpSpan({
        ...attributes,
        cache_hits: `${fold.metrics.cacheHits}`,
        cache_misses: `${fold.metrics.cacheMisses}`,
        duration_ms: `${Duration.toMillis(fold.metrics.duration)}`,
        error_count: `${A.length(fold.errors)}`,
        nodes_created: `${fold.metrics.nodesCreated}`,
        nodes_processed: `${fold.metrics.nodesProcessed}`,
      });
      return yield* Types.makeOperationResult(executionId, graph, fold.newNodes, fold.errors, fold.metrics);
    }).pipe(Obs.observeNlpWorkflow("nlp.graph_executor.execute", attributes));
  })
);

const validate: GraphExecutorShape["validate"] = dual(
  2,
  Effect.fn("GraphExecutor.validate")(function* <A, B, R, E>(
    graph: EffectGraph<A>,
    operation: GraphOperation<A, B, R, E>
  ) {
    const leafNodes = getLeafNodes(graph);
    if (A.length(leafNodes) === 0) {
      return Types.ValidationResult.withWarnings(Types.ValidationResult.valid(), [
        "No leaf nodes to apply operation to",
      ]);
    }
    const validations = yield* Effect.forEach(leafNodes, (node) => operation.validate(node), { concurrency: 4 });
    const errors = A.flatMap(validations, (v) => v.errors);
    const warnings = A.flatMap(validations, (v) => v.warnings);
    return A.length(errors) === 0
      ? { errors: A.empty<string>(), valid: true, warnings }
      : { errors, valid: false, warnings };
  })
);

const makeGraphExecutor = Effect.succeed(
  GraphExecutor.of({
    estimateCost,
    execute,
    validate,
  })
);

/**
 * Live {@link GraphExecutor} layer.
 *
 * @remarks
 * The layer constructs only the executor service. Effects returned from
 * `GraphExecutor.execute` still require a {@link ResultStore.ResultStore}
 * environment so callers can choose the cache implementation per run.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { GraphExecutorLive } from "@beep/nlp-processing/Graph/GraphOperations/Executor"
 * import { empty } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { identity } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 * import { GraphExecutor } from "@beep/nlp-processing/Graph/GraphOperations/Executor"
 *
 * const cost = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const executor = yield* GraphExecutor
 *     return yield* executor.estimateCost(empty<string>(), identity<string>())
 *   }).pipe(Effect.provide(GraphExecutorLive))
 * )
 *
 * cost.complexity
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const GraphExecutorLive: Layer.Layer<GraphExecutor> = Layer.effect(GraphExecutor, makeGraphExecutor);

/**
 * Test layer providing both the executor and its in-memory result store.
 *
 * @remarks
 * Use this layer for examples and tests that run `execute` directly. It starts
 * with an empty cache and satisfies the executor's run-time
 * {@link ResultStore.ResultStore} requirement.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { GraphExecutorTest } from "@beep/nlp-processing/Graph/GraphOperations/Executor"
 * import { empty } from "@beep/nlp-processing/Graph/EffectGraph"
 * import { identity } from "@beep/nlp-processing/Graph/GraphOperations/Operation"
 * import { GraphExecutor } from "@beep/nlp-processing/Graph/GraphOperations/Executor"
 *
 * const validation = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const executor = yield* GraphExecutor
 *     return yield* executor.validate(empty<string>(), identity<string>())
 *   }).pipe(Effect.provide(GraphExecutorTest))
 * )
 *
 * validation.warnings.length
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const GraphExecutorTest: Layer.Layer<GraphExecutor | ResultStore.ResultStore> = Layer.merge(
  GraphExecutorLive,
  ResultStore.ResultStoreTest
);
