// The MDX vocabulary: construction (schema checks included), serialization
// conformance against the vendored oracles, and the Mdast interop boundary.
//
// Serialization expectations are lifted from the vendored oracle suites
// (.repos/mdast-util-mdx-jsx/test.js `mdxJsxToMarkdown`,
// .repos/mdast-util-mdx-expression, .repos/mdast-util-mdxjs-esm) at the
// oracle defaults: quote `"`, no quoteSmart, spaced self-closing, attributes
// wrapped onto their own lines only when one carries a line ending. Where a
// case's CHILD block content is ordinary markdown, the bytes follow THIS
// package's canonical table (bullet `-`, tight lists), not the oracle's
// to-markdown defaults — the MDX structure is the oracle contract, the
// markdown inside it is ours.

import { assert, describe, it } from "@effect/vitest";
import * as Result from "effect/Result";
import { Markdown } from "../../effected/markdown/Markdown.ts";
import { MarkdownDocument } from "../../effected/markdown/MarkdownDocument.ts";
import {
	Blockquote,
	Code,
	FootnoteDefinition,
	Heading,
	List,
	ListItem,
	MdxFlowExpression,
	MdxJsxAttribute,
	MdxJsxAttributeValueExpression,
	MdxJsxExpressionAttribute,
	MdxJsxFlowElement,
	MdxJsxTextElement,
	MdxTextExpression,
	MdxjsEsm,
	Paragraph,
	Root,
	Strong,
	Text,
} from "../../effected/markdown/MarkdownNode.ts";
import { Mdast } from "../../effected/markdown/Mdast.ts";

const text = (value: string): Text => Text.make({ value });

const paragraph = (...children: ReadonlyArray<Paragraph["children"][number]>): Paragraph =>
	Paragraph.make({ children });

const rootOf = (...children: ReadonlyArray<Root["children"][number]>): Root => Root.make({ children });

const stringified = (root: Root): string => {
	const result = Markdown.stringifyResult(root);
	assert.isTrue(Result.isSuccess(result));
	return Result.isSuccess(result) ? result.success : "";
};

const flowElement = (
	name: string | null,
	attributes: ReadonlyArray<MdxJsxFlowElement["attributes"][number]> = [],
	children: ReadonlyArray<MdxJsxFlowElement["children"][number]> = [],
): MdxJsxFlowElement => MdxJsxFlowElement.make({ name, attributes, children });

const textElement = (
	name: string | null,
	attributes: ReadonlyArray<MdxJsxTextElement["attributes"][number]> = [],
	children: ReadonlyArray<MdxJsxTextElement["children"][number]> = [],
): MdxJsxTextElement => MdxJsxTextElement.make({ name, attributes, children });

const expressionAttribute = (value: string): MdxJsxExpressionAttribute => MdxJsxExpressionAttribute.make({ value });

describe("mdx nodes", () => {
	describe("construction checks", () => {
		it("refuses a fragment carrying attributes, at make and at decode", () => {
			assert.throws(() => flowElement(null, [expressionAttribute("x")]));
			assert.throws(() => textElement(null, [MdxJsxAttribute.make({ name: "a" })]));
		});

		it("refuses an attribute without a name", () => {
			assert.throws(() => MdxJsxAttribute.make({ name: "" }));
		});

		it("refuses an empty-string element name — `null` is the fragment spelling", () => {
			// An empty name has no MDX spelling: the oracle's parser only ever
			// produces a real name or `null`, and a serialized `< />` is invalid.
			assert.throws(() => flowElement(""));
			assert.throws(() => textElement(""));
		});

		it("admits every attribute value spelling the oracle contract has", () => {
			// Absent, null, string, expression — never explicit undefined.
			assert.strictEqual(MdxJsxAttribute.make({ name: "a" }).value, undefined);
			assert.strictEqual(MdxJsxAttribute.make({ name: "a", value: null }).value, null);
			assert.strictEqual(MdxJsxAttribute.make({ name: "a", value: "b" }).value, "b");
			const expression = MdxJsxAttributeValueExpression.make({ value: "c" });
			const attribute = MdxJsxAttribute.make({ name: "a", value: expression });
			assert.strictEqual(
				attribute.value !== null && typeof attribute.value === "object" ? attribute.value.value : "",
				"c",
			);
		});
	});

	describe("flow element serialization (oracle: mdxJsxToMarkdown)", () => {
		it("serializes a fragment with no children", () => {
			assert.strictEqual(stringified(rootOf(flowElement(null))), "<></>\n");
		});

		it("serializes a named, empty element self-closing with a space", () => {
			assert.strictEqual(stringified(rootOf(flowElement("x"))), "<x />\n");
		});

		it("serializes children indented in block layout", () => {
			assert.strictEqual(stringified(rootOf(flowElement("x", [], [paragraph(text("y"))]))), "<x>\n  y\n</x>\n");
		});

		it("serializes a fragment with children", () => {
			assert.strictEqual(stringified(rootOf(flowElement(null, [], [paragraph(text("y"))]))), "<>\n  y\n</>\n");
		});

		it("serializes expression attributes", () => {
			assert.strictEqual(stringified(rootOf(flowElement("x", [expressionAttribute("y")]))), "<x {y} />\n");
			assert.strictEqual(
				stringified(rootOf(flowElement("x", [expressionAttribute("y")], [paragraph(text("z"))]))),
				"<x {y}>\n  z\n</x>\n",
			);
			assert.strictEqual(
				stringified(rootOf(flowElement("x", [expressionAttribute("y"), expressionAttribute("z")]))),
				"<x {y} {z} />\n",
			);
			assert.strictEqual(
				stringified(rootOf(flowElement("x", [expressionAttribute('...{y: "z"}')]))),
				'<x {...{y: "z"}} />\n',
			);
			assert.strictEqual(stringified(rootOf(flowElement("x", [expressionAttribute("")]))), "<x {} />\n");
		});

		it("serializes named attributes: boolean, string and expression values", () => {
			assert.strictEqual(stringified(rootOf(flowElement("x", [MdxJsxAttribute.make({ name: "y" })]))), "<x y />\n");
			assert.strictEqual(
				stringified(rootOf(flowElement("x", [MdxJsxAttribute.make({ name: "y", value: null })]))),
				"<x y />\n",
			);
			assert.strictEqual(
				stringified(rootOf(flowElement("x", [MdxJsxAttribute.make({ name: "y", value: "z" })]))),
				'<x y="z" />\n',
			);
			assert.strictEqual(
				stringified(
					rootOf(
						flowElement("x", [
							MdxJsxAttribute.make({ name: "y", value: MdxJsxAttributeValueExpression.make({ value: "z" }) }),
						]),
					),
				),
				"<x y={z} />\n",
			);
			assert.strictEqual(
				stringified(
					rootOf(
						flowElement("x", [
							MdxJsxAttribute.make({ name: "y", value: MdxJsxAttributeValueExpression.make({ value: "" }) }),
						]),
					),
				),
				"<x y={} />\n",
			);
		});

		it("escapes the quote in a string attribute value as the oracle spells it", () => {
			assert.strictEqual(
				stringified(rootOf(flowElement("x", [MdxJsxAttribute.make({ name: "y", value: "z\"a'b" })]))),
				'<x y="z&#x22;a\'b" />\n',
			);
		});

		it("puts attributes on their own lines when one carries a line ending", () => {
			assert.strictEqual(
				stringified(rootOf(flowElement("x", [expressionAttribute("\n  ...a\n")]))),
				"<x\n  {\n  ...a\n}\n/>\n",
			);
		});

		it("serializes ordinary flow children with this package's canonical markdown", () => {
			const tree = rootOf(
				flowElement(
					"x",
					[],
					[
						Blockquote.make({ children: [paragraph(text("a"))] }),
						List.make({
							children: [
								ListItem.make({ children: [paragraph(text("b\nc"))] }),
								ListItem.make({ children: [paragraph(text("d"))] }),
							],
						}),
					],
				),
			);
			assert.strictEqual(stringified(tree), "<x>\n  > a\n\n  - b\n    c\n  - d\n</x>\n");
		});

		it("indents nested flow elements one step per JSX ancestor", () => {
			const tree = rootOf(flowElement("a", [], [flowElement("b", [], [paragraph(text("y"))])]));
			assert.strictEqual(stringified(tree), "<a>\n  <b>\n    y\n  </b>\n</a>\n");
		});

		it("restarts JSX indentation inside a blockquote and a list item", () => {
			const quoted = rootOf(Blockquote.make({ children: [flowElement("x", [], [paragraph(text("y"))])] }));
			assert.strictEqual(stringified(quoted), "> <x>\n>   y\n> </x>\n");
			// The list item's hanging indent owns indentation from there in, so a
			// JSX element inside an item of a list that itself sits inside a JSX
			// element renders at depth 0 and takes the item indent only — the
			// oracle's inferDepth break at `listItem`.
			const listed = rootOf(
				flowElement(
					"x",
					[],
					[
						List.make({
							children: [ListItem.make({ children: [flowElement("y", [], [paragraph(text("z"))])] })],
						}),
					],
				),
			);
			assert.strictEqual(stringified(listed), "<x>\n  - <y>\n      z\n    </y>\n</x>\n");
		});

		it("keeps counting JSX depth through a footnote definition", () => {
			// The oracle's inferDepth breaks ONLY at `blockquote` and `listItem`
			// (.repos/mdast-util-mdx-jsx/lib/index.js `inferDepth`), so for
			// mdxJsxFlowElement > footnoteDefinition > mdxJsxFlowElement the
			// inner element still counts its JSX ancestor. Expected bytes are
			// derived from the oracle's algorithm: the inner element
			// self-indents by inferDepth (`  <b>` at depth 1, its child at
			// depth 2), the footnote applies its four-space continuation
			// indent over that, and the outer element's flow indents the whole
			// definition one more step.
			const sandwiched = rootOf(
				flowElement(
					"a",
					[],
					[
						FootnoteDefinition.make({
							identifier: "x",
							children: [flowElement("b", [], [paragraph(text("y"))])],
						}),
					],
				),
			);
			assert.strictEqual(stringified(sandwiched), "<a>\n  [^x]:   <b>\n          y\n        </b>\n</a>\n");
			// With no JSX ancestor the inner element sits at depth 0 and only
			// the footnote's continuation indent applies.
			const topLevel = rootOf(
				FootnoteDefinition.make({
					identifier: "x",
					children: [flowElement("b", [], [paragraph(text("y"))])],
				}),
			);
			assert.strictEqual(stringified(topLevel), "[^x]: <b>\n      y\n    </b>\n");
		});

		it("preserves child line terminators, leaving blank CRLF lines bare", () => {
			// The oracle's indentLines splits on `\r\n`, `\n` and bare `\r`,
			// keeps each terminator verbatim, and never indents a blank line —
			// a blank CRLF line must not become `  \r`.
			const tree = rootOf(flowElement("x", [], [Code.make({ value: "a\r\n\r\nb\n", lang: "txt" })]));
			assert.strictEqual(stringified(tree), "<x>\n  ```txt\n  a\r\n\r\n  b\n  ```\n</x>\n");
		});
	});

	describe("text element serialization", () => {
		it("serializes inline elements, fragments and attributes", () => {
			assert.strictEqual(
				stringified(rootOf(paragraph(text("w "), textElement("x", [], [text("y")]), text(" z.")))),
				"w <x>y</x> z.\n",
			);
			assert.strictEqual(
				stringified(rootOf(paragraph(textElement("x", [], [Strong.make({ children: [text("y")] })])))),
				"<x>**y**</x>\n",
			);
			assert.strictEqual(stringified(rootOf(paragraph(textElement(null)))), "<></>\n");
			assert.strictEqual(stringified(rootOf(paragraph(textElement("x")))), "<x />\n");
			assert.strictEqual(
				stringified(
					rootOf(
						paragraph(
							textElement("x", [MdxJsxAttribute.make({ name: "y", value: "z" }), MdxJsxAttribute.make({ name: "a" })]),
						),
					),
				),
				'<x y="z" a />\n',
			);
		});
	});

	describe("expressions and ESM", () => {
		it("serializes flow expressions with two-space continuation indent", () => {
			assert.strictEqual(stringified(rootOf(MdxFlowExpression.make({ value: "a + b" }))), "{a + b}\n");
			assert.strictEqual(stringified(rootOf(MdxFlowExpression.make({ value: "a\nb" }))), "{a\n  b}\n");
		});

		it("indents expression continuation lines across every terminator spelling", () => {
			// Oracle line handling: a bare `\r` separates lines too, terminators
			// survive verbatim, and blank lines take no indent.
			assert.strictEqual(stringified(rootOf(MdxFlowExpression.make({ value: "a\rb" }))), "{a\r  b}\n");
			assert.strictEqual(stringified(rootOf(MdxFlowExpression.make({ value: "a\r\n\r\nb" }))), "{a\r\n\r\n  b}\n");
		});

		it("serializes text expressions inline", () => {
			assert.strictEqual(
				stringified(rootOf(paragraph(text("a "), MdxTextExpression.make({ value: "b" }), text(" c.")))),
				"a {b} c.\n",
			);
		});

		it("serializes ESM values verbatim as blocks", () => {
			assert.strictEqual(stringified(rootOf(MdxjsEsm.make({ value: 'import a from "b"' }))), 'import a from "b"\n');
			const tree = rootOf(
				MdxjsEsm.make({ value: 'import {A} from "./a.ts"' }),
				Heading.make({ depth: 1, children: [text("Title")] }),
				flowElement("A"),
			);
			assert.strictEqual(stringified(tree), 'import {A} from "./a.ts"\n\n# Title\n\n<A />\n');
		});
	});

	describe("MDX-aware text escaping", () => {
		it("escapes `{` in text only when the tree carries an MDX node", () => {
			const plain = rootOf(paragraph(text("a { b")));
			assert.strictEqual(stringified(plain), "a { b\n");
			const withMdx = rootOf(paragraph(text("a { b")), flowElement("x"));
			assert.strictEqual(stringified(withMdx), "a \\{ b\n\n<x />\n");
		});

		it("escapes `<` in text always (already in the canonical escape set)", () => {
			assert.strictEqual(stringified(rootOf(paragraph(text("a < b")))), "a \\< b\n");
		});
	});

	describe("the JSON-encoded props path (the consumer's primary construction)", () => {
		it("carries JSON.stringify output through an attribute value expression byte-exactly", () => {
			const props = { code: 'const a: string = "quoted"', apiScope: "public", n: 1 };
			const tree = rootOf(
				flowElement("ApiSignature", [
					MdxJsxAttribute.make({
						name: "code",
						value: MdxJsxAttributeValueExpression.make({ value: JSON.stringify(props) }),
					}),
				]),
			);
			assert.strictEqual(
				stringified(tree),
				'<ApiSignature code={{"code":"const a: string = \\"quoted\\"","apiScope":"public","n":1}} />\n',
			);
		});
	});

	describe("Mdast interop", () => {
		it("projects MDX nodes the way mdast-util-mdx spells them", () => {
			const tree = rootOf(
				flowElement(
					"x",
					[
						MdxJsxAttribute.make({ name: "a" }),
						MdxJsxAttribute.make({ name: "b", value: MdxJsxAttributeValueExpression.make({ value: "c" }) }),
						expressionAttribute("...d"),
					],
					[paragraph(text("y"), MdxTextExpression.make({ value: "z" }))],
				),
				MdxjsEsm.make({ value: "export const a = 1" }),
			);
			const projected = Mdast.toMdast(tree) as unknown as {
				children: ReadonlyArray<Record<string, unknown>>;
			};
			const element = projected.children[0] as {
				type: string;
				name: string | null;
				attributes: ReadonlyArray<Record<string, unknown>>;
			};
			assert.strictEqual(element.type, "mdxJsxFlowElement");
			assert.strictEqual(element.name, "x");
			// A bare attribute projects `value: null` (the parser's spelling);
			// a value expression projects without a position (ditto).
			assert.deepStrictEqual(element.attributes[0]?.value, null);
			assert.deepStrictEqual(element.attributes[1]?.value, { type: "mdxJsxAttributeValueExpression", value: "c" });
			assert.deepStrictEqual(element.attributes[2]?.type, "mdxJsxExpressionAttribute");
			assert.strictEqual(projected.children[1]?.type, "mdxjsEsm");
		});

		it("admits foreign MDX trees, synthesizing positions and dropping estree data", () => {
			const foreign = {
				type: "root",
				children: [
					{
						type: "mdxJsxFlowElement",
						name: null,
						attributes: [],
						children: [{ type: "paragraph", children: [{ type: "text", value: "y" }] }],
					},
					{
						type: "mdxFlowExpression",
						value: "a + b",
						data: { estree: { type: "Program", body: [], sourceType: "module" } },
					},
					{
						type: "paragraph",
						children: [
							{
								type: "mdxJsxTextElement",
								name: "b",
								attributes: [
									{ type: "mdxJsxAttribute", name: "x", value: null },
									{
										type: "mdxJsxAttribute",
										name: "y",
										value: { type: "mdxJsxAttributeValueExpression", value: "z" },
									},
								],
								children: [],
							},
						],
					},
				],
			};
			const result = Mdast.fromMdastResult(foreign);
			assert.isTrue(Result.isSuccess(result));
			if (Result.isSuccess(result)) {
				const [fragment, expression, wrapper] = result.success.children;
				assert.strictEqual(fragment?.type, "mdxJsxFlowElement");
				assert.strictEqual(expression?.type, "mdxFlowExpression");
				const textEl = wrapper?.type === "paragraph" ? wrapper.children[0] : undefined;
				assert.strictEqual(textEl?.type, "mdxJsxTextElement");
				if (textEl?.type === "mdxJsxTextElement") {
					// The null value spelling survives admission, and sentinel
					// positions were synthesized on the attribute carriers.
					assert.strictEqual(textEl.attributes[0]?.type === "mdxJsxAttribute" ? textEl.attributes[0].value : "x", null);
					assert.strictEqual(textEl.attributes[0]?.position.start.offset, 0);
				}
			}
		});

		it("passes a malformed element name through so the decode fails typed", () => {
			// The oracle contract is exactly `string | null`; anything else must
			// reach the schema and fail the decode, never be coerced to a fragment.
			const numericName = {
				type: "root",
				children: [{ type: "mdxJsxFlowElement", name: 42, attributes: [], children: [] }],
			};
			assert.isTrue(Result.isFailure(Mdast.fromMdastResult(numericName)));
			const emptyName = {
				type: "root",
				children: [{ type: "mdxJsxFlowElement", name: "", attributes: [], children: [] }],
			};
			assert.isTrue(Result.isFailure(Mdast.fromMdastResult(emptyName)));
		});

		it("passes non-array attributes and children through so the decode fails typed", () => {
			// Same contract discipline as `name`: `attributes` and `children`
			// are exactly arrays, so any other value must reach the schema and
			// fail the decode — never be coerced to `[]`, which would decode
			// successfully while silently dropping input.
			const objectAttributes = {
				type: "root",
				children: [{ type: "mdxJsxFlowElement", name: "x", attributes: {}, children: [] }],
			};
			assert.isTrue(Result.isFailure(Mdast.fromMdastResult(objectAttributes)));
			const stringChildren = {
				type: "root",
				children: [{ type: "mdxJsxFlowElement", name: "x", attributes: [], children: "text" }],
			};
			assert.isTrue(Result.isFailure(Mdast.fromMdastResult(stringChildren)));
		});

		it("round-trips project-then-admit for a tree with every MDX node type", () => {
			const tree = rootOf(
				MdxjsEsm.make({ value: "import a from 'b'" }),
				flowElement("x", [MdxJsxAttribute.make({ name: "a", value: "b" })], [paragraph(text("y"))]),
				MdxFlowExpression.make({ value: "1 + 1" }),
				paragraph(textElement("i", [], [text("z")]), MdxTextExpression.make({ value: "q" })),
			);
			const back = Mdast.fromMdastResult(Mdast.toMdast(tree));
			assert.isTrue(Result.isSuccess(back));
			if (Result.isSuccess(back)) {
				assert.deepStrictEqual(Mdast.toMdast(back.success), Mdast.toMdast(tree));
				assert.strictEqual(stringified(back.success), stringified(tree));
			}
		});
	});

	describe("document navigation over MDX nodes", () => {
		const docOf = (...children: ReadonlyArray<Root["children"][number]>): MarkdownDocument =>
			MarkdownDocument.make({
				source: "",
				root: rootOf(...children),
				diagnostics: [],
				definitions: new Map(),
			});

		it("reads heading text through a JSX text wrapper; an expression contributes none", () => {
			const document = docOf(
				Heading.make({
					depth: 1,
					children: [textElement("span", [], [text("Title")]), MdxTextExpression.make({ value: "x" })],
				}),
			);
			assert.strictEqual(document.headings[0]?.text, "Title");
			assert.strictEqual(document.sections[0]?.text, "Title");
		});

		it("sections a document carrying an ESM statement, excluding it from section children", () => {
			const document = docOf(
				Heading.make({ depth: 1, children: [text("T")] }),
				MdxjsEsm.make({ value: 'import a from "b"' }),
				paragraph(text("body")),
			);
			const sections = document.sections;
			assert.strictEqual(sections.length, 1);
			// ESM is metadata, not prose — like frontmatter it belongs to no
			// section, which is also what keeps the FlowContent typing sound.
			assert.deepStrictEqual(
				sections[0]?.children.map((child) => child.type),
				["paragraph"],
			);
		});
	});
});
