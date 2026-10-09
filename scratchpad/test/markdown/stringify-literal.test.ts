// `Text.escapeStyle: "literal"` (#489): the caller vouches a text value is
// already safe markdown, so the emitter drops every inline-phase escape and
// keeps only the ones defending block structure. The canonical path must not
// move by a byte — the canonical-form suites in `stringify.test.ts` pin that,
// and the "canonical is unchanged" cases here pin it for the exact shapes the
// literal path touches.

import { assert, describe, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { Markdown } from "../../effected/markdown/Markdown.ts";
import {
	Emphasis,
	Heading,
	InlineCode,
	MdxFlowExpression,
	Paragraph,
	Root,
	Table,
	TableCell,
	TableRow,
	Text,
} from "../../effected/markdown/MarkdownNode.ts";
import { Mdast } from "../../effected/markdown/Mdast.ts";

const ProjectedRecords = S.Array(S.Record(S.String, S.Unknown));
const isRecords = S.is(ProjectedRecords);

type EscapeStyle = "canonical" | "literal";

const literal = (value: string): Text => Text.make({ value, escapeStyle: "literal" });
const canonical = (value: string): Text => Text.make({ value });

const out = (root: Root): string => {
	const result = Markdown.stringifyResult(root);
	if (Result.isFailure(result)) {
		assert.fail(`stringify failed: ${result.failure.message}`);
	}
	return Result.getOrThrow(result);
};

const parse = (source: string): Root => Result.getOrThrow(Markdown.parseResult(source));

describe("adjacent text run boundaries", () => {
	it("keeps canonical underscore boundaries and split entity defenses", () => {
		const children = [canonical("a"), canonical("_"), canonical("b &a"), canonical("mp;"), canonical("")];
		const paragraph = Paragraph.make({ children });
		const before = paragraph.children;
		assert.strictEqual(out(Root.make({ children: [paragraph] })), "a\\_b \\&amp;\n");
		assert.strictEqual(paragraph.children, before);
		for (let index = 0; index < children.length; index += 1) {
			assert.strictEqual(paragraph.children[index], children[index]);
		}
	});

	it("keeps mixed escape styles and restarts lookahead after non-text siblings", () => {
		const children = [literal("a_"), canonical("b_"), literal("C:\\"), canonical(""),
			InlineCode.make({ value: "x" }), canonical("&a"), literal("mp;"), literal("~1")];
		const paragraph = Paragraph.make({ children });
		const before = paragraph.children;
		assert.strictEqual(out(Root.make({ children: [paragraph] })), "a_b\\_C:\\\\`x`\\&amp;~1\n");
		assert.strictEqual(paragraph.children, before);
		const first = children[0];
		const second = children[1];
		if (first?.type !== "text" || second?.type !== "text") assert.fail("expected text siblings");
		assert.strictEqual(first.escapeStyle, "literal");
		assert.strictEqual(second.escapeStyle, undefined);
	});

	it("defends split literal block openers and heading hash runs across empty siblings", () => {
		assert.strictEqual(out(paragraphOf(literal("-"), literal(""), canonical(" item"))), "\\- item\n");
		assert.strictEqual(out(Root.make({ children: [Heading.make({ depth: 2,
			children: [literal("v #"), canonical(""), literal("#"), canonical(" ")],
		})] })), "## v \\#\\# \n");
		assert.strictEqual(out(Root.make({ children: [Heading.make({ depth: 2,
			children: [canonical("v #"), literal(" tail")],
		})] })), "## v # tail\n");
	});
});

const tableOf = (rows: ReadonlyArray<ReadonlyArray<ReadonlyArray<Text>>>): Root =>
	Root.make({
		children: [
			Table.make({
				children: rows.map((cells) =>
					TableRow.make({ children: cells.map((children) => TableCell.make({ children: [...children] })) }),
				),
			}),
		],
	});

const paragraphOf = (...children: ReadonlyArray<Paragraph["children"][number]>): Root =>
	Root.make({ children: [Paragraph.make({ children: [...children] })] });

/** Every cell's concatenated text value, row by row, from a parsed table. */
const cellValues = (root: Root): ReadonlyArray<ReadonlyArray<string>> => {
	const table = root.children[0];
	if (table?.type !== "table") {
		assert.fail(`expected a table, got ${table?.type}`);
	}
	return table.children.map((row) =>
		row.children.map((cell) => cell.children.map((child) => (child.type === "text" ? child.value : "")).join("")),
	);
};

// The consumer's shape: savvy-web/systems silk-effects builds plain mdast
// `tableCell > text` nodes and admits them through `Mdast.fromMdastResult`.
const HEADER = ["Dependency", "Type", "Action", "From", "To"];
const ROWS = [
	["@scope/pkg", "dependency", "updated", "~0.2.1", "^1.0.0"],
	["some_pkg", "devDependency", "added", "—", "^1.0.0"],
];

const plainTable = (escapeStyle: EscapeStyle | undefined): unknown => ({
	type: "root",
	children: [
		{
			type: "table",
			align: [null, null, null, null, null],
			children: [HEADER, ...ROWS].map((texts) => ({
				type: "tableRow",
				children: texts.map((value) => ({
					type: "tableCell",
					children: [{ type: "text", value, ...(escapeStyle === undefined ? {} : { escapeStyle }) }],
				})),
			})),
		},
	],
});

const decodePlain = (input: unknown): Root => {
	const result = Mdast.fromMdastResult(input);
	if (Result.isFailure(result)) {
		assert.fail(`decode failed: ${result.failure.message}`);
	}
	return Result.getOrThrow(result);
};

describe("Text escapeStyle: literal", () => {
	describe("a dependency table (the #489 consumer shape)", () => {
		it("emits ranges and package names verbatim in cells", () => {
			assert.strictEqual(
				out(decodePlain(plainTable("literal"))),
				[
					"| Dependency | Type | Action | From | To |",
					"| --- | --- | --- | --- | --- |",
					"| @scope/pkg | dependency | updated | ~0.2.1 | ^1.0.0 |",
					"| some_pkg | devDependency | added | — | ^1.0.0 |",
					"",
				].join("\n"),
			);
		});

		it("re-parses to the same cell values", () => {
			assert.deepStrictEqual(cellValues(parse(out(decodePlain(plainTable("literal"))))), [HEADER, ...ROWS]);
		});

		it("leaves the canonical bytes of the same table unchanged", () => {
			const pinned = [
				"| Dependency | Type | Action | From | To |",
				"| --- | --- | --- | --- | --- |",
				"| @scope/pkg | dependency | updated | \\~0.2.1 | ^1.0.0 |",
				"| some_pkg | devDependency | added | — | ^1.0.0 |",
				"",
			].join("\n");
			assert.strictEqual(out(decodePlain(plainTable(undefined))), pinned);
			assert.strictEqual(out(decodePlain(plainTable("canonical"))), pinned);
		});
	});

	describe("structural escapes a literal cell keeps", () => {
		it("escapes a bare pipe", () => {
			const emitted = out(tableOf([[[literal("a|b")]]]));
			assert.strictEqual(emitted, "| a\\|b |\n| --- |\n");
			assert.deepStrictEqual(cellValues(parse(emitted)), [["a|b"]]);
		});

		it("keeps an already-escaped pipe as one escape, not two", () => {
			const emitted = out(tableOf([[[literal("a\\|b")]]]));
			assert.strictEqual(emitted, "| a\\|b |\n| --- |\n");
			assert.deepStrictEqual(cellValues(parse(emitted)), [["a|b"]]);
		});

		it("escapes a pipe after an escaped backslash, which would otherwise split the cell", () => {
			const emitted = out(tableOf([[[literal("a\\\\|b")]]]));
			assert.strictEqual(emitted, "| a\\\\\\|b |\n| --- |\n");
			assert.strictEqual(cellValues(parse(emitted))[0]?.length, 1);
		});

		it("doubles a value-final backslash when more cell content follows", () => {
			const emitted = out(tableOf([[[literal("a\\"), canonical("|b")]]]));
			assert.strictEqual(emitted, "| a\\\\\\|b |\n| --- |\n");
			assert.deepStrictEqual(cellValues(parse(emitted)), [["a\\|b"]]);
		});

		it("leaves a value-final backslash alone when it ends the cell", () => {
			const emitted = out(tableOf([[[literal("a\\")], [literal("b")]]]));
			assert.strictEqual(emitted, "| a\\ | b |\n| --- | --- |\n");
			assert.deepStrictEqual(cellValues(parse(emitted)), [["a\\", "b"]]);
		});

		it("turns a newline into a space so the row stays one line", () => {
			const emitted = out(tableOf([[[literal("a\nb")], [literal("c")]]]));
			assert.strictEqual(emitted, "| a b | c |\n| --- | --- |\n");
			assert.deepStrictEqual(cellValues(parse(emitted)), [["a b", "c"]]);
		});
	});

	describe("structural escapes a literal paragraph keeps", () => {
		const blockOpeners = [
			["# heading", "\\# heading"],
			["- item", "\\- item"],
			["+ item", "\\+ item"],
			["* item", "\\* item"],
			["***", "\\***"],
			["___", "\\___"],
			["> quote", "\\> quote"],
			["1. one", "1\\. one"],
			["```", "\\```"],
			["~~~", "\\~~~"],
			["<div>", "\\<div>"],
			["[a]: /u", "\\[a]: /u"],
		] as const;
		for (const [value, expected] of blockOpeners) {
			it(`escapes the line-start opener in ${JSON.stringify(value)}`, () => {
				const emitted = out(paragraphOf(literal(value)));
				assert.strictEqual(emitted, `${expected}\n`);
				const reparsed = parse(emitted);
				assert.strictEqual(reparsed.children.length, 1, `emitted: ${JSON.stringify(emitted)}`);
				assert.strictEqual(reparsed.children[0]?.type, "paragraph", `emitted: ${JSON.stringify(emitted)}`);
			});
		}

		it("escapes an opener at a line start after a soft break, and nothing mid-line", () => {
			const emitted = out(paragraphOf(literal("x ~1.0 a_b\n- y\n= z\n==\n| --- |")));
			assert.strictEqual(emitted, "x ~1.0 a_b\n\\- y\n= z\n\\==\n\\| --- |\n");
			const reparsed = parse(emitted);
			assert.strictEqual(reparsed.children.length, 1);
			assert.strictEqual(reparsed.children[0]?.type, "paragraph");
		});

		// Only text that can open a block at a line start is escaped: a marker
		// needs its trailing space, tab or end of line, a break or fence its
		// run. Each emitted line must parse back to one paragraph carrying the
		// exact value.
		const lineStarts = [
			["~0.2.1", "~0.2.1"],
			["~~~x", "\\~~~x"],
			["```x", "\\```x"],
			["``x", "``x"],
			["1.0.0", "1.0.0"],
			["1. x", "1\\. x"],
			["2) x", "2\\) x"],
			["1.", "1\\."],
			["1234567890. x", "1234567890. x"],
			["- x", "\\- x"],
			["-x", "-x"],
			["-", "\\-"],
			["--", "\\--"],
			["--- | ---", "\\--- | ---"],
			["-:", "\\-:"],
			["---json", "\\---json"],
			["+ x", "\\+ x"],
			["+1", "+1"],
			["+++", "\\+++"],
			["*a*", "*a*"],
			["* x", "\\* x"],
			["***", "\\***"],
			["* * *", "\\* * *"],
			["_a_", "_a_"],
			["___", "\\___"],
			["# x", "\\# x"],
			["#x", "#x"],
			["#", "\\#"],
			["####### x", "####### x"],
			["=", "\\="],
			["=x", "=x"],
			["> x", "\\> x"],
			[">x", "\\>x"],
		] as const;
		for (const [value, expected] of lineStarts) {
			it(`emits the line start of ${JSON.stringify(value)} as ${JSON.stringify(expected)}`, () => {
				const emitted = out(paragraphOf(literal(value)));
				assert.strictEqual(emitted, `${expected}\n`);
				const reparsed = parse(emitted);
				assert.strictEqual(reparsed.children.length, 1, `emitted: ${JSON.stringify(emitted)}`);
				const paragraph = reparsed.children[0];
				assert.strictEqual(paragraph?.type, "paragraph", `emitted: ${JSON.stringify(emitted)}`);
				if (paragraph?.type === "paragraph" && paragraph.children.every((child) => child.type === "text")) {
					assert.strictEqual(paragraph.children.map((child) => child.value).join(""), value);
				}
			});
		}

		it("escapes a line start that is an opener only once the following siblings are read", () => {
			assert.strictEqual(out(paragraphOf(literal("1."), canonical(" x"))), "1\\. x\n");
			assert.strictEqual(out(paragraphOf(literal("1."), canonical("0"))), "1.0\n");
			assert.strictEqual(out(paragraphOf(literal("#"), literal("x"))), "#x\n");
			assert.strictEqual(out(paragraphOf(literal("#"), literal(" x"))), "\\# x\n");
		});

		it("escapes a marker whose next character belongs to a non-text sibling", () => {
			const emitted = out(paragraphOf(literal("-"), InlineCode.make({ value: "x" })));
			assert.strictEqual(emitted, "\\-`x`\n");
			const fence = out(paragraphOf(literal("``"), InlineCode.make({ value: "x" })));
			assert.strictEqual(fence, "\\```x`\n");
			assert.strictEqual(parse(fence).children[0]?.type, "paragraph");
		});

		it("escapes a break-shaped run that a parent's closing marker could complete", () => {
			const emitted = out(paragraphOf(Emphasis.make({ children: [literal("a\n**")] })));
			assert.strictEqual(emitted, "*a\n\\***\n");
			const reparsed = parse(emitted);
			assert.strictEqual(reparsed.children.length, 1);
			assert.strictEqual(reparsed.children[0]?.type, "paragraph");
		});

		it("keeps leading indentation inert", () => {
			const emitted = out(paragraphOf(literal("    code?")));
			assert.strictEqual(emitted, "&#32;   code?\n");
			assert.strictEqual(parse(emitted).children[0]?.type, "paragraph");
		});

		it("keeps a blank line from ending the paragraph", () => {
			const emitted = out(paragraphOf(literal("a\n\nb")));
			assert.strictEqual(emitted, "a&#10;&#10;b\n");
			assert.strictEqual(parse(emitted).children.length, 1);
		});

		it("drops every inline-phase escape mid-line", () => {
			const value = "a_ ~b ^c @d/e [f] `g` \\h &amp; www.x.test http://y.test <z";
			assert.strictEqual(out(paragraphOf(literal(value))), `${value}\n`);
		});

		it("does not round-trip a value that parses as markdown — the caller's promise", () => {
			const reparsed = parse(out(paragraphOf(literal("x *a* y"))));
			const paragraph = reparsed.children[0];
			assert.isTrue(paragraph?.type === "paragraph" && paragraph.children.some((child) => child.type === "emphasis"));
		});
	});

	describe("a value-final backslash with more content after it", () => {
		it("is doubled in a paragraph, so it cannot escape the next sibling", () => {
			const emitted = out(paragraphOf(literal("C:\\"), InlineCode.make({ value: "x" })));
			assert.strictEqual(emitted, "C:\\\\`x`\n");
			const paragraph = parse(emitted).children[0];
			assert.isTrue(paragraph?.type === "paragraph");
			if (paragraph?.type === "paragraph") {
				assert.deepStrictEqual(
					paragraph.children.map((child) => [child.type, "value" in child ? child.value : ""]),
					[
						["text", "C:\\"],
						["inlineCode", "x"],
					],
				);
			}
		});

		it("is doubled in a heading, so it cannot escape the next sibling", () => {
			const emitted = out(
				Root.make({
					children: [Heading.make({ depth: 2, children: [literal("C:\\"), InlineCode.make({ value: "x" })] })],
				}),
			);
			assert.strictEqual(emitted, "## C:\\\\`x`\n");
			const heading = parse(emitted).children[0];
			assert.isTrue(heading?.type === "heading");
			if (heading?.type === "heading") {
				assert.deepStrictEqual(
					heading.children.map((child) => [child.type, "value" in child ? child.value : ""]),
					[
						["text", "C:\\"],
						["inlineCode", "x"],
					],
				);
			}
		});

		it("is left alone when it ends the paragraph", () => {
			const emitted = out(paragraphOf(literal("C:\\")));
			assert.strictEqual(emitted, "C:\\\n");
			const paragraph = parse(emitted).children[0];
			assert.isTrue(paragraph?.type === "paragraph" && paragraph.children[0]?.type === "text");
			if (paragraph?.type === "paragraph" && paragraph.children[0]?.type === "text") {
				assert.strictEqual(paragraph.children[0].value, "C:\\");
			}
		});
	});

	describe("structural escapes a literal heading keeps", () => {
		it("escapes a trailing hash run that would read as the closing sequence", () => {
			const emitted = out(Root.make({ children: [Heading.make({ depth: 2, children: [literal("v1 ~2 #")] })] }));
			assert.strictEqual(emitted, "## v1 ~2 \\#\n");
			const heading = parse(emitted).children[0];
			assert.isTrue(heading?.type === "heading" && heading.children[0]?.type === "text");
			if (heading?.type === "heading" && heading.children[0]?.type === "text") {
				assert.strictEqual(heading.children[0].value, "v1 ~2 #");
			}
		});

		it("turns a newline into a space", () => {
			const emitted = out(Root.make({ children: [Heading.make({ depth: 1, children: [literal("a\nb")] })] }));
			assert.strictEqual(emitted, "# a b\n");
		});
	});

	it("keeps `{` and `<` escaped in a tree carrying MDX", () => {
		const emitted = out(
			Root.make({
				children: [Paragraph.make({ children: [literal("a {b} <c")] }), MdxFlowExpression.make({ value: "x" })],
			}),
		);
		assert.strictEqual(emitted, "a \\{b} \\<c\n\n{x}\n");
	});

	describe("admission and projection", () => {
		it("Text.make carries the field", () => {
			assert.strictEqual(literal("x").escapeStyle, "literal");
			assert.isFalse("escapeStyle" in canonical("x"));
		});

		it("Mdast.fromMdast admits escapeStyle on a text node", () => {
			const root = decodePlain({
				type: "root",
				children: [{ type: "paragraph", children: [{ type: "text", value: "~1", escapeStyle: "literal" }] }],
			});
			const paragraph = root.children[0];
			assert.isTrue(paragraph?.type === "paragraph" && paragraph.children[0]?.type === "text");
			if (paragraph?.type === "paragraph" && paragraph.children[0]?.type === "text") {
				assert.strictEqual(paragraph.children[0].escapeStyle, "literal");
			}
		});

		it("Mdast.fromMdast fails typed on an unknown escapeStyle", () => {
			const result = Mdast.fromMdastResult({
				type: "root",
				children: [{ type: "paragraph", children: [{ type: "text", value: "x", escapeStyle: "raw" }] }],
			});
			assertFailure(Result.mapError(result, () => undefined), undefined);
		});

		it("Mdast.toMdast projects escapeStyle only when present", () => {
			const projected = Mdast.toMdast(paragraphOf(literal("a"), canonical("b")));
			const children = projected.children;
			if (!isRecords(children)) assert.fail("expected projected children");
			const paragraph = children[0];
			assert.isDefined(paragraph);
			const textChildren = paragraph.children;
			if (!isRecords(textChildren)) assert.fail("expected projected text children");
			const [first, second] = textChildren;
			assert.strictEqual(first?.escapeStyle, "literal");
			assert.isFalse(second !== undefined && "escapeStyle" in second);
		});

		it("the parser never sets it", () => {
			const paragraph = parse("~0.2.1 some_pkg\n").children[0];
			assert.isTrue(paragraph?.type === "paragraph");
			if (paragraph?.type === "paragraph") {
				for (const child of paragraph.children) {
					assert.isFalse("escapeStyle" in child);
				}
			}
		});
	});
});
