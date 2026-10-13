import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { DependencyGraph, CyclicDependencyError } from "../../effected/workspaces/DependencyGraph.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x and never fails`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("DependencyGraph property floor", () => {
  roundTrips("DependencyGraph", DependencyGraph);
  roundTrips("CyclicDependencyError", CyclicDependencyError);
});

it.effect.prop("Mermaid rendering is stable after caching and schema serialization", [Arbitrary.schema(DependencyGraph)], ([graph]) =>
  Effect.gen(function* () {
    const text = graph.toMermaid();
    assert.strictEqual(graph.toMermaid(), text);
    // README: node and edge ordering must be independent of declaration order.
    assert.strictEqual(DependencyGraph.make({ packages: A.reverse(graph.packages) }).toMermaid(), text);
    const decoded = yield* S.decodeEffect(DependencyGraph)(yield* S.encodeEffect(DependencyGraph)(graph));
    assert.strictEqual(decoded.toMermaid(), text);
  }), runs);
