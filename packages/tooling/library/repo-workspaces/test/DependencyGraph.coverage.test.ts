import { CyclicDependencyError, DependencyGraph } from "@beep/repo-workspaces/DependencyGraph";
import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

const pkg = (name: string, dependencies: Record<string, string> = {}) =>
  WorkspacePackage.make({
    name,
    version: "1.0.0",
    path: `/repo/${name}`,
    packageJsonPath: `/repo/${name}/package.json`,
    relativePath: name,
    workspaceRoot: "/repo",
    dependencies,
  });

describe("DependencyGraph traversal coverage", () => {
  it.effect("reports missing dependents with the available names", () =>
    Effect.gen(function* () {
      const graph = DependencyGraph.make({ packages: [pkg("a")] });
      const missing = yield* Effect.flip(graph.dependentsOf("missing"));
      assert.strictEqual(missing.packageName, "missing");
      assert.deepStrictEqual(missing.available, ["a"]);
      assert.strictEqual(
        CyclicDependencyError.make({ cycle: ["a", "b"] }).message,
        "Cyclic workspace dependencies among: a, b"
      );
    })
  );
  it.effect("coalesces duplicate traversal seeds and converging dependencies", () =>
    Effect.gen(function* () {
      const graph = DependencyGraph.make({
        packages: [pkg("a", { b: "*", c: "*" }), pkg("b", { d: "*" }), pkg("c", { d: "*" }), pkg("d")],
      });
      const affectedBy1 = yield* graph.affectedBy(["d", "d", "b"]);
      assert.deepStrictEqual(affectedBy1, ["a", "b", "c", "d"]);
      const sortSubset2 = yield* graph.sortSubset(["a", "a", "b"]);
      assert.deepStrictEqual(sortSubset2, ["d", "b", "c", "a"]);
      assert.isFalse(graph.hasCycle);
      assert.include(graph.toMermaid(), "flowchart TD");
      const sortSubset3 = yield* graph.sortSubset([]);
      assert.deepStrictEqual(sortSubset3, []);
    })
  );
});
