import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { createScanner, lexAll } from "../../../effected/yaml/internal/lexer.ts";

describe("lexer scanner boundaries", () => {
  it.effect("accessors are empty before scanning, after exhaustion, and after reset", () => Effect.sync(() => {
    const scanner = createScanner("\uFEFFa\r\nb\rc\nd");
    const empty = () => {
      assert.strictEqual(scanner.getToken(), null);
      assert.strictEqual(scanner.getTokenValue(), "");
      assert.strictEqual(scanner.getTokenOffset(), 0);
      assert.strictEqual(scanner.getTokenLength(), 0);
      assert.strictEqual(scanner.getTokenLine(), 0);
      assert.strictEqual(scanner.getTokenColumn(), 0);
    };
    empty();
    assert.strictEqual(scanner.getPosition(), 0);
    for (const [position, value, line] of [[1, "a", 0], [4, "b", 1], [6, "c", 2], [8, "d", 3]] as const) {
      scanner.setPosition(position);
      empty();
      assert.strictEqual(scanner.scan(), "scalar");
      assert.strictEqual(scanner.getTokenValue(), value);
      assert.strictEqual(scanner.getTokenLine(), line);
      assert.strictEqual(scanner.getTokenColumn(), 0);
    }
    scanner.setPosition(100);
    assert.strictEqual(scanner.getPosition(), 9);
    assert.strictEqual(scanner.scan(), null);
    empty();
    scanner.setPosition(-1);
    assert.strictEqual(scanner.getPosition(), 0);
    assert.strictEqual(scanner.scan(), "byte-order-mark");
  }));

  for (const [source, value] of [
    ["|+\n \t", "\t\n"], ["|+\r\r", "\n"], ["|+\r\n\r\n", "\n"],
    ["|2\n  a", "a\n"], ["-key: |2\n  a", "a\n"], ["-\tkey: |2\n    a", "a\n"],
    ["a:\n  b: !tag\n    |2\n    c", "c\n"],
    [">-\n  a\n\n    b\n\n  c", "a\n\n  b\n\nc"],
    ["|+\n \t\n", "\t\n"], ["|+\n\n ", "\n"],
    ["  key: |2\n    a", "a\n"],
    ["'a\r\nb'", "a b"], ['"a\r\nb"', "a b"],
    ["|+\r\n  a\r\n\r\n", "a\n\n"],
  ] as const) {
    it.effect(`block scalar content for ${source}`, () => Effect.sync(() => {
      const scalars = A.filter(lexAll(source), (token) => token.kind === "scalar");
      assertSome(O.map(A.last(scalars), (token) => token.value), value);
    }));
  }

  it.effect("keep chomp stops before a following zero-indent mapping sibling", () => Effect.sync(() => {
    assert.deepStrictEqual(A.map(A.filter(lexAll("a: |+\nnext"), (token) => token.kind === "scalar"), (token) => token.value), ["a", "", "next"]);
  }));

  for (const source of ["|word", ">word", "|:x", "|;", ">:x", ">;", "...suffix"]) {
    it.effect(`non-header punctuation remains plain scalar content: ${source}`, () => Effect.sync(() => {
      assert.strictEqual(lexAll(source)[0]?.value, source);
      assert.strictEqual(lexAll(source)[0]?.kind, "scalar");
    }));
  }

  for (const source of ["&", "*", "&\n", "*\r", "!<tag\n", "!<tag", '"\\U0000000G"', '"\\U0"']) {
    it.effect(`malformed scalar or sigil produces an error token: ${source}`, () => Effect.sync(() => {
      assert.strictEqual(lexAll(source)[0]?.kind, "error");
    }));
  }

  for (const marker of ["---", "..."]) {
    for (const suffix of ["", " ", "\t", "\n", "\r"]) {
      it.effect(`document boundary ${marker} with separation ${suffix} terminates quoted and block scalars`, () => Effect.sync(() => {
        for (const quote of ["'", '"']) assert.strictEqual(lexAll(`${quote}a\n${marker}${suffix}`)[0]?.kind, "error");
        const tokens = lexAll(`|\n${marker}${suffix}`);
        assert.strictEqual(tokens[0]?.value, "");
        assert.strictEqual(tokens[1]?.kind, marker === "---" ? "document-start" : "document-end");
        const content = lexAll(`|\n  a\n${marker}${suffix}`);
        assert.strictEqual(content[0]?.value, "a\n");
        assert.strictEqual(content[1]?.kind, marker === "---" ? "document-start" : "document-end");
      }));
    }
  }

  for (const prefix of ["-", "key:"]) {
    for (const indicator of ["-", "?"]) {
      for (const suffix of ["", " ", "\t", "\n", "\r"]) {
        const source = `${prefix} \t\t${indicator}${suffix}`;
        it.effect(`tab indentation before nested block syntax is an error: ${source}`, () => Effect.sync(() => {
          assert.strictEqual(A.filter(lexAll(source), (token) => token.kind === "error")[0]?.value, "\t");
        }));
      }
    }
  }

  it.effect("explicit keys reject tab indentation after intervening spaces", () => Effect.sync(() => {
    assert.strictEqual(A.filter(lexAll("?  \t\tkey"), (token) => token.kind === "error")[0]?.value, "\t");
  }));

  for (const source of ["[\n\t", "a:\n \t", "a:\n \t\r", "a:\n \t\n"]) {
    it.effect(`EOF and blank-line tab separation stays whitespace: ${source}`, () => Effect.sync(() => {
      assert.strictEqual(A.filter(lexAll(source), (token) => token.kind === "error").length, 0);
      assert.strictEqual(A.filter(lexAll(source), (token) => token.kind === "whitespace").length, 1);
    }));
  }
});
