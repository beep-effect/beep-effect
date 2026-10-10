// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// `parseEntity`: a character reference in any of the three spec forms decodes
// to the character it names. A reference this engine cannot resolve is left
// as the literal source text, which is upstream's behavior too — its
// `decodeHTMLStrict` returns the input unchanged for an unknown name.

import { decodeEntity } from "../entities.ts";
import type { InlineConstruct } from "../inlineTypes.ts";
import { ENTITY } from "../unescape.ts";

const C_AMPERSAND = 0x26;

const reEntityHere = new RegExp(`^${ENTITY}`, "i");

/**
 * Decodes a named, decimal or hexadecimal character reference.
 *
 * **Details**
 *
 * **Example** (Register the character reference trigger)
 *
 * ```ts
 * import { entityConstruct } from "@beep/scratchpad/effected/markdown/internal/inlines/entity"
 *
 * console.log(entityConstruct.triggers.map((code) => String.fromCharCode(code)).join("")) // &
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const entityConstruct: InlineConstruct = {
	name: "entity",
	triggers: [C_AMPERSAND],
	parse: (scanner) => {
		const from = scanner.pos;
		const matched = scanner.match(reEntityHere);
		if (matched === undefined) {
			return false;
		}
		scanner.appendText(decodeEntity(matched) ?? matched, from, scanner.pos);
		return true;
	},
};
