import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { insertAfter, makeInlineNode, unlink } from "../../../effected/markdown/internal/inlineNode.ts";

it.effect("inserts and unlinks siblings with no parent container", () => Effect.sync(() => {
  const first = makeInlineNode("text", 0, 1, "a");
  const second = makeInlineNode("text", 1, 2, "b");
  insertAfter(first, second);
  assert.strictEqual(first.next, second);
  assert.strictEqual(second.prev, first);
  assert.strictEqual(second.parent, undefined);
  unlink(first);
  assert.strictEqual(second.prev, undefined);
  unlink(second);
  assert.strictEqual(second.next, undefined);
}));
