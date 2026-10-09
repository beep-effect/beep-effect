// Unit coverage for GFM footnotes: the `[^label]:` block definition and the
// `[^label]` inline reference.
//
// Semantics authority is cmark-gfm 0.29.0.gfm.13. Footnotes are the one GFM
// construct that lives in cmark-gfm's CORE rather than `extensions/` — it is
// gated by `CMARK_OPT_FOOTNOTES`, not by an extension registration — so the
// files to read are `src/footnotes.c` (the label map), `src/blocks.c` (the
// definition block start, its continuation prefix, and `process_footnotes`)
// and `src/inlines.c` (the reference, formed in `handle_close_bracket`'s
// `noMatch` fallthrough).
//
// The three `extensions.txt` conformance examples sample the happy path and
// one unmatched reference; these assert the rules behind them: the definition
// label grammar (which forbids spaces, unlike a link label), the four-space
// continuation prefix and the blank-line rule, lazy paragraph continuation,
// reference formation and its literal fallback, label normalization, and that
// the `commonmark` dialect never sees either construct.

import { assert, describe, it } from "@effect/vitest";
import { parseBlocks } from "../../effected/markdown/internal/blockParser.ts";
import { MAX_NESTING_DEPTH } from "../../effected/markdown/internal/limits.ts";
import type {
	FlowContent,
	FootnoteDefinition,
	FootnoteReference,
	Frontmatter,
	MdxjsEsm,
	Paragraph,
	PhrasingContent,
	Text,
} from "../../effected/markdown/MarkdownNode.ts";

type Dialect = "commonmark" | "gfm";

/** Every node in a source's flow tree, in document order, however deeply nested. */
const flowNodes = (source: string, dialect: Dialect = "gfm"): ReadonlyArray<FlowContent> => {
	const found: FlowContent[] = [];
	const walk = (nodes: ReadonlyArray<Frontmatter | MdxjsEsm | FlowContent>): void => {
		for (const node of nodes) {
			if (node.type === "frontmatter" || node.type === "mdxjsEsm") {
				continue;
			}
			found.push(node);
			if (node.type === "blockquote" || node.type === "footnoteDefinition") {
				walk(node.children);
			} else if (node.type === "list") {
				for (const item of node.children) {
					walk(item.children);
				}
			}
		}
	};
	walk(parseBlocks(source, dialect).root.children);
	return found;
};

/** Every footnote definition in a source, in document order. */
const definitionsOf = (source: string, dialect: Dialect = "gfm"): ReadonlyArray<FootnoteDefinition> =>
	flowNodes(source, dialect).filter((node): node is FootnoteDefinition => node.type === "footnoteDefinition");

/** The first footnote definition a source produces; fails the test if it produced none. */
const firstDefinition = (source: string, dialect: Dialect = "gfm"): FootnoteDefinition => {
	const definition = definitionsOf(source, dialect)[0];
	assert.isDefined(definition, "expected the source to parse a footnote definition");
	return definition;
};

/** Every phrasing node in a source, in document order, however deeply nested. */
const phrasingNodes = (source: string, dialect: Dialect = "gfm"): ReadonlyArray<PhrasingContent> => {
	const found: PhrasingContent[] = [];
	const walk = (nodes: ReadonlyArray<PhrasingContent>): void => {
		for (const node of nodes) {
			found.push(node);
			if (
				node.type === "emphasis" ||
				node.type === "strong" ||
				node.type === "delete" ||
				node.type === "link" ||
				node.type === "linkReference"
			) {
				walk(node.children);
			}
		}
	};
	for (const node of flowNodes(source, dialect)) {
		if (node.type === "paragraph" || node.type === "heading") {
			walk(node.children);
		}
	}
	return found;
};

/** Every footnote reference in a source, in document order. */
const referencesOf = (source: string, dialect: Dialect = "gfm"): ReadonlyArray<FootnoteReference> =>
	phrasingNodes(source, dialect).filter((node): node is FootnoteReference => node.type === "footnoteReference");

/** The first footnote reference a source produces; fails the test if it produced none. */
const firstReference = (source: string, dialect: Dialect = "gfm"): FootnoteReference => {
	const reference = referencesOf(source, dialect)[0];
	assert.isDefined(reference, "expected the source to parse a footnote reference");
	return reference;
};

/** The concatenated text of every top-level paragraph in a source. */
const paragraphText = (source: string, dialect: Dialect = "gfm"): string =>
	phrasingNodes(source, dialect)
		.filter((node): node is Text => node.type === "text")
		.map((node) => node.value)
		.join("");

/** A definition's child paragraph at `index`, asserted to be one. */
const definitionParagraph = (definition: FootnoteDefinition, index = 0): Paragraph => {
	const child = definition.children[index];
	assert.isDefined(child, `expected a child at ${String(index)}`);
	assert.strictEqual(child.type, "paragraph");
	return child as Paragraph;
};

/** A paragraph's flattened text. */
const textOf = (paragraph: Paragraph): string =>
	paragraph.children
		.filter((node): node is Text => node.type === "text")
		.map((node) => node.value)
		.join("");

describe("gfm footnotes", () => {
	describe("the definition block start", () => {
		it("opens a definition on an unindented marker", () => {
			const definition = firstDefinition("[^a]: bravo");
			assert.strictEqual(definition.identifier, "a");
			assert.strictEqual(textOf(definitionParagraph(definition)), "bravo");
		});

		it("keeps the definition in the tree at its source position", () => {
			// The port delta: cmark-gfm's `process_footnotes` physically moves
			// every definition to the end of the document and DROPS the ones
			// nothing references. Definitions here stay where they were written,
			// on the same terms as a link reference definition, because this
			// package edits markdown and a relocated node is a lost edit.
			const nodes = flowNodes("alpha\n\n[^a]: bravo\n\ncharlie");
			assert.deepStrictEqual(
				nodes.map((node) => node.type),
				["paragraph", "footnoteDefinition", "paragraph", "paragraph"],
			);
		});

		it("keeps an unreferenced definition in the tree", () => {
			// cmark-gfm unlinks a definition with no `ix` (nothing referenced
			// it). Here it survives; a renderer that wants cmark's output emits
			// nothing for it, which the test writer does.
			assert.strictEqual(definitionsOf("[^unused]: nobody points here").length, 1);
		});

		it("takes the label verbatim as `label` and normalized as `identifier`", () => {
			// mdast's Association contract: `identifier` is the normalized
			// label, `label` is the source text. cmark-gfm normalizes with
			// `normalize_map_label` — the same case fold link references use.
			const definition = firstDefinition("[^Alpha]: bravo");
			assert.strictEqual(definition.identifier, "alpha");
			assert.strictEqual(definition.label, "Alpha");
		});

		it("always carries a label, never an explicitly absent one", () => {
			// `label` is an `optionalKey`, and the P1 discipline is that an
			// absent optional field is genuinely absent rather than present and
			// `undefined`. A parsed definition always has a source label, so
			// the key is always there.
			const definition = firstDefinition("[^a]: bravo");
			assert.isTrue("label" in definition);
			assert.strictEqual(definition.label, "a");
		});

		it("case folds the identifier the way link references do", () => {
			// `normalize_map_label` runs `cmark_utf8proc_case_fold`, which is
			// full case folding and not `toLowerCase` — the same fold that makes
			// a link reference label match across it.
			assert.strictEqual(firstDefinition("[^ẞ]: bravo").identifier, "ss");
		});

		it("accepts a numeric label", () => {
			assert.strictEqual(firstDefinition("[^1]: bravo").identifier, "1");
		});

		it("accepts punctuation in a label", () => {
			assert.strictEqual(firstDefinition("[^other-note]: bravo").identifier, "other-note");
		});

		it("strips the spaces and tabs after the colon", () => {
			// `_scan_footnote_definition` consumes `[ \t]*` after `]:`, so the
			// content starts at the first non-space — eight spaces here would
			// otherwise open an indented code block.
			const definition = firstDefinition("[^a]:       no code block here");
			assert.strictEqual(definitionParagraph(definition).type, "paragraph");
			assert.strictEqual(textOf(definitionParagraph(definition)), "no code block here");
		});

		it("opens an empty definition when the marker ends the line", () => {
			assert.deepStrictEqual(firstDefinition("[^a]:").children, []);
		});

		it("refuses a label holding a space", () => {
			// The scanner's label class is `[^\] \r\n\x00\t]+` — a footnote
			// label may not hold whitespace at all, which is where it parts
			// company with a link reference label.
			// `bravo charlie` keeps the line from being a LINK reference
			// definition with the label `^a b` instead, which is what a footnote
			// label holding a space falls back to.
			assert.strictEqual(definitionsOf("[^a b]: bravo charlie").length, 0);
			assert.strictEqual(paragraphText("[^a b]: bravo charlie"), "[^a b]: bravo charlie");
		});

		it("refuses a label holding a tab", () => {
			assert.strictEqual(definitionsOf("[^a\tb]: bravo").length, 0);
		});

		it("refuses an empty label", () => {
			assert.strictEqual(definitionsOf("[^]: bravo").length, 0);
		});

		it("refuses a marker with no colon", () => {
			assert.strictEqual(definitionsOf("[^a] bravo").length, 0);
		});

		it("refuses a marker indented four spaces", () => {
			// The block start is guarded by `!indented`, so four spaces make it
			// an indented code block instead.
			const nodes = flowNodes("    [^a]: bravo");
			assert.deepStrictEqual(
				nodes.map((node) => node.type),
				["code"],
			);
		});

		it("opens on a marker indented three spaces", () => {
			assert.strictEqual(firstDefinition("   [^a]: bravo").identifier, "a");
		});

		it("interrupts a paragraph", () => {
			// The footnote branch in `open_new_blocks` carries no
			// `cont_type == PARAGRAPH && !all_matched` guard, unlike the
			// thematic break above it, so it interrupts.
			const nodes = flowNodes("alpha\n[^a]: bravo");
			assert.deepStrictEqual(
				nodes.map((node) => node.type),
				["paragraph", "footnoteDefinition", "paragraph"],
			);
		});

		it("opens inside a blockquote", () => {
			// `cmark_node_can_contain_type` lets any block container hold a
			// footnote definition.
			const nodes = flowNodes("> [^a]: bravo");
			assert.deepStrictEqual(
				nodes.map((node) => node.type),
				["blockquote", "footnoteDefinition", "paragraph"],
			);
		});

		it("opens inside a list item", () => {
			const nodes = flowNodes("- [^a]: bravo");
			assert.deepStrictEqual(
				nodes.map((node) => node.type),
				["list", "footnoteDefinition", "paragraph"],
			);
		});
	});

	describe("the definition continuation prefix", () => {
		it("continues a block indented four spaces", () => {
			// `parse_footnote_definition_block_prefix`: four columns of indent
			// continue the definition, anything less ends it.
			const definition = firstDefinition("[^a]: alpha\n\n    bravo");
			assert.strictEqual(definition.children.length, 2);
			assert.strictEqual(textOf(definitionParagraph(definition, 1)), "bravo");
		});

		it("reads eight spaces as an indented code block inside the definition", () => {
			// Four for the continuation prefix, four for the code block.
			const definition = firstDefinition("[^a]:\n        alpha");
			const child = definition.children[0];
			assert.isDefined(child);
			assert.strictEqual(child.type, "code");
		});

		it("continues across a blank line", () => {
			const definition = firstDefinition("[^a]: alpha\n\n    bravo\n\n    charlie");
			assert.strictEqual(definition.children.length, 3);
		});

		it("ends at an unindented line after a blank line", () => {
			const nodes = flowNodes("[^a]: alpha\n\nbravo");
			assert.deepStrictEqual(
				nodes.map((node) => node.type),
				["footnoteDefinition", "paragraph", "paragraph"],
			);
			assert.strictEqual(firstDefinition("[^a]: alpha\n\nbravo").children.length, 1);
		});

		it("takes an unindented line with no blank line as lazy paragraph continuation", () => {
			// The prefix fails, but the open paragraph inside is a lazy
			// continuation target exactly as it would be inside a blockquote.
			const definition = firstDefinition("[^a]: alpha\nbravo");
			assert.strictEqual(definition.children.length, 1);
			assert.strictEqual(textOf(definitionParagraph(definition)), "alpha\nbravo");
		});

		it("holds a blockquote, a code block and paragraphs at once", () => {
			// The shape of the `extensions.txt` `[^footnote]` case.
			const definition = firstDefinition(
				"[^a]:\n    > quoted\n\n        code\n\n    or, naturally, simple paragraphs.\n",
			);
			assert.deepStrictEqual(
				definition.children.map((child) => child.type),
				["blockquote", "code", "paragraph"],
			);
		});

		it("holds a nested footnote definition", () => {
			const definition = firstDefinition("[^a]:\n    [^b]: bravo");
			assert.deepStrictEqual(
				definition.children.map((child) => child.type),
				["footnoteDefinition"],
			);
		});
	});

	describe("reference formation", () => {
		it("forms a reference when a definition matches", () => {
			const reference = firstReference("alpha[^a]\n\n[^a]: bravo");
			assert.strictEqual(reference.identifier, "a");
			assert.strictEqual(reference.label, "a");
		});

		it("forms a reference against a definition that appears LATER", () => {
			// The map is built from the whole block tree before the inline pass
			// runs, so document order does not matter — cmark-gfm's
			// `process_footnotes` collects every definition before it resolves
			// any reference, for the same reason.
			assert.strictEqual(referencesOf("alpha[^a]\n\n[^a]: bravo").length, 1);
		});

		it("leaves a reference with no matching definition as literal text", () => {
			// cmark-gfm forms the node unconditionally and REWRITES it back to
			// `[^label]` text in `process_footnotes` when the lookup misses.
			// Consulting the map at formation time reaches the same tree in one
			// pass, and this is the observable half.
			assert.strictEqual(referencesOf("alpha[^nope]").length, 0);
			assert.strictEqual(paragraphText("alpha[^nope]"), "alpha[^nope]");
		});

		it("discards the inner inline structure of an unmatched reference", () => {
			// The fallback text is rebuilt from the RAW source span between the
			// brackets (`cmark_chunk_dup` off the text node following the
			// opener), so emphasis that had already been paired inside is lost.
			assert.strictEqual(paragraphText("[^*a*]"), "[^*a*]");
			assert.strictEqual(phrasingNodes("[^*a*]").length, 1);
		});

		it("matches a definition case-insensitively", () => {
			const reference = firstReference("alpha[^Bravo]\n\n[^bravo]: charlie");
			assert.strictEqual(reference.identifier, "bravo");
			assert.strictEqual(reference.label, "Bravo");
		});

		it("does not form on an empty marker", () => {
			// `(literal->len > 1 || opener->inl_text->next->next)`: there has to
			// be something between the caret and the closing bracket.
			assert.strictEqual(referencesOf("[^]\n\n[^]: bravo").length, 0);
			assert.strictEqual(paragraphText("[^]"), "[^]");
		});

		it("does not form when the caret is not the first character", () => {
			assert.strictEqual(referencesOf("[ ^a]\n\n[^a]: bravo").length, 0);
		});

		it("loses to an inline link", () => {
			// The footnote branch is the `noMatch` fallthrough, so everything
			// `handle_close_bracket` tries first still wins.
			const nodes = phrasingNodes("[^a](/url)\n\n[^a]: bravo");
			assert.strictEqual(nodes[0]?.type, "link");
		});

		it("loses to a full link reference", () => {
			const nodes = phrasingNodes("[^a][ref]\n\n[^a]: bravo\n\n[ref]: /url");
			assert.strictEqual(nodes[0]?.type, "linkReference");
		});

		it("forms more than once against the same definition", () => {
			assert.strictEqual(referencesOf("alpha[^a] bravo[^a] charlie[^a]\n\n[^a]: delta").length, 3);
		});

		it("forms inside a footnote definition", () => {
			const references = referencesOf("[^a]: see [^b]\n\n[^b]: bravo");
			assert.strictEqual(references.length, 1);
			assert.strictEqual(references[0]?.identifier, "b");
		});

		it("forms inside a definition that references itself", () => {
			const references = referencesOf("[^a]: see [^a]");
			assert.strictEqual(references.length, 1);
			assert.strictEqual(references[0]?.identifier, "a");
		});

		it("always carries a label, never an explicitly absent one", () => {
			const reference = firstReference("alpha[^a]\n\n[^a]: bravo");
			assert.isTrue("label" in reference);
		});

		it("forms inside emphasis", () => {
			const types = phrasingNodes("*alpha[^a]*\n\n[^a]: bravo").map((node) => node.type);
			assert.include(types, "emphasis");
			assert.include(types, "footnoteReference");
		});
	});

	describe("positions", () => {
		it("spans the whole definition, marker included", () => {
			// A port delta from cmark-gfm, which starts the node AFTER the
			// marker (`add_child(..., first_nonspace + matched + 1)`) for its
			// own column bookkeeping. mdast positions span the construct.
			const definition = firstDefinition("[^a]: bravo");
			assert.strictEqual(definition.position.start.offset, 0);
			assert.strictEqual(definition.position.start.line, 1);
			assert.strictEqual(definition.position.start.column, 1);
			assert.strictEqual(definition.position.end.offset, 11);
		});

		it("positions a definition that does not start at the document start", () => {
			const definition = firstDefinition("alpha\n\n[^a]: bravo");
			assert.strictEqual(definition.position.start.offset, 7);
			assert.strictEqual(definition.position.start.line, 3);
		});

		it("spans exactly the reference marker", () => {
			const reference = firstReference("abc[^a]def\n\n[^a]: bravo");
			assert.strictEqual(reference.position.start.offset, 3);
			assert.strictEqual(reference.position.end.offset, 7);
			assert.strictEqual(reference.position.start.column, 4);
		});

		it("positions a reference on a later line", () => {
			const reference = firstReference("alpha\n\nbravo[^a]\n\n[^a]: charlie");
			assert.strictEqual(reference.position.start.line, 3);
			assert.strictEqual(reference.position.start.offset, 12);
		});
	});

	describe("the commonmark dialect sees neither construct", () => {
		it("reads a definition line as a paragraph", () => {
			// `bravo charlie` cannot be a link destination followed by a title,
			// so the line is not a link reference definition either — it is
			// plain paragraph text, which is what `commonmark` must keep
			// producing now that `gfm` reads it as a footnote.
			assert.strictEqual(definitionsOf("[^a]: bravo charlie", "commonmark").length, 0);
			assert.strictEqual(paragraphText("[^a]: bravo charlie", "commonmark"), "[^a]: bravo charlie");
		});

		it("reads a reference as literal text", () => {
			assert.strictEqual(referencesOf("alpha[^a]\n\n[^a]: bravo", "commonmark").length, 0);
			assert.strictEqual(paragraphText("alpha[^a]", "commonmark"), "alpha[^a]");
		});

		it("still reads a link reference definition whose label starts with a caret", () => {
			// Under `commonmark` the line is a link reference definition with
			// the label `^a`; under `gfm` the footnote block start claims it
			// first. Both dialects have to keep their own answer.
			const nodes = flowNodes("[^a]: /url", "commonmark");
			assert.deepStrictEqual(
				nodes.map((node) => node.type),
				["definition"],
			);
		});
	});

	describe("hardening", () => {
		it("trips the nesting guard on definition-in-definition recursion", () => {
			// A footnote definition is a container, so it shares `addChild`'s
			// `MAX_NESTING_DEPTH` cap with every other one. cmark-gfm guards the
			// same shape with its own `depth < MAX_LIST_DEPTH` test on the block
			// start.
			assert.throws(() => parseBlocks("[^a]: ".repeat(MAX_NESTING_DEPTH + 4), "gfm"));
		});

		it("parses a definition nested just under the cap", () => {
			assert.doesNotThrow(() => parseBlocks("[^a]: ".repeat(8), "gfm"));
		});

		it("does not blow the stack on many sibling definitions", () => {
			const source = Array.from({ length: 5000 }, (_, index) => `[^n${String(index)}]: body`).join("\n\n");
			assert.strictEqual(definitionsOf(source).length, 5000);
		});
	});
});
