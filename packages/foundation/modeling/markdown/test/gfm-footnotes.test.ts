import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { MAX_NESTING_DEPTH } from "@beep/markdown/internal/limits";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Str from "effect/String";
import { flowNodes } from "./support/tree.ts";
import type {
  FlowContent,
  FootnoteDefinition,
  FootnoteReference,
  Paragraph,
  PhrasingContent,
  Text,
} from "@beep/markdown/MarkdownNode";

type Dialect = "commonmark" | "gfm";

const flowNodesOf = (source: string, dialect: Dialect = "gfm"): ReadonlyArray<FlowContent> =>
  flowNodes(parseBlocks(source, { dialect: dialect }).root.children);

const definitionsOf = (source: string, dialect: Dialect = "gfm"): ReadonlyArray<FootnoteDefinition> =>
  A.filter(flowNodesOf(source, dialect), (node): node is FootnoteDefinition => node.type === "footnoteDefinition");

const firstDefinition = (source: string, dialect: Dialect = "gfm"): FootnoteDefinition => {
  const definition = definitionsOf(source, dialect)[0];
  assert.isDefined(definition, "expected the source to parse a footnote definition");
  return definition;
};

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
  for (const node of flowNodesOf(source, dialect)) {
    if (node.type === "paragraph" || node.type === "heading") {
      walk(node.children);
    }
  }
  return found;
};

const referencesOf = (source: string, dialect: Dialect = "gfm"): ReadonlyArray<FootnoteReference> =>
  A.filter(phrasingNodes(source, dialect), (node): node is FootnoteReference => node.type === "footnoteReference");

const firstReference = (source: string, dialect: Dialect = "gfm"): FootnoteReference => {
  const reference = referencesOf(source, dialect)[0];
  assert.isDefined(reference, "expected the source to parse a footnote reference");
  return reference;
};

const isText = (node: PhrasingContent): node is Text => node.type === "text";

const paragraphText = (source: string, dialect: Dialect = "gfm"): string =>
  A.join(
    A.map(A.filter(phrasingNodes(source, dialect), isText), (node) => node.value),
    ""
  );

const definitionParagraph = (definition: FootnoteDefinition, index = 0): Paragraph => {
  const child = definition.children[index];
  assert.isDefined(child, `expected a child at ${String(index)}`);
  assert.strictEqual(child.type, "paragraph");
  if (child.type !== "paragraph") assert.fail("expected a paragraph");
  return child;
};

const textOf = (paragraph: Paragraph): string =>
  A.join(
    A.map(A.filter(paragraph.children, isText), (node) => node.value),
    ""
  );

describe("gfm footnotes: the rules the three extensions.txt examples only sample, per the cmark-gfm 0.29.0.gfm.13 core", () => {
  describe("the definition block start", () => {
    it("opens a definition on an unindented marker", () => {
      const definition = firstDefinition("[^a]: bravo");
      assert.strictEqual(definition.identifier, "a");
      assert.strictEqual(textOf(definitionParagraph(definition)), "bravo");
    });

    it("keeps the definition in the tree at its source position", () => {
      const nodes = flowNodesOf("alpha\n\n[^a]: bravo\n\ncharlie");
      assert.deepStrictEqual(
        A.map(nodes, (node) => node.type),
        ["paragraph", "footnoteDefinition", "paragraph", "paragraph"],
        "a port delta: cmark-gfm's process_footnotes moves every definition to the end and drops unreferenced ones; here they stay, as link reference definitions do, since a relocated node is a lost edit"
      );
    });

    it("keeps an unreferenced definition in the tree", () => {
      assert.strictEqual(
        definitionsOf("[^unused]: nobody points here").length,
        1,
        "cmark-gfm unlinks a definition nothing referenced; here it survives, and a renderer wanting cmark's output emits nothing for it, as the test writer does"
      );
    });

    it("takes the label verbatim as `label` and normalized as `identifier`", () => {
      const definition = firstDefinition("[^Alpha]: bravo");
      assert.strictEqual(
        definition.identifier,
        "alpha",
        "mdast's Association contract: identifier is the normalized label and label the source text; cmark-gfm normalizes with normalize_map_label, the link-reference case fold"
      );
      assert.strictEqual(definition.label, "Alpha");
    });

    it("always carries a label, never an explicitly absent one", () => {
      const definition = firstDefinition("[^a]: bravo");
      assert.isTrue(
        "label" in definition,
        "label is an optionalKey, and an absent optional field is genuinely absent, never present and undefined; a parsed definition always has a source label"
      );
      assert.strictEqual(definition.label, "a");
    });

    it("case folds the identifier the way link references do", () => {
      assert.strictEqual(
        firstDefinition("[^ẞ]: bravo").identifier,
        "ss",
        "normalize_map_label runs cmark_utf8proc_case_fold, full case folding rather than toLowerCase, the same fold link reference labels match across"
      );
    });

    it("accepts a numeric label", () => {
      assert.strictEqual(firstDefinition("[^1]: bravo").identifier, "1");
    });

    it("accepts punctuation in a label", () => {
      assert.strictEqual(firstDefinition("[^other-note]: bravo").identifier, "other-note");
    });

    it("strips the spaces and tabs after the colon", () => {
      const definition = firstDefinition("[^a]:       no code block here");
      assert.strictEqual(
        definitionParagraph(definition).type,
        "paragraph",
        "_scan_footnote_definition consumes [ \\t]* after ]:, so content starts at the first non-space; eight spaces would otherwise open indented code"
      );
      assert.strictEqual(textOf(definitionParagraph(definition)), "no code block here");
    });

    it("opens an empty definition when the marker ends the line", () => {
      assert.deepStrictEqual(firstDefinition("[^a]:").children, []);
    });

    it("refuses a label holding a space", () => {
      assert.strictEqual(
        definitionsOf("[^a b]: bravo charlie").length,
        0,
        "the scanner's label class [^\\] \\r\\n\\x00\\t]+ admits no whitespace at all, where it parts company with a link reference label"
      );
      assert.strictEqual(
        paragraphText("[^a b]: bravo charlie"),
        "[^a b]: bravo charlie",
        "bravo charlie keeps the line from being a link reference definition labelled ^a b, the fallback for a spaced footnote label"
      );
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
      const nodes = flowNodesOf("    [^a]: bravo");
      assert.deepStrictEqual(
        A.map(nodes, (node) => node.type),
        ["code"],
        "the block start is guarded by !indented, so four spaces make an indented code block instead"
      );
    });

    it("opens on a marker indented three spaces", () => {
      assert.strictEqual(firstDefinition("   [^a]: bravo").identifier, "a");
    });

    it("interrupts a paragraph", () => {
      const nodes = flowNodesOf("alpha\n[^a]: bravo");
      assert.deepStrictEqual(
        A.map(nodes, (node) => node.type),
        ["paragraph", "footnoteDefinition", "paragraph"],
        "the footnote branch in open_new_blocks lacks the cont_type == PARAGRAPH && !all_matched guard the thematic break carries, so it interrupts"
      );
    });

    it("opens inside a blockquote", () => {
      const nodes = flowNodesOf("> [^a]: bravo");
      assert.deepStrictEqual(
        A.map(nodes, (node) => node.type),
        ["blockquote", "footnoteDefinition", "paragraph"],
        "cmark_node_can_contain_type lets any block container hold a footnote definition"
      );
    });

    it("opens inside a list item", () => {
      const nodes = flowNodesOf("- [^a]: bravo");
      assert.deepStrictEqual(
        A.map(nodes, (node) => node.type),
        ["list", "footnoteDefinition", "paragraph"]
      );
    });
  });

  describe("the definition continuation prefix", () => {
    it("continues a block indented four spaces", () => {
      const definition = firstDefinition("[^a]: alpha\n\n    bravo");
      assert.strictEqual(
        definition.children.length,
        2,
        "parse_footnote_definition_block_prefix: four columns of indent continue the definition, anything less ends it"
      );
      assert.strictEqual(textOf(definitionParagraph(definition, 1)), "bravo");
    });

    it("reads eight spaces as an indented code block inside the definition", () => {
      const definition = firstDefinition("[^a]:\n        alpha");
      const child = definition.children[0];
      assert.isDefined(child);
      assert.strictEqual(child.type, "code", "four columns for the continuation prefix, four for the code block");
    });

    it("continues across a blank line", () => {
      const definition = firstDefinition("[^a]: alpha\n\n    bravo\n\n    charlie");
      assert.strictEqual(definition.children.length, 3);
    });

    it("ends at an unindented line after a blank line", () => {
      const nodes = flowNodesOf("[^a]: alpha\n\nbravo");
      assert.deepStrictEqual(
        A.map(nodes, (node) => node.type),
        ["footnoteDefinition", "paragraph", "paragraph"]
      );
      assert.strictEqual(firstDefinition("[^a]: alpha\n\nbravo").children.length, 1);
    });

    it("takes an unindented line with no blank line as lazy paragraph continuation", () => {
      const definition = firstDefinition("[^a]: alpha\nbravo");
      assert.strictEqual(
        definition.children.length,
        1,
        "the prefix fails, but the open paragraph inside is a lazy continuation target, exactly as inside a blockquote"
      );
      assert.strictEqual(textOf(definitionParagraph(definition)), "alpha\nbravo");
    });

    it("holds a blockquote, a code block and paragraphs at once", () => {
      const definition = firstDefinition(
        "[^a]:\n    > quoted\n\n        code\n\n    or, naturally, simple paragraphs.\n"
      );
      assert.deepStrictEqual(
        A.map(definition.children, (child) => child.type),
        ["blockquote", "code", "paragraph"],
        "the shape of the extensions.txt [^footnote] case"
      );
    });

    it("holds a nested footnote definition", () => {
      const definition = firstDefinition("[^a]:\n    [^b]: bravo");
      assert.deepStrictEqual(
        A.map(definition.children, (child) => child.type),
        ["footnoteDefinition"]
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
      assert.strictEqual(
        referencesOf("alpha[^a]\n\n[^a]: bravo").length,
        1,
        "the label map is built from the whole block tree before the inline pass, as cmark-gfm's process_footnotes collects every definition before resolving any reference"
      );
    });

    it("leaves a reference with no matching definition as literal text", () => {
      assert.strictEqual(
        referencesOf("alpha[^nope]").length,
        0,
        "cmark-gfm forms the node unconditionally and rewrites it to [^label] text on a lookup miss; consulting the map at formation reaches the same tree in one pass"
      );
      assert.strictEqual(paragraphText("alpha[^nope]"), "alpha[^nope]");
    });

    it("discards the inner inline structure of an unmatched reference", () => {
      assert.strictEqual(
        paragraphText("[^*a*]"),
        "[^*a*]",
        "the fallback text is rebuilt from the raw source span between the brackets (cmark_chunk_dup off the text after the opener), so emphasis paired inside is lost"
      );
      assert.strictEqual(phrasingNodes("[^*a*]").length, 1);
    });

    it("matches a definition case-insensitively", () => {
      const reference = firstReference("alpha[^Bravo]\n\n[^bravo]: charlie");
      assert.strictEqual(reference.identifier, "bravo");
      assert.strictEqual(reference.label, "Bravo");
    });

    it("does not form on an empty marker", () => {
      assert.strictEqual(
        referencesOf("[^]\n\n[^]: bravo").length,
        0,
        "(literal->len > 1 || opener->inl_text->next->next): something must sit between the caret and the closing bracket"
      );
      assert.strictEqual(paragraphText("[^]"), "[^]");
    });

    it("does not form when the caret is not the first character", () => {
      assert.strictEqual(referencesOf("[ ^a]\n\n[^a]: bravo").length, 0);
    });

    it("loses to an inline link", () => {
      const nodes = phrasingNodes("[^a](/url)\n\n[^a]: bravo");
      assert.strictEqual(
        nodes[0]?.type,
        "link",
        "the footnote branch is handle_close_bracket's noMatch fallthrough, so everything it tries first still wins"
      );
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
      const types = A.map(phrasingNodes("*alpha[^a]*\n\n[^a]: bravo"), (node) => node.type);
      assert.include(types, "emphasis");
      assert.include(types, "footnoteReference");
    });
  });

  describe("positions", () => {
    it("spans the whole definition, marker included", () => {
      const definition = firstDefinition("[^a]: bravo");
      assert.strictEqual(
        definition.position.start.offset,
        0,
        "a port delta: cmark-gfm starts the node after the marker (first_nonspace + matched + 1) for its column bookkeeping; mdast positions span the construct"
      );
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
      assert.strictEqual(
        definitionsOf("[^a]: bravo charlie", "commonmark").length,
        0,
        "bravo charlie cannot be a destination plus title, so the line is no link reference definition: commonmark must keep producing paragraph text"
      );
      assert.strictEqual(paragraphText("[^a]: bravo charlie", "commonmark"), "[^a]: bravo charlie");
    });

    it("reads a reference as literal text", () => {
      assert.strictEqual(referencesOf("alpha[^a]\n\n[^a]: bravo", "commonmark").length, 0);
      assert.strictEqual(paragraphText("alpha[^a]", "commonmark"), "alpha[^a]");
    });

    it("still reads a link reference definition whose label starts with a caret", () => {
      const nodes = flowNodesOf("[^a]: /url", "commonmark");
      assert.deepStrictEqual(
        A.map(nodes, (node) => node.type),
        ["definition"],
        "under commonmark the line is a link reference definition labelled ^a; under gfm the footnote block start claims it first"
      );
    });
  });

  describe("hardening", () => {
    it("trips the nesting guard on definition-in-definition recursion", () => {
      assert.throws(
        () => parseBlocks(Str.repeat(MAX_NESTING_DEPTH + 4)("[^a]: "), { dialect: "gfm" }),
        undefined,
        undefined,
        "a footnote definition is a container sharing addChild's MAX_NESTING_DEPTH cap; cmark-gfm guards it with depth < MAX_LIST_DEPTH"
      );
    });

    it("parses a definition nested just under the cap", () => {
      assert.doesNotThrow(() => parseBlocks(Str.repeat(8)("[^a]: "), { dialect: "gfm" }));
    });

    it("does not blow the stack on many sibling definitions", () => {
      const source = A.join(
        A.makeBy(5000, (index) => `[^n${String(index)}]: body`),
        "\n\n"
      );
      assert.strictEqual(definitionsOf(source).length, 5000);
    });
  });
});
