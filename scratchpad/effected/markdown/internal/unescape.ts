// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `lib/common.js` `unescapeString`: resolve backslash escapes and character
// references into the literal characters they stand for. Used by link
// destinations, link titles and fenced-code info strings.

import { decodeEntity } from "./entities.ts";

/**
 * Defines the punctuation set a backslash may escape, per the spec.
 *
 * **Details**
 *
 * This is a regular-expression character class, ready to embed in a pattern.
 *
 * **Example** (Match escapable punctuation)
 *
 * ```ts
 * import { ESCAPABLE } from "@beep/scratchpad/effected/markdown/internal/unescape"
 *
 * const punctuation = new RegExp(`^${ESCAPABLE}$`)
 * console.log(punctuation.test("*")) // true
 * console.log(punctuation.test("a")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ESCAPABLE = "[!\"#$%&'()*+,./:;<=>?@[\\\\\\]^_`{|}~-]";

/**
 * Matches one entity, in each of the three spec forms.
 *
 * **Details**
 *
 * This regular-expression source recognizes hexadecimal, decimal and named
 * character references with a terminating semicolon. Use case-insensitive
 * matching to recognize uppercase letters in hexadecimal and named references.
 *
 * **Example** (Recognize the three character-reference forms)
 *
 * ```ts
 * import { ENTITY } from "@beep/scratchpad/effected/markdown/internal/unescape"
 *
 * const entity = new RegExp(`^${ENTITY}$`, "i")
 * console.log(entity.test("&#x41;")) // true
 * console.log(entity.test("&#65;")) // true
 * console.log(entity.test("&amp;")) // true
 * console.log(entity.test("&amp")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
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

/**
 * Replaces every backslash escape and character reference with its literal.
 *
 * **When to use**
 *
 * Use to resolve escapes in link destinations, link titles and fenced-code info strings.
 *
 * **Gotchas**
 *
 * Only punctuation in {@link ESCAPABLE} can be backslash-escaped. A character
 * reference this engine cannot decode stays literal.
 *
 * **Example** (Resolve escapes and preserve unknown references)
 *
 * ```ts
 * import { unescapeString } from "@beep/scratchpad/effected/markdown/internal/unescape"
 *
 * console.log(unescapeString("\\* &amp; &#65; &#x42;")) // * & A B
 * console.log(unescapeString("\\q &unknown;")) // \q &unknown;
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const unescapeString = (source: string): string =>
	reBackslashOrAmp.test(source) ? source.replace(reEntityOrEscapedChar, unescapeChar) : source;
