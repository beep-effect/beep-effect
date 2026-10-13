import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { clearMeta, commentProps, getLineStarts, hasMeta, lineCol, NodeMeta } from "../../../../effected/yaml/internal/composer/state.ts";

const runs = { arbitrary: fcRuns(100) };
describe("composer state properties", () => {
  it.effect.prop("NodeMeta encode/decode is lossless and decoding encoded metadata never fails", [Arbitrary.schema(NodeMeta)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(NodeMeta)(value);
    const decoded = yield* S.decodeEffect(NodeMeta)(encoded);
    assert.strictEqual(S.toEquivalence(NodeMeta)(decoded, value), true);
    assert.deepStrictEqual(yield* S.encodeEffect(NodeMeta)(decoded), encoded);
    clearMeta(decoded);
    assert.deepStrictEqual(decoded, {});
    assert.strictEqual(hasMeta(decoded), false);
  }), runs);
  it.effect.prop("comment fidelity copies every present field and is idempotent", [Arbitrary.schema(S.Struct({ commentBefore: S.optionalKey(S.String), comment: S.optionalKey(S.String), spaceBefore: S.optionalKey(S.Boolean) }))], ([value]) => Effect.sync(() => {
    const copied = commentProps(value);
    assert.deepStrictEqual(copied, value);
    assert.deepStrictEqual(commentProps(copied), copied);
  }), runs);
  it.effect.prop("line index reconstructs source bytes and positions agree with newline prefixes", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
    const starts = getLineStarts(text);
    assert.strictEqual(starts.map((start, index) => text.slice(start, starts[index + 1])).join(""), text);
    for (let offset = 0; offset <= text.length; offset++) {
      const prefix = text.slice(0, offset);
      const lineStart = prefix.lastIndexOf("\n") + 1;
      const bom = text[lineStart] === "\uFEFF" && offset > lineStart ? 1 : 0;
      assert.deepStrictEqual(lineCol(text, offset), { line: prefix.split("\n").length - 1, column: offset - lineStart - bom });
    }
  }), runs);
});
