// The phrasing-level parse entry point: a text fragment parsed as a single
// paragraph's inline content, with positions correct relative to the input.

import { assert, describe, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { MAX_NESTING_DEPTH } from "../../effected/markdown/internal/limits.ts";
import { Markdown } from "../../effected/markdown/Markdown.ts";
import type { PhrasingContent } from "../../effected/markdown/MarkdownNode.ts";

const phrasing = (text: string, options?: Parameters<typeof Markdown.parsePhrasingResult>[1]) => {
	const result = Markdown.parsePhrasingResult(text, options);
	assert.isTrue(Result.isSuccess(result), `expected phrasing parse of ${JSON.stringify(text)} to succeed`);
	return Result.isSuccess(result) ? result.success : [];
};

/** The paragraph-splice the consumer hand-rolls today, as the oracle. */
const splicedFromFullParse = (text: string): ReadonlyArray<PhrasingContent> => {
	const parsed = Markdown.parseResult(text);
	assert.isTrue(Result.isSuccess(parsed));
	if (!Result.isSuccess(parsed)) {
		return [];
	}
	const [block] = parsed.success.children;
	assert.strictEqual(block?.type, "paragraph");
	return block?.type === "paragraph" ? block.children : [];
};

describe("Markdown.parsePhrasingResult", () => {
	it("parses a link-carrying prose fragment into phrasing content", () => {
		const nodes = phrasing("see [the docs](./docs.md)");
		assert.deepStrictEqual(
			nodes.map((node) => node.type),
			["text", "link"],
		);
		const link = nodes[1];
		assert.strictEqual(link?.type === "link" ? link.url : "", "./docs.md");
	});

	it("matches the paragraph splice of a full parse, positions included", () => {
		for (const fragment of [
			"plain",
			"x *y* `z`",
			"a [link](./x) and ![img](./y.png)",
			"code `span` **strong** ~~gone~~",
			"auto https://example.com literal",
		]) {
			assert.deepStrictEqual(phrasing(fragment), splicedFromFullParse(fragment), fragment);
		}
	});

	it("reports positions relative to the input string", () => {
		const [emphasis] = phrasing("  *hi*  ");
		assert.strictEqual(emphasis?.type, "emphasis");
		assert.strictEqual(emphasis?.position.start.offset, 2);
		assert.strictEqual(emphasis?.position.end.offset, 6);
	});

	it("treats blank lines as inline content, never a block break", () => {
		const nodes = phrasing("a\n\nb");
		assert.strictEqual(nodes.length, 1);
		assert.strictEqual(nodes[0]?.type === "text" ? nodes[0].value : "", "a\n\nb");
	});

	it("never opens block constructs", () => {
		const [heading] = phrasing("# not a heading");
		assert.strictEqual(heading?.type === "text" ? heading.value : "", "# not a heading");
	});

	it("normalizes CRLF terminators to \\n while keeping offsets true", () => {
		const [node] = phrasing("a\r\nb");
		assert.strictEqual(node?.type === "text" ? node.value : "", "a\nb");
		assert.strictEqual(node?.position.start.offset, 0);
		assert.strictEqual(node?.position.end.offset, 4);
	});

	it("leaves dangling references literal — no reference context exists", () => {
		assert.deepStrictEqual(
			phrasing("[foo] and ![bar] and [^baz]").map((node) => node.type),
			["text"],
		);
	});

	it("honors the dialect option", () => {
		const gfm = phrasing("~~x~~");
		assert.strictEqual(gfm[0]?.type, "delete");
		const commonmark = phrasing("~~x~~", { dialect: "commonmark" });
		assert.strictEqual(commonmark[0]?.type, "text");
	});

	it("returns an empty array for empty and all-whitespace input", () => {
		assert.deepStrictEqual(phrasing(""), []);
		assert.deepStrictEqual(phrasing("   \n  "), []);
	});

	it("fails typed on a hardening-guard trip", () => {
		const markers = "*".repeat((MAX_NESTING_DEPTH + 10) * 2);
		const result = Markdown.parsePhrasingResult(`${markers}a${markers}`);
		assert.isTrue(Result.isFailure(result));
		if (Result.isFailure(result)) {
			assert.strictEqual(result.failure._tag, "MarkdownParseError");
			assert.strictEqual(result.failure.diagnostic.code, "NestingDepthExceeded");
		}
	});

	it.effect("the Effect twin agrees with the Result primitive", () =>
		Effect.gen(function* () {
			const nodes = yield* Markdown.parsePhrasing("x *y*");
			assert.deepStrictEqual(nodes, phrasing("x *y*"));
		}),
	);
});
