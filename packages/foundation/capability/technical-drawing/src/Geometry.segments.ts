/**
 * Canonical forms of projected segments, used to compare views.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, N } from "@beep/utils";
import { Order, pipe } from "effect";
import type { Segment2 } from "./Geometry.schemas.ts";

const round = (value: number): number => {
  const rounded = N.round(3)(value);
  return rounded === 0 ? 0 : rounded;
};

const segmentOrder = Order.combineAll([
  Order.mapInput(Order.Number, (s: Segment2) => s[0]),
  Order.mapInput(Order.Number, (s: Segment2) => s[1]),
  Order.mapInput(Order.Number, (s: Segment2) => s[2]),
  Order.mapInput(Order.Number, (s: Segment2) => s[3]),
]);

const normalise = ([x1, y1, x2, y2]: Segment2): Segment2 => {
  const p = [round(x1), round(y1)] as const;
  const q = [round(x2), round(y2)] as const;
  const pFirst = p[0] < q[0] || (p[0] === q[0] && p[1] <= q[1]);
  return pFirst ? [p[0], p[1], q[0], q[1]] : [q[0], q[1], p[0], p[1]];
};

/**
 * Round, direction-normalise, and sort segments so equal geometry compares
 * equal.
 *
 * **Example** (Two orderings of one segment)
 *
 * ```ts
 * import { canonicalSegments } from "@beep/technical-drawing"
 *
 * console.log(canonicalSegments([[5, 0, 0, 0]]), canonicalSegments([[0, 0, 5, 0]]))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const canonicalSegments = (segments: ReadonlyArray<Segment2>): ReadonlyArray<Segment2> =>
  pipe(segments, A.map(normalise), A.sort(segmentOrder));

/**
 * Mirror segments left–right about the view's own centre line, canonicalised.
 *
 * **Details**
 *
 * Mirroring about the view centre rather than `x = 0` makes the comparison
 * independent of where the engine placed the view-plane origin.
 *
 * **Example** (Mirror a segment)
 *
 * ```ts
 * import { mirrorSegments } from "@beep/technical-drawing"
 *
 * console.log(mirrorSegments([[0, 0, 4, 0], [4, 0, 4, 2]]))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const mirrorSegments = (segments: ReadonlyArray<Segment2>): ReadonlyArray<Segment2> => {
  const xs = pipe(
    segments,
    A.flatMap((s) => [s[0], s[2]])
  );
  const centre = A.length(xs) === 0 ? 0 : (Math.min(...xs) + Math.max(...xs)) / 2;
  return canonicalSegments(
    pipe(
      segments,
      A.map(([x1, y1, x2, y2]): Segment2 => [2 * centre - x1, y1, 2 * centre - x2, y2])
    )
  );
};

/**
 * Whether two canonicalised segment lists are equal.
 *
 * **Example** (Compare a view with itself)
 *
 * ```ts
 * import { sameSegments } from "@beep/technical-drawing"
 *
 * console.log(sameSegments({ left: [[0, 0, 1, 1]], right: [[1, 1, 0, 0]] }))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sameSegments = (input: {
  readonly left: ReadonlyArray<Segment2>;
  readonly right: ReadonlyArray<Segment2>;
}): boolean => {
  const a = canonicalSegments(input.left);
  const b = canonicalSegments(input.right);
  return (
    A.length(a) === A.length(b) &&
    A.every(A.zip(a, b), ([s, t]) => s[0] === t[0] && s[1] === t[1] && s[2] === t[2] && s[3] === t[3])
  );
};
