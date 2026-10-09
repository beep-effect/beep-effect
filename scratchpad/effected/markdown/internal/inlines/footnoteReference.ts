// Ported from cmark-gfm 0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
// Copyright (c) 2014 GitHub Inc.
// License: BSD-style (see the cmark-gfm COPYING file)
//
// The GFM footnote REFERENCE: `[^label]` in running text.
//
// Upstream sources: the formation branch under `handle_close_bracket`'s
// `noMatch` label in `src/inlines.c`, and the `process_footnotes` post-pass in
// `src/blocks.c` that decides what each formed node becomes.
//
// WHERE IT HOOKS, and why. A footnote reference is not a construct on the `[`
// or the `]` of its own. cmark-gfm reaches it only after `handle_close_bracket`
// has tried an inline link, a full reference, a collapsed reference and a
// shortcut reference and every one has failed — so `[^a](/url)` is a link, and
// `[^a][ref]` with a matching `[ref]:` is a link reference, both beating the
// footnote. Registering a separate construct on `]` could not reproduce that:
// the close-bracket construct always claims the character (a `]` that closes
// nothing is still literal text it emits), so anything after it in the trigger
// table is unreachable, and anything before it would beat the link shapes it
// must lose to. Hence the `LinkCloseFallback` seam in `link.ts` — the same
// branch point, in the same place, without a `gfm` copy of the link handler.
//
// THE ONE PORT DELTA, and why it is not observable. Upstream forms the
// reference node UNCONDITIONALLY here and only later, in `process_footnotes`,
// looks the label up: a hit renumbers the node, and a MISS deletes it and
// inserts a plain text node spelling `[^` + the raw label + `]` in its place.
// This port consults the label index at formation time instead, because the
// block pass has already built it over the whole document — which is exactly
// the tree `process_footnotes` walks — so both branches reach the same answer
// one pass earlier. Both branches are reproduced faithfully, including the
// destructive half of the miss: upstream's replacement text is rebuilt from
// the RAW source span between the brackets, so any inline structure already
// parsed inside an unmatched reference is discarded rather than kept.

import { insertAfter, makeInlineNode, unlink } from "../inlineNode.ts";
import { normalizeLabelText } from "../references.ts";
import type { LinkCloseFallback } from "./link.ts";
import { makeImageOpenConstruct, makeLinkCloseConstruct } from "./link.ts";

const C_CARET = 0x5e;

/**
 * Whether the bracket that just closed looks like `[^...]` with something
 * between the caret and the `]`.
 *
 * Upstream tests the node list — the node after the opener must be TEXT whose
 * literal starts with `^`, and there must be more content than that caret
 * alone (`literal->len > 1 || opener->inl_text->next->next`). Read off the
 * subject the two tests are the same: `^` triggers no construct, so it always
 * lands in a text node, and "more content" is precisely "the `]` is not the
 * next character".
 */
const looksLikeFootnote = (subject: string, openerIndex: number, bracketPos: number): boolean =>
	subject.charCodeAt(openerIndex + 1) === C_CARET && bracketPos > openerIndex + 2;

/**
 * cmark-gfm's footnote branch: form a reference, or leave the whole span as
 * the literal text upstream's post-pass would have rewritten it to.
 */
export const footnoteReferenceFallback: LinkCloseFallback = (scanner, opener, bracketPos, afterBracket) => {
	if (!looksLikeFootnote(scanner.subject, opener.index, bracketPos)) {
		return false;
	}

	// `handle_close_bracket` may have run ahead looking for a link label;
	// upstream rewinds with `subj->pos = initial_pos` before it builds
	// anything, and so does this.
	scanner.pos = afterBracket;

	// The label is the raw source between `[^` and `]`, taken verbatim — NOT
	// the text of the nodes parsed inside, which upstream throws away.
	const rawLabel = scanner.subject.slice(opener.index + 2, bracketPos);
	const key = normalizeLabelText(rawLabel);
	const matched = key !== "" && scanner.footnoteLabels.has(key);

	// Emphasis inside the brackets is spent before the span closes either way,
	// so its delimiters cannot pair with anything outside it. Upstream calls
	// `process_emphasis` here for the same reason, immediately before it frees
	// the nodes that pairing produced.
	scanner.processEmphasis(opener.previousDelimiter);

	const start = opener.node.start;
	const node = matched
		? makeInlineNode("footnoteReference", start, scanner.pos)
		: makeInlineNode("text", start, scanner.pos, `[^${rawLabel}]`);

	if (matched) {
		node.data.identifier = key.toLowerCase();
		node.data.label = rawLabel;
	}

	// Replace the opener and everything the brackets enclosed with the one
	// node — upstream's `insert_before` then free-the-rest walk.
	insertAfter(opener.node, node);
	let child = node.next;
	while (child !== undefined) {
		const following = child.next;
		unlink(child);
		child = following;
	}
	scanner.removeBracket();
	unlink(opener.node);

	return true;
};

/**
 * The `]` construct for the `gfm` dialect: CommonMark's, with the footnote
 * branch wired into its no-match seam.
 */
export const gfmLinkCloseConstruct = makeLinkCloseConstruct(footnoteReferenceFallback);

/**
 * The `!` construct for the `gfm` dialect: CommonMark's, refusing to open an
 * image on `![^` so the caret can reach the footnote branch.
 *
 * `makeImageOpenConstruct` carries the reason; it is a footnote rule living on
 * the bang, which is why it is re-exported from here rather than left to look
 * like a link concern.
 */
export const gfmImageOpenConstruct = makeImageOpenConstruct(false);
