import { createScanner, lexAll } from "@beep/yaml/internal/lexer";
import { YamlToken } from "@beep/yaml/internal/token";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import { constant, identity } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const UnknownJson = S.fromJsonString(S.Unknown);

describe("lexer", () => {
  describe("anchor and alias token spans", () => {
    const text = "a: &anc 1\nb: *anc\n";

    it("anchor token span covers the & sigil and the full name", () => {
      const anchor = O.getOrUndefined(A.findFirst(lexAll(text), (t) => t.kind === "anchor"));
      if (anchor === undefined) {
        assert.fail("expected an anchor token");
      }
      assert.strictEqual(Str.slice(anchor.offset, anchor.offset + anchor.length)(text), "&anc");
      assert.strictEqual(anchor.offset, O.getOrElse(constant(-1))(Str.indexOf("&anc")(text)));
      assert.strictEqual(anchor.length, "&anc".length);
    });

    it("alias token span covers the * sigil and the full name", () => {
      const alias = O.getOrUndefined(A.findFirst(lexAll(text), (t) => t.kind === "alias"));
      if (alias === undefined) {
        assert.fail("expected an alias token");
      }
      assert.strictEqual(Str.slice(alias.offset, alias.offset + alias.length)(text), "*anc");
      assert.strictEqual(alias.offset, O.getOrElse(constant(-1))(Str.indexOf("*anc")(text)));
      assert.strictEqual(alias.length, "*anc".length);
    });

    it("anchor and alias token values stay the bare name without the sigil", () => {
      const tokens = lexAll(text);
      assert.strictEqual(O.getOrUndefined(A.findFirst(tokens, (t) => t.kind === "anchor"))?.value, "anc");
      assert.strictEqual(O.getOrUndefined(A.findFirst(tokens, (t) => t.kind === "alias"))?.value, "anc");
    });
  });

  describe("leading byte-order mark (#694)", () => {
    it("the BOM occupies no column, so the first line lexes at the same indent as the rest", () => {
      const tokens = lexAll("\uFEFFa: 1\nb: 2\n");
      const scalars = A.filter(tokens, (t) => t.kind === "scalar" && (t.value === "a" || t.value === "b"));
      assert.deepStrictEqual(
        A.map(scalars, (t) => t.column),
        [0, 0]
      );
      assert.strictEqual(A.filter(tokens, (t) => t.kind === "block-map-start").length, 1);
    });

    it("setPosition replays the BOM without a column, matching scan", () => {
      const scanner = createScanner("\uFEFF---\na: 1\n");
      scanner.setPosition(1);
      assert.strictEqual(scanner.scan(), "document-start");
      assert.strictEqual(scanner.getTokenColumn(), 0);
    });
  });
});

describe("newline positions and scanner reset", () => {
  for (const newline of ["\r", "\r\n", "\n"]) {
    it(`counts ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(newline), identity)} once and resets indentation`, () => {
      const source = `a:${newline}  b: 1${newline}  c: 2${newline}d: 3${newline}`;
      const keys = A.filter(lexAll(source), (token) => ["a", "b", "c", "d"].includes(token.value));
      assert.deepStrictEqual(
        A.map(keys, (token) => [token.value, token.line, token.column]),
        [
          ["a", 0, 0],
          ["b", 1, 2],
          ["c", 2, 2],
          ["d", 3, 0],
        ]
      );
      const scanner = createScanner(source);
      while (scanner.scan() !== null) {
        /* Populate state before reset. */
      }
      scanner.setPosition(O.getOrElse(constant(-1))(Str.indexOf("b")(source)));
      assert.strictEqual(scanner.getToken(), null);
      assert.strictEqual(scanner.scan(), "scalar");
      assert.strictEqual(scanner.getTokenValue(), "b");
      assert.strictEqual(scanner.getTokenLine(), 1);
      assert.strictEqual(scanner.getTokenColumn(), 2);
      scanner.setPosition(O.getOrElse(constant(-1))(Str.indexOf("d")(source)));
      assert.strictEqual(scanner.scan(), "scalar");
      assert.strictEqual(scanner.getTokenValue(), "d");
      assert.strictEqual(scanner.getTokenLine(), 3);
      assert.strictEqual(scanner.getTokenColumn(), 0);
      assert.strictEqual(scanner.scan(), "block-map-start");
      assert.strictEqual(scanner.getTokenColumn(), 0);
    });
  }
});

describe("plain scalar trailing whitespace", () => {
  for (const source of ["hello  ", "a: hello \t", "hello  : value"]) {
    it(`emits consumed whitespace separately for ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(source), identity)}`, () => {
      const tokens = lexAll(source);
      const scalar = O.getOrUndefined(A.findFirst(tokens, (token) => token.value === "hello"));
      assert.isDefined(scalar);
      assert.strictEqual(scalar?.length, 5);
      const whitespace = O.getOrUndefined(
        A.findFirst(tokens, (token) => token.kind === "whitespace" && token.offset === (scalar?.offset ?? 0) + 5)
      );
      assert.isDefined(whitespace);
      assert.strictEqual(whitespace?.column, (scalar?.column ?? 0) + 5);
      assert.strictEqual(
        A.join(
          A.map(tokens, (token) => Str.slice(token.offset, token.offset + token.length)(source)),
          ""
        ),
        source
      );
    });
  }
});

describe("double quoted escape dispatch", () => {
  it("preserves every simple escape substitution", () => {
    const escapes = ["\\", '"', "/", "b", "f", "n", "r", "\t", "t", "0", "a", "e", "v", " ", "N", "_", "L", "P"];
    const expected = [
      "\\",
      '"',
      "/",
      "\b",
      "\f",
      "\n",
      "\r",
      "\t",
      "\t",
      "\0",
      "\x07",
      "\x1B",
      "\x0B",
      " ",
      "\u0085",
      "\u00A0",
      "\u2028",
      "\u2029",
    ];
    const source = `"${A.join(
      A.map(escapes, (escape) => `\\${escape}`),
      ""
    )}"`;
    const tokens = lexAll(source);
    assert.strictEqual(tokens.length, 1);
    assert.strictEqual(tokens[0]?.kind, "scalar");
    assert.strictEqual(tokens[0]?.value, A.join(expected, ""));
    assert.strictEqual(tokens[0]?.length, source.length);
  });
  it("retains hex escapes, line continuations and invalid-escape errors", () => {
    const source = '"\\x41\\u0042\\U00000043\\\n  D\\\r\n  E\\\r  F"';
    assert.strictEqual(lexAll(source)[0]?.value, "ABCDEF");
    for (const invalid of ['"\\q"', '"\\xGG"', '"\\u00GG"', '"\\U00110000"']) {
      assert.strictEqual(lexAll(invalid)[0]?.kind, "error");
    }
  });
});

describe("block-scalar header recovery", () => {
  it("rejects repeated indicators and retains both valid orderings", () => {
    for (const indicator of ["|", ">"]) {
      for (const modifiers of ["++", "--", "+-", "-+", "22", "23"]) {
        const header = `${indicator}${modifiers}`;
        assert.deepStrictEqual(
          lexAll(`${header}\n  a\n`)[0],
          YamlToken.make({
            kind: "error",
            value: header,
            offset: 0,
            length: 3,
            line: 0,
            column: 0,
          })
        );
      }
      for (const modifiers of ["2+", "+2", "2-", "-2"]) {
        const tokens = lexAll(`${indicator}${modifiers}\n  a\n`);
        assert.strictEqual(tokens[0]?.kind, "scalar");
        assert.strictEqual(tokens[0]?.value, Str.includes("-")(modifiers) ? "a" : "a\n");
        assert.isFalse(A.some(tokens, (token) => token.kind === "error"));
      }
    }
  });

  it("emits separated comments after invalid headers with exact spans", () => {
    for (const header of ["> hello ", "| invalid\t", "|++ ", "|22\t"]) {
      for (const newline of ["\n", "\r", "\r\n"]) {
        const tokens = lexAll(`${header}# comment${newline}`);
        assert.deepStrictEqual(tokens.slice(0, 2), [
          YamlToken.make({ kind: "error", value: header, offset: 0, length: header.length, line: 0, column: 0 }),
          YamlToken.make({
            kind: "comment",
            value: "# comment",
            offset: header.length,
            length: 9,
            line: 0,
            column: header.length,
          }),
        ]);
        assert.strictEqual(tokens[2]?.kind, "newline");
        assert.strictEqual(tokens[2]?.offset, header.length + 9);
        assert.strictEqual(tokens[2]?.value, newline);
      }
    }
  });
});

describe("quoted physical line breaks", () => {
  it("folds lone CR and preserves the following token's physical position", () => {
    for (const quote of ['"', "'"]) {
      const source = `${quote}a\rb${quote}\rc`;
      const scalars = A.filter(lexAll(source), (token) => token.kind === "scalar");
      assert.deepStrictEqual(scalars, [
        YamlToken.make({ kind: "scalar", value: "a b", offset: 0, length: 5, line: 0, column: 0 }),
        YamlToken.make({ kind: "scalar", value: "c", offset: 6, length: 1, line: 2, column: 0 }),
      ]);
    }
  });

  it("terminates either quoted scalar at a column-zero marker after lone CR", () => {
    for (const quote of ['"', "'"]) {
      for (const marker of ["---", "..."]) {
        const tokens = lexAll(`${quote}a\r${marker}\n`);
        assert.deepStrictEqual(
          tokens[0],
          YamlToken.make({
            kind: "error",
            value: `${quote}a\r`,
            offset: 0,
            length: 3,
            line: 0,
            column: 0,
          })
        );
        assert.deepStrictEqual(
          tokens[1],
          YamlToken.make({
            kind: marker === "---" ? "document-start" : "document-end",
            value: marker,
            offset: 3,
            length: 3,
            line: 1,
            column: 0,
          })
        );
      }
    }
  });
});
