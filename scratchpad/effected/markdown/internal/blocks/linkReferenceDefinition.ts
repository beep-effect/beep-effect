// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// THE port delta. Upstream parses link reference definitions off the front of
// every paragraph and DELETES them (`removeLinkReferenceDefinitions`), keeping
// only a refmap, because a renderer has nowhere to put them. This package
// edits markdown, so a deleted definition would be a lost edit: the
// definitions are split out of the paragraph exactly as upstream splits them,
// then spliced into the tree as `definition` nodes at their own source
// position, ahead of whatever is left of the paragraph.
//
// The other half of the delta is that references are never resolved during
// parsing. `parseBlocks` returns a refmap built from these nodes so the
// inline pass and any renderer can resolve on their own terms.
//
// Upstream also does the split in two places (the document finalize walk and
// the setext-heading start). This port does it in one — `extractDefinitions`,
// called from a paragraph's finalize and from the setext start before it
// decides whether any paragraph content is left to promote.

import { Definition } from "../../MarkdownNode.ts";
import type { BlockConstruct, BlockNode } from "../blockTypes.ts";
import { makeBlockNode } from "../blockTypes.ts";
import { parseReference } from "../references.ts";
import { sliceWithSegments, sourceOffsetAt } from "../segments.ts";
import * as O from "@beep/utils/Option";

const C_OPEN_BRACKET = 0x5b;

/**
 * Split every leading link reference definition out of `block`, inserting one
 * `definition` node per definition into `block`'s parent, immediately before
 * `block` itself.
 *
 * Definitions can only ever start a paragraph — they cannot interrupt one —
 * so a single leading pass is exhaustive.
 */
export const extractDefinitions = (block: BlockNode): void => {
	const parent = block.parent;
	if (parent === undefined) {
		return;
	}

	while (block.stringContent.charCodeAt(0) === C_OPEN_BRACKET) {
		const reference = parseReference(block.stringContent);
		if (reference === undefined) {
			return;
		}

		const consumed = block.stringContent.slice(0, reference.length);
		const startOffset = sourceOffsetAt(block.segments, 0, block.startOffset);
		const linesConsumed = (consumed.match(/\n/g) ?? []).length;
		// The node ends at the definition's last content character. The parse
		// consumes trailing whitespace and the line ending to validate the
		// definition, but that consumption is not part of the node's span —
		// mdast-util ends definitions at content end, pinned by the interop
		// corpus.
		const contentLength = consumed.replace(/[ \t\r\n]+$/, "").length;
		const endOffset = sourceOffsetAt(block.segments, contentLength, startOffset);
		const contentLines = (consumed.slice(0, contentLength).match(/\n/g) ?? []).length;

		const node = makeBlockNode("definition", startOffset, block.startLine, block.depth);
		node.parent = parent;
		node.open = false;
		node.endOffset = endOffset;
		node.endLine = block.startLine + contentLines;
		node.data.definition = {
			key: reference.key,
			identifier: reference.identifier,
			label: reference.label,
			url: reference.url,
			...O.getSomesStruct({ title: O.fromUndefinedOr(reference.title) }),
		};

		const at = parent.children.indexOf(block);
		parent.children.splice(at === -1 ? parent.children.length : at, 0, node);

		// Advance the paragraph past what the definition took with it.
		const remaining = sliceWithSegments(block.segments, reference.length, block.stringContent.length);
		block.stringContent = block.stringContent.slice(reference.length);
		block.segments.splice(0, block.segments.length, ...remaining);
		block.startLine += linesConsumed;
		block.startOffset = remaining[0]?.sourceOffset ?? endOffset;
	}
};

/**
 * Definition: a node with no block start of its own — {@link extractDefinitions}
 * is the only thing that ever creates one, already closed.
 */
export const definitionConstruct: BlockConstruct = {
	type: "definition",
	acceptsLines: false,
	canContain: () => false,
	continue: () => 1,
	materialize: (block, _children, context) => {
		const definition = block.data.definition;
		if (definition === undefined) {
			return undefined;
		}
		return Definition.make({
			identifier: definition.identifier,
			label: definition.label,
			url: definition.url,
			position: context.position(block.startOffset, block.endOffset),
			...O.getSomesStruct({ title: O.fromUndefinedOr(definition.title) }),
		});
	},
};
