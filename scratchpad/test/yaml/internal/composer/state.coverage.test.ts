import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { composeFlowMap, composeFlowSeq } from "../../../../effected/yaml/internal/composer/flow.ts";
import { clearMeta, commentProps, createState, enterNesting, exitNesting, getLineStarts, hasMeta, lineCol, MAX_NESTING_DEPTH } from "../../../../effected/yaml/internal/composer/state.ts";
import type { NodeMeta } from "../../../../effected/yaml/internal/composer/state.ts";

describe("composer state coverage", () => {
  it.effect("metadata preserves empty strings and false while consumed keys become absent", () => Effect.sync(() => {
    for (const meta of [{}, { anchor: "" }, { tag: "" }, { comment: "" }]) {
      const pending: NodeMeta = meta;
      assert.strictEqual(hasMeta(pending), Object.keys(pending).length > 0);
      clearMeta(pending);
      assert.deepStrictEqual(pending, {});
      assert.strictEqual(hasMeta(pending), false);
    }
    assert.deepStrictEqual(commentProps({}), {});
    assert.deepStrictEqual(commentProps({ commentBefore: "", comment: "tail", spaceBefore: false }), { commentBefore: "", comment: "tail", spaceBefore: false });
  }));
  it.effect("line positions clamp offsets and ignore only a line-leading BOM", () => Effect.sync(() => {
    assert.deepStrictEqual(getLineStarts("a\nb\n"), [0, 2, 4]);
    assert.strictEqual(getLineStarts("a\nb\n"), getLineStarts("a\nb\n"));
    for (const [offset, line, column] of [[-1, 0, 0], [0, 0, 0], [1, 0, 0], [3, 0, 2], [4, 1, 0], [5, 1, 0], [99, 1, 1]]) {
      if (offset !== undefined && line !== undefined && column !== undefined) assert.deepStrictEqual(lineCol("\uFEFFab\n\uFEFFc", offset), { line, column });
    }
    assert.deepStrictEqual(lineCol("a\nb\nc", 0), { line: 0, column: 0 });
  }));
  it.effect("nesting rejection records one fatal diagnostic and successful entries balance", () => Effect.sync(() => {
    const state = createState("[]", { composeFlowMap, composeFlowSeq }, { strict: false, uniqueKeys: false, maxAliasCount: 0 });
    const cst = { type: "flow-seq", source: "[]", offset: 7, length: 2 } as const;
    assert.deepStrictEqual(state.options, { strict: false, uniqueKeys: false, maxAliasCount: 0 });
    assert.strictEqual(enterNesting(state, cst), true);
    exitNesting(state);
    assert.strictEqual(state.depth, 0);
    state.depth = MAX_NESTING_DEPTH;
    state.errors.push({ code: "UnexpectedToken", message: "prior", offset: 0, length: 1 });
    assert.strictEqual(enterNesting(state, cst), false);
    assert.strictEqual(enterNesting(state, cst), false);
    assert.strictEqual(state.errors.length, 2);
    assert.deepStrictEqual(state.errors[1], { code: "NestingDepthExceeded", message: `Nesting depth exceeded maximum of ${MAX_NESTING_DEPTH}`, offset: 7, length: 1 });
    assert.strictEqual(state.depth, MAX_NESTING_DEPTH);
  }));
});
