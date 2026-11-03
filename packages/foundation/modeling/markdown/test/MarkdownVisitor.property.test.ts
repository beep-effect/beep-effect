import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Root } from "@beep/markdown/MarkdownNode";
import { MarkdownVisitor, MarkdownVisitorEvent } from "@beep/markdown/MarkdownVisitor";
import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import type { MarkdownPath } from "@beep/markdown/MarkdownEdit";
import type { MarkdownNode } from "@beep/markdown/MarkdownNode";

const runs = { arbitrary: fcRuns(100) };

// The walk hands out its nodes by reference, so expected events are plain
// values of the union type: a case `make` would validate and copy the node.
const visitorEvent = (
  _tag: "Enter" | "Exit",
  node: MarkdownNode,
  path: MarkdownPath,
  depth: number
): MarkdownVisitorEvent => ({ _tag, node, path, depth });
const countNodes = (node: MarkdownNode): number => {
  const children: ReadonlyArray<MarkdownNode> = "children" in node ? node.children : [];
  return 1 + A.reduce(children, 0, (count, child) => count + countNodes(child));
};

describe("MarkdownVisitor traversal properties", () => {
  it.effect.prop(
    "every generated tree has paired enter/exit events with stable paths across subscriptions",
    [Arbitrary.schema(Root)],
    ([root]) =>
      Effect.gen(function* () {
        const stream = MarkdownVisitor.visit(root);
        const events = yield* Stream.runCollect(stream);
        const resultCollect = yield* Stream.runCollect(stream);
        assert.deepStrictEqual(resultCollect, events);
        const entered = A.filter(events, MarkdownVisitorEvent.guards.Enter);
        const exited = A.filter(events, MarkdownVisitorEvent.guards.Exit);
        assert.strictEqual(entered.length, countNodes(root));
        assert.strictEqual(exited.length, entered.length);
        assert.deepStrictEqual(A.filter(events, MarkdownVisitorEvent.guards.Error), []);
        for (const enter of entered) {
          assert.strictEqual(enter.depth, enter.path.length);
          const exit = A.findFirst(exited, (event) => event.node === enter.node);
          assertSome(exit, visitorEvent("Exit", enter.node, enter.path, enter.depth));
        }
        const resultCollect1 = yield* Stream.runCollect(Stream.take(stream, 1));
        assert.deepStrictEqual(resultCollect1, [visitorEvent("Enter", root, [], 0)]);
      }),
    runs
  );
});
