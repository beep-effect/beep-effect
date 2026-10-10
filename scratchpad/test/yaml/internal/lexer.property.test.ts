import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { createScanner, lexAll } from "../../../effected/yaml/internal/lexer.ts";
import type { YamlToken } from "../../../effected/yaml/internal/token.ts";

const runs = { arbitrary: fcRuns(100) };
const syntax = S.Literals([
  "a", ": ", "- ", "? ", "\n", "\r", "\r\n", "  ", "\t", "# comment\n",
  "{", "}", "[", "]", ", ", "&anchor ", "*anchor", "!tag ", "!<tag>",
  "|\n  text\n", ">\n  text\n", "'quoted'", '"escaped\\n"', "\uFEFF",
]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("")));
const scalarText = S.Literals(["a", " ", "'", "#", ":", "[", "é", "😀"]).pipe(S.Array, Arbitrary.schema);
const reconstruct = (source: string, tokens: readonly YamlToken[]): string =>
  A.join(A.map(tokens, (token) => Str.substring(token.offset, token.offset + token.length)(source)), "");
const render = (source: string): string => reconstruct(source, lexAll(source));

describe("lexer property floor", () => {
  it.effect.prop("raw-span rendering is idempotent and relexing preserves every token", [syntax], ([source]) => Effect.sync(() => {
    const tokens = lexAll(source);
    const rendered = reconstruct(source, tokens);
    assert.strictEqual(render(rendered), rendered);
    assert.deepStrictEqual(lexAll(rendered), tokens);
    assert.strictEqual(rendered, source);
    let offset = 0;
    for (const token of tokens) {
      assert.strictEqual(token.offset, offset);
      offset += token.length;
    }
    assert.strictEqual(offset, source.length);
  }), runs);

  it.effect.prop("resetting the pull scanner reproduces the batch tokens and clears exhausted state", [syntax], ([source]) => Effect.sync(() => {
    const expected = lexAll(source);
    const scanner = createScanner(source);
    for (let pass = 0; pass < 2; pass++) {
      scanner.setPosition(0);
      assert.strictEqual(scanner.getToken(), null);
      for (const token of expected) {
        assert.strictEqual(scanner.scan(), token.kind);
        assert.deepStrictEqual({
          kind: scanner.getToken(), value: scanner.getTokenValue(),
          offset: scanner.getTokenOffset(), length: scanner.getTokenLength(),
          line: scanner.getTokenLine(), column: scanner.getTokenColumn(),
        }, token);
      }
      assert.strictEqual(scanner.scan(), null);
      assert.strictEqual(scanner.getPosition(), source.length);
    }
  }), runs);

  it.effect.prop("single-quote rendering is stable and preserves scalar content including quotes and hashes", [scalarText], ([characters]) => Effect.sync(() => {
    const value = A.join(characters, "");
    const stringify = (text: string): string => `'${Str.replaceAll("'", "''")(text)}'`;
    const source = stringify(value);
    const tokens = lexAll(source);
    assert.strictEqual(tokens.length, 1);
    assert.strictEqual(tokens[0]?.kind, "scalar");
    assert.strictEqual(tokens[0]?.value, value);
    const rendered = stringify(tokens[0]?.value ?? "");
    assert.strictEqual(rendered, source);
    assert.deepStrictEqual(lexAll(rendered), tokens);
  }), runs);
});
