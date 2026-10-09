import { bfs, dfs, singleton, toArray } from "@beep/nlp-processing/Graph/TextGraph";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Graph from "effect/Graph";

describe("TextGraph traversal", () => {
  it.effect(
    "treats an explicit undefined start as the curried default form",
    Effect.fnUntraced(function* () {
      const graph = yield* singleton("Hello.", "document");

      expect(toArray(graph)).toHaveLength(1);
      expect(dfs(undefined)).toBeTypeOf("function");
      expect(bfs(undefined)).toBeTypeOf("function");
      const curriedDepthFirst = dfs(undefined)(graph);
      const directDepthFirst = dfs(graph);
      expect(Array.from(Graph.values(curriedDepthFirst))).toEqual(Array.from(Graph.values(directDepthFirst)));
      const curriedBreadthFirst = bfs(undefined)(graph);
      const directBreadthFirst = bfs(graph);
      expect(Array.from(Graph.values(curriedBreadthFirst))).toEqual(Array.from(Graph.values(directBreadthFirst)));
    })
  );
});
