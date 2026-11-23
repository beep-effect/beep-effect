import { isRawTomlError } from "@beep/toml/internal/diagnostics";
import { isGuardExceeded } from "@beep/toml/internal/limits";
import { parseExpressions } from "@beep/toml/internal/parser";
import { TomlLocalDate } from "@beep/toml/TomlDateTime";
import {
  TomlArray,
  TomlArrayTableHeader,
  TomlBoolean,
  TomlDateTimeLiteral,
  TomlFloat,
  TomlInlineTable,
  TomlInteger,
  TomlKeyValue,
  TomlString,
  TomlTableHeader,
  TomlTrivia,
} from "@beep/toml/TomlNode";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import type { TomlErrorCodeRaw } from "@beep/toml/internal/diagnostics";
import type { TomlExpression } from "@beep/toml/TomlNode";

function tiles(src: string): ReadonlyArray<TomlExpression> {
  const exprs = parseExpressions(src);
  assert.strictEqual(
    A.join(
      A.map(exprs, (e) => Str.slice(e.offset, e.offset + e.length)(src)),
      ""
    ),
    src
  );
  return exprs;
}

function assertParseError(src: string, code: TomlErrorCodeRaw, offset?: number): void {
  try {
    parseExpressions(src);
  } catch (error) {
    if (!isRawTomlError(error)) {
      throw error;
    }
    assert.strictEqual(error.diagnostic.code, code);
    if (offset !== undefined) {
      assert.strictEqual(error.diagnostic.offset, offset);
    }
    return;
  }
  assert.fail(`expected RawTomlError with code ${code}, but nothing was thrown`);
}

function keyValueAt(exprs: ReadonlyArray<TomlExpression>, index: number): TomlKeyValue {
  const expr = exprs[index];
  if (!Schema.is(TomlKeyValue)(expr)) {
    throw new Error(`expected expression ${index} to be a TomlKeyValue, got ${expr?._tag}`);
  }
  return expr;
}

function checkedNode<T>(node: unknown, schema: Schema.Schema<T>): T {
  if (!Schema.is(schema)(node)) {
    assert.fail("expected the parsed node to match its schema");
  }
  return node;
}

describe("parser", () => {
  describe("tiling", () => {
    it("tiles a mixed document with headers, dotted keys, comments and blank runs", () => {
      const src = A.join(
        [
          "# top comment",
          "# second line",
          "",
          'title = "TOML" # trailing',
          "",
          "[owner]",
          'name = "Tom"',
          "dob = 1979-05-27T07:32:00-08:00",
          "",
          "[[products]]",
          "sku = 738594937",
          "a.b.c = 1",
          "",
        ],
        "\n"
      );
      const exprs = tiles(src);
      assert.isTrue(Schema.is(TomlTrivia)(exprs[0]));
      assert.isFalse(
        Schema.is(TomlTrivia)(exprs[1]),
        "the two comment lines and the following blank line coalesce into one trivia"
      );
      assert.strictEqual(A.filter(exprs, (e) => Schema.is(TomlTrivia)(e)).length, 3);
    });
    it("tiles a CRLF document", () => {
      const src = "[a]\r\n# c\r\nx = 1\r\n\r\ny = 2 # done\r\n";
      const exprs = tiles(src);
      assert.strictEqual(exprs.length, 5);
      assert.isTrue(Schema.is(TomlTableHeader)(exprs[0]));
      assert.isTrue(Schema.is(TomlTrivia)(exprs[1]));
      assert.isTrue(Schema.is(TomlTrivia)(exprs[3]));
      assert.strictEqual(keyValueAt(exprs, 4).comment, "done");
    });
    it("tiles a document with multiline strings extending their expression span", () => {
      const src = "s1 = \"\"\"\nmulti\nline\"\"\"\ns2 = '''raw\nlines''' # after\nz = 1\n";
      const exprs = tiles(src);
      assert.strictEqual(exprs.length, 3);
      const s1 = keyValueAt(exprs, 0);
      assert.isTrue(Schema.is(TomlString)(s1.value));
      assert.strictEqual(checkedNode(s1.value, TomlString).value, "multi\nline");
      assert.strictEqual(keyValueAt(exprs, 1).comment, "after");
    });
    it("tiles a multi-line array with inner comments", () => {
      const src = A.join(
        ["arr = [ # opening", "\t1, # one", "\t2,", "\t# a lone comment line", "\t3,", "]", "done = true", ""],
        "\n"
      );
      const exprs = tiles(src);
      assert.strictEqual(exprs.length, 2);
      const arr = keyValueAt(exprs, 0).value;
      assert.isTrue(Schema.is(TomlArray)(arr));
      assert.strictEqual(checkedNode(arr, TomlArray).items.length, 3);
    });
    it("tiles a BOM-prefixed document without a trailing newline", () => {
      const src = "\uFEFF# note\na = 1";
      const exprs = tiles(src);
      assert.strictEqual(exprs.length, 2);
      assert.isTrue(Schema.is(TomlTrivia)(exprs[0]));
      assert.strictEqual(exprs[0]?.offset, 0);
    });
    it("tiles a whitespace-heavy document with quoted keys and a trailing blank run", () => {
      const src = '\t[ a . "b c" ]\n\tx\t=\t{ p = 1, q.r = [1, [2]] }\n"" = \'empty\'\n\n   ';
      const exprs = tiles(src);
      assert.isTrue(Schema.is(TomlTableHeader)(exprs[0]));
      assert.isTrue(Schema.is(TomlTrivia)(exprs.at(-1)));
    });
  });

  describe("shapes", () => {
    it("parses a dotted key with mixed kinds", () => {
      const kv = keyValueAt(parseExpressions('a.b."c d" = 1'), 0);
      assert.deepStrictEqual(
        A.map(kv.keyPath, (k) => k.kind),
        ["bare", "bare", "basic"]
      );
      assert.deepStrictEqual(
        A.map(kv.keyPath, (k) => k.value),
        ["a", "b", "c d"]
      );
      assert.isTrue(Schema.is(TomlInteger)(kv.value));
    });
    it("parses table and array-of-tables headers", () => {
      const exprs = parseExpressions("[t.u]\n[[t.u.v]]\n");
      const header = exprs[0];
      assert.isTrue(Schema.is(TomlTableHeader)(header));
      assert.deepStrictEqual(
        A.map(checkedNode(header, TomlTableHeader).keyPath, (k) => k.value),
        ["t", "u"]
      );
      const arrayHeader = exprs[1];
      assert.isTrue(Schema.is(TomlArrayTableHeader)(arrayHeader));
      assert.deepStrictEqual(
        A.map(checkedNode(arrayHeader, TomlArrayTableHeader).keyPath, (k) => k.value),
        ["t", "u", "v"]
      );
    });
    it("decodes a trailing comment onto the expression", () => {
      const kv = keyValueAt(parseExpressions("a = 1 # c"), 0);
      assert.strictEqual(kv.comment, "c");
      const header = parseExpressions("[t] # section\n")[0];
      assert.isTrue(Schema.is(TomlTableHeader)(header));
      assert.strictEqual(checkedNode(header, TomlTableHeader).comment, "section");
      const bare = keyValueAt(parseExpressions("a = 1\n"), 0);
      assert.notInclude(Reflect.ownKeys(bare), "comment");
    });
    it("records key spans into the source", () => {
      const src = "  'k' = 1\n";
      const kv = keyValueAt(parseExpressions(src), 0);
      const key = kv.keyPath[0];
      assert.strictEqual(Str.slice(key?.offset, (key?.offset ?? 0) + (key?.length ?? 0))(src), "'k'");
      assert.strictEqual(kv.offset, 0);
    });
  });

  describe("values", () => {
    it("parses nested arrays and inline tables", () => {
      const kv = keyValueAt(parseExpressions("a = [[1,2],{a=1}]"), 0);
      const outer = checkedNode(kv.value, TomlArray);
      assert.isTrue(Schema.is(TomlArray)(outer));
      const inner = checkedNode(outer.items[0], TomlArray);
      assert.isTrue(Schema.is(TomlArray)(inner));
      assert.deepStrictEqual(
        A.map(inner.items, (i) => checkedNode(i, TomlInteger).value),
        [1, 2]
      );
      const table = checkedNode(outer.items[1], TomlInlineTable);
      assert.isTrue(Schema.is(TomlInlineTable)(table));
      assert.strictEqual(table.entries.length, 1);
      const entryValue = checkedNode(table.entries[0]?.value, TomlInteger);
      assert.strictEqual(entryValue.value, 1);
    });
    it("parses a heterogeneous array", () => {
      const kv = keyValueAt(parseExpressions('a = [1, "two", 3.5, true, 1979-05-27]'), 0);
      const items = checkedNode(kv.value, TomlArray).items;
      assert.isTrue(Schema.is(TomlInteger)(items[0]));
      assert.isTrue(Schema.is(TomlString)(items[1]));
      assert.isTrue(Schema.is(TomlFloat)(items[2]));
      assert.isTrue(Schema.is(TomlBoolean)(items[3]));
      assert.isTrue(Schema.is(TomlDateTimeLiteral)(items[4]));
      assert.isTrue(Schema.is(TomlLocalDate)(checkedNode(items[4], TomlDateTimeLiteral).value));
    });
    it("parses empty arrays and empty inline tables", () => {
      const exprs = parseExpressions("a = []\nb = {}\n");
      assert.strictEqual(checkedNode(keyValueAt(exprs, 0).value, TomlArray).items.length, 0);
      assert.strictEqual(checkedNode(keyValueAt(exprs, 1).value, TomlInlineTable).entries.length, 0);
    });
    it("parses dotted keys inside inline tables", () => {
      const kv = keyValueAt(parseExpressions("t = {a.b = 1}"), 0);
      const table = checkedNode(kv.value, TomlInlineTable);
      assert.deepStrictEqual(
        A.map(table.entries[0]?.keyPath ?? [], (k) => k.value),
        ["a", "b"]
      );
    });
    it("distinguishes integers from floats and keeps big integers as bigint", () => {
      const exprs = parseExpressions("i = 1\nf = 1.0\ne = 1e2\nx = 0xEF\nbig = 9007199254740993\nn = nan\n");
      assert.isTrue(Schema.is(TomlInteger)(keyValueAt(exprs, 0).value));
      assert.isTrue(Schema.is(TomlFloat)(keyValueAt(exprs, 1).value));
      assert.isTrue(Schema.is(TomlFloat)(keyValueAt(exprs, 2).value));
      assert.isTrue(Schema.is(TomlInteger)(keyValueAt(exprs, 3).value));
      assert.strictEqual(checkedNode(keyValueAt(exprs, 3).value, TomlInteger).value, 239);
      assert.strictEqual(checkedNode(keyValueAt(exprs, 4).value, TomlInteger).value, 9007199254740993n);
      assert.isTrue(Number.isNaN(checkedNode(keyValueAt(exprs, 5).value, TomlFloat).value));
    });
    it("records string styles for all four forms", () => {
      const exprs = parseExpressions("a = \"b\"\nc = 'd'\ne = \"\"\"f\"\"\"\ng = '''h'''\n");
      const styles = A.map([0, 1, 2, 3], (i) => checkedNode(keyValueAt(exprs, i).value, TomlString).style);
      assert.deepStrictEqual(styles, ["basic", "literal", "multiline-basic", "multiline-literal"]);
    });
    it("allows a trailing comma in arrays", () => {
      const kv = keyValueAt(parseExpressions("a = [1, 2,]"), 0);
      assert.strictEqual(checkedNode(kv.value, TomlArray).items.length, 2);
    });
    it("allows a trailing comma in inline tables (TOML 1.1)", () => {
      const kv = keyValueAt(parseExpressions("a = {b = 1,}"), 0);
      assert.strictEqual(checkedNode(kv.value, TomlInlineTable).entries.length, 1);
    });
    it("allows newlines and comments inside inline tables (TOML 1.1)", () => {
      const src = A.join(["t = { # opening", "\ta = 1, # one", "\t# a lone comment line", "\tb = 2,", "}", ""], "\n");
      const exprs = tiles(src);
      assert.strictEqual(exprs.length, 1);
      const table = checkedNode(keyValueAt(exprs, 0).value, TomlInlineTable);
      assert.strictEqual(table.entries.length, 2);
      assert.deepStrictEqual(
        A.map(table.entries, (entry) => entry.keyPath[0]?.value),
        ["a", "b"]
      );
    });
    it("allows a comment-only empty inline table (TOML 1.1)", () => {
      const kv = keyValueAt(parseExpressions("a = { # comment\n}\n"), 0);
      assert.strictEqual(checkedNode(kv.value, TomlInlineTable).entries.length, 0);
    });
  });

  describe("errors", () => {
    it("throws ExpectedValue on a missing value", () => {
      assertParseError("a =", "ExpectedValue");
      assertParseError("a = # comment", "ExpectedValue");
    });
    it("throws ExpectedEquals when the equals sign is missing", () => {
      assertParseError("a 1", "ExpectedEquals", 2);
    });
    it("throws ExpectedKey on missing or empty keys", () => {
      assertParseError("= 1", "ExpectedKey", 0);
      assertParseError("[a.]", "ExpectedKey");
      assertParseError("[.a]", "ExpectedKey");
      assertParseError("a. = 1", "ExpectedKey");
    });
    it("throws ExpectedTableHeaderClose on an unclosed header", () => {
      assertParseError("[t", "ExpectedTableHeaderClose");
      assertParseError("[[t]", "ExpectedTableHeaderClose");
    });
    it("throws UnterminatedArray on an unclosed array", () => {
      assertParseError("a = [1", "UnterminatedArray");
      assertParseError("a = [1 2]", "UnterminatedArray");
    });
    it("throws UnterminatedInlineTable on an unclosed inline table", () => {
      assertParseError("a = {b = 1", "UnterminatedInlineTable");
      assertParseError("a = {b = 1,", "UnterminatedInlineTable");
      assertParseError("a = {b = 1 c = 2}", "UnterminatedInlineTable");
    });
    it("keeps keyval-sep newline-free inside inline tables: no newline around =", () => {
      assertParseError("a = {b\n= 1}", "ExpectedEquals");
      assertParseError("a = {b =\n1}", "ExpectedValue");
    });
    it("rejects a comma-only inline table", () => {
      assertParseError("a = {,}", "ExpectedKey");
      assertParseError("a = {b = 1,,c = 2}", "ExpectedKey");
    });
    it("throws ExpectedNewline on junk after a value or header", () => {
      assertParseError("a = 1 b = 2", "ExpectedNewline", 6);
      assertParseError("[t] x", "ExpectedNewline", 4);
    });
  });

  describe("depth", () => {
    it("parses 255 and 256 nested arrays (inclusive bound)", () => {
      for (const depth of [255, 256]) {
        const src = `a = ${Str.repeat(depth)("[")}${Str.repeat(depth)("]")}`;
        const exprs = tiles(src);
        assert.isTrue(Schema.is(TomlArray)(keyValueAt(exprs, 0).value));
      }
    });
    it("throws GuardExceeded at the 257th opening bracket", () => {
      const src = `a = ${Str.repeat(257)("[")}1${Str.repeat(257)("]")}`;
      try {
        parseExpressions(src);
      } catch (error) {
        if (!isGuardExceeded(error)) {
          throw error;
        }
        assert.strictEqual(error.reason, "NestingDepthExceeded");
        assert.strictEqual(error.limit, 256);
        assert.strictEqual(error.actual, 257);
        assert.strictEqual(error.offset, 4 + 256);
        return;
      }
      assert.fail("expected GuardExceeded, but nothing was thrown");
    });
    it("counts arrays and inline tables against one combined depth", () => {
      const src = `a = ${Str.repeat(128)("[{k = ")}[`;
      try {
        parseExpressions(src);
      } catch (error) {
        if (!isGuardExceeded(error)) {
          throw error;
        }
        assert.strictEqual(error.actual, 257);
        assert.strictEqual(error.offset, 4 + 128 * 6);
        return;
      }
      assert.fail("expected GuardExceeded, but nothing was thrown");
    });
  });
});
