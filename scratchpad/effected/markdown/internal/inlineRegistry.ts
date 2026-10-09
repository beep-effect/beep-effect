// Ported from commonmark.js@0.31.2 (https://github.com/commonmark/commonmark.js)
// Copyright (c) 2014-2023 John MacFarlane
// License: BSD-2-Clause
//
// Upstream's `parseInline` switch, as a per-dialect trigger table. The switch
// order is preserved where a character has more than one construct: `<` tries
// an autolink before raw HTML, exactly as
// `this.parseAutolink(block) || this.parseHtmlTag(block)` does.
//
// Emphasis registers on `*`/`_` and links on `[`, `]` and `!`. A character with
// no registered construct falls through to the text fallback — whose pattern
// excludes it — and ends up as a literal single character.

import { $ScratchpadId } from "@beep/identity/packages";
import * as HashMap from "effect/HashMap";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { autolinkConstruct } from "./inlines/autolink.ts";
import { linkifyEmails, urlAutolinkConstruct, wwwAutolinkConstruct } from "./inlines/autolinkLiteral.ts";
import { codeSpanConstruct } from "./inlines/codeSpan.ts";
import { emphasisConstruct } from "./inlines/emphasis.ts";
import { entityConstruct } from "./inlines/entity.ts";
import { escapeConstruct } from "./inlines/escape.ts";
import { gfmImageOpenConstruct, gfmLinkCloseConstruct } from "./inlines/footnoteReference.ts";
import { lineBreakConstruct } from "./inlines/lineBreak.ts";
import { imageOpenConstruct, linkCloseConstruct, linkOpenConstruct } from "./inlines/link.ts";
import { rawHtmlConstruct } from "./inlines/rawHtml.ts";
import { strikethroughConstruct } from "./inlines/strikethrough.ts";
import { gfmTextConstruct, textConstruct } from "./inlines/text.ts";
import type { InlineConstruct, InlineDialect } from "./inlineTypes.ts";

const $I = $ScratchpadId.create("effected/markdown/internal/inlineRegistry");

class UnknownInlineDialectError extends S.TaggedError<UnknownInlineDialectError>($I`UnknownInlineDialectError`)("UnknownInlineDialectError", {
	message: S.String,
}) {}

/** The dialects the inline pass can be keyed by. */
export type InlineDialectName = "commonmark" | "gfm";

const triggerTable = (
	constructs: ReadonlyArray<InlineConstruct>,
): ReadonlyMap<number, ReadonlyArray<InlineConstruct>> => {
	const table = MutableHashMap.empty<number, InlineConstruct[]>();
	const entries: Array<[number, InlineConstruct[]]> = [];
	for (const construct of constructs) {
		for (const trigger of construct.triggers) {
			const bucket = O.getOrUndefined(MutableHashMap.get(table, trigger));
			if (bucket === undefined) {
				const made = [construct];
				MutableHashMap.set(table, trigger, made);
				entries.push([trigger, made]);
			} else {
				bucket.push(construct);
			}
		}
	}
	// Keep the scanner's ReadonlyMap boundary and trigger insertion order.
	return {
		size: MutableHashMap.size(table),
		get: (key) => O.getOrUndefined(MutableHashMap.get(table, key)),
		has: (key) => MutableHashMap.has(table, key),
		*keys() { for (const [key] of entries) yield key; return undefined; },
		*values() { for (const [, value] of entries) yield value; return undefined; },
		*entries() { for (const [key, value] of entries) yield [key, value]; return undefined; },
		[Symbol.iterator]() { return this.entries(); },
		forEach(callback, thisArg) {
			for (const [key, value] of entries) callback.call(thisArg, value, key, this);
		},
	};
};

/** The CommonMark construct set, which every dialect starts from. */
const COMMONMARK_CONSTRUCTS: ReadonlyArray<InlineConstruct> = [
	lineBreakConstruct,
	escapeConstruct,
	codeSpanConstruct,
	emphasisConstruct,
	linkOpenConstruct,
	imageOpenConstruct,
	linkCloseConstruct,
	autolinkConstruct,
	rawHtmlConstruct,
	entityConstruct,
];

const commonmarkDialect: InlineDialect = {
	byTrigger: triggerTable(COMMONMARK_CONSTRUCTS),
	text: textConstruct,
	postprocess: [],
};

// GFM: the CommonMark set plus strikethrough and the two literal-autolink
// matchers, with the email half as a postprocess pass (`autolinkLiteral.ts`
// carries the reason for the split). The additions are appended, so a
// character CommonMark already claims keeps its existing precedence.
//
// Footnote references are the exception to "additions are appended", because
// they are not an addition to any trigger table — they are two branches inside
// constructs CommonMark already owns, so both are SWAPPED for the variants
// carrying them:
//
//   `]` — the footnote branch sits inside the close-bracket handler, reached
//   only once every link shape has failed. A construct registered AFTER the
//   close-bracket one could never run (it claims every `]`), and one before it
//   would beat the links a footnote must lose to.
//
//   `!` — cmark-gfm's bang handler refuses to open an image on `![^`, which is
//   what keeps the `!` in `text![^1]` literal and lets the bracket reach the
//   footnote branch as an ordinary opener.
//
// `inlines/footnoteReference.ts` and `makeImageOpenConstruct` carry the
// reasoning for each.
const gfmDialect: InlineDialect = {
	byTrigger: triggerTable([
		...COMMONMARK_CONSTRUCTS.filter(
			(construct) => construct !== linkCloseConstruct && construct !== imageOpenConstruct,
		),
		gfmLinkCloseConstruct,
		gfmImageOpenConstruct,
		strikethroughConstruct,
		wwwAutolinkConstruct,
		urlAutolinkConstruct,
	]),
	text: gfmTextConstruct,
	postprocess: [linkifyEmails],
};

const dialects = HashMap.fromIterable<InlineDialectName, InlineDialect>([
	["commonmark", commonmarkDialect],
	["gfm", gfmDialect],
]);

/**
 * The inline tables for `dialect`.
 *
 * An unknown dialect cannot arrive through the schema-typed public surface,
 * so it is programmer error and dies as a defect.
 */
export const inlineDialect = (dialect: InlineDialectName): InlineDialect => {
	const found = O.getOrUndefined(HashMap.get(dialects, dialect));
	if (found === undefined) {
		throw UnknownInlineDialectError.make({ message: `unknown markdown dialect: ${String(dialect)}` });
	}
	return found;
};
