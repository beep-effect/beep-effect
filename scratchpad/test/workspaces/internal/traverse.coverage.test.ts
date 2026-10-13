import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Traversal, badMaxDepthMessage, isPruned, isValidMaxDepth, joinRelative } from "../../../effected/workspaces/internal/traverse.ts";

it.effect("traversal drains FIFO, enforces bounds, and reports the root in diagnostics", () => Effect.sync(() => {
  const traversal = new Traversal("", "/repo", 1, 1);
  const root = { relative: "", absolute: "/repo", depth: 0 };
  assert.deepStrictEqual(traversal.next(), root);
  assert.isTrue(traversal.admits(root));
  traversal.push(root, "a", "/repo/a");
  traversal.push(root, "b", "/repo/b");
  assert.deepStrictEqual(traversal.next(), { relative: "a", absolute: "/repo/a", depth: 1 });
  assert.deepStrictEqual(traversal.next(), { relative: "b", absolute: "/repo/b", depth: 1 });
  assert.isUndefined(traversal.next());
  assert.isFalse(traversal.admits({ relative: "a", absolute: "/repo/a", depth: 1 }));
  assert.isUndefined(traversal.charge());
  assert.deepStrictEqual(traversal.charge(), { kind: "budgetExceeded", detail: "visited more than 1 directories" });
  assert.deepStrictEqual(traversal.depthStop(), { kind: "depthExceeded", detail: 'descended past 1 levels below ""' });
  assert.strictEqual(joinRelative("", "a"), "a");
  assert.strictEqual(joinRelative("b")("a"), "a/b");
  assert.isTrue(isPruned("node_modules"));
  assert.isFalse(isPruned("packages"));
  for (const depth of [0, -1, 1.5, NaN, Infinity]) assert.isFalse(isValidMaxDepth(depth));
  assert.isTrue(isValidMaxDepth(1));
  assert.strictEqual(badMaxDepthMessage(NaN), "maxDepth must be a positive integer, received NaN");
}));
