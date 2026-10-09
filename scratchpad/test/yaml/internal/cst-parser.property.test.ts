import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseCSTAll } from "../../../effected/yaml/internal/cst-parser.ts";
import type { CstNode } from "../../../effected/yaml/internal/cst.ts";

const runs = { arbitrary: fcRuns(100) };
const stringify = (documents: readonly CstNode[]): string => A.join(A.map(documents, (document) => document.source), "");
const render = (text: string): string => stringify(parseCSTAll(text));
const syntax = S.Literals([
  "a", ": ", "- ", "? ", "\n", "  ", "# comment\n", "{", "}", "[", "]", ", ", "&anchor ", "*anchor", "!tag ", "|\n  text\n", ">\n  text\n", "'quoted'", '"escaped\\n"', "\uFEFF",
]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("")));

const assertSpans = (node: CstNode, text: string): void => {
  assert.strictEqual(node.source, Str.substring(node.offset, node.offset + node.length)(text));
  for (const child of node.children ?? []) assertSpans(child, text);
};

describe("CST parser property floor", () => {
  it.effect.prop("multi-document framing preserves every document and embedded marker content", [S.Literals([
    "a: 1", "[a, {b: c}]", "|\n  ---\n  ...", "'---'", "# lead\ntrue",
  ]).pipe(S.Array, Arbitrary.schema)], ([contents]) => Effect.sync(() => {
    const text = pipe(contents, A.map((content) => `---\n${content}\n...\n`), A.join(""));
    const documents = parseCSTAll(text);
    assert.strictEqual(documents.length, contents.length === 0 ? 1 : contents.length);
    assert.strictEqual(stringify(documents), text);
    assert.deepStrictEqual(parseCSTAll(stringify(documents)), documents);
    for (const document of documents) assertSpans(document, text);
  }), runs);

  it.effect.prop("CST rendering is idempotent and reparsing preserves the complete tree", [syntax], ([text]) => Effect.sync(() => {
    const parsed = parseCSTAll(text);
    const rendered = stringify(parsed);
    assert.strictEqual(render(rendered), rendered);
    assert.deepStrictEqual(parseCSTAll(rendered), parsed);
  }), runs);

  it.effect.prop("CST preserves every original character and every raw source span", [syntax], ([text]) => Effect.sync(() => {
    const parsed = parseCSTAll(text);
    assert.strictEqual(stringify(parsed), text);
    for (const document of parsed) assertSpans(document, text);
  }), runs);
});
