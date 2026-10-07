import { assert, describe, it } from "@effect/vitest";
import { pipe } from "effect/Function";
import { createScanner, ScanError, type Scanner, SyntaxKind } from "../../effected/jsonc/internal/scanner.ts";

// Scan every token of `text`, pairing each kind with its decoded value and error.
const tokens = (scanner: Scanner): ReadonlyArray<readonly [SyntaxKind, string, ScanError]> => {
  const out: Array<readonly [SyntaxKind, string, ScanError]> = [];
  for (let kind = scanner.scan(); kind !== "EOF"; kind = scanner.scan()) {
    out.push([kind, scanner.getTokenValue(), scanner.getTokenError()]);
  }
  return out;
};

const kinds = (text: string, ignoreTrivia = false): ReadonlyArray<SyntaxKind> =>
  tokens(createScanner(text, ignoreTrivia)).map(([kind]) => kind);

const single = (text: string): readonly [SyntaxKind, string, ScanError] => {
  const scanner = createScanner(text);
  const kind = scanner.scan();
  return [kind, scanner.getTokenValue(), scanner.getTokenError()];
};

describe("createScanner", () => {
  describe("kits", () => {
    it("exposes the token and error vocabularies as literal kits", () => {
      assert.isTrue(SyntaxKind.is.EOF("EOF"));
      assert.isFalse(SyntaxKind.is.EOF("Comma"));
      assert.isTrue(ScanError.is.None("None"));
      assert.strictEqual(SyntaxKind.literals.length, 17);
      assert.strictEqual(ScanError.literals.length, 8);
    });
  });

  describe("calling styles", () => {
    it("preserves trivia by default and with false in both calling styles", () => {
      const text = " /* comment */\n1";
      const scanners = [
        createScanner(text),
        createScanner(text, false),
        createScanner(text, undefined),
        pipe(text, createScanner()),
        pipe(text, createScanner(false)),
        pipe(text, createScanner(undefined)),
      ];
      for (const scanner of scanners) {
        assert.strictEqual(scanner.getToken(), "Unknown");
        assert.deepStrictEqual(
          tokens(scanner).map(([kind]) => kind),
          ["Trivia", "BlockComment", "LineBreak", "Number"]
        );
        assert.strictEqual(scanner.getToken(), "EOF");
        assert.strictEqual(scanner.getTokenOffset(), text.length);
        assert.strictEqual(scanner.getTokenLength(), 0);
      }
    });

    it("skips trivia only when true in both calling styles", () => {
      const text = " /* block */ // line\n1";
      for (const scanner of [createScanner(text, true), pipe(text, createScanner(true))]) {
        assert.strictEqual(scanner.scan(), "Number");
        assert.strictEqual(scanner.getTokenValue(), "1");
        assert.strictEqual(scanner.scan(), "EOF");
      }
    });
  });

  describe("punctuation and keywords", () => {
    it("tokenizes every structural character with its text as value", () => {
      assert.deepStrictEqual(
        tokens(createScanner("{}[]:,")).map(([kind, value]) => `${kind}=${value}`),
        ["OpenBrace={", "CloseBrace=}", "OpenBracket=[", "CloseBracket=]", "Colon=:", "Comma=,"]
      );
    });

    it("recognizes the three keywords and rejects any other lowercase word", () => {
      assert.deepStrictEqual(kinds("true false null"), ["True", "Trivia", "False", "Trivia", "Null"]);
      assert.deepStrictEqual(single("nul"), ["Unknown", "nul", "InvalidSymbol"]);
      assert.deepStrictEqual(single("truex"), ["Unknown", "truex", "InvalidSymbol"]);
    });

    it("reports an unknown character, a lone slash and a lone minus", () => {
      assert.deepStrictEqual(single("@"), ["Unknown", "@", "InvalidCharacter"]);
      assert.deepStrictEqual(single("/x"), ["Unknown", "/", "InvalidCharacter"]);
      assert.deepStrictEqual(single("-x"), ["Unknown", "-", "InvalidSymbol"]);
      assert.deepStrictEqual(single("-"), ["Unknown", "-", "InvalidSymbol"]);
    });
  });

  describe("whitespace and line breaks", () => {
    it("groups every whitespace code unit into one trivia token", () => {
      const text = " \t\u000b\u000c ﻿1";
      const [first, second] = tokens(createScanner(text));
      assert.deepStrictEqual(first, ["Trivia", text.slice(0, -1), "None"]);
      assert.deepStrictEqual(second, ["Number", "1", "None"]);
    });

    it("treats CRLF as one line break and LS, PS, CR and LF as one each", () => {
      const scanner = createScanner("\r\n\r\u2028\u2029\n");
      const lengths: Array<number> = [];
      for (let kind = scanner.scan(); kind !== "EOF"; kind = scanner.scan()) {
        assert.strictEqual(kind, "LineBreak");
        lengths.push(scanner.getTokenLength());
      }
      assert.deepStrictEqual(lengths, [2, 1, 1, 1, 1]);
    });
  });

  describe("numbers", () => {
    it("scans integers, negatives, fractions and exponents", () => {
      for (const text of ["0", "-0", "12", "-34", "1.5", "0.25", "1e5", "1E5", "1e+5", "1e-5", "2.5E-3"]) {
        assert.deepStrictEqual(single(text), ["Number", text, "None"], text);
      }
    });

    it("stops a number at the first non-number character", () => {
      assert.deepStrictEqual(kinds("1]"), ["Number", "CloseBracket"]);
      assert.deepStrictEqual(kinds("01"), ["Number", "Number"]);
    });

    it("reports a truncated fraction or exponent as UnexpectedEndOfNumber", () => {
      assert.deepStrictEqual(single("1."), ["Number", "1.", "UnexpectedEndOfNumber"]);
      assert.deepStrictEqual(single("1.x"), ["Number", "1.", "UnexpectedEndOfNumber"]);
      assert.deepStrictEqual(single("1e"), ["Number", "1e", "UnexpectedEndOfNumber"]);
      assert.deepStrictEqual(single("1e+"), ["Number", "1e+", "UnexpectedEndOfNumber"]);
    });
  });

  describe("strings", () => {
    it("decodes every simple escape and unicode escapes in both hex cases", () => {
      assert.deepStrictEqual(single(String.raw`"\"\\\/\b\f\n\r\t"`), ["String", '"\\/\b\f\n\r\t', "None"]);
      assert.deepStrictEqual(single(String.raw`"\u0041\u00e9\u00E9"`), ["String", "Aéé", "None"]);
      assert.deepStrictEqual(single(String.raw`"\u00AB\uFfFf"`), ["String", "«￿", "None"]);
    });

    it("reports invalid unicode and invalid escape characters while keeping the rest", () => {
      assert.deepStrictEqual(single(String.raw`"a\u00ZZb"`), ["String", "aZZb", "InvalidUnicode"]);
      assert.deepStrictEqual(single(String.raw`"a\u12"`), ["String", "a", "InvalidUnicode"]);
      assert.deepStrictEqual(single(String.raw`"a\xb"`), ["String", "ab", "InvalidEscapeCharacter"]);
    });

    it("ends an unterminated string at a line break or at EOF", () => {
      assert.deepStrictEqual(single('"abc\ndef"'), ["String", "abc", "UnexpectedEndOfString"]);
      assert.deepStrictEqual(single('"abc'), ["String", "abc", "UnexpectedEndOfString"]);
      assert.deepStrictEqual(kinds('"abc\ndef"'), ["String", "LineBreak", "Unknown", "String"]);
    });

    it("flags unescaped control characters but keeps the token intact", () => {
      assert.deepStrictEqual(single(`"a${String.fromCharCode(1)}b"`), ["String", `a${String.fromCharCode(1)}b`, "InvalidCharacter"]);
    });

    it("does not duplicate the buffered prefix when an unterminated string ends with a trailing backslash", () => {
      assert.deepStrictEqual(single('"abc\\'), ["String", "abc", "UnexpectedEndOfString"]);
    });

    it("recovers an empty value for an unterminated string containing only a trailing backslash", () => {
      assert.deepStrictEqual(single('"\\'), ["String", "", "UnexpectedEndOfString"]);
    });

    it("preserves prior decoded escapes when a later trailing backslash terminates the string", () => {
      assert.deepStrictEqual(single('"a\\nb\\'), ["String", "a\nb", "UnexpectedEndOfString"]);
    });
  });

  describe("comments", () => {
    it("scans line comments up to the line break and block comments across lines", () => {
      assert.deepStrictEqual(tokens(createScanner("// note\n/* a\nb */1")), [
        ["LineComment", "// note", "None"],
        ["LineBreak", "\n", "None"],
        ["BlockComment", "/* a\nb */", "None"],
        ["Number", "1", "None"],
      ]);
    });

    it("reports an unterminated block comment and consumes the rest of the input", () => {
      assert.deepStrictEqual(single("/* open"), ["BlockComment", "/* open", "UnexpectedEndOfComment"]);
      assert.deepStrictEqual(single("/*"), ["BlockComment", "/*", "UnexpectedEndOfComment"]);
      assert.deepStrictEqual(single("/* a *"), ["BlockComment", "/* a *", "UnexpectedEndOfComment"]);
    });
  });

  describe("offsets", () => {
    it("reports each token's offset and length against the source", () => {
      const text = ' {"k": [1]} ';
      const scanner = createScanner(text, true);
      const spans: Array<string> = [];
      for (let kind = scanner.scan(); kind !== "EOF"; kind = scanner.scan()) {
        spans.push(text.substring(scanner.getTokenOffset(), scanner.getTokenOffset() + scanner.getTokenLength()));
      }
      assert.deepStrictEqual(spans, ["{", '"k"', ":", "[", "1", "]", "}"]);
    });
  });
});
