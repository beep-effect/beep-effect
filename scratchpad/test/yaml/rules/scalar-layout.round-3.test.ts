import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Result from "effect/Result";
import * as YAML from "yaml";
import { YamlLint, YamlLintConfig, YamlMap, YamlPair, YamlScalar, YamlSeq } from "../../../effected/yaml/index.ts";
import { walkScalars } from "../../../effected/yaml/internal/rules/util.ts";
import { builtin, testRule, testRuleInference } from "./harness.ts";

describe("composed scalar blank-line fidelity", () => {
	for (const blankCount of [1, 3]) {
		for (const shape of ["mapping", "flow sequence", "block sequence"]) {
			it(`${shape} content with ${blankCount} blank lines never diagnoses, fixes or votes as layout`, () => {
				const breaks = "\n".repeat(blankCount + 1);
				const input = shape === "mapping" ? `a: first${breaks}  second\n` :
					shape === "flow sequence" ? `[first${breaks}  second]\n` : `- first${breaks}  second\n`;
				const value = `first${"\n".repeat(blankCount)}second`;
				const expected = shape === "mapping" ? { a: value } : [value];
				const rule = builtin("empty-lines");
				for (const setting of [{}, { max: 0 }]) {
					const config = YamlLintConfig.make({ rules: { "empty-lines": setting } });
					assert.deepStrictEqual(YamlLint.run(input, [rule], config), []);
					const fixed = Result.getOrThrow(YamlLint.fix(input, [rule], config));
					assert.strictEqual(fixed, input);
					assert.deepStrictEqual(YAML.parse(input), expected);
					assert.deepStrictEqual(YAML.parse(fixed), expected);
				}
				assert.deepStrictEqual(YamlLint.observe(input, [rule]).floors, []);
			});
		}
	}
	it("block-scalar content remains protected while a separate layout run is deleted", () => {
		const input = "a: |\n  hello\n\n\n  world\nb: 1\n\nc: 2\n";
		const rule = builtin("empty-lines");
		const config = YamlLintConfig.make({ rules: { "empty-lines": { max: 0 } } });
		const findings = YamlLint.run(input, [rule], config);
		assert.deepStrictEqual(A.map(findings, (finding) => finding.line), [6]);
		const fixed = Result.getOrThrow(YamlLint.fix(input, [rule], config));
		assert.strictEqual(fixed, "a: |\n  hello\n\n\n  world\nb: 1\nc: 2\n");
		assert.deepStrictEqual(YAML.parse(fixed), { a: "hello\n\n\nworld\n", b: 1, c: 2 });
		assert.deepStrictEqual(YAML.parse(fixed), YAML.parse(input));
		assert.deepStrictEqual(A.map(YamlLint.observe(input, [rule]).floors, (floor) => floor.value), [1]);
	});
});

describe("keep-chomp EOF fidelity", () => {
	for (const header of ["|+", ">+", "|2+", ">+2"]) {
		it(`${header} retains a diagnostic without completing a scalar-content blank line`, () => {
			const rule = builtin("eof-newline");
			const config = YamlLintConfig.make({ rules: { "eof-newline": {} } });
			for (const ending of [" ", "  "]) {
				const input = `a: ${header}\n  hi\n${ending}`;
				const findings = YamlLint.run(input, [rule], config);
				assert.strictEqual(findings.length, 1);
				assert.isUndefined(findings[0]?.fix);
				assert.deepStrictEqual(YAML.parse(input), { a: "hi\n" });
				assert.deepStrictEqual(YAML.parse(`${input}\n`), { a: "hi\n\n" });
				const fixed = Result.getOrThrow(YamlLint.fix(input, [rule], config));
				assert.strictEqual(fixed, input);
				assert.deepStrictEqual(YAML.parse(fixed), YAML.parse(input));
			}
		});
		it(`${header} still inserts EOF after content, extra indentation and tabs`, () => {
			const rule = builtin("eof-newline");
			const config = YamlLintConfig.make({ rules: { "eof-newline": {} } });
			for (const input of [`a: ${header}\n  hi`, `a: ${header}\n  hi\n    `, `a: ${header}\n  hi\n  \t`, `a: ${header}\n  `]) {
				assert.isDefined(YamlLint.run(input, [rule], config)[0]?.fix);
				const fixed = Result.getOrThrow(YamlLint.fix(input, [rule], config));
				assert.strictEqual(fixed, `${input}\n`);
				assert.deepStrictEqual(YAML.parse(fixed), YAML.parse(input));
			}
		});
	}
	it("wholly blank keep-chomp scalars retain previously completed content breaks", () => {
		const rule = builtin("eof-newline");
		const config = YamlLintConfig.make({ rules: { "eof-newline": {} } });
		for (const header of ["|+", ">+", "|2+", ">2+"]) {
			const input = `a: ${header}\n  \n  `;
			assert.isUndefined(YamlLint.run(input, [rule], config)[0]?.fix);
			assert.deepStrictEqual(YAML.parse(input), { a: "\n" });
			assert.deepStrictEqual(YAML.parse(`${input}\n`), { a: "\n\n" });
			const fixed = Result.getOrThrow(YamlLint.fix(input, [rule], config));
			assert.strictEqual(fixed, input);
			assert.deepStrictEqual(YAML.parse(fixed), YAML.parse(input));
		}
	});
	it("explicit content indentation distinguishes retained spaces from an empty line", () => {
		const rule = builtin("eof-newline");
		const config = YamlLintConfig.make({ rules: { "eof-newline": {} } });
		for (const header of ["|2+", ">2+"]) {
			for (const ending of ["  ", "    "]) {
				const input = `a: ${header}\n    hi\n${ending}`;
				const fixed = Result.getOrThrow(YamlLint.fix(input, [rule], config));
				assert.strictEqual(fixed, ending.length === 2 ? input : `${input}\n`);
				assert.deepStrictEqual(YAML.parse(fixed), YAML.parse(input));
			}
		}
	});
});

describe("explicit key document boundaries", () => {
	for (const marker of ["---", "..."]) {
		for (const scalar of ["hello", '"hello"', "|\n    hello"]) {
			it(`${marker} resets an unfinished explicit key before ${scalar}`, () => {
				const input = `? key\n${marker}\n  ${scalar}\n`;
				const rule = builtin("indentation");
				const config = YamlLintConfig.make({ rules: { indentation: { spaces: 4 } } });
				const findings = YamlLint.run(input, [rule], config);
				assert.strictEqual(findings.length, 1);
				assert.strictEqual(findings[0]?.line, 2);
				assert.strictEqual(findings[0]?.message, "Indent of 2 spaces, expected 4");
				assert.deepStrictEqual(A.map(YamlLint.observe(input, [rule]).votes, (vote) => [vote.dimension, vote.value]), [["spaces", 2]]);
			});
		}
	}
	it("same-document explicit plain key continuation remains exempt", () => {
		const input = "? key\n  hello\n";
		const rule = builtin("indentation");
		assert.deepStrictEqual(YamlLint.run(input, [rule], YamlLintConfig.make({ rules: { indentation: { spaces: 4 } } })), []);
		assert.deepStrictEqual(YamlLint.observe(input, [rule]).votes, []);
	});
});

for (const properties of ["&ref", "!!seq", "!!seq &ref"]) {
	testRule(builtin("indentation"), [
		{ name: `own-line ${properties} preserves the unindented policy`, input: `a:\n  ${properties} # metadata\n  - x\n`, setting: { spaces: 2, indentSequences: false }, expected: [{ line: 2, messageIncludes: "should not be indented" }] },
		{ name: `own-line ${properties} preserves the indented policy`, input: `a:\n  ${properties}\n- x\n`, setting: { spaces: 2, indentSequences: true }, expected: [{ line: 2, messageIncludes: "should be indented" }] },
		{ name: `own-line ${properties} cannot hide consistent sequence drift`, input: `a:\n  - x\nb:\n  ${properties}\n- y\n`, expected: [{ line: 4, messageIncludes: "should be indented" }] },
		{ name: `own-line ${properties} still contributes to the indentation stack`, input: `a:\n    ${properties}\n    - x\n`, setting: { spaces: 2 }, expected: [{ line: 1, messageIncludes: "expected 2" }] },
	]);
	testRuleInference(builtin("indentation"), [
		{ name: `own-line ${properties} votes both indentation dimensions`, inputs: [`a:\n  ${properties}\n  - x\n`], strict: { kind: "options", options: { spaces: 2, indentSequences: true } } },
		{ name: `own-line ${properties} still votes spaces on an unindented sequence`, inputs: [`a:\n  ${properties}\n- x\n`], strict: { kind: "options", options: { spaces: 2, indentSequences: false } } },
		{ name: `own-line ${properties} cannot hide a strict sequence conflict`, inputs: [`a:\n  - x\nb:\n  ${properties}\n- y\n`], strict: { kind: "conflict", dimension: "indentSequences", values: [true, false] } },
	]);
}

testRule(builtin("indentation"), [
	{ name: "stream BOM is not indentation", input: "\uFEFFname: Ada\n", setting: { spaces: 2 }, expected: [] },
	{ name: "BOM diagnostic spans the real spaces", input: "\uFEFF  hello\n", setting: { spaces: 4 }, expected: [{ line: 0, character: 1, length: 2, messageIncludes: "expected 4" }] },
	{ name: "BOM cannot train consistent mode as one-space indentation", input: "\uFEFFa:\n  b: 1\nc:\n    d: 2\n", expected: [{ line: 3, character: 0, length: 4, messageIncludes: "expected 2" }] },
	{ name: "alias content interrupts key-sequence pairing", input: "source: &ref x\na:\n  *ref\n- y\n", setting: { indentSequences: true }, expected: [] },
]);
testRuleInference(builtin("indentation"), [
	{ name: "flat BOM input casts no spaces vote", inputs: ["\uFEFFname: Ada\n"], strict: { kind: "none" } },
	{ name: "BOM preserves two-space nesting inference", inputs: ["\uFEFFa:\n  b: 1\n"], strict: { kind: "options", options: { spaces: 2 } } },
	{ name: "BOM sequence offset lookup preserves pairing", inputs: ["\uFEFFa:\n  - x\n"], strict: { kind: "options", options: { spaces: 2, indentSequences: true } } },
]);

describe("YAML indentation alphabet", () => {
	for (const prefix of ["\u00A0", "\u2003", "\uFEFF\uFEFF"]) {
		it(`${JSON.stringify(prefix)} is scalar content rather than an indentation vote`, () => {
			const input = `${prefix}hello\n`;
			const rule = builtin("indentation");
			assert.deepStrictEqual(YamlLint.run(input, [rule], YamlLintConfig.make({ rules: { indentation: { spaces: 2 } } })), []);
			assert.deepStrictEqual(YamlLint.observe(input, [rule]).votes, []);
		});
	}
	it("tab-indented lines remain the parser's business", () => {
		const input = "a:\n \tb: 1\n";
		const rule = builtin("indentation");
		assert.deepStrictEqual(YamlLint.run(input, [rule], YamlLintConfig.make({ rules: { indentation: { spaces: 2 } } })), []);
		assert.deepStrictEqual(YamlLint.observe(input, [rule]).votes, []);
	});
});

for (const key of ["['a', 'b']", "{'a': ['b']}"]) {
	testRule(builtin("quoted-strings"), [
		{ name: `${key} subtree is excluded from quote checking`, input: `? ${key}\n: "value"\n`, expected: [], fixed: `? ${key}\n: "value"\n` },
		{ name: `${key} subtree is excluded while a value quote is fixed`, input: `? ${key}\n: 'value'\n`, expected: [{ line: 1, messageIncludes: "double quotes" }], fixed: `? ${key}\n: "value"\n` },
		{ name: `${key} subtree is excluded from required quoting`, input: `? ${key}\n: value\n`, setting: { required: true }, expected: [{ line: 1, messageIncludes: "should be quoted" }], fixed: `? ${key}\n: "value"\n` },
	]);
	testRuleInference(builtin("quoted-strings"), [
		{ name: `${key} quote styles cannot create strict value conflicts`, inputs: [`? ${key}\n: "value"\n`], strict: { kind: "options", options: { quoteType: "double" } } },
		{ name: `${key} quote styles cast no votes alone`, inputs: [`? ${key}\n: value\n`], strict: { kind: "none" } },
	]);
}
for (const shape of ["sequence", "mapping"]) {
	const key = shape === "sequence" ? "[yes, no]" : "{yes: no}";
	const quotedKey = shape === "sequence" ? '["yes", "no"]' : '{"yes": "no"}';
	testRule(builtin("truthy"), [
		{ name: `${shape} key subtree is excluded with checkKeys false`, input: `? ${key}\n: value\n`, setting: { checkKeys: false }, expected: [], fixed: `? ${key}\n: value\n` },
		{ name: `${shape} key subtree is checked with checkKeys true`, input: `? ${key}\n: value\n`, setting: { checkKeys: true }, expected: [{ line: 0 }, { line: 0 }], fixed: `? ${quotedKey}\n: value\n` },
		{ name: `${shape} key exclusion still fixes truthy values`, input: `? ${key}\n: yes\n`, setting: { checkKeys: false }, expected: [{ line: 1 }], fixed: `? ${key}\n: "yes"\n` },
	]);
}

describe("scalar traversal mode compatibility", () => {
	it("default traversal retains immediate-parent roles while direct and pipeable value mode omit key subtrees", () => {
		const scalar = YamlScalar.make({ value: "x", style: "plain", offset: 0, length: 1 });
		const key = YamlSeq.make({ items: [scalar, YamlMap.make({ items: [YamlPair.make({ key: scalar, value: scalar })], style: "flow", offset: 0, length: 1 })], style: "flow", offset: 0, length: 1 });
		const node = YamlMap.make({ items: [YamlPair.make({ key, value: scalar })], style: "block", offset: 0, length: 1 });
		const roles: Array<string> = [];
		walkScalars(node, "root", (_scalar, role) => roles.push(role));
		assert.deepStrictEqual(roles, ["item", "key", "value", "value"]);
		const direct: Array<string> = [];
		walkScalars(node, "root", (_scalar, role) => direct.push(role), true);
		assert.deepStrictEqual(direct, ["value"]);
		const piped: Array<string> = [];
		pipe(node, walkScalars("root", (_scalar, role) => piped.push(role), true));
		assert.deepStrictEqual(piped, direct);
		const defaultPiped: Array<string> = [];
		pipe(node, walkScalars("root", (_scalar, role) => defaultPiped.push(role)));
		assert.deepStrictEqual(defaultPiped, roles);
	});
});
