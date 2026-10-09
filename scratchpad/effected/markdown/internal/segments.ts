// Source provenance for accumulated leaf content.
//
// The block pass strips container prefixes and expands tabs, so a leaf
// block's content is not a contiguous slice of the source. Each
// `RawInlineSegment` pins one run that is, and these helpers are how the
// inline pass turns an index into that content back into an absolute source
// offset. Characters the engine injects — the `\n` between lines, the spaces
// a partially consumed tab expands to — lie between segments and belong to no
// source range.
//
// Leaf module: imports only the segment type.

import { dual } from "effect/Function";
import type { RawInlineSegment } from "./blockTypes.ts";

/**
 * The absolute source offset of `textIndex` within a segmented content run.
 *
 * An index that falls between segments resolves to the end of the segment
 * before it, which is the closest real source position there is.
 */
export const sourceOffsetAt: {
	(segments: ReadonlyArray<RawInlineSegment>, textIndex: number, fallback: number): number;
	(textIndex: number, fallback: number): (segments: ReadonlyArray<RawInlineSegment>) => number;
} = dual(3, (
	segments: ReadonlyArray<RawInlineSegment>,
	textIndex: number,
	fallback: number,
): number => {
	let offset = fallback;
	for (const segment of segments) {
		if (textIndex < segment.textOffset) {
			return offset;
		}
		if (textIndex < segment.textOffset + segment.length) {
			return segment.sourceOffset + (textIndex - segment.textOffset);
		}
		offset = segment.sourceOffset + segment.length;
	}
	return offset;
});

/**
 * Cut `[from, to)` out of a segmented content run, keeping the provenance of
 * every character that survives.
 */
export const sliceWithSegments: {
	(segments: ReadonlyArray<RawInlineSegment>, from: number, to: number): ReadonlyArray<RawInlineSegment>;
	(from: number, to: number): (segments: ReadonlyArray<RawInlineSegment>) => ReadonlyArray<RawInlineSegment>;
} = dual(3, (
	segments: ReadonlyArray<RawInlineSegment>,
	from: number,
	to: number,
): ReadonlyArray<RawInlineSegment> => {
	const sliced: RawInlineSegment[] = [];
	for (const segment of segments) {
		const start = Math.max(segment.textOffset, from);
		const end = Math.min(segment.textOffset + segment.length, to);
		if (end > start) {
			sliced.push({
				textOffset: start - from,
				sourceOffset: segment.sourceOffset + (start - segment.textOffset),
				length: end - start,
			});
		}
	}
	return sliced;
});
