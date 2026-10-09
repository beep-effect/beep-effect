import { assert, describe, it } from "@effect/vitest";
import { parseBlocks } from "../../effected/markdown/internal/blockParser.ts";
import { GuardExceeded, isGuardExceeded } from "../../effected/markdown/internal/carriers.ts";
import { MAX_NESTING_DEPTH } from "../../effected/markdown/internal/limits.ts";
import { columnsToNextTabStop, preprocessLines, replaceNul } from "../../effected/markdown/internal/preprocess.ts";

/** Slice the source back out of a node's position — the offset round trip. */
const sliceOf = (source: string, node: { readonly position: { start: { offset: number }; end: { offset: number } } }) =>
	source.slice(node.position.start.offset, node.position.end.offset);

describe("preprocess", () => {
	describe("line splitting", () => {
		it("keeps each line's absolute start offset", () => {
			const lines = preprocessLines("abc\ndef\nghi");
			assert.deepStrictEqual(
				lines.map((line) => [line.text, line.start]),
				[
					["abc", 0],
					["def", 4],
					["ghi", 8],
				],
			);
		});

		it("treats CRLF as one boundary and keeps offsets in the original text", () => {
			const lines = preprocessLines("abc\r\ndef\rghi\n");
			assert.deepStrictEqual(
				lines.map((line) => [line.text, line.start]),
				[
					["abc", 0],
					["def", 5],
					["ghi", 9],
				],
			);
		});

		it("does not invent a final empty line for a trailing newline", () => {
			assert.deepStrictEqual(
				preprocessLines("foo\n").map((line) => line.text),
				["foo"],
			);
		});

		it("yields one empty line for empty input", () => {
			assert.deepStrictEqual(
				preprocessLines("").map((line) => [line.text, line.start]),
				[["", 0]],
			);
		});

		it("replaces U+0000 with U+FFFD without moving any offset", () => {
			const source = "a\u0000b\nc";
			const lines = preprocessLines(source);
			assert.strictEqual(lines[0]?.text, "a\uFFFDb");
			assert.strictEqual(lines[0]?.text.length, 3);
			assert.strictEqual(lines[1]?.start, 4);
			assert.strictEqual(replaceNul("no nulls here"), "no nulls here");
		});
	});

	describe("tab stops", () => {
		it("expands a tab to the next multiple of four columns", () => {
			assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map(columnsToNextTabStop), [4, 3, 2, 1, 4, 3]);
		});
	});
});

describe("block pass", () => {
	describe("tabs", () => {
		it("treats a leading tab as four columns of code indentation", () => {
			const { root } = parseBlocks("\tfoo\n");
			const [code] = root.children;
			assert.strictEqual(code?.type, "code");
			assert.strictEqual(code?.type === "code" ? code.value : "", "foo\n");
		});

		it("reads a tab and four spaces as the same code indent", () => {
			// A tab at column 0 spans columns 1-4, which the code indent
			// consumes exactly. Partially consumed tabs need a container prefix
			// to straddle, so they arrive with blockquotes and lists in Task 7.
			const { root } = parseBlocks("    foo\n\tbar\n");
			const [code] = root.children;
			assert.strictEqual(code?.type === "code" ? code.value : "", "foo\nbar\n");
		});

		it("counts a tab inside an ATX heading as content, not indentation", () => {
			const { root } = parseBlocks("#\tfoo\n");
			const [heading] = root.children;
			assert.strictEqual(heading?.type, "heading");
			assert.strictEqual(heading?.type === "heading" ? heading.depth : 0, 1);
		});
	});

	describe("construct precedence", () => {
		it("prefers a thematic break to a paragraph line", () => {
			const { root } = parseBlocks("***\n");
			assert.strictEqual(root.children[0]?.type, "thematicBreak");
		});

		it("prefers an ATX heading to a paragraph line", () => {
			const { root } = parseBlocks("# heading\n");
			assert.strictEqual(root.children[0]?.type, "heading");
		});

		it("does not open indented code inside a paragraph", () => {
			// An indented line after a paragraph is a lazy continuation, never
			// a code block — the `tip.type !== "paragraph"` guard in the start.
			const { root } = parseBlocks("foo\n    bar\n");
			assert.strictEqual(root.children.length, 1);
			assert.strictEqual(root.children[0]?.type, "paragraph");
		});

		it("does not open an ATX heading at four columns of indentation", () => {
			const { root } = parseBlocks("    # not a heading\n");
			assert.strictEqual(root.children[0]?.type, "code");
		});
	});

	describe("fidelity fields", () => {
		it("marks an ATX heading with its style and depth", () => {
			const { root } = parseBlocks("### three\n");
			const [heading] = root.children;
			assert.strictEqual(heading?.type, "heading");
			if (heading?.type !== "heading") {
				return;
			}
			assert.strictEqual(heading.depth, 3);
			assert.strictEqual(heading.headingStyle, "atx");
		});

		it("records the character a thematic break was drawn with", () => {
			for (const [source, marker] of [
				["---\n", "-"],
				["___\n", "_"],
				["***\n", "*"],
			] as const) {
				const [node] = parseBlocks(source).root.children;
				assert.strictEqual(node?.type === "thematicBreak" ? node.markerChar : undefined, marker);
			}
		});

		it("leaves fence fields genuinely absent on indented code", () => {
			const [code] = parseBlocks("    x = 1\n").root.children;
			assert.strictEqual(code?.type, "code");
			assert.isFalse(Object.hasOwn(code ?? {}, "fenceChar"));
			assert.isFalse(Object.hasOwn(code ?? {}, "fenceLength"));
			assert.isFalse(Object.hasOwn(code ?? {}, "lang"));
			assert.isFalse(Object.hasOwn(code ?? {}, "meta"));
		});
	});

	describe("positions", () => {
		it("spans exactly the source each block was built from", () => {
			const source = "# Title\n\nHello\nworld\n";
			const { root } = parseBlocks(source);
			const [heading, paragraph] = root.children;

			assert.isDefined(heading);
			assert.isDefined(paragraph);
			assert.strictEqual(sliceOf(source, heading), "# Title");
			assert.strictEqual(sliceOf(source, paragraph), "Hello\nworld");
		});

		it("pulls an indented code block's end back past its trailing blank lines", () => {
			const source = "    foo\n\n\nbar\n";
			const { root } = parseBlocks(source);
			const [code] = root.children;
			assert.strictEqual(code?.type, "code");
			// The span starts at the line start: the four columns of code
			// indentation are part of the block's source extent (the interop
			// corpus pins mdast-util's convention); only the value excludes
			// them. The end still excludes the trailing blank lines.
			assert.isDefined(code);
			assert.strictEqual(sliceOf(source, code), "    foo");
			assert.strictEqual(code?.type === "code" ? code.value : "", "foo\n");
		});

		it("gives every point 1-based line and column with a 0-based offset", () => {
			const source = "# Title\n\nHello\n";
			const { root } = parseBlocks(source);
			const paragraph = root.children[1];
			assert.deepStrictEqual({ ...paragraph?.position.start }, { line: 3, column: 1, offset: 9 });
			assert.deepStrictEqual({ ...paragraph?.position.end }, { line: 3, column: 6, offset: 14 });
		});

		it("keeps offsets monotonic and inside the source for every node", () => {
			const source = "# a\n\ntext one\ntext two\n\n    code\n\n***\n\n# b\n";
			const { root } = parseBlocks(source);
			const check = (node: { position: { start: { offset: number }; end: { offset: number } } }): void => {
				assert.isAtLeast(node.position.start.offset, 0);
				assert.isAtMost(node.position.start.offset, node.position.end.offset);
				assert.isAtMost(node.position.end.offset, source.length);
			};
			check(root);
			for (const child of root.children) {
				check(child);
			}
		});
	});

	describe("raw inline slices", () => {
		it("emits one slice per leaf, pointing at the node that will own it", () => {
			const source = "# Title\n\nHello\nworld\n";
			const { root, rawInlines } = parseBlocks(source);
			const [heading, paragraph] = root.children;

			assert.strictEqual(rawInlines.length, 2);
			assert.strictEqual<unknown>(rawInlines[0]?.parent, heading);
			assert.strictEqual(rawInlines[0]?.text, "Title");
			assert.strictEqual<unknown>(rawInlines[1]?.parent, paragraph);
			assert.strictEqual(rawInlines[1]?.text, "Hello\nworld");
		});

		it("maps every segment back to the source it was copied from", () => {
			const source = "Hello\nworld\n";
			const { rawInlines } = parseBlocks(source);
			const slice = rawInlines[0];
			assert.isDefined(slice);
			assert.strictEqual(slice?.startOffset, 0);
			for (const segment of slice?.segments ?? []) {
				assert.strictEqual(
					slice?.text.slice(segment.textOffset, segment.textOffset + segment.length),
					source.slice(segment.sourceOffset, segment.sourceOffset + segment.length),
				);
			}
		});

		it("keeps a soft line break as a literal newline in the raw text", () => {
			const { rawInlines } = parseBlocks("aaa\nbbb\n");
			assert.strictEqual(rawInlines[0]?.text, "aaa\nbbb");
		});

		it("emits no slice for a code block", () => {
			const { rawInlines } = parseBlocks("    code\n");
			assert.strictEqual(rawInlines.length, 0);
		});
	});

	describe("documents", () => {
		it("parses an empty document to an empty root", () => {
			const { root, rawInlines, carriers } = parseBlocks("");
			assert.strictEqual(root.type, "root");
			assert.strictEqual(root.children.length, 0);
			assert.strictEqual(rawInlines.length, 0);
			assert.strictEqual(carriers.length, 0);
		});

		it("parses a blank-line-only document to an empty root", () => {
			assert.strictEqual(parseBlocks("\n\n \n\t\n").root.children.length, 0);
		});

		it("separates paragraphs at blank lines", () => {
			const { root } = parseBlocks("one\n\ntwo\n");
			assert.deepStrictEqual(
				root.children.map((child) => child.type),
				["paragraph", "paragraph"],
			);
		});
	});
});

describe("container blocks", () => {
	describe("lazy continuation", () => {
		it("keeps an unmarked line inside the blockquote's paragraph", () => {
			// The second line matches no container, but it is non-blank and the
			// paragraph is open, so it continues that paragraph — and the
			// blockquote is NOT closed.
			const { root } = parseBlocks("> foo\nbar\n");
			const [quote] = root.children;
			assert.strictEqual(quote?.type, "blockquote");
			if (quote?.type !== "blockquote") {
				return;
			}
			assert.strictEqual(quote.children.length, 1);
			assert.strictEqual(quote.children[0]?.type, "paragraph");
		});

		it("does not lazily continue into a blank line", () => {
			const { root } = parseBlocks("> foo\n\nbar\n");
			assert.deepStrictEqual(
				root.children.map((child) => child.type),
				["blockquote", "paragraph"],
			);
		});

		it("does not lazily continue a line that starts a new block", () => {
			const { root } = parseBlocks("> foo\n---\n");
			assert.deepStrictEqual(
				root.children.map((child) => child.type),
				["blockquote", "thematicBreak"],
			);
		});

		it("lazily continues a paragraph nested two containers deep", () => {
			const { root } = parseBlocks("> - foo\nbar\n");
			const [quote] = root.children;
			assert.strictEqual(quote?.type, "blockquote");
			const list = quote?.type === "blockquote" ? quote.children[0] : undefined;
			assert.strictEqual(list?.type, "list");
		});
	});

	describe("lists", () => {
		it("records the bullet character and item spread", () => {
			const { root } = parseBlocks("- a\n- b\n");
			const [list] = root.children;
			assert.strictEqual(list?.type, "list");
			if (list?.type !== "list") {
				return;
			}
			assert.strictEqual(list.ordered, false);
			assert.strictEqual(list.bulletChar, "-");
			assert.strictEqual(list.spread, false);
			assert.strictEqual(list.children.length, 2);
			assert.isFalse(Object.hasOwn(list, "start"));
			assert.isFalse(Object.hasOwn(list, "delimiter"));
		});

		it("records the delimiter and start of an ordered list", () => {
			const [list] = parseBlocks("3) a\n4) b\n").root.children;
			assert.strictEqual(list?.type, "list");
			if (list?.type !== "list") {
				return;
			}
			assert.strictEqual(list.ordered, true);
			assert.strictEqual(list.start, 3);
			assert.strictEqual(list.delimiter, ")");
			assert.isFalse(Object.hasOwn(list, "bulletChar"));
		});

		it("marks a list loose when a blank line separates its items", () => {
			const [list] = parseBlocks("- a\n\n- b\n").root.children;
			assert.strictEqual(list?.type === "list" ? list.spread : undefined, true);
		});

		it("starts a new list when the marker character changes", () => {
			const { root } = parseBlocks("- a\n* b\n");
			assert.deepStrictEqual(
				root.children.map((child) => child.type),
				["list", "list"],
			);
		});

		it("nests a list inside a list item", () => {
			const [outer] = parseBlocks("- a\n  - b\n").root.children;
			const item = outer?.type === "list" ? outer.children[0] : undefined;
			assert.deepStrictEqual(
				(item?.children ?? []).map((child) => child.type),
				["paragraph", "list"],
			);
		});
	});

	describe("fenced code", () => {
		it("splits the info string into lang and meta", () => {
			const [code] = parseBlocks("```ruby startline=3 $%@#$\nx\n```\n").root.children;
			assert.strictEqual(code?.type, "code");
			if (code?.type !== "code") {
				return;
			}
			assert.strictEqual(code.lang, "ruby");
			assert.strictEqual(code.meta, "startline=3 $%@#$");
			assert.strictEqual(code.value, "x\n");
		});

		it("records the fence character and length", () => {
			const [code] = parseBlocks("~~~~\nx\n~~~~\n").root.children;
			assert.strictEqual(code?.type === "code" ? code.fenceChar : undefined, "~");
			assert.strictEqual(code?.type === "code" ? code.fenceLength : undefined, 4);
		});

		it("leaves lang and meta absent for a bare fence", () => {
			const [code] = parseBlocks("```\nx\n```\n").root.children;
			assert.isFalse(Object.hasOwn(code ?? {}, "lang"));
			assert.isFalse(Object.hasOwn(code ?? {}, "meta"));
		});

		it("tells a fenced block from an indented one by its fence fields", () => {
			const [fenced] = parseBlocks("```\nx\n```\n").root.children;
			const [indented] = parseBlocks("    x\n").root.children;
			assert.isTrue(Object.hasOwn(fenced ?? {}, "fenceChar"));
			assert.isFalse(Object.hasOwn(indented ?? {}, "fenceChar"));
		});
	});

	describe("html blocks", () => {
		it("opens each of the seven block types", () => {
			const sources: ReadonlyArray<readonly [string, string]> = [
				["<script>\na\n</script>\n", "type 1"],
				["<!-- a -->\n", "type 2"],
				["<?php a ?>\n", "type 3"],
				["<!DOCTYPE html>\n", "type 4"],
				["<![CDATA[a]]>\n", "type 5"],
				["<div>\na\n</div>\n", "type 6"],
				["<custom-tag>\na\n", "type 7"],
			];
			for (const [source, label] of sources) {
				const [node] = parseBlocks(source).root.children;
				assert.strictEqual(node?.type, "html", `${label} did not open an HTML block`);
			}
		});

		it("ends a type 6 block at a blank line and resumes with markdown", () => {
			const { root } = parseBlocks("<div>\na\n\nb\n");
			assert.deepStrictEqual(
				root.children.map((child) => child.type),
				["html", "paragraph"],
			);
		});

		it("ends a type 2 block on the line carrying its closing pattern", () => {
			const { root } = parseBlocks("<!-- a -->\nb\n");
			assert.deepStrictEqual(
				root.children.map((child) => child.type),
				["html", "paragraph"],
			);
		});

		it("does not let a type 7 block interrupt a paragraph", () => {
			const { root } = parseBlocks("a\n<custom-tag>\n");
			assert.deepStrictEqual(
				root.children.map((child) => child.type),
				["paragraph"],
			);
		});
	});

	describe("setext headings", () => {
		it("promotes the paragraph above the underline", () => {
			const source = "Foo\nbar\n===\n";
			const [heading] = parseBlocks(source).root.children;
			assert.strictEqual(heading?.type, "heading");
			if (heading?.type !== "heading") {
				return;
			}
			assert.strictEqual(heading.depth, 1);
			assert.strictEqual(heading.headingStyle, "setext");
			// The heading spans from the text down to the underline.
			assert.strictEqual(sliceOf(source, heading), "Foo\nbar\n===");
		});

		it("reads a dash underline as depth two", () => {
			const [heading] = parseBlocks("Foo\n---\n").root.children;
			assert.strictEqual(heading?.type === "heading" ? heading.depth : 0, 2);
		});

		it("leaves a definition-only paragraph as a definition plus a break", () => {
			const { root } = parseBlocks("[foo]: /url\n---\n");
			assert.deepStrictEqual(
				root.children.map((child) => child.type),
				["definition", "thematicBreak"],
			);
		});
	});
});

describe("link reference definitions", () => {
	it("keeps the definition in the tree at its source position", () => {
		const source = '[foo]: /url "title"\n\nbar\n';
		const { root } = parseBlocks(source);
		const [definition] = root.children;
		assert.strictEqual(definition?.type, "definition");
		if (definition?.type !== "definition") {
			return;
		}
		assert.strictEqual(definition.identifier, "foo");
		assert.strictEqual(definition.label, "foo");
		assert.strictEqual(definition.url, "/url");
		assert.strictEqual(definition.title, "title");
		assert.strictEqual(sliceOf(source, definition), '[foo]: /url "title"');
	});

	it("stores the decoded destination, leaving the encoding to the renderer", () => {
		const [definition] = parseBlocks("[foo]: /url\\bar\\*baz\n").root.children;
		assert.strictEqual(definition?.type === "definition" ? definition.url : "", "/url\\bar*baz");
	});

	it("splits the definitions off the front of a paragraph, keeping the rest", () => {
		const { root } = parseBlocks("[a]: /1\n[b]: /2\nfoo\n");
		assert.deepStrictEqual(
			root.children.map((child) => child.type),
			["definition", "definition", "paragraph"],
		);
	});

	it("drops a paragraph that held nothing but definitions", () => {
		const { root } = parseBlocks("[a]: /1\n");
		assert.deepStrictEqual(
			root.children.map((child) => child.type),
			["definition"],
		);
	});

	it("does not let a definition interrupt a paragraph", () => {
		const { root } = parseBlocks("foo\n[a]: /1\n");
		assert.deepStrictEqual(
			root.children.map((child) => child.type),
			["paragraph"],
		);
	});

	it("omits an absent title rather than storing undefined", () => {
		const [definition] = parseBlocks("[foo]: /url\n").root.children;
		assert.isFalse(Object.hasOwn(definition ?? {}, "title"));
	});

	describe("the refmap", () => {
		it("keys definitions by their case-folded label", () => {
			const { refmap } = parseBlocks("[Foo Bar]: /url\n");
			assert.strictEqual(refmap.size, 1);
			assert.isTrue(refmap.has("FOO BAR"));
		});

		it("collapses internal whitespace in the key", () => {
			const { refmap } = parseBlocks("[foo \t bar]: /url\n");
			assert.isTrue(refmap.has("FOO BAR"));
		});

		it("lets the first definition win", () => {
			const { refmap } = parseBlocks("[foo]: /first\n[foo]: /second\n");
			assert.strictEqual(refmap.size, 1);
			assert.strictEqual(refmap.get("FOO")?.url, "/first");
		});

		it("collects definitions from inside containers", () => {
			const { refmap } = parseBlocks("> [foo]: /url\n");
			assert.isTrue(refmap.has("FOO"));
		});

		it("holds a `__proto__` label as a key, never as a prototype write", () => {
			const { refmap } = parseBlocks("[__proto__]: /url\n");
			assert.isTrue(refmap.has("__PROTO__"));
			assert.strictEqual(refmap.get("__PROTO__")?.url, "/url");
			// The label round-trips as data because the refmap is a real Map:
			// on a plain object the same assignment would have written a
			// prototype instead of a key, and the lookup above would fail.
			assert.strictEqual(Object.getPrototypeOf(refmap), Map.prototype);
			assert.isUndefined(Object.getOwnPropertyDescriptor(Object.prototype, "url"));
		});

		it("is empty for a document with no definitions", () => {
			assert.strictEqual(parseBlocks("foo\n").refmap.size, 0);
		});
	});
});

describe("hardening", () => {
	it("refuses to nest containers past the depth cap", () => {
		const source = `${">".repeat(MAX_NESTING_DEPTH + 44)} foo\n`;
		assert.throws(() => parseBlocks(source), GuardExceeded);
	});

	it("trips the guard with the nesting reason, never a RangeError", () => {
		let caught: unknown;
		try {
			parseBlocks(`${">".repeat(300)} foo\n`);
		} catch (error) {
			caught = error;
		}

		assert.isTrue(isGuardExceeded(caught), "a deep document must trip the guard, not overflow the stack");
		assert.isFalse(caught instanceof RangeError);
		if (isGuardExceeded(caught)) {
			assert.strictEqual(caught.reason, "NestingDepthExceeded");
			assert.strictEqual(caught.limit, MAX_NESTING_DEPTH);
		}
	});

	it("guards deeply nested lists on the same counter", () => {
		const source = `${"- ".repeat(300)}foo\n`;
		assert.throws(() => parseBlocks(source), GuardExceeded);
	});

	it("parses a document nested just under the cap", () => {
		// The positive control: the guard must not fire early, or the test
		// above would pass for the wrong reason.
		const { root } = parseBlocks(`${">".repeat(MAX_NESTING_DEPTH - 2)} foo\n`);
		assert.strictEqual(root.children[0]?.type, "blockquote");
	});
});
