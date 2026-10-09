// The leaf-block content seam between the block pass and the inline pass.
//
// commonmark.js hands `block._string_content.trim()` straight to its inline
// parser and lets inline nodes inherit the leaf's sourcepos. This port trims
// with the source provenance attached (`segments.ts`), so the inline pass can
// give every node it builds an absolute position in the original document.

import type * as HashMap from "effect/HashMap";
import { dual } from "effect/Function";
import type * as HashSet from "effect/HashSet";
import * as P from "effect/Predicate";
import type { Definition, PhrasingContent, Position } from "../MarkdownNode.ts";
import type { BlockNode, PreparedInline, RawInlineSegment } from "./blockTypes.ts";
import { parseInlines } from "./inlineParser.ts";
import type { InlineDialectName } from "./inlineRegistry.ts";

/** Builds the `Position` for an absolute source range. */
type PositionOf = (start: number, end: number) => Position;

// Two trims because two upstreams: commonmark.js hands paragraph content to
// `String.prototype.trim()`, whose JS `\s` strips `\v`, `\f` and unicode
// spaces — the oracle suite pins that parity. cmark-gfm trims table cells
// with `cmark_strbuf_trim` over `cmark_isspace`, whose space class is exactly
// {space, tab, LF, CR} (`src/cmark_ctype.c`), so a `\v` or `\f` SURVIVES in
// cell content even though the row scanners treat both as spacechars
// (`ext_scanners.re`). The pathological "tables" case pins that survival.
const reWhitespace = /\s/;
const reCmarkSpace = /[ \t\n\r]/;

/**
 * Trim `text` the way commonmark.js does before inline parsing, carrying the
 * segment table along so the surviving characters keep their source offsets.
 * Exported for the phrasing-level parse entry point (`phrasing.ts`), which
 * prepares content the same way a paragraph does.
 */
export const trimWithSegments: {
	(text: string, segments: ReadonlyArray<RawInlineSegment>, whitespace: RegExp): { readonly text: string; readonly segments: ReadonlyArray<RawInlineSegment> };
	(segments: ReadonlyArray<RawInlineSegment>, whitespace: RegExp): (text: string) => { readonly text: string; readonly segments: ReadonlyArray<RawInlineSegment> };
} = dual(3, (
	text: string,
	segments: ReadonlyArray<RawInlineSegment>,
	whitespace: RegExp,
): { readonly text: string; readonly segments: ReadonlyArray<RawInlineSegment> } => {
	let start = 0;
	let end = text.length;
	while (start < end && whitespace.test(text.charAt(start))) {
		start += 1;
	}
	while (end > start && whitespace.test(text.charAt(end - 1))) {
		end -= 1;
	}

	if (start === 0 && end === text.length) {
		return { text, segments };
	}

	const trimmed: RawInlineSegment[] = [];
	for (const segment of segments) {
		const from = Math.max(segment.textOffset, start);
		const to = Math.min(segment.textOffset + segment.length, end);
		if (to > from) {
			trimmed.push({
				textOffset: from - start,
				sourceOffset: segment.sourceOffset + (from - segment.textOffset),
				length: to - from,
			});
		}
	}

	return { text: text.slice(start, end), segments: trimmed };
});

/**
 * Prepare a leaf block's accumulated content and run the inline pass over it:
 * trim it, keep its source provenance, and parse it into phrasing content.
 */
export const prepareInline: {
	(block: BlockNode, position: PositionOf, refmap: HashMap.HashMap<string, Definition>, dialect?: InlineDialectName, footnoteLabels?: HashSet.HashSet<string>): PreparedInline;
	(position: PositionOf, refmap: HashMap.HashMap<string, Definition>, dialect?: InlineDialectName, footnoteLabels?: HashSet.HashSet<string>): (block: BlockNode) => PreparedInline;
} = dual((args) => !P.isFunction(args[0]), (
	block: BlockNode,
	position: PositionOf,
	refmap: HashMap.HashMap<string, Definition>,
	dialect: InlineDialectName = "commonmark",
	footnoteLabels?: HashSet.HashSet<string>,
): PreparedInline => {
	const { text, segments } = trimWithSegments(
		block.stringContent,
		block.segments,
		block.type === "tableCell" ? reCmarkSpace : reWhitespace,
	);
	const first = segments[0];
	const last = segments[segments.length - 1];
	const startOffset = first === undefined ? block.startOffset : first.sourceOffset;
	const endOffset = last === undefined ? startOffset : last.sourceOffset + last.length;

	const children: ReadonlyArray<PhrasingContent> =
		text.length === 0 ? [] : parseInlines({ text, startOffset, segments }, refmap, position, dialect, footnoteLabels);

	return { text, startOffset, endOffset, segments, children };
});
