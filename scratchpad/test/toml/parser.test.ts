import { assert, describe, it } from "@effect/vitest";
import type { TomlErrorCodeRaw } from "../../effected/toml/internal/diagnostics.ts";
import { isRawTomlError } from "../../effected/toml/internal/diagnostics.ts";
import { isGuardExceeded } from "../../effected/toml/internal/limits.ts";
import { parseExpressions } from "../../effected/toml/internal/parser.ts";
import { TomlLocalDate } from "../../effected/toml/TomlDateTime.ts";
import type { TomlExpression } from "../../effected/toml/TomlNode.ts";
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
} from "../../effected/toml/TomlNode.ts";

/** Parse and assert the span-tiling invariant: the expression slices rebuild the source byte-exactly. */
function tiles(src: string): ReadonlyArray<TomlExpression> {
	const exprs = parseExpressions(src);
	assert.strictEqual(exprs.map((e) => src.slice(e.offset, e.offset + e.length)).join(""), src);
	return exprs;
}

/** Assert `parseExpressions(src)` throws a RawTomlError with `code` (and `offset`, when given). */
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

/** The parsed key-value at `index`, asserted to be a TomlKeyValue. */
function keyValueAt(exprs: ReadonlyArray<TomlExpression>, index: number): TomlKeyValue {
	const expr = exprs[index];
	if (!(expr instanceof TomlKeyValue)) {
		throw new Error(`expected expression ${index} to be a TomlKeyValue, got ${expr?._tag}`);
	}
	return expr;
}

describe("parser", () => {
	describe("tiling", () => {
		it("tiles a mixed document with headers, dotted keys, comments and blank runs", () => {
			const src = [
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
			].join("\n");
			const exprs = tiles(src);
			// the two comment lines and the following blank line coalesce into ONE trivia
			assert.isTrue(exprs[0] instanceof TomlTrivia);
			assert.isFalse(exprs[1] instanceof TomlTrivia);
			assert.strictEqual(exprs.filter((e) => e instanceof TomlTrivia).length, 3);
		});
		it("tiles a CRLF document", () => {
			const src = "[a]\r\n# c\r\nx = 1\r\n\r\ny = 2 # done\r\n";
			const exprs = tiles(src);
			assert.strictEqual(exprs.length, 5);
			assert.isTrue(exprs[0] instanceof TomlTableHeader);
			assert.isTrue(exprs[1] instanceof TomlTrivia);
			assert.isTrue(exprs[3] instanceof TomlTrivia);
			assert.strictEqual(keyValueAt(exprs, 4).comment, "done");
		});
		it("tiles a document with multiline strings extending their expression span", () => {
			const src = "s1 = \"\"\"\nmulti\nline\"\"\"\ns2 = '''raw\nlines''' # after\nz = 1\n";
			const exprs = tiles(src);
			assert.strictEqual(exprs.length, 3);
			const s1 = keyValueAt(exprs, 0);
			assert.isTrue(s1.value instanceof TomlString);
			assert.strictEqual((s1.value as TomlString).value, "multi\nline");
			assert.strictEqual(keyValueAt(exprs, 1).comment, "after");
		});
		it("tiles a multi-line array with inner comments", () => {
			const src = [
				"arr = [ # opening",
				"\t1, # one",
				"\t2,",
				"\t# a lone comment line",
				"\t3,",
				"]",
				"done = true",
				"",
			].join("\n");
			const exprs = tiles(src);
			assert.strictEqual(exprs.length, 2);
			const arr = keyValueAt(exprs, 0).value;
			assert.isTrue(arr instanceof TomlArray);
			assert.strictEqual((arr as TomlArray).items.length, 3);
		});
		it("tiles a BOM-prefixed document without a trailing newline", () => {
			const src = "\uFEFF# note\na = 1";
			const exprs = tiles(src);
			assert.strictEqual(exprs.length, 2);
			assert.isTrue(exprs[0] instanceof TomlTrivia);
			assert.strictEqual(exprs[0]?.offset, 0);
		});
		it("tiles a whitespace-heavy document with quoted keys and a trailing blank run", () => {
			const src = '\t[ a . "b c" ]\n\tx\t=\t{ p = 1, q.r = [1, [2]] }\n"" = \'empty\'\n\n   ';
			const exprs = tiles(src);
			assert.isTrue(exprs[0] instanceof TomlTableHeader);
			assert.isTrue(exprs.at(-1) instanceof TomlTrivia);
		});
	});

	describe("shapes", () => {
		it("parses a dotted key with mixed kinds", () => {
			const kv = keyValueAt(parseExpressions('a.b."c d" = 1'), 0);
			assert.deepStrictEqual(
				kv.keyPath.map((k) => k.kind),
				["bare", "bare", "basic"],
			);
			assert.deepStrictEqual(
				kv.keyPath.map((k) => k.value),
				["a", "b", "c d"],
			);
			assert.isTrue(kv.value instanceof TomlInteger);
		});
		it("parses table and array-of-tables headers", () => {
			const exprs = parseExpressions("[t.u]\n[[t.u.v]]\n");
			const header = exprs[0];
			assert.isTrue(header instanceof TomlTableHeader);
			assert.deepStrictEqual(
				(header as TomlTableHeader).keyPath.map((k) => k.value),
				["t", "u"],
			);
			const arrayHeader = exprs[1];
			assert.isTrue(arrayHeader instanceof TomlArrayTableHeader);
			assert.deepStrictEqual(
				(arrayHeader as TomlArrayTableHeader).keyPath.map((k) => k.value),
				["t", "u", "v"],
			);
		});
		it("decodes a trailing comment onto the expression", () => {
			const kv = keyValueAt(parseExpressions("a = 1 # c"), 0);
			assert.strictEqual(kv.comment, "c");
			const header = parseExpressions("[t] # section\n")[0];
			assert.isTrue(header instanceof TomlTableHeader);
			assert.strictEqual((header as TomlTableHeader).comment, "section");
			const bare = keyValueAt(parseExpressions("a = 1\n"), 0);
			assert.isFalse(Object.hasOwn(bare, "comment"));
		});
		it("records key spans into the source", () => {
			const src = "  'k' = 1\n";
			const kv = keyValueAt(parseExpressions(src), 0);
			const key = kv.keyPath[0];
			assert.strictEqual(src.slice(key?.offset, (key?.offset ?? 0) + (key?.length ?? 0)), "'k'");
			assert.strictEqual(kv.offset, 0);
		});
	});

	describe("values", () => {
		it("parses nested arrays and inline tables", () => {
			const kv = keyValueAt(parseExpressions("a = [[1,2],{a=1}]"), 0);
			const outer = kv.value as TomlArray;
			assert.isTrue(outer instanceof TomlArray);
			const inner = outer.items[0] as TomlArray;
			assert.isTrue(inner instanceof TomlArray);
			assert.deepStrictEqual(
				inner.items.map((i) => (i as TomlInteger).value),
				[1, 2],
			);
			const table = outer.items[1] as TomlInlineTable;
			assert.isTrue(table instanceof TomlInlineTable);
			assert.strictEqual(table.entries.length, 1);
			const entryValue = table.entries[0]?.value as TomlInteger;
			assert.strictEqual(entryValue.value, 1);
		});
		it("parses a heterogeneous array", () => {
			const kv = keyValueAt(parseExpressions('a = [1, "two", 3.5, true, 1979-05-27]'), 0);
			const items = (kv.value as TomlArray).items;
			assert.isTrue(items[0] instanceof TomlInteger);
			assert.isTrue(items[1] instanceof TomlString);
			assert.isTrue(items[2] instanceof TomlFloat);
			assert.isTrue(items[3] instanceof TomlBoolean);
			assert.isTrue(items[4] instanceof TomlDateTimeLiteral);
			assert.isTrue((items[4] as TomlDateTimeLiteral).value instanceof TomlLocalDate);
		});
		it("parses empty arrays and empty inline tables", () => {
			const exprs = parseExpressions("a = []\nb = {}\n");
			assert.strictEqual((keyValueAt(exprs, 0).value as TomlArray).items.length, 0);
			assert.strictEqual((keyValueAt(exprs, 1).value as TomlInlineTable).entries.length, 0);
		});
		it("parses dotted keys inside inline tables", () => {
			const kv = keyValueAt(parseExpressions("t = {a.b = 1}"), 0);
			const table = kv.value as TomlInlineTable;
			assert.deepStrictEqual(
				table.entries[0]?.keyPath.map((k) => k.value),
				["a", "b"],
			);
		});
		it("distinguishes integers from floats and keeps big integers as bigint", () => {
			const exprs = parseExpressions("i = 1\nf = 1.0\ne = 1e2\nx = 0xEF\nbig = 9007199254740993\nn = nan\n");
			assert.isTrue(keyValueAt(exprs, 0).value instanceof TomlInteger);
			assert.isTrue(keyValueAt(exprs, 1).value instanceof TomlFloat);
			assert.isTrue(keyValueAt(exprs, 2).value instanceof TomlFloat);
			assert.isTrue(keyValueAt(exprs, 3).value instanceof TomlInteger);
			assert.strictEqual((keyValueAt(exprs, 3).value as TomlInteger).value, 239);
			assert.strictEqual((keyValueAt(exprs, 4).value as TomlInteger).value, 9007199254740993n);
			assert.isTrue(Number.isNaN((keyValueAt(exprs, 5).value as TomlFloat).value));
		});
		it("records string styles for all four forms", () => {
			const exprs = parseExpressions("a = \"b\"\nc = 'd'\ne = \"\"\"f\"\"\"\ng = '''h'''\n");
			const styles = [0, 1, 2, 3].map((i) => (keyValueAt(exprs, i).value as TomlString).style);
			assert.deepStrictEqual(styles, ["basic", "literal", "multiline-basic", "multiline-literal"]);
		});
		it("allows a trailing comma in arrays", () => {
			const kv = keyValueAt(parseExpressions("a = [1, 2,]"), 0);
			assert.strictEqual((kv.value as TomlArray).items.length, 2);
		});
		it("allows a trailing comma in inline tables (TOML 1.1)", () => {
			const kv = keyValueAt(parseExpressions("a = {b = 1,}"), 0);
			assert.strictEqual((kv.value as TomlInlineTable).entries.length, 1);
		});
		it("allows newlines and comments inside inline tables (TOML 1.1)", () => {
			const src = ["t = { # opening", "\ta = 1, # one", "\t# a lone comment line", "\tb = 2,", "}", ""].join("\n");
			const exprs = tiles(src);
			assert.strictEqual(exprs.length, 1);
			const table = keyValueAt(exprs, 0).value as TomlInlineTable;
			assert.strictEqual(table.entries.length, 2);
			assert.deepStrictEqual(
				table.entries.map((entry) => entry.keyPath[0]?.value),
				["a", "b"],
			);
		});
		it("allows a comment-only empty inline table (TOML 1.1)", () => {
			const kv = keyValueAt(parseExpressions("a = { # comment\n}\n"), 0);
			assert.strictEqual((kv.value as TomlInlineTable).entries.length, 0);
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
			// TOML 1.1 relaxes ws-comment-newline around entries, NOT keyval-sep.
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
				const src = `a = ${"[".repeat(depth)}${"]".repeat(depth)}`;
				const exprs = tiles(src);
				assert.isTrue(keyValueAt(exprs, 0).value instanceof TomlArray);
			}
		});
		it("throws GuardExceeded at the 257th opening bracket", () => {
			const src = `a = ${"[".repeat(257)}1${"]".repeat(257)}`;
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
			const src = `a = ${"[{k = ".repeat(128)}[`;
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
