import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { composeFlowMap, composeFlowSeq } from "@beep/yaml/internal/composer/flow";
import * as C from "@beep/yaml/internal/composer/scalars";
import { createState } from "@beep/yaml/internal/composer/state";
import { renderDoubleQuoted } from "@beep/yaml/internal/stringifier";
import { Yaml } from "@beep/yaml/Yaml";
import { YamlFormat } from "@beep/yaml/YamlFormat";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { CstNode } from "@beep/yaml/internal/cst";

const runs = { arbitrary: fcRuns(100) };
const node = (source: string): CstNode => ({ type: "flow-scalar", source, offset: 0, length: source.length });

describe("scalar parser properties", () => {
  it.effect.prop(
    "double quoted decoding is faithful and canonical rendering is idempotent",
    [Arbitrary.schema(S.String)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = renderDoubleQuoted(value);
        const decoded = C.getScalarValue(node(encoded));
        expect(decoded).toBe(value);
        expect(C.getScalarValue(node(renderDoubleQuoted(decoded)))).toBe(decoded);
        const formatted = YamlFormat.formatToString(encoded);
        expect(YamlFormat.formatToString(formatted)).toBe(formatted);
        const parsed10 = yield* Yaml.parse(encoded);
        const stringify7 = yield* Yaml.stringify(parsed10);
        const parsed1 = yield* Yaml.parse(stringify7);
        expect(parsed1).toBe(value);
      }),
    runs
  );

  it.effect.prop(
    "plain integer resolution preserves value across spelling and stringify",
    [Arbitrary.schema(S.Int)],
    ([value]) =>
      Effect.gen(function* () {
        const source = String(value);
        expect(O.getOrUndefined(C.classifyPlainNumeric(source))).toBe("int");
        const decoded = C.resolveScalar(C.getScalarValue(node(source)), ["plain"]);
        expect(decoded).toBe(value + 0);
        const stringify2 = yield* Yaml.stringify(decoded);
        expect(C.resolveScalar(C.getScalarValue(node(stringify2)), ["plain"])).toBe(decoded);
        const formatted = YamlFormat.formatToString(source);
        expect(YamlFormat.formatToString(formatted)).toBe(formatted);
      }),
    runs
  );

  it.effect.prop(
    "single quoted collection, key collection and flow folding preserve textual words",
    [Arbitrary.schema(S.Array(S.Int).check(S.isMinLength(1), S.isMaxLength(12)))],
    ([values]) =>
      Effect.sync(() => {
        const words = A.map(values, (value) => `word${value}`);
        const source = A.join(words, "\n  ");
        const expected = A.join(words, " ");
        expect(C.foldFlowLines(source)).toBe(expected);
        expect(C.foldFlowLines(C.foldFlowLines(source))).toBe(expected);
        expect(C.getScalarValue(node(`'${source}'`))).toBe(expected);
        expect(C.getScalarValue(node(renderDoubleQuoted(C.getScalarValue(node(`'${source}'`)))))).toBe(expected);
        const children = A.map(words, node);
        const key = C.collectMultilineKey(children, 0).value;
        const plain = C.collectMultilinePlainScalar(children, 0).value;
        expect(key).toBe(expected);
        expect(plain).toBe(expected);
        expect(C.getScalarValue(node(renderDoubleQuoted(key)))).toBe(key);
        expect(C.getScalarValue(node(renderDoubleQuoted(plain)))).toBe(plain);
        expect(C.collectMultilineKey([node(renderDoubleQuoted(expected))], 0).value).toBe(renderDoubleQuoted(expected));
      }),
    runs
  );

  it.effect.prop(
    "scalar formatting preserves noncanonical numeric spelling and comments",
    [Arbitrary.schema(S.Int)],
    ([value]) =>
      Effect.gen(function* () {
        const spelling = value < 0 ? `-0${Math.abs(value)}` : `+0${value}`;
        const source = `key: ${spelling} # scalar spelling\n`;
        const formatted = YamlFormat.formatToString(source);
        expect(formatted).toContain(`${spelling} # scalar spelling`);
        expect(YamlFormat.formatToString(formatted)).toBe(formatted);
        const parsed3 = yield* Yaml.parse(formatted);
        const expectation = expect(parsed3);
        const parsed2 = yield* Yaml.parse(source);
        expectation.toEqual(parsed2);
        const parsed11 = yield* Yaml.parse(source);
        const stringify8 = yield* Yaml.stringify(parsed11);
        const parsed4 = yield* Yaml.parse(stringify8);
        expect(parsed4).toEqual({ key: value + 0 });
      }),
    runs
  );
  it.effect.prop(
    "block scalar composition keeps value, metadata and parse-stringify fidelity",
    [Arbitrary.schema(S.Array(S.Int).check(S.isMinLength(1), S.isMaxLength(12)))],
    ([values]) =>
      Effect.gen(function* () {
        const words = A.map(values, (value) => `word${value}`);
        for (const indicator of ["|", ">"] as const) {
          const source = `${indicator}- # header\n${A.join(
            A.map(words, (word) => `  ${word}`),
            "\n"
          )}\n`;
          const cst: CstNode = { type: "block-scalar", source, offset: 0, length: source.length };
          const state = createState(source, { composeFlowMap, composeFlowSeq });
          const composed = C.makeScalar(cst, state);
          const expected = A.join(words, indicator === "|" ? "\n" : " ");
          expect(C.getScalarValue(cst, source)).toBe(expected);
          expect(composed.value).toBe(expected);
          expect(composed.comment).toBe(" header");
          expect(composed.offset).toBe(0);
          expect(composed.length).toBe(source.length);
          expect(state.errors).toEqual([]);
          const parsed = yield* Yaml.parse(source);
          expect(parsed).toBe(expected);
          const stringify9 = yield* Yaml.stringify(parsed);
          const parsed5 = yield* Yaml.parse(stringify9);
          expect(parsed5).toBe(parsed);
          const formatted = YamlFormat.formatToString(source);
          expect(YamlFormat.formatToString(formatted)).toBe(formatted);
          const parsed6 = yield* Yaml.parse(formatted);
          expect(parsed6).toBe(parsed);
          expect(formatted).toContain("# header");
        }
      }),
    runs
  );
});
