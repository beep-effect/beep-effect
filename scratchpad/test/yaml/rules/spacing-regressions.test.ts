import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { Yaml, YamlLint, YamlLintConfig } from "../../../effected/yaml/index.ts";
import type { YamlRule } from "../../../effected/yaml/YamlLintRule.ts";
import { builtin } from "./harness.ts";

// The wrapper passes unknown options straight to the rule's check, bypassing
// config validation while retaining the engine's real token/document context.
const directCheck = (text: string, rule: YamlRule, options: unknown) =>
	YamlLint.run(text, [{ id: rule.id, check: (ctx) => rule.check(ctx, options) }],
		YamlLintConfig.make({ rules: { [rule.id]: "error" } }));

describe("comment spacing at a leading BOM", () => {
	const rule = builtin("comments-spacing");
	const config = YamlLintConfig.make({ rules: { [rule.id]: "error" } });

	for (const input of ["\uFEFF# header\na: 1\n", "\uFEFF  # header\na: 1\n"]) {
		it(`treats the BOM-prefixed header as an own-line comment: ${input}`, () => {
			assert.deepStrictEqual(YamlLint.run(input, [rule], config), []);
			assertSuccess(YamlLint.fix(input, [rule], config), input);
			assert.deepStrictEqual(A.map(YamlLint.observe(input, [rule]).votes, (vote) => vote.dimension), ["requireSpaceAfter"]);
		});
	}

	it("fixes only after # for a tight BOM-prefixed own-line comment", () => {
		const input = "\uFEFF#tight\na: 1\n";
		const diagnostics = YamlLint.run(input, [rule], config);
		assert.strictEqual(diagnostics.length, 1);
		assert.strictEqual(diagnostics[0]?.message, 'Missing space after "#"');
		assert.strictEqual(diagnostics[0]?.offset, 1);
		assert.strictEqual(diagnostics[0]?.line, 0);
		assert.strictEqual(diagnostics[0]?.character, 1);
		assert.strictEqual(diagnostics[0]?.fix?.offset, 2);
		assertSuccess(YamlLint.fix(input, [rule], config), "\uFEFF# tight\na: 1\n");
	});

	it("still treats an inline BOM as preceding line content", () => {
		const diagnostics = directCheck("a: \uFEFF # c\n", rule, { minSpacesBefore: 3 });
		assert.strictEqual(diagnostics.length, 1);
		assert.strictEqual(diagnostics[0]?.message, "Too few spaces before comment (1 < 3)");
	});
});

describe("independent direct-call rule options", () => {
	const comments = builtin("comments-spacing");

	for (const options of [
		{ minSpacesBefore: 3, severity: "invalid" },
		{ minSpacesBefore: 3, requireSpaceAfter: "invalid" },
	]) {
		it(`keeps valid before-spacing with invalid ${"severity" in options ? "severity" : "requireSpaceAfter"}`, () => {
			const diagnostics = directCheck("a: 1 # c\n", comments, options);
			assert.strictEqual(diagnostics.length, 1);
			assert.strictEqual(diagnostics[0]?.message, "Too few spaces before comment (1 < 3)");
			assert.strictEqual(diagnostics[0]?.fix?.content, "  ");
		});
	}

	for (const options of [
		{ requireSpaceAfter: false, severity: "invalid" },
		{ requireSpaceAfter: false, minSpacesBefore: "invalid" },
	]) {
		it(`keeps requireSpaceAfter: false with invalid ${"severity" in options ? "severity" : "minSpacesBefore"}`, () => {
			assert.deepStrictEqual(directCheck("a: 1 #tight\n", comments, options), []);
		});
	}

	it("defaults an invalid after-spacing field without discarding before-spacing", () => {
		const diagnostics = directCheck("a: 1 #tight\n", comments, { minSpacesBefore: 3, requireSpaceAfter: 0 });
		assert.sameMembers(A.map(diagnostics, (diagnostic) => diagnostic.message), [
			'Missing space after "#"', "Too few spaces before comment (1 < 3)",
		]);
	});

	for (const [id, marked, unmarked] of [
		["document-start", "---\na: 1\n", "a: 1\n"],
		["document-end", "a: 1\n...\n", "a: 1\n"],
		] satisfies ReadonlyArray<readonly [string, string, string]>) {
		const rule = builtin(id);
		it(`${id} preserves present: false despite invalid severity`, () => {
			const options = { present: false, severity: "invalid" };
			assert.deepStrictEqual(directCheck(unmarked, rule, options), []);
			const diagnostics = directCheck(marked, rule, options);
			assert.strictEqual(diagnostics.length, 1);
			assert.include(diagnostics[0]?.message ?? "", "Forbidden");
			assert.isDefined(diagnostics[0]?.fix);
		});
		it(`${id} defaults an invalid present field independently`, () => {
			assert.deepStrictEqual(directCheck(marked, rule, { present: 0, severity: "invalid" }), []);
			const diagnostics = directCheck(unmarked, rule, { present: 0, severity: "invalid" });
			assert.strictEqual(diagnostics.length, 1);
			assert.include(diagnostics[0]?.message ?? "", "Missing");
		});
	}
});

describe("hyphen spacing preserves collection values", () => {
	const rule = builtin("hyphen-spacing");
	const config = YamlLintConfig.make({ rules: { [rule.id]: "error" } });

	for (const [name, input, expected] of [
		["sequence continuation", "-   - one\n    - two\n", [["one", "two"]]],
		["mapping continuation", "-   a: one\n    b: two\n", [{ a: "one", b: "two" }]],
		["CRLF sequence continuation", "-   - one\r\n    - two\r\n", [["one", "two"]]],
		["comments before continuation", "-   - one\n    # keep\n\n    - two\n", [["one", "two"]]],
		["flow value in a compact mapping", "-   a: {first: one}\n    b: two\n", [{ a: { first: "one" }, b: "two" }]],
	] satisfies ReadonlyArray<readonly [string, string, unknown]>) {
		it(`retains the diagnostic without a destructive fix for ${name}`, () => {
			const diagnostics = YamlLint.run(input, [rule], config);
			assert.strictEqual(diagnostics.length, 1);
			assert.strictEqual(diagnostics[0]?.message, 'Too many spaces after "-" (3 > 1)');
			assert.isUndefined(diagnostics[0]?.fix);
			assertSuccess(Yaml.parseResult(input), expected);
			const fixed = YamlLint.fix(input, [rule], config);
			assertSuccess(fixed, input);
			assertSuccess(Yaml.parseResult(fixed.success), expected);
		});
	}

	for (const [name, input, fixed, expected] of [
		["scalar", "-   one\n- two\n", "- one\n- two\n", ["one", "two"]],
		["flow mapping", "-   {a: one}\n- two\n", "- {a: one}\n- two\n", [{ a: "one" }, "two"]],
		["flow sequence", "-   [one, two]\n", "- [one, two]\n", [["one", "two"]]],
		["compact sequence without continuation", "-   - one\n- two\n", "- - one\n- two\n", [["one"], "two"]],
		["compact mapping without continuation", "-   a: one\n- two\n", "- a: one\n- two\n", [{ a: "one" }, "two"]],
	] satisfies ReadonlyArray<readonly [string, string, string, unknown]>) {
		it(`keeps a safe ${name} fix and its parsed value`, () => {
			const diagnostics = YamlLint.run(input, [rule], config);
			assert.strictEqual(diagnostics.length, 1);
			assert.isDefined(diagnostics[0]?.fix);
			assertSuccess(Yaml.parseResult(input), expected);
			const result = YamlLint.fix(input, [rule], config);
			assertSuccess(result, fixed);
			assertSuccess(Yaml.parseResult(result.success), expected);
		});
	}
});
