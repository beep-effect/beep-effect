import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { type MarkdownNode, Root } from "../../effected/markdown/MarkdownNode.ts";
import { MarkdownVisitor, MarkdownVisitorEvent } from "../../effected/markdown/MarkdownVisitor.ts";
const runs = { arbitrary: fcRuns(100) };
const countNodes = (node: MarkdownNode): number => {
  const children: ReadonlyArray<MarkdownNode> = "children" in node ? node.children : [];
  return 1 + A.reduce(children, 0, (count, child) => count + countNodes(child));
};

describe("MarkdownVisitor traversal properties", () => {
  it.effect.prop("every generated tree has paired enter/exit events with stable paths across subscriptions", [Arbitrary.schema(Root)], ([root]) => Effect.gen(function* () {
    const stream = MarkdownVisitor.visit(root);
    const events = yield* Stream.runCollect(stream);
    assert.deepStrictEqual(yield* Stream.runCollect(stream), events);
    const entered = A.filter(events, MarkdownVisitorEvent.$is("Enter"));
    const exited = A.filter(events, MarkdownVisitorEvent.$is("Exit"));
    assert.strictEqual(entered.length, countNodes(root));
    assert.strictEqual(exited.length, entered.length);
    assert.deepStrictEqual(A.filter(events, MarkdownVisitorEvent.$is("Error")), []);
    for (const enter of entered) {
      assert.strictEqual(enter.depth, enter.path.length);
      const exit = A.findFirst(exited, (event) => event.node === enter.node);
      assertSome(exit, MarkdownVisitorEvent.Exit({ node: enter.node, path: enter.path, depth: enter.depth }));
    }
    assert.deepStrictEqual(yield* Stream.runCollect(Stream.take(stream, 1)), [MarkdownVisitorEvent.Enter({ node: root, path: [], depth: 0 })]);
  }), runs);
});
