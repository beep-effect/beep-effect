// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `lib/common.js` `unescapeString`: resolve backslash escapes and character
// references into the literal characters they stand for. Used by link
// destinations, link titles and fenced-code info strings.

import { decodeEntity } from "./entities.ts";

/** The punctuation set a backslash may escape, per the spec. */
export const ESCAPABLE = "[!\"#$%&'()*+,./:;<=>?@[\\\\\\]^_`{|}~-]";

/** One entity, in any of the three spec forms. */
export const ENTITY = "&(?:#x[a-f0-9]{1,6}|#[0-9]{1,7}|[a-z][a-z0-9]{1,31});";

const reBackslashOrAmp = /[\\&]/;
const reEntityOrEscapedChar = new RegExp(`\\\\${ESCAPABLE}|${ENTITY}`, "gi");

const unescapeChar = (source: string): string => {
	if (source.charCodeAt(0) === 0x5c) {
		return source.charAt(1);
	}
	// An entity this engine cannot decode yet stays literal (see entities.ts).
	return decodeEntity(source) ?? source;
};

/** Replace every backslash escape and character reference with its literal. */
export const unescapeString = (source: string): string =>
	reBackslashOrAmp.test(source) ? source.replace(reEntityOrEscapedChar, unescapeChar) : source;
