import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as Effect from "effect/Effect";
import { cstEvents } from "../../../effected/yaml/internal/cst-visitor.ts";

const leaves = (text: string) => A.filterMap([...cstEvents(text)], (event) =>
  "source" in event && event._tag !== "CstMapStartEvent" && event._tag !== "CstSeqStartEvent"
    ? Result.succeed([event._tag, event.depth, event.source])
    : Result.failVoid);

const cases = [
  { name: "block sequence values reset the next key", text: "a:\n  - b\nc: d", expected: [["CstKeyEvent", 1, "a"], ["CstScalarEvent", 3, "b"], ["CstKeyEvent", 2, "c"], ["CstValueEvent", 2, "d"]] },
  { name: "directives, comments and unresolved document scalars", text: "%YAML 1.2\n---\ntrue\n# tail\n", expected: [["CstDirectiveEvent", 1, "%YAML 1.2"], ["CstScalarEvent", 1, "true"], ["CstCommentEvent", 1, "# tail"]] },
  { name: "document metadata and aliases", text: "&a !str true\n*ref\n", expected: [["CstScalarEvent", 1, "true"], ["CstAliasEvent", 1, "*ref"]] },
  { name: "block scalar source", text: "|\n  hello\n", expected: [["CstScalarEvent", 1, "|\n  hello\n"]] },
  { name: "explicit block keys", text: "? a\n: b", expected: [["CstKeyEvent", 2, "a"], ["CstValueEvent", 2, "b"]] },
  { name: "recovered directive inside a block map", text: "a: 1\n%YAML 1.2\nb: 2", expected: [["CstKeyEvent", 1, "a"], ["CstValueEvent", 2, "1"], ["CstDirectiveEvent", 2, "%YAML 1.2"], ["CstKeyEvent", 2, "b"], ["CstValueEvent", 2, "2"]] },
  { name: "block metadata, alias, flow collections and literal value", text: "a: &x !str true # value\nb: *x\nc: {d: 1, e: [2, 3]}\nf: |\n  text\n", expected: [["CstKeyEvent", 1, "a"], ["CstValueEvent", 2, "true"], ["CstCommentEvent", 2, "# value"], ["CstKeyEvent", 2, "b"], ["CstAliasEvent", 2, "*x"], ["CstKeyEvent", 2, "c"], ["CstKeyEvent", 3, "d"], ["CstValueEvent", 3, "1"], ["CstKeyEvent", 3, "e"], ["CstScalarEvent", 4, "2"], ["CstScalarEvent", 4, "3"], ["CstKeyEvent", 2, "f"], ["CstValueEvent", 2, "|\n  text\n"]] },
  { name: "flow entry roles after aliases and collections", text: "{a: &x !str true, b: *x, c: {d: 1}, e: [2, {f: 3}], ? g: 4, # hi\nh: 5}", expected: [["CstKeyEvent", 2, "a"], ["CstValueEvent", 2, "true"], ["CstKeyEvent", 2, "b"], ["CstAliasEvent", 2, "*x"], ["CstKeyEvent", 2, "c"], ["CstKeyEvent", 3, "d"], ["CstValueEvent", 3, "1"], ["CstKeyEvent", 2, "e"], ["CstScalarEvent", 3, "2"], ["CstKeyEvent", 4, "f"], ["CstValueEvent", 4, "3"], ["CstKeyEvent", 2, "g"], ["CstValueEvent", 2, "4"], ["CstCommentEvent", 2, "# hi"], ["CstKeyEvent", 2, "h"], ["CstValueEvent", 2, "5"]] },
];

describe("CST visitor coverage", () => {
  for (const { name, text, expected } of cases) {
    it.effect(name, () => Effect.sync(() => assert.deepStrictEqual(leaves(text), expected)));
  }

  for (const text of ['"unterminated', 'a: "unterminated', '{a: "unterminated}', '['.repeat(270) + 'x' + ']'.repeat(270), '{a: '.repeat(270) + 'x' + '}'.repeat(270), 'a:\n' + A.join(A.makeBy(270, (i) => '  '.repeat(i + 1) + 'a:\n'), '')]) {
    it.effect(`surfaces lexical or depth errors for ${text.slice(0, 24)}`, () => Effect.sync(() => {
      const events = [...cstEvents(text)];
      assert.isAbove(A.filter(events, (event) => event._tag === "CstErrorEvent").length, 0);
      assertSome(A.last(events), { _tag: "CstDocumentEndEvent", path: [], depth: 0 });
    }));
  }

  it.effect("empty containers and multi-document boundaries stay balanced", () => Effect.sync(() => {
    const events = [...cstEvents("---\n{}\n---\n[]\n---\n")];
    assert.deepStrictEqual(A.map(events, (event) => [event._tag, event.depth]), [
      ["CstDocumentStartEvent", 0], ["CstMapStartEvent", 1], ["CstMapEndEvent", 1], ["CstDocumentEndEvent", 0],
      ["CstDocumentStartEvent", 0], ["CstSeqStartEvent", 1], ["CstSeqEndEvent", 1], ["CstDocumentEndEvent", 0],
      ["CstDocumentStartEvent", 0], ["CstDocumentEndEvent", 0],
    ]);
  }));
});
