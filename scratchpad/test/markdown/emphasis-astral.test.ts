import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import { parseBlocks } from "../../effected/markdown/internal/blockParser.ts";

describe("Unicode code-point delimiter flanking", () => {
	it.each(["😀_a_", "_a_😀", "𐄀_a_", "_a_𐄀", "😀_a_😀", "𐄀_a_𐄀"])(
		"allows underscore emphasis beside astral punctuation or symbols in %s",
		(source) => {
			const [paragraph] = parseBlocks(source).root.children;
			assert.strictEqual(paragraph?.type, "paragraph");
			if (paragraph?.type !== "paragraph") return;
			const emphasis = A.filter(paragraph.children, (node) => node.type === "emphasis");
			assert.strictEqual(emphasis.length, 1);
			const [node] = emphasis;
			assert.strictEqual(node?.children[0]?.type, "text");
			assert.strictEqual(node?.children[0]?.type === "text" ? node.children[0].value : "", "a");
			const start = source.indexOf("_");
			assert.strictEqual(node?.position.start.offset, start);
			assert.strictEqual(node?.position.end.offset, start + 3);
		},
	);

	it.each(["a*𐄀*b", "a*😀*b", "a_𐄀_b", "a_😀_b"])(
		"keeps punctuation flanked by letters literal in %s",
		(source) => {
			const [paragraph] = parseBlocks(source).root.children;
			assert.strictEqual(paragraph?.type, "paragraph");
			if (paragraph?.type !== "paragraph") return;
			assert.strictEqual(paragraph.children.length, 1);
			const [text] = paragraph.children;
			assert.strictEqual(text?.type, "text");
			assert.strictEqual(text?.type === "text" ? text.value : "", source);
			assert.strictEqual(text?.position.end.offset, source.length);
		},
	);

	it.each(["𐐀_a_", "_a_𐐀"])("retains intraword underscore restrictions beside astral letters in %s", (source) => {
		const [paragraph] = parseBlocks(source).root.children;
		assert.strictEqual(paragraph?.type, "paragraph");
		if (paragraph?.type !== "paragraph") return;
		assert.strictEqual(paragraph.children.length, 1);
		assert.strictEqual(paragraph.children[0]?.type, "text");
		assert.strictEqual(paragraph.children[0]?.type === "text" ? paragraph.children[0].value : "", source);
	});

	it("uses the corrected flanking measurement for GFM strikethrough too", () => {
		const [paragraph] = parseBlocks("a~𐄀~b 😀~a~😀", { dialect: "gfm" }).root.children;
		assert.strictEqual(paragraph?.type, "paragraph");
		if (paragraph?.type !== "paragraph") return;
		assert.deepStrictEqual(A.map(paragraph.children, (node) => node.type), ["text", "delete", "text"]);
		const [text, deletion] = paragraph.children;
		assert.strictEqual(text?.type === "text" ? text.value : "", "a~𐄀~b 😀");
		assert.strictEqual(deletion?.type === "delete" ? deletion.children[0]?.type : "", "text");
		assert.strictEqual(deletion?.type === "delete" && deletion.children[0]?.type === "text" ? deletion.children[0].value : "", "a");
	});
});
