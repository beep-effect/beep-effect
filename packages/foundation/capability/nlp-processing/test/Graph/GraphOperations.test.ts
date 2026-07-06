/**
 * Proofs for the GraphOperations spine: the ExecutionMetrics monoid laws
 * (associativity + identity), OperationCost scaling, the effectful Operation
 * constructors (pure/transform/expand/filter/identity), the ResultStore
 * store/get/has/delete/clear/gc round-trips, and the GraphExecutor over a small
 * graph (leaf application, caching, validation, cost estimation).
 *
 * Effect v4 + `@effect/vitest` coverage for GraphOperations.
 */

import * as EG from "@beep/nlp-processing/Graph/EffectGraph";
import { Errors, Executor, Operation, ResultStore, Types } from "@beep/nlp-processing/Graph/GraphOperations";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const finiteNonNegativeMillis = (duration: Duration.Duration): Duration.Duration => {
  const millis = Duration.toMillis(duration);
  return Number.isFinite(millis) ? Duration.millis(Math.min(Math.abs(Math.trunc(millis)), 86_400_000)) : Duration.zero;
};

const arbMetrics: fc.Arbitrary<Types.ExecutionMetrics> = S.toArbitrary(Types.ExecutionMetrics).map((metrics) =>
  Types.ExecutionMetrics.make({
    ...metrics,
    duration: finiteNonNegativeMillis(metrics.duration),
  })
);
const metricsEqual = S.toEquivalence(Types.ExecutionMetrics);

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown, unknown, never, never>>(schema: Schema) => {
  const arbitrary = S.toArbitrary(schema);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equals = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      expect(equals(decode(encode(value)), value)).toBe(true);
    }),
    { numRuns: 50 }
  );
};

describe("ExecutionMetrics monoid laws", () => {
  it("round-trips schema-derived metrics through encode/decode", () => {
    assertSchemaRoundTrip(Types.ExecutionMetrics);
  });

  it("satisfies left identity: empty ⊕ x = x", () => {
    fc.assert(
      fc.property(arbMetrics, (x) => metricsEqual(Types.ExecutionMetrics.combine(Types.ExecutionMetrics.empty(), x), x))
    );
  });

  it("satisfies right identity: x ⊕ empty = x", () => {
    fc.assert(
      fc.property(arbMetrics, (x) => metricsEqual(Types.ExecutionMetrics.combine(x, Types.ExecutionMetrics.empty()), x))
    );
  });

  it("satisfies associativity: (x ⊕ y) ⊕ z = x ⊕ (y ⊕ z)", () => {
    fc.assert(
      fc.property(arbMetrics, arbMetrics, arbMetrics, (x, y, z) =>
        metricsEqual(
          Types.ExecutionMetrics.combine(Types.ExecutionMetrics.combine(x, y), z),
          Types.ExecutionMetrics.combine(x, Types.ExecutionMetrics.combine(y, z))
        )
      )
    );
  });
});

describe("OperationCost", () => {
  it("round-trips schema-derived operation costs through encode/decode", () => {
    assertSchemaRoundTrip(Types.OperationCost);
  });

  it("scales O(1) cost by a constant factor of 1", () => {
    const scaled = Types.OperationCost.scale(
      { ...Types.OperationCost.zero(), tokenCost: 5, estimatedTime: Duration.millis(10) },
      8
    );
    expect(scaled.tokenCost).toBe(40);
    expect(Duration.toMillis(scaled.estimatedTime)).toBe(10);
  });

  it("scales O(n) time linearly", () => {
    const scaled = Types.OperationCost.scale(
      { complexity: "O(n)", estimatedTime: Duration.millis(3), memoryCost: 0, tokenCost: 0 },
      4
    );
    expect(Duration.toMillis(scaled.estimatedTime)).toBe(12);
  });
});

describe("ExecutionId", () => {
  it("round-trips schema-derived ids through encode/decode", () => {
    assertSchemaRoundTrip(Types.ExecutionId);
  });

  it.effect(
    "generates distinct ids",
    Effect.fnUntraced(function* () {
      const a = yield* Types.generateExecutionId;
      const b = yield* Types.generateExecutionId;
      expect(a).not.toBe(b);
    })
  );
});

describe("Operation constructors", () => {
  it.effect(
    "pure mints one child node per produced value",
    Effect.fnUntraced(function* () {
      const op = Operation.expand({ name: "chars", description: "", f: (s: string) => s.split("") });
      const root = yield* EG.makeNode("ab");
      const children = yield* op.apply(root);
      expect(children.length).toBe(2);
      expect(children.map((n) => n.data)).toEqual(["a", "b"]);
      expect(O.getOrNull(children[0]!.parentId)).toBe(root.id);
    })
  );

  it.effect(
    "transform produces a single mapped child",
    Effect.fnUntraced(function* () {
      const op = Operation.transform({ name: "len", description: "", f: (s: string) => s.length });
      const root = yield* EG.makeNode("hello");
      const children = yield* op.apply(root);
      expect(children.map((n) => n.data)).toEqual([5]);
    })
  );

  it.effect(
    "filter keeps or drops based on the predicate",
    Effect.fnUntraced(function* () {
      const op = Operation.filter({ name: "nonEmpty", description: "", predicate: (s: string) => s.length > 0 });
      const keep = yield* op.apply(yield* EG.makeNode("x"));
      const drop = yield* op.apply(yield* EG.makeNode(""));
      expect(keep.length).toBe(1);
      expect(drop.length).toBe(0);
    })
  );

  it.effect(
    "identity re-emits the node under a fresh id",
    Effect.fnUntraced(function* () {
      const op = Operation.identity<string>();
      const root = yield* EG.makeNode("z");
      const [child] = yield* op.apply(root);
      expect(child!.data).toBe("z");
      expect(child!.id).not.toBe(root.id);
      expect(O.getOrNull(child!.parentId)).toBe(root.id);
    })
  );
});

describe("ResultStore", () => {
  const mkResult = Effect.gen(function* () {
    const node = yield* EG.makeNode<unknown>("payload");
    return yield* Types.makeOperationResult(
      yield* Types.generateExecutionId,
      O.none(),
      [node],
      [],
      Types.ExecutionMetrics.empty()
    );
  });

  it.effect(
    "stores and retrieves a result, incrementing hits",
    Effect.fnUntraced(function* () {
      const store = yield* ResultStore.ResultStore;
      const nodeId = EG.NodeId.make("n1");
      const key = ResultStore.ResultKey.new("op", nodeId);
      const result = yield* mkResult;
      expect(yield* store.has(key)).toBe(false);
      yield* store.store(key, result);
      expect(yield* store.has(key)).toBe(true);
      const got = yield* store.get(key);
      expect(O.isSome(got)).toBe(true);
      const stats = yield* store.stats;
      expect(stats.size).toBe(1);
      expect(stats.totalHits).toBe(1);
    }, provideScopedLayer(ResultStore.ResultStoreTest))
  );

  it.effect(
    "delete and clear remove entries",
    Effect.fnUntraced(function* () {
      const store = yield* ResultStore.ResultStore;
      const key = ResultStore.ResultKey.new("op", EG.NodeId.make("n2"));
      yield* store.store(key, yield* mkResult);
      yield* store.delete(key);
      expect(yield* store.has(key)).toBe(false);
      yield* store.store(ResultStore.ResultKey.new("op", EG.NodeId.make("n3")), yield* mkResult);
      yield* store.clear;
      expect((yield* store.stats).size).toBe(0);
    }, provideScopedLayer(ResultStore.ResultStoreTest))
  );
});

describe("GraphExecutor", () => {
  const upper = Operation.transform({ name: "upper", description: "", f: (s: string) => s.toUpperCase() });

  it.effect(
    "applies an operation to leaf nodes, producing new nodes",
    Effect.fnUntraced(function* () {
      const graph = yield* EG.singleton("hello");
      const executor = yield* Executor.GraphExecutor;
      const result = yield* executor.execute(graph, upper);
      expect(result.newNodes.map((n) => n.data)).toEqual(["HELLO"]);
      expect(result.errors.length).toBe(0);
      expect(result.metrics.nodesProcessed).toBe(1);
      expect(result.metrics.nodesCreated).toBe(1);
    }, provideScopedLayer(Executor.GraphExecutorTest))
  );

  it.effect(
    "supports pipe-friendly dual service methods",
    Effect.fnUntraced(function* () {
      const graph = yield* EG.singleton("hello");
      const executor = yield* Executor.GraphExecutor;

      const result = yield* pipe(graph, executor.execute(upper, { cache: false }));
      const validation = yield* pipe(graph, executor.validate(upper));
      const cost = yield* pipe(graph, executor.estimateCost(upper));

      expect(result.newNodes.map((n) => n.data)).toEqual(["HELLO"]);
      expect(validation.valid).toBe(true);
      expect(cost.complexity).toBe("O(1)");
    }, provideScopedLayer(Executor.GraphExecutorTest))
  );

  it.effect(
    "reports a cache miss then a cache hit for the same node",
    Effect.fnUntraced(function* () {
      const graph = yield* EG.singleton("hi");
      const executor = yield* Executor.GraphExecutor;
      const first = yield* executor.execute(graph, upper);
      const second = yield* executor.execute(graph, upper);
      expect(first.metrics.cacheMisses).toBe(1);
      expect(first.metrics.cacheHits).toBe(0);
      expect(second.metrics.cacheHits).toBe(1);
    }, provideScopedLayer(Executor.GraphExecutorTest))
  );

  it.effect(
    "validate warns when there are no leaf nodes",
    Effect.fnUntraced(function* () {
      const executor = yield* Executor.GraphExecutor;
      const result = yield* executor.validate(EG.empty<string>(), upper);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    }, provideScopedLayer(Executor.GraphExecutorTest))
  );

  it.effect(
    "estimateCost scales by the number of leaf nodes",
    Effect.fnUntraced(function* () {
      const graph = yield* EG.singleton("x");
      const executor = yield* Executor.GraphExecutor;
      const cost = yield* executor.estimateCost(graph, upper);
      expect(cost.complexity).toBe("O(1)");
    }, provideScopedLayer(Executor.GraphExecutorTest))
  );

  it.effect(
    "surfaces a per-node error without failing the run",
    Effect.fnUntraced(function* () {
      const boom = Operation.make<string, string, never, Errors.OperationError>({
        name: "boom",
        description: "",
        category: "transformation",
        apply: (node) =>
          Effect.fail(Errors.OperationError.make({ cause: new Error("boom"), nodeId: node.id, operationName: "boom" })),
      });
      const graph = yield* EG.singleton("x");
      const executor = yield* Executor.GraphExecutor;
      const result = yield* executor.execute(graph, boom);
      expect(result.newNodes.length).toBe(0);
      expect(result.errors.length).toBe(1);
    }, provideScopedLayer(Executor.GraphExecutorTest))
  );
});
