import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import type { AlignedSegment } from "../LocatorMap.ts";
import type { Position } from "../OffsetUnit.ts";

/** One side of a segment: the range in the earlier text or the range in the later one. */
export type Side = (segment: AlignedSegment) => Position;

/** The `from` side of a segment. */
export const fromSide: Side = (segment) => segment.from;

/** The `to` side of a segment. */
export const toSide: Side = (segment) => segment.to;

// decision: native-scan-hot-paths
const firstEndingAfter = (segments: ReadonlyArray<AlignedSegment>, side: Side, offset: number): number => {
  let low = 0;
  let high = segments.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const end = side(A.getUnsafe(segments, middle)).end;
    if (end > offset) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  return low;
};

/** The index of the segment whose `side` range holds `offset` as a start: `start <= offset < end`. */
export const segmentStartingAt: {
  (side: Side, offset: number): (segments: ReadonlyArray<AlignedSegment>) => O.Option<number>;
  (segments: ReadonlyArray<AlignedSegment>, side: Side, offset: number): O.Option<number>;
} = dual(3, (segments: ReadonlyArray<AlignedSegment>, side: Side, offset: number): O.Option<number> => {
  const index = firstEndingAfter(segments, side, offset);
  return O.as(
    O.filter(A.get(segments, index), (segment) => side(segment).start <= offset),
    index
  );
});

/**
 * The first and last index of the segments whose `side` ranges cover `[start, end)` without a gap; `None` when some
 * part of the range is outside every segment.
 */
export const coveringSegments: {
  (
    side: Side,
    start: number,
    end: number
  ): (segments: ReadonlyArray<AlignedSegment>) => O.Option<readonly [number, number]>;
  (
    segments: ReadonlyArray<AlignedSegment>,
    side: Side,
    start: number,
    end: number
  ): O.Option<readonly [number, number]>;
} = dual(
  4,
  (
    segments: ReadonlyArray<AlignedSegment>,
    side: Side,
    start: number,
    end: number
  ): O.Option<readonly [number, number]> =>
    O.flatMap(segmentStartingAt(segments, side, start), (first) => {
      let last = first;
      while (side(A.getUnsafe(segments, last)).end < end) {
        const reached = side(A.getUnsafe(segments, last)).end;
        if (!O.exists(A.get(segments, last + 1), (next) => side(next).start === reached)) {
          return O.none();
        }
        last++;
      }
      return O.some([first, last] as const);
    })
);
