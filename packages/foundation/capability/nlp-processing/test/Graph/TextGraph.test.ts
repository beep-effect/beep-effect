import { bfs, dfs, singleton, toArray } from "@beep/nlp-processing/Graph/TextGraph";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Graph } from "effect";

describe("TextGraph traversal", () => {
  it.effect(
    "treats an explicit undefined start as the curried default form",
    Effect.fnUntraced(function* () {
      const graph = yield* singleton("Hello.", "document");

      expect(toArray(graph)).toHaveLength(1);
      expect(dfs(undefined)).toBeTypeOf("function");
      expect(bfs(undefined)).toBeTypeOf("function");
      expect(Array.from(Graph.values(dfs(undefined)(graph)))).toEqual(Array.from(Graph.values(dfs(graph))));
      expect(Array.from(Graph.values(bfs(undefined)(graph)))).toEqual(Array.from(Graph.values(bfs(graph))));
    })
  );
});
