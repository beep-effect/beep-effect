// The phrasing-level parse: a text fragment prepared and inline-parsed
// exactly the way the block pass prepares a paragraph's content, without
// running the block pass at all.
//
// The whole input is treated as ONE paragraph's inline content: lines are
// preprocessed (terminators stripped, U+0000 replaced) and joined with `\n`,
// the commonmark.js paragraph trim applies, and the inline pass runs over the
// result with full source provenance — so every node's position is correct
// relative to the input string. Blank lines do NOT open a new block; they
// survive as literal newlines in text content, which is the documented
// contract for this surface.
//
// No reference context exists at phrasing level: the reference map and the
// footnote-label set are empty, so `[foo]`, `![foo]` and `[^foo]` stay
// literal text unless spelled as inline links/images — the same result a full
// parse of the fragment in isolation produces, since the fragment carries no
// definitions.
//
// Throws the raw `GuardExceeded` carrier on a hardening trip (the inline
// pass's delimiter/bracket stacks); the facade materializes the typed error.

import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import type { Definition, PhrasingContent, Position } from "../MarkdownNode.ts";
import { Point, Position as PositionClass } from "../MarkdownNode.ts";
import type { RawInlineSegment } from "./blockTypes.ts";
import { parseInlines } from "./inlineParser.ts";
import type { InlineDialectName } from "./inlineRegistry.ts";
import { LineIndex } from "./lineIndex.ts";
import { preprocessLines } from "./preprocess.ts";
import { trimWithSegments } from "./rawInline.ts";

const emptyDefinitions = HashMap.empty<string, Definition>();
const EMPTY_REFMAP: ReadonlyMap<string, Definition> = {
	size: HashMap.size(emptyDefinitions),
	get: (key) => O.getOrUndefined(HashMap.get(emptyDefinitions, key)),
	has: (key) => HashMap.has(emptyDefinitions, key),
	*keys() { yield* HashMap.keys(emptyDefinitions); return undefined; },
	*values() { yield* HashMap.values(emptyDefinitions); return undefined; },
	*entries() { yield* HashMap.entries(emptyDefinitions); return undefined; },
	[Symbol.iterator]() { return this.entries(); },
	forEach(callback, thisArg) {
		HashMap.forEach(emptyDefinitions, (value, key) => callback.call(thisArg, value, key, this));
	},
};

/**
 * Parse a text fragment as a single paragraph's inline content.
 */
export const parsePhrasingText: {
	(text: string, dialect: InlineDialectName): ReadonlyArray<PhrasingContent>;
	(dialect: InlineDialectName): (text: string) => ReadonlyArray<PhrasingContent>;
} = dual(2, (text: string, dialect: InlineDialectName): ReadonlyArray<PhrasingContent> => {
	const lines = preprocessLines(text);
	const segments: RawInlineSegment[] = [];
	let content = "";
	for (const line of lines) {
		segments.push({ textOffset: content.length, sourceOffset: line.start, length: line.text.length });
		content += `${line.text}\n`;
	}

	const trimmed = trimWithSegments(content, segments, /\s/);
	if (trimmed.text.length === 0) {
		return [];
	}

	const first = trimmed.segments[0];
	const startOffset = first === undefined ? 0 : first.sourceOffset;

	const lineIndex = LineIndex.fromLineStarts(
		text,
		lines.map((line) => line.start),
	);
	const sourceLength = text.length;
	const positionOf = (start: number, end: number): Position => {
		const clampedStart = Math.min(Math.max(start, 0), sourceLength);
		const clampedEnd = Math.min(Math.max(end, clampedStart), sourceLength);
		const startPoint = lineIndex.positionAt(clampedStart);
		const endPoint = lineIndex.positionAt(clampedEnd);
		return PositionClass.make({
			start: Point.make({ line: startPoint.line, column: startPoint.column, offset: clampedStart }),
			end: Point.make({ line: endPoint.line, column: endPoint.column, offset: clampedEnd }),
		});
	};

	return parseInlines(
		{ text: trimmed.text, startOffset, segments: trimmed.segments },
		EMPTY_REFMAP,
		positionOf,
		dialect,
	);
});
