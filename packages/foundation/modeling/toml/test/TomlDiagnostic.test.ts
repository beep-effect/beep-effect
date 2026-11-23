import {
  RawTomlError,
  TOML_LEX_ERROR_CODES,
  TOML_PARSE_ERROR_CODES,
  TOML_SEMANTIC_ERROR_CODES,
  TOML_STRINGIFY_ERROR_CODES,
} from "@beep/toml/internal/diagnostics";
import { TomlDiagnostic } from "@beep/toml/TomlDiagnostic";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";

describe("TomlDiagnostic", () => {
  it("derives line and character from offset against LF source", () => {
    const d = TomlDiagnostic.fromRaw("a = 1\nb = ?\n", {
      code: "ExpectedValue",
      message: "expected a value",
      offset: 10,
      length: 1,
    });
    assert.strictEqual(d.line, 1);
    assert.strictEqual(d.character, 4);
  });
  it("derives line and character across CRLF newlines", () => {
    const d = TomlDiagnostic.fromRaw("a = 1\r\nb = ?\r\n", {
      code: "ExpectedValue",
      message: "expected a value",
      offset: 11,
      length: 1,
    });
    assert.strictEqual(d.line, 1);
    assert.strictEqual(d.character, 4);
  });
  it("clamps an offset at EOF to the final position", () => {
    const d = TomlDiagnostic.fromRaw("a = ", { code: "ExpectedValue", message: "m", offset: 4, length: 0 });
    assert.strictEqual(d.line, 0);
    assert.strictEqual(d.character, 4);
  });
  it("derives line and character when the offset lands on the newline itself", () => {
    const d = TomlDiagnostic.fromRaw("a\nb", { code: "ExpectedValue", message: "m", offset: 1, length: 1 });
    assert.strictEqual(d.line, 0);
    assert.strictEqual(d.character, 1);
  });
  it("only parse and stringify share IntegerOutOfRange and NestingDepthExceeded codes", () => {
    const stageArrays = [
      TOML_LEX_ERROR_CODES,
      TOML_PARSE_ERROR_CODES,
      TOML_SEMANTIC_ERROR_CODES,
      TOML_STRINGIFY_ERROR_CODES,
    ];
    for (const codes of stageArrays) {
      assert.strictEqual(new Set(codes).size, codes.length);
    }

    const lex = new Set(TOML_LEX_ERROR_CODES);
    const parse = new Set(TOML_PARSE_ERROR_CODES);
    const semantic = new Set(TOML_SEMANTIC_ERROR_CODES);
    const stringify = new Set(TOML_STRINGIFY_ERROR_CODES);
    const intersect = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
      A.filter([...a], (code) => b.has(code)).sort();

    assert.deepStrictEqual(intersect(lex, parse), []);
    assert.deepStrictEqual(intersect(lex, semantic), []);
    assert.deepStrictEqual(intersect(lex, stringify), []);
    assert.deepStrictEqual(intersect(semantic, parse), []);
    assert.deepStrictEqual(intersect(semantic, stringify), []);
    assert.deepStrictEqual(intersect(parse, stringify), ["IntegerOutOfRange", "NestingDepthExceeded"]);
  });
  it("RawTomlError carries its diagnostic", () => {
    const e = RawTomlError.make({ code: "DuplicateKey", message: "m", offset: 0, length: 1 });
    assert.strictEqual(e.diagnostic.code, "DuplicateKey");
  });
});
