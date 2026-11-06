import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CyclicDependencyError, DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decode(encode(x)) equals x and never fails`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("DependencyGraph property floor", () => {
  roundTrips("DependencyGraph", DependencyGraph);
  roundTrips("CyclicDependencyError", CyclicDependencyError);
});

it.effect.prop(
  "Mermaid rendering is stable after caching and schema serialization",
  [Arbitrary.schema(DependencyGraph)],
  ([graph]) =>
    Effect.gen(function* () {
      const text = graph.toMermaid();
      assert.strictEqual(graph.toMermaid(), text);
      // README: node and edge ordering must be independent of declaration order.
      assert.strictEqual(DependencyGraph.make({ packages: A.reverse(graph.packages) }).toMermaid(), text);
      const argument = S.decodeEffect(DependencyGraph);
      const value2 = yield* S.encodeEffect(DependencyGraph)(graph);
      const decoded = yield* argument(value2);
      assert.strictEqual(decoded.toMermaid(), text);
    }),
  runs
);
