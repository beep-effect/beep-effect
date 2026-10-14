/**
 * Pure 37 CFR 1.84(m) surface-shading rules: classify a planar face, band its
 * exposure, find its shadow edge, and decide the section planes that cut it
 * into shading lines.
 *
 * **Details**
 *
 * The default plan (`uniform` style, `longest-edge` axis, no minimum face
 * span) reproduces the original procedural hatch exactly: faces above the lit
 * threshold stay blank, lines run along the longest straight edge, and the
 * pitch grows with exposure. The opt-in `graded` style shades every visible
 * planar face: the first line sits one minimum pitch from the shadow edge and
 * the gaps grow geometrically toward the lit side, as in the USPTO Guide's
 * spaced-line examples. The opt-in `surface-class` axis hatches walls along
 * +Z and inclined and level faces along the major edge turned away from the
 * light, so a wall reads the same way in every view and a flap or lid bunches
 * its band on its darkest edge.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O } from "@beep/utils";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import { HatchAxis, ShadingCoverage, ShadingSkip, ShadingSkipReason } from "./Geometry.schemas.ts";
import {
  FaceAnchor,
  FaceTreatment,
  ShadingCut,
  ShadingLines,
  ShadingSkipped,
  ShadingTone,
  SurfaceClass,
  ViewFacts,
} from "./Shading.schemas.ts";
import type { Camera, Segment2, ShadingPlan, Vec3 } from "./Geometry.schemas.ts";
import type { FaceAspect, FaceEdge, FaceFacts, ShadingWindow } from "./Shading.schemas.ts";

type V3 = Vec3;

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crossOf = ([ax, ay, az]: V3, [bx, by, bz]: V3): V3 => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
const plus = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const times = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const unitOf = (a: V3): V3 => times(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const minus = (a: V3, b: V3): V3 => plus(a, times(b, -1));

const MODEL_UP: V3 = [0, 0, 1];
const MODEL_X: V3 = [1, 0, 0];
// One degree either side decides level, upright, and square-on.
const ANGLE_TOLERANCE = Math.sin(Math.PI / 180);
const COS_TOLERANCE = Math.cos(Math.PI / 180);
// Below this fraction of a step surviving on the sheet, a face is nearly
// edge-on to its hatch step and lines would merge however far apart they are
// on the model.
const MIN_SPREAD = 0.2;
const BACK_FACING = 1e-9;
// Below this share of the light along a face's step the face is lit edge-on
// to its lines and the shadow side is read from the sheet instead (the lower
// right): a wall the sheet light runs straight across in an isometric would
// otherwise flip sides on rounding.
const EDGE_ON_LIGHT = 0.2;
// Graded gaps grow by this factor from the shadow edge toward the lit side.
const GROWTH = 1.4;
// Graded strokes: this many full-length lines at the shadow edge, then a taper.
const FULL_LINES = 2;
const TAPER_FROM = 0.6;
const TAPER_TO = 0.4;

/**
 * Sheet frame and 1.84(m) light of a camera, in model coordinates.
 *
 * **Example** (The front elevation's light)
 *
 * ```ts
 * import { Camera } from "@beep/technical-drawing"
 * import { viewFactsOf } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(viewFactsOf(Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] })).light)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const viewFactsOf = (camera: Camera): ViewFacts => {
  const eye = unitOf(camera.eye);
  const right = unitOf(crossOf(unitOf(camera.up), eye));
  const up = crossOf(eye, right);
  return ViewFacts.make({ eye, right, up, light: unitOf(plus(plus(times(right, -1), up), eye)) });
};

/**
 * Orientation class of a face normal against model +Z, within one degree.
 *
 * **Example** (A 45° flap is inclined)
 *
 * ```ts
 * import { surfaceClassOf } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(surfaceClassOf([0, -Math.SQRT1_2, Math.SQRT1_2])) // "inclined"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const surfaceClassOf = (normal: Vec3): SurfaceClass => {
  const vertical = Math.abs(dot(unitOf(normal), MODEL_UP));
  if (vertical >= COS_TOLERANCE) {
    return "level";
  }
  return vertical <= ANGLE_TOLERANCE ? "upright" : "inclined";
};

const onSheet =
  (view: ViewFacts) =>
  (point: V3): readonly [number, number] => [dot(point, view.right), dot(point, view.up)];

// Narrowest width of the face's projected outline: the extent across each
// projected straight edge (where a convex outline's width is smallest) and
// across every 5° direction, whichever is least.
const projectedSpan = (face: FaceFacts, view: ViewFacts): number => {
  const points = A.map(face.outline, onSheet(view));
  const edgeDirections = pipe(
    face.edges,
    A.map((edge) => {
      const [x, y] = onSheet(view)(minus(edge.end, edge.start));
      return Math.atan2(x, -y);
    })
  );
  const directions = [...A.makeBy(36, (i) => (i * Math.PI) / 36), ...edgeDirections];
  return pipe(
    directions,
    A.map((angle) => {
      const across = A.map(points, ([x, y]) => x * Math.cos(angle) + y * Math.sin(angle));
      return A.isReadonlyArrayNonEmpty(across) ? Math.max(...across) - Math.min(...across) : 0;
    }),
    A.reduce(Number.POSITIVE_INFINITY, (least, width) => Math.min(least, width))
  );
};

/**
 * Presentation of a face in a view: `sliver` when its projected width is
 * under `minFaceSpan` (model units), `square-on` within one degree of the
 * sight line, `oblique` otherwise.
 *
 * **Example** (A 2-wide band under a 3-wide minimum)
 *
 * ```ts
 * import { BoundingBox } from "@beep/technical-drawing"
 * import { aspectOf, viewFactsOf } from "@beep/technical-drawing/Shading.rules"
 * import { FaceFacts } from "@beep/technical-drawing/Shading.schemas"
 * import { Camera } from "@beep/technical-drawing"
 *
 * const face = FaceFacts.make({
 *   normal: [0, -1, 0], center: [0, 0, 1], edges: [],
 *   outline: [[-20, 0, 0], [20, 0, 0], [20, 0, 2], [-20, 0, 2]],
 *   bounds: BoundingBox.make({ min: [-20, 0, 0], max: [20, 0, 2] })
 * })
 * const view = viewFactsOf(Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] }))
 * console.log(aspectOf({ face, view, minFaceSpan: 3 })) // "sliver"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const aspectOf = (input: {
  readonly face: FaceFacts;
  readonly view: ViewFacts;
  readonly minFaceSpan: number;
}): FaceAspect => {
  const { face, view, minFaceSpan } = input;
  if (minFaceSpan > 0 && projectedSpan(face, view) < minFaceSpan) {
    return "sliver";
  }
  return dot(unitOf(face.normal), view.eye) >= COS_TOLERANCE ? "square-on" : "oblique";
};

/**
 * Exposure band: the cosine between a face normal and the 1.84(m) light,
 * banded at 0.6, 0.2, and -0.2. A face seen square-on (exposure 1/√3) is
 * `light`; there is no unshaded band.
 *
 * **Example** (Band a square-on face)
 *
 * ```ts
 * import { toneOf } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(toneOf(1 / Math.sqrt(3))) // "light"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const toneOf = (exposure: number): ShadingTone => {
  if (exposure >= 0.6) {
    return "faint";
  }
  if (exposure >= 0.2) {
    return "light";
  }
  return exposure >= -0.2 ? "medium" : "dark";
};

// How much of a face a tone covers from its shadow edge, and how many lines:
// the 1993 Guide's flat-face examples (Appendix 4, Examples 32 and 36) put a
// few strokes at the shadow edge, the last within about a third of the span,
// and leave a face square to the light nearly bare.
const toneSpacing = (tone: ShadingTone) =>
  ShadingTone.$match(tone, {
    faint: () => ({ coverage: 0.15, minLines: 2, maxLines: 4 }),
    light: () => ({ coverage: 0.3, minLines: 2, maxLines: 5 }),
    medium: () => ({ coverage: 0.35, minLines: 3, maxLines: 7 }),
    dark: () => ({ coverage: 0.35, minLines: 4, maxLines: 8 }),
  });

/**
 * Line offsets of graded shading across a face `span` wide on the sheet,
 * measured from its shadow edge.
 *
 * **Details**
 *
 * The first line sits `minPitch` from the shadow edge; each gap is `1.4`
 * times the one before, capped at `maxPitch`. Lines stop when they pass the
 * tone's share of the span (once its minimum count is drawn) or its maximum
 * count, and never come within `minPitch` of the far edge. A face too narrow
 * for one line gets none. An optional `keep`, given a position and the index
 * the line would take, rejects positions where the face is too narrow for a
 * stroke (a tab, a lip, a pointed tip): the line is not counted and the next
 * position is tried one gap further in, so the strokes move inward instead
 * of vanishing.
 *
 * **Example** (A light 30-wide face)
 *
 * ```ts
 * import { gradedOffsets } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(gradedOffsets({ span: 30, minPitch: 1, maxPitch: 2.5, tone: "light" }))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const gradedOffsets = (input: {
  readonly span: number;
  readonly minPitch: number;
  readonly maxPitch: number;
  readonly tone: ShadingTone;
  readonly keep?: (offset: number, index: number) => boolean;
}): ReadonlyArray<number> => {
  const { span, minPitch } = input;
  const maxPitch = Math.max(input.maxPitch, minPitch);
  const keep = input.keep ?? (() => true);
  const { coverage, minLines, maxLines } = toneSpacing(input.tone);
  const limit = span - minPitch;
  const next = (offsets: ReadonlyArray<number>, at: number, gap: number): ReadonlyArray<number> => {
    const offset = at + gap;
    const drawn = A.length(offsets);
    if (offset > limit || drawn >= maxLines || (drawn >= minLines && offset > coverage * span)) {
      return offsets;
    }
    return keep(offset, drawn)
      ? next([...offsets, offset], offset, Math.min(maxPitch, gap * GROWTH))
      : next(offsets, offset, gap);
  };
  return next([], 0, minPitch);
};

// Length of the chord a cut at `offset` along the anchor's step makes across
// the face, from its straight edges (a curved face answers infinity and keeps
// every position); the hull across a notch, which is what a stroke spans.
const chordAt =
  (face: FaceFacts, anchor: FaceAnchor, direction: V3) =>
  (offset: number): number => {
    const u = (p: V3) => dot(minus(p, anchor.point), direction);
    const v = (p: V3) => dot(minus(p, anchor.point), anchor.step);
    const hits = pipe(
      face.edges,
      A.map((e): O.Option<number> => {
        const v0 = v(e.start);
        const v1 = v(e.end);
        if (v0 === v1 || (v0 - offset) * (v1 - offset) > 0) {
          return O.none();
        }
        const t = (offset - v0) / (v1 - v0);
        return O.some(u(e.start) + t * (u(e.end) - u(e.start)));
      }),
      A.getSomes
    );
    return A.isReadonlyArrayNonEmpty(hits) ? Math.max(...hits) - Math.min(...hits) : Number.POSITIVE_INFINITY;
  };

/**
 * Drawn fraction of each graded line's chord, by line count: the first
 * `fullLines` lines (two by default) run full length and the rest shorten
 * evenly from 60% to 40%.
 *
 * **Details**
 *
 * The taper is the 1993 Guide's (Appendix 4, Examples 32 and 34): strokes
 * are longest at the shadow edge and shorten toward the light, each centred
 * on the chord it would have filled. A face turned toward the light gets no
 * full-length line at all (`fullLines` 0): its one or two strokes are short.
 *
 * **Example** (Five lines, and two short strokes on a lit face)
 *
 * ```ts
 * import { gradedExtents } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(gradedExtents({ count: 5 })) // [1, 1, 0.6, 0.5, 0.4]
 * console.log(gradedExtents({ count: 2, fullLines: 0 })) // [0.6, 0.4]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const gradedExtents = (input: {
  readonly count: number;
  readonly fullLines?: number;
}): ReadonlyArray<number> => {
  const { count } = input;
  const fullLines = input.fullLines ?? FULL_LINES;
  return count <= 0
    ? A.empty()
    : A.makeBy(count, (index) =>
        index < fullLines
          ? 1
          : TAPER_FROM - (TAPER_FROM - TAPER_TO) * ((index - fullLines) / Math.max(1, count - fullLines - 1))
      );
};

// Two shading segments sit side by side when they run within two degrees of
// each other and overlap along their length by more than the minimum spacing;
// collinear pieces (one line split by a hidden part) are 0.01 apart or less
// and do not count.
const PARALLEL_SINE = Math.sin((2 * Math.PI) / 180);
const COLLINEAR = 0.01;

/**
 * Distance between two segments that sit side by side: within two degrees
 * of parallel, overlapping along their length by more than `minOverlap`
 * (default `minSpacing`), and closer than `maxGap` (default `minSpacing`,
 * measured from the second segment's midpoint to the first one's line).
 * Collinear pieces, one line split by a hidden part, are none.
 *
 * **Example** (Two lines 0.3 apart)
 *
 * ```ts
 * import { sideBySideGap } from "@beep/technical-drawing/Shading.rules"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(sideBySideGap({ first: [0, 0, 10, 0], second: [0, 0.3, 10, 0.3], minSpacing: 0.5 }))) // 0.3
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sideBySideGap = (input: {
  readonly first: Segment2;
  readonly second: Segment2;
  readonly minSpacing: number;
  readonly maxGap?: number;
  readonly minOverlap?: number;
}): O.Option<number> => {
  const { first: a, second: b, minSpacing } = input;
  const maxGap = input.maxGap ?? minSpacing;
  const minOverlap = input.minOverlap ?? minSpacing;
  const [ax, ay, bx, by] = a;
  const length = Math.hypot(bx - ax, by - ay);
  const otherLength = Math.hypot(b[2] - b[0], b[3] - b[1]);
  if (length < COLLINEAR || otherLength < COLLINEAR) {
    return O.none();
  }
  const ux = (bx - ax) / length;
  const uy = (by - ay) / length;
  const sine = Math.abs(ux * (b[3] - b[1]) - uy * (b[2] - b[0])) / otherLength;
  const along = (x: number, y: number) => (x - ax) * ux + (y - ay) * uy;
  const start = along(b[0], b[1]);
  const end = along(b[2], b[3]);
  const overlap = Math.min(length, Math.max(start, end)) - Math.max(0, Math.min(start, end));
  const distance = Math.abs(((b[1] + b[3]) / 2 - ay) * ux - ((b[0] + b[2]) / 2 - ax) * uy);
  return sine <= PARALLEL_SINE && overlap > minOverlap && distance > COLLINEAR && distance < maxGap
    ? O.some(distance)
    : O.none();
};

const segmentLength = (s: Segment2): number => Math.hypot(s[2] - s[0], s[3] - s[1]);

/**
 * Distance from a point to a segment, in the segment's units.
 *
 * **Example** (A point beside a segment)
 *
 * ```ts
 * import { pointToSegmentDistance } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(pointToSegmentDistance({ x: 5, y: 3, segment: [0, 0, 10, 0] })) // 3
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const pointToSegmentDistance = (input: {
  readonly x: number;
  readonly y: number;
  readonly segment: Segment2;
}): number => {
  const { x, y, segment: s } = input;
  const dx = s[2] - s[0];
  const dy = s[3] - s[1];
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s[0]) * dx + (y - s[1]) * dy) / length2));
  return Math.hypot(x - (s[0] + t * dx), y - (s[1] + t * dy));
};

/**
 * Distance from a point to the nearest of a set of outline segments;
 * infinity when there are none.
 *
 * **Example** (The nearest of two outlines)
 *
 * ```ts
 * import { nearestOutlineDistance } from "@beep/technical-drawing/Shading.rules"
 *
 * console.log(nearestOutlineDistance({ x: 5, y: 3, outlines: [[0, 0, 10, 0], [0, 10, 10, 10]] })) // 3
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const nearestOutlineDistance = (input: {
  readonly x: number;
  readonly y: number;
  readonly outlines: ReadonlyArray<Segment2>;
}): number =>
  pipe(
    input.outlines,
    A.map((segment) => pointToSegmentDistance({ x: input.x, y: input.y, segment })),
    A.reduce(Number.POSITIVE_INFINITY, (least, d) => Math.min(least, d))
  );

/**
 * Shading segments kept legible after hidden-line removal: every piece is
 * drawn back `inset` from both of its ends (so a stroke stops short of the
 * outline it would otherwise touch, whether that is the face's own edge or a
 * part in front of it), a piece then shorter than `minStroke` is dropped (a
 * chord cut to a fragment by a hidden part), and of two segments side by side
 * closer than `minSpacing` the shorter is dropped (two coplanar parts, a flap
 * and its tab, shading one area from their own anchors). With `outlines` and
 * a `clearance`, an end that still stands closer than the clearance to an
 * outline (one it met at a shallow angle) is drawn back further, half a
 * clearance at a time and at most two clearances, and a piece running beside
 * an outline closer than the clearance is dropped.
 *
 * **Example** (A fragment and a doubled line)
 *
 * ```ts
 * import { Segment2 } from "@beep/technical-drawing"
 * import { legibleShading } from "@beep/technical-drawing/Shading.rules"
 *
 * const segments = [Segment2.make([0, 0, 10, 0]), Segment2.make([0, 0.3, 4, 0.3]), Segment2.make([0, 0, 0.5, 0])]
 * console.log(legibleShading({ segments, minStroke: 1, minSpacing: 0.5, inset: 1 })) // [[1, 0, 9, 0]]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const legibleShading = (input: {
  readonly segments: ReadonlyArray<Segment2>;
  readonly minStroke: number;
  readonly minSpacing: number;
  readonly inset?: number;
  readonly outlines?: ReadonlyArray<Segment2>;
  readonly clearance?: number;
}): ReadonlyArray<Segment2> => {
  const inset = Math.max(0, input.inset ?? 0);
  const clearance = Math.max(0, input.clearance ?? 0);
  const outlines = input.outlines ?? [];
  const drawnBack = (s: Segment2): Segment2 => {
    const length = segmentLength(s);
    if (inset <= 0 || length <= 2 * inset) {
      return inset <= 0 ? s : [s[0], s[1], s[0], s[1]];
    }
    const ux = (s[2] - s[0]) / length;
    const uy = (s[3] - s[1]) / length;
    return [s[0] + ux * inset, s[1] + uy * inset, s[2] - ux * inset, s[3] - uy * inset];
  };
  // an end that met an outline at a shallow angle sits almost on it after the
  // inset along the stroke: each end is drawn back further, half a clearance
  // at a time and at most two clearances, until it stands clear of every outline
  const nearest = (x: number, y: number): number => nearestOutlineDistance({ x, y, outlines });
  const cleared = (s: Segment2): Segment2 => {
    const length = segmentLength(s);
    if (clearance <= 0 || A.length(outlines) === 0 || length <= 0) {
      return s;
    }
    const ux = (s[2] - s[0]) / length;
    const uy = (s[3] - s[1]) / length;
    const step = clearance / 2;
    const most = 2 * clearance;
    const back = (x: number, y: number, dx: number, dy: number, soFar: number): number =>
      soFar >= most || nearest(x + dx * soFar, y + dy * soFar) >= clearance ? soFar : back(x, y, dx, dy, soFar + step);
    const a = back(s[0], s[1], ux, uy, 0);
    const b = back(s[2], s[3], -ux, -uy, 0);
    return a + b >= length ? [s[0], s[1], s[0], s[1]] : [s[0] + ux * a, s[1] + uy * a, s[2] - ux * b, s[3] - uy * b];
  };
  // a stroke running beside a drawn outline closer than the clearance (a
  // board's edge seen on edge next to the face it bounds) reads as a doubled
  // line and goes
  const besideOutline = (s: Segment2): boolean =>
    clearance > 0 && A.some(outlines, (o) => O.isSome(sideBySideGap({ first: s, second: o, minSpacing: clearance })));
  const long = pipe(
    input.segments,
    A.map(drawnBack),
    A.map(cleared),
    A.filter((s) => segmentLength(s) >= Math.max(input.minStroke, COLLINEAR) && !besideOutline(s))
  );
  const yieldsTo = (s: Segment2, i: number) => (other: Segment2, j: number) =>
    j !== i &&
    O.isSome(sideBySideGap({ first: s, second: other, minSpacing: input.minSpacing })) &&
    (segmentLength(other) > segmentLength(s) || (segmentLength(other) === segmentLength(s) && j < i));
  return A.filter(long, (s, i) => !A.some(long, yieldsTo(s, i)));
};

// Lengths are compared to the micrometre so the equal edges of a regular face
// tie instead of ordering by floating-point noise.
const lineLength = (edge: FaceEdge): number => Math.round(edge.length * 1e3) / 1e3;

const rise = (edge: FaceEdge): number => Math.abs(edge.end[2] - edge.start[2]);

// Longest first; among equals the most level edge, so a regular face (an
// equilateral lid flap) is hatched along its horizontal edge in every view.
const hatchEdgeOrder = Order.combine(
  Order.flip(Order.mapInput(Order.Number, lineLength)),
  Order.mapInput(Order.Number, rise)
);

const longestEdgeDirection = (face: FaceFacts): O.Option<V3> =>
  pipe(
    face.edges,
    A.sort(hatchEdgeOrder),
    A.head,
    O.map((edge) => unitOf(plus(edge.end, times(edge.start, -1))))
  );

// The straight edge of a level or inclined face whose outward side faces most
// away from the light: strokes along it bunch on the face's darkest edge.
// Only edges at least a quarter as long as the face's longest count, so a tab
// notch or chamfer cannot turn a flap's strokes into a row of ticks; among
// equals the longer edge wins, so a regular lid keeps one direction per set.
const MAJOR_EDGE_SHARE = 0.25;

const majorEdgesOf = (face: FaceFacts): ReadonlyArray<FaceEdge> => {
  const longest = pipe(
    face.edges,
    A.map((edge) => edge.length),
    A.reduce(0, (most, length) => Math.max(most, length))
  );
  return A.filter(face.edges, (edge) => edge.length > 0 && edge.length >= MAJOR_EDGE_SHARE * longest);
};

const darkestEdge = (face: FaceFacts, light: V3): O.Option<FaceEdge> => {
  const normal = unitOf(face.normal);
  const inPlane = minus(light, times(normal, dot(light, normal)));
  const darkness = (edge: FaceEdge): number => {
    const along = unitOf(minus(edge.end, edge.start));
    const side = unitOf(crossOf(normal, along));
    const mid = times(plus(edge.start, edge.end), 0.5);
    const outward = dot(side, minus(mid, face.center)) < 0 ? times(side, -1) : side;
    return -dot(outward, inPlane);
  };
  const order = Order.combine(
    Order.flip(Order.mapInput(Order.Number, (edge: FaceEdge) => Math.round(darkness(edge) * 1e6) / 1e6)),
    Order.flip(Order.mapInput(Order.Number, lineLength))
  );
  return pipe(majorEdgesOf(face), A.sort(order), A.head);
};

const darkestEdgeDirection = (face: FaceFacts, light: V3): O.Option<V3> =>
  O.map(darkestEdge(face, light), (edge) => unitOf(minus(edge.end, edge.start)));

/**
 * Direction the shading lines run along a face, by hatch axis.
 *
 * **Details**
 *
 * `longest-edge`: the face's longest straight edge. `surface-class`: +Z on
 * upright faces; on inclined and level faces the edge whose outward side
 * faces most away from `light` when a light is given (so a lid's strokes
 * bunch on its darkest edge and a hanging flap's run along its lower-right
 * edge instead of shrinking to ticks at its tip), else the level line
 * (`normal × Z`) on an inclined face and the longest edge on a level one (+X
 * on a level face without straight edges, such as a peg's top). None for a
 * `longest-edge` face without straight edges.
 *
 * **Example** (A wall hatches vertically)
 *
 * ```ts
 * import { BoundingBox } from "@beep/technical-drawing"
 * import { hatchDirectionOf } from "@beep/technical-drawing/Shading.rules"
 * import { FaceFacts } from "@beep/technical-drawing/Shading.schemas"
 *
 * const wall = FaceFacts.make({
 *   normal: [0, -1, 0], center: [0, 0, 10], edges: [], outline: [],
 *   bounds: BoundingBox.make({ min: [0, 0, 0], max: [40, 0, 20] })
 * })
 * console.log(hatchDirectionOf({ face: wall, axis: "surface-class" }))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const hatchDirectionOf = (input: {
  readonly face: FaceFacts;
  readonly axis: HatchAxis;
  readonly light?: Vec3;
}): O.Option<Vec3> => {
  const { face } = input;
  const darkest = pipe(
    O.fromNullishOr(input.light),
    O.flatMap((light) => darkestEdgeDirection(face, light))
  );
  return HatchAxis.$match(input.axis, {
    "longest-edge": () => longestEdgeDirection(face),
    "surface-class": () =>
      SurfaceClass.$match(surfaceClassOf(face.normal), {
        upright: () => O.some(MODEL_UP),
        inclined: () => O.orElse(darkest, () => O.some(unitOf(crossOf(unitOf(face.normal), MODEL_UP)))),
        level: () =>
          pipe(
            darkest,
            O.orElse(() => longestEdgeDirection(face)),
            O.orElse(() => O.some(MODEL_X))
          ),
      }),
  });
};

// Fraction of a step along `step` that survives projection toward `eye`: 1
// when the step lies in the picture plane, 0 when it runs along the sight line.
const spread = (step: V3, eye: V3): number => Math.sqrt(Math.max(0, 1 - dot(step, eye) ** 2));

// Distance on the sheet between two lines running along `direction` one unit
// apart along `step`: the projected step's component across the projected lines.
const sheetSpacing = (direction: V3, step: V3, view: ViewFacts): number => {
  const [dx, dy] = onSheet(view)(direction);
  const [sx, sy] = onSheet(view)(step);
  const length = Math.hypot(dx, dy);
  return length < 1e-9 ? 0 : Math.abs(dx * sy - dy * sx) / length;
};

const sign = (value: number): number => (value < 0 ? -1 : 1);

/**
 * Shadow-side anchor of graded lines on a face.
 *
 * **Details**
 *
 * The sheet-plane part of the 1.84(m) light (its component toward the viewer
 * dropped, since the shadow side is read on the sheet), projected into the
 * face plane, points to the lit side; the anchor is the outline point
 * farthest the other way along `step`, and
 * the returned step points from it into the face. When the light has no
 * component along `step` (a face lit edge-on to its lines), the shadow side
 * is the sheet's lower right. With a `shadowEdge` (the darkest edge the
 * lines follow), the shadow side is that edge's side of the face, so the band
 * bunches on the edge its lines run along. The anchor is taken from the face's major
 * straight edges (at least a quarter as long as its longest), so a tab or
 * chamfer sticking out past a side does not move the band; a face without
 * straight edges anchors on its outline. The anchor edge is the first
 * straight edge, in the kernel's order, that runs along `direction` through
 * the anchor's line.
 *
 * **Example** (A square-on wall anchors on its right edge)
 *
 * ```ts
 * import { BoundingBox, Camera } from "@beep/technical-drawing"
 * import { anchorOf, viewFactsOf } from "@beep/technical-drawing/Shading.rules"
 * import { FaceFacts } from "@beep/technical-drawing/Shading.schemas"
 *
 * const wall = FaceFacts.make({
 *   normal: [0, -1, 0], center: [0, 0, 10], edges: [],
 *   outline: [[-20, 0, 0], [20, 0, 0], [20, 0, 20], [-20, 0, 20]],
 *   bounds: BoundingBox.make({ min: [-20, 0, 0], max: [20, 0, 20] })
 * })
 * const view = viewFactsOf(Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] }))
 * console.log(anchorOf({ face: wall, view, direction: [0, 0, 1] }).point) // [20, 0, 0]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const anchorOf = (input: {
  readonly face: FaceFacts;
  readonly view: ViewFacts;
  readonly direction: Vec3;
  readonly shadowEdge?: FaceEdge;
}): FaceAnchor => {
  const { face, view, direction } = input;
  const normal = unitOf(face.normal);
  const across = unitOf(crossOf(normal, direction));
  // The shadow side is read on the sheet: the light's component toward the
  // viewer makes faces lit but must not pick the near end of a receding wall.
  const sheetLight = minus(view.light, times(view.eye, dot(view.light, view.eye)));
  const inPlaneLight = minus(sheetLight, times(normal, dot(sheetLight, normal)));
  const toLight = dot(across, inPlaneLight);
  // lit edge-on to its lines, a face shades its sheet-right side, or its
  // bottom when its step runs straight up the sheet
  const sheetRight = dot(across, view.right);
  const sheetShadow = Math.abs(sheetRight) > 1e-6 ? sheetRight : -dot(across, view.up);
  // lines that follow the face's darkest edge bunch on that edge's side
  const edgeSide = O.map(O.fromNullishOr(input.shadowEdge), (edge) =>
    sign(dot(across, minus(times(plus(edge.start, edge.end), 0.5), face.center)))
  );
  const toShadow = O.getOrElse(edgeSide, () =>
    Math.abs(toLight) > EDGE_ON_LIGHT ? -sign(toLight) : sign(sheetShadow)
  );
  const shadow = times(across, toShadow);
  // the anchor is read from the face's major edges, so a tab or chamfer that
  // sticks out past the face's side cannot pull the band outside it
  const majors = majorEdgesOf(face);
  const candidates = A.isReadonlyArrayNonEmpty(majors) ? A.flatMap(majors, (e) => [e.start, e.end]) : face.outline;
  const point = pipe(
    candidates,
    A.reduce(O.none<V3>(), (best, candidate) =>
      O.match(best, {
        onNone: () => O.some(candidate),
        onSome: (current) => (dot(candidate, shadow) > dot(current, shadow) + 1e-9 ? O.some(candidate) : best),
      })
    ),
    O.getOrElse(() => face.center)
  );
  const reach = dot(point, shadow);
  const tolerance = 1e-6 * Math.max(1, Math.abs(reach));
  const edge = A.findFirst(
    face.edges,
    (e) =>
      Math.abs(dot(e.start, shadow) - reach) <= tolerance &&
      Math.abs(dot(e.end, shadow) - reach) <= tolerance &&
      e.length > 0
  );
  return FaceAnchor.make({ point, step: times(shadow, -1), edge });
};

const skipped = (reason: ShadingSkipReason): FaceTreatment => ShadingSkipped.make({ reason });

// Exposure → pitch of the uniform style: `minPitch` at -1, `maxPitch` at the
// lit threshold, none above it.
const uniformPitch = (exposure: number, plan: ShadingPlan): O.Option<number> => {
  if (exposure > plan.litThreshold) {
    return O.none();
  }
  const t = (exposure + 1) / (plan.litThreshold + 1);
  return O.some(plan.minPitch + (plan.maxPitch - plan.minPitch) * Math.max(0, Math.min(1, t)));
};

// Lines centred on the face with a half-pitch phase so none lands on the
// face's own boundary, reaching the kernel bounding box's diagonal each way.
const centredLines = (face: FaceFacts, step: V3, pitch: number): FaceTreatment => {
  const { min, max } = face.bounds;
  const reach = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const count = Math.floor((2 * reach) / pitch);
  return ShadingLines.make({
    origin: face.center,
    step,
    cuts: A.makeBy(count + 1, (i) => ShadingCut.make({ offset: -reach + pitch * (i + 0.5) })),
  });
};

// The original hatch: lines along the longest edge, stepped across it unless
// that step is too foreshortened, in which case along it.
const legacyTreatment = (face: FaceFacts, view: ViewFacts, pitch: number): FaceTreatment =>
  pipe(
    longestEdgeDirection(face),
    O.match({
      onNone: () => skipped("no-straight-edge"),
      onSome: (direction) => {
        const across = unitOf(crossOf(face.normal, direction));
        const step =
          spread(across, view.eye) >= MIN_SPREAD || spread(across, view.eye) >= spread(direction, view.eye)
            ? across
            : direction;
        const visibleSpread = spread(step, view.eye);
        return visibleSpread < MIN_SPREAD ? skipped("edge-on") : centredLines(face, step, pitch / visibleSpread);
      },
    })
  );

const gradedTreatment = (input: {
  readonly face: FaceFacts;
  readonly view: ViewFacts;
  readonly plan: ShadingPlan;
  readonly direction: V3;
  readonly factor: number;
  readonly window: O.Option<ShadingWindow>;
  readonly shadowEdge: O.Option<FaceEdge>;
}): FaceTreatment => {
  const { face, view, plan, direction, factor, window } = input;
  const anchor = anchorOf({
    face,
    view,
    direction,
    ...O.match(input.shadowEdge, { onNone: () => ({}), onSome: (shadowEdge) => ({ shadowEdge }) }),
  });
  const reach = pipe(
    face.outline,
    A.map((point) => dot(minus(point, anchor.point), anchor.step)),
    A.reduce(0, (most, r) => Math.max(most, r))
  );
  // a visible stretch of the face is shaded as a face of its own, from the side nearest the shadow anchor
  const start = O.match(window, { onNone: () => 0, onSome: (w) => w.start });
  const span = O.match(window, { onNone: () => reach, onSome: (w) => w.span }) * factor;
  const tone = toneOf(dot(face.normal, view.light));
  // a stroke needs the face wide enough where it is cut to keep the minimum
  // stroke, at the fraction of the chord its line would draw, after the kernel
  // draws both its ends back one pitch from the outline
  const chord = chordAt(face, anchor, direction);
  const seen = spread(direction, view.eye);
  const needed = plan.minStroke + 2 * plan.minPitch;
  // a lit face carries short strokes only (Example 32: lit faces are nearly bare)
  const fullLines = tone === "faint" ? 0 : FULL_LINES;
  const keep = (offset: number, index: number) =>
    plan.minStroke <= 0 || chord(start + offset / factor) * seen * (index < fullLines ? 1 : TAPER_TO) >= needed;
  const band = gradedOffsets({ span, minPitch: plan.minPitch, maxPitch: plan.maxPitch, tone, keep });
  const extents = gradedExtents({ count: A.length(band), fullLines });
  const cuts = A.map(band, (offset, index) =>
    ShadingCut.make({
      offset: start + offset / factor,
      extent: pipe(
        A.get(extents, index),
        O.getOrElse(() => TAPER_TO)
      ),
    })
  );
  return A.isReadonlyArrayNonEmpty(band)
    ? ShadingLines.make({ origin: anchor.point, step: anchor.step, cuts })
    : skipped("sliver");
};

/**
 * Shading decided for one planar face in one view.
 *
 * **Details**
 *
 * Faces turned away from the viewer are `back-facing` and faces narrower than
 * `minFaceSpan` are `sliver`s. The default plan then reproduces the original
 * hatch (`lit` above the threshold, `no-straight-edge`, `edge-on`). Any other
 * axis or style hatches along {@link hatchDirectionOf} with the true sheet
 * spacing; `graded` lines start at the shadow edge and never skip a face as
 * lit, while `uniform` lines keep the lit threshold and the centred pitch.
 * With a `window`, graded lines are planned for that visible stretch of the
 * face alone, measured along the step from the shadow anchor, so a stretch
 * another part uncovers gets its band at the side nearest the shadow.
 *
 * **Example** (A square-on wall under graded shading)
 *
 * ```ts
 * import { BoundingBox, Camera, ShadingPlan } from "@beep/technical-drawing"
 * import { treatmentFor, viewFactsOf } from "@beep/technical-drawing/Shading.rules"
 * import { FaceFacts } from "@beep/technical-drawing/Shading.schemas"
 *
 * const wall = FaceFacts.make({
 *   normal: [0, -1, 0], center: [0, 0, 10], edges: [],
 *   outline: [[-20, 0, 0], [20, 0, 0], [20, 0, 20], [-20, 0, 20]],
 *   bounds: BoundingBox.make({ min: [-20, 0, 0], max: [20, 0, 20] })
 * })
 * const view = viewFactsOf(Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] }))
 * const plan = ShadingPlan.make({ minPitch: 1, maxPitch: 3, style: "graded", axis: "surface-class" })
 * console.log(treatmentFor({ face: wall, view, plan }).kind) // "lines"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const treatmentFor = (input: {
  readonly face: FaceFacts;
  readonly view: ViewFacts;
  readonly plan: ShadingPlan;
  readonly window?: ShadingWindow;
}): FaceTreatment => {
  const { face, view, plan } = input;
  if (!(dot(face.normal, view.eye) > BACK_FACING)) {
    return skipped("back-facing");
  }
  if (aspectOf({ face, view, minFaceSpan: plan.minFaceSpan }) === "sliver") {
    return skipped("sliver");
  }
  const exposure = dot(face.normal, view.light);
  const pitch = uniformPitch(exposure, plan);
  if (plan.style === "uniform" && O.isNone(pitch)) {
    return skipped("lit");
  }
  if (plan.style === "uniform" && plan.axis === "longest-edge") {
    return legacyTreatment(
      face,
      view,
      O.getOrElse(pitch, () => plan.maxPitch)
    );
  }
  return pipe(
    hatchDirectionOf({ face, axis: plan.axis, light: view.light }),
    O.match({
      onNone: () => skipped("no-straight-edge"),
      onSome: (direction) => {
        const step = unitOf(crossOf(unitOf(face.normal), direction));
        const factor = sheetSpacing(direction, step, view);
        if (factor < MIN_SPREAD) {
          return skipped("edge-on");
        }
        // under the surface-class axis a level or inclined face follows its darkest edge, and its band bunches there
        const shadowEdge =
          plan.axis === "surface-class" && surfaceClassOf(face.normal) !== "upright"
            ? darkestEdge(face, view.light)
            : O.none<FaceEdge>();
        return plan.style === "graded"
          ? gradedTreatment({
              face,
              view,
              plan,
              direction,
              factor,
              window: input.window === undefined ? O.none() : O.some(input.window),
              shadowEdge,
            })
          : centredLines(face, step, O.getOrElse(pitch, () => plan.maxPitch) / factor);
      },
    })
  );
};

/**
 * Coverage counts of a view: faces given lines, and skipped faces per reason
 * in {@link ShadingSkipReason} order, zero counts left out.
 *
 * **Example** (Two shaded faces and one sliver)
 *
 * ```ts
 * import { coverageOf } from "@beep/technical-drawing/Shading.rules"
 * import { ShadingCut, ShadingLines, ShadingSkipped } from "@beep/technical-drawing/Shading.schemas"
 *
 * const lines = ShadingLines.make({ origin: [0, 0, 0], step: [1, 0, 0], cuts: [ShadingCut.make({ offset: 1 })] })
 * console.log(coverageOf([lines, lines, ShadingSkipped.make({ reason: "sliver" })]))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const coverageOf = (treatments: ReadonlyArray<FaceTreatment>): ShadingCoverage => {
  const reasons = pipe(
    treatments,
    A.filter(FaceTreatment.guards.skipped),
    A.map((t) => t.reason)
  );
  return ShadingCoverage.make({
    shadedFaces: A.length(treatments) - A.length(reasons),
    skippedFaces: pipe(
      ShadingSkipReason.literals,
      A.map((reason) => ShadingSkip.make({ reason, faces: A.length(A.filter(reasons, (r) => r === reason)) })),
      A.filter((skip) => skip.faces > 0)
    ),
  });
};
