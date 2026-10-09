import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SemanticItem, composeBlockMap, composeBlockSeq, composeFlatBlockMap, flattenBlockMapChildren, buildPairs } from "../../../../effected/yaml/internal/composer/block.ts";
import { createState } from "../../../../effected/yaml/internal/composer/state.ts";
import { composeFlowMap, composeFlowSeq } from "../../../../effected/yaml/internal/composer/flow.ts";
import type { CstNode } from "../../../../effected/yaml/internal/cst.ts";
import { YamlDocument } from "../../../../effected/yaml/YamlDocument.ts";
import { YamlPair, YamlScalar } from "../../../../effected/yaml/YamlNode.ts";

const runs = { arbitrary: fcRuns(100) };
const flow = { composeFlowMap, composeFlowSeq };
const Sample = S.Struct({ value: S.Int.check(S.isBetween({ minimum: -100000, maximum: 100000 })), comment: S.String.check(S.isPattern(/^[a-z]{1,20}$/)) });

describe("block composer property floor", () => {
  it.effect.prop("SemanticItem decodes its encoding without failure and preserves schema equivalence", [Arbitrary.schema(SemanticItem)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(SemanticItem)(value);
    const decoded = yield* S.decodeEffect(SemanticItem)(encoded);
    assert.strictEqual(S.toEquivalence(SemanticItem)(decoded, value), true);
  }), runs);

  for (const sequence of [false, true]) {
    it.effect.prop(`${sequence ? "sequence" : "map"} composition is repeatable and preserves values and comments through rendering`, [Arbitrary.schema(Sample)], ([sample]) => Effect.gen(function* () {
      const prefix = sequence ? "- " : "key: ";
      const text = `${prefix}${sample.value} # ${sample.comment}\n`;
      const children: CstNode[] = sequence
        ? [{ type: "whitespace", source: "-", offset: 0, length: 1 }, { type: "flow-scalar", source: `${sample.value}`, offset: 2, length: `${sample.value}`.length }]
        : [{ type: "whitespace", source: ":", offset: 3, length: 1 }, { type: "flow-scalar", source: `${sample.value}`, offset: 5, length: `${sample.value}`.length }];
      children.push({ type: "comment", source: `# ${sample.comment}`, offset: prefix.length + `${sample.value}`.length + 1, length: sample.comment.length + 2 });
      const cst: CstNode = { type: sequence ? "block-seq" : "block-map", source: text, offset: 0, length: text.length, children };
      const key = YamlScalar.make({ value: "key", style: "plain", offset: 0, length: 3 });
      const compose = () => sequence ? composeBlockSeq(cst, createState(text, flow)) : composeBlockMap(cst, createState(text, flow), key);
      const first = compose();
      assert.deepStrictEqual(compose(), first);
      assert.deepStrictEqual(first.toValue(), sequence ? [sample.value === 0 ? 0 : sample.value] : { key: sample.value === 0 ? 0 : sample.value });
      if (sequence === false) {
        assert.deepStrictEqual(composeFlatBlockMap(children, 0, cst, createState(text, flow), key).toValue(), first.toValue());
        const tokens = flattenBlockMapChildren(children, createState(text, flow));
        assert.deepStrictEqual(flattenBlockMapChildren(children, createState(text, flow)), tokens);
        const pairs: YamlPair[] = [];
        buildPairs([{ kind: "key", node: key }, ...tokens], pairs, text);
        assert.deepStrictEqual(pairs, first._tag === "YamlMap" ? first.items : []);
      }
      const doc = yield* YamlDocument.parse(text);
      const rendered = yield* doc.stringify();
      const reparsed = yield* YamlDocument.parse(rendered);
      assert.deepStrictEqual(reparsed.toValue(), doc.toValue());
      assert.strictEqual(rendered.includes(`# ${sample.comment}`), true);
      assert.strictEqual(yield* reparsed.stringify(), rendered);
    }), runs);
  }
});
