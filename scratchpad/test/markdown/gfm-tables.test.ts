// Unit coverage for the GFM table block construct.
//
// Semantics authority is cmark-gfm 0.29.0.gfm.13 — `extensions/table.c` and
// the row/delimiter scanners in `extensions/ext_scanners.re`. The conformance
// corpora assert the spec examples; these assert the rules those examples only
// sample: the delimiter-row grammar, the paragraph reclaim, cell-count
// mismatch handling, escaped pipes and the source offsets they shift, and that
// the `commonmark` dialect never sees a table at all.

import { assert, describe, it } from "@effect/vitest";
import { parseBlocks } from "../../effected/markdown/internal/blockParser.ts";
import type { PhrasingContent, Table, TableAlign } from "../../effected/markdown/MarkdownNode.ts";

/** The first block of a source parsed under a dialect. */
const firstBlock = (source: string, dialect: "commonmark" | "gfm" = "gfm") =>
	parseBlocks(source, { dialect: dialect }).root.children[0];

/** The table a source parses to, or `undefined` if it produced anything else. */
const tableOf = (source: string, dialect: "commonmark" | "gfm" = "gfm"): Table | undefined => {
	const block = parseBlocks(source, { dialect: dialect }).root.children.find((child) => child.type === "table");
	return block?.type === "table" ? block : undefined;
};

/** The table a source must parse to; fails the test if it did not form one. */
const requireTable = (source: string, dialect: "commonmark" | "gfm" = "gfm"): Table => {
	const table = tableOf(source, dialect);
	assert.isDefined(table, "expected the source to parse as a table");
	return table;
};

/** A compact rendering of a table: rows of cells, cells as their text. */
const sketchInline = (nodes: ReadonlyArray<PhrasingContent>): string =>
	nodes
		.map((node) => {
			switch (node.type) {
				case "text":
					return JSON.stringify(node.value);
				case "inlineCode":
					return `code${JSON.stringify(node.value)}`;
				case "html":
					return `html${JSON.stringify(node.value)}`;
				case "link":
					return `link(${node.url})[${sketchInline(node.children)}]`;
				case "linkReference":
					return `ref(${node.identifier})[${sketchInline(node.children)}]`;
				case "delete":
					return `del[${sketchInline(node.children)}]`;
				case "emphasis":
					return `em[${sketchInline(node.children)}]`;
				case "strong":
					return `strong[${sketchInline(node.children)}]`;
				default:
					return node.type;
			}
		})
		.join(",");

/** `row|row`, each row `cell/cell`, each cell its compact inline shape. */
const grid = (table: Table): string =>
	table.children.map((row) => row.children.map((cell) => sketchInline(cell.children)).join("/")).join("|");

/** The alignment array, with `null` spelled `-` so a test reads as one string. */
const alignOf = (table: Table): string => (table.align ?? []).map((entry: TableAlign | null) => entry ?? "-").join(",");

describe("gfm tables", () => {
	describe("formation", () => {
		it("forms from a header row and a delimiter row", () => {
			const table = requireTable("| a | b |\n| - | - |\n");
			assert.strictEqual(grid(table), '"a"/"b"');
		});

		it("forms without leading or trailing pipes", () => {
			const table = requireTable("a | b\n--- | ---\nc | d\n");
			assert.strictEqual(grid(table), '"a"/"b"|"c"/"d"');
		});

		it("does not form when the delimiter row's column count differs", () => {
			assert.isUndefined(tableOf("| a | b | c |\n| --- | --- |\n"));
		});

		it("does not form from a delimiter row with no header above it", () => {
			assert.isUndefined(tableOf("| --- | --- |\n"));
		});

		it("does not form when indented four spaces", () => {
			assert.isUndefined(tableOf("    | a | b |\n    | - | - |\n"));
		});

		it("prefers a setext heading to a single-column table", () => {
			const block = firstBlock("a\n---\n");
			assert.strictEqual(block?.type, "heading");
		});

		it("never forms under the commonmark dialect", () => {
			assert.isUndefined(tableOf("| a | b |\n| - | - |\n| c | d |\n", "commonmark"));
			assert.strictEqual(firstBlock("| a | b |\n| - | - |\n", "commonmark")?.type, "paragraph");
		});
	});

	describe("delimiter rows and alignment", () => {
		it("emits one align entry per column, null where undeclared", () => {
			assert.strictEqual(alignOf(requireTable("| a | b |\n| --- | --- |\n")), "-,-");
		});

		it("reads left, center and right markers", () => {
			assert.strictEqual(alignOf(requireTable("a|b|c\n:--|:-:|--:\n")), "left,center,right");
		});

		it("reads a one-dash marker with both colons as center", () => {
			assert.strictEqual(alignOf(requireTable("a\n:-:\n")), "center");
		});

		it("allows whitespace around each marker", () => {
			assert.strictEqual(alignOf(requireTable("a | b\n  :---  |  ---:  \n")), "left,right");
		});

		it("rejects a marker with no dash", () => {
			assert.isUndefined(tableOf("| a | b |\n| : | : |\n"));
		});

		it("rejects a marker with an interior colon", () => {
			assert.isUndefined(tableOf("| a | b |\n| -:- | --- |\n"));
		});

		it("rejects a delimiter row carrying other text", () => {
			assert.isUndefined(tableOf("| a | b |\n| --- | --- | x\n"));
		});
	});

	describe("cell splitting", () => {
		it("treats an empty cell between two pipes as a column", () => {
			assert.strictEqual(grid(requireTable("| a | b | c |\n| - | - | - |\n| d || e |\n")), '"a"/"b"/"c"|"d"//"e"');
		});

		it("trims whitespace around cell content", () => {
			assert.strictEqual(grid(requireTable("|   a   |\n| - |\n|\t b \t|\n")), '"a"|"b"');
		});

		it("unescapes an escaped pipe into cell text", () => {
			assert.strictEqual(grid(requireTable("| a |\n| - |\n| x \\| y |\n")), '"a"|"x | y"');
		});

		it("keeps an escaped pipe inside a code span as a literal pipe", () => {
			assert.strictEqual(grid(requireTable("| a |\n| - |\n| `x\\|y` |\n")), '"a"|code"x|y"');
		});

		it("splits on an unescaped pipe even inside a code span", () => {
			// Cell splitting runs before inline parsing, so the backtick pair
			// cannot protect a bare pipe — cmark-gfm's documented behavior.
			// Three cells split out of the row, truncated to the header's two,
			// and neither surviving backtick has a partner left to pair with.
			assert.strictEqual(grid(requireTable("| a | b |\n| - | - |\n| `x|y` | z |\n")), '"a"/"b"|"`x"/"y`"');
		});

		it("leaves a doubled backslash alone", () => {
			assert.strictEqual(grid(requireTable("| a |\n| - |\n| \\\\ |\n")), '"a"|"\\\\"');
		});

		it("does not treat a pipe after an escaped backslash as escaped", () => {
			assert.strictEqual(grid(requireTable("| a | b |\n| - | - |\n| x\\\\ | y |\n")), '"a"/"b"|"x\\\\"/"y"');
		});
	});

	describe("cell count mismatches", () => {
		it("pads a short row with empty cells", () => {
			assert.strictEqual(grid(requireTable("| a | b | c |\n| - | - | - |\n| x |\n")), '"a"/"b"/"c"|"x"//');
		});

		it("truncates a long row", () => {
			assert.strictEqual(grid(requireTable("| a | b |\n| - | - |\n| w | x | y | z |\n")), '"a"/"b"|"w"/"x"');
		});

		it("gives a padded cell a zero-width position", () => {
			const table = requireTable("| a | b |\n| - | - |\n| x |\n");
			const padded = table.children[1]?.children[1];
			assert.isDefined(padded);
			assert.strictEqual(padded.position.start.offset, padded.position.end.offset);
		});
	});

	describe("paragraph interaction", () => {
		it("reclaims only the last paragraph line as the header", () => {
			const { root } = parseBlocks("123\n456\n| a | b |\n| - | - |\nd | e\n", { dialect: "gfm" });
			const [paragraph, table] = root.children;
			assert.isTrue(paragraph?.type === "paragraph", "the reclaimed lines are a paragraph");
			const text = paragraph?.type === "paragraph" ? paragraph.children[0] : undefined;
			assert.strictEqual(text?.type === "text" ? text.value : "", "123\n456");
			assert.isTrue(table?.type === "table", "the header line became a table");
			assert.strictEqual(table?.type === "table" ? grid(table) : "", '"a"/"b"|"d"/"e"');
		});

		it("starts the table at the reclaimed header line, not the paragraph", () => {
			const source = "123\n| a |\n| - |\n";
			const table = requireTable(source);
			assert.strictEqual(table.position.start.offset, source.indexOf("| a |"));
		});

		it("is interrupted by a block-level construct", () => {
			const { root } = parseBlocks("| a | b |\n| - | - |\n| c | d |\n> quoted\n", { dialect: "gfm" });
			assert.strictEqual(root.children[0]?.type, "table");
			assert.strictEqual(root.children[1]?.type, "blockquote");
		});

		it("ends at a blank line and the next paragraph stands alone", () => {
			const { root } = parseBlocks("| a | b |\n| - | - |\n| c | d |\n\ntext\n", { dialect: "gfm" });
			assert.strictEqual(root.children[0]?.type, "table");
			assert.strictEqual(root.children[1]?.type, "paragraph");
		});

		it("absorbs a following pipe-less line as a one-cell row", () => {
			// cmark-gfm's row scanner accepts any non-blank line as a row, so a
			// plain line under a table is a padded row, not a paragraph.
			assert.strictEqual(grid(requireTable("| a | b |\n| - | - |\ntext\n")), '"a"/"b"|"text"/');
		});
	});

	describe("inline content in cells", () => {
		it("parses emphasis, code and strikethrough inside a cell", () => {
			const table = requireTable("| a | b | c |\n| - | - | - |\n| *x* | `y` | ~~z~~ |\n");
			assert.strictEqual(grid(table), '"a"/"b"/"c"|em["x"]/code"y"/del["z"]');
		});

		it("parses an autolink literal inside a cell", () => {
			const table = requireTable("| a |\n| - |\n| www.example.com |\n");
			assert.strictEqual(grid(table), '"a"|link(http://www.example.com)["www.example.com"]');
		});

		it("forms a reference link in a header cell against a later definition", () => {
			// References are emitted unresolved by design (P1): what matters
			// here is that a cell consults the refmap at all, which is what
			// makes the reference a `linkReference` and not literal text.
			const table = requireTable("| [ref][] |\n| - |\n| x |\n\n[ref]: /url\n");
			assert.strictEqual(grid(table), 'ref(ref)["ref"]|"x"');
		});

		it("does not parse a block construct inside a cell", () => {
			assert.strictEqual(grid(requireTable("| a |\n| - |\n| # not a heading |\n")), '"a"|"# not a heading"');
		});
	});

	describe("positions", () => {
		it("spans each cell's trimmed content, excluding the delimiter pipes", () => {
			const source = "| a | b |\n| - | - |\n| xy | z |\n";
			const table = requireTable(source);
			const [first, second] = table.children[1]?.children ?? [];
			assert.isDefined(first);
			assert.isDefined(second);
			assert.strictEqual(first.position.start.offset, source.indexOf("xy"));
			assert.strictEqual(first.position.end.offset, source.indexOf("xy") + 2);
			assert.strictEqual(second.position.start.offset, source.lastIndexOf("z"));
			assert.strictEqual(second.position.end.offset, source.lastIndexOf("z") + 1);
		});

		it("keeps source offsets correct after an escaped pipe", () => {
			const source = "| a | b |\n| - | - |\n| x\\|y | z |\n";
			const table = requireTable(source);
			const [first, second] = table.children[1]?.children ?? [];
			assert.isDefined(first);
			assert.isDefined(second);
			// The cell text is `x|y` — one character shorter than the source it
			// came from, so the end offset must clear the escape, not the text.
			assert.strictEqual(first.position.start.offset, source.indexOf("x\\|y"));
			assert.strictEqual(first.position.end.offset, source.indexOf("x\\|y") + 4);
			assert.strictEqual(second.position.start.offset, source.lastIndexOf("z"));
		});

		it("spans the whole construct on the table and each row", () => {
			const source = "| a |\n| - |\n| b |\n";
			const table = requireTable(source);
			assert.strictEqual(table.position.start.offset, 0);
			assert.strictEqual(table.position.end.offset, source.length - 1);
			assert.strictEqual(table.children[0]?.position.start.offset, 0);
			assert.strictEqual(table.children[1]?.position.start.offset, source.indexOf("| b |"));
		});

		it("carries 1-based lines on every node", () => {
			const table = requireTable("| a |\n| - |\n| b |\n");
			assert.strictEqual(table.position.start.line, 1);
			assert.strictEqual(table.children[1]?.position.start.line, 3);
			assert.strictEqual(table.children[1]?.children[0]?.position.start.line, 3);
		});
	});

	describe("containers", () => {
		it("forms inside a blockquote", () => {
			const { root } = parseBlocks("> | a | b |\n> | - | - |\n> | c | d |\n", { dialect: "gfm" });
			const quote = root.children[0];
			const table = quote?.type === "blockquote" ? quote.children[0] : undefined;
			assert.isTrue(table?.type === "table", "the blockquote holds a table");
			assert.strictEqual(table?.type === "table" ? grid(table) : "", '"a"/"b"|"c"/"d"');
		});

		it("forms inside a list item", () => {
			const { root } = parseBlocks("- | a | b |\n  | - | - |\n  | c | d |\n", { dialect: "gfm" });
			const list = root.children[0];
			const table = list?.type === "list" ? list.children[0]?.children[0] : undefined;
			assert.isTrue(table?.type === "table", "the list item holds a table");
			assert.strictEqual(table?.type === "table" ? grid(table) : "", '"a"/"b"|"c"/"d"');
		});
	});
});
