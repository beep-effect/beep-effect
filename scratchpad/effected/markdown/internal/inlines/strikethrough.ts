// Ported from cmark-gfm@0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
// Copyright (c) 2014, John MacFarlane; Copyright (c) 2015, GitHub, Inc.
// License: BSD-2-Clause
//
// `extensions/strikethrough.c`: GFM strikethrough, as a delimiter-stack
// construct. Both halves live here — `match`, which measures a `~` run and
// pushes it, and `insert`, which pairs two runs into a `delete` node — because
// the parser's `processEmphasis` calls the second one the way upstream's
// `process_emphasis` calls `insert_inline_from_delim`.
//
// Three rules carry the whole construct:
//
// 1. Only runs of ONE or TWO tildes are pushed. Upstream's `match` gates the
//    push on `delims == 2 || delims == 1`, so `~~~foo~~~` has no delimiters at
//    all and stays literal — it is not a long run failing to pair, it never
//    became a candidate.
// 2. Flanking is emphasis's flanking. Upstream calls the same
//    `scan_delimiters` and uses its two flags directly, which is `*`'s rule,
//    not `_`'s: intraword strikethrough is allowed.
// 3. The two runs must be the SAME LENGTH. Upstream's `insert` compares the
//    two text literals' lengths and bails when they differ — but bails through
//    `done:`, which still drops every delimiter in between, so a mismatched
//    pair is spent rather than retried.
//
// Registered under the `gfm` dialect only.

import { dual } from "effect/Function";
import type { InlineNode } from "../inlineNode.ts";
import { appendChild, insertAfter, makeInlineNode, unlink } from "../inlineNode.ts";
import type { Delimiter, InlineConstruct, InlineScanner } from "../inlineTypes.ts";
import { scanDelims } from "./emphasis.ts";

/** The `~` character code — the construct's only trigger. */
export const C_TILDE = 0x7e;

/**
 * Consume a `~` run as literal text and, when it is a viable one- or
 * two-tilde run, push it onto the shared delimiter stack.
 *
 * The run becomes a text node either way: a `~` that never pairs has to
 * survive as the character it is.
 */
const handleTilde = (scanner: InlineScanner): boolean => {
	const res = scanDelims(scanner, C_TILDE);
	if (res === undefined) {
		return false;
	}

	const startpos = scanner.pos;
	scanner.pos += res.numdelims;
	const node = scanner.appendText(scanner.subject.slice(startpos, scanner.pos), startpos, scanner.pos);

	if ((res.canOpen || res.canClose) && (res.numdelims === 1 || res.numdelims === 2)) {
		const delimiter: Delimiter = {
			cc: C_TILDE,
			numdelims: res.numdelims,
			origdelims: res.numdelims,
			node,
			previous: scanner.delimiters,
			next: undefined,
			canOpen: res.canOpen,
			canClose: res.canClose,
		};
		if (delimiter.previous !== undefined) {
			delimiter.previous.next = delimiter;
		}
		scanner.delimiters = delimiter;
	}

	return true;
};

/**
 * Pair `opener` with `closer` into a `delete` node — upstream's `insert`.
 *
 * Returns the delimiter the caller's loop continues from, which upstream
 * captures as `closer->next` BEFORE it starts unlinking, so both the matched
 * and the mismatched path resume at the same place.
 */
export const insertStrikethrough: {
	(scanner: InlineScanner, opener: Delimiter, closer: Delimiter): Delimiter | undefined;
	(opener: Delimiter, closer: Delimiter): (scanner: InlineScanner) => Delimiter | undefined;
} = dual(3, (
	scanner: InlineScanner,
	opener: Delimiter,
	closer: Delimiter,
): Delimiter | undefined => {
	const resume = closer.next;
	const openerNode = opener.node;
	const closerNode = closer.node;

	if (openerNode.value.length === closerNode.value.length) {
		// Every tilde on both sides is spent, unlike emphasis, which may leave
		// a run partially unused.
		const delims = openerNode.value.length;
		openerNode.value = "";
		openerNode.end -= delims;
		closerNode.value = "";
		closerNode.start += delims;

		const strikethrough: InlineNode = makeInlineNode("delete", openerNode.end, closerNode.start);

		let between = openerNode.next;
		while (between !== undefined && between !== closerNode) {
			const following = between.next;
			appendChild(strikethrough, between);
			between = following;
		}

		insertAfter(openerNode, strikethrough);
		unlink(openerNode);
		unlink(closerNode);
	}

	// Upstream's `done:` label: matched or not, every delimiter from the
	// closer back through the opener is removed.
	let delimiter: Delimiter | undefined = closer;
	while (delimiter !== undefined && delimiter !== opener) {
		const previous: Delimiter | undefined = delimiter.previous;
		scanner.removeDelimiter(delimiter);
		delimiter = previous;
	}
	scanner.removeDelimiter(opener);

	return resume;
});

/** GFM strikethrough: `~foo~` and `~~foo~~`. */
export const strikethroughConstruct: InlineConstruct = {
	name: "strikethrough",
	triggers: [C_TILDE],
	parse: (scanner) => handleTilde(scanner),
};
