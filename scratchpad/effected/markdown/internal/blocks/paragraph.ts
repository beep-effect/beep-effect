// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// Port notes: a paragraph has no block start of its own — the line loop opens
// one for any line no other construct claimed, which is upstream's structure
// too. The link-reference-definition split runs here rather than in the
// document's finalize walk (see `linkReferenceDefinition.ts`), which is the
// one structural difference: upstream defers it to a tree walk at the end,
// this port does it as each paragraph closes.

import { Paragraph } from "../../MarkdownNode.ts";
import type { BlockConstruct } from "../blockTypes.ts";
import { extractDefinitions } from "./linkReferenceDefinition.ts";

/** Paragraph: absorbs lines until a blank one, and contains nothing. */
export const paragraphConstruct: BlockConstruct = {
	type: "paragraph",
	acceptsLines: true,
	canContain: () => false,
	continue: (scanner) => (scanner.blank ? 1 : 0),
	finalize: (_scanner, block) => {
		extractDefinitions(block);
	},
	materialize: (block, _children, context) => {
		const inline = context.inlineSlice(block);
		// A paragraph whose content trimmed away renders nothing; dropping it
		// keeps `<p></p>` out of the tree. A paragraph that held only link
		// reference definitions is the case that makes this reachable.
		if (inline.text.length === 0) {
			return undefined;
		}

		const node = Paragraph.make({
			children: inline.children,
			position: context.position(block.startOffset, block.endOffset),
		});
		context.registerInline(node, inline);
		return node;
	},
};
