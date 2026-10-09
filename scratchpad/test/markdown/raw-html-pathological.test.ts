import { assert, describe, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import { parseBlocks } from "../../effected/markdown/internal/blockParser.ts";
import { rawHtmlConstruct } from "../../effected/markdown/internal/inlines/rawHtml.ts";

describe("raw HTML declaration missing-closer protection", () => {
	it("rejects repeated missing declaration closers before attempting the HTML regex", () => {
		const parse = rawHtmlConstruct.parse;
		let matches = 0;
		const spy = vi.spyOn(rawHtmlConstruct, "parse").mockImplementation((scanner) => {
			const match = scanner.match;
			scanner.match = (pattern) => {
				matches += 1;
				return match.call(scanner, pattern);
			};
			try {
				return parse(scanner);
			} finally {
				scanner.match = match;
			}
		});
		try {
			parseBlocks("x " + "<!A".repeat(8000));
			assert.strictEqual(spy.mock.calls.length, 8000);
			assert.strictEqual(matches, 0);
		} finally {
			spy.mockRestore();
		}
	});

	it.each([1, 8000, 16000, 32000])("preserves %i unterminated declarations as text", (count) => {
		const source = "x " + "<!A".repeat(count);
		const [paragraph] = parseBlocks(source).root.children;
		assert.strictEqual(paragraph?.type, "paragraph");
		if (paragraph?.type !== "paragraph") return;
		assert.strictEqual(paragraph.children.length, 1);
		const [text] = paragraph.children;
		assert.strictEqual(text?.type, "text");
		assert.strictEqual(text?.type === "text" ? text.value : "", source);
		assert.strictEqual(text?.position.start.offset, 0);
		assert.strictEqual(text?.position.end.offset, source.length);
	});

	it.each(["<!DOCTYPE html>", "<!A>", "<!alphabet payload>", "<!--comment-->", "<?pi?>", "<![CDATA[value]]>", "<span>"])(
		"continues to accept closed inline HTML %s",
		(html) => {
			const source = "x " + html + " y";
			const [paragraph] = parseBlocks(source).root.children;
			assert.strictEqual(paragraph?.type, "paragraph");
			if (paragraph?.type !== "paragraph") return;
			assert.deepStrictEqual(A.map(paragraph.children, (node) => node.type), ["text", "html", "text"]);
			const node = paragraph.children[1];
			assert.strictEqual(node?.type === "html" ? node.value : "", html);
			assert.strictEqual(node?.position.start.offset, 2);
			assert.strictEqual(node?.position.end.offset, 2 + html.length);
		},
	);

	it("accepts a declaration containing repeated openers once its closer exists", () => {
		const html = "<!A" + "<!A".repeat(128) + ">";
		const [paragraph] = parseBlocks("x " + html).root.children;
		assert.strictEqual(paragraph?.type, "paragraph");
		if (paragraph?.type !== "paragraph") return;
		const node = paragraph.children[1];
		assert.strictEqual(node?.type, "html");
		assert.strictEqual(node?.type === "html" ? node.value : "", html);
	});
});
