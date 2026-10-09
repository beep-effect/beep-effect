import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { parseBlocks } from "../../effected/markdown/internal/blockParser.ts";
import { appendChild, childrenOf, makeInlineNode } from "../../effected/markdown/internal/inlineNode.ts";
import { linkifyEmails } from "../../effected/markdown/internal/inlines/autolinkLiteral.ts";

describe("email autolink source boundaries", () => {
	it.each([
		["&amp;", "&"],
		["\\!", "!"],
		["&#33;", "!"],
		["&NotEqualTilde;", "≂̸"],
	])("starts an email after the complete decoded prefix %s", (prefix, decoded) => {
		const source = prefix + "a@b.com";
		const [paragraph] = parseBlocks(source, { dialect: "gfm" }).root.children;
		assert.strictEqual(paragraph?.type, "paragraph");
		if (paragraph?.type !== "paragraph") return;
		const [text, link] = paragraph.children;
		assert.strictEqual(text?.type, "text");
		assert.strictEqual(text?.type === "text" ? text.value : "", decoded);
		assert.strictEqual(text?.position.start.offset, 0);
		assert.strictEqual(text?.position.end.offset, prefix.length);
		assert.strictEqual(link?.type, "link");
		assert.strictEqual(link?.position.start.offset, prefix.length);
		assert.strictEqual(link?.position.end.offset, source.length);
		if (link?.type !== "link") return;
		assert.strictEqual(link.url, "mailto:a@b.com");
		assert.strictEqual(link.children[0]?.position.start.offset, prefix.length);
		assert.strictEqual(link.children[0]?.position.end.offset, source.length);
	});

	it("maps an email ending in a decoded piece to that piece's source end", () => {
		const source = "a@b.co&#109;";
		const [paragraph] = parseBlocks(source, { dialect: "gfm" }).root.children;
		assert.strictEqual(paragraph?.type, "paragraph");
		if (paragraph?.type !== "paragraph") return;
		const [link] = paragraph.children;
		assert.strictEqual(link?.type, "link");
		assert.strictEqual(link?.position.start.offset, 0);
		assert.strictEqual(link?.position.end.offset, source.length);
		if (link?.type !== "link") return;
		assert.strictEqual(link.url, "mailto:a@b.com");
		assert.strictEqual(link.children[0]?.position.end.offset, source.length);
	});

	it("keeps repeated boundaries ordered across decoded prefixes and several email pieces", () => {
		const source = "&amp;a_b@c.de \\!d_e@f.com &gt;g_h@i.net";
		const [paragraph] = parseBlocks(source, { dialect: "gfm" }).root.children;
		assert.strictEqual(paragraph?.type, "paragraph");
		if (paragraph?.type !== "paragraph") return;
		const links = A.filter(paragraph.children, (node) => node.type === "link");
		assert.strictEqual(links.length, 3);
		for (const [index, address] of A.map(["a_b@c.de", "d_e@f.com", "g_h@i.net"], (address, index) => [index, address] as const)) {
			const link = links[index];
			const start = O.getOrElse(Str.indexOf(address)(source), () => -1);
			assert.strictEqual(link?.position.start.offset, start);
			assert.strictEqual(link?.position.end.offset, start + address.length);
			assert.strictEqual(link?.type === "link" ? link.url : "", "mailto:" + address);
			assert.strictEqual(link?.type === "link" ? link.children[0]?.position.start.offset : -1, start);
		}
		const text = A.filter(paragraph.children, (node) => node.type === "text");
		assert.deepStrictEqual(A.map(text, (node) => [node.value, node.position.start.offset, node.position.end.offset]), [
			["&", 0, 5],
			[" !", 13, 16],
			[" >", 25, 30],
		]);
	});

	it.each([64, 128, 256])("recovers positions with linear original-piece reads for %i emails", (count) => {
		const root = makeInlineNode("emphasis", 0, count * 9);
		let reads = 0;
		for (let index = 0; index < count; index += 1) {
			let start = index * 9;
			for (const value of ["a", "_", "b@c.de "]) {
				const node = {
					...makeInlineNode("text", start, start + value.length),
					get value() {
						reads += 1;
						return value;
					},
				};
				appendChild(root, node);
				start += value.length;
			}
		}
		linkifyEmails(root);
		const links = A.filter(childrenOf(root), (node) => node.type === "link");
		assert.strictEqual(links.length, count);
		for (let index = 0; index < count; index += 1) {
			assert.strictEqual(links[index]?.start, index * 9);
			assert.strictEqual(links[index]?.end, index * 9 + 8);
		}
		// Every piece is visited once as the boundary cursor advances, plus
		// a fixed number of reads per match and during initial concatenation.
		assert.isAtMost(reads, count * 20);
	});

	it("preserves the existing interior-index mapping within a decoded piece", () => {
		const root = makeInlineNode("emphasis", 0, 12);
		appendChild(root, makeInlineNode("text", 0, 6, "!a"));
		appendChild(root, makeInlineNode("text", 6, 12, "@b.com"));
		linkifyEmails(root);
		const [text, link] = childrenOf(root);
		assert.strictEqual(text?.end, 1);
		assert.strictEqual(link?.start, 1);
		assert.strictEqual(link?.end, 12);
		assert.strictEqual(link?.data.url, "mailto:a@b.com");
	});
});
