import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { MAX_NESTING_DEPTH } from "../../effected/markdown/internal/limits.ts";
import { Blockquote, type FlowContent, Paragraph, Root, Text } from "../../effected/markdown/MarkdownNode.ts";
import { MarkdownVisitor } from "../../effected/markdown/MarkdownVisitor.ts";

describe("MarkdownVisitor coverage", () => {
  it.effect("terminates at the depth diagnostic before visiting later siblings", () => Effect.gen(function* () {
    let node: FlowContent = Paragraph.make({ children: [Text.make({ value: "deep" })] });
    for (let depth = 0; depth < MAX_NESTING_DEPTH; depth++) node = Blockquote.make({ children: [node] });
    const root = Root.make({ children: [node, Paragraph.make({ children: [Text.make({ value: "later" })] })] });
    const stream = MarkdownVisitor.visit(root);
    const events = yield* Stream.runCollect(stream);
    const last = events[events.length - 1];
    assert.strictEqual(last?._tag, "Error");
    if (last?._tag === "Error") {
      assert.strictEqual(last.depth, MAX_NESTING_DEPTH + 1);
      assert.strictEqual(last.diagnostic.code, "NestingDepthExceeded");
    }
    assert.strictEqual(events.length, MAX_NESTING_DEPTH + 2);
    assert.deepStrictEqual(yield* Stream.runCollect(stream), events);
  }));
});
