// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `parseString`: the fallback that consumes a run of ordinary characters.
// Upstream's smart-punctuation branch is deliberately not ported (the `smart`
// option is not offered).

import type { InlineConstruct } from "../inlineTypes.ts";

// Every character that can start some other construct, so a text run stops
// before it. `'` and `"` are in the set because upstream's smart punctuation
// triggers on them; without smart punctuation they simply fall through to the
// single-character fallback, which is the same result.
//
// Upstream carries an `m` flag here, which is inert for it: its `switch`
// reaches `parseString` only when the character at the cursor is outside this
// set, so `^` always matches at the cursor. This parser tries the text
// construct for every character no construct claimed, including the excluded
// ones — and under `m`, `^` would then match at the NEXT line start and the
// run in between would be skipped. The flag is dropped, and `match` requires
// the match to sit at the cursor besides.
const reMain = /^[^\n`[\]\\!<&*_'"]+/;

// The GFM exclusion set, three characters wider. `~` is strikethrough's
// delimiter; `w` and `:` are the autolink-literal triggers, and they are here
// for the same reason every other character in the set is — a text run that
// swallowed them would consume the construct before it was ever dispatched.
// cmark-gfm spells this as `special_inline_chars` on each extension, which its
// `parse_inline` adds to the same set.
//
// Excluding a letter as common as `w` looks expensive and is not: a run simply
// ends there and the next one begins, and `inlineParser`'s materialization
// coalesces adjacent text nodes into one anyway.
const reMainGfm = /^[^\n`[\]\\!<&*_'"~w:]+/;

/** Consume a run of ordinary characters, stopping before any construct's. */
const runConstruct = (name: string, pattern: RegExp): InlineConstruct => ({
	name,
	triggers: [],
	parse: (scanner) => {
		const from = scanner.pos;
		const matched = scanner.match(pattern);
		if (matched === undefined) {
			return false;
		}
		scanner.appendText(matched, from, scanner.pos);
		return true;
	},
});

/** Ordinary text: the fallback construct, with no trigger of its own. */
export const textConstruct: InlineConstruct = runConstruct("text", reMain);

/** Ordinary text under `gfm`, which has three more characters to yield to. */
export const gfmTextConstruct: InlineConstruct = runConstruct("text", reMainGfm);
