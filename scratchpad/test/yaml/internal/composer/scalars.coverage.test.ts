import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as C from "../../../../effected/yaml/internal/composer/scalars.ts";
import type { CstNode, CstNodeType } from "../../../../effected/yaml/internal/cst.ts";
import { createState } from "../../../../effected/yaml/internal/composer/state.ts";
import { composeFlowMap, composeFlowSeq } from "../../../../effected/yaml/internal/composer/flow.ts";

const node = (type: CstNodeType, source: string, offset = 0, children?: readonly CstNode[]): CstNode => ({ type, source, offset, length: source.length, ...(children === undefined ? {} : { children }) });
const scalar = (source: string) => C.getScalarValue(node("flow-scalar", source));
const block = (source: string, text?: string, offset = 0) => C.getScalarValue(node("block-scalar", source, offset), text);
const state = (text: string) => createState(text, { composeFlowMap, composeFlowSeq });

describe("scalar seam coverage", () => {
  it.effect("resolves explicit tags independently of core schema spelling", () => Effect.sync(() => {
    for (const [text, tag, value] of [
      ["0o17", "!!int", 15], ["0x10", "!!int", 16], ["bad", "!!int", "bad"],
      [".inf", "!!float", Infinity], ["-.inf", "!!float", -Infinity], [".nan", "!!float", NaN],
      ["1.5", "!!float", 1.5], ["bad", "!!float", "bad"], ["false", "!!bool", false], ["bad", "!!bool", "bad"],
    ] as const) expect(C.resolveScalar(text, ["plain", tag])).toEqual(value);
    expect(C.resolveScalar("-.inf", ["plain"])).toBe(-Infinity);
    expect(C.resolveScalar("+.inf", ["plain"])).toBe(Infinity);
    expect(C.resolveScalar("false", ["plain", ""])).toBe(false);
    expect(C.classifyPlainNumeric("words")).toBeNull();
  }));

  it.effect("decodes every escape and both physical line ending styles", () => Effect.sync(() => {
    for (const [source, value] of [
      ['"\\/\\b\\f\\a\\v\\N\\_\\L\\P"', "/\b\f\x07\x0b\u0085\u00a0\u2028\u2029"],
      ['"\\U00110000"', "\ufffd"], ['"\\q"', "q"], ['"\\"', "\\"],
      ['"a\\\rb"', "ab"], ['"a\\\r\n \tb"', "ab"], ['"a\\\r \tb"', "ab"],
      ['"a\r\n \tb"', "a b"], ['"a\n\rb"', "a\nb"], ['"a\n\r\n \tb"', "a\nb"], ['"a\rb"', "a\rb"],
      ["a\n  b", "a b"],
    ] as const) expect(scalar(source)).toBe(value);
    expect(C.foldFlowLines("\n\n")).toBe("\n");
    expect(C.getBlockChomp(node("block-scalar", "invalid"))).toBe("clip");
    expect(C.getBlockIndent(node("block-scalar", "invalid"))).toBeUndefined();
    expect(block("invalid")).toBe("");
    expect(block("|2\n  x", "", 4)).toBe("x\n");
    expect(C.makeScalar(node("flow-scalar", "0x10"), state("0x10")).raw).toBe("0x10");
  }));

  it.effect("collects fragments and respects CST boundaries and absent nodes", () => Effect.sync(() => {
    const first = node("flow-scalar", "one");
    const second = node("flow-scalar", "two", 5);
    expect(C.collectMultilineKey([], 0)).toEqual({ value: "", nextIdx: 1 });
    expect(C.collectMultilineKey([node("tag", "  !x ")], 0)).toEqual({ value: "!x", nextIdx: 1 });
    expect(C.collectMultilineKey([first, node("tag", "!x")], 0)).toEqual({ value: "one", nextIdx: 1 });
    expect(C.collectMultilineKey([first, second], 0)).toEqual({ value: "one two", nextIdx: 2 });
    expect(C.collectMultilineKey([first, node("whitespace", ",")], 0)).toEqual({ value: "one", nextIdx: 1 });
    const holes = new Array<CstNode>(1);
    expect(C.collectMultilineKey([first, ...holes], 0)).toEqual({ value: "one", nextIdx: 1 });
    expect(C.collectMultilinePlainScalar([], 0)).toEqual({ value: "", nextIdx: 1, partsCount: 1, endOffset: 0 });
    expect(C.collectMultilinePlainScalar([node("tag", "!x")], 0).value).toBe("!x");
    expect(C.collectMultilinePlainScalar([node("flow-scalar", "'x'")], 0).value).toBe("x");
    expect(C.collectMultilinePlainScalar([first, ...holes], 0).nextIdx).toBe(1);
    const text = "one\n\n  &x  \t\r\nend";
    const list = [first, node("newline", "\n", 3), node("newline", "\n", 4), node("anchor", "&x", 7), node("tag", "!x", 20)];
    expect(C.collectMultilinePlainScalar([...list.slice(0, 4), ...holes], 0, 1, text).value).toBe("one\n&x");
    const collected = C.collectMultilinePlainScalar(list, 0, 1, text);
    expect(collected).toEqual({ value: "one\n&x", nextIdx: 4, partsCount: 3, endOffset: 9 });
    expect(C.collectMultilinePlainScalar([first, node("newline", "\n", 3), node("anchor", "", 5)], 0, 0, "one\n  ").value).toBe("one");
  }));

  it.effect("scans sparse child lists and distinguishes trivia from structure", () => Effect.sync(() => {
    const holes = new Array<CstNode>(1);
    const nl = node("newline", "\n");
    const comment = node("comment", "# c");
    const blank = node("whitespace", " ");
    const colon = node("whitespace", ":", 4);
    const content = node("flow-scalar", "x");
    const trivia = [...holes, nl, comment, blank];
    expect(C.findNextSignificantChild([...trivia, content], 0)).toBe(4);
    expect(C.hasBlockMapAfterInList([...trivia, colon], 0)).toBe(false);
    expect(C.findValueSepOffset([...trivia, colon], 0)).toBe(4);
    expect(C.hasValueSepBetween([...trivia, colon], 0, 5)).toBe(true);
    expect(C.hasValueSepThroughPlainScalars([...trivia, colon], 0)).toBe(true);
    expect(C.findNextContentInList([...trivia, content], 0)).toEqual({ node: content, idx: 4 });
    expect(C.findNextContentChild([...trivia, content], 0)).toBe(content);
    expect(C.hasValueSepAfter([...holes, blank, nl, colon], 0)).toBe(true);
    expect(C.findFirstContent([...holes, blank, nl])).toBeUndefined();
    expect(C.findLastContent([...holes, blank, nl])).toBeUndefined();
    expect(C.findFirstContent([colon])).toBe(colon);
    expect(C.findLastContent([colon])).toBe(colon);
    expect(C.indexOfChild([], content)).toBe(-1);
    for (const [children, expected] of [[undefined, false], [trivia, false], [[...trivia, colon], true], [[blank, node("whitespace", "?")], false], [[content], false]] as const) {
      expect(C.blockMapStartsWithValueSep(node("block-map", "", 0, children))).toBe(expected);
    }
  }));

  it.effect("handles block headers, empty bodies, indentation and carriage returns", () => Effect.sync(() => {
    for (const [source, value] of [
      ["| # c\r\n  x\r\n", "x\n"], ["|\r  x\r", "x\n"], ["|+\r\n\r\n", "\n"], ["|+\r\r", "\n"],
      ["|+\n  ", "\n"], ["|+\n\n  ", "\n"], ["|\n  \r\n  x\n", "\nx\n"],
      ["|2\n x\n", ""], ["|2\n  x\r\n  \r\n", "x\n"], ["|2\n  x\r  \r", "x\n"],
      [">2", ""], [">2+\n", ""], [">2\n\n", ""], [">2-\n\n", ""], [">2+\n\n", "\n"],
      [">2+\n  x", "x\n"], [">2-\n  x", "x"], ["|2\n\n   \n  x\n", "\n \nx\n"],
    ] as const) expect(block(source)).toBe(value);
    for (const prefix of ["  - ", "\r  -\t", "  -key: ", "  key: !tag &anchor\n    ", "-: "]) {
      const raw = "|2\n    x\n";
      expect(block(raw, prefix + raw, prefix.length)).toBe(prefix === "-: " ? "  x\n" : "x\n");
    }
    for (const raw of ["|#bad\n  x", "|\t# yes\n  x", "|", "|\r\n   \r\n  x", "|\r   \r  x", "|\n   "]) {
      const s = state(raw);
      const result = C.makeScalar(node("block-scalar", raw), s);
      expect(result.value).toBe(block(raw, raw));
      expect(s.errors.length).toBe(raw.includes("   \r") ? 1 : 0);
    }
  }));
});
