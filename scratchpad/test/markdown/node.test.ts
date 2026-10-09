import { assert, describe, it } from "@effect/vitest";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import {
	Blockquote,
	Break,
	Code,
	Definition,
	Delete,
	Emphasis,
	FootnoteDefinition,
	FootnoteReference,
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

/** A throwaway span. Node identity in these tests never depends on the span. */
const span = (startOffset = 0, endOffset = 0): Position =>
	Position.make({
		start: Point.make({ line: 1, column: 1, offset: startOffset }),
		end: Point.make({ line: 1, column: 1 + endOffset - startOffset, offset: endOffset }),
	});

/** A plain-object span, for decoding tests that start from untyped JSON. */
const rawSpan = (startOffset = 0, endOffset = 0) => ({
	start: { line: 1, column: 1, offset: startOffset },
	end: { line: 1, column: 1 + endOffset - startOffset, offset: endOffset },
});

describe("MarkdownNode", () => {
	describe("construction", () => {
		it("builds a document tree with X.make, filling `type` from the tag default", () => {
			const document = Root.make({
				children: [
					Heading.make({
						depth: 1,
						children: [Text.make({ value: "Title", position: span(2, 7) })],
						position: span(0, 7),
						headingStyle: "atx",
					}),
					Paragraph.make({
						children: [
							Text.make({ value: "hello ", position: span(9, 15) }),
							Emphasis.make({
								children: [Text.make({ value: "world", position: span(16, 21) })],
								position: span(15, 22),
								markerChar: "*",
							}),
						],
						position: span(9, 22),
					}),
				],
				position: span(0, 22),
			});

			assert.strictEqual(document.type, "root");
			assert.strictEqual(document.children.length, 2);

			const [heading, paragraph] = document.children;
			assert.strictEqual(heading?.type, "heading");
			assert.strictEqual(paragraph?.type, "paragraph");
		});

		it("omits an absent optionalKey field rather than storing undefined", () => {
			const indented = Code.make({ value: "x = 1", position: span(0, 5) });
			const fenced = Code.make({ value: "x = 1", position: span(0, 13), fenceChar: "`", fenceLength: 3 });

			assert.isFalse(Object.hasOwn(indented, "fenceChar"));
			assert.isFalse(Object.hasOwn(indented, "lang"));
			assert.strictEqual(fenced.fenceChar, "`");
			assert.strictEqual(fenced.fenceLength, 3);
		});

		it("keeps every node's position on the instance", () => {
			const text = Text.make({ value: "a", position: span(3, 4) });
			assert.strictEqual(text.position.start.offset, 3);
			assert.strictEqual(text.position.end.offset, 4);
		});

		it("passes constructed children through `make` by identity", () => {
			// The pin for the category-union children fields (`RowContent` in
			// `MarkdownNode.ts`): `make` passes an already-constructed instance
			// through a nested class-typed field by reference, whether the field
			// is a plain class type or — as here — wrapped in a category union.
			// `position` (a plain class-typed field, pinned in
			// node-synthesis.test.ts) and `children` (wrapped in `RowContent` /
			// `TableContent`) both preserve identity on `make`; this test pins
			// that pass-through specifically for the category-union `children`
			// fields that back `TableRow`/`Table`/`List`.
			const text = Text.make({ value: "x", position: span(0, 1) });
			const cell = TableCell.make({ children: [text], position: span(0, 1) });
			assert.strictEqual(cell.children[0], text);

			const row = TableRow.make({ children: [cell], position: span(0, 1) });
			assert.strictEqual(row.children[0], cell);

			const table = Table.make({ children: [row], position: span(0, 1) });
			assert.strictEqual(table.children[0], row);

			const item = ListItem.make({ children: [], position: span(0, 1) });
			const list = List.make({ children: [item], position: span(0, 1) });
			assert.strictEqual(list.children[0], item);
		});
	});

	describe("structural equality", () => {
		it("treats two identically-shaped trees as equal", () => {
			const build = (): Root =>
				Root.make({
					children: [
						Blockquote.make({
							children: [
								Paragraph.make({
									children: [Text.make({ value: "quoted", position: span(2, 8) })],
									position: span(2, 8),
								}),
							],
							position: span(0, 8),
						}),
					],
					position: span(0, 8),
				});

			assert.deepStrictEqual(build(), build());
		});

		it("distinguishes trees differing only in a fidelity extra", () => {
			const withMarker = ThematicBreak.make({ position: span(0, 3), markerChar: "-" });
			const withoutMarker = ThematicBreak.make({ position: span(0, 3) });

			assert.notDeepEqual(withMarker, withoutMarker);
		});
	});

	describe("mdast type literals", () => {
		it("spells every node type exactly as mdast does", () => {
			const p = span(0, 0);
			const types = [
				Root.make({ children: [], position: p }).type,
				Paragraph.make({ children: [], position: p }).type,
				Heading.make({ depth: 1, children: [], position: p }).type,
				ThematicBreak.make({ position: p }).type,
				Blockquote.make({ children: [], position: p }).type,
				List.make({ children: [], position: p }).type,
				ListItem.make({ children: [], position: p }).type,
				Code.make({ value: "", position: p }).type,
				Html.make({ value: "", position: p }).type,
				Definition.make({ identifier: "a", url: "/a", position: p }).type,
				Text.make({ value: "", position: p }).type,
				Emphasis.make({ children: [], position: p }).type,
				Strong.make({ children: [], position: p }).type,
				InlineCode.make({ value: "", position: p }).type,
				Break.make({ position: p }).type,
				Link.make({ url: "/a", children: [], position: p }).type,
				Image.make({ url: "/a", position: p }).type,
				LinkReference.make({ identifier: "a", referenceType: "shortcut", children: [], position: p }).type,
				ImageReference.make({ identifier: "a", referenceType: "full", position: p }).type,
			];

			assert.deepStrictEqual(types, [
				"root",
				"paragraph",
				"heading",
				"thematicBreak",
				"blockquote",
				"list",
				"listItem",
				"code",
				"html",
				"definition",
				"text",
				"emphasis",
				"strong",
				"inlineCode",
				"break",
				"link",
				"image",
				"linkReference",
				"imageReference",
			]);
			assert.strictEqual(types.length, 19);
		});
	});

	describe("decoding", () => {
		const decodeRoot = (input: unknown) => Result.getOrThrow(S.decodeUnknownResult(Root)(input));

		it("decodes a plain-object tree covering every node type", () => {
			const tree = {
				type: "root",
				position: rawSpan(0, 100),
				children: [
					{ type: "thematicBreak", position: rawSpan(0, 3), markerChar: "-" },
					{
						type: "heading",
						depth: 2,
						position: rawSpan(3, 10),
						headingStyle: "setext",
						children: [{ type: "text", value: "T", position: rawSpan(3, 4) }],
					},
					{
						type: "code",
						value: "x",
						lang: "ts",
						meta: "twoslash",
						fenceChar: "~",
						fenceLength: 3,
						position: rawSpan(10, 20),
					},
					{ type: "html", value: "<hr>", position: rawSpan(20, 24) },
					{ type: "definition", identifier: "ref", label: "Ref", url: "/u", title: "T", position: rawSpan(24, 40) },
					{
						type: "list",
						ordered: true,
						start: 3,
						spread: false,
						bulletChar: "-",
						delimiter: ")",
						position: rawSpan(40, 60),
						children: [
							{
								type: "listItem",
								spread: false,
								position: rawSpan(40, 60),
								children: [
									{
										type: "blockquote",
										position: rawSpan(42, 58),
										children: [
											{
												type: "paragraph",
												position: rawSpan(44, 58),
												children: [
													{ type: "text", value: "a", position: rawSpan(44, 45) },
													{ type: "break", breakStyle: "spaces", position: rawSpan(45, 47) },
													{ type: "inlineCode", value: "c", position: rawSpan(47, 50) },
													{
														type: "emphasis",
														markerChar: "_",
														position: rawSpan(50, 53),
														children: [{ type: "text", value: "e", position: rawSpan(51, 52) }],
													},
													{
														type: "strong",
														markerChar: "*",
														position: rawSpan(53, 58),
														children: [{ type: "text", value: "s", position: rawSpan(55, 56) }],
													},
												],
											},
										],
									},
								],
							},
						],
					},
					{
						type: "paragraph",
						position: rawSpan(60, 100),
						children: [
							{
								type: "link",
								url: "/l",
								title: "lt",
								position: rawSpan(60, 70),
								children: [{ type: "text", value: "l", position: rawSpan(61, 62) }],
							},
							{ type: "image", url: "/i", title: "it", alt: "ia", position: rawSpan(70, 80) },
							{
								type: "linkReference",
								identifier: "ref",
								label: "Ref",
								referenceType: "full",
								position: rawSpan(80, 90),
								children: [{ type: "text", value: "r", position: rawSpan(81, 82) }],
							},
							{
								type: "imageReference",
								identifier: "ref",
								referenceType: "collapsed",
								alt: "ra",
								position: rawSpan(90, 100),
							},
						],
					},
				],
			};

			const decoded = decodeRoot(tree);

			assert.instanceOf(decoded, Root);
			assert.strictEqual(decoded.children.length, 7);

			const list = decoded.children[5];
			assert.strictEqual(list?.type, "list");
			assert.instanceOf(list, List);
			assert.strictEqual(list.start, 3);
			assert.strictEqual(list.ordered, true);

			const item = list.children[0];
			assert.instanceOf(item, ListItem);
			const quote = item?.children[0];
			assert.instanceOf(quote, Blockquote);
		});

		it("round-trips a decoded tree back through encode", () => {
			const tree = {
				type: "root",
				position: rawSpan(0, 5),
				children: [
					{
						type: "paragraph",
						position: rawSpan(0, 5),
						children: [{ type: "text", value: "hello", position: rawSpan(0, 5) }],
					},
				],
			};

			const decoded = decodeRoot(tree);
			const encoded = Result.getOrThrow(S.encodeUnknownResult(Root)(decoded));

			// Compared as plain JSON: the encoded side is typed against Root's
			// literal `type` fields, which the untyped fixture widens to `string`.
			assert.deepStrictEqual<unknown>(encoded, tree);
		});

		it("rejects a node whose type is not an mdast name", () => {
			assert.throws(() =>
				decodeRoot({
					type: "root",
					position: rawSpan(0, 1),
					children: [{ type: "footnoteDefinition", position: rawSpan(0, 1), children: [] }],
				}),
			);
		});

		it("rejects a heading depth outside 1 to 6", () => {
			assert.throws(() =>
				decodeRoot({
					type: "root",
					position: rawSpan(0, 1),
					children: [{ type: "heading", depth: 7, position: rawSpan(0, 1), children: [] }],
				}),
			);
		});

		it("rejects a node missing its position", () => {
			assert.throws(() =>
				decodeRoot({
					type: "root",
					position: rawSpan(0, 1),
					children: [{ type: "paragraph", children: [] }],
				}),
			);
		});

		it("decodes a 40-deep nest of blockquotes, proving suspend recursion", () => {
			let node: Record<string, unknown> = {
				type: "paragraph",
				position: rawSpan(40, 41),
				children: [{ type: "text", value: "deep", position: rawSpan(40, 41) }],
			};
			for (let depth = 0; depth < 40; depth += 1) {
				node = { type: "blockquote", position: rawSpan(39 - depth, 42 + depth), children: [node] };
			}

			const decoded = decodeRoot({ type: "root", position: rawSpan(0, 100), children: [node] });

			let cursor: unknown = decoded.children[0];
			let seen = 0;
			while (S.is(Blockquote)(cursor)) {
				seen += 1;
				cursor = cursor.children[0];
			}

			assert.strictEqual(seen, 40);
			assert.instanceOf(cursor, Paragraph);
		});
	});

	describe("GFM extensions", () => {
		describe("construction", () => {
			it("builds a table with X.make", () => {
				const table = Table.make({
					align: ["left", null, "right"],
					children: [
						TableRow.make({
							children: [
								TableCell.make({ children: [Text.make({ value: "a", position: span(0, 1) })], position: span(0, 1) }),
								TableCell.make({ children: [Text.make({ value: "b", position: span(2, 3) })], position: span(2, 3) }),
								TableCell.make({ children: [Text.make({ value: "c", position: span(4, 5) })], position: span(4, 5) }),
							],
							position: span(0, 5),
						}),
					],
					position: span(0, 5),
				});

				assert.strictEqual(table.type, "table");
				assert.deepStrictEqual(table.align, ["left", null, "right"]);
				assert.strictEqual(table.children[0]?.type, "tableRow");
				assert.strictEqual(table.children[0]?.children[0]?.type, "tableCell");
			});

			it("builds a delete node with X.make", () => {
				const strikethrough = Delete.make({
					children: [Text.make({ value: "gone", position: span(2, 6) })],
					position: span(0, 8),
				});

				assert.strictEqual(strikethrough.type, "delete");
				assert.strictEqual(strikethrough.children[0]?.type, "text");
			});

			it("builds a footnote definition and a resolving reference with X.make", () => {
				const definition = FootnoteDefinition.make({
					identifier: "alpha",
					label: "alpha",
					children: [
						Paragraph.make({ children: [Text.make({ value: "bravo", position: span(0, 5) })], position: span(0, 5) }),
					],
					position: span(0, 5),
				});
				const reference = FootnoteReference.make({ identifier: "alpha", label: "alpha", position: span(10, 17) });

				assert.strictEqual(definition.type, "footnoteDefinition");
				assert.strictEqual(reference.type, "footnoteReference");
				assert.strictEqual(definition.identifier, reference.identifier);
			});

			it("sets checked on a task-list item", () => {
				const done = ListItem.make({ checked: true, children: [], position: span(0, 5) });
				const notDone = ListItem.make({ checked: false, children: [], position: span(0, 5) });
				const notATask = ListItem.make({ children: [], position: span(0, 5) });

				assert.strictEqual(done.checked, true);
				assert.strictEqual(notDone.checked, false);
				assert.isUndefined(notATask.checked);
			});
		});

		describe("absent optionalKey fields", () => {
			it("omits checked on a non-task list item rather than storing undefined", () => {
				const item = ListItem.make({ children: [], position: span(0, 1) });
				assert.isFalse(Object.hasOwn(item, "checked"));
			});

			it("omits align on a table with no declared alignment rather than storing undefined", () => {
				const table = Table.make({ children: [], position: span(0, 1) });
				assert.isFalse(Object.hasOwn(table, "align"));
			});

			it("omits label on a footnote definition and reference rather than storing undefined", () => {
				const definition = FootnoteDefinition.make({ identifier: "a", children: [], position: span(0, 1) });
				const reference = FootnoteReference.make({ identifier: "a", position: span(0, 1) });
				assert.isFalse(Object.hasOwn(definition, "label"));
				assert.isFalse(Object.hasOwn(reference, "label"));
			});
		});

		describe("structural equality", () => {
			it("treats two identically-shaped GFM trees as equal", () => {
				const build = (): Root =>
					Root.make({
						children: [
							Table.make({
								align: ["left"],
								children: [
									TableRow.make({
										children: [
											TableCell.make({
												children: [Text.make({ value: "h", position: span(0, 1) })],
												position: span(0, 1),
											}),
										],
										position: span(0, 1),
									}),
								],
								position: span(0, 1),
							}),
						],
						position: span(0, 1),
					});

				assert.deepStrictEqual(build(), build());
			});

			it("distinguishes list items differing only in checked", () => {
				const done = ListItem.make({ checked: true, children: [], position: span(0, 1) });
				const notATask = ListItem.make({ children: [], position: span(0, 1) });

				assert.notDeepEqual(done, notATask);
			});
		});

		describe("mdast type literals", () => {
			it("spells every GFM node type exactly as mdast does", () => {
				const p = span(0, 0);
				const types = [
					Delete.make({ children: [], position: p }).type,
					FootnoteDefinition.make({ identifier: "a", children: [], position: p }).type,
					FootnoteReference.make({ identifier: "a", position: p }).type,
					Table.make({ children: [], position: p }).type,
					TableRow.make({ children: [], position: p }).type,
					TableCell.make({ children: [], position: p }).type,
				];

				assert.deepStrictEqual(types, [
					"delete",
					"footnoteDefinition",
					"footnoteReference",
					"table",
					"tableRow",
					"tableCell",
				]);
			});
		});

		describe("decoding", () => {
			const decodeRoot = (input: unknown) => Result.getOrThrow(S.decodeUnknownResult(Root)(input));

			it("decodes a plain-object tree through the GFM-widened flow and phrasing unions", () => {
				const tree = {
					type: "root",
					position: rawSpan(0, 60),
					children: [
						{
							type: "paragraph",
							position: rawSpan(0, 10),
							children: [
								{
									type: "delete",
									position: rawSpan(0, 6),
									children: [{ type: "text", value: "gone", position: rawSpan(1, 5) }],
								},
								{ type: "footnoteReference", identifier: "note", label: "note", position: rawSpan(6, 10) },
							],
						},
						{
							type: "list",
							spread: false,
							position: rawSpan(10, 25),
							children: [
								{
									type: "listItem",
									checked: true,
									position: rawSpan(10, 25),
									children: [
										{
											type: "paragraph",
											position: rawSpan(14, 25),
											children: [{ type: "text", value: "done", position: rawSpan(14, 18) }],
										},
									],
								},
							],
						},
						{
							type: "table",
							align: ["left", null],
							position: rawSpan(25, 45),
							children: [
								{
									type: "tableRow",
									position: rawSpan(25, 35),
									children: [
										{
											type: "tableCell",
											position: rawSpan(25, 30),
											children: [{ type: "text", value: "h1", position: rawSpan(25, 27) }],
										},
										{
											type: "tableCell",
											position: rawSpan(30, 35),
											children: [{ type: "text", value: "h2", position: rawSpan(30, 32) }],
										},
									],
								},
							],
						},
						{
							type: "footnoteDefinition",
							identifier: "note",
							label: "note",
							position: rawSpan(45, 60),
							children: [
								{
									type: "paragraph",
									position: rawSpan(48, 60),
									children: [{ type: "text", value: "referent", position: rawSpan(48, 56) }],
								},
							],
						},
					],
				};

				const decoded = decodeRoot(tree);

				assert.instanceOf(decoded, Root);
				assert.strictEqual(decoded.children.length, 4);

				const paragraph = decoded.children[0];
				assert.instanceOf(paragraph, Paragraph);
				assert.instanceOf(paragraph.children[0], Delete);
				assert.instanceOf(paragraph.children[1], FootnoteReference);

				const list = decoded.children[1];
				assert.instanceOf(list, List);
				const item = list.children[0];
				assert.instanceOf(item, ListItem);
				assert.strictEqual(item.checked, true);

				const table = decoded.children[2];
				assert.instanceOf(table, Table);
				assert.deepStrictEqual(table.align, ["left", null]);
				const row = table.children[0];
				assert.instanceOf(row, TableRow);
				assert.instanceOf(row.children[0], TableCell);

				const footnoteDefinition = decoded.children[3];
				assert.instanceOf(footnoteDefinition, FootnoteDefinition);
				assert.strictEqual(footnoteDefinition.identifier, "note");
			});

			it("round-trips a decoded GFM tree back through encode", () => {
				const tree = {
					type: "root",
					position: rawSpan(0, 5),
					children: [
						{
							type: "table",
							align: ["center"],
							position: rawSpan(0, 5),
							children: [
								{
									type: "tableRow",
									position: rawSpan(0, 5),
									children: [
										{
											type: "tableCell",
											position: rawSpan(0, 5),
											children: [{ type: "text", value: "x", position: rawSpan(0, 5) }],
										},
									],
								},
							],
						},
					],
				};

				const decoded = decodeRoot(tree);
				const encoded = Result.getOrThrow(S.encodeUnknownResult(Root)(decoded));

				assert.deepStrictEqual<unknown>(encoded, tree);
			});

			it("rejects a checked value that is not a boolean", () => {
				assert.throws(() =>
					decodeRoot({
						type: "root",
						position: rawSpan(0, 1),
						children: [
							{
								type: "list",
								position: rawSpan(0, 1),
								children: [{ type: "listItem", checked: "yes", position: rawSpan(0, 1), children: [] }],
							},
						],
					}),
				);
			});
		});
	});
});
