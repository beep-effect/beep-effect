import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Str from "effect/String";
import { parseCSTAll } from "../../../effected/yaml/internal/cst-parser.ts";
import type { CstNode } from "../../../effected/yaml/internal/cst.ts";

const leaves = (node: CstNode): string =>
  node.children === undefined ? node.source : A.join(A.map(node.children, leaves), "");

const cases = [
  "", "# only comment", " \n\t", "{}", "[]", "[", "{", "---\n...\n",
  "# directive\n%YAML 1.2\n---\na: 1\n...\n# tail\n",
  "a: 1\n---\nb: 2\n...\n",
  "? - a\n  - b\n: - one\n  - two\n? key\n: dependencies:\n    x: 1\n",
  "? a\n: b\n? c\n: d\n",
  "a:\n- x\n- y\nb: z\n", "a: &a !tag\n- x\n- y\n",
  "- - a: 1\n    b: 2\n  - c\n- d\n",
  "- a: 1\n  b:\n    c: 2\n  d: 3\n- e\n",
  "- a: 1\n? x\n: y\n", "- a: 1\n: b\n",
  "- a:\n  |\n    raw\n- z\n", "- a: 1\n  [b]\n  {c: d}\n",
  "a:\n  b: 2\n? c\n: 3\n", "a:\n  b: 2\n: 3\n",
  "- &a !tag x\n- *a\n", "? a\n: scalar\n",
  "a: - x\n  - y\n", "a:\n  - b\n    - c\n",
  "- [a, {b: [c]}]\n- {d: [e]}\n",
  "a: |\n  ---\n  ...\nb: >\n  folded\n", "|\n  raw\n",
  "- a: 1\n---\nb: 2\n", "- a: 1\n...\n", "a: 1\n- x\n", "a: 1\n}\n", "- x\n]\n", "- a: 1\n  }\n",
];

describe("CST parser coverage", () => {
  for (const kind of ["sequence", "compact mapping", "mapped compact mapping"] as const) {
    it.effect(`caps hostile nested ${kind} input`, () => Effect.sync(() => {
      const text = `${kind === "mapped compact mapping" ? "root:\n" : ""}${pipe(A.range(0, 280), A.map((depth) => `${Str.repeat(depth * 2 + (kind === "mapped compact mapping" ? 2 : 0))(" ")}${kind === "sequence" ? "-" : "- key:"}\n`), A.join(""))}`;
      const documents = parseCSTAll(text);
      const errors = (node: CstNode): readonly CstNode[] => node.type === "error" ? [node] : A.flatMap(node.children ?? [], errors);
      assert.isAbove(A.flatMap(documents, errors).length, 0);
      assert.strictEqual(A.join(A.map(documents, leaves), ""), text);
    }));
  }
  for (const [index, text] of A.map(cases, (text, index) => [index, text] as const)) {
    it.effect(`preserves all raw spans in syntax case ${index}`, () => Effect.sync(() => {
      const documents = parseCSTAll(text);
      assert.strictEqual(A.join(A.map(documents, leaves), ""), text);
      for (const document of documents) {
        assert.strictEqual(document.type, "document");
        assert.strictEqual(document.source, Str.substring(document.offset, document.offset + document.length)(text));
      }
    }));
  }

  it.effect("standalone repeated end markers do not create extra documents", () => Effect.sync(() => {
    const documents = parseCSTAll("a\n...\n...\n");
    assert.strictEqual(documents.length, 1);
    assert.strictEqual(A.getUnsafe(documents, 0).source, "a\n...\n");
  }));

  it.effect("caps hostile flow nesting with positioned error nodes", () => Effect.sync(() => {
    const text = `${Str.repeat(280)("[")}x${Str.repeat(280)("]")}`;
    const documents = parseCSTAll(text);
    const errors = (node: CstNode): readonly CstNode[] => node.type === "error" ? [node] : A.flatMap(node.children ?? [], errors);
    const found = A.flatMap(documents, errors);
    assert.isAbove(found.length, 0);
    assert.strictEqual(A.join(A.map(documents, leaves), ""), text);
    for (const error of found) assert.strictEqual(error.source, Str.substring(error.offset, error.offset + error.length)(text));
  }));
});
