import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as C from "../../../../effected/yaml/internal/composer/scalars.ts";
import type { CstNode } from "../../../../effected/yaml/internal/cst.ts";
import { createState } from "../../../../effected/yaml/internal/composer/state.ts";
import { composeFlowMap, composeFlowSeq } from "../../../../effected/yaml/internal/composer/flow.ts";
import { renderDoubleQuoted } from "../../../../effected/yaml/internal/stringifier.ts";
import { Yaml } from "../../../../effected/yaml/Yaml.ts";
import { YamlFormat } from "../../../../effected/yaml/YamlFormat.ts";

const runs = { arbitrary: fcRuns(100) };
const node = (source: string): CstNode => ({ type: "flow-scalar", source, offset: 0, length: source.length });

describe("scalar parser properties", () => {
  it.effect.prop("double quoted decoding is faithful and canonical rendering is idempotent", [Arbitrary.schema(S.String)], ([value]) => Effect.gen(function* () {
    const encoded = renderDoubleQuoted(value);
    const decoded = C.getScalarValue(node(encoded));
    expect(decoded).toBe(value);
    expect(C.getScalarValue(node(renderDoubleQuoted(decoded)))).toBe(decoded);
    const formatted = YamlFormat.formatToString(encoded);
    expect(YamlFormat.formatToString(formatted)).toBe(formatted);
    expect(yield* Yaml.parse(yield* Yaml.stringify(yield* Yaml.parse(encoded)))).toBe(value);
  }), runs);

  it.effect.prop("plain integer resolution preserves value across spelling and stringify", [Arbitrary.schema(S.Int)], ([value]) => Effect.gen(function* () {
    const source = String(value);
    expect(C.classifyPlainNumeric(source)).toBe("int");
    const decoded = C.resolveScalar(C.getScalarValue(node(source)), ["plain"]);
    expect(decoded).toBe(value + 0);
    expect(C.resolveScalar(C.getScalarValue(node(yield* Yaml.stringify(decoded))), ["plain"])).toBe(decoded);
    const formatted = YamlFormat.formatToString(source);
    expect(YamlFormat.formatToString(formatted)).toBe(formatted);
  }), runs);

  it.effect.prop("single quoted collection, key collection and flow folding preserve textual words", [Arbitrary.schema(S.Array(S.Int).check(S.isMinLength(1), S.isMaxLength(12)))], ([values]) => Effect.sync(() => {
    const words = values.map((value) => `word${value}`);
    const source = words.join("\n  ");
    const expected = words.join(" ");
    expect(C.foldFlowLines(source)).toBe(expected);
    expect(C.foldFlowLines(C.foldFlowLines(source))).toBe(expected);
    expect(C.getScalarValue(node(`'${source}'`))).toBe(expected);
    expect(C.getScalarValue(node(renderDoubleQuoted(C.getScalarValue(node(`'${source}'`)))))).toBe(expected);
    const children = words.map(node);
    const key = C.collectMultilineKey(children, 0).value;
    const plain = C.collectMultilinePlainScalar(children, 0).value;
    expect(key).toBe(expected);
    expect(plain).toBe(expected);
    expect(C.getScalarValue(node(renderDoubleQuoted(key)))).toBe(key);
    expect(C.getScalarValue(node(renderDoubleQuoted(plain)))).toBe(plain);
    expect(C.collectMultilineKey([node(renderDoubleQuoted(expected))], 0).value).toBe(renderDoubleQuoted(expected));
  }), runs);

  it.effect.prop("scalar formatting preserves noncanonical numeric spelling and comments", [Arbitrary.schema(S.Int)], ([value]) => Effect.gen(function* () {
    const spelling = value < 0 ? `-0${Math.abs(value)}` : `+0${value}`;
    const source = `key: ${spelling} # scalar spelling\n`;
    const formatted = YamlFormat.formatToString(source);
    expect(formatted).toContain(`${spelling} # scalar spelling`);
    expect(YamlFormat.formatToString(formatted)).toBe(formatted);
    expect(yield* Yaml.parse(formatted)).toEqual(yield* Yaml.parse(source));
    expect(yield* Yaml.parse(yield* Yaml.stringify(yield* Yaml.parse(source)))).toEqual({ key: value + 0 });
  }), runs);
  it.effect.prop("block scalar composition keeps value, metadata and parse-stringify fidelity", [Arbitrary.schema(S.Array(S.Int).check(S.isMinLength(1), S.isMaxLength(12)))], ([values]) => Effect.gen(function* () {
    const words = values.map((value) => `word${value}`);
    for (const indicator of ["|", ">"] as const) {
      const source = `${indicator}- # header\n${words.map((word) => `  ${word}`).join("\n")}\n`;
      const cst: CstNode = { type: "block-scalar", source, offset: 0, length: source.length };
      const state = createState(source, { composeFlowMap, composeFlowSeq });
      const composed = C.makeScalar(cst, state);
      const expected = words.join(indicator === "|" ? "\n" : " ");
      expect(C.getScalarValue(cst, source)).toBe(expected);
      expect(composed.value).toBe(expected);
      expect(composed.comment).toBe(" header");
      expect(composed.offset).toBe(0);
      expect(composed.length).toBe(source.length);
      expect(state.errors).toEqual([]);
      const parsed = yield* Yaml.parse(source);
      expect(parsed).toBe(expected);
      expect(yield* Yaml.parse(yield* Yaml.stringify(parsed))).toBe(parsed);
      const formatted = YamlFormat.formatToString(source);
      expect(YamlFormat.formatToString(formatted)).toBe(formatted);
      expect(yield* Yaml.parse(formatted)).toBe(parsed);
      expect(formatted).toContain("# header");
    }
  }), runs);

});
