import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CstNode } from "../../../effected/yaml/internal/cst.ts";
import { ParseOptionsInput, StringifyOptionsInput } from "../../../effected/yaml/internal/options.ts";
import { RawDirective, RawYamlDocument } from "../../../effected/yaml/internal/raw-document.ts";
import { parseCSTAll } from "../../../effected/yaml/internal/cst-parser.ts";
import { cstEvents } from "../../../effected/yaml/internal/cst-visitor.ts";
import { Yaml } from "../../../effected/yaml/Yaml.ts";
import { getScalarValue } from "../../../effected/yaml/internal/composer/scalars.ts";
import { composeFlowMap, composeFlowSeq, flattenFlowChildren } from "../../../effected/yaml/internal/composer/flow.ts";
import { createState } from "../../../effected/yaml/internal/composer/state.ts";
import { stringifyValue } from "../../../effected/yaml/internal/stringifier.ts";

const CstNodes = S.Array(CstNode);
const node = (type: CstNode["type"], source: string): CstNode => ({ type, source, offset: 0, length: source.length });

describe("round 2 integration seams", () => {
  it.effect("runtime structural codecs validate recursive nodes and engine inputs", () => Effect.sync(() => {
    const docs = parseCSTAll("a: [1, 2]\n");
    assert.isTrue(S.is(CstNodes)(docs));
    assert.isFalse(S.is(CstNode)({ type: "unknown", source: "", offset: 0, length: 0 }));
    assert.isTrue(S.is(ParseOptionsInput)({ strict: false, maxAliasCount: 4, uniqueKeys: true }));
    assert.isFalse(S.is(ParseOptionsInput)({ strict: "false" }));
    assert.isTrue(S.is(StringifyOptionsInput)({ indent: 2, quoteStyle: "double", inFlow: true }));
    assert.isFalse(S.is(StringifyOptionsInput)({ quoteStyle: "invalid" }));
    assert.isTrue(S.is(RawDirective)({ name: "YAML", parameters: ["1.2"] }));
    assert.isTrue(S.is(RawYamlDocument)({ contents: null, errors: [], warnings: [], directives: [], hasDocumentStart: false, hasDocumentEnd: false, hasDocumentStartTab: false }));
  }));

  for (const text of ["? {a: b}\n: c", "? [a, b]\n: c", "? &a key\n? *a\n: c", "?\n  a: b\n: c", "{? {a: b}: c}", "{? [a, b]: c}", "{? *a : c}"]) {
    it.effect(`collection and alias keys remain keys: ${text}`, () => Effect.sync(() => {
      const events = [...cstEvents(text)];
      assert.strictEqual(A.getUnsafe(events, 0)._tag, "CstDocumentStartEvent");
      assert.strictEqual(A.getUnsafe(events, events.length - 1)._tag, "CstDocumentEndEvent");
      assert.deepStrictEqual(A.map(A.filter(events, (event) => event._tag === "CstValueEvent"), (event) => event.source), text.includes("a: b") ? ["b", "c"] : ["c"]);
    }));
  }

  it.effect("CRLF flow continuation is indented under its block parent", () => Effect.gen(function* () {
    assert.deepStrictEqual(yield* Yaml.parse("a: [\r\n  b,\r\n  c]\r\n"), { a: ["b", "c"] });
  }));

  it.effect("terminal explicit flow key skips intervening trivia", () => Effect.sync(() => {
    const state = createState("", { composeFlowMap, composeFlowSeq });
    const items = flattenFlowChildren([node("flow-scalar", "?"), node("newline", "\n"), node("comment", "# c"), node("whitespace", " "), node("whitespace", "}")], state);
    assert.strictEqual(items[0]?.kind, "key");
  }));

  it.effect("parent indentation scans quoted escapes and whole-line comments", () => Effect.sync(() => {
    for (const prefix of ['"a\\\"b": ', "'a''b': ", "# comment\n", "  # comment\n"]) {
      const source = "|2\n  x\n";
      assert.strictEqual(getScalarValue({ ...node("block-scalar", source), offset: prefix.length }, prefix + source), "x\n");
    }
  }));

  it.effect("multiline plain scalar falls back to quotes for an unrepresentable indent", () => Effect.sync(() => {
    assert.strictEqual(stringifyValue(" leading\ntext", { indent: 0 }), '" leading\\ntext"\n');
  }));
});
