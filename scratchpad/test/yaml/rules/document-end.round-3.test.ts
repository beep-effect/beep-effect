import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as YAML from "yaml";
import { YamlLint, YamlLintConfig } from "../../../effected/yaml/index.ts";
import { builtin } from "./harness.ts";

const rule = builtin("document-end");
const required = YamlLintConfig.make({ rules: { "document-end": "error" } });
const forbidden = YamlLintConfig.make({ rules: { "document-end": { present: false } } });

describe("document-end round-3 regressions", () => {
	for (const { terminator, line, insertion } of [
		{ terminator: "\r", line: 1, insertion: "\n...\n" },
		{ terminator: "\r\r", line: 2, insertion: "\n...\n" },
		{ terminator: "\r\n", line: 1, insertion: "...\n" },
		{ terminator: "\r\n\r", line: 2, insertion: "\n...\n" },
		{ terminator: "\r\r\n", line: 2, insertion: "...\n" },
	]) {
		it(`EOF diagnostics and inference agree after ${JSON.stringify(terminator)}`, () => {
			const input = `a: 1${terminator}`;
			const diagnostics = YamlLint.run(input, [rule], required);
			assert.strictEqual(diagnostics.length, 1);
			const diagnostic = diagnostics[0];
			assert.isDefined(diagnostic);
			assert.include(diagnostic.message, "Missing");
			assert.strictEqual(diagnostic.offset, input.length);
			assert.strictEqual(diagnostic.length, 0);
			assert.strictEqual(diagnostic.line, line);
			assert.strictEqual(diagnostic.character, 0);
			assert.strictEqual(diagnostic.fix?.content, insertion);
			assert.strictEqual(Result.getOrThrow(YamlLint.fix(input, [rule], required)), `${input}${insertion}`);
			const evidence = YamlLint.observe(input, [rule]);
			assert.strictEqual(evidence.votes.length, 1);
			const vote = evidence.votes[0];
			assert.isDefined(vote);
			assert.strictEqual(vote.rule, "document-end");
			assert.strictEqual(vote.dimension, "present");
			assert.strictEqual(vote.value, false);
			assert.strictEqual(vote.offset, input.length);
			assert.strictEqual(vote.length, 0);
			assert.strictEqual(vote.line, line);
			assert.strictEqual(vote.character, 0);
		});
	}

	it("keeps the sole end marker of standalone and comment-prefixed empty documents", () => {
		for (const input of ["...", "...\n", "...\r", "...\r\n", "# header\n...\n", "# header\n...\n# trailing\n"]) {
			const diagnostics = YamlLint.run(input, [rule], forbidden);
			assert.strictEqual(diagnostics.length, 1);
			assert.include(diagnostics[0]?.message ?? "", "Forbidden");
			assert.isUndefined(diagnostics[0]?.fix);
			const fixed = Result.getOrThrow(YamlLint.fix(input, [rule], forbidden));
			assert.strictEqual(fixed, input);
			const before = YAML.parseAllDocuments(input);
			const after = YAML.parseAllDocuments(fixed);
			assert.strictEqual(before.length, 1);
			assert.strictEqual(after.length, 1);
			// The independent parser rejects a lone CR here, but still recovers
			// the explicit empty document. Pin that error as well as the count.
			const errorCodes = input === "...\r" ? ["UNEXPECTED_TOKEN"] : [];
			assert.deepStrictEqual(A.map(before, (document) => A.map(document.errors, (error) => error.code)), [errorCodes]);
			assert.deepStrictEqual(A.map(after, (document) => A.map(document.errors, (error) => error.code)), [errorCodes]);
			assert.deepStrictEqual(A.map(after, (document) => document.toJS()), [null]);
		}
	});

	it("inspects an unstarted empty final document after an earlier nonempty document", () => {
		for (const input of ["a: 1\n...\n...\n", "---\na: 1\n...\n# final\n...\n"]) {
			const diagnostics = YamlLint.run(input, [rule], forbidden);
			assert.strictEqual(diagnostics.length, 1);
			assert.include(diagnostics[0]?.message ?? "", "Forbidden");
			assert.isUndefined(diagnostics[0]?.fix);
			const fixed = Result.getOrThrow(YamlLint.fix(input, [rule], forbidden));
			assert.strictEqual(fixed, input);
			const before = YAML.parseAllDocuments(input);
			const after = YAML.parseAllDocuments(fixed);
			assert.strictEqual(before.length, 2);
			assert.strictEqual(after.length, 2);
			assert.deepStrictEqual(A.map(before, (document) => document.errors), [[], []]);
			assert.deepStrictEqual(A.map(after, (document) => document.errors), [[], []]);
			assert.deepStrictEqual(A.map(after, (document) => document.toJS()), [{ a: 1 }, null]);
		}
	});

	it("removes the final empty document's end marker when its start marker remains", () => {
		for (const { input, fixed, values } of [
			{ input: "---\n...\n", fixed: "---\n", values: [null] },
			{ input: "# header\n---\n...\n", fixed: "# header\n---\n", values: [null] },
			{ input: "a: 1\n---\n...\n", fixed: "a: 1\n---\n", values: [{ a: 1 }, null] },
			{ input: "...\n---\n...\n", fixed: "...\n---\n", values: [null, null] },
		]) {
			const diagnostics = YamlLint.run(input, [rule], forbidden);
			assert.strictEqual(diagnostics.length, 1);
			assert.include(diagnostics[0]?.message ?? "", "Forbidden");
			assert.isDefined(diagnostics[0]?.fix);
			assert.strictEqual(Result.getOrThrow(YamlLint.fix(input, [rule], forbidden)), fixed);
			const before = YAML.parseAllDocuments(input);
			const after = YAML.parseAllDocuments(fixed);
			assert.strictEqual(before.length, values.length);
			assert.strictEqual(after.length, before.length);
			assert.deepStrictEqual(A.map(before, (document) => document.errors), A.map(values, () => []));
			assert.deepStrictEqual(A.map(after, (document) => document.errors), A.map(values, () => []));
			assert.deepStrictEqual(A.map(after, (document) => document.toJS()), values);
			assert.deepStrictEqual(A.map(after, (document) => document.toJS()), A.map(before, (document) => document.toJS()));
		}
	});

	it("removes the marker of a nonempty final document even when the first document is empty", () => {
		for (const { input, fixed, values } of [
			{ input: "...\n---\na: 1\n...\n", fixed: "...\n---\na: 1\n", values: [null, { a: 1 }] },
			{ input: "null\n...\n", fixed: "null\n", values: [null] },
		]) {
			assert.isDefined(YamlLint.run(input, [rule], forbidden)[0]?.fix);
			assert.strictEqual(Result.getOrThrow(YamlLint.fix(input, [rule], forbidden)), fixed);
			const before = YAML.parseAllDocuments(input);
			const after = YAML.parseAllDocuments(fixed);
			assert.strictEqual(before.length, values.length);
			assert.strictEqual(after.length, before.length);
			assert.deepStrictEqual(A.map(before, (document) => document.errors), A.map(values, () => []));
			assert.deepStrictEqual(A.map(after, (document) => document.errors), A.map(values, () => []));
			assert.deepStrictEqual(A.map(after, (document) => document.toJS()), values);
		}
	});
});
