import { composeFlowMap, composeFlowSeq, flattenFlowChildren } from "@beep/yaml/internal/composer/flow";
import { getScalarValue } from "@beep/yaml/internal/composer/scalars";
import { createState } from "@beep/yaml/internal/composer/state";
import { CstNode } from "@beep/yaml/internal/cst";
import { parseCSTAll } from "@beep/yaml/internal/cst-parser";
import { cstEvents } from "@beep/yaml/internal/cst-visitor";
import { ParseOptionsInput, StringifyOptionsInput } from "@beep/yaml/internal/options";
import { RawDirective, RawYamlDocument } from "@beep/yaml/internal/raw-document";
import { stringifyValue } from "@beep/yaml/internal/stringifier";
import { Yaml } from "@beep/yaml/Yaml";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const CstNodes = S.Array(CstNode);
const node = (type: CstNode["type"], source: string): CstNode => ({ type, source, offset: 0, length: source.length });

describe("round 2 integration seams", () => {
  it.effect("runtime structural codecs validate recursive nodes and engine inputs", () =>
    Effect.sync(() => {
      const docs = parseCSTAll("a: [1, 2]\n");
      assert.isTrue(S.is(CstNodes)(docs));
      assert.isFalse(S.is(CstNode)({ type: "unknown", source: "", offset: 0, length: 0 }));
      assert.isTrue(S.is(ParseOptionsInput)({ strict: false, maxAliasCount: 4, uniqueKeys: true }));
      assert.isFalse(S.is(ParseOptionsInput)({ strict: "false" }));
      assert.isTrue(S.is(StringifyOptionsInput)({ indent: 2, quoteStyle: "double", inFlow: true }));
      assert.isFalse(S.is(StringifyOptionsInput)({ quoteStyle: "invalid" }));
      assert.isTrue(S.is(RawDirective)({ name: "YAML", parameters: ["1.2"] }));
      assert.isTrue(
        S.is(RawYamlDocument)({
          contents: null,
          errors: [],
          warnings: [],
          directives: [],
          hasDocumentStart: false,
          hasDocumentEnd: false,
          hasDocumentStartTab: false,
        })
      );
    })
  );

  for (const text of [
    "? {a: b}\n: c",
    "? [a, b]\n: c",
    "? &a key\n? *a\n: c",
    "?\n  a: b\n: c",
    "{? {a: b}: c}",
    "{? [a, b]: c}",
    "{? *a : c}",
  ]) {
    it.effect(`collection and alias keys remain keys: ${text}`, () =>
      Effect.sync(() => {
        const events = [...cstEvents(text)];
        assert.strictEqual(A.getUnsafe(events, 0)._tag, "CstDocumentStartEvent");
        assert.strictEqual(A.getUnsafe(events, events.length - 1)._tag, "CstDocumentEndEvent");
        assert.deepStrictEqual(
          A.map(
            A.filter(events, (event) => event._tag === "CstValueEvent"),
            (event) => event.source
          ),
          Str.includes("a: b")(text) ? ["b", "c"] : ["c"]
        );
      })
    );
  }

  it.effect("CRLF flow continuation is indented under its block parent", () =>
    Effect.gen(function* () {
      const parsed = yield* Yaml.parse("a: [\r\n  b,\r\n  c]\r\n");
      assert.deepStrictEqual(parsed, { a: ["b", "c"] });
    })
  );

  it.effect("terminal explicit flow key skips intervening trivia", () =>
    Effect.sync(() => {
      const state = createState("", { composeFlowMap, composeFlowSeq });
      const items = flattenFlowChildren(
        [
          node("flow-scalar", "?"),
          node("newline", "\n"),
          node("comment", "# c"),
          node("whitespace", " "),
          node("whitespace", "}"),
        ],
        state
      );
      assert.strictEqual(items[0]?.kind, "key");
    })
  );

  it.effect("parent indentation scans quoted escapes and whole-line comments", () =>
    Effect.sync(() => {
      for (const prefix of ['"a\\"b": ', "'a''b': ", "# comment\n", "  # comment\n"]) {
        const source = "|2\n  x\n";
        assert.strictEqual(
          getScalarValue({ ...node("block-scalar", source), offset: prefix.length }, prefix + source),
          "x\n"
        );
      }
    })
  );

  it.effect("multiline plain scalar falls back to quotes for an unrepresentable indent", () =>
    Effect.sync(() => {
      assert.strictEqual(
        stringifyValue(" leading\ntext", StringifyOptionsInput.make({ indent: 0 })),
        '" leading\\ntext"\n'
      );
    })
  );
});
