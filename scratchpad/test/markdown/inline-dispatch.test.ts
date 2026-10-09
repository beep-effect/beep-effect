// Trigger precedence and node materialization remain stable when the inline
// registry uses HashMap and the materializer compiles its matcher once.
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { inlineDialect } from "../../effected/markdown/internal/inlineRegistry.ts";
import { Markdown } from "../../effected/markdown/Markdown.ts";

const cases = [
	{ source: "`x`", type: "inlineCode" },
	{ source: "<b>", type: "html" },
	{ source: "*x*", type: "emphasis" },
	{ source: "**x**", type: "strong" },
	{ source: "~~x~~", type: "delete" },
	{ source: '[x](/u "title")', type: "link" },
	{ source: '![x](/u "title")', type: "image" },
	{ source: "<https://example.com>", type: "link" },
];

describe("inline dispatch", () => {
	it("keeps autolinks before raw HTML in each trigger bucket", () => {
		for (const dialect of ["commonmark", "gfm"] as const) {
			const registry = inlineDialect(dialect);
			const bucket = O.getOrElse(HashMap.get(registry.byTrigger, 0x3c), () => []);
			assert.deepStrictEqual(A.map(bucket, (construct) => construct.name), ["autolink", "rawHtml"]);
			assertNone(HashMap.get(registry.byTrigger, 0x61));
		}
	});

	for (const { source, type } of cases) {
		it(`materializes ${type} from ${source}`, () => {
			const result = Markdown.parsePhrasingResult(source);
			assertSuccess(Result.map(result, () => undefined), undefined);
			if (Result.isSuccess(result)) {
				assert.strictEqual(result.success.length, 1);
				assert.strictEqual(result.success[0]?.type, type);
				assert.strictEqual(result.success[0]?.position.start.offset, 0);
				assert.strictEqual(result.success[0]?.position.end.offset, source.length);
			}
		});
	}

	it("retains both hard-break style fields", () => {
		for (const { source, style } of [
			{ source: "a\\\nb", style: "backslash" },
			{ source: "a  \nb", style: "spaces" },
		]) {
			const result = Markdown.parsePhrasingResult(source);
			assertSuccess(Result.map(result, () => undefined), undefined);
			if (Result.isSuccess(result)) {
				assert.deepStrictEqual(A.map(result.success, (node) => node.type), ["text", "break", "text"]);
				const lineBreak = result.success[1];
				assert.strictEqual(lineBreak?.type === "break" ? lineBreak.breakStyle : undefined, style);
			}
		}
	});

	it("coalesces text fallback including dangling references", () => {
		const source = "plain ] [missing] !";
		const result = Markdown.parsePhrasingResult(source);
		assertSuccess(Result.map(result, () => undefined), undefined);
		if (Result.isSuccess(result)) {
			assert.strictEqual(result.success.length, 1);
			const [text] = result.success;
			assert.strictEqual(text?.type === "text" ? text.value : undefined, source);
		}
	});
});
