import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { composeFlowMap, composeFlowSeq, flattenFlowChildren } from "../../../../effected/yaml/internal/composer/flow.ts";
import { createState } from "../../../../effected/yaml/internal/composer/state.ts";
import { parseCSTAll } from "../../../../effected/yaml/internal/cst-parser.ts";
import { Yaml } from "../../../../effected/yaml/Yaml.ts";
import { YamlDocument } from "../../../../effected/yaml/YamlDocument.ts";
import { YamlFormat } from "../../../../effected/yaml/YamlFormat.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({ values: S.Array(S.Int.check(S.isBetween({ minimum: -1000, maximum: 1000 }))), map: S.Boolean });
const sourceOf = (sample: typeof Sample.Type): string => sample.map
  ? `{${sample.values.map((value, index) => `k${index}: ${value}`).join(", ")}}`
  : `[${sample.values.map((value) => `"${value}"`).join(", ")}]`;
const compose = (text: string) => {
  const cst = parseCSTAll(text)[0]?.children?.find((child) => child.type === "flow-map" || child.type === "flow-seq");
  if (cst === undefined) throw new Error("Expected flow collection");
  const state = createState(text, { composeFlowMap, composeFlowSeq });
  return { cst, state, node: cst.type === "flow-map" ? composeFlowMap(cst, state) : composeFlowSeq(cst, state) };
};

describe("flow composer properties", () => {
  it.effect.prop("map and sequence composition preserves stringify fidelity and format idempotence", [Arbitrary.schema(Sample)], ([sample]) => Effect.gen(function* () {
    const source = sourceOf(sample);
    const first = compose(source);
    assert.deepStrictEqual(first.state.errors, []);
    const value = first.node.toValue();
    assert.deepStrictEqual(yield* Yaml.parse(yield* Yaml.stringify(value)), value);
    const once = YamlFormat.formatToString(source);
    assert.strictEqual(YamlFormat.formatToString(once), once);
    assert.deepStrictEqual((yield* YamlDocument.parse(once)).toValue(), value);
    assert.deepStrictEqual(compose(source).node, first.node);
  }), runs);

  it.effect.prop("flattening is deterministic and agrees with sequence composition", [S.Int.pipe(S.Array, Arbitrary.schema)], ([values]) => Effect.sync(() => {
    const text = `[${values.map((value) => `"${value}"`).join(", ")}]`;
    const { cst, node } = compose(text);
    const children = cst.children ?? [];
    const first = flattenFlowChildren(children, createState(text, { composeFlowMap, composeFlowSeq }));
    assert.deepStrictEqual(flattenFlowChildren(children, createState(text, { composeFlowMap, composeFlowSeq })), first);
    assert.deepStrictEqual(first.flatMap((item) => item.kind === "node" && item.node !== undefined ? [item.node.toValue()] : []), node.toValue());
    assert.deepStrictEqual(node.toValue(), values.map(String));
  }), runs);

  it.effect.prop("own-line comments lead the following item and same-line comments trail it", [Arbitrary.schema(S.Int)], ([value]) => Effect.gen(function* () {
    const text = `[\n# before\n${value}, # after\n]`;
    const { node } = compose(text);
    const item = node.items[0];
    if (item === undefined || !("commentBefore" in item)) throw new Error("Expected commented sequence item");
    assert.strictEqual(item.commentBefore, " before");
    assert.strictEqual(item.comment, " after");
    const document = yield* YamlDocument.parse(text);
    const rendered = yield* document.stringify();
    const reparsed = yield* YamlDocument.parse(rendered);
    assert.deepStrictEqual(reparsed.toValue(), document.toValue());
    assert.strictEqual(YamlFormat.formatToString(YamlFormat.formatToString(text)), YamlFormat.formatToString(text));
    assert.include(rendered, "# before");
    assert.include(rendered, "# after");
  }), runs);
});
