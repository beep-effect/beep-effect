// Unit coverage for the GFM task-list item construct.
//
// Semantics authority is cmark-gfm 0.29.0.gfm.13 — `extensions/tasklist.c`
// and the generated `_scan_tasklist` in `extensions/ext_scanners.c`. The three
// `extensions.txt` conformance examples only sample the happy path; these
// assert the rules behind it: the marker grammar the scanner accepts, the
// fact that the scan runs over the RAW LINE from column zero (which is what
// keeps a task marker out of a blockquote or a same-line nested item), the
// checked-state scan, the source offsets left behind once the marker is
// consumed, and that the `commonmark` dialect never sees a task item at all.

import { assert, describe, it } from "@effect/vitest";
import { parseBlocks } from "../../effected/markdown/internal/blockParser.ts";
import type { FlowContent, Frontmatter, ListItem, MdxjsEsm, Text } from "../../effected/markdown/MarkdownNode.ts";

/** Every list item in a source, in document order, however deeply nested. */
const itemsOf = (source: string, dialect: "commonmark" | "gfm" = "gfm"): ReadonlyArray<ListItem> => {
	const found: ListItem[] = [];
	const walk = (nodes: ReadonlyArray<Frontmatter | MdxjsEsm | FlowContent>): void => {
		for (const node of nodes) {
			if (node.type === "list") {
				for (const item of node.children) {
					found.push(item);
					walk(item.children);
				}
			} else if (node.type === "blockquote") {
				walk(node.children);
			}
		}
	};
	walk(parseBlocks(source, { dialect: dialect }).root.children);
	return found;
};

/** The first list item a source produces; fails the test if it produced none. */
const firstItem = (source: string, dialect: "commonmark" | "gfm" = "gfm"): ListItem => {
	const item = itemsOf(source, dialect)[0];
	assert.isDefined(item, "expected the source to parse as a list item");
	return item;
};

/** The first text node inside a list item, or `undefined` if it holds none. */
const firstText = (item: ListItem): Text | undefined => {
	const paragraph = item.children[0];
	if (paragraph?.type !== "paragraph") {
		return undefined;
	}
	const text = paragraph.children[0];
	return text?.type === "text" ? text : undefined;
};

/** The first text node's value, or `""` when the item has no text at all. */
const textOf = (item: ListItem): string => firstText(item)?.value ?? "";

describe("gfm task-list items", () => {
	describe("the marker sets checked", () => {
		it("reads an unchecked marker as false", () => {
			assert.strictEqual(firstItem("- [ ] foo").checked, false);
		});

		it("reads a lowercase checked marker as true", () => {
			assert.strictEqual(firstItem("- [x] foo").checked, true);
		});

		it("reads an uppercase checked marker as true", () => {
			// The generated scanner accepts ` `, `x` AND `X` between the
			// brackets, even though `ext_scanners.re`'s source rule lists only
			// the first two; `tasklist.c` then tests for both cases.
			assert.strictEqual(firstItem("- [X] foo").checked, true);
		});

		it("reads a marker on an ordered item", () => {
			assert.strictEqual(firstItem("1. [x] foo").checked, true);
		});

		it("reads a marker on a deeper bullet character", () => {
			assert.strictEqual(firstItem("* [ ] foo").checked, false);
			assert.strictEqual(firstItem("+ [x] foo").checked, true);
		});
	});

	describe("checked is genuinely absent on a plain item", () => {
		it("leaves no key at all when there is no marker", () => {
			const item = firstItem("- foo");
			assert.isFalse(Object.hasOwn(item, "checked"));
		});

		it("leaves no key when the bracket content is not a task marker", () => {
			const item = firstItem("- [@] foo");
			assert.isFalse(Object.hasOwn(item, "checked"));
			assert.strictEqual(textOf(item), "[@] foo");
		});
	});

	describe("the marker grammar", () => {
		it("requires whitespace after the closing bracket", () => {
			const item = firstItem("- [x]foo");
			assert.isFalse(Object.hasOwn(item, "checked"));
			assert.strictEqual(textOf(item), "[x]foo");
		});

		it("does not match a marker that ends the line", () => {
			// `spacechar+` is required after `]`, and the line terminator is
			// not a `spacechar` — so an item whose whole content is a marker
			// is not a task item.
			const item = firstItem("- [x]");
			assert.isFalse(Object.hasOwn(item, "checked"));
			assert.strictEqual(textOf(item), "[x]");
		});

		it("matches a marker followed by whitespace and nothing else", () => {
			const item = firstItem("- [ ] ");
			assert.strictEqual(item.checked, false);
			assert.deepStrictEqual([...item.children], []);
		});

		it("requires exactly one character between the brackets", () => {
			assert.isFalse(Object.hasOwn(firstItem("- [xx] foo"), "checked"));
			assert.isFalse(Object.hasOwn(firstItem("- [] foo"), "checked"));
		});

		it("does not match a marker that is not the item's first content", () => {
			const item = firstItem("- foo [x] bar");
			assert.isFalse(Object.hasOwn(item, "checked"));
			assert.strictEqual(textOf(item), "foo [x] bar");
		});

		it("does not match a marker on a continuation line", () => {
			const item = firstItem("- foo\n  [x] bar");
			assert.isFalse(Object.hasOwn(item, "checked"));
		});

		it("does not match a marker outside a list", () => {
			const source = "[x] foo";
			const block = parseBlocks(source, { dialect: "gfm" }).root.children[0];
			assert.strictEqual(block?.type, "paragraph");
		});
	});

	describe("the scan runs over the raw line from column zero", () => {
		it("does not match inside a blockquote", () => {
			// `_scan_tasklist` is applied at offset 0 of the whole line, so a
			// `>` prefix means the line never looks like a task item to
			// cmark-gfm. Preserved deliberately.
			const item = firstItem("> - [x] foo");
			assert.isFalse(Object.hasOwn(item, "checked"));
			assert.strictEqual(textOf(item), "[x] foo");
		});

		it("does not match a nested item opened on the same line", () => {
			// `- - [x] foo` puts a second list marker between column zero and
			// the bracket, which the scanner's grammar does not admit.
			const items = itemsOf("- - [x] foo");
			assert.strictEqual(items.length, 2);
			for (const item of items) {
				assert.isFalse(Object.hasOwn(item, "checked"));
			}
		});

		it("matches a nested item opened on its own line", () => {
			const items = itemsOf("- [x] foo\n  - [ ] bar\n  - [X] baz\n- [ ] bim");
			assert.deepStrictEqual(
				items.map((item) => item.checked),
				[true, false, true, false],
			);
		});

		it("matches an item indented by up to three spaces", () => {
			assert.strictEqual(firstItem("   - [x] foo").checked, true);
		});
	});

	describe("the checked state comes from a whole-line scan", () => {
		it("preserves cmark-gfm's whole-line search for a checked marker", () => {
			// `tasklist.c` sets `checked` with `strstr(input, "[x]")` over the
			// ENTIRE line rather than the bytes the scanner matched. A later
			// `[x]` in the item's text therefore checks the box. This is an
			// upstream quirk, reproduced on purpose: the reference
			// implementation is the contract.
			const item = firstItem("- [ ] foo [x]");
			assert.strictEqual(item.checked, true);
			assert.strictEqual(textOf(item), "foo [x]");
		});
	});

	describe("the consumed marker", () => {
		it("removes the marker from the item's content", () => {
			assert.strictEqual(textOf(firstItem("- [x] foo")), "foo");
		});

		it("leaves the first text node positioned on the source it came from", () => {
			const source = "- [x] foo";
			const text = firstText(firstItem(source));
			assert.isDefined(text);
			assert.strictEqual(text.value, "foo");
			assert.strictEqual(text.position.start.offset, source.indexOf("foo"));
			assert.strictEqual(text.position.end.offset, source.length);
			assert.strictEqual(text.position.start.column, source.indexOf("foo") + 1);
		});

		it("keeps offsets right for a nested task item on a later line", () => {
			const source = "- [x] foo\n  - [ ] bar\n";
			const inner = itemsOf(source)[1];
			assert.isDefined(inner);
			const text = firstText(inner);
			assert.isDefined(text);
			assert.strictEqual(text.value, "bar");
			assert.strictEqual(text.position.start.offset, source.indexOf("bar"));
			assert.strictEqual(text.position.start.line, 2);
		});

		it("stops the block-start scan the way cmark-gfm's break does", () => {
			// `open_tasklist_item` returns NULL, and `open_new_blocks` breaks
			// on a NULL container — so nothing after a task marker can open
			// another block on that line.
			const item = firstItem("- [x] # foo");
			assert.strictEqual(item.checked, true);
			assert.strictEqual(item.children[0]?.type, "paragraph");
			assert.strictEqual(textOf(item), "# foo");
		});
	});

	describe("the commonmark dialect", () => {
		it("never forms a task item", () => {
			for (const source of ["- [ ] foo", "- [x] foo", "- [X] foo"]) {
				const item = firstItem(source, "commonmark");
				assert.isFalse(Object.hasOwn(item, "checked"));
			}
		});

		it("keeps the marker as literal text", () => {
			const source = "- [x] foo";
			const text = firstText(firstItem(source, "commonmark"));
			assert.isDefined(text);
			assert.strictEqual(text.value, "[x] foo");
			assert.strictEqual(text.position.start.offset, source.indexOf("[x]"));
		});
	});

	describe("interaction with other gfm constructs", () => {
		it("leaves a marker inside a table cell as literal text", () => {
			const source = "| a |\n| - |\n| [x] b |\n";
			const table = parseBlocks(source, { dialect: "gfm" }).root.children.find((child) => child.type === "table");
			assert.isDefined(table);
			const cell = table.children[1]?.children[0];
			assert.isDefined(cell);
			const text = cell.children[0];
			assert.strictEqual(text?.type === "text" ? text.value : undefined, "[x] b");
		});
	});
});
