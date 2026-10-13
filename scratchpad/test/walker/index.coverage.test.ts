import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Public from "../../effected/walker/index.ts";
import { DescendError, DescendResult, UnreadableDirectory, descend } from "../../effected/walker/Descend.ts";
import { CompileAndExpandOptions, GlobExpansionError, compileAndExpand } from "../../effected/walker/Expand.ts";
import { AscendOptions, Walker } from "../../effected/walker/Walker.ts";

it.effect("the entrypoint exposes the same traversal operations and schemas as the concept modules", () => Effect.sync(() => {
  assert.strictEqual(Public.DescendError, DescendError);
  assert.strictEqual(Public.DescendResult, DescendResult);
  assert.strictEqual(Public.UnreadableDirectory, UnreadableDirectory);
  assert.strictEqual(Public.descend, descend);
  assert.strictEqual(Public.CompileAndExpandOptions, CompileAndExpandOptions);
  assert.strictEqual(Public.GlobExpansionError, GlobExpansionError);
  assert.strictEqual(Public.compileAndExpand, compileAndExpand);
  assert.strictEqual(Public.AscendOptions, AscendOptions);
  assert.strictEqual(Public.Walker, Walker);
}));
