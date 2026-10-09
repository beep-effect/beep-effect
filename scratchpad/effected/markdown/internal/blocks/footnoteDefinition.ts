// Ported from cmark-gfm 0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
// Copyright (c) 2014 GitHub Inc.
// License: BSD-style (see the cmark-gfm COPYING file)
//
// The GFM footnote DEFINITION block: `[^label]:` and everything indented
// under it.
//
// Footnotes are the one GFM construct cmark-gfm keeps in its CORE rather than
// `extensions/`: there is no `cmark_syntax_extension` for them, only the
// `CMARK_OPT_FOOTNOTES` flag gating a branch of `open_new_blocks`, a case in
// `check_open_blocks`, and the `process_footnotes` post-pass. The three
// sources are `src/blocks.c`, `src/footnotes.c` and `src/scanners.re`. They
// are registered here under the `gfm` dialect only, which is what that option
// flag amounts to in this port.
//
// Port notes, three deltas from upstream:
//
// 1. POSITION. cmark-gfm opens the node AFTER the marker
//    (`add_child(parser, *container, CMARK_NODE_FOOTNOTE_DEFINITION,
//    parser->first_nonspace + matched + 1)`) because its `internal_offset`
//    bookkeeping wants the content column. mdast positions span the whole
//    construct, so the node opens at the `[`.
//
// 2. PLACEMENT. `process_footnotes` unlinks every definition and re-appends it
//    to the document root in reference order, dropping the ones nothing
//    referenced. Definitions here stay where they were written, on exactly the
//    terms `Definition` does: this package edits markdown, and
//    a relocated or deleted definition is a lost edit. A renderer that wants
//    cmark's end-of-document section builds it from the references, which is
//    what the test writer does.
//
// 3. LABEL. Upstream stores the raw label on the node and defers normalization
//    to `cmark_footnote_create`. Here the fold happens once, at the start, so
//    the label map the inline pass consults and the node's `identifier` can
//    never disagree.

import { FootnoteDefinition } from "../../MarkdownNode.ts";
import type { BlockConstruct, BlockStart } from "../blockTypes.ts";
import { flowChildren } from "../blockTypes.ts";
import { stickyOf } from "../patterns.ts";
import { normalizeLabelText } from "../references.ts";

/**
 * `_scan_footnote_definition` from `src/scanners.re`:
 *
 * ```re2c
 * '[^' ([^\] \r\n\x00\t]+) ']:' [ \t]*
 * ```
 *
 * The label class is the whole grammar and the whole surprise: a footnote
 * label may hold no whitespace at all, which is where it parts company with a
 * link reference label. The line terminators in the class are unreachable here
 * (the block pass hands over one line at a time, terminator stripped) but stay
 * so the class reads as upstream's.
 */
const reFootnoteDefinition = /\[\^([^\]\0\t\n\r ]+)\]:[ \t]*/;

/** Columns of indentation a continuation line must carry. */
const CONTINUATION_INDENT = 4;

/**
 * FootnoteDefinition: a container whose children are flow blocks, continued by
 * four columns of indentation.
 */
export const footnoteDefinitionConstruct: BlockConstruct = {
	type: "footnoteDefinition",
	acceptsLines: false,
	// `cmark_node_can_contain_type` groups FOOTNOTE_DEFINITION with DOCUMENT,
	// BLOCK_QUOTE and ITEM: any block child except a bare list item.
	canContain: (child) => child !== "listItem",
	// `parse_footnote_definition_block_prefix`. Four columns of indent continue
	// the definition; so does a completely empty line, which is what lets one
	// hold several paragraphs. Anything else ends it — and when what ends it is
	// ordinary text with an open paragraph inside, the line loop's lazy
	// continuation still absorbs it, exactly as it would inside a blockquote.
	continue: (scanner) => {
		if (scanner.indent >= CONTINUATION_INDENT) {
			scanner.advanceOffset(CONTINUATION_INDENT, true);
			return 0;
		}
		// Upstream tests `input->data[0] == '\n'` — the RAW line, before any
		// indent is skipped, so a line of spaces is not blank enough.
		return scanner.currentLine.length === 0 ? 0 : 1;
	},
	materialize: (block, children, context) => {
		const footnote = block.data.footnote;
		if (footnote === undefined) {
			return undefined;
		}
		return FootnoteDefinition.make({
			identifier: footnote.identifier,
			label: footnote.label,
			children: flowChildren(children),
			position: context.position(block.startOffset, block.endOffset),
		});
	},
};

/**
 * The footnote-definition block start: an unindented `[^label]:`.
 *
 * Registered at the CORE position cmark-gfm runs it from — after the thematic
 * break, before the list marker — rather than with the GFM extensions at the
 * end of the table, because that is literally where the branch sits in
 * `open_new_blocks`. It carries no `cont_type == PARAGRAPH` guard, so unlike
 * the thematic break above it, a footnote definition interrupts a paragraph.
 */
export const footnoteDefinitionStart: BlockStart = {
	name: "footnoteDefinition",
	trigger: (scanner) => {
		if (scanner.indented) {
			return 0;
		}

		const sticky = stickyOf(reFootnoteDefinition);
		sticky.lastIndex = scanner.nextNonspace;
		const found = sticky.exec(scanner.currentLine);
		const rawLabel = found?.[1];
		if (found === null || rawLabel === undefined) {
			return 0;
		}

		const key = normalizeLabelText(rawLabel);
		if (key === "") {
			// `normalize_map_label` returns NULL for a label that folds away to
			// nothing, and `cmark_footnote_create` then drops the definition
			// entirely. Refusing to open is the same outcome one step earlier.
			return 0;
		}

		scanner.closeUnmatchedBlocks();
		// The node spans from the `[` (delta 1), but the scan position moves
		// past the marker and the spaces after it, so the rest of the line
		// becomes the definition's first child rather than its own content.
		const start = scanner.nextNonspace;
		scanner.advanceNextNonspace();
		scanner.advanceOffset(found[0].length, false);

		const block = scanner.addChild("footnoteDefinition", start);
		block.data.footnote = { key, identifier: key.toLowerCase(), label: rawLabel };
		return 1;
	},
};
