import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CyclicDependencyError, DependencyGraph } from "../../effected/workspaces/DependencyGraph.ts";
import { WorkspacePackage } from "../../effected/workspaces/WorkspacePackage.ts";

const pkg = (name: string, dependencies: Record<string, string> = {}) => WorkspacePackage.make({
  name, version: "1.0.0", path: `/repo/${name}`, packageJsonPath: `/repo/${name}/package.json`,
  relativePath: name, workspaceRoot: "/repo", dependencies,
});

describe("DependencyGraph traversal coverage", () => {
  it.effect("reports missing dependents with the available names", () => Effect.gen(function* () {
    const graph = DependencyGraph.make({ packages: [pkg("a")] });
    const missing = yield* Effect.flip(graph.dependentsOf("missing"));
    assert.strictEqual(missing.name, "missing");
    assert.deepStrictEqual(missing.available, ["a"]);
    assert.strictEqual(CyclicDependencyError.make({ cycle: ["a", "b"] }).message,
      "Cyclic workspace dependencies among: a, b");
  }));
  it.effect("coalesces duplicate traversal seeds and converging dependencies", () => Effect.gen(function* () {
    const graph = DependencyGraph.make({ packages: [pkg("a", { b: "*", c: "*" }), pkg("b", { d: "*" }), pkg("c", { d: "*" }), pkg("d")] });
    assert.deepStrictEqual(yield* graph.affectedBy(["d", "d", "b"]), ["a", "b", "c", "d"]);
    assert.deepStrictEqual(yield* graph.sortSubset(["a", "a", "b"]), ["d", "b", "c", "a"]);
    assert.isFalse(graph.hasCycle);
    assert.include(graph.toMermaid(), "flowchart TD");
    assert.deepStrictEqual(yield* graph.sortSubset([]), []);
  }));
});
