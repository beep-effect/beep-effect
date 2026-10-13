import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { LayerPolicy } from "../../effected/workspaces/LayerPolicy.ts";
import { LayerEdge, LayeringReport, WorkspaceLayering } from "../../effected/workspaces/WorkspaceLayering.ts";

it.effect("renders missing declarations and required edges in report order", () => Effect.gen(function* () {
  const edge = LayerEdge.make({ from: "app", to: "core", field: "dependencies" });
  const report = LayeringReport.make({ duplicates: ["dup"], unclassified: ["unknown"], offenders: [{ edge, reason: "upward" }], cycle: O.some(["app", "core"]), missingDeclared: ["absent"], missingRequiredEdges: ["app -> missing"], edgeCount: 1 });
  assert.deepStrictEqual(report.violations, ["classified more than once: dup", "not classified by the policy: unknown", "upward: app -> core (dependencies)", "dependency cycle among: app, core", "declared but not in the workspace: absent", "required edge missing: app -> missing"]);
}));

it.effect("cycle construction handles self edges, absent graph names and real cycles", () => Effect.gen(function* () {
  const edge = (from: string, to: string) => LayerEdge.make({ from, to, field: "dependencies" });
  const policy = LayerPolicy.make({ layers: [], tooling: [], unconstrained: ["*"] });
  const self = WorkspaceLayering.check({ names: [], edges: [edge("self", "self")] }, policy);
  assertNone(self.cycle);
  assert.deepStrictEqual(self.violations, []);
  const cyclic = WorkspaceLayering.check({ names: [], edges: [edge("a", "b"), edge("b", "a")] }, policy);
  assertSome(cyclic.cycle, ["a", "b"]);
  assert.deepStrictEqual(cyclic.violations, ["dependency cycle among: a, b"]);
}));
