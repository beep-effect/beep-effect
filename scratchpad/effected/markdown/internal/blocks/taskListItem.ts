// Ported from cmark-gfm 0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
// Copyright (c) 2014 GitHub, Inc.
// License: BSD-2-Clause (see `.repos/cmark-gfm/COPYING`)
//
// The task-list extension: `extensions/tasklist.c`'s `open_tasklist_item`,
// plus the `_scan_tasklist` scanner generated into
// `extensions/ext_scanners.c`. Upstream has no separate node type for a task
// item — it flags the ITEM it is handed — and neither does this port: the
// start below decorates the list item `listItemStart` just opened, which is
// why there is no construct here and no second copy of the list logic.
//
// Port notes, four things the C decides that are easy to get wrong:
//
// 1. WHERE THE MARKER IS RECOGNIZED. `open_new_blocks` reaches the extension
//    hook only in its final `else` — after every CommonMark start has
//    declined the line — and passes `input->data`, the WHOLE LINE, which
//    `scan_tasklist` then scans from index 0. The scanner's grammar therefore
//    spans the list marker as well as the checkbox
//    (`spacechar* ("-"|"+"|"*"|[0-9]+.) spacechar+ "[" [ xX] "]" spacechar+`),
//    and a line whose bullet is not the first thing on it can never match. A
//    `>` prefix or a second marker (`- - [x] foo`) both defeat it. Preserved.
// 2. STOPPING. The hook returns NULL and `open_new_blocks` breaks on a NULL
//    container, so no further block start is tried on that line: `- [x] # foo`
//    is a paragraph reading `# foo`, not a heading. That is verdict `2` here.
//    `add_text_to_container` then re-runs `S_find_first_nonspace` before it
//    decides anything, which is what the scanner refresh below reproduces.
// 3. THE CHECKED STATE. Upstream reads it with `strstr` over the whole line,
//    not from the bytes it matched, so a later `[x]` anywhere on the line
//    checks the box. An upstream quirk, reproduced deliberately — the
//    reference implementation is this package's contract, and the unit tests
//    pin it as such.
// 4. THE MARKER'S SOURCE. It is source text that produces no output, so it is
//    consumed at scan time (`cmark_parser_advance_offset(parser, input, 3)`)
//    BEFORE the item's content is ever appended. The segment table therefore
//    never sees it and no offset needs fixing up afterwards.

import type { BlockNode, BlockStart } from "../blockTypes.ts";

/**
 * `_scan_tasklist`, as the generated scanner accepts it.
 *
 * Two deliberate differences from the `ext_scanners.re` SOURCE rule, which is
 * stale next to the C it generated: the bracket admits `X` as well as `x`, and
 * `spacechar` is `[ \t\v\f]` — a line terminator does not end the marker, so
 * `- [x]` alone is not a task item.
 */
const reTaskListMarker = /^[ \t\v\f]*(?:[-+*]|\d+[^\n])[ \t\v\f]+\[[ xX]\][ \t\v\f]/;

/** The checkbox is three characters wide; upstream advances exactly that. */
const MARKER_LENGTH = 3;

/** Whether `line` carries a checked marker anywhere — upstream's `strstr` pair. */
const isChecked = (line: string): boolean => line.includes("[x]") || line.includes("[X]");

/**
 * The GFM task-list block start: a `[ ]`, `[x]` or `[X]` checkbox opening a
 * list item's content.
 *
 * Registered in the `gfm` dialect only, immediately after the CommonMark
 * starts, which is where cmark-gfm runs its extensions.
 */
export const taskListItemStart: BlockStart = {
	name: "taskListItem",
	trigger: (scanner, container: BlockNode) => {
		// Upstream's `node_type != CMARK_NODE_ITEM` guard: the hook only ever
		// decorates the item the list start opened on this same line.
		if (container.type !== "listItem") {
			return 0;
		}

		if (!reTaskListMarker.test(scanner.currentLine)) {
			return 0;
		}

		container.data.checked = isChecked(scanner.currentLine);

		// Consume the checkbox and settle on the content behind it, exactly as
		// `add_text_to_container`'s `S_find_first_nonspace` would have.
		scanner.advanceOffset(MARKER_LENGTH, false);
		scanner.findNextNonspace();
		scanner.advanceNextNonspace();

		// `2`: the line's block starts are done, upstream's `break`.
		return 2;
	},
};
