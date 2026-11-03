import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  buildPairs,
  composeBlockMap,
  composeBlockSeq,
  composeFlatBlockMap,
  flattenBlockMapChildren,
  SemanticItem,
  SemanticKey,
} from "@beep/yaml/internal/composer/block";
import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow";
import { createState } from "@beep/yaml/internal/composer/state";
import { YamlDocument } from "@beep/yaml/YamlDocument";
import { YamlScalar } from "@beep/yaml/YamlNode";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CstNode } from "@beep/yaml/internal/cst";
import type { YamlPair } from "@beep/yaml/YamlNode";

const runs = { arbitrary: fcRuns(100) };
const flow = { composeFlowMap, composeFlowSeq };
const Sample = S.Struct({
  value: S.Int.check(S.isBetween({ minimum: -100000, maximum: 100000 })),
  comment: S.String.check(S.isPattern(/^[a-z]{1,20}$/)),
});

const sampleKey = YamlScalar.make({ value: "key", style: "plain", offset: 0, length: 3 });

/** Hand-built CST for `- <value> # <comment>` (sequence) or `key: <value> # <comment>` (map). */
const sampleCst = (sequence: boolean, sample: typeof Sample.Type) => {
  const prefix = sequence ? "- " : "key: ";
  const text = `${prefix}${sample.value} # ${sample.comment}\n`;
  const children: CstNode[] = sequence
    ? [
        { type: "whitespace", source: "-", offset: 0, length: 1 },
        { type: "flow-scalar", source: `${sample.value}`, offset: 2, length: `${sample.value}`.length },
      ]
    : [
        { type: "whitespace", source: ":", offset: 3, length: 1 },
        { type: "flow-scalar", source: `${sample.value}`, offset: 5, length: `${sample.value}`.length },
      ];
  children.push({
    type: "comment",
    source: `# ${sample.comment}`,
    offset: prefix.length + `${sample.value}`.length + 1,
    length: sample.comment.length + 2,
  });
  const cst: CstNode = {
    type: sequence ? "block-seq" : "block-map",
    source: text,
    offset: 0,
    length: text.length,
    children,
  };
  return { text, children, cst };
};

/** The flat-map, flatten and pair-building paths agree with the composed mapping. */
const assertFlatMapAgreement = (
  text: string,
  children: CstNode[],
  cst: CstNode,
  first: ReturnType<typeof composeBlockMap> | ReturnType<typeof composeBlockSeq>
) => {
  assert.deepStrictEqual(
    composeFlatBlockMap(children, 0, cst, createState(text, flow), sampleKey).toValue(),
    first.toValue()
  );
  const tokens = flattenBlockMapChildren(children, createState(text, flow));
  assert.deepStrictEqual(flattenBlockMapChildren(children, createState(text, flow)), tokens);
  const pairs: YamlPair[] = [];
  buildPairs([SemanticKey.make({ kind: "key", node: sampleKey }), ...tokens], pairs, text);
  assert.deepStrictEqual(pairs, first._tag === "YamlMap" ? first.items : []);
};

const assertRenderRoundtrip = Effect.fn(function* (text: string, comment: string) {
  const doc = yield* YamlDocument.parse(text);
  const rendered = yield* doc.stringify();
  const reparsed = yield* YamlDocument.parse(rendered);
  assert.deepStrictEqual(reparsed.toValue(), doc.toValue());
  assert.strictEqual(Str.includes(`# ${comment}`)(rendered), true);
  const stringify1 = yield* reparsed.stringify();
  assert.strictEqual(stringify1, rendered);
});

describe("block composer property floor", () => {
  it.effect.prop(
    "SemanticItem decodes its encoding without failure and preserves schema equivalence",
    [Arbitrary.schema(SemanticItem)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(SemanticItem)(value);
        const decoded = yield* S.decodeEffect(SemanticItem)(encoded);
        assert.strictEqual(S.toEquivalence(SemanticItem)(decoded, value), true);
      }),
    runs
  );

  for (const sequence of [false, true]) {
    it.effect.prop(
      `${sequence ? "sequence" : "map"} composition is repeatable and preserves values and comments through rendering`,
      [Arbitrary.schema(Sample)],
      ([sample]) =>
        Effect.gen(function* () {
          const { text, children, cst } = sampleCst(sequence, sample);
          const compose = () =>
            sequence
              ? composeBlockSeq(cst, createState(text, flow))
              : composeBlockMap(cst, createState(text, flow), sampleKey);
          const first = compose();
          assert.deepStrictEqual(compose(), first);
          assert.deepStrictEqual(
            first.toValue(),
            sequence ? [sample.value === 0 ? 0 : sample.value] : { key: sample.value === 0 ? 0 : sample.value }
          );
          if (sequence === false) assertFlatMapAgreement(text, children, cst, first);
          yield* assertRenderRoundtrip(text, sample.comment);
        }),
      runs
    );
  }
});
