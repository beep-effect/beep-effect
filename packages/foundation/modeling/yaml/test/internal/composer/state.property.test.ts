import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  clearMeta,
  commentProps,
  getLineStarts,
  hasMeta,
  LineColumn,
  lineCol,
  NodeMeta,
} from "@beep/yaml/internal/composer/state";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
describe("composer state properties", () => {
  it.effect.prop(
    "NodeMeta encode/decode is lossless and decoding encoded metadata never fails",
    [Arbitrary.schema(NodeMeta)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(NodeMeta)(value);
        const decoded = yield* S.decodeEffect(NodeMeta)(encoded);
        assert.strictEqual(S.toEquivalence(NodeMeta)(decoded, value), true);
        const value1 = yield* S.encodeEffect(NodeMeta)(decoded);
        assert.deepStrictEqual(value1, encoded);
        clearMeta(decoded);
        assert.deepStrictEqual(decoded, NodeMeta.make({}));
        assert.strictEqual(hasMeta(decoded), false);
      }),
    runs
  );
  it.effect.prop(
    "comment fidelity copies every present field and is idempotent",
    [
      Arbitrary.schema(
        S.Struct({
          commentBefore: S.optionalKey(S.String),
          comment: S.optionalKey(S.String),
          spaceBefore: S.optionalKey(S.Boolean),
        })
      ),
    ],
    ([value]) =>
      Effect.sync(() => {
        const copied = commentProps(value);
        assert.deepStrictEqual(copied, value);
        assert.deepStrictEqual(commentProps(copied), copied);
      }),
    runs
  );
  it.effect.prop(
    "line index reconstructs source bytes and positions agree with newline prefixes",
    [Arbitrary.schema(S.String)],
    ([text]) =>
      Effect.sync(() => {
        const starts = getLineStarts(text);
        assert.strictEqual(
          A.join(
            A.map(starts, (start, index) => Str.slice(start, starts[index + 1])(text)),
            ""
          ),
          text
        );
        let line = 0;
        let lineStart = 0;
        for (let offset = 0; offset <= text.length; offset++) {
          if (offset > 0 && text[offset - 1] === "\n") {
            line++;
            lineStart = offset;
          }
          const bom = text[lineStart] === "\uFEFF" && offset > lineStart ? 1 : 0;
          assert.deepStrictEqual(
            lineCol(text, offset),
            LineColumn.make({
              line,
              column: offset - lineStart - bom,
            })
          );
        }
      }),
    runs
  );
});
