/**
 * GraphOperations/Types - core value types for the graph-operations engine.
 *
 * Execution strategies, metrics, cost estimation, validation results, options,
 * execution ids, and operation results. {@link ExecutionMetrics} forms a monoid
 * (its {@link ExecutionMetrics.combine} is associative with {@link ExecutionMetrics.empty}
 * as identity), which is how per-node results aggregate into a run total.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * - `ExecutionId` is a `Brand.nominal` branded string with an EFFECTFUL
 *   {@link generateExecutionId} (reads `Clock` + `effect/Random`) instead of an
 *   inline `crypto.randomUUID()`.
 * - {@link makeOperationResult} reads `Clock` for its timestamp instead of
 *   `Date.now()`.
 * - `timeout` is an `Option<Duration>` (no `null`); native array spreads become
 *   `effect/Array`.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, NonNegNum, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Clock, Duration, Effect, Random, Tuple } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { GraphNode } from "../EffectGraph.ts";

const $I = $NlpProcessingId.create("Graph/GraphOperations/Types");

// =============================================================================
// Execution Strategy
// =============================================================================

/**
 * Conservative upper bound the executor enforces on parallel concurrency.
 *
 * **Gotchas**
 *
 * `ExecutionStrategy.Parallel(concurrency)` accepts any finite number, but an
 * untrusted or buggy caller could request excessive parallelism and exhaust
 * CPU, memory, fibers, or downstream resources. The executor clamps the
 * requested concurrency into `[1, MAX_PARALLEL_CONCURRENCY]` (flooring fractional
 * values and falling back to `1` for non-finite or non-positive input) before
 * scheduling work, so this constant is the documented source of truth for that
 * cap. Trusted operators that genuinely need more parallelism should raise this
 * bound deliberately rather than passing larger values from request input.
 *
 * **Example** (Clamp requested parallel concurrency)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { MAX_PARALLEL_CONCURRENCY } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const requested = MAX_PARALLEL_CONCURRENCY + 10
 * const bounded = Math.min(requested, MAX_PARALLEL_CONCURRENCY)
 *
 * strictEqual(bounded, 64)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_PARALLEL_CONCURRENCY = 64;

/**
 * Strategy describing how an operation is scheduled across the current leaf set.
 *
 * **Details**
 *
 * The executor currently honors sequential execution and parallel execution with
 * bounded concurrency: the requested `Parallel(concurrency)` value is clamped to
 * `[1, MAX_PARALLEL_CONCURRENCY]` before scheduling, so callers cannot request
 * unbounded parallelism. Batch and streaming variants are part of the public
 * model so callers can persist intent, but execution falls back to the sequential
 * behavior until dedicated schedulers are introduced.
 *
 * **Example** (Create parallel execution strategy)
 *
 * ```ts import.meta.vitest name="Create parallel execution strategy"
 * import { ExecutionStrategy } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const strategy = ExecutionStrategy.Parallel(4)
 * strategy.concurrency // => 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExecutionStrategy = S.TaggedUnion({
  Sequential: {},
  Parallel: { concurrency: S.Finite },
  Batch: { batchSize: S.Finite },
  Streaming: {},
}).pipe(
  SchemaUtils.withStatics((schema) => ({
    Sequential: schema.cases.Sequential.make({}),
    Parallel: (concurrency: number) =>
      schema.cases.Parallel.make({
        concurrency,
      }),
    Batch: (batchSize: number) =>
      schema.cases.Batch.make({
        batchSize,
      }),
    Streaming: schema.cases.Streaming.make({}),
  })),
  $I.annoteSchema("ExecutionStrategy", {
    description: "Strategy determining how an operation is executed across the graph's nodes.",
  })
);

/**
 * Runtime type represented by {@link ExecutionStrategy}.
 *
 * **Example** (Annotate sequential strategy type)
 *
 * ```ts import.meta.vitest name="Annotate sequential strategy type"
 * import { ExecutionStrategy } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const strategy: ExecutionStrategy = ExecutionStrategy.Sequential
 * strategy._tag // => "Sequential"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExecutionStrategy = typeof ExecutionStrategy.Type;

// =============================================================================
// Execution Metrics (Monoid)
// =============================================================================

/**
 * Metrics accumulated while applying an operation to graph leaves.
 *
 * **Details**
 *
 * Metrics form a monoid: `empty` is the identity and `combine` adds counters
 * and durations. Executors use this to aggregate per-leaf applications into one
 * run summary.
 *
 * **Example** (Combine empty metrics monoid)
 *
 * ```ts import.meta.vitest name="Combine empty metrics monoid"
 * import { NonNegativeInt } from "@beep/schema"
 * import { ExecutionMetrics } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const combined = ExecutionMetrics.combine(
 *   ExecutionMetrics.empty(),
 *   ExecutionMetrics.make({ ...ExecutionMetrics.empty(), nodesProcessed: NonNegativeInt.make(2) })
 * )
 *
 * combined.nodesProcessed // => 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExecutionMetrics extends S.Class<ExecutionMetrics>($I`ExecutionMetrics`)(
  {
    cacheHits: NonNegativeInt,
    cacheMisses: NonNegativeInt,
    duration: S.Duration,
    nodesCreated: NonNegativeInt,
    nodesProcessed: NonNegativeInt,
    /** Tokens consumed by LLM-backed operations. */
    tokensConsumed: NonNegativeInt.annotateKey({
      description: "Tokens consumed by LLM-backed operations.",
    }),
  },
  $I.annote("ExecutionMetrics", {
    description: "Monoid of metrics accumulated while applying an operation to graph leaves.",
  })
) {
  static readonly empty = () =>
    ExecutionMetrics.make({
      cacheHits: NonNegativeInt.make(0),
      cacheMisses: NonNegativeInt.make(0),
      duration: Duration.zero,
      nodesCreated: NonNegativeInt.make(0),
      nodesProcessed: NonNegativeInt.make(0),
      tokensConsumed: NonNegativeInt.make(0),
    });

  static readonly combine: {
    (m1: ExecutionMetrics, m2: ExecutionMetrics): ExecutionMetrics;
    (m2: ExecutionMetrics): (m1: ExecutionMetrics) => ExecutionMetrics;
  } = dual(
    2,
    (m1: ExecutionMetrics, m2: ExecutionMetrics): ExecutionMetrics =>
      ExecutionMetrics.make({
        cacheHits: NonNegativeInt.make(m1.cacheHits + m2.cacheHits),
        cacheMisses: NonNegativeInt.make(m1.cacheMisses + m2.cacheMisses),
        duration: Duration.sum(m1.duration, m2.duration),
        nodesCreated: NonNegativeInt.make(m1.nodesCreated + m2.nodesCreated),
        nodesProcessed: NonNegativeInt.make(m1.nodesProcessed + m2.nodesProcessed),
        tokensConsumed: NonNegativeInt.make(m1.tokensConsumed + m2.tokensConsumed),
      })
  );
}

// =============================================================================
// Operation Cost Estimation
// =============================================================================

/**
 * Asymptotic complexity vocabulary used when scaling operation cost estimates.
 *
 * **Example** (Check O(n) complexity tag)
 *
 * ```ts import.meta.vitest name="Check O(n) complexity tag"
 * import { Complexity } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * Complexity.is["O(n)"]("O(n)") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Complexity = LiteralKit(["O(1)", "O(n)", "O(n log n)", "O(n^2)"]).pipe(
  $I.annoteSchema("Complexity", {
    description: "Asymptotic complexity class used to scale an OperationCost.",
  })
);

/**
 * Runtime type represented by {@link Complexity}.
 *
 * **Example** (Assign linearithmic complexity type)
 *
 * ```ts
 * import type { Complexity } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const complexity: Complexity = "O(n log n)"
 * console.log(complexity)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Complexity = typeof Complexity.Type;

/**
 * Cost estimate for an operation whose time does not grow with leaf count.
 *
 * **Example** (Make constant operation cost)
 *
 * ```ts import.meta.vitest name="Make constant operation cost"
 * import { Duration } from "effect"
 * import { ConstantOperationCost } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const cost = ConstantOperationCost.make({
 *   complexity: "O(1)",
 *   estimatedTime: Duration.millis(1),
 *   memoryCost: 0,
 *   tokenCost: 0
 * })
 *
 * cost.complexity // => "O(1)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConstantOperationCost extends S.Class<ConstantOperationCost>($I`ConstantOperationCost`)(
  {
    complexity: S.tag("O(1)"),
    estimatedTime: S.Duration,
    /** Memory cost in bytes. */
    memoryCost: NonNegNum.annotateKey({
      description: "Memory cost in bytes.",
    }),
    /** LLM token cost. */
    tokenCost: NonNegNum.annotateKey({
      description: "LLM token cost in tokens.",
    }),
  },
  $I.annote("ConstantOperationCost", {
    description: "Cost estimate for an operation whose time complexity is constant.",
  })
) {}

/**
 * Cost estimate for work that grows linearly with leaf count.
 *
 * **Example** (Make linear operation cost)
 *
 * ```ts import.meta.vitest name="Make linear operation cost"
 * import { Duration } from "effect"
 * import { LinearOperationCost } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const cost = LinearOperationCost.make({
 *   complexity: "O(n)",
 *   estimatedTime: Duration.millis(2),
 *   memoryCost: 128,
 *   tokenCost: 4
 * })
 *
 * cost.tokenCost // => 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LinearOperationCost extends S.Class<LinearOperationCost>($I`LinearOperationCost`)(
  {
    complexity: S.tag("O(n)"),
    estimatedTime: S.Duration,
    /** Memory cost in bytes. */
    memoryCost: NonNegNum.annotateKey({
      description: "Memory cost in bytes.",
    }),
    /** LLM token cost. */
    tokenCost: NonNegNum.annotateKey({
      description: "LLM token cost in tokens.",
    }),
  },
  $I.annote("LinearOperationCost", {
    description: "Cost estimate for an operation whose time complexity is linear.",
  })
) {}

/**
 * Cost estimate for work that grows at `n log n`.
 *
 * **Example** (Make linearithmic operation cost)
 *
 * ```ts import.meta.vitest name="Make linearithmic operation cost"
 * import { Duration } from "effect"
 * import { LinearithmicOperationCost } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const cost = LinearithmicOperationCost.make({
 *   complexity: "O(n log n)",
 *   estimatedTime: Duration.millis(3),
 *   memoryCost: 256,
 *   tokenCost: 0
 * })
 *
 * cost.memoryCost // => 256
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LinearithmicOperationCost extends S.Class<LinearithmicOperationCost>($I`LinearithmicOperationCost`)(
  {
    complexity: S.tag("O(n log n)"),
    estimatedTime: S.Duration,
    /** Memory cost in bytes. */
    memoryCost: NonNegNum.annotateKey({
      description: "Memory cost in bytes.",
    }),
    /** LLM token cost. */
    tokenCost: NonNegNum.annotateKey({
      description: "LLM token cost in tokens.",
    }),
  },
  $I.annote("LinearithmicOperationCost", {
    description: "Cost estimate for an operation whose time complexity is linearithmic.",
  })
) {}

/**
 * Cost estimate for pairwise or otherwise quadratic graph work.
 *
 * **Example** (Make quadratic operation cost)
 *
 * ```ts import.meta.vitest name="Make quadratic operation cost"
 * import { Duration } from "effect"
 * import { QuadraticOperationCost } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const cost = QuadraticOperationCost.make({
 *   complexity: "O(n^2)",
 *   estimatedTime: Duration.millis(5),
 *   memoryCost: 512,
 *   tokenCost: 0
 * })
 *
 * cost.complexity // => "O(n^2)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuadraticOperationCost extends S.Class<QuadraticOperationCost>($I`QuadraticOperationCost`)(
  {
    complexity: S.tag("O(n^2)"),
    estimatedTime: S.Duration,
    /** Memory cost in bytes. */
    memoryCost: NonNegNum.annotateKey({
      description: "Memory cost in bytes.",
    }),
    /** LLM token cost. */
    tokenCost: NonNegNum.annotateKey({
      description: "LLM token cost in tokens.",
    }),
  },
  $I.annote("QuadraticOperationCost", {
    description: "Cost estimate for an operation whose time complexity is quadratic.",
  })
) {}

/**
 * Tagged union of operation cost estimates with scaling helpers.
 *
 * **Details**
 *
 * `scale` multiplies the estimate for the number of leaves the executor will
 * process. Time uses the selected complexity class, while memory and token costs
 * are currently scaled linearly by leaf count.
 *
 * **Example** (Scale linear cost by leaves)
 *
 * ```ts import.meta.vitest name="Scale linear cost by leaves"
 * import { Duration } from "effect"
 * import { OperationCost } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const cost = OperationCost.cases["O(n)"].make({
 *   estimatedTime: Duration.millis(2),
 *   memoryCost: 10,
 *   tokenCost: 1
 * })
 *
 * OperationCost.scale(cost, 3).memoryCost // => 30
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OperationCost = Complexity.mapMembers(
  Tuple.evolve([
    () => ConstantOperationCost,
    () => LinearOperationCost,
    () => LinearithmicOperationCost,
    () => QuadraticOperationCost,
  ])
).pipe(
  S.toTaggedUnion("complexity"),
  SchemaUtils.withStatics(() => {
    const scale: {
      (cost: OperationCost, nodeCount: number): OperationCost;
      (nodeCount: number): (cost: OperationCost) => OperationCost;
    } = dual(2, (cost: OperationCost, nodeCount: number): OperationCost => {
      const timeMultiplier = Complexity.$match(cost.complexity, {
        "O(1)": () => 1,
        "O(n)": () => nodeCount,
        "O(n log n)": () => nodeCount * Math.log2(nodeCount),
        "O(n^2)": () => nodeCount * nodeCount,
      });
      return {
        complexity: cost.complexity,
        estimatedTime: Duration.times(cost.estimatedTime, timeMultiplier),
        memoryCost: NonNegNum.make(cost.memoryCost * nodeCount),
        tokenCost: NonNegNum.make(cost.tokenCost * nodeCount),
      };
    });

    return {
      zero: () =>
        OperationCost.cases["O(1)"].make({
          estimatedTime: Duration.zero,
          memoryCost: 0,
          tokenCost: 0,
        }),
      scale,
    };
  }),
  $I.annoteSchema("OperationCost", {
    description: "Cost of a graph operation",
  })
);

/**
 * Companion type for {@link OperationCost}.
 *
 * **Example** (Type constant operation cost)
 *
 * ```ts import.meta.vitest name="Type constant operation cost"
 * import { Duration } from "effect"
 * import { OperationCost } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const cost: OperationCost = OperationCost.cases["O(1)"].make({
 *   estimatedTime: Duration.millis(1),
 *   memoryCost: 0,
 *   tokenCost: 0,
 * })
 *
 * cost.complexity // => "O(1)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OperationCost = typeof OperationCost.Type;

// =============================================================================
// Validation Result
// =============================================================================

/**
 * Result of checking whether an operation may run against graph leaves.
 *
 * **Details**
 *
 * `valid` is false when any errors are present. Warnings preserve non-blocking
 * diagnostics, such as running against a graph with no leaves.
 *
 * **Example** (Attach non-blocking validation warnings)
 *
 * ```ts import.meta.vitest name="Attach non-blocking validation warnings"
 * import { ValidationResult } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const result = ValidationResult.withWarnings(
 *   ValidationResult.valid(),
 *   ["No leaf nodes to process"]
 * )
 *
 * result.warnings.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ValidationResult extends S.Class<ValidationResult>($I`ValidationResult`)(
  {
    errors: S.Array(S.String),
    valid: S.Boolean,
    warnings: S.Array(S.String),
  },
  $I.annote("ValidationResult", {
    description: "Result of validating that an operation can be applied",
  })
) {
  static readonly valid = () => ({
    errors: A.empty<string>(),
    valid: true,
    warnings: A.empty<string>(),
  });

  static invalid = (errors: ReadonlyArray<string>): ValidationResult => ({
    errors,
    valid: false,
    warnings: A.empty<string>(),
  });
  static readonly withWarnings: {
    (result: ValidationResult, warnings: ReadonlyArray<string>): ValidationResult;
    (warnings: ReadonlyArray<string>): (result: ValidationResult) => ValidationResult;
  } = dual(
    2,
    (result: ValidationResult, warnings: ReadonlyArray<string>): ValidationResult => ({
      ...result,
      warnings: A.appendAll(result.warnings, warnings),
    })
  );
}

// =============================================================================
// Operation Category
// =============================================================================

/**
 * Operation category vocabulary describing a graph morphism's shape.
 *
 * **Example** (Check expansion category tag)
 *
 * ```ts import.meta.vitest name="Check expansion category tag"
 * import { OperationCategory } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * OperationCategory.is.expansion("expansion") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OperationCategory = LiteralKit([
  "transformation",
  "expansion",
  "aggregation",
  "filtering",
  "composition",
  "llm",
]).pipe(
  $I.annoteSchema("OperationCategory", {
    description: "Graph operation category vocabulary.",
  })
);

/**
 * Runtime type represented by {@link OperationCategory}.
 *
 * **Example** (Assign transformation category type)
 *
 * ```ts
 * import type { OperationCategory } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const category: OperationCategory = "transformation"
 * console.log(category)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OperationCategory = typeof OperationCategory.Type;

// =============================================================================
// Execution Options
// =============================================================================

/**
 * Options controlling one executor run.
 *
 * **Details**
 *
 * `cache` toggles result-store lookup and write-through. `strategy` controls
 * scheduling over the current leaf set. When `timeout` is set, the executor
 * bounds each per-leaf `operation.apply` invocation by that duration and records
 * a `TimeoutError` as that leaf's result error on expiry instead of letting the
 * operation run unbounded. `trace` is retained for orchestration layers that emit
 * diagnostics around execution.
 *
 * **Example** (Build parallel execution options)
 *
 * ```ts import.meta.vitest name="Build parallel execution options"
 * import { ExecutionOptions } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const options = ExecutionOptions.parallel(8)
 * options.strategy._tag // => "Parallel"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExecutionOptions extends S.Class<ExecutionOptions>($I`ExecutionOptions`)(
  {
    cache: SchemaUtils.withKeyDefaults(S.Boolean, true),
    strategy: SchemaUtils.withKeyDefaults(ExecutionStrategy, ExecutionStrategy.Sequential),
    timeout: SchemaUtils.withKeyDefaults(S.Option(S.Duration), O.none()),
    trace: SchemaUtils.withKeyDefaults(S.Boolean, false),
  },
  $I.annote("ExecutionOptions", {
    description: "Options controlling a single execution.",
  })
) {
  static readonly default = () => ExecutionOptions.make({});
  static readonly sequential = () =>
    ExecutionOptions.make({
      strategy: ExecutionStrategy.cases.Sequential.make({}),
    });
  static readonly parallel = (concurrency = 4) =>
    ExecutionOptions.make({
      strategy: ExecutionStrategy.Parallel(concurrency),
    });
}

// =============================================================================
// Execution ID
// =============================================================================

/**
 * Branded identifier for one graph-operation execution.
 *
 * **Example** (Make branded execution id)
 *
 * ```ts
 * import { ExecutionId } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const id: ExecutionId = ExecutionId.make("exec-1")
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExecutionId = S.String.pipe(
  S.brand("ExecutionId"),
  $I.annoteSchema("ExecutionId", {
    description: "Unique identifier for one execution.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type represented by {@link ExecutionId}.
 *
 * **Example** (Type branded execution id)
 *
 * ```ts
 * import { ExecutionId } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const id: ExecutionId = ExecutionId.make("exec-1")
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExecutionId = typeof ExecutionId.Type;

/**
 * Generate a fresh execution id from the Effect clock and random service.
 *
 * **Example** (Generate fresh execution id)
 *
 * ```ts import.meta.vitest name="Generate fresh execution id"
 * import { Effect } from "effect"
 * import { generateExecutionId } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const program = Effect.map(generateExecutionId, (id) => id.startsWith("exec-"))
 * Effect.runSync(program) // => true
 * ```
 *
 * @effects Reads the Effect `Clock` and random service to include timestamp and entropy in the generated id.
 * @category constructors
 * @since 0.0.0
 */
export const generateExecutionId: Effect.Effect<ExecutionId> = Effect.gen(function* () {
  const ms = yield* Clock.currentTimeMillis;
  const rand = yield* Random.nextInt;
  return ExecutionId.make(`exec-${ms}-${rand}`);
});

// =============================================================================
// Operation Result
// =============================================================================

/**
 * Result of applying one operation to the sampled graph leaves.
 *
 * **Details**
 *
 * `newNodes` contains only nodes emitted by the operation, not a rewritten graph.
 * `errors` contains per-leaf operation failures captured during application.
 * `originalGraph` is intentionally opaque so callers can carry provenance
 * without forcing this type to know the graph's payload type.
 *
 * **Example** (Count newly emitted nodes)
 *
 * ```ts
 * import type { OperationResult } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const createdCount = <A, E>(result: OperationResult<A, E>) => result.newNodes.length
 * console.log(createdCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface OperationResult<B, E> {
  readonly errors: ReadonlyArray<E>;
  readonly executionId: ExecutionId;
  readonly metrics: ExecutionMetrics;
  readonly newNodes: ReadonlyArray<GraphNode<B>>;
  /** Opaque reference to the originating graph. */
  readonly originalGraph: unknown;
  readonly timestamp: number;
}

/**
 * Build an operation result and stamp it with the current Effect clock time.
 *
 * **Example** (Stamp result with clock time)
 *
 * ```ts import.meta.vitest name="Stamp result with clock time"
 * import { Effect } from "effect"
 * import { ExecutionId, ExecutionMetrics, makeOperationResult } from "@beep/nlp-processing/Graph/GraphOperations/Types"
 *
 * const program = makeOperationResult(ExecutionId.make("exec-example"), {
 *   originalGraph: "source graph",
 *   newNodes: [],
 *   errors: [],
 *   metrics: ExecutionMetrics.empty()
 * })
 *
 * Effect.runSync(program).newNodes.length // => 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeOperationResult: {
  <B, E>(
    executionId: ExecutionId,
    options: {
      readonly originalGraph: unknown;
      readonly newNodes: ReadonlyArray<GraphNode<B>>;
      readonly errors: ReadonlyArray<E>;
      readonly metrics: ExecutionMetrics;
    }
  ): Effect.Effect<OperationResult<B, E>>;
  <B, E>(options: {
    readonly originalGraph: unknown;
    readonly newNodes: ReadonlyArray<GraphNode<B>>;
    readonly errors: ReadonlyArray<E>;
    readonly metrics: ExecutionMetrics;
  }): (executionId: ExecutionId) => Effect.Effect<OperationResult<B, E>>;
} = dual(
  2,
  <B, E>(
    executionId: ExecutionId,
    {
      errors,
      metrics,
      newNodes,
      originalGraph,
    }: {
      readonly originalGraph: unknown;
      readonly newNodes: ReadonlyArray<GraphNode<B>>;
      readonly errors: ReadonlyArray<E>;
      readonly metrics: ExecutionMetrics;
    }
  ): Effect.Effect<OperationResult<B, E>> =>
    Effect.map(
      Clock.currentTimeMillis,
      (timestamp): OperationResult<B, E> => ({
        errors,
        executionId,
        metrics,
        newNodes,
        originalGraph,
        timestamp,
      })
    )
);
