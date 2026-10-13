import { assert, describe, it } from "@effect/vitest";
import { lex, locate, references, specifierLiterals } from "../../effected/workspaces/internal/sourceText.ts";

/** A `/` that opens a regex blanks the body in the code view; one that divides leaves the code view untouched. */
const divides = (text: string): boolean => lex(text).code === text;

describe("lex: the contextual `of`", () => {
	const divisions = [
		["a variable named of", "const of = 8; const x = of / 2; const y = 8 / 2;"],
		["a property named of", "const x = o.of / 2; const y = 8 / 2;"],
		["an optional-chained property named of", "const x = o?.of / 2; const y = 8 / 2;"],
		["a property named like a keyword", "const x = it.return / 2; const y = 8 / 2;"],
		["of inside a classic for head", "for (let i = of / 2; i < n / 2; i++) {}"],
		["of in a call's parentheses", "const x = f(of / 2, 8 / 2);"],
		["of after a non-null assertion", "const x = of! / 2; const y = 8 / 2;"],
		["an iterable named of", "for (const x of of / 2 / 4) {}"],
		["of after a for...in keyword", "for (x in of / 2 / 4) {}"],
		["of starting a statement after a block", "if (a) {}\nof / 2; const y = 8 / 2;"],
		["of starting a statement after a name", "x\nof / 2; const y = 8 / 2;"],
	] as const;
	for (const [name, text] of divisions) {
		it(`divides after ${name}`, () => assert.isTrue(divides(text), text));
	}

	const regexes = [
		["the for...of keyword", "for (const x of /a b/.exec(s)) {}"],
		["the keyword after a binding named of", "for (const of of /a b/.exec(s)) {}"],
		["the keyword after a destructuring pattern", "for (const [a] of /a b/.exec(s)) {}"],
		["the keyword in a for await head", "for await (const x of /a b/.exec(s)) {}"],
		["a spread of a keyword", "const xs = [...new /a b/.constructor()];"],
	] as const;
	for (const [name, text] of regexes) {
		it(`opens a regex after ${name}`, () => {
			assert.isFalse(divides(text), text);
			assert.notInclude(lex(text).code, "a b", text);
		});
	}
});

describe("sourceText review regressions", () => {
	it("keeps raw escapes and UTF-16 offsets in lex, and cooks only module specifiers", () => {
		const text = 'import p from "\\u006eode:process";';
		const lexed = lex(text);
		assert.strictEqual(lexed.withoutComments, text);
		assert.strictEqual(lexed.code.length, text.length);
		assert.deepStrictEqual(lexed.literals, [{ start: 14, value: "\\u006eode:process" }]);
		assert.deepStrictEqual(specifierLiterals(lexed), [{ start: 14, value: "node:process" }]);
		assert.deepStrictEqual(lexed.literals, [{ start: 14, value: "\\u006eode:process" }]);
	});

	const escapedImports = [
		['import "\\x6eode:process";', "node:process"],
		["export { p } from '\\u{6e}ode:process';", "node:process"],
		['require("\\156ode:process");', "node:process"],
		["import(`\\u006eode:process`);", "node:process"],
		['import("no\\\r\nde:process");', "node:process"],
		['import("\\b\\f\\n\\r\\t\\v\\0\\\\\\\"\\q");', '\b\f\n\r\t\v\0\\"q'],
		["import(`a\r\nb`);", "a\nb"],
		['import("\\u{1d499}");', "𝒙"],
		['import("a\u2028b");', "a\u2028b"],
		['import("a\u2029b");', "a\u2029b"],
	] as const;
	for (const [text, value] of escapedImports) {
		it(`cooks ECMAScript specifier escapes in ${text}`, () => {
			assert.deepStrictEqual(specifierLiterals(lex(text)).map((literal) => literal.value), [value]);
		});
	}

	it("keeps the raw width when rejecting a computed escaped specifier", () => {
		assert.deepStrictEqual(specifierLiterals(lex('import("\\u006eode:process" + name);')), []);
	});

	it("uses full code points in backward identifier scans", () => {
		assert.deepStrictEqual(references("𝒙globalThis.process; globalThis𝒙.process; globalThis.process;", "process"), [55]);
		assert.deepStrictEqual(specifierLiterals(lex('𝒙require("node:process"); require𝒙("node:process");')), []);
		assert.isTrue(divides("const 𝒙return = 8; 𝒙return / 2;"));
	});

	for (const separator of ["\r", "\u2028", "\u2029", "\r\n"]) {
		it(`preserves line terminator ${separator.codePointAt(0)} in all lexed views and locations`, () => {
			const text = `/* a${separator}b */${separator}// harmless${separator}process.touch();`;
			const lexed = lex(text);
			assert.strictEqual(lexed.code.length, text.length);
			assert.strictEqual(lexed.withoutComments.length, text.length);
			assert.deepStrictEqual(lexed.code.split(separator), ["    ", "    ", "           ", "process.touch();"]);
			assert.strictEqual(lexed.withoutComments, lexed.code);
			const offset = text.indexOf("process");
			assert.deepStrictEqual(references(lexed.code, "process"), [offset]);
			assert.deepStrictEqual(locate(text)(offset), { line: 4, column: 1 });
		});
	}
});


describe("sourceText cooked identifier regressions", () => {
	const reads = [
		"\\u0070rocess",
		"\\u{70}rocess",
		"pr\\u006fcess",
		"pr\\u006Fcess",
		"proce\\u0073\\u0073",
	] as const;
	for (const raw of reads) {
		it(`matches the whole cooked identifier ${raw} at its original UTF-16 offset`, () => {
			const text = `const label = "😀"; /* comment */\r\nconst p = ${raw};`;
			const lexed = lex(text);
			const at = text.indexOf(raw);
			assert.strictEqual(lexed.withoutComments.length, text.length);
			assert.strictEqual(lexed.code.length, text.length);
			assert.strictEqual(lexed.code.slice(at, at + raw.length), raw);
			assert.deepStrictEqual(references(lexed.code, "process"), [at]);
			assert.deepStrictEqual(locate(text)(at), { line: 2, column: 11 });
		});
	}

	const nonReads = [
		"process\\u0078",
		"\\u0078process",
		"process\\u{1d499}",
		"\\u{1d499}process",
		"process\\uD835\\uDC99",
		"child.\\u0070rocess",
		"child?.\\u{70}rocess",
		"this.#\\u0070rocess",
		"({ \\u0070rocess: 1 })",
		"interface I { \\u{70}rocess?: string }",
		"\\u007Zprocess",
		"process\\u00ZZ",
		"\\u{110000}process",
		"process\\u0020",
		"process\\u{D800}",
		"\\U0070rocess",
		"\\u{70rocess",
	] as const;
	for (const text of nonReads) {
		it(`excludes longer names, members, keys and invalid escapes in ${text}`, () => {
			assert.deepStrictEqual(references(lex(text).code, "process"), []);
		});
	}

	it("cooks the global receiver without changing the reference offset", () => {
		const text = "globalTh\\u0069s?.\\u0070rocess; global\\u{54}his.process;";
		assert.deepStrictEqual(references(lex(text).code, "process"), [17, 47]);
	});

	const calls = [
		"\\u0072equire",
		"re\\u0071uire",
		"requir\\u{65}",
		"require?.",
		"\\u0072equire?.",
		"requir\\u{65}?.",
		"require /* comment */ ?. /* comment */",
	] as const;
	for (const callee of calls) {
		it(`reads the whole literal argument of standalone ${callee}`, () => {
			const text = `const label = "😀"; ${callee}("node:process");`;
			const lexed = lex(text);
			const start = text.indexOf('"node:process"');
			assert.deepStrictEqual(specifierLiterals(lexed), [{ start, value: "node:process" }]);
			assert.strictEqual(lexed.withoutComments.length, text.length);
			assert.strictEqual(lexed.code.length, text.length);
			assert.deepStrictEqual(lexed.literals, [{ start: 14, value: "😀" }, { start, value: "node:process" }]);
		});
	}

	const nonCalls = [
		'obj.\\u0072equire("node:process")',
		'obj?.\\u0072equire?.("node:process")',
		'obj. /* comment */ require?.("node:process")',
		'obj.#\\u0072equire?.("node:process")',
		'\\u0078require("node:process")',
		'require\\u0078?.("node:process")',
		'requir\\u{110000}("node:process")',
		'\\u00ZZrequire?.("node:process")',
		'\\u0020require("node:process")',
		'\\u{require("node:process")',
		'\\U0072equire("node:process")',
		'require?.("node:process" + name)',
		'\\u0072equire?.(`node:${name}`)',
		'require?.(name)',
		'import?.("node:process")',
	] as const;
	for (const text of nonCalls) {
		it(`excludes member calls, longer names, invalid escapes and computed arguments in ${text}`, () => {
			assert.deepStrictEqual(specifierLiterals(lex(text)), []);
		});
	}
});

it("rejects an incomplete Unicode escape used as a global receiver", () => {
  const source = "\\u{.process";
  assert.deepStrictEqual(references(lex(source).code, "process"), []);
  assert.deepStrictEqual(references(lex("globalThis.process").code, "process"), [11]);
});

it("rejects closing-brace receivers outside a complete contiguous Unicode escape", () => {
  assert.deepStrictEqual(references(lex("{}.process").code, "process"), []);
  assert.deepStrictEqual(references(lex("\\u{ 70}.process").code, "process"), []);
  assert.deepStrictEqual(references(lex("global\\u{54}his.process").code, "process"), [16]);
});
