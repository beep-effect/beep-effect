// Canonical stringify: hand-built trees in, markdown source out.
//
// Two kinds of assertion live here. Exact-string cases pin the canonical
// form where it is stable and documented (the default table in
// `src/internal/stringify.ts`); re-parse cases assert the operational
// contract — emitted text must parse back to a render-equivalent document —
// for shapes where the exact spelling is an implementation detail. The
// corpus-wide version of the re-parse property lives in
// `__test__/e2e/stringify-roundtrip.e2e.test.ts`.

import { assert, describe, it } from "@effect/vitest";
import { Effect, Result, Schema } from "effect";
import { Markdown, MarkdownStringifyError } from "../../effected/markdown/Markdown.ts";
import {
	Blockquote,
	Break,
	Code,
	Definition,
	Delete,
	Emphasis,
	FootnoteDefinition,
	FootnoteReference,
	Frontmatter,
	Heading,
	Html,
	Image,
	ImageReference,
	InlineCode,
	Link,
	LinkReference,
	List,
	ListItem,
	Paragraph,
	Point,
	Position,
	Root,
	Strong,
	Table,
	TableCell,
	TableRow,
	Text,
	ThematicBreak,
} from "../../effected/markdown/MarkdownNode.ts";

/** A throwaway span. Stringify never reads offsets, only shapes. */
const span = (): Position =>
	Position.make({
		start: Point.make({ line: 1, column: 1, offset: 0 }),
		end: Point.make({ line: 1, column: 1, offset: 0 }),
	});

const text = (value: string): Text => Text.make({ value, position: span() });

const paragraph = (...children: Paragraph["children"][number][]): Paragraph =>
	Paragraph.make({ children, position: span() });

const rootOf = (...children: ReadonlyArray<Root["children"][number]>): Root =>
	Root.make({ children, position: span() });

/** stringify, asserting success. */
const out = (root: Root): string => {
	const result = Markdown.stringifyResult(root);
	if (Result.isFailure(result)) {
		assert.fail(`stringify failed: ${result.failure.message}`);
	}
	return Result.getOrThrow(result);
};

/** Render-equivalence through the real parser: emitted text re-parses. */
const reparses = (root: Root, expectType: string): void => {
	const emitted = out(root);
	const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
	assert.strictEqual(reparsed.children[0]?.type, expectType, `emitted: ${JSON.stringify(emitted)}`);
};

// The canonical-form table published on `Markdown.stringifyResult`'s TSDoc is a
// STABILITY COMMITMENT: consumers are told they may assert against these bytes,
// and that changing one is a breaking change. A published promise that no test
// pins is a promise that drifts, so each row of that table is asserted here in
// the same order it is documented.
//
// If you change a row, you are making a breaking change — update the table, the
// package README and this suite together, and bump accordingly.
describe("Markdown.stringify — the documented canonical form", () => {
	it("heading: ATX at every depth", () => {
		for (const depth of [1, 2, 3, 4, 5, 6] as const) {
			const heading = Heading.make({ depth, children: [text("T")], position: span() });
			assert.strictEqual(out(rootOf(heading)), `${"#".repeat(depth)} T\n`);
		}
	});

	it("thematic break: ***", () => {
		assert.strictEqual(out(rootOf(ThematicBreak.make({ position: span() }))), "***\n");
	});

	it("bullet list marker: -", () => {
		const list = List.make({
			ordered: false,
			spread: false,
			children: [ListItem.make({ spread: false, children: [paragraph(text("a"))], position: span() })],
			position: span(),
		});
		assert.strictEqual(out(rootOf(list)), "- a\n");
	});

	it("ordered list delimiter: .", () => {
		const list = List.make({
			ordered: true,
			spread: false,
			children: [ListItem.make({ spread: false, children: [paragraph(text("a"))], position: span() })],
			position: span(),
		});
		assert.strictEqual(out(rootOf(list)), "1. a\n");
	});

	it("ordered list delimiter flips to ) to separate an adjacent sibling list", () => {
		const item = (value: string) =>
			ListItem.make({ spread: false, children: [paragraph(text(value))], position: span() });
		const list = (child: string) =>
			List.make({ ordered: true, spread: false, children: [item(child)], position: span() });
		// The one documented exception to the row above, and the reason the table
		// states it: two adjacent ordered lists that both emitted `.` would reparse
		// as ONE list.
		const emitted = out(rootOf(list("a"), list("b")));
		assert.strictEqual(emitted, "1. a\n\n1) b\n");
		// The delimiter flip only earns its place if the emitted text actually
		// reparses as TWO lists — substring assertions pass even when it does not.
		const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
		assert.strictEqual(reparsed.children.length, 2);
		assert.strictEqual(reparsed.children[0]?.type, "list");
		assert.strictEqual(reparsed.children[1]?.type, "list");
	});

	it("emphasis * and strong **", () => {
		const tree = rootOf(
			paragraph(
				Emphasis.make({ children: [text("em")], position: span() }),
				text(" "),
				Strong.make({ children: [text("st")], position: span() }),
			),
		);
		assert.strictEqual(out(tree), "*em* **st**\n");
	});

	it("code block: indented with neither lang nor fenceChar", () => {
		const code = Code.make({ value: "let x = 1;", position: span() });
		assert.strictEqual(out(rootOf(code)), "    let x = 1;\n");
	});

	it("code block: fenced once a lang is present, and the fence grows past interior backticks", () => {
		const plain = Code.make({ value: "x", lang: "js", position: span() });
		assert.strictEqual(out(rootOf(plain)), "```js\nx\n```\n");

		const nested = Code.make({ value: "a ``` b", lang: "js", position: span() });
		const emitted = out(rootOf(nested));
		// A fence that did not grow would terminate the block early — the emitted
		// text must re-parse as ONE code node carrying the whole value.
		const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
		assert.strictEqual(reparsed.children.length, 1);
		assert.strictEqual(reparsed.children[0]?.type, "code");
	});

	it("code block: representability forces a fence where indenting would not reparse", () => {
		// The documented exception to the row above, and a REAL split in the
		// canonical form: an indented block directly after a list is absorbed as
		// list content, so the emitter fences instead. A byte assertion over
		// synthesized code blocks therefore depends on the preceding sibling.
		const bare = Code.make({ value: "A", position: span() });
		const list = List.make({
			ordered: false,
			spread: false,
			children: [ListItem.make({ spread: false, children: [paragraph(text("item"))], position: span() })],
			position: span(),
		});

		// Alone, and after a paragraph: indented, per the row.
		assert.strictEqual(out(rootOf(bare)), "    A\n");
		assert.strictEqual(out(rootOf(paragraph(text("p")), bare)), "p\n\n    A\n");

		// Directly after a list: fenced.
		const afterList = out(rootOf(list, bare));
		assert.strictEqual(afterList, "- item\n\n```\nA\n```\n");

		// And the reason it must: the emitted text has to reparse as a list
		// followed by a SEPARATE code node, which indenting would not give.
		const reparsed = Result.getOrThrow(Markdown.parseResult(afterList));
		assert.strictEqual(reparsed.children.length, 2);
		assert.strictEqual(reparsed.children[0]?.type, "list");
		assert.strictEqual(reparsed.children[1]?.type, "code");
	});

	it("block separation: exactly one blank line", () => {
		assert.strictEqual(out(rootOf(paragraph(text("a")), paragraph(text("b")))), "a\n\nb\n");
	});

	it("document: a single trailing newline", () => {
		const emitted = out(rootOf(paragraph(text("a"))));
		assert.isTrue(emitted.endsWith("\n"));
		assert.isFalse(emitted.endsWith("\n\n"));
	});

	it("a fidelity field overrides its row", () => {
		// The table describes a SYNTHESIZED node; a parsed one re-serializes in its
		// author's spelling. Both halves are load-bearing for the promise.
		const setext = Heading.make({ depth: 1, children: [text("T")], position: span(), headingStyle: "setext" });
		// The underline is sized to the heading text, so a one-character heading
		// gets a one-character rule.
		assert.strictEqual(out(rootOf(setext)), "T\n=\n");
		const dashBreak = ThematicBreak.make({ position: span(), markerChar: "_" });
		assert.strictEqual(out(rootOf(dashBreak)), "___\n");
	});
});

describe("Markdown.stringify", () => {
	describe("blocks, canonical defaults", () => {
		it("paragraph", () => {
			assert.strictEqual(out(rootOf(paragraph(text("hello world")))), "hello world\n");
		});

		it("ATX heading by default", () => {
			const heading = Heading.make({ depth: 2, children: [text("Title")], position: span() });
			assert.strictEqual(out(rootOf(heading)), "## Title\n");
		});

		it("setext heading when fidelity says so", () => {
			const heading = Heading.make({
				depth: 1,
				children: [text("Title")],
				position: span(),
				headingStyle: "setext",
			});
			assert.strictEqual(out(rootOf(heading)), "Title\n=====\n");
		});

		it("setext fidelity at depth 3 falls back to ATX", () => {
			const heading = Heading.make({
				depth: 3,
				children: [text("Title")],
				position: span(),
				headingStyle: "setext",
			});
			assert.strictEqual(out(rootOf(heading)), "### Title\n");
		});

		it("thematic break defaults to ***", () => {
			assert.strictEqual(out(rootOf(ThematicBreak.make({ position: span() }))), "***\n");
		});

		it("thematic break honors markerChar", () => {
			assert.strictEqual(out(rootOf(ThematicBreak.make({ position: span(), markerChar: "_" }))), "___\n");
		});

		it("fenced code with fidelity", () => {
			const code = Code.make({
				value: "let x = 1;",
				lang: "js",
				position: span(),
				fenceChar: "~",
				fenceLength: 4,
			});
			assert.strictEqual(out(rootOf(code)), "~~~~js\nlet x = 1;\n~~~~\n");
		});

		it("indented code when fidelity marks it indented", () => {
			const code = Code.make({ value: "a\nb", position: span() });
			assert.strictEqual(out(rootOf(code)), "    a\n    b\n");
		});

		it("indented fidelity with a lang forces a fence", () => {
			const code = Code.make({ value: "x", lang: "js", position: span() });
			assert.strictEqual(out(rootOf(code)), "```js\nx\n```\n");
		});

		it("fence grows past interior backtick runs", () => {
			const code = Code.make({ value: "``` inside", position: span(), fenceChar: "`", fenceLength: 3 });
			assert.strictEqual(out(rootOf(code)), "````\n``` inside\n````\n");
		});

		it("blockquote prefixes every line", () => {
			const quote = Blockquote.make({
				children: [paragraph(text("a")), paragraph(text("b"))],
				position: span(),
			});
			assert.strictEqual(out(rootOf(quote)), "> a\n>\n> b\n");
		});

		it("html block passes through verbatim", () => {
			const html = Html.make({ value: "<div>\n<p>x</p>\n</div>", position: span() });
			assert.strictEqual(out(rootOf(html)), "<div>\n<p>x</p>\n</div>\n");
		});

		it("definition with title, label case preserved", () => {
			const definition = Definition.make({
				identifier: "ref",
				label: "Ref",
				url: "/url",
				title: "the title",
				position: span(),
			});
			assert.strictEqual(out(rootOf(definition)), '[Ref]: /url "the title"\n');
		});

		it("definition with an empty or spacey destination uses pointy brackets", () => {
			const empty = Definition.make({ identifier: "a", url: "", position: span() });
			const spacey = Definition.make({ identifier: "b", url: "/u r l", position: span() });
			assert.strictEqual(out(rootOf(empty)), "[a]: <>\n");
			assert.strictEqual(out(rootOf(spacey)), "[b]: </u r l>\n");
		});

		it("blocks join with one blank line", () => {
			assert.strictEqual(out(rootOf(paragraph(text("a")), paragraph(text("b")))), "a\n\nb\n");
		});

		it("empty root stringifies to the empty string", () => {
			assert.strictEqual(out(rootOf()), "");
		});
	});

	describe("lists", () => {
		it("tight bullet list with defaults", () => {
			const list = List.make({
				ordered: false,
				spread: false,
				children: [
					ListItem.make({ spread: false, children: [paragraph(text("one"))], position: span() }),
					ListItem.make({ spread: false, children: [paragraph(text("two"))], position: span() }),
				],
				position: span(),
			});
			assert.strictEqual(out(rootOf(list)), "- one\n- two\n");
		});

		it("ordered list counts up from start with fidelity delimiter", () => {
			const list = List.make({
				ordered: true,
				start: 3,
				spread: false,
				children: [
					ListItem.make({ spread: false, children: [paragraph(text("a"))], position: span() }),
					ListItem.make({ spread: false, children: [paragraph(text("b"))], position: span() }),
				],
				position: span(),
				delimiter: ")",
			});
			assert.strictEqual(out(rootOf(list)), "3) a\n4) b\n");
		});

		it("loose list separates items with a blank line", () => {
			const list = List.make({
				ordered: false,
				spread: true,
				children: [
					ListItem.make({ spread: true, children: [paragraph(text("a"))], position: span() }),
					ListItem.make({ spread: true, children: [paragraph(text("b"))], position: span() }),
				],
				position: span(),
			});
			assert.strictEqual(out(rootOf(list)), "- a\n\n- b\n");
		});

		it("continuation lines indent to the marker width", () => {
			const list = List.make({
				ordered: false,
				spread: true,
				children: [
					ListItem.make({
						spread: true,
						children: [paragraph(text("first")), paragraph(text("second"))],
						position: span(),
					}),
				],
				position: span(),
			});
			assert.strictEqual(out(rootOf(list)), "- first\n\n  second\n");
		});

		it("task items carry their checkbox", () => {
			const list = List.make({
				ordered: false,
				spread: false,
				children: [
					ListItem.make({ spread: false, checked: true, children: [paragraph(text("done"))], position: span() }),
					ListItem.make({ spread: false, checked: false, children: [paragraph(text("todo"))], position: span() }),
				],
				position: span(),
			});
			assert.strictEqual(out(rootOf(list)), "- [x] done\n- [ ] todo\n");
		});

		it("adjacent same-marker lists alternate markers so they stay separate", () => {
			const item = (label: string): ListItem =>
				ListItem.make({ spread: false, children: [paragraph(text(label))], position: span() });
			const listA = List.make({ ordered: false, spread: false, children: [item("a")], position: span() });
			const listB = List.make({ ordered: false, spread: false, children: [item("b")], position: span() });
			const emitted = out(rootOf(listA, listB));
			const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
			assert.deepStrictEqual(
				reparsed.children.map((child) => child.type),
				["list", "list"],
				`emitted: ${JSON.stringify(emitted)}`,
			);
		});

		it("nested list nests by indentation", () => {
			const inner = List.make({
				ordered: false,
				spread: false,
				children: [ListItem.make({ spread: false, children: [paragraph(text("inner"))], position: span() })],
				position: span(),
			});
			const outer = List.make({
				ordered: false,
				spread: false,
				children: [ListItem.make({ spread: false, children: [paragraph(text("outer")), inner], position: span() })],
				position: span(),
			});
			assert.strictEqual(out(rootOf(outer)), "- outer\n  - inner\n");
		});
	});

	describe("gfm blocks", () => {
		it("table with alignment row", () => {
			const cell = (value: string): TableCell => TableCell.make({ children: [text(value)], position: span() });
			const row = (...cells: ReadonlyArray<TableCell>): TableRow =>
				TableRow.make({ children: cells, position: span() });
			const table = Table.make({
				align: ["left", null, "center"],
				children: [row(cell("a"), cell("b"), cell("c")), row(cell("1"), cell("2"), cell("3"))],
				position: span(),
			});
			assert.strictEqual(out(rootOf(table)), "| a | b | c |\n| :-- | --- | :-: |\n| 1 | 2 | 3 |\n");
		});

		it("pipes inside cells are escaped", () => {
			const table = Table.make({
				children: [
					TableRow.make({
						children: [TableCell.make({ children: [text("a|b")], position: span() })],
						position: span(),
					}),
				],
				position: span(),
			});
			const emitted = out(rootOf(table));
			assert.include(emitted, "a\\|b");
			const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
			assert.strictEqual(reparsed.children[0]?.type, "table");
		});

		// The cell splitter reads `\\` as ONE escaped character, so a pipe
		// after an even run of backslashes is a real column boundary. Raw
		// emissions (a code span, inline HTML) carry backslashes verbatim, and
		// the post-pass must count the run rather than peek one character back.
		describe("a raw cell pipe after an escaped backslash stays in its cell", () => {
			const rawCells = [
				["inline code", (value: string) => InlineCode.make({ value, position: span() })],
				["html", (value: string) => Html.make({ value: `<b title="${value}">`, position: span() })],
			] as const;
			const values = ["a|b", "a\\\\|b", "a\\\\\\\\|b", "\\\\|"];
			for (const [kind, make] of rawCells) {
				for (const value of values) {
					it(`${kind} ${JSON.stringify(value)}`, () => {
						const node = make(value);
						const table = Table.make({
							children: [
								TableRow.make({
									children: [
										TableCell.make({ children: [node], position: span() }),
										TableCell.make({ children: [text("x")], position: span() }),
									],
									position: span(),
								}),
							],
							position: span(),
						});
						const emitted = out(rootOf(table));
						const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
						const first = reparsed.children[0];
						assert.strictEqual(first?.type, "table", `emitted: ${JSON.stringify(emitted)}`);
						if (first?.type !== "table") return;
						const cells = first.children[0]?.children ?? [];
						assert.strictEqual(cells.length, 2, `emitted: ${JSON.stringify(emitted)}`);
						const [child] = cells[0]?.children ?? [];
						assert.strictEqual(child?.type, node.type, `emitted: ${JSON.stringify(emitted)}`);
						assert.strictEqual(
							child !== undefined && "value" in child ? child.value : undefined,
							node.value,
							`emitted: ${JSON.stringify(emitted)}`,
						);
					});
				}
			}

			it("pins the emitted bytes", () => {
				const tableOf = (node: InlineCode | Html): Root =>
					rootOf(
						Table.make({
							children: [
								TableRow.make({
									children: [TableCell.make({ children: [node], position: span() })],
									position: span(),
								}),
							],
							position: span(),
						}),
					);
				const code = (value: string) => out(tableOf(InlineCode.make({ value, position: span() })));
				const html = (value: string) => out(tableOf(Html.make({ value, position: span() })));
				assert.strictEqual(code("a|b"), "| `a\\|b` |\n| --- |\n");
				assert.strictEqual(code("a\\\\|b"), "| `a\\\\\\|b` |\n| --- |\n");
				assert.strictEqual(code("a\\\\\\\\|b"), "| `a\\\\\\\\\\|b` |\n| --- |\n");
				assert.strictEqual(html('<b title="a\\\\|b">'), '| <b title="a\\\\\\|b"> |\n| --- |\n');
			});
		});

		it("footnote definition with continuation indentation", () => {
			const definition = FootnoteDefinition.make({
				identifier: "note",
				children: [paragraph(text("first")), paragraph(text("second"))],
				position: span(),
			});
			assert.strictEqual(out(rootOf(definition)), "[^note]: first\n\n    second\n");
		});

		it("footnote reference round-trips against its definition", () => {
			const tree = rootOf(
				paragraph(text("body"), FootnoteReference.make({ identifier: "n", position: span() })),
				FootnoteDefinition.make({ identifier: "n", children: [paragraph(text("note"))], position: span() }),
			);
			const emitted = out(tree);
			assert.include(emitted, "[^n]");
			const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
			const firstParagraph = reparsed.children[0];
			assert.strictEqual(firstParagraph?.type, "paragraph");
			assert.isTrue(
				firstParagraph?.type === "paragraph" &&
					firstParagraph.children.some((child) => child.type === "footnoteReference"),
				`emitted: ${JSON.stringify(emitted)}`,
			);
		});
	});

	describe("frontmatter fences", () => {
		it("yaml", () => {
			const tree = rootOf(
				Frontmatter.make({ format: "yaml", value: "title: x", position: span() }),
				paragraph(text("body")),
			);
			assert.strictEqual(out(tree), "---\ntitle: x\n---\n\nbody\n");
		});

		it("toml", () => {
			const tree = rootOf(Frontmatter.make({ format: "toml", value: 'title = "x"', position: span() }));
			assert.strictEqual(out(tree), '+++\ntitle = "x"\n+++\n');
		});

		it("json closes with three dashes and re-parses", () => {
			const tree = rootOf(Frontmatter.make({ format: "json", value: '{ "a": 1 }', position: span() }));
			const emitted = out(tree);
			assert.strictEqual(emitted, '---json\n{ "a": 1 }\n---\n');
			const reparsed = Result.getOrThrow(Markdown.parseResult(emitted, { frontmatter: true }));
			assert.strictEqual(reparsed.children[0]?.type, "frontmatter");
		});
	});

	describe("inlines", () => {
		it("emphasis and strong with default markers", () => {
			const tree = rootOf(
				paragraph(
					Emphasis.make({ children: [text("em")], position: span() }),
					text(" and "),
					Strong.make({ children: [text("st")], position: span() }),
				),
			);
			assert.strictEqual(out(tree), "*em* and **st**\n");
		});

		it("underscore fidelity is honored", () => {
			const tree = rootOf(paragraph(Emphasis.make({ children: [text("em")], position: span(), markerChar: "_" })));
			assert.strictEqual(out(tree), "_em_\n");
		});

		it("strikethrough", () => {
			const tree = rootOf(paragraph(Delete.make({ children: [text("gone")], position: span() })));
			assert.strictEqual(out(tree), "~~gone~~\n");
		});

		it("nested strong-in-emphasis re-parses to the same shape", () => {
			const tree = rootOf(
				paragraph(
					Emphasis.make({
						children: [Strong.make({ children: [text("both")], position: span() })],
						position: span(),
					}),
				),
			);
			reparses(tree, "paragraph");
			const emitted = out(tree);
			const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
			const p = reparsed.children[0];
			assert.isTrue(p?.type === "paragraph" && p.children[0]?.type === "emphasis", `emitted: ${emitted}`);
		});

		it("emphasis-in-strong flips the inner marker rather than fusing runs", () => {
			const tree = rootOf(
				paragraph(
					Strong.make({
						children: [Emphasis.make({ children: [text("both")], position: span() })],
						position: span(),
					}),
				),
			);
			const emitted = out(tree);
			const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
			const p = reparsed.children[0];
			assert.isTrue(p?.type === "paragraph" && p.children[0]?.type === "strong", `emitted: ${emitted}`);
		});

		it("inline code picks a longer run than its content", () => {
			const tree = rootOf(paragraph(InlineCode.make({ value: "a ` b", position: span() })));
			assert.strictEqual(out(tree), "``a ` b``\n");
		});

		it("inline code starting with a backtick pads with spaces", () => {
			const tree = rootOf(paragraph(InlineCode.make({ value: "`x", position: span() })));
			assert.strictEqual(out(tree), "`` `x ``\n");
		});

		it("hard break defaults to backslash", () => {
			const tree = rootOf(paragraph(text("a"), Break.make({ position: span() }), text("b")));
			assert.strictEqual(out(tree), "a\\\nb\n");
		});

		it("hard break honors the spaces spelling", () => {
			const tree = rootOf(paragraph(text("a"), Break.make({ position: span(), breakStyle: "spaces" }), text("b")));
			assert.strictEqual(out(tree), "a  \nb\n");
		});

		it("soft break is a newline in the text and survives", () => {
			const tree = rootOf(paragraph(text("a\nb")));
			assert.strictEqual(out(tree), "a\nb\n");
		});

		it("link with title", () => {
			const tree = rootOf(paragraph(Link.make({ url: "/u", title: "t", children: [text("x")], position: span() })));
			assert.strictEqual(out(tree), '[x](/u "t")\n');
		});

		it("image with alt and no title", () => {
			const tree = rootOf(paragraph(Image.make({ url: "/i.png", alt: "pic", position: span() })));
			assert.strictEqual(out(tree), "![pic](/i.png)\n");
		});

		it("link reference forms by referenceType", () => {
			// A shortcut or collapsed reference's bracket IS its label, so
			// those forms emit the label; only a full reference carries free
			// content in its first bracket. In a parsed tree the label and
			// children always agree — the divergence here is synthesized.
			const make = (referenceType: "full" | "collapsed" | "shortcut"): Root =>
				rootOf(
					paragraph(
						LinkReference.make({
							identifier: "ref",
							label: "Ref",
							referenceType,
							children: [text("Ref")],
							position: span(),
						}),
					),
					Definition.make({ identifier: "ref", label: "Ref", url: "/u", position: span() }),
				);
			assert.strictEqual(out(make("full")), "[Ref][Ref]\n\n[Ref]: /u\n");
			assert.strictEqual(out(make("collapsed")), "[Ref][]\n\n[Ref]: /u\n");
			assert.strictEqual(out(make("shortcut")), "[Ref]\n\n[Ref]: /u\n");
		});

		it("image reference", () => {
			const tree = rootOf(
				paragraph(ImageReference.make({ identifier: "ref", referenceType: "shortcut", alt: "ref", position: span() })),
				Definition.make({ identifier: "ref", url: "/u", position: span() }),
			);
			assert.strictEqual(out(tree), "![ref]\n\n[ref]: /u\n");
		});

		it("inline html passes through", () => {
			const tree = rootOf(paragraph(text("a "), Html.make({ value: "<b>", position: span() }), text("c")));
			assert.strictEqual(out(tree), "a <b>c\n");
		});
	});

	describe("escaping", () => {
		const literal = (value: string, expectHtmlText: string): void => {
			const emitted = out(rootOf(paragraph(text(value))));
			const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
			const p = reparsed.children[0];
			assert.strictEqual(p?.type, "paragraph", `emitted: ${JSON.stringify(emitted)} became ${p?.type}`);
			if (p?.type !== "paragraph") return;
			assert.deepStrictEqual(
				p.children.map((child) => child.type),
				["text"],
				`emitted: ${JSON.stringify(emitted)} split into ${JSON.stringify(p.children.map((c) => c.type))}`,
			);
			const only = p.children[0];
			assert.isTrue(only?.type === "text" && only.value === expectHtmlText, `round-trip: ${JSON.stringify(emitted)}`);
		};

		it("emphasis markers stay literal", () => literal("a *b* _c_", "a *b* _c_"));
		it("backticks stay literal", () => literal("a `b`", "a `b`"));
		it("brackets stay literal", () => literal("[not a link](x)", "[not a link](x)"));
		it("footnote-shaped text stays literal", () => literal("[^note]", "[^note]"));
		it("autolink-shaped text stays literal", () => literal("<http://x.example>", "<http://x.example>"));
		it("entity-shaped text stays literal", () => literal("&amp; &#65;", "&amp; &#65;"));
		it("tilde runs stay literal", () => literal("~~x~~", "~~x~~"));
		it("backslashes stay literal", () => literal("a \\ b \\* c", "a \\ b \\* c"));
		it("leading hash stays literal", () => literal("# not a heading", "# not a heading"));
		it("leading quote marker stays literal", () => literal("> not a quote", "> not a quote"));
		it("leading list markers stay literal", () => {
			literal("- not a list", "- not a list");
			literal("+ not a list", "+ not a list");
			literal("1. not a list", "1. not a list");
			literal("1) not a list", "1) not a list");
		});
		it("setext-lookalike second line stays a paragraph", () => literal("para\n===", "para\n==="));
		it("thematic-lookalike second line stays a paragraph", () => literal("para\n---", "para\n---"));
		it("line-start rules apply after soft breaks", () => literal("a\n# b\n> c", "a\n# b\n> c"));
		it("pipes stay literal under gfm", () => {
			const emitted = out(rootOf(paragraph(text("a | b\n--- | ---"))));
			const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
			assert.strictEqual(reparsed.children[0]?.type, "paragraph", `emitted: ${JSON.stringify(emitted)}`);
		});
		it("www autolink literal shape survives as text content", () => {
			// Under gfm a bare www literal re-parses as a link; the design's
			// bar is render equivalence of TEXT — a literal that was plain
			// text must stay plain text. The www matcher reads RAW source, so
			// an escaped dot defeats it while decoding back to the same text.
			const emitted = out(rootOf(paragraph(text("www.example.com"))));
			const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
			const p = reparsed.children[0];
			assert.isTrue(
				p?.type === "paragraph" && p.children.every((child) => child.type === "text"),
				`emitted: ${JSON.stringify(emitted)} must not re-parse as an autolink`,
			);
		});
		it("scheme autolink literal shape survives as text content", () => {
			const emitted = out(rootOf(paragraph(text("see http://example.com here"))));
			const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
			const p = reparsed.children[0];
			assert.isTrue(
				p?.type === "paragraph" && p.children.every((child) => child.type === "text"),
				`emitted: ${JSON.stringify(emitted)} must not re-parse as an autolink`,
			);
		});
		it("KNOWN LIMITATION: email-shaped plain text re-parses as an autolink under gfm", () => {
			// The email matcher is a postprocess over DECODED text (the P2
			// hook-placement ruling), so no backslash or entity spelling can
			// hide an email-shaped run from it — the escape decodes away
			// before the scan. Canonical stringify therefore cannot keep
			// email-shaped plain text plain under the gfm dialect; this test
			// pins the limitation so a future fix is a deliberate change.
			const emitted = out(rootOf(paragraph(text("mail a@b.example please"))));
			const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
			const p = reparsed.children[0];
			assert.isTrue(
				p?.type === "paragraph" && p.children.some((child) => child.type === "link"),
				`emitted: ${JSON.stringify(emitted)} — if this now stays text, the limitation was fixed; update this pin`,
			);
		});
	});

	describe("inline text escaping is minimal (parse ∘ stringify identity)", () => {
		// A downstream consumer asserts `parse(stringify(tree))` reproduces the
		// text it put in — byte for byte where the canonical form allows it.
		// Every case below pins the emitted bytes AND re-parses them, asserting
		// the single text node comes back with the original value.
		const heading = (depth: Heading["depth"], ...children: Heading["children"][number][]): Heading =>
			Heading.make({ depth, children, position: span() });

		/** The value of the sole text child of the first block, after re-parsing `emitted`. */
		const reparsedText = (emitted: string, expectType: string): string => {
			const reparsed = Result.getOrThrow(Markdown.parseResult(emitted));
			const block = reparsed.children[0];
			assert.strictEqual(block?.type, expectType, `emitted: ${JSON.stringify(emitted)} became ${block?.type}`);
			if (block?.type !== "paragraph" && block?.type !== "heading") assert.fail("unreachable");
			assert.deepStrictEqual(
				block.children.map((child) => child.type),
				["text"],
				`emitted: ${JSON.stringify(emitted)} split into ${JSON.stringify(block.children.map((c) => c.type))}`,
			);
			const only = block.children[0];
			return only?.type === "text" ? only.value : "";
		};

		const paragraphCase = (value: string, expected: string): void => {
			const emitted = out(rootOf(paragraph(text(value))));
			assert.strictEqual(emitted, expected);
			assert.strictEqual(reparsedText(emitted, "paragraph"), value);
		};

		const headingCase = (depth: Heading["depth"], value: string, expected: string): void => {
			const emitted = out(rootOf(heading(depth, text(value))));
			assert.strictEqual(emitted, expected);
			assert.strictEqual(reparsedText(emitted, "heading"), value);
		};

		/** parse → stringify → the same string. */
		const stringIdentity = (source: string): void => {
			const parsed = Result.getOrThrow(Markdown.parseResult(source));
			assert.strictEqual(out(parsed), source);
		};

		describe("`_` escapes only where it could open or close emphasis", () => {
			it("intraword underscores stay raw in a heading", () =>
				headingCase(1, "DEFAULT_PIPELINE_OPTIONS", "# DEFAULT_PIPELINE_OPTIONS\n"));
			it("intraword underscores stay raw in a paragraph", () => paragraphCase("snake_case_name", "snake_case_name\n"));
			it("boundary and punctuation-adjacent underscores stay escaped", () =>
				paragraphCase("__init__", "\\_\\_init\\_\\_\n"));
			it("space-flanked underscores stay escaped", () => paragraphCase("a _b_ c", "a \\_b\\_ c\n"));
			it("a leading and a trailing underscore stay escaped", () => paragraphCase("_a_", "\\_a\\_\n"));
			it("`*` stays escaped even intraword", () => paragraphCase("a*b*c", "a\\*b\\*c\n"));
			it("parse ∘ stringify is the identity on `# A_B`", () => stringIdentity("# A_B\n"));
		});

		describe("`&` escapes only when the following text is entity-shaped", () => {
			it("a spaced ampersand stays raw", () => paragraphCase("Getters & Setters", "Getters & Setters\n"));
			it("an intraword ampersand stays raw", () => paragraphCase("Q&A", "Q&A\n"));
			it("a named reference shape is escaped", () => paragraphCase("&amp;", "\\&amp;\n"));
			it("a decimal reference shape is escaped", () => paragraphCase("&#123;", "\\&#123;\n"));
			it("a hexadecimal reference shape is escaped", () => paragraphCase("&#x1F600;", "\\&#x1F600;\n"));
			it("an unknown but name-shaped run is still escaped", () => paragraphCase("&zzzz;", "\\&zzzz;\n"));
			it("a one-letter name is not entity-shaped", () => paragraphCase("AT&T;", "AT&T;\n"));
			it("a value-final ampersand with no sibling stays raw", () => paragraphCase("a &", "a &\n"));
			it("an entity split across text siblings is detected", () => {
				// Text("&") + Text("amp;") and Text("&a") + Text("mp;") must not fuse.
				for (const [head, tail] of [
					["a &", "amp;"],
					["a &a", "mp;"],
					["a &#12", "3;"],
				] as const) {
					const emitted = out(rootOf(paragraph(text(head), text(tail))));
					assert.strictEqual(emitted, `a \\&${(head + tail).slice(3)}\n`);
					assert.strictEqual(reparsedText(emitted, "paragraph"), head + tail);
				}
			});
			it("a value-final ampersand before plain text siblings stays raw", () => {
				const emitted = out(rootOf(paragraph(text("a &"), text(" b"))));
				assert.strictEqual(emitted, "a & b\n");
				assert.strictEqual(reparsedText(emitted, "paragraph"), "a & b");
			});
			it("an entity-prefix run before a non-text sibling is conservatively escaped", () => {
				const emitted = out(
					rootOf(paragraph(text("a &am"), Strong.make({ children: [text("p;")], position: span() }))),
				);
				assert.strictEqual(emitted, "a \\&am**p;**\n");
			});
			it("parse ∘ stringify is the identity on `Getters & Setters`", () => stringIdentity("Getters & Setters\n"));
		});

		describe("`>` escapes only at a line start", () => {
			it("a mid-line `>` stays raw", () => paragraphCase("a > b", "a > b\n"));
			it("`<` stays escaped", () => paragraphCase("<T>", "\\<T>\n"));
			it("a line-start `>` stays escaped", () => paragraphCase("> not a quote", "\\> not a quote\n"));
			it("a `>` after a soft break stays escaped", () => paragraphCase("a\n> b", "a\n\\> b\n"));
		});

		describe("`#` in a heading escapes only a closing sequence", () => {
			it("a VitePress custom anchor `{#id}` serializes raw on a tree with no MDX nodes", () =>
				headingCase(2, "Setters {#setters}", "## Setters {#setters}\n"));
			it("an issue-number `#` stays raw", () => headingCase(2, "Issue #12", "## Issue #12\n"));
			it("a trailing `#` run is escaped at its first character", () => {
				headingCase(2, "Trailing #", "## Trailing \\#\n");
				headingCase(2, "Trailing ##", "## Trailing \\##\n");
			});
			it("a `#` that is the whole heading text is escaped", () => headingCase(2, "#", "## \\#\n"));
			it("a trailing `#` before a non-text sibling is conservatively escaped", () => {
				const emitted = out(rootOf(heading(2, text("a #"), Strong.make({ children: [text("b")], position: span() }))));
				assert.strictEqual(emitted, "## a \\#**b**\n");
			});
			it("a `#` run is judged against the contiguous text siblings", () => {
				assert.strictEqual(out(rootOf(heading(2, text("a #"), text("b")))), "## a #b\n");
				assert.ok(out(rootOf(heading(2, text("a #"), text(" ")))).startsWith("## a \\#"));
			});
			it("a `#` outside a heading is untouched mid-line", () => paragraphCase("Issue #12 #", "Issue #12 #\n"));
		});

		// Issue #585: a soft break sitting at the boundary of a Text node (index
		// 0 or the last index) is entity-encoded even though the neighbouring
		// non-text inline keeps the paragraph continuous — a plain newline
		// cannot open a block there. The `adjacent` case (a literal blank line
		// inside a text value) is the one boundary-adjacent shape that DOES
		// need the entity, and stays covered by the negative control below.
		describe("a soft break at a Text boundary stays a plain newline (#585)", () => {
			it("before inlineCode", () => {
				const tree = rootOf(paragraph(text("a\n"), InlineCode.make({ value: "b", position: span() })));
				assert.strictEqual(out(tree), "a\n`b`\n");
			});
			it("after inlineCode", () => {
				const tree = rootOf(paragraph(InlineCode.make({ value: "a", position: span() }), text("\nb")));
				assert.strictEqual(out(tree), "`a`\nb\n");
			});
			it("before strong", () => {
				const tree = rootOf(paragraph(text("a\n"), Strong.make({ children: [text("b")], position: span() })));
				assert.strictEqual(out(tree), "a\n**b**\n");
			});
			it("after strong", () => {
				const tree = rootOf(paragraph(Strong.make({ children: [text("a")], position: span() }), text("\nb")));
				assert.strictEqual(out(tree), "**a**\nb\n");
			});
			it("before emphasis", () => {
				const tree = rootOf(paragraph(text("a\n"), Emphasis.make({ children: [text("b")], position: span() })));
				assert.strictEqual(out(tree), "a\n*b*\n");
			});
			it("after emphasis", () => {
				const tree = rootOf(paragraph(Emphasis.make({ children: [text("a")], position: span() }), text("\nb")));
				assert.strictEqual(out(tree), "*a*\nb\n");
			});
			it("before a link", () => {
				const tree = rootOf(paragraph(text("a\n"), Link.make({ url: "/u", children: [text("b")], position: span() })));
				assert.strictEqual(out(tree), "a\n[b](/u)\n");
			});
			it("after a link", () => {
				const tree = rootOf(paragraph(Link.make({ url: "/u", children: [text("a")], position: span() }), text("\nb")));
				assert.strictEqual(out(tree), "[a](/u)\nb\n");
			});

			it("the issue's first repro string round-trips byte for byte", () =>
				stringIdentity("a typed vocabulary, `ApiItem` → `Page`\nbuilders, and more\n"));
			it("the issue's second repro string round-trips byte for byte", () =>
				stringIdentity("swapped per API while\n`generateApiDocs` ran\n"));

			it("negative control: a blank line inside a text value still encodes", () => {
				// Two consecutive newlines cannot occur in a parsed Text value (a
				// real blank line ends the paragraph), but a hand-built tree can
				// carry one — and it must stay entity-encoded, or a literal blank
				// line would end the paragraph early on re-parse.
				const tree = rootOf(paragraph(text("a\n\nb")));
				assert.strictEqual(out(tree), "a&#10;&#10;b\n");
			});

			it("a boundary newline that WOULD open a blank line after a hard break stays encoded", () => {
				// A hard break already lands the next position at a fresh physical
				// line; a soft break's leading newline right after it would open a
				// second, blank line — checked via the line-start state, not the
				// boundary position alone.
				const tree = rootOf(paragraph(text("a"), Break.make({ position: span() }), text("\nb")));
				assert.strictEqual(out(tree), "a\\\n&#10;b\n");
			});
		});
	});

	describe("guard and facade posture", () => {
		it("depth past the cap fails typed, never a RangeError", () => {
			let tree: Root["children"][number] = paragraph(text("x"));
			for (let i = 0; i < 300; i += 1) {
				tree = Blockquote.make({ children: [tree as never], position: span() });
			}
			const result = Markdown.stringifyResult(rootOf(tree));
			assert.isTrue(Result.isFailure(result));
			if (Result.isFailure(result)) {
				assert.instanceOf(result.failure, MarkdownStringifyError);
				assert.strictEqual(result.failure.diagnostic.code, "NestingDepthExceeded");
			}
		});

		it("the Effect variant agrees with the Result variant", () =>
			Effect.gen(function* () {
				const tree = rootOf(paragraph(text("same")));
				const fromEffect = yield* Markdown.stringify(tree);
				assert.strictEqual(fromEffect, Result.getOrThrow(Markdown.stringifyResult(tree)));
			}).pipe(Effect.runPromise));

		it("encode through MarkdownFromString round-trips", () => {
			const encode = Schema.encodeEffect(Markdown.MarkdownFromString);
			const decode = Schema.decodeUnknownEffect(Markdown.MarkdownFromString);
			return Effect.gen(function* () {
				const root = yield* decode("# Title\n\npara *em* text\n\n- a\n- b\n");
				const emitted = yield* encode(root);
				const again = yield* decode(emitted);
				assert.deepStrictEqual(
					again.children.map((child) => child.type),
					root.children.map((child) => child.type),
				);
			}).pipe(Effect.runPromise);
		});
	});
});
