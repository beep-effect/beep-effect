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
 * **Details**
 *
 * An index that falls between segments resolves to the end of the segment
 * before it, which is the closest real source position there is.
 *
 * **Example** (Resolve real and injected positions)
 *
 * ```ts
 * import { sourceOffsetAt } from "@beep/scratchpad/effected/markdown/internal/segments";
 *
 * const segments = [
 *   { textOffset: 0, sourceOffset: 10, length: 3 },
 *   { textOffset: 4, sourceOffset: 20, length: 2 }
 * ];
 * console.log(sourceOffsetAt(segments, 2, 0)) // 12
 * console.log(sourceOffsetAt(3, 0)(segments)) // 13
 * console.log(sourceOffsetAt([], 2, 99)) // 99
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sourceOffsetAt: {
	(segments: ReadonlyArray<RawInlineSegment>, textIndex: number, fallback: number): number;
	(textIndex: number, fallback: number): (segments: ReadonlyArray<RawInlineSegment>) => number;
} = dual(3, (
	segments: ReadonlyArray<RawInlineSegment>,
	textIndex: number,
	fallback: number,
): number => {
	let low = 0;
	let high = segments.length;
	while (low < high) {
		const mid = Math.floor((low + high) / 2);
		const segment = segments[mid];
		// Use the same comparison as the forward scan, including its NaN
		// behavior: an unordered index advances to the final segment end.
		if (segment !== undefined && !(textIndex < segment.textOffset)) {
			low = mid + 1;
		} else {
			high = mid;
		}
	}
	const segment = segments[low - 1];
	if (segment === undefined) return fallback;
	return textIndex < segment.textOffset + segment.length
		? segment.sourceOffset + (textIndex - segment.textOffset)
		: segment.sourceOffset + segment.length;
});

/**
 * Cut `[from, to)` out of a segmented content run, keeping the provenance of
 * every character that survives.
 *
 * **Example** (Retain provenance across a slice)
 *
 * ```ts
 * import { sliceWithSegments } from "@beep/scratchpad/effected/markdown/internal/segments";
 *
 * const segments = [{ textOffset: 0, sourceOffset: 10, length: 4 }];
 * const sliced = sliceWithSegments(1, 3)(segments);
 * console.log(JSON.stringify(sliced)) // [{"textOffset":0,"sourceOffset":11,"length":2}]
 * ```
 *
 * @category utilities
 * @since 0.0.0
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
