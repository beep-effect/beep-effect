// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// Port notes: upstream's `document` finalize runs
// `removeLinkReferenceDefinitions`, a whole-tree walk that strips definitions
// out. This package keeps definitions as nodes and splits them out as each paragraph closes
// (`linkReferenceDefinition.ts`), so this construct's finalize is a no-op.

import { Root } from "../../MarkdownNode.ts";
import type { BlockConstruct } from "../blockTypes.ts";

/**
 * Materializes the document root, containing everything except a bare list item.
 *
 * **Example** (Inspect root containment)
 *
 * ```ts
 * import { documentConstruct } from "@beep/scratchpad/effected/markdown/internal/blocks/document";
 *
 * console.log(documentConstruct.canContain("blockquote")); // true
 * console.log(documentConstruct.canContain("listItem")); // false
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const documentConstruct: BlockConstruct = {
	type: "document",
	acceptsLines: false,
	canContain: (child) => child !== "listItem",
	continue: () => 0,
	materialize: (block, children, context) =>
		Root.make({ children, position: context.position(block.startOffset, block.endOffset) }),
};
