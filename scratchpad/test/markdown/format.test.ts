// The format/modify offset-splice layer: marker normalization as guarded
// edits, and node-identity surgical replacement.
//
// Two postures pinned here. `format` is conservative by construction: an
// edit is emitted only when the rewrite is provably safe against re-parse
// hazards (setext underlines, list merges, intraword `_`, container
// prefixes); hazardous conversions are skipped, never attempted. `modify`
// is toml-strict: replacements are node fragments or plain text — both
// rendered through the canonical stringifier — so every modified document
// re-parses cleanly by construction; raw markdown replacement is
// deliberately not offered day one.

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Markdown } from "../../effected/markdown/Markdown.ts";
import { MarkdownDocument } from "../../effected/markdown/MarkdownDocument.ts";
import { MarkdownEdit } from "../../effected/markdown/MarkdownEdit.ts";
import { MarkdownFormat, MarkdownFormattingOptions, MarkdownModificationError } from "../../effected/markdown/MarkdownFormat.ts";
import type { MarkdownNode } from "../../effected/markdown/MarkdownNode.ts";
import { Blockquote, Heading, Paragraph, Point, Position, Text } from "../../effected/markdown/MarkdownNode.ts";
import { renderHtml } from "./e2e/support/htmlWriter.ts";

/** A throwaway span for hand-built fragments; modify never reads fragment offsets. */
const span = (): Position =>
	Position.make({
		start: Point.make({ line: 1, column: 1, offset: 0 }),
		end: Point.make({ line: 1, column: 1, offset: 0 }),
	});

const fmt = (text: string, options: Parameters<typeof MarkdownFormattingOptions.make>[0]): string =>
	MarkdownFormat.formatToString(text, undefined, MarkdownFormattingOptions.make(options));

const parseDoc = (text: string) => MarkdownDocument.parse(text);

/** Render-equivalence: the formatted text parses to the same HTML as the original. */
const assertEquivalent = (original: string, formatted: string): void => {
	const before = Markdown.parseResult(original);
	const after = Markdown.parseResult(formatted);
	assert.isTrue(before._tag === "Success" && after._tag === "Success");
	if (before._tag === "Success" && after._tag === "Success") {
		assert.strictEqual(renderHtml(after.success, { gfm: true }), renderHtml(before.success, { gfm: true }));
	}
};

describe("MarkdownFormat.format", () => {
	describe("thematicBreakChar", () => {
		it("rewrites a break to the target character", () => {
			assert.strictEqual(fmt("a\n\n***\n", { thematicBreakChar: "-" }), "a\n\n---\n");
		});

		it("rewrites toward underscore", () => {
			assert.strictEqual(fmt("***\n", { thematicBreakChar: "_" }), "___\n");
		});

		it("skips a dash rewrite that would read as a setext underline", () => {
			assert.strictEqual(fmt("a\n***\n", { thematicBreakChar: "-" }), "a\n***\n");
		});

		it("normalizes a spaced break form to a plain run", () => {
			const result = fmt("a\n\n- - -\n", { thematicBreakChar: "*" });
			assert.strictEqual(result, "a\n\n***\n");
		});
	});

	describe("headingStyle", () => {
		it("converts setext to atx preserving content verbatim", () => {
			assert.strictEqual(fmt("foo *bar*\n=========\n", { headingStyle: "atx" }), "# foo *bar*\n");
		});

		it("converts a depth-2 setext to atx", () => {
			assert.strictEqual(fmt("bar\n---\n", { headingStyle: "atx" }), "## bar\n");
		});

		it("converts setext to atx inside a blockquote", () => {
			assert.strictEqual(fmt("> foo\n> ===\n", { headingStyle: "atx" }), "> # foo\n");
		});

		it("converts atx to setext at depths one and two", () => {
			const result = fmt("# foo\n\n## bar\n", { headingStyle: "setext" });
			assertEquivalent("# foo\n\n## bar\n", result);
			assert.notInclude(result, "# ");
		});

		it("leaves atx depth three and up alone under a setext target", () => {
			assert.strictEqual(fmt("### foo\n", { headingStyle: "setext" }), "### foo\n");
		});

		it("leaves an empty atx heading alone under a setext target", () => {
			assert.strictEqual(fmt("#\n", { headingStyle: "setext" }), "#\n");
		});

		it("skips atx-to-setext when the content would re-parse as a list item", () => {
			assert.strictEqual(fmt("## - foo\n", { headingStyle: "setext" }), "## - foo\n");
		});

		it("skips atx-to-setext inside a blockquote", () => {
			assert.strictEqual(fmt("> # foo\n", { headingStyle: "setext" }), "> # foo\n");
		});
	});

	describe("bulletChar", () => {
		it("rewrites every item marker in a list, nested lists included", () => {
			assert.strictEqual(fmt("* a\n  * b\n* c\n", { bulletChar: "-" }), "- a\n  - b\n- c\n");
		});

		it("skips a list whose rewrite would merge it with an adjacent sibling list", () => {
			assert.strictEqual(fmt("- a\n\n* b\n", { bulletChar: "-" }), "- a\n\n* b\n");
		});

		it("leaves ordered lists untouched", () => {
			assert.strictEqual(fmt("1. a\n2. b\n", { bulletChar: "-" }), "1. a\n2. b\n");
		});
	});

	describe("emphasisChar", () => {
		it("rewrites emphasis and strong markers", () => {
			assert.strictEqual(fmt("_foo_ and __bar__\n", { emphasisChar: "*" }), "*foo* and **bar**\n");
		});

		it("rewrites toward underscore when flanks are clear", () => {
			assert.strictEqual(fmt("*foo* and **bar**\n", { emphasisChar: "_" }), "_foo_ and __bar__\n");
		});

		it("skips an underscore target at an intraword boundary", () => {
			assert.strictEqual(fmt("*foo*bar\n", { emphasisChar: "_" }), "*foo*bar\n");
		});

		it("skips a rewrite that would abut a same-marker child run", () => {
			const source = "_a *b*_\n";
			assert.strictEqual(fmt(source, { emphasisChar: "*" }), source);
		});
	});

	describe("fenceChar", () => {
		it("rewrites a backtick fence to tildes", () => {
			assert.strictEqual(fmt("```js\ncode\n```\n", { fenceChar: "~" }), "~~~js\ncode\n~~~\n");
		});

		it("skips tilde-to-backtick when the info string holds a backtick", () => {
			const source = "~~~a`b\nx\n~~~\n";
			assert.strictEqual(fmt(source, { fenceChar: "`" }), source);
		});

		it("lengthens the fence past interior runs of the target character", () => {
			assert.strictEqual(fmt("```\n~~~\n```\n", { fenceChar: "~" }), "~~~~\n~~~\n~~~~\n");
		});

		it("leaves indented code untouched", () => {
			assert.strictEqual(fmt("    code\n", { fenceChar: "~" }), "    code\n");
		});
	});

	describe("codeBlockStyle", () => {
		it("absent, both code-block spellings survive untouched (the pinned default)", () => {
			const source = "    indented\n\n```\nfenced\n```\n";
			assert.strictEqual(fmt(source, {}), source);
		});

		it("fenced converts a language-less indented block to a backtick fence", () => {
			assert.strictEqual(fmt("    code\n", { codeBlockStyle: "fenced" }), "```\ncode\n```\n");
		});

		it("fenced honors the fenceChar option for the new fence", () => {
			assert.strictEqual(fmt("    code\n", { codeBlockStyle: "fenced", fenceChar: "~" }), "~~~\ncode\n~~~\n");
		});

		it("fenced preserves interior blank lines of a merged indented block", () => {
			assert.strictEqual(fmt("    a\n\n    b\n", { codeBlockStyle: "fenced" }), "```\na\n\nb\n```\n");
		});

		it("fenced grows the fence past interior runs of the fence character", () => {
			assert.strictEqual(fmt("    a\n    ```\n", { codeBlockStyle: "fenced" }), "````\na\n```\n````\n");
		});

		it("fenced leaves an existing fence to fenceChar normalization", () => {
			assert.strictEqual(fmt("```js\ncode\n```\n", { codeBlockStyle: "fenced", fenceChar: "~" }), "~~~js\ncode\n~~~\n");
		});

		it("fenced skips an indented block inside a container", () => {
			const source = ">     code\n";
			assert.strictEqual(fmt(source, { codeBlockStyle: "fenced" }), source);
		});

		it("indented converts a language-less fence", () => {
			assert.strictEqual(fmt("```\ncode\n```\n", { codeBlockStyle: "indented" }), "    code\n");
		});

		it("indented emits no fenceChar edit on a span it converted", () => {
			assert.strictEqual(fmt("```\ncode\n```\n", { codeBlockStyle: "indented", fenceChar: "~" }), "    code\n");
		});

		it("indented preserves interior blank lines", () => {
			assert.strictEqual(fmt("```\na\n\nb\n```\n", { codeBlockStyle: "indented" }), "    a\n\n    b\n");
		});

		it("indented leaves a fence with a language alone", () => {
			const source = "```js\ncode\n```\n";
			assert.strictEqual(fmt(source, { codeBlockStyle: "indented" }), source);
		});

		it("indented skips a fence whose indented form would lazily continue a paragraph", () => {
			const source = "para\n```\ncode\n```\n";
			assert.strictEqual(fmt(source, { codeBlockStyle: "indented" }), source);
		});

		it("indented skips a fence a preceding list would absorb", () => {
			const source = "- a\n\n```\ncode\n```\n";
			assert.strictEqual(fmt(source, { codeBlockStyle: "indented" }), source);
		});

		it("indented skips a fence adjacent to a language-less code sibling", () => {
			const source = "```\na\n```\n\n    b\n";
			assert.strictEqual(fmt(source, { codeBlockStyle: "indented" }), source);
		});

		it("indented skips an empty fence", () => {
			const source = "```\n```\n";
			assert.strictEqual(fmt(source, { codeBlockStyle: "indented" }), source);
		});

		it("indented skips a value with a blank first line", () => {
			const source = "```\n\nx\n```\n";
			assert.strictEqual(fmt(source, { codeBlockStyle: "indented" }), source);
		});

		it("indented skips a fence inside a blockquote", () => {
			const source = "> ```\n> code\n> ```\n";
			assert.strictEqual(fmt(source, { codeBlockStyle: "indented" }), source);
		});

		it("both directions are idempotent", () => {
			for (const codeBlockStyle of ["fenced", "indented"] as const) {
				const options = MarkdownFormattingOptions.make({ codeBlockStyle });
				const source = "    a\n\npara\n\n```\nb\n```\n";
				const once = MarkdownFormat.formatToString(source, undefined, options);
				const twice = MarkdownFormat.formatToString(once, undefined, options);
				assert.strictEqual(twice, once);
			}
		});

		it("keeps converted documents render-equivalent", () => {
			for (const codeBlockStyle of ["fenced", "indented"] as const) {
				const source = "    a\n\npara\n\n```\nb\n```\n\n~~~py\nc\n~~~\n";
				assertEquivalent(source, fmt(source, { codeBlockStyle }));
			}
		});
	});

	describe("composition and stability", () => {
		it("applies several options in one pass", () => {
			const result = fmt("* a\n\n***\n\n_x_\n", { bulletChar: "-", thematicBreakChar: "*", emphasisChar: "*" });
			assert.strictEqual(result, "- a\n\n***\n\n*x*\n");
		});

		it("yields zero edits on an already-canonical document", () => {
			const canonical = "# t\n\n- a\n\n***\n\n*x* **y**\n\n```js\ncode\n```\n";
			const edits = MarkdownFormat.format(
				canonical,
				undefined,
				MarkdownFormattingOptions.make({
					headingStyle: "atx",
					bulletChar: "-",
					thematicBreakChar: "*",
					emphasisChar: "*",
					fenceChar: "`",
					codeBlockStyle: "fenced",
				}),
			);
			assert.strictEqual(edits.length, 0);
		});

		it("is idempotent", () => {
			const source = "foo\n===\n\n* a\n* b\n\n___\n\n__x__\n";
			const options = MarkdownFormattingOptions.make({
				headingStyle: "atx",
				bulletChar: "-",
				thematicBreakChar: "*",
				emphasisChar: "*",
			});
			const once = MarkdownFormat.formatToString(source, undefined, options);
			const twice = MarkdownFormat.formatToString(once, undefined, options);
			assert.strictEqual(twice, once);
		});

		it("keeps the formatted document render-equivalent", () => {
			const source = "foo\n===\n\n* a\n  * b\n\n___\n\n__x__ and _y_\n\n```\ncode\n```\n";
			const result = fmt(source, {
				headingStyle: "atx",
				bulletChar: "-",
				thematicBreakChar: "*",
				emphasisChar: "*",
				fenceChar: "~",
			});
			assertEquivalent(source, result);
		});

		it("restricts edits to the requested range by owning node", () => {
			const source = "a\n\n***\n\nb\n\n___\n";
			const edits = MarkdownFormat.format(
				source,
				{ offset: 0, length: 6 },
				MarkdownFormattingOptions.make({ thematicBreakChar: "-" }),
			);
			assert.strictEqual(edits.length, 1);
			assert.strictEqual(edits[0]?.offset, 3);
		});

		it("returns no edits when parsing trips a hardening guard", () => {
			const hostile = `${">".repeat(300)}a`;
			const edits = MarkdownFormat.format(hostile, undefined, MarkdownFormattingOptions.make({ bulletChar: "-" }));
			assert.strictEqual(edits.length, 0);
		});
	});
});

describe("MarkdownFormat.modify", () => {
	const firstChild = (doc: MarkdownDocument): MarkdownNode => doc.root.children[0] as MarkdownNode;

	it.effect("replaces a flow node with plain text, block-wrapped", () =>
		Effect.gen(function* () {
			const doc = yield* parseDoc("# a\n\np\n");
			const out = yield* MarkdownFormat.modifyToString(doc, firstChild(doc), "hello");
			assert.strictEqual(out, "hello\n\np\n");
		}),
	);

	it.effect("replaces a flow node with a flow fragment rendered canonically", () =>
		Effect.gen(function* () {
			const doc = yield* parseDoc("p one\n\np two\n");
			const fragment = Heading.make({
				depth: 2,
				children: [Text.make({ value: "t", position: span() })],
				position: span(),
			});
			const out = yield* MarkdownFormat.modifyToString(doc, firstChild(doc), fragment);
			assert.strictEqual(out, "## t\n\np two\n");
		}),
	);

	it.effect("escapes plain-text replacement of a phrasing node", () =>
		Effect.gen(function* () {
			const doc = yield* parseDoc("before *target* after\n");
			const para = firstChild(doc) as Paragraph;
			const target = para.children[1] as MarkdownNode;
			const out = yield* MarkdownFormat.modifyToString(doc, target, "a *b*");
			const reparsed = yield* parseDoc(out);
			assert.strictEqual(renderHtml(reparsed.root, { gfm: true }), "<p>before a *b* after</p>\n");
		}),
	);

	it.effect("replaces table-cell content with pipe-safe text", () =>
		Effect.gen(function* () {
			const doc = yield* parseDoc("| h |\n| - |\n| x |\n");
			const table = doc.root.children[0] as { children: ReadonlyArray<{ children: ReadonlyArray<MarkdownNode> }> };
			const row = table.children[1];
			assert.isDefined(row);
			if (row === undefined) assert.fail("expected a table row");
			const cell = row.children[0];
			if (cell === undefined) assert.fail("expected a table cell");
			const out = yield* MarkdownFormat.modifyToString(doc, cell, "a|b");
			const reparsed = yield* parseDoc(out);
			assert.include(renderHtml(reparsed.root, { gfm: true }), "a|b");
		}),
	);

	it.effect("fails typed when the node is not in the document", () =>
		Effect.gen(function* () {
			const doc = yield* parseDoc("p\n");
			const stranger = Paragraph.make({ children: [Text.make({ value: "x", position: span() })], position: span() });
			const error = yield* Effect.flip(MarkdownFormat.modify(doc, stranger, "y"));
			assert.instanceOf(error, MarkdownModificationError);
			assert.strictEqual(error.code, "NodeNotInDocument");
		}),
	);

	it.effect("fails typed on a fragment category mismatch", () =>
		Effect.gen(function* () {
			const doc = yield* parseDoc("p\n");
			const phrasing = Text.make({ value: "x", position: span() });
			const error = yield* Effect.flip(MarkdownFormat.modify(doc, firstChild(doc), phrasing));
			assert.instanceOf(error, MarkdownModificationError);
			assert.strictEqual(error.code, "FragmentCategoryMismatch");
		}),
	);

	it.effect("refuses an unsupported target kind", () =>
		Effect.gen(function* () {
			const doc = yield* parseDoc("- a\n");
			const list = doc.root.children[0] as { children: ReadonlyArray<MarkdownNode> };
			const item = list.children[0];
			if (item === undefined) assert.fail("expected a list item");
			const error = yield* Effect.flip(MarkdownFormat.modify(doc, item, "x"));
			assert.instanceOf(error, MarkdownModificationError);
			assert.strictEqual(error.code, "UnsupportedTarget");
		}),
	);

	it.effect("refuses a multi-line replacement inside a container", () =>
		Effect.gen(function* () {
			const doc = yield* parseDoc("> p\n");
			const quote = doc.root.children[0] as { children: ReadonlyArray<MarkdownNode> };
			const target = quote.children[0];
			if (target === undefined) assert.fail("expected a blockquote child");
			const fragment = Blockquote.make({
				children: [
					Paragraph.make({ children: [Text.make({ value: "a", position: span() })], position: span() }),
					Paragraph.make({ children: [Text.make({ value: "b", position: span() })], position: span() }),
				],
				position: span(),
			});
			const error = yield* Effect.flip(MarkdownFormat.modify(doc, target, fragment));
			assert.instanceOf(error, MarkdownModificationError);
			assert.strictEqual(error.code, "UnsupportedTarget");
		}),
	);

	it.effect("single-line replacement inside a container works", () =>
		Effect.gen(function* () {
			const doc = yield* parseDoc("> p\n");
			const quote = doc.root.children[0] as { children: ReadonlyArray<MarkdownNode> };
			const target = quote.children[0];
			if (target === undefined) assert.fail("expected a blockquote child");
			const out = yield* MarkdownFormat.modifyToString(doc, target, "q");
			assert.strictEqual(out, "> q\n");
		}),
	);

	it.effect("modify returns edits that compose through applyAll", () =>
		Effect.gen(function* () {
			const doc = yield* parseDoc("# a\n");
			const edits = yield* MarkdownFormat.modify(doc, firstChild(doc), "b");
			assert.strictEqual(MarkdownEdit.applyAll(doc.source, edits), "b\n");
		}),
	);
});
