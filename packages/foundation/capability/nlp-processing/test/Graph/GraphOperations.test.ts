import * as EG from "@beep/nlp-processing/Graph/EffectGraph";
import { Errors, Executor, Operation, ResultStore, Types } from "@beep/nlp-processing/Graph/GraphOperations";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeResultStoreStoredResult = S.decodeEffect(ResultStore.StoredResult);
const encodeResultStoreStoredResult = S.encodeEffect(ResultStore.StoredResult);
const isResultStoreAnyOperationResult = S.is(ResultStore.AnyOperationResult);
const isResultStoreStoredResult = S.is(ResultStore.StoredResult);

const finiteNonNegativeMillis = (duration: Duration.Duration): Duration.Duration => {
  const millis = Duration.toMillis(duration);
  return Number.isFinite(millis) ? Duration.millis(Math.min(Math.abs(Math.trunc(millis)), 86_400_000)) : Duration.zero;
};

const arbMetrics: Arbitrary.Arbitrary<Types.ExecutionMetrics> = Arbitrary.schema(Types.ExecutionMetrics).pipe(
  Arbitrary.map((metrics) =>
    Types.ExecutionMetrics.make({
      ...metrics,
      duration: finiteNonNegativeMillis(metrics.duration),
    })
  )
);
const metricsEqual = S.toEquivalence(Types.ExecutionMetrics);

const assertSchemaRoundTrip = Effect.fn("assertSchemaRoundTrip")(function* <
  Schema extends S.Codec<unknown, unknown, never, never>,
>(schema: Schema, value: Schema["Type"], label: string) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  expect(S.toEquivalence(schema)(decoded, value), label).toBe(true);
});

describe("ExecutionMetrics monoid laws", () => {
  it.effect.prop(
    "round-trips schema-derived metrics through encode/decode",
    { ExecutionMetrics: Arbitrary.schema(Types.ExecutionMetrics) },
    (values) => assertSchemaRoundTrip(Types.ExecutionMetrics, values.ExecutionMetrics, "Types.ExecutionMetrics"),
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "satisfies left identity: empty ⊕ x = x",
    [arbMetrics],
    ([x]) => {
      expect(metricsEqual(Types.ExecutionMetrics.combine(Types.ExecutionMetrics.empty(), x), x)).toBe(true);
    },
    { arbitrary: fcRuns() }
  );

  it.prop(
    "satisfies right identity: x ⊕ empty = x",
    [arbMetrics],
    ([x]) => {
      expect(metricsEqual(Types.ExecutionMetrics.combine(x, Types.ExecutionMetrics.empty()), x)).toBe(true);
    },
    { arbitrary: fcRuns() }
  );

  it.prop(
    "satisfies associativity: (x ⊕ y) ⊕ z = x ⊕ (y ⊕ z)",
    [arbMetrics, arbMetrics, arbMetrics],
    ([x, y, z]) => {
      expect(
        metricsEqual(
          Types.ExecutionMetrics.combine(Types.ExecutionMetrics.combine(x, y), z),
          Types.ExecutionMetrics.combine(x, Types.ExecutionMetrics.combine(y, z))
        )
      ).toBe(true);
    },
    { arbitrary: fcRuns() }
  );
});

describe("OperationCost", () => {
  it.effect.prop(
    "round-trips schema-derived operation costs through encode/decode",
    { OperationCost: Arbitrary.schema(Types.OperationCost) },
    (values) => assertSchemaRoundTrip(Types.OperationCost, values.OperationCost, "Types.OperationCost"),
    { arbitrary: fcRuns(50) }
  );

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
  it.effect.prop(
    "round-trips schema-derived ids through encode/decode",
    { ExecutionId: Arbitrary.schema(Types.ExecutionId) },
    (values) => assertSchemaRoundTrip(Types.ExecutionId, values.ExecutionId, "Types.ExecutionId"),
    { arbitrary: fcRuns(50) }
  );

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
  const mkResultFixture = Effect.gen(function* () {
    const node = yield* EG.makeNode<unknown>("payload");
    const result = yield* Types.makeOperationResult(yield* Types.generateExecutionId, {
      originalGraph: O.none(),
      newNodes: [node],
      errors: [],
      metrics: Types.ExecutionMetrics.empty(),
    });
    return {
      key: ResultStore.ResultKey.new("op", node.id),
      result,
    };
  });

  const mkResult = Effect.map(mkResultFixture, ({ result }) => result);

  it.effect(
    "round-trips schema-backed cache entries with type-erased operation results",
    Effect.fnUntraced(function* () {
      const { key, result } = yield* mkResultFixture;
      const stored = ResultStore.StoredResult.make({
        hits: NonNegativeInt.make(0),
        key,
        result,
        timestamp: result.timestamp,
      });
      const encoded = yield* encodeResultStoreStoredResult(stored);
      const decoded = yield* decodeResultStoreStoredResult(encoded);

      expect(isResultStoreStoredResult(decoded)).toBe(true);
      expect(isResultStoreAnyOperationResult(decoded.result)).toBe(true);
      expect(decoded.result.executionId).toBe(result.executionId);
    })
  );

  it.layer(ResultStore.ResultStoreTest)("stores and retrieves a result, incrementing hits", (it) => {
    it.effect(
      "stores and retrieves a result, incrementing hits",
      Effect.fnUntraced(function* () {
        expect((yield* (yield* ResultStore.ResultStore).stats).size).toBe(0);
        const store = yield* ResultStore.ResultStore;
        const nodeId = EG.NodeId.make("n1");
        const key = ResultStore.ResultKey.new("op", nodeId);
        const result = yield* mkResult;
        expect(yield* store.has(key)).toBe(false);
        yield* store.store(key, result);
        expect(yield* store.has(key)).toBe(true);
        const got = yield* store.get(key);
        pipe(got, O.isSome, assertTrue);
        const stats = yield* store.stats;
        expect(stats.size).toBe(1);
        expect(stats.totalHits).toBe(1);
      })
    );
  });

  it.layer(ResultStore.ResultStoreTest)("delete and clear remove entries", (it) => {
    it.effect(
      "delete and clear remove entries",
      Effect.fnUntraced(function* () {
        expect((yield* (yield* ResultStore.ResultStore).stats).size).toBe(0);
        const store = yield* ResultStore.ResultStore;
        const key = ResultStore.ResultKey.new("op", EG.NodeId.make("n2"));
        yield* store.store(key, yield* mkResult);
        yield* store.delete(key);
        expect(yield* store.has(key)).toBe(false);
        yield* store.store(ResultStore.ResultKey.new("op", EG.NodeId.make("n3")), yield* mkResult);
        yield* store.clear;
        expect((yield* store.stats).size).toBe(0);
      })
    );
  });
});

describe("GraphExecutor", () => {
  const upper = Operation.transform({ name: "upper", description: "", f: (s: string) => s.toUpperCase() });

  it.layer(Executor.GraphExecutorTest)("applies an operation to leaf nodes, producing new nodes", (it) => {
    it.effect(
      "applies an operation to leaf nodes, producing new nodes",
      Effect.fnUntraced(function* () {
        expect((yield* (yield* ResultStore.ResultStore).stats).size).toBe(0);
        const graph = yield* EG.singleton("hello");
        const executor = yield* Executor.GraphExecutor;
        const result = yield* executor.execute(graph, upper);
        expect(result.newNodes.map((n) => n.data)).toEqual(["HELLO"]);
        expect(result.errors.length).toBe(0);
        expect(result.metrics.nodesProcessed).toBe(1);
        expect(result.metrics.nodesCreated).toBe(1);
      })
    );
  });

  it.layer(Executor.GraphExecutorTest)(
    "clamps an over-large parallel concurrency and still applies the operation",
    (it) => {
      it.effect(
        "clamps an over-large parallel concurrency and still applies the operation",
        Effect.fnUntraced(function* () {
          expect((yield* (yield* ResultStore.ResultStore).stats).size).toBe(0);
          const graph = yield* EG.singleton("hello");
          const executor = yield* Executor.GraphExecutor;
          // Far above MAX_PARALLEL_CONCURRENCY, so this exercises the clamp rather
          // than the sequential default.
          const result = yield* executor.execute(graph, upper, {
            strategy: Types.ExecutionStrategy.Parallel(1_000),
          });

          expect(result.newNodes.map((n) => n.data)).toEqual(["HELLO"]);
          expect(result.errors.length).toBe(0);
        })
      );
    }
  );

  it.layer(Executor.GraphExecutorTest)("supports pipe-friendly dual service methods", (it) => {
    it.effect(
      "supports pipe-friendly dual service methods",
      Effect.fnUntraced(function* () {
        expect((yield* (yield* ResultStore.ResultStore).stats).size).toBe(0);
        const graph = yield* EG.singleton("hello");
        const executor = yield* Executor.GraphExecutor;

        const result = yield* pipe(graph, executor.execute(upper, { cache: false }));
        const validation = yield* pipe(graph, executor.validate(upper));
        const cost = yield* pipe(graph, executor.estimateCost(upper));

        expect(result.newNodes.map((n) => n.data)).toEqual(["HELLO"]);
        expect(validation.valid).toBe(true);
        expect(cost.complexity).toBe("O(1)");
      })
    );
  });

  it.layer(Executor.GraphExecutorTest)("reports a cache miss then a cache hit for the same node", (it) => {
    it.effect(
      "reports a cache miss then a cache hit for the same node",
      Effect.fnUntraced(function* () {
        expect((yield* (yield* ResultStore.ResultStore).stats).size).toBe(0);
        const graph = yield* EG.singleton("hi");
        const executor = yield* Executor.GraphExecutor;
        const first = yield* executor.execute(graph, upper);
        const second = yield* executor.execute(graph, upper);
        expect(first.metrics.cacheMisses).toBe(1);
        expect(first.metrics.cacheHits).toBe(0);
        expect(second.metrics.cacheHits).toBe(1);
      })
    );
  });

  it.layer(Executor.GraphExecutorTest)("validate warns when there are no leaf nodes", (it) => {
    it.effect(
      "validate warns when there are no leaf nodes",
      Effect.fnUntraced(function* () {
        expect((yield* (yield* ResultStore.ResultStore).stats).size).toBe(0);
        const executor = yield* Executor.GraphExecutor;
        const result = yield* executor.validate(EG.empty<string>(), upper);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
      })
    );
  });

  it.layer(Executor.GraphExecutorTest)("estimateCost scales by the number of leaf nodes", (it) => {
    it.effect(
      "estimateCost scales by the number of leaf nodes",
      Effect.fnUntraced(function* () {
        expect((yield* (yield* ResultStore.ResultStore).stats).size).toBe(0);
        const graph = yield* EG.singleton("x");
        const executor = yield* Executor.GraphExecutor;
        const cost = yield* executor.estimateCost(graph, upper);
        expect(cost.complexity).toBe("O(1)");
        const priced = Operation.make({
          ...upper,
          name: "priced-upper",
          estimateCost: () =>
            Effect.succeed(
              Types.OperationCost.make({
                complexity: "O(n)",
                estimatedTime: Duration.millis(3),
                memoryCost: NonNegativeInt.make(2),
                tokenCost: NonNegativeInt.make(5),
              })
            ),
        });
        const parent = yield* EG.makeNode("parent");
        const firstLeaf = yield* EG.makeNode("a", O.some(parent.id));
        const secondLeaf = yield* EG.makeNode("b", O.some(parent.id));
        const twoLeaves = EG.addNode(EG.addNode(EG.addNode(EG.empty<string>(), parent), firstLeaf), secondLeaf);
        const singleCost = yield* executor.estimateCost(graph, priced);
        const multipleCost = yield* executor.estimateCost(twoLeaves, priced);
        expect(EG.getChildren(twoLeaves, parent.id)).toHaveLength(2);
        expect(EG.getChildren(twoLeaves, firstLeaf.id)).toHaveLength(0);
        expect(EG.getChildren(twoLeaves, secondLeaf.id)).toHaveLength(0);
        expect(Duration.toMillis(singleCost.estimatedTime)).toBe(3);
        expect(singleCost.tokenCost).toBe(5);
        expect(Duration.toMillis(multipleCost.estimatedTime)).toBe(6);
        expect(multipleCost.tokenCost).toBe(10);
      })
    );
  });

  it.layer(Executor.GraphExecutorTest)("surfaces a per-node error without failing the run", (it) => {
    it.effect(
      "surfaces a per-node error without failing the run",
      Effect.fnUntraced(function* () {
        expect((yield* (yield* ResultStore.ResultStore).stats).size).toBe(0);
        const boom = Operation.make<string, string, never, Errors.OperationError>({
          name: "boom",
          description: "",
          category: "transformation",
          apply: (node) =>
            Effect.fail(
              Errors.OperationError.make({ cause: new Error("boom"), nodeId: node.id, operationName: "boom" })
            ),
        });
        const graph = yield* EG.singleton("x");
        const executor = yield* Executor.GraphExecutor;
        const result = yield* executor.execute(graph, boom);
        expect(result.newNodes.length).toBe(0);
        expect(result.errors.length).toBe(1);
      })
    );
  });
});
